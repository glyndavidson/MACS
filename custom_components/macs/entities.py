from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN, MOODS, WEATHERS, MACS_DEVICE

# macs_mood dropdown select entity
class MacsMoodSelect(SelectEntity):
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

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE

# macs_weather dropdown select entity
class MacsWeatherSelect(SelectEntity):
    _attr_has_entity_name = True
    _attr_name = "Weather"
    _attr_unique_id = "macs_weather"
    _attr_suggested_object_id = "macs_weather"
    _attr_icon = "mdi:weather-partly-cloudy"
    _attr_options = WEATHERS
    _attr_current_option = "none"

    async def async_select_option(self, option: str) -> None:
        if option in WEATHERS:
            self._attr_current_option = option
            self.async_write_ha_state()

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE

# macs_brightness number entity
class MacsBrightnessNumber(NumberEntity):
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

    @property
    def device_info(self) -> DeviceInfo:
        return MACS_DEVICE
