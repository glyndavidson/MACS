/**
 * MacsCardEditor
 * ---------------
 * Home Assistant Lovelace card editor for M.A.C.S. (Mood-Aware Character SVG).
 *
 * This file defines the custom editor UI shown in the Lovelace card configuration
 * panel. It allows users to configure how M.A.C.S. integrates with Home Assistant’s
 * Assist system, including:
 * - Enabling automatic mood changes based on assistant state
 * - Enabling or disabling dialogue display from the assistant
 *
 * User selections are merged with default values and emitted via `config-changed`
 * events so Home Assistant can persist the card configuration.
 *
 * This file is frontend-only and does not perform any backend logic.
 */


import {
  DEFAULTS,
} from "./constants.js";

export class MacsCardEditor extends HTMLElement {
	// get the defaults, and apply user's config
	setConfig(config) {
		this._config = { ...DEFAULTS, ...(config || {}) };
		this._render();
	}

	set hass(hass) {
		this._hass = hass;
		if (this._rendered) this._sync();
	}

	// get assistant satellites from HA ready to populate the combobox
	async _loadSatellites() {
		if (!this._hass?.states) return { satellites: [] };
		const satellites = Object.keys(this._hass.states)
			.filter((id) => id.startsWith("assist_satellite."))
			.map((id) => {
			const st = this._hass.states[id];
			const name = (st?.attributes?.friendly_name || id).toString();
			return { id, name };
			})
			.sort((a, b) => a.name.localeCompare(b.name));
		return { satellites };
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

			// Get Assist Satellites. 
			const satellitesPayload = this._hass ? await  this._loadSatellites() : { satellites: [] };
			const satellites = satellitesPayload.satellites || [];
			const satItems = [{ id: "custom", name: "Custom" }, ...satellites.map(s => ({ id: s.id, name: s.name }))];

			// Get Assistant Piplines. Set preferred as default option if user hasn't chosen one yet.
			const pipelinesPayload = this._hass ? await this._loadPipelines() : { pipelines: [], preferred: "" };
			const pipelines = pipelinesPayload.pipelines || [];
			const preferred = pipelinesPayload.preferred || "";
			const pipelineItems = [{ id: "custom", name: "Custom" }, ...pipelines];

			// Build DOM
			this.shadowRoot.innerHTML = `
				<style>
					.group{margin-bottom:24px;border:1px solid var(--divider-color);border-radius:8px; padding:12px}
					.row{display:block;width:100%;margin-bottom:12px;}
					label{display:block;font-weight:500;margin-bottom:6px;}
					.hint{opacity:0.7;font-size:90%;margin-top:4px;}
					#satellite_select, #satellite_entity, #pipeline_select, #pipeline_id { width: 100%; }
					.entity-grid {display: grid;grid-template-columns: 1fr 1fr;gap: 6px 12px;}
					.entity-grid .header {font-weight: 600;border-bottom: 1px solid var(--divider-color);padding-bottom: 4px;}
					.entity-grid > div {white-space: nowrap;}
					.about-toggle{cursor:pointer;opacity:0.6;}
					.about-content{padding-left:10px;opacity:0.9;}
				</style>

				<!-- Auto respond to assistant states -->
				<div class="group">
					<div class="row">
						<label for="assist_states_enabled">React to wake-words?</label>
						<ha-switch id="assist_states_enabled"></ha-switch>
						<div class="hint">When enabled, Macs will mirror your selected Assist satellite.<br>(listening, processing, responding, idle, etc)</div>
					</div>

					<div class="row">
						<ha-combo-box id="satellite_select" label="Assist satellite"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="satellite_entity" label="Assist Satellite Entity ID" placeholder="assist_satellite.my_device"></ha-textfield>
					</div>
				</div>

				<!-- Show dialogue -->
				<div class="group">
					<div class="row">
						<label for="assist_pipeline_enabled">Display dialogue?</label>
						<ha-switch id="assist_pipeline_enabled"></ha-switch>
						<div class="hint">When enabled, Macs will display conversations with your assistant.</div>
					</div>

					<div class="row">
						<ha-combo-box id="pipeline_select" label="Assistant"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="pipeline_id" label="Assistant Pipeline ID" placeholder="01k..."></ha-textfield>
					</div>
				</div>

				<!-- Show dialogue -->
				<div class="group">
					<div class="row">
						<label>Custom Integrations</label>
						<div>
							<p>For custom integrations, Macs works like any other device and exposes entities which allow full control over his behavior.<br>Some examples are given below:</p>
							<div class="entity-grid">
								<div class="header">Entity</div>
								<div class="header">Action</div>

								<div>select.macs_mood</div>
								<div>macs.set_mood</div>

								<div>select.macs_weather</div>
								<div>macs.set_weather</div>

								<div>number.macs_brightness</div>
								<div>macs.set_brightness</div>
							</div>
						</div>
					</div>
				</div>


				<!-- About -->
				<div class="group">
					<div class="row about">
						<div class="about-toggle" tabindex="0" role="button">
							About M.A.C.S. 
							<span class="about-arrow">&gt;</span>
						</div>
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



			// Page has rendered
			this._rendered = true;
			this._pipelinesLoaded = false;


			// Add satellites to combobox
			const satSel = this.shadowRoot.getElementById("satellite_select");
			// add selects to combobox
			if (satSel) {
				satSel.items = satItems;
				satSel.itemLabelPath = "name";
				satSel.itemValuePath = "id";
			}
			this._satelliteItems = satItems;
			// Preselect saved config before sync
			if (satSel) {
				const eid = (this._config.assist_satellite_entity ?? "").toString();
				const known = satItems.some(s => s.id === eid && s.id !== "custom");
				const isCustom = !!this._config.assist_satellite_custom || (!known && eid);
				satSel.value = isCustom ? "custom" : eid;
			}


			// Add pipelines to combobox
			const sel = this.shadowRoot.getElementById("pipeline_select");
			if (sel) {
				sel.items = pipelineItems;
				sel.itemLabelPath = "name";
				sel.itemValuePath = "id";
			}
			this._pipelineItems = pipelineItems;

			// Preselect pipline based on saved config before sync runs
			if (sel) {
				const pid = (this._config.pipeline_id ?? "").toString();
				const known = pipelineItems.some(p => p.id === pid && p.id !== "custom");
				const isCustom = !!this._config.pipeline_custom || (!known && pid);
				sel.value = isCustom ? "custom" : pid;
			}


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

			// -----------------  Assist state auto mood ----------------- //
			const assistStateAutoMood = !!this._config.assist_states_enabled;
			const assistStateAutoMoodToggle = this.shadowRoot.getElementById("assist_states_enabled");
			const satelliteSelect   = this.shadowRoot.getElementById("satellite_select");
			const satelliteEntity    = this.shadowRoot.getElementById("satellite_entity");
			if (assistStateAutoMoodToggle && assistStateAutoMoodToggle.checked !== assistStateAutoMood) assistStateAutoMoodToggle.checked = assistStateAutoMood;
			if (satelliteSelect) satelliteSelect.disabled = !assistStateAutoMood;
			if (satelliteEntity)  satelliteEntity.disabled  = !assistStateAutoMood;
			// determine custom/known
			const eid = (this._config.assist_satellite_entity ?? "").toString();
			const knownSatelite = Array.isArray(this._satelliteItems) && this._satelliteItems.some(s => s.id === eid && s.id !== "custom");
			const satIsCustom = !!this._config.assist_satellite_custom || !knownSatelite;
			const nextSatSelect = satIsCustom ? "custom" : eid;
			if (satelliteSelect && satelliteSelect.value !== nextSatSelect) satelliteSelect.value = nextSatSelect;
			if (satelliteEntity && satelliteEntity.value !== eid && (!satIsCustom || !satelliteEntity.matches(":focus-within"))) satelliteEntity.value = eid;
			if (satelliteEntity) satelliteEntity.disabled = !assistStateAutoMood || !satIsCustom;


			// -----------------  Assist Dialogue (Pipeline) ----------------- //
			const dialogueEnabled = !!this._config.assist_pipeline_enabled;
			const dialogueEnabledToggle = this.shadowRoot.getElementById("assist_pipeline_enabled");
			const pipelineSelect = this.shadowRoot.getElementById("pipeline_select");
			const pipelineId  = this.shadowRoot.getElementById("pipeline_id");
			// Toggle state
			if (dialogueEnabledToggle && dialogueEnabledToggle.checked !== dialogueEnabled) dialogueEnabledToggle.checked = dialogueEnabled;
			// Also disable inputs when hidden (optional but nice)
			if (pipelineSelect) pipelineSelect.disabled = !dialogueEnabled;
			if (pipelineId) pipelineId.disabled = !dialogueEnabled;
			// Sync values (only write if changed)
			const pid = (this._config.pipeline_id ?? "").toString();
			const knownPipeline = Array.isArray(this._pipelineItems) && this._pipelineItems.some(p => p.id === pid && p.id !== "custom");
			const pipelineIsCustom = !!this._config.pipeline_custom || !knownPipeline;
			const nextPipelineSelect = pipelineIsCustom ? "custom" : pid;
			if (pipelineSelect && pipelineSelect.value !== nextPipelineSelect) pipelineSelect.value = nextPipelineSelect;
			if (pipelineId && pipelineId.value !== pid && !pipelineId.matches(":focus-within")) pipelineId.value = pid;
			if (pipelineId) pipelineId.disabled = !dialogueEnabled || !pipelineIsCustom;
		}

		


		// wire up event listeners for user config changes
		_wire() {
			const onChange = (e) => {
				// get combobox selected value
				const comboValue = (el) =>
					(e?.currentTarget === el && e?.detail && typeof e.detail.value !== "undefined")
						? e.detail.value
						: (el?.value ?? "");

				// -----------------  Assist state auto mood ----------------- //
				const assistStateAutoMood = !!this.shadowRoot.getElementById("assist_states_enabled")?.checked;
				const satelliteSelect = this.shadowRoot.getElementById("satellite_select");
				const satelliteEntity = this.shadowRoot.getElementById("satellite_entity");
				const satelliteSelectValue = comboValue(satelliteSelect);
				const satManualVal = satelliteEntity?.value || "";
				const assistSatelliteCustom = satelliteSelectValue === "custom";
				const assistSatelliteEntity = assistSatelliteCustom ? satManualVal : satelliteSelectValue;
				if (satelliteEntity) satelliteEntity.disabled = !assistStateAutoMood || !assistSatelliteCustom;

				// -----------------  Assist Dialogue (Pipeline) ----------------- //
				const assist_pipeline_enabled = !!this.shadowRoot.getElementById("assist_pipeline_enabled")?.checked;
				const pipelineSelect = this.shadowRoot.getElementById("pipeline_select");
				const pipelineIdInput = this.shadowRoot.getElementById("pipeline_id");
				const pipelineValue = comboValue(pipelineSelect);
				const pipelineId = pipelineIdInput?.value || "";
				const pipeline_custom = pipelineValue === "custom";
				if (pipelineIdInput) pipelineIdInput.disabled = !assist_pipeline_enabled || !pipeline_custom;
				// If custom selected, use manual field; otherwise use the selected pipeline id
				const pipeline_id = pipeline_custom ? pipelineId : pipelineValue;

				// Commit new config
				const next = {
					type: "custom:macs-card",
					assist_states_enabled: assistStateAutoMood,
					assist_satellite_entity: assistSatelliteEntity,
					assist_satellite_custom: assistSatelliteCustom,
					assist_pipeline_enabled, 
					pipeline_id, 
					pipeline_custom
				};

				this._config = { ...DEFAULTS, ...next };

				// IMPORTANT: do NOT call this._sync() here (HA will call setConfig again)
				this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
			};

			["assist_states_enabled","satellite_select","satellite_entity","assist_pipeline_enabled","pipeline_select","pipeline_id"].forEach((id) => {
				const el = this.shadowRoot.getElementById(id);
				if (!el) return;
				el.addEventListener("change", onChange);
				if (id === "pipeline_select" || id === "satellite_select") el.addEventListener("value-changed", onChange);
			});

			// Change-only listeners (avoid input storm)
			// ["assist_states_enabled","satellite_select","satellite_entity", "assist_pipeline_enabled", "pipeline_select", "pipeline_id"].forEach((id) => {
			// 	const el = this.shadowRoot.getElementById(id);
			// 	if (!el) return;
			// 	el.addEventListener("change", onChange);
			// 	if (id === "pipeline_select" || id === "satellite_select") {
			// 		el.addEventListener("value-changed", onChange);
			// 		el.addEventListener("input", onChange);
			// 	}
			// });
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