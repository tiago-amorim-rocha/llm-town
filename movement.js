// === MOVEMENT MODULE ===
// Handles entity movement logic

import * as config from './config.js';
import { randomDirection } from './utils.js';

// Movement configuration
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

  // Only move if entity has an active movement action
  if (!entity.currentMovementAction) {
    return; // Stay still - default state is stationary
  }

  // Handle movement based on action type
  if (entity.currentMovementAction === 'wandering') {
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

  // Use time-based movement
  const currentSpeed = MOVEMENT_SPEED * deltaTime;

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

  const currentSpeed = MOVEMENT_SPEED * deltaTime;

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