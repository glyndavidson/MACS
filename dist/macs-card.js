(() => {
  "use strict";

  /* ===========================
     MACS CARD — BRIDGE MODE
     - NO token handling in iframe
     - Card uses authenticated hass.callWS + hass event bus
     - Iframe is display-only
     =========================== */

  const DEFAULTS = {
    url: "/local/macs/macs.html?v=1.0.14",
    mode: "postMessage",
    param: "mood",
    cache_bust: false,
    pipeline_id: "",
    max_turns: 2,
  };

  const MOOD_ENTITY_ID = "select.macs_mood";
  const CONVERSATION_ENTITY_ID = "conversation.home_assistant";

  function normMood(v) {
    return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
  }

  function safeUrl(baseUrl) {
    return new URL(baseUrl || DEFAULTS.url, window.location.origin);
  }

  function getTargetOrigin(absoluteUrlString) {
    try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
  }

  class MacsCard extends HTMLElement {
    static getStubConfig() {
      return { type: "custom:macs-card", pipeline_id: "" };
    }

    static getConfigElement() {
      return document.createElement("macs-card-editor");
    }

    setConfig(config) {
      if (!config || typeof config !== "object") throw new Error("macs-card: invalid config");

      const mode = "postMessage"; // locked
      this._config = { ...DEFAULTS, ...config, mode };

      if (!this._root) {
        this._root = this.attachShadow({ mode: "open" });
        this._root.innerHTML = `
          <style>
            :host { display: block; height: 100%; }
            ha-card { height: 100%; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); }
            .wrap { height: 100%; width: 100%; }
            iframe { border: 0; width: 100%; height: 100%; display: block; }
          </style>
          <ha-card><div class="wrap"><iframe></iframe></div></ha-card>
        `;

        this._iframe = this._root.querySelector("iframe");
        this._loadedOnce = false;
        this._lastMood = undefined;
        this._lastSrc = undefined;

        this._hass = null;

        this._turns = []; // newest first: [{runId, heard, reply, error, ts}]
        this._lastSeen = { runId: null, ts: null };
        this._fetchDebounce = null;

        this._unsubStateChanged = null;

        this._onMessage = this._onMessage.bind(this);
        window.addEventListener("message", this._onMessage);
      }
    }

    disconnectedCallback() {
      try { window.removeEventListener("message", this._onMessage); } catch (_) {}
      try { if (this._unsubStateChanged) this._unsubStateChanged(); } catch (_) {}
      this._unsubStateChanged = null;
    }

    /* ---------- postMessage ---------- */

    _postToIframe(payload) {
      if (!this._iframe?.contentWindow) return;
      // Post to the iframe window; targetOrigin "*" is safe here because we target a specific window.
      try { this._iframe.contentWindow.postMessage(payload, "*"); } catch (_) {}
    }

    _sendConfigToIframe() {
      const pipeline_id = (this._config.pipeline_id || "").toString().trim();
      this._postToIframe({ type: "macs:config", pipeline_id: pipeline_id || "" });
    }

    _sendMoodToIframe(mood) {
      this._postToIframe({ type: "macs:mood", mood });
    }

    _sendTurnsToIframe() {
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

      if (e.data.type === "macs:request_config") {
        this._sendConfigToIframe();
        this._sendTurnsToIframe();
      }
    }

    /* ---------- assist pipeline debug (bridge) ---------- */

    _upsertTurn(t) {
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
      const pid = (this._config.pipeline_id || "").toString().trim();
      if (!pid) return null;
      // Uses frontend auth automatically
      return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/list", pipeline_id: pid });
    }

    async _getRun(runId) {
      const pid = (this._config.pipeline_id || "").toString().trim();
      if (!pid || !runId) return null;
      return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/get", pipeline_id: pid, pipeline_run_id: runId });
    }

    _triggerFetchNewest() {
      if (this._fetchDebounce) return;
      this._fetchDebounce = setTimeout(() => { this._fetchDebounce = null; this._fetchNewest().catch(() => {}); }, 160);
    }

    async _fetchNewest() {
      if (!this._hass) return;

      const pid = (this._config.pipeline_id || "").toString().trim();
      if (!pid) return;

      const listed = await this._listRuns();
      const newest = listed?.pipeline_runs?.at?.(-1) || (Array.isArray(listed?.pipeline_runs) ? listed.pipeline_runs[listed.pipeline_runs.length - 1] : null);
      if (!newest) return;

      const changed = newest.pipeline_run_id !== this._lastSeen.runId || newest.timestamp !== this._lastSeen.ts;
      if (!changed) return;

      this._lastSeen = { runId: newest.pipeline_run_id, ts: newest.timestamp };

      // Fetch multiple times (pipeline debug events can arrive a moment later)
      const runId = this._lastSeen.runId;
      for (const delay of [0, 250, 700]) {
        setTimeout(async () => {
          try {
            const got = await this._getRun(runId);
            const events = got?.events || null;
            if (!events) return;

            const parsed = { ...this._extract(events), runId };
            if (parsed.heard || parsed.reply || parsed.error) {
              this._upsertTurn(parsed);
              this._sendTurnsToIframe();
            }
          } catch (_) {}
        }, delay);
      }
    }

    _ensureSubscriptions() {
      if (!this._hass || this._unsubStateChanged) return;

      // Listen for changes to conversation.home_assistant; that’s our “new run likely happened” signal.
      this._unsubStateChanged = this._hass.connection.subscribeEvents((ev) => {
        try {
          if (ev?.data?.entity_id !== CONVERSATION_ENTITY_ID) return;
          this._triggerFetchNewest();
        } catch (_) {}
      }, "state_changed");
    }

    /* ---------- hass hook ---------- */

    set hass(hass) {
      if (!this._config || !this._iframe) return;

      this._hass = hass;
      this._ensureSubscriptions();

      const st = hass.states[MOOD_ENTITY_ID] || null;
      const mood = normMood(st?.state);

      const base = safeUrl(this._config.url);
      const sendAll = () => {
        this._sendConfigToIframe();
        this._sendMoodToIframe(mood);
        this._sendTurnsToIframe();
      };

      if (!this._loadedOnce) {
        base.searchParams.set(this._config.param || DEFAULTS.param, mood);

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

        setTimeout(sendAll, 0);
      } else {
        if (mood !== this._lastMood) {
          this._lastMood = mood;
          this._sendMoodToIframe(mood);
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

  if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "macs-card",
    name: "Macs Card",
    description: "Displays Macs. Card bridges Assist pipeline debug to iframe via postMessage (no tokens).",
  });

  /* ---------- Editor ---------- */

  class MacsCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...DEFAULTS, ...(config || {}) };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._rendered) this._sync();
    }

    _render() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });

      this.shadowRoot.innerHTML = `
        <style>
          .row { display: grid; gap: 12px; }
          .hint { opacity: 0.8; font-size: 12px; line-height: 1.35; }
        </style>

        <div class="row">
          <ha-textfield id="pipeline_id" label="Assist pipeline ID" placeholder="01k..."></ha-textfield>

          <ha-textfield id="max_turns" label="Max turns to show" inputmode="numeric"></ha-textfield>

          <div class="hint">
            Bridge mode: this card listens to Home Assistant and sends updates to the iframe via <code>postMessage</code>.<br>
            The iframe never receives or stores any Home Assistant tokens.
          </div>
        </div>
      `;

      this._rendered = true;
      this._wire();
      this._sync();
    }

    _sync() {
      if (!this.shadowRoot) return;

      const pipeline = this.shadowRoot.getElementById("pipeline_id");
      if (pipeline) pipeline.value = this._config.pipeline_id ?? DEFAULTS.pipeline_id;

      const maxTurns = this.shadowRoot.getElementById("max_turns");
      if (maxTurns) maxTurns.value = (this._config.max_turns ?? DEFAULTS.max_turns).toString();
    }

    _wire() {
      const onChange = () => {
        const pipeline_id = this.shadowRoot.getElementById("pipeline_id")?.value || "";
        const max_turns_raw = this.shadowRoot.getElementById("max_turns")?.value || "";

        const max_turns = Math.max(1, parseInt(max_turns_raw, 10) || DEFAULTS.max_turns);

        const next = { type: "custom:macs-card", pipeline_id, max_turns };

        this._config = { ...DEFAULTS, ...next };

        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
          })
        );
      };

      ["pipeline_id", "max_turns"].forEach((id) => {
        const el = this.shadowRoot.getElementById(id);
        if (!el) return;
        el.addEventListener("change", onChange);
        el.addEventListener("input", onChange);
      });
    }
  }

  if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);
})();