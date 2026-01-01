/**
 * MacsCard
 * --------
 * Main Home Assistant Lovelace card implementation for M.A.C.S.
 * (Mood-Aware Character SVG).
 *
 * This file defines the custom Lovelace card element responsible for:
 * - Rendering the M.A.C.S. UI inside an iframe
 * - Passing Home Assistant state (mood, weather, brightness, etc) to the iframe
 * - Bridging Assist pipeline data (conversation turns) from Home Assistant
 *   to the frontend character via postMessage
 *
 * All backend interaction (WebSocket calls, event subscriptions, auth usage)
 * occurs here, while the iframe is kept sandboxed and display-focused.
 *
 * This file represents the core integration layer between Home Assistant
 * and the M.A.C.S. frontend character.
 */


import {
  DEFAULTS,
  MOOD_ENTITY_ID,
  WEATHER_ENTITY_ID,
  BRIGHTNESS_ENTITY_ID,
  CONVERSATION_ENTITY_ID
} from "./constants.js";

import {
	normMood,
	normWeather,
	normBrightness,
	safeUrl,
	getTargetOrigin
} from "./validators.js";


// map assistant state to mood
function assistStateToMood(state) {
    state = (state || "").toString().trim().toLowerCase();
    if (state === "listening") return "listening";
    if (state === "thinking") return "thinking";
    if (state === "processing") return "thinking";
    if (state === "responding") return "thinking";
    if (state === "speaking") return "thinking";
    if (state === "idle") return "idle";
    return "idle";
}


export class MacsCard extends HTMLElement {
    static getStubConfig() { 
        return { type: "custom:macs-card", assist_pipeline_enabled: false, pipeline_id: "", pipeline_custom: false, max_turns: 2, preview_image: DEFAULTS.preview_image }; 
    }

    static getConfigElement() {
        return document.createElement("macs-card-editor");
    }

    setConfig(config) {
        if (!config || typeof config !== "object") throw new Error("macs-card: invalid config");

        const mode = "postMessage"; // locked
        this._config = { ...DEFAULTS, ...config, mode };

        if (!this._root) {
            // Shadow DOM wrapper + iframe shell
            this._root = this.attachShadow({ mode: "open" });
            this._root.innerHTML = `
                <style>
                    :host { display: block; height: 100%; }
                    ha-card { height: 100%; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); }
                    .wrap { height: 100%; width: 100%; }
                    iframe, img { border: 0; width: 100%; height: 100%; display: block; }
                    img { object-fit: cover; }
                    .hidden { display: none !important; }
                </style>
                <ha-card><div class="wrap"><img class="thumb" /><iframe class="hidden"></iframe></div></ha-card>
            `;

            this._iframe = this._root.querySelector("iframe");
            this._thumb = this._root.querySelector("img.thumb");
            if (this._thumb) this._thumb.src = (this._config.preview_image || DEFAULTS.preview_image).toString();
            this._loadedOnce = false;
            this._lastMood = undefined;
            this._lastSrc = undefined;

            this._hass = null;

            this._turns = []; // newest first: [{runId, heard, reply, error, ts}]
            this._lastSeen = { runId: null, ts: null };
            this._fetchDebounce = null;

            this._unsubStateChanged = null;



            // automatically respond to satellite assistant states
            this._assistOverrideMood = null;     // "happy" / "confused" / etc.
            this._assistOverrideUntil = 0;       // ms timestamp
            this._assistOverrideTimer = null;
            this._lastAssistState = "idle";
            this._assistRun = null; // { startedAt, sawListening, sawProcessing, sawResponding }



            // Listen for iframe requests
            this._onMessage = this._onMessage.bind(this);
            window.addEventListener("message", this._onMessage);

            // Prevent outside-clicks from closing the HA editor dialog while menu is open
            this._onOutsideSelectClick = (e) => {
                if (!this._menuOpen) return;
                const path = e.composedPath ? e.composedPath() : [];
                const isMenuEl = (el) => {
                    const tag = el && el.tagName;
                    return tag === "HA-SELECT" || tag === "MWC-MENU" || tag === "MWC-MENU-SURFACE" || tag === "MWC-LIST" || tag === "MWC-LIST-ITEM";
                };
                if (path.some(isMenuEl)) return;
                this._closeSelectMenu();
                e.stopPropagation();
            };
            window.addEventListener("click", this._onOutsideSelectClick, true);
        }
    }

