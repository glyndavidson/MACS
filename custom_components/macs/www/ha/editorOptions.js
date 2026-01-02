export async function loadSatellites(hass) {
	if (!hass?.states) return { satellites: [] };
	const satellites = Object.keys(hass.states)
		.filter((id) => id.startsWith("assist_satellite."))
		.map((id) => {
			const st = hass.states[id];
			const name = (st?.attributes?.friendly_name || id).toString();
			return { id, name };
		})
		.sort((a, b) => a.name.localeCompare(b.name));
	return { satellites };
}

export async function loadPipelines(hass) {
	if (!hass) return { pipelines: [], preferred: "" };
	const res = await hass.callWS({ type: "assist_pipeline/pipeline/list" });
	const pipelines = Array.isArray(res?.pipelines) ? res.pipelines : [];
	const preferred = (res?.preferred_pipeline || "").toString();
	return {
		preferred,
		pipelines: pipelines
			.map((p) => ({
				id: (p.id || "").toString(),
				name: (p.name || p.id || "Unnamed").toString()
			}))
			.filter((p) => p.id),
	};
}

export async function loadAssistantOptions(hass) {
	let satellitesPayload = { satellites: [] };
	if (hass) {
		try { satellitesPayload = await loadSatellites(hass); } catch (_) {}
	}
	const satellites = satellitesPayload.satellites || [];
	const satItems = [{ id: "custom", name: "Custom" }, ...satellites.map((s) => ({ id: s.id, name: s.name }))];

	let pipelinesPayload = { pipelines: [], preferred: "" };
	if (hass) {
		try { pipelinesPayload = await loadPipelines(hass); } catch (_) {}
	}
	const pipelines = pipelinesPayload.pipelines || [];
	const preferred = pipelinesPayload.preferred || "";
	const pipelineItems = [{ id: "custom", name: "Custom" }, ...pipelines];

	return { satItems, pipelineItems, preferred };
}

function comboValue(el, e) {
	if (e?.currentTarget === el && e?.detail && typeof e.detail.value !== "undefined") {
		return e.detail.value;
	}
	return el?.value ?? "";
}

export function syncAssistStateControls(root, config, satelliteItems) {
	if (!root) return;
	const assistStateAutoMood = !!config?.assist_states_enabled;
	const assistStateAutoMoodToggle = root.getElementById("assist_states_enabled");
	const satelliteSelect = root.getElementById("satellite_select");
	const satelliteEntity = root.getElementById("satellite_entity");
	if (assistStateAutoMoodToggle && assistStateAutoMoodToggle.checked !== assistStateAutoMood) {
		assistStateAutoMoodToggle.checked = assistStateAutoMood;
	}
	if (satelliteSelect) satelliteSelect.disabled = !assistStateAutoMood;
	if (satelliteEntity) satelliteEntity.disabled = !assistStateAutoMood;
	const eid = (config?.assist_satellite_entity ?? "").toString();
	const knownSatellite = Array.isArray(satelliteItems) && satelliteItems.some((s) => s.id === eid && s.id !== "custom");
	const satIsCustom = !!config?.assist_satellite_custom || !knownSatellite;
	const nextSatSelect = satIsCustom ? "custom" : eid;
	if (satelliteSelect && satelliteSelect.value !== nextSatSelect) satelliteSelect.value = nextSatSelect;
	if (satelliteEntity && satelliteEntity.value !== eid && (!satIsCustom || !satelliteEntity.matches(":focus-within"))) {
		satelliteEntity.value = eid;
	}
	if (satelliteEntity) satelliteEntity.disabled = !assistStateAutoMood || !satIsCustom;
}

export function syncPipelineControls(root, config, pipelineItems) {
	if (!root) return;
	const dialogueEnabled = !!config?.assist_pipeline_enabled;
	const dialogueEnabledToggle = root.getElementById("assist_pipeline_enabled");
	const pipelineSelect = root.getElementById("pipeline_select");
	const pipelineId = root.getElementById("pipeline_id");
	if (dialogueEnabledToggle && dialogueEnabledToggle.checked !== dialogueEnabled) {
		dialogueEnabledToggle.checked = dialogueEnabled;
	}
	if (pipelineSelect) pipelineSelect.disabled = !dialogueEnabled;
	if (pipelineId) pipelineId.disabled = !dialogueEnabled;
	const pid = (config?.pipeline_id ?? "").toString();
	const knownPipeline = Array.isArray(pipelineItems) && pipelineItems.some((p) => p.id === pid && p.id !== "custom");
	const pipelineIsCustom = !!config?.pipeline_custom || !knownPipeline;
	const nextPipelineSelect = pipelineIsCustom ? "custom" : pid;
	if (pipelineSelect && pipelineSelect.value !== nextPipelineSelect) pipelineSelect.value = nextPipelineSelect;
	if (pipelineId && pipelineId.value !== pid && !pipelineId.matches(":focus-within")) pipelineId.value = pid;
	if (pipelineId) pipelineId.disabled = !dialogueEnabled || !pipelineIsCustom;
}

