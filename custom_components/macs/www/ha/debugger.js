import { DEBUGGING, VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = DEBUGGING) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        const debugDiv = document.getElementById('debug');
        if(debugDiv){
            debugDiv.style.display = "block";
            debugDiv.innerHTML = "<h1>Debugging</h1>";
            debugDiv.innerHTML += `v${VERSION}<br>`;
        }
        return (...args) => {
            if(debugDiv){
                debugDiv.innerHTML += args + "<br>";
            }
            console.log(`[MACS:${ns}]`, ...args);
        };
    }

    return () => {};
}
