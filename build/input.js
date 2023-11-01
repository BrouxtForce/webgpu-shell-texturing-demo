import { vec2, vec3 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
export class Input {
    constructor(node) {
        this.pointerIsLocked = false;
        this.mouseDelta = vec2.zero();
        this.pressedKeys = new Set();
        node.tabIndex = 0;
        node.addEventListener("keydown", event => {
            this.pressedKeys.add(event.key.toLowerCase());
        });
        node.addEventListener("keyup", event => {
            this.pressedKeys.delete(event.key.toLowerCase());
        });
        node.addEventListener("mousemove", event => {
            vec2.set(event.movementX, event.movementY, this.mouseDelta);
        });
        node.addEventListener("mousedown", () => {
            node.requestPointerLock();
        });
        document.addEventListener("pointerlockchange", () => {
            this.pointerIsLocked = (document.pointerLockElement === node);
        });
        document.addEventListener("pointerlockerror", () => {
            console.error("Failed to lock pointer");
        });
    }
    up() {
        return this.pressedKeys.has("w") || this.pressedKeys.has("arrowup");
    }
    left() {
        return this.pressedKeys.has("a") || this.pressedKeys.has("arrowleft");
    }
    down() {
        return this.pressedKeys.has("s") || this.pressedKeys.has("arrowdown");
    }
    right() {
        return this.pressedKeys.has("d") || this.pressedKeys.has("arrowright");
    }
    space() {
        return this.pressedKeys.has(" ");
    }
    shift() {
        return this.pressedKeys.has("shift");
    }
    movement() {
        return vec3.create(Number(this.right()) - Number(this.left()), Number(this.space()) - Number(this.shift()), Number(this.down()) - Number(this.up()));
    }
    endFrame() {
        vec2.set(0, 0, this.mouseDelta);
    }
}
