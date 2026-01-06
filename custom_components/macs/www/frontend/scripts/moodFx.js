const MOODS = ['bored','confused','happy','idle','listening','sad','sleeping','surprised','thinking'];
const MOOD_IDLE_TO_BORED_MS = 30000;
const MOOD_BORED_TO_SLEEP_MS = 30000;

export function createMoodFx({ isEditor, onMoodChange } = {}) {
	const getIsEditor = typeof isEditor === "function" ? isEditor : () => false;
	const notifyMoodChange = typeof onMoodChange === "function" ? onMoodChange : () => {};

	let baseMood = "idle";
	let idleSequenceEnabled = false;
	let moodIdleTimer = null;
	let moodBoredTimer = null;

	const applyBodyClass = (prefix, value, allowed, fallback) => {
		if (!document.body) return;
		[...document.body.classList].forEach(c => {
			if (c.startsWith(prefix + '-')) document.body.classList.remove(c);
		});

		const v = (value ?? '').toString().trim().toLowerCase();
		const isValid = typeof allowed === 'function' ? allowed(v) : allowed.includes(v);
		const next = isValid ? v : fallback;
		document.body.classList.add(prefix + '-' + next);
		notifyMoodChange(next);
	};

	const setMood = (value) => {
		applyBodyClass('mood', value, MOODS, 'idle');
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
		if (getIsEditor() || !idleSequenceEnabled) return;
		moodIdleTimer = setTimeout(() => {
			if (baseMood !== "idle") return;
			setMood("bored");
			moodBoredTimer = setTimeout(() => {
				if (baseMood !== "idle") return;
				setMood("sleeping");
			}, MOOD_BORED_TO_SLEEP_MS);
		}, MOOD_IDLE_TO_BORED_MS);
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

	const setBaseMood = (nextMood) => {
		const value = (nextMood ?? "idle").toString().trim().toLowerCase();
		baseMood = MOODS.includes(value) ? value : "idle";
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

	return {
		setBaseMood,
		setIdleSequenceEnabled,
		resetMoodSequence
	};
}
