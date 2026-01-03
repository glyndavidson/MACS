import { DEBUGGING } from "./constants.js";

export function createDebugger(namespace, enabled = DEBUGGING) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        const debugDiv = document.getElementById('debug');
        debugDiv.style.display = "block";
        return (...args) => {
            if(debugDiv){
                debugDiv.innerHTML += args + "<br>";
            }
            console.log(`[MACS:${ns}]`, ...args);
        };
    }

    return () => {};
}
