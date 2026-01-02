from homeassistant.helpers.device_registry import DeviceInfo

DOMAIN = "macs"
MACS_DEVICE_ID = "macs"

# add a device with entities to the integration UI
MACS_DEVICE = DeviceInfo(
    identifiers={(DOMAIN, MACS_DEVICE_ID)},
    name="M.A.C.S.",
    manufacturer="Glyn Davidson",
    model="Mood-Aware Character SVG",
)

MOODS = (
    "bored",
    "confused",
    "happy",
    "idle",
    "listening",
    "sleeping",
    "surprised",
    "thinking",
)
SERVICE_SET_MOOD = "set_mood"
ATTR_MOOD = "mood"



# WEATHERS = (
#     "none",
#     "rain",
#     "wind",
#     "hot",
#     "cold",
# )
# SERVICE_SET_WEATHER = "set_weather"
# ATTR_WEATHER = "weather"
# #ATTR_INTENSITY = "intensity"



SERVICE_SET_BRIGHTNESS = "set_brightness"
ATTR_BRIGHTNESS = "brightness"