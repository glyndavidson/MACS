import { createDebugger } from "../ha/debugger.js";
import { ParticleSystem } from "./particles.js";

const DEBUG_ENABLED = true;
const debug = createDebugger("Moods", DEBUG_ENABLED);

const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIN_MAX_DROPS = 50;

const RAIN_MIN_SPEED = 0.8;
const RAIN_MAX_SPEED = 4;

const RAIN_DROP_SIZE_MIN = 0.6;
const RAIN_DROP_SIZE_MAX = 1.3;
const RAIN_SIZE_VARIATION = 10;
const RAIN_SIZE_SPEED_RANGE = 0.4;

const RAIN_OPACITY_MIN = 0.15;
const RAIN_OPACITY_MAX = 0.8;
const RAIN_OPACITY_VARIATION = 10;

const RAIN_SPEED_JITTER_MIN = -0.2;
const RAIN_SPEED_JITTER_MAX = 0.2;

const RAIN_WIND_TILT_MAX = 89;
const RAIN_TILT_VARIATION = 1;
const RAIN_PATH_PADDING = 60;
const RAIN_WIND_SPEED_MULTIPLIER = 1.7;
const RAIN_SPAWN_OFFSET = 120;
const RAIN_SPAWN_VARIATION = 1;
const RAIN_START_DELAY_MAX = 2;

const SNOW_MAX_FLAKES = 500;
const SNOW_MIN_SPEED = 0.1;
const SNOW_MAX_SPEED = 0.3;
const SNOW_SIZE_MIN = 1.4;
const SNOW_SIZE_MAX = 3.6;
const SNOW_SIZE_VARIATION = 0.6;
const SNOW_OPACITY_MIN = 0.3;
const SNOW_OPACITY_MAX = 0.9;
const SNOW_OPACITY_VARIATION = 0.5;
const SNOW_MIN_DURATION = 6;
const SNOW_SPEED_JITTER_MIN = -0.1;
const SNOW_SPEED_JITTER_MAX = 0.1;
const SNOW_WIND_TILT_MAX = 89;
const SNOW_TILT_VARIATION = 12;
const SNOW_PATH_PADDING = 80;
const SNOW_WIND_SPEED_MULTIPLIER = 0.4;
const SNOW_START_DELAY_RATIO = 1;

const LEAF_MAX_COUNT = 1;
const LEAF_MIN_SPEED = 0.1;
const LEAF_MAX_SPEED = 2;
const LEAF_SIZE_MIN = 100
const LEAF_SIZE_MAX = 200;
const LEAF_SIZE_VARIATION = 0.5;
const LEAF_OPACITY_MIN = 1;
const LEAF_OPACITY_MAX = 1;
const LEAF_OPACITY_VARIATION = 0.3;
const LEAF_MIN_DURATION = 4;
const LEAF_SPEED_JITTER_MIN = -0.15;
const LEAF_SPEED_JITTER_MAX = 0.15;
const LEAF_WIND_TILT_MAX = 89;
const LEAF_WIND_EXPONENT = 0.5;
const LEAF_TILT_VARIATION = 18;
const LEAF_PATH_PADDING = 140;
const LEAF_SPAWN_OFFSET = 180;
const LEAF_SPAWN_VARIATION = 1.4;
const LEAF_START_STAGGER = 50;
const LEAF_START_JITTER = 0.2;
const LEAF_RESPAWN_DELAY_MIN = 5;
const LEAF_RESPAWN_DELAY_JITTER = 0.8;
const LEAF_SPIN_MIN = 120;
const LEAF_SPIN_MAX = 540;
const LEAF_VARIANTS = 10;
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



let rainIntensity = -1;
let rainViewWidth = 1000;
let rainViewHeight = 1000;
let windIntensity = 0;
let snowIntensity = -1;
let idleFloatBase = IDLE_FLOAT_BASE_VMIN;
let idleFloatDuration = IDLE_FLOAT_BASE_SECONDS;
let idleFloatJitterTimer = null;
let rainSystem = null;
let snowSystem = null;
let leafSystem = null;

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

