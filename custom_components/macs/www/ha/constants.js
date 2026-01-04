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
    assist_pipeline_entity: "",     // assistant pipeline ID to use for discussion text output
    assist_pipeline_custom: false,  // whether the pipeline ID is custom (true) or selected from HA assistant pipelines (false)
    assist_satellite_enabled: false, // automatically change mood based on assistant state (listening, idle, processing etc)
    assist_satellite_entity: "",    // entity_id of a satellite device to monitor assistant state from
    assist_satellite_custom: false, // whether the satellite entity is custom (true) or selected from HA assistant satellites (false)	
    max_turns: 2,  			 		// number of turns (voice requests) to show in the iframe		
    preview_image: new URL("images/card_preview.png", rootUrl).toString(), 
    assist_outcome_duration_ms: 1000,
    // Weather sensor inputs (frontend UI defaults)
    temperature_sensor_enabled: false,
    temperature_sensor_entity: "",
    temperature_sensor_custom: false,
    temperature_sensor_unit: "",
    temperature_sensor_min: "",
    temperature_sensor_max: "",
    wind_sensor_enabled: false,
    wind_sensor_entity: "",
    wind_sensor_custom: false,
    wind_sensor_unit: "",
    wind_sensor_min: "",
    wind_sensor_max: "",
    precipitation_sensor_enabled: false,
    precipitation_sensor_entity: "",
    precipitation_sensor_custom: false,
    precipitation_sensor_unit: "",
    precipitation_sensor_min: "",
    precipitation_sensor_max: "",
    battery_charge_sensor_enabled: false,
    battery_charge_sensor_entity: "",
    battery_charge_sensor_custom: false,
    battery_charge_sensor_unit: "%",
    battery_charge_sensor_min: "",
    battery_charge_sensor_max: "",
    weather_conditions_enabled: false,
    weather_conditions: "",
};

export const DEFAULT_MAX_TEMP_C = 30;
export const DEFAULT_MIN_TEMP_C = 5;
export const DEFAULT_MAX_WIND_MPH = 50;
export const DEFAULT_MIN_WIND_MPH = 10;
export const DEFAULT_MAX_RAIN_MM = 15;
export const DEFAULT_MIN_RAIN_MM = 0; 


// HA entity IDs this card listens to
export const MOOD_ENTITY_ID = "select.macs_mood";
export const BRIGHTNESS_ENTITY_ID = "number.macs_brightness";
export const TEMPERATURE_ENTITY_ID = "number.macs_temperature";
export const WIND_ENTITY_ID = "number.macs_windspeed";
export const PRECIPITATION_ENTITY_ID = "number.macs_precipitation";
export const BATTERY_CHARGE_ENTITY_ID = "number.macs_battery_charge";
export const CONVERSATION_ENTITY_ID = "conversation.home_assistant";


