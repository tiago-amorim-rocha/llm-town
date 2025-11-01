// Main application entry point
// This file is loaded with cache busting via index.html
// Pre-commit hook now configured for automatic version.txt updates

import * as debugConsole from './console.js';
import * as config from './config.js';

// ============================================================
// AUTO-RELOAD SYSTEM
// ============================================================

// Version checking configuration
const VERSION_CHECK_INTERVAL = config.VERSION_CHECK_INTERVAL;
let initialVersion = window.__BUILD;
let versionCheckCount = 0;

// Version checking function
async function checkForNewVersion() {
  versionCheckCount++;

  try {
    const res = await fetch('./version.txt', { cache: 'no-store' });
    if (!res.ok) {
      if (versionCheckCount % 10 === 0) {
        console.warn('Version check failed: Could not fetch version.txt');
      }
      return;
    }

    const currentVersion = (await res.text()).trim();

    // Log every 10 checks for debugging
    if (versionCheckCount % 10 === 0) {
      console.log(`Version check #${versionCheckCount}: current=${currentVersion}, initial=${initialVersion}`);
    }

    // Check if version has changed
    if (currentVersion !== initialVersion && initialVersion) {
      console.log(`🔄 New version detected! Current: ${currentVersion}, Initial: ${initialVersion}`);
      showReloadButton();
    }
  } catch (err) {
    if (versionCheckCount % 10 === 0) {
      console.warn('Version check error:', err.message);
    }
  }
}

// Show reload button
function showReloadButton() {
  const reloadButton = document.getElementById('reload-button');
  if (reloadButton && !reloadButton.classList.contains('show')) {
    reloadButton.classList.add('show');
    console.log('✨ Reload button shown - new version available');
  }
}

// Initialize reload button click handler
function initReloadButton() {
  const reloadButton = document.getElementById('reload-button');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      console.log('🔄 Reloading application...');
      window.location.reload(true);
    });
  }
}

// ============================================================
// SVG COMPONENTS
// ============================================================

const SVG_COMPONENTS = {
  tree: (scale = 1) => `
    <g transform="scale(${scale})">
      <ellipse cx="0" cy="-30" rx="20" ry="25" fill="#1a4d2e" opacity="0.8"/>
      <ellipse cx="-10" cy="-35" rx="18" ry="20" fill="#2d5f3f" opacity="0.9"/>
      <ellipse cx="10" cy="-35" rx="18" ry="20" fill="#1f5234" opacity="0.9"/>
      <rect x="-4" y="-10" width="8" height="15" fill="#3d2817"/>
    </g>
  `,

  grass: (scale = 1) => `
    <g transform="scale(${scale})">
      <path d="M -5,0 Q -6,-8 -5,-12" stroke="#3d6b3d" stroke-width="1.5" fill="none"/>
      <path d="M 0,0 Q -1,-10 0,-14" stroke="#4a7c4a" stroke-width="1.5" fill="none"/>
      <path d="M 5,0 Q 6,-7 5,-11" stroke="#3d6b3d" stroke-width="1.5" fill="none"/>
    </g>
  `,

  bonfire: (scale = 1) => `
    <g transform="scale(${scale})">
      <ellipse cx="0" cy="5" rx="20" ry="8" fill="#2d2d2d" opacity="0.5"/>
      <rect x="-12" y="-5" width="5" height="12" fill="#4a3728" transform="rotate(-15 -9.5 1)"/>
      <rect x="7" y="-5" width="5" height="12" fill="#5a3d28" transform="rotate(15 9.5 1)"/>
      <rect x="-4" y="-3" width="8" height="10" fill="#4a3728"/>
      <path d="M 0,-10 Q -5,-20 -3,-28 Q -1,-22 0,-25 Q 1,-22 3,-28 Q 5,-20 0,-10" fill="#ff6b1a" opacity="0.9"/>
      <path d="M 0,-12 Q -3,-18 -2,-23 Q -1,-19 0,-21 Q 1,-19 2,-23 Q 3,-18 0,-12" fill="#ffa51a" opacity="0.9"/>
      <path d="M 0,-14 Q -2,-18 -1,-21 Q 0,-18 0,-19 Q 0,-18 1,-21 Q 2,-18 0,-14" fill="#ffdd1a" opacity="0.8"/>
    </g>
  `,

  character: (scale = 1) => `
    <g transform="scale(${scale})">
      <circle cx="0" cy="-25" r="8" fill="#ffdbac"/>
      <ellipse cx="0" cy="-15" rx="10" ry="12" fill="#5588dd"/>
      <rect x="-10" y="-15" width="6" height="14" fill="#5588dd" rx="3"/>
      <rect x="4" y="-15" width="6" height="14" fill="#5588dd" rx="3"/>
      <rect x="-6" y="-3" width="5" height="12" fill="#4a4a4a" rx="2"/>
      <rect x="1" y="-3" width="5" height="12" fill="#4a4a4a" rx="2"/>
      <circle cx="-3" cy="-26" r="2" fill="#3d2817"/>
      <circle cx="3" cy="-26" r="2" fill="#3d2817"/>
    </g>
  `
};

