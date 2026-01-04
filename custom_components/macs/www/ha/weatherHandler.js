import { TEMPERATURE_ENTITY_ID, WIND_ENTITY_ID, PRECIPITATION_ENTITY_ID, BATTERY_CHARGE_ENTITY_ID } from "./constants.js";
import { toNumber, normalizeTemperatureValue, normalizeWindValue, normalizeRainValue, normalizeBatteryValue, normalizeWeatherUnit, normalizeBatteryUnit } from "./validators.js";
import { createDebugger } from "./debugger.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("weatherHandler", DEBUG_ENABLED);

const CONDITION_KEYS = [
    "snowy",
    "cloudy",
    "rainy",
    "windy",
    "sunny",
    "stormy",
    "foggy",
    "hail",
    "lightning",
    "partlycloudy",
    "pouring",
    "clear_night",
    "exceptional",
];

const CONDITION_ENTITY_IDS = {
    snowy: "switch.macs_weather_conditions_snowy",
    cloudy: "switch.macs_weather_conditions_cloudy",
    rainy: "switch.macs_weather_conditions_rainy",
    windy: "switch.macs_weather_conditions_windy",
    sunny: "switch.macs_weather_conditions_sunny",
    stormy: "switch.macs_weather_conditions_stormy",
    foggy: "switch.macs_weather_conditions_foggy",
    hail: "switch.macs_weather_conditions_hail",
    lightning: "switch.macs_weather_conditions_lightning",
    partlycloudy: "switch.macs_weather_conditions_partlycloudy",
    pouring: "switch.macs_weather_conditions_pouring",
    clear_night: "switch.macs_weather_conditions_clear_night",
    exceptional: "switch.macs_weather_conditions_exceptional",
};

function emptyConditions() {
    const out = {};
    for (let i = 0; i < CONDITION_KEYS.length; i++) {
        out[CONDITION_KEYS[i]] = false;
    }
    return out;
}

function isTruthyState(state) {
    const value = (state || "").toString().trim().toLowerCase();
    return value === "on" || value === "true" || value === "1" || value === "yes";
}

function applyDerivedConditions(flags) {
    if (flags.partlycloudy) {
        flags.cloudy = true;
    }
    if (flags.pouring) {
        flags.rainy = true;
    }
}

export class WeatherHandler {
    constructor() {
        this._config = null;
        this._hass = null;
        this._temperature = null;
        this._windspeed = null;
        this._precipitation = null;
        this._battery = null;
        this._conditions = emptyConditions();
        this._weather = { temperature: null, wind: null, precipitation: null, battery: null, conditions: null };
        this._lastTemperature = undefined;
        this._lastWindspeed = undefined;
        this._lastPrecipitation = undefined;
        this._lastBattery = undefined;
        this._lastConditionsSignature = undefined;
    }

    setConfig(config) {
        this._config = config || null;
    }

    setHass(hass) {
        this._hass = hass || null;
    }

    update() {
        if (!this._hass) return null;

        const temperature = this._normalizeTemperature();
        const wind = this._normalizeWind();
        const precipitation = this._normalizePrecipitation();
        const battery = this._normalizeBattery();
        const conditions = this._normalizeConditions();

        this._weather = { temperature, wind, precipitation, battery, conditions };
        this._temperature = Number.isFinite(temperature?.normalized) ? temperature.normalized : null;
        this._windspeed = Number.isFinite(wind?.normalized) ? wind.normalized : null;
        this._precipitation = Number.isFinite(precipitation?.normalized) ? precipitation.normalized : null;
        this._battery = Number.isFinite(battery?.normalized) ? battery.normalized : null;
        this._conditions = conditions || emptyConditions();

        return this.getPayload();
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

    _readManualValue(entityId) {
        if (!this._hass || !entityId) return null;
        const st = this._hass.states?.[entityId];
        if (!st) return null;
        const value = toNumber(st.state);
        if (value === null) return null;
        const clamped = Math.max(0, Math.min(100, value));
        return {
            value: clamped,
            unit: "normalized",
            min: 0,
            max: 100,
            normalized: clamped,
        };
    }

    _readConditionText(stateObj) {
        if (!stateObj) return "";
        const attrs = stateObj.attributes || {};
        const candidates = [attrs.condition, attrs.conditions, attrs.weather, stateObj.state];
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (Array.isArray(candidate) && candidate.length > 0) {
                return candidate.join(", ");
            }
            if (typeof candidate === "string") {
                const value = candidate.trim();
                if (value) return value;
            }
        }
        return "";
    }

