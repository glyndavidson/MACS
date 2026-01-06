/**
 * Editor Options
 * --------------
 * Loads dynamic option lists used by the card editor.
 */
// Helper and editor option utilities for the MACS editor.

export async function loadSatellites(hass) {
	// Guard against missing HA state.
	if (!hass || !hass.states) {
		return { satellites: [] };
	}

	var satellites = [];
	var stateIds = Object.keys(hass.states);
	var i = 0;

	for (i = 0; i < stateIds.length; i++) {
		var id = stateIds[i];
		if (id.indexOf("assist_satellite.") !== 0) {
			continue;
		}
		var st = hass.states[id];
		var name = (st && st.attributes && st.attributes.friendly_name) || id;
		satellites.push({ id: id, name: String(name) });
	}

	satellites.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	return { satellites: satellites };
}

export async function loadPipelines(hass) {
	// If we cannot talk to HA, return an empty set.
	if (!hass) {
		return { pipelines: [], preferred: "" };
	}

	var res = await hass.callWS({ type: "assist_pipeline/pipeline/list" });
	var pipelines = Array.isArray(res && res.pipelines) ? res.pipelines : [];
	var preferred = String(res && res.preferred_pipeline ? res.preferred_pipeline : "");

	// Normalize pipelines into { id, name } and discard missing ids.
	var out = [];
	var i = 0;
	for (i = 0; i < pipelines.length; i++) {
		var p = pipelines[i] || {};
		var id = String(p.id || "");
		if (!id) {
			continue;
		}
		var name = String(p.name || p.id || "Unnamed");
		out.push({ id: id, name: name });
	}

	return { preferred: preferred, pipelines: out };
}

export async function loadAssistantOptions(hass) {
	// Load satellites and pipelines, but be defensive if HA errors.
	var satellitesPayload = { satellites: [] };
	if (hass) {
		try {
			satellitesPayload = await loadSatellites(hass);
		} catch (_err) {
			// Ignore failures and fall back to empty.
		}
	}

	var satellites = satellitesPayload.satellites || [];
	var satItems = [{ id: "custom", name: "Custom" }];
	var i = 0;
	for (i = 0; i < satellites.length; i++) {
		satItems.push({ id: satellites[i].id, name: satellites[i].name });
	}

	var pipelinesPayload = { pipelines: [], preferred: "" };
	if (hass) {
		try {
			pipelinesPayload = await loadPipelines(hass);
		} catch (_err2) {
			// Ignore failures and fall back to empty.
		}
	}

	var pipelines = pipelinesPayload.pipelines || [];
	var preferred = pipelinesPayload.preferred || "";
	var pipelineItems = [{ id: "custom", name: "Custom" }];
	for (i = 0; i < pipelines.length; i++) {
		pipelineItems.push(pipelines[i]);
	}

	return { satItems: satItems, pipelineItems: pipelineItems, preferred: preferred };
}

function comboValue(el, e) {
	// Prefer the event detail value when this element triggered the event.
	if (e && e.currentTarget === el && e.detail && typeof e.detail.value !== "undefined") {
		return e.detail.value;
	}
	// Fallback to HA combo-box selection.
	if (el && el.selectedItem && typeof el.selectedItem.id !== "undefined") {
		return el.selectedItem.id;
	}
	// Last resort: raw element value.
	return el && typeof el.value !== "undefined" ? el.value : "";
}

function readToggleValue(el, e, fallback) {
	if (el) {
		if (e && e.currentTarget === el) {
			if (e.detail && typeof e.detail.value !== "undefined") {
				return !!e.detail.value;
			}
			if (e.detail && typeof e.detail.checked !== "undefined") {
				return !!e.detail.checked;
			}
		}
		if (typeof el.checked !== "undefined") {
			return !!el.checked;
		}
	}
	return !!fallback;
}

