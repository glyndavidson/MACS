import { createDebugger } from "../ha/debugger.js";
import { Particle, SVG_NS } from "./particles.js";

const DEBUG_ENABLED = true;
const debug = createDebugger("Moods", DEBUG_ENABLED);

const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];

const RAIN_MAX_DROPS = 200;
const RAIN_MIN_SPEED = 0.8;
const RAIN_MAX_SPEED = 4;
const RAIN_DROP_SIZE_MIN = 0.6;
const RAIN_DROP_SIZE_MAX = 1.3;
const RAIN_SIZE_VARIATION = 10;
const RAIN_SIZE_SPEED_RANGE = 0.8;
const RAIN_OPACITY_MIN = 0.2;
const RAIN_OPACITY_MAX = 0.8;
const RAIN_OPACITY_VARIATION = 8;
const RAIN_COUNT_EXPONENT = 1.5; // > 1 = fewer drops at low precipitation, ramping up later. < 1 = more drops at low precipitation
const RAIN_SPEED_JITTER_MIN = -0.2;
const RAIN_SPEED_JITTER_MAX = 0.2;
const RAIN_WIND_TILT_MAX = 89;
const RAIN_TILT_VARIATION = 1;
const RAIN_PATH_PADDING = 60;
const RAIN_WIND_SPEED_MULTIPLIER = 1;
const RAIN_SPAWN_OFFSET = 120;
const RAIN_SPAWN_VARIATION = 1;
const RAIN_START_DELAY_MAX = 2;

const SNOW_MAX_FLAKES = 500;
const SNOW_MIN_SPEED = 0.05;
const SNOW_MAX_SPEED = 0.1;
const SNOW_SIZE_MIN = 2;
const SNOW_SIZE_MAX = 5;
const SNOW_SIZE_VARIATION = 0.6;
const SNOW_OPACITY_MIN = 0.1;
const SNOW_OPACITY_MAX = 1;
const SNOW_OPACITY_VARIATION = 0.8;
const SNOW_MIN_DURATION = 6;
const SNOW_SPEED_JITTER_MIN = -0.2;
const SNOW_SPEED_JITTER_MAX = 0.2;
const SNOW_WIND_TILT_MAX = 89;
const SNOW_TILT_VARIATION = 15;
const SNOW_PATH_PADDING = 80;
const SNOW_WIND_SPEED_MULTIPLIER = 20;
const SNOW_START_DELAY_RATIO = 1;


const LEAF_MAX_COUNT = 20; 				// Maximum number of leaf particles when leaf intensity is 100%.
const LEAF_MIN_SPEED = 0.5;				// Base minimum travel speed (slowest leaves at low wind).
const LEAF_MAX_SPEED = 2;				// Base maximum travel speed (fastest leaves at high wind).
const LEAF_WIND_EXPONENT = 0.5;			// Non‑linear curve for wind strength (lower = wind effect ramps faster at low wind).
const LEAF_MIN_DURATION = 1;			// Minimum travel time (seconds) for a leaf at low wind; this fades toward 0 as wind increases.
const LEAF_SPEED_JITTER_MIN = -0.15;	// Random speed jitter lower bound (negative slows some leaves).
const LEAF_SPEED_JITTER_MAX = 0.15;		// Random speed jitter upper bound (positive speeds some leaves).
const LEAF_START_STAGGER = 5;			// Base delay between leaf starts by slot (seconds).
const LEAF_START_JITTER = 0.2;			// Extra random per‑leaf delay (seconds).
const LEAF_RESPAWN_DELAY_MIN = 0.1;		// Minimum pause before a leaf re‑enters after finishing its path (seconds).
const LEAF_RESPAWN_DELAY_JITTER = 0.8;	// 
const LEAF_WIND_TILT_MAX = 89;			// Maximum tilt angle from wind (degrees, 89 ≈ nearly horizontal).
const LEAF_TILT_VARIATION = 18;			// Random per‑leaf tilt variance (adds divergence so they don’t all travel parallel).
const LEAF_SIZE_MIN = 100;				// Smallest leaf size in px.
const LEAF_SIZE_MAX = 200;				// Largest leaf size in px.
const LEAF_SIZE_VARIATION = 0.5;		// Random size spread around the intensity value (0 = no variation, higher = more variance)
const LEAF_SPAWN_OFFSET = 300;			// How far beyond the entry edge leaves spawn (off‑screen).
const LEAF_SPAWN_VARIATION = 1.4;		// Random multiplier for spawn offset (more variation = more staggered start distances).
const LEAF_PATH_PADDING = 140;			// Extra off‑screen padding for path calculations (bigger = longer travel off‑screen).
const LEAF_OPACITY_MIN = 1;				// Minimum opacity per leaf.
const LEAF_OPACITY_MAX = 1;				// Maximum opacity per leaf.
const LEAF_OPACITY_VARIATION = 0;		// Random opacity spread around the intensity value.
const LEAF_SPIN_MIN = 120;				// 
const LEAF_SPIN_MAX = 120;				// 
const LEAF_VARIANTS = 10;				// 
const LEAF_IMAGE_BASE = "images/weather/leaves/leaf_";



