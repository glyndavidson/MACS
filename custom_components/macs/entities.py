from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN, MOODS, MACS_DEVICE

# macs_mood dropdown select entity
class MacsMoodSelect(SelectEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Mood"
    _attr_unique_id = "macs_mood"
    _attr_suggested_object_id = "macs_mood"
    _attr_icon = "mdi:emoticon"
    _attr_options = MOODS
    _attr_current_option = "idle"

    async def async_select_option(self, option: str) -> None:
        if option in MOODS:
            self._attr_current_option = option
            self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.state in MOODS:
            self._attr_current_option = last_state.state

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


# macs_brightness number entity
class MacsBrightnessNumber(NumberEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Brightness"
    _attr_unique_id = "macs_brightness"
    _attr_suggested_object_id = "macs_brightness"
    _attr_icon = "mdi:brightness-6"

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER
    _attr_native_value = 100

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(0, min(100, value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        try:
            value = float(last_state.state)
        except (TypeError, ValueError):
            return
        self._attr_native_value = max(0, min(100, value))

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsBatteryChargeNumber(NumberEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Battery Charge"
    _attr_unique_id = "macs_battery_charge"
    _attr_suggested_object_id = "macs_battery_charge"
    _attr_icon = "mdi:battery"

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER
    _attr_native_value = 100

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(0, min(100, value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        try:
            value = float(last_state.state)
        except (TypeError, ValueError):
            return
        self._attr_native_value = max(0, min(100, value))

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsTemperatureNumber(NumberEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Temperature"
    _attr_unique_id = "macs_temperature"
    _attr_suggested_object_id = "macs_temperature"
    _attr_icon = "mdi:thermometer"

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER
    _attr_native_value = 0

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(0, min(100, value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        try:
            value = float(last_state.state)
        except (TypeError, ValueError):
            return
        self._attr_native_value = max(0, min(100, value))

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWindSpeedNumber(NumberEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Wind Speed"
    _attr_unique_id = "macs_windspeed"
    _attr_suggested_object_id = "macs_windspeed"
    _attr_icon = "mdi:weather-windy"

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER
    _attr_native_value = 0

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(0, min(100, value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        try:
            value = float(last_state.state)
        except (TypeError, ValueError):
            return
        self._attr_native_value = max(0, min(100, value))

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsPrecipitationNumber(NumberEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Precipitation"
    _attr_unique_id = "macs_precipitation"
    _attr_suggested_object_id = "macs_precipitation"
    _attr_icon = "mdi:weather-rainy"

    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER
    _attr_native_value = 0

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(0, min(100, value))
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        try:
            value = float(last_state.state)
        except (TypeError, ValueError):
            return
        self._attr_native_value = max(0, min(100, value))

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE



class MacsWeatherConditionsSnowySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Snowy"
    _attr_unique_id = "macs_weather_conditions_snowy"
    _attr_suggested_object_id = "macs_weather_conditions_snowy"
    _attr_icon = "mdi:snowflake"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsCloudySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Cloudy"
    _attr_unique_id = "macs_weather_conditions_cloudy"
    _attr_suggested_object_id = "macs_weather_conditions_cloudy"
    _attr_icon = "mdi:weather-cloudy"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsRainySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Rainy"
    _attr_unique_id = "macs_weather_conditions_rainy"
    _attr_suggested_object_id = "macs_weather_conditions_rainy"
    _attr_icon = "mdi:weather-rainy"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsWindySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Windy"
    _attr_unique_id = "macs_weather_conditions_windy"
    _attr_suggested_object_id = "macs_weather_conditions_windy"
    _attr_icon = "mdi:weather-windy"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsSunnySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Sunny"
    _attr_unique_id = "macs_weather_conditions_sunny"
    _attr_suggested_object_id = "macs_weather_conditions_sunny"
    _attr_icon = "mdi:weather-sunny"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsStormySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Stormy"
    _attr_unique_id = "macs_weather_conditions_stormy"
    _attr_suggested_object_id = "macs_weather_conditions_stormy"
    _attr_icon = "mdi:weather-lightning"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsFoggySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Foggy"
    _attr_unique_id = "macs_weather_conditions_foggy"
    _attr_suggested_object_id = "macs_weather_conditions_foggy"
    _attr_icon = "mdi:weather-fog"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsHailSwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Hail"
    _attr_unique_id = "macs_weather_conditions_hail"
    _attr_suggested_object_id = "macs_weather_conditions_hail"
    _attr_icon = "mdi:weather-hail"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsLightningSwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Lightning"
    _attr_unique_id = "macs_weather_conditions_lightning"
    _attr_suggested_object_id = "macs_weather_conditions_lightning"
    _attr_icon = "mdi:weather-lightning"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsPartlyCloudySwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Partly Cloudy"
    _attr_unique_id = "macs_weather_conditions_partlycloudy"
    _attr_suggested_object_id = "macs_weather_conditions_partlycloudy"
    _attr_icon = "mdi:weather-partly-cloudy"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsPouringSwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Pouring"
    _attr_unique_id = "macs_weather_conditions_pouring"
    _attr_suggested_object_id = "macs_weather_conditions_pouring"
    _attr_icon = "mdi:weather-pouring"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsClearNightSwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Clear Night"
    _attr_unique_id = "macs_weather_conditions_clear_night"
    _attr_suggested_object_id = "macs_weather_conditions_clear_night"
    _attr_icon = "mdi:weather-night"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE


class MacsWeatherConditionsExceptionalSwitch(SwitchEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_name = "Exceptional"
    _attr_unique_id = "macs_weather_conditions_exceptional"
    _attr_suggested_object_id = "macs_weather_conditions_exceptional"
    _attr_icon = "mdi:alert-circle-outline"
    _attr_is_on = False

    async def async_turn_on(self, **kwargs) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if not last_state:
            return
        self._attr_is_on = (last_state.state == "on")

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE
