/**
 * MacsCard
 * --------
 * Main Home Assistant Lovelace card implementation for M.A.C.S.
 * (Mood-Aware Character SVG).
 *
 * This file defines the custom Lovelace card element responsible for:
 * - Rendering the M.A.C.S. UI inside an iframe
 * - Passing Home Assistant state (mood, brightness, etc) to the iframe
 * - Bridging Assist pipeline data (conversation turns) from Home Assistant
 *   to the frontend character via postMessage
 *
 * All backend interaction (WebSocket calls, event subscriptions, auth usage)
 * occurs here, while the iframe is kept sandboxed and display-focused.
 *
 * This file represents the core integration layer between Home Assistant
 * and the M.A.C.S. frontend character.
 */

import { VERSION, DEFAULTS, MOOD_ENTITY_ID, BRIGHTNESS_ENTITY_ID, ANIMATIONS_ENTITY_ID, DEBUG_ENTITY_ID } from "./constants.js";
import { normMood, normBrightness, safeUrl, getTargetOrigin, assistStateToMood} from "./validators.js";
import { SatelliteTracker } from "./assistSatellite.js";
import { AssistPipelineTracker } from "./assistPipeline.js";
import { WeatherHandler } from "./weatherHandler.js";
import { createDebugger } from "./debugger.js";


const debug = createDebugger("MacsCard.js");
const cardCssUrl = (() => {
    const baseUrl = new URL(import.meta.url);
    const cssUrl = new URL("./cards.css", baseUrl);
    cssUrl.search = baseUrl.search;
    return cssUrl.toString();
})();
// Kiosk UI hides HA chrome and forces the card to full-viewport.
const KIOSK_STYLE_ID = "macs-kiosk-style";
const kioskCssUrl = (() => {
    const baseUrl = new URL(import.meta.url);
    const cssUrl = new URL("./kiosk.css", baseUrl);
    cssUrl.search = baseUrl.search;
    return cssUrl.toString();
})();


export class MacsCard extends HTMLElement {
    // returns the minimum valid config Home Assistant needs to add the card to a dashboard before the user configures anything.
    static getStubConfig() { 
        return { 
            type: "custom:macs-card", 
            assist_pipeline_enabled: false, 
            assist_pipeline_custom: false, 
            preview_image: DEFAULTS.preview_image
        }; 
    }

    // create the card editor
    static getConfigElement() {
        return document.createElement("macs-card-editor");
    }

    // Load the Macs Card and Configs
    setConfig(config) {
        // ensure we have a valid config object
        if (!config || typeof config !== "object"){
            throw new Error("macs-card: invalid config");
        }

        // Merge defaults with user config and lock "core" fields to constants so the card behaves consistently.
        this._config = {
            ...DEFAULTS,
            ...config,
            url: DEFAULTS.url,
            max_turns: DEFAULTS.max_turns,
            preview_image: DEFAULTS.preview_image
        }; //, mode };
        debug("CARD CONFIG: " + JSON.stringify(this._config));

        // Only run the first time setConfig is called
        if (!this._root) {
            // Shadow DOM wrapper + iframe shell
            // (Creating a Shadow Root so CSS styles don't mess with HA, and HA styles don't mess with Macs.)
            this._root = this.attachShadow({ mode: "open" });

            // the iframe (hidden whilst loading - display thumbnail instead)
            this._root.innerHTML = `
                <link rel="stylesheet" href="${cardCssUrl}">
                <ha-card><div class="wrap"><img class="thumb" /><iframe class="hidden" hidden></iframe></div></ha-card>
            `;
            this._iframe = this._root.querySelector("iframe");

            // preview image (shown before iframe is ready)
            this._thumb = this._root.querySelector("img.thumb");
            if (this._thumb) {   
                if (this._config.preview_image){
                    this._thumb.src = this._config.preview_image.toString();
                }
                else {
                    this._thumb.src = DEFAULTS.preview_image;
                }
            }

            // keep load/render state
            this._loadedOnce = false;
            this._lastMood = undefined;
            this._lastSrc = undefined;
            this._kioskHidden = false;
            this._isPreview = false;
            this._lastAssistSatelliteState = null;
            this._lastTurnsSignature = null;
            this._lastAnimationsEnabled = null;
            this._lastConfigSignature = null;

            // Keep home assistant state
            this._hass = null;

            // Track assist satellite state transitions for wake-word logic.
            this._assistSatelliteOutcome = new SatelliteTracker({});

            // Track pipeline turns (assistant chat history) and forward to iframe.
            this._pipelineTracker = new AssistPipelineTracker({
                onTurns: (turns) => {
                    if (!this._iframe) return;
                    this._postToIframe({ type: "macs:turns", turns });
                }
            });
            if (this._pipelineTracker) this._pipelineTracker.setConfig(this._config);

            // Normalize and cache weather data so we only post changes to the iframe.
            this._weatherHandler = new WeatherHandler();
            this._weatherHandler.setConfig(this._config);


            // Listen for messages from HA to the iframe
            this._onMessage = this._onMessage.bind(this);
            window.addEventListener("message", this._onMessage);
            this._messageListenerActive = true;
        }
        else {
            // Reapply config to existing handlers when HA updates config for this card.
            if (!this._weatherHandler) {
                this._weatherHandler = new WeatherHandler();
            }
            if (this._weatherHandler) this._weatherHandler.setConfig(this._config);
            if (this._hass && this._weatherHandler) {
                this._weatherHandler.setHass(this._hass);
                this._weatherHandler.update?.();
                this._weatherHandler.resetChangeTracking?.();
                this._sendWeatherIfChanged();
            }
            this._lastConfigSignature = null;
        }
    }

