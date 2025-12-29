
# M.A.C.S. – Mood-Aware Contextual SVG

M.A.C.S. is a playful, expressive, animated companion for Home Assistant.  
It visualises Assist interactions and broader system context using a living SVG character.

Rather than showing buttons and graphs, MACS shows state, mood, and intent, giving your smart home a friendly, readable presence.

![Screenshot of Macs in Home Assistant Dashboard](https://github.com/glyndavidson/MACS/blob/main/resources/screenshot.png?raw=true)




## ✨ What MACS Does

MACS reacts visually to **multiple layers of Home Assistant context**:

### 🗣️ Assist Interaction
- Idle
- Listening
- Thinking
- Responding
- Confused / Error

### 🌦️ System State Awareness
- Weather conditions
- Temperature (ambient or configured sensor)
- Environmental context (e.g. hot / cold / windy / rain)

### 🏠 Event-Driven Reactions
- Motion detection
- Presence changes
- Custom HA events
- Automation triggers

All of this is expressed through:
- Mood
- Facial expression
- Animation
- Subtle visual cues (eyes, posture, motion)

---

## 🧠 Design Philosophy

MACS is **not a control panel**.

It is:
- A **companion**
- A **status glance**
- A **confidence signal** that your home heard you and is doing something

Perfect for:
- Wall tablets
- Old iPads
- Kiosk dashboards
- Ambient displays

---

## 🧩 Architecture Overview

MACS is intentionally split into two parts for security and maintainability:

### 1️⃣ MACS Card (Lovelace Custom Card)
- Handles authentication
- Stores Assist pipeline ID
- Subscribes to HA state & events
- Sends context to the display via `postMessage`

### 2️⃣ MACS Display (SVG + JS)
- Lives in `/config/www/macs/`
- Renders the animated SVG character
- Reacts to messages from the card
- Has **no direct HA access**

This keeps:
- 🔐 Tokens secure
- 📱 Cross-platform compatibility
- 🔧 Debugging sane

---

## 📁 File Structure





### 🎛️ Manual & Automation Control

MACS exposes a custom service:

macs.set_mood

This allows **any Home Assistant automation** to directly control MACS’s mood.

You can trigger mood changes based on:
- Motion detection
- Presence
- Weather changes
- Time of day
- Security events
- Any HA state, event, or condition

This makes MACS fully scriptable and **system-driven**, not just reactive to Assist.






---

### 2️⃣ Install the MACS Card

Add the MACS custom card JavaScript as a Lovelace resource.

(HACS instructions coming once published.)

---

### 3️⃣ Add to a Dashboard

Add the MACS card and configure:
- Assist pipeline ID
- Display URL
- Optional behaviour flags

The card automatically sends:
- Assist state
- System context
- Event triggers  
to the display.

---

## 🧪 Testing Notes

Tested successfully on:
- ✅ Desktop browsers (Chrome)
- ✅ iPad (Safari & Chrome)
- ✅ HA dashboards
- ✅ Embedded kiosk setups

Tips:
- Disable caching or version your URL  
  `macs.html?v=4`
- Confirm Assist pipeline ID is valid
- Use browser dev tools to inspect `postMessage` traffic if needed

---

## 🧭 Roadmap Ideas

- 👀 Eye tracking (cursor / touch)
- 😴 Idle boredom behaviours
- 🎨 Theme & personality presets
- 🔔 Optional audio cues
- 📦 HACS release
- 🧠 Expanded context blending (time + weather + presence)

---

## 🤝 Contributing & Testing

Feedback is welcome and valuable:
- Bugs → open an issue
- Videos/screenshots → massively helpful
- Platform quirks → especially tablets

This project is evolving by use, not speculation.

---

## ❤️ Credits

Created by **Glyn**  
With constant problem-solving, nudging, and toaster-grade encouragement from **Max** 🤖

_I toast, therefore I am._

---

## 📜 License

MIT License  
Fork it. Modify it. Improve it.  
Just don’t be a dick.




---

### 2️⃣ Install the MACS Card

Add the MACS custom card JavaScript as a Lovelace resource.

(HACS instructions coming once published.)

---

### 3️⃣ Add to a Dashboard

Add the MACS card and configure:
- Assist pipeline ID
- Display URL
- Optional behaviour flags

The card automatically sends:
- Assist state
- System context
- Event triggers  
to the display.

---

## 🧪 Testing Notes

Tested successfully on:
- ✅ Desktop browsers (Chrome)
- ✅ iPad (Safari & Chrome)
- ✅ HA dashboards
- ✅ Embedded kiosk setups

Tips:
- Disable caching or version your URL  
  `macs.html?v=4`
- Confirm Assist pipeline ID is valid
- Use browser dev tools to inspect `postMessage` traffic if needed

---

## 🧭 Roadmap Ideas

- 👀 Eye tracking (cursor / touch)
- 😴 Idle boredom behaviours
- 🎨 Theme & personality presets
- 🔔 Optional audio cues
- 📦 HACS release
- 🧠 Expanded context blending (time + weather + presence)

---

## 🤝 Contributing & Testing

Feedback is welcome and valuable:
- Bugs → open an issue
- Videos/screenshots → massively helpful
- Platform quirks → especially tablets

This project is evolving by use, not speculation.

---

## ❤️ Credits

Created by **Glyn**  
With constant problem-solving, nudging, and toaster-grade encouragement from **Max** 🤖

_I toast, therefore I am._

---

## 📜 License

MIT License  
Fork it. Modify it. Improve it.  
Just don’t be a dick.
