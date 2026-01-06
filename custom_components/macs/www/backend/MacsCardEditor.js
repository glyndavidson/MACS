/**
 * MacsCardEditor
 * ---------------
 * Home Assistant Lovelace card editor for M.A.C.S. (Mood-Aware Character SVG).
 *
 * This file defines the custom editor UI shown in the Lovelace card configuration
 * panel. 
 *
 * User selections are merged with default values and emitted via `config-changed`
 * events so Home Assistant can persist the card configuration.
 *
 * This file is frontend-only and does not perform any backend logic.
 */



import { DEFAULTS, TEMPERATURE_UNIT_ITEMS, WIND_UNIT_ITEMS, PRECIPITATION_UNIT_ITEMS, BATTERY_CHARGE_UNIT_ITEMS, CARD_EDITOR_INFO, CARD_EDITOR_ABOUT } from "../shared/constants.js";
import { createDebugger } from "../shared/debugger.js";
import { getValidUrl } from "./validators.js";
import { loadAssistantOptions, loadWeatherOptions, readAssistStateInputs, readAutoBrightnessInputs, readPipelineInputs, readWeatherInputs, syncAssistStateControls, syncConditionControls, syncAutoBrightnessControls, syncPipelineControls, syncWeatherControls } from "./editorOptions.js";

const debug = createDebugger("editor");

