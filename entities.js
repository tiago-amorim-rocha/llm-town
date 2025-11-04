// === ENTITIES MODULE ===
// Classes for game entities: Item, Inventory, Entity, DummyEntity, SmartEntity

import { distance, easeInOutCubic } from './utils.js';
import { initNeeds } from './needs.js';

// ============================================================
// ITEM AND INVENTORY CLASSES
// ============================================================

// Item class - represents collectible items
export class Item {
  constructor(type, properties = {}) {
    this.type = type; // 'apple', 'berry', etc.
    this.properties = properties; // For future: freshness, edibility, etc. (not used yet)
  }
}

// Inventory class - manages item storage
export class Inventory {
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

// ============================================================
// ENTITY CLASSES
// ============================================================

// Base Entity class - all game objects
export class Entity {
  constructor(type, x, y, scale = 1) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  render(SVG_COMPONENTS) {
    let svg = SVG_COMPONENTS[this.type](this.scale);
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }
}

// DummyEntity - static objects (trees, grass, rocks, lakes)
export class DummyEntity extends Entity {
  constructor(type, x, y, scale = 1, inventoryCapacity = 5) {
    super(type, x, y, scale);
    this.inventory = new Inventory(inventoryCapacity);
  }

  render(SVG_COMPONENTS) {
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
export class SmartEntity extends Entity {
  constructor(type, x, y, scale = 1, inventoryCapacity = 10, visibilityRadius = 200, isFriendly = false) {
    super(type, x, y, scale);
    this.inventory = new Inventory(inventoryCapacity);
    this.currentAction = null;
    this.actionQueue = [];

    // Visibility and sensory system
    this.visibilityRadius = visibilityRadius; // Base visibility radius
    this.visibleEntities = new Set(); // Entities this entity can currently see
    this.previousVisibleEntities = new Set(); // For tracking visibility changes
    this.isFriendly = isFriendly; // Whether this entity is part of player's tribe

    // Event system for visibility changes
    this.eventHandlers = {
      entityVisible: [],
      entityInvisible: []
    };

    // Movement action state
    this.currentMovementAction = null; // 'wandering', 'moving_to', null
    this.movementActionData = {}; // Data for current movement action

    // Needs system (hunger, tiredness, cold, HP)
    initNeeds(this);
    this.isSleeping = false; // Sleep state
    this.isRunning = false;  // Running state (for tiredness calculation)

    // Spatial memory system - remember locations of entities
    this.memory = {
      discovered: new Map(), // entityType → {type, x, y, lastSeen, distance}
      landmarks: new Map()   // Special locations (bonfire)
    };
  }

  // Calculate what this entity can see
  updateVisibility(allEntities, currentCycleState) {
    // Store previous visibility state
    const previousVisible = new Set(this.visibleEntities);
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

    // Emit visibility events
    // Check for newly visible entities
    for (const entity of this.visibleEntities) {
      if (!previousVisible.has(entity)) {
        this._emit('entityVisible', entity);
      }
    }

    // Check for entities that became invisible
    for (const entity of previousVisible) {
      if (!this.visibleEntities.has(entity)) {
        this._emit('entityInvisible', entity);

        // Remember this entity's location
        const dist = distance(this.x, this.y, entity.x, entity.y);
        this.memory.discovered.set(entity.type, {
          type: entity.type,
          x: entity.x,
          y: entity.y,
          lastSeen: Date.now(),
          distance: dist,
          entity: entity // Keep reference for static entities
        });

        // Mark bonfire as special landmark
        if (entity.type === 'bonfire') {
          this.memory.landmarks.set('bonfire', entity);
        }
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

  // Event system methods
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      console.warn(`Unknown event type: ${event}`);
      return;
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (!this.eventHandlers[event]) {
      console.warn(`Unknown event type: ${event}`);
      return;
    }
    const index = this.eventHandlers[event].indexOf(handler);
    if (index > -1) {
      this.eventHandlers[event].splice(index, 1);
    }
  }

  _emit(event, data) {
    if (!this.eventHandlers[event]) {
      return;
    }
    for (const handler of this.eventHandlers[event]) {
      handler(data);
    }
  }

  render(SVG_COMPONENTS, getCharacterSVG = null) {
    let svg;
    if (this.type === 'character' && getCharacterSVG) {
      svg = getCharacterSVG(this.scale);
    } else {
      svg = SVG_COMPONENTS[this.type](this.scale);
    }
    return `<g transform="translate(${this.x}, ${this.y})">${svg}</g>`;
  }

  // Action methods with callbacks (implementations injected from actions.js)
  collect(target, itemType, callback) {
    // Implementation will be injected
  }

  drop(itemType, callback) {
    // Implementation will be injected
  }

  searchFor(itemType, callback) {
    // Implementation will be injected
  }

  wander(callback) {
    // Implementation will be injected
  }
}