    // make sure we remove event listeners when unloaded
    disconnectedCallback() {
        debug("got disconnected");
        try { window.removeEventListener("message", this._onMessage); } catch (_) {}
        this._messageListenerActive = false;

        // Dispose long-lived helpers to avoid leaks if HA removes/recreates the card.
       try { this._pipelineTracker?.dispose?.(); } catch (_) {}
       this._pipelineTracker  = null;

        // remove the assist satellite class
        try { this._assistSatelliteOutcome?.dispose?.(); } catch (_) {}
        this._assistSatelliteOutcome = null;

        try { this._weatherHandler?.dispose?.(); } catch (_) {}
        this._weatherHandler = null;

    }

    connectedCallback() {
        this._updatePreviewState();
        // If HA disconnected and reconnected the same instance, rebuild trackers
        if (this._config && !this._pipelineTracker) {
            debug("Recreating AssistPipelineTracker (reconnect)");
            this._pipelineTracker = new AssistPipelineTracker({
            onTurns: (turns) => {
                if (!this._iframe) return;
                this._postToIframe({ type: "macs:turns", turns });
            }
            });
            this._pipelineTracker.setConfig(this._config);
            if (this._hass) this._pipelineTracker.setHass(this._hass);
        }

        if (this._config && !this._assistSatelliteOutcome) {
            debug("Recreating SatelliteTracker (reconnect)");
            this._assistSatelliteOutcome = new SatelliteTracker({});
        }

        if (this._config && !this._weatherHandler) {
            debug("Recreating WeatherHandler (reconnect)");
            this._weatherHandler = new WeatherHandler();
            this._weatherHandler.setConfig(this._config);
            if (this._hass) {
                this._weatherHandler.setHass(this._hass);
                this._weatherHandler.update?.();
                this._weatherHandler.resetChangeTracking?.();
                this._sendWeatherIfChanged();
            }
        }

        if (this._onMessage && !this._messageListenerActive) {
            window.addEventListener("message", this._onMessage);
            this._messageListenerActive = true;
        }
    }





    /* ---------- Send data to iFrame ---------- */

    _postToIframe(payload) {
        if (!this._iframe?.contentWindow) return;
        const base = safeUrl(this._config?.url);
        const targetOrigin = getTargetOrigin(base.toString());
        // Always target the iframe origin to avoid cross-origin leaks.
        try { this._iframe.contentWindow.postMessage(payload, targetOrigin); } catch (_) {}
    }




    _sendConfigToIframe(force = false) {
        this._updatePreviewState();
        const enabled = !!this._config.assist_pipeline_enabled;
        const assistSatelliteEnabled = !!this._config.assist_satellite_enabled;
        const assist_pipeline_entity = enabled ? (this._config.assist_pipeline_entity || "").toString().trim() : "";
        const autoBrightnessEnabled = this._isPreview ? false : !!this._config.auto_brightness_enabled;
        const autoBrightnessTimeout = this._isPreview ? 0 : this._config.auto_brightness_timeout_minutes;
        const autoBrightnessMin = this._config.auto_brightness_min;
        const autoBrightnessMax = this._config.auto_brightness_max;
        const autoBrightnessPauseAnimations = !!this._config.auto_brightness_pause_animations;
        const debugMode = typeof window !== "undefined" && typeof window.__MACS_DEBUG__ !== "undefined"
            ? window.__MACS_DEBUG__
            : "None";
        // Preview mode forces kiosk/auto-brightness off so the editor stays usable.
        const payload = {
            type: "macs:config",
            assist_satellite_enabled: assistSatelliteEnabled,
            assist_pipeline_entity,
            auto_brightness_enabled: autoBrightnessEnabled,
            auto_brightness_timeout_minutes: autoBrightnessTimeout,
            auto_brightness_min: autoBrightnessMin,
            auto_brightness_max: autoBrightnessMax,
            auto_brightness_pause_animations: autoBrightnessPauseAnimations,
            debug_mode: debugMode
        };
        const signature = JSON.stringify(payload);
        if (!force && signature === this._lastConfigSignature) return;
        this._lastConfigSignature = signature;
        this._postToIframe(payload);
    }

