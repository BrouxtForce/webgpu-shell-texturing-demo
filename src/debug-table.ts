export class DebugTable {
    private readonly container: HTMLElement;
    private readonly keyRowMap: Map<string, HTMLElement>;

    constructor(container: HTMLElement) {
        this.container = container;
        this.keyRowMap = new Map();
    }

    set(key: string, value: string): void;
    set(key: string, value: number[] | Float32Array | Float64Array): void;
    set(key: string, value: string | number[] | Float32Array | Float64Array): void {
        // For vectors
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
}