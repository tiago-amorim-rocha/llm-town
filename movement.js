// === MOVEMENT MODULE ===
// Handles entity movement logic
//
// TIME SYSTEM: Movement speed is defined in config.js in terms of in-game time
// (pixels per in-game hour) and converted to pixels per real second for use here.
// The deltaTime parameter ensures frame-independent movement.

import * as config from './config.js';
import { randomDirection } from './utils.js';
import * as needs from './needs.js';

// Movement configuration (already converted from in-game time to real time in config.js)
const MOVEMENT_SPEED = config.MOVEMENT_SPEED;
const DIRECTION_CHANGE_INTERVAL = config.DIRECTION_CHANGE_INTERVAL;

// Movement state for entities
const entityMovementState = new Map();

// Initialize movement state for an entity
export function initMovementState(entity) {
  entityMovementState.set(entity, {
    currentDirection: randomDirection(),
    lastDirectionChange: Date.now()
  });
}

// Update entity position (action-driven movement)
export function updateEntityPosition(entity, isCollecting = false, deltaTime = 1/60) {
  if (!entity) return;

  // If currently collecting, don't move
  if (isCollecting) {
    return;
  }

  // If sleeping, don't move
  if (entity.isSleeping) {
    return;
  }

  // If dead, don't move
  if (entity.isDead) {
    return;
  }

  // Only move if entity has an active movement action
  if (!entity.currentMovementAction) {
    return; // Stay still - default state is stationary
  }

  // Handle movement based on action type
  if (entity.currentMovementAction === 'wandering' || entity.currentMovementAction === 'searching') {
    // Both wandering and searching use random wandering movement
    // The difference is in the context (searching has a goal/target)
    applyWanderingMovement(entity, deltaTime);
  } else if (entity.currentMovementAction === 'moving_to') {
    applyMoveToMovement(entity, deltaTime);
  }
}

// Apply wandering movement behavior
function applyWanderingMovement(entity, deltaTime) {
  // Get or create movement state
  if (!entityMovementState.has(entity)) {
    initMovementState(entity);
  }
  const state = entityMovementState.get(entity);

  // Apply speed multipliers based on needs
  let speedMultiplier = 1.0;

  // Apply energy penalty if entity has needs system
  if (entity.energy !== undefined) {
    speedMultiplier *= needs.getSpeedMultiplier(entity);
    entity.isRunning = false; // Not running during wander
  }

  // Use time-based movement with speed multiplier
  const currentSpeed = MOVEMENT_SPEED * deltaTime * speedMultiplier;

  // Change direction periodically
  if (Date.now() - state.lastDirectionChange > DIRECTION_CHANGE_INTERVAL) {
    state.currentDirection = randomDirection();
    state.lastDirectionChange = Date.now();
  }

  // Update position using time-based speed
  const newX = entity.x + state.currentDirection.x * currentSpeed;
  const newY = entity.y + state.currentDirection.y * currentSpeed;

  // Keep within bounds with padding
  const padding = 50;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (newX >= padding && newX <= width - padding) {
    entity.x = newX;
  } else {
    state.currentDirection.x *= -1; // Bounce off edge
  }

  if (newY >= padding && newY <= height - padding) {
    entity.y = newY;
  } else {
    state.currentDirection.y *= -1; // Bounce off edge
  }
}

// Apply move-to-target movement behavior
function applyMoveToMovement(entity, deltaTime) {
  const targetData = entity.movementActionData.target;
  if (!targetData) {
    // No target, stop movement
    entity.currentMovementAction = null;
    return;
  }

  // Calculate direction to target
  const dx = targetData.x - entity.x;
  const dy = targetData.y - entity.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check if arrived
  const arrivalDistance = entity.movementActionData.arrivalDistance || 50;
  if (distance <= arrivalDistance) {
    // Arrived! Stop and call callback if exists
    entity.currentMovementAction = null;
    if (entity.movementActionData.callback) {
      entity.movementActionData.callback({ success: true, arrived: true });
    }
    entity.movementActionData = {};
    return;
  }

  // Move towards target
  const directionX = dx / distance; // Normalize
  const directionY = dy / distance;

  // Apply speed multipliers based on needs
  let speedMultiplier = 1.0;

  // Apply energy penalty and running if entity has needs system
  if (entity.energy !== undefined) {
    speedMultiplier *= needs.getSpeedMultiplier(entity);

    // Try to run if possible (when moving to specific target)
    if (needs.canRun(entity)) {
      speedMultiplier *= config.RUN_SPEED_MULTIPLIER;
      entity.isRunning = true;
    } else {
      entity.isRunning = false;
    }
  }

  const currentSpeed = MOVEMENT_SPEED * deltaTime * speedMultiplier;

  const newX = entity.x + directionX * currentSpeed;
  const newY = entity.y + directionY * currentSpeed;

  // Keep within bounds with padding
  const padding = 50;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (newX >= padding && newX <= width - padding) {
    entity.x = newX;
  }

  if (newY >= padding && newY <= height - padding) {
    entity.y = newY;
  }
}

// Clear movement state (e.g., on scene reset)
export function clearMovementState() {
  entityMovementState.clear();
}