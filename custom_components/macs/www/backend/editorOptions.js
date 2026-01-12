/**
 * Editor Options
 * --------------
 * Populates combo boxes for use by the card editor.
 * Obtains User Inputs with Fallbacks to Default Values
 * Syncs UI with Config
 */


import {DEFAULTS} from "../shared/constants.js";

//###############################################################################################
//                                                                                              #
//                         Element / Config Keys	                                            #
//                                                                                              #
//###############################################################################################

// Assistant Satellite
const assistSatelitteKeys = {
	enabled: "assist_satellite_enabled",
	select:  "assist_satellite_select",
	entity:  "assist_satellite_entity",
	custom: "assist_satellite_custom"
};

// Assistant Pipeline
const assistPipelineKeys = {
	enabled: "assist_pipeline_enabled",
	select:  "assist_pipeline_select",
	entity:  "assist_pipeline_entity",
	custom: "assist_pipeline_custom"
};

// Temperature
const temperatureKeys = {
	enabled: "temperature_sensor_enabled",
	select: "temperature_sensor_select",
	entity: "temperature_sensor_entity",
	unit: "temperature_sensor_unit",
	min: "temperature_sensor_min",
	max: "temperature_sensor_max"
};

// Windspeed
const windspeedKeys = {
	enabled: "wind_sensor_enabled",
	select: "wind_sensor_select",
	entity: "wind_sensor_entity",
	unit: "wind_sensor_unit",
	min: "wind_sensor_min",
	max: "wind_sensor_max"
};

// Rainfall
const precipitationKeys = {
	enabled: "precipitation_sensor_enabled",
	select: "precipitation_sensor_select",
	entity: "precipitation_sensor_entity",
	unit: "precipitation_sensor_unit",
	min: "precipitation_sensor_min",
	max: "precipitation_sensor_max"
};

// Weather Condition
const weatherConditionKeys = {
	enabled: "weather_conditions_enabled",
	select:  "weather_conditions_select",
	entity:  "weather_conditions_entity",
	custom: "weather_conditions_custom"
};

// Battery charge %
const batteryChargeKeys = {
	enabled: "battery_charge_sensor_enabled",
	select: "battery_charge_sensor_select",
	entity: "battery_charge_sensor_entity",
	unit: "battery_charge_sensor_unit",
	min: "battery_charge_sensor_min",
	max: "battery_charge_sensor_max"
};

// Battery is Plugged in
const batteryStateKeys = {
	enabled: "battery_state_sensor_enabled",
	select: "battery_state_sensor_select",
	entity: "battery_state_sensor_entity"
};

// Kiosk Mode
const autoBrightnessKeys = {
	enabled: "auto_brightness_enabled",
	min: "auto_brightness_min",
	max: "auto_brightness_max",
	kioskAnimations: "auto_brightness_pause_animations_enabled",
	kioskTimeout: "auto_brightness_timeout_minutes"
};




//###############################################################################################
//                                                                                              #
//                         Get lists for Combo Boxes                                            #
//                                                                                              #
//###############################################################################################

// returns a list of all matching entities ready for inclusion in the combo boxes
export async function getComboboxItems(hass) {
	let comboxItems = {};

	// Gather likely assistant satellites
	comboxItems.satelliteItems = searchForEntities("assist_satellite", "keys", hass);

	// Gather assistant pipeline IDs and preferred Pipeline
	let pipelineItems = await searchForPipelines(hass);
	comboxItems.preferred = pipelineItems.preferred;
	comboxItems.pipelineItems = pipelineItems.pipelineItems;

	// Gather likely temperature sensors.
	comboxItems.temperatureItems = searchForEntities("sensor", "entries", hass, ["temperature"], ["temp", "temperature"]);

	// Gather likely wind speed sensors.
	comboxItems.windItems = searchForEntities("sensor", "entries", hass, ["wind_speed"], ["wind"]);
	
	// Gather likely precipitation sensors.
	comboxItems.precipitationItems = searchForEntities("sensor", "entries", hass, ["precipitation", "precipitation_intensity", "precipitation_probability"], ["rain", "precip", "precipitation"]);

	// Gather weather entities for weather_condition strings.
	comboxItems.weatherConditionItems = searchForEntities("weather", "entries", hass);

	// Gather likely battery charge % sensors.
	comboxItems.batteryItems = searchForEntities("sensor", "entries", hass, ["battery"], ["battery", "charge", "batt"]);

	// Gather likely battery state/is_charging sensors.
	const batteryStateSensors = searchForEntities("sensor", "entries", hass, ["battery", "battery_charging", "power", "plug"], ["battery_state","battery state","is_charging","charging","charge","charge_state","charger","plugged","ac power","power"]);
	const batteryStateBinarySensors = searchForEntities("binary_sensor", "entries", hass, ["battery", "battery_charging", "power", "plug"], ["battery_state","battery state","is_charging","charging","charge","charge_state","charger","plugged","ac power","power"]);
	comboxItems.batteryStateItems = mergeComboboxItems(batteryStateSensors, batteryStateBinarySensors);

	return comboxItems;
}

