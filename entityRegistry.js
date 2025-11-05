// ============================================================
// ENTITY REGISTRY
// ============================================================
// Centralized configuration for all entity types in the game.
// This single source of truth defines entity properties, behaviors,
// and relationships, making it easy to add new entities without
// modifying action code throughout the codebase.

import * as time from './time.js';

// ============================================================
// ENTITY DEFINITIONS
// ============================================================

export const ENTITY_REGISTRY = {
  // ==================== RESOURCES ====================

  tree: {
    category: 'source',
    displayName: 'Tree',
    emoji: '🌳',
    searchable: false,  // Can't search for trees directly (search for apples instead)
    collectible: false,  // Can't collect the tree itself
    canContainItems: true,
    produces: ['apple'],  // Trees contain apples
    description: 'Source of apples'
  },

  grass: {
    category: 'source',
    displayName: 'Grass',
    emoji: '🌿',
    searchable: false,  // Can't search for grass directly (search for berries instead)
    collectible: false,  // Can't collect the grass itself
    canContainItems: true,
    produces: ['berry'],  // Grass contains berries
    description: 'Source of berries'
  },

  // ==================== COLLECTIBLES ====================

  apple: {
    category: 'food',
    displayName: 'Apple',
    emoji: '🍎',
    searchable: true,  // Can search for apples
    collectible: true,  // Can collect apples
    canContainItems: false,
    producedBy: 'tree',  // Apples come from trees
    consumable: true,
    foodValue: 30,  // Restores 30% food
    collectionTime: time.inGameMinutesToRealMs(24),  // 24 in-game minutes
    description: 'Nutritious fruit that restores hunger'
  },

  berry: {
    category: 'food',
    displayName: 'Berry',
    emoji: '🫐',
    searchable: true,  // Can search for berries
    collectible: true,  // Can collect berries
    canContainItems: false,
    producedBy: 'grass',  // Berries come from grass
    consumable: true,
    foodValue: 20,  // Restores 20% food
    collectionTime: time.inGameMinutesToRealMs(20),  // 20 in-game minutes
    description: 'Small fruit that restores hunger'
  },

  stick: {
    category: 'fuel',
    displayName: 'Stick',
    emoji: '🪵',
    searchable: true,  // Can search for sticks
    collectible: true,  // Can collect sticks
    canContainItems: false,
    isGroundEntity: true,  // Spawns as a ground entity (not inside another entity)
    usableWith: ['bonfire'],  // Can be used with bonfire
    fuelValue: 10,  // Adds 10% to bonfire fuel
    collectionTime: time.inGameMinutesToRealMs(15),  // 15 in-game minutes
    description: 'Fuel for the bonfire'
  },

  // ==================== STRUCTURES ====================

  bonfire: {
    category: 'warmth',
    displayName: 'Bonfire',
    emoji: '🔥',
    searchable: true,  // Can search for bonfire
    collectible: false,  // Can't collect the bonfire
    canContainItems: false,
    isStructure: true,
    acceptsFuel: ['stick'],  // Accepts sticks as fuel
    providesWarmth: true,
    description: 'Source of warmth and light'
  },

  // ==================== CREATURES ====================

  wolf: {
    category: 'threat',
    displayName: 'Wolf',
    emoji: '🐺',
    searchable: false,  // Don't want to search for wolves!
    collectible: false,
    canContainItems: false,
    hostile: true,
    damage: 20,  // Deals 20 damage
    description: 'Dangerous predator'
  },

  character: {
    category: 'agent',
    displayName: 'Character',
    emoji: '🧑',
    searchable: false,
    collectible: false,
    canContainItems: true,  // Has inventory
    isPlayer: true,
    description: 'The main character'
  }
};

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Get all searchable entity types
 * @returns {Array<string>} Array of entity type names that can be searched for
 */
export function getSearchableTypes() {
  return Object.entries(ENTITY_REGISTRY)
    .filter(([_, config]) => config.searchable)
    .map(([type, _]) => type);
}

/**
 * Get all collectible entity types
 * @returns {Array<string>} Array of entity type names that can be collected
 */
export function getCollectibleTypes() {
  return Object.entries(ENTITY_REGISTRY)
    .filter(([_, config]) => config.collectible)
    .map(([type, _]) => type);
}

/**
 * Get all consumable (edible) entity types
 * @returns {Array<string>} Array of entity type names that can be eaten
 */
export function getConsumableTypes() {
  return Object.entries(ENTITY_REGISTRY)
    .filter(([_, config]) => config.consumable)
    .map(([type, _]) => type);
}

/**
 * Get entity configuration by type
 * @param {string} type - The entity type name
 * @returns {Object|null} Entity configuration or null if not found
 */
export function getEntityConfig(type) {
  return ENTITY_REGISTRY[type] || null;
}

/**
 * Get category for an entity type
 * @param {string} type - The entity type name
 * @returns {string|null} Category name or null if not found
 */
export function getEntityCategory(type) {
  const config = getEntityConfig(type);
  return config ? config.category : null;
}

/**
 * Resolve search target for an item type
 * For items like 'apple', returns 'tree' (the source entity)
 * For ground entities like 'stick', returns 'stick' (the entity itself)
 * For structures like 'bonfire', returns 'bonfire' (the entity itself)
 *
 * @param {string} itemType - The item type to search for
 * @returns {Object} { targetType: string, isDirectSearch: boolean }
 */
export function resolveSearchTarget(itemType) {
  const config = getEntityConfig(itemType);

  if (!config) {
    return { targetType: null, isDirectSearch: false };
  }

  // If it has a producer, search for the producer entity
  if (config.producedBy) {
    return { targetType: config.producedBy, isDirectSearch: false };
  }

  // If it's a ground entity or structure, search for it directly
  if (config.isGroundEntity || config.isStructure || itemType === 'bonfire') {
    return { targetType: itemType, isDirectSearch: true };
  }

  // Default to direct search
  return { targetType: itemType, isDirectSearch: true };
}

/**
 * Get emoji for an entity type
 * @param {string} type - The entity type name
 * @returns {string} Emoji or default icon
 */
export function getEntityEmoji(type) {
  const config = getEntityConfig(type);
  return config ? config.emoji : '❓';
}

/**
 * Check if an entity type is in a specific category
 * @param {string} type - The entity type name
 * @param {string} category - The category to check
 * @returns {boolean}
 */
export function isEntityInCategory(type, category) {
  const config = getEntityConfig(type);
  return config ? config.category === category : false;
}

/**
 * Get collection time for an item type
 * @param {string} type - The item type name
 * @returns {number|null} Collection time in milliseconds or null
 */
export function getCollectionTime(type) {
  const config = getEntityConfig(type);
  return config ? config.collectionTime || null : null;
}

/**
 * Get food value for a consumable item
 * @param {string} type - The item type name
 * @returns {number|null} Food value (0-100) or null
 */
export function getFoodValue(type) {
  const config = getEntityConfig(type);
  return config ? config.foodValue || null : null;
}
