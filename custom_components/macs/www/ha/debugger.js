import { DEBUGGING, VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = DEBUGGING, msgLen=50) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        const debugDiv = document.getElementById('debug');
        if(debugDiv){
            debugDiv.style.display = "block";
            debugDiv.innerHTML = "<h1>Debugging</h1>";
            debugDiv.innerHTML += `v${VERSION}<br>`;
        }
        return (...args) => {
            let msg = args.join(" ");
            msg = msg.toString().trim();
            const len = msg.length;
            msg = msg.substring(0, msgLen);
            if (len > msgLen){
                msg += "...";
            }
            if(debugDiv){
                debugDiv.innerHTML += msg + "<br>";
            }
            console.log(`[*MACS:${ns}]`, ...args);
        };
    }

    return () => {};
}