const toIntensity = (value, fallback = 0) => clampPercent(value, fallback) / 100;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const isTruthy = (value) => {
	if (value === null || value === undefined) return false;
	const v = value.toString().trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes" || v === "on";
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

const getLineRectIntersections = (point, dir, rect) => {
	const hits = [];
	const { xMin, xMax, yMin, yMax } = rect;

	if (dir.x !== 0) {
		const tLeft = (xMin - point.x) / dir.x;
		const yLeft = point.y + tLeft * dir.y;
		if (yLeft >= yMin && yLeft <= yMax) hits.push({ x: xMin, y: yLeft, t: tLeft });

		const tRight = (xMax - point.x) / dir.x;
		const yRight = point.y + tRight * dir.y;
		if (yRight >= yMin && yRight <= yMax) hits.push({ x: xMax, y: yRight, t: tRight });
	}

	if (dir.y !== 0) {
		const tTop = (yMin - point.y) / dir.y;
		const xTop = point.x + tTop * dir.x;
		if (xTop >= xMin && xTop <= xMax) hits.push({ x: xTop, y: yMin, t: tTop });

		const tBottom = (yMax - point.y) / dir.y;
		const xBottom = point.x + tBottom * dir.x;
		if (xBottom >= xMin && xBottom <= xMax) hits.push({ x: xBottom, y: yMax, t: tBottom });
	}

	if (hits.length < 2) return null;
	hits.sort((a, b) => a.t - b.t);
	return { start: hits[0], end: hits[hits.length - 1] };
};

const getPathForSlot = (slotIndex, targetCount, tiltDeg, rect) => {
	const slot = Number.isFinite(slotIndex) ? slotIndex : Math.floor(Math.random() * Math.max(1, targetCount));
	const tiltRad = tiltDeg * (Math.PI / 180);
	const dir = { x: Math.sin(tiltRad), y: Math.cos(tiltRad) };
	const perp = { x: -dir.y, y: dir.x };
	const maxOffset = (Math.abs(perp.x) * rainViewWidth + Math.abs(perp.y) * rainViewHeight) / 2;
	const offset = (((slot + Math.random()) / Math.max(1, targetCount)) - 0.5) * 2 * maxOffset;
	const center = { x: rainViewWidth / 2, y: rainViewHeight / 2 };
	const point = { x: center.x + (perp.x * offset), y: center.y + (perp.y * offset) };
	const segment = getLineRectIntersections(point, dir, rect);
	const start = segment?.start ?? { x: center.x, y: rect.yMin };
	const end = segment?.end ?? { x: center.x, y: rect.yMax };

	return { slot, dir, start, end };
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
}

const setRainViewBoxFromSvg = () => {
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
	if (rainSystem) rainSystem.reset();
	if (snowSystem) snowSystem.reset();
	if (leafSystem) leafSystem.reset();
};

const getRainSystem = () => {
	if (rainSystem) return rainSystem;
	const container = document.getElementById("rain-drops");
	if (!container) return null;

	rainSystem = new ParticleSystem({
		container,
		maxCount: RAIN_MAX_DROPS,
		createParticle: () => {
			const drop = document.createElementNS(SVG_NS, "ellipse");
			drop.setAttribute("class", "drop");
			return drop;
		},
		buildConfig: buildRainConfig
	});
	return rainSystem;
};

const buildRainConfig = ({ particle, slot, normalized, targetCount }) => {
	const resolvedSlot = Number.isFinite(slot) ? slot : Math.floor(Math.random() * Math.max(1, targetCount));
	const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_SIZE_VARIATION);
	const size = RAIN_DROP_SIZE_MIN + (sizeBias * (RAIN_DROP_SIZE_MAX - RAIN_DROP_SIZE_MIN));
	const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_OPACITY_VARIATION);
	const baseOpacity = RAIN_OPACITY_MIN + (opacityBias * (RAIN_OPACITY_MAX - RAIN_OPACITY_MIN));
	const rx = 1 + (size * 1.2);
	const ry = 12 + (size * 18);
	const divergence = (Math.random() * 2) - 1;
	const tiltDeg = (windIntensity * RAIN_WIND_TILT_MAX) + (divergence * RAIN_TILT_VARIATION);
	const tiltCss = -tiltDeg;
	const rect = {
		xMin: -RAIN_PATH_PADDING,
		xMax: rainViewWidth + RAIN_PATH_PADDING,
		yMin: -RAIN_PATH_PADDING,
		yMax: rainViewHeight + RAIN_PATH_PADDING
	};
	const { dir, start, end } = getPathForSlot(resolvedSlot, targetCount, tiltDeg, rect);
	const spawnOffset = RAIN_SPAWN_OFFSET * (0.5 + (Math.random() * RAIN_SPAWN_VARIATION));
	const startOut = { x: start.x - (dir.x * spawnOffset), y: start.y - (dir.y * spawnOffset) };
	const endOut = { x: end.x + (dir.x * spawnOffset), y: end.y + (dir.y * spawnOffset) };
	const pathLength = Math.hypot(endOut.x - startOut.x, endOut.y - startOut.y);

	const baseSpeed = (RAIN_MIN_SPEED + ((RAIN_MAX_SPEED - RAIN_MIN_SPEED) * normalized)) * (1 + (windIntensity * RAIN_WIND_SPEED_MULTIPLIER));
	const jitter = RAIN_SPEED_JITTER_MIN + (Math.random() * (RAIN_SPEED_JITTER_MAX - RAIN_SPEED_JITTER_MIN));
	const sizeFactor = clamp01((size - RAIN_DROP_SIZE_MIN) / Math.max(1, (RAIN_DROP_SIZE_MAX - RAIN_DROP_SIZE_MIN)));
	const speedFactor = 1 + ((sizeFactor - 0.5) * RAIN_SIZE_SPEED_RANGE);
	const unclamped = (baseSpeed * speedFactor) * (1 + jitter);
	const speed = Math.min(RAIN_MAX_SPEED, Math.max(RAIN_MIN_SPEED, unclamped));
	const refDistance = Math.max(1, rect.yMax - rect.yMin);
	const distanceRatio = pathLength / refDistance;
	const duration = Math.max(0.1, distanceRatio / speed);

	particle.setAttribute("rx", rx.toFixed(2));
	particle.setAttribute("ry", ry.toFixed(2));
	particle.setAttribute("cx", "0");
	particle.setAttribute("cy", "0");
	particle.style.opacity = Math.min(RAIN_OPACITY_MAX, baseOpacity * (0.7 + (size * 0.3))).toFixed(2);
	particle.dataset.size = size.toFixed(3);
	particle.dataset.slot = resolvedSlot.toString();
	particle.dataset.pathLength = pathLength.toFixed(1);

	return {
		slot: resolvedSlot,
		keyframes: [
			{ transform: `translate(${startOut.x.toFixed(1)}px, ${startOut.y.toFixed(1)}px) rotate(${tiltCss.toFixed(2)}deg)` },
			{ transform: `translate(${endOut.x.toFixed(1)}px, ${endOut.y.toFixed(1)}px) rotate(${tiltCss.toFixed(2)}deg)` }
		],
		duration: duration * 1000,
		delay: Math.random() * RAIN_START_DELAY_MAX * 1000
	};
};