    _resolveUnit(sensorUnit, configUnit, kind) {
        const cfg = normalizeWeatherUnit(kind, configUnit);
        if (cfg) return cfg;

        const su = normalizeWeatherUnit(kind, sensorUnit);
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

    _resolveBatteryUnit(sensorUnit, configUnit) {
        const cfg = normalizeBatteryUnit(configUnit);
        if (cfg) return cfg;

        const su = normalizeBatteryUnit(sensorUnit);
        if (su) return su;

        return "%";
    }

    _normalizeTemperature() {
        if (!this._config?.temperature_sensor_enabled) {
            return this._readManualValue(TEMPERATURE_ENTITY_ID);
        }
        const entityId = (this._config.temperature_sensor_entity || "").toString().trim();
        if (!entityId) {
            return null;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            return null;
        }
        debug("temperature sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.temperature_sensor_unit, "temp");
        const normalized = normalizeTemperatureValue(
            reading.value,
            unit,
            this._config.temperature_sensor_min,
            this._config.temperature_sensor_max
        );
        debug("temperature normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.temperature_sensor_min,
            max: this._config.temperature_sensor_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.temperature_sensor_min,
            max: this._config.temperature_sensor_max,
            normalized,
        };
    }

    _normalizeWind() {
        if (!this._config?.wind_sensor_enabled) {
            return this._readManualValue(WIND_ENTITY_ID);
        }
        const entityId = (this._config.wind_sensor_entity || "").toString().trim();
        if (!entityId) {
            return null;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            return null;
        }
        debug("wind sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.wind_sensor_unit, "wind");
        const normalized = normalizeWindValue(
            reading.value,
            unit,
            this._config.wind_sensor_min,
            this._config.wind_sensor_max
        );
        debug("wind normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.wind_sensor_min,
            max: this._config.wind_sensor_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.wind_sensor_min,
            max: this._config.wind_sensor_max,
            normalized,
        };
    }

    _normalizePrecipitation() {
        if (!this._config?.precipitation_sensor_enabled) {
            return this._readManualValue(PRECIPITATION_ENTITY_ID);
        }
        const entityId = (this._config.precipitation_sensor_entity || "").toString().trim();
        if (!entityId) {
            return null;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            return null;
        }
        debug("precipitation sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.precipitation_sensor_unit, "rain");
        const normalized = normalizeRainValue(
            reading.value,
            unit,
            this._config.precipitation_sensor_min,
            this._config.precipitation_sensor_max
        );
        debug("precipitation normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.precipitation_sensor_min,
            max: this._config.precipitation_sensor_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.precipitation_sensor_min,
            max: this._config.precipitation_sensor_max,
            normalized,
        };
    }

    _normalizeBattery() {
        if (!this._config?.battery_charge_sensor_enabled) {
            return this._readManualValue(BATTERY_CHARGE_ENTITY_ID);
        }
        const entityId = (this._config.battery_charge_sensor_entity || "").toString().trim();
        if (!entityId) {
            return null;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            return null;
        }
        debug("battery sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveBatteryUnit(reading.unit, this._config.battery_charge_sensor_unit);
        const normalized = normalizeBatteryValue(
            reading.value,
            unit,
            this._config.battery_charge_sensor_min,
            this._config.battery_charge_sensor_max
        );
        debug("battery normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.battery_charge_sensor_min,
            max: this._config.battery_charge_sensor_max,
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config.battery_charge_sensor_min,
            max: this._config.battery_charge_sensor_max,
            normalized,
        };
    }

    _normalizeConditions() {
        if (this._config?.weather_conditions_enabled) {
            const entityId = (this._config.weather_conditions || "").toString().trim();
            if (!entityId || !this._hass?.states) {
                return emptyConditions();
            }
            const st = this._hass.states?.[entityId];
            if (!st) {
                return emptyConditions();
            }
            const raw = this._readConditionText(st);
            const text = (raw || "").toString().trim().toLowerCase();
            if (!text || text === "unknown" || text === "unavailable") {
                return emptyConditions();
            }

            const normalized = text.replace(/\s+/g, " ").trim();
            const compact = normalized.replace(/[\s-]+/g, "_");
            const spaced = normalized.replace(/[_-]+/g, " ");

            const hasToken = (token) => {
                if (!token) return false;
                const t = token.toLowerCase();
                if (normalized.indexOf(t) !== -1) return true;
                if (compact.indexOf(t.replace(/[\s-]+/g, "_")) !== -1) return true;
                if (spaced.indexOf(t.replace(/[_-]+/g, " ")) !== -1) return true;
                return false;
            };

            const flags = emptyConditions();

            if (hasToken("partlycloudy") || hasToken("partly cloudy") || hasToken("partly-cloudy")) {
                flags.partlycloudy = true;
                flags.cloudy = true;
            }
            if (hasToken("clear_night") || hasToken("clear-night") || hasToken("clear night")) {
                flags.clear_night = true;
            }

            if (hasToken("snowy") || hasToken("snowing") || hasToken("snow")) {
                flags.snowy = true;
            }
            if (hasToken("rainy") || hasToken("raining") || hasToken("rain")) {
                flags.rainy = true;
            }
            if (hasToken("pouring")) {
                flags.pouring = true;
                flags.rainy = true;
            }
            if (hasToken("windy") || hasToken("wind")) {
                flags.windy = true;
            }
            if (hasToken("cloudy") || hasToken("clouds") || hasToken("overcast")) {
                flags.cloudy = true;
            }
            if (hasToken("sunny") || hasToken("sun")) {
                flags.sunny = true;
            }
            if (hasToken("stormy") || hasToken("storm")) {
                flags.stormy = true;
            }
            if (hasToken("foggy") || hasToken("fog")) {
                flags.foggy = true;
            }
            if (hasToken("hail")) {
                flags.hail = true;
            }
            if (hasToken("lightning")) {
                flags.lightning = true;
            }
            if (hasToken("exceptional")) {
                flags.exceptional = true;
            }

            debug("weather conditions", JSON.stringify({
                entityId,
                raw,
                conditions: flags,
            }));
            return flags;
        }

        if (!this._hass?.states) {
            return emptyConditions();
        }

        const flags = emptyConditions();
        for (let i = 0; i < CONDITION_KEYS.length; i++) {
            const key = CONDITION_KEYS[i];
            const id = CONDITION_ENTITY_IDS[key];
            if (!id) continue;
            const st = this._hass.states?.[id];
            if (!st) continue;
            flags[key] = isTruthyState(st.state);
        }
        applyDerivedConditions(flags);
        debug("weather condition toggles", JSON.stringify({
            conditions: flags,
        }));
        return flags;
    }

    getWeather() {
        debug("getWeather");
        return this._weather;
    }

    getPayload() {
        return {
            temperature: this._temperature,
            windspeed: this._windspeed,
            precipitation: this._precipitation,
            battery: this._battery,
            conditions: this._conditions,
        };
    }

    getTemperature() {
        return this._temperature;
    }

    getTemperatureHasChanged() {
        const changed = this._temperature !== this._lastTemperature;
        if (changed) this._lastTemperature = this._temperature;
        return changed;
    }

    getWindSpeed() {
        return this._windspeed;
    }

    getWindSpeedHasChanged() {
        const changed = this._windspeed !== this._lastWindspeed;
        if (changed) this._lastWindspeed = this._windspeed;
        return changed;
    }

    getPrecipitation() {
        return this._precipitation;
    }

    getPrecipitationHasChanged() {
        const changed = this._precipitation !== this._lastPrecipitation;
        if (changed) this._lastPrecipitation = this._precipitation;
        return changed;
    }

    getWeatherConditions() {
        return this._conditions;
    }

    getWeatherConditionsHasChanged() {
        const signature = JSON.stringify(this._conditions || emptyConditions());
        const changed = signature !== this._lastConditionsSignature;
        if (changed) this._lastConditionsSignature = signature;
        return changed;
    }

    getBattery() {
        return this._battery;
    }

    getBatteryHasChanged() {
        const changed = this._battery !== this._lastBattery;
        if (changed) this._lastBattery = this._battery;
        return changed;
    }

    dispose() {
        this._hass = null;
        this._config = null;
        this._temperature = null;
        this._windspeed = null;
        this._precipitation = null;
        this._battery = null;
        this._conditions = emptyConditions();
        this._weather = { temperature: null, wind: null, precipitation: null, battery: null, conditions: null };
        this._lastTemperature = undefined;
        this._lastWindspeed = undefined;
        this._lastPrecipitation = undefined;
        this._lastBattery = undefined;
        this._lastConditionsSignature = undefined;
    }


}
