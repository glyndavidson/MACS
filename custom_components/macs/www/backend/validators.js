/**
 * Shared helpers for normalising values and safely handling URLs
 */

import {DEFAULTS, DEFAULT_MAX_TEMP_C, DEFAULT_MIN_TEMP_C, DEFAULT_MAX_WIND_MPH, DEFAULT_MIN_WIND_MPH, DEFAULT_MAX_RAIN_MM, DEFAULT_MIN_RAIN_MM, TEMPERATURE_UNIT_ITEMS, WIND_UNIT_ITEMS, PRECIPITATION_UNIT_ITEMS, BATTERY_CHARGE_UNIT_ITEMS, VERSION, rootUrl} from "../shared/constants.js";



// ###################################################################################################################//
//                                                                                                                    //
//                                              URLS                                                                  //
//                                                                                                                    //
// ###################################################################################################################//

export function safeUrl(baseUrl) {
    return new URL(baseUrl || DEFAULTS.url, window.location.origin);
}
export function getTargetOrigin(absoluteUrlString) {
    try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
}
export function getValidUrl(path, params = null) {
    const url = new URL(path, rootUrl);
    const search = new URLSearchParams();
    if (VERSION && VERSION !== "Unknown") {
        search.set("v", VERSION);
    }
    if (params instanceof URLSearchParams) {
        params.forEach((value, key) => {
            if (value !== null && typeof value !== "undefined") {
                search.set(key, value.toString());
            }
        });
    } else if (typeof params === "string") {
        const cleaned = params.startsWith("?") ? params.slice(1) : params;
        const extra = new URLSearchParams(cleaned);
        extra.forEach((value, key) => {
            if (value !== null && typeof value !== "undefined") {
                search.set(key, value.toString());
            }
        });
    } else if (params && typeof params === "object") {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && typeof value !== "undefined") {
                search.set(key, value.toString());
            }
        });
    }
    const query = search.toString();
    if (query) {
        url.search = query;
    }
    return url.toString();
}


// ###################################################################################################################//
//                                                                                                                    //
//                                              MOODS                                                                 //
//                                                                                                                    //
// ###################################################################################################################//

// normalize mood string
export function normMood(v) {
    return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
}

// map assistant state to mood
export function assistStateToMood(state) {
    state = (state || "").toString().trim().toLowerCase();
    if (state === "listening") return "listening";
    if (state === "thinking") return "thinking";
    if (state === "processing") return "thinking";
    if (state === "responding") return "thinking";
    if (state === "speaking") return "thinking";
    if (state === "idle") return "idle";
    return "idle";
}

// ###################################################################################################################//
//                                                                                                                    //
//                                              BRIGHTNESS                                                            //
//                                                                                                                    //
// ###################################################################################################################//

export function normBrightness(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 100;
    return Math.max(0, Math.min(100, n));
}




// ###################################################################################################################//
//                                                                                                                    //
//                                              WEATHER                                                               //
//                                                                                                                    //
// ###################################################################################################################//

// Weather Unit Conversters
export function celsiusToFahrenheit(celsius) {
    return celsius * 1.8 + 32;
}
export function convertMphToKph(mph){
    return mph * 1.609344;
}
export function convertMphToMetersPerSecond(mph){
    return mph * 0.44704;
}
export function convertMphToKnots(mph){
    return mph * 0.8689762419;
}
export function convertMmToInches(mm){ 
    return mm * 0.0393700787;
}

export function toNumberOrNull(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return toNumber(value);
}

export function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function normalizeUnit(kind, value) {
    const k = (kind || "").toString().trim().toLowerCase();
    if (k === "temp") return normalizeUnitFromItems(value, TEMPERATURE_UNIT_ITEMS, "c");
    if (k === "wind") return normalizeUnitFromItems(value, WIND_UNIT_ITEMS, "mph");
    if (k === "rain") return normalizeUnitFromItems(value, PRECIPITATION_UNIT_ITEMS, "mm");
    if (k === "battery") return normalizeUnitFromItems(value, BATTERY_CHARGE_UNIT_ITEMS, "%");
    return "";
}

function normalizeUnitFromItems(value, items, fallback) {
    const token = (value || "").toString().trim().toLowerCase();
    if (!token || token === "auto") return "";
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item) continue;
        const id = (item.id || "").toString().trim().toLowerCase();
        if (!id) continue;
        if (token === id) return item.id;
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        for (let j = 0; j < aliases.length; j++) {
            const alias = (aliases[j] || "").toString().trim().toLowerCase();
            if (!alias) continue;
            if (token === alias) return item.id;
        }
    }
    return fallback || "";
}


