// === NEEDS SYSTEM ===
// Manages hunger, tiredness, cold, and HP for SmartEntity

import * as config from './config.js';

// ============================================================
// NEEDS CONFIGURATION
// ============================================================

// Scale: 0-100 for all properties
export const INITIAL_HUNGER = 100;      // Full
export const INITIAL_TIREDNESS = 0;     // Rested
export const INITIAL_COLD = 0;          // Warm
export const INITIAL_HP = 100;          // Full health

// Thresholds
export const HUNGER_CRITICAL = 30;      // Below this, HP starts decreasing
export const COLD_CRITICAL = 70;        // Above this, HP starts decreasing
export const TIREDNESS_NO_RUN = 70;     // Above this, can't run
export const TIREDNESS_SLOW_WALK = 85;  // Above this, walk at half speed
export const TIREDNESS_FORCE_SLEEP = 95; // Above this, forced sleep

// Needs "met" for HP regeneration
export const HUNGER_MET = 50;
export const COLD_MET = 50;
export const TIREDNESS_MET = 50;

// Rates (per second)
export const HUNGER_DECREASE_RATE = 0.1;        // ~16.6 min to deplete
export const TIREDNESS_IDLE_RATE = 0.05;        // Slow increase when idle
export const TIREDNESS_WALK_RATE = 0.15;        // Faster when walking
export const TIREDNESS_RUN_RATE = 0.3;          // Even faster when running
export const COLD_INCREASE_RATE = 0.2;          // When away from bonfire
export const COLD_DECREASE_RATE = 0.5;          // When near bonfire
export const HP_DECREASE_RATE = 0.5;            // Per critical need per second
export const HP_REGEN_RATE = 0.3;               // When all needs met

// Bonfire warmth radius
export const BONFIRE_WARMTH_RADIUS = 100;       // Stay within this distance to warm up

// Eating
export const FOOD_HUNGER_RESTORE = 40;          // Instant restore per food item

// Sleep
export const SLEEP_TARGET_TIREDNESS = 10;       // Sleep until tiredness is below this
export const SLEEP_INTERRUPT_HP = 20;           // Wake up if HP drops below this

// ============================================================
// NEEDS INITIALIZATION
// ============================================================

export function initNeeds(entity) {
  entity.hunger = INITIAL_HUNGER;
  entity.tiredness = INITIAL_TIREDNESS;
  entity.cold = INITIAL_COLD;
  entity.hp = INITIAL_HP;
  entity.isDead = false;
}

// ============================================================
// NEEDS UPDATE (called every frame)
// ============================================================

export function updateNeeds(entity, deltaTime, bonfireEntity) {
  if (entity.isDead) return;

  const dt = deltaTime / 1000; // Convert to seconds

  // 1. Update hunger (always decreases)
  entity.hunger = Math.max(0, entity.hunger - HUNGER_DECREASE_RATE * dt);

  // 2. Update tiredness (depends on movement state)
  let tirednessRate = TIREDNESS_IDLE_RATE;

  if (entity.isSleeping) {
    // Sleeping restores tiredness
    entity.tiredness = Math.max(0, entity.tiredness - 1.5 * dt); // Fast recovery
  } else if (entity.currentMovementAction === 'moving_to' || entity.currentMovementAction === 'wandering') {
    // Check if running (based on speed multiplier in movement system)
    const isRunning = entity.isRunning || false;
    tirednessRate = isRunning ? TIREDNESS_RUN_RATE : TIREDNESS_WALK_RATE;
    entity.tiredness = Math.min(100, entity.tiredness + tirednessRate * dt);
  } else {
    // Idle
    entity.tiredness = Math.min(100, entity.tiredness + tirednessRate * dt);
  }

  // 3. Update cold (depends on distance to bonfire)
  if (bonfireEntity) {
    const distToBonfire = Math.sqrt(
      (entity.x - bonfireEntity.x) ** 2 +
      (entity.y - bonfireEntity.y) ** 2
    );

    if (distToBonfire <= BONFIRE_WARMTH_RADIUS) {
      // Near bonfire: warm up
      entity.cold = Math.max(0, entity.cold - COLD_DECREASE_RATE * dt);
    } else {
      // Away from bonfire: get cold
      entity.cold = Math.min(100, entity.cold + COLD_INCREASE_RATE * dt);
    }
  } else {
    // No bonfire: always getting cold
    entity.cold = Math.min(100, entity.cold + COLD_INCREASE_RATE * dt);
  }

  // 4. Update HP based on needs
  let hpChange = 0;

  // Count critical needs
  if (entity.hunger < HUNGER_CRITICAL) {
    hpChange -= HP_DECREASE_RATE * dt;
  }
  if (entity.cold > COLD_CRITICAL) {
    hpChange -= HP_DECREASE_RATE * dt;
  }

  // Check if all needs are met for HP regeneration
  const needsMet = entity.hunger > HUNGER_MET &&
                   entity.cold < COLD_MET &&
                   entity.tiredness < TIREDNESS_MET;

  if (needsMet && hpChange === 0) {
    hpChange += HP_REGEN_RATE * dt;
  }

  entity.hp = Math.max(0, Math.min(100, entity.hp + hpChange));

  // 5. Check for death
  if (entity.hp <= 0) {
    entity.isDead = true;
    console.log(`💀 ${entity.type} has died!`);
  }

  // 6. Check for forced sleep
  if (!entity.isSleeping && entity.tiredness >= TIREDNESS_FORCE_SLEEP) {
    console.log(`😴 ${entity.type} is exhausted and must sleep!`);
    // Force sleep will be handled by the action system
  }
}

// ============================================================
// MOVEMENT SPEED MODIFIERS
// ============================================================

export function getSpeedMultiplier(entity) {
  if (entity.isDead) return 0;

  // Check tiredness penalties
  if (entity.tiredness >= TIREDNESS_SLOW_WALK) {
    return 0.5; // Half speed
  }

  return 1.0; // Normal speed
}

export function canRun(entity) {
  if (entity.isDead) return false;
  return entity.tiredness < TIREDNESS_NO_RUN;
}

// ============================================================
// EATING
// ============================================================

export function eat(entity, foodType) {
  if (entity.isDead) {
    return { success: false, reason: 'entity_dead' };
  }

  // Check if entity has the food item
  const itemIndex = entity.inventory.items.findIndex(item => item.type === foodType);
  if (itemIndex === -1) {
    return { success: false, reason: 'no_food' };
  }

  // Consume the food
  entity.inventory.removeItem(itemIndex);
  entity.hunger = Math.min(100, entity.hunger + FOOD_HUNGER_RESTORE);

  console.log(`🍽️ ${entity.type} ate ${foodType}. Hunger: ${entity.hunger.toFixed(1)}`);

  return { success: true };
}

// ============================================================
// NEEDS DISPLAY
// ============================================================

export function getNeedsStatus(entity) {
  return {
    hunger: entity.hunger,
    tiredness: entity.tiredness,
    cold: entity.cold,
    hp: entity.hp,
    isDead: entity.isDead
  };
}
