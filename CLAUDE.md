# LLM Town

## Project Overview
A 2D survival scene visualization with procedurally generated trees, grass, a bonfire, and character. Built as a Progressive Web App optimized for iOS devices.

## Quick Reference

### Making Changes
1. **Edit code** - Main logic is in `main.js`
2. **Commit** - Pre-commit hook auto-updates `version.txt` for cache busting
3. **Push to `claude/**` branch** - Auto-promotes to `main` and deploys via GitHub Pages

### Key Files
- **`main.js`** - Scene rendering, entity system, tree/grass generation (main.js:109-232)
- **`index.html`** - Entry point, cache busting loader, iOS optimizations
- **`console.js`** - Debug console (🐛 button in bottom-right)
- **`version.txt`** - Cache-busting timestamp (auto-updated by git hook)
- **`manifest.json`** - PWA config for iOS "Add to Home Screen"

### Project Architecture

**Entity System** (main.js:110-122)
- `Entity` class stores type, position (x, y), and scale
- Types: `tree`, `grass`, `bonfire`, `character`
- Entities sorted by Y position for depth ordering (main.js:173)

**Scene Generation** (main.js:128-176)
- Character height scales to 1/20 of screen height
- Bonfire placed at center-bottom (50% X, 65% Y)
- Character positioned to bonfire's right
- Trees: 15-25 randomly placed with spacing checks
  - Horizontal spacing: 80px minimum
  - Vertical spacing: 150px minimum (increased for better distribution)
  - Max 50 placement attempts per tree
  - Trees avoid 75px radius around bonfire
- Grass: 10-15 patches randomly scattered

**SVG Components** (main.js:64-107)
- Reusable SVG generators with scale parameter
- Layered shapes for visual depth
- Trees use multiple overlapping ellipses
- Bonfire has animated-looking flames (3 layers)

## Automated Systems

### ✅ Pre-commit Hook (INSTALLED)
**Location**: `.git/hooks/pre-commit`
**Function**: Auto-updates `version.txt` with timestamp on every commit
**Status**: Active and tested
**Why**: Ensures cache busting works without manual version.txt edits

### ✅ Auto-promotion Workflow
**File**: `.github/workflows/autopromote.yml`
**Trigger**: Push to any `claude/**` branch
**Action**: Automatically merges to `main` branch
**Result**: Deploys to GitHub Pages immediately

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

## Common Tasks

### Add New Entity Type
1. Add SVG component to `SVG_COMPONENTS` (main.js:65-107)
2. Create entity in `initScene()` with `new Entity(type, x, y, scale)`
3. Entities auto-render based on `type` property

### Adjust Tree Spacing
- Edit `minHorizontalSpacing` and `minVerticalSpacing` (main.js:151-152)
- Edit `maxAttempts` for placement retry limit (main.js:153)

### Change Scene Layout
- Modify positions in `initScene()` (main.js:128-176)
- Bonfire position affects character placement (relative positioning)
- Trees avoid bonfire radius (line 158-169)

### Update Auto-reload Frequency
- Edit `VERSION_CHECK_INTERVAL` (main.js:8)
- Default: 2000ms (2 seconds)

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
│   ├── autopromote.yml           # Auto-merge claude/** → main
│   └── cleanup-old-branches.yml  # Daily branch cleanup
├── .git/hooks/
│   └── pre-commit                # Auto-updates version.txt ✅ INSTALLED
├── index.html                    # Entry point + cache busting
├── main.js                       # Scene logic, entities, rendering
├── console.js                    # Debug console module
├── manifest.json                 # PWA configuration
├── icon-512.svg                  # App icon
├── version.txt                   # Build version (auto-updated)
└── CLAUDE.md                     # This file
```
