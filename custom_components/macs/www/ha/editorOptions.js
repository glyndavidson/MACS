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