const WIND_TILT_MAX = 25;
const WIND_TILT_EXPONENT = 2.2;

const IDLE_FLOAT_BASE_VMIN = 1.2;
const IDLE_FLOAT_MAX_VMIN = 20;
const IDLE_FLOAT_EXPONENT = 2.2;
const IDLE_FLOAT_BASE_SECONDS = 9;
const IDLE_FLOAT_MIN_SECONDS = 1;
const IDLE_FLOAT_SPEED_EXPONENT = 1.5;
const IDLE_FLOAT_JITTER_RATIO = 0.25;
const KIOSK_HOLD_MS = 800;
const BRIGHTNESS_FADE_SECONDS = 10;
const MOOD_IDLE_TO_BORED_MS = 30000;
const MOOD_BORED_TO_SLEEP_MS = 30000;
const CURSOR_LOOK_IDLE_MS = 5000;
const EYE_LOOK_MAX_X = 20;
const EYE_LOOK_MAX_Y = 12;



let rainIntensity = -1;
let rainViewWidth = 1000;
let rainViewHeight = 1000;
let windIntensity = 0;
let snowIntensity = -1;
let basePrecipIntensity = 0;
let idleFloatBase = IDLE_FLOAT_BASE_VMIN;
let idleFloatDuration = IDLE_FLOAT_BASE_SECONDS;
let idleFloatJitterTimer = null;
let weatherConditions = {};
let baseMood = "idle";
let autoBrightnessEnabled = false;
let autoBrightnessTimeoutMs = 0;
let autoBrightnessMin = 0;
let autoBrightnessMax = 100;
let autoBrightnessTimer = null;
let autoBrightnessFadeTimer = null;
let autoBrightnessIdle = false;
let autoBrightnessAsleep = false;
let baseBrightness = 100;
let autoBrightnessNextSleepAt = null;
let autoBrightnessDebugTimer = null;
let autoBrightnessConfigApplied = false;
let kioskHoldTimer = null;
let isEditor = false;
let brightnessFrame = null;
let lastBrightnessTarget = null;
let lastBrightnessTransition = null;
let moodIdleTimer = null;
let moodBoredTimer = null;
let cursorLookTimer = null;
let cursorLookActive = false;

let rainParticles = null;
let snowParticles = null;
let leafParticles = null;

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

const toIntensity = (value, fallback = 0) => clampPercent(value, fallback) / 100;
const clampRange = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
};

