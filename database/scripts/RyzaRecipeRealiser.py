from neo4j import GraphDatabase
import ItemRecipe

elementToID = {
    ItemRecipe.ELEMENT_FIRE: 0,
    ItemRecipe.ELEMENT_ICE: 1,
    ItemRecipe.ELEMENT_THUNDER: 2,
    ItemRecipe.ELEMENT_AIR: 3
}

class RyzaRecipeRealiser:

    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()
    
    def writeElements(self):
        """Writes the elements to the database
        """
        with self.driver.session() as session:
            session.run("CREATE (:Element {string_id:'4063340', element_id:0}) " #fire
                        "CREATE (:Element {string_id:'4063341', element_id:1}) " #ice
                        "CREATE (:Element {string_id:'4063342', element_id:2}) " #lightning
                        "CREATE (:Element {string_id:'4063343', element_id:3}) ")#wind
    
    def writeCats(self, categoryStringIDs):
        """Writes the categories to the database

        Args:
            categoryIDs (str[]): list of category ids
        """
        categoryID = 0
        with self.driver.session() as session:
            for stringID in categoryStringIDs:
                session.run("CREATE (:Category {string_id:$stringID, category_id:$categoryID})", stringID = stringID, categoryID = categoryID)
                categoryID += 1

    def writeSynthCats(self, synthCatStringIDs):
        """Writes the synthesis categories to the database

        Args:
            synthCatIDs (str[]): list of synthesis category ids 
        """
        synthCatID = 0
        with self.driver.session() as session:
            for stringID in synthCatStringIDs:
                session.run("CREATE (:SynthesisCategory {string_id:$stringID, synthesis_category_id:$synthCatID})", stringID = stringID, synthCatID = synthCatID)
                synthCatID += 1

    def writeItemRecipes(self, itemRecipes, itemEnums):
        """Writes the items and their recipes to the database

        Args:
            itemRecipes (Item[]): The items to add to the database
            itemEnums (ItemIDEnumDict): The dictionaries used to convert enums and ids
        """
        
        self.writeItems(itemRecipes)
        self.writeRecipes(itemRecipes, itemEnums)
    
    def writeItems(self, items):
        """Writes the items to the database

        Args:
            itemRecipes (Item[]): The list of items to write
        """
        with self.driver.session() as session:
            itemID = 0
            for item in items:
                #Create item
                session.run("CREATE (:Item {string_id:$stringID, item_id:$itemID})", stringID = item.stringID, itemID = itemID)

                # #Add categories
                for category in item.categories:
                    session.run("MATCH (item:Item {string_id:$itemID}), (cat:Category {string_id:$catID}) "
                    "CREATE (item)-[:CATEGORISED_BY]->(cat)"
                    , itemID = item.stringID, catID = category)
                
                #Add elements
                for element in item.elements:
                    session.run("MATCH (item:Item {string_id:$itemID}), (elem:Element {element_id:$elemID}) "
                    "CREATE (item)-[:HAS_ELEMENT]->(elem)"
                    , itemID = item.stringID, elemID = elementToID[element])
                
                itemID += 1
                

    def writeRecipes(self, itemRecipes, itemEnums):
        """Writes the recipes to the database

        Args:
            itemRecipes (Item[]): The list of items to write that have the database stored
            itemEnums (ItemIDEnumDict): The dictionaries used to convert enums and ids
        """
        with self.driver.session() as session:
            for item in itemRecipes:
                if item.recipe != None:
                    #Connect synthesis category
                    synthCatEnum = item.itemType
                    if synthCatEnum == "ITEM_KIND_FIELD": #Replacing the gathering item tag with the synthesis tag since it is functionally the same
                        synthCatEnum = "ITEM_KIND_MIX"
                          
                    session.run("MATCH (item:Item {string_id:$itemID}),(synthCat:SynthesisCategory {string_id:$synthCatID}) "
                                "CREATE (item)-[:SYNTHESIS_CATEGORISED_BY]->(synthCat)"
                                , itemID = item.stringID, synthCatID = itemEnums.enumToID[synthCatEnum])

                    #Create nodes
                    def createNodeID(item, nodeNo):
                        return "R" + str(nodeNo) + "_" + item.stringID
                    createNode = ""
                    matching = ("MATCH (origin:Item {{string_id:'{0}'}}), "
                                "(e0:Element {{element_id:0}}), "
                                "(e1:Element {{element_id:1}}), "
                                "(e2:Element {{element_id:2}}), "
                                "(e3:Element {{element_id:3}}) ").format(item.stringID)
                    createRelationship = "CREATE (origin)-[:HAS_RECIPE]->({0}) ".format(createNodeID(item, 0))
                    usedItems = set()
                    for nodeNo, recipeNode in item.recipe.nodes.items():
                        if recipeNode.itemUsed != None:
                            thisNodeID = createNodeID(item, nodeNo)
                            
                            createNode += "CREATE ({0}:RecipeNode {{node_id:'{0}'}}) ".format(thisNodeID)
                        
                            #Adding what item the node needs
                            if recipeNode.itemUsed not in usedItems:
                                usedItems.add(recipeNode.itemUsed)
                                matching += "MATCH ({0} {{string_id:'{1}'}}) ".format(recipeNode.itemUsed, itemEnums.enumToID[recipeNode.itemUsed])
                            createRelationship += "CREATE ({0})<-[:USED_IN]-({1}) ".format(thisNodeID, recipeNode.itemUsed)

                            #Adds the elements needed to unlock
                            if recipeNode.unlock != None:
                                createRelationship += "CREATE ({0})<-[:UNLOCKS {{cost:{1}}}]-(e{2}) ".format(thisNodeID, recipeNode.unlock.cost, recipeNode.unlock.element)

                            #Adds the elements needed to increase effect level
                            createRelationship += "CREATE ({0})<-[:ADDS_EFFECT]-(e{1})".format(thisNodeID, recipeNode.effectElem)

                            #Connects the nodes to each other
                            for child in recipeNode.children:
                                createRelationship += "CREATE ({0})-[:CONNECTS_TO {{draw_dir:{1}}}]->({2}) ".format(thisNodeID, child["drawDir"] ,createNodeID(item, child["child"]))
                            
                            #Working with added effects
                            for effect in recipeNode.effects:
                                #Adds the category the node unlocks
                                if effect.name in itemEnums.addCat:
                                    matching += "MATCH ({0}:Category {{string_id:'{1}'}}) ".format(effect.name, itemEnums.addCat[effect.name])
                                    createRelationship += "CREATE ({0})-[:ADDS_CATEGORY]->({1}) ".format(thisNodeID, effect.name)
                                    # createRelationship += "CREATE ({0})-[:ADD_CAT_REQUIRES"

                                #Adds the element the node unlocks
                                elif effect.name in itemEnums.addElem:
                                    matching += "MATCH ({0}:Element {{string_id:'{1}'}}) ".format(effect.name, itemEnums.addElem[effect.name])
                                    createRelationship += "CREATE ({0})-[:ADDS_ELEMENT]->({1}) ".format(thisNodeID, effect.name)

                                #Unlocks a new recipe
                                elif effect.name.startswith("ITEM_RECIPE_"):
                                    newRecipe = effect.name[len("ITEM_RECIPE_"):]
                                    if newRecipe in itemEnums.enumToID:
                                        matching += "MATCH ({0}:Item {{string_id:'{1}'}}) ".format(effect.name, itemEnums.enumToID[newRecipe])
                                        createRelationship += "CREATE ({0})-[:UNLOCKS_RECIPE]->({1}) ".format(thisNodeID, effect.name)
                                
                                else:
                                    break
                    session.run(matching + createNode + createRelationship)
                    print("Added", item.recipe.meta.recipeName)

    def clearDB(self):
        """Clears the database
        """
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")

    def createDB(self, itemRecipes, itemEnumDict):
        """Creates the database 

        Args:
            itemRecipes (Item[]): The items to add to the database
            itemEnums (ItemIDEnumDict): The dictionaries used to convert enums and ids
        """
        self.clearDB()
        
        self.writeElements()
        categoryIDs = [string_id for enum, string_id in itemEnumDict.enumToID.items() if enum.startswith("ITEM_CATEGORY")]
        self.writeCats(categoryIDs)
        unusedSynthCats = ["ITEM_KIND_EXPENDABLE", "ITEM_KIND_MATERIAL", "ITEM_KIND_CORE", "ITEM_KIND_SUPPORT", "ITEM_KIND_BOOK", "ITEM_KIND_FIELD"]
        synthCatIDs =  [string_id for enum, string_id in itemEnumDict.enumToID.items() if enum.startswith("ITEM_KIND_") and enum not in unusedSynthCats]
        self.writeSynthCats(synthCatIDs)

        self.writeItemRecipes(itemRecipes, itemEnumDict)

    def applyTranslation(self, stringIDToLang, language):
        """Applies the translations to the database

        Args:
            stringIDToLang (dict of str:str): Links the string id to the translation
            language (str): The language used
        """
        with self.driver.session() as session:
            result = session.run("MATCH (n) WHERE n.string_id IS NOT NULL RETURN n.string_id")
            stringIDs = result.value()

            addLangQuery = "MATCH (n {{string_id:$ID}}) SET n.name_{0} = $name".format(language)
            for stringID in stringIDs:
                if stringID in stringIDToLang:
                    session.run(addLangQuery, ID = stringID, name = stringIDToLang[stringID])
                else:
                    print("String id", stringID, "is missing from the dictionary")

    def connectForFrontEnd(self):
        with self.driver.session() as session:
            print("Add synthesises_to that doesn't require unlocking a new category")
            session.run("""
                MATCH p = (i:Item)-[:CATEGORISED_BY]->(c:Category)-[:USED_IN]->(:RecipeNode)<-[:CONNECTS_TO|HAS_RECIPE*]-(i2:Item)
                MERGE (i)-[:SYNTHESISES_TO{needs_unlock:FALSE, category_used_en:c.name_en}]->(i2)
            """)

            print("Add synthesises_to that does require unlocking a new category")
            session.run("""
                MATCH p = (i:Item)-[:HAS_RECIPE]->(:RecipeNode)-[:CONNECTS_TO*]->(:RecipeNode)-[:ADDS_CATEGORY]->(c:Category)-[:USED_IN]->(:RecipeNode)<-[:CONNECTS_TO|HAS_RECIPE*]-(i2:Item)
                MERGE (i)-[:SYNTHESISES_TO{needs_unlock:TRUE, category_used_en:c.name_en}]->(i2)
            """)

            print("Add synthesises_to that directly needs an item")
            session.run("""
                MATCH p = (i:Item)-[:USED_IN]->(:RecipeNode)<-[:HAS_RECIPE|CONNECTS_TO*]-(i2:Item)
                MERGE (i)-[:SYNTHESISES_TO{directly_used:TRUE}]->(i2)
            """)

            print("Add synthesises_to that evolves into an item")
            session.run("""
                MATCH p = (i:Item)-[:HAS_RECIPE]->(:RecipeNode)-[:CONNECTS_TO*]->(:RecipeNode)-[:UNLOCKS_RECIPE]->(i2:Item)
                MERGE (i)-[:SYNTHESISES_TO{evolves_into:TRUE}]->(i2)
            """)

            print("Set category relation to not need unlock")
            session.run("""
                MATCH (i:Item)-[r:CATEGORISED_BY]->(c:Category)
                SET r.needs_unlock = FALSE
            """)

            print("Sets category relation to need unlock")
            session.run("""
                MATCH (i:Item)-[:HAS_RECIPE]->()-[:CONNECTS_TO*]->()-[r:ADDS_CATEGORY]->(c:Category)
                MERGE (i)-[:CATEGORISED_BY{needs_unlock:TRUE}]->(c)
            """)
            
            print("Adds no unlock categories to item")
            session.run("""
                MATCH (i:Item)-[r:CATEGORISED_BY{needs_unlock:FALSE}]->(c:Category)
                WITH COLLECT(c.name_en) as cats, i
                SET i.categories_nat_en=cats
            """)
            
            print("Adds unlock categories to item")
            session.run("""
                MATCH (i:Item)-[r:CATEGORISED_BY{needs_unlock:TRUE}]->(c:Category)
                WITH COLLECT(c.name_en) as cats, i
                SET i.categories_add_en=cats
            """)

            print("Set element relation to not need unlock")
            session.run("""
                MATCH (i:Item)-[r:HAS_ELEMENT]->(e:Element)
                SET r.needs_unlock = FALSE
            """)

            print("Sets element relation to need unlock")
            session.run("""
                MATCH (i:Item)-[:HAS_RECIPE]->()-[:CONNECTS_TO*]->()-[r:ADDS_ELEMENT]->(e:Element)
                MERGE (i)-[:HAS_ELEMENT{needs_unlock:TRUE}]->(e)
            """)
            
            print("Adds no unlock elements to item")
            session.run("""
                MATCH (i:Item)-[r:HAS_ELEMENT{needs_unlock:FALSE}]->(e:Element)
                WITH COLLECT(e.name_en) as elems, i
                SET i.elements_nat_en=elems
            """)
            
            print("Adds unlock categories to item")
            session.run("""
                MATCH (i:Item)-[r:HAS_ELEMENT{needs_unlock:TRUE}]->(e:Element)
                WITH COLLECT(e.name_en) as elems, i
                SET i.elements_add_en=elems
            """)
            
            print("Adds item id to the recipe node")
            session.run("""
                MATCH (i:Item)-[:HAS_RECIPE|CONNECTS_TO*]->(r:RecipeNode)
                SET r.item_id = id(i)
            """)

            print("Adds element to recipe node")
            session.run("""
                MATCH (r:RecipeNode)<-[:ADDS_EFFECT]-(e:Element)
                SET r.element_required_en = e.name_en
            """)

            print("Adds item to recipe node")
            session.run("""
                MATCH (r:RecipeNode)<-[:USED_IN]-(e)
                SET r.item_type_needed = e.name_en
            """)

            print("Adds unlock to recipe edge")
            session.run("""
                MATCH (:RecipeNode)-[c:CONNECTS_TO]-(:RecipeNode)<-[:UNLOCKS]-(e)
                SET c.element_unlock_en = e.name_en
            """)