    _sendMoodToIframe(mood, options = {}) {
        const payload = { type: "macs:mood", mood };
        // reset_sleep tells the iframe to reset its idle/sleep timers.
        if (options.resetSleep) payload.reset_sleep = true;
        this._postToIframe(payload);
    }
    _sendTemperatureToIframe(temperature) {
        if (this._weatherHandler.getTemperatureHasChanged?.()) {
            this._postToIframe({ type: "macs:temperature", temperature });
        }
    }
    _sendWindSpeedToIframe(windspeed) {
        if (this._weatherHandler.getWindSpeedHasChanged?.()) {
            this._postToIframe({ type: "macs:windspeed", windspeed });
        }
    }
    _sendPrecipitationToIframe(precipitation) {
        if (this._weatherHandler.getPrecipitationHasChanged?.()) {
            this._postToIframe({ type: "macs:precipitation", precipitation });
        }
    }
    _sendWeatherConditionsToIframe(conditions) {
        if (this._weatherHandler.getWeatherConditionsHasChanged?.()) {
            this._postToIframe({ type: "macs:weather_conditions", conditions: conditions || {} });
        }
    }
    _sendBatteryToIframe(battery) {
        if (this._weatherHandler.getBatteryHasChanged?.()) {
            this._postToIframe({ type: "macs:battery", battery });
        }
    }
    _sendBrightnessToIframe(brightness) {
        this._postToIframe({ type: "macs:brightness", brightness });
    }

    _sendAnimationsEnabledToIframe(enabled) {
        if (this._config?.auto_brightness_enabled) {
            this._lastAnimationsEnabled = null;
            return;
        }
        const next = !!enabled;
        if (this._lastAnimationsEnabled === next) return;
        this._lastAnimationsEnabled = next;
        this._postToIframe({ type: "macs:animations_enabled", enabled: next });
    }

    _sendTurnsToIframe() {
        // Turns are kept newest-first in the card, but sent as-is
        const turns = this._pipelineTracker?.getTurns?.() || [];
        // Avoid spamming iframe with identical payloads.
        const signature = JSON.stringify(turns);
        if (signature === this._lastTurnsSignature) return;
        this._lastTurnsSignature = signature;
        this._postToIframe({ type: "macs:turns", turns });
    }

    _onMessage(e) {
        if (!this._iframe?.contentWindow) return;
        if (e.source !== this._iframe.contentWindow) return;

        // Origin check: allow "null" for sandboxed iframes; otherwise require the iframe URL origin.
        const base = safeUrl(this._config?.url);
        const expectedOrigin = getTargetOrigin(base.toString());
        if (e.origin !== expectedOrigin && e.origin !== "null") return;

        if (!e.data || typeof e.data !== "object") return;

        // Long-press gesture in the iframe toggles HA chrome visibility.
        if (e.data.type === "macs:toggle_kiosk") {
            if (this._isPreview) {
                debug("kiosk-toggle", { ignored: true, reason: "preview" });
                return;
            }
            this._toggleKioskUi();
            return;
        }

        // Iframe requests initial config and current turns
        if (e.data.type === "macs:request_config") {
            this._sendConfigToIframe(true);
            this._sendTurnsToIframe();
        }
    }

    _getKioskStyleRoots() {
        // Walk HA shadow roots so we can inject kiosk styles in the right place.
        const roots = [];
        const hass = document.querySelector("home-assistant");
        const hassRoot = hass?.shadowRoot;
        if (hassRoot) roots.push(hassRoot);

        const main = hassRoot?.querySelector("home-assistant-main");
        const mainRoot = main?.shadowRoot;
        if (mainRoot) roots.push(mainRoot);

        const lovelace = mainRoot?.querySelector("ha-panel-lovelace");
        const lovelaceRoot = lovelace?.shadowRoot;
        if (lovelaceRoot) roots.push(lovelaceRoot);

        const huiRoot = lovelaceRoot?.querySelector("hui-root");
        const huiShadow = huiRoot?.shadowRoot;
        if (huiShadow) roots.push(huiShadow);

        return roots;
    }

