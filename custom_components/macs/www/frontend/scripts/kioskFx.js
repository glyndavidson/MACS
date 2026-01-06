/**
 * Kiosk FX
 * --------
 * Manages auto-brightness, sleep timers, and kiosk gestures.
 */
const KIOSK_HOLD_MS = 800;
const BRIGHTNESS_FADE_SECONDS = 10;

export function createKioskFx({
	debug,
	isEditor,
	messagePoster,
	setAnimationsPaused
} = {}) {
	const log = typeof debug === "function" ? debug : () => {};
	const getIsEditor = typeof isEditor === "function" ? isEditor : () => false;
	const applyAnimationsPaused = typeof setAnimationsPaused === "function" ? setAnimationsPaused : () => {};
	const poster = messagePoster || null;

	let autoBrightnessEnabled = false;
	let autoBrightnessTimeoutMs = 0;
	let autoBrightnessMin = 0;
	let autoBrightnessMax = 100;
	let autoBrightnessPauseAnimations = true;
	let autoBrightnessTimer = null;
	let autoBrightnessFadeTimer = null;
	let autoBrightnessIdle = false;
	let autoBrightnessAsleep = false;
	let autoBrightnessNextSleepAt = null;
	let autoBrightnessDebugTimer = null;
	let autoBrightnessConfigApplied = false;
	let animationsToggleEnabled = true;
	let baseBrightness = 100;
	let brightnessFrame = null;
	let lastBrightnessTarget = null;
	let lastBrightnessTransition = null;
	let kioskHoldTimer = null;

	const clampPercent = (value, fallback = 0) => {
		const num = Number(value);
		if (!Number.isFinite(num)) return fallback;
		if (num < 0) return 0;
		if (num > 100) return 100;
		return num;
	};

	const clampRange = (value, min, max) => Math.min(max, Math.max(min, value));

	const setBrightnessTransition = (seconds) => {
		const duration = Number.isFinite(seconds) ? seconds : 0;
		document.documentElement.style.setProperty('--brightness-transition', `${duration}s`);
		if (document.body) {
			document.body.style.transition = `opacity ${duration}s linear`;
		}
	};

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

	const applyAnimationsToggle = () => {
		if (autoBrightnessEnabled) {
			if (autoBrightnessAsleep) {
				applyAnimationsPaused(autoBrightnessPauseAnimations);
			} else {
				applyAnimationsPaused(false);
			}
			return;
		}
		applyAnimationsPaused(!animationsToggleEnabled);
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
			applyAnimationsPaused(autoBrightnessPauseAnimations);
		}, autoBrightnessTimeoutMs);
		updateAutoBrightnessDebug();
	};

	const registerActivity = () => {
		if (getIsEditor()) return false;
		if (!autoBrightnessEnabled) return false;

		if (autoBrightnessIdle) {
			autoBrightnessIdle = false;
			autoBrightnessAsleep = false;
			applyBrightness();
		}

		scheduleAutoBrightness();
		applyAnimationsToggle();
		return true;
	};

	const sendKioskToggle = () => {
		log("Kiosk hold: toggling sidebar/navbar");
		if (!poster) return;
		poster.post({ type: "macs:toggle_kiosk", recipient: "backend" });
	};

	const startKioskHold = () => {
		if (getIsEditor()) return;
		if (!autoBrightnessEnabled) return;
		log("Kiosk hold: start");
		if (kioskHoldTimer) clearTimeout(kioskHoldTimer);
		kioskHoldTimer = setTimeout(() => {
			kioskHoldTimer = null;
			sendKioskToggle();
		}, KIOSK_HOLD_MS);
	};

	const endKioskHold = () => {
		if (kioskHoldTimer) {
			log("Kiosk hold: cancel");
			clearTimeout(kioskHoldTimer);
			kioskHoldTimer = null;
		}
	};

	const initKioskHoldListeners = () => {
		if (getIsEditor()) return;
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

	const setAutoBrightnessConfig = (config) => {
		if (getIsEditor()) {
			autoBrightnessEnabled = false;
			autoBrightnessIdle = false;
			applyAnimationsPaused(false);
			updateAutoBrightnessDebug();
			return;
		}
		const nextEnabled = !!(config && config.auto_brightness_enabled);
		const timeoutFallback = autoBrightnessTimeoutMs ? (autoBrightnessTimeoutMs / 60000) : 0;
		const timeoutMinutes = Number.isFinite(Number(config?.auto_brightness_timeout_minutes))
			? Number(config?.auto_brightness_timeout_minutes)
			: timeoutFallback;
		const nextTimeoutMs = timeoutMinutes > 0 ? timeoutMinutes * 60 * 1000 : 0;
		const nextMin = Number.isFinite(Number(config?.auto_brightness_min))
			? Number(config?.auto_brightness_min)
			: autoBrightnessMin;
		const nextMax = Number.isFinite(Number(config?.auto_brightness_max))
			? Number(config?.auto_brightness_max)
			: autoBrightnessMax;
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
	};

	const setAnimationsToggleEnabled = (enabled) => {
		animationsToggleEnabled = !!enabled;
		applyAnimationsToggle();
	};

	const setBrightness = (value) => {
		const brightness = Number(value);
		if (!Number.isFinite(brightness)) return;
		if (brightness < 0 || brightness > 100) return;
		baseBrightness = brightness;
		applyBrightness();
	};

	return {
		setAutoBrightnessConfig,
		setAnimationsToggleEnabled,
		setBrightness,
		registerActivity,
		initKioskHoldListeners,
		ensureAutoBrightnessDebugTimer,
		updateAutoBrightnessDebug
	};
}
