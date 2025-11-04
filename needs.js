// === NEEDS SYSTEM ===
// Manages hunger, tiredness, cold, and HP for SmartEntity
//
// TIME SYSTEM: All rates are defined in terms of in-game time (per in-game hour)
// and converted to per real second for use in update calculations.

import * as config from './config.js';
import * as time from './time.js';

// ============================================================
// NEEDS CONFIGURATION
// ============================================================

// Scale: 0-100 for all properties (LOW IS ALWAYS BAD)
export const INITIAL_FOOD = 100;        // Full (was hunger - flipped naming)
export const INITIAL_ENERGY = 100;      // Rested (was tiredness - flipped)
export const INITIAL_WARMTH = 100;      // Warm (was cold - flipped)
export const INITIAL_HP = 100;          // Full health

// Thresholds (LOW IS ALWAYS BAD)
export const FOOD_CRITICAL = 30;        // Below this, HP starts decreasing
export const WARMTH_CRITICAL = 30;      // Below this, HP starts decreasing (was cold > 70)
export const ENERGY_NO_RUN = 30;        // Below this, can't run (was tiredness > 70)
export const ENERGY_SLOW_WALK = 15;     // Below this, walk at half speed (was tiredness > 85)
export const ENERGY_FORCE_SLEEP = 5;    // Below this, forced sleep (was tiredness > 95)

// Needs "met" for HP regeneration (all need to be above 50)
export const FOOD_MET = 50;
export const WARMTH_MET = 50;
export const ENERGY_MET = 50;

// Rates (defined in in-game time, converted to real time below) - LOW IS ALWAYS BAD
// Food depletes in ~2.78 in-game days (66.7 in-game hours)
const FOOD_DECREASE_PER_INGAME_HOUR = 1.5;     // 100 / 66.7 ≈ 1.5 per hour

// Energy rates (in-game hours)
const ENERGY_IDLE_PER_INGAME_HOUR = 0.75;      // Slow decrease when idle (~133 hours to deplete)
const ENERGY_WALK_PER_INGAME_HOUR = 2.25;      // Faster decrease when walking (~44 hours)
const ENERGY_RUN_PER_INGAME_HOUR = 4.5;        // Even faster decrease when running (~22 hours)

// Warmth rates (in-game hours)
const WARMTH_DECREASE_PER_INGAME_HOUR = 3.0;   // When away from bonfire (~33 hours)
const WARMTH_INCREASE_PER_INGAME_HOUR = 7.5;   // When near bonfire (~13 hours to full)

// HP rates (in-game hours)
const HP_DECREASE_PER_INGAME_HOUR = 7.5;       // Per critical need (~13 hours to death)
const HP_REGEN_PER_INGAME_HOUR = 4.5;          // When all needs met (~22 hours to full)

// Sleep energy restore rate (in-game hours)
const SLEEP_ENERGY_RESTORE_PER_INGAME_HOUR = 22.5;  // Fast recovery (~4.5 hours to full)

// Convert to per real second for use in calculations
export const FOOD_DECREASE_RATE = FOOD_DECREASE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const ENERGY_IDLE_RATE = ENERGY_IDLE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const ENERGY_WALK_RATE = ENERGY_WALK_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const ENERGY_RUN_RATE = ENERGY_RUN_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const WARMTH_DECREASE_RATE = WARMTH_DECREASE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const WARMTH_INCREASE_RATE = WARMTH_INCREASE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const HP_DECREASE_RATE = HP_DECREASE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const HP_REGEN_RATE = HP_REGEN_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;
export const SLEEP_ENERGY_RESTORE_RATE = SLEEP_ENERGY_RESTORE_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;

// Bonfire warmth radius
export const BONFIRE_WARMTH_RADIUS = 100;       // Stay within this distance to warm up

// Eating
export const FOOD_RESTORE = 40;                 // Instant restore per food item

// Sleep
export const SLEEP_TARGET_ENERGY = 90;          // Sleep until energy is above this (was tiredness < 10)
export const SLEEP_INTERRUPT_HP = 20;           // Wake up if HP drops below this

// ============================================================
// NEEDS INITIALIZATION
// ============================================================

export function initNeeds(entity) {
  entity.food = INITIAL_FOOD;
  entity.energy = INITIAL_ENERGY;
  entity.warmth = INITIAL_WARMTH;
  entity.hp = INITIAL_HP;
  entity.isDead = false;
}

