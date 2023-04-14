var edgeColour = "#E69600";
var itemSpacing = 300;
var recipeXOrigin = -350;
var recipeSpacing = 65;
var elementColours = {
    Wind: { node: "#67A158", edge: "#468037" },
    Ice: { node: "#409DB1", edge: "#1C788C" },
    Lightning: { node: "#E2E087", edge: "#B4B259" },
    Fire: { node: "#BA585A", edge: "#933133" },
};
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

async function drawShortestPath(sourceItem, destItem) {
    // validate input
    if (sourceItem == null || destItem == null) {
        this.isSuccess = false;
        this.message = "Starting and final items needed.";
        return;
    }

    Alpine.store("loading").loading = true;

    let url = `https://ryza-recipe-realiser.deno.dev/api/synthesis/shortest-path/source/${sourceItem}/dest/${destItem}`;
    url += "?" + new URLSearchParams(this.filters).toString();

    const container = document.getElementById("vis");
    let response;
    try {
        response = await fetch(url);
    } catch (error) {
        this.isSuccess = false;
        this.message = "There is a problem with the server. Please try again.";
        Alpine.store("loading").loading = false;
        container.replaceChildren();
        return;
    }
    const result = await response.json();

    // const result = examplePath;
    if (result.summary.status !== "success") {
        this.isSuccess = false;
        this.message = "No synthesis found.";
        Alpine.store("loading").loading = false;
        container.replaceChildren();
        return;
    }

    const shortestPath = result.path;

    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const depthItemIDs = [];
    //changes the depthItemIDs, nodes and edges
    parseItemPath(shortestPath, null, 0, depthItemIDs, nodes, edges);

    //draw network
    const options = {
        nodes: {
            fixed: true,
            font: {
                size: 20,
            },
        },
        edges: {
            font: {
                strokeWidth: 0,
                size: 17,
            },
            width: 2,
            smooth: false,
        },
        physics: { enabled: false },
        layout: { improvedLayout: false },
    };
    const data = { nodes: nodes, edges: edges };

    const network = new vis.Network(container, data, options);

    //hide items that cannot be crafted on click
    addClickEvent(network, nodes, depthItemIDs, shortestPath);

    //Adds a minimum and maximum zoom
    const minZoom = network.getScale() / 1.5;
    addMinMaxZoom(network, minZoom, MAX_ZOOM);

    this.isSuccess = true;
    this.length = result.summary.length;
    this.noOfPaths = result.summary.number_of_paths;
    this.message = "Syntheses Found!";
    Alpine.store("loading").loading = false;
}


function parseItemPath(item, parentID, depth, depthItemIDs, nodes, edges) {
    const params = splitEdgeNodeParams(item);

    if (parentID !== null) {
        dashStyle = [];
        if (params.edgeParams.needs_unlock) {
            dashStyle = [5, 5];
        } else if (params.edgeParams.directly_used) {
            dashStyle = [30, 5];
        } else if (params.edgeParams.evolves_into) {
            dashStyle = [20, 10, 5, 5, 5, 10];
        }
        edges.add({
            id: parentID + " " + item._id,
            title: createSynthesisToHoverElement(params.edgeParams),
            from: parentID,
            to: item._id,
            dashes: dashStyle,
            arrows: {
                middle: { enabled: true },
            },
            color: edgeColour,
            raw: params.edgeParams,
        });
    }

    //Set node depth for hiding nodes later
    item.depth = depth;

    //The source data is in a tree structure, so ignore nodes with the same id already added
    if (!nodes.get(item._id)) {
        if (!depthItemIDs[depth]) {
            depthItemIDs[depth] = new Set([item._id]);
        } else {
            depthItemIDs[depth].add(item._id);
        }

        //add item
        const itemNode = {
            id: item._id,
            label: item["name_en"],
            title: createItemHoverElement(item),
            shape: "circularImage",
            size: 50,
            image: createItemIcon(item),
            x: (depthItemIDs[depth].size - 1) * itemSpacing,
            y: depth * itemSpacing,
            color: "#ffffff00",
            depth: depth,
            raw: { ...params.nodeParams },
        };

        // add recipe
        if (item.recipe) {
            const recipeIDs = [];
            startRecipeParse(item.recipe, item._id, recipeXOrigin, depth * itemSpacing, recipeSpacing, recipeIDs, nodes, edges);
            itemNode.raw.recipeIDs = recipeIDs;
        }

        nodes.add(itemNode);

        //add items that this one synthesises to
        if (item.SYNTHESISES_TO) {
            depth++;
            item.SYNTHESISES_TO.forEach((synthToItem) => {
                parseItemPath(synthToItem, item._id, depth, depthItemIDs, nodes, edges);
            });
        }
    }
}

