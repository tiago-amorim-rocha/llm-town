// === DAY/NIGHT CYCLE MODULE ===
// Handles day/night cycle calculations and in-game time tracking

import * as config from './config.js';
import * as time from './time.js';
import { easeInOutCubic } from './utils.js';

// Day/night configuration (imported from config, which converts from in-game hours)
const DAY_DURATION = config.DAY_DURATION;
const DUSK_DURATION = config.DUSK_DURATION;
const NIGHT_DURATION = config.NIGHT_DURATION;
const DAWN_DURATION = config.DAWN_DURATION;
const DAY_NIGHT_CYCLE_DURATION = config.DAY_NIGHT_CYCLE_DURATION;

let cycleStartTime = Date.now();

// Get current cycle state and progress
export function getCycleState() {
  const elapsed = Date.now() - cycleStartTime;
  const cycleTime = elapsed % DAY_NIGHT_CYCLE_DURATION;

  if (cycleTime < DAY_DURATION) {
    // Day: 0-20s
    return { state: 'day', progress: cycleTime / DAY_DURATION };
  } else if (cycleTime < DAY_DURATION + DUSK_DURATION) {
    // Dusk: 20-30s
    const duskTime = cycleTime - DAY_DURATION;
    return { state: 'dusk', progress: duskTime / DUSK_DURATION };
  } else if (cycleTime < DAY_DURATION + DUSK_DURATION + NIGHT_DURATION) {
    // Night: 30-50s
    const nightTime = cycleTime - DAY_DURATION - DUSK_DURATION;
    return { state: 'night', progress: nightTime / NIGHT_DURATION };
  } else {
    // Dawn: 50-60s
    const dawnTime = cycleTime - DAY_DURATION - DUSK_DURATION - NIGHT_DURATION;
    return { state: 'dawn', progress: dawnTime / DAWN_DURATION };
  }
}

// Get darkness overlay opacity based on cycle state
export function getDarknessOpacity() {
  const { state, progress } = getCycleState();
  const maxDarkness = config.MAX_DARKNESS_OPACITY;

  switch (state) {
    case 'day':
      return 0; // No darkness during day

    case 'dusk':
      // Transition from light to dark with ease-in-out
      const duskProgress = easeInOutCubic(progress);
      return maxDarkness * duskProgress;

    case 'night':
      return maxDarkness; // Full darkness at night

    case 'dawn':
      // Transition from dark to light with ease-in-out
      const dawnProgress = easeInOutCubic(progress);
      return maxDarkness * (1 - dawnProgress);

    default:
      return 0;
  }
}

// Reset cycle time (e.g., on scene reset)
export function resetCycleTime() {
  cycleStartTime = Date.now();
  time.resetCycleTime();
}

// Get current in-game time
// Returns { day, hour, minute, second, phase, totalSeconds, totalHours }
export function getInGameTime() {
  return time.getCurrentInGameTime();
}

// Format in-game time as readable string (e.g., "Day 1, 14:30")
export function formatInGameTime(timeObject) {
  return time.formatInGameTime(timeObject || getInGameTime());
}
