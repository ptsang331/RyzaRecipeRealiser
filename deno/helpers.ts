// deno-lint-ignore-file no-explicit-any
function relationshipListToQuery(list: any[], pre: (item: any) => string, n1: (item: any) => string, r: (item: any) => string, n2: (item: any) => string) {
    const result: string[] = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];

        result[i] = `${pre(item)} (${n1(item)})-[${r(item)}]-(${n2(item)})`;
    }

    return result;
}

function queryBuildWhereAnd(queryList: string[]) {
    if (queryList.length === 0) {
        return "";
    }

    let whereQuery = "WHERE " + queryList[0];
    for (let i = 1; i < queryList.length; i++) {
        whereQuery += " AND " + queryList[i];
    }

    return whereQuery;
}

function parseNumberArrayString(numberArrayString: string) {
    return numberArrayString.split(",")
        .map(numStr => parseInt(numStr))
        .filter((n) => !Number.isNaN(n));
}

export { relationshipListToQuery, queryBuildWhereAnd, parseNumberArrayString };