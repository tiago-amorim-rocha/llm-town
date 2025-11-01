// ============================================================
// GAME CONFIGURATION
// ============================================================
// All game settings are centralized here for easy adjustment

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

// Duration of each phase in the day/night cycle (in milliseconds)
export const DAY_DURATION = 20000;    // 20 seconds
export const DUSK_DURATION = 10000;   // 10 seconds
export const NIGHT_DURATION = 20000;  // 20 seconds
export const DAWN_DURATION = 10000;   // 10 seconds

// Total cycle duration (60 seconds)
export const DAY_NIGHT_CYCLE_DURATION =
  DAY_DURATION + DUSK_DURATION + NIGHT_DURATION + DAWN_DURATION;

// ============================================================
// LIGHTING SETTINGS
// ============================================================

// Maximum darkness opacity at night (0-1 range)
// Lower values = brighter overall, more contrast between day/night
export const MAX_DARKNESS_OPACITY = 0.6;  // Reduced from 0.6 for better visibility

// Background colors
export const BACKGROUND_COLOR = "#2a5d2a";  // Lighter green for better visibility

// ============================================================
// CHARACTER MOVEMENT SETTINGS
// ============================================================

export const MOVEMENT_SPEED = 1.5;              // Pixels per frame (base speed)
export const RUN_SPEED_MULTIPLIER = 2.0;        // Running doubles movement speed
export const DIRECTION_CHANGE_INTERVAL = 4000;  // Change direction every 4 seconds (search mode)
export const MOVEMENT_UPDATE_INTERVAL = 1000 / 60; // 60 fps visual updates (~16.67ms)
export const MOVE_TO_ARRIVAL_DISTANCE = 20;     // Consider arrived when within this distance
export const MOVE_TO_MAX_CYCLES = 3;            // Number of move-to cycles before search mode
export const SEARCH_MODE_DURATION = 10000;      // Search mode duration in milliseconds (10 seconds)

// ============================================================
// TREE GENERATION SETTINGS
// ============================================================

export const TREE_COUNT_MIN = 10;
export const TREE_COUNT_MAX = 15;
export const MIN_HORIZONTAL_SPACING = 80;   // Minimum horizontal distance between trees
export const MIN_VERTICAL_SPACING = 150;    // Minimum vertical distance between trees
export const MAX_PLACEMENT_ATTEMPTS = 50;   // Max attempts to place each tree
export const BONFIRE_EXCLUSION_RADIUS = 75; // Trees won't spawn within this radius of bonfire

// ============================================================
// GRASS GENERATION SETTINGS
// ============================================================

export const GRASS_COUNT_MIN = 10;
export const GRASS_COUNT_MAX = 20;

// ============================================================
// COLLECTION SETTINGS
// ============================================================

export const APPLE_COLLECTION_TIME = 3000;   // Time to collect apple in milliseconds (3 seconds)
export const BERRY_COLLECTION_TIME = 2500;   // Time to collect berries in milliseconds (2.5 seconds)
export const MAX_INVENTORY_SIZE = 2;         // Maximum items character can carry

// ============================================================
// VERSION CHECKING
// ============================================================

export const VERSION_CHECK_INTERVAL = 2000; // Check for updates every 2 seconds
