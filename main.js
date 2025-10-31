// Main application entry point
// This file is loaded with cache busting via index.html
// Pre-commit hook now configured for automatic version.txt updates

import * as debugConsole from './console.js';

// SVG Component Definitions
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

// Entity system
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

function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear existing entities
  entities = [];

  // Calculate character height (1/15 of screen)
  const characterHeight = height / 15;
  const characterScale = characterHeight / 50; // Base character height is ~50px

  // Place bonfire in lower-center area
  const bonfireX = width * 0.5;
  const bonfireY = height * 0.65;
  entities.push(new Entity('bonfire', bonfireX, bonfireY, 1.2));

  // Place character beside bonfire (to the right)
  const characterX = bonfireX + 50;
  const characterY = bonfireY + 10;
  entities.push(new Entity('character', characterX, characterY, characterScale));

  // Generate random trees (5-8 trees)
  const treeCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < treeCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.8; // Keep in upper 80%
    const scale = 0.8 + Math.random() * 0.8; // Scale between 0.8-1.6

    // Avoid placing too close to bonfire area
    const distToBonfire = Math.sqrt((x - bonfireX) ** 2 + (y - bonfireY) ** 2);
    if (distToBonfire > 100) {
      entities.push(new Entity('tree', x, y, scale));
    }
  }

  // Generate random grass patches (10-15)
  const grassCount = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < grassCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const scale = 0.6 + Math.random() * 0.8; // Scale between 0.6-1.4
    entities.push(new Entity('grass', x, y, scale));
  }

  // Sort entities by Y position for proper depth ordering
  entities.sort((a, b) => a.y - b.y);

  render();
}

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

// Example: Initialize your app
function init() {
  // Initialize debug console FIRST
  debugConsole.init();

  console.log('🚀 Application loaded!');
  console.log('📦 Build version:', window.__BUILD || 'unknown');
  console.log('✨ Initializing survival scene...');

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