export function syncAssistStateControls(root, config, satelliteItems) {
	// Sync assist state controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var assistStateAutoMood = !!(config && config.assist_satellite_enabled);
	var assistStateAutoMoodToggle = root.getElementById("assist_satellite_enabled");
	var satelliteSelect = root.getElementById("assist_satellite_select");
	var satelliteEntity = root.getElementById("assist_satellite_entity");

	if (assistStateAutoMoodToggle && assistStateAutoMoodToggle.checked !== assistStateAutoMood) {
		assistStateAutoMoodToggle.checked = assistStateAutoMood;
	}

	if (satelliteSelect) {
		satelliteSelect.disabled = !assistStateAutoMood;
	}
	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood;
	}

	var eid = String((config && config.assist_satellite_entity) || "");
	var knownSatellite =
		Array.isArray(satelliteItems) &&
		satelliteItems.some(function (s) {
			return s.id === eid && s.id !== "custom";
		});
	var satIsCustom = !!(config && config.assist_satellite_custom) || !knownSatellite;
	var nextSatSelect = satIsCustom ? "custom" : eid;

	if (satelliteSelect && satelliteSelect.value !== nextSatSelect) {
		satelliteSelect.value = nextSatSelect;
	}
	if (
		satelliteEntity &&
		satelliteEntity.value !== eid &&
		(!satIsCustom || !satelliteEntity.matches(":focus-within"))
	) {
		satelliteEntity.value = eid;
	}
	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood || !satIsCustom;
	}
}

export function syncPipelineControls(root, config, pipelineItems) {
	// Sync pipeline controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var dialogueEnabled = !!(config && config.assist_pipeline_enabled);
	var dialogueEnabledToggle = root.getElementById("assist_pipeline_enabled");
	var pipelineSelect = root.getElementById("assist_pipeline_select");
	var pipelineId = root.getElementById("assist_pipeline_entity");

	if (dialogueEnabledToggle && dialogueEnabledToggle.checked !== dialogueEnabled) {
		dialogueEnabledToggle.checked = dialogueEnabled;
	}

	if (pipelineSelect) {
		pipelineSelect.disabled = !dialogueEnabled;
	}
	if (pipelineId) {
		pipelineId.disabled = !dialogueEnabled;
	}

	var pid = String((config && config.assist_pipeline_entity) || "");
	var knownPipeline =
		Array.isArray(pipelineItems) &&
		pipelineItems.some(function (p) {
			return p.id === pid && p.id !== "custom";
		});
	var pipelineIsCustom = !!(config && config.assist_pipeline_custom) || !knownPipeline;
	var nextPipelineSelect = pipelineIsCustom ? "custom" : pid;

	if (pipelineSelect && pipelineSelect.value !== nextPipelineSelect) {
		pipelineSelect.value = nextPipelineSelect;
	}
	if (pipelineId && pipelineId.value !== pid && !pipelineId.matches(":focus-within")) {
		pipelineId.value = pid;
	}
	if (pipelineId) {
		pipelineId.disabled = !dialogueEnabled || !pipelineIsCustom;
	}
}

export function syncConditionControls(root, config, conditionItems) {
	// Sync weather condition controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var conditionsEnabled = !!(config && config.weather_conditions_enabled);
	var conditionsToggle = root.getElementById("weather_conditions_enabled");
	var conditionsSelect = root.getElementById("weather_conditions_select");
	var conditionsEntity = root.getElementById("weather_conditions_entity");

	if (conditionsToggle && conditionsToggle.checked !== conditionsEnabled) {
		conditionsToggle.checked = conditionsEnabled;
	}

	if (conditionsSelect) {
		conditionsSelect.disabled = !conditionsEnabled;
	}
	if (conditionsEntity) {
		conditionsEntity.disabled = !conditionsEnabled;
	}

	var value = String((config && config.weather_conditions) || "");
	var knownCondition =
		Array.isArray(conditionItems) &&
		conditionItems.some(function (c) {
			return c.id === value && c.id !== "custom";
		});
	var isCustom = value.length > 0 && !knownCondition;
	var nextSelect = isCustom ? "custom" : value;

	if (conditionsSelect && conditionsSelect.value !== nextSelect) {
		conditionsSelect.value = nextSelect;
	}
	if (
		conditionsEntity &&
		conditionsEntity.value !== value &&
		(!isCustom || !conditionsEntity.matches(":focus-within"))
	) {
		conditionsEntity.value = value;
	}
	if (conditionsEntity) {
		conditionsEntity.disabled = !conditionsEnabled || !isCustom;
	}
}