    disconnectedCallback() {
        // Cleanup event handlers / subscriptions
        try { window.removeEventListener("message", this._onMessage); } catch (_) {}
        try { window.removeEventListener("click", this._onOutsideSelectClick, true); } catch (_) {}
        try { if (this._unsubStateChanged) this._unsubStateChanged(); } catch (_) {}
        this._unsubStateChanged = null;
        try { if (this._assistOverrideTimer) clearTimeout(this._assistOverrideTimer); } catch (_) {}
        this._assistOverrideTimer = null;
    }





    /* ---------- Send data to iFrame ---------- */

    _postToIframe(payload) {
        if (!this._iframe?.contentWindow) return;
        // Post to the iframe window; targetOrigin "*" is safe here because we target a specific window.
        try { this._iframe.contentWindow.postMessage(payload, "*"); } catch (_) {}
    }

    _pipelineEnabled() { 
        return !!this._config?.assist_pipeline_enabled && !!(this._config?.pipeline_id || "").toString().trim(); 
    }


    _setAssistOverride(mood, ms) {
        this._assistOverrideMood = mood;
        this._assistOverrideUntil = Date.now() + Math.max(250, ms || 0);
        try { 
            if (this._assistOverrideTimer) clearTimeout(this._assistOverrideTimer); 
        } 
        catch (_) {
        }

        this._assistOverrideTimer = setTimeout(() => {
            this._assistOverrideMood = null;
            this._assistOverrideUntil = 0;
        }, Math.max(250, ms || 0));
    }


    _sendConfigToIframe() {
        const enabled = !!this._config.assist_pipeline_enabled;
        const pipeline_id = enabled ? (this._config.pipeline_id || "").toString().trim() : "";
        this._postToIframe({ type: "macs:config", pipeline_id });
    }

    _sendMoodToIframe(mood) {
        this._postToIframe({ type: "macs:mood", mood });
    }
    _sendWeatherToIframe(weather) {
        this._postToIframe({ type: "macs:weather", weather });
    }
    _sendBrightnessToIframe(brightness) {
        this._postToIframe({ type: "macs:brightness", brightness });
    }

    _sendTurnsToIframe() {
        // Turns are kept newest-first in the card, but sent as-is
        this._postToIframe({ type: "macs:turns", turns: this._turns.slice() });
    }

    _onMessage(e) {
        if (!this._iframe?.contentWindow) return;
        if (e.source !== this._iframe.contentWindow) return;

        // Origin check: allow "null" for sandboxed iframes; otherwise require the iframe URL origin.
        const base = safeUrl(this._config?.url);
        const expectedOrigin = getTargetOrigin(base.toString());
        if (e.origin !== expectedOrigin && e.origin !== "null") return;

        if (!e.data || typeof e.data !== "object") return;

        // Iframe requests initial config and current turns
        if (e.data.type === "macs:request_config") {
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }


    // Monitor the satellite state. 
    // If the assistant understood a voice request, satellite goes idle > listening > processing > responding > idle. 
    // If the state goes idle > listening > idle, then it hasn't understood.
    // this functions keeps track of the satellite's state.
    _updateAssistOutcome(satState) {
        const now = Date.now();
        const state = (satState || "").toString().trim().toLowerCase();

        // If no run yet, create on first "listening"
        if (!this._assistRun) this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };

        // Safety: reset stale runs (e.g. satellite gets stuck)
        if (this._assistRun.startedAt && (now - this._assistRun.startedAt) > 15000) this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };

        // Detect transitions
        const prev = this._lastAssistState;
        this._lastAssistState = state;