    _applyKioskStyles(enabled) {
        // Inject/remove kiosk CSS inside each shadow root to hide HA chrome.
        const roots = this._getKioskStyleRoots();
        roots.forEach((root) => {
            const existing = root.getElementById(KIOSK_STYLE_ID);
            if (!enabled) {
                if (existing) existing.remove();
                return;
            }
            if (!existing) {
                const link = document.createElement("link");
                link.id = KIOSK_STYLE_ID;
                link.rel = "stylesheet";
                link.href = kioskCssUrl;
                root.appendChild(link);
            }
        });
    }

    _applyKioskCardStyle(enabled) {
        // Force the card itself to full-viewport; restore prior inline styles when disabled.
        if (enabled) {
            if (typeof this._kioskHostStyleBackup === "undefined") {
                this._kioskHostStyleBackup = this.getAttribute("style");
            }
            this.style.position = "fixed";
            this.style.inset = "0";
            this.style.width = "100vw";
            this.style.height = "100vh";
            this.style.maxWidth = "100vw";
            this.style.maxHeight = "100vh";
            this.style.margin = "0";
            this.style.zIndex = "10000";
        } else {
            if (typeof this._kioskHostStyleBackup === "undefined") {
                this.removeAttribute("style");
            } else if (this._kioskHostStyleBackup) {
                this.setAttribute("style", this._kioskHostStyleBackup);
            } else {
                this.removeAttribute("style");
            }
        }
    }

    _toggleKioskUi() {
        if (this._isPreview) return;
        this._kioskHidden = !this._kioskHidden;
        debug("kiosk-toggle", { hidden: this._kioskHidden });
        this._applyKioskStyles(this._kioskHidden);
        this._applyKioskCardStyle(this._kioskHidden);
    }

    _updatePreviewState() {
        // Detect when we're rendered inside the HA card editor preview.
        this._isPreview = !!this.closest(".element-preview");
    }

    _sendWeatherIfChanged() {
        if (!this._weatherHandler) return;
        // Only post deltas to keep iframe traffic minimal.
        this._sendTemperatureToIframe(this._weatherHandler.getTemperature?.());
        this._sendWindSpeedToIframe(this._weatherHandler.getWindSpeed?.());       
        this._sendPrecipitationToIframe(this._weatherHandler.getPrecipitation?.());
        this._sendWeatherConditionsToIframe(this._weatherHandler.getWeatherConditions?.());
        this._sendBatteryToIframe(this._weatherHandler.getBattery?.());
    }


    /* ---------- hass hook ---------- */