const setBrightnessTransition = (seconds) => {
	const duration = Number.isFinite(seconds) ? seconds : 0;
	document.documentElement.style.setProperty('--brightness-transition', `${duration}s`);
	if (document.body) {
		document.body.style.transition = `opacity ${duration}s linear`;
	}
};
const isTruthy = (value) => {
	if (value === null || value === undefined) return false;
	const v = value.toString().trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes" || v === "on";
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

const applyIdleFloatJitter = () => {
	const jitter = (Math.random() * 2) - 1;
	const amp = Math.max(0.1, idleFloatBase * (1 + (jitter * IDLE_FLOAT_JITTER_RATIO)));
	document.documentElement.style.setProperty('--idle-float-amp', `${amp.toFixed(2)}vmin`);
	if (idleFloatJitterTimer) {
		clearTimeout(idleFloatJitterTimer);
	}
	idleFloatJitterTimer = setTimeout(applyIdleFloatJitter, idleFloatDuration * 1000);
};

const getConditionFlag = (key) => {
	return !!(weatherConditions && weatherConditions[key]);
};

const applyPrecipitation = () => {
	const rainy = getConditionFlag("rainy") || getConditionFlag("pouring");
	const snowy = getConditionFlag("snowy");
	rainIntensity = rainy ? basePrecipIntensity : 0;
	snowIntensity = snowy ? basePrecipIntensity : 0;
	document.documentElement.style.setProperty('--precipitation-intensity', rainIntensity.toString());
	document.documentElement.style.setProperty('--snowfall-intensity', snowIntensity.toString());
	updateRainDrops(rainIntensity);
	updateSnowFlakes(snowIntensity);
	updateLeaves();
};

// applies a css class to the body so that we can style based on mood
function applyBodyClass(prefix, value, allowed, fallback){
    // remove existing prefixed classes
    [...document.body.classList].forEach(c => {
        if (c.startsWith(prefix + '-')) document.body.classList.remove(c);
    });

    // normalise the input value
    const v = (value ?? '').toString().trim().toLowerCase();

    // make sure it's an allowed value
    const isValid = typeof allowed === 'function' ? allowed(v) : allowed.includes(v);

    // apply the css style
    document.body.classList.add(prefix + '-' + (isValid ? v : fallback));
}

// set Macs mood. Must be one of const moods
function setMood(m){ 
    applyBodyClass('mood', m, moods, 'idle');
	setCursorLookActive(cursorLookActive);
}

const setCursorLookActive = (active) => {
	cursorLookActive = !!active;
	const body = document.body;
	if (!body) return;
	const idleActive = body.classList.contains("mood-idle");
	if (cursorLookActive && idleActive) {
		body.classList.add("cursor-look");
	} else {
		body.classList.remove("cursor-look");
	}
};

const setCursorLookOffset = (x, y) => {
	const root = document.documentElement;
	if (!root) return;
	root.style.setProperty("--eye-look-x", `${x.toFixed(2)}px`);
	root.style.setProperty("--eye-look-y", `${y.toFixed(2)}px`);
};

const handleCursorMove = (clientX, clientY) => {
	const width = window.innerWidth || 1;
	const height = window.innerHeight || 1;
	const nx = (clientX - width / 2) / (width / 2);
	const ny = (clientY - height / 2) / (height / 2);
	const clampedX = Math.max(-1, Math.min(1, nx));
	const clampedY = Math.max(-1, Math.min(1, ny));
	setCursorLookOffset(clampedX * EYE_LOOK_MAX_X, clampedY * EYE_LOOK_MAX_Y);
	setCursorLookActive(true);
	if (cursorLookTimer) clearTimeout(cursorLookTimer);
	cursorLookTimer = setTimeout(() => {
		setCursorLookActive(false);
	}, CURSOR_LOOK_IDLE_MS);
};

const clearMoodTimers = () => {
	if (moodIdleTimer) {
		clearTimeout(moodIdleTimer);
		moodIdleTimer = null;
	}
	if (moodBoredTimer) {
		clearTimeout(moodBoredTimer);
		moodBoredTimer = null;
	}
};

const scheduleMoodIdleSequence = () => {
	clearMoodTimers();
	if (isEditor) return;
	moodIdleTimer = setTimeout(() => {
		if (baseMood !== "idle") return;
		setMood("bored");
		moodBoredTimer = setTimeout(() => {
			if (baseMood !== "idle") return;
			setMood("sleeping");
		}, MOOD_BORED_TO_SLEEP_MS);
	}, MOOD_IDLE_TO_BORED_MS);
};

const setBaseMood = (nextMood) => {
	const value = (nextMood ?? "idle").toString().trim().toLowerCase();
	baseMood = moods.includes(value) ? value : "idle";
	if (baseMood !== "idle") {
		clearMoodTimers();
		setMood(baseMood);
		return;
	}
	setMood("idle");
	scheduleMoodIdleSequence();
};

const resetMoodSequence = () => {
	clearMoodTimers();
	if (baseMood === "idle") {
		setMood("idle");
		scheduleMoodIdleSequence();
	}
};

const initParticles = () => {
	if (!rainParticles) {
		rainParticles = new Particle("rain", {
			container: document.getElementById("rain-drops"),
			maxCount: RAIN_MAX_DROPS,
			countExponent: RAIN_COUNT_EXPONENT,
			element: {
				namespace: SVG_NS,
				tag: "ellipse",
				className: "drop"
			},
			size: {
				min: RAIN_DROP_SIZE_MIN,
				max: RAIN_DROP_SIZE_MAX,
				variation: RAIN_SIZE_VARIATION
			},
			opacity: {
				min: RAIN_OPACITY_MIN,
				max: RAIN_OPACITY_MAX,
				variation: RAIN_OPACITY_VARIATION
			},
			speed: {
				min: RAIN_MIN_SPEED,
				max: RAIN_MAX_SPEED,
				jitterMin: RAIN_SPEED_JITTER_MIN,
				jitterMax: RAIN_SPEED_JITTER_MAX,
				sizeRange: RAIN_SIZE_SPEED_RANGE,
				windMultiplier: RAIN_WIND_SPEED_MULTIPLIER
			},
			wind: {
				tiltMax: RAIN_WIND_TILT_MAX,
				tiltVariation: RAIN_TILT_VARIATION
			},
			path: {
				padding: RAIN_PATH_PADDING,
				spawnOffset: RAIN_SPAWN_OFFSET,
				spawnVariation: RAIN_SPAWN_VARIATION
			},
			delay: {
				startDelayMax: RAIN_START_DELAY_MAX
			}
		});
	}

	if (!snowParticles) {
		snowParticles = new Particle("snow", {
			container: document.getElementById("snow-flakes"),
			maxCount: SNOW_MAX_FLAKES,
			element: {
				namespace: SVG_NS,
				tag: "circle",
				className: "flake"
			},
			size: {
				min: SNOW_SIZE_MIN,
				max: SNOW_SIZE_MAX,
				variation: SNOW_SIZE_VARIATION
			},
			opacity: {
				min: SNOW_OPACITY_MIN,
				max: SNOW_OPACITY_MAX,
				variation: SNOW_OPACITY_VARIATION
			},
			speed: {
				min: SNOW_MIN_SPEED,
				max: SNOW_MAX_SPEED,
				jitterMin: SNOW_SPEED_JITTER_MIN,
				jitterMax: SNOW_SPEED_JITTER_MAX,
				minDuration: SNOW_MIN_DURATION,
				windMultiplier: SNOW_WIND_SPEED_MULTIPLIER
			},
			wind: {
				tiltMax: SNOW_WIND_TILT_MAX,
				tiltVariation: SNOW_TILT_VARIATION
			},
			path: {
				padding: SNOW_PATH_PADDING
			},
			delay: {
				startDelayRatio: SNOW_START_DELAY_RATIO
			}
		});
	}

	if (!leafParticles) {
		leafParticles = new Particle("leaf", {
			container: document.getElementById("leaf-layer"),
			maxCount: LEAF_MAX_COUNT,
			element: {
				tag: "img",
				className: "leaf",
				props: {
					alt: "",
					decoding: "async",
					draggable: false
				}
			},
			size: {
				min: LEAF_SIZE_MIN,
				max: LEAF_SIZE_MAX,
				variation: LEAF_SIZE_VARIATION
			},
			opacity: {
				min: LEAF_OPACITY_MIN,
				max: LEAF_OPACITY_MAX,
				variation: LEAF_OPACITY_VARIATION
			},
			speed: {
				min: LEAF_MIN_SPEED,
				max: LEAF_MAX_SPEED,
				jitterMin: LEAF_SPEED_JITTER_MIN,
				jitterMax: LEAF_SPEED_JITTER_MAX,
				minDuration: LEAF_MIN_DURATION,
				sizeBase: 0.85,
				sizeScale: 0.4
			},
			wind: {
				tiltMax: LEAF_WIND_TILT_MAX,
				tiltVariation: LEAF_TILT_VARIATION,
				exponent: LEAF_WIND_EXPONENT
			},
			path: {
				padding: LEAF_PATH_PADDING,
				spawnOffset: LEAF_SPAWN_OFFSET,
				spawnVariation: LEAF_SPAWN_VARIATION
			},
			spin: {
				min: LEAF_SPIN_MIN,
				max: LEAF_SPIN_MAX
			},
			images: {
				basePath: LEAF_IMAGE_BASE,
				variants: LEAF_VARIANTS
			},
			delay: {
				startStagger: LEAF_START_STAGGER,
				startJitter: LEAF_START_JITTER,
				respawnMin: LEAF_RESPAWN_DELAY_MIN,
				respawnJitter: LEAF_RESPAWN_DELAY_JITTER
			},
			thresholds: {
				windMin: 0.1,
				precipMax: 0.1
			},
			setIntensityVar: (value) => {
				document.documentElement.style.setProperty('--leaf-intensity', value.toString());
			}
		});
	}

	if (rainParticles) rainParticles.setWindIntensity(windIntensity);
	if (snowParticles) snowParticles.setWindIntensity(windIntensity);
	if (leafParticles) leafParticles.setWindIntensity(windIntensity);
};

const setRainViewBoxFromSvg = () => {
	initParticles();
	const svg = document.querySelector(".fx-rain");
	if (!svg) return;

	const rect = svg.getBoundingClientRect();
	const width = Math.max(1, Math.round(rect.width));
	const height = Math.max(1, Math.round(rect.height));

	if (width === rainViewWidth && height === rainViewHeight) return;
	rainViewWidth = width;
	rainViewHeight = height;
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	const snowSvg = document.querySelector(".fx-snow");
	if (snowSvg) {
		snowSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	}
	if (rainParticles) {
		rainParticles.setViewSize(width, height);
		rainParticles.reset();
	}
	if (snowParticles) {
		snowParticles.setViewSize(width, height);
		snowParticles.reset();
	}
	if (leafParticles) {
		leafParticles.setViewSize(width, height);
		leafParticles.reset();
	}
};

const updateRainDrops = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	if (!rainParticles) return;
	rainParticles.update(intensity, forceUpdate);
};

