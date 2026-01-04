/**
 * M.A.C.S. is a mood-aware SVG character who reacts to your smart home.
 * This file handles the Home Assistant Backend Integration.
 */



/** 
 * TO-DO
 * --------
 * Also add a macs.show_message
 * 
 * - Monitor idle time and set bored, then sleep state/mood.
 * - Allow the user to configure the mood timeout/duration when a conversation ends.
 * - Create a user config options:
 *    - Enable Kiosk Mode:
 *    - after N idle minutes, starting turning display brightness to X, over a duration of T
 *    - on wake, return display brightness to B
 * - test non-admin user
 * - add seasons: christmas, halloween etc.
 * - create a "charging" mood.
 * - train "Hey Macs" wakeword
 * - change happy trigger from idle to responding. Actually, idle OR responding, whichever comes first.
 * - update readme screenshot
 * - create bored / sleep sequence
 * wake word restore brightness

 */



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