function startRecipeParse(recipeNode, parentItemID, x, y, spacing, recipeIDs, nodes, edges) {
    const params = splitEdgeNodeParams(recipeNode);

    //Adds the recipe edge
    edges.add({
        id: parentItemID + " " + recipeNode._id,
        from: parentItemID,
        to: recipeNode._id,
        dashes: true,
        label: "Recipe",
        color: edgeColour,
        width: 1,
        arrows: {
            to: { enabled: true },
        },
        raw: params.edgeParams,
    });

    nodes.add({
        id: recipeNode._id,
        size: 15,
        hidden: true,
        color: elementColours[params.nodeParams.element_required_en].node,
        title: createRecipeNodeHoverElement(recipeNode),
        shape: "circularImage",
        image: createRecipeIcon(recipeNode),
        x: x,
        y: y,
        raw: params.nodeParams,
    });
    recipeIDs.push(recipeNode._id);

    recipeNode.CONNECTS_TO.forEach((childRecipeNode) => {
        parseRecipe(childRecipeNode, recipeNode._id, x, y, spacing, recipeIDs, nodes, edges);
    });
}

function parseRecipe(recipeNode, parentID, parentX, parentY, spacing, recipeIDs, nodes, edges) {
    const params = splitEdgeNodeParams(recipeNode);

    edges.add({
        id: parentID + " " + recipeNode._id,
        from: parentID,
        to: recipeNode._id,
        color: params.edgeParams.element_unlock_en ? elementColours[params.edgeParams.element_unlock_en].edge : edgeColour,
        arrows: {
            to: { enabled: true },
        },
        raw: params.edgeParams,
    });

    const theta = 60 * params.edgeParams.draw_dir;
    const offset = radiusOffset(spacing, theta);
    const x = parentX + offset.x;
    const y = parentY + offset.y;

    nodes.add({
        id: recipeNode._id,
        size: 15,
        hidden: true,
        color: elementColours[params.nodeParams.element_required_en].node,
        title: createRecipeNodeHoverElement(recipeNode),
        shape: "circularImage",
        image: createRecipeIcon(recipeNode),
        x: x,
        y: y,
        raw: params.nodeParams,
    });
    recipeIDs.push(recipeNode._id);

    if (recipeNode.CONNECTS_TO) {
        recipeNode.CONNECTS_TO.forEach((childRecipeNode) => {
            parseRecipe(childRecipeNode, recipeNode._id, x, y, spacing, recipeIDs, nodes, edges);
        });
    }
}

function addMinMaxZoom(network, minZoom, maxZoom) {
    let lastZoomPosition = { x: 0, y: 0 };
    network.on("zoom", () => {
        let scale = network.getScale();
        if (scale <= minZoom) {
            network.moveTo({ position: lastZoomPosition, scale: minZoom });
        } else if (scale >= maxZoom) {
            network.moveTo({ position: lastZoomPosition, scale: maxZoom });
        } else {
            lastZoomPosition = network.getViewPosition();
        }
    });
    network.on("dragEnd", () => {
        lastZoomPosition = network.getViewPosition();
    });
}

function addClickEvent(network, nodes, depthItemIDs, shortestPath) {
    let hiddenItems = new Set();
    let recipeUpdates = [];
    let itemUpdates = [];
    network.on("click", (e) => {
        if (e.nodes.length === 0) {
            return;
        }
        const node = nodes.get(e.nodes[0]);

        switch (node.raw._type) {
            case "Item":
                ({ hiddenItems, recipeUpdates, itemUpdates } = clickItem(node, hiddenItems, depthItemIDs, recipeUpdates, itemUpdates, shortestPath, nodes));
        }
    });
}

