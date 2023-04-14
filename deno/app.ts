import neo4j from "https://deno.land/x/neo4j_lite_client@4.4.6/mod.ts";
import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { send } from "https://deno.land/x/oak@v11.1.0/send.ts";
import { getQuery } from "https://deno.land/x/oak@v11.1.0/helpers.ts";
import { load } from "https://deno.land/std@0.175.0/dotenv/mod.ts";
import { queryBuildWhereAnd, relationshipListToQuery, parseNumberArrayString } from "./helpers.ts";

const env = Object.assign(Deno.env.toObject(), await load());

const URI = env.NEO4J_URI;
const driver = neo4j.driver(
    URI,
    neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
);
const session = driver.session();

const app = new Application();

const router = new Router({ prefix: "/api" });
router
    //Gets the shortest path between source and destination
    .get("/synthesis/shortest-path/source/:source/dest/:dest", async (context) => {
        const source = parseInt(context.params.source);
        const dest = parseInt(context.params.dest);
        const args = getQuery(context);

        let synthesisCategoryBlacklistIDs: number[] = [];
        if (args.synthesisCategoryBlacklist) {
            synthesisCategoryBlacklistIDs = parseNumberArrayString(args.synthesisCategoryBlacklist);
        }

        const noRecipeMorphs = args.noRecipeMorphs;

        //Query
        const queryStart = `MATCH path = allShortestPaths((source:Item{item_id:$source})-[:SYNTHESISES_TO*]->(dest:Item{item_id:$dest}))
        `;

        //Adds the where clause
        //Adds the synthesis category blacklist
        const andClauses = [];
        if (synthesisCategoryBlacklistIDs.length !== 0) {
            const pre = () => { return "NOT"; };
            const n1 = () => { return "item"; };
            const r = () => { return ":SYNTHESIS_CATEGORISED_BY"; };
            const n2 = (item: number) => { return `{synthesis_category_id:${item}}`; };
            const synthesisCategoryBlacklist = relationshipListToQuery(synthesisCategoryBlacklistIDs, pre, n1, r, n2);

            andClauses.push(`ALL (item IN nodes(path) ${queryBuildWhereAnd(synthesisCategoryBlacklist)})
            `);
        }

        //Removes recipe morphs from the search
        if (noRecipeMorphs === "true") {
            andClauses.push(`ALL (edge in relationships(path) WHERE edge.evolves_into IS NULL)
                `);
        }
        const queryWhere = queryBuildWhereAnd(andClauses);



        const queryEnd = `WITH collect(path) AS paths, length(path) AS length
            CALL apoc.convert.toTree(paths, false)
            YIELD value
            RETURN value AS shortest_path, length, size(paths) as size;
        `;

        const query = queryStart + queryWhere + queryEnd;

        const result = (await session.run(query, { source: source, dest: dest })).records[0];

        let shortestPath;
        if (result) {
            shortestPath = result.get("shortest_path");
        } else {
            //If no path found
            context.response.body = { "summary": { "status": "not found" }, "path": "" };
            return;
        }

        //Adds recipes
        let items = [shortestPath];
        const seenRecipes = new Map();
        while (items.length > 0) {
            //Take item and add items it synthesises into
            const item = items.pop();
            if (item.SYNTHESISES_TO) {
                items = items.concat(item.SYNTHESISES_TO);
            }

            //Add recipe
            if (!seenRecipes.has(item._id)) {
                seenRecipes.set(item._id, await getRecipe(item._id));
            }

            item.recipe = seenRecipes.get(item._id);
        }

        //Return result
        context.response.body = { "summary": { "status": "success", "length": result.get("length"), "number_of_paths": result.get("size") }, "path": shortestPath };
    })
    //Lists all synthesis cetegories
    .get("/synthesis-category", async (context) => {
        const query = `
            MATCH (synthesisCategory:SynthesisCategory) 
            RETURN synthesisCategory
        `;
        const result = await session.run(query);
        const synthesisCategories = result.records.map(item => item.get("synthesisCategory"));
        context.response.body = synthesisCategories;
    })
    //Simple search for items
    .get("/search/item/:searchQuery", async (context) => {
        let query = "";
        const searchQuery = context.params.searchQuery;
        const args = getQuery(context);

        let synthesisCategoryBlacklist: number[] = [];
        if (args.synthesisCategoryBlacklist) {
            synthesisCategoryBlacklist = parseNumberArrayString(args.synthesisCategoryBlacklist);
        }

        if (args.synthesisOnly === "true") {
            query = `
                MATCH (item:Item)-[:SYNTHESIS_CATEGORISED_BY]->(blacklist)  
                    WHERE 
                        toLower(item.name_en) CONTAINS toLower($searchQuery)
                        AND NOT blacklist.synthesis_category_id IN $synthesisCategoryBlacklist
                
                return item LIMIT 10
            `;
        } else {
            query = `
                MATCH (i:Item)
                    WHERE toLower(i.name_en) CONTAINS toLower($searchQuery)

                CALL {
                    WITH i
                    OPTIONAL MATCH (i)-[:SYNTHESIS_CATEGORISED_BY]->(synthCat)  
                    CALL {
                        WITH i, synthCat
                        WITH i AS item, synthCat AS blacklist
                        WHERE blacklist IS NULL OR NOT blacklist.synthesis_category_id IN $synthesisCategoryBlacklist
                        RETURN item
                    }
                    RETURN item
                }

                RETURN item LIMIT 10
        `;
        }

        const result = await session.run(query, { searchQuery: searchQuery, synthesisCategoryBlacklist: synthesisCategoryBlacklist });
        const items = result.records.map(item => item.get("item"));
        context.response.body = items;
    });

//Gets recipes
async function getRecipe(id: number) {
    const query = `
            MATCH recipe_paths = ((item:Item)-[:HAS_RECIPE]->(:RecipeNode)-[:CONNECTS_TO*]->(:RecipeNode))
            WHERE ID(item) = $id
            WITH collect(recipe_paths) AS recipe
            CALL apoc.convert.toTree(recipe, false)
            YIELD value
            RETURN value as recipe;
        `;
    const result = await session.run(query, { id: id });
    const recipe = result.records[0].get("recipe").HAS_RECIPE;

    return recipe ? recipe[0] : undefined;
}

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

//Main site
app.use(async (context, next) => {
    try {
        await send(context, context.request.url.pathname, { root: "site/", index: "pages/index.html" });
    } catch (_) {
        await next();
    }
});

//404
app.use((context) => {
    context.response.type = "text/html; charset=utf-8";
    context.response.status = 404;
    context.response.body = "<h1>404, Page not found!</h1>";
});

await app.listen({ port: 8000 });