// ============================================================
// TRANSLATOR MODULE
// ============================================================
// Converts engine state (numbers) to words for LLM prompts
// No numbers in prompts - words only!

import {
  NEED_THRESHOLDS,
  DISTANCE_THRESHOLDS,
  BONFIRE_FUEL_THRESHOLDS,
  NEARBY_ENTITY_CAP
} from './config.js';
import { getInGameTime } from './cycle.js';

// ============================================================
// NEED TRANSLATION (4-tier system)
// ============================================================

/**
 * Translate need value to word-based description
 * @param {number} value - Need value (0-100)
 * @param {string} needType - 'food', 'energy', 'warmth', 'health'
 * @returns {string|null} - Word description or null if fine
 */
export function translateNeed(value, needType) {
  const words = {
    food: ['a little hungry', 'hungry', 'very hungry', 'starving'],
    energy: ['a little tired', 'tired', 'very tired', 'exhausted'],
    warmth: ['a little cold', 'cold', 'very cold', 'freezing'],
    health: ['a little hurt', 'hurt', 'badly hurt', 'critical']
  };

  if (value > NEED_THRESHOLDS.TIER_1) return null; // Fine, omit from prompt
  if (value > NEED_THRESHOLDS.TIER_2) return words[needType][0]; // "a little X"
  if (value > NEED_THRESHOLDS.TIER_3) return words[needType][1]; // "X"
  if (value > NEED_THRESHOLDS.TIER_4) return words[needType][2]; // "very X"
  return words[needType][3]; // Critical state
}

// ============================================================
// DISTANCE TRANSLATION
// ============================================================

/**
 * Translate pixel distance to word-based description
 * @param {number} distance - Distance in pixels
 * @returns {string} - "at hand", "nearby", or "far"
 */
export function translateDistance(distance) {
  if (distance <= DISTANCE_THRESHOLDS.AT_HAND) return 'at hand';
  if (distance <= DISTANCE_THRESHOLDS.NEARBY) return 'nearby';
  return 'far';
}

// ============================================================
// BONFIRE FUEL TRANSLATION
// ============================================================

/**
 * Translate bonfire fuel level to word-based description
 * @param {number} fuel - Fuel level (0-100)
 * @returns {string} - "blaze", "strong", "low", or "fading"
 */
export function translateBonfireFuel(fuel) {
  if (fuel >= BONFIRE_FUEL_THRESHOLDS.BLAZE) return 'blaze';
  if (fuel >= BONFIRE_FUEL_THRESHOLDS.STRONG) return 'strong';
  if (fuel >= BONFIRE_FUEL_THRESHOLDS.LOW) return 'low';
  return 'fading';
}

// ============================================================
// TIME TRANSLATION
// ============================================================

/**
 * Translate current game time to simple time description
 * @returns {string} - e.g., "day (3h until dusk)" or "night (5h until dawn)"
 */
export function translateTime() {
  const { phase, hour } = getInGameTime();

  // Calculate hours until next transition
  let nextTransition, hoursUntil;

  if (phase === 'day') {
    nextTransition = 'dusk';
    hoursUntil = 8 - hour; // Day ends at hour 8
  } else if (phase === 'dusk') {
    nextTransition = 'night';
    hoursUntil = 10 - hour; // Dusk ends at hour 10
  } else if (phase === 'night') {
    nextTransition = 'dawn';
    hoursUntil = 22 - hour; // Night ends at hour 22
  } else { // dawn
    nextTransition = 'day';
    hoursUntil = 24 - hour; // Dawn ends at hour 24 (0)
  }

  return `${phase} (${hoursUntil}h until ${nextTransition})`;
}

// ============================================================
// ENTITY TRANSLATION
// ============================================================

/**
 * Translate entity to prompt-friendly description
 * @param {Entity} entity - The entity to describe
 * @param {Entity} characterEntity - The character (for distance calculation)
 * @returns {object} - {description, distance, distanceWord, priority}
 */
export function translateEntity(entity, characterEntity) {
  const dx = entity.x - characterEntity.x;
  const dy = entity.y - characterEntity.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const distanceWord = translateDistance(distance);

  let description = '';
  let priority = 0; // Higher = more important for current needs

  // Format based on entity type (no IDs - LLM uses types)
  if (entity.type === 'tree') {
    const items = [];
    if (entity.apples > 0) items.push(`${entity.apples} apples`);
    if (entity.berries > 0) items.push(`${entity.berries} berries`);
    if (entity.sticks > 0) items.push(`${entity.sticks} sticks`);

    if (items.length > 0) {
      description = `tree (${distanceWord}, has: ${items.join(', ')})`;
    } else {
      description = `tree (${distanceWord}, empty)`;
    }
  } else if (entity.type === 'bonfire') {
    const fuelWord = translateBonfireFuel(entity.fuel);
    description = `bonfire (${distanceWord}, fuel: ${fuelWord})`;
    priority = 10; // Bonfire is always important
  } else if (entity.type === 'apple' || entity.type === 'berry' || entity.type === 'stick') {
    description = `${entity.type} (${distanceWord})`;
  } else if (entity.type === 'wolf') {
    description = `WOLF (${distanceWord}) ⚠️`;
    priority = 100; // Threats are highest priority
  } else {
    description = `${entity.type} (${distanceWord})`;
  }

  return { description, distance, distanceWord, priority };
}

// ============================================================
// NEARBY ENTITIES (ranked and capped)
// ============================================================

