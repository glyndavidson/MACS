import { TEMPERATURE_ENTITY_ID, WIND_ENTITY_ID, RAINFALL_ENTITY_ID } from "./constants.js";
import { toNumber, normalizeTemperatureValue, normalizeWindValue, normalizeRainValue, normalizeWeatherUnit } from "./validators.js";
import { createDebugger } from "./debugger.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("weatherHandler", DEBUG_ENABLED);

export class WeatherHandler {
    constructor() {
        this._config = null;
        this._hass = null;
        this._temperature = null;
        this._windspeed = null;
        this._rainfall = null;
        this._weather = { temperature: null, wind: null, precipitation: null };
        this._lastTemperature = undefined;
        this._lastWindspeed = undefined;
        this._lastRainfall = undefined;
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
        const precipitation = this._normalizeRain();

        this._weather = { temperature, wind, precipitation };
        this._temperature = Number.isFinite(temperature?.normalized) ? temperature.normalized : null;
        this._windspeed = Number.isFinite(wind?.normalized) ? wind.normalized : null;
        this._rainfall = Number.isFinite(precipitation?.normalized) ? precipitation.normalized : null;

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

        const unit = this._resolveUnit(reading.unit, this._config.temperature_unit, "temp");
        const normalized = normalizeTemperatureValue(
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

        const unit = this._resolveUnit(reading.unit, this._config.wind_unit, "wind");
        const normalized = normalizeWindValue(
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
        if (!this._config?.precipitation_sensor_enabled) {
            return this._readManualValue(RAINFALL_ENTITY_ID);
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

        const unit = this._resolveUnit(reading.unit, this._config.precipitation_unit, "rain");
        const normalized = normalizeRainValue(
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
        return this._weather;
    }

    getPayload() {
        return {
            temperature: this._temperature,
            windspeed: this._windspeed,
            rainfall: this._rainfall,
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

    getRainfall() {
        return this._rainfall;
    }

    getRainfallHasChanged() {
        const changed = this._rainfall !== this._lastRainfall;
        if (changed) this._lastRainfall = this._rainfall;
        return changed;
    }

    dispose() {
        this._hass = null;
        this._config = null;
        this._temperature = null;
        this._windspeed = null;
        this._rainfall = null;
        this._weather = { temperature: null, wind: null, precipitation: null };
        this._lastTemperature = undefined;
        this._lastWindspeed = undefined;
        this._lastRainfall = undefined;
    }


}
