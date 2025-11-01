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

    // Return a function that wraps the content with scale transform and adds state-based decorations
    return (scale = 1, state = 0) => {
      let decorations = '';

      // Add berries to grass based on state
      if (name === 'grass') {
        if (state === 1) {
          // Few berries (2-3 berries)
          decorations = `
            <circle cx="-5" cy="-10" r="3.6" fill="#8B2252"/>
            <circle cx="3" cy="-12" r="3.6" fill="#8B2252"/>
          `;
        } else if (state === 2) {
          // Lots of berries (5-6 berries)
          decorations = `
            <circle cx="-7" cy="-8" r="3.6" fill="#8B2252"/>
            <circle cx="-3" cy="-12" r="3.6" fill="#8B2252"/>
            <circle cx="1" cy="-10" r="3.6" fill="#8B2252"/>
            <circle cx="5" cy="-14" r="3.6" fill="#8B2252"/>
            <circle cx="7" cy="-9" r="3.6" fill="#8B2252"/>
          `;
        }
      }

      // Add apples to trees based on state
      if (name === 'tree') {
        const applePositions = [
          { cx: -8, cy: -35 },   // Left side
          { cx: 10, cy: -38 },   // Right side
          { cx: -5, cy: -28 },   // Lower left
        ];

        for (let i = 0; i < state && i < applePositions.length; i++) {
          decorations += `<circle cx="${applePositions[i].cx}" cy="${applePositions[i].cy}" r="4.5" fill="#DC143C"/>`;
        }
      }

      return `<g transform="scale(${scale})">${innerContent}${decorations}</g>`;
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

  // Add programmatic components for ground items
  SVG_COMPONENTS['ground-apple'] = (scale = 1) => {
    return `<g transform="scale(${scale})">
      <circle cx="0" cy="0" r="4.5" fill="#DC143C"/>
    </g>`;
  };

  SVG_COMPONENTS['ground-berry'] = (scale = 1) => {
    // One "berry" item is represented by 3 small berries clustered together
    return `<g transform="scale(${scale})">
      <circle cx="-3" cy="0" r="3.6" fill="#8B2252"/>
      <circle cx="2" cy="-2" r="3.6" fill="#8B2252"/>
      <circle cx="2" cy="2" r="3.6" fill="#8B2252"/>
    </g>`;
  };

  console.log('✅ All SVG assets loaded');
}

// Get character SVG with collection animation
function getCharacterSVG(scale, state) {
  // Get the base character SVG
  const baseSVG = SVG_COMPONENTS['character'](scale, state);

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

class Entity {
  constructor(type, x, y, scale = 1, state = 0) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.state = state; // State for food items (berries on grass, apples on trees)
  }

  render() {
    let svg;
    if (this.type === 'character') {
      svg = getCharacterSVG(this.scale, this.state);
    } else {
      svg = SVG_COMPONENTS[this.type](this.scale, this.state);
    }
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }
}

// Game state
let entities = [];
let canvas = null;
let characterEntity = null; // Reference to the character entity
let wolfEntity = null; // Reference to the wolf entity

// ============================================================
// INVENTORY SYSTEM
// ============================================================

// Import inventory configuration
const MAX_INVENTORY_SIZE = config.MAX_INVENTORY_SIZE;
const APPLE_COLLECTION_TIME = config.APPLE_COLLECTION_TIME;
const BERRY_COLLECTION_TIME = config.BERRY_COLLECTION_TIME;

// Character inventory state
let inventory = []; // Array of {type: 'apple' or 'berry', sourceEntity: Entity}

// Collection state
let isCollecting = false;
let collectionStartTime = null;
let collectionTarget = null;
let collectionType = null; // 'apple' or 'berry'

// Animation state
let collectionAnimationProgress = 0; // 0 to 1

// Helper functions for inventory
function canCollectFrom(entity) {
  if (inventory.length >= MAX_INVENTORY_SIZE) return false;
  if (entity.type === 'tree' && entity.state > 0) return true; // Has apples
  if (entity.type === 'grass' && entity.state > 0) return true; // Has berries
  if (entity.type === 'ground-apple' || entity.type === 'ground-berry') return true; // Ground items
  return false;
}