// Searches Home Assistant for Entity Ids and States
function searchForEntities(needle, haystack, hass, possibleDeviceClasses=null, possibleNames=null){
	// Make sure HA is available
	if (!hass || !hass.states) {
		return [];
	}

	// make sure each combobox has a custom option so user can specify entity not in the list
	let list = [{ id: "custom", name: "Custom" }];
	let entities = [];

	// get a list of entity keys/entries
	if(haystack === "keys"){
		entities = Object.keys(hass.states);
	}
	else if(haystack === "entries"){
		entities = Object.entries(hass.states);
	}
	
	// For each entity
	for (let i = 0; i<entities.length; i++) {
		let id;
		let state;

		// get the ID
		if(haystack === "keys"){
			id = entities[i];
		}
		else if(haystack === "entries"){
			id = entities[i][0];
		}

		// ignore if the ID doesn't match what we're looking for (i.e. "sensor.") - note we add "." here, so it doesn't match things like opts.my_sensor
		if (id.indexOf(needle + ".") !== 0) {
			continue;
		}

		// otherwise, get the entities
		if(haystack === "keys"){
			state = hass.states[id];
		}
		else if(haystack === "entries"){
			state = entities[i][1];
		}

		let include = false;

		// only include the entity in the list if it matches one of the device classes or possible names
		if(possibleDeviceClasses===null && possibleNames===null){
			include = true;
		}
		else{
			// if we have device classes to compare to
			if(possibleDeviceClasses!==null && possibleDeviceClasses.length>0){
				// get the entity's device class
				let deviceClass = String((state && state.attributes && state.attributes.device_class) || "").toLowerCase();
				// compare to the list of chosen classes
				for (let c = 0; c < possibleDeviceClasses.length; c++) {
					if(deviceClass == possibleDeviceClasses[c].toLowerCase()) {
						include = true;
						break;
					}
				}
			}
			// if we have possible names to compare to, and we haven't already matched by device class
			if(possibleNames!==null && possibleNames.length>0 && include===false){
				let name = (state && state.attributes && state.attributes.friendly_name) || "";
				let hay = (id + " " + name).toLowerCase();
				for (let c = 0; c < possibleNames.length; c++) {
					if (hay.indexOf(possibleNames[c].toLowerCase()) !== -1) {
						include = true;
						break;
					}
				}
			}
		}

		// include the entity in the list
		if (include) {
			// get the friendly name
			var name = (state && state.attributes && state.attributes.friendly_name) || id;
			// add the entity to the results
			list.push({ id: id, name: String(name) });
		}
	}

	// Sort alphabetically but keep Custom at the top.
	const custom = list.find((item) => item.id === "custom");
	const sorted = list.filter((item) => item.id !== "custom");
	sorted.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});
	if (custom) {
		sorted.unshift(custom);
	}

	// return the list of compatible entities
	return sorted;
}

// merge two comboboxes into one, removing duplicates.
function mergeComboboxItems(...lists) {
	const byId = new Map();

	lists.forEach((items) => {
		(items || []).forEach((item) => {
			if (!item || typeof item.id === "undefined") return;
			if (item.id === "custom") return;
			if (!byId.has(item.id)) {
				byId.set(item.id, item);
			}
		});
	});

	const entries = Array.from(byId.values());
	return [{ id: "custom", name: "Custom" }, ...entries];
}