function clickItem(node, hiddenItems, depthItemIDs, recipeUpdates, itemUpdates, shortestPath, nodes) {
    if (node.showRecipe) {
        node.showRecipe = false;
        //unhide peer nodes
        hiddenItems = difference(hiddenItems, depthItemIDs[node.depth]);

        if (node.raw.recipeIDs) {
            recipeUpdates = node.raw.recipeIDs.map((recipeID) => {
                return { id: recipeID, hidden: true };
            });
        }
    } else {
        node.showRecipe = true;
        //hide peer nodes
        for (const itemID of depthItemIDs[node.depth]) {
            if (itemID != node.id) {
                hiddenItems.add(itemID);
            }
        }

        if (node.raw.recipeIDs) {
            recipeUpdates = node.raw.recipeIDs.map((recipeID) => {
                return { id: recipeID, hidden: false };
            });
        }
    }
    //The ids of items to be updated with index indicating depth
    const depthItemUpdateIDs = [];

    itemUpdates = getItemUpdate(shortestPath, hiddenItems, false, depthItemUpdateIDs);
    itemUpdates = arrangeItemUpdates(itemUpdates, depthItemUpdateIDs, depthItemIDs);
    itemUpdates = Array.from(itemUpdates.values());

    nodes.update(itemUpdates);
    nodes.update(recipeUpdates);
    return { hiddenItems, recipeUpdates, itemUpdates };
}

function getItemUpdate(item, hiddenItems, hidden, depthItemIDs) {
    hidden = hidden || hiddenItems.has(item._id);

    //for leaf nodes
    if (!item.SYNTHESISES_TO) {
        const itemUpdates = new Map();
        itemUpdates.set(item._id, { id: item._id, hidden: hidden });
        depthItemIDs[item.depth] = new Set([item._id]);
        return itemUpdates;
    }

    let itemUpdates = new Map();
    let hideCurrent = true;
    for (const childItem of item.SYNTHESISES_TO) {
        //forward hiding
        const childupdates = getItemUpdate(childItem, hiddenItems, hidden, depthItemIDs);

        //backward hiding
        hideCurrent = hideCurrent && childupdates.get(childItem._id).hidden;

        //union the updates - overwrite if path is hidden
        for (const [key, value] of childupdates.entries()) {
            if (!itemUpdates.has(key) || (itemUpdates.has(key) && itemUpdates.get(key).hidden)) {
                itemUpdates.set(key, value);
            }
        }
    }

    if (!hideCurrent) {
        if (!depthItemIDs[item.depth]) {
            depthItemIDs[item.depth] = new Set([item._id]);
        } else {
            depthItemIDs[item.depth].add(item._id);
        }
    }

    itemUpdates.set(item._id, { id: item._id, hidden: hideCurrent });
    return itemUpdates;
}

//Moves items to new positions when their peers are hidden
function arrangeItemUpdates(itemUpdates, depthItemUpdateIDs, depthItemIDs) {
    for (let depth = 1; depth < depthItemIDs.length - 1; depth++) {
        const itemUpdateIDs = depthItemUpdateIDs[depth];
        const itemIDs = depthItemIDs[depth];

        let itemCount = 0;
        itemIDs.forEach((itemID) => {
            if (itemUpdateIDs.has(itemID)) {
                itemCount++;
                const itemUpdate = itemUpdates.get(itemID);
                itemUpdate.x = (itemCount - 1) * itemSpacing;

                if (itemCount == itemUpdateIDs.length) {
                    return;
                }
            }
        });
    }
    return itemUpdates;
}

//Splits the parameters that belong to the edge and the node
function splitEdgeNodeParams(node) {
    const nodeParams = {};
    const edgeParams = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.includes(".")) {
            const newKey = key.split(".")[1];
            edgeParams[newKey] = value;
        } else {
            nodeParams[key] = value;
        }
    }
    return { nodeParams: nodeParams, edgeParams: edgeParams };
}

function createItemHoverElement(item) {
    const template = document.getElementById("itemPopUp");

    const hoverElement = document.createElement("div");
    hoverElement.append(template.content.cloneNode(true));

    hoverElement.querySelector(".itemName").textContent = item.name_en;

    hoverElement.querySelector(".naturalCategories").textContent = arrayToString(item.categories_nat_en);

    if (item.categories_add_en) {
        hoverElement.querySelector(".addedCategories").textContent = arrayToString(item.categories_add_en);
    } else {
        hoverElement.querySelector(".addedCategoriesTitle").remove();
        hoverElement.querySelector(".addedCategories").remove();
    }

    hoverElement.querySelector(".naturalElements").textContent = arrayToString(item.elements_nat_en);
    if (item.elements_add_en) {
        hoverElement.querySelector(".addedElements").textContent = arrayToString(item.elements_add_en);
    } else {
        hoverElement.querySelector(".addedElementsTitle").remove();
        hoverElement.querySelector(".addedElements").remove();
    }

    return hoverElement;
}

