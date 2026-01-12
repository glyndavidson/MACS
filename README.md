# M.A.C.S. - Mood-Aware Character SVG

M.A.C.S. is a playful, expressive, animated companion for Home Assistant.

It visualises Assist interactions and broader system context using a living SVG character.

Rather than showing buttons and graphs, MACS shows state, mood, and intent, giving your smart home a friendly, readable presence.

![Screenshot of Macs in Home Assistant Dashboard](https://github.com/glyndavidson/MACS/blob/main/resources/screenshot.png)
<br><br>


## Buy me a Coffee
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to encourage continued development.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>


## What MACS Does
Originally, I developed Macs because I wasn't sure if my Wake Words were triggering and if Home Assistant was listening to, and understanding my requests. I wanted some feedback so that I could see what was happening. Since fixing this problem, Macs has grown into more than just a friendly assistant - he now pulls data from multiplke sensors and can visualise things like weather forecasts, battery charging, etc.


## Design Philosophy
MACS is not a control panel.

It is:
- A companion
- A status glance
- A playful way to visualise the state of various home assistant entities.

![Concept sketches for Macs](https://github.com/glyndavidson/MACS/blob/main/resources/art-philosophy.png?raw=true)

Perfect for:
- Wall tablets
- Old iPads
- Kiosk dashboards
<br><br>


## Installation
- Install the Macs Card via Hacs.
- Create a new Dashboard with a Panel (Single Card) Layout.
- Add the Macs Card to the dashboard.
- Configure as required.
<br><br>


## Manual & Automation Control
MACS works like any other device and exposes entities and services so automations can drive its mood and effects directly.

Use macs.set_mood to change expressions. Use number entities or the matching services to control brightness, temperature, windspeed, precipitation, and battery charge. Use switches for animations_enabled, charging, and the weather_conditions_* toggles. You can also push dialogue bubbles with send_user_message and send_assistant_message.

Typical uses:
- Trigger moods from motion, presence, or security events
- Reflect weather shifts in real time
- Create time-based routines (sleeping at night, happy in the morning)

This makes MACS fully scriptable and system-driven, not just reactive to Assist.
<br><br>

## Entities and Services
This table shows the MACS entities and services and which card features override the entities.

### Entities
| Entity | Type | Purpose | Overridden by card feature |
| --- | --- | --- | --- |
| select.macs_mood | select | Set the base mood. | Assist Satellite enabled can override mood. |
| select.macs_debug | select | Set debug output level. | None. |
| number.macs_brightness | number | Set brightness (0-100). | Kiosk Mode enabled. |
| number.macs_battery_charge | number | Set battery charge (0-100). | Use Battery Charge Sensor enabled. |
| number.macs_temperature | number | Set temperature intensity (0-100). | Use Temperature Sensor enabled. |
| number.macs_windspeed | number | Set wind speed intensity (0-100). | Use Wind Sensor enabled. |
| number.macs_precipitation | number | Set precipitation intensity (0-100). | Use Precipitation Sensor enabled. |
| switch.macs_animations_enabled | switch | Enable or pause animations. | Kiosk Mode enabled. |
| switch.macs_charging | switch | Set charging state. | Use Charging Sensor enabled. |
| switch.macs_weather_conditions_snowy | switch | Toggle snowy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_cloudy | switch | Toggle cloudy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_rainy | switch | Toggle rainy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_windy | switch | Toggle windy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_sunny | switch | Toggle sunny condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_stormy | switch | Toggle stormy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_foggy | switch | Toggle foggy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_hail | switch | Toggle hail condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_lightning | switch | Toggle lightning condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_partlycloudy | switch | Toggle partly cloudy condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_pouring | switch | Toggle pouring condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_clear_night | switch | Toggle clear night condition. | Weather Conditions sensor enabled. |
| switch.macs_weather_conditions_exceptional | switch | Toggle exceptional condition. | Weather Conditions sensor enabled. |

### Services
| Service | Purpose |
| --- | --- |
| macs.set_mood | Set the mood (select.macs_mood). |
| macs.set_brightness | Set brightness (number.macs_brightness). |
| macs.set_temperature | Set temperature intensity (number.macs_temperature). |
| macs.set_windspeed | Set wind speed intensity (number.macs_windspeed). |
| macs.set_precipitation | Set precipitation intensity (number.macs_precipitation). |
| macs.set_battery_charge | Set battery charge (number.macs_battery_charge). |
| macs.set_animations_enabled | Toggle animations (switch.macs_animations_enabled). |
| macs.set_charging | Toggle charging (switch.macs_charging). |
| macs.set_weather_conditions_snowy | Toggle snowy condition. |
| macs.set_weather_conditions_cloudy | Toggle cloudy condition. |
| macs.set_weather_conditions_rainy | Toggle rainy condition. |
| macs.set_weather_conditions_windy | Toggle windy condition. |
| macs.set_weather_conditions_sunny | Toggle sunny condition. |
| macs.set_weather_conditions_stormy | Toggle stormy condition. |
| macs.set_weather_conditions_foggy | Toggle foggy condition. |
| macs.set_weather_conditions_hail | Toggle hail condition. |
| macs.set_weather_conditions_lightning | Toggle lightning condition. |
| macs.set_weather_conditions_partlycloudy | Toggle partly cloudy condition. |
| macs.set_weather_conditions_pouring | Toggle pouring condition. |
| macs.set_weather_conditions_clear_night | Toggle clear night condition. |
| macs.set_weather_conditions_exceptional | Toggle exceptional condition. |
| macs.send_user_message | Add a user dialogue bubble. |
| macs.send_assistant_message | Add an assistant dialogue bubble. |
<br><br>


## Roadmap
Macs is currently under active development.

Feedback is welcome and valuable:
- Bugs -> open an issue
- Videos/screenshots -> massively helpful
- Platform quirks -> especially tablets
<br><br>


## License
MIT License  
Fork it. Modify it. Improve it.  
Just don't be a dick.
<br><br>


## Support Macs
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to support my work.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>
