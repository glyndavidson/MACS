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

export function syncAssistStateControls(root, config, satelliteItems) {
	// Sync assist state controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var assistStateAutoMood = !!(config && config.assist_states_enabled);
	var assistStateAutoMoodToggle = root.getElementById("assist_states_enabled");
	var satelliteSelect = root.getElementById("satellite_select");
	var satelliteEntity = root.getElementById("satellite_entity");

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
	var pipelineSelect = root.getElementById("pipeline_select");
	var pipelineId = root.getElementById("pipeline_id");

	if (dialogueEnabledToggle && dialogueEnabledToggle.checked !== dialogueEnabled) {
		dialogueEnabledToggle.checked = dialogueEnabled;
	}

	if (pipelineSelect) {
		pipelineSelect.disabled = !dialogueEnabled;
	}
	if (pipelineId) {
		pipelineId.disabled = !dialogueEnabled;
	}

	var pid = String((config && config.pipeline_id) || "");
	var knownPipeline =
		Array.isArray(pipelineItems) &&
		pipelineItems.some(function (p) {
			return p.id === pid && p.id !== "custom";
		});
	var pipelineIsCustom = !!(config && config.pipeline_custom) || !knownPipeline;
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

export function readAssistStateInputs(root, e, config) {
	// Read assist state inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			assist_states_enabled: !!(config && config.assist_states_enabled),
			assist_satellite_entity: String((config && config.assist_satellite_entity) || ""),
			assist_satellite_custom: !!(config && config.assist_satellite_custom),
		};
	}

	var assistStateAutoMood = !!root.getElementById("assist_states_enabled")?.checked;
	var satelliteSelect = root.getElementById("satellite_select");
	var satelliteEntity = root.getElementById("satellite_entity");
	var satelliteSelectValue = comboValue(satelliteSelect, e);
	var satManualVal = (satelliteEntity && satelliteEntity.value) || "";
	var assistSatelliteCustom = satelliteSelectValue === "custom";
	var assistSatelliteEntity = assistSatelliteCustom ? satManualVal : satelliteSelectValue;

	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood || !assistSatelliteCustom;
	}

	return {
		assist_states_enabled: assistStateAutoMood,
		assist_satellite_entity: assistSatelliteEntity,
		assist_satellite_custom: assistSatelliteCustom,
	};
}

export function readPipelineInputs(root, e, config) {
	// Read pipeline inputs from the DOM, or fall back to config.
	if (!root) {
		return {
			assist_pipeline_enabled: !!(config && config.assist_pipeline_enabled),
			pipeline_id: String((config && config.pipeline_id) || ""),
			pipeline_custom: !!(config && config.pipeline_custom),
		};
	}

	var assist_pipeline_enabled = !!root.getElementById("assist_pipeline_enabled")?.checked;
	var pipelineSelect = root.getElementById("pipeline_select");
	var pipelineIdInput = root.getElementById("pipeline_id");
	var pipelineValue = comboValue(pipelineSelect, e);
	var pipelineId = (pipelineIdInput && pipelineIdInput.value) || "";
	var pipeline_custom = pipelineValue === "custom";

	if (pipelineIdInput) {
		pipelineIdInput.disabled = !assist_pipeline_enabled || !pipeline_custom;
	}

	var pipeline_id = pipeline_custom ? pipelineId : pipelineValue;

	return {
		assist_pipeline_enabled: assist_pipeline_enabled,
		pipeline_id: pipeline_id,
		pipeline_custom: pipeline_custom,
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

// Unit sets used for sensor matching.
const TEMP_UNITS = new Set(["ļøc", "c", "celsius", "ļøf", "f", "fahrenheit"]);
const WIND_UNITS = new Set(["m/s", "mps", "km/h", "kph", "mph", "kn", "kt", "kt/h"]);
const RAIN_UNITS = new Set(["mm", "mm/h", "in", "in/h", "inch", "inches"]);
const PERCENT_UNITS = new Set(["%"]);

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
			(hasUnit(st, PERCENT_UNITS) && matchesName(id, st, ["rain", "rainfall", "precip", "precipitation"])) ||
			matchesName(id, st, ["rain", "rainfall", "precip", "precipitation"])
		);
	});

	var temperatureItems = [{ id: "custom", name: "Custom" }].concat(temps);
	var windItems = [{ id: "custom", name: "Custom" }].concat(winds);
	var precipitationItems = [{ id: "custom", name: "Custom" }].concat(rains);

	return {
		temperatureItems: temperatureItems,
		windItems: windItems,
		precipitationItems: precipitationItems,
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
	var unit = root.getElementById(ids.unit);
	var min = root.getElementById(ids.min);
	var max = root.getElementById(ids.max);

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

	var unitVal = String((config && config[unitKey]) || "");
	if (unit && unit.value !== unitVal) {
		unit.value = unitVal;
	}

	if (min && min.value !== (config && config[minKey])) {
		min.value = (config && config[minKey]) || "";
	}
	if (max && max.value !== (config && config[maxKey])) {
		max.value = (config && config[maxKey]) || "";
	}
}