export function readAssistStateInputs(root, e, config = {}) {
	if (!root) {
		return {
			assist_states_enabled: !!config.assist_states_enabled,
			assist_satellite_entity: (config.assist_satellite_entity ?? "").toString(),
			assist_satellite_custom: !!config.assist_satellite_custom
		};
	}
	const assistStateAutoMood = !!root.getElementById("assist_states_enabled")?.checked;
	const satelliteSelect = root.getElementById("satellite_select");
	const satelliteEntity = root.getElementById("satellite_entity");
	const satelliteSelectValue = comboValue(satelliteSelect, e);
	const satManualVal = satelliteEntity?.value || "";
	const assistSatelliteCustom = satelliteSelectValue === "custom";
	const assistSatelliteEntity = assistSatelliteCustom ? satManualVal : satelliteSelectValue;
	if (satelliteEntity) satelliteEntity.disabled = !assistStateAutoMood || !assistSatelliteCustom;
	return {
		assist_states_enabled: assistStateAutoMood,
		assist_satellite_entity: assistSatelliteEntity,
		assist_satellite_custom: assistSatelliteCustom
	};
}

export function readPipelineInputs(root, e, config = {}) {
	if (!root) {
		return {
			assist_pipeline_enabled: !!config.assist_pipeline_enabled,
			pipeline_id: (config.pipeline_id ?? "").toString(),
			pipeline_custom: !!config.pipeline_custom
		};
	}
	const assist_pipeline_enabled = !!root.getElementById("assist_pipeline_enabled")?.checked;
	const pipelineSelect = root.getElementById("pipeline_select");
	const pipelineIdInput = root.getElementById("pipeline_id");
	const pipelineValue = comboValue(pipelineSelect, e);
	const pipelineId = pipelineIdInput?.value || "";
	const pipeline_custom = pipelineValue === "custom";
	if (pipelineIdInput) pipelineIdInput.disabled = !assist_pipeline_enabled || !pipeline_custom;
	const pipeline_id = pipeline_custom ? pipelineId : pipelineValue;
	return {
		assist_pipeline_enabled,
		pipeline_id,
		pipeline_custom
	};
}

