from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, MOODS, SERVICE_SET_MOOD, ATTR_MOOD

PLATFORMS: list[str] = ["select"]

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def handle_set_mood(call: ServiceCall) -> None:
        mood = str(call.data.get(ATTR_MOOD, "")).strip().lower()
        if mood not in MOODS:
            raise vol.Invalid(f"Invalid mood '{mood}'. Must be one of: {', '.join(MOODS)}")

        registry = er.async_get(hass)
        entity_id = None
        for ent in registry.entities.values():
            if ent.platform == DOMAIN and ent.unique_id == f"{DOMAIN}_mood":
                entity_id = ent.entity_id
                break

        if not entity_id:
            raise vol.Invalid("Macs mood entity not found (select not created)")

        await hass.services.async_call(
            "select",
            "select_option",
            {"entity_id": entity_id, "option": mood},
            blocking=True,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_MOOD):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_MOOD,
            handle_set_mood,
            schema=vol.Schema({vol.Required(ATTR_MOOD): vol.In(MOODS)}),
        )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok and not hass.config_entries.async_entries(DOMAIN):
        hass.services.async_remove(DOMAIN, SERVICE_SET_MOOD)
    return unload_ok