function startCollection(entity) {
  if (isCollecting || !canCollectFrom(entity)) return false;

  isCollecting = true;
  collectionStartTime = Date.now();
  collectionTarget = entity;

  if (entity.type === 'tree') {
    collectionType = 'apple';
    console.log(`🍎 Started collecting apple from tree (${APPLE_COLLECTION_TIME/1000}s)`);
  } else if (entity.type === 'grass') {
    collectionType = 'berry';
    console.log(`🫐 Started collecting berries from bush (${BERRY_COLLECTION_TIME/1000}s)`);
  } else if (entity.type === 'ground-apple') {
    collectionType = 'apple';
    console.log(`🍎 Picking up apple from ground (instant)`);
  } else if (entity.type === 'ground-berry') {
    collectionType = 'berry';
    console.log(`🫐 Picking up berries from ground (instant)`);
  }

  return true;
}

function updateCollection() {
  if (!isCollecting) return;

  const now = Date.now();

  // Ground items are collected instantly
  let collectionTime;
  if (collectionTarget.type === 'ground-apple' || collectionTarget.type === 'ground-berry') {
    collectionTime = 100; // 100ms for ground items (instant)
  } else if (collectionType === 'apple') {
    collectionTime = APPLE_COLLECTION_TIME;
  } else {
    collectionTime = BERRY_COLLECTION_TIME;
  }

  const elapsed = now - collectionStartTime;

  // Update animation progress (0 to 1)
  collectionAnimationProgress = Math.min(elapsed / collectionTime, 1);

  // Check if collection is complete
  if (elapsed >= collectionTime) {
    completeCollection();
  }
}

function completeCollection() {
  if (!collectionTarget) return;

  // Add item to inventory
  inventory.push({
    type: collectionType,
    sourceEntity: collectionTarget
  });

  // Handle source entity based on type
  if (collectionTarget.type === 'ground-apple' || collectionTarget.type === 'ground-berry') {
    // Remove ground item from entities
    const index = entities.indexOf(collectionTarget);
    if (index > -1) {
      entities.splice(index, 1);
      console.log(`✅ Picked up ${collectionType} from ground! Inventory: ${inventory.length}/${MAX_INVENTORY_SIZE}`);
    }
  } else {
    // Decrease state of source entity (remove one apple/berry from tree/grass)
    collectionTarget.state = Math.max(0, collectionTarget.state - 1);
    console.log(`✅ Collected ${collectionType}! Inventory: ${inventory.length}/${MAX_INVENTORY_SIZE}`);
  }

  // Reset collection state
  isCollecting = false;
  collectionStartTime = null;
  collectionTarget = null;
  collectionType = null;
  collectionAnimationProgress = 0;

  // Execute next action in sequence after a short delay
  setTimeout(() => executeNextAction(), 500);
}

function dropItem(index) {
  if (index < 0 || index >= inventory.length) return null;

  const item = inventory.splice(index, 1)[0]; // Remove from inventory

  // Create a ground entity at character's position (slightly offset to avoid overlap)
  const offsetX = (Math.random() - 0.5) * 30;
  const offsetY = (Math.random() - 0.5) * 30;

  // Find a position that doesn't overlap with existing ground items
  let dropX = characterEntity.x + offsetX;
  let dropY = characterEntity.y + offsetY;

  // Check for overlapping ground items
  const groundItems = entities.filter(e => e.type === 'ground-apple' || e.type === 'ground-berry');
  for (let attempt = 0; attempt < 10; attempt++) {
    let overlapping = false;
    for (const groundItem of groundItems) {
      const dist = distance(dropX, dropY, groundItem.x, groundItem.y);
      if (dist < 30) { // Minimum spacing of 30px
        overlapping = true;
        break;
      }
    }

    if (!overlapping) break;

    // Try a new position
    dropX = characterEntity.x + (Math.random() - 0.5) * 60;
    dropY = characterEntity.y + (Math.random() - 0.5) * 60;
  }

  const groundEntityType = item.type === 'apple' ? 'ground-apple' : 'ground-berry';
  const groundEntity = new Entity(groundEntityType, dropX, dropY, 1, 1);
  entities.push(groundEntity);

  console.log(`📦 Dropped ${item.type} at (${dropX.toFixed(0)}, ${dropY.toFixed(0)})`);

  return groundEntity;
}

