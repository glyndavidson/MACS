import { createDebugger } from "../../shared/debugger.js";
import { MessagePoster } from "../../shared/messagePoster.js";
import { MessageListener } from "../../shared/messageListener.js";
import { Particle, SVG_NS } from "./particles.js";
import {
	RAIN_MAX_DROPS,
	RAIN_MIN_SPEED,
	RAIN_MAX_SPEED,
	RAIN_DROP_SIZE_MIN,
	RAIN_DROP_SIZE_MAX,
	RAIN_SIZE_VARIATION,
	RAIN_SIZE_SPEED_RANGE,
	RAIN_OPACITY_MIN,
	RAIN_OPACITY_MAX,
	RAIN_OPACITY_VARIATION,
	RAIN_COUNT_EXPONENT,
	RAIN_SPEED_JITTER_MIN,
	RAIN_SPEED_JITTER_MAX,
	RAIN_WIND_TILT_MAX,
	RAIN_TILT_VARIATION,
	RAIN_PATH_PADDING,
	RAIN_WIND_SPEED_MULTIPLIER,
	RAIN_SPAWN_OFFSET,
	RAIN_SPAWN_VARIATION,
	RAIN_START_DELAY_MAX,
	SNOW_MAX_FLAKES,
	SNOW_MIN_SPEED,
	SNOW_MAX_SPEED,
	SNOW_SIZE_MIN,
	SNOW_SIZE_MAX,
	SNOW_SIZE_VARIATION,
	SNOW_OPACITY_MIN,
	SNOW_OPACITY_MAX,
	SNOW_OPACITY_VARIATION,
	SNOW_MIN_DURATION,
	SNOW_SPEED_JITTER_MIN,
	SNOW_SPEED_JITTER_MAX,
	SNOW_WIND_TILT_MAX,
	SNOW_TILT_VARIATION,
	SNOW_PATH_PADDING,
	SNOW_WIND_SPEED_MULTIPLIER,
	SNOW_START_DELAY_RATIO,
	LEAF_MAX_COUNT,
	LEAF_MIN_SPEED,
	LEAF_MAX_SPEED,
	LEAF_WIND_EXPONENT,
	LEAF_MIN_DURATION,
	LEAF_SPEED_JITTER_MIN,
	LEAF_SPEED_JITTER_MAX,
	LEAF_START_STAGGER,
	LEAF_START_JITTER,
	LEAF_RESPAWN_DELAY_MIN,
	LEAF_RESPAWN_DELAY_JITTER,
	LEAF_WIND_TILT_MAX,
	LEAF_TILT_VARIATION,
	LEAF_SIZE_MIN,
	LEAF_SIZE_MAX,
	LEAF_SIZE_VARIATION,
	LEAF_SPAWN_OFFSET,
	LEAF_SPAWN_VARIATION,
	LEAF_PATH_PADDING,
	LEAF_OPACITY_MIN,
	LEAF_OPACITY_MAX,
	LEAF_OPACITY_VARIATION,
	LEAF_SPIN_MIN,
	LEAF_SPIN_MAX,
	LEAF_VARIANTS,
	LEAF_IMAGE_BASE,
	WIND_TILT_MAX,
	WIND_TILT_EXPONENT,
} from "./weatherFxTweaker.js";

const debug = createDebugger("moods");
const messagePoster = new MessagePoster({
	sender: "frontend",
	recipient: "backend",
	getRecipientWindow: () => window.parent,
	getTargetOrigin: () => window.location.origin,
});
const messageListener = new MessageListener({
	recipient: "moods",
	getExpectedSource: () => window.parent,
	getExpectedOrigin: () => window.location.origin,
	allowNullOrigin: true,
	onMessage: handleMessage,
});
messageListener.start();
let readySent = false;

