/**
 * MacsCardEditor
 * ---------------
 * Home Assistant Lovelace card editor for M.A.C.S. (Mood-Aware Character SVG).
 *
 * This file defines the custom editor UI shown in the Lovelace card configuration
 * panel. It allows users to configure how M.A.C.S. integrates with Home Assistant's
 * Assist system, including:
 * - Enabling automatic mood changes based on assistant state
 * - Enabling or disabling dialogue display from the assistant
 *
 * User selections are merged with default values and emitted via `config-changed`
 * events so Home Assistant can persist the card configuration.
 *
 * This file is frontend-only and does not perform any backend logic.
 */



import { DEFAULTS } from "./constants.js";
import { createDebugger } from "./debugger.js";
import { loadAssistantOptions, loadWeatherOptions, readAssistStateInputs, readPipelineInputs, readWeatherInputs, syncAssistStateControls, syncConditionControls, syncPipelineControls, syncWeatherControls } from "./editorOptions.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("macsCardEditor", DEBUG_ENABLED);


const cssUrl = new URL("./editor.css", import.meta.url).toString();
const styleSheet = `<link rel="stylesheet" href="${cssUrl}">`;

const temperatureUnitItems = [
	{ id: "", name: "Auto" },
	{ id: "c", name: "Celsius (°C)" },
	{ id: "f", name: "Fahrenheit (°F)" },
];

const windUnitItems = [
	{ id: "", name: "Auto" },
	{ id: "mph", name: "Miles per hour (mph)" },
	{ id: "kph", name: "Kilometres per hour (kph)" },
	{ id: "mps", name: "Metres per second (m/s)" },
	{ id: "knots", name: "Knots" },
];

const precipitationUnitItems = [
	{ id: "", name: "Auto" },
	{ id: "%", name: "Chance of rain (%)" },
	{ id: "mm", name: "Millimetres (mm)" },
	{ id: "in", name: "Inches (in)" },
];

const batteryChargeUnitItems = [
	{ id: "%", name: "Percent (%)" },
	{ id: "v", name: "Volts (V)" },
];


const instructions = `
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

						<div>number.macs_temperature</div>
						<div>macs.set_temperature</div>

						<div>number.macs_windspeed</div>
						<div>macs.set_windspeed</div>

						<div>number.macs_precipitation</div>
						<div>macs.set_precipitation</div>
					</div>
				</div>
			</div>
		</div>
	`;

