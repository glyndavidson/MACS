from __future__ import annotations

import json
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er
from homeassistant.components.http import StaticPathConfig
from homeassistant.helpers import config_validation as cv

# import constants
from .const import (
    DOMAIN,
    MOODS,
    SERVICE_SET_MOOD,
    ATTR_MOOD,
    SERVICE_SET_BRIGHTNESS,
    ATTR_BRIGHTNESS,
    SERVICE_SET_TEMPERATURE,
    ATTR_TEMPERATURE,
    SERVICE_SET_WINDSPEED,
    ATTR_WINDSPEED,
    SERVICE_SET_RAINFALL,
    ATTR_RAINFALL,
    SERVICE_SET_SNOWFALL,
    ATTR_SNOWFALL,
)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# user dropdown/select and number entities
PLATFORMS: list[str] = ["select", "number"]

RESOURCE_BASE_URL = "/macs/macs.js"
RESOURCE_TYPE = "module"


def _integration_version() -> str:
    """Read integration version from manifest.json (best-effort)."""
    try:
        manifest_path = Path(__file__).parent / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        return str(manifest.get("version", "0"))
    except Exception:
        return "0"


async def _ensure_lovelace_resource(hass: HomeAssistant) -> None:
    """
    Auto-register/update the Lovelace resource for macs.js in storage mode.

    In YAML mode, HA doesn't expose a writable resources collection, so we just no-op.
    """
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None) if lovelace else None
    if not resources:
        return

    version = _integration_version()
    desired_url = f"{RESOURCE_BASE_URL}?v={version}"

    existing = None
    for item in resources.async_items():
        url = str(item.get("url", ""))
        if url.split("?", 1)[0] == RESOURCE_BASE_URL:
            existing = item
            break

    if existing:
        if existing.get("url") != desired_url or existing.get("res_type") != RESOURCE_TYPE:
            await resources.async_update_item(existing["id"], {"res_type": RESOURCE_TYPE, "url": desired_url})
    else:
        await resources.async_create_item({"res_type": RESOURCE_TYPE, "url": desired_url})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Serve frontend files from custom_components/macs/www at /macs/...
    hass.data.setdefault(DOMAIN, {})
    if not hass.data[DOMAIN].get("static_path_registered"):
        www_path = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths([StaticPathConfig("/macs", str(www_path), cache_headers=False)])
        hass.data[DOMAIN]["static_path_registered"] = True

    # Create entities first
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # ---- entity_id migration (fix ugly auto-generated IDs like select.m_a_c_s_weather) ----
    reg = er.async_get(hass)

    def migrate(unique_id: str, desired_entity_id: str) -> None:
        entry_obj = next((e for e in reg.entities.values() if e.platform == DOMAIN and e.unique_id == unique_id), None)
        if not entry_obj:
            return
        if entry_obj.entity_id == desired_entity_id:
            return
        # Only rename if the desired entity_id is free
        if desired_entity_id not in reg.entities:
            reg.async_update_entity(entry_obj.entity_id, new_entity_id=desired_entity_id)

    # These must match the _attr_unique_id values in entities.py
    migrate("macs_mood", "select.macs_mood")
    #migrate("macs_weather", "select.macs_weather")
    migrate("macs_brightness", "number.macs_brightness")
    migrate("macs_temperature", "number.macs_temperature")
    migrate("macs_windspeed", "number.macs_windspeed")
    migrate("macs_rainfall", "number.macs_rainfall")
    migrate("macs_snowfall", "number.macs_snowfall")

    async def handle_set_mood(call: ServiceCall) -> None:
        mood = str(call.data.get(ATTR_MOOD, "")).strip().lower()
        if mood not in MOODS:
            raise vol.Invalid(f"Invalid mood '{mood}'. Must be one of: {', '.join(MOODS)}")

        registry = er.async_get(hass)
        entity_id = None
        for ent in registry.entities.values():
            if ent.platform == DOMAIN and ent.unique_id == "macs_mood":
                entity_id = ent.entity_id
                break

        if not entity_id:
            raise vol.Invalid("Macs mood entity not found (select not created)")

        await hass.services.async_call("select", "select_option", {"entity_id": entity_id, "option": mood}, blocking=True)

    async def _set_number_entity(call: ServiceCall, attr_name: str, unique_id: str, label: str) -> None:
        raw = call.data.get(attr_name, None)
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise vol.Invalid(f"Invalid {label} '{raw}'. Must be a number between 0 and 100.")

        if not (0 <= value <= 100):
            raise vol.Invalid(f"Invalid {label} '{value}'. Must be between 0 and 100.")

        registry = er.async_get(hass)
        entity_id = None
        for ent in registry.entities.values():
            if ent.platform == DOMAIN and ent.unique_id == unique_id:
                entity_id = ent.entity_id
                break

        if not entity_id:
            raise vol.Invalid(f"Macs {label} entity not found (number not created)")

        await hass.services.async_call(
            "number",
            "set_value",
            {"entity_id": entity_id, "value": value},
            blocking=True,
        )

    async def handle_set_brightness(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_BRIGHTNESS, "macs_brightness", "brightness")

    async def handle_set_temperature(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_TEMPERATURE, "macs_temperature", "temperature")

    async def handle_set_windspeed(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_WINDSPEED, "macs_windspeed", "windspeed")

    async def handle_set_rainfall(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_RAINFALL, "macs_rainfall", "rainfall")

    async def handle_set_snowfall(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_SNOWFALL, "macs_snowfall", "snowfall")

    if not hass.services.has_service(DOMAIN, SERVICE_SET_MOOD):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_MOOD,
            handle_set_mood,
            schema=vol.Schema({vol.Required(ATTR_MOOD): vol.In(MOODS)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_BRIGHTNESS):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_BRIGHTNESS,
            handle_set_brightness,
            schema=vol.Schema({vol.Required(ATTR_BRIGHTNESS): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_TEMPERATURE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_TEMPERATURE,
            handle_set_temperature,
            schema=vol.Schema({vol.Required(ATTR_TEMPERATURE): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WINDSPEED):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WINDSPEED,
            handle_set_windspeed,
            schema=vol.Schema({vol.Required(ATTR_WINDSPEED): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_RAINFALL):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_RAINFALL,
            handle_set_rainfall,
            schema=vol.Schema({vol.Required(ATTR_RAINFALL): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_SNOWFALL):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_SNOWFALL,
            handle_set_snowfall,
            schema=vol.Schema({vol.Required(ATTR_SNOWFALL): vol.Coerce(float)}),
        )

    # Auto-add/update Lovelace resource (storage mode)
    await _ensure_lovelace_resource(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok and not hass.config_entries.async_entries(DOMAIN):
        hass.services.async_remove(DOMAIN, SERVICE_SET_MOOD)
        hass.services.async_remove(DOMAIN, SERVICE_SET_BRIGHTNESS)
        hass.services.async_remove(DOMAIN, SERVICE_SET_TEMPERATURE)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WINDSPEED)
        hass.services.async_remove(DOMAIN, SERVICE_SET_RAINFALL)
        hass.services.async_remove(DOMAIN, SERVICE_SET_SNOWFALL)
        hass.data.get(DOMAIN, {}).pop("static_path_registered", None)
    return unload_ok
