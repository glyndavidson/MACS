from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MOODS, WEATHERS

async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([MacsMoodSelect(), MacsWeatherSelect()])

class MacsMoodSelect(SelectEntity):
    _attr_has_entity_name = True
    _attr_name = "Mood"
    _attr_unique_id = f"{DOMAIN}_mood"
    _attr_icon = "mdi:emoticon"
    _attr_options = MOODS
    _attr_current_option = "idle"

    async def async_select_option(self, option: str) -> None:
        if option not in MOODS:
            return
        self._attr_current_option = option
        self.async_write_ha_state()

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, "macs")},
            name="M.A.C.S.",
            manufacturer="Glyn Davidson",
            model="Mood-Aware Character SVG",
        )

class MacsWeatherSelect(SelectEntity):
    _attr_has_entity_name = True
    _attr_name = "Weather"
    _attr_unique_id = f"{DOMAIN}_weather"
    _attr_icon = "mdi:weather-partly-cloudy"
    _attr_options = WEATHERS
    _attr_current_option = "none"

    async def async_select_option(self, option: str) -> None:
        if option not in WEATHERS:
            return
        self._attr_current_option = option
        self.async_write_ha_state()

    @property
    def device_info(self) -> DeviceInfo:
        # Same device as the mood entity so they group together
        return DeviceInfo(
            identifiers={(DOMAIN, "macs")},
            name="M.A.C.S.",
            manufacturer="Glyn Davidson",
            model="Mood-Aware Character SVG",
        )