const about = `
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

function createHtmlGroup({ id, name, label, hint = null, placeholder, units = false, minMax = false }) {
	let htmlString = `
		<!-- ${name} -->
			<div class="group" id="${id}">
				<div class="row">
					<ha-switch id="${id}_enabled" label="${label}"></ha-switch>
					${hint !== null ? `
						<div class="hint">${hint}</div>
					` : ""}
				</div>

				<div class="row">
					<ha-combo-box id="${id}_select" label="${name} entity"></ha-combo-box>
				</div>

				<div class="row">
					<ha-textfield id="${id}_entity" label="${name} ID" placeholder="${placeholder}" class="fullwidth"></ha-textfield>
				</div>

				${units ? `
					<div class="row">
						<ha-combo-box id="${id}_unit" label="${name} units"></ha-combo-box>
					</div>
				` : ""}

				${minMax ? `
					<div class="row double">
						<ha-textfield id="${id}_min" label="Min value" placeholder="Leave empty for defaults" type="number" inputmode="decimal"></ha-textfield>
						<ha-textfield id="${id}_max" label="Max value" placeholder="Leave empty for defaults" type="number" inputmode="decimal"></ha-textfield>
					</div>
				` : ""}
			</div>
		`;
	return htmlString;
}

function populateCombobox(root, id, items, selectedId, options = {}) {
	if (!root) return null;

	const el = root.getElementById(id);
	if (!el) return null;

	const labelPath = options.labelPath ?? "name";
	const valuePath = options.valuePath ?? "id";
	const customValue = options.customValue ?? "custom";
	const allowCustom = !!options.allowCustom;
	const customFlag = !!options.customFlag;

	el.items = Array.isArray(items) ? items : [];
	el.itemLabelPath = labelPath;
	el.itemValuePath = valuePath;

	const selected = selectedId === null || typeof selectedId === "undefined" ? "" : String(selectedId);
	const hasSelected = selected.length > 0;

	if (allowCustom) {
		const known =
			Array.isArray(items) &&
			items.some((item) => item && item[valuePath] === selected && item[valuePath] !== customValue);
		const isCustom = customFlag || (!known && hasSelected);
		el.value = isCustom ? customValue : selected;
	} else {
		el.value = selected;
	}

	return el;
}

function createInputGroup(groups, definition) {
	if (!groups || !definition) return null;

	const group = {
		id: definition.id,
		name: definition.name,
		label: definition.label,
		hint: definition.hint,
		placeholder: definition.placeholder,
		units: !!definition.units,
		minMax: !!definition.minMax,
		selectItems: typeof definition.selectItems === "undefined" ? null : definition.selectItems,
		selectValue: definition.selectValue,
		selectOptions: typeof definition.selectOptions === "undefined" ? null : definition.selectOptions,
		unitItems: typeof definition.unitItems === "undefined" ? null : definition.unitItems,
		unitValue: definition.unitValue,
		wire: definition.wire !== false
	};

	group.html = createHtmlGroup(group);
	groups.push(group);
	return group;
}

function setupInputGroup(root, config, group) {
	if (!root || !group) return;

	if (Array.isArray(group.selectItems)) {
		populateCombobox(
			root,
			`${group.id}_select`,
			group.selectItems,
			group.selectValue,
			group.selectOptions || {}
		);
	}

	if (Array.isArray(group.unitItems)) {
		populateCombobox(root, `${group.id}_unit`, group.unitItems, group.unitValue);
	}

	if (group.minMax) {
		setMinMax(root, config, group.id);
	}
}

function setMinMax(root, config, idBase) {
	if (!root) return;

	const minKey = `${idBase}_min`;
	const maxKey = `${idBase}_max`;
	const elMin = root.getElementById(minKey);
	const elMax = root.getElementById(maxKey);

	if (elMin) elMin.value = (config?.[minKey] ?? "").toString();
	if (elMax) elMax.value = (config?.[maxKey] ?? "").toString();
}

function wireInput(root, id, onChange, options = {}) {
	if (!root || typeof onChange !== "function") return;

	const el = root.getElementById(id);
	if (!el) return;

	el.addEventListener("change", onChange);

	const listenValueChanged =
		typeof options.valueChanged !== "undefined"
			? options.valueChanged
			: id.endsWith("_select") || id.endsWith("_unit");

	if (listenValueChanged) {
		el.addEventListener("value-changed", onChange);
	}
}

export class MacsCardEditor extends HTMLElement {
	// get the defaults, and apply user's config
	setConfig(config) {
		this._config = { ...DEFAULTS, ...(config || {}) };
		debug("setConfig", { config: this._config });
		this._render();
	}

	set hass(hass) {
		this._hass = hass;
	}

	// render the card editor UI
	async _render() {
		if (!this.shadowRoot) {
			this.attachShadow({ mode: "open" });
		}

		let htmlOutput;

		const { satItems, pipelineItems, preferred } = await loadAssistantOptions(this._hass);
		const { temperatureItems, windItems, precipitationItems, batteryItems, conditionItems } = await loadWeatherOptions(this._hass);

		// Build DOM...
		const inputGroups = [];

		createInputGroup(inputGroups, {
			id: "assist_satellite",
			name: "Assist Satellite",
			label: "React to Wake-Words?",
			hint: "When enabled, Macs will mirror your selected Assist satellite.<br>(listening, processing, responding, idle, etc)",
			placeholder: "assist_satellite.my_device",
			selectItems: satItems,
			selectValue: this._config.assist_satellite_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.assist_satellite_custom }
		});

		createInputGroup(inputGroups, {
			id: "assist_pipeline",
			name: "Assistant Pipeline",
			label: "Display Dialogue?",
			hint: "When enabled, Macs will display conversations with your assistant.",
			placeholder: "01k...",
			selectItems: pipelineItems,
			selectValue: this._config.assist_pipeline_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.assist_pipeline_custom }
		});

		createInputGroup(inputGroups, {
			id: "temperature_sensor",
			name: "Temperature",
			label: "Use Temperature Sensor?",
			hint: null,
			placeholder: "sensor.my_temperature",
			units: true,
			minMax: true,
			selectItems: temperatureItems,
			selectValue: this._config.temperature_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.temperature_sensor_custom },
			unitItems: temperatureUnitItems,
			unitValue: this._config.temperature_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "wind_sensor",
			name: "Wind Sensor",
			label: "Use Wind Sensor?",
			hint: null,
			placeholder: "sensor.my_wind_speed",
			units: true,
			minMax: true,
			selectItems: windItems,
			selectValue: this._config.wind_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.wind_sensor_custom },
			unitItems: windUnitItems,
			unitValue: this._config.wind_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "precipitation_sensor",
			name: "Rainfall Sensor",
			label: "Use Rainfall Sensor?",
			hint: null,
			placeholder: "sensor.my_rain",
			units: true,
			minMax: true,
			selectItems: precipitationItems,
			selectValue: this._config.precipitation_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.precipitation_sensor_custom },
			unitItems: precipitationUnitItems,
			unitValue: this._config.precipitation_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "weather_conditions",
			name: "Weather Conditions",
			label: "Auto-Detect Weather Conditions?",
			hint: null,
			placeholder: "weather.forecast_home",
			selectItems: conditionItems,
			selectValue: this._config.weather_conditions ?? "",
			selectOptions: { allowCustom: true }
		});

		createInputGroup(inputGroups, {
			id: "battery_charge_sensor",
			name: "Battery Charge",
			label: "Use Battery Sensor?",
			hint: null,
			placeholder: "sensor.my_battery",
			units: true,
			minMax: true,
			selectItems: batteryItems,
			selectValue: this._config.battery_charge_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.battery_charge_sensor_custom },
			unitItems: batteryChargeUnitItems,
			unitValue: this._config.battery_charge_sensor_unit ?? "%"
		});

		htmlOutput = styleSheet;
		htmlOutput += inputGroups.map((group) => group.html).join("");
		htmlOutput += instructions;
		htmlOutput += about;

		this.shadowRoot.innerHTML = htmlOutput;


		// Page has rendered
		this._rendered = true;

		this._inputGroups = inputGroups;
		this._satelliteItems = satItems;
		this._pipelineItems = pipelineItems;
		this._temperatureItems = temperatureItems;
		this._windItems = windItems;
		this._precipitationItems = precipitationItems;
		this._batteryItems = batteryItems;
		this._conditionItems = conditionItems;

		inputGroups.forEach((group) => setupInputGroup(this.shadowRoot, this._config, group));


		// About/Support toggle
		const toggle = this.shadowRoot.querySelector(".about-toggle");
		const arrow = this.shadowRoot.querySelector(".about-arrow");
		const content = this.shadowRoot.querySelector(".about-content");

		if (toggle && arrow && content) {
			toggle.addEventListener("click", () => {
				const open = !content.hasAttribute("hidden");
				content.toggleAttribute("hidden", open);
				arrow.textContent = open ? ">" : "v";
			});
		}

		// Wire once per render (safe because render rebuilds DOM)
		this._wire();

		// Sync UI from config
		this._sync();
		//this._pipelinesLoaded = true;

		// If user hasn't set a pipeline yet, pick HA's preferred
		const currentPid = (this._config.assist_pipeline_entity ?? "").toString().trim();
		if (!currentPid && preferred && !this._config.assist_pipeline_custom) {
			const next = {
				type: "custom:macs-card",
				...this._config,
				assist_pipeline_entity: preferred,
				assist_pipeline_custom: false
			};
			this._config = next;
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		}
	}


	// sync UI state from this._config
	async _sync() {
		if (!this.shadowRoot) return;

		syncAssistStateControls(this.shadowRoot, this._config, this._satelliteItems);
		syncPipelineControls(this.shadowRoot, this._config, this._pipelineItems);
		syncWeatherControls(
			this.shadowRoot,
			this._config,
			this._temperatureItems || [],
			this._windItems || [],
			this._precipitationItems || [],
			this._batteryItems || []
		);
		syncConditionControls(this.shadowRoot, this._config, this._conditionItems || []);
	}

	// wire up event listeners for user config changes
	_wire() {
		const onChange = (e) => {
			const target = e?.currentTarget;
			if (target?.id && target.id.endsWith("_unit")) {
				debug("unit-change", {
					id: target.id,
					type: e?.type,
					detailValue: e?.detail?.value,
					value: target.value,
					selectedItemId: target.selectedItem?.id
				});
			}

			const assistConfig = readAssistStateInputs(this.shadowRoot, e, this._config);
			const pipelineConfig = readPipelineInputs(this.shadowRoot, e, this._config);
			const weatherConfig = readWeatherInputs(this.shadowRoot, e, this._config);
			debug("weather-config", weatherConfig);

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

		const groups = Array.isArray(this._inputGroups) ? this._inputGroups : [];
		groups.forEach((group) => {
			if (!group || group.wire === false) return;

			const baseId = group.id;
			const ids = [
				`${baseId}_enabled`,
				`${baseId}_select`,
				`${baseId}_entity`,
			];

			if (group.units) {
				ids.push(`${baseId}_unit`);
			}

			if (group.minMax) {
				ids.push(`${baseId}_min`, `${baseId}_max`);
			}

			ids.forEach((id) => wireInput(this.shadowRoot, id, onChange));
		});

	}
}