function collectSensors(hass, predicate) {
	if (!hass?.states) return [];
	const out = [];
	for (const [id, st] of Object.entries(hass.states)) {
		if (!id.startsWith("sensor.")) continue;
		if (predicate(id, st)) {
			const name = (st?.attributes?.friendly_name || id).toString();
			out.push({ id, name });
		}
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

const TEMP_UNITS = new Set(["°c", "c", "celsius", "°f", "f", "fahrenheit"]);
const WIND_UNITS = new Set(["m/s", "mps", "km/h", "kph", "mph", "kn", "kt", "kt/h"]);
const RAIN_UNITS = new Set(["mm", "mm/h", "in", "in/h", "inch", "inches"]);
const PERCENT_UNITS = new Set(["%"]);

function hasUnit(st, allowed) {
	const u = (st?.attributes?.unit_of_measurement || "").toString().toLowerCase();
	return allowed.has(u);
}

function hasDeviceClass(st, expected) {
	return (st?.attributes?.device_class || "").toString().toLowerCase() === expected;
}

function matchesName(id, st, keywords) {
	const hay = `${id} ${(st?.attributes?.friendly_name || "")}`.toLowerCase();
	return keywords.some((k) => hay.includes(k));
}

export async function loadWeatherOptions(hass) {
	const temps = collectSensors(
		hass,
		(id, st) =>
			hasDeviceClass(st, "temperature") ||
			hasUnit(st, TEMP_UNITS) ||
			matchesName(id, st, ["temp", "temperature"])
	);

	const winds = collectSensors(
		hass,
		(id, st) =>
			hasDeviceClass(st, "wind_speed") ||
			hasUnit(st, WIND_UNITS) ||
			matchesName(id, st, ["wind"])
	);

	const rains = collectSensors(
		hass,
		(id, st) =>
			hasDeviceClass(st, "precipitation") ||
			hasDeviceClass(st, "precipitation_intensity") ||
			hasDeviceClass(st, "precipitation_probability") ||
			hasUnit(st, RAIN_UNITS) ||
			(hasUnit(st, PERCENT_UNITS) && matchesName(id, st, ["rain", "rainfall", "precip", "precipitation"])) ||
			matchesName(id, st, ["rain", "rainfall", "precip", "precipitation"])
	);

	const temperatureItems = [{ id: "custom", name: "Custom" }, ...temps];
	const windItems = [{ id: "custom", name: "Custom" }, ...winds];
	const precipitationItems = [{ id: "custom", name: "Custom" }, ...rains];

	return {
		temperatureItems,
		windItems,
		precipitationItems,
	};
}

function syncSingleWeather(root, config, items, ids, customFlagKey, entityKey, enabledKey, unitKey, minKey, maxKey) {
	if (!root) return;
	const enabled = !!config?.[enabledKey];
	const enabledToggle = root.getElementById(ids.enabled);
	const select = root.getElementById(ids.select);
	const entity = root.getElementById(ids.entity);
	const unit = root.getElementById(ids.unit);
	const min = root.getElementById(ids.min);
	const max = root.getElementById(ids.max);

	if (enabledToggle && enabledToggle.checked !== enabled) enabledToggle.checked = enabled;

	if (select) select.disabled = !enabled;
	if (entity) entity.disabled = !enabled;
	if (unit) unit.disabled = !enabled;
	if (min) min.disabled = !enabled;
	if (max) max.disabled = !enabled;

	const eid = (config?.[entityKey] ?? "").toString();
	const known = Array.isArray(items) && items.some((s) => s.id === eid && s.id !== "custom");
	const isCustom = !!config?.[customFlagKey] || !known;
	const nextSelect = isCustom ? "custom" : eid;
	if (select && select.value !== nextSelect) select.value = nextSelect;
	if (entity && entity.value !== eid && (!isCustom || !entity.matches(":focus-within"))) entity.value = eid;
	if (entity) entity.disabled = !enabled || !isCustom;

	const unitVal = (config?.[unitKey] ?? "").toString();
	if (unit && unit.value !== unitVal) unit.value = unitVal;

	if (min && min.value !== (config?.[minKey] ?? "")) min.value = config?.[minKey] ?? "";
	if (max && max.value !== (config?.[maxKey] ?? "")) max.value = config?.[maxKey] ?? "";
}

export function syncWeatherControls(root, config, items) {
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

function readSingleWeather(root, e, ids, config, enabledKey, entityKey, customKey, unitKey, minKey, maxKey) {
	const enabled = !!root.getElementById(ids.enabled)?.checked;
	const select = root.getElementById(ids.select);
	const entityInput = root.getElementById(ids.entity);
	const unit = root.getElementById(ids.unit);
	const min = root.getElementById(ids.min);
	const max = root.getElementById(ids.max);

	const selectValue = comboValue(select, e);
	const manualVal = entityInput?.value || "";
	const isCustom = selectValue === "custom";
	const entityVal = isCustom ? manualVal : selectValue;

	if (entityInput) entityInput.disabled = !enabled || !isCustom;
	if (select) select.disabled = !enabled;
	if (unit) unit.disabled = !enabled;
	if (min) min.disabled = !enabled;
	if (max) max.disabled = !enabled;

	return {
		[enabledKey]: enabled,
		[entityKey]: entityVal,
		[customKey]: isCustom,
		[unitKey]: unit?.value ?? "",
		[minKey]: min?.value ?? "",
		[maxKey]: max?.value ?? "",
	};
}

export function readWeatherInputs(root, e, config = {}) {
	if (!root) return {
		temperature_sensor_enabled: !!config.temperature_sensor_enabled,
		temperature_sensor_entity: (config.temperature_sensor_entity ?? "").toString(),
		temperature_sensor_custom: !!config.temperature_sensor_custom,
		temperature_unit: (config.temperature_unit ?? "").toString(),
		temperature_min: (config.temperature_min ?? "").toString(),
		temperature_max: (config.temperature_max ?? "").toString(),
		wind_sensor_enabled: !!config.wind_sensor_enabled,
		wind_sensor_entity: (config.wind_sensor_entity ?? "").toString(),
		wind_sensor_custom: !!config.wind_sensor_custom,
		wind_unit: (config.wind_unit ?? "").toString(),
		wind_min: (config.wind_min ?? "").toString(),
		wind_max: (config.wind_max ?? "").toString(),
		precipitation_sensor_enabled: !!config.precipitation_sensor_enabled,
		precipitation_sensor_entity: (config.precipitation_sensor_entity ?? "").toString(),
		precipitation_sensor_custom: !!config.precipitation_sensor_custom,
		precipitation_unit: (config.precipitation_unit ?? "").toString(),
		precipitation_min: (config.precipitation_min ?? "").toString(),
		precipitation_max: (config.precipitation_max ?? "").toString(),
	};

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