const moods = ['bored','confused','happy','idle','listening','sad','sleeping','surprised','thinking'];


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
const STAGE_LOOK_MAX_X = 8;
const STAGE_LOOK_MAX_Y = 6;
const LOW_BATTERY_CUTOFF = 20;



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
let idleSequenceEnabled = false;
let autoBrightnessEnabled = false;
let autoBrightnessTimeoutMs = 0;
let autoBrightnessMin = 0;
let autoBrightnessMax = 100;
let autoBrightnessPauseAnimations = true;
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
let animationsPaused = false;
let animationsToggleEnabled = true;
let lastBatteryPercent = null;
let baseColors = null;
let batteryCharging = null;
let batteryStateSensorEnabled = false;

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

const LOW_BATTERY_ZERO_VARS = [
	"--iris-outer-glow",
	"--iris-inner-glow",
	"--mouth-glow",
	"--brow-glow"
];

const LOW_BATTERY_BLACK_VARS = [
	"--sclera-gradient-fill",
	"--sclera-gradient-shadow",
	"--sclera-gradient-highlight"
];

const LOW_BATTERY_FADE_VARS = [
	"--sclera-outer-glow",
	"--sclera-inner-glow",
	"--pupil-inner-glow",
	"--pupil-outer-glow",
	"--pupil-fill",
	"--mouth-fill",
	"--brow-fill"
];

const BASE_COLOR_VARS = (() => {
	const vars = [
		...LOW_BATTERY_ZERO_VARS,
		...LOW_BATTERY_BLACK_VARS,
		...LOW_BATTERY_FADE_VARS,
		"--sclera-charging-glow"
	];
	return Array.from(new Set(vars));
})();

const parseColor = (value) => {
	const v = (value || "").toString().trim();
	if (!v) return null;
	if (v.startsWith("#")) {
		const hex = v.slice(1);
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			return { r, g, b, a: 1 };
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			return { r, g, b, a: 1 };
		}
	}
	const rgbMatch = v.match(/^rgba?\(([^)]+)\)$/i);
	if (rgbMatch) {
		const parts = rgbMatch[1].split(",").map((p) => p.trim());
		const r = Number(parts[0]);
		const g = Number(parts[1]);
		const b = Number(parts[2]);
		const a = parts.length > 3 ? Number(parts[3]) : 1;
		if ([r, g, b, a].every((n) => Number.isFinite(n))) {
			return { r, g, b, a };
		}
	}
	return null;
};

