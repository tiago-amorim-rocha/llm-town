// === ACTIONS MODULE ===
// Action execution system for SmartEntity
//
// TIME SYSTEM: Action durations (collection times, search duration, etc.) are
// defined in config.js in terms of in-game time (minutes/hours) and converted
// to real milliseconds for use here.

import * as config from './config.js';
import { Item, DummyEntity } from './entities.js';
import { distance } from './utils.js';
import * as needs from './needs.js';
import * as entityRegistry from './entityRegistry.js';

// Import configuration (already converted from in-game time to real time in config.js)
const COLLECTION_RANGE = config.COLLECTION_RANGE;
const APPLE_COLLECTION_TIME = config.APPLE_COLLECTION_TIME;
const BERRY_COLLECTION_TIME = config.BERRY_COLLECTION_TIME;

// Collection state (for animation)
let isCollecting = false;
let collectionAnimationProgress = 0; // 0 to 1

// Get collection state (for animation)
export function getCollectionState() {
  return { isCollecting, collectionAnimationProgress };
}

// Action execution functions

function executeCollect(smartEntity, target, itemType, callback) {
  // Validate target
  if (!target || !target.inventory) {
    callback({ success: false, reason: 'invalid_target' });
    return;
  }

  // Check if entity is close enough to target
  const dist = distance(smartEntity.x, smartEntity.y, target.x, target.y);
  if (dist > COLLECTION_RANGE) {
    // Auto-navigate to target first, then collect
    console.log(`📍 ${smartEntity.type} too far from ${target.type} (${dist.toFixed(0)}px), navigating first...`);
    executeMoveTo(smartEntity, target, COLLECTION_RANGE, (moveResult) => {
      if (!moveResult.success) {
        callback({ success: false, reason: 'navigation_failed', details: moveResult });
        return;
      }
      // Now try collecting again (should be close enough now)
      console.log(`🎯 ${smartEntity.type} arrived, now collecting ${itemType}...`);
      executeCollect(smartEntity, target, itemType, callback);
    });
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

  console.log(`🎯 ${smartEntity.type} collecting ${itemType} from ${target.type} (${collectionTime/1000}s)...`);

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
        console.log(`✅ ${smartEntity.type} collected ${itemType}! Inventory: ${smartEntity.inventory.items.length}/${smartEntity.inventory.maxCapacity}`);
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

function executeDrop(smartEntity, itemType, callback, entities) {
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

  console.log(`📦 ${smartEntity.type} dropped ${item.type} at (${dropX.toFixed(0)}, ${dropY.toFixed(0)})`);
  callback({ success: true, entity: groundEntity });
}

function executeSearchFor(smartEntity, itemType, callback) {
  console.log(`🔍 ${smartEntity.type} searching for ${itemType}...`);

  // Use entity registry to resolve search target (data-driven approach)
  const { targetType, isDirectSearch } = entityRegistry.resolveSearchTarget(itemType);

  if (!targetType) {
    callback({ success: false, reason: 'unknown_item_type' });
    return;
  }

  const isDirectEntitySearch = isDirectSearch;

  // Track search state
  const searchStartTime = Date.now();
  const searchDuration = config.SEARCH_MODE_DURATION;
  let searchComplete = false;

  // Helper to check if entity matches search criteria
  const isTargetMatch = (entity) => {
    if (isDirectEntitySearch) {
      // For direct entity searches (like bonfire), just match the type
      return entity.type === targetType;
    } else {
      // For item searches, match type AND check inventory
      return entity.type === targetType &&
             entity.inventory &&
             entity.inventory.hasItem(itemType);
    }
  };

  // Check if target is already visible
  const alreadyVisible = Array.from(smartEntity.visibleEntities).find(isTargetMatch);
  if (alreadyVisible) {
    console.log(`✅ ${smartEntity.type} found ${itemType} immediately at ${alreadyVisible.type}`);
    callback({ success: true, target: alreadyVisible, foundType: itemType });
    return;
  }

  // Event handler for newly visible entities
  const onEntityVisible = (entity) => {
    if (searchComplete) return;

    if (isTargetMatch(entity)) {
      // Found the target!
      searchComplete = true;
      smartEntity.off('entityVisible', onEntityVisible);
      smartEntity.stopCurrentAction(); // Stop wandering
      console.log(`✅ ${smartEntity.type} found ${itemType} at ${entity.type} (${entity.x.toFixed(0)}, ${entity.y.toFixed(0)})`);
      callback({ success: true, target: entity, foundType: itemType });
    }
  };

  // Subscribe to visibility events
  smartEntity.on('entityVisible', onEntityVisible);

  // Set searching state (different from aimless wandering)
  smartEntity.currentMovementAction = 'searching';
  smartEntity.movementActionData = {
    searchTarget: itemType,
    targetCategory: entityRegistry.getEntityCategory(itemType) || entityRegistry.getEntityCategory(targetType),
    startTime: Date.now(),
    duration: searchDuration
  };

  // Start wandering movement to search
  // Note: We set state to 'searching' above, but use wander's movement logic
  const wanderStartTime = Date.now();

  const checkCompletion = () => {
    if (searchComplete) return;

    const elapsed = Date.now() - wanderStartTime;
    if (elapsed >= searchDuration) {
      // Search timeout
      searchComplete = true;
      smartEntity.off('entityVisible', onEntityVisible);
      smartEntity.currentMovementAction = null;
      smartEntity.movementActionData = {};
      console.log(`⏰ ${smartEntity.type} search timeout: ${itemType} not found`);
      callback({ success: false, reason: 'timeout' });
    } else {
      requestAnimationFrame(checkCompletion);
    }
  };

  requestAnimationFrame(checkCompletion);
}

function executeMoveTo(smartEntity, target, arrivalDistance, callback) {
  if (!target) {
    callback({ success: false, reason: 'invalid_target' });
    return;
  }

  // Allow calling without arrivalDistance (defaults to COLLECTION_RANGE)
  if (typeof arrivalDistance === 'function') {
    callback = arrivalDistance;
    arrivalDistance = config.COLLECTION_RANGE;
  }

  console.log(`🎯 ${smartEntity.type} moving to ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})...`);

  // Set movement action state
  smartEntity.currentMovementAction = 'moving_to';
  smartEntity.movementActionData = {
    target: target,
    arrivalDistance: arrivalDistance,
    callback: callback
  };

  // Note: The actual movement is handled by updateEntityPosition in movement.js
  // The callback will be called when arrival distance is reached
}

function executeWander(smartEntity, duration, callback) {
  // If no duration specified, use random duration
  const wanderDuration = duration || (3000 + Math.random() * 4000); // 3-7 seconds default

  console.log(`🚶 ${smartEntity.type} wandering for ${(wanderDuration / 1000).toFixed(1)}s...`);

  // Set movement action state
  smartEntity.currentMovementAction = 'wandering';
  smartEntity.movementActionData = {
    startTime: Date.now(),
    duration: wanderDuration
  };

  // Check completion using requestAnimationFrame for frame-accurate timing
  const checkCompletion = () => {
    const elapsed = Date.now() - smartEntity.movementActionData.startTime;

    if (elapsed >= wanderDuration) {
      // Wander complete - stop movement
      smartEntity.currentMovementAction = null;
      smartEntity.movementActionData = {};
      console.log(`✅ ${smartEntity.type} finished wandering`);
      callback({ success: true });
    } else {
      // Continue wandering
      requestAnimationFrame(checkCompletion);
    }
  };

  checkCompletion();
}

function executeSleep(smartEntity, callback) {
  if (smartEntity.isDead) {
    callback({ success: false, reason: 'entity_dead' });
    return;
  }

  console.log(`😴 ${smartEntity.type} going to sleep...`);

  // Set sleeping state
  smartEntity.isSleeping = true;
  smartEntity.currentMovementAction = null; // Stop all movement
  smartEntity.movementActionData = {};

  // Check sleep completion
  const checkSleepStatus = () => {
    // Wake up if HP is critically low (interruptible)
    if (smartEntity.hp < needs.SLEEP_INTERRUPT_HP) {
      smartEntity.isSleeping = false;
      console.log(`⚠️ ${smartEntity.type} woke up due to low HP!`);
      callback({ success: false, reason: 'hp_critical', interrupted: true });
      return;
    }

    // Wake up if energy is high enough (low is bad, so we sleep until energy is high)
    if (smartEntity.energy >= needs.SLEEP_TARGET_ENERGY) {
      smartEntity.isSleeping = false;
      console.log(`✅ ${smartEntity.type} woke up refreshed! Energy: ${smartEntity.energy.toFixed(1)}`);
      callback({ success: true });
      return;
    }

    // Continue sleeping
    requestAnimationFrame(checkSleepStatus);
  };

  checkSleepStatus();
}

function executeEat(smartEntity, foodType, callback) {
  if (smartEntity.isDead) {
    callback({ success: false, reason: 'entity_dead' });
    return;
  }

  const result = needs.eat(smartEntity, foodType);

  if (result.success) {
    callback({ success: true });
  } else {
    callback({ success: false, reason: result.reason });
  }
}

function executeAddFuel(smartEntity, bonfireEntity, callback) {
  if (smartEntity.isDead) {
    callback({ success: false, reason: 'entity_dead' });
    return;
  }

  // Check if entity has sticks
  if (!smartEntity.inventory.hasItem('stick')) {
    callback({ success: false, reason: 'no_sticks' });
    return;
  }

  // Check if close enough to bonfire
  const dist = distance(smartEntity.x, smartEntity.y, bonfireEntity.x, bonfireEntity.y);
  if (dist > COLLECTION_RANGE) {
    // Auto-navigate to bonfire first, then add fuel
    console.log(`📍 ${smartEntity.type} too far from bonfire (${dist.toFixed(0)}px), navigating first...`);
    executeMoveTo(smartEntity, bonfireEntity, COLLECTION_RANGE, (moveResult) => {
      if (!moveResult.success) {
        callback({ success: false, reason: 'navigation_failed', details: moveResult });
        return;
      }
      // Now try adding fuel again (should be close enough now)
      console.log(`🎯 ${smartEntity.type} arrived at bonfire, now adding fuel...`);
      executeAddFuel(smartEntity, bonfireEntity, callback);
    });
    return;
  }

  // Check if bonfire has fuel property
  if (bonfireEntity.fuel === undefined) {
    callback({ success: false, reason: 'invalid_bonfire' });
    return;
  }

  // Find stick in inventory
  const stickIndex = smartEntity.inventory.items.findIndex(item => item.type === 'stick');
  if (stickIndex === -1) {
    callback({ success: false, reason: 'no_sticks' });
    return;
  }

  // Remove stick from inventory
  smartEntity.inventory.removeItem(stickIndex);

  // Add fuel to bonfire (each stick adds 20 fuel)
  const fuelAdded = 20;
  bonfireEntity.fuel = Math.min(bonfireEntity.maxFuel, bonfireEntity.fuel + fuelAdded);

  console.log(`🔥 ${smartEntity.type} added fuel to bonfire! Fuel: ${bonfireEntity.fuel.toFixed(0)}/${bonfireEntity.maxFuel}`);

  callback({ success: true });
}

// Inject action methods into SmartEntity prototype
export function injectActions(SmartEntityClass, entitiesGetter) {
  SmartEntityClass.prototype.collect = function(target, itemType, callback) {
    executeCollect(this, target, itemType, callback);
  };

  SmartEntityClass.prototype.drop = function(itemType, callback) {
    executeDrop(this, itemType, callback, entitiesGetter());
  };

  SmartEntityClass.prototype.searchFor = function(itemType, callback) {
    executeSearchFor(this, itemType, callback);
  };

  SmartEntityClass.prototype.wander = function(duration, callback) {
    // Allow calling with just callback (duration optional)
    if (typeof duration === 'function') {
      callback = duration;
      duration = null;
    }
    executeWander(this, duration, callback);
  };

  SmartEntityClass.prototype.moveTo = function(target, arrivalDistance, callback) {
    // Allow calling with just target and callback (arrivalDistance optional)
    if (typeof arrivalDistance === 'function') {
      callback = arrivalDistance;
      arrivalDistance = config.COLLECTION_RANGE;
    }
    executeMoveTo(this, target, arrivalDistance, callback);
  };

  SmartEntityClass.prototype.stopCurrentAction = function() {
    // Stop any current movement action
    this.currentMovementAction = null;
    this.movementActionData = {};
  };

  SmartEntityClass.prototype.sleep = function(callback) {
    executeSleep(this, callback);
  };

  SmartEntityClass.prototype.eat = function(foodType, callback) {
    executeEat(this, foodType, callback);
  };

  SmartEntityClass.prototype.addFuel = function(bonfireEntity, callback) {
    executeAddFuel(this, bonfireEntity, callback);
  };
}
