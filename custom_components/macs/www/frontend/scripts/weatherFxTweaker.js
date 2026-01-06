export const RAIN_MAX_DROPS = 200;
export const RAIN_MIN_SPEED = 0.8;
export const RAIN_MAX_SPEED = 4;
export const RAIN_DROP_SIZE_MIN = 0.6;
export const RAIN_DROP_SIZE_MAX = 1.3;
export const RAIN_SIZE_VARIATION = 10;
export const RAIN_SIZE_SPEED_RANGE = 0.8;
export const RAIN_OPACITY_MIN = 0.2;
export const RAIN_OPACITY_MAX = 0.8;
export const RAIN_OPACITY_VARIATION = 8;
export const RAIN_COUNT_EXPONENT = 1.5; // > 1 = fewer drops at low precipitation, ramping up later. < 1 = more drops at low precipitation
export const RAIN_SPEED_JITTER_MIN = -0.2;
export const RAIN_SPEED_JITTER_MAX = 0.2;
export const RAIN_WIND_TILT_MAX = 89;
export const RAIN_TILT_VARIATION = 1;
export const RAIN_PATH_PADDING = 60;
export const RAIN_WIND_SPEED_MULTIPLIER = 1;
export const RAIN_SPAWN_OFFSET = 120;
export const RAIN_SPAWN_VARIATION = 1;
export const RAIN_START_DELAY_MAX = 2;

export const SNOW_MAX_FLAKES = 500;
export const SNOW_MIN_SPEED = 0.05;
export const SNOW_MAX_SPEED = 0.1;
export const SNOW_SIZE_MIN = 2;
export const SNOW_SIZE_MAX = 5;
export const SNOW_SIZE_VARIATION = 0.6;
export const SNOW_OPACITY_MIN = 0.1;
export const SNOW_OPACITY_MAX = 1;
export const SNOW_OPACITY_VARIATION = 0.8;
export const SNOW_MIN_DURATION = 6;
export const SNOW_SPEED_JITTER_MIN = -0.2;
export const SNOW_SPEED_JITTER_MAX = 0.2;
export const SNOW_WIND_TILT_MAX = 89;
export const SNOW_TILT_VARIATION = 15;
export const SNOW_PATH_PADDING = 80;
export const SNOW_WIND_SPEED_MULTIPLIER = 20;
export const SNOW_START_DELAY_RATIO = 1;


export const LEAF_MAX_COUNT = 20; 				// Maximum number of leaf particles when leaf intensity is 100%.
export const LEAF_MIN_SPEED = 0.5;				// Base minimum travel speed (slowest leaves at low wind).
export const LEAF_MAX_SPEED = 2;				// Base maximum travel speed (fastest leaves at high wind).
export const LEAF_WIND_EXPONENT = 0.5;			// Non‑linear curve for wind strength (lower = wind effect ramps faster at low wind).
export const LEAF_MIN_DURATION = 1;			// Minimum travel time (seconds) for a leaf at low wind; this fades toward 0 as wind increases.
export const LEAF_SPEED_JITTER_MIN = -0.15;	// Random speed jitter lower bound (negative slows some leaves).
export const LEAF_SPEED_JITTER_MAX = 0.15;		// Random speed jitter upper bound (positive speeds some leaves).
export const LEAF_START_STAGGER = 5;			// Base delay between leaf starts by slot (seconds).
export const LEAF_START_JITTER = 0.2;			// Extra random per‑leaf delay (seconds).
export const LEAF_RESPAWN_DELAY_MIN = 0.1;		// Minimum pause before a leaf re‑enters after finishing its path (seconds).
export const LEAF_RESPAWN_DELAY_JITTER = 0.8;	// 
export const LEAF_WIND_TILT_MAX = 89;			// Maximum tilt angle from wind (degrees, 89 ≈ nearly horizontal).
export const LEAF_TILT_VARIATION = 18;			// Random per‑leaf tilt variance (adds divergence so they don’t all travel parallel).
export const LEAF_SIZE_MIN = 100;				// Smallest leaf size in px.
export const LEAF_SIZE_MAX = 200;				// Largest leaf size in px.
export const LEAF_SIZE_VARIATION = 0.5;		// Random size spread around the intensity value (0 = no variation, higher = more variance)
export const LEAF_SPAWN_OFFSET = 300;			// How far beyond the entry edge leaves spawn (off‑screen).
export const LEAF_SPAWN_VARIATION = 1.4;		// Random multiplier for spawn offset (more variation = more staggered start distances).
export const LEAF_PATH_PADDING = 140;			// Extra off‑screen padding for path calculations (bigger = longer travel off‑screen).
export const LEAF_OPACITY_MIN = 1;				// Minimum opacity per leaf.
export const LEAF_OPACITY_MAX = 1;				// Maximum opacity per leaf.
export const LEAF_OPACITY_VARIATION = 0;		// Random opacity spread around the intensity value.
export const LEAF_SPIN_MIN = 120;				// 
export const LEAF_SPIN_MAX = 120;				// 
export const LEAF_VARIANTS = 10;				// 
export const LEAF_IMAGE_BASE = "frontend/images/weather/leaves/leaf_";


export const WIND_TILT_MAX = 25;
export const WIND_TILT_EXPONENT = 2.2;