function createHtmlGroup({ id, name, label, hint = null, tooltip = null, placeholder, units = false, minMax = false, customInput = "", select = true, entity = true }) {
	const safeHint = hint
		? hint.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		: "";
	const safeTooltipAttr = tooltip
		? tooltip.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;")
		: "";
	const safeTooltipHtml = tooltip
		? tooltip.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		: "";
	let htmlString = `
		<!-- ${name} -->
			<div class="group" id="${id}">
				<div class="row">
					<label for="${id}_enabled">${label}${safeTooltipAttr ? ` <ha-icon class="tooltip" icon="mdi:information-outline" tabindex="0" role="button" aria-label="${safeTooltipAttr}" data-target="${id}_hint"></ha-icon>` : ""}</label>
					<ha-switch id="${id}_enabled"></ha-switch>
					${safeHint ? `
						<div class="hint always">${safeHint}</div>
					` : ""}
					${safeTooltipHtml ? `
						<div class="hint" id="${id}_hint">${safeTooltipHtml}</div>
					` : ""}
				</div>

				${select ? `
					<div class="row">
						<ha-combo-box id="${id}_select" label="${name} entity"></ha-combo-box>
					</div>
				` : ""}

				${entity ? `
					<div class="row">
						<ha-textfield id="${id}_entity" label="${name} ID" placeholder="${placeholder}" class="fullwidth"></ha-textfield>
					</div>
				` : ""}

				${customInput || ""}

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
		tooltip: definition.tooltip,
		placeholder: definition.placeholder,
		units: !!definition.units,
		minMax: !!definition.minMax,
		select: typeof definition.select === "undefined" ? true : !!definition.select,
		entity: typeof definition.entity === "undefined" ? true : !!definition.entity,
		customInput: definition.customInput || "",
		extraIds: Array.isArray(definition.extraIds) ? definition.extraIds : [],
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

	const listenCheckedChanged =
		typeof options.checkedChanged !== "undefined"
			? options.checkedChanged
			: id.endsWith("_enabled");

	if (listenValueChanged) {
		el.addEventListener("value-changed", onChange);
	}

	if (listenCheckedChanged) {
		el.addEventListener("checked-changed", onChange);
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
		const { temperatureItems, windItems, precipitationItems, batteryItems, batteryStateItems, conditionItems } = await loadWeatherOptions(this._hass);

		// Build DOM...
		const inputGroups = [];

		createInputGroup(inputGroups, {
			id: "assist_satellite",
			name: "Assist Satellite",
			label: "React to Wake-Words?",
			hint: null,
			tooltip: "When enabled, M.A.C.S. follows the selected Assist satellite state and overrides the mood select.",
			placeholder: "assist_satellite.my_device",
			selectItems: satItems,
			selectValue: this._config.assist_satellite_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.assist_satellite_custom }
		});

		createInputGroup(inputGroups, {
			id: "assist_pipeline",
			name: "Assistant Pipeline",
			label: "Display Dialogue?",
			hint: null,
			tooltip: "When enabled, M.A.C.S. shows dialogue from the selected Assist pipeline.",
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
			tooltip: "When enabled, the selected sensor is used and the M.A.C.S. Temperature entity/service is ignored.",
			placeholder: "sensor.my_temperature",
			units: true,
			minMax: true,
			selectItems: temperatureItems,
			selectValue: this._config.temperature_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.temperature_sensor_custom },
			unitItems: TEMPERATURE_UNIT_ITEMS,
			unitValue: this._config.temperature_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "wind_sensor",
			name: "Wind Sensor",
			label: "Use Wind Sensor?",
			hint: null,
			tooltip: "When enabled, the selected sensor is used and the M.A.C.S. Wind Speed entity/service is ignored.",
			placeholder: "sensor.my_wind_speed",
			units: true,
			minMax: true,
			selectItems: windItems,
			selectValue: this._config.wind_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.wind_sensor_custom },
			unitItems: WIND_UNIT_ITEMS,
			unitValue: this._config.wind_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "precipitation_sensor",
			name: "Rainfall Sensor",
			label: "Use Rainfall Sensor?",
			hint: null,
			tooltip: "When enabled, the selected sensor is used and the M.A.C.S. Precipitation entity/service is ignored.",
			placeholder: "sensor.my_rain",
			units: true,
			minMax: true,
			selectItems: precipitationItems,
			selectValue: this._config.precipitation_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.precipitation_sensor_custom },
			unitItems: PRECIPITATION_UNIT_ITEMS,
			unitValue: this._config.precipitation_sensor_unit ?? ""
		});

		createInputGroup(inputGroups, {
			id: "weather_conditions",
			name: "Weather Conditions",
			label: "Auto-Detect Weather Conditions?",
			hint: null,
			tooltip: "When enabled, conditions come from the selected weather entity and the condition toggles are ignored.",
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
			tooltip: "When enabled, the selected sensor is used and the M.A.C.S. Battery Charge entity/service is ignored. Macs Mood will turn sad at 20% Battery.",
			placeholder: "sensor.my_battery",
			units: true,
			minMax: true,
			selectItems: batteryItems,
			selectValue: this._config.battery_charge_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.battery_charge_sensor_custom },
			unitItems: BATTERY_CHARGE_UNIT_ITEMS,
			unitValue: this._config.battery_charge_sensor_unit ?? "%"
		});

		createInputGroup(inputGroups, {
			id: "battery_state_sensor",
			name: "Battery State",
			label: "Use Charging Sensor?",
			hint: null,
			tooltip: "When enabled, the selected sensor is used to detect charging state.",
			placeholder: "sensor.ipad_battery_state",
			selectItems: batteryStateItems,
			selectValue: this._config.battery_state_sensor_entity ?? "",
			selectOptions: { allowCustom: true, customFlag: !!this._config.battery_state_sensor_custom }
		});

		createInputGroup(inputGroups, {
			id: "auto_brightness",
			name: "Kiosk Mode",
			label: "Enable Kiosk Mode?",
			hint: null,
			tooltip: "When enabled, the card uses its kiosk timer for dimming and sleep. Tip: hold anywhere on the card to toggle the sidebar and navbar.",
			placeholder: "",
			select: false,
			entity: false,
			minMax: true,
			customInput: `
				<div class="row">
					<label for="auto_brightness_pause_animations_enabled">Pause animations when asleep?</label>
					<ha-switch id="auto_brightness_pause_animations_enabled"></ha-switch>
					<div class="hint always">Reduces power consumption</div>
				</div>
				<div class="row">
					<ha-textfield id="auto_brightness_timeout_minutes" class="fullwidth" label="Screen timeout (minutes)" placeholder="5" type="number" inputmode="decimal" min="2"></ha-textfield>
				</div>
			`,
			extraIds: ["auto_brightness_timeout_minutes", "auto_brightness_pause_animations_enabled"]
		});

		const cssUrl = getValidUrl("backend/editor.css");
		const styleSheet = `<link rel="stylesheet" href="${cssUrl}">`;

		htmlOutput = styleSheet;
		htmlOutput += inputGroups.map((group) => group.html).join("");
		htmlOutput += CARD_EDITOR_INFO;
		htmlOutput += CARD_EDITOR_ABOUT;

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
		this._batteryStateItems = batteryStateItems;
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

		// Tooltip toggles show/hide the inline hint.
		const tooltips = this.shadowRoot.querySelectorAll(".tooltip");
		tooltips.forEach((tooltip) => {
			tooltip.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				const targetId = tooltip.getAttribute("data-target");
				if (!targetId) return;
				const hint = this.shadowRoot.getElementById(targetId);
				if (!hint) return;
				hint.classList.toggle("open");
			});
			tooltip.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				tooltip.click();
			});
		});

		// Wire once per render (safe because render rebuilds DOM)
		this._wire();

		// Sync UI from config
		this._sync();
		//this._pipelinesLoaded = true;

		// If user hasn't set a pipeline yet, pick HA's preferred
		const currentPid = (this._config.assist_pipeline_entity ?? "").toString().trim();
		if (!currentPid && preferred && !this._config.assist_pipeline_custom) {
			const assistConfig = readAssistStateInputs(this.shadowRoot, null, this._config);
			const pipelineConfig = readPipelineInputs(this.shadowRoot, null, this._config);
			const weatherConfig = readWeatherInputs(this.shadowRoot, null, this._config);
			const autoBrightnessConfig = readAutoBrightnessInputs(this.shadowRoot, null, this._config);
			const next = {
				type: "custom:macs-card",
				...assistConfig,
				...pipelineConfig,
				...weatherConfig,
				...autoBrightnessConfig,
				assist_pipeline_entity: preferred,
				assist_pipeline_custom: false,
			};
			this._config = { ...DEFAULTS, ...next };
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
			this._batteryItems || [],
			this._batteryStateItems || []
		);
		syncConditionControls(this.shadowRoot, this._config, this._conditionItems || []);
		syncAutoBrightnessControls(this.shadowRoot, this._config);
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
			const autoBrightnessConfig = readAutoBrightnessInputs(this.shadowRoot, e, this._config);
			debug("weather-config", weatherConfig);

			// Commit new config
			const next = {
				type: "custom:macs-card",
				...assistConfig,
				...pipelineConfig,
				...weatherConfig,
				...autoBrightnessConfig
			};

			this._config = { ...DEFAULTS, ...next };

			// IMPORTANT: do NOT call this._sync() here (HA will call setConfig again)
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		};

		const groups = Array.isArray(this._inputGroups) ? this._inputGroups : [];
		groups.forEach((group) => {
			if (!group || group.wire === false) return;

			const baseId = group.id;
			const ids = [`${baseId}_enabled`];

			if (group.select !== false) {
				ids.push(`${baseId}_select`);
			}

			if (group.entity !== false) {
				ids.push(`${baseId}_entity`);
			}

			if (group.units) {
				ids.push(`${baseId}_unit`);
			}

			if (group.minMax) {
				ids.push(`${baseId}_min`, `${baseId}_max`);
			}

			if (Array.isArray(group.extraIds) && group.extraIds.length > 0) {
				ids.push(...group.extraIds);
			}

			ids.forEach((id) => wireInput(this.shadowRoot, id, onChange));
		});
	}
}