const updateRainDrops = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const system = getRainSystem();
	if (!system) return;
	system.update(intensity, forceUpdate);
};

const getSnowDuration = (size, pathLength, refDistance) => {
	const windMultiplier = 1 + (windIntensity * SNOW_WIND_SPEED_MULTIPLIER);
	const jitter = SNOW_SPEED_JITTER_MIN + (Math.random() * (SNOW_SPEED_JITTER_MAX - SNOW_SPEED_JITTER_MIN));
	const sizeFactor = (size - SNOW_SIZE_MIN) / Math.max(1, (SNOW_SIZE_MAX - SNOW_SIZE_MIN));
	const speedBias = clamp01(sizeFactor + jitter);
	const baseSpeed = SNOW_MIN_SPEED + (speedBias * (SNOW_MAX_SPEED - SNOW_MIN_SPEED));
	const unclampedSpeed = baseSpeed * windMultiplier;
	const speed = Math.min(SNOW_MAX_SPEED, Math.max(SNOW_MIN_SPEED, unclampedSpeed));
	const distance = Number.isFinite(pathLength) ? pathLength : refDistance;
	const distanceRatio = distance / refDistance;
	const minDuration = SNOW_MIN_DURATION * distanceRatio;
	return Math.max(minDuration, distanceRatio / speed);
};