// ============================================================
// ENTITY SYSTEM
// ============================================================

class Entity {
  constructor(type, x, y, scale = 1) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  render() {
    const svg = SVG_COMPONENTS[this.type](this.scale);
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }
}

// Game state
let entities = [];
let canvas = null;
let characterEntity = null; // Reference to the character entity

// ============================================================
// DAY/NIGHT CYCLE
// ============================================================

// Day/night configuration - imported from config.js
const DAY_DURATION = config.DAY_DURATION;
const DUSK_DURATION = config.DUSK_DURATION;
const NIGHT_DURATION = config.NIGHT_DURATION;
const DAWN_DURATION = config.DAWN_DURATION;
const DAY_NIGHT_CYCLE_DURATION = config.DAY_NIGHT_CYCLE_DURATION;

const DAY_VISIBILITY_RADIUS = config.DAY_VISIBILITY_RADIUS;   // Halved visibility
const NIGHT_VISIBILITY_RADIUS = config.NIGHT_VISIBILITY_RADIUS; // Halved visibility
let cycleStartTime = Date.now();

// Ease-in-out function for smooth transitions
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Get current cycle state and progress
function getCycleState() {
  const elapsed = Date.now() - cycleStartTime;
  const cycleTime = elapsed % DAY_NIGHT_CYCLE_DURATION;

  if (cycleTime < DAY_DURATION) {
    // Day: 0-20s
    return { state: 'day', progress: cycleTime / DAY_DURATION };
  } else if (cycleTime < DAY_DURATION + DUSK_DURATION) {
    // Dusk: 20-30s
    const duskTime = cycleTime - DAY_DURATION;
    return { state: 'dusk', progress: duskTime / DUSK_DURATION };
  } else if (cycleTime < DAY_DURATION + DUSK_DURATION + NIGHT_DURATION) {
    // Night: 30-50s
    const nightTime = cycleTime - DAY_DURATION - DUSK_DURATION;
    return { state: 'night', progress: nightTime / NIGHT_DURATION };
  } else {
    // Dawn: 50-60s
    const dawnTime = cycleTime - DAY_DURATION - DUSK_DURATION - NIGHT_DURATION;
    return { state: 'dawn', progress: dawnTime / DAWN_DURATION };
  }
}

// Get current visibility radius based on cycle state
function getVisibilityRadius() {
  const { state, progress } = getCycleState();

  switch (state) {
    case 'day':
      return DAY_VISIBILITY_RADIUS; // Full visibility

    case 'dusk':
      // Transition from day to night with ease-in-out
      const duskProgress = easeInOutCubic(progress);
      return DAY_VISIBILITY_RADIUS - (DAY_VISIBILITY_RADIUS - NIGHT_VISIBILITY_RADIUS) * duskProgress;

    case 'night':
      return NIGHT_VISIBILITY_RADIUS; // Minimal visibility

    case 'dawn':
      // Transition from night to day with ease-in-out
      const dawnProgress = easeInOutCubic(progress);
      return NIGHT_VISIBILITY_RADIUS + (DAY_VISIBILITY_RADIUS - NIGHT_VISIBILITY_RADIUS) * dawnProgress;

    default:
      return DAY_VISIBILITY_RADIUS;
  }
}

// Get darkness overlay opacity based on cycle state
function getDarknessOpacity() {
  const { state, progress } = getCycleState();
  const maxDarkness = config.MAX_DARKNESS_OPACITY; // Reduced for better visibility

  switch (state) {
    case 'day':
      return 0; // No darkness during day

    case 'dusk':
      // Transition from light to dark with ease-in-out
      const duskProgress = easeInOutCubic(progress);
      return maxDarkness * duskProgress;

    case 'night':
      return maxDarkness; // Full darkness at night

    case 'dawn':
      // Transition from dark to light with ease-in-out
      const dawnProgress = easeInOutCubic(progress);
      return maxDarkness * (1 - dawnProgress);

    default:
      return 0;
  }
}

