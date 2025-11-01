# LLM Town

---
# ✅ AUTOMATED VERSION CONTROL ✅

**Good news: version.txt updates are now AUTOMATED in the GitHub Actions workflow!**

When you push to `claude/**` branches:
1. GitHub Actions automatically updates `version.txt` with a timestamp
2. Commits the change to your branch
3. Merges to `main` and deploys

**No manual setup required!** The cache busting system works out of the box.

---

### 🔧 Optional: Local Pre-commit Hook

For direct commits to `main` (rare), you can optionally install a local hook:

```bash
./install-hooks.sh
```

This is **not required** for the normal `claude/**` workflow, which handles versioning automatically.

---

## Project Overview
A 2D survival scene visualization with procedurally generated trees, grass, a bonfire, a character, and a wolf. Built as a Progressive Web App optimized for iOS devices. All art assets are stored as separate SVG files for easy editing.

**Navigation**: Code uses section markers for easy navigation. Search for `// === SECTION NAME ===` patterns in code files. See "Code Structure" below for all markers.

## Quick Reference

### Making Changes
1. **Edit code** - Main logic is in `main.js`
2. **Commit** - Commit your changes (version.txt will be handled by GitHub Actions)
3. **Push to `claude/**` branch** - Workflow auto-updates `version.txt`, merges to `main`, and deploys

### Key Files
- **`main.js`** - Scene rendering, entity system, tree/grass generation, SVG loader
- **`index.html`** - Entry point, cache busting loader, iOS optimizations
- **`console.js`** - Debug console (🐛 button in bottom-right)
- **`assets/`** - SVG art files for all game entities (tree, grass, bonfire, character, wolf)
- **`version.txt`** - Cache-busting timestamp (auto-updated by git hook)
- **`manifest.json`** - PWA config for iOS "Add to Home Screen"

### Code Structure (main.js)

Code is organized with clear section markers. Search for these to navigate:

**`// === AUTO-RELOAD SYSTEM ===`**
- Version checking every 2 seconds (`VERSION_CHECK_INTERVAL`)
- Shows reload button when new version detected
- Reload button in `index.html`

**`// === SVG COMPONENTS ===`**
- SVG art assets loaded from `./assets/` directory at startup
- Async loader: `loadSVGComponents()` fetches all SVG files
- Each component function accepts scale parameter
- Components: `tree`, `grass`, `bonfire`, `character`, `wolf`
- Layered shapes for visual depth

**`// === ENTITY SYSTEM ===`**
- `Entity` class stores type, position (x, y), and scale
- All entities use same `render()` method
- Entities sorted by Y position for depth ordering

**`// === SCENE GENERATION ===`**
Main scene setup in `initScene()`:
- Character height scales to 1/20 of screen height
- Bonfire placed at center-bottom (50% X, 65% Y)
- Character positioned to bonfire's right

**Sub-section: `// --- Tree Placement ---`**
- 15-25 trees randomly placed with spacing enforcement
- `minHorizontalSpacing`: 80px minimum
- `minVerticalSpacing`: 150px minimum (larger vertical spacing)
- `maxAttempts`: 50 retry attempts per tree
- Trees avoid 75px radius around bonfire

**Sub-section: `// --- Grass Placement ---`**
- 10-15 grass patches randomly scattered
- No spacing constraints

**`// === RENDERING ===`**
- SVG canvas with all entities
- Entities pre-sorted by Y for correct layering

**`// === INITIALIZATION ===`**
- Debug console setup
- Version checking start
- Canvas creation and scene initialization

## Automated Systems

### ✅ Auto-promotion Workflow (with automatic versioning)
**File**: `.github/workflows/autopromote.yml`
**Trigger**: Push to any `claude/**` branch

**What it does:**
1. **Updates version.txt** - Generates timestamp and commits to your branch
2. **Merges to main** - Automatically merges your branch into `main`
3. **Deploys** - GitHub Pages serves the new version immediately

**Why this is great:**
- ✅ No manual setup required
- ✅ Works in any environment (immune to resets)
- ✅ Can't be forgotten
- ✅ Cache busting always works

**Version update logic:**
```bash
# Generates millisecond timestamp
date +%s%3N > version.txt
# Commits and pushes to claude/** branch
# Then merges to main
```

### ⚙️ Local Pre-commit Hook (optional backup)
**File**: `.githooks/pre-commit` (tracked in git)
**Purpose**: Updates `version.txt` for direct commits to `main`
**Setup**: `./install-hooks.sh` (runs `git config core.hooksPath .githooks`)

**When needed:**
- Only for direct commits to `main` (bypassing `claude/**` workflow)
- Not required for normal development workflow
- Immune to being "lost" (hook file is tracked in git)

### ✅ Branch Cleanup
**File**: `.github/workflows/cleanup-old-branches.yml`
**Schedule**: Daily at 3am UTC
**Action**: Deletes `claude/**` branches older than 24 hours
**Manual**: Can trigger via GitHub Actions UI

## Cache Busting System

**How it works:**
1. `index.html` fetches `version.txt` (bypassing cache)
2. Appends `?v=<timestamp>` to `main.js` import
3. Browser treats each version as new file, no stale cache