const toRgba = (value, alpha) => {
	const parsed = parseColor(value);
	if (!parsed) {
		return alpha >= 1 ? value : "rgba(0, 0, 0, 0)";
	}
	const a = Math.max(0, Math.min(1, alpha));
	return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${a})`;
};

const ensureBaseColors = () => {
	const root = document.documentElement;
	if (!root) return;
	const styles = getComputedStyle(root);
	if (!baseColors) {
		baseColors = {};
	}
	BASE_COLOR_VARS.forEach((key) => {
		if (typeof baseColors[key] === "undefined") {
			baseColors[key] = styles.getPropertyValue(key).trim();
		}
	});
};

const applyColorSet = (colors) => {
	if (!colors) return;
	const root = document.documentElement;
	if (!root) return;
	Object.keys(colors).forEach((key) => {
		if (typeof colors[key] !== "undefined") {
			root.style.setProperty(key, colors[key]);
		}
	});
};

const getActiveColors = () => {
	const colors = baseColors;
	if (!colors) return null;
	if (isChargingVisualActive() && colors["--sclera-charging-glow"]) {
		return {
			...colors,
			"--sclera-inner-glow": colors["--sclera-charging-glow"]
		};
	}
	return colors;
};

const applyBatteryDimming = (percent) => {
	ensureBaseColors();
	const colors = getActiveColors();
	if (!colors) return;
	const root = document.documentElement;
	if (!root) return;
	if (!Number.isFinite(percent) || batteryCharging === true || percent > LOW_BATTERY_CUTOFF) {
		applyColorSet(colors);
		return;
	}
	LOW_BATTERY_ZERO_VARS.forEach((key) => {
		root.style.setProperty(key, toRgba(colors[key], 0));
	});
	LOW_BATTERY_BLACK_VARS.forEach((key) => {
		root.style.setProperty(key, "rgba(0, 0, 0, 1)");
	});
	const fade = Math.max(0, Math.min(1, percent / LOW_BATTERY_CUTOFF));
	LOW_BATTERY_FADE_VARS.forEach((key) => {
		root.style.setProperty(key, toRgba(colors[key], fade));
	});
};

function isChargingVisualActive() {
	if (batteryCharging !== true) return false;
	if (!batteryStateSensorEnabled) return true;
	return Number.isFinite(lastBatteryPercent) && lastBatteryPercent <= LOW_BATTERY_CUTOFF;
}

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
	const effectiveActive = cursorLookActive && idleActive;
	if (effectiveActive) {
		body.classList.add("cursor-look");
	} else {
		body.classList.remove("cursor-look");
	}
	if (!effectiveActive) {
		setStageLookOffset(0, 0);
	}
};

const setCursorLookOffset = (x, y) => {
	const root = document.documentElement;
	if (!root) return;
	root.style.setProperty("--eye-look-x", `${x.toFixed(2)}px`);
	root.style.setProperty("--eye-look-y", `${y.toFixed(2)}px`);
};

const setStageLookOffset = (x, y) => {
	const root = document.documentElement;
	if (!root) return;
	root.style.setProperty("--stage-look-x", `${x.toFixed(2)}px`);
	root.style.setProperty("--stage-look-y", `${y.toFixed(2)}px`);
};

const handleCursorMove = (clientX, clientY) => {
	const width = window.innerWidth || 1;
	const height = window.innerHeight || 1;
	const nx = (clientX - width / 2) / (width / 2);
	const ny = (clientY - height / 2) / (height / 2);
	const clampedX = Math.max(-1, Math.min(1, nx));
	const clampedY = Math.max(-1, Math.min(1, ny));
	setCursorLookOffset(clampedX * EYE_LOOK_MAX_X, clampedY * EYE_LOOK_MAX_Y);
	setStageLookOffset(clampedX * STAGE_LOOK_MAX_X, clampedY * STAGE_LOOK_MAX_Y);
	setCursorLookActive(true);
	if (cursorLookTimer) clearTimeout(cursorLookTimer);
	cursorLookTimer = setTimeout(() => {
		setCursorLookActive(false);
	}, CURSOR_LOOK_IDLE_MS);
};

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
		if (cursorLookTimer) {
			clearTimeout(cursorLookTimer);
			cursorLookTimer = null;
		}
		setCursorLookActive(false);
		if (rainParticles) rainParticles.reset();
		if (snowParticles) snowParticles.reset();
		if (leafParticles) leafParticles.reset();
		return;
	}

	applyIdleFloatJitter();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity, true);
	updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity, true);
	updateLeaves(true);
};

const applyAnimationsToggle = () => {
	if (autoBrightnessEnabled) {
		if (autoBrightnessAsleep) {
			setAnimationsPaused(autoBrightnessPauseAnimations);
		} else {
			setAnimationsPaused(false);
		}
		return;
	}
	setAnimationsPaused(!animationsToggleEnabled);
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

const setIdleSequenceEnabled = (enabled) => {
	const next = !!enabled;
	if (idleSequenceEnabled === next) return;
	idleSequenceEnabled = next;
	if (!idleSequenceEnabled) {
		clearMoodTimers();
		if (baseMood === "idle") {
			setMood("idle");
		}
		return;
	}
	if (baseMood === "idle") {
		scheduleMoodIdleSequence();
	}
};

const scheduleMoodIdleSequence = () => {
	clearMoodTimers();
	if (isEditor || !idleSequenceEnabled) return;
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
	if (idleSequenceEnabled) {
		scheduleMoodIdleSequence();
	}
};

const resetMoodSequence = () => {
	clearMoodTimers();
	if (baseMood === "idle") {
		setMood("idle");
		if (idleSequenceEnabled) {
			scheduleMoodIdleSequence();
		}
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
	if (animationsPaused) return;
	setRainViewBoxFromSvg();
	if (!rainParticles) return;
	rainParticles.update(intensity, forceUpdate);
};

const updateSnowFlakes = (intensity, forceUpdate = false) => {
	if (animationsPaused) return;
	setRainViewBoxFromSvg();
	if (!snowParticles) return;
	snowParticles.update(intensity, forceUpdate);
};

const updateLeaves = (forceUpdate = false) => {
	if (animationsPaused) return;
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
	const percent = clampPercent(value, 0);
	const intensity = percent / 100;
	document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
	const body = document.body;
	if (body) {
		body.classList.toggle("temp-icicles", percent >= 0 && percent <= 5);
		body.classList.toggle("temp-scarf", percent >= 0 && percent <= 10);
	}
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
	debug(`Setting weather conditions to:\n${JSON.stringify(weatherConditions, null, 2)}`);
	applyPrecipitation();
}

function setBattery(value){
	const percent = clampPercent(value, 0);
	const intensity = percent / 100;
	lastBatteryPercent = percent;
	document.documentElement.style.setProperty('--battery-intensity', intensity.toString());
	setChargingActive(isChargingVisualActive());
	applyBatteryDimming(percent);
}

function setChargingActive(active) {
	const body = document.body;
	if (!body) return;
	body.classList.toggle("charging", !!active);
}

function setBatteryState(value) {
	if (value === null || typeof value === "undefined") {
		batteryCharging = null;
		setChargingActive(false);
		applyBatteryDimming(lastBatteryPercent);
		return;
	}
	batteryCharging = !!value;
	setChargingActive(isChargingVisualActive());
	applyBatteryDimming(lastBatteryPercent);
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
		const logContainer = debugDiv.querySelector(".debug-log");
		if (logContainer) {
			debugDiv.insertBefore(statusEl, logContainer);
		} else {
			debugDiv.appendChild(statusEl);
		}
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

	if (!autoBrightnessEnabled) {
		applyAnimationsToggle();
		return;
	}

	if (!Number.isFinite(autoBrightnessTimeoutMs) || autoBrightnessTimeoutMs <= 0) {
		autoBrightnessIdle = false;
		autoBrightnessAsleep = false;
		autoBrightnessNextSleepAt = null;
		applyAnimationsToggle();
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
		setAnimationsPaused(autoBrightnessPauseAnimations);
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
	applyAnimationsToggle();
};

const sendKioskToggle = () => {
	debug("Kiosk hold: toggling sidebar/navbar");
	messagePoster.post({ type: "macs:toggle_kiosk", recipient: "backend" });
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
		setAnimationsPaused(false);
		updateAutoBrightnessDebug();
		return;
	}
	const nextEnabled = !!(config && config.auto_brightness_enabled);
	const timeoutFallback = autoBrightnessTimeoutMs ? (autoBrightnessTimeoutMs / 60000) : 0;
	const timeoutMinutes = toNumber(config?.auto_brightness_timeout_minutes, timeoutFallback);
	const nextTimeoutMs = timeoutMinutes > 0 ? timeoutMinutes * 60 * 1000 : 0;
	const nextMin = toNumber(config?.auto_brightness_min, autoBrightnessMin);
	const nextMax = toNumber(config?.auto_brightness_max, autoBrightnessMax);
	const nextPauseAnimations = config?.auto_brightness_pause_animations;

	const changed = !autoBrightnessConfigApplied ||
		nextEnabled !== autoBrightnessEnabled ||
		nextTimeoutMs !== autoBrightnessTimeoutMs ||
		nextMin !== autoBrightnessMin ||
		nextMax !== autoBrightnessMax ||
		nextPauseAnimations !== autoBrightnessPauseAnimations;

	if (!changed) return;

	autoBrightnessConfigApplied = true;
	autoBrightnessEnabled = nextEnabled;
	autoBrightnessTimeoutMs = nextTimeoutMs;
	autoBrightnessMin = nextMin;
	autoBrightnessMax = nextMax;
	autoBrightnessPauseAnimations = typeof nextPauseAnimations === "undefined"
		? autoBrightnessPauseAnimations
		: !!nextPauseAnimations;
	autoBrightnessIdle = false;
	autoBrightnessAsleep = false;
	applyAnimationsToggle();
	ensureAutoBrightnessDebugTimer();
	scheduleAutoBrightness();
	applyBrightness();
	updateAutoBrightnessDebug();
}

const applyConfigPayload = (config) => {
	if (!config || typeof config !== "object") return;
	if (typeof config.assist_satellite_enabled !== "undefined") {
		setIdleSequenceEnabled(!!config.assist_satellite_enabled);
	}
	if (typeof config.auto_brightness_enabled !== "undefined") {
		setAutoBrightnessConfig(config);
	}
	if (typeof config.battery_state_sensor_enabled !== "undefined") {
		batteryStateSensorEnabled = !!config.battery_state_sensor_enabled;
		setChargingActive(isChargingVisualActive());
		applyBatteryDimming(lastBatteryPercent);
	}
	if (typeof config.debug_mode !== "undefined") {
		setDebugOverride(config.debug_mode);
	}
};

const applySensorPayload = (sensors) => {
	if (!sensors || typeof sensors !== "object") return;
	if (typeof sensors.temperature !== "undefined") {
		setTemperature(sensors.temperature);
	}
	if (typeof sensors.windspeed !== "undefined") {
		setWindSpeed(sensors.windspeed);
	}
	if (typeof sensors.precipitation !== "undefined") {
		setPrecipitation(sensors.precipitation);
	}
	if (typeof sensors.conditions !== "undefined") {
		setWeatherConditions(sensors.conditions);
	}
	if (typeof sensors.battery !== "undefined") {
		setBattery(sensors.battery);
	}
	if (typeof sensors.battery_state !== "undefined") {
		setBatteryState(sensors.battery_state);
	}
};

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
if (precipitationParam !== null) {
	setPrecipitation(precipitationParam);
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

function handleMessage(payload) {
	if (!payload || typeof payload !== 'object') return;

	if (payload.type === 'macs:init') {
		applyConfigPayload(payload.config);
		if (typeof payload.mood !== "undefined") {
			setBaseMood(payload.mood || 'idle');
		}
		applySensorPayload(payload.sensors);
		if (typeof payload.brightness !== "undefined") {
			setBrightness(payload.brightness);
		}
		if (typeof payload.animations_enabled !== "undefined") {
			animationsToggleEnabled = !!payload.animations_enabled;
			applyAnimationsToggle();
		}
		messagePoster.post({ type: "macs:init_ack", recipient: "backend" });
		return;
	}

	if (payload.type === 'macs:config') {
		applyConfigPayload(payload);
		return;
	}

	if (payload.type === 'macs:animations_enabled') {
		animationsToggleEnabled = !!payload.enabled;
		applyAnimationsToggle();
		return;
	}

    if (payload.type === 'macs:mood') {
        setBaseMood(payload.mood || 'idle');
        if (payload.reset_sleep) {
            debug("Wakeword: reset sleep timer");
            registerAutoBrightnessActivity();
            resetMoodSequence();
        }
        return;
    }
    if (payload.type === 'macs:temperature') {
        setTemperature(payload.temperature ?? '0');
        debug("Setting temperature to: " + (payload.temperature ?? '0'));
        return;
    }
    if (payload.type === 'macs:windspeed') {
        setWindSpeed(payload.windspeed ?? '0');
        debug("Setting windspeed to: " + (payload.windspeed ?? '0'));
        return;
    }
    if (payload.type === 'macs:precipitation') {
        setPrecipitation(payload.precipitation ?? '0');
        debug("Setting precipitation to: " + (payload.precipitation ?? '0'));
        return;
    }
    if (payload.type === 'macs:weather_conditions') {
        setWeatherConditions(payload.conditions);
        return;
    }
    if (payload.type === 'macs:turns') {
        debug("Pipeline: reset sleep timer");
        registerAutoBrightnessActivity();
        resetMoodSequence();
        return;
    }
    if (payload.type === 'macs:battery') {
        setBattery(payload.battery ?? '0');
        return;
    }
    if (payload.type === 'macs:battery_state') {
        setBatteryState(payload.battery_state);
        return;
    }
    if (payload.type === 'macs:brightness') {
        setBrightness(payload.brightness ?? '100');
        return;
    }
}


debug("Macs Moods Loaded");
if (!readySent) {
	readySent = true;
messagePoster.post({ type: "macs:ready", recipient: "backend" });
}

