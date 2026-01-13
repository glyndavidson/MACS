/**
 * Macs Frontend
 * -------------
 * Coordinates frontend effects, message handling, and runtime setup.
 */


// Add version query param to javascript imports

import { importWithVersion } from "./importHandler.js";

// Import shared helpers + debugger
const { createDebugger, setDebugOverride } = await importWithVersion("../../shared/debugger.js");
const { QUERY_PARAMS, getQueryParamOrDefault, loadSharedConstants, getWeatherConditionKeys } = await importWithVersion("./helpers.js");
const debug = createDebugger(import.meta.url);

const paramsString = JSON.stringify(Object.fromEntries(QUERY_PARAMS.entries()), null, 2);

debug("Macs frontend Starting with Query Params:\n" + paramsString);


// Import JS Files
debug("Loading files...");
const { MessagePoster } = await importWithVersion("../../shared/messagePoster.js");
const { MessageListener } = await importWithVersion("../../shared/messageListener.js");
await importWithVersion("./assist-bridge.js");
const { createBatteryFx } = await importWithVersion("./batteryFx.js");
const { createCursorFx } = await importWithVersion("./cursorFx.js");
const { createKioskFx } = await importWithVersion("./kioskFx.js");
const { createIdleFx } = await importWithVersion("./idleFx.js");
const { createMoodFx } = await importWithVersion("./moodFx.js");
const { createWeatherFx } = await importWithVersion("./weatherFx.js");

// load defaults from JSON
await loadSharedConstants();

// Is the iframe being rendered in a card preview (we don't want kiosk mode etc)
const isCardPreview = (() => {
	const edit = getQueryParamOrDefault("edit");
	return edit === "1" || edit === "true";
})();

let weatherFx = null;
let batteryFx = null;
let cursorFx = null;
let idleFx = null;
let moodFx = null;
let kioskFx = null;

let animationsPaused = false;
let readySent = false;


// Message poster for sending updates tot he backend
const messagePoster = new MessagePoster({
	sender: "frontend",
	recipient: "backend",
	getRecipientWindow: () => window.parent,
	getTargetOrigin: () => window.location.origin,
});
// Message poster for emulating system dialogue in the front-end (Used for error reporting)
// todo: move to debugger.js
const assistMessagePoster = new MessagePoster({
	sender: "frontend",
	recipient: "all",
	getRecipientWindow: () => window,  // Same window
	getTargetOrigin: () => window.location.origin,
});


// Listen for post messages
const messageListener = new MessageListener({
	recipient: "frontend",
	getExpectedSource: () => window.parent,
	getExpectedOrigin: () => window.location.origin,
	allowNullOrigin: true,
	onMessage: handleMessage,
});


// highlights null values in config (i.e. a sensor error)
// and fakes an assist dialogue to let the user know
// todo: move to debugger.js
const warnIfNull = (label, value) => {
	if (value !== null) return false;
	debug("warn", `${label} is null`);

	assistMessagePoster.post({
        type: "macs:turns",
        recipient: "all",
        turns: [
            {
                "ts": "2026-01-07T17:45:50.028019+00:00",
                "reply": `Looks like there might be a problem with [${label}]`
            },
        ]
	});
};


// Applies configuration values (Used once at startup)
const applyConfigPayload = (config) => {
	// make sure we have a valid config
	if (!config || typeof config !== "object") return;

	// if using assist satellite, then auto adjust mood
	if (typeof config.assist_satellite_enabled !== "undefined") {
		if (moodFx) moodFx.setIdleSequenceEnabled(!!config.assist_satellite_enabled);
	}

	// Kiosk Mode
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

	// battery charging
	if (typeof config.battery_state_sensor_enabled !== "undefined") {
		if (batteryFx) batteryFx.setBatteryStateSensorEnabled(!!config.battery_state_sensor_enabled);
	}

	// debug mode
	if (typeof config.debug_mode !== "undefined") {
		setDebugOverride(config.debug_mode, debug);
	}
};

