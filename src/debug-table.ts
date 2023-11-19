function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(value, min));
}

function forceStep(value: number, step: number): number {
    return Math.floor(value / step) * step;
}

function restrictInput(value: number, min: number, max: number, step: number): number {
    return forceStep(clamp(value, min, max), step);
}

export class DebugTable {
    public readonly container: HTMLElement;

    private readonly keyRowMap: Map<string, { node: HTMLElement, reset?: boolean }>;
    private readonly hashes: string[];

    constructor(container: HTMLElement) {
        this.container = container;
        this.keyRowMap = new Map();
        this.hashes = ["gJBsbYb0", "x2H6UVAv", "PlqzdZe+"];
    }

    addTitle(title: string): void {
        const rowNode = document.createElement("tr");
        rowNode.className = "row";
        
        const titleNode = document.createElement("th");
        titleNode.textContent = title;
        titleNode.colSpan = 4;
        rowNode.append(titleNode);
        
        this.container.prepend(rowNode);
    }

    set(key: string, value: string): void;
    set(key: string, value: number[] | Float32Array | Float64Array): void;
    set(key: string, value: string | number[] | Float32Array | Float64Array): void {
        // For vectors
        if (typeof value !== "string") {
            value = `(${Array.from(value).map(num => num.toFixed(2)).join(", ")})`;
        }

        let rowNode = this.keyRowMap.get(key)?.node;
        if (rowNode) {
            rowNode.children[2].textContent = value;
            return;
        }
        
        rowNode = document.createElement("tr");
        rowNode.className = "row";
        this.keyRowMap.set(key, { node: rowNode });
        
        const rowKeyNode = document.createElement("td");
        rowKeyNode.textContent = key;
        
        const rowValueNode = document.createElement("td");
        rowValueNode.textContent = value;
        
        rowNode.append(rowKeyNode, document.createElement("td"), rowValueNode);
        this.container.append(rowNode);
    }

    slider(name: string, defaultValue: number, min: number, max: number, step: number = 0.01, sliderName?: string, displayName?: string): number {
        defaultValue = Number(localStorage.getItem(name) ?? defaultValue);

        const entry = this.keyRowMap.get(name);
        let rowNode = entry?.node;
        {
            const inputNode = rowNode?.querySelector(".slider-input") as HTMLInputElement | null;
            const inputValueNode = rowNode?.querySelector(".text-input") as HTMLInputElement | null;
            if (inputNode) {
                inputNode.type = "range";
                inputNode.min = min.toString();
                inputNode.max = max.toString();
                inputNode.step = step.toString();

                if (entry?.reset) {
                    inputNode.value = defaultValue.toString();
                    if (inputValueNode !== null) {
                        inputValueNode.value = defaultValue.toString();
                    }
                    delete entry.reset;
                }

                return clamp(Number(inputNode.value), min, max);
            }
        }

        rowNode = document.createElement("tr");
        rowNode.className = "row";
        this.keyRowMap.set(name, { node: rowNode });

        const rowNameNode = document.createElement("td");
        rowNameNode.textContent = displayName ?? name;
        rowNode.append(rowNameNode);

        const inputNode = document.createElement("input");
        inputNode.className = "slider-input";
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

    slider3(name: string, defaultValue: number[], min: number, max: number, step: number, sliderNames: string | string[] = "xyz"): number[] {
        return [
            this.slider(name + this.hashes[0], defaultValue[0], min, max, step, sliderNames[0], name),
            this.slider(name + this.hashes[1], defaultValue[1], min, max, step, sliderNames[1], ""),
            this.slider(name + this.hashes[2], defaultValue[2], min, max, step, sliderNames[2], "")
        ];
    }

    show(): void {
        this.container.style.display = "";
    }

    hide(): void {
        this.container.style.display = "none";
    }

    save(): void {
        for (const [key, value] of this.keyRowMap) {
            const valueNode = value.node.querySelector("input");
            if (!valueNode) {
                continue;
            }
            localStorage.setItem(key, valueNode.value);
        }
    }

    reset(): void {
        for (const [key, value] of this.keyRowMap) {
            localStorage.removeItem(key);
            value.reset = true;
        }
    }
}