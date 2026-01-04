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

import { VERSION, DEFAULTS, MOOD_ENTITY_ID, BRIGHTNESS_ENTITY_ID } from "./constants.js";
import { normMood, normBrightness, safeUrl, getTargetOrigin, assistStateToMood} from "./validators.js";
import { SatelliteTracker } from "./assistSatellite.js";
import { AssistPipelineTracker } from "./assistPipeline.js";
import { WeatherHandler } from "./weatherHandler.js";
import { createDebugger } from "./debugger.js";


const DEBUG_ENABLED = false;
const debug = createDebugger("macsCard", DEBUG_ENABLED);
const KIOSK_STYLE_ID = "macs-kiosk-style";
const KIOSK_STYLE = `
    app-drawer-layout app-drawer,
    app-drawer-layout [drawer],
    ha-sidebar,
    hui-sidebar {
        display: none !important;
    }
    app-header,
    app-toolbar,
    ha-tabs,
    .header {
        display: none !important;
    }
    app-drawer-layout > [main] {
        margin-left: 0 !important;
    }
`;


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

        // locked to postmessage mode - todo, remove this option
        //const mode = "postMessage";

        // merge defaults with user config. Todo, remove mode?
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
            // (Creating a Shadow Root so CSS styles don’t mess with HA, and HA styles don’t mess with Macs.)
            this._root = this.attachShadow({ mode: "open" });

            // the iframe (hidden whilst loading - display thumbnail instead)
            this._root.innerHTML = `
                <style>
                    :host { display: block; height: 100%; }
                    ha-card { height: 100%; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); }
                    .wrap { height: 100%; width: 100%; }
                    iframe, img { border: 0; width: 100%; height: 100%; display: block; }
                    img { object-fit: cover; }
                    .hidden { display: none !important; }
                </style>
                <ha-card><div class="wrap"><img class="thumb" /><iframe class="hidden"></iframe></div></ha-card>
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

            // Keep home assistant state
            this._hass = null;

            this._assistSatelliteOutcome = new SatelliteTracker({});

            this._pipelineTracker = new AssistPipelineTracker({
                onTurns: (turns) => {
                    if (!this._iframe) return;
                    this._postToIframe({ type: "macs:turns", turns });
                }
            });
            if (this._pipelineTracker) this._pipelineTracker.setConfig(this._config);

            this._weatherHandler = new WeatherHandler();
            this._weatherHandler.setConfig(this._config);


            // Listen for messages from HA to the iframe
            this._onMessage = this._onMessage.bind(this);
            window.addEventListener("message", this._onMessage);
            this._messageListenerActive = true;
        }
        else {
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
        }
    }

    // make sure we remove event listeners when unloaded
    disconnectedCallback() {
        debug("got disconnected");
        try { window.removeEventListener("message", this._onMessage); } catch (_) {}
        this._messageListenerActive = false;

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
        try { this._iframe.contentWindow.postMessage(payload, targetOrigin); } catch (_) {}
    }




    _sendConfigToIframe() {
        this._updatePreviewState();
        const enabled = !!this._config.assist_pipeline_enabled;
        const assist_pipeline_entity = enabled ? (this._config.assist_pipeline_entity || "").toString().trim() : "";
        const autoBrightnessEnabled = this._isPreview ? false : !!this._config.auto_brightness_enabled;
        const autoBrightnessTimeout = this._isPreview ? 0 : this._config.auto_brightness_timeout_minutes;
        const autoBrightnessMin = this._config.auto_brightness_min;
        const autoBrightnessMax = this._config.auto_brightness_max;
        this._postToIframe({
            type: "macs:config",
            assist_pipeline_entity,
            auto_brightness_enabled: autoBrightnessEnabled,
            auto_brightness_timeout_minutes: autoBrightnessTimeout,
            auto_brightness_min: autoBrightnessMin,
            auto_brightness_max: autoBrightnessMax
        });
    }

    _sendMoodToIframe(mood, options = {}) {
        const payload = { type: "macs:mood", mood };
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

    _sendTurnsToIframe() {
        // Turns are kept newest-first in the card, but sent as-is
        const turns = this._pipelineTracker?.getTurns?.() || [];
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
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }

    _getKioskStyleRoots() {
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
        const roots = this._getKioskStyleRoots();
        roots.forEach((root) => {
            const existing = root.getElementById(KIOSK_STYLE_ID);
            if (!enabled) {
                if (existing) existing.remove();
                return;
            }
            if (!existing) {
                const style = document.createElement("style");
                style.id = KIOSK_STYLE_ID;
                style.textContent = KIOSK_STYLE;
                root.appendChild(style);
            }
        });
    }

    _applyKioskCardStyle(enabled) {
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
        this._isPreview = !!this.closest(".element-preview");
    }

    _sendWeatherIfChanged() {
        if (!this._weatherHandler) return;
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
            wakewordTriggered = prevSatState === "idle" && satState === "listening";
            this._lastAssistSatelliteState = satState || null;
        } else {
            this._lastAssistSatelliteState = null;
        }

        // const now = Date.now();
        const overrideMood = this._assistSatelliteOutcome?.getOverrideMood?.();
        const mood = overrideMood ? overrideMood : ((this._config?.assist_satellite_enabled && assistMood) ? assistMood : baseMood);

        const brightnessState = hass.states[BRIGHTNESS_ENTITY_ID] || null;
        const brightness = normBrightness(brightnessState?.state);

        let weatherValues = null;
        if (this._weatherHandler) {
            this._weatherHandler.setHass(hass);
            weatherValues = this._weatherHandler.update?.() || this._weatherHandler.getPayload?.() || null;
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
        const sendAll = () => {
            this._sendConfigToIframe();
            this._sendMoodToIframe(mood);
            this._sendWeatherIfChanged();
            this._sendBrightnessToIframe(brightness);
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
                this._weatherHandler?.resetChangeTracking?.();
                sendAll();
                // First fetch after iframe is alive
                this._pipelineTracker?.triggerFetchNewest?.();
                if (this._thumb){
                    this._thumb.classList.add("hidden");
                    this._iframe.classList.remove("hidden");
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

            // keep config/turns fresh
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }

    getCardSize() {
        return 6;
    }
}

