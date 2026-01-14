/**
 * Macs Frontend
 * -------------
 * Coordinates frontend effects, message handling, and runtime setup.
 */


// Add version query param to javascript imports for cache busting
import { importWithVersion } from "./importHandler.js";

// Import query params and shared helpers
const { QUERY_PARAMS, getQueryParamOrDefault, loadSharedConstants, getWeatherConditionKeys } = await importWithVersion("./helpers.js");
const paramsString = JSON.stringify(Object.fromEntries(QUERY_PARAMS.entries()), null, 2);

// Create Debugger
const { createDebugger, setDebugOverride } = await importWithVersion("../../shared/debugger.js");
const debug = createDebugger(import.meta.url);




//###############################################################################################
//                                                                                              #
//                         			STARTUP				                                        #
//                                                                                              #
//###############################################################################################

// Add query params to startup debug
debug("Macs frontend Starting with Query Params:\n" + paramsString);

// Import remaining JS Files
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

// load default settings from JSON
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
                "ts": Date(),
                "reply": `Looks like there might be a problem with [${label}]`
            },
        ]
	});
};


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


window.addEventListener('resize', () => {
	if (weatherFx) weatherFx.handleResize();
});



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


// Initialise each of the animation handlers
const initFx = (factory, overrides = {}) => {
	if (typeof factory !== "function") return null;
	return factory({
		isCardPreview,
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

// Set Mood setings
if (moodFx) {
	moodFx.setBaseMoodFromQuery();
	moodFx.setOnMoodChange((mood) => {
		if (cursorFx) cursorFx.setIdleActive(mood === "idle");
	});
}

// set Cursor settings
if (cursorFx) cursorFx.initCursorTracking();

// Set Weather settings
if (weatherFx) {
	weatherFx.setOnWindChange((intensity) => idleFx?.setWindIntensity(intensity));
	weatherFx.handleResize();
	weatherFx.setTemperatureFromQuery();
	weatherFx.setWindSpeedFromQuery();
	weatherFx.setPrecipitationFromQuery();
	weatherFx.setWeatherConditionsFromQuery();
}

// Set Battery settings
if (batteryFx) batteryFx.setBatteryFromQuery();

// Set Kiosk Settings
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





//###############################################################################################
//                                                                                              #
//                         			RUNTIME				                                        #
//                                                                                              #
//###############################################################################################

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


// Handle update messages fromt he backend
function handleMessage(payload) {
	// Make sure we have a valid payload (message)
	if (!payload || typeof payload !== 'object') return;

	switch (payload.type) {
		// If this is the first load
		case 'macs:init': {
			// then apply the config
			applyConfigPayload(payload.config);
			if (typeof payload.mood !== "undefined") {
				if (moodFx) moodFx.setBaseMood(payload.mood || 'idle');
			}
			// and the sensor data
			applySensorPayload(payload.sensors);
			if (typeof payload.brightness !== "undefined") {
				if (kioskFx) kioskFx.setBrightness(payload.brightness);
			}
			if (typeof payload.animations_enabled !== "undefined") {
				if (kioskFx) kioskFx.setAnimationsToggleEnabled(!!payload.animations_enabled);
			}
			// let the backend know that we're ready for further updates
			messagePoster.post({ type: "macs:init_ack", recipient: "backend" });
			return;
		}
		// if the settings have changed then reapply the config
		case 'macs:config': {
			applyConfigPayload(payload);
			return;
		}
		case 'macs:mood': {
			if (moodFx) moodFx.setBaseMood(payload.mood || 'idle');
			if (payload.reset_sleep) {
				debug("Wakeword: reset sleep timer");
				if (kioskFx) kioskFx.registerActivity();
				if (moodFx) moodFx.resetMoodSequence();
			}
			return;
		}
		case 'macs:temperature': {
			if (warnIfNull("temperature", payload.temperature)) return;
			if (weatherFx) weatherFx.setTemperature(payload.temperature ?? '0');
			debug("Setting temperature to: " + (payload.temperature ?? '0'));
			return;
		}
		case 'macs:windspeed': {
			if (warnIfNull("windspeed", payload.windspeed)) return;
			if (weatherFx) weatherFx.setWindSpeed(payload.windspeed ?? '0');
			debug("Setting windspeed to: " + (payload.windspeed ?? '0'));
			return;
		}
		case 'macs:precipitation': {
			if (warnIfNull("precipitation", payload.precipitation)) return;
			if (weatherFx) weatherFx.setPrecipitation(payload.precipitation ?? '0');
			debug("Setting precipitation to: " + (payload.precipitation ?? '0'));
			return;
		}
		case 'macs:weather_conditions': {
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
		case 'macs:turns': {
			debug("Pipeline: reset sleep timer");
			if (kioskFx) kioskFx.registerActivity();
			if (moodFx) moodFx.resetMoodSequence();
			return;
		}
		case 'macs:battery_charge': {
			if (warnIfNull("battery_charge", payload.battery_charge)) return;
			if (batteryFx) batteryFx.setBattery(payload.battery_charge ?? '0');
			return;
		}
		case 'macs:charging': {
			if (warnIfNull("charging", payload.charging)) return;
			if (batteryFx) batteryFx.setBatteryState(payload.charging);
			return;
		}
		case 'macs:brightness': {
			if (kioskFx) kioskFx.setBrightness(payload.brightness ?? '100');
			return;
		}
		case 'macs:animations_enabled': {
			if (kioskFx) kioskFx.setAnimationsToggleEnabled(!!payload.enabled);
			return;
		}
		default:
			return;
	}
}






//###############################################################################################
//                                                                                              #
//                         			READY				                                        #
//                                                                                              #
//###############################################################################################

debug("Macs Frontend Ready");
debug("Starting Communication with Backend...");

messageListener.start();
if (!readySent) {
	readySent = true;
	setTimeout(() => {
		messagePoster.post({ type: "macs:ready", recipient: "backend" });
	}, 50);
}
