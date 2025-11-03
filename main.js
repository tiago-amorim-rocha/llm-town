// Main application entry point
// This file is loaded with cache busting via index.html

import * as debugConsole from './console.js';
import * as config from './config.js';
import { Entity, DummyEntity, SmartEntity, Item } from './entities.js';
import { injectActions, getCollectionState } from './actions.js';
import { updateVisibility } from './visibility.js';
import { updateEntityPosition, initMovementState, clearMovementState } from './movement.js';
import { render } from './rendering.js';
import { updateNeeds } from './needs.js';

// ============================================================
// AUTO-RELOAD SYSTEM
// ============================================================

const VERSION_CHECK_INTERVAL = config.VERSION_CHECK_INTERVAL;
let initialVersion = window.__BUILD;
let versionCheckCount = 0;

async function checkForNewVersion() {
  versionCheckCount++;

  try {
    const res = await fetch('./version.txt', { cache: 'no-store' });
    if (!res.ok) {
      return;
    }

    const currentVersion = (await res.text()).trim();

    if (currentVersion !== initialVersion && initialVersion) {
      showReloadButton();
    }
  } catch (err) {
    // Silent failure
  }
}

function showReloadButton() {
  const reloadButton = document.getElementById('reload-button');
  if (reloadButton && !reloadButton.classList.contains('show')) {
    reloadButton.classList.add('show');
  }
}

function initReloadButton() {
  const reloadButton = document.getElementById('reload-button');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      window.location.reload(true);
    });
  }
}

// ============================================================
// SVG COMPONENTS (Loaded from external files)
// ============================================================

const SVG_COMPONENTS = {};

const SVG_ASSETS = {
  tree: './assets/tree.svg',
  grass: './assets/grass.svg',
  bonfire: './assets/bonfire.svg',
  character: './assets/character.svg',
  wolf: './assets/wolf.svg',
  apple: './assets/apple.svg',
  berry: './assets/berry.svg'
};