    set hass(hass) {
        if (!this._config || !this._iframe) return;

        this._hass = hass;
        this._updatePreviewState();

        // Always keep hass fresh (safe + cheap)
        this._pipelineTracker?.setHass?.(hass);
               
        // Only re-apply config if the pipeline settings changed since last time we applied it
        const enabled = !!this._config?.assist_pipeline_enabled;
        const pid = this._config?.assist_pipeline_entity || "";
        if (!this._lastPipelineCfg || this._lastPipelineCfg.enabled !== enabled || this._lastPipelineCfg.pid !== pid) {
            this._lastPipelineCfg = { enabled, pid};
            this._pipelineTracker?.setConfig?.(this._config);
        }

        if (this._weatherHandler) this._weatherHandler.setConfig(this._config);
        

        //this._ensureSubscriptions();

        // Read current HA state into local values.
        const moodState = hass.states[MOOD_ENTITY_ID] || null;
        //const mood = normMood(moodState?.state);
        const baseMood = normMood(moodState?.state);
        // Optional: auto mood from selected satellite state
        let assistMood = null;
        let satState = ""; 
        let wakewordTriggered = false;
        const prevSatState = this._lastAssistSatelliteState;

        if (this._config?.assist_satellite_enabled) {
            const satId = (this._config.assist_satellite_entity || "").toString().trim();
            if (satId) {
                const satStateObj = hass.states[satId] || null;
                satState = (satStateObj?.state || "").toString().trim().toLowerCase(); 
                assistMood = assistStateToMood(satState);
                const tracker = this._assistSatelliteOutcome;
                debug(tracker);
                if (this._config?.assist_satellite_enabled && satState && tracker) tracker.update(satState);
            }
            // Detect idle -> listening transition to treat as a wake-word event.
            wakewordTriggered = prevSatState === "idle" && satState === "listening";
            this._lastAssistSatelliteState = satState || null;
        } else {
            this._lastAssistSatelliteState = null;
        }

        const brightnessState = hass.states[BRIGHTNESS_ENTITY_ID] || null;
        const brightness = normBrightness(brightnessState?.state);
        const animationsState = hass.states[ANIMATIONS_ENTITY_ID] || null;
        const animationsEnabled = animationsState ? animationsState.state === "on" : true;
        const debugState = hass.states[DEBUG_ENTITY_ID] || null;
        const debugMode = debugState ? (debugState.state || "None") : "None";
        if (typeof window !== "undefined") {
            window.__MACS_DEBUG__ = debugMode;
        }

        // Weather handler normalizes raw HA entities into a single payload.
        let weatherValues = null;
        if (this._weatherHandler) {
            this._weatherHandler.setHass(hass);
            weatherValues = this._weatherHandler.update?.() || this._weatherHandler.getPayload?.() || null;
        }
        const batteryLow =
            !!this._config?.battery_charge_sensor_enabled &&
            Number.isFinite(weatherValues?.battery) &&
            weatherValues.battery <= 20;

        // const now = Date.now();
        const overrideMood = this._assistSatelliteOutcome?.getOverrideMood?.();
        const assistEnabled = !!this._config?.assist_satellite_enabled;
        const assistActive = assistEnabled && assistMood && assistMood !== "idle";
        let mood = overrideMood ? overrideMood : ((assistEnabled && assistMood) ? assistMood : baseMood);
        if (!overrideMood && !assistActive && batteryLow) {
            mood = "sad";
        }

        const base = safeUrl(this._config.url);
        if (this._isPreview) {
            base.searchParams.set("edit", "1");
        } else {
            base.searchParams.delete("edit");
        }
        if (VERSION) {
            base.searchParams.set("v", VERSION);
        } else {
            base.searchParams.delete("v");
        }
        // Helper to send the full state bundle to the iframe.
        const sendAll = () => {
            this._sendConfigToIframe();
            this._sendMoodToIframe(mood);
            this._sendWeatherIfChanged();
            this._sendBrightnessToIframe(brightness);
            this._sendAnimationsEnabledToIframe(animationsEnabled);
            this._sendTurnsToIframe();
        };

        if (!this._loadedOnce) {
            // First load: set iframe src and send initial state
            base.searchParams.set("mood", mood);
            base.searchParams.set("brightness", brightness.toString());
            if (weatherValues && Number.isFinite(weatherValues.temperature)) {
                base.searchParams.set("temperature", weatherValues.temperature.toString());
            }
            if (weatherValues && Number.isFinite(weatherValues.windspeed)) {
                base.searchParams.set("windspeed", weatherValues.windspeed.toString());
            }
            if (weatherValues && Number.isFinite(weatherValues.precipitation)) {
                base.searchParams.set("precipitation", weatherValues.precipitation.toString());
            }
            if (weatherValues && Number.isFinite(weatherValues.battery)) {
                base.searchParams.set("battery", weatherValues.battery.toString());
            }

            const src = base.toString();
            this._iframe.onload = () => {
                // Reset change tracking so the first postMessage burst sends everything.
                this._weatherHandler?.resetChangeTracking?.();
                sendAll();
                // First fetch after iframe is alive
                this._pipelineTracker?.triggerFetchNewest?.();
                if (this._thumb){
                    this._thumb.classList.add("hidden");
                    this._thumb.hidden = true;
                    this._iframe.classList.remove("hidden");
                    this._iframe.hidden = false;
                }
            };

            if (src !== this._lastSrc) {
                this._iframe.src = src;
                this._lastSrc = src;
            }

            this._loadedOnce = true;
            this._lastMood = mood;
            this._lastBrightness = brightness;

            setTimeout(sendAll, 0);
        }
        else {
            // Subsequent updates: only send what changed
            if (wakewordTriggered) {
                this._lastMood = mood;
                // Wake-word resets the iframe's idle/sleep timers.
                this._sendMoodToIframe(mood, { resetSleep: true });
            } else if (mood !== this._lastMood) {
                this._lastMood = mood;
                this._sendMoodToIframe(mood);
            }
            this._sendWeatherIfChanged();
            if(brightness !== this._lastBrightness) {
                this._lastBrightness = brightness;
                this._sendBrightnessToIframe(brightness);
            }
            this._sendAnimationsEnabledToIframe(animationsEnabled);

            // keep config/turns fresh
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }

    getCardSize() {
        return 6;
    }
}
