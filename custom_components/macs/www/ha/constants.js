/**
 * Shared constants and default configuration for the M.A.C.S. Lovelace card.
 */

export const DEBUGGING = true;

// get URL for macs.html
const selfUrl = new URL(import.meta.url);
export const rootUrl = new URL("../", selfUrl);
export const htmlUrl = new URL("macs.html", rootUrl);
htmlUrl.search = selfUrl.search; // query params, including manifest version (macs.html?hacstag=n)

// default config values
export const DEFAULTS = {
    url: htmlUrl.toString(),		// URL to Macs HTML file (auto adds version from manifest.json)
    assist_pipeline_enabled: false, // show discussion text output in iframe
    pipeline_id: "",        		// assistant pipeline ID to use	for discussion text output
    pipeline_custom: false, 		// whether the pipeline ID is custom (true) or selected from HA assistant pipelines (false)	
    assist_states_enabled: false, 	// automatically change mood based on assistant state (listening, idle, processing etc)
    assist_satellite_entity: "",    // entity_id of a satellite device to monitor assistant state from
    assist_satellite_custom: false, // whether the satellite entity is custom (true) or selected from HA assistant satellites (false)	
    max_turns: 2,  			 		// number of turns (voice requests) to show in the iframe		
    preview_image: new URL("images/card_preview.png", rootUrl).toString(), 
    assist_outcome_duration_ms: 1000,
    // Weather sensor inputs (frontend UI defaults)
    temperature_sensor_enabled: false,
    temperature_sensor_entity: "",
    temperature_sensor_custom: false,
    temperature_unit: "",
    temperature_min: "",
    temperature_max: "",
    wind_sensor_enabled: false,
    wind_sensor_entity: "",
    wind_sensor_custom: false,
    wind_unit: "",
    wind_min: "",
    wind_max: "",
    precipitation_sensor_enabled: false,
    precipitation_sensor_entity: "",
    precipitation_sensor_custom: false,
    precipitation_unit: "",
    precipitation_min: "",
    precipitation_max: "",
};

// HA entity IDs this card listens to
export const MOOD_ENTITY_ID = "select.macs_mood";
export const BRIGHTNESS_ENTITY_ID = "number.macs_brightness";
export const CONVERSATION_ENTITY_ID = "conversation.home_assistant";


