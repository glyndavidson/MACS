/**
 * Battery FX
 * ----------
 * Handles charging visuals and low-battery dimming.
 */
const LOW_BATTERY_CUTOFF = 20;

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

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

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

export function createBatteryFx() {
	let baseColors = null;
	let lastBatteryPercent = null;
	let batteryCharging = null;
	let batteryStateSensorEnabled = false;

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

	const setChargingActive = (active) => {
		const body = document.body;
		if (!body) return;
		body.classList.toggle("charging", !!active);
	};

	const isChargingVisualActive = () => {
		if (batteryCharging !== true) return false;
		if (!batteryStateSensorEnabled) return true;
		return Number.isFinite(lastBatteryPercent) && lastBatteryPercent <= LOW_BATTERY_CUTOFF;
	};

	const setBattery = (value) => {
		const percent = clampPercent(value, 0);
		const intensity = percent / 100;
		lastBatteryPercent = percent;
		document.documentElement.style.setProperty('--battery-intensity', intensity.toString());
		setChargingActive(isChargingVisualActive());
		applyBatteryDimming(percent);
	};

	const setBatteryState = (value) => {
		if (value === null || typeof value === "undefined") {
			batteryCharging = null;
			setChargingActive(false);
			applyBatteryDimming(lastBatteryPercent);
			return;
		}
		batteryCharging = !!value;
		setChargingActive(isChargingVisualActive());
		applyBatteryDimming(lastBatteryPercent);
	};

	const setBatteryStateSensorEnabled = (enabled) => {
		batteryStateSensorEnabled = !!enabled;
		setChargingActive(isChargingVisualActive());
		applyBatteryDimming(lastBatteryPercent);
	};

	return {
		setBattery,
		setBatteryState,
		setBatteryStateSensorEnabled
	};
}