const updateSnowFlakes = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	if (!snowParticles) return;
	snowParticles.update(intensity, forceUpdate);
};

const updateLeaves = (forceUpdate = false) => {
	setRainViewBoxFromSvg();
	if (!leafParticles) return;
	leafParticles.updateFromEnvironment({
		windIntensity,
		rainIntensity,
		snowIntensity,
		forceUpdate
	});
};

function setTemperature(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
}

function setWindSpeed(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--windspeed-intensity', intensity.toString());
	windIntensity = intensity;
	if (rainParticles) rainParticles.setWindIntensity(intensity);
	if (snowParticles) snowParticles.setWindIntensity(intensity);
	if (leafParticles) leafParticles.setWindIntensity(intensity);
	const tilt = Math.pow(intensity, WIND_TILT_EXPONENT) * -WIND_TILT_MAX;
	document.documentElement.style.setProperty('--wind-tilt', `${tilt.toFixed(1)}deg`);
	idleFloatBase = IDLE_FLOAT_BASE_VMIN + ((IDLE_FLOAT_MAX_VMIN - IDLE_FLOAT_BASE_VMIN) * Math.pow(intensity, IDLE_FLOAT_EXPONENT));
	idleFloatDuration = IDLE_FLOAT_BASE_SECONDS - ((IDLE_FLOAT_BASE_SECONDS - IDLE_FLOAT_MIN_SECONDS) * Math.pow(intensity, IDLE_FLOAT_SPEED_EXPONENT));
	document.documentElement.style.setProperty('--idle-float-duration', `${idleFloatDuration.toFixed(2)}s`);
	applyIdleFloatJitter();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity, true);
	updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity, true);
	updateLeaves(true);
}

