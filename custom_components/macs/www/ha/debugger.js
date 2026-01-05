import { VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = false, msgLen=50) {
    const ns = (namespace || "general").toString();
    let debugDiv = null;
    let visible = false;

    const resolveOverride = () => {
        if (typeof window === "undefined") return undefined;
        if (typeof window.__MACS_DEBUG__ === "undefined") return undefined;
        return !!window.__MACS_DEBUG__;
    };

    const isEnabled = () => {
        if (!enabled) return false;
        const override = resolveOverride();
        return typeof override === "undefined" ? false : override;
    };

    const ensureDebugDiv = () => {
        if (debugDiv) return debugDiv;
        debugDiv = document.getElementById('debug');
        return debugDiv;
    };

    const showDebug = () => {
        const el = ensureDebugDiv();
        if (!el || visible) return;
        el.style.display = "block";
        el.innerHTML = "<h1>Debugging</h1>";
        el.innerHTML += `v${VERSION}<br>`;
        visible = true;
    };

    const hideDebug = () => {
        if (!visible) return;
        const el = ensureDebugDiv();
        if (el) el.style.display = "none";
        visible = false;
    };

    return (...args) => {
        if (!isEnabled()) {
            hideDebug();
            return;
        }
        showDebug();
        const el = ensureDebugDiv();
        let msg = args.join(" ");
        msg = msg.toString().trim();
        const len = msg.length;
        msg = msg.substring(0, msgLen);
        if (len > msgLen){
            msg += "...";
        }
        if (el){
            el.innerHTML += msg + "<br>";
        }
        console.log(`[*MACS:${ns}]`, ...args);
    };
}
