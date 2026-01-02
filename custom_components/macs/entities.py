from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.restore_state import RestoreEntity

#from .const import DOMAIN, MOODS, WEATHERS, MACS_DEVICE
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

# macs_weather dropdown select entity
# class MacsWeatherSelect(SelectEntity, RestoreEntity):
#     _attr_has_entity_name = True
#     _attr_name = "Weather"
#     _attr_unique_id = "macs_weather"
#     _attr_suggested_object_id = "macs_weather"
#     _attr_icon = "mdi:weather-partly-cloudy"
#     _attr_options = WEATHERS
#     _attr_current_option = "none"

#     async def async_select_option(self, option: str) -> None:
#         if option in WEATHERS:
#             self._attr_current_option = option
#             self.async_write_ha_state()

#     async def async_added_to_hass(self) -> None:
#         await super().async_added_to_hass()
#         last_state = await self.async_get_last_state()
#         if last_state and last_state.state in WEATHERS:
#             self._attr_current_option = last_state.state

#     @property
#     def device_info(self) -> DeviceInfo:
#         return MACS_DEVICE

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
