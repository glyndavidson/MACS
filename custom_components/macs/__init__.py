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
    SERVICE_SET_PRECIPITATION,
    ATTR_PRECIPITATION,
    SERVICE_SET_BATTERY_CHARGE,
    ATTR_BATTERY_CHARGE,
    SERVICE_SET_WEATHER_CONDITIONS_SNOWY,
    ATTR_WEATHER_CONDITIONS_SNOWY,
    SERVICE_SET_WEATHER_CONDITIONS_CLOUDY,
    ATTR_WEATHER_CONDITIONS_CLOUDY,
    SERVICE_SET_WEATHER_CONDITIONS_RAINY,
    ATTR_WEATHER_CONDITIONS_RAINY,
    SERVICE_SET_WEATHER_CONDITIONS_WINDY,
    ATTR_WEATHER_CONDITIONS_WINDY,
    SERVICE_SET_WEATHER_CONDITIONS_SUNNY,
    ATTR_WEATHER_CONDITIONS_SUNNY,
    SERVICE_SET_WEATHER_CONDITIONS_STORMY,
    ATTR_WEATHER_CONDITIONS_STORMY,
    SERVICE_SET_WEATHER_CONDITIONS_FOGGY,
    ATTR_WEATHER_CONDITIONS_FOGGY,
    SERVICE_SET_WEATHER_CONDITIONS_HAIL,
    ATTR_WEATHER_CONDITIONS_HAIL,
    SERVICE_SET_WEATHER_CONDITIONS_LIGHTNING,
    ATTR_WEATHER_CONDITIONS_LIGHTNING,
    SERVICE_SET_WEATHER_CONDITIONS_PARTLYCLOUDY,
    ATTR_WEATHER_CONDITIONS_PARTLYCLOUDY,
    SERVICE_SET_WEATHER_CONDITIONS_POURING,
    ATTR_WEATHER_CONDITIONS_POURING,
    SERVICE_SET_WEATHER_CONDITIONS_CLEAR_NIGHT,
    ATTR_WEATHER_CONDITIONS_CLEAR_NIGHT,
    SERVICE_SET_WEATHER_CONDITIONS_EXCEPTIONAL,
    ATTR_WEATHER_CONDITIONS_EXCEPTIONAL
)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# user dropdown/select and number entities
PLATFORMS: list[str] = ["select", "number", "switch"]

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
    migrate("macs_brightness", "number.macs_brightness")
    migrate("macs_battery_charge", "number.macs_battery_charge")
    migrate("macs_temperature", "number.macs_temperature")
    migrate("macs_windspeed", "number.macs_windspeed")
    migrate("macs_precipitation", "number.macs_precipitation")
    migrate("macs_weather_conditions_snowy", "switch.macs_weather_conditions_snowy")
    migrate("macs_weather_conditions_cloudy", "switch.macs_weather_conditions_cloudy")
    migrate("macs_weather_conditions_rainy", "switch.macs_weather_conditions_rainy")
    migrate("macs_weather_conditions_windy", "switch.macs_weather_conditions_windy")
    migrate("macs_weather_conditions_sunny", "switch.macs_weather_conditions_sunny")
    migrate("macs_weather_conditions_stormy", "switch.macs_weather_conditions_stormy")
    migrate("macs_weather_conditions_foggy", "switch.macs_weather_conditions_foggy")
    migrate("macs_weather_conditions_hail", "switch.macs_weather_conditions_hail")
    migrate("macs_weather_conditions_lightning", "switch.macs_weather_conditions_lightning")
    migrate("macs_weather_conditions_partlycloudy", "switch.macs_weather_conditions_partlycloudy")
    migrate("macs_weather_conditions_pouring", "switch.macs_weather_conditions_pouring")
    migrate("macs_weather_conditions_clear_night", "switch.macs_weather_conditions_clear_night")
    migrate("macs_weather_conditions_exceptional", "switch.macs_weather_conditions_exceptional")

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

    async def handle_set_precipitation(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_PRECIPITATION, "macs_precipitation", "precipitation")

    async def handle_set_battery_charge(call: ServiceCall) -> None:
        await _set_number_entity(call, ATTR_BATTERY_CHARGE, "macs_battery_charge", "battery charge")


    async def _set_switch_entity(call: ServiceCall, attr_name: str, unique_id: str, label: str) -> None:
        raw = call.data.get(attr_name, None)

        if isinstance(raw, bool):
            is_on = raw
        elif isinstance(raw, (int, float)):
            is_on = bool(raw)
        elif isinstance(raw, str):
            v = raw.strip().lower()
            if v in ("1", "true", "on", "yes", "y"):
                is_on = True
            elif v in ("0", "false", "off", "no", "n"):
                is_on = False
            else:
                raise vol.Invalid(f"Invalid {label} '{raw}'. Must be true/false.")
        else:
            raise vol.Invalid(f"Invalid {label} '{raw}'. Must be true/false.")

        registry = er.async_get(hass)
        entity_id = None
        for ent in registry.entities.values():
            if ent.platform == DOMAIN and ent.unique_id == unique_id:
                entity_id = ent.entity_id
                break

        if not entity_id:
            raise vol.Invalid(f"Macs {label} entity not found (switch not created)")

        await hass.services.async_call(
            "switch",
            "turn_on" if is_on else "turn_off",
            {"entity_id": entity_id},
            blocking=True,
        )

    async def handle_set_weather_conditions_snowy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_SNOWY,
            "macs_weather_conditions_snowy",
            "weather conditions snowy"
        )

    async def handle_set_weather_conditions_cloudy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_CLOUDY,
            "macs_weather_conditions_cloudy",
            "weather conditions cloudy"
        )

    async def handle_set_weather_conditions_rainy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_RAINY,
            "macs_weather_conditions_rainy",
            "weather conditions rainy"
        )

    async def handle_set_weather_conditions_windy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_WINDY,
            "macs_weather_conditions_windy",
            "weather conditions windy"
        )

    async def handle_set_weather_conditions_sunny(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_SUNNY,
            "macs_weather_conditions_sunny",
            "weather conditions sunny"
        )

    async def handle_set_weather_conditions_stormy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_STORMY,
            "macs_weather_conditions_stormy",
            "weather conditions stormy"
        )

    async def handle_set_weather_conditions_foggy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_FOGGY,
            "macs_weather_conditions_foggy",
            "weather conditions foggy"
        )

    async def handle_set_weather_conditions_hail(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_HAIL,
            "macs_weather_conditions_hail",
            "weather conditions hail"
        )

    async def handle_set_weather_conditions_lightning(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_LIGHTNING,
            "macs_weather_conditions_lightning",
            "weather conditions lightning"
        )

    async def handle_set_weather_conditions_partlycloudy(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_PARTLYCLOUDY,
            "macs_weather_conditions_partlycloudy",
            "weather conditions partly cloudy"
        )

    async def handle_set_weather_conditions_pouring(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_POURING,
            "macs_weather_conditions_pouring",
            "weather conditions pouring"
        )

    async def handle_set_weather_conditions_clear_night(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_CLEAR_NIGHT,
            "macs_weather_conditions_clear_night",
            "weather conditions clear night"
        )

    async def handle_set_weather_conditions_exceptional(call: ServiceCall) -> None:
        await _set_switch_entity(
            call,
            ATTR_WEATHER_CONDITIONS_EXCEPTIONAL,
            "macs_weather_conditions_exceptional",
            "weather conditions exceptional"
        )



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

    if not hass.services.has_service(DOMAIN, SERVICE_SET_PRECIPITATION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_PRECIPITATION,
            handle_set_precipitation,
            schema=vol.Schema({vol.Required(ATTR_PRECIPITATION): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_BATTERY_CHARGE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_BATTERY_CHARGE,
            handle_set_battery_charge,
            schema=vol.Schema({vol.Required(ATTR_BATTERY_CHARGE): vol.Coerce(float)}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_SNOWY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_SNOWY,
            handle_set_weather_conditions_snowy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_SNOWY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_CLOUDY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_CLOUDY,
            handle_set_weather_conditions_cloudy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_CLOUDY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_RAINY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_RAINY,
            handle_set_weather_conditions_rainy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_RAINY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_WINDY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_WINDY,
            handle_set_weather_conditions_windy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_WINDY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_SUNNY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_SUNNY,
            handle_set_weather_conditions_sunny,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_SUNNY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_STORMY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_STORMY,
            handle_set_weather_conditions_stormy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_STORMY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_FOGGY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_FOGGY,
            handle_set_weather_conditions_foggy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_FOGGY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_HAIL):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_HAIL,
            handle_set_weather_conditions_hail,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_HAIL): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_LIGHTNING):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_LIGHTNING,
            handle_set_weather_conditions_lightning,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_LIGHTNING): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_PARTLYCLOUDY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_PARTLYCLOUDY,
            handle_set_weather_conditions_partlycloudy,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_PARTLYCLOUDY): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_POURING):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_POURING,
            handle_set_weather_conditions_pouring,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_POURING): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_CLEAR_NIGHT):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_CLEAR_NIGHT,
            handle_set_weather_conditions_clear_night,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_CLEAR_NIGHT): cv.boolean}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_EXCEPTIONAL):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_WEATHER_CONDITIONS_EXCEPTIONAL,
            handle_set_weather_conditions_exceptional,
            schema=vol.Schema({vol.Required(ATTR_WEATHER_CONDITIONS_EXCEPTIONAL): cv.boolean}),
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
        hass.services.async_remove(DOMAIN, SERVICE_SET_PRECIPITATION)
        hass.services.async_remove(DOMAIN, SERVICE_SET_BATTERY_CHARGE)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_SNOWY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_CLOUDY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_RAINY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_WINDY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_SUNNY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_STORMY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_FOGGY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_HAIL)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_LIGHTNING)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_PARTLYCLOUDY)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_POURING)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_CLEAR_NIGHT)
        hass.services.async_remove(DOMAIN, SERVICE_SET_WEATHER_CONDITIONS_EXCEPTIONAL)
        hass.data.get(DOMAIN, {}).pop("static_path_registered", None)
    return unload_ok