export function syncAutoBrightnessControls(root, config) {
	// Sync auto-brightness controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var enabled = !!(config && config.auto_brightness_enabled);
	var toggle = root.getElementById("auto_brightness_enabled");
	var timeout = root.getElementById("auto_brightness_timeout_minutes");
	var minBrightness = root.getElementById("auto_brightness_min");
	var maxBrightness = root.getElementById("auto_brightness_max");
	var pauseToggle = root.getElementById("auto_brightness_pause_animations_enabled");

	if (toggle && toggle.checked !== enabled) {
		toggle.checked = enabled;
	}

	if (timeout) timeout.disabled = !enabled;
	if (minBrightness) minBrightness.disabled = !enabled;
	if (maxBrightness) maxBrightness.disabled = !enabled;
	if (pauseToggle) pauseToggle.disabled = !enabled;

	var timeoutVal = config && config.auto_brightness_timeout_minutes;
	if (timeout && timeout.value !== timeoutVal) {
		timeout.value = timeoutVal === null || typeof timeoutVal === "undefined" ? "" : String(timeoutVal);
	}

	var minVal = config && config.auto_brightness_min;
	if (minBrightness && minBrightness.value !== minVal) {
		minBrightness.value = minVal === null || typeof minVal === "undefined" ? "" : String(minVal);
	}

	var maxVal = config && config.auto_brightness_max;
	if (maxBrightness && maxBrightness.value !== maxVal) {
		maxBrightness.value = maxVal === null || typeof maxVal === "undefined" ? "" : String(maxVal);
	}

	var pauseVal = !!(config && config.auto_brightness_pause_animations);
	if (pauseToggle && pauseToggle.checked !== pauseVal) {
		pauseToggle.checked = pauseVal;
	}
}

export function readAssistStateInputs(root, e, config) {
	// Read assist state inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			assist_satellite_enabled: !!(config && config.assist_satellite_enabled),
			assist_satellite_entity: String((config && config.assist_satellite_entity) || ""),
			assist_satellite_custom: !!(config && config.assist_satellite_custom),
		};
	}

	var toggle = root.getElementById("assist_satellite_enabled");
	var assistStateAutoMood = readToggleValue(toggle, e, config && config.assist_satellite_enabled);
	var satelliteSelect = root.getElementById("assist_satellite_select");
	var satelliteEntity = root.getElementById("assist_satellite_entity");
	var satelliteSelectValue = comboValue(satelliteSelect, e);
	var satManualVal = (satelliteEntity && satelliteEntity.value) || "";
	var assistSatelliteCustom = satelliteSelectValue === "custom";
	var assistSatelliteEntity = assistSatelliteCustom ? satManualVal : satelliteSelectValue;

	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood || !assistSatelliteCustom;
	}

	return {
		assist_satellite_enabled: assistStateAutoMood,
		assist_satellite_entity: assistSatelliteEntity,
		assist_satellite_custom: assistSatelliteCustom,
	};
}

export function readPipelineInputs(root, e, config) {
	// Read pipeline inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			assist_pipeline_enabled: !!(config && config.assist_pipeline_enabled),
			assist_pipeline_entity: String((config && config.assist_pipeline_entity) || ""),
			assist_pipeline_custom: !!(config && config.assist_pipeline_custom),
		};
	}

	var pipelineToggle = root.getElementById("assist_pipeline_enabled");
	var assist_pipeline_enabled = readToggleValue(pipelineToggle, e, config && config.assist_pipeline_enabled);
	var pipelineSelect = root.getElementById("assist_pipeline_select");
	var pipelineIdInput = root.getElementById("assist_pipeline_entity");
	var pipelineValue = comboValue(pipelineSelect, e);
	var pipelineId = (pipelineIdInput && pipelineIdInput.value) || "";
	var pipeline_custom = pipelineValue === "custom";

	if (pipelineIdInput) {
		pipelineIdInput.disabled = !assist_pipeline_enabled || !pipeline_custom;
	}

	var pipeline_entity = pipeline_custom ? pipelineId : pipelineValue;

	return {
		assist_pipeline_enabled: assist_pipeline_enabled,
		assist_pipeline_entity: pipeline_entity,
		assist_pipeline_custom: pipeline_custom,
	};
}

