import { createDebugger } from "../ha/debugger.js";

const DEBUG_ENABLED = true;
const debug = createDebugger("Moods", DEBUG_ENABLED);

const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIN_MAX_DROPS = 50;

const RAIN_MIN_SPEED = 0.8;
const RAIN_MAX_SPEED = 1.8;

const RAIN_DROP_SIZE_MIN = 0.6;
const RAIN_DROP_SIZE_MAX = 1.3;
const RAIN_SIZE_VARIATION = 10;

const RAIN_OPACITY_MIN = 0.15;
const RAIN_OPACITY_MAX = 0.8;
const RAIN_OPACITY_VARIATION = 10;

const RAIN_SPEED_JITTER_MIN = -0.2;
const RAIN_SPEED_JITTER_MAX = 0.2;

const RAIN_DRIFT_BASE = -100;
const RAIN_DRIFT_VARIATION = 60;



let rainDropCount = -1;
let rainIntensity = -1;
let rainViewWidth = 1000;
let rainViewHeight = 1000;

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

const toIntensity = (value, fallback = 0) => clampPercent(value, fallback) / 100;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

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
	svg.style.setProperty("--rain-start-y", `${-height}px`);
	svg.style.setProperty("--rain-end-y", `${height}px`);
	rainDropCount = -1;
};

const updateRainDrops = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const container = document.getElementById("rain-drops");
	if (!container) return;

	const normalized = clamp01(intensity);
	const targetCount = Math.ceil(normalized * RAIN_MAX_DROPS);
	const baseSpeed = RAIN_MIN_SPEED + ((RAIN_MAX_SPEED - RAIN_MIN_SPEED) * normalized);
	const travelDistance = Math.max(1, rainViewHeight);

	const setDropSpeed = (drop, size) => {
		const jitter = RAIN_SPEED_JITTER_MIN + (Math.random() * (RAIN_SPEED_JITTER_MAX - RAIN_SPEED_JITTER_MIN));
		const speedFactor = 0.7 + size;
		const unclamped = (baseSpeed * speedFactor) * (1 + jitter);
		const speed = Math.min(RAIN_MAX_SPEED, Math.max(RAIN_MIN_SPEED, unclamped));
		const duration = 1 / speed;
		drop.style.animationDuration = `${duration.toFixed(2)}s`;
	};

	if (targetCount === rainDropCount && normalized === rainIntensity) {
		if (forceUpdate) {
			[...container.children].forEach((drop) => {
				const size = Number(drop.dataset.size);
				setDropSpeed(drop, Number.isFinite(size) ? size : 0.7);
			});
		}
		return;
	}
	rainDropCount = targetCount;
	rainIntensity = normalized;

	const xPositions = [];
	if (targetCount > 0) {
		for (let i = 0; i < targetCount; i += 1) {
			xPositions.push(((i + Math.random()) / targetCount) * rainViewWidth);
		}
		for (let i = xPositions.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[xPositions[i], xPositions[j]] = [xPositions[j], xPositions[i]];
		}
	}

	container.replaceChildren();
	for (let i = 0; i < targetCount; i += 1) {
		const drop = document.createElementNS(SVG_NS, "ellipse");
		const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_SIZE_VARIATION);
		const size = RAIN_DROP_SIZE_MIN + (sizeBias * (RAIN_DROP_SIZE_MAX - RAIN_DROP_SIZE_MIN));
		const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_OPACITY_VARIATION);
		const baseOpacity = RAIN_OPACITY_MIN + (opacityBias * (RAIN_OPACITY_MAX - RAIN_OPACITY_MIN));
		const rx = 1.5 + (size * 1.2);
		const ry = 12 + (size * 18);
		const cx = Math.round(xPositions[i] ?? (Math.random() * rainViewWidth));
		const cy = Math.round(Math.random() * rainViewHeight);

		drop.setAttribute("class", "drop");
		drop.setAttribute("rx", rx.toFixed(2));
		drop.setAttribute("ry", ry.toFixed(2));
		drop.setAttribute("cx", cx.toString());
		drop.setAttribute("cy", cy.toString());
		const divergence = (Math.random() * 2) - 1;
		const drift = RAIN_DRIFT_BASE + (divergence * RAIN_DRIFT_VARIATION);
		const tilt = -Math.atan2(drift, travelDistance) * (180 / Math.PI);
		const startY = -(rainViewHeight + (ry * 2));
		drop.style.setProperty("--rain-drift", `${drift.toFixed(1)}px`);
		drop.style.setProperty("--rain-tilt", `${tilt.toFixed(2)}deg`);
		drop.style.setProperty("--rain-start-y", `${startY.toFixed(1)}px`);
		drop.style.setProperty("--rain-end-y", `${rainViewHeight.toFixed(1)}px`);
		drop.style.transform = `translate(${(-drift).toFixed(1)}px, ${startY.toFixed(1)}px) rotate(${tilt.toFixed(2)}deg)`;
		drop.dataset.size = size.toFixed(3);
		drop.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`;
		drop.style.opacity = Math.min(RAIN_OPACITY_MAX, baseOpacity * (0.7 + (size * 0.3))).toFixed(2);
		setDropSpeed(drop, size);
		container.appendChild(drop);
	}
};

function setTemperature(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
}

function setWindSpeed(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--windspeed-intensity', intensity.toString());
}

function setRainfall(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--rainfall-intensity', intensity.toString());
	updateRainDrops(intensity);
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
setRainfall(qs.get('rainfall') ?? '0');
setBrightness(qs.get('brightness') ?? '100');

window.addEventListener('resize', () => {
	setRainViewBoxFromSvg();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity);
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
    if (e.data.type === 'macs:brightness') {
        setBrightness(e.data.brightness ?? '100');
        return;
    }
});


debug("Macs Moods Loaded");