function setPrecipitation(value){
	basePrecipIntensity = toIntensity(value);
	applyPrecipitation();
}

function setSnowfall(value){
	setPrecipitation(value);
}

function setWeatherConditions(conditions){
	weatherConditions = (conditions && typeof conditions === "object") ? conditions : {};
	const body = document.body;
	if (!body) return;
	[...body.classList].forEach(c => {
		if (c.indexOf("weather-") === 0) body.classList.remove(c);
	});
	Object.keys(weatherConditions).forEach(key => {
		if (weatherConditions[key]) body.classList.add(`weather-${key}`);
	});
	debug("Setting weather conditions to: " + JSON.stringify(weatherConditions));
	applyPrecipitation();
}

function setBattery(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--battery-intensity', intensity.toString());
}

const setBrightnessValue = (value) => {
	const brightness = Number(value);
	if (!Number.isFinite(brightness)) return;
	if (brightness < 0 || brightness > 100) return;

	let opacity = 100;
	if (brightness === 0) {
		opacity = 0;
	} else if (brightness < 100) {
		opacity = brightness / 100;
	}

	document.documentElement.style.setProperty(
		'--brightness-level',
		opacity.toString()
	);
};

const applyBrightness = () => {
	if (!autoBrightnessEnabled) {
		if (brightnessFrame) {
			cancelAnimationFrame(brightnessFrame);
			brightnessFrame = null;
		}
		lastBrightnessTarget = baseBrightness;
		lastBrightnessTransition = 0;
		setBrightnessTransition(0);
		setBrightnessValue(baseBrightness);
		return;
	}

	const minValue = clampPercent(autoBrightnessMin, 0);
	const maxValue = clampPercent(autoBrightnessMax, 100);
	const safeMax = Math.max(minValue, maxValue);
	const activeBrightness = clampRange(baseBrightness, minValue, safeMax);
	const target = autoBrightnessIdle ? minValue : activeBrightness;
	const fadeSeconds = autoBrightnessIdle
		? Math.min(BRIGHTNESS_FADE_SECONDS, autoBrightnessTimeoutMs / 1000)
		: 0;

	if (fadeSeconds !== lastBrightnessTransition) {
		setBrightnessTransition(fadeSeconds);
		lastBrightnessTransition = fadeSeconds;
	}

	if (target === lastBrightnessTarget) return;
	lastBrightnessTarget = target;

	if (fadeSeconds > 0) {
		if (brightnessFrame) cancelAnimationFrame(brightnessFrame);
		brightnessFrame = requestAnimationFrame(() => {
			brightnessFrame = null;
			setBrightnessValue(target);
		});
		return;
	}

	if (brightnessFrame) {
		cancelAnimationFrame(brightnessFrame);
		brightnessFrame = null;
	}
	setBrightnessValue(target);
};

