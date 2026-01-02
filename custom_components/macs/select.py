from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .entities import MacsMoodSelect #, MacsWeatherSelect


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities([
        MacsMoodSelect(),
        # MacsWeatherSelect(),
    ])