        // Start a run when we enter listening (from idle or anything else)
        if (state === "listening" && prev !== "listening") {
            this._assistRun = { startedAt: now, sawListening: true, sawProcessing: false, sawResponding: false };
            return;
        }

        // If a run is active, record milestones
        if (this._assistRun.startedAt) {
            if (state === "processing") this._assistRun.sawProcessing = true;
            if (state === "responding") this._assistRun.sawResponding = true;

            // End of run: return to idle
            if (state === "idle" && prev !== "idle") {
                const ok = this._assistRun.sawListening && this._assistRun.sawProcessing && this._assistRun.sawResponding;

                // Your requested rule:
                // - full sequence => happy
                // - anything else that ends early => confused
                this._setAssistOverride(ok ? "happy" : "confused", DEFAULTS.assist_outcome_duration_ms);

                // reset run
                this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };
            }
        }
    }




    /* ---------- Capture assist messages - uses assist pipeline websockets, and HASS auth ---------- */

    // a turn is one user message and following system response consisting of: 
    // runId, heard, reply, error, ts

    // Keep only the most recent N turns.
    _upsertTurn(t) {
        // Deduplicate by runId and keep newest-first, capped by max_turns
        const maxTurns = Math.max(1, parseInt(this._config.max_turns ?? DEFAULTS.max_turns, 10) || DEFAULTS.max_turns);

        const idx = this._turns.findIndex(x => x.runId === t.runId);

        if (idx === 0) { this._turns[0] = { ...this._turns[0], ...t }; return; }

        if (idx > 0) {
            const merged = { ...this._turns[idx], ...t };
            this._turns.splice(idx, 1);
            this._turns.unshift(merged);
        } else {
            this._turns.unshift(t);
            if (this._turns.length > maxTurns) this._turns.length = maxTurns;
        }
    }

    _extract(events) {
        // Pull just the pieces we render from pipeline debug events
        let heard = "", reply = "", error = "", ts = "";
        for (const ev of (events || [])) {
            if (!ts && ev.timestamp) ts = ev.timestamp;

            if (!heard && ev.type === "intent-start") heard = ev.data?.intent_input || "";
            if (ev.type === "stt-end") heard = ev.data?.stt_output?.text || heard;

            if (ev.type === "intent-end") reply = ev.data?.intent_output?.response?.speech?.plain?.speech || reply;

            if (ev.type === "error") error = `${ev.data?.code || "error"}: ${ev.data?.message || ""}`.trim();
        }
        return { heard, reply, error, ts };
    }

    async _listRuns() {
        // Pipeline debug list call (frontend-authenticated)
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid) return null;
        // Uses frontend auth automatically
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/list", pipeline_id: pid });
    }

    async _getRun(runId) {
        // Fetch a single pipeline run for detailed events
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid || !runId) return null;
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/get", pipeline_id: pid, pipeline_run_id: runId });
    }

    _triggerFetchNewest() {
        if (this._fetchDebounce) return;
        this._fetchDebounce = setTimeout(() => { this._fetchDebounce = null; this._fetchNewest().catch(() => {}); }, 160);
    }

    async _fetchNewest() {
        // user must be authenticated
        if (!this._hass) return;

        // ignore if pipeline not enabled
        if (!this._pipelineEnabled()) return;

        // make sure we have a pipeline id
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid) return;

        // List runs and find newest
        const listed = await this._listRuns();
        const newest = listed?.pipeline_runs?.at?.(-1) || (Array.isArray(listed?.pipeline_runs) ? listed.pipeline_runs[listed.pipeline_runs.length - 1] : null);
        if (!newest) return;

        // Check if the newest run has changed
        const changed = newest.pipeline_run_id !== this._lastSeen.runId || newest.timestamp !== this._lastSeen.ts;
        if (!changed) return;

        // Remember last seen
        this._lastSeen = { runId: newest.pipeline_run_id, ts: newest.timestamp };

        // Fetch multiple times because pipeline events can arrive late
        const runId = this._lastSeen.runId;
        for (const delay of [0, 250, 700]) {
            setTimeout(async () => {
                try {
                    const got = await this._getRun(runId);
                    const events = got?.events || null;
                    if (!events) return;

                    // Extract turn data and upsert
                    const parsed = { ...this._extract(events), runId };
                    if (parsed.heard || parsed.reply || parsed.error) {
                        this._upsertTurn(parsed);
                        this._sendTurnsToIframe();
                    }
                } catch (_) {}
            }, delay);
        }
    }

    // // Subscribe to conversation entity changes to trigger pipeline refresh
    _ensureSubscriptions() {
        if (!this._hass) return;
        const shouldSub = this._pipelineEnabled();
        
        if (shouldSub && !this._unsubStateChanged) {
            this._unsubStateChanged = this._hass.connection.subscribeEvents((ev) => {
                try {
                    if (ev?.data?.entity_id !== CONVERSATION_ENTITY_ID) return;
                    this._triggerFetchNewest();
                } catch (_) {}
            }, "state_changed");
        }

        if (!shouldSub && this._unsubStateChanged) {
            try { this._unsubStateChanged(); } catch (_) {}
            this._unsubStateChanged = null;
        }
    }



    /* ---------- hass hook ---------- */

    set hass(hass) {
        if (!this._config || !this._iframe) return;

        this._hass = hass;
        if (this._thumb && this._iframe) { this._thumb.classList.add("hidden"); this._iframe.classList.remove("hidden"); }
        this._ensureSubscriptions();

        const moodState = hass.states[MOOD_ENTITY_ID] || null;
        //const mood = normMood(moodState?.state);
        const baseMood = normMood(moodState?.state);
        // Optional: auto mood from selected satellite state
        let assistMood = null;
        let satState = ""; 

        if (this._config?.assist_states_enabled) {
            const satId = (this._config.assist_satellite_entity || "").toString().trim();
            if (satId) {
                const satStateObj = hass.states[satId] || null;
                satState = (satStateObj?.state || "").toString().trim().toLowerCase(); 
                assistMood = assistStateToMood(satState);
                if (this._config?.assist_states_enabled && satState) this._updateAssistOutcome(satState);
            }
        }

        const now = Date.now();
        const overrideActive = this._assistOverrideMood && now < (this._assistOverrideUntil || 0);
        const mood = overrideActive ? this._assistOverrideMood : ((this._config?.assist_states_enabled && assistMood) ? assistMood : baseMood);


        const weatherState = hass.states[WEATHER_ENTITY_ID] || null;
        const weather = normWeather(weatherState?.state);

        const brightnessState = hass.states[BRIGHTNESS_ENTITY_ID] || null;
        const brightness = normBrightness(brightnessState?.state);

        const base = safeUrl(this._config.url);
        const sendAll = () => {
            this._sendConfigToIframe();
            this._sendMoodToIframe(mood);
            this._sendWeatherToIframe(weather);
            this._sendBrightnessToIframe(brightness);
            this._sendTurnsToIframe();
        };

        if (!this._loadedOnce) {
            // First load: set iframe src and send initial state
            base.searchParams.set("mood", mood);
            base.searchParams.set("weather", weather);
            base.searchParams.set("brightness", brightness.toString());

            const src = base.toString();
            this._iframe.onload = () => {
                sendAll();
                // First fetch after iframe is alive
                this._triggerFetchNewest();
            };

            if (src !== this._lastSrc) {
                this._iframe.src = src;
                this._lastSrc = src;
            }

            this._loadedOnce = true;
            this._lastMood = mood;
            this._lastWeather = undefined;

            setTimeout(sendAll, 0);
        }
        else {
            // Subsequent updates: only send what changed
            if (mood !== this._lastMood) {
                this._lastMood = mood;
                this._sendMoodToIframe(mood);
            }
            if (weather !== this._lastWeather) {
                this._lastWeather = weather;
                this._sendWeatherToIframe(weather);
            }
            if(brightness !== this._lastBrightness) {
                this._lastBrightness = brightness;
                this._sendBrightnessToIframe(brightness);
            }

            // keep config/turns fresh
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }

    getCardSize() {
        return 6;
    }
}