// Gets the pipeline IDs for inclusion in the comboxboxes
async function searchForPipelines(hass) {
	// Default safe payload
	const result = {
		pipelineItems: [{ id: "custom", name: "Custom" }],
		preferred: ""
	};

	if (!hass) return result;

	try {
		const res = await hass.callWS({ type: "assist_pipeline/pipeline/list" });

		const pipelines = Array.isArray(res?.pipelines) ? res.pipelines : [];
		result.preferred = String(res?.preferred_pipeline || "");

		for (let i = 0; i < pipelines.length; i++) {
			const p = pipelines[i] || {};
			const id = String(p.id || "");
			if (!id) continue;

			const name = String(p.name || p.id || "Unnamed");
			result.pipelineItems.push({ id, name });
		}
	} catch (_) {
		// swallow errors
	}

	return result;
}





//###############################################################################################
//                                                                                              #
//                         			Synch config to UI                                          #
//                                                                                              #
//###############################################################################################

// called my MacsCardEditor.js
export function readInputs(shadowRoot, event, config) {
	// Read all inputs or fall back to config.
	if (!shadowRoot) {
		return {
			// Assistant Satellite
			assist_satellite_enabled: !!(config && config.assist_satellite_enabled),
			assist_satellite_entity: String((config && config.assist_satellite_entity) || ""),
			assist_satellite_custom: !!(config && config.assist_satellite_custom),

			// Assistant pipeline
			assist_pipeline_enabled: !!(config && config.assist_pipeline_enabled),
			assist_pipeline_entity: String((config && config.assist_pipeline_entity) || ""),
			assist_pipeline_custom: !!(config && config.assist_pipeline_custom),

			// Temperature
			temperature_sensor_enabled: !!(config && config.temperature_sensor_enabled),
			temperature_sensor_entity: String((config && config.temperature_sensor_entity) ?? ""),
			temperature_sensor_custom: !!(config && config.temperature_sensor_custom),
			temperature_sensor_unit: String((config && config.temperature_sensor_unit) ?? ""),
			temperature_sensor_min: String((config && config.temperature_sensor_min) ?? ""),
			temperature_sensor_max: String((config && config.temperature_sensor_max) ?? ""),
			
			// Windspeed
			wind_sensor_enabled: !!(config && config.wind_sensor_enabled),
			wind_sensor_entity: String((config && config.wind_sensor_entity) ?? ""),
			wind_sensor_custom: !!(config && config.wind_sensor_custom),
			wind_sensor_unit: String((config && config.wind_sensor_unit) ?? ""),
			wind_sensor_min: String((config && config.wind_sensor_min) ?? ""),
			wind_sensor_max: String((config && config.wind_sensor_max) ?? ""),
			
			// Rainfall
			precipitation_sensor_enabled: !!(config && config.precipitation_sensor_enabled),
			precipitation_sensor_entity: String((config && config.precipitation_sensor_entity) ?? ""),
			precipitation_sensor_custom: !!(config && config.precipitation_sensor_custom),
			precipitation_sensor_unit: String((config && config.precipitation_sensor_unit) ?? ""),
			precipitation_sensor_min: String((config && config.precipitation_sensor_min) ?? ""),
			precipitation_sensor_max: String((config && config.precipitation_sensor_max) ?? ""),
			
			// Weather Condition
			weather_conditions_enabled: !!(config && config.weather_conditions_enabled),
			weather_conditions_entity: String((config && config.weather_conditions_entity) ?? ""),
			weather_conditions_custom: !!(config && config.weather_conditions_custom),
			
			// Battery charge %
			battery_charge_sensor_enabled: !!(config && config.battery_charge_sensor_enabled),
			battery_charge_sensor_entity: String((config && config.battery_charge_sensor_entity) ?? ""),
			battery_charge_sensor_custom: !!(config && config.battery_charge_sensor_custom),
			battery_charge_sensor_unit: String((config && config.battery_charge_sensor_unit) ?? ""),
			battery_charge_sensor_min: String((config && config.battery_charge_sensor_min) ?? ""),
			battery_charge_sensor_max: String((config && config.battery_charge_sensor_max) ?? ""),
			
			// Battery is Plugged in
			battery_state_sensor_enabled: !!(config && config.battery_state_sensor_enabled),
			battery_state_sensor_entity: String((config && config.battery_state_sensor_entity) ?? ""),
			battery_state_sensor_custom: !!(config && config.battery_state_sensor_custom),

			// Kiosk Mode
			auto_brightness_enabled: !!(config && config.auto_brightness_enabled),
			auto_brightness_timeout_minutes: String((config && config.auto_brightness_timeout_minutes) ?? ""),
			auto_brightness_min: String((config && config.auto_brightness_min) ?? ""),
			auto_brightness_max: String((config && config.auto_brightness_max) ?? ""),
			auto_brightness_pause_animations: !!(config && config.auto_brightness_pause_animations),
		};
	}

	return {
		...getUserInputs(shadowRoot, event, config, assistSatelitteKeys),
		...getUserInputs(shadowRoot, event, config, assistPipelineKeys),
		...getUserInputs(shadowRoot, event, config, temperatureKeys),
		...getUserInputs(shadowRoot, event, config, windspeedKeys),
		...getUserInputs(shadowRoot, event, config, precipitationKeys),
		...getUserInputs(shadowRoot, event, config, weatherConditionKeys),
		...getUserInputs(shadowRoot, event, config, batteryChargeKeys),
		...getUserInputs(shadowRoot, event, config, batteryStateKeys),
		...getUserInputs(shadowRoot, event, config, autoBrightnessKeys),
	};
}


