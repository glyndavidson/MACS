import { VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = true, msgLen=100) {
    const ns = (namespace || "general").toString();
    let debugDiv = null;
    let visible = false;

    const normalizeToken = (value) => (value ?? "").toString().trim().toLowerCase();
    const stripJs = (value) => (value.endsWith(".js") ? value.slice(0, -3) : value);

    const resolveOverride = () => {
        if (typeof window === "undefined") return "none";
        if (typeof window.__MACS_DEBUG__ === "undefined") return "none";
        const raw = window.__MACS_DEBUG__;
        if (typeof raw === "boolean") return raw ? "all" : "none";
        return normalizeToken(raw);
    };

    const matchesNamespace = (selection) => {
        if (!selection || selection === "none") return false;
        if (selection === "all") return true;
        const wanted = selection.split(",").map((entry) => normalizeToken(entry));
        const target = normalizeToken(ns);
        const targetNoExt = stripJs(target);
        return wanted.some((entry) => {
            if (!entry) return false;
            const entryNoExt = stripJs(entry);
            return entry === target || entryNoExt === targetNoExt;
        });
    };

    const isEnabled = () => {
        if (!enabled) return false;
        return matchesNamespace(resolveOverride());
    };

    const ensureDebugDiv = () => {
        if (debugDiv) return debugDiv;
        debugDiv = document.getElementById('debug');
        return debugDiv;
    };

    const ensureLogContainer = (el) => {
        if (!el) return null;
        let log = el.querySelector(".debug-log");
        if (!log) {
            log = document.createElement("div");
            log.className = "debug-log";
            el.appendChild(log);
        }
        return log;
    };

    const ensureHeader = (el) => {
        if (!el) return;
        if (!el.querySelector(".debug-title")) {
            const title = document.createElement("div");
            title.className = "debug-title";
            title.textContent = "Debugging";
            el.prepend(title);
        }
        if (!el.querySelector(".debug-version")) {
            const version = document.createElement("div");
            version.className = "debug-version";
            version.textContent = `v${VERSION}`;
            const title = el.querySelector(".debug-title");
            if (title?.nextSibling) {
                el.insertBefore(version, title.nextSibling);
            } else if (title) {
                title.after(version);
            } else {
                el.prepend(version);
            }
        }
        ensureLogContainer(el);
    };

    const showDebug = () => {
        const el = ensureDebugDiv();
        if (!el || visible) return;
        ensureHeader(el);
        el.style.display = "block";
        visible = true;
    };

    const hideDebug = () => {
        if (!visible) return;
        const el = ensureDebugDiv();
        if (el) el.style.display = "none";
        visible = false;
    };

    const updateVisibility = () => {
        if (isEnabled()) {
            showDebug();
        } else {
            hideDebug();
        }
    };

    const toUiString = (value) => {
        if (value === null || typeof value === "undefined") return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value); } catch (_) {}
        try { return String(value); } catch (_) {}
        return "";
    };

    const log = (...args) => {
        if (!isEnabled()) {
            hideDebug();
            return;
        }
        showDebug();
        const el = ensureDebugDiv();
        ensureHeader(el);
        const log = ensureLogContainer(el);
        let msg = args.map(toUiString).join(" ").trim();
        const len = msg.length;
        msg = msg.substring(0, msgLen);
        if (len > msgLen){
            msg += "...";
        }
        if (log){
            const line = document.createElement("div");
            line.textContent = msg;
            log.appendChild(line);
        }
        console.log(`[*MACS:${ns}]`, ...args);
    };

    log.show = updateVisibility;
    log.enabled = isEnabled;
    return log;
}