// ============================================================
// ACTION STATE MACHINE
// ============================================================

// Test state machine for automated actions
let actionSequence = [];
let currentActionIndex = 0;
let retryCurrentAction = false; // Flag to retry current action after search mode
let retryActionData = null; // Store action to retry

// Define action types
const ACTION_TYPE = {
  MOVE_TO: 'move-to',
  COLLECT: 'collect',
  DROP: 'drop',
  WAIT: 'wait',
  WANDER: 'wander'
};

// Initialize test action sequence
function initActionSequence() {
  // Test sequence: collect items, wander with full inventory, drop them, pick them up again
  // Note: Collection happens automatically on arrival at trees/grass/ground items
  actionSequence = [
    { type: ACTION_TYPE.MOVE_TO, targetType: 'tree' },  // Move to tree (auto-collects apple on arrival)
    { type: ACTION_TYPE.MOVE_TO, targetType: 'grass' }, // Move to grass (auto-collects berries on arrival)
    { type: ACTION_TYPE.WANDER, duration: 5000 },       // Wander 5 seconds (inventory full)
    { type: ACTION_TYPE.DROP, itemIndex: 0 },           // Drop first item
    { type: ACTION_TYPE.WANDER, duration: 5000 },       // Wander 5 more seconds
    { type: ACTION_TYPE.DROP, itemIndex: 0 },           // Drop second item (now at index 0)
    { type: ACTION_TYPE.WAIT, duration: 1500 },         // Wait 1.5 seconds
    { type: ACTION_TYPE.MOVE_TO, targetType: 'ground-apple' }, // Pick up dropped apple
    { type: ACTION_TYPE.MOVE_TO, targetType: 'ground-berry' }, // Pick up dropped berries
    { type: ACTION_TYPE.MOVE_TO, targetType: 'bonfire' }, // Move to bonfire (no collection)
  ];
  currentActionIndex = 0;
  console.log('🤖 Initialized action sequence with', actionSequence.length, 'actions');
}

// Get next action from sequence
function getNextAction() {
  if (currentActionIndex >= actionSequence.length) {
    // Sequence complete, restart
    currentActionIndex = 0;
    console.log('🔄 Action sequence complete, restarting...');
  }

  const action = actionSequence[currentActionIndex];
  currentActionIndex++;
  return action;
}

// Execute the next action in sequence
function executeNextAction() {
  const action = getNextAction();
  console.log(`🎬 Executing action ${currentActionIndex}/${actionSequence.length}:`, action.type);

  switch (action.type) {
    case ACTION_TYPE.MOVE_TO:
      // Find a target of the specified type
      const targets = entities.filter(e => e.type === action.targetType && visibleEntities.has(e));
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        startMoveToMode(target, false);
      } else {
        console.log(`⚠️ No visible ${action.targetType} found, entering search mode`);
        // Set retry flag so we retry this action after search mode
        retryCurrentAction = true;
        retryActionData = action;
        startSearchMode();
      }
      break;

    case ACTION_TYPE.COLLECT:
      // Collection is automatic when arriving at collectible target
      // This action serves as documentation in the sequence but is handled by arrival
      console.log('📋 Collect action (handled automatically on arrival)');
      // This is a no-op, immediately move to next action
      setTimeout(() => executeNextAction(), 100);
      break;

    case ACTION_TYPE.DROP:
      if (inventory.length > 0) {
        const index = Math.min(action.itemIndex, inventory.length - 1);
        dropItem(index);
        // After dropping, execute next action after a short delay
        setTimeout(() => executeNextAction(), 500);
      } else {
        console.log('⚠️ No items to drop, skipping');
        executeNextAction();
      }
      break;

    case ACTION_TYPE.WAIT:
      console.log(`⏳ Waiting ${action.duration}ms...`);
      setTimeout(() => executeNextAction(), action.duration);
      break;

    case ACTION_TYPE.WANDER:
      console.log(`🚶 Wandering for ${action.duration}ms...`);
      // Enter search mode (wandering) for the specified duration
      startSearchMode();
      // After duration, execute next action
      setTimeout(() => executeNextAction(), action.duration);
      break;
  }
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
  visibleEntities.clear();

  for (const entity of entities) {
    if (isEntityVisible(entity)) {
      visibleEntities.add(entity);
    }
  }

  // Check if we should retry a failed action now that visibility changed
  if (retryCurrentAction && retryActionData && retryActionData.type === ACTION_TYPE.MOVE_TO) {
    // Check if target type is now visible
    const targets = entities.filter(e => e.type === retryActionData.targetType && visibleEntities.has(e));
    if (targets.length > 0) {
      console.log(`👀 Target ${retryActionData.targetType} now visible! Retrying action immediately.`);
      // Clear retry flags
      retryCurrentAction = false;
      const actionToRetry = retryActionData;
      retryActionData = null;
      // Decrement action index to retry the same action
      currentActionIndex--;
      // Exit search mode and execute the action
      movementMode = 'move-to'; // This will be set properly by executeNextAction
      executeNextAction();
    }
  }
}

