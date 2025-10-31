// Main application entry point
// This file is loaded with cache busting via index.html
// Pre-commit hook now configured for automatic version.txt updates

import * as debugConsole from './console.js';

// ============================================================
// AUTO-RELOAD SYSTEM
// ============================================================

// Version checking configuration
const VERSION_CHECK_INTERVAL = 2000; // Check every 2 seconds
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
  entities.push(new Entity('character', characterX, characterY, characterScale));

  // --- Tree Placement ---
  // Generate random trees (15-25 trees) with spacing enforcement
  const treeCount = 15 + Math.floor(Math.random() * 11);
  const minHorizontalSpacing = 80; // Minimum horizontal distance between trees
  const minVerticalSpacing = 150; // Larger vertical spacing
  const maxAttempts = 50; // Max attempts to place each tree

  for (let i = 0; i < treeCount; i++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.8; // Keep in upper 80%
      const scale = 0.6 + Math.random() * 0.6; // Scale between 0.6-1.2 (1.5x larger than before)

      // Avoid placing too close to bonfire area
      const distToBonfire = Math.sqrt((x - bonfireX) ** 2 + (y - bonfireY) ** 2);
      if (distToBonfire <= 75) { // 50 * 1.5
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
  // Generate random grass patches (10-15)
  const grassCount = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < grassCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const scale = 0.45 + Math.random() * 0.6; // Scale between 0.45-1.05 (1.5x larger than before)
    entities.push(new Entity('grass', x, y, scale));
  }

  // Sort entities by Y position for proper depth ordering
  entities.sort((a, b) => a.y - b.y);

  render();
}

// ============================================================
// RENDERING
// ============================================================

function render() {
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1a3d1a"/>
      ${entities.map(e => e.render()).join('')}
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
