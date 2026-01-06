import { DEFAULTS, CONVERSATION_ENTITY_ID } from "./constants.js";
import { createDebugger } from "../shared/debugger.js";

const debug = createDebugger("assistPipeline.js");


export class AssistPipelineTracker {
    constructor({ onTurns } = {}) {
        debug ("Creating new AssistPipelineTracker");
        this._onTurns = typeof onTurns === "function" ? onTurns : null;

        this._hass = null;
        this._enabled = false;
        this._pipelineId = "";
        this._maxTurns = DEFAULTS.max_turns ?? 2;
        
        // Prevents fetching calls when HA is updating rapidly
        this._fetchDebounce = null;

        // Keep assistant conversation history
        // newest first: [{runId, heard, reply, error, ts}]
        this._turns = []; 
        // Remember which message we saw last to prevent processing the same message again
        this._lastSeen = { runId: null, ts: null };

        // Keep an unsubscribe function so we can clean up later
        this._unsubStateChanged = null;

        this._disposed = false;
        this._subToken = 0;
    }

    setHass(hass) {
        this._hass = hass || null;
        this.ensureSubscriptions();
    }

    setConfig(config) {
        //debug("Setting pipeline config: " + JSON.stringify(config));

        const enabled = !!config?.assist_pipeline_enabled;
        const pid = enabled ? (config?.assist_pipeline_entity || "").toString().trim() : "";
        //const maxTurns = Math.max(1, parseInt(config?.max_turns ?? DEFAULTS.max_turns, 10) || DEFAULTS.max_turns);

        const changed = (enabled !== this._enabled) || (pid !== this._pipelineId); // || (maxTurns !== this._maxTurns);

        this._enabled = enabled;
        this._pipelineId = pid;

        //this._maxTurns = maxTurns;

        this.ensureSubscriptions();

        // If pipeline was just enabled or pipeline id changed, kick a fetch
        if (changed && this._enabled && this._pipelineId) this.triggerFetchNewest();
        if (!this._enabled || !this._pipelineId) this.clearTurns();

        
        debug("setConfig: enabled = " + this._enabled);
        debug("setConfig: pid = " + this._pipelineId);
    }

    getTurns() {
        return this._turns.slice();
    }

    dispose() {
        debug("disposing...");
        this._disposed = true;

        try {
            const u = this._unsubStateChanged;
            if (typeof u === "function") u();
        } catch (_) {}
        this._unsubStateChanged = null;

        try { if (this._fetchDebounce) clearTimeout(this._fetchDebounce); } catch (_) {}
        this._fetchDebounce = null;

        this._hass = null;
        this._enabled = false;
        this._pipelineId = "";
        this.clearTurns();
    }

    /* ---------- internals ---------- */

    pipelineEnabled() {
        let pipeEnabled = !!this._enabled && !!this._pipelineId;
        debug("pipelineEnabled: " + pipeEnabled);
        return pipeEnabled;
    }

    clearTurns() {
        debug("Clearing turns...");
        debug("Pipline ID is now [" + this._pipelineId + "]");
        this._turns = [];
        this._lastSeen = { runId: null, ts: null };
        if (this._onTurns) this._onTurns(this.getTurns());
    }

    // a turn is one user message and following system response consisting of: 
    // runId, heard, reply, error, ts
    // Keep only the most recent N turns.
    upsertTurn(t) {
        debug("upsert turn...");
        const idx = this._turns.findIndex(x => x.runId === t.runId);

        if (idx === 0) {
            this._turns[0] = { ...this._turns[0], ...t };
        } else if (idx > 0) {
            const merged = { ...this._turns[idx], ...t };
            this._turns.splice(idx, 1);
            this._turns.unshift(merged);
        } else {
            this._turns.unshift(t);
        }

        if (this._turns.length > this._maxTurns) this._turns.length = this._maxTurns;
    }

    extract(events) {
        debug("Extracting");
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

    async listRuns() {
        debug("List runs...");
        if (!this._hass) return null;
        // Pipeline debug list call (frontend-authenticated)
        const pid = this._pipelineId;
        if (!pid) return null;
        // Uses frontend auth automatically
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/list", pipeline_id: pid });
    }

    async getRun(runId) {
        debug("get run...");
        if (!this._hass) return null;
        // Fetch a single pipeline run for detailed events
        const pid = this._pipelineId;
        if (!pid || !runId) return null;
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/get", pipeline_id: pid, pipeline_run_id: runId });
    }

    triggerFetchNewest() {
        debug("trigger fetchNewest this=" + (this?.constructor?.name || typeof this) + " keys=" + Object.keys(this || {}).join(","));
        if (this._fetchDebounce) return;
        this._fetchDebounce = setTimeout(() => { this._fetchDebounce = null; this.fetchNewest().catch(() => {}); }, 160);
    }

    async fetchNewest() {
        debug("fetchNewest ran, enabled=" + this._enabled + " pid=" + this._pipelineId);
        // user must be authenticated
        if (!this._hass) return;

        // ignore if pipeline not enabled
        if (!this.pipelineEnabled()) return;

        // make sure we have a pipeline id
        const pid = this._pipelineId;
        if (!pid) return;

        // List runs and find newest
        const listed = await this.listRuns();
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
                    const got = await this.getRun(runId);
                    const events = got?.events || null;
                    if (!events) return;

                    // Extract turn data and upsert
                    const parsed = { ...this.extract(events), runId };
                    if (parsed.heard || parsed.reply || parsed.error) {
                        this.upsertTurn(parsed);
                        if (this._onTurns) this._onTurns(this.getTurns());
                    }
                } catch (_) {}
            }, delay);
        }
    }

    // Subscribe to conversation entity changes to trigger pipeline refresh
    ensureSubscriptions() {       
        debug("ensure subscriptions...");

        if (!this._hass || this._disposed) return;

        const shouldSub = this.pipelineEnabled();

        // Need to subscribe
        if (shouldSub && !this._unsubStateChanged) {
            const token = ++this._subToken;
            this._unsubStateChanged = "pending"; // any non-null sentinel

            this._hass.connection.subscribeEvents((ev) => {
                try {
                    if (ev?.data?.entity_id !== CONVERSATION_ENTITY_ID) return;
                    this.triggerFetchNewest();
                } catch (_) {}
            }, "state_changed").then((unsub) => {
                // If we've been disposed or a newer subscribe attempt happened, immediately clean up.
                if (this._disposed || token !== this._subToken || !this.pipelineEnabled()) {
                    try { unsub(); } catch (_) {}
                    return;
                }
                this._unsubStateChanged = unsub;
            }).catch(() => {
                if (token === this._subToken) this._unsubStateChanged = null;
            });

            return;
        }

        // Need to unsubscribe
        if (!shouldSub && this._unsubStateChanged) {
            const u = this._unsubStateChanged;
            if (typeof u === "function") {
                try { u(); } catch (_) {}
            }
            this._unsubStateChanged = null;
        }
    }


}
