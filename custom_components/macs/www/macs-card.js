/* ===========================
	MACS CARD — BRIDGE MODE
	- NO token handling in iframe
	- Card uses authenticated hass.callWS + hass event bus
	- Iframe is display-only

@todo test non admin user
=========================== */

(() => {
	// use strict mode
	"use strict";

	// ##################################################################################################
	//																									#
	//                                        BACKEND													#
	//																									#
	// ##################################################################################################

	// get URL for macs.html
	const selfUrl = new URL(import.meta.url);
	const htmlUrl = new URL("macs.html", selfUrl);
	htmlUrl.search = selfUrl.search; // carries ?hacstag=...

	// default config values
	const DEFAULTS = {
		url: htmlUrl.toString(),
		mode: "postMessage",
		param: "mood",
		assist_pipeline_enabled: false,
		pipeline_id: "",
		pipeline_custom: false,
		max_turns: 2,
			preview_image: new URL("images/card_preview.png", selfUrl).toString(),
	};

	// HA entity IDs this card listens to
	const MOOD_ENTITY_ID = "select.macs_mood";
	const WEATHER_ENTITY_ID = "select.macs_weather";
	const BRIGHTNESS_ENTITY_ID = "number.macs_brightness";
	const CONVERSATION_ENTITY_ID = "conversation.home_assistant";


	// normalize mood string
	function normMood(v) {
		return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
	}
	function normWeather(v) {
		return (typeof v === "string" ? v : "none").trim().toLowerCase() || "none";
	}
	function normBrightness(v) {
		const n = Number(v);
		if (!Number.isFinite(n)) return 100;
		return Math.max(0, Math.min(100, n));
	}

	function safeUrl(baseUrl) {
		return new URL(baseUrl || DEFAULTS.url, window.location.origin);
	}

	function getTargetOrigin(absoluteUrlString) {
		try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
	}

	class MacsCard extends HTMLElement {
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
			const mood = normMood(moodState?.state);

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
				base.searchParams.set(this._config.param || DEFAULTS.param, mood);
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

	if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);

	window.customCards = window.customCards || [];
	window.customCards.push({
		type: "macs-card",
		name: "M.A.C.S.",
		description: "M.A.C.S. (Macs) - Mood-Aware Character SVG",
		preview: true
	});




	// ##################################################################################################
	//																									#
	//                                        CARD EDITOR												#
	//																									#
	// ##################################################################################################

	class MacsCardEditor extends HTMLElement {
		// get the defaults, and apply user's config
		setConfig(config) {
			this._config = { ...DEFAULTS, ...(config || {}) };
			this._render();
		}

		set hass(hass) {
			this._hass = hass;
			if (this._rendered) this._sync();
		}

		// get assistant pipelines from HA (Do this before rendering the editor so combobox can be populated)
		async _loadPipelines() {
			if (!this._hass) return { pipelines: [], preferred: "" };

			const res = await this._hass.callWS({ type: "assist_pipeline/pipeline/list" });

			const pipelines = Array.isArray(res?.pipelines) ? res.pipelines : [];
			const preferred = (res?.preferred_pipeline || "").toString();

			return {
				preferred,
				pipelines: pipelines
					.map(p => ({ id: (p.id || "").toString(), name: (p.name || p.id || "Unnamed").toString() }))
					.filter(p => p.id),
			};
		}

		// render the card editor UI
		async _render() {
			if (!this.shadowRoot) this.attachShadow({ mode: "open" });

			// Get Assistant Piplines. Set preferred as default option if user hasn't chosen one yet.
			const pipelinesPayload = this._hass ? await this._loadPipelines() : { pipelines: [], preferred: "" };
			const pipelines = pipelinesPayload.pipelines || [];
			const preferred = pipelinesPayload.preferred || "";
			const items = [{ id: "custom", name: "Custom" }, ...pipelines];

			// Build DOM
			this.shadowRoot.innerHTML = `
				<style>
					.row{display:block;width:100%;margin-bottom:16px;}
					.hint{opacity:0.7;font-size:90%;margin-top:4px;}
					#pipeline_select, #pipeline_id, #max_turns { width: 100%; }
					.about{margin-top:40px;border:1px solid var(--divider-color);border-left:none;border-right:none;padding:10px 0;}
					.about-toggle{cursor:pointer;opacity:0.6;}
					.about-content{padding-left:10px;opacity:0.9;}
				</style>

				<div class="row">
					Enable Assist pipeline
					<ha-switch id="assist_pipeline_enabled"></ha-switch>
					<div class="hint"> (Allow Macs to react to interactions with the assistant. For custom automations, Macs acts like any other device where you can adjust brightness, mood, weather etc.)</div>
				</div>

				<div class="row">
					<ha-combo-box id="pipeline_select" label="Assistant"></ha-combo-box>
				</div>

				<div class="row">
					<ha-textfield id="pipeline_id" label="Assistant Pipeline ID" placeholder="01k..."></ha-textfield>
				</div>
	
				<div class="row about">
				<div class="about-toggle" tabindex="0" role="button">
					About M.A.C.S. 
					<span class="about-arrow">&gt;</span>
				</div>

				<div class="about-content" hidden>
					<p>
						<strong>M.A.C.S.</strong> (Mood-Aware Character SVG) is a playful Home Assistant card that adds personality to your smart home, responding visually to system events such as voice interactions and custom automations.
					</p>

					<p>
						M.A.C.S. is being developed by <strong>Glyn Davidson</strong> (Developer, climber, and chronic tinkerer of occasionally useful tools) in his free time.
					</p>

					<p class="support">
						If you find M.A.C.S. useful and would like to encourage its ongoing development with new features and bug fixes, please consider 
						<br>
						<ha-icon icon="mdi:coffee"></ha-icon>
						<a href="https://buymeacoffee.com/glyndavidson" target="_blank" rel="noopener">
							buying me a coffee
						</a>.
					</p>
				</div>
				</div>
			`;

			// About/Support toggle
			const toggle = this.shadowRoot.querySelector(".about-toggle");
			const arrow = this.shadowRoot.querySelector(".about-arrow");
			const content = this.shadowRoot.querySelector(".about-content");

			if (toggle && arrow && content) {
				toggle.addEventListener("click", () => {
					const open = !content.hasAttribute("hidden");
					content.toggleAttribute("hidden", open);
					arrow.textContent = open ? "›" : "▾";
				});
			}

			// Page has rendered
			this._rendered = true;
			this._pipelinesLoaded = false;

			const sel = this.shadowRoot.getElementById("pipeline_select");
			if (sel) {
				sel.items = items;
				sel.itemLabelPath = "name";
				sel.itemValuePath = "id";
			}
			this._pipelineItems = items;

			// Preselect based on saved config before sync runs
			if (sel) {
				const pid = (this._config.pipeline_id ?? "").toString();
				const known = items.some(p => p.id === pid && p.id !== "custom");
				const isCustom = !!this._config.pipeline_custom || (!known && pid);
				sel.value = isCustom ? "custom" : pid;
			}

			// Wire once per render (safe because render rebuilds DOM)
			this._wire();

			// Sync UI from config
			this._sync();
			this._pipelinesLoaded = true;

			// If user hasn't set a pipeline yet, pick HA's preferred
			const currentPid = (this._config.pipeline_id ?? "").toString().trim();
			if (!currentPid && preferred && !this._config.pipeline_custom) {
				const next = { type: "custom:macs-card", ...this._config, pipeline_id: preferred, pipeline_custom: false };
				this._config = next;
				this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
			}
		}
		
		_bindSelectOpenState() {
			const sel = this.shadowRoot?.getElementById("pipeline_select");
			if (!sel) return;
			this._selectEl = sel;
			this._menuOpen = false;
			const onOpened = () => { this._menuOpen = true; };
			const onClosed = () => { this._menuOpen = false; };
			sel.addEventListener("opened", onOpened);
			sel.addEventListener("closed", onClosed);
			sel.addEventListener("change", onClosed);
		}

		_closeSelectMenu() {
			const sel = this._selectEl || this.shadowRoot?.getElementById("pipeline_select");
			if (!sel) return;
			const menu = sel.menu || sel.shadowRoot?.querySelector("mwc-menu");
			if (menu) menu.open = false;
			if ("open" in sel) sel.open = false;
			this._menuOpen = false;
		}

		// sync UI state from this._config
		async _sync() {
			if (!this.shadowRoot) return;

			const enabled = !!this._config.assist_pipeline_enabled;

			const sw = this.shadowRoot.getElementById("assist_pipeline_enabled");
			const adv = this.shadowRoot.getElementById("advanced_fields");
			const sel = this.shadowRoot.getElementById("pipeline_select");
			const tf  = this.shadowRoot.getElementById("pipeline_id");
			const maxTurns = this.shadowRoot.getElementById("max_turns");

			// Toggle state
			if (sw && sw.checked !== enabled) sw.checked = enabled;

			// Hide/show advanced block
			if (adv) adv.hidden = !enabled;

			// Also disable inputs when hidden (optional but nice)
			if (sel) sel.disabled = !enabled;
			if (tf) tf.disabled = !enabled;

			// Sync values (only write if changed)
			const pid = (this._config.pipeline_id ?? "").toString();
			const known = Array.isArray(this._pipelineItems) && this._pipelineItems.some(p => p.id === pid && p.id !== "custom");
			const isCustom = !!this._config.pipeline_custom || !known;
			const nextSelect = isCustom ? "custom" : pid;
			if (sel && sel.value !== nextSelect) sel.value = nextSelect;
			if (tf && tf.value !== pid && !tf.matches(":focus-within")) tf.value = pid;
			if (tf) tf.disabled = !enabled || !isCustom;

			const mt = (this._config.max_turns ?? DEFAULTS.max_turns).toString();
			if (maxTurns && maxTurns.value !== mt) maxTurns.value = mt;
		}

		


		// wire up event listeners for user config changes
		_wire() {
			const onChange = (e) => {
				const assist_pipeline_enabled = !!this.shadowRoot.getElementById("assist_pipeline_enabled")?.checked;
				const selEl = this.shadowRoot.getElementById("pipeline_select");
				const selVal = e?.detail?.value ?? selEl?.value ?? "";
				const manualVal = this.shadowRoot.getElementById("pipeline_id")?.value || "";
				const max_turns_raw = this.shadowRoot.getElementById("max_turns")?.value || "";
				const max_turns = Math.max(1, parseInt(max_turns_raw, 10) || DEFAULTS.max_turns);

				const tf = this.shadowRoot.getElementById("pipeline_id");
				const pipeline_custom = selVal === "custom";
				if (tf) tf.disabled = !assist_pipeline_enabled || !pipeline_custom;

				// If custom selected, use manual field; otherwise use the selected pipeline id
				const pipeline_id = pipeline_custom ? manualVal : selVal;

				const next = { type: "custom:macs-card", assist_pipeline_enabled, pipeline_id, pipeline_custom, max_turns };

				this._config = { ...DEFAULTS, ...next };

				// IMPORTANT: do NOT call this._sync() here (HA will call setConfig again)
				this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
			};

			// Change-only listeners (avoid input storm)
			["assist_pipeline_enabled", "pipeline_select", "pipeline_id", "max_turns"].forEach((id) => {
				const el = this.shadowRoot.getElementById(id);
				if (!el) return;
				el.addEventListener("change", onChange);
				if (id === "pipeline_select") {
					el.addEventListener("value-changed", onChange);
					el.addEventListener("input", onChange);
				}
			});
		}

		// escape helper (used when rendering pipeline names)
		_esc(s) {
			return (s ?? "")
				.toString()
				.replace(/[&<>"']/g, (c) => ({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				}[c]));
		}
	}

	if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);
})();