// Reads all inputs for a HTML group
function getUserInputs(shadowRoot, event, config, ids) {
	// see why keys are available in the current group
	const enabledKey = ids.enabled ? ids.enabled : false;
	const selectKey = ids.select ? ids.select : false;
	const customKey = ids.custom ? ids.custom : false;
	const entityKey = ids.entity ? ids.entity : false;
	const unitKey = ids.unit ? ids.unit : false;
	const minKey = ids.min ? ids.min : false;
	const maxKey = ids.max ? ids.max : false;
	const kioskAnimKey = ids.kioskAnimations ? ids.kioskAnimations : false;
	const kioskTimeoutKey = ids.kioskTimeout ? ids.kioskTimeout : false;

	// get the corresponding html elements
	const elemEnabled      = enabledKey 	 ? shadowRoot.getElementById(enabledKey) : null;
	const elemSelect       = selectKey 		 ? shadowRoot.getElementById(selectKey) : null;
	//const elemCustom       = customKey 		 ? root.getElementById(customKey) : null;
	const elemEntityInput  = entityKey 		 ? shadowRoot.getElementById(entityKey) : null;
	const elemUnit         = unitKey 		 ? shadowRoot.getElementById(unitKey) : null;
	const elemMin          = minKey 		 ? shadowRoot.getElementById(minKey) : null;
	const elemMax          = maxKey 		 ? shadowRoot.getElementById(maxKey) : null;
	const elemKioskAnims   = kioskAnimKey 	 ? shadowRoot.getElementById(kioskAnimKey) : null;
	const elemKioskTimeout = kioskTimeoutKey ? shadowRoot.getElementById(kioskTimeoutKey) : null;

	// get the combo box selected val and chosen entity
	const enabled = getToggleValue(elemEnabled, event, config && config[enabledKey]);
	const selectValue = getComboboxValue(elemSelect, event);
	const isCustom = selectValue === "custom";
	const entityVal = isCustom ? ((elemEntityInput && elemEntityInput.value) || "") : selectValue;
			
	// prepare payload
	let payload = {[enabledKey]: enabled};
	if (selectKey){ 	  payload[entityKey] 	    = entityVal;	payload[customKey] = isCustom; }
	if (unitKey) 		  payload[unitKey]			= String(elemUnit ? getComboboxValue(elemUnit, event) : ((config && config[unitKey]) || ""));
	
	if (minKey)  		  payload[minKey] 			= getNumberOrDefault(elemMin, minKey);
	if (maxKey)  	      payload[maxKey] 			= getNumberOrDefault(elemMax, maxKey);
	if (kioskTimeoutKey)  payload[kioskTimeoutKey] 	= getNumberOrDefault(elemKioskTimeout, kioskTimeoutKey);

	if (kioskAnimKey)  	  payload[kioskAnimKey] 	= getToggleValue(elemKioskAnims, event, config && config[kioskAnimKey]);
	
	
	// If custom is selected but the entity is cleared, drop custom to fall back cleanly.
	if (customKey && entityKey && payload[customKey] && payload[entityKey] === "") {
		payload[customKey] = false;
	}

	// Remove empty inputs so config falls back to defaults.
	Object.keys(payload).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(DEFAULTS, key) && payload[key] === "") {
			delete payload[key];
		}
	});
	return payload;
}