export function readAutoBrightnessInputs(root, e, config) {
	// Read auto-brightness inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			auto_brightness_enabled: !!(config && config.auto_brightness_enabled),
			auto_brightness_timeout_minutes: String((config && config.auto_brightness_timeout_minutes) || ""),
			auto_brightness_min: String((config && config.auto_brightness_min) || ""),
			auto_brightness_max: String((config && config.auto_brightness_max) || ""),
			auto_brightness_pause_animations: !!(config && config.auto_brightness_pause_animations),
		};
	}

	var toggle = root.getElementById("auto_brightness_enabled");
	var enabled = readToggleValue(toggle, e, config && config.auto_brightness_enabled);
	var timeout = root.getElementById("auto_brightness_timeout_minutes");
	var minBrightness = root.getElementById("auto_brightness_min");
	var maxBrightness = root.getElementById("auto_brightness_max");
	var pauseToggle = root.getElementById("auto_brightness_pause_animations_enabled");

	if (timeout) timeout.disabled = !enabled;
	if (minBrightness) minBrightness.disabled = !enabled;
	if (maxBrightness) maxBrightness.disabled = !enabled;
	if (pauseToggle) pauseToggle.disabled = !enabled;

	var parseNumber = function (value) {
		if (value === "" || value === null || typeof value === "undefined") {
			return "";
		}
		var num = Number(value);
		return Number.isFinite(num) ? num : "";
	};

	var rawTimeout = timeout ? timeout.value : undefined;
	if (rawTimeout === "" || rawTimeout === null || typeof rawTimeout === "undefined") {
		rawTimeout = config && config.auto_brightness_timeout_minutes;
	}

	var rawMin = minBrightness ? minBrightness.value : undefined;
	if (rawMin === "" || rawMin === null || typeof rawMin === "undefined") {
		rawMin = config && config.auto_brightness_min;
	}

	var rawMax = maxBrightness ? maxBrightness.value : undefined;
	if (rawMax === "" || rawMax === null || typeof rawMax === "undefined") {
		rawMax = config && config.auto_brightness_max;
	}

	return {
		auto_brightness_enabled: enabled,
		auto_brightness_timeout_minutes: parseNumber(rawTimeout),
		auto_brightness_min: parseNumber(rawMin),
		auto_brightness_max: parseNumber(rawMax),
		auto_brightness_pause_animations: readToggleValue(pauseToggle, e, config && config.auto_brightness_pause_animations),
	};
}

export function readConditionInputs(root, e, config) {
	// Read weather condition inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			weather_conditions_enabled: !!(config && config.weather_conditions_enabled),
			weather_conditions: String((config && config.weather_conditions) || ""),
		};
	}

	var toggle = root.getElementById("weather_conditions_enabled");
	var conditionsEnabled = readToggleValue(toggle, e, config && config.weather_conditions_enabled);
	var conditionsSelect = root.getElementById("weather_conditions_select");
	var conditionsEntity = root.getElementById("weather_conditions_entity");
	var selectValue = comboValue(conditionsSelect, e);
	var manualVal = (conditionsEntity && conditionsEntity.value) || "";
	var isCustom = selectValue === "custom";
	var entityVal = isCustom ? manualVal : selectValue;

	if (conditionsEntity) {
		conditionsEntity.disabled = !conditionsEnabled || !isCustom;
	}
	if (conditionsSelect) {
		conditionsSelect.disabled = !conditionsEnabled;
	}

	return {
		weather_conditions_enabled: conditionsEnabled,
		weather_conditions: conditionsEnabled ? String(entityVal || "") : "",
	};
}

function collectSensors(hass, predicate) {
	// Build a sorted list of sensors matching the predicate.
	if (!hass || !hass.states) {
		return [];
	}

	var out = [];
	var entries = Object.entries(hass.states);
	var i = 0;

	for (i = 0; i < entries.length; i++) {
		var id = entries[i][0];
		var st = entries[i][1];
		if (id.indexOf("sensor.") !== 0) {
			continue;
		}
		if (predicate(id, st)) {
			var name = (st && st.attributes && st.attributes.friendly_name) || id;
			out.push({ id: id, name: String(name) });
		}
	}

	out.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	return out;
}

function collectBinarySensors(hass, predicate) {
	// Build a sorted list of binary sensors matching the predicate.
	if (!hass || !hass.states) {
		return [];
	}

	var out = [];
	var entries = Object.entries(hass.states);
	var i = 0;

	for (i = 0; i < entries.length; i++) {
		var id = entries[i][0];
		var st = entries[i][1];
		if (id.indexOf("binary_sensor.") !== 0) {
			continue;
		}
		if (predicate(id, st)) {
			var name = (st && st.attributes && st.attributes.friendly_name) || id;
			out.push({ id: id, name: String(name) });
		}
	}

	out.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	return out;
}

