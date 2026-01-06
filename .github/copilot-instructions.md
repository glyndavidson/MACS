# M.A.C.S. (Mood-Aware Character SVG) - AI Coding Agent Instructions

## Project Overview
M.A.C.S. is a Home Assistant custom component that provides a Lovelace card displaying an animated SVG character that reacts to smart home states. The character shows moods, responds to voice interactions, and reflects environmental conditions through visual changes.

## Architecture Overview

### Backend (Python Integration)
- **Main Entry**: `custom_components/macs/__init__.py` - Integration setup, service registration, static file serving
- **Entities**: `entities.py` - All HA entity classes (select.macs_mood, number.macs_brightness, weather switches)
- **Platforms**: `select.py`, `number.py`, `switch.py` - Entity registration per platform
- **Config**: `config_flow.py` - Minimal config flow (no user options in v1)
- **Constants**: `const.py` - All service names, entity IDs, mood options

### Frontend (JavaScript Card)
- **Card Registration**: `www/macs.js` - Registers custom card with HA
- **Card Implementation**: `www/backend/MacsCard.js` - Main card logic, iframe management, HA state tracking
- **Character UI**: `www/frontend/` - HTML, CSS, JS for the animated SVG character
- **Shared Utilities**: `www/shared/` - Constants, debugging, postMessage communication

### Data Flow
1. HA entities update → Card backend detects changes → PostMessage to iframe
2. Assist pipeline events → Card backend → Mood/state changes → Visual updates
3. Sensor data → Card configuration → Character environmental reactions

## Key Patterns & Conventions

### Entity Naming & Services
- **Mood Control**: `select.macs_mood` with options: `["bored", "confused", "happy", "idle", "listening", "sad", "sleeping", "surprised", "thinking"]`
- **Brightness**: `number.macs_brightness` (0-100%)
- **Weather Controls**: Individual switches like `switch.macs_weather_conditions_snowy`
- **Services**: `macs.set_mood`, `macs.set_brightness`, etc. - all update corresponding entities

### Communication
- **PostMessage**: Backend-to-frontend communication via `MessagePoster` class
- **Event Handling**: `macs_message` events for conversation turns
- **State Tracking**: Real-time HA entity state monitoring

### Code Organization
- **Shadow DOM**: Card uses shadow root for CSS isolation
- **Async/Await**: Extensive use in Python for HA async patterns
- **Entity Restoration**: All entities inherit `RestoreEntity` for state persistence
- **Device Grouping**: All entities belong to single `MACS_DEVICE` for UI organization

## Development Workflow

### No Build Process
This is a pure Home Assistant integration - no compilation, bundling, or build tools required. Files are served directly from `custom_components/macs/www/`.

### Testing & Debugging
- **Debug Entity**: `select.macs_debug` with granular options (`"None"`, `"All"`, `"MacsCard.js"`, etc.)
- **Manual Testing**: Add card to HA dashboard, observe entity changes
- **Console Logging**: Use `createDebugger()` from `shared/debugger.js` for targeted logging

### Entity Migration
When adding new entities:
1. Create entity class in `entities.py` with proper `_attr_unique_id`
2. Add to appropriate platform file (`select.py`, `number.py`, `switch.py`)
3. Add migration logic in `__init__.py` `async_setup_entry()` for clean entity IDs
4. Register corresponding service in `__init__.py` with validation

### Frontend Development
- **Iframe Sandboxing**: Character runs in isolated iframe for security
- **Versioning**: Auto-appends `?v={version}` from `manifest.json` to prevent caching
- **Resource Loading**: All assets served via `/macs/` path from HA

## Integration Points

### Assist Pipeline
- Tracks conversation state (`listening`, `thinking`, `responding`)
- Maps states to moods automatically
- Handles message events for conversation display

### Sensor Integration
- Temperature, wind, precipitation sensors map to visual intensity (0-100%)
- Battery charge and charging state for device status
- Weather conditions as individual boolean switches

### Lovelace Resources
- Auto-registers `macs.js` as Lovelace resource with version parameter
- Supports both storage and YAML Lovelace modes

## Common Tasks

### Adding New Moods
1. Add to `MOODS` tuple in `const.py`
2. Update `MacsMoodSelect._attr_options` in `entities.py`
3. Update service validation in `__init__.py`

### Adding Weather Conditions
1. Create new switch entity class in `entities.py`
2. Add to `switch.py` platform
3. Add service registration in `__init__.py`
4. Add migration logic for entity ID cleanup

### Frontend Changes
- Modify files in `www/frontend/` for character appearance/behavior
- Use `www/shared/constants.js` for configuration
- Test via HA dashboard card reload

### Backend Changes
- Entity additions require platform updates and service registration
- Always include entity migration logic for clean IDs
- Test service calls via HA developer tools

## File Structure Reference
```
custom_components/macs/
├── __init__.py          # Integration setup, services, migrations
├── entities.py          # All entity class definitions
├── const.py             # Constants, service names, entity IDs
├── config_flow.py       # Configuration flow (minimal)
├── manifest.json        # Integration metadata
├── services.yaml        # Service definitions for HA
└── www/
    ├── macs.js              # Card registration
    ├── backend/
    │   ├── MacsCard.js      # Main card implementation
    │   ├── assistPipeline.js # Conversation tracking
    │   └── sensorHandler.js # Sensor data processing
    └── frontend/            # Character UI assets
        ├── macs.html        # Main character HTML
        ├── scripts/         # Character behavior JS
        └── styles/          # Character styling
```</content>
<parameter name="filePath">.github/copilot-instructions.md