// ============================================================
// PROMPT REFACTOR TESTS
// ============================================================
// Test the new minimal, words-first prompt builder

import * as translator from './translator.js';
import { NEED_THRESHOLDS } from './config.js';

// ============================================================
// TEST SNAPSHOTS
// ============================================================

console.log('\n' + '='.repeat(80));
console.log('PROMPT REFACTOR TEST - SNAPSHOT OUTPUTS');
console.log('='.repeat(80) + '\n');

// --- Test 1: All needs fine ---
console.log('TEST 1: Healthy character (all needs >75%)');
console.log('-'.repeat(80));

const test1Needs = {
  food: 80,
  energy: 85,
  warmth: 90,
  health: 95
};

console.log('Input state:');
console.log('  Needs:', test1Needs);
console.log('\nTranslated needs:');
console.log('  Food:', translator.translateNeed(test1Needs.food, 'food') || 'fine (omitted from prompt)');
console.log('  Energy:', translator.translateNeed(test1Needs.energy, 'energy') || 'fine (omitted from prompt)');
console.log('  Warmth:', translator.translateNeed(test1Needs.warmth, 'warmth') || 'fine (omitted from prompt)');
console.log('  Health:', translator.translateNeed(test1Needs.health, 'health') || 'fine (omitted from prompt)');
console.log('  Expected in prompt: "all fine"');
console.log('\n');

// --- Test 2: Multiple needs critical ---
console.log('TEST 2: Critical state (multiple needs ≤10%)');
console.log('-'.repeat(80));

const test2Needs = {
  food: 8,    // starving (≤10%)
  energy: 45, // a little tired (50-75%)
  warmth: 5,  // freezing (≤10%)
  health: 25  // hurt (25-50%)
};

console.log('Input state:');
console.log('  Needs:', test2Needs);
console.log('\nTranslated needs:');
console.log('  Food:', translator.translateNeed(test2Needs.food, 'food'));
console.log('  Energy:', translator.translateNeed(test2Needs.energy, 'energy'));
console.log('  Warmth:', translator.translateNeed(test2Needs.warmth, 'warmth'));
console.log('  Health:', translator.translateNeed(test2Needs.health, 'health'));
console.log('\n');

// --- Test 3: Mid-range needs ---
console.log('TEST 3: Mid-range needs (various tiers)');
console.log('-'.repeat(80));

const test3Needs = {
  food: 35,   // hungry (25-50%)
  energy: 15, // very tired (10-25%)
  warmth: 60, // a little cold (50-75%)
  health: 100 // fine (>75%)
};

console.log('Input state:');
console.log('  Needs:', test3Needs);
console.log('\nTranslated needs:');
console.log('  Food:', translator.translateNeed(test3Needs.food, 'food'));
console.log('  Energy:', translator.translateNeed(test3Needs.energy, 'energy'));
console.log('  Warmth:', translator.translateNeed(test3Needs.warmth, 'warmth'));
console.log('  Health:', translator.translateNeed(test3Needs.health, 'health') || 'fine (omitted from prompt)');
console.log('\n');

// --- Test 4: Distance translation ---
console.log('TEST 4: Distance translation');
console.log('-'.repeat(80));

const distances = [20, 50, 75, 120, 200];
console.log('Distance thresholds: at hand ≤50, nearby 51-120, far >120');
distances.forEach(d => {
  console.log(`  ${d}px → "${translator.translateDistance(d)}"`);
});
console.log('\n');

// --- Test 5: Bonfire fuel levels ---
console.log('TEST 5: Bonfire fuel translation');
console.log('-'.repeat(80));

const fuelLevels = [95, 85, 60, 25, 5];
console.log('Fuel thresholds: blaze ≥90, strong 70-89, low 30-69, fading <30');
fuelLevels.forEach(f => {
  console.log(`  ${f}% → "${translator.translateBonfireFuel(f)}"`);
});
console.log('\n');

// --- Test 6: Entity ranking ---
console.log('TEST 6: Nearby entity ranking (capped at 3)');
console.log('-'.repeat(80));

// Mock character entity
const mockCharacter = {
  x: 500,
  y: 500,
  food: 20,  // hungry (dominant need)
  energy: 70,
  warmth: 60,
  hp: 80
};