**Example:**
```javascript
// Loads: ./main.js?v=1761844854000
s.src = `./main.js?v=${encodeURIComponent(version)}`;
```

**Note**: Only `main.js` needs explicit versioning. ES6 imports inherit the cache-busted URL automatically.

## iOS Optimizations

### PWA Support
- Add to Home Screen via Safari
- Runs fullscreen without browser UI
- Configured in `manifest.json`

### Safe Areas
- CSS `env(safe-area-inset-*)` handles notch, home indicator, screen edges
- All UI elements (including debug console) respect safe areas

### Touch Handling
- Disabled double-tap zoom (`touch-action: manipulation`)
- Disabled text selection and callouts
- Disabled tap highlights
- Prevented pull-to-refresh

### Keyboard Protection
- `position: fixed` on html/body
- Virtual keyboard doesn't resize viewport
- Game canvas stays full-size

## Debug Console

**Access**: Click 🐛 button (bottom-right corner)
**Captures**: `console.log`, `console.info`, `console.debug`, `console.warn`, `console.error`
**History**: Last 100 messages with timestamps and color coding
**Use case**: Essential for mobile debugging without DevTools

**To disable**: Remove `console.js` import from `main.js`

## SVG Assets

All game art is stored as separate SVG files in the `./assets/` directory. This keeps the code clean and makes art easier to edit.

### Asset Structure
```
assets/
├── tree.svg          # Forest tree (layered ellipses + trunk)
├── grass.svg         # Grass patches (curved paths)
├── bonfire.svg       # Campfire with flames
├── character.svg     # Player character
└── wolf.svg          # Wolf creature (side view)
```

### How It Works
1. **Startup**: `loadSVGComponents()` fetches all SVG files asynchronously
2. **Parsing**: SVG content is extracted and wrapped in scale transform
3. **Usage**: Components accessed via `SVG_COMPONENTS[type](scale)`
4. **Rendering**: Entity system uses these functions to render game objects

### SVG File Format
- Each SVG file is a standalone, complete SVG document
- Use appropriate `viewBox` to center the art around origin
- Keep designs relative to (0,0) center point for proper positioning
- Use layered shapes for depth and visual appeal

## Common Tasks

### Add New Entity Type
1. **Create SVG file** in `./assets/` directory (e.g., `bear.svg`)
   - Use proper viewBox centered around the entity
   - Keep art centered at (0,0) for correct positioning
2. **Register in main.js**: Add entry to `SVG_ASSETS` object
   ```javascript
   const SVG_ASSETS = {
     // ... existing entries
     bear: './assets/bear.svg'
   };
   ```
3. **Use in scene**: In `// === SCENE GENERATION ===`, create entity
   ```javascript
   entities.push(new Entity('bear', x, y, scale));
   ```
4. Entities auto-render based on `type` property

### Edit Existing Art
1. Open the SVG file in `./assets/` (e.g., `./assets/wolf.svg`)
2. Edit the SVG using any text editor or SVG editor
3. Save and refresh - changes appear immediately (cache busting active)
4. No need to modify `main.js` for art changes

### Adjust Tree Spacing
1. Find `// --- Tree Placement ---` section
2. Edit `minHorizontalSpacing` and `minVerticalSpacing` constants
3. Edit `maxAttempts` for placement retry limit

### Change Scene Layout
1. Find `// === SCENE GENERATION ===` section
2. Modify positions in `initScene()` function
3. Note: Bonfire position affects character placement (relative positioning)
4. Note: Trees avoid bonfire radius check

### Update Auto-reload Frequency
1. Find `// === AUTO-RELOAD SYSTEM ===` section
2. Edit `VERSION_CHECK_INTERVAL` constant
3. Default: 2000ms (2 seconds)

## Deployment

**GitHub Pages Setup:**
1. Settings → Pages → Deploy from branch
2. Select `main` branch
3. Push to any `claude/**` branch → auto-deploys

**iOS Installation:**
1. Open in Safari
2. Share → Add to Home Screen
3. Launch from home screen for fullscreen PWA

## File Structure
```
.
├── .github/workflows/
│   ├── autopromote.yml           # Auto-merge claude/** → main + version.txt update
│   └── cleanup-old-branches.yml  # Daily branch cleanup
├── .githooks/
│   └── pre-commit                # Optional: auto-updates version.txt locally
├── assets/                       # SVG art files
│   ├── tree.svg                  # Tree sprite
│   ├── grass.svg                 # Grass sprite
│   ├── bonfire.svg               # Bonfire sprite
│   ├── character.svg             # Character sprite
│   └── wolf.svg                  # Wolf sprite
├── hooks/                        # Legacy - can be removed
│   └── pre-commit                # Old hook location
├── install-hooks.sh              # Optional: git config core.hooksPath .githooks
├── index.html                    # Entry point + cache busting
├── main.js                       # Scene logic, entities, rendering, SVG loader
├── console.js                    # Debug console module
├── config.js                     # Game configuration values
├── manifest.json                 # PWA configuration
├── icon-512.svg                  # App icon
├── version.txt                   # Build version (auto-updated by GitHub Actions)
└── CLAUDE.md                     # This file
```
