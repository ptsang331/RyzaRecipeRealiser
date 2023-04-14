function drawCircleSegment(radius, startAngle, sweepAngle) {
    if (startAngle === 0 && sweepAngle === 360) {
        return `M ${0} ${0} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
    }

    const start = radiusOffset(radius, startAngle);
    const end = radiusOffset(radius, startAngle + sweepAngle);
    const isObtuse = sweepAngle > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${isObtuse} 1 ${end.x} ${end.y} L 0 0 Z`;
}

function arrayToString(array) {
    let s = "";
    for (let i = 0; i < array.length; i++) {
        s += array[i];
        if (i < array.length - 1) {
            s += ", ";
        }
    }
    return s;
}

function union(setA, setB) {
    const _union = new Set(setA);
    for (const elem of setB) {
        _union.add(elem);
    }
    return _union;
}

function difference(setA, setB) {
    const _difference = new Set(setA);
    for (const elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}

function radiusOffset(radius, theta) {
    theta = (theta * Math.PI) / 180;
    let xOffset = radius * Math.sin(theta);
    let yOffset = - radius * Math.cos(theta); //Graphics have minus Y going up
    return { x: xOffset, y: yOffset };
}
