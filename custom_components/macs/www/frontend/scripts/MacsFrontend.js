/**
 * Macs Frontend
 * -------------
 * Coordinates frontend effects, message handling, and runtime setup.
 */

import { MessagePoster } from "../../shared/messagePoster.js";
import { MessageListener } from "../../shared/messageListener.js";
import { createBatteryFx } from "./batteryFx.js";
import { createCursorFx } from "./cursorFx.js";
import { createKioskFx } from "./kioskFx.js";
import { createMoodFx } from "./moodFx.js";
import { createWeatherFx } from "./weatherFx.js";

import { createDebugger } from "../../shared/debugger.js";
const debug = createDebugger(import.meta.url);

const messagePoster = new MessagePoster({
	sender: "frontend",
	recipient: "backend",
	getRecipientWindow: () => window.parent,
	getTargetOrigin: () => window.location.origin,
});
const messageListener = new MessageListener({
	recipient: "frontend",
	getExpectedSource: () => window.parent,
	getExpectedOrigin: () => window.location.origin,
	allowNullOrigin: true,
	onMessage: handleMessage,
});
let readySent = false;

const IDLE_FLOAT_BASE_VMIN = 1.2;
const IDLE_FLOAT_MAX_VMIN = 20;
const IDLE_FLOAT_EXPONENT = 2.2;
const IDLE_FLOAT_BASE_SECONDS = 9;
const IDLE_FLOAT_MIN_SECONDS = 1;
const IDLE_FLOAT_SPEED_EXPONENT = 1.5;
const IDLE_FLOAT_JITTER_RATIO = 0.25;



let weatherFx = null;
let batteryFx = null;
let cursorFx = null;
let moodFx = null;
let kioskFx = null;
let idleFloatBase = IDLE_FLOAT_BASE_VMIN;
let idleFloatDuration = IDLE_FLOAT_BASE_SECONDS;
let idleFloatJitterTimer = null;
let isEditor = false;
let animationsPaused = false;

const warnIfNull = (label, value) => {
	if (value !== null) return false;
	debug(`<span class="error">${label} is null</span>`);
	return true;
};

const parseConditionsParam = (value) => {
	const conditions = {};
	if (!value) return conditions;
	value.split(",").forEach((entry) => {
		const key = entry.trim().toLowerCase();
		if (key) conditions[key] = true;
	});
	return conditions;
};

const setDebugOverride = (mode) => {
	if (typeof mode === "undefined") return;
	if (typeof window !== "undefined") {
		window.__MACS_DEBUG__ = mode;
		if (window.dispatchEvent) {
			window.dispatchEvent(new CustomEvent("macs-debug-update"));
		}
	}
	if (typeof debug?.show === "function") {
		debug.show();
	}
};


const applyIdleFloatJitter = () => {
	const jitter = (Math.random() * 2) - 1;
	const amp = Math.max(0.1, idleFloatBase * (1 + (jitter * IDLE_FLOAT_JITTER_RATIO)));
	document.documentElement.style.setProperty('--idle-float-amp', `${amp.toFixed(2)}vmin`);
	if (idleFloatJitterTimer) {
		clearTimeout(idleFloatJitterTimer);
	}
	idleFloatJitterTimer = setTimeout(applyIdleFloatJitter, idleFloatDuration * 1000);
};

const handleWindFxChange = (intensity) => {
	idleFloatBase = IDLE_FLOAT_BASE_VMIN + ((IDLE_FLOAT_MAX_VMIN - IDLE_FLOAT_BASE_VMIN) * Math.pow(intensity, IDLE_FLOAT_EXPONENT));
	idleFloatDuration = IDLE_FLOAT_BASE_SECONDS - ((IDLE_FLOAT_BASE_SECONDS - IDLE_FLOAT_MIN_SECONDS) * Math.pow(intensity, IDLE_FLOAT_SPEED_EXPONENT));
	document.documentElement.style.setProperty('--idle-float-duration', `${idleFloatDuration.toFixed(2)}s`);
	applyIdleFloatJitter();
};

weatherFx = createWeatherFx({
	debug,
	getIsPaused: () => animationsPaused,
	onWindChange: handleWindFxChange,
});

