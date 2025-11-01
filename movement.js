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

// Update entity position (simple wandering behavior)
export function updateEntityPosition(entity, isCollecting = false) {
  if (!entity) return;

  // If currently collecting, don't move
  if (isCollecting) {
    return;
  }

  // Get or create movement state
  if (!entityMovementState.has(entity)) {
    initMovementState(entity);
  }
  const state = entityMovementState.get(entity);

  const currentSpeed = MOVEMENT_SPEED;

  // Change direction periodically
  if (Date.now() - state.lastDirectionChange > DIRECTION_CHANGE_INTERVAL) {
    state.currentDirection = randomDirection();
    state.lastDirectionChange = Date.now();
  }

  // Update position
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

// Clear movement state (e.g., on scene reset)
export function clearMovementState() {
  entityMovementState.clear();
}
