// Monitor the satellite state. 
// If the assistant understood a voice request, satellite goes idle > listening > processing > responding > idle. 
// If the state goes idle > listening > idle, then it hasn't understood.
// this functions keeps track of the satellite's state.

import {DEFAULTS} from "../shared/constants.js";

import { createDebugger } from "../shared/debugger.js";
const debug = createDebugger(import.meta.url);

export class SatelliteTracker{
    //Todo - Allow user config timeout
    constructor() { // old version: constructor({ onOutcome, timeoutMs = DEFAULTS.assist_outcome_duration_ms }){}
        // automatically respond to satellite assistant states
        this._assistOverrideMood = null;    // temporarily force mood
        this._assistOverrideUntil = 0;      // force mood until timestamp
        this._assistOverrideTimer = null;   // The Timer which stores forced duration
        this._lastAssistState = "idle";     // last observed satellite assist state
        this._assistRun = null;             // Tracks the current run milestones (idle > listening > processing > responding > idle)
        
        // this._onOutcome = onOutcome;
        // this._timeoutMs = timeoutMs;
    }

    update(satState) {
        const now = Date.now();
        const state = (satState || "").toString().trim().toLowerCase();

        // Ensure run object exists (startedAt=0 means inactive)
        if (!this._assistRun) this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };

        // Safety: reset stale runs (e.g. satellite gets stuck)
        if (this._assistRun.startedAt && (now - this._assistRun.startedAt) > 15000) this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };

        // Detect transitions
        const prev = this._lastAssistState;
        this._lastAssistState = state;

        debug(`assist satellite state: ${prev} -> ${state}`);

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
                this.setAssistOverride(ok ? "happy" : "confused", DEFAULTS.assist_outcome_duration_ms);

                // reset run
                this._assistRun = { startedAt: 0, sawListening: false, sawProcessing: false, sawResponding: false };
            }
        }
    }

    getOverrideMood() {
        if (!this._assistOverrideMood) return null;
        if (Date.now() > this._assistOverrideUntil) return null;
        return this._assistOverrideMood;
    }

    setAssistOverride(mood, ms) {
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

    dispose() {
        try { if (this._assistOverrideTimer) clearTimeout(this._assistOverrideTimer); } catch (_) {}
        this._assistOverrideTimer = null;
        this._assistOverrideMood = null;
        this._assistOverrideUntil = 0;
        this._assistRun = null;
        this._lastAssistState = "idle";
    }
}
