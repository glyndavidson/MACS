from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .entities import (
    MacsAnimationsEnabledSwitch,
    MacsWeatherConditionsClearNightSwitch,
    MacsWeatherConditionsCloudySwitch,
    MacsWeatherConditionsExceptionalSwitch,
    MacsWeatherConditionsFoggySwitch,
    MacsWeatherConditionsHailSwitch,
    MacsWeatherConditionsLightningSwitch,
    MacsWeatherConditionsPartlyCloudySwitch,
    MacsWeatherConditionsPouringSwitch,
    MacsWeatherConditionsRainySwitch,
    MacsWeatherConditionsSnowySwitch,
    MacsWeatherConditionsStormySwitch,
    MacsWeatherConditionsSunnySwitch,
    MacsWeatherConditionsWindySwitch,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities(
        [
            MacsAnimationsEnabledSwitch(),
            MacsWeatherConditionsSnowySwitch(),
            MacsWeatherConditionsCloudySwitch(),
            MacsWeatherConditionsRainySwitch(),
            MacsWeatherConditionsWindySwitch(),
            MacsWeatherConditionsSunnySwitch(),
            MacsWeatherConditionsStormySwitch(),
            MacsWeatherConditionsFoggySwitch(),
            MacsWeatherConditionsHailSwitch(),
            MacsWeatherConditionsLightningSwitch(),
            MacsWeatherConditionsPartlyCloudySwitch(),
            MacsWeatherConditionsPouringSwitch(),
            MacsWeatherConditionsClearNightSwitch(),
            MacsWeatherConditionsExceptionalSwitch(),
        ]
    )
