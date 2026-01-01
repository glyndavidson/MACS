/**
 * Shared constants and default configuration for the M.A.C.S. Lovelace card.
 */


// get URL for macs.html
const selfUrl = new URL(import.meta.url);
export const rootUrl = new URL("../", selfUrl);
export const htmlUrl = new URL("macs.html", rootUrl);
htmlUrl.search = selfUrl.search; // query params, including manifest version (macs.html?hacstag=n)

// default config values
export const DEFAULTS = {
    url: htmlUrl.toString(),
    //mode: "postMessage",
    //param: "mood",
    assist_pipeline_enabled: false,
    pipeline_id: "",
    pipeline_custom: false,
    max_turns: 2,
    preview_image: new URL("images/card_preview.png", rootUrl).toString(),
};

// HA entity IDs this card listens to
export const MOOD_ENTITY_ID = "select.macs_mood";
export const WEATHER_ENTITY_ID = "select.macs_weather";
export const BRIGHTNESS_ENTITY_ID = "number.macs_brightness";
export const CONVERSATION_ENTITY_ID = "conversation.home_assistant";