// ============================================================
// NEEDS UPDATE (called every frame)
// ============================================================

export function updateNeeds(entity, deltaTime, bonfireEntity) {
  if (entity.isDead) return;

  const dt = deltaTime / 1000; // Convert to seconds

  // 1. Update food (always decreases - low is bad)
  entity.food = Math.max(0, entity.food - FOOD_DECREASE_RATE * dt);

  // 2. Update energy (depends on movement state - low is bad)
  let energyRate = ENERGY_IDLE_RATE;

  if (entity.isSleeping) {
    // Sleeping restores energy (increases it)
    entity.energy = Math.min(100, entity.energy + SLEEP_ENERGY_RESTORE_RATE * dt);
  } else if (entity.currentMovementAction === 'moving_to' || entity.currentMovementAction === 'wandering') {
    // Check if running (based on speed multiplier in movement system)
    const isRunning = entity.isRunning || false;
    energyRate = isRunning ? ENERGY_RUN_RATE : ENERGY_WALK_RATE;
    entity.energy = Math.max(0, entity.energy - energyRate * dt); // Decreases (gets tired)
  } else {
    // Idle - still decreases slowly
    entity.energy = Math.max(0, entity.energy - energyRate * dt);
  }

  // 3. Update warmth (depends on distance to bonfire - low is bad)
  if (bonfireEntity) {
    const distToBonfire = Math.sqrt(
      (entity.x - bonfireEntity.x) ** 2 +
      (entity.y - bonfireEntity.y) ** 2
    );

    if (distToBonfire <= BONFIRE_WARMTH_RADIUS) {
      // Near bonfire: warm up (increases)
      entity.warmth = Math.min(100, entity.warmth + WARMTH_INCREASE_RATE * dt);
    } else {
      // Away from bonfire: get cold (decreases)
      entity.warmth = Math.max(0, entity.warmth - WARMTH_DECREASE_RATE * dt);
    }
  } else {
    // No bonfire: always getting cold (decreases)
    entity.warmth = Math.max(0, entity.warmth - WARMTH_DECREASE_RATE * dt);
  }

  // 4. Update HP based on needs (low is bad for all)
  let hpChange = 0;

  // Count critical needs (all low = bad)
  if (entity.food < FOOD_CRITICAL) {
    hpChange -= HP_DECREASE_RATE * dt;
  }
  if (entity.warmth < WARMTH_CRITICAL) {
    hpChange -= HP_DECREASE_RATE * dt;
  }

  // Check if all needs are met for HP regeneration (all above 50)
  const needsMet = entity.food > FOOD_MET &&
                   entity.warmth > WARMTH_MET &&
                   entity.energy > ENERGY_MET;

  if (needsMet && hpChange === 0) {
    hpChange += HP_REGEN_RATE * dt;
  }

  entity.hp = Math.max(0, Math.min(100, entity.hp + hpChange));

  // 5. Check for death
  if (entity.hp <= 0) {
    entity.isDead = true;
    console.log(`💀 ${entity.type} has died!`);
  }

  // 6. Check for forced sleep (low energy)
  if (!entity.isSleeping && entity.energy <= ENERGY_FORCE_SLEEP) {
    console.log(`😴 ${entity.type} is exhausted and must sleep!`);
    // Force sleep will be handled by the action system
  }
}

// ============================================================
// MOVEMENT SPEED MODIFIERS
// ============================================================

export function getSpeedMultiplier(entity) {
  if (entity.isDead) return 0;

  // Check energy penalties (low energy = slow)
  if (entity.energy <= ENERGY_SLOW_WALK) {
    return 0.5; // Half speed
  }

  return 1.0; // Normal speed
}

export function canRun(entity) {
  if (entity.isDead) return false;
  return entity.energy > ENERGY_NO_RUN; // Need energy above threshold to run
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
  entity.food = Math.min(100, entity.food + FOOD_RESTORE);

  console.log(`🍽️ ${entity.type} ate ${foodType}. Food: ${entity.food.toFixed(1)}`);

  return { success: true };
}

// ============================================================
// NEEDS DISPLAY
// ============================================================

export function getNeedsStatus(entity) {
  return {
    food: entity.food,
    energy: entity.energy,
    warmth: entity.warmth,
    hp: entity.hp,
    isDead: entity.isDead
  };
}
