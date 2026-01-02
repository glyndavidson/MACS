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

import { DEFAULTS, MOOD_ENTITY_ID, BRIGHTNESS_ENTITY_ID } from "./constants.js";
import { normMood, normBrightness, safeUrl, getTargetOrigin, assistStateToMood} from "./validators.js";
import { SatelliteTracker } from "./assistSatellite.js";
import { AssistPipelineTracker } from "./assistPipeline.js";
import { WeatherHandler } from "./weatherHandler.js";
import { createDebugger } from "./debugger.js";


const DEBUG_ENABLED = false;
const debug = createDebugger("macsCard", DEBUG_ENABLED);


export class MacsCard extends HTMLElement {
    // returns the minimum valid config Home Assistant needs to add the card to a dashboard before the user configures anything.
    static getStubConfig() { 
        return { 
            type: "custom:macs-card", 
            assist_pipeline_enabled: false, 
            pipeline_custom: false, 
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
        this._config = { ...DEFAULTS, ...config}; //, mode };
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
        }
        else {
            if (this._weatherHandler) this._weatherHandler.setConfig(this._config);
            if (this._hass && this._weatherHandler) {
                this._weatherHandler.setHass(this._hass);
                const weather = this._weatherHandler.getWeather();
                const weatherJson = weather ? JSON.stringify(weather) : null;
                if (weatherJson !== this._lastWeather) {
                    this._lastWeather = weatherJson;
                    if (weather) this._sendWeatherToIframe(weather);
                }
            }
        }
    }

    // make sure we remove event listeners when unloaded
    disconnectedCallback() {
        debug("got disconnected");
        try { window.removeEventListener("message", this._onMessage); } catch (_) {} 

       try { this._pipelineTracker?.dispose?.(); } catch (_) {}
       this._pipelineTracker  = null;

        // remove the assist satellite class
        try { this._assistSatelliteOutcome?.dispose?.(); } catch (_) {}
        this._assistSatelliteOutcome = null;

        try { this._weatherHandler?.dispose?.(); } catch (_) {}
        this._weatherHandler = null;

    }

    connectedCallback() {
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
    }





    /* ---------- Send data to iFrame ---------- */

    _postToIframe(payload) {
        if (!this._iframe?.contentWindow) return;
        const base = safeUrl(this._config?.url);
        const targetOrigin = getTargetOrigin(base.toString());
        try { this._iframe.contentWindow.postMessage(payload, targetOrigin); } catch (_) {}
    }




    _sendConfigToIframe() {
        const enabled = !!this._config.assist_pipeline_enabled;
        const pipeline_id = enabled ? (this._config.pipeline_id || "").toString().trim() : "";
        this._postToIframe({ type: "macs:config", pipeline_id });
    }

    _sendMoodToIframe(mood) {
        this._postToIframe({ type: "macs:mood", mood });
    }
    _sendWeatherToIframe(weather) {
        this._postToIframe({ type: "macs:weather", weather });
    }
    _sendBrightnessToIframe(brightness) {
        this._postToIframe({ type: "macs:brightness", brightness });
    }

    _sendTurnsToIframe() {
        // Turns are kept newest-first in the card, but sent as-is
        const turns = this._pipelineTracker?.getTurns?.() || [];
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

        // Iframe requests initial config and current turns
        if (e.data.type === "macs:request_config") {
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }


    /* ---------- hass hook ---------- */

    set hass(hass) {
        if (!this._config || !this._iframe) return;

        this._hass = hass;

        // Always keep hass fresh (safe + cheap)
        this._pipelineTracker?.setHass?.(hass);
               
        // Only re-apply config if the pipeline settings changed since last time we applied it
        const enabled = !!this._config?.assist_pipeline_enabled;
        const pid = this._config?.pipeline_id || "";
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

        if (this._config?.assist_states_enabled) {
            const satId = (this._config.assist_satellite_entity || "").toString().trim();
            if (satId) {
                const satStateObj = hass.states[satId] || null;
                satState = (satStateObj?.state || "").toString().trim().toLowerCase(); 
                assistMood = assistStateToMood(satState);
                const tracker = this._assistSatelliteOutcome;
                debug(tracker);
                if (this._config?.assist_states_enabled && satState && tracker) tracker.update(satState);
            }
        }

        // const now = Date.now();
        const overrideMood = this._assistSatelliteOutcome?.getOverrideMood?.();
        const mood = overrideMood ? overrideMood : ((this._config?.assist_states_enabled && assistMood) ? assistMood : baseMood);

        const brightnessState = hass.states[BRIGHTNESS_ENTITY_ID] || null;
        const brightness = normBrightness(brightnessState?.state);

        if (this._weatherHandler) this._weatherHandler.setHass(hass);
        const weather = this._weatherHandler?.getWeather?.() || null;
        const weatherJson = weather ? JSON.stringify(weather) : null;

        const base = safeUrl(this._config.url);
        const sendAll = () => {
            this._sendConfigToIframe();
            this._sendMoodToIframe(mood);
            if (weather && weatherJson !== this._lastWeather) {
                this._lastWeather = weatherJson;
                this._sendWeatherToIframe(weather);
            }
            this._sendBrightnessToIframe(brightness);
            this._sendTurnsToIframe();
        };

        if (!this._loadedOnce) {
            // First load: set iframe src and send initial state
            base.searchParams.set("mood", mood);
            base.searchParams.set("brightness", brightness.toString());

            const src = base.toString();
            this._iframe.onload = () => {
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
            if (mood !== this._lastMood) {
                this._lastMood = mood;
                this._sendMoodToIframe(mood);
            }
            if (weatherJson !== this._lastWeather) {
                this._lastWeather = weatherJson;
                if (weather) this._sendWeatherToIframe(weather);
            }
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