// ============================================================
// CHARACTER MOVEMENT
// ============================================================

// Movement configuration - imported from config.js
const MOVEMENT_SPEED = config.MOVEMENT_SPEED;
const RUN_SPEED_MULTIPLIER = config.RUN_SPEED_MULTIPLIER;
const DIRECTION_CHANGE_INTERVAL = config.DIRECTION_CHANGE_INTERVAL;
const MOVEMENT_UPDATE_INTERVAL = config.MOVEMENT_UPDATE_INTERVAL;
const MOVE_TO_ARRIVAL_DISTANCE = config.MOVE_TO_ARRIVAL_DISTANCE;
const MOVE_TO_MAX_CYCLES = config.MOVE_TO_MAX_CYCLES;
const SEARCH_MODE_DURATION = config.SEARCH_MODE_DURATION;

// Character movement state
let currentDirection = { x: 0, y: 0 };
let lastDirectionChange = Date.now();
let movementMode = 'search'; // 'search' or 'move-to'
let isRunning = false; // Running state
let moveToTarget = null; // Target entity for move-to mode
let moveToCount = 0; // Number of completed move-to cycles
let searchModeStartTime = null; // When search mode started

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

// Get a random visible object (excluding character, bonfire, and wolf)
function getRandomVisibleObject() {
  const validTargets = Array.from(visibleEntities).filter(
    entity => entity !== characterEntity &&
              entity.type !== 'bonfire' &&
              entity !== wolfEntity
  );

  if (validTargets.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * validTargets.length);
  return validTargets[randomIndex];
}

// Calculate normalized direction towards target
function getDirectionToTarget(targetX, targetY) {
  const dx = targetX - characterEntity.x;
  const dy = targetY - characterEntity.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx / distance,
    y: dy / distance
  };
}

// Start move-to mode with a target
function startMoveToMode(target, shouldRun = null) {
  if (!target) {
    console.log('🔍 No visible objects, entering search mode');
    startSearchMode();
    return;
  }

  movementMode = 'move-to';
  moveToTarget = target;

  // If shouldRun is explicitly set, use it; otherwise random 50% chance
  if (shouldRun !== null) {
    isRunning = shouldRun;
  } else {
    isRunning = Math.random() > 0.5;
  }

  console.log(`🎯 Moving to ${target.type} at (${target.x.toFixed(1)}, ${target.y.toFixed(1)})${isRunning ? ' [RUNNING 🏃]' : ' [WALKING 🚶]'}`);
}

// Start search mode
function startSearchMode() {
  movementMode = 'search';
  moveToTarget = null;
  searchModeStartTime = Date.now();
  isRunning = false;
  currentDirection = randomDirection();
  lastDirectionChange = Date.now();

  console.log(`🔍 Entering search mode for ${SEARCH_MODE_DURATION / 1000} seconds`);
}

