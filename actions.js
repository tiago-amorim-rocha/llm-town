// === ACTIONS MODULE ===
// Action execution system for SmartEntity

import * as config from './config.js';
import { Item, DummyEntity } from './entities.js';

// Import configuration
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

  // Track search state
  const searchStartTime = Date.now();
  const searchDuration = config.SEARCH_MODE_DURATION;
  let searchComplete = false;

  // Helper to check if entity matches search criteria
  const isTargetMatch = (entity) => {
    return entity.type === targetType &&
           entity.inventory &&
           entity.inventory.hasItem(itemType);
  };

  // Check if target is already visible
  const alreadyVisible = Array.from(smartEntity.visibleEntities).find(isTargetMatch);
  if (alreadyVisible) {
    console.log(`✅ ${smartEntity.type} found ${itemType} immediately at ${alreadyVisible.type}`);
    callback({ success: true, target: alreadyVisible });
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
      callback({ success: true, target: entity });
    }
  };

  // Subscribe to visibility events
  smartEntity.on('entityVisible', onEntityVisible);

  // Start wandering to search
  smartEntity.wander(searchDuration, (result) => {
    if (searchComplete) return; // Already found target

    // Wander duration complete without finding target
    searchComplete = true;
    smartEntity.off('entityVisible', onEntityVisible);
    console.log(`⏰ ${smartEntity.type} search timeout: ${itemType} not found`);
    callback({ success: false, reason: 'timeout' });
  });
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

  SmartEntityClass.prototype.stopCurrentAction = function() {
    // Stop any current movement action
    this.currentMovementAction = null;
    this.movementActionData = {};
  };
}
