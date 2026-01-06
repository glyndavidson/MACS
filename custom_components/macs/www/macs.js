/**
 * M.A.C.S. is a mood-aware SVG character who reacts to your smart home.
 * This file handles the Home Assistant Backend Integration.
 */



/** 
 * TO-DO
 * --------
 * - test non-admin user
 * - add seasons: christmas, halloween etc.
 * - create a "charging" mood.
 * - train "Hey Macs" wakeword
 * - change happy trigger from idle to responding. Actually, idle OR responding, whichever comes first.
 * - update readme screenshot
 * - create battery plugged in
 * - Update Custom Integrations examples and tooltips
 * - add a macs.show handler - "show me my shopping list", "show me my camera" etc? Shopping list likely easy, camera difficult.
 */

/*Here are the best refactor opportunities I see right now:

Reduce service registration boilerplate in __init__.py by driving async_register/async_remove from a single mapping (service → handler → schema). This would also clean up the weather-condition service block.
Collapse the repetitive weather-condition switch classes in entities.py into a tiny factory/base class with a definition list (name/icon/unique_id).
Consolidate the _sendTemperature/_sendWindSpeed/_sendPrecipitation/... helpers in MacsCard.js into a table-driven sender so change checks + postMessage are in one place.
Deduplicate the normalize/read logic in sensorHandler.js (temperature/wind/precip/battery are almost identical patterns).
Replace the long if (e.data.type === ...) chain in MacsFrontend.js with a message-handler map to make intent clearer and reduce branching noise.
If you want me to start on any of these, pick one:

__init__.py services mapping
entities.py switch factory
MacsCard.js sender map
sensorHandler.js normalization helper
MacsFrontend.js handler map

*/

import {MacsCard} from "./backend/MacsCard.js";
import {MacsCardEditor} from "./backend/MacsCardEditor.js";

const macsVersion = new URL(import.meta.url).searchParams.get("v");
if (macsVersion) {
    window.__MACS_VERSION__ = macsVersion;
}

if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);
window.customCards = window.customCards || [];
window.customCards.push({
    type: "macs-card",
    name: "M.A.C.S.",
    description: "M.A.C.S. (Macs) - Mood-Aware Character SVG",
    preview: true
});

if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);