const getSnowSystem = () => {
	if (snowSystem) return snowSystem;
	const container = document.getElementById("snow-flakes");
	if (!container) return null;

	snowSystem = new ParticleSystem({
		container,
		maxCount: SNOW_MAX_FLAKES,
		createParticle: () => {
			const flake = document.createElementNS(SVG_NS, "circle");
			flake.setAttribute("class", "flake");
			return flake;
		},
		buildConfig: buildSnowConfig
	});
	return snowSystem;
};

const buildSnowConfig = ({ particle, slot, normalized, targetCount }) => {
	const resolvedSlot = Number.isFinite(slot) ? slot : Math.floor(Math.random() * Math.max(1, targetCount));
	const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * SNOW_SIZE_VARIATION);
	const size = SNOW_SIZE_MIN + (sizeBias * (SNOW_SIZE_MAX - SNOW_SIZE_MIN));
	const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * SNOW_OPACITY_VARIATION);
	const baseOpacity = SNOW_OPACITY_MIN + (opacityBias * (SNOW_OPACITY_MAX - SNOW_OPACITY_MIN));
	const divergence = (Math.random() * 2) - 1;
	const tiltDeg = (windIntensity * SNOW_WIND_TILT_MAX) + (divergence * SNOW_TILT_VARIATION);
	const tiltCss = -tiltDeg;
	const rect = {
		xMin: -SNOW_PATH_PADDING,
		xMax: rainViewWidth + SNOW_PATH_PADDING,
		yMin: -SNOW_PATH_PADDING,
		yMax: rainViewHeight + SNOW_PATH_PADDING
	};
	const { start, end } = getPathForSlot(resolvedSlot, targetCount, tiltDeg, rect);
	const pathLength = Math.hypot(end.x - start.x, end.y - start.y);
	const refDistance = Math.max(1, rect.yMax - rect.yMin);
	const duration = getSnowDuration(size, pathLength, refDistance);

	particle.setAttribute("r", size.toFixed(2));
	particle.setAttribute("cx", "0");
	particle.setAttribute("cy", "0");
	particle.style.opacity = Math.min(SNOW_OPACITY_MAX, baseOpacity).toFixed(2);
	particle.dataset.size = size.toFixed(3);
	particle.dataset.slot = resolvedSlot.toString();
	particle.dataset.pathLength = pathLength.toFixed(1);

	return {
		slot: resolvedSlot,
		keyframes: [
			{ transform: `translate(${start.x.toFixed(1)}px, ${start.y.toFixed(1)}px) rotate(${tiltCss.toFixed(2)}deg)` },
			{ transform: `translate(${end.x.toFixed(1)}px, ${end.y.toFixed(1)}px) rotate(${tiltCss.toFixed(2)}deg)` }
		],
		duration: duration * 1000,
		delay: Math.random() * duration * SNOW_START_DELAY_RATIO * 1000
	};
};

const updateSnowFlakes = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const system = getSnowSystem();
	if (!system) return;
	system.update(intensity, forceUpdate);
};

