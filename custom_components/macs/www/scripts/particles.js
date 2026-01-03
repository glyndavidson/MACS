const clamp01 = (value) => Math.max(0, Math.min(1, value));
const shuffle = (items) => {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
};

export class ParticleSystem {
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

	update(intensity, forceUpdate = false) {
		if (!this.container) return;
		const raw = Number(intensity);
		const normalized = Number.isFinite(raw) ? clamp01(raw) : 0;
		const targetCount = Math.ceil(normalized * this.maxCount);

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