// Applies sensor values (Used any time a sensor value updates)
const applySensorPayload = (sensors) => {
	// make sure we have a valid object
	if (!sensors || typeof sensors !== "object") return;

	const weatherConditionKeys = getWeatherConditionKeys();

	// Set the temperature
	if (typeof sensors.temperature !== "undefined") {
		if (!warnIfNull("temperature", sensors.temperature) && weatherFx) {
			weatherFx.setTemperature(sensors.temperature);
		}
	}

	// Set the windspeed
	if (typeof sensors.windspeed !== "undefined") {
		if (!warnIfNull("windspeed", sensors.windspeed) && weatherFx) {
			weatherFx.setWindSpeed(sensors.windspeed);
		}
	}

	// Set the precipitation
	if (typeof sensors.precipitation !== "undefined") {
		if (!warnIfNull("precipitation", sensors.precipitation) && weatherFx) {
			weatherFx.setPrecipitation(sensors.precipitation);
		}
	}

	// Set weather conditions
	if (weatherConditionKeys.length && weatherFx) {
		const conditions = {};
		let hasAny = false;
		weatherConditionKeys.forEach((key) => {
			if (typeof sensors[key] === "undefined") return;
			if (warnIfNull(key, sensors[key])) return;
			conditions[key] = !!sensors[key];
			hasAny = true;
		});
		if (hasAny) {
			weatherFx.setWeatherConditions(conditions);
		}
	}

	// Set battery charge level
	if (typeof sensors.battery_charge !== "undefined") {
		if (!warnIfNull("battery_charge", sensors.battery_charge) && batteryFx) {
			batteryFx.setBattery(sensors.battery_charge);
		}
	}

	// Set battery charging state (bool)
	if (typeof sensors.charging !== "undefined") {
		if (!warnIfNull("charging", sensors.charging) && batteryFx) {
			batteryFx.setBatteryState(sensors.charging);
		}
	}
};


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
		const weatherConditionKeys = getWeatherConditionKeys();
		const conditions = {};
		let hasAny = false;
		weatherConditionKeys.forEach((key) => {
			if (typeof payload[key] === "undefined") return;
			if (warnIfNull(key, payload[key])) return;
			conditions[key] = !!payload[key];
			hasAny = true;
		});
		if (hasAny && weatherFx) {
			weatherFx.setWeatherConditions(conditions);
		}
        return;
    }
    if (payload.type === 'macs:turns') {
        debug("Pipeline: reset sleep timer");
		if (kioskFx) kioskFx.registerActivity();
		if (moodFx) moodFx.resetMoodSequence();
        return;
    }
    if (payload.type === 'macs:battery_charge') {
		if (warnIfNull("battery_charge", payload.battery_charge)) return;
		if (batteryFx) batteryFx.setBattery(payload.battery_charge ?? '0');
        return;
    }
    if (payload.type === 'macs:charging') {
		if (warnIfNull("charging", payload.charging)) return;
		if (batteryFx) batteryFx.setBatteryState(payload.charging);
        return;
    }
    if (payload.type === 'macs:brightness') {
		if (kioskFx) kioskFx.setBrightness(payload.brightness ?? '100');
        return;
    }
}


// pause animations when screen timeout is reached is reduce power consumption
const setAnimationsPaused = (paused) => {
	const next = !!paused;
	if (animationsPaused === next) return;
	animationsPaused = next;
	const body = document.body;
	if (body) body.classList.toggle("animations-paused", animationsPaused);
	if (idleFx) idleFx.setPaused(animationsPaused);

	if (animationsPaused) {
		if (cursorFx) cursorFx.reset();
		if (weatherFx) weatherFx.reset();
		return;
	}

	if (weatherFx) weatherFx.refresh(true);
};





const initFx = (factory, overrides = {}) => {
	if (typeof factory !== "function") return null;
	return factory({
		debug,
		isCardPreview: () => isCardPreview,
		messagePoster,
		setAnimationsPaused,
		getIsPaused: () => animationsPaused,
		...overrides
	});
};


idleFx = initFx(createIdleFx);
moodFx = initFx(createMoodFx);
cursorFx = initFx(createCursorFx);
weatherFx = initFx(createWeatherFx);
batteryFx = initFx(createBatteryFx);
kioskFx = initFx(createKioskFx);



if (moodFx) {
	moodFx.setBaseMoodFromQuery();
	moodFx.setOnMoodChange((mood) => {
		if (cursorFx) cursorFx.setIdleActive(mood === "idle");
	});
}

if (cursorFx) cursorFx.initCursorTracking();

if (weatherFx) {
	weatherFx.setOnWindChange((intensity) => idleFx?.setWindIntensity(intensity));
	weatherFx.handleResize();
	weatherFx.setTemperatureFromQuery();
	weatherFx.setWindSpeedFromQuery();
	weatherFx.setPrecipitationFromQuery();
	weatherFx.setWeatherConditionsFromQuery();
}

if (batteryFx) batteryFx.setBatteryFromQuery();

if (kioskFx) {
	kioskFx.setBrightnessFromQuery();
	kioskFx.ensureAutoBrightnessDebugTimer();
	kioskFx.updateAutoBrightnessDebug();
	kioskFx.initKioskHoldListeners();
	kioskFx.initActivityListeners({
		onActivity: () => {
			if (moodFx) moodFx.resetMoodSequence();
		}
	});
}



window.addEventListener('resize', () => {
	if (weatherFx) weatherFx.handleResize();
});



debug("Macs Frontend Ready");
debug("Starting Communication with Backend...");

messageListener.start();
if (!readySent) {
	readySent = true;
	setTimeout(() => {
		messagePoster.post({ type: "macs:ready", recipient: "backend" });
	}, 50);
}
