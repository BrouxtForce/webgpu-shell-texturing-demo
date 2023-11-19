export async function loadObj(filepath) {
    const fileData = await (await fetch(filepath)).text();
    const lines = fileData.split("\n").map(line => line.trim());
    let name = filepath;
    const rawPositions = [];
    const rawNormals = [];
    const rawTexcoords = [];
    const rawIndices = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const firstSpaceIndex = line.indexOf(" ");
        if (firstSpaceIndex === -1) {
            continue;
        }
        const lineType = line.slice(0, firstSpaceIndex);
        const dataString = line.slice(firstSpaceIndex + 1);
        const data = dataString.split(" ");
        switch (lineType) {
            case "#": break;
            case "o":
                name = dataString;
                break;
            case "v":
                if (data.length !== 3) {
                    console.error(`Error (line ${i}): Position should have three components`);
                    break;
                }
                rawPositions.push(data.map(Number));
                break;
            case "vt":
                if (data.length !== 2) {
                    console.error(`Error (line ${i}): Only two component texcoords are supported.`);
                    break;
                }
                rawTexcoords.push(data.map(Number));
                break;
            case "vn":
                if (data.length !== 3) {
                    console.error(`Error (line ${i}): Normal should have three components`);
                    break;
                }
                rawNormals.push(data.map(Number));
                break;
            case "f":
                if (data.length !== 3) {
                    console.error(`Error (line ${i}): Non-triangle primitives are not supported.`);
                    break;
                }
                rawIndices.push(data.map(str => str.split("/").map(val => val ? Number(val) : 0)));
                break;
            default:
                console.error(`Error (line ${i}): Unsupported line type: ${lineType}`);
                break;
        }
    }
    const normals = [];
    const texcoords = [];
    const indices = [];
    for (const primitiveIndices of rawIndices) {
        for (const primitiveIndexSet of primitiveIndices) {
            const positionIndex = primitiveIndexSet[0] - 1;
            const texcoordIndex = primitiveIndexSet[1] - 1;
            const normalIndex = (primitiveIndexSet[2] ?? 0) - 1;
            if (positionIndex === -1) {
                throw new Error("Primitive position index must be specified.");
            }
            indices.push(positionIndex);
            if (normalIndex !== -1) {
                normals[positionIndex] = rawNormals[normalIndex];
            }
            if (texcoordIndex !== -1) {
                texcoords[positionIndex] = rawTexcoords[texcoordIndex];
            }
        }
    }
    return {
        name: name,
        positions: new Float32Array(rawPositions.flat()),
        indices: new Uint32Array(indices),
        normals: new Float32Array(normals.flat()),
        texcoords: new Float32Array(texcoords.flat())
    };
}
export async function loadObjIntoBuffers(device, filepath) {
    const modelData = await loadObj(filepath);
    const positionBuffer = device.createBuffer({
        label: `'${modelData.name}' position buffer`,
        size: modelData.positions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(positionBuffer, 0, modelData.positions);
    const indexCount = modelData.indices.length;
    const indexBuffer = device.createBuffer({
        label: `'${modelData.name}' index buffer`,
        size: modelData.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(indexBuffer, 0, modelData.indices);
    let normalBuffer = null;
    if (modelData.normals.byteLength > 0) {
        normalBuffer = device.createBuffer({
            label: `'${modelData.name}' normal buffer`,
            size: modelData.normals.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(normalBuffer, 0, modelData.normals);
    }
    let texcoordBuffer = null;
    if (modelData.texcoords.byteLength > 0) {
        texcoordBuffer = device.createBuffer({
            label: `${modelData.name} texcoord buffer`,
            size: modelData.texcoords.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(texcoordBuffer, 0, modelData.texcoords);
    }
    return { positionBuffer, indexBuffer, indexCount, normalBuffer, texcoordBuffer };
}