function collectWeatherEntities(hass) {
	// Build a sorted list of weather entities for condition selection.
	if (!hass || !hass.states) {
		return [];
	}

	var out = [];
	var entries = Object.entries(hass.states);
	var i = 0;

	for (i = 0; i < entries.length; i++) {
		var id = entries[i][0];
		var st = entries[i][1];
		if (id.indexOf("weather.") !== 0) {
			continue;
		}
		var name = (st && st.attributes && st.attributes.friendly_name) || id;
		out.push({ id: id, name: String(name) });
	}

	out.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	return out;
}

// Unit sets used for sensor matching.
const TEMP_UNITS = new Set(["░c", "c", "celsius", "░f", "f", "fahrenheit"]);
const WIND_UNITS = new Set(["mph", "kph", "mps", "knots", "km/h", "m/s", "kn", "kt", "kt/h"]);
const RAIN_UNITS = new Set(["mm", "in", "mm/h", "in/h", "inch", "inches"]);
const PERCENT_UNITS = new Set(["%"]);
const BATTERY_UNITS = new Set(["%", "percent", "percentage", "v", "volt", "volts", "mv"]);

function hasUnit(st, allowed) {
	// Check sensor unit against a known set.
	var u = String((st && st.attributes && st.attributes.unit_of_measurement) || "").toLowerCase();
	return allowed.has(u);
}

function hasDeviceClass(st, expected) {
	// Check HA device class on the sensor.
	return String((st && st.attributes && st.attributes.device_class) || "").toLowerCase() === expected;
}

function matchesName(id, st, keywords) {
	// Simple name/id keyword match.
	var name = (st && st.attributes && st.attributes.friendly_name) || "";
	var hay = (id + " " + name).toLowerCase();
	var i = 0;
	for (i = 0; i < keywords.length; i++) {
		if (hay.indexOf(keywords[i]) !== -1) {
			return true;
		}
	}
	return false;
}

export async function loadWeatherOptions(hass) {
	// Gather likely temperature sensors.
	var temps = collectSensors(hass, function (id, st) {
		return (
			hasDeviceClass(st, "temperature") ||
			hasUnit(st, TEMP_UNITS) ||
			matchesName(id, st, ["temp", "temperature"])
		);
	});

	// Gather likely wind speed sensors.
	var winds = collectSensors(hass, function (id, st) {
		return hasDeviceClass(st, "wind_speed") || hasUnit(st, WIND_UNITS) || matchesName(id, st, ["wind"]);
	});

	// Gather likely precipitation sensors.
	var rains = collectSensors(hass, function (id, st) {
		return (
			hasDeviceClass(st, "precipitation") ||
			hasDeviceClass(st, "precipitation_intensity") ||
			hasDeviceClass(st, "precipitation_probability") ||
			hasUnit(st, RAIN_UNITS) ||
			(hasUnit(st, PERCENT_UNITS) && matchesName(id, st, ["rain", "precip", "precipitation"])) ||
			matchesName(id, st, ["rain", "precip", "precipitation"])
		);
	});

	// Gather likely battery charge sensors.
	var batteries = collectSensors(hass, function (id, st) {
		return (
			hasDeviceClass(st, "battery") ||
			hasUnit(st, BATTERY_UNITS) ||
			matchesName(id, st, ["battery", "charge", "batt"])
		);
	});

	// Gather likely battery state/charging sensors.
	var batteryStates = collectSensors(hass, function (id, st) {
		return (
			hasDeviceClass(st, "battery") ||
			hasDeviceClass(st, "battery_charging") ||
			hasDeviceClass(st, "power") ||
			hasDeviceClass(st, "plug") ||
			matchesName(id, st, [
			"battery_state",
			"battery state",
			"is_charging",
			"charging",
			"charge",
			"charge_state",
			"charger",
			"plugged",
			"ac power",
			"power",
		])
		);
	});
	batteryStates = batteryStates.concat(collectBinarySensors(hass, function (id, st) {
		return (
			hasDeviceClass(st, "battery") ||
			hasDeviceClass(st, "battery_charging") ||
			hasDeviceClass(st, "power") ||
			hasDeviceClass(st, "plug") ||
			matchesName(id, st, [
			"battery_state",
			"battery state",
			"is_charging",
			"charging",
			"charge",
			"charge_state",
			"charger",
			"plugged",
			"ac power",
			"power",
		])
		);
	}));

	// Gather weather entities for condition strings.
	var conditions = collectWeatherEntities(hass);

	var temperatureItems = [{ id: "custom", name: "Custom" }].concat(temps);
	var windItems = [{ id: "custom", name: "Custom" }].concat(winds);
	var precipitationItems = [{ id: "custom", name: "Custom" }].concat(rains);
	var batteryItems = [{ id: "custom", name: "Custom" }].concat(batteries);
	var batteryStateItems = [{ id: "custom", name: "Custom" }].concat(batteryStates);
	var conditionItems = [{ id: "custom", name: "Custom" }].concat(conditions);

	return {
		temperatureItems: temperatureItems,
		windItems: windItems,
		precipitationItems: precipitationItems,
		batteryItems: batteryItems,
		batteryStateItems: batteryStateItems,
		conditionItems: conditionItems,
	};
}