const setAnimationsPaused = (paused) => {
	const next = !!paused;
	if (animationsPaused === next) return;
	animationsPaused = next;
	const body = document.body;
	if (body) body.classList.toggle("animations-paused", animationsPaused);

	if (animationsPaused) {
		if (idleFloatJitterTimer) {
			clearTimeout(idleFloatJitterTimer);
			idleFloatJitterTimer = null;
		}
		if (cursorFx) cursorFx.reset();
		if (weatherFx) weatherFx.reset();
		return;
	}

	applyIdleFloatJitter();
	if (weatherFx) weatherFx.refresh(true);
};

cursorFx = createCursorFx();
moodFx = createMoodFx({
	isEditor: () => isEditor,
	onMoodChange: (mood) => {
		if (cursorFx) cursorFx.setIdleActive(mood === "idle");
	}
});
batteryFx = createBatteryFx();
kioskFx = createKioskFx({
	debug,
	isEditor: () => isEditor,
	messagePoster,
	setAnimationsPaused
});

const applyConfigPayload = (config) => {
	if (!config || typeof config !== "object") return;
	if (typeof config.assist_satellite_enabled !== "undefined") {
		if (moodFx) moodFx.setIdleSequenceEnabled(!!config.assist_satellite_enabled);
	}
	const hasAutoBrightnessConfig = [
		"auto_brightness_enabled",
		"auto_brightness_timeout_minutes",
		"auto_brightness_min",
		"auto_brightness_max",
		"auto_brightness_pause_animations"
	].some((key) => typeof config[key] !== "undefined");
	if (hasAutoBrightnessConfig && kioskFx) {
		kioskFx.setAutoBrightnessConfig(config);
	}
	if (typeof config.battery_state_sensor_enabled !== "undefined") {
		if (batteryFx) batteryFx.setBatteryStateSensorEnabled(!!config.battery_state_sensor_enabled);
	}
	if (typeof config.debug_mode !== "undefined") {
		setDebugOverride(config.debug_mode);
	}
};

const applySensorPayload = (sensors) => {
	if (!sensors || typeof sensors !== "object") return;
	if (typeof sensors.temperature !== "undefined") {
		if (!warnIfNull("temperature", sensors.temperature) && weatherFx) {
			weatherFx.setTemperature(sensors.temperature);
		}
	}
	if (typeof sensors.windspeed !== "undefined") {
		if (!warnIfNull("windspeed", sensors.windspeed) && weatherFx) {
			weatherFx.setWindSpeed(sensors.windspeed);
		}
	}
	if (typeof sensors.precipitation !== "undefined") {
		if (!warnIfNull("precipitation", sensors.precipitation) && weatherFx) {
			weatherFx.setPrecipitation(sensors.precipitation);
		}
	}
	if (typeof sensors.conditions !== "undefined") {
		if (!warnIfNull("conditions", sensors.conditions) && weatherFx) {
			weatherFx.setWeatherConditions(sensors.conditions);
		}
	}
	if (typeof sensors.battery !== "undefined") {
		if (!warnIfNull("battery", sensors.battery) && batteryFx) {
			batteryFx.setBattery(sensors.battery);
		}
	}
	if (typeof sensors.battery_state !== "undefined") {
		if (!warnIfNull("battery_state", sensors.battery_state) && batteryFx) {
			batteryFx.setBatteryState(sensors.battery_state);
		}
	}
};

const qs = new URLSearchParams(location.search);
isEditor = qs.get('edit') === '1' || qs.get('edit') === 'true';
if (moodFx) moodFx.setBaseMood(qs.get('mood') || 'idle');
if (weatherFx) weatherFx.handleResize();
if (weatherFx) weatherFx.setTemperature(qs.get('temperature') ?? '0');
if (weatherFx) weatherFx.setWindSpeed(qs.get('windspeed') ?? '0');
const precipitationParam = qs.get('precipitation');
if (precipitationParam !== null) {
	if (weatherFx) weatherFx.setPrecipitation(precipitationParam);
} else {
	if (weatherFx) weatherFx.setPrecipitation('0');
}
const conditionsParam = qs.get('conditions');
if (conditionsParam !== null) {
	if (weatherFx) weatherFx.setWeatherConditions(parseConditionsParam(conditionsParam));
}
if (batteryFx) batteryFx.setBattery(qs.get('battery') ?? '0');
if (kioskFx) {
	kioskFx.setBrightness(qs.get('brightness') ?? '100');
	kioskFx.ensureAutoBrightnessDebugTimer();
	kioskFx.updateAutoBrightnessDebug();
	kioskFx.initKioskHoldListeners();
}