// ___________________________________________
//           HELPER FUNCTIONS

// get the selected value of a combo box
function getComboboxValue(el, e) {
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

// chick if a toggle switch is "checked" or not
function getToggleValue(elem, event, fallback) {
	if (elem) {
		if (event && event.currentTarget === elem) {
			if (event.detail && typeof event.detail.value !== "undefined") {
				return !!event.detail.value;
			}
			if (event.detail && typeof event.detail.checked !== "undefined") {
				return !!event.detail.checked;
			}
		}
		if (typeof elem.checked !== "undefined") {
			return !!elem.checked;
		}
	}
	return !!fallback;
}

// return a number input or fallback to default value
function getNumberOrDefault(elem, key){
	if(key){
		if(elem){
			const val = elem ? elem.value : undefined;
			if (val === "" || val === null || typeof val === "undefined") {
				return "";
			}
			const num = Number(val);
			return Number.isFinite(num) ? num : "";
		}
	}
}






//###############################################################################################
//                                                                                              #
//                         Sync UI to Config	                                                #
//                                                                                              #
//###############################################################################################

// Called my MacsCardEditor.js
export function syncInputs(shadowRoot, config, satelliteItems, pipelineItems, temperatureItems, windspeedItems, precipitationItems, weatherConditionItems, batteryChargeItems, batteryStateItems, autoBrightnessItems) {
	syncInputGroup(shadowRoot, config, satelliteItems, assistSatelitteKeys);
	syncInputGroup(shadowRoot, config, pipelineItems, assistPipelineKeys);
	syncInputGroup(shadowRoot, config, temperatureItems, temperatureKeys);
	syncInputGroup(shadowRoot, config, windspeedItems, windspeedKeys);
	syncInputGroup(shadowRoot, config, precipitationItems, precipitationKeys);
	syncInputGroup(shadowRoot, config, weatherConditionItems, weatherConditionKeys);
	syncInputGroup(shadowRoot, config, batteryChargeItems, batteryChargeKeys);
	syncInputGroup(shadowRoot, config, batteryStateItems, batteryStateKeys);
	syncInputGroup(shadowRoot, config, autoBrightnessItems, autoBrightnessKeys);
}

// synchronises all html elements with user's config
export function syncInputGroup(shadowRoot, config, items, keys){
	// make sure the html root exists
	if (!shadowRoot) {
		return;
	}

	// set what config keys exist for the current html-group
	const enabledKey = keys.enabled ? keys.enabled : false;
	const selectKey = keys.select ? keys.select : false;
	const customKey = keys.custom ? keys.custom : false;
	const entityKey = keys.entity ? keys.entity : false;
	const unitKey = keys.unit ? keys.unit : false;
	const minKey = keys.min ? keys.min : false;
	const maxKey = keys.max ? keys.max : false;
	const kioskAnimKey = keys.kioskAnimations ? keys.kioskAnimations : false;
	const kioskTimeoutKey = keys.kioskTimeout ? keys.kioskTimeout : false;

	// get the HTML elements
	// todo - gate these by keys-exist
	const elemEnabled      = enabledKey 	 ? shadowRoot.getElementById(enabledKey) : false;
	const elemSelect       = selectKey 		 ? shadowRoot.getElementById(selectKey) : false;
	const elemEntity       = entityKey 		 ? shadowRoot.getElementById(entityKey) : false;
	const elemUnit         = unitKey 		 ? shadowRoot.getElementById(unitKey) : false;
	const elemMin          = minKey 		 ? shadowRoot.getElementById(minKey) : false;
	const elemMax          = maxKey 		 ? shadowRoot.getElementById(maxKey) : false;
	const elemKioskAnims   = kioskAnimKey 	 ? shadowRoot.getElementById(kioskAnimKey) : false;
	const elemKioskTimeout = kioskTimeoutKey ? shadowRoot.getElementById(kioskTimeoutKey) : false;

	// is the feature enabled
	const enabled = !!(config && config[enabledKey]);
	
	// update toggle switches
	setToggleState(elemEnabled, enabledKey, config);
	setToggleState(elemKioskAnims, kioskAnimKey, config);

	// update comboboxes
	setSelectedValue(elemUnit, unitKey, config);

	// update number inputs
	setNumericValue(elemMin, minKey, config);
	setNumericValue(elemMax, maxKey, config);
	setNumericValue(elemKioskTimeout, kioskTimeoutKey, config);

	// enable / disable group
	setEnabledDisabled(elemSelect, 		selectKey, 		enabled);
	setEnabledDisabled(elemEntity, 		entityKey, 		enabled);
	setEnabledDisabled(elemUnit, 		unitKey, 		enabled);
	setEnabledDisabled(elemMin,			minKey,  		enabled);
	setEnabledDisabled(elemMax, 		maxKey, 		enabled);
	setEnabledDisabled(elemKioskAnims, 	kioskAnimKey, 	enabled);
	setEnabledDisabled(elemKioskTimeout,kioskTimeoutKey,enabled);


	// entity select comboBox
	if(selectKey){
		// if the dropdown exists
		if(elemSelect){
			// get the stored entityId
			const entityId = String((config && config[entityKey]) || "");

			// Is the currently selected entityId one of the known items in the list — and not the special custom option?
			// (i.e. No point trying to select this value in the combobox if it doesn't exist)
			const knownSelect = Array.isArray(items) && items.some(function (s) {
					return s.id === entityId && s.id !== "custom";
				});
			const hasEntity = entityId !== "";
			const isCustom = hasEntity && ( !!(config && config[customKey]) || !knownSelect );
			const nextSelect = isCustom ? "custom" : entityId;
			// update the selected value
			if (elemSelect.value !== nextSelect) {
				elemSelect.value = nextSelect;
			}

			// disable the entity input if the group is disabled, or if the selected combobox value is not custom
			if(entityKey){
				if (elemEntity){
					if(elemEntity.value !== entityId){//} && (!isCustom || !elemEntity.matches(":focus-within"))) {
						elemEntity.value = entityId;
					}
					const entityEnable = enabled && isCustom
					elemEntity.disabled = !entityEnable;
				}
			}
		}
	}


}


// ___________________________________________
//           HELPER FUNCTIONS

// switch toggle
function setToggleState(elem, key, config){
	// if the configKey exists
	if(key){
		// if the htmlElem exists
		if(elem){
			// get stored value
			const val = !!(config && config[key]);
			// only update if values are different
			if (elem.checked !== val) {
				elem.checked = val;
			}
		}
	}
}


// select combox value if it exists
function setSelectedValue(elem, key, config){
	// if the configKey exists
	if(key){
		// if the htmlElem exists
		if (elem) {
			// get the stored value
			const val = String((config && config[key]) || "");
			// if combox has items
			if (Array.isArray(elem.items)) {
				// make sure the stored value exists int he combobox
				if (elem.items.some(item => String(item.id ?? item.value) === val)){
					// only update if values are different
					if (elem.value !== val) {
						elem.value = val;
					}
				}
			}
		}
	}
}

// set values of number inputs. Allow blanks to use defaults
function setNumericValue(elem, key, config){
	// if the configKey exists
	if(key){
		// if the htmlElem exists
		if(elem){
			// get stored value
			const val = config && config[key];
			// only update if values are different
			if (elem.value !== val) {
				// allow blanks
				if(val === null || typeof val === "undefined"){
					elem.value = "";
				}
				else{
					elem.value = String(val);
				}
			}
		}
	}
}


// enabled/disable UI elems
function setEnabledDisabled(elem, key, enabled){
	// if the configKey exists
	if(key){
		// if the htmlElem exists
		if (elem) {
			// only update if values are different
			if(elem.disabled == enabled){
				// enable/disable
				elem.disabled = !enabled;
			}
		}
	}
}