function syncSingleWeather(
	root,
	config,
	items,
	ids,
	customFlagKey,
	entityKey,
	enabledKey,
	unitKey,
	minKey,
	maxKey
) {
	// Push config into a single weather section.
	if (!root) {
		return;
	}

	var enabled = !!(config && config[enabledKey]);
	var enabledToggle = root.getElementById(ids.enabled);
	var select = root.getElementById(ids.select);
	var entity = root.getElementById(ids.entity);
	var unit = unitKey ? root.getElementById(ids.unit) : null;
	var min = minKey ? root.getElementById(ids.min) : null;
	var max = maxKey ? root.getElementById(ids.max) : null;

	if (enabledToggle && enabledToggle.checked !== enabled) {
		enabledToggle.checked = enabled;
	}

	if (select) select.disabled = !enabled;
	if (entity) entity.disabled = !enabled;
	if (unit) unit.disabled = !enabled;
	if (min) min.disabled = !enabled;
	if (max) max.disabled = !enabled;

	var eid = String((config && config[entityKey]) || "");
	var known =
		Array.isArray(items) &&
		items.some(function (s) {
			return s.id === eid && s.id !== "custom";
		});
	var isCustom = !!(config && config[customFlagKey]) || !known;
	var nextSelect = isCustom ? "custom" : eid;

	if (select && select.value !== nextSelect) {
		select.value = nextSelect;
	}
	if (entity && entity.value !== eid && (!isCustom || !entity.matches(":focus-within"))) {
		entity.value = eid;
	}
	if (entity) {
		entity.disabled = !enabled || !isCustom;
	}

	if (unitKey) {
		var unitVal = String((config && config[unitKey]) || "");
		if (unit && unit.value !== unitVal) {
			unit.value = unitVal;
		}
	}

	if (minKey) {
		var cfgMin = config && config[minKey];
		if (min && min.value !== cfgMin) {
			min.value = cfgMin === null || typeof cfgMin === "undefined" ? "" : String(cfgMin);
		}
	}
	if (maxKey) {
		var cfgMax = config && config[maxKey];
		if (max && max.value !== cfgMax) {
			max.value = cfgMax === null || typeof cfgMax === "undefined" ? "" : String(cfgMax);
		}
	}
}