const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
activityEvents.forEach((eventName) => {
	window.addEventListener(eventName, () => {
		const handled = kioskFx ? kioskFx.registerActivity() : false;
		if (handled && moodFx) moodFx.resetMoodSequence();
	}, { passive: true });
});
window.addEventListener("pointermove", (event) => {
	if (cursorFx) cursorFx.handleCursorMove(event.clientX, event.clientY);
}, { passive: true });
window.addEventListener("touchmove", (event) => {
	if (!event.touches || !event.touches.length) return;
	const touch = event.touches[0];
	if (cursorFx) cursorFx.handleCursorMove(touch.clientX, touch.clientY);
}, { passive: true });
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) {
		const handled = kioskFx ? kioskFx.registerActivity() : false;
		if (handled && moodFx) moodFx.resetMoodSequence();
	}
});

window.addEventListener('resize', () => {
	if (weatherFx) weatherFx.handleResize();
});

function handleMessage(payload) {
	if (!payload || typeof payload !== 'object') return;

	if (payload.type === 'macs:init') {
		applyConfigPayload(payload.config);
		if (typeof payload.mood !== "undefined") {
			if (moodFx) moodFx.setBaseMood(payload.mood || 'idle');
		}
		applySensorPayload(payload.sensors);
		if (typeof payload.brightness !== "undefined") {
			if (kioskFx) kioskFx.setBrightness(payload.brightness);
		}
		if (typeof payload.animations_enabled !== "undefined") {
			if (kioskFx) kioskFx.setAnimationsToggleEnabled(!!payload.animations_enabled);
		}
		messagePoster.post({ type: "macs:init_ack", recipient: "backend" });
		return;
	}

	if (payload.type === 'macs:config') {
		applyConfigPayload(payload);
		return;
	}

	if (payload.type === 'macs:animations_enabled') {
		if (kioskFx) kioskFx.setAnimationsToggleEnabled(!!payload.enabled);
		return;
	}

    if (payload.type === 'macs:mood') {
        if (moodFx) moodFx.setBaseMood(payload.mood || 'idle');
        if (payload.reset_sleep) {
            debug("Wakeword: reset sleep timer");
			if (kioskFx) kioskFx.registerActivity();
			if (moodFx) moodFx.resetMoodSequence();
        }
        return;
    }
    if (payload.type === 'macs:temperature') {
        if (warnIfNull("temperature", payload.temperature)) return;
        if (weatherFx) weatherFx.setTemperature(payload.temperature ?? '0');
        debug("Setting temperature to: " + (payload.temperature ?? '0'));
        return;
    }
    if (payload.type === 'macs:windspeed') {
        if (warnIfNull("windspeed", payload.windspeed)) return;
        if (weatherFx) weatherFx.setWindSpeed(payload.windspeed ?? '0');
        debug("Setting windspeed to: " + (payload.windspeed ?? '0'));
        return;
    }
    if (payload.type === 'macs:precipitation') {
        if (warnIfNull("precipitation", payload.precipitation)) return;
        if (weatherFx) weatherFx.setPrecipitation(payload.precipitation ?? '0');
        debug("Setting precipitation to: " + (payload.precipitation ?? '0'));
        return;
    }
    if (payload.type === 'macs:weather_conditions') {
        if (warnIfNull("conditions", payload.conditions)) return;
        if (weatherFx) weatherFx.setWeatherConditions(payload.conditions);
        return;
    }
    if (payload.type === 'macs:turns') {
        debug("Pipeline: reset sleep timer");
		if (kioskFx) kioskFx.registerActivity();
		if (moodFx) moodFx.resetMoodSequence();
        return;
    }
    if (payload.type === 'macs:battery') {
		if (warnIfNull("battery", payload.battery)) return;
		if (batteryFx) batteryFx.setBattery(payload.battery ?? '0');
        return;
    }
    if (payload.type === 'macs:battery_state') {
		if (warnIfNull("battery_state", payload.battery_state)) return;
		if (batteryFx) batteryFx.setBatteryState(payload.battery_state);
        return;
    }
    if (payload.type === 'macs:brightness') {
		if (kioskFx) kioskFx.setBrightness(payload.brightness ?? '100');
        return;
    }
}

debug("Macs Frontend Ready");
debug("Starting Communication with Backend...");

messageListener.start();
if (!readySent) {
	readySent = true;
	setTimeout(() => {
		messagePoster.post({ type: "macs:ready", recipient: "backend" });
	}, 50);
}