async function loadSVG(name, path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${name}: ${response.statusText}`);
    }
    const svgText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');

    if (!svgElement) {
      throw new Error(`Invalid SVG file: ${name}`);
    }

    const innerContent = svgElement.innerHTML;

    return (scale = 1) => {
      return `<g transform="scale(${scale})">${innerContent}</g>`;
    };
  } catch (error) {
    console.error(`Error loading SVG ${name}:`, error);
    return (scale = 1) => `<g transform="scale(${scale})"><text x="0" y="0" fill="red" font-size="12">Error: ${name}</text></g>`;
  }
}

async function loadSVGComponents() {
  console.log('📦 Loading SVG assets...');
  const loadPromises = Object.entries(SVG_ASSETS).map(async ([name, path]) => {
    SVG_COMPONENTS[name] = await loadSVG(name, path);
    console.log(`  ✓ Loaded ${name}.svg`);
  });

  await Promise.all(loadPromises);
  console.log('✅ All SVG assets loaded');
}

// Get character SVG with collection animation
function getCharacterSVG(scale) {
  const baseSVG = SVG_COMPONENTS['character'](scale);

  const { isCollecting, collectionAnimationProgress } = getCollectionState();

  if (!isCollecting) {
    return baseSVG;
  }

  // Add simple arm animation during collection
  const armOffset = Math.sin(collectionAnimationProgress * Math.PI * 4) * 2;

  const animatedSVG = baseSVG.replace(
    /<g transform="scale\(([^)]+)\)">/,
    `<g transform="scale($1)"><g transform="translate(0, ${-armOffset})">`
  ).replace(/<\/g>$/, '</g></g>');

  return animatedSVG;
}

// ============================================================
// GAME STATE
// ============================================================

let entities = [];
let canvas = null;
let characterEntity = null;
let wolfEntity = null;

// Getter for actions module
function getEntities() {
  return entities;
}

// Inject action methods into SmartEntity
injectActions(SmartEntity, getEntities);

// ============================================================
// SCENE GENERATION
// ============================================================

function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  console.log(`📺 Screen size: ${width}px × ${height}px`);

  // Clear existing entities and movement state
  entities = [];
  clearMovementState();

  // Calculate character height
  const characterHeight = height / 20;
  const characterScale = characterHeight / 50;

  // Place bonfire
  const bonfireX = width * 0.5;
  const bonfireY = height * 0.65;
  entities.push(new Entity('bonfire', bonfireX, bonfireY, 0.9));

  // Place character (friendly)
  const characterX = bonfireX + 37.5;
  const characterY = bonfireY + 7.5;
  characterEntity = new SmartEntity(
    'character',
    characterX,
    characterY,
    characterScale,
    config.MAX_INVENTORY_SIZE,
    config.DAY_VISIBILITY_RADIUS,
    true
  );
  entities.push(characterEntity);
  initMovementState(characterEntity);

  // Place wolf (not friendly)
  const wolfX = Math.random() * width;
  const wolfY = Math.random() * height * 0.7;
  const wolfScale = characterScale * 1.2;
  wolfEntity = new SmartEntity(
    'wolf',
    wolfX,
    wolfY,
    wolfScale,
    5,
    config.DAY_VISIBILITY_RADIUS * 1.2,
    false
  );
  entities.push(wolfEntity);
  initMovementState(wolfEntity);

  // Generate trees
  const treeCount = config.TREE_COUNT_MIN + Math.floor(Math.random() * (config.TREE_COUNT_MAX - config.TREE_COUNT_MIN + 1));
  const maxAttempts = config.MAX_PLACEMENT_ATTEMPTS;

  for (let i = 0; i < treeCount; i++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      const scale = 0.8 + Math.random() * 0.4;
      const treeRadius = config.TREE_RADIUS * scale;

      // Random placement with dynamic edge margin based on tree size
      const x = treeRadius + Math.random() * (width - 2 * treeRadius);
      const y = treeRadius + Math.random() * (height * 0.8 - 2 * treeRadius);

      const distToBonfire = Math.sqrt((x - bonfireX) ** 2 + (y - bonfireY) ** 2);
      if (distToBonfire <= config.BONFIRE_EXCLUSION_RADIUS) {
        attempts++;
        continue;
      }

      // Check overlap with other trees
      let overlapping = false;
      for (const entity of entities) {
        if (entity.type === 'tree') {
          const otherRadius = config.TREE_RADIUS * entity.scale;
          const distance = Math.sqrt((x - entity.x) ** 2 + (y - entity.y) ** 2);
          const minDistance = treeRadius + otherRadius;

          if (distance < minDistance) {
            overlapping = true;
            break;
          }
        }
      }

      if (!overlapping) {
        const tree = new DummyEntity('tree', x, y, scale, 3);
        const appleCount = Math.floor(Math.random() * 4);
        for (let j = 0; j < appleCount; j++) {
          tree.inventory.addItem(new Item('apple'));
        }
        entities.push(tree);
        placed = true;
      }

      attempts++;
    }
  }

  // Generate grass
  const grassCount = config.GRASS_COUNT_MIN + Math.floor(Math.random() * (config.GRASS_COUNT_MAX - config.GRASS_COUNT_MIN + 1));
  for (let i = 0; i < grassCount; i++) {
    const scale = 0.7 + Math.random() * 0.35;
    const grassRadius = config.GRASS_RADIUS * scale;

    // Random placement with dynamic edge margin based on grass size
    const x = grassRadius + Math.random() * (width - 2 * grassRadius);
    const y = grassRadius + Math.random() * (height - 2 * grassRadius);

    const grass = new DummyEntity('grass', x, y, scale, 5);
    const berryCount = Math.floor(Math.random() * 4); // 0-3 berries, same as apples
    for (let j = 0; j < berryCount; j++) {
      grass.inventory.addItem(new Item('berry'));
    }
    entities.push(grass);
  }

  // Sort entities by Y position for depth ordering
  entities.sort((a, b) => a.y - b.y);

  // Initialize visibility
  updateVisibility(entities);

  render(canvas, entities, SVG_COMPONENTS, getCharacterSVG, characterEntity);
}

// ============================================================
// FEEDBACK LOG UI
// ============================================================

let feedbackMessages = [];
const MAX_FEEDBACK_MESSAGES = 10;

function addFeedbackMessage(message) {
  feedbackMessages.push(message);
  if (feedbackMessages.length > MAX_FEEDBACK_MESSAGES) {
    feedbackMessages.shift(); // Remove oldest
  }
  updateFeedbackLog();
}

function updateFeedbackLog() {
  const feedbackLog = document.getElementById('feedback-log');
  if (!feedbackLog) return;

  feedbackLog.innerHTML = feedbackMessages
    .map(msg => `<div class="feedback-message">${msg}</div>`)
    .join('');

  // Auto-scroll to bottom
  feedbackLog.scrollTop = feedbackLog.scrollHeight;
}

// Intercept console.log to capture feedback
const originalConsoleLog = console.log;
console.log = function(...args) {
  originalConsoleLog.apply(console, args);

  // Only capture certain emoji-prefixed messages
  const message = args.join(' ');
  if (message.match(/^[🎯🔍✅⏰😴🍽️💀📦🚶]/)) {
    addFeedbackMessage(message);
  }
};

// ============================================================
// ACTION MENU UI
// ============================================================

let currentActionMenuState = null; // 'actions', 'targets', or null
let selectedAction = null;

const AVAILABLE_ACTIONS = [
  { id: 'searchFor', label: '🔍 Search for...', needsTarget: true },
  { id: 'moveTo', label: '🎯 Move to...', needsTarget: true },
  { id: 'collect', label: '📦 Collect from...', needsTarget: true },
  { id: 'drop', label: '📤 Drop item...', needsTarget: true },
  { id: 'eat', label: '🍽️ Eat item...', needsTarget: true },
  { id: 'sleep', label: '😴 Sleep', needsTarget: false },
  { id: 'wander', label: '🚶 Wander', needsTarget: false }
];

function showActionMenu() {
  currentActionMenuState = 'actions';
  selectedAction = null;

  const menu = document.getElementById('action-menu');
  const title = document.getElementById('action-menu-title');
  const list = document.getElementById('action-menu-list');

  if (!menu || !title || !list) return;

  title.textContent = 'Select Action';
  list.innerHTML = '';

  AVAILABLE_ACTIONS.forEach(action => {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.textContent = action.label;
    item.onclick = () => handleActionSelect(action);
    list.appendChild(item);
  });

  menu.classList.add('show');
}

function handleActionSelect(action) {
  if (!action.needsTarget) {
    // Execute immediately
    executeAction(action.id, null);
    hideActionMenu();
  } else {
    // Show target selection
    selectedAction = action;
    showTargetSelection(action);
  }
}

function showTargetSelection(action) {
  currentActionMenuState = 'targets';

  const title = document.getElementById('action-menu-title');
  const list = document.getElementById('action-menu-list');

  if (!title || !list) return;

  title.textContent = `${action.label} - Select Target`;
  list.innerHTML = '';

  // Get appropriate targets based on action
  const targets = getTargetsForAction(action.id);

  if (targets.length === 0) {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.textContent = '❌ No targets available';
    item.style.cursor = 'default';
    item.style.opacity = '0.5';
    list.appendChild(item);
    return;
  }

  targets.forEach(target => {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.textContent = target.label;
    item.onclick = () => {
      executeAction(action.id, target.value);
      hideActionMenu();
    };
    list.appendChild(item);
  });
}

function getTargetsForAction(actionId) {
  if (!characterEntity) return [];

  switch (actionId) {
    case 'searchFor':
      return [
        { label: '🍎 Apple', value: 'apple' },
        { label: '🫐 Berry', value: 'berry' },
        { label: '🔥 Bonfire', value: 'bonfire' }
      ];

    case 'moveTo':
      // Get all visible entities
      const visibleTargets = Array.from(characterEntity.visibleEntities || entities);
      return visibleTargets
        .filter(e => e !== characterEntity)
        .map(e => ({
          label: `${getEntityEmoji(e.type)} ${e.type} (${Math.round(e.x)}, ${Math.round(e.y)})`,
          value: e
        }));

    case 'collect':
      // Get entities with items in their inventory
      const collectTargets = Array.from(characterEntity.visibleEntities || entities);
      return collectTargets
        .filter(e => e !== characterEntity && e.inventory && e.inventory.items.length > 0)
        .flatMap(e => {
          return e.inventory.items.map((item, idx) => ({
            label: `${getEntityEmoji(item.type)} ${item.type} from ${e.type}`,
            value: { entity: e, itemType: item.type }
          }));
        });

    case 'drop':
      // Get items in character's inventory
      if (!characterEntity.inventory || characterEntity.inventory.items.length === 0) {
        return [];
      }
      return characterEntity.inventory.items.map(item => ({
        label: `${getEntityEmoji(item.type)} ${item.type}`,
        value: item.type
      }));

    case 'eat':
      // Get food items in inventory
      if (!characterEntity.inventory || characterEntity.inventory.items.length === 0) {
        return [];
      }
      const foodItems = characterEntity.inventory.items.filter(item =>
        item.type === 'apple' || item.type === 'berry'
      );
      return foodItems.map(item => ({
        label: `${getEntityEmoji(item.type)} ${item.type}`,
        value: item.type
      }));

    default:
      return [];
  }
}

function getEntityEmoji(type) {
  const emojiMap = {
    apple: '🍎',
    berry: '🫐',
    tree: '🌳',
    grass: '🌿',
    bonfire: '🔥',
    character: '🧍',
    wolf: '🐺'
  };
  return emojiMap[type] || '❓';
}

function executeAction(actionId, target) {
  if (!characterEntity) return;

  switch (actionId) {
    case 'searchFor':
      characterEntity.searchFor(target, (result) => {
        if (result.success) {
          console.log(`✅ Found ${target}!`);
        } else {
          console.log(`⏰ Could not find ${target}`);
        }
      });
      break;

    case 'moveTo':
      characterEntity.moveTo(target, (result) => {
        if (result.success) {
          console.log(`✅ Arrived at ${target.type}`);
        }
      });
      break;

    case 'collect':
      characterEntity.collect(target.entity, target.itemType, (result) => {
        if (result.success) {
          console.log(`✅ Collected ${target.itemType}!`);
        } else {
          console.log(`⏰ Could not collect ${target.itemType}: ${result.reason}`);
        }
      });
      break;

    case 'drop':
      characterEntity.drop(target, (result) => {
        if (result.success) {
          console.log(`📦 Dropped ${target}`);
        }
      });
      break;

    case 'eat':
      characterEntity.eat(target, (result) => {
        if (result.success) {
          console.log(`🍽️ Ate ${target}!`);
        } else {
          console.log(`⏰ Cannot eat: ${result.reason}`);
        }
      });
      break;

    case 'sleep':
      characterEntity.sleep((result) => {
        if (result.success) {
          console.log(`✅ Woke up refreshed!`);
        } else {
          console.log(`⏰ Sleep interrupted: ${result.reason}`);
        }
      });
      break;

    case 'wander':
      characterEntity.wander((result) => {
        if (result.success) {
          console.log(`✅ Finished wandering`);
        }
      });
      break;
  }
}

function hideActionMenu() {
  const menu = document.getElementById('action-menu');
  if (menu) {
    menu.classList.remove('show');
  }
  currentActionMenuState = null;
  selectedAction = null;
}

function initActionMenu() {
  const closeButton = document.getElementById('action-menu-close');
  if (closeButton) {
    closeButton.addEventListener('click', hideActionMenu);
  }

  // Action menu button
  const actionButton = document.getElementById('action-menu-button');
  if (actionButton) {
    actionButton.addEventListener('click', () => {
      if (currentActionMenuState === null) {
        showActionMenu();
      } else {
        hideActionMenu();
      }
    });
  }
}

// ============================================================
// NEEDS UI UPDATE
// ============================================================

function updateNeedsUI(entity) {
  if (!entity || entity.food === undefined) return;

  // Update HP bar
  const hpBar = document.getElementById('hp-bar');
  if (hpBar) {
    hpBar.style.width = `${entity.hp}%`;
  }

  // Update Food bar
  const foodBar = document.getElementById('food-bar');
  if (foodBar) {
    foodBar.style.width = `${entity.food}%`;
  }

  // Update Energy bar
  const energyBar = document.getElementById('energy-bar');
  if (energyBar) {
    energyBar.style.width = `${entity.energy}%`;
  }

  // Update Warmth bar
  const warmthBar = document.getElementById('warmth-bar');
  if (warmthBar) {
    warmthBar.style.width = `${entity.warmth}%`;
  }
}

function showGameOver() {
  const gameOverScreen = document.getElementById('game-over-screen');
  if (gameOverScreen) {
    gameOverScreen.classList.add('show');
  }
}

function hideGameOver() {
  const gameOverScreen = document.getElementById('game-over-screen');
  if (gameOverScreen) {
    gameOverScreen.classList.remove('show');
  }
}

function initRespawnButton() {
  const respawnButton = document.getElementById('respawn-button');
  if (respawnButton) {
    respawnButton.addEventListener('click', () => {
      console.log('🔄 Respawning...');
      hideGameOver();
      initScene(); // Reinitialize scene
      lastTimestamp = 0; // Reset timestamp
    });
  }
}

// ============================================================
// GAME LOOP
// ============================================================

let lastTimestamp = 0;

function gameLoop(timestamp) {
  // Calculate delta time (milliseconds since last frame)
  const deltaTime = lastTimestamp === 0 ? 16.67 : timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  const { isCollecting } = getCollectionState();

  // Update movement
  updateEntityPosition(characterEntity, isCollecting, deltaTime / 1000);
  updateEntityPosition(wolfEntity, false, deltaTime / 1000);

  // Update needs for all smart entities
  const bonfireEntity = entities.find(e => e.type === 'bonfire');
  if (characterEntity && characterEntity.food !== undefined) {
    updateNeeds(characterEntity, deltaTime, bonfireEntity);
    updateNeedsUI(characterEntity);

    // Check for death
    if (characterEntity.isDead) {
      showGameOver();
    }
  }
  if (wolfEntity && wolfEntity.food !== undefined) {
    updateNeeds(wolfEntity, deltaTime, bonfireEntity);
  }

  // Re-sort entities by Y position
  entities.sort((a, b) => a.y - b.y);

  // Update visibility for smart entities
  updateVisibility(entities);

  render(canvas, entities, SVG_COMPONENTS, getCharacterSVG, characterEntity);

  // Request next frame (runs at monitor refresh rate, typically 60fps)
  requestAnimationFrame(gameLoop);
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
  debugConsole.init();

  console.log('🚀 Application loaded!');
  console.log('📦 Build version:', window.__BUILD || 'unknown');

  await loadSVGComponents();

  console.log('✨ Initializing survival scene...');

  initReloadButton();
  initRespawnButton();
  initActionMenu();
  showReloadButton(); // TEMPORARILY ALWAYS SHOW FOR TESTING
  setInterval(checkForNewVersion, VERSION_CHECK_INTERVAL);
  console.log(`🔍 Version checking enabled (every ${VERSION_CHECK_INTERVAL / 1000}s)`);

  canvas = document.createElement('div');
  canvas.id = 'game-canvas';
  canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;';
  document.body.appendChild(canvas);

  initScene();

  // Start game loop using requestAnimationFrame for smooth 60fps
  requestAnimationFrame(gameLoop);

  console.log('🎮 Game loop started (using requestAnimationFrame)');
  console.log(`🌞 Day/night cycle: ${config.DAY_NIGHT_CYCLE_DURATION / 1000}s total`);
  console.log(`   Day: ${config.DAY_DURATION / 1000}s | Dusk: ${config.DUSK_DURATION / 1000}s | Night: ${config.NIGHT_DURATION / 1000}s | Dawn: ${config.DAWN_DURATION / 1000}s`);
  console.log(`👁️ Base visibility: ${config.DAY_VISIBILITY_RADIUS}px (day) → ${config.NIGHT_VISIBILITY_RADIUS}px (night)`);

  window.addEventListener('resize', () => {
    console.log('🔄 Window resized, regenerating scene...');
    initScene();
  });

  console.log('✅ Scene initialized with', entities.length, 'entities');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

export { init };
