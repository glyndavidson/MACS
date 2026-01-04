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

SERVICE_SET_BRIGHTNESS = "set_brightness"
ATTR_BRIGHTNESS = "brightness"

SERVICE_SET_TEMPERATURE = "set_temperature"
ATTR_TEMPERATURE = "temperature"

SERVICE_SET_WINDSPEED = "set_windspeed"
ATTR_WINDSPEED = "windspeed"

SERVICE_SET_PRECIPITATION = "set_precipitation"
ATTR_PRECIPITATION = "precipitation"

SERVICE_SET_BATTERY_CHARGE = "set_battery_charge"
ATTR_BATTERY_CHARGE = "battery_charge"

SERVICE_SET_WEATHER_CONDITIONS_SNOWY = "set_weather_conditions_snowy"
ATTR_WEATHER_CONDITIONS_SNOWY = "weather_conditions_snowy"
SERVICE_SET_WEATHER_CONDITIONS_CLOUDY = "set_weather_conditions_cloudy"
ATTR_WEATHER_CONDITIONS_CLOUDY = "weather_conditions_cloudy"
SERVICE_SET_WEATHER_CONDITIONS_RAINY = "set_weather_conditions_rainy"
ATTR_WEATHER_CONDITIONS_RAINY = "weather_conditions_rainy"
SERVICE_SET_WEATHER_CONDITIONS_WINDY = "set_weather_conditions_windy"
ATTR_WEATHER_CONDITIONS_WINDY = "weather_conditions_windy"
SERVICE_SET_WEATHER_CONDITIONS_SUNNY = "set_weather_conditions_sunny"
ATTR_WEATHER_CONDITIONS_SUNNY = "weather_conditions_sunny"
SERVICE_SET_WEATHER_CONDITIONS_STORMY = "set_weather_conditions_stormy"
ATTR_WEATHER_CONDITIONS_STORMY = "weather_conditions_stormy"
SERVICE_SET_WEATHER_CONDITIONS_FOGGY = "set_weather_conditions_foggy"
ATTR_WEATHER_CONDITIONS_FOGGY = "weather_conditions_foggy"
SERVICE_SET_WEATHER_CONDITIONS_HAIL = "set_weather_conditions_hail"
ATTR_WEATHER_CONDITIONS_HAIL = "weather_conditions_hail"
SERVICE_SET_WEATHER_CONDITIONS_LIGHTNING = "set_weather_conditions_lightning"
ATTR_WEATHER_CONDITIONS_LIGHTNING = "weather_conditions_lightning"
SERVICE_SET_WEATHER_CONDITIONS_PARTLYCLOUDY = "set_weather_conditions_partlycloudy"
ATTR_WEATHER_CONDITIONS_PARTLYCLOUDY = "weather_conditions_partlycloudy"
SERVICE_SET_WEATHER_CONDITIONS_POURING = "set_weather_conditions_pouring"
ATTR_WEATHER_CONDITIONS_POURING = "weather_conditions_pouring"
SERVICE_SET_WEATHER_CONDITIONS_CLEAR_NIGHT = "set_weather_conditions_clear_night"
ATTR_WEATHER_CONDITIONS_CLEAR_NIGHT = "weather_conditions_clear_night"
SERVICE_SET_WEATHER_CONDITIONS_EXCEPTIONAL = "set_weather_conditions_exceptional"
ATTR_WEATHER_CONDITIONS_EXCEPTIONAL = "weather_conditions_exceptional"