export function syncWeatherControls(root, config, temperatureItems, windItems, precipitationItems, batteryItems, batteryStateItems) {
	// Sync all sensor sections.
	syncSingleWeather(
		root,
		config,
		temperatureItems,
		{
			enabled: "temperature_sensor_enabled",
			select: "temperature_sensor_select",
			entity: "temperature_sensor_entity",
			unit: "temperature_sensor_unit",
			min: "temperature_sensor_min",
			max: "temperature_sensor_max",
		},
		"temperature_sensor_custom",
		"temperature_sensor_entity",
		"temperature_sensor_enabled",
		"temperature_sensor_unit",
		"temperature_sensor_min",
		"temperature_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		windItems,
		{
			enabled: "wind_sensor_enabled",
			select: "wind_sensor_select",
			entity: "wind_sensor_entity",
			unit: "wind_sensor_unit",
			min: "wind_sensor_min",
			max: "wind_sensor_max",
		},
		"wind_sensor_custom",
		"wind_sensor_entity",
		"wind_sensor_enabled",
		"wind_sensor_unit",
		"wind_sensor_min",
		"wind_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		precipitationItems,
		{
			enabled: "precipitation_sensor_enabled",
			select: "precipitation_sensor_select",
			entity: "precipitation_sensor_entity",
			unit: "precipitation_sensor_unit",
			min: "precipitation_sensor_min",
			max: "precipitation_sensor_max",
		},
		"precipitation_sensor_custom",
		"precipitation_sensor_entity",
		"precipitation_sensor_enabled",
		"precipitation_sensor_unit",
		"precipitation_sensor_min",
		"precipitation_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		batteryItems,
		{
			enabled: "battery_charge_sensor_enabled",
			select: "battery_charge_sensor_select",
			entity: "battery_charge_sensor_entity",
			unit: "battery_charge_sensor_unit",
			min: "battery_charge_sensor_min",
			max: "battery_charge_sensor_max",
		},
		"battery_charge_sensor_custom",
		"battery_charge_sensor_entity",
		"battery_charge_sensor_enabled",
		"battery_charge_sensor_unit",
		"battery_charge_sensor_min",
		"battery_charge_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		batteryStateItems,
		{
			enabled: "battery_state_sensor_enabled",
			select: "battery_state_sensor_select",
			entity: "battery_state_sensor_entity",
		},
		"battery_state_sensor_custom",
		"battery_state_sensor_entity",
		"battery_state_sensor_enabled"
	);
}

function readSingleWeather(
	root,
	e,
	ids,
	config,
	enabledKey,
	entityKey,
	customKey,
	unitKey,
	minKey,
	maxKey
) {
	// Read a single weather section from the DOM.
	var enabledEl = root.getElementById(ids.enabled);
	var select = root.getElementById(ids.select);
	var entityInput = root.getElementById(ids.entity);
	var unit = unitKey ? root.getElementById(ids.unit) : null;
	var min = minKey ? root.getElementById(ids.min) : null;
	var max = maxKey ? root.getElementById(ids.max) : null;

	var enabled = readToggleValue(enabledEl, e, config && config[enabledKey]);
	var selectValue = comboValue(select, e);
	var manualVal = (entityInput && entityInput.value) || "";
	var isCustom = selectValue === "custom";
	var entityVal = isCustom ? manualVal : selectValue;

	if (entityInput) entityInput.disabled = !enabled || !isCustom;
	if (select) select.disabled = !enabled;
	if (unit) unit.disabled = !enabled;
	if (min) min.disabled = !enabled;
	if (max) max.disabled = !enabled;

    // Parse numeric values only if they are valid numbers.
    var parseNumber = function (value) {
        if (value === "" || value === null || typeof value === "undefined") {
            return "";
        }
        var num = Number(value);
        return Number.isFinite(num) ? num : "";
    };

    var rawMin = min ? min.value : undefined;
    if (rawMin === "" || rawMin === null || typeof rawMin === "undefined") {
        rawMin = config && config[minKey];
    }
    var rawMax = max ? max.value : undefined;
    if (rawMax === "" || rawMax === null || typeof rawMax === "undefined") {
        rawMax = config && config[maxKey];
    }
	var payload = {
		[enabledKey]: enabled,
		[entityKey]: entityVal,
		[customKey]: isCustom,
    };
	if (unitKey) {
		payload[unitKey] = String(unit ? comboValue(unit, e) : ((config && config[unitKey]) || ""));
	}
	if (minKey) {
		payload[minKey] = parseNumber(rawMin);
	}
	if (maxKey) {
		payload[maxKey] = parseNumber(rawMax);
	}
	return payload;
}

