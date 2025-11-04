// === TIME SYSTEM MODULE ===
// Handles conversion between in-game time and real time
//
// The game uses an accelerated time system where in-game time passes faster
// than real time. This module provides conversion functions and tracks the
// current in-game time based on the day/night cycle.

// ============================================================
// TIME MULTIPLIER
// ============================================================
// How fast in-game time passes relative to real time
// Example values:
//   240 = 1 in-game hour = 15 real seconds (full day = 6 real minutes) [TESTING]
//   60  = 1 in-game hour = 1 real minute (full day = 24 real minutes) [PRODUCTION]
export const TIME_MULTIPLIER = 240;

// ============================================================
// DAY/NIGHT CYCLE DEFINITION (in in-game hours)
// ============================================================
// Northern location: long nights, short days
export const DAY_HOURS = 8;      // 8 hours of daylight
export const DUSK_HOURS = 2;     // 2 hours of dusk transition
export const NIGHT_HOURS = 12;   // 12 hours of night
export const DAWN_HOURS = 2;     // 2 hours of dawn transition
export const HOURS_PER_DAY = 24; // Total hours in a day

// ============================================================
// TIME CONVERSION FUNCTIONS
// ============================================================

/**
 * Convert in-game seconds to real milliseconds
 * @param {number} seconds - In-game seconds
 * @returns {number} Real milliseconds
 */
export function inGameSecondsToRealMs(seconds) {
  return (seconds * 1000) / TIME_MULTIPLIER;
}

/**
 * Convert real milliseconds to in-game seconds
 * @param {number} ms - Real milliseconds
 * @returns {number} In-game seconds
 */
export function realMsToInGameSeconds(ms) {
  return (ms * TIME_MULTIPLIER) / 1000;
}

/**
 * Convert in-game minutes to real milliseconds
 * @param {number} minutes - In-game minutes
 * @returns {number} Real milliseconds
 */
export function inGameMinutesToRealMs(minutes) {
  return inGameSecondsToRealMs(minutes * 60);
}

/**
 * Convert in-game hours to real milliseconds
 * @param {number} hours - In-game hours
 * @returns {number} Real milliseconds
 */
export function inGameHoursToRealMs(hours) {
  return inGameSecondsToRealMs(hours * 3600);
}

/**
 * Convert real milliseconds to in-game minutes
 * @param {number} ms - Real milliseconds
 * @returns {number} In-game minutes
 */
export function realMsToInGameMinutes(ms) {
  return realMsToInGameSeconds(ms) / 60;
}

/**
 * Convert real milliseconds to in-game hours
 * @param {number} ms - Real milliseconds
 * @returns {number} In-game hours
 */
export function realMsToInGameHours(ms) {
  return realMsToInGameSeconds(ms) / 3600;
}

// ============================================================
// CYCLE TIME TRACKING
// ============================================================

let cycleStartTime = Date.now();

/**
 * Reset the cycle start time (for scene resets)
 */
export function resetCycleTime() {
  cycleStartTime = Date.now();
}

/**
 * Get the current in-game time based on elapsed real time
 * @returns {Object} { day, hour, minute, second, phase, totalSeconds, totalHours }
 */
export function getCurrentInGameTime() {
  const realElapsed = Date.now() - cycleStartTime;
  const inGameSeconds = realMsToInGameSeconds(realElapsed);

  // Calculate day/hour/minute/second
  const totalSeconds = inGameSeconds;
  const totalMinutes = totalSeconds / 60;
  const totalHours = totalMinutes / 60;

  const day = Math.floor(totalHours / HOURS_PER_DAY);
  const hourInDay = totalHours % HOURS_PER_DAY;
  const hour = Math.floor(hourInDay);
  const minute = Math.floor((hourInDay - hour) * 60);
  const second = Math.floor(((hourInDay - hour) * 60 - minute) * 60);

  // Determine phase based on hour
  let phase = 'day';
  if (hourInDay < DAY_HOURS) {
    phase = 'day';
  } else if (hourInDay < DAY_HOURS + DUSK_HOURS) {
    phase = 'dusk';
  } else if (hourInDay < DAY_HOURS + DUSK_HOURS + NIGHT_HOURS) {
    phase = 'night';
  } else {
    phase = 'dawn';
  }

  return {
    day,
    hour,
    minute,
    second,
    phase,
    totalSeconds,
    totalHours,
    hourInDay
  };
}

/**
 * Format in-game time as a readable string
 * @param {Object} timeObject - Result from getCurrentInGameTime()
 * @returns {string} Formatted time string (e.g., "Day 1, 14:30")
 */
export function formatInGameTime(timeObject) {
  const { day, hour, minute } = timeObject;
  const hourStr = String(hour).padStart(2, '0');
  const minStr = String(minute).padStart(2, '0');
  return `Day ${day + 1}, ${hourStr}:${minStr}`;
}
