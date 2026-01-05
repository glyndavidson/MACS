/**
 * M.A.C.S. is a mood-aware SVG character who reacts to your smart home.
 * This file handles the Home Assistant Backend Integration.
 */



/** 
 * TO-DO
 * --------
 * - add a macs.show_message service
 * - test non-admin user
 * - add seasons: christmas, halloween etc.
 * - create a "charging" mood.
 * - train "Hey Macs" wakeword
 * - change happy trigger from idle to responding. Actually, idle OR responding, whichever comes first.
 * - update readme screenshot
 * - make bored mood look less sad. Maybe rename bored to sad and create new bored mood.
 * - create low batter / battery charge indicator / battery plugged in
 * - add wake from sleep service, sleeping toggle
 * - Update Custom Integrations examples
 * - add a macs.show handler - "show me my shopping list", "show me my camera" etc? Shopping list likely easy, camera difficult.
 * - disable weather effects after screentimeout (saves battery/power - does it really?) if useful, make it optional
 * 
 *  */



import {MacsCard} from "./ha/MacsCard.js";
import {MacsCardEditor} from "./ha/MacsCardEditor.js";

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