const getLeafIntensity = () => {
	const wind = windIntensity;
	const rain = rainIntensity > 0 ? rainIntensity : 0;
	const snow = snowIntensity > 0 ? snowIntensity : 0;
	const precip = clamp01(rain + snow);
	if (wind <= 0.1 || precip >= 0.1) return 0;
	const windFactor = (wind - 0.1) / 0.9;
	const precipFactor = clamp01(1 - (precip / 0.1));
	return clamp01(windFactor * precipFactor);
};

const getLeafDuration = (size, pathLength, refDistance, windFactor) => {
	const jitter = LEAF_SPEED_JITTER_MIN + (Math.random() * (LEAF_SPEED_JITTER_MAX - LEAF_SPEED_JITTER_MIN));
	const sizeFactor = clamp01((size - LEAF_SIZE_MIN) / Math.max(1, (LEAF_SIZE_MAX - LEAF_SIZE_MIN)));
	const speedFactor = 0.85 + (sizeFactor * 0.4);
	const baseSpeed = LEAF_MIN_SPEED + (windFactor * (LEAF_MAX_SPEED - LEAF_MIN_SPEED));
	const speed = Math.max(LEAF_MIN_SPEED, baseSpeed * speedFactor * (1 + jitter));
	const distance = Number.isFinite(pathLength) ? pathLength : refDistance;
	const distanceRatio = distance / refDistance;
	const minDuration = LEAF_MIN_DURATION * (1 - windFactor) * distanceRatio;
	return Math.max(minDuration, distanceRatio / speed);
};

const getLeafSystem = () => {
	if (leafSystem) return leafSystem;
	const container = document.getElementById("leaf-layer");
	if (!container) return null;

	leafSystem = new ParticleSystem({
		container,
		maxCount: LEAF_MAX_COUNT,
		createParticle: () => {
			const leaf = document.createElement("img");
			leaf.className = "leaf";
			leaf.alt = "";
			leaf.decoding = "async";
			leaf.draggable = false;
			return leaf;
		},
		buildConfig: buildLeafConfig
	});
	return leafSystem;
};

const buildLeafConfig = ({ particle, slot, normalized, targetCount }) => {
	const resolvedSlot = Number.isFinite(slot) ? slot : Math.floor(Math.random() * Math.max(1, targetCount));
	const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * LEAF_SIZE_VARIATION);
	const size = LEAF_SIZE_MIN + (sizeBias * (LEAF_SIZE_MAX - LEAF_SIZE_MIN));
	const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * LEAF_OPACITY_VARIATION);
	const baseOpacity = LEAF_OPACITY_MIN + (opacityBias * (LEAF_OPACITY_MAX - LEAF_OPACITY_MIN));
	const divergence = (Math.random() * 2) - 1;
	const windFactor = Math.pow(windIntensity, LEAF_WIND_EXPONENT);
	const tiltDeg = (windFactor * LEAF_WIND_TILT_MAX) + (divergence * LEAF_TILT_VARIATION);
	const tiltCss = -tiltDeg;
	const rect = {
		xMin: -LEAF_PATH_PADDING,
		xMax: rainViewWidth + LEAF_PATH_PADDING,
		yMin: -LEAF_PATH_PADDING,
		yMax: rainViewHeight + LEAF_PATH_PADDING
	};
	const { dir, start, end } = getPathForSlot(resolvedSlot, targetCount, tiltDeg, rect);
	const spawnOffset = LEAF_SPAWN_OFFSET * (0.5 + (Math.random() * LEAF_SPAWN_VARIATION));
	const startOut = { x: start.x - (dir.x * spawnOffset), y: start.y - (dir.y * spawnOffset) };
	const endOut = { x: end.x + (dir.x * spawnOffset), y: end.y + (dir.y * spawnOffset) };
	const pathLength = Math.hypot(endOut.x - startOut.x, endOut.y - startOut.y);
	const refDistance = Math.max(1, rect.yMax - rect.yMin);
	const duration = getLeafDuration(size, pathLength, refDistance, windFactor);
	const spinStart = Math.random() * 360;
	const spinAmount = (LEAF_SPIN_MIN + (Math.random() * (LEAF_SPIN_MAX - LEAF_SPIN_MIN))) * (Math.random() < 0.5 ? -1 : 1);
	const spinEnd = spinStart + spinAmount;
	const leafIndex = Math.floor(Math.random() * LEAF_VARIANTS);

	particle.src = `${LEAF_IMAGE_BASE}${leafIndex}.png`;
	particle.style.width = `${size.toFixed(1)}px`;
	particle.style.height = `${size.toFixed(1)}px`;
	particle.style.opacity = Math.min(LEAF_OPACITY_MAX, baseOpacity).toFixed(2);
	particle.dataset.slot = resolvedSlot.toString();
	particle.dataset.pathLength = pathLength.toFixed(1);

	const respawnDelay = LEAF_RESPAWN_DELAY_MIN + (Math.random() * LEAF_RESPAWN_DELAY_JITTER);
	const startJitter = Math.random() * LEAF_START_JITTER;
	return {
		slot: resolvedSlot,
		keyframes: [
			{ transform: `translate(${startOut.x.toFixed(1)}px, ${startOut.y.toFixed(1)}px) rotate(${(tiltCss + spinStart).toFixed(2)}deg)` },
			{ transform: `translate(${endOut.x.toFixed(1)}px, ${endOut.y.toFixed(1)}px) rotate(${(tiltCss + spinEnd).toFixed(2)}deg)` }
		],
		duration: duration * 1000,
		delay: (resolvedSlot * LEAF_START_STAGGER + startJitter + respawnDelay) * 1000
	};
};