const updateAutoBrightnessDebug = () => {
	const debugDiv = document.getElementById("debug");
	if (!debugDiv) return;
	let statusEl = debugDiv.querySelector(".debug-sleep-timer");
	if (!statusEl) {
		statusEl = document.createElement("div");
		statusEl.className = "debug-sleep-timer";
		debugDiv.appendChild(statusEl);
	}

	let text = "Sleep in: disabled";
	if (autoBrightnessEnabled) {
		if (autoBrightnessAsleep) {
			text = "Sleep in: 0s (sleeping)";
		} else if (autoBrightnessNextSleepAt) {
			const remainingMs = autoBrightnessNextSleepAt - Date.now();
			const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
			text = `Sleep in: ${remaining}s`;
		} else {
			text = "Sleep in: 0s";
		}
	}

	statusEl.textContent = text;
};

const ensureAutoBrightnessDebugTimer = () => {
	if (autoBrightnessDebugTimer) return;
	autoBrightnessDebugTimer = setInterval(updateAutoBrightnessDebug, 1000);
};

const scheduleAutoBrightness = () => {
	if (autoBrightnessTimer) {
		clearTimeout(autoBrightnessTimer);
		autoBrightnessTimer = null;
	}
	if (autoBrightnessFadeTimer) {
		clearTimeout(autoBrightnessFadeTimer);
		autoBrightnessFadeTimer = null;
	}

	if (!autoBrightnessEnabled) return;

	if (!Number.isFinite(autoBrightnessTimeoutMs) || autoBrightnessTimeoutMs <= 0) {
		autoBrightnessIdle = false;
		autoBrightnessAsleep = false;
		autoBrightnessNextSleepAt = null;
		applyBrightness();
		updateAutoBrightnessDebug();
		return;
	}

	const fadeMs = Math.min(BRIGHTNESS_FADE_SECONDS * 1000, autoBrightnessTimeoutMs);
	const fadeDelay = Math.max(0, autoBrightnessTimeoutMs - fadeMs);
	if (fadeDelay <= 0) {
		autoBrightnessIdle = true;
		autoBrightnessAsleep = false;
		applyBrightness();
		updateAutoBrightnessDebug();
	} else {
		autoBrightnessFadeTimer = setTimeout(() => {
			autoBrightnessFadeTimer = null;
			autoBrightnessIdle = true;
			autoBrightnessAsleep = false;
			applyBrightness();
			updateAutoBrightnessDebug();
		}, fadeDelay);
	}

	autoBrightnessNextSleepAt = Date.now() + autoBrightnessTimeoutMs;
	autoBrightnessTimer = setTimeout(() => {
		autoBrightnessAsleep = true;
		autoBrightnessNextSleepAt = null;
		updateAutoBrightnessDebug();
	}, autoBrightnessTimeoutMs);
	updateAutoBrightnessDebug();
};