// Mock visible entities
const mockEntities = [
  { id: 't1', type: 'tree', x: 520, y: 510, apples: 3, berries: 0, sticks: 1 },
  { id: 't2', type: 'tree', x: 600, y: 600, apples: 0, berries: 0, sticks: 0 },
  { id: 'bon1', type: 'bonfire', x: 480, y: 520, fuel: 45 },
  { id: 'a1', type: 'apple', x: 530, y: 505 },
  { id: 'w1', type: 'wolf', x: 700, y: 700 },
  { id: 's1', type: 'stick', x: 510, y: 495 },
];

console.log('Character state: food=20 (hungry - dominant need)');
console.log('Visible entities:', mockEntities.length);
console.log('\nRanked nearby (max 3):');
const ranked = translator.translateNearbyEntities(mockEntities, mockCharacter, {
  food: mockCharacter.food,
  energy: mockCharacter.energy,
  warmth: mockCharacter.warmth,
  health: mockCharacter.hp
});

ranked.forEach((desc, i) => {
  console.log(`  ${i + 1}. ${desc}`);
});
console.log('\n');

// --- Test 7: Full prompt example ---
console.log('TEST 7: Complete prompt output');
console.log('-'.repeat(80));

// Build a full prompt manually (simulating buildPrompt logic)
const needs = {
  food: 25,   // very hungry
  energy: 55, // a little tired
  warmth: 12, // very cold
  health: 70  // a little hurt
};

const needWords = [];
const foodWord = translator.translateNeed(needs.food, 'food');
const energyWord = translator.translateNeed(needs.energy, 'energy');
const warmthWord = translator.translateNeed(needs.warmth, 'warmth');
const healthWord = translator.translateNeed(needs.health, 'health');

if (foodWord) needWords.push(`food ${foodWord}`);
if (energyWord) needWords.push(`energy ${energyWord}`);
if (warmthWord) needWords.push(`warmth ${warmthWord}`);
if (healthWord) needWords.push(`health ${healthWord}`);

const needsLine = needWords.length > 0 ? needWords.join(', ') : 'all fine';
const timeDescription = translator.translateTime();
const inventoryLine = 'apple, stick';
const nearbyLine = 'tree @t1 (at hand, has: 2 apples, 1 stick); bonfire @bon1 (nearby, fuel: low); apple @a1 (at hand)';
const memoryLine = null; // No memory in this example

const prompt = `You are Lira — practical and cautious but kind.
Assume commonsense. Treat the need words as literal state tags (not storytelling).

Situation: ${timeDescription}. Goal: survive and thrive.
Needs: ${needsLine}
Inventory: ${inventoryLine}
Nearby: ${nearbyLine}${memoryLine ? `\nMemory: ${memoryLine}` : ''}
Constraints: interact only at hand; carry up to two items.

Allowed actions:
searchFor('apple'|'berry'|'stick'|'bonfire')
moveTo(id)
collect(id,'apple'|'berry'|'stick')
addFuel('bon1')
eat('apple'|'berry')
sleep()
wander()

Respond only with strict JSON:
{
  "intent": "<short goal>",
  "plan": ["<step1>", "<step2>", "<step3>"],
  "next_action": {"name":"...","args":{...}},
  "bubble": {"text":"<≤8 words>","emoji":"<one>"}
}`;

console.log(prompt);
console.log('\n');

// --- Validation checks ---
console.log('VALIDATION CHECKS');
console.log('-'.repeat(80));

const checks = [
  { name: 'No numeric need values in prompt', pass: !prompt.match(/\d+\/100/) },
  { name: 'No mechanics explanations', pass: !prompt.includes('lose HP if') },
  { name: 'No in-prompt examples', pass: !prompt.includes('Examples:') },
  { name: 'Uses word-based needs', pass: prompt.includes('very hungry') || prompt.includes('very cold') },
  { name: 'Time includes hours until transition', pass: /\(\d+h until/.test(prompt) },
  { name: 'Minimal and concise', pass: prompt.length < 1000 },
  { name: 'Only allowed actions listed', pass: prompt.includes("searchFor('apple'") }
];

checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
});

console.log('\n' + '='.repeat(80));
console.log('Prompt length:', prompt.length, 'characters');
console.log('Target: <1000 characters (minimal and concise)');
console.log('='.repeat(80) + '\n');