// Update character position
function updateCharacterPosition() {
  if (!characterEntity) return;

  // If currently collecting, don't move
  if (isCollecting) {
    return;
  }

  const currentSpeed = MOVEMENT_SPEED * (isRunning ? RUN_SPEED_MULTIPLIER : 1);

  if (movementMode === 'search') {
    // Search mode: random movement

    // Check if search mode duration has elapsed
    if (searchModeStartTime && Date.now() - searchModeStartTime >= SEARCH_MODE_DURATION) {
      console.log('⏰ Search mode duration elapsed');

      // Check if we need to retry an action from the sequence
      if (retryCurrentAction && retryActionData) {
        console.log('🔄 Retrying action from sequence:', retryActionData.type);
        retryCurrentAction = false;
        const actionToRetry = retryActionData;
        retryActionData = null;

        // Decrement action index to retry the same action
        currentActionIndex--;
        executeNextAction();
      } else {
        // No retry needed - shouldn't normally reach here with action sequence
        // But keep this as fallback
        console.log('⚠️ Search mode ended without retry context - this shouldn\'t happen!');
        executeNextAction();
      }
      return;
    }

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
  } else if (movementMode === 'move-to') {
    // Move-to mode: move towards target

    if (!moveToTarget) {
      // No target, switch to search mode
      startSearchMode();
      return;
    }

    // Check if target is still visible
    if (!visibleEntities.has(moveToTarget)) {
      console.log(`❌ Target ${moveToTarget.type} is no longer visible, entering search mode`);
      startSearchMode();
      return;
    }

    // Calculate distance to target
    const dist = distance(characterEntity.x, characterEntity.y, moveToTarget.x, moveToTarget.y);

    // Check if arrived
    if (dist <= MOVE_TO_ARRIVAL_DISTANCE) {
      console.log(`✅ Arrived at ${moveToTarget.type}! (distance: ${dist.toFixed(1)}px)`);

      // Check if we can collect from this target
      if (canCollectFrom(moveToTarget)) {
        // Start collection action
        if (startCollection(moveToTarget)) {
          // Collection started, stay in move-to mode but don't move
          // Collection will complete via updateCollection(), which will trigger next action
          return;
        }
      }

      // If not collecting (can't collect or collection failed), execute next action
      setTimeout(() => executeNextAction(), 500);
      return;
    }

    // Move towards target
    currentDirection = getDirectionToTarget(moveToTarget.x, moveToTarget.y);

    const newX = characterEntity.x + currentDirection.x * currentSpeed;
    const newY = characterEntity.y + currentDirection.y * currentSpeed;

    // Keep within bounds with padding
    const padding = 50;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (newX >= padding && newX <= width - padding) {
      characterEntity.x = newX;
    } else {
      // Hit edge, enter search mode
      console.log('🚧 Hit boundary, entering search mode');
      startSearchMode();
      return;
    }

    if (newY >= padding && newY <= height - padding) {
      characterEntity.y = newY;
    } else {
      // Hit edge, enter search mode
      console.log('🚧 Hit boundary, entering search mode');
      startSearchMode();
      return;
    }
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
        // Randomly assign 0-3 apples to the tree
        const appleState = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
        entities.push(new Entity('tree', x, y, scale, appleState));
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
    // Randomly assign berry state: 0 (no berries), 1 (few berries), 2 (lots of berries)
    const berryState = Math.floor(Math.random() * 3); // 0, 1, or 2
    entities.push(new Entity('grass', x, y, scale, berryState));
  }

  // Sort entities by Y position for proper depth ordering
  entities.sort((a, b) => a.y - b.y);

  // Initialize visibility
  updateVisibility();

  // Initialize action sequence and start first action
  initActionSequence();
  executeNextAction();

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

  // Render inventory items floating above character
  let inventoryDisplay = '';
  if (characterEntity && inventory.length > 0) {
    inventory.forEach((item, index) => {
      const offsetX = (index - (inventory.length - 1) / 2) * 15; // Space items horizontally
      const offsetY = -45; // Float above character's head
      const itemX = characterEntity.x + offsetX;
      const itemY = characterEntity.y + offsetY;

      if (item.type === 'apple') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">
          <circle cx="0" cy="0" r="4.5" fill="#DC143C"/>
        </g>`;
      } else if (item.type === 'berry') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">
          <circle cx="-3" cy="0" r="3" fill="#8B2252"/>
          <circle cx="2" cy="-2" r="3" fill="#8B2252"/>
          <circle cx="2" cy="2" r="3" fill="#8B2252"/>
        </g>`;
      }
    });
  }

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${config.BACKGROUND_COLOR}"/>

      <!-- Entities -->
      ${visibleEntitySVG}

      <!-- Visibility circle -->
      ${visibilityCircle}

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
    updateCollection(); // Update collection progress
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
