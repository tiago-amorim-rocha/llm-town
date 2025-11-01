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
// SVG COMPONENTS (Loaded from external files)
// ============================================================

// SVG components will be loaded from ./assets/ directory
// This object will be populated by loadSVGComponents()
const SVG_COMPONENTS = {};

// SVG asset definitions
const SVG_ASSETS = {
  tree: './assets/tree.svg',
  grass: './assets/grass.svg',
  bonfire: './assets/bonfire.svg',
  character: './assets/character.svg',
  wolf: './assets/wolf.svg'
};

// Load a single SVG file and return its content
async function loadSVG(name, path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${name}: ${response.statusText}`);
    }
    const svgText = await response.text();

    // Parse the SVG to extract its inner content
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');

    if (!svgElement) {
      throw new Error(`Invalid SVG file: ${name}`);
    }

    // Get the inner content of the SVG (everything inside <svg>...</svg>)
    const innerContent = svgElement.innerHTML;

    // Return a function that wraps the content with scale transform
    return (scale = 1) => `<g transform="scale(${scale})">${innerContent}</g>`;
  } catch (error) {
    console.error(`Error loading SVG ${name}:`, error);
    // Return a placeholder function that shows an error
    return (scale = 1) => `<g transform="scale(${scale})"><text x="0" y="0" fill="red" font-size="12">Error: ${name}</text></g>`;
  }
}

// Load all SVG components
async function loadSVGComponents() {
  console.log('📦 Loading SVG assets...');
  const loadPromises = Object.entries(SVG_ASSETS).map(async ([name, path]) => {
    SVG_COMPONENTS[name] = await loadSVG(name, path);
    console.log(`  ✓ Loaded ${name}.svg`);
  });

  await Promise.all(loadPromises);
  console.log('✅ All SVG assets loaded');
}

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
let wolfEntity = null; // Reference to the wolf entity

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
  if (!characterEntity || entity === characterEntity || entity === wolfEntity) return true;
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

// Wolf movement state
let wolfDirection = { x: 0, y: 0 };
let lastWolfDirectionChange = Date.now();

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

// Update wolf position (moves 50% faster than character)
function updateWolfPosition() {
  if (!wolfEntity) return;

  const wolfSpeed = MOVEMENT_SPEED * 1.5; // 50% faster than character

  // Change direction periodically
  if (Date.now() - lastWolfDirectionChange > DIRECTION_CHANGE_INTERVAL) {
    wolfDirection = randomDirection();
    lastWolfDirectionChange = Date.now();
  }

  // Update position
  const newX = wolfEntity.x + wolfDirection.x * wolfSpeed;
  const newY = wolfEntity.y + wolfDirection.y * wolfSpeed;

  // Keep within bounds with padding
  const padding = 50;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (newX >= padding && newX <= width - padding) {
    wolfEntity.x = newX;
  } else {
    wolfDirection.x *= -1; // Bounce off edge
  }

  if (newY >= padding && newY <= height - padding) {
    wolfEntity.y = newY;
  } else {
    wolfDirection.y *= -1; // Bounce off edge
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

  // Place wolf randomly in the forest
  const wolfX = Math.random() * width;
  const wolfY = Math.random() * height * 0.7; // Keep in upper 70% of screen
  const wolfScale = characterScale * 1.2; // Slightly larger than character
  wolfEntity = new Entity('wolf', wolfX, wolfY, wolfScale);
  entities.push(wolfEntity);

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

async function init() {
  // Initialize debug console FIRST
  debugConsole.init();

  console.log('🚀 Application loaded!');
  console.log('📦 Build version:', window.__BUILD || 'unknown');

  // Load SVG assets before initializing scene
  await loadSVGComponents();

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
    updateWolfPosition();
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
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

// Export for other modules if needed
export { init };
