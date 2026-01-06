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

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

const toIntensity = (value, fallback = 0) => clampPercent(value, fallback) / 100;

export function createWeatherFx({ debug, getIsPaused, onWindChange } = {}) {
	const log = typeof debug === "function" ? debug : () => {};
	const isPaused = typeof getIsPaused === "function" ? getIsPaused : () => false;
	const notifyWind = typeof onWindChange === "function" ? onWindChange : null;

	let rainIntensity = -1;
	let rainViewWidth = 1000;
	let rainViewHeight = 1000;
	let windIntensity = 0;
	let snowIntensity = -1;
	let basePrecipIntensity = 0;
	let weatherConditions = {};

	let rainParticles = null;
	let snowParticles = null;
	let leafParticles = null;

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
		if (isPaused()) return;
		setRainViewBoxFromSvg();
		if (!rainParticles) return;
		rainParticles.update(intensity, forceUpdate);
	};

	const updateSnowFlakes = (intensity, forceUpdate = false) => {
		if (isPaused()) return;
		setRainViewBoxFromSvg();
		if (!snowParticles) return;
		snowParticles.update(intensity, forceUpdate);
	};

	const updateLeaves = (forceUpdate = false) => {
		if (isPaused()) return;
		setRainViewBoxFromSvg();
		if (!leafParticles) return;
		leafParticles.updateFromEnvironment({
			windIntensity,
			rainIntensity,
			snowIntensity,
			forceUpdate
		});
	};

	const setTemperature = (value) => {
		const percent = clampPercent(value, 0);
		const intensity = percent / 100;
		document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
		const body = document.body;
		if (body) {
			body.classList.toggle("temp-icicles", percent >= 0 && percent <= 5);
			body.classList.toggle("temp-scarf", percent >= 0 && percent <= 10);
		}
	};

	const setWindSpeed = (value) => {
		const intensity = toIntensity(value);
		document.documentElement.style.setProperty('--windspeed-intensity', intensity.toString());
		windIntensity = intensity;
		if (rainParticles) rainParticles.setWindIntensity(intensity);
		if (snowParticles) snowParticles.setWindIntensity(intensity);
		if (leafParticles) leafParticles.setWindIntensity(intensity);
		const tilt = Math.pow(intensity, WIND_TILT_EXPONENT) * -WIND_TILT_MAX;
		document.documentElement.style.setProperty('--wind-tilt', `${tilt.toFixed(1)}deg`);
		if (notifyWind) notifyWind(intensity);
		updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity, true);
		updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity, true);
		updateLeaves(true);
	};

	const setPrecipitation = (value) => {
		basePrecipIntensity = toIntensity(value);
		applyPrecipitation();
	};

	const setWeatherConditions = (conditions) => {
		weatherConditions = (conditions && typeof conditions === "object") ? conditions : {};
		const body = document.body;
		if (!body) return;
		[...body.classList].forEach(c => {
			if (c.indexOf("weather-") === 0) body.classList.remove(c);
		});
		Object.keys(weatherConditions).forEach(key => {
			if (weatherConditions[key]) body.classList.add(`weather-${key}`);
		});
		log(`Setting weather conditions to:\n${JSON.stringify(weatherConditions, null, 2)}`);
		applyPrecipitation();
	};

	const refresh = (forceUpdate = false) => {
		updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity, forceUpdate);
		updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity, forceUpdate);
		updateLeaves(forceUpdate);
	};

	const reset = () => {
		if (rainParticles) rainParticles.reset();
		if (snowParticles) snowParticles.reset();
		if (leafParticles) leafParticles.reset();
	};

	const handleResize = () => {
		refresh(true);
	};

	return {
		setTemperature,
		setWindSpeed,
		setPrecipitation,
		setWeatherConditions,
		refresh,
		reset,
		handleResize,
	};
}
