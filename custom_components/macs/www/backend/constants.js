/**
 * Shared constants and default configuration for the M.A.C.S. Lovelace card.
 */

const resolveVersion = () => {
    const existing = (window.__MACS_VERSION__ || "").toString().trim();
    if (existing) return existing;
    try {
        const scripts = Array.from(document.scripts || []);
        for (const script of scripts) {
            const src = script && script.getAttribute ? script.getAttribute("src") : "";
            if (!src || src.indexOf("macs.js") === -1) continue;
            const v = new URL(src, window.location.origin).searchParams.get("v");
            if (v) {
                window.__MACS_VERSION__ = v;
                return v.toString().trim();
            }
        }
    } catch (_) {}
    return "Unknown";
};
export const VERSION = resolveVersion();

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
    preview_image: new URL("frontend/images/card_preview.png", rootUrl).toString(), 
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
    battery_state_sensor_enabled: false,
    battery_state_sensor_entity: "",
    battery_state_sensor_custom: false,
    weather_conditions_enabled: false,
    weather_conditions: "",
    auto_brightness_enabled: false,
    auto_brightness_timeout_minutes: 5,
    auto_brightness_min: 0,
    auto_brightness_max: 100,
    auto_brightness_pause_animations: true,
};

export const DEFAULT_MAX_TEMP_C = 30;
export const DEFAULT_MIN_TEMP_C = 5;
export const DEFAULT_MAX_WIND_MPH = 50;
export const DEFAULT_MIN_WIND_MPH = 10;
export const DEFAULT_MAX_RAIN_MM = 10;

export const MACS_MESSAGE_EVENT = "macs_message";
export const DEFAULT_MIN_RAIN_MM = 0; 


// HA entity IDs this card listens to
export const MOOD_ENTITY_ID = "select.macs_mood";
export const BRIGHTNESS_ENTITY_ID = "number.macs_brightness";
export const TEMPERATURE_ENTITY_ID = "number.macs_temperature";
export const WIND_ENTITY_ID = "number.macs_windspeed";
export const PRECIPITATION_ENTITY_ID = "number.macs_precipitation";
export const BATTERY_CHARGE_ENTITY_ID = "number.macs_battery_charge";
export const BATTERY_STATE_ENTITY_ID = "switch.macs_charging";
export const ANIMATIONS_ENTITY_ID = "switch.macs_animations_enabled";
export const DEBUG_ENTITY_ID = "select.macs_debug";
export const CONVERSATION_ENTITY_ID = "conversation.home_assistant";