const registerAutoBrightnessActivity = () => {
	if (isEditor) return;
	if (!autoBrightnessEnabled) return;

	if (autoBrightnessIdle) {
		autoBrightnessIdle = false;
		autoBrightnessAsleep = false;
		applyBrightness();
	}

	scheduleAutoBrightness();
	resetMoodSequence();
};

const sendKioskToggle = () => {
	try {
		debug("Kiosk hold: toggling sidebar/navbar");
		window.parent.postMessage({ type: "macs:toggle_kiosk" }, window.location.origin);
	} catch (_) {}
};

const startKioskHold = () => {
	if (isEditor) return;
	if (!autoBrightnessEnabled) return;
	debug("Kiosk hold: start");
	if (kioskHoldTimer) clearTimeout(kioskHoldTimer);
	kioskHoldTimer = setTimeout(() => {
		kioskHoldTimer = null;
		sendKioskToggle();
	}, KIOSK_HOLD_MS);
};

const endKioskHold = () => {
	if (kioskHoldTimer) {
		debug("Kiosk hold: cancel");
		clearTimeout(kioskHoldTimer);
		kioskHoldTimer = null;
	}
};

const initKioskHoldListeners = () => {
	if (isEditor) return;
	const target = document.body;
	if (!target) return;
	if ("PointerEvent" in window) {
		target.addEventListener("pointerdown", startKioskHold, { passive: true });
		target.addEventListener("pointerup", endKioskHold, { passive: true });
		target.addEventListener("pointercancel", endKioskHold, { passive: true });
		target.addEventListener("pointerleave", endKioskHold, { passive: true });
	} else {
		target.addEventListener("touchstart", startKioskHold, { passive: true });
		target.addEventListener("touchend", endKioskHold, { passive: true });
		target.addEventListener("touchcancel", endKioskHold, { passive: true });
		target.addEventListener("mousedown", startKioskHold);
		target.addEventListener("mouseup", endKioskHold);
		target.addEventListener("mouseleave", endKioskHold);
	}
};

function setAutoBrightnessConfig(config){
	if (isEditor) {
		autoBrightnessEnabled = false;
		autoBrightnessIdle = false;
		updateAutoBrightnessDebug();
		return;
	}
	const nextEnabled = !!(config && config.auto_brightness_enabled);
	const timeoutFallback = autoBrightnessTimeoutMs ? (autoBrightnessTimeoutMs / 60000) : 0;
	const timeoutMinutes = toNumber(config?.auto_brightness_timeout_minutes, timeoutFallback);
	const nextTimeoutMs = timeoutMinutes > 0 ? timeoutMinutes * 60 * 1000 : 0;
	const nextMin = toNumber(config?.auto_brightness_min, autoBrightnessMin);
	const nextMax = toNumber(config?.auto_brightness_max, autoBrightnessMax);

	const changed = !autoBrightnessConfigApplied ||
		nextEnabled !== autoBrightnessEnabled ||
		nextTimeoutMs !== autoBrightnessTimeoutMs ||
		nextMin !== autoBrightnessMin ||
		nextMax !== autoBrightnessMax;

	if (!changed) return;

	autoBrightnessConfigApplied = true;
	autoBrightnessEnabled = nextEnabled;
	autoBrightnessTimeoutMs = nextTimeoutMs;
	autoBrightnessMin = nextMin;
	autoBrightnessMax = nextMax;
	autoBrightnessIdle = false;
	autoBrightnessAsleep = false;
	ensureAutoBrightnessDebugTimer();
	scheduleAutoBrightness();
	applyBrightness();
	updateAutoBrightnessDebug();
}