const updateLeaves = (forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const system = getLeafSystem();
	if (!system) return;
	const intensity = getLeafIntensity();
	document.documentElement.style.setProperty('--leaf-intensity', intensity.toString());
	system.update(intensity, forceUpdate);
};

function setTemperature(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
}

function setWindSpeed(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--windspeed-intensity', intensity.toString());
	windIntensity = intensity;
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

function setRainfall(value){
	const intensity = toIntensity(value);
	rainIntensity = intensity;
	document.documentElement.style.setProperty('--rainfall-intensity', intensity.toString());
	updateRainDrops(intensity);
	updateLeaves();
}

function setSnowfall(value){
	const intensity = toIntensity(value);
	snowIntensity = intensity;
	document.documentElement.style.setProperty('--snowfall-intensity', intensity.toString());
	updateSnowFlakes(intensity);
	updateLeaves();
}

// set brightness level (0-100)
function setBrightness(userBrightness){
	const brightness = Number(userBrightness);

	if (!Number.isFinite(brightness)) return;

    if (brightness < 0 || brightness > 100) return;

	// convert to 0–1 for opacity
    let opacity = 100;
    if (brightness === 0){
        opacity = 0;
    }
    else if (brightness < 100){
	    opacity = brightness / 100;
    }

	document.documentElement.style.setProperty(
		'--brightness-level',
		opacity.toString()
	);
}


const qs = new URLSearchParams(location.search);
setMood(qs.get('mood') || 'idle');
setRainViewBoxFromSvg();
setTemperature(qs.get('temperature') ?? '0');
setWindSpeed(qs.get('windspeed') ?? '0');
const rainfallParam = qs.get('rainfall');
const snowfallParam = qs.get('snowfall');
const snowing = isTruthy(qs.get('snowing'));
if (snowing) {
	if (snowfallParam !== null) {
		setSnowfall(snowfallParam);
		setRainfall(rainfallParam ?? '0');
	} else {
		setSnowfall(rainfallParam ?? '0');
		setRainfall('0');
	}
} else {
	setRainfall(rainfallParam ?? '0');
	setSnowfall(snowfallParam ?? '0');
}
setBrightness(qs.get('brightness') ?? '100');

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

    if (e.data.type === 'macs:mood') {
        setMood(e.data.mood || 'idle');
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
    if (e.data.type === 'macs:rainfall') {
        setRainfall(e.data.rainfall ?? '0');
        debug("Setting rainfall to: " + (e.data.rainfall ?? '0'));
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
