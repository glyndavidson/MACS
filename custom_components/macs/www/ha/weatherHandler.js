import { normalizeTemperature, normalizeWind, normalizeRain } from "./validators.js";
import { createDebugger } from "./debugger.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("weatherHandler", DEBUG_ENABLED);

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeTempUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u.indexOf("f") !== -1) return "f";
    if (u.indexOf("c") !== -1) return "c";
    return "";
}

function normalizeWindUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u === "kph" || u === "km/h") return "kph";
    if (u === "mps" || u === "m/s") return "mps";
    if (u === "knots" || u === "kn" || u === "kt" || u === "kt/h") return "knots";
    if (u === "mph") return "mph";
    return "";
}

function normalizeRainUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u === "%" || u.indexOf("percent") !== -1) return "%";
    if (u === "in" || u === "inch" || u === "inches") return "in";
    if (u === "mm") return "mm";
    return "";
}

function normalizeUnit(kind, value) {
    if (kind === "temp") return normalizeTempUnitValue(value);
    if (kind === "wind") return normalizeWindUnitValue(value);
    if (kind === "rain") return normalizeRainUnitValue(value);
    return "";
}

export class WeatherHandler {
    constructor() {
        this._config = null;
        this._hass = null;
    }

    setConfig(config) {
        this._config = config || null;
    }

    setHass(hass) {
        this._hass = hass || null;
    }

    _readSensor(entityId) {
        if (!this._hass || !entityId) return null;
        const st = this._hass.states?.[entityId];
        if (!st) return null;
        return {
            value: toNumber(st.state),
            unit: (st.attributes?.unit_of_measurement || "").toString(),
        };
    }

    _resolveUnit(sensorUnit, configUnit, kind) {
        const cfg = normalizeUnit(kind, configUnit);
        if (cfg) return cfg;

        const su = normalizeUnit(kind, sensorUnit);
        if (su) return su;

        if (kind === "temp") {
            return "c";
        }
        if (kind === "wind") {
            return "mph";
        }
        if (kind === "rain") {
            return "mm";
        }
        return "";
    }

    _normalizeTemperature() {
        if (!this._config?.temperature_sensor_enabled) return null;
        const entityId = (this._config.temperature_sensor_entity || "").toString().trim();
        if (!entityId) return null;
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) return null;
        debug("temperature sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.temperature_unit, "temp");
        const normalized = normalizeTemperature(
            reading.value,
            unit,
            this._config.temperature_min,
            this._config.temperature_max
        );
        debug("temperature normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.temperature_min,
            max: this._config.temperature_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.temperature_min,
            max: this._config.temperature_max,
            normalized,
        };
    }

    _normalizeWind() {
        if (!this._config?.wind_sensor_enabled) return null;
        const entityId = (this._config.wind_sensor_entity || "").toString().trim();
        if (!entityId) return null;
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) return null;
        debug("wind sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.wind_unit, "wind");
        const normalized = normalizeWind(
            reading.value,
            unit,
            this._config.wind_min,
            this._config.wind_max
        );
        debug("wind normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.wind_min,
            max: this._config.wind_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.wind_min,
            max: this._config.wind_max,
            normalized,
        };
    }

    _normalizeRain() {
        if (!this._config?.precipitation_sensor_enabled) return null;
        const entityId = (this._config.precipitation_sensor_entity || "").toString().trim();
        if (!entityId) return null;
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) return null;
        debug("precipitation sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.precipitation_unit, "rain");
        const normalized = normalizeRain(
            reading.value,
            unit,
            this._config.precipitation_min,
            this._config.precipitation_max
        );
        debug("precipitation normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.precipitation_min,
            max: this._config.precipitation_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.precipitation_min,
            max: this._config.precipitation_max,
            normalized,
        };
    }

    getWeather() {
        debug("getWeather");
        return {
            temperature: this._normalizeTemperature(),
            wind: this._normalizeWind(),
            precipitation: this._normalizeRain(),
        };
    }

    dispose() {
        this._hass = null;
        this._config = null;
    }
}
