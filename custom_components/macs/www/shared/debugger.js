import { VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = true) {
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

    const ensureAutoScroll = (el) => {
        if (!el) return null;
        let wrap = el.querySelector(".debug-autoscroll");
        if (!wrap) {
            wrap = document.createElement("label");
            wrap.className = "debug-autoscroll";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.id = "debug-autoscroll-toggle";
            input.checked = true;

            const text = document.createElement("span");
            text.textContent = "Auto-scroll";

            wrap.appendChild(input);
            wrap.appendChild(text);
        }
        return wrap;
    };

    const ensureAutoScrollPlacement = (el, logEl) => {
        if (!el) return;
        const autoScroll = ensureAutoScroll(el);
        if (!autoScroll) return;
        if (!autoScroll.parentNode) {
            el.appendChild(autoScroll);
        }
        const sleep = el.querySelector(".debug-sleep-timer");
        if (sleep) {
            if (sleep.nextSibling !== autoScroll) {
                el.insertBefore(autoScroll, sleep.nextSibling);
            }
            return;
        }
        if (logEl && autoScroll.nextSibling !== logEl) {
            el.insertBefore(autoScroll, logEl);
        }
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
        const log = ensureLogContainer(el);
        ensureAutoScrollPlacement(el, log);
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

    const looksLikeJson = (value) => {
        if (typeof value !== "string") return false;
        const trimmed = value.trim();
        if (!trimmed) return false;
        const starts = trimmed[0];
        const ends = trimmed[trimmed.length - 1];
        if (starts === "{" && ends === "}") return true;
        if (starts === "[" && ends === "]") return true;
        return false;
    };

    const toUiString = (value) => {
        if (value === null || typeof value === "undefined") return "";
        if (typeof value === "string") {
            if (looksLikeJson(value)) {
                try { return JSON.stringify(JSON.parse(value), null, 2); } catch (_) {}
            }
            return value;
        }
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        try { return JSON.stringify(value, null, 2); } catch (_) {}
        try { return JSON.stringify(value); } catch (_) {}
        try { return String(value); } catch (_) {}
        return "";
    };

    const isAutoScrollEnabled = () => {
        const toggle = document.getElementById("debug-autoscroll-toggle");
        if (!toggle) return true;
        return toggle.checked;
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
        const entries = args.map((arg) => ({
            arg,
            text: toUiString(arg)
        }));
        const hasObjectArg = entries.some((entry, index) => {
            if (index === 0) return false;
            if (entry.arg && typeof entry.arg === "object") return true;
            return looksLikeJson(entry.arg);
        });
        const msg = (hasObjectArg
            ? entries.map((entry) => entry.text).join("\n")
            : entries.map((entry) => entry.text).join(" ")
        ).trim();
        if (log){
            const line = document.createElement("div");
            line.textContent = msg;
            if (msg.includes("\n")) {
                line.style.whiteSpace = "pre-wrap";
            }
            log.appendChild(line);
            if (isAutoScrollEnabled() && el) {
                el.scrollTop = el.scrollHeight;
            }
        }
        console.log(`[*MACS:${ns}]`, ...args);
    };

    log.show = updateVisibility;
    log.enabled = isEnabled;
    return log;
}
