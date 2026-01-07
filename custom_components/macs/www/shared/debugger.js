/**
 * Debugger
 * --------
 * Shared debug logger and UI panel with target filtering.
 */
import { VERSION } from "./constants.js";

export function createDebugger(namespace, enabled = true) {
    const nsSource = (namespace || "general").toString();
    let debugDiv = null;
    let visible = false;
    const BACKLOG_LIMIT = 200;

    const normalizeToken = (value) => (value ?? "").toString().trim().toLowerCase();
    const stripJs = (value) => (value.endsWith(".js") ? value.slice(0, -3) : value);
    const normalizeKey = (value) => normalizeToken(value).replace(/[\s-]+/g, "_");
    let targetsLoading = false;
    let missingTargetWarned = false;
    const getFileName = (value) => {
        if (!value) return "";
        const raw = value.toString();
        try {
            const url = new URL(raw);
            return url.pathname.split("/").pop() || "";
        } catch (_) {
            const trimmed = raw.split("?")[0].split("#")[0];
            const parts = trimmed.split("/");
            return parts[parts.length - 1] || "";
        }
    };
    const nsFile = getFileName(nsSource);
    const nsDisplay = nsFile || nsSource;
    const ns = stripJs(nsDisplay);
    const addTokens = (value, collector) => {
        const token = normalizeToken(value);
        const key = normalizeKey(value);
        [token, key, stripJs(token), stripJs(key)].forEach((entry) => {
            if (entry) collector.add(entry);
        });
    };
    const buildBaseTokens = () => {
        const tokens = new Set();
        [nsSource, nsDisplay, nsFile].forEach((value) => addTokens(value, tokens));
        return tokens;
    };
    const buildEntryTokens = (entry) => {
        const tokens = new Set();
        const entryKey = entry?.key || "";
        const entryLabel = entry?.label || "";
        const entryFile = entry?.filename || "";
        const entryFileName = getFileName(entryFile);
        [entryKey, entryLabel, entryFile, entryFileName].forEach((value) => addTokens(value, tokens));
        return tokens;
    };
    const tokensIntersect = (left, right) => {
        for (const token of left) {
            if (right.has(token)) return true;
        }
        return false;
    };

    const getTargets = () => {
        if (typeof window === "undefined") return [];
        const targets = window.__MACS_DEBUG_TARGETS__;
        return Array.isArray(targets) ? targets : [];
    };

    const ensureTargetsLoaded = () => {
        if (typeof window === "undefined") return;
        if (window.__MACS_DEBUG_TARGETS__ || targetsLoading) return;
        targetsLoading = true;
        try {
            const url = new URL("/macs/shared/debugTargets.json", window.location.origin);
            if (VERSION && VERSION !== "Unknown") {
                url.searchParams.set("v", VERSION);
            }
            fetch(url.toString(), { cache: "no-store" })
                .then((resp) => (resp && resp.ok ? resp.json() : null))
                .then((data) => {
                    if (Array.isArray(data)) {
                        window.__MACS_DEBUG_TARGETS__ = data;
                        if (window.dispatchEvent) {
                            window.dispatchEvent(new CustomEvent("macs-debug-update"));
                        }
                        checkTargetRegistration();
                    }
                })
                .catch(() => {});
        } catch (_) {}
    };

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
        const baseTokens = buildBaseTokens();
        const targetTokens = new Set(baseTokens);

        const targets = getTargets();
        targets.forEach((entry) => {
            const entryTokens = buildEntryTokens(entry);
            if (tokensIntersect(entryTokens, baseTokens)) {
                entryTokens.forEach((token) => targetTokens.add(token));
            }
        });

        return wanted.some((entry) => {
            if (!entry) return false;
            const entryKey = normalizeKey(entry);
            return targetTokens.has(entry) || targetTokens.has(entryKey) || targetTokens.has(stripJs(entry));
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
        let title = el.querySelector(".debug-title");
        if (!title) {
            title = document.createElement("div");
            title.className = "debug-title";
            el.prepend(title);
        }
        title.textContent = `Debugging | v${VERSION}`;

        let subtitle = el.querySelector(".debug-subtitle");
        if (!subtitle) {
            subtitle = document.createElement("div");
            subtitle.className = "debug-subtitle";
            if (title?.nextSibling) {
                el.insertBefore(subtitle, title.nextSibling);
            } else if (title) {
                title.after(subtitle);
            } else {
                el.prepend(subtitle);
            }
        }
        subtitle.textContent = "(Frontend only, see console for backend)";

        const version = el.querySelector(".debug-version");
        if (version) {
            version.remove();
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
        flushQueue();
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
        checkTargetRegistration();
    };

    if (typeof window !== "undefined" && window?.addEventListener) {
        window.addEventListener("macs-debug-update", updateVisibility);
    }
    ensureTargetsLoaded();

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

    const appendLine = (logEl, msg) => {
        if (!logEl) return;
        const line = document.createElement("div");
        const asString = typeof msg === "string" ? msg : "";
        const trimmed = asString.trim();
        if (trimmed.startsWith("<span") && trimmed.endsWith("</span>")) {
            line.innerHTML = msg;
        } else {
            line.textContent = msg;
        }
        if (typeof msg === "string" && msg.startsWith("ERROR:")) {
            line.className = "debug-error";
        }
        if (msg.includes("\n")) {
            line.style.whiteSpace = "pre-wrap";
        }
        logEl.appendChild(line);
    };

    const getQueue = () => {
        if (typeof window === "undefined") return null;
        if (!Array.isArray(window.__MACS_DEBUG_QUEUE__)) {
            window.__MACS_DEBUG_QUEUE__ = [];
        }
        return window.__MACS_DEBUG_QUEUE__;
    };

    const getNextSeq = () => {
        if (typeof window === "undefined") return 0;
        if (typeof window.__MACS_DEBUG_SEQ__ !== "number") {
            window.__MACS_DEBUG_SEQ__ = 0;
        }
        window.__MACS_DEBUG_SEQ__ += 1;
        return window.__MACS_DEBUG_SEQ__;
    };

    const getRenderedSeq = () => {
        if (typeof window === "undefined") return 0;
        if (typeof window.__MACS_DEBUG_RENDERED__ !== "number") {
            window.__MACS_DEBUG_RENDERED__ = 0;
        }
        return window.__MACS_DEBUG_RENDERED__;
    };

    const setRenderedSeq = (value) => {
        if (typeof window === "undefined") return;
        window.__MACS_DEBUG_RENDERED__ = value;
    };

    const enqueue = (msg) => {
        if (!msg) return;
        const queue = getQueue();
        if (!queue) return;
        queue.push({ seq: getNextSeq(), text: msg });
        if (queue.length > BACKLOG_LIMIT) {
            queue.shift();
        }
    };

    const flushQueue = () => {
        const el = ensureDebugDiv();
        if (!el) return;
        ensureHeader(el);
        const log = ensureLogContainer(el);
        const queue = getQueue();
        if (!queue || !log) return;
        let last = getRenderedSeq();
        queue.forEach((entry) => {
            if (entry.seq > last) {
                appendLine(log, entry.text);
                last = entry.seq;
            }
        });
        setRenderedSeq(last);
        if (isAutoScrollEnabled()) {
            el.scrollTop = el.scrollHeight;
        }
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

    function checkTargetRegistration() {
        if (missingTargetWarned) return;
        const targets = getTargets();
        if (!Array.isArray(targets) || !targets.length) return;
        const baseTokens = buildBaseTokens();
        const found = targets.some((entry) => tokensIntersect(buildEntryTokens(entry), baseTokens));
        if (!found) {
            missingTargetWarned = true;
            console.warn(`[MACS] Debug target missing for ${nsDisplay}. Add it to shared/debugTargets.json.`);
        }
    }

    const log = (...args) => {
        const enabledNow = isEnabled();
        if (!enabledNow) {
            hideDebug();
        }
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
        enqueue(msg);
        if (enabledNow) {
            showDebug();
            flushQueue();
        }
        console.log(`[*MACS:${ns}]`, ...args);
    };

    log.show = updateVisibility;
    log.enabled = isEnabled;
    log.flush = flushQueue;
    updateVisibility();
    return log;
}