export function readWeatherInputs(root, e, config) {
	// Read all weather inputs or fall back to config.
	if (!root) {
		return {
			temperature_sensor_enabled: !!(config && config.temperature_sensor_enabled),
			temperature_sensor_entity: String((config && config.temperature_sensor_entity) || ""),
			temperature_sensor_custom: !!(config && config.temperature_sensor_custom),
			temperature_sensor_unit: String((config && config.temperature_sensor_unit) || ""),
			temperature_sensor_min: String((config && config.temperature_sensor_min) || ""),
			temperature_sensor_max: String((config && config.temperature_sensor_max) || ""),
			wind_sensor_enabled: !!(config && config.wind_sensor_enabled),
			wind_sensor_entity: String((config && config.wind_sensor_entity) || ""),
			wind_sensor_custom: !!(config && config.wind_sensor_custom),
			wind_sensor_unit: String((config && config.wind_sensor_unit) || ""),
			wind_sensor_min: String((config && config.wind_sensor_min) || ""),
			wind_sensor_max: String((config && config.wind_sensor_max) || ""),
			precipitation_sensor_enabled: !!(config && config.precipitation_sensor_enabled),
			precipitation_sensor_entity: String((config && config.precipitation_sensor_entity) || ""),
			precipitation_sensor_custom: !!(config && config.precipitation_sensor_custom),
			precipitation_sensor_unit: String((config && config.precipitation_sensor_unit) || ""),
			precipitation_sensor_min: String((config && config.precipitation_sensor_min) || ""),
			precipitation_sensor_max: String((config && config.precipitation_sensor_max) || ""),
			battery_charge_sensor_enabled: !!(config && config.battery_charge_sensor_enabled),
			battery_charge_sensor_entity: String((config && config.battery_charge_sensor_entity) || ""),
			battery_charge_sensor_custom: !!(config && config.battery_charge_sensor_custom),
			battery_charge_sensor_unit: String((config && config.battery_charge_sensor_unit) || ""),
			battery_charge_sensor_min: String((config && config.battery_charge_sensor_min) || ""),
			battery_charge_sensor_max: String((config && config.battery_charge_sensor_max) || ""),
			battery_state_sensor_enabled: !!(config && config.battery_state_sensor_enabled),
			battery_state_sensor_entity: String((config && config.battery_state_sensor_entity) || ""),
			battery_state_sensor_custom: !!(config && config.battery_state_sensor_custom),
			weather_conditions_enabled: !!(config && config.weather_conditions_enabled),
			weather_conditions: String((config && config.weather_conditions) || ""),
		};
	}

	return {
		...readSingleWeather(
			root,
			e,
			{
				enabled: "temperature_sensor_enabled",
				select: "temperature_sensor_select",
				entity: "temperature_sensor_entity",
				unit: "temperature_sensor_unit",
				min: "temperature_sensor_min",
				max: "temperature_sensor_max",
			},
			config,
			"temperature_sensor_enabled",
			"temperature_sensor_entity",
			"temperature_sensor_custom",
			"temperature_sensor_unit",
			"temperature_sensor_min",
			"temperature_sensor_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "wind_sensor_enabled",
				select: "wind_sensor_select",
				entity: "wind_sensor_entity",
				unit: "wind_sensor_unit",
				min: "wind_sensor_min",
				max: "wind_sensor_max",
			},
			config,
			"wind_sensor_enabled",
			"wind_sensor_entity",
			"wind_sensor_custom",
			"wind_sensor_unit",
			"wind_sensor_min",
			"wind_sensor_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "precipitation_sensor_enabled",
				select: "precipitation_sensor_select",
				entity: "precipitation_sensor_entity",
				unit: "precipitation_sensor_unit",
				min: "precipitation_sensor_min",
				max: "precipitation_sensor_max",
			},
			config,
			"precipitation_sensor_enabled",
			"precipitation_sensor_entity",
			"precipitation_sensor_custom",
			"precipitation_sensor_unit",
			"precipitation_sensor_min",
			"precipitation_sensor_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "battery_charge_sensor_enabled",
				select: "battery_charge_sensor_select",
				entity: "battery_charge_sensor_entity",
				unit: "battery_charge_sensor_unit",
				min: "battery_charge_sensor_min",
				max: "battery_charge_sensor_max",
			},
			config,
			"battery_charge_sensor_enabled",
			"battery_charge_sensor_entity",
			"battery_charge_sensor_custom",
			"battery_charge_sensor_unit",
			"battery_charge_sensor_min",
			"battery_charge_sensor_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "battery_state_sensor_enabled",
				select: "battery_state_sensor_select",
				entity: "battery_state_sensor_entity",
			},
			config,
			"battery_state_sensor_enabled",
			"battery_state_sensor_entity",
			"battery_state_sensor_custom"
		),
		...readConditionInputs(root, e, config),
	};
}


