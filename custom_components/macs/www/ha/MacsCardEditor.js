/**
 * MacsCardEditor
 * ---------------
 * Home Assistant Lovelace card editor for M.A.C.S. (Mood-Aware Character SVG).
 *
 * This file defines the custom editor UI shown in the Lovelace card configuration
 * panel. It allows users to configure how M.A.C.S. integrates with Home Assistantâ€™s
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
import { createDebugger } from "./debugger.js";
import {
	loadAssistantOptions,
	loadWeatherOptions,
	readAssistStateInputs,
	readPipelineInputs,
	readWeatherInputs,
	syncAssistStateControls,
	syncPipelineControls,
	syncWeatherControls
} from "./editorOptions.js";

const debug = createDebugger("macsCardEditor", true);



export class MacsCardEditor extends HTMLElement {
	// get the defaults, and apply user's config
	setConfig(config) {
		this._config = { ...DEFAULTS, ...(config || {}) };
		debug("setConfig", {
			temperature_unit: this._config.temperature_unit,
			temperature_min: this._config.temperature_min,
			temperature_max: this._config.temperature_max,
			wind_unit: this._config.wind_unit,
			wind_min: this._config.wind_min,
			wind_max: this._config.wind_max,
			precipitation_unit: this._config.precipitation_unit,
			precipitation_min: this._config.precipitation_min,
			precipitation_max: this._config.precipitation_max
		});
		this._render();
	}

	set hass(hass) {
		this._hass = hass;
		if (this._rendered) this._sync();
	}

			// render the card editor UI
		async _render() {
			if (!this.shadowRoot) this.attachShadow({ mode: "open" });

			const { satItems, pipelineItems, preferred } = await loadAssistantOptions(this._hass);
			const weatherItems = await loadWeatherOptions(this._hass);

			// Build DOM
			this.shadowRoot.innerHTML = `
				<style>
					.group{margin-bottom:24px;border:1px solid var(--divider-color);border-radius:8px; padding:12px}
					.row{display:block;width:100%;margin-bottom:12px;}
					label{display:block;font-weight:500;margin-bottom:6px;}
					.hint{opacity:0.7;font-size:90%;margin-top:4px;}
					#satellite_select, #satellite_entity, #pipeline_select, #pipeline_id,
					#temperature_select, #temperature_entity, #temperature_unit, #temperature_min, #temperature_max,
					#wind_select, #wind_entity, #wind_unit, #wind_min, #wind_max,
					#precipitation_select, #precipitation_entity, #precipitation_unit, #precipitation_min, #precipitation_max { width: 100%; }
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

				<!-- Temperature sensor -->
				<div class="group">
					<div class="row">
						<label for="temperature_sensor_enabled">Use temperature sensor?</label>
						<ha-switch id="temperature_sensor_enabled"></ha-switch>
					</div>

					<div class="row">
						<ha-combo-box id="temperature_select" label="Temperature sensor"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="temperature_entity" label="Temperature Sensor ID" placeholder="sensor.my_temperature"></ha-textfield>
					</div>

					<div class="row">
						<ha-combo-box id="temperature_unit" label="Temperature units"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="temperature_min" label="Min value" placeholder="Leave empty for defaults"></ha-textfield>
						<ha-textfield id="temperature_max" label="Max value" placeholder="Leave empty for defaults"></ha-textfield>
					</div>
				</div>

				<!-- Wind sensor -->
				<div class="group">
					<div class="row">
						<label for="wind_sensor_enabled">Use wind sensor?</label>
						<ha-switch id="wind_sensor_enabled"></ha-switch>
					</div>

					<div class="row">
						<ha-combo-box id="wind_select" label="Wind speed sensor"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="wind_entity" label="Wind Speed Sensor ID" placeholder="sensor.my_wind_speed"></ha-textfield>
					</div>

					<div class="row">
						<ha-combo-box id="wind_unit" label="Wind speed units"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="wind_min" label="Min value" placeholder="Leave empty for defaults"></ha-textfield>
						<ha-textfield id="wind_max" label="Max value" placeholder="Leave empty for defaults"></ha-textfield>
					</div>
				</div>

				<!-- Rain / precipitation sensor -->
				<div class="group">
					<div class="row">
						<label for="precipitation_sensor_enabled">Use rainfall sensor?</label>
						<ha-switch id="precipitation_sensor_enabled"></ha-switch>
					</div>

					<div class="row">
						<ha-combo-box id="precipitation_select" label="Rainfall sensor"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="precipitation_entity" label="Rainfall Sensor ID" placeholder="sensor.my_rain"></ha-textfield>
					</div>

					<div class="row">
						<ha-combo-box id="precipitation_unit" label="Rainfall units"></ha-combo-box>
					</div>

					<div class="row">
						<ha-textfield id="precipitation_min" label="Min value" placeholder="Leave empty for defaults"></ha-textfield>
						<ha-textfield id="precipitation_max" label="Max value" placeholder="Leave empty for defaults"></ha-textfield>
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
			//this._pipelinesLoaded = false;


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

			// Weather sensors: temperature
			const tempSel = this.shadowRoot.getElementById("temperature_select");
			if (tempSel) {
				tempSel.items = weatherItems.temperatureItems;
				tempSel.itemLabelPath = "name";
				tempSel.itemValuePath = "id";
			}
			this._temperatureItems = weatherItems.temperatureItems;
			if (tempSel) {
				const tid = (this._config.temperature_sensor_entity ?? "").toString();
				const known = weatherItems.temperatureItems.some(s => s.id === tid && s.id !== "custom");
				const isCustom = !!this._config.temperature_sensor_custom || (!known && tid);
				tempSel.value = isCustom ? "custom" : tid;
			}

			// Weather sensors: wind
			const windSel = this.shadowRoot.getElementById("wind_select");
			if (windSel) {
				windSel.items = weatherItems.windItems;
				windSel.itemLabelPath = "name";
				windSel.itemValuePath = "id";
			}
			this._windItems = weatherItems.windItems;
			if (windSel) {
				const wid = (this._config.wind_sensor_entity ?? "").toString();
				const known = weatherItems.windItems.some(s => s.id === wid && s.id !== "custom");
				const isCustom = !!this._config.wind_sensor_custom || (!known && wid);
				windSel.value = isCustom ? "custom" : wid;
			}

			// Weather sensors: precipitation
			const rainSel = this.shadowRoot.getElementById("precipitation_select");
			if (rainSel) {
				rainSel.items = weatherItems.precipitationItems;
				rainSel.itemLabelPath = "name";
				rainSel.itemValuePath = "id";
			}
			this._precipitationItems = weatherItems.precipitationItems;
			if (rainSel) {
				const rid = (this._config.precipitation_sensor_entity ?? "").toString();
				const known = weatherItems.precipitationItems.some(s => s.id === rid && s.id !== "custom");
				const isCustom = !!this._config.precipitation_sensor_custom || (!known && rid);
				rainSel.value = isCustom ? "custom" : rid;
			}

			            // Weather: temperature sensor units
            const temperatureUnitSelect = this.shadowRoot.getElementById("temperature_unit");
            if (temperatureUnitSelect) {
                temperatureUnitSelect.items = [
                    { id: "", name: "Auto" },
                    { id: "c", name: "Celsius (°C)" },
                    { id: "f", name: "Fahrenheit (°F)" },
                ];
                temperatureUnitSelect.itemLabelPath = "name";
                temperatureUnitSelect.itemValuePath = "id";
                temperatureUnitSelect.value = (this._config.temperature_unit ?? "").toString();
            }

            // Weather: wind units
            const windUnitSelect = this.shadowRoot.getElementById("wind_unit");
            if (windUnitSelect) {
                windUnitSelect.items = [
                    { id: "", name: "Auto" },
                    { id: "mph", name: "Miles per hour (mph)" },
                    { id: "km/h", name: "Kilometres per hour (km/h)" },
                    { id: "m/s", name: "Metres per second (m/s)" },
                ];
                windUnitSelect.itemLabelPath = "name";
                windUnitSelect.itemValuePath = "id";
                windUnitSelect.value = (this._config.wind_unit ?? "").toString();
            }

            // Weather: precipitation units
            const precipitationUnitSelect = this.shadowRoot.getElementById("precipitation_unit");
            if (precipitationUnitSelect) {
                precipitationUnitSelect.items = [
                    { id: "", name: "Auto" },
                    { id: "%", name: "Chance of rain (%)" },
                    { id: "mm", name: "Millimetres (mm)" },
                    { id: "in", name: "Inches (in)" },
                ];
                precipitationUnitSelect.itemLabelPath = "name";
                precipitationUnitSelect.itemValuePath = "id";
                precipitationUnitSelect.value = (this._config.precipitation_unit ?? "").toString();
            }

            // Weather min/max fields from config
            const tempMin = this.shadowRoot.getElementById("temperature_min");
            const tempMax = this.shadowRoot.getElementById("temperature_max");
            if (tempMin) tempMin.value = (this._config.temperature_min ?? "").toString();
            if (tempMax) tempMax.value = (this._config.temperature_max ?? "").toString();

            const windMin = this.shadowRoot.getElementById("wind_min");
            const windMax = this.shadowRoot.getElementById("wind_max");
            if (windMin) windMin.value = (this._config.wind_min ?? "").toString();
            if (windMax) windMax.value = (this._config.wind_max ?? "").toString();

            const precipMin = this.shadowRoot.getElementById("precipitation_min");
            const precipMax = this.shadowRoot.getElementById("precipitation_max");
            if (precipMin) precipMin.value = (this._config.precipitation_min ?? "").toString();
            if (precipMax) precipMax.value = (this._config.precipitation_max ?? "").toString();

            // About/Support toggle
			const toggle = this.shadowRoot.querySelector(".about-toggle");
			const arrow = this.shadowRoot.querySelector(".about-arrow");
			const content = this.shadowRoot.querySelector(".about-content");

			if (toggle && arrow && content) {
				toggle.addEventListener("click", () => {
					const open = !content.hasAttribute("hidden");
					content.toggleAttribute("hidden", open);
					arrow.textContent = open ? "â€º" : "â–¾";
				});
			}


			// Wire once per render (safe because render rebuilds DOM)
			this._wire();

			// Sync UI from config
			this._sync();
			//this._pipelinesLoaded = true;

			// If user hasn't set a pipeline yet, pick HA's preferred
			const currentPid = (this._config.pipeline_id ?? "").toString().trim();
			if (!currentPid && preferred && !this._config.pipeline_custom) {
				const next = { type: "custom:macs-card", ...this._config, pipeline_id: preferred, pipeline_custom: false };
				this._config = next;
				this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
			}
		}
		
		// _bindSelectOpenState() {
		// 	const sel = this.shadowRoot?.getElementById("pipeline_select");
		// 	if (!sel) return;
		// 	this._selectEl = sel;
		// 	this._menuOpen = false;
		// 	const onOpened = () => { this._menuOpen = true; };
		// 	const onClosed = () => { this._menuOpen = false; };
		// 	sel.addEventListener("opened", onOpened);
		// 	sel.addEventListener("closed", onClosed);
		// 	sel.addEventListener("change", onClosed);
		// }

		// _closeSelectMenu() {
		// 	const sel = this._selectEl || this.shadowRoot?.getElementById("pipeline_select");
		// 	if (!sel) return;
		// 	const menu = sel.menu || sel.shadowRoot?.querySelector("mwc-menu");
		// 	if (menu) menu.open = false;
		// 	if ("open" in sel) sel.open = false;
		// 	this._menuOpen = false;
		// }

		// sync UI state from this._config
		async _sync() {
			if (!this.shadowRoot) return;

			syncAssistStateControls(this.shadowRoot, this._config, this._satelliteItems);
			syncPipelineControls(this.shadowRoot, this._config, this._pipelineItems);
			syncWeatherControls(this.shadowRoot, this._config, {
				temperatureItems: this._temperatureItems || [],
				windItems: this._windItems || [],
				precipitationItems: this._precipitationItems || []
			});
		}

		


		// wire up event listeners for user config changes
		_wire() {
			const onChange = (e) => {
				const assistConfig = readAssistStateInputs(this.shadowRoot, e, this._config);
				const pipelineConfig = readPipelineInputs(this.shadowRoot, e, this._config);
				const weatherConfig = readWeatherInputs(this.shadowRoot, e, this._config);

				// Commit new config
				const next = {
					...this._config,
					type: "custom:macs-card",
					...assistConfig,
					...pipelineConfig,
					...weatherConfig
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

			[
				"temperature_sensor_enabled","temperature_select","temperature_entity","temperature_unit","temperature_min","temperature_max",
				"wind_sensor_enabled","wind_select","wind_entity","wind_unit","wind_min","wind_max",
				"precipitation_sensor_enabled","precipitation_select","precipitation_entity","precipitation_unit","precipitation_min","precipitation_max"
			].forEach((id) => {
				const el = this.shadowRoot.getElementById(id);
				if (!el) return;
				el.addEventListener("change", onChange);
				if (id.endsWith("_select") || id.endsWith("_unit")) el.addEventListener("value-changed", onChange);
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
		// _esc(s) {
		// 	return (s ?? "")
		// 		.toString()
		// 		.replace(/[&<>"']/g, (c) => ({
		// 			"&": "&amp;",
		// 			"<": "&lt;",
		// 			">": "&gt;",
		// 			'"': "&quot;",
		// 			"'": "&#39;",
		// 		}[c]));
		// }
	}



