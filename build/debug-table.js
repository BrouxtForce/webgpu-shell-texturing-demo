function randomBase64(length) {
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-+";
    const characters = Array(length);
    for (let i = 0; i < characters.length; i++) {
        const randomIndex = Math.floor(Math.random() * possibleCharacters.length);
        characters[i] = possibleCharacters[randomIndex];
    }
    return characters.join("");
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(value, min));
}
function forceStep(value, step) {
    return Math.floor(value / step) * step;
}
function restrictInput(value, min, max, step) {
    return forceStep(clamp(value, min, max), step);
}
export class DebugTable {
    constructor(container) {
        this.container = container;
        this.keyRowMap = new Map();
        this.hashes = [
            randomBase64(8), randomBase64(8), randomBase64(8)
        ];
    }
    addTitle(title) {
        const rowNode = document.createElement("tr");
        rowNode.className = "row";
        const titleNode = document.createElement("th");
        titleNode.textContent = title;
        titleNode.colSpan = 4;
        rowNode.append(titleNode);
        this.container.prepend(rowNode);
    }
    set(key, value) {
        if (typeof value !== "string") {
            value = `(${Array.from(value).map(num => num.toFixed(2)).join(", ")})`;
        }
        let rowNode = this.keyRowMap.get(key);
        if (rowNode) {
            rowNode.children[2].textContent = value;
            return;
        }
        rowNode = document.createElement("tr");
        rowNode.className = "row";
        this.keyRowMap.set(key, rowNode);
        const rowKeyNode = document.createElement("td");
        rowKeyNode.textContent = key;
        const rowValueNode = document.createElement("td");
        rowValueNode.textContent = value;
        rowNode.append(rowKeyNode, document.createElement("td"), rowValueNode);
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
                return clamp(Number(inputNode.value), min, max);
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
        inputNode.addEventListener("input", () => {
            inputValueNode.value = inputNode.value;
        });
        const inputValueNode = document.createElement("input");
        inputValueNode.value = inputNode.value;
        inputValueNode.type = "text";
        inputValueNode.className = "text-input";
        inputValueNode.addEventListener("change", () => {
            const newValue = restrictInput(Number(inputValueNode.value), min, max, step);
            if (Number.isNaN(newValue)) {
                inputValueNode.value = inputNode.value;
                return;
            }
            const newValueString = newValue.toString();
            inputNode.value = newValueString;
            inputValueNode.value = newValueString;
        });
        const sliderNameNode = document.createElement("td");
        sliderNameNode.textContent = sliderName ?? "";
        rowNode.append(sliderNameNode);
        rowNode.append(inputNode, inputValueNode);
        this.container.append(rowNode);
        return clamp(defaultValue, min, max);
    }
    slider3(name, defaultValue, min, max, step, sliderNames = "xyz") {
        return [
            this.slider(name + this.hashes[0], defaultValue[0], min, max, step, sliderNames[0], name),
            this.slider(name + this.hashes[1], defaultValue[1], min, max, step, sliderNames[1], ""),
            this.slider(name + this.hashes[2], defaultValue[2], min, max, step, sliderNames[2], "")
        ];
    }
    show() {
        this.container.style.display = "";
    }
    hide() {
        this.container.style.display = "none";
    }
}