// ============================================================
// VISIBILITY SYSTEM
// ============================================================

// Track which entities are currently visible
let visibleEntities = new Set();

// Calculate distance between two points
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Check if an entity is within visibility range of the character
function isEntityVisible(entity) {
  if (!characterEntity || entity === characterEntity) return true;
  const dist = distance(characterEntity.x, characterEntity.y, entity.x, entity.y);
  return dist <= getVisibilityRadius();
}

// Update visibility for all entities
function updateVisibility() {
  const previouslyVisible = new Set(visibleEntities);
  visibleEntities.clear();

  for (const entity of entities) {
    if (isEntityVisible(entity)) {
      visibleEntities.add(entity);

      // Log when entity becomes visible
      if (!previouslyVisible.has(entity) && entity !== characterEntity) {
        const dist = distance(characterEntity.x, characterEntity.y, entity.x, entity.y);
        console.log(`👁️ ${entity.type} became visible at distance ${dist.toFixed(1)}px`);
      }
    } else {
      // Log when entity becomes invisible
      if (previouslyVisible.has(entity) && entity !== characterEntity) {
        console.log(`🌫️ ${entity.type} became invisible`);
      }
    }
  }
}

// ============================================================
// CHARACTER MOVEMENT
// ============================================================

// Movement configuration - imported from config.js
const MOVEMENT_SPEED = config.MOVEMENT_SPEED;
const DIRECTION_CHANGE_INTERVAL = config.DIRECTION_CHANGE_INTERVAL;
const MOVEMENT_UPDATE_INTERVAL = config.MOVEMENT_UPDATE_INTERVAL;

let currentDirection = { x: 0, y: 0 };
let lastDirectionChange = Date.now();

// Generate random direction
function randomDirection() {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

// Update character position
function updateCharacterPosition() {
  if (!characterEntity) return;

  // Change direction periodically
  if (Date.now() - lastDirectionChange > DIRECTION_CHANGE_INTERVAL) {
    currentDirection = randomDirection();
    lastDirectionChange = Date.now();
  }

  // Update position
  const newX = characterEntity.x + currentDirection.x * MOVEMENT_SPEED;
  const newY = characterEntity.y + currentDirection.y * MOVEMENT_SPEED;

  // Keep within bounds with padding
  const padding = 50;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (newX >= padding && newX <= width - padding) {
    characterEntity.x = newX;
  } else {
    currentDirection.x *= -1; // Bounce off edge
  }

  if (newY >= padding && newY <= height - padding) {
    characterEntity.y = newY;
  } else {
    currentDirection.y *= -1; // Bounce off edge
  }

  // Re-sort entities by Y position for proper depth ordering
  entities.sort((a, b) => a.y - b.y);
}

// ============================================================
// SCENE GENERATION
// ============================================================

function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear existing entities
  entities = [];

  // Calculate character height (1/20 of screen - 1.33x smaller than original)
  const characterHeight = height / 20;
  const characterScale = characterHeight / 50; // Base character height is ~50px

  // Place bonfire in lower-center area
  const bonfireX = width * 0.5;
  const bonfireY = height * 0.65;
  entities.push(new Entity('bonfire', bonfireX, bonfireY, 0.9)); // 0.6 * 1.5

  // Place character beside bonfire (to the right)
  const characterX = bonfireX + 37.5; // 25 * 1.5
  const characterY = bonfireY + 7.5; // 5 * 1.5
  characterEntity = new Entity('character', characterX, characterY, characterScale);
  entities.push(characterEntity);

  // --- Tree Placement ---
  // Generate random trees with spacing enforcement - config values
  const treeCount = config.TREE_COUNT_MIN + Math.floor(Math.random() * (config.TREE_COUNT_MAX - config.TREE_COUNT_MIN + 1));
  const minHorizontalSpacing = config.MIN_HORIZONTAL_SPACING;
  const minVerticalSpacing = config.MIN_VERTICAL_SPACING;
  const maxAttempts = config.MAX_PLACEMENT_ATTEMPTS;

  for (let i = 0; i < treeCount; i++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.8; // Keep in upper 80%
      const scale = 0.6 + Math.random() * 0.6; // Scale between 0.6-1.2 (1.5x larger than before)

      // Avoid placing too close to bonfire area
      const distToBonfire = Math.sqrt((x - bonfireX) ** 2 + (y - bonfireY) ** 2);
      if (distToBonfire <= config.BONFIRE_EXCLUSION_RADIUS) {
        attempts++;
        continue;
      }

      // Check distance from other trees
      let tooClose = false;
      for (const entity of entities) {
        if (entity.type === 'tree') {
          const dx = Math.abs(x - entity.x);
          const dy = Math.abs(y - entity.y);

          // Check if too close using different thresholds for X and Y
          if (dx < minHorizontalSpacing && dy < minVerticalSpacing) {
            tooClose = true;
            break;
          }
        }
      }

      if (!tooClose) {
        entities.push(new Entity('tree', x, y, scale));
        placed = true;
      }

      attempts++;
    }
  }

  // --- Grass Placement ---
  // Generate random grass patches - config values
  const grassCount = config.GRASS_COUNT_MIN + Math.floor(Math.random() * (config.GRASS_COUNT_MAX - config.GRASS_COUNT_MIN + 1));
  for (let i = 0; i < grassCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const scale = 0.45 + Math.random() * 0.6; // Scale between 0.45-1.05 (1.5x larger than before)
    entities.push(new Entity('grass', x, y, scale));
  }

  // Sort entities by Y position for proper depth ordering
  entities.sort((a, b) => a.y - b.y);

  // Initialize visibility
  updateVisibility();

  render();
}

