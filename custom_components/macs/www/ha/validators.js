/**
 * Shared helpers for normalising values and safely handling URLs
 */

import {DEFAULTS} from "./constants.js";

// normalize mood string
export function normMood(v) {
    return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
}
export function normWeather(v) {
    return (typeof v === "string" ? v : "none").trim().toLowerCase() || "none";
}
export function normBrightness(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 100;
    return Math.max(0, Math.min(100, n));
}

export function safeUrl(baseUrl) {
    return new URL(baseUrl || DEFAULTS.url, window.location.origin);
}

export function getTargetOrigin(absoluteUrlString) {
    try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
}