const CURSOR_LOOK_IDLE_MS = 5000;
const EYE_LOOK_MAX_X = 20;
const EYE_LOOK_MAX_Y = 12;
const STAGE_LOOK_MAX_X = 8;
const STAGE_LOOK_MAX_Y = 6;

export function createCursorFx() {
	let cursorLookTimer = null;
	let cursorLookActive = false;
	let idleActive = false;

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

	const applyActiveState = () => {
		const body = document.body;
		if (!body) return;
		const effectiveActive = cursorLookActive && idleActive;
		if (effectiveActive) {
			body.classList.add("cursor-look");
		} else {
			body.classList.remove("cursor-look");
			setStageLookOffset(0, 0);
		}
	};

	const setCursorLookActive = (active) => {
		cursorLookActive = !!active;
		applyActiveState();
	};

	const setIdleActive = (active) => {
		const next = !!active;
		if (idleActive === next) return;
		idleActive = next;
		if (!idleActive) {
			if (cursorLookTimer) {
				clearTimeout(cursorLookTimer);
				cursorLookTimer = null;
			}
			cursorLookActive = false;
		}
		applyActiveState();
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

	const reset = () => {
		if (cursorLookTimer) {
			clearTimeout(cursorLookTimer);
			cursorLookTimer = null;
		}
		cursorLookActive = false;
		setCursorLookActive(false);
	};

	return {
		handleCursorMove,
		setIdleActive,
		reset
	};
}