export function normalizeRange(value, minValue, maxValue) {
    if (!Number.isFinite(value) || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) return null;
    if (minValue === maxValue) return 0;
    const min = Math.min(minValue, maxValue);
    const max = Math.max(minValue, maxValue);
    const clamped = Math.max(min, Math.min(max, value));
    return ((clamped - min) / (max - min)) * 100;
}

export function roundToTwoDecimals(value) {
    if (!Number.isFinite(value)) return value;
    return Math.round(value * 100) / 100;
}

export function getDefaultTempRange(unit) {
    if (unit === "f") {
        return {
            min: celsiusToFahrenheit(DEFAULT_MIN_TEMP_C),
            max: celsiusToFahrenheit(DEFAULT_MAX_TEMP_C),
        };
    }
    return { min: DEFAULT_MIN_TEMP_C, max: DEFAULT_MAX_TEMP_C };
}

export function getDefaultWindRange(unit) {
    if (unit === "kph" || unit === "km/h") {
        return {
            min: convertMphToKph(DEFAULT_MIN_WIND_MPH),
            max: convertMphToKph(DEFAULT_MAX_WIND_MPH),
        };
    }
    if (unit === "mps" || unit === "m/s") {
        return {
            min: convertMphToMetersPerSecond(DEFAULT_MIN_WIND_MPH),
            max: convertMphToMetersPerSecond(DEFAULT_MAX_WIND_MPH),
        };
    }
    if (unit === "knots" || unit === "kn") {
        return {
            min: convertMphToKnots(DEFAULT_MIN_WIND_MPH),
            max: convertMphToKnots(DEFAULT_MAX_WIND_MPH),
        };
    }
    return { min: DEFAULT_MIN_WIND_MPH, max: DEFAULT_MAX_WIND_MPH };
}

export function getDefaultRainRange(unit) {
    if (unit === "in") {
        return {
            min: convertMmToInches(DEFAULT_MIN_RAIN_MM),
            max: convertMmToInches(DEFAULT_MAX_RAIN_MM),
        };
    }
    if (unit === "%") {
        return { min: 0, max: 100 };
    }
    return { min: DEFAULT_MIN_RAIN_MM, max: DEFAULT_MAX_RAIN_MM };
}

export function getDefaultBatteryRange(unit) {
    if (unit === "v") {
        return { min: 0, max: 100 };
    }
    return { min: 0, max: 100 };
}

export function normalizeTemperatureValue(value, unit, minValue, maxValue) {
    const normalizedUnit = normalizeUnit("temp", unit);
    const defaults = getDefaultTempRange(normalizedUnit);
    const min = toNumberOrNull(minValue);
    const max = toNumberOrNull(maxValue);
    const effectiveMin = Number.isFinite(min) ? min : defaults.min;
    const effectiveMax = Number.isFinite(max) ? max : defaults.max;
    const v = toNumber(value);
    return roundToTwoDecimals(normalizeRange(v, effectiveMin, effectiveMax));
}

export function normalizeWindValue(value, unit, minValue, maxValue) {
    const normalizedUnit = normalizeUnit("wind", unit);
    const defaults = getDefaultWindRange(normalizedUnit);
    const min = toNumberOrNull(minValue);
    const max = toNumberOrNull(maxValue);
    const effectiveMin = Number.isFinite(min) ? min : defaults.min;
    const effectiveMax = Number.isFinite(max) ? max : defaults.max;
    const v = toNumber(value);
    return roundToTwoDecimals(normalizeRange(v, effectiveMin, effectiveMax));
}

export function normalizeRainValue(value, unit, minValue, maxValue) {
    const normalizedUnit = normalizeUnit("rain", unit);
    const defaults = getDefaultRainRange(normalizedUnit);
    const min = toNumberOrNull(minValue);
    const max = toNumberOrNull(maxValue);
    const effectiveMin = Number.isFinite(min) ? min : defaults.min;
    const effectiveMax = Number.isFinite(max) ? max : defaults.max;
    const v = toNumber(value);
    return roundToTwoDecimals(normalizeRange(v, effectiveMin, effectiveMax));
}

export function normalizeBatteryValue(value, unit, minValue, maxValue) {
    const normalizedUnit = normalizeUnit("battery", unit);
    const defaults = getDefaultBatteryRange(normalizedUnit);
    const min = toNumberOrNull(minValue);
    const max = toNumberOrNull(maxValue);
    const effectiveMin = Number.isFinite(min) ? min : defaults.min;
    const effectiveMax = Number.isFinite(max) ? max : defaults.max;
    const v = toNumber(value);
    return normalizeRange(v, effectiveMin, effectiveMax);
}