function createSynthesisToHoverElement(edge) {
    const template = document.getElementById("synthesisToPopUp");

    const hoverElement = document.createElement("div");
    hoverElement.append(template.content.cloneNode(true));

    if (edge.category_used_en) {
        hoverElement.querySelector(".neededCategory").textContent = edge.category_used_en;
    } else {
        hoverElement.querySelector(".neededCategory").textContent = "";
        if (edge.directly_used) {
            hoverElement.querySelector(".header").textContent = "Directly Used";
        } else if (edge.evolves_into) {
            hoverElement.querySelector(".header").textContent = "Recipe Morphs Into";
        }
    }

    return hoverElement;
}

function createRecipeNodeHoverElement(recipeNode) {
    const template = document.getElementById("recipeNodePopUp");

    const hoverElement = document.createElement("div");
    hoverElement.append(template.content.cloneNode(true));

    if (!icons[recipeNode.item_type_needed]) {
        hoverElement.querySelector(".itemOrCategory").textContent = "Item Used:";
    }

    hoverElement.querySelector(".neededItemType").textContent = recipeNode.item_type_needed;

    return hoverElement;
}

function createRecipeIcon(recipeNode) {
    const width = 512;
    const height = 512;
    const scale = 0.7;

    let image = "";

    if (icons[recipeNode.item_type_needed]) {
        image = icons[recipeNode.item_type_needed].shape;
    } else {
        image = icons["Other"].shape;
    }

    let icon =
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(${width * (1 - scale) / 2},${height * (1 - scale) / 2}) scale(${scale},${scale})">
                <path d="${image}" fill="white"></path>
            </g>
        </svg>`;

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(icon);

    return url;
}

function createItemIcon(item) {
    //Overall dimensions
    const width = 1600;
    const height = 1600;
    const catWidth = 512;
    const catHeight = 512;
    const fillColour = "#B56EAF";
    const strokeColour = "#574055";

    const radius = 512;

    let icon =
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(${width / 2},${height / 2})">
        <circle cx="0" cy="0" r="${radius}" fill="white" stroke="${strokeColour}" stroke-width="50"/>`;

    //Dimensions for the elements
    const elemCount = item.elements_nat_en.length + (item.elements_add_en ? item.elements_add_en.length : 0);
    const elemAngle = 360 / elemCount;
    let elemIndex = 0;

    item.elements_nat_en.forEach((elem) => {
        icon += `<path d="${drawCircleSegment(radius, elemIndex * elemAngle, elemAngle)}" fill="${elementColours[elem].node}"></path>`;
        elemIndex++;
    });

    if (item.elements_add_en) {
        item.elements_add_en.forEach((elem) => {
            icon += `<path d="${drawCircleSegment(radius, elemIndex * elemAngle, elemAngle)}" fill="${elementColours[elem].node}" opacity="0.6"></path>`;
            elemIndex++;
        });
    }

    //Dimensions for the categories
    const catCount = item.categories_nat_en.length + (item.categories_add_en ? item.categories_add_en.length : 0);
    const catAngle = 360 / catCount;
    const scale = 0.75;
    let catIndex = 0;

    item.categories_nat_en.forEach((cat) => {
        const offset = radiusOffset(radius, catIndex * catAngle);
        const x = (-catWidth * scale) / 2 + offset.x;
        const y = (-catHeight * scale) / 2 + offset.y;

        icon += `<g transform="translate(${x},${y}) scale(${scale},${scale})">`;
        icon += `<circle cx="${radius / 2}" cy="${radius / 2}" r="${(radius * 2) / 3}" fill="${fillColour}" stroke="${strokeColour}" stroke-width="25"/>`;
        icon += `<path d="${icons[cat].shape}" fill="white"></path>`;
        icon += `</g>`;

        catIndex++;
    });

    if (item.categories_add_en) {
        item.categories_add_en.forEach((cat) => {
            const offset = radiusOffset(radius, catIndex * catAngle);
            const x = (-catWidth * scale) / 2 + offset.x;
            const y = (-catHeight * scale) / 2 + offset.y;

            icon += `<g transform="translate(${x},${y}) scale(${scale},${scale})">`;
            icon += `<circle cx="${radius / 2}" cy="${radius / 2}" r="${(radius * 2) / 3}" fill="${fillColour}" stroke="${strokeColour}" stroke-width="25"/>`;
            icon += `<path d="${icons[cat].shape}" fill="white" opacity="0.6"></path>`;
            icon += `</g>`;

            catIndex++;
        });
    }

    icon += "</g></svg>";

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(icon);
    return url;
}
