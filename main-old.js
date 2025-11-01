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
  wolf: './assets/wolf.svg',
  apple: './assets/apple.svg',
  berry: './assets/berry.svg'
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
    return (scale = 1) => {
      return `<g transform="scale(${scale})">${innerContent}</g>`;
    };
  } catch (error) {
    console.error(`Error loading SVG ${name}:`, error);
    // Return a placeholder function that shows an error
    return (scale = 1, state = 0) => `<g transform="scale(${scale})"><text x="0" y="0" fill="red" font-size="12">Error: ${name}</text></g>`;
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

// Get character SVG with collection animation
function getCharacterSVG(scale) {
  // Get the base character SVG
  const baseSVG = SVG_COMPONENTS['character'](scale);

  // If not collecting, return base SVG
  if (!isCollecting) {
    return baseSVG;
  }

  // Add simple arm animation during collection
  // Animation: arms move up slightly (simple bounce effect)
  const armOffset = Math.sin(collectionAnimationProgress * Math.PI * 4) * 2; // Oscillates 0->2->0

  // Parse the SVG to modify arm positions
  // Left arm: x="-10" y="-15"
  // Right arm: x="4" y="-15"
  // We'll just add a transform to create a simple "reaching" animation
  const animatedSVG = baseSVG.replace(
    /<g transform="scale\(([^)]+)\)">/,
    `<g transform="scale($1)"><g transform="translate(0, ${-armOffset})">`
  ).replace(/<\/g>$/, '</g></g>');

  return animatedSVG;
}

// ============================================================
// ENTITY SYSTEM
// ============================================================

// Item class - represents collectible items
class Item {
  constructor(type, properties = {}) {
    this.type = type; // 'apple', 'berry', etc.
    this.properties = properties; // For future: freshness, edibility, etc. (not used yet)
  }
}

// Inventory class - manages item storage
class Inventory {
  constructor(maxCapacity = 10) {
    this.items = []; // Array of Item objects (no stacking - each item is separate)
    this.maxCapacity = maxCapacity;
  }

  addItem(item) {
    if (this.items.length >= this.maxCapacity) {
      return false; // Inventory full
    }
    this.items.push(item);
    return true;
  }

  removeItem(index) {
    if (index < 0 || index >= this.items.length) {
      return null;
    }
    return this.items.splice(index, 1)[0];
  }

  hasItem(type) {
    return this.items.some(item => item.type === type);
  }

  getItemCount(type) {
    return this.items.filter(item => item.type === type).length;
  }

  isFull() {
    return this.items.length >= this.maxCapacity;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  getItems() {
    return [...this.items]; // Return copy
  }
}

// Base Entity class - all game objects
class Entity {
  constructor(type, x, y, scale = 1) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  render() {
    let svg = SVG_COMPONENTS[this.type](this.scale);
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }
}

// DummyEntity - static objects (trees, grass, rocks, lakes)
class DummyEntity extends Entity {
  constructor(type, x, y, scale = 1, inventoryCapacity = 5) {
    super(type, x, y, scale);
    this.inventory = new Inventory(inventoryCapacity);
  }

  render() {
    // Render base entity
    const baseSVG = SVG_COMPONENTS[this.type](this.scale);

    // Render items in inventory on top of the entity
    let itemsDisplay = '';
    if (this.type === 'tree') {
      // Render apples on tree
      const applePositions = [
        { x: -8, y: -35 },   // Left side
        { x: 10, y: -38 },   // Right side
        { x: -5, y: -28 },   // Lower left
      ];
      const apples = this.inventory.items.filter(item => item.type === 'apple');
      for (let i = 0; i < apples.length && i < applePositions.length; i++) {
        const appleScale = 0.35;
        itemsDisplay += `<g transform="translate(${applePositions[i].x}, ${applePositions[i].y})">${SVG_COMPONENTS['apple'](appleScale)}</g>`;
      }
    } else if (this.type === 'grass') {
      // Render berries on grass
      const berryPositions = [
        { x: -7, y: -8 },
        { x: -3, y: -12 },
        { x: 1, y: -10 },
        { x: 5, y: -14 },
        { x: 7, y: -9 },
      ];
      const berries = this.inventory.items.filter(item => item.type === 'berry');
      for (let i = 0; i < berries.length && i < berryPositions.length; i++) {
        const berryScale = 0.35;
        itemsDisplay += `<g transform="translate(${berryPositions[i].x}, ${berryPositions[i].y})">${SVG_COMPONENTS['berry'](berryScale)}</g>`;
      }
    }

    return `<g transform="translate(${this.x}, ${this.y})">${baseSVG}${itemsDisplay}</g>`;
  }
}

// SmartEntity - AI-controlled entities (character, wolf)
class SmartEntity extends Entity {
  constructor(type, x, y, scale = 1, inventoryCapacity = 10, visibilityRadius = 200, isFriendly = false) {
    super(type, x, y, scale);
    this.inventory = new Inventory(inventoryCapacity);
    this.currentAction = null;
    this.actionQueue = [];

    // Visibility and sensory system
    this.visibilityRadius = visibilityRadius; // Base visibility radius
    this.visibleEntities = new Set(); // Entities this entity can currently see
    this.isFriendly = isFriendly; // Whether this entity is part of player's tribe
  }

  // Calculate what this entity can see
  updateVisibility(allEntities, currentCycleState) {
    this.visibleEntities.clear();

    // Get visibility radius based on day/night cycle (only for this entity)
    const radius = this.getVisibilityRadius(currentCycleState);

    for (const entity of allEntities) {
      if (entity === this) continue; // Don't see yourself

      const dist = distance(this.x, this.y, entity.x, entity.y);
      if (dist <= radius) {
        this.visibleEntities.add(entity);
      }
    }
  }

  // Get visibility radius based on day/night cycle
  getVisibilityRadius(cycleState) {
    const { state, progress } = cycleState;
    const dayRadius = this.visibilityRadius;
    const nightRadius = this.visibilityRadius * 0.5; // Half visibility at night

    switch (state) {
      case 'day':
        return dayRadius;

      case 'dusk':
        const duskProgress = easeInOutCubic(progress);
        return dayRadius - (dayRadius - nightRadius) * duskProgress;

      case 'night':
        return nightRadius;

      case 'dawn':
        const dawnProgress = easeInOutCubic(progress);
        return nightRadius + (dayRadius - nightRadius) * dawnProgress;

      default:
        return dayRadius;
    }
  }

  // Check if this entity can see a specific entity
  canSee(entity) {
    return this.visibleEntities.has(entity);
  }

  // Get all visible entities (sensory input for AI)
  getVisibleEntities() {
    return Array.from(this.visibleEntities);
  }

  render() {
    let svg;
    if (this.type === 'character') {
      svg = getCharacterSVG(this.scale);
    } else {
      svg = SVG_COMPONENTS[this.type](this.scale);
    }
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }

  // Action methods with callbacks
  collect(target, itemType, callback) {
    executeCollect(this, target, itemType, callback);
  }

  drop(itemType, callback) {
    executeDrop(this, itemType, callback);
  }

  searchFor(itemType, callback) {
    executeSearchFor(this, itemType, callback);
  }

  wander(callback) {
    executeWander(this, callback);
  }
}

// Game state
let entities = [];
let canvas = null;
let characterEntity = null; // Reference to the character entity
let wolfEntity = null; // Reference to the wolf entity

// ============================================================
// ACTION SYSTEM
// ============================================================

// Import configuration
const MAX_INVENTORY_SIZE = config.MAX_INVENTORY_SIZE;
const APPLE_COLLECTION_TIME = config.APPLE_COLLECTION_TIME;
const BERRY_COLLECTION_TIME = config.BERRY_COLLECTION_TIME;

// Collection state (for animation)
let isCollecting = false;
let collectionAnimationProgress = 0; // 0 to 1

// Action implementation for SmartEntity
// These functions will be called by the action methods

function executeCollect(smartEntity, target, itemType, callback) {
  // Validate target
  if (!target || !target.inventory) {
    callback({ success: false, reason: 'invalid_target' });
    return;
  }

  // Check if inventory is full
  if (smartEntity.inventory.isFull()) {
    callback({ success: false, reason: 'inventory_full' });
    return;
  }

  // Check if target has the item
  if (!target.inventory.hasItem(itemType)) {
    callback({ success: false, reason: 'item_not_found' });
    return;
  }

  // Find the item in target's inventory
  const itemIndex = target.inventory.items.findIndex(item => item.type === itemType);
  if (itemIndex === -1) {
    callback({ success: false, reason: 'item_not_found' });
    return;
  }

  // Determine collection time
  let collectionTime = 100; // Default instant pickup
  if (target.type === 'tree') {
    collectionTime = APPLE_COLLECTION_TIME;
  } else if (target.type === 'grass') {
    collectionTime = BERRY_COLLECTION_TIME;
  }

  console.log(`🎯 Collecting ${itemType} from ${target.type} (${collectionTime/1000}s)...`);

  // Start collection animation
  isCollecting = true;
  const startTime = Date.now();

  // Collection timer
  const checkProgress = () => {
    const elapsed = Date.now() - startTime;
    collectionAnimationProgress = Math.min(elapsed / collectionTime, 1);

    if (elapsed >= collectionTime) {
      // Collection complete
      const item = target.inventory.removeItem(itemIndex);
      if (item && smartEntity.inventory.addItem(item)) {
        console.log(`✅ Collected ${itemType}! Inventory: ${smartEntity.inventory.items.length}/${smartEntity.inventory.maxCapacity}`);
        isCollecting = false;
        collectionAnimationProgress = 0;
        callback({ success: true });
      } else {
        isCollecting = false;
        collectionAnimationProgress = 0;
        callback({ success: false, reason: 'collection_failed' });
      }
    } else {
      // Continue checking
      requestAnimationFrame(checkProgress);
    }
  };

  checkProgress();
}

function executeDrop(smartEntity, itemType, callback) {
  // Check if inventory has the item
  if (!smartEntity.inventory.hasItem(itemType)) {
    callback({ success: false, reason: 'item_not_in_inventory' });
    return;
  }

  // Find the item
  const itemIndex = smartEntity.inventory.items.findIndex(item => item.type === itemType);
  if (itemIndex === -1) {
    callback({ success: false, reason: 'item_not_found' });
    return;
  }

  // Remove item from inventory
  const item = smartEntity.inventory.removeItem(itemIndex);
  if (!item) {
    callback({ success: false, reason: 'drop_failed' });
    return;
  }

  // Create ground entity at smart entity's position
  const offsetX = (Math.random() - 0.5) * 30;
  const offsetY = (Math.random() - 0.5) * 30;
  const dropX = smartEntity.x + offsetX;
  const dropY = smartEntity.y + offsetY;

  // Create a ground entity for the dropped item
  const groundEntity = new DummyEntity(item.type, dropX, dropY, 0.5, 1);
  groundEntity.inventory.addItem(new Item(item.type));
  entities.push(groundEntity);

  console.log(`📦 Dropped ${item.type} at (${dropX.toFixed(0)}, ${dropY.toFixed(0)})`);
  callback({ success: true, entity: groundEntity });
}

function executeSearchFor(smartEntity, itemType, callback) {
  console.log(`🔍 ${smartEntity.type} searching for ${itemType}...`);

  // Determine which entity type has this item
  let targetType = null;
  if (itemType === 'apple') {
    targetType = 'tree';
  } else if (itemType === 'berry') {
    targetType = 'grass';
  }

  if (!targetType) {
    callback({ success: false, reason: 'unknown_item_type' });
    return;
  }

  // Start wandering and check periodically for the target
  const searchStartTime = Date.now();
  const searchDuration = config.SEARCH_MODE_DURATION;

  const checkForTarget = () => {
    const elapsed = Date.now() - searchStartTime;

    // Find visible entities with the item (using THIS entity's visibility)
    const targetsWithItem = Array.from(smartEntity.visibleEntities).filter(e =>
      e.type === targetType && e.inventory && e.inventory.hasItem(itemType)
    );

    if (targetsWithItem.length > 0) {
      // Found a target!
      const target = targetsWithItem[0];
      console.log(`✅ ${smartEntity.type} found ${itemType} at ${target.type} (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);
      callback({ success: true, target: target });
      return;
    }

    // Check if search duration elapsed
    if (elapsed >= searchDuration) {
      console.log(`⏰ ${smartEntity.type} search timeout: ${itemType} not found`);
      callback({ success: false, reason: 'timeout' });
      return;
    }

    // Continue searching
    setTimeout(checkForTarget, 500);
  };

  checkForTarget();
}

function executeWander(smartEntity, callback) {
  console.log(`🚶 Wandering...`);

  // Wander for a random duration
  const wanderDuration = 3000 + Math.random() * 4000; // 3-7 seconds

  setTimeout(() => {
    console.log(`✅ Finished wandering`);
    callback({ success: true });
  }, wanderDuration);
}

// ============================================================
// DAY/NIGHT CYCLE
// ============================================================

// Day/night configuration - imported from config.js
const DAY_DURATION = config.DAY_DURATION;
const DUSK_DURATION = config.DUSK_DURATION;
const NIGHT_DURATION = config.NIGHT_DURATION;
const DAWN_DURATION = config.DAWN_DURATION;
const DAY_NIGHT_CYCLE_DURATION = config.DAY_NIGHT_CYCLE_DURATION;
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

// Calculate distance between two points
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Update visibility for all smart entities
function updateVisibility() {
  const cycleState = getCycleState();

  // Update visibility for each smart entity
  for (const entity of entities) {
    if (entity instanceof SmartEntity) {
      entity.updateVisibility(entities, cycleState);
    }
  }
}

// Get union of all friendly entities' visible entities (for player rendering)
function getFriendlyVisibleEntities() {
  const friendlyVisible = new Set();

  for (const entity of entities) {
    if (entity instanceof SmartEntity && entity.isFriendly) {
      // Add all entities this friendly entity can see
      for (const visibleEntity of entity.visibleEntities) {
        friendlyVisible.add(visibleEntity);
      }
      // Add the friendly entity itself
      friendlyVisible.add(entity);
    }
  }

  return friendlyVisible;
}

// ============================================================
// CHARACTER MOVEMENT
// ============================================================

// Movement configuration - imported from config.js
const MOVEMENT_SPEED = config.MOVEMENT_SPEED;
const DIRECTION_CHANGE_INTERVAL = config.DIRECTION_CHANGE_INTERVAL;
const MOVEMENT_UPDATE_INTERVAL = config.MOVEMENT_UPDATE_INTERVAL;

// Character movement state
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

// Update character position (simple wandering behavior)
function updateCharacterPosition() {
  if (!characterEntity) return;

  // If currently collecting, don't move
  if (isCollecting) {
    return;
  }

  const currentSpeed = MOVEMENT_SPEED;

  // Change direction periodically
  if (Date.now() - lastDirectionChange > DIRECTION_CHANGE_INTERVAL) {
    currentDirection = randomDirection();
    lastDirectionChange = Date.now();
  }

  // Update position
  const newX = characterEntity.x + currentDirection.x * currentSpeed;
  const newY = characterEntity.y + currentDirection.y * currentSpeed;

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

  // Place bonfire in lower-center area (static, no inventory)
  const bonfireX = width * 0.5;
  const bonfireY = height * 0.65;
  entities.push(new Entity('bonfire', bonfireX, bonfireY, 0.9)); // 0.6 * 1.5

  // Place character beside bonfire (to the right) - SmartEntity with inventory
  const characterX = bonfireX + 37.5; // 25 * 1.5
  const characterY = bonfireY + 7.5; // 5 * 1.5
  // Character is friendly, has day visibility from config
  characterEntity = new SmartEntity(
    'character',
    characterX,
    characterY,
    characterScale,
    config.MAX_INVENTORY_SIZE,
    config.DAY_VISIBILITY_RADIUS,
    true // isFriendly - part of player's tribe
  );
  entities.push(characterEntity);

  // Place wolf randomly in the forest - SmartEntity with inventory
  const wolfX = Math.random() * width;
  const wolfY = Math.random() * height * 0.7; // Keep in upper 70% of screen
  const wolfScale = characterScale * 1.2; // Slightly larger than character
  // Wolf is not friendly, has its own visibility radius
  wolfEntity = new SmartEntity(
    'wolf',
    wolfX,
    wolfY,
    wolfScale,
    5, // inventory capacity
    config.DAY_VISIBILITY_RADIUS * 1.2, // Better vision than character
    false // not friendly
  );
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
      const scale = 0.8 + Math.random() * 0.4; // Scale between 0.8-1.2 (reduced size variation)

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
        // Create tree with inventory capacity of 3 apples
        const tree = new DummyEntity('tree', x, y, scale, 3);

        // Randomly assign 0-3 apples to the tree's inventory
        const appleCount = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
        for (let j = 0; j < appleCount; j++) {
          tree.inventory.addItem(new Item('apple'));
        }

        entities.push(tree);
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
    const scale = 0.7 + Math.random() * 0.35; // Scale between 0.7-1.05 (reduced size variation)

    // Create grass with inventory capacity of 5 berries
    const grass = new DummyEntity('grass', x, y, scale, 5);

    // Randomly assign berries: 0 (no berries), 1-2 (few berries), 3-5 (lots of berries)
    const berryCount = Math.floor(Math.random() * 6); // 0, 1, 2, 3, 4, or 5
    for (let j = 0; j < berryCount; j++) {
      grass.inventory.addItem(new Item('berry'));
    }

    entities.push(grass);
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
  const darknessOpacity = getDarknessOpacity();
  const cycleState = getCycleState();

  // Get union of all friendly entities' visibility
  const friendlyVisibleEntities = getFriendlyVisibleEntities();

  // Render visible entities (only what friendly entities can see)
  const visibleEntitySVG = entities
    .filter(e => friendlyVisibleEntities.has(e))
    .map(e => e.render())
    .join('');

  // Render visibility circles for all friendly entities
  let visibilityCircles = '';
  for (const entity of entities) {
    if (entity instanceof SmartEntity && entity.isFriendly) {
      const radius = entity.getVisibilityRadius(cycleState);
      visibilityCircles += `
        <circle
          cx="${entity.x}"
          cy="${entity.y}"
          r="${radius}"
          fill="none"
          stroke="#ffdd1a"
          stroke-width="2"
          stroke-dasharray="5,5"
          opacity="0.6"
        />
      `;
    }
  }

  // Render inventory items floating above character
  let inventoryDisplay = '';
  if (characterEntity && characterEntity.inventory && characterEntity.inventory.items.length > 0) {
    const items = characterEntity.inventory.items;
    items.forEach((item, index) => {
      const offsetX = (index - (items.length - 1) / 2) * 15; // Space items horizontally
      const offsetY = -45; // Float above character's head
      const itemX = characterEntity.x + offsetX;
      const itemY = characterEntity.y + offsetY;

      // Render item using SVG components
      const itemScale = 0.25;
      if (item.type === 'apple') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">${SVG_COMPONENTS['apple'](itemScale)}</g>`;
      } else if (item.type === 'berry') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">${SVG_COMPONENTS['berry'](itemScale)}</g>`;
      }
    });
  }

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${config.BACKGROUND_COLOR}"/>

      <!-- Entities -->
      ${visibleEntitySVG}

      <!-- Visibility circles (friendly entities only) -->
      ${visibilityCircles}

      <!-- Inventory display -->
      ${inventoryDisplay}

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
  console.log(`👁️ Base visibility: ${config.DAY_VISIBILITY_RADIUS}px (day) → ${config.NIGHT_VISIBILITY_RADIUS}px (night)`);

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
