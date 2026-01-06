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

import { VERSION, DEFAULTS, MOOD_ENTITY_ID, BRIGHTNESS_ENTITY_ID, ANIMATIONS_ENTITY_ID, DEBUG_ENTITY_ID, MACS_MESSAGE_EVENT } from "../shared/constants.js";
import { normMood, normBrightness, safeUrl, getTargetOrigin, assistStateToMood, getValidUrl} from "./validators.js";
import { SatelliteTracker } from "./assistSatellite.js";
import { AssistPipelineTracker } from "./assistPipeline.js";
import { SensorHandler } from "./sensorHandler.js";
import { createDebugger } from "../shared/debugger.js";
import { MessagePoster } from "../shared/postmessage.js";


const debug = createDebugger("MacsCard.js");


// Kiosk UI hides HA chrome and forces the card to full-viewport.
const KIOSK_STYLE_ID = "macs-kiosk-style";
const kioskCssUrl = getValidUrl("backend/kiosk.css");
const cardCssUrl = getValidUrl("backend/cards.css");


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
            this._messagePoster = new MessagePoster({
                sender: "backend",
                recipient: "iframe",
                getRecipientWindow: () => this._iframe?.contentWindow,
                getTargetOrigin: () => {
                    const base = safeUrl(this._config?.url);
                    return getTargetOrigin(base.toString());
                },
                allowNullOrigin: true,
            });

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
            this._iframeReady = false;
            this._iframeLoaded = false;
            this._iframeBootstrapped = false;
            this._initSent = false;
            this._pendingState = null;
            this._lastAssistSatelliteState = null;
            this._lastTurnsSignature = null;
            this._lastAnimationsEnabled = null;
            this._lastConfigSignature = null;
            this._syntheticTurns = [];
            this._unsubMessageEvents = null;
            this._messageSubToken = 0;

            // Keep home assistant state
            this._hass = null;

            // Track assist satellite state transitions for wake-word logic.
            this._assistSatelliteOutcome = new SatelliteTracker({});

            // Track pipeline turns (assistant chat history) and forward to iframe.
            this._pipelineTracker = new AssistPipelineTracker({
                onTurns: () => {
                    if (!this._iframe) return;
                    this._sendTurnsToIframe();
                }
            });
            if (this._pipelineTracker) this._pipelineTracker.setConfig(this._config);

            // Normalize and cache sensor data so we only post changes to the iframe.
            this._sensorHandler = new SensorHandler();
            this._sensorHandler.setConfig(this._config);


            // Listen for messages from HA to the iframe
            this._onMessage = this._onMessage.bind(this);
            window.addEventListener("message", this._onMessage);
            this._messageListenerActive = true;
        }
        else {
            // Reapply config to existing handlers when HA updates config for this card.
            if (!this._sensorHandler) {
                this._sensorHandler = new SensorHandler();
            }
            if (this._sensorHandler) this._sensorHandler.setConfig(this._config);
            if (this._hass && this._sensorHandler) {
                this._sensorHandler.setHass(this._hass);
                this._sensorHandler.update?.();
                this._sensorHandler.resetChangeTracking?.();
                this._sendSensorIfChanged();
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

        try { this._sensorHandler?.dispose?.(); } catch (_) {}
        this._sensorHandler = null;

        try {
            const u = this._unsubMessageEvents;
            if (typeof u === "function") u();
        } catch (_) {}
        this._unsubMessageEvents = null;

    }

    connectedCallback() {
        this._updatePreviewState();
        // If HA disconnected and reconnected the same instance, rebuild trackers
        if (this._config && !this._pipelineTracker) {
            debug("Recreating AssistPipelineTracker (reconnect)");
            this._pipelineTracker = new AssistPipelineTracker({
            onTurns: () => {
                if (!this._iframe) return;
                this._sendTurnsToIframe();
            }
            });
            this._pipelineTracker.setConfig(this._config);
            if (this._hass) this._pipelineTracker.setHass(this._hass);
        }

        if (this._config && !this._assistSatelliteOutcome) {
            debug("Recreating SatelliteTracker (reconnect)");
            this._assistSatelliteOutcome = new SatelliteTracker({});
        }

        if (this._config && !this._sensorHandler) {
            debug("Recreating SensorHandler (reconnect)");
            this._sensorHandler = new SensorHandler();
            this._sensorHandler.setConfig(this._config);
            if (this._hass) {
                this._sensorHandler.setHass(this._hass);
                this._sensorHandler.update?.();
                this._sensorHandler.resetChangeTracking?.();
                this._sendSensorIfChanged();
            }
        }

        if (this._onMessage && !this._messageListenerActive) {
            window.addEventListener("message", this._onMessage);
            this._messageListenerActive = true;
        }
    }





    /* ---------- Send data to iFrame ---------- */

    _postToIframe(payload) {
        if (!this._messagePoster) return;
        // Always target the iframe origin to avoid cross-origin leaks.
        this._messagePoster.post(payload);
    }

    _buildConfigPayload() {
        this._updatePreviewState();
        const enabled = !!this._config.assist_pipeline_enabled;
        const assistSatelliteEnabled = !!this._config.assist_satellite_enabled;
        const assist_pipeline_entity = enabled ? (this._config.assist_pipeline_entity || "").toString().trim() : "";
        const maxTurns = this._config.max_turns ?? DEFAULTS.max_turns;
        const autoBrightnessEnabled = this._isPreview ? false : !!this._config.auto_brightness_enabled;
        const autoBrightnessTimeout = this._isPreview ? 0 : this._config.auto_brightness_timeout_minutes;
        const autoBrightnessMin = this._config.auto_brightness_min;
        const autoBrightnessMax = this._config.auto_brightness_max;
        const autoBrightnessPauseAnimations = !!this._config.auto_brightness_pause_animations;
        const batteryStateSensorEnabled = !!this._config.battery_state_sensor_enabled;
        const debugMode = typeof window !== "undefined" && typeof window.__MACS_DEBUG__ !== "undefined"
            ? window.__MACS_DEBUG__
            : "None";
        return {
            assist_satellite_enabled: assistSatelliteEnabled,
            assist_pipeline_entity,
            max_turns: maxTurns,
            auto_brightness_enabled: autoBrightnessEnabled,
            auto_brightness_timeout_minutes: autoBrightnessTimeout,
            auto_brightness_min: autoBrightnessMin,
            auto_brightness_max: autoBrightnessMax,
            auto_brightness_pause_animations: autoBrightnessPauseAnimations,
            battery_state_sensor_enabled: batteryStateSensorEnabled,
            debug_mode: debugMode
        };
    }

    _buildTurnsPayload() {
        const turns = this._pipelineTracker?.getTurns?.() || [];
        const synthetic = this._syntheticTurns || [];
        const combined = [...synthetic, ...turns].sort((a, b) => {
            const ta = Date.parse(a?.ts || "") || 0;
            const tb = Date.parse(b?.ts || "") || 0;
            return tb - ta;
        });
        const maxMessages = this._getMaxMessages();
        return maxMessages ? combined.slice(0, maxMessages) : combined;
    }

    _sendInitToIframe(state) {
        const snapshot = state || this._pendingState;
        if (!snapshot) return;
        const config = this._buildConfigPayload();
        const turns = this._buildTurnsPayload();
        const payload = {
            type: "macs:init",
            config,
            mood: snapshot.mood ?? null,
            sensors: snapshot.sensorValues ?? null,
            brightness: Number.isFinite(snapshot.brightness) ? snapshot.brightness : null,
            animations_enabled: typeof snapshot.animationsEnabled === "boolean" ? snapshot.animationsEnabled : null,
            turns
        };

        this._postToIframe(payload);
        this._initSent = true;

        this._lastConfigSignature = JSON.stringify({ type: "macs:config", ...config });
        this._lastTurnsSignature = JSON.stringify(turns);

        this._lastMood = snapshot.mood;
        this._lastBrightness = snapshot.brightness;
        this._lastAnimationsEnabled = typeof snapshot.animationsEnabled === "boolean"
            ? snapshot.animationsEnabled
            : this._lastAnimationsEnabled;
        this._sensorHandler?.syncChangeTracking?.();
    }

    _flushPendingState() {
        const snapshot = this._pendingState;
        if (!snapshot) return;
        const mood = snapshot.mood;
        if (mood && mood !== this._lastMood) {
            this._lastMood = mood;
            this._sendMoodToIframe(mood);
        }
        if (Number.isFinite(snapshot.brightness) && snapshot.brightness !== this._lastBrightness) {
            this._lastBrightness = snapshot.brightness;
            this._sendBrightnessToIframe(snapshot.brightness);
        }
        this._sendAnimationsEnabledToIframe(snapshot.animationsEnabled);
        this._sendSensorIfChanged();
        this._sendConfigToIframe();
        this._sendTurnsToIframe();
    }

    _handleIframeReady() {
        if (this._iframeBootstrapped) return;
        if (!this._iframeReady || !this._iframeLoaded) return;
        if (!this._initSent) {
            this._sendInitToIframe(this._pendingState);
        }
        this._pipelineTracker?.triggerFetchNewest?.();
    }

    _revealIframe() {
        if (this._thumb) {
            this._thumb.classList.add("hidden");
            this._thumb.hidden = true;
        }
        if (this._iframe) {
            this._iframe.classList.remove("hidden");
            this._iframe.hidden = false;
        }
    }




    _sendConfigToIframe(force = false) {
        const payload = {
            type: "macs:config",
            ...this._buildConfigPayload(),
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
        if (this._sensorHandler.getTemperatureHasChanged?.()) {
            this._postToIframe({ type: "macs:temperature", temperature });
        }
    }
    _sendWindSpeedToIframe(windspeed) {
        if (this._sensorHandler.getWindSpeedHasChanged?.()) {
            this._postToIframe({ type: "macs:windspeed", windspeed });
        }
    }
    _sendPrecipitationToIframe(precipitation) {
        if (this._sensorHandler.getPrecipitationHasChanged?.()) {
            this._postToIframe({ type: "macs:precipitation", precipitation });
        }
    }
    _sendWeatherConditionsToIframe(conditions) {
        if (this._sensorHandler.getWeatherConditionsHasChanged?.()) {
            this._postToIframe({ type: "macs:weather_conditions", conditions: conditions || {} });
        }
    }
    _sendBatteryToIframe(battery) {
        if (this._sensorHandler.getBatteryHasChanged?.()) {
            this._postToIframe({ type: "macs:battery", battery });
        }
    }
    _sendBatteryStateToIframe(state) {
        if (this._sensorHandler.getBatteryStateHasChanged?.()) {
            this._postToIframe({ type: "macs:battery_state", battery_state: state });
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
        const payloadTurns = this._buildTurnsPayload();
        // Avoid spamming iframe with identical payloads.
        const signature = JSON.stringify(payloadTurns);
        if (signature === this._lastTurnsSignature) return;
        this._lastTurnsSignature = signature;
        this._postToIframe({ type: "macs:turns", turns: payloadTurns });
    }

    _onMessage(e) {
        if (!this._messagePoster || !this._messagePoster.isValidEvent(e)) return;

        if (!e.data || typeof e.data !== "object") return;

        if (e.data.type === "macs:ready") {
            debug("iframe ready");
            this._iframeReady = true;
            this._handleIframeReady();
            return;
        }

        if (e.data.type === "macs:init_ack") {
            debug("init: ack received");
            this._iframeBootstrapped = true;
            this._revealIframe();
            this._flushPendingState();
            return;
        }

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
            if (!this._iframeBootstrapped) {
                if (!this._initSent) {
                    this._sendInitToIframe(this._pendingState);
                }
            } else {
                this._sendConfigToIframe(true);
                this._sendTurnsToIframe();
            }
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

    _getMaxMessages() {
        const raw = Number(this._config?.max_turns ?? DEFAULTS.max_turns);
        const maxTurns = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULTS.max_turns;
        return Math.max(1, maxTurns) * 2;
    }

    _ensureMessageSubscription() {
        if (!this._hass || this._unsubMessageEvents) return;
        const token = ++this._messageSubToken;
        this._unsubMessageEvents = "pending";

        this._hass.connection.subscribeEvents((ev) => {
            try {
                const data = ev?.data || {};
                const role = (data.role || "assistant").toString().trim().toLowerCase();
                const text = (data.text || "").toString().trim();
                if (!text) return;
                const ts = (data.ts || new Date().toISOString()).toString();
                const runId = (data.id || `synthetic_${Date.now()}_${Math.random().toString(16).slice(2)}`).toString();
                const turn = { runId, ts };
                if (role === "user") {
                    turn.heard = text;
                } else {
                    turn.reply = text;
                }

                const existing = this._syntheticTurns?.findIndex?.((entry) => entry.runId === runId) ?? -1;
                if (existing >= 0) {
                    this._syntheticTurns.splice(existing, 1);
                }
                if (!this._syntheticTurns) this._syntheticTurns = [];
                this._syntheticTurns.unshift(turn);
                const maxMessages = this._getMaxMessages();
                if (maxMessages && this._syntheticTurns.length > maxMessages) {
                    this._syntheticTurns.length = maxMessages;
                }
                this._sendTurnsToIframe();
            } catch (_) {}
        }, MACS_MESSAGE_EVENT).then((unsub) => {
            if (token !== this._messageSubToken) {
                try { unsub(); } catch (_) {}
                return;
            }
            this._unsubMessageEvents = unsub;
        }).catch(() => {
            if (token === this._messageSubToken) this._unsubMessageEvents = null;
        });
    }

    _sendSensorIfChanged() {
        if (!this._sensorHandler) return;
        // Only post deltas to keep iframe traffic minimal.
        this._sendTemperatureToIframe(this._sensorHandler.getTemperature?.());
        this._sendWindSpeedToIframe(this._sensorHandler.getWindSpeed?.());       
        this._sendPrecipitationToIframe(this._sensorHandler.getPrecipitation?.());
        this._sendWeatherConditionsToIframe(this._sensorHandler.getWeatherConditions?.());
        this._sendBatteryToIframe(this._sensorHandler.getBattery?.());
        this._sendBatteryStateToIframe(this._sensorHandler.getBatteryState?.());
    }


    /* ---------- hass hook ---------- */

    set hass(hass) {
        if (!this._config || !this._iframe) return;

        this._hass = hass;
        this._updatePreviewState();
        this._ensureMessageSubscription();

        // Always keep hass fresh (safe + cheap)
        this._pipelineTracker?.setHass?.(hass);
               
        // Only re-apply config if the pipeline settings changed since last time we applied it
        const enabled = !!this._config?.assist_pipeline_enabled;
        const pid = this._config?.assist_pipeline_entity || "";
        if (!this._lastPipelineCfg || this._lastPipelineCfg.enabled !== enabled || this._lastPipelineCfg.pid !== pid) {
            this._lastPipelineCfg = { enabled, pid};
            this._pipelineTracker?.setConfig?.(this._config);
        }

        if (this._sensorHandler) this._sensorHandler.setConfig(this._config);
        

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

        // Sensor handler normalizes raw HA entities into a single payload.
        let sensorValues = null;
        if (this._sensorHandler) {
            this._sensorHandler.setHass(hass);
            sensorValues = this._sensorHandler.update?.() || this._sensorHandler.getPayload?.() || null;
        }
        const batteryActive = Number.isFinite(sensorValues?.battery);
        const batteryLow = batteryActive && sensorValues.battery <= 20;
        const batteryCharging = sensorValues?.battery_state === true;

        // const now = Date.now();
        const overrideMood = this._assistSatelliteOutcome?.getOverrideMood?.();
        const assistEnabled = !!this._config?.assist_satellite_enabled;
        const assistActive = assistEnabled && assistMood && assistMood !== "idle";
        let mood = overrideMood ? overrideMood : ((assistEnabled && assistMood) ? assistMood : baseMood);
        if (!overrideMood && !assistActive && batteryLow && !batteryCharging) {
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
        this._pendingState = { mood, brightness, animationsEnabled, sensorValues };
        if (!this._initSent && this._iframeReady && this._iframeLoaded) {
            this._sendInitToIframe(this._pendingState);
        }

        if (!this._loadedOnce) {
            // First load: set iframe src and send initial state
            base.searchParams.set("mood", mood);
            base.searchParams.set("brightness", brightness.toString());
            if (sensorValues && Number.isFinite(sensorValues.temperature)) {
                base.searchParams.set("temperature", sensorValues.temperature.toString());
            }
            if (sensorValues && Number.isFinite(sensorValues.windspeed)) {
                base.searchParams.set("windspeed", sensorValues.windspeed.toString());
            }
            if (sensorValues && Number.isFinite(sensorValues.precipitation)) {
                base.searchParams.set("precipitation", sensorValues.precipitation.toString());
            }
            if (sensorValues && Number.isFinite(sensorValues.battery)) {
                base.searchParams.set("battery", sensorValues.battery.toString());
            }

            const src = base.toString();
            this._iframe.onload = () => {
                this._iframeLoaded = true;
                this._handleIframeReady();
            };

            if (src !== this._lastSrc) {
                this._iframeReady = false;
                this._iframeLoaded = false;
                this._iframeBootstrapped = false;
                this._initSent = false;
                this._iframe.src = src;
                this._lastSrc = src;
            }

            this._loadedOnce = true;
            this._lastMood = undefined;
            this._lastBrightness = undefined;
        }
        else {
            if (!this._iframeBootstrapped) {
                return;
            }
            // Subsequent updates: only send what changed
            if (wakewordTriggered) {
                this._lastMood = mood;
                // Wake-word resets the iframe's idle/sleep timers.
                this._sendMoodToIframe(mood, { resetSleep: true });
            } else if (mood !== this._lastMood) {
                this._lastMood = mood;
                this._sendMoodToIframe(mood);
            }
            this._sendSensorIfChanged();
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