// ============================================================
// RENDERING
// ============================================================

function render() {
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const visRadius = getVisibilityRadius();
  const darknessOpacity = getDarknessOpacity();

  // Render visible entities
  const visibleEntitySVG = entities
    .filter(e => visibleEntities.has(e))
    .map(e => e.render())
    .join('');

  // Render visibility circle around character
  const visibilityCircle = characterEntity ? `
    <circle
      cx="${characterEntity.x}"
      cy="${characterEntity.y}"
      r="${visRadius}"
      fill="none"
      stroke="#ffdd1a"
      stroke-width="2"
      stroke-dasharray="5,5"
      opacity="0.6"
    />
  ` : '';

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${config.BACKGROUND_COLOR}"/>

      <!-- Entities -->
      ${visibleEntitySVG}

      <!-- Visibility circle -->
      ${visibilityCircle}

      <!-- Darkness overlay for night -->
      <rect width="100%" height="100%" fill="#000000" opacity="${darknessOpacity}" pointer-events="none"/>
    </svg>
  `;
}

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
  // Initialize debug console FIRST
  debugConsole.init();

  console.log('🚀 Application loaded!');
  console.log('📦 Build version:', window.__BUILD || 'unknown');
  console.log('✨ Initializing survival scene...');

  // Initialize reload button and start version checking
  initReloadButton();
  setInterval(checkForNewVersion, VERSION_CHECK_INTERVAL);
  console.log(`🔍 Version checking enabled (every ${VERSION_CHECK_INTERVAL / 1000}s)`);

  // Create canvas container
  canvas = document.createElement('div');
  canvas.id = 'game-canvas';
  canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;';
  document.body.appendChild(canvas);

  // Initialize scene
  initScene();

  // Start game loop for movement and visibility updates
  setInterval(() => {
    updateCharacterPosition();
    updateVisibility();
    render();
  }, MOVEMENT_UPDATE_INTERVAL);

  console.log('🎮 Game loop started');
  console.log(`🌞 Day/night cycle: ${DAY_NIGHT_CYCLE_DURATION / 1000}s total`);
  console.log(`   Day: ${DAY_DURATION / 1000}s | Dusk: ${DUSK_DURATION / 1000}s | Night: ${NIGHT_DURATION / 1000}s | Dawn: ${DAWN_DURATION / 1000}s`);
  console.log(`👁️ Visibility: ${DAY_VISIBILITY_RADIUS}px (day) → ${NIGHT_VISIBILITY_RADIUS}px (night)`);

  // Handle window resize
  window.addEventListener('resize', () => {
    console.log('🔄 Window resized, regenerating scene...');
    initScene();
  });

  console.log('✅ Scene initialized with', entities.length, 'entities');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for other modules if needed
export { init };