export function syncWeatherControls(root, config, items) {
	// Sync all three weather sections.
	syncSingleWeather(
		root,
		config,
		items.temperatureItems,
		{
			enabled: "temperature_sensor_enabled",
			select: "temperature_select",
			entity: "temperature_entity",
			unit: "temperature_unit",
			min: "temperature_min",
			max: "temperature_max",
		},
		"temperature_sensor_custom",
		"temperature_sensor_entity",
		"temperature_sensor_enabled",
		"temperature_unit",
		"temperature_min",
		"temperature_max"
	);

	syncSingleWeather(
		root,
		config,
		items.windItems,
		{
			enabled: "wind_sensor_enabled",
			select: "wind_select",
			entity: "wind_entity",
			unit: "wind_unit",
			min: "wind_min",
			max: "wind_max",
		},
		"wind_sensor_custom",
		"wind_sensor_entity",
		"wind_sensor_enabled",
		"wind_unit",
		"wind_min",
		"wind_max"
	);

	syncSingleWeather(
		root,
		config,
		items.precipitationItems,
		{
			enabled: "precipitation_sensor_enabled",
			select: "precipitation_select",
			entity: "precipitation_entity",
			unit: "precipitation_unit",
			min: "precipitation_min",
			max: "precipitation_max",
		},
		"precipitation_sensor_custom",
		"precipitation_sensor_entity",
		"precipitation_sensor_enabled",
		"precipitation_unit",
		"precipitation_min",
		"precipitation_max"
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
	var unit = root.getElementById(ids.unit);
	var min = root.getElementById(ids.min);
	var max = root.getElementById(ids.max);

	var enabled = !!(enabledEl && enabledEl.checked);
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

	return {
		[enabledKey]: enabled,
		[entityKey]: entityVal,
		[customKey]: isCustom,
		[unitKey]: String(comboValue(unit, e) || (config && config[unitKey]) || ""),
		[minKey]: parseNumber((min && min.value) || (config && config[minKey]) || ""),
		[maxKey]: parseNumber((max && max.value) || (config && config[maxKey]) || ""),
	};
}

export function readWeatherInputs(root, e, config) {
	// Read all weather inputs or fall back to config.
	if (!root) {
		return {
			temperature_sensor_enabled: !!(config && config.temperature_sensor_enabled),
			temperature_sensor_entity: String((config && config.temperature_sensor_entity) || ""),
			temperature_sensor_custom: !!(config && config.temperature_sensor_custom),
			temperature_unit: String((config && config.temperature_unit) || ""),
			temperature_min: String((config && config.temperature_min) || ""),
			temperature_max: String((config && config.temperature_max) || ""),
			wind_sensor_enabled: !!(config && config.wind_sensor_enabled),
			wind_sensor_entity: String((config && config.wind_sensor_entity) || ""),
			wind_sensor_custom: !!(config && config.wind_sensor_custom),
			wind_unit: String((config && config.wind_unit) || ""),
			wind_min: String((config && config.wind_min) || ""),
			wind_max: String((config && config.wind_max) || ""),
			precipitation_sensor_enabled: !!(config && config.precipitation_sensor_enabled),
			precipitation_sensor_entity: String((config && config.precipitation_sensor_entity) || ""),
			precipitation_sensor_custom: !!(config && config.precipitation_sensor_custom),
			precipitation_unit: String((config && config.precipitation_unit) || ""),
			precipitation_min: String((config && config.precipitation_min) || ""),
			precipitation_max: String((config && config.precipitation_max) || ""),
		};
	}

	return {
		...readSingleWeather(
			root,
			e,
			{
				enabled: "temperature_sensor_enabled",
				select: "temperature_select",
				entity: "temperature_entity",
				unit: "temperature_unit",
				min: "temperature_min",
				max: "temperature_max",
			},
			config,
			"temperature_sensor_enabled",
			"temperature_sensor_entity",
			"temperature_sensor_custom",
			"temperature_unit",
			"temperature_min",
			"temperature_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "wind_sensor_enabled",
				select: "wind_select",
				entity: "wind_entity",
				unit: "wind_unit",
				min: "wind_min",
				max: "wind_max",
			},
			config,
			"wind_sensor_enabled",
			"wind_sensor_entity",
			"wind_sensor_custom",
			"wind_unit",
			"wind_min",
			"wind_max"
		),
		...readSingleWeather(
			root,
			e,
			{
				enabled: "precipitation_sensor_enabled",
				select: "precipitation_select",
				entity: "precipitation_entity",
				unit: "precipitation_unit",
				min: "precipitation_min",
				max: "precipitation_max",
			},
			config,
			"precipitation_sensor_enabled",
			"precipitation_sensor_entity",
			"precipitation_sensor_custom",
			"precipitation_unit",
			"precipitation_min",
			"precipitation_max"
		),
	};
}
