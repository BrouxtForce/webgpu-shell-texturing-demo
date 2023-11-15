function randomBase64(length) {
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-+";
    const characters = Array(length);
    for (let i = 0; i < characters.length; i++) {
        const randomIndex = Math.floor(Math.random() * possibleCharacters.length);
        characters[i] = possibleCharacters[randomIndex];
    }
    return characters.join("");
}
export class DebugTable {
    constructor(container) {
        this.container = container;
        this.keyRowMap = new Map();
        this.hashes = [
            randomBase64(8), randomBase64(8), randomBase64(8)
        ];
    }
    set(key, value) {
        if (typeof value !== "string") {
            value = `(${Array.from(value).map(num => num.toFixed(2)).join(", ")})`;
        }
        let rowNode = this.keyRowMap.get(key);
        if (rowNode) {
            rowNode.children[1].textContent = value;
            return;
        }
        rowNode = document.createElement("tr");
        rowNode.className = "row";
        this.keyRowMap.set(key, rowNode);
        const rowKeyNode = document.createElement("td");
        rowKeyNode.textContent = key;
        const rowValueNode = document.createElement("td");
        rowValueNode.textContent = value;
        rowNode.append(rowKeyNode, rowValueNode);
        this.container.append(rowNode);
    }
    slider(name, defaultValue, min, max, step = 0.01, sliderName, displayName) {
        let rowNode = this.keyRowMap.get(name);
        {
            const inputNode = rowNode?.querySelector("input");
            if (inputNode) {
                inputNode.type = "range";
                inputNode.min = min.toString();
                inputNode.max = max.toString();
                inputNode.step = step.toString();
                return Number(inputNode.value);
            }
        }
        rowNode = document.createElement("tr");
        rowNode.className = "row";
        this.keyRowMap.set(name, rowNode);
        const rowNameNode = document.createElement("td");
        rowNameNode.textContent = displayName ?? name;
        rowNode.append(rowNameNode);
        const inputNode = document.createElement("input");
        inputNode.type = "range";
        inputNode.min = min.toString();
        inputNode.max = max.toString();
        inputNode.step = step.toString();
        inputNode.value = defaultValue.toString();
        const inputValueNode = document.createElement("span");
        inputValueNode.textContent = inputNode.value;
        inputNode.addEventListener("input", () => {
            inputValueNode.textContent = inputNode.value;
        });
        if (sliderName) {
            const sliderNameNode = document.createElement("span");
            sliderNameNode.textContent = sliderName;
            rowNode.append(sliderNameNode);
        }
        rowNode.append(inputNode, inputValueNode);
        this.container.append(rowNode);
        return defaultValue;
    }
    slider3(name, defaultValue, min, max, step) {
        return [
            this.slider(name + this.hashes[0], defaultValue[0], min, max, step, "r", name),
            this.slider(name + this.hashes[1], defaultValue[1], min, max, step, "g", ""),
            this.slider(name + this.hashes[2], defaultValue[2], min, max, step, "b", "")
        ];
    }
}