/**
 * Get top N nearby entities, ranked by relevance to current needs
 * @param {Entity[]} visibleEntities - All visible entities
 * @param {Entity} characterEntity - The character
 * @param {object} needs - Current needs {food, energy, warmth, health}
 * @returns {string[]} - Array of entity descriptions (max NEARBY_ENTITY_CAP)
 */
export function translateNearbyEntities(visibleEntities, characterEntity, needs) {
  // Determine dominant need (lowest value)
  let dominantNeed = 'food';
  let lowestValue = needs.food;

  if (needs.energy < lowestValue) {
    dominantNeed = 'energy';
    lowestValue = needs.energy;
  }
  if (needs.warmth < lowestValue) {
    dominantNeed = 'warmth';
    lowestValue = needs.warmth;
  }
  if (needs.health < lowestValue) {
    dominantNeed = 'health';
    lowestValue = needs.health;
  }

  // Translate all entities and boost priority based on dominant need
  const translated = visibleEntities.map((entity, index) => {
    const t = translateEntity(entity, characterEntity);

    // Boost priority based on dominant need
    if (dominantNeed === 'food' && (entity.type === 'apple' || entity.type === 'berry' || entity.type === 'tree')) {
      t.priority += 50;
    }
    if (dominantNeed === 'warmth' && entity.type === 'bonfire') {
      t.priority += 50;
    }
    if (dominantNeed === 'energy' && entity.type === 'bonfire') {
      t.priority += 30; // Bonfire for sleep location
    }
    if (entity.type === 'stick' || (entity.type === 'tree' && entity.sticks > 0)) {
      t.priority += 20; // Sticks are always useful for bonfire
    }

    return t;
  });

  // Sort by priority DESC, then distance ASC
  translated.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.distance - b.distance;
  });

  // Take top N
  return translated.slice(0, NEARBY_ENTITY_CAP).map(t => t.description);
}

// ============================================================
// MEMORY TRANSLATION
// ============================================================

/**
 * Translate memory to useful location hints
 * Shows remembered entity locations with direction and walking time
 * Filtered to only show memories relevant to current needs
 * @param {Entity[]} visibleEntities - Currently visible entities
 * @param {Map} rememberedLocations - Map of remembered entity locations
 * @param {Entity} characterEntity - The character (for relative directions)
 * @param {object} needs - Current needs {food, energy, warmth, health}
 * @returns {string|null} - Memory description or null
 */
export function translateMemory(visibleEntities, rememberedLocations, characterEntity, needs) {
  const memories = [];

  // Determine what's useful based on needs
  const wantsFood = needs.food < 80;
  const wantsWarmth = needs.warmth < 80;
  const wantsEnergy = needs.energy < 80;

  // Check each remembered location
  for (const [entityType, memData] of rememberedLocations.entries()) {
    // Skip if currently visible
    if (visibleEntities.some(e => e.type === entityType)) {
      continue;
    }

    // Filter by usefulness
    let isUseful = false;
    if (entityType === 'bonfire') isUseful = wantsWarmth || wantsEnergy; // Warmth and sleep location
    if (entityType === 'tree' || entityType === 'apple') isUseful = wantsFood;
    if (entityType === 'grass' || entityType === 'berry') isUseful = wantsFood;
    if (entityType === 'stick') isUseful = true; // Always useful for bonfire

    // Also include bonfire if nothing else useful (it's a landmark)
    if (entityType === 'bonfire' && memories.length === 0) isUseful = true;

    if (!isUseful) continue;

    // Calculate relative direction and distance
    const dir = getRelativeDirection(characterEntity.x, characterEntity.y, memData.x, memData.y);
    const dist = Math.sqrt(
      Math.pow(memData.x - characterEntity.x, 2) +
      Math.pow(memData.y - characterEntity.y, 2)
    );

    // Convert distance to walking time (at ~22.5 px/s = ~1350 px/min)
    const walkMinutes = Math.round(dist / 1350);
    const timeStr = walkMinutes < 1 ? 'nearby' : `${walkMinutes}min walk`;

    memories.push(`${entityType} ${dir} (${timeStr})`);
  }

  if (memories.length === 0) return null;

  return memories.join(', ');
}

/**
 * Helper: Get relative direction from character to target (8-direction system)
 * @param {number} charX - Character's x position
 * @param {number} charY - Character's y position
 * @param {number} targetX - Target x position
 * @param {number} targetY - Target y position
 * @returns {string} - Relative direction (e.g., "E", "NE", "SSW")
 */
function getRelativeDirection(charX, charY, targetX, targetY) {
  const dx = targetX - charX;
  const dy = targetY - charY;

  // Calculate angle in degrees (0° = east, 90° = south, -90° = north)
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;

  // Normalize to 0-360
  if (angle < 0) angle += 360;

  // 16-direction system for more precision (but display as simplified)
  // N (337.5-22.5), NE (22.5-67.5), E (67.5-112.5), SE (112.5-157.5),
  // S (157.5-202.5), SW (202.5-247.5), W (247.5-292.5), NW (292.5-337.5)

  // For more granular directions, we can use SSW, ESE, etc.
  if (angle >= 337.5 || angle < 22.5) return 'E';
  if (angle >= 22.5 && angle < 67.5) return 'SE';
  if (angle >= 67.5 && angle < 112.5) return 'S';
  if (angle >= 112.5 && angle < 157.5) return 'SW';
  if (angle >= 157.5 && angle < 202.5) return 'W';
  if (angle >= 202.5 && angle < 247.5) return 'NW';
  if (angle >= 247.5 && angle < 292.5) return 'N';
  if (angle >= 292.5 && angle < 337.5) return 'NE';

  return '?';
}
