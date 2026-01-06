const SVG_NS = "http://www.w3.org/2000/svg";
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const shuffle = (items) => {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
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

const getPathForSlot = (slotIndex, targetCount, tiltDeg, rect, viewWidth, viewHeight) => {
	const slot = Number.isFinite(slotIndex) ? slotIndex : Math.floor(Math.random() * Math.max(1, targetCount));
	const tiltRad = tiltDeg * (Math.PI / 180);
	const dir = { x: Math.sin(tiltRad), y: Math.cos(tiltRad) };
	const perp = { x: -dir.y, y: dir.x };
	const maxOffset = (Math.abs(perp.x) * viewWidth + Math.abs(perp.y) * viewHeight) / 2;
	const offset = (((slot + Math.random()) / Math.max(1, targetCount)) - 0.5) * 2 * maxOffset;
	const center = { x: viewWidth / 2, y: viewHeight / 2 };
	const point = { x: center.x + (perp.x * offset), y: center.y + (perp.y * offset) };
	const segment = getLineRectIntersections(point, dir, rect);
	const start = segment?.start ?? { x: center.x, y: rect.yMin };
	const end = segment?.end ?? { x: center.x, y: rect.yMax };

	return { slot, dir, start, end };
};

class ParticleSystem {
	constructor({ container, maxCount, createParticle, buildConfig }) {
		this.container = container;
		this.maxCount = maxCount;
		this.createParticle = createParticle;
		this.buildConfig = buildConfig;
		this.animations = new WeakMap();
		this.count = -1;
		this.intensity = -1;
		this.normalized = 0;
		this.targetCount = 0;
	}

	stopAnimation(particle) {
		const anim = this.animations.get(particle);
		if (!anim) return;
		anim.onfinish = null;
		anim.cancel();
		this.animations.delete(particle);
	}

	startAnimation(particle, slot) {
		this.stopAnimation(particle);
		const config = this.buildConfig({
			particle,
			slot,
			normalized: this.normalized,
			targetCount: this.targetCount
		});
		if (!config) return;

		const anim = particle.animate(config.keyframes, {
			duration: config.duration,
			delay: config.delay ?? 0,
			easing: config.easing ?? "linear",
			fill: config.fill ?? "backwards",
			iterations: 1
		});
		this.animations.set(particle, anim);
		const nextSlot = Number.isFinite(config.slot) ? config.slot : slot;
		anim.onfinish = () => this.startAnimation(particle, nextSlot);
	}

	update(intensity, forceUpdate = false, countNormalized = null) {
		if (!this.container) return;
		const raw = Number(intensity);
		const normalized = Number.isFinite(raw) ? clamp01(raw) : 0;
		const countValue = Number.isFinite(countNormalized) ? clamp01(countNormalized) : normalized;
		const targetCount = Math.ceil(countValue * this.maxCount);

		this.normalized = normalized;
		this.targetCount = targetCount;

		if (targetCount === this.count && normalized === this.intensity) {
			if (forceUpdate) {
				[...this.container.children].forEach((particle) => {
					const slot = Number(particle.dataset.slot);
					this.startAnimation(particle, Number.isFinite(slot) ? slot : undefined);
				});
			}
			return;
		}

		this.count = targetCount;
		this.intensity = normalized;

		[...this.container.children].forEach((particle) => this.stopAnimation(particle));
		this.container.replaceChildren();

		if (targetCount === 0) return;
		const slots = shuffle([...Array(targetCount).keys()]);
		for (let i = 0; i < targetCount; i += 1) {
			const particle = this.createParticle();
			this.container.appendChild(particle);
			this.startAnimation(particle, slots[i]);
		}
	}

	reset() {
		if (!this.container) return;
		[...this.container.children].forEach((particle) => this.stopAnimation(particle));
		this.container.replaceChildren();
		this.count = -1;
		this.intensity = -1;
		this.normalized = 0;
		this.targetCount = 0;
	}
}

export class Particle {
	constructor(typeOrOptions, options = {}) {
		const config = typeof typeOrOptions === "string"
			? { ...options, type: typeOrOptions }
			: (typeOrOptions ?? {});

		this.type = config.type ?? "generic";
		this.container = config.container ?? null;
		this.maxCount = config.maxCount ?? 0;
		this.element = config.element ?? {};
		this.size = config.size ?? {};
		this.opacity = config.opacity ?? {};
		this.speed = config.speed ?? {};
		this.wind = config.wind ?? {};
		this.path = config.path ?? {};
		this.spin = config.spin ?? {};
		this.images = config.images ?? {};
		this.delay = config.delay ?? {};
		this.thresholds = config.thresholds ?? null;
		this.setIntensityVar = config.setIntensityVar ?? null;
		this.countExponent = config.countExponent ?? 1;
		this.viewWidth = config.viewWidth ?? 1000;
		this.viewHeight = config.viewHeight ?? 1000;
		this.windIntensity = 0;

		this.system = new ParticleSystem({
			container: this.container,
			maxCount: this.maxCount,
			createParticle: this.createParticle.bind(this),
			buildConfig: this.buildConfig.bind(this)
		});
	}

	setViewSize(width, height) {
		this.viewWidth = width;
		this.viewHeight = height;
	}

	setWindIntensity(value) {
		this.windIntensity = Number.isFinite(value) ? value : 0;
	}

	update(intensity, forceUpdate = false) {
		const raw = Number(intensity);
		const normalized = Number.isFinite(raw) ? clamp01(raw) : 0;
		const countNormalized = Math.pow(normalized, this.countExponent);
		this.system.update(normalized, forceUpdate, countNormalized);
	}

	updateFromEnvironment({ windIntensity = 0, rainIntensity = 0, snowIntensity = 0, forceUpdate = false } = {}) {
		this.setWindIntensity(windIntensity);
		const intensity = this.getIntensityFromEnvironment({ windIntensity, rainIntensity, snowIntensity });
		if (this.setIntensityVar) {
			this.setIntensityVar(intensity);
		}
		this.update(intensity, forceUpdate);
		return intensity;
	}

	reset() {
		this.system.reset();
	}

	createParticle() {
		const tag = this.element.tag ?? "div";
		const namespace = this.element.namespace ?? null;
		const particle = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag);
		const className = this.element.className ?? "";
		if (className) {
			if (namespace) {
				particle.setAttribute("class", className);
			} else {
				particle.className = className;
			}
		}
		const attributes = this.element.attributes ?? {};
		Object.entries(attributes).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				particle.setAttribute(key, value);
			}
		});
		const props = this.element.props ?? {};
		Object.entries(props).forEach(([key, value]) => {
			particle[key] = value;
		});
		return particle;
	}

	getIntensityFromEnvironment({ windIntensity = 0, rainIntensity = 0, snowIntensity = 0 } = {}) {
		if (!this.thresholds) return clamp01(windIntensity);
		const windMin = this.thresholds.windMin ?? 0.1;
		const precipMax = this.thresholds.precipMax ?? 0.1;
		const rain = rainIntensity > 0 ? rainIntensity : 0;
		const snow = snowIntensity > 0 ? snowIntensity : 0;
		const precip = clamp01(rain + snow);
		if (windIntensity <= windMin || precip >= precipMax) return 0;
		const windFactor = (windIntensity - windMin) / Math.max(0.001, 1 - windMin);
		const precipFactor = clamp01(1 - (precip / precipMax));
		return clamp01(windFactor * precipFactor);
	}

	buildConfig({ particle, slot, normalized, targetCount }) {
		const resolvedSlot = Number.isFinite(slot) ? slot : Math.floor(Math.random() * Math.max(1, targetCount));
		const sizeRange = Math.max(0.001, (this.size.max ?? 1) - (this.size.min ?? 0));
		const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * (this.size.variation ?? 0));
		const size = (this.size.min ?? 0) + (sizeBias * sizeRange);
		const opacityRange = Math.max(0.001, (this.opacity.max ?? 1) - (this.opacity.min ?? 0));
		const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * (this.opacity.variation ?? 0));
		const baseOpacity = (this.opacity.min ?? 0) + (opacityBias * opacityRange);
		const divergence = (Math.random() * 2) - 1;
		const windExponent = this.wind.exponent ?? 1;
		const windFactor = Math.pow(this.windIntensity, windExponent);
		const tiltDeg = (windFactor * (this.wind.tiltMax ?? 0)) + (divergence * (this.wind.tiltVariation ?? 0));
		const tiltCss = -tiltDeg;
		const rect = {
			xMin: -(this.path.padding ?? 0),
			xMax: this.viewWidth + (this.path.padding ?? 0),
			yMin: -(this.path.padding ?? 0),
			yMax: this.viewHeight + (this.path.padding ?? 0)
		};
		const { dir, start, end } = getPathForSlot(resolvedSlot, targetCount, tiltDeg, rect, this.viewWidth, this.viewHeight);
		const spawnBase = this.path.spawnOffset ?? 0;
		const spawnVariation = this.path.spawnVariation ?? 0;
		const spawnOffset = spawnBase === 0 ? 0 : spawnBase * (0.5 + (Math.random() * spawnVariation));
		const startOut = { x: start.x - (dir.x * spawnOffset), y: start.y - (dir.y * spawnOffset) };
		const endOut = { x: end.x + (dir.x * spawnOffset), y: end.y + (dir.y * spawnOffset) };
		const pathLength = Math.hypot(endOut.x - startOut.x, endOut.y - startOut.y);
		const refDistance = Math.max(1, rect.yMax - rect.yMin);
		let spinStart = 0;
		let spinEnd = 0;
		if (this.type === "leaf") {
			const spinAmount = ((this.spin.min ?? 0) + (Math.random() * ((this.spin.max ?? 0) - (this.spin.min ?? 0))))
				* (Math.random() < 0.5 ? -1 : 1);
			spinStart = Math.random() * 360;
			spinEnd = spinStart + spinAmount;
		}

		const durationSeconds = this.getDuration({
			normalized,
			size,
			sizeRange,
			pathLength,
			refDistance,
			windFactor
		});

		this.applyParticleAppearance(particle, {
			resolvedSlot,
			size,
			baseOpacity,
			pathLength
		});

		return {
			slot: resolvedSlot,
			keyframes: [
				{ transform: `translate(${startOut.x.toFixed(1)}px, ${startOut.y.toFixed(1)}px) rotate(${(tiltCss + spinStart).toFixed(2)}deg)` },
				{ transform: `translate(${endOut.x.toFixed(1)}px, ${endOut.y.toFixed(1)}px) rotate(${(tiltCss + spinEnd).toFixed(2)}deg)` }
			],
			duration: durationSeconds * 1000,
			delay: this.getDelay({ resolvedSlot, durationSeconds })
		};
	}

	getDuration({ normalized, size, sizeRange, pathLength, refDistance, windFactor }) {
		if (this.type === "rain") {
			const windBoost = 1 + (this.windIntensity * (this.speed.windMultiplier ?? 0));
			const baseSpeed = ((this.speed.min ?? 0) + (((this.speed.max ?? 0) - (this.speed.min ?? 0)) * normalized))
				* windBoost;
			const jitter = (this.speed.jitterMin ?? 0) + (Math.random() * ((this.speed.jitterMax ?? 0) - (this.speed.jitterMin ?? 0)));
			const sizeFactor = clamp01((size - (this.size.min ?? 0)) / sizeRange);
			const speedFactor = 1 + ((sizeFactor - 0.5) * (this.speed.sizeRange ?? 0));
			const unclamped = baseSpeed * speedFactor * (1 + jitter);
			const maxSpeed = (this.speed.max ?? unclamped) * windBoost;
			const minSpeed = this.speed.min ?? 0;
			const speed = Math.min(maxSpeed, Math.max(minSpeed, unclamped));
			const distanceRatio = pathLength / refDistance;
			return Math.max(0.1, distanceRatio / speed);
		}

		if (this.type === "snow") {
			const windMultiplier = 1 + (this.windIntensity * (this.speed.windMultiplier ?? 0));
			const jitter = (this.speed.jitterMin ?? 0) + (Math.random() * ((this.speed.jitterMax ?? 0) - (this.speed.jitterMin ?? 0)));
			const sizeFactor = clamp01((size - (this.size.min ?? 0)) / sizeRange);
			const speedBias = clamp01(sizeFactor + jitter);
			const baseSpeed = (this.speed.min ?? 0) + (speedBias * ((this.speed.max ?? 0) - (this.speed.min ?? 0)));
			const unclamped = baseSpeed * windMultiplier;
			const maxSpeed = (this.speed.max ?? unclamped) * windMultiplier;
			const minSpeed = this.speed.min ?? 0;
			const speed = Math.min(maxSpeed, Math.max(minSpeed, unclamped));
			const distanceRatio = pathLength / refDistance;
			const minDuration = (this.speed.minDuration ?? 0) * (1 - this.windIntensity) * distanceRatio;
			return Math.max(minDuration, distanceRatio / speed);
		}

		if (this.type === "leaf") {
			const jitter = (this.speed.jitterMin ?? 0) + (Math.random() * ((this.speed.jitterMax ?? 0) - (this.speed.jitterMin ?? 0)));
			const sizeFactor = clamp01((size - (this.size.min ?? 0)) / sizeRange);
			const sizeBase = this.speed.sizeBase ?? 0.85;
			const sizeScale = this.speed.sizeScale ?? 0.4;
			const speedFactor = sizeBase + (sizeFactor * sizeScale);
			const baseSpeed = (this.speed.min ?? 0) + (windFactor * ((this.speed.max ?? 0) - (this.speed.min ?? 0)));
			const speed = Math.max(this.speed.min ?? 0, baseSpeed * speedFactor * (1 + jitter));
			const distanceRatio = pathLength / refDistance;
			const minDuration = (this.speed.minDuration ?? 0) * (1 - windFactor) * distanceRatio;
			return Math.max(minDuration, distanceRatio / speed);
		}

		const distanceRatio = pathLength / refDistance;
		const speed = this.speed.max ?? 1;
		return Math.max(0.1, distanceRatio / Math.max(0.01, speed));
	}

	applyParticleAppearance(particle, { resolvedSlot, size, baseOpacity, pathLength }) {
		if (this.type === "rain") {
			const rx = 1 + (size * 0.5);
			const ry = 12 + (size * 18);
			particle.setAttribute("rx", rx.toFixed(2));
			particle.setAttribute("ry", ry.toFixed(2));
			particle.setAttribute("cx", "0");
			particle.setAttribute("cy", "0");
			particle.style.opacity = Math.min(this.opacity.max ?? 1, baseOpacity * (0.7 + (size * 0.3))).toFixed(2);
		} else if (this.type === "snow") {
			particle.setAttribute("r", size.toFixed(2));
			particle.setAttribute("cx", "0");
			particle.setAttribute("cy", "0");
			particle.style.opacity = Math.min(this.opacity.max ?? 1, baseOpacity).toFixed(2);
		} else if (this.type === "leaf") {
			const variants = this.images.variants ?? 1;
			const leafIndex = Math.floor(Math.random() * variants);
			const basePath = this.images.basePath ?? "";
			particle.src = `${basePath}${leafIndex}.png`;
			particle.style.width = `${size.toFixed(1)}px`;
			particle.style.height = `${size.toFixed(1)}px`;
			particle.style.opacity = Math.min(this.opacity.max ?? 1, baseOpacity).toFixed(2);
		}

		particle.dataset.slot = resolvedSlot.toString();
		particle.dataset.pathLength = pathLength.toFixed(1);
	}

	getDelay({ resolvedSlot, durationSeconds }) {
		if (this.type === "rain") {
			return Math.random() * (this.delay.startDelayMax ?? 0) * 1000;
		}

		if (this.type === "snow") {
			return Math.random() * durationSeconds * (this.delay.startDelayRatio ?? 0) * 1000;
		}

		if (this.type === "leaf") {
			const respawnDelay = (this.delay.respawnMin ?? 0) + (Math.random() * (this.delay.respawnJitter ?? 0));
			const startJitter = Math.random() * (this.delay.startJitter ?? 0);
			const startStagger = (this.delay.startStagger ?? 0) + (this.delay.startJitter ?? 0);
			return (resolvedSlot * startStagger + startJitter + respawnDelay) * 1000;
		}

		return 0;
	}
}

export { SVG_NS };
