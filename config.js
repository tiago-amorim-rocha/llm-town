// ============================================================
// GAME CONFIGURATION
// ============================================================
// All game settings are centralized here for easy adjustment
//
// TIME SYSTEM:
// The game uses in-game time (hours/minutes/seconds) which passes faster
// than real time. See time.js for conversion functions and TIME_MULTIPLIER.
//
// Current TIME_MULTIPLIER = 240 (testing):
//   1 in-game hour = 15 real seconds
//   1 full day (24 hours) = 6 real minutes

import * as time from './time.js';

// ============================================================
// VISIBILITY SETTINGS
// ============================================================

// Visibility radius during different times of day
// Note: These values have been halved for better gameplay balance
export const DAY_VISIBILITY_RADIUS = 150;   // Halved from 300px
export const NIGHT_VISIBILITY_RADIUS = 60;  // Halved from 120px

// ============================================================
// DAY/NIGHT CYCLE SETTINGS
// ============================================================

// Duration of each phase (in in-game hours)
// Northern location: long nights (12h), short days (8h)
export const DAY_HOURS = time.DAY_HOURS;       // 8 in-game hours of daylight
export const DUSK_HOURS = time.DUSK_HOURS;     // 2 in-game hours of dusk
export const NIGHT_HOURS = time.NIGHT_HOURS;   // 12 in-game hours of night
export const DAWN_HOURS = time.DAWN_HOURS;     // 2 in-game hours of dawn

// Convert to real milliseconds for cycle calculations
export const DAY_DURATION = time.inGameHoursToRealMs(DAY_HOURS);
export const DUSK_DURATION = time.inGameHoursToRealMs(DUSK_HOURS);
export const NIGHT_DURATION = time.inGameHoursToRealMs(NIGHT_HOURS);
export const DAWN_DURATION = time.inGameHoursToRealMs(DAWN_HOURS);
export const DAY_NIGHT_CYCLE_DURATION = time.inGameHoursToRealMs(24);

// ============================================================
// LIGHTING SETTINGS
// ============================================================

// Maximum darkness opacity at night (0-1 range)
// Lower values = brighter overall, more contrast between day/night
export const MAX_DARKNESS_OPACITY = 0.6;

// Background colors
export const BACKGROUND_COLOR = "#2a5d2a";  // Lighter green for better visibility

// ============================================================
// CHARACTER MOVEMENT SETTINGS
// ============================================================

// Movement speed (in pixels per in-game hour)
// This maintains visual speed across different TIME_MULTIPLIERs
const MOVEMENT_SPEED_PER_INGAME_HOUR = 337.5;  // Half speed - equivalent to 22.5 px/s real at TIME_MULTIPLIER=240

// Convert to pixels per real second for use in movement calculations
export const MOVEMENT_SPEED = MOVEMENT_SPEED_PER_INGAME_HOUR / 3600 * time.TIME_MULTIPLIER;

export const RUN_SPEED_MULTIPLIER = 1.0;        // Running speed multiplier
export const MOVEMENT_UPDATE_INTERVAL = 1000 / 60; // 60 fps visual updates (~16.67ms)
export const MOVE_TO_ARRIVAL_DISTANCE = 20;     // Consider arrived when within this distance (pixels)
export const MOVE_TO_MAX_CYCLES = 3;            // Number of move-to cycles before search mode

// Direction change interval (in in-game minutes)
const DIRECTION_CHANGE_MINUTES = 32;  // Change direction every 32 in-game minutes
export const DIRECTION_CHANGE_INTERVAL = time.inGameMinutesToRealMs(DIRECTION_CHANGE_MINUTES);

// Search mode duration (in in-game minutes)
const SEARCH_MODE_MINUTES = 80;  // Search for 80 in-game minutes (~1.3 hours)
export const SEARCH_MODE_DURATION = time.inGameMinutesToRealMs(SEARCH_MODE_MINUTES);

// ============================================================
// TREE GENERATION SETTINGS
// ============================================================

export const TREE_COUNT_MIN = 3;  // Reduced by 30% from 5
export const TREE_COUNT_MAX = 5;  // Reduced by 30% from 7
export const TREE_RADIUS = 40;              // Approximate tree radius at scale 1.0 (for collision/margins)
export const MAX_PLACEMENT_ATTEMPTS = 50;   // Max attempts to place each tree
export const BONFIRE_EXCLUSION_RADIUS = 200; // Trees won't spawn within this radius of bonfire (doubled for more clear space)

// ============================================================
// GRASS GENERATION SETTINGS
// ============================================================

export const GRASS_COUNT_MIN = 6;   // Reduced by 30% from 8
export const GRASS_COUNT_MAX = 10;  // Reduced by 30% from 15
export const GRASS_RADIUS = 25;             // Approximate grass radius at scale 1.0 (for margins)

// ============================================================
// COLLECTION SETTINGS
// ============================================================

export const COLLECTION_RANGE = 50;          // Maximum distance to collect items (pixels)

// Collection times (in in-game minutes)
const APPLE_COLLECTION_MINUTES = 24;  // 24 in-game minutes to collect apple
const BERRY_COLLECTION_MINUTES = 20;  // 20 in-game minutes to collect berries

// Convert to real milliseconds
export const APPLE_COLLECTION_TIME = time.inGameMinutesToRealMs(APPLE_COLLECTION_MINUTES);
export const BERRY_COLLECTION_TIME = time.inGameMinutesToRealMs(BERRY_COLLECTION_MINUTES);

export const MAX_INVENTORY_SIZE = 2;         // Maximum items character can carry

// ============================================================
// LLM PROMPT - NEED THRESHOLDS
// ============================================================

// 5-tier word-based need thresholds (no numbers in prompts)
// Tier 1 (>75%): fine (omitted from prompt)
// Tier 2 (50-75%): "a little [hungry/tired/cold/hurt]"
// Tier 3 (25-50%): "[hungry/tired/cold/hurt]"
// Tier 4 (10-25%): "very [hungry/tired/cold/hurt]"
// Tier 5 (≤10%): "[starving/exhausted/freezing/critical]"

export const NEED_THRESHOLDS = {
  TIER_1: 75,  // Fine (omit from prompt)
  TIER_2: 50,  // "a little X"
  TIER_3: 25,  // "X"
  TIER_4: 10,  // "very X"
  TIER_5: 0    // Critical state
};

// Distance thresholds for word-based distances
export const DISTANCE_THRESHOLDS = {
  AT_HAND: 50,    // ≤50px: "at hand"
  NEARBY: 120,    // 51-120px: "nearby"
  FAR: Infinity   // >120px: "far"
};

// Bonfire fuel thresholds
export const BONFIRE_FUEL_THRESHOLDS = {
  BLAZE: 90,     // ≥90: "blaze"
  STRONG: 70,    // 70-89: "strong"
  LOW: 30,       // 30-69: "low"
  FADING: 0      // <30: "fading"
};

// LLM prompt settings
export const NEARBY_ENTITY_CAP = 3;  // Max 3 useful entities in prompt

// LLM heartbeat settings (in in-game hours)
const HEARTBEAT_INTERVAL_HOURS = 1;  // Required heartbeat every 1 in-game hour
export const HEARTBEAT_INTERVAL = time.inGameHoursToRealMs(HEARTBEAT_INTERVAL_HOURS);

// ============================================================
// VERSION CHECKING
// ============================================================

export const VERSION_CHECK_INTERVAL = 2000; // Check for updates every 2 seconds
