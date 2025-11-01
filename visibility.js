// === VISIBILITY SYSTEM MODULE ===
// Handles visibility calculations for smart entities

import { SmartEntity } from './entities.js';
import { getCycleState } from './cycle.js';

// Update visibility for all smart entities
export function updateVisibility(entities) {
  const cycleState = getCycleState();

  // Update visibility for each smart entity
  for (const entity of entities) {
    if (entity instanceof SmartEntity) {
      entity.updateVisibility(entities, cycleState);
    }
  }
}

// Get union of all friendly entities' visible entities (for player rendering)
export function getFriendlyVisibleEntities(entities) {
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