// set brightness level (0-100)
function setBrightness(userBrightness){
	const brightness = Number(userBrightness);
	if (!Number.isFinite(brightness)) return;
	if (brightness < 0 || brightness > 100) return;

	baseBrightness = brightness;
	applyBrightness();
}


const qs = new URLSearchParams(location.search);
isEditor = qs.get('edit') === '1' || qs.get('edit') === 'true';
setBaseMood(qs.get('mood') || 'idle');
setRainViewBoxFromSvg();
setTemperature(qs.get('temperature') ?? '0');
setWindSpeed(qs.get('windspeed') ?? '0');
const precipitationParam = qs.get('precipitation');
const rainfallParam = qs.get('rainfall');
const snowfallParam = qs.get('snowfall');
if (precipitationParam !== null) {
	setPrecipitation(precipitationParam);
} else if (rainfallParam !== null) {
	setPrecipitation(rainfallParam);
} else if (snowfallParam !== null) {
	setPrecipitation(snowfallParam);
} else {
	setPrecipitation('0');
}
const conditionsParam = qs.get('conditions');
if (conditionsParam !== null) {
	setWeatherConditions(parseConditionsParam(conditionsParam));
}
setBattery(qs.get('battery') ?? '0');
setBrightness(qs.get('brightness') ?? '100');
ensureAutoBrightnessDebugTimer();
updateAutoBrightnessDebug();
initKioskHoldListeners();

const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
activityEvents.forEach((eventName) => {
	window.addEventListener(eventName, registerAutoBrightnessActivity, { passive: true });
});
window.addEventListener("pointermove", (event) => {
	handleCursorMove(event.clientX, event.clientY);
}, { passive: true });
window.addEventListener("touchmove", (event) => {
	if (!event.touches || !event.touches.length) return;
	const touch = event.touches[0];
	handleCursorMove(touch.clientX, touch.clientY);
}, { passive: true });
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) registerAutoBrightnessActivity();
});

window.addEventListener('resize', () => {
	setRainViewBoxFromSvg();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity);
	updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity);
	updateLeaves();
});

window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    if (e.origin !== window.location.origin) return;
    if (!e.data || typeof e.data !== 'object') return;

	if (e.data.type === 'macs:config') {
		if (typeof e.data.auto_brightness_enabled !== "undefined") {
			setAutoBrightnessConfig(e.data);
		}
		return;
	}

    if (e.data.type === 'macs:mood') {
        setBaseMood(e.data.mood || 'idle');
        if (e.data.reset_sleep) {
            debug("Wakeword: reset sleep timer");
            registerAutoBrightnessActivity();
            resetMoodSequence();
        }
        return;
    }
    if (e.data.type === 'macs:temperature') {
        setTemperature(e.data.temperature ?? '0');
        debug("Setting temperature to: " + (e.data.temperature ?? '0'));
        return;
    }
    if (e.data.type === 'macs:windspeed') {
        setWindSpeed(e.data.windspeed ?? '0');
        debug("Setting windspeed to: " + (e.data.windspeed ?? '0'));
        return;
    }
    if (e.data.type === 'macs:precipitation') {
        setPrecipitation(e.data.precipitation ?? '0');
        debug("Setting precipitation to: " + (e.data.precipitation ?? '0'));
        return;
    }
    if (e.data.type === 'macs:rainfall') {
        setPrecipitation(e.data.rainfall ?? '0');
        debug("Setting precipitation to: " + (e.data.rainfall ?? '0'));
        return;
    }
    if (e.data.type === 'macs:weather_conditions') {
        setWeatherConditions(e.data.conditions);
        return;
    }
    if (e.data.type === 'macs:turns') {
        debug("Pipeline: reset sleep timer");
        registerAutoBrightnessActivity();
        resetMoodSequence();
        return;
    }
    if (e.data.type === 'macs:battery') {
        setBattery(e.data.battery ?? '0');
        return;
    }
    if (e.data.type === 'macs:snowfall') {
        setSnowfall(e.data.snowfall ?? '0');
        debug("Setting snowfall to: " + (e.data.snowfall ?? '0'));
        return;
    }
    if (e.data.type === 'macs:brightness') {
        setBrightness(e.data.brightness ?? '100');
        return;
    }
});


debug("Macs Moods Loaded");
