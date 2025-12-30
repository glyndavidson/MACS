from __future__ import annotations

import json
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN, MOODS, SERVICE_SET_MOOD, ATTR_MOOD


from homeassistant.helpers import config_validation as cv
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)



PLATFORMS: list[str] = ["select"]

RESOURCE_BASE_URL = "/macs/macs-card.js"
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
    Auto-register/update the Lovelace resource for macs-card.js in storage mode.

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

        await hass.services.async_call("select", "select_option", {"entity_id": entity_id, "option": mood}, blocking=True)

    if not hass.services.has_service(DOMAIN, SERVICE_SET_MOOD):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_MOOD,
            handle_set_mood,
            schema=vol.Schema({vol.Required(ATTR_MOOD): vol.In(MOODS)}),
        )

    # Auto-add/update Lovelace resource (storage mode)
    await _ensure_lovelace_resource(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok and not hass.config_entries.async_entries(DOMAIN):
        hass.services.async_remove(DOMAIN, SERVICE_SET_MOOD)
        hass.data.get(DOMAIN, {}).pop("static_path_registered", None)
    return unload_ok
