// === AI DECISION LAYER ===
// LLM-driven decision making for SmartEntity agents
//
// This module handles:
// - Triggering LLM calls at appropriate moments
// - Building prompts from game state
// - Parsing and validating LLM responses
// - Executing validated actions
// - Rate limiting and error handling

import * as config from './config.js';
import { distance } from './utils.js';
import { getInGameTime, formatInGameTime } from './cycle.js';
import * as translator from './translator.js';

// ============================================================
// CONFIGURATION
// ============================================================

// Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyCpWEffL6jIpkSkUfZu-jj3BC_btV-piRk'; // From llm-exp repo
const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Fastest model (experimental)
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Rate limiting
const MAX_CALLS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MIN_TIME_BETWEEN_CALLS = 2000; // 2 seconds minimum between calls

// Decision triggers
const IDLE_TRIGGER_DELAY = 5000; // Ask LLM if idle for 5 seconds

// Entity categories for smart interrupt logic
const ENTITY_CATEGORIES = {
  apple: 'food',
  berry: 'food',
  stick: 'fuel',
  bonfire: 'warmth',
  wolf: 'threat',
  tree: 'source',    // Source of food (apples)
  grass: 'source'    // Source of food (berries)
};

// ============================================================
// STATE TRACKING
// ============================================================

// Track AI state per entity
const aiState = new Map();

function getAIState(entity) {
  if (!aiState.has(entity)) {
    aiState.set(entity, {
      enabled: false, // AI disabled by default
      lastCallTime: 0,
      callHistory: [], // Timestamps of recent calls for rate limiting
      lastDecision: null,
      currentPlan: [],
      currentIntent: '',
      actionHistory: [], // Keep all actions for debugging
      lastActionResult: null
    });
  }
  return aiState.get(entity);
}

// ============================================================
// RATE LIMITING
// ============================================================

function canMakeCall(entity) {
  const state = getAIState(entity);
  const now = Date.now();

  // Remove calls outside the rate limit window
  state.callHistory = state.callHistory.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  // Check if we've hit the rate limit
  if (state.callHistory.length >= MAX_CALLS_PER_WINDOW) {
    console.warn(`⏳ Rate limit: ${state.callHistory.length}/${MAX_CALLS_PER_WINDOW} calls in last 10s`);
    return false;
  }

  // Check minimum time between calls
  if (now - state.lastCallTime < MIN_TIME_BETWEEN_CALLS) {
    return false;
  }

  return true;
}

function recordCall(entity) {
  const state = getAIState(entity);
  const now = Date.now();
  state.callHistory.push(now);
  state.lastCallTime = now;
}

// ============================================================
// TRIGGER SYSTEM
// ============================================================

export function shouldTriggerDecision(entity, context = {}) {
  const state = getAIState(entity);

  // AI disabled
  if (!state.enabled) {
    return false;
  }

  // Entity is dead
  if (entity.isDead) {
    return false;
  }

  // Rate limiting
  if (!canMakeCall(entity)) {
    return false;
  }

  // Currently executing an action (collecting, sleeping)
  if (context.isCollecting || entity.isSleeping) {
    return false;
  }

  // High priority triggers
  if (context.actionCompleted) {
    return true;
  }

  if (context.needBecameCritical) {
    return true;
  }

  if (context.hpLow && entity.hp < 30) {
    return true;
  }

  // New important entity visible
  if (context.newEntityVisible) {
    const newEntityType = context.newEntityVisible.type;
    const newCategory = ENTITY_CATEGORIES[newEntityType];

    // Only care about categorized entities
    if (!newCategory) {
      return false;
    }

    // If currently moving to a target, check if we should interrupt
    if (entity.currentMovementAction === 'moving_to' && entity.movementActionData.target) {
      const currentTarget = entity.movementActionData.target;

      // Same exact entity (position match) - don't interrupt
      if (currentTarget.type === newEntityType &&
          currentTarget.x === context.newEntityVisible.x &&
          currentTarget.y === context.newEntityVisible.y) {
        return false;
      }

      // Threats always interrupt
      if (newCategory === 'threat') {
        return true;
      }

      // Check category of current target
      const currentCategory = ENTITY_CATEGORIES[currentTarget.type];

      // Same category (e.g., both food, both fuel) - don't interrupt
      // Let AI finish current action rather than thrash between similar resources
      if (currentCategory === newCategory) {
        return false;
      }

      // Different category - allow interrupt
      return true;
    }

    // Not moving or wandering - allow trigger for any new entity
    return true;
  }

  // Idle too long
  if (entity.currentMovementAction === null) {
    const idleTime = Date.now() - state.lastCallTime;
    if (idleTime > IDLE_TRIGGER_DELAY) {
      return true;
    }
  }

  // Required heartbeat (every in-game hour)
  // Skip if recently called for other reasons or if sleeping
  const timeSinceLastCall = Date.now() - state.lastCallTime;
  if (timeSinceLastCall >= config.HEARTBEAT_INTERVAL && !entity.isSleeping) {
    return true;
  }

  return false;
}

// ============================================================
// PROMPT BUILDING (minimal, words-first)
// ============================================================

function buildPrompt(entity, entities, context = {}) {
  const state = getAIState(entity);
  const visible = entity.getVisibleEntities();

  // Translate needs to words (only include if not fine)
  const needs = {
    food: entity.food,
    energy: entity.energy,
    warmth: entity.warmth,
    health: entity.hp
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

  // Translate time
  const timeDescription = translator.translateTime();

  // Translate inventory
  const inventoryLine = entity.inventory.items.length > 0
    ? entity.inventory.items.map(i => i.type).join(', ')
    : 'empty';

  // Translate nearby entities (max 3, ranked by relevance)
  const nearbyDescriptions = translator.translateNearbyEntities(visible, entity, needs);
  const nearbyLine = nearbyDescriptions.length > 0
    ? nearbyDescriptions.join('; ')
    : 'nothing visible';

  // Translate memory (simple: bonfire location if not visible)
  const memoryLine = translator.translateMemory(visible, entity.memory.discovered);

  // Build minimal prompt (words only, no numbers)
  let prompt = `You are Lira — practical and cautious but kind.
Assume commonsense. Treat the need words as literal state tags (not storytelling).

Situation: ${timeDescription}. Goal: survive and thrive.
Needs: ${needsLine}
Inventory: ${inventoryLine}
Nearby: ${nearbyLine}`;

  if (memoryLine) {
    prompt += `\nMemory: ${memoryLine}`;
  }

  prompt += `
Constraints: interact only at hand; carry up to two items.

Allowed actions (exact parameter names and prerequisites):
- searchFor: {"name":"searchFor","args":{"itemType":"apple"|"berry"|"stick"|"bonfire"}}
  → Wanders to find specified item type
- moveTo: {"name":"moveTo","args":{"target":"<ID>"}}
  → Walks to target entity (use ID without @ symbol)
- collect: {"name":"collect","args":{"target":"<ID>","itemType":"apple"|"berry"|"stick"}}
  → Picks up item from target (requires: target "at hand", inventory not full)
  → Use ID from nearby list, e.g., "sti3" not "@sti3"
- addFuel: {"name":"addFuel","args":{}}
  → Adds stick to bonfire (requires: stick in inventory, bonfire at hand)
- eat: {"name":"eat","args":{"foodType":"apple"|"berry"}}
  → Consumes food from inventory (requires: food in inventory)
- sleep: {"name":"sleep","args":{}}
  → Rests to restore energy
- wander: {"name":"wander","args":{}}
  → Explores randomly

Respond only with strict JSON:
{
  "intent": "<short goal>",
  "plan": ["<step1>", "<step2>", "<step3>"],
  "next_action": {"name":"...","args":{...}},
  "bubble": {"text":"<≤8 words>","emoji":"<one>"}
}

IMPORTANT: Use entity IDs from "Nearby" list WITHOUT the @ symbol.
Example - bonfire @bon1 is nearby, collect stick @sti3:
{"intent":"get fuel","plan":["collect stick","go to bonfire","add fuel"],"next_action":{"name":"collect","args":{"target":"sti3","itemType":"stick"}},"bubble":{"text":"getting stick","emoji":"🪵"}}`;

  return prompt;
}

function getDirection(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;

  let dir = '';
  if (Math.abs(dy) > 20) dir += dy < 0 ? 'N' : 'S';
  if (Math.abs(dx) > 20) dir += dx < 0 ? 'W' : 'E';

  return dir || 'here';
}

// ============================================================
// LLM API CALL
// ============================================================

async function callGemini(prompt) {
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No response from Gemini');
  }

  const text = data.candidates[0].content.parts[0].text;
  return text;
}

// ============================================================
// RESPONSE PARSING
// ============================================================

function parseResponse(responseText) {
  // Extract JSON from response (handle markdown code blocks)
  let jsonText = responseText.trim();

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n');
    lines.shift(); // Remove opening ```
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop(); // Remove closing ```
    }
    jsonText = lines.join('\n');
  }

  // Remove "json" language identifier if present
  jsonText = jsonText.replace(/^json\s*\n/i, '');

  try {
    const parsed = JSON.parse(jsonText);
    return { success: true, data: parsed };
  } catch (error) {
    console.error('❌ Failed to parse LLM response:', error.message);
    console.error('Response text:', responseText);
    return { success: false, error: error.message };
  }
}

// ============================================================
// ACTION VALIDATION
// ============================================================

function validateAction(action, entity, entities) {
  const { name, args } = action;

  // Check action exists
  const validActions = ['collect', 'drop', 'eat', 'moveTo', 'searchFor', 'addFuel', 'sleep', 'wander'];
  if (!validActions.includes(name)) {
    return { valid: false, reason: `Unknown action: ${name}` };
  }

  // Validate specific actions
  switch (name) {
    case 'collect':
      if (!args.target || !args.itemType) {
        return { valid: false, reason: 'collect requires target and itemType' };
      }
      if (entity.inventory.isFull()) {
        return { valid: false, reason: 'Inventory full' };
      }
      break;

    case 'drop':
      if (!args.itemType) {
        return { valid: false, reason: 'drop requires itemType' };
      }
      if (!entity.inventory.hasItem(args.itemType)) {
        return { valid: false, reason: `No ${args.itemType} in inventory` };
      }
      break;

    case 'eat':
      if (!args.foodType) {
        return { valid: false, reason: 'eat requires foodType' };
      }
      if (!entity.inventory.hasItem(args.foodType)) {
        return { valid: false, reason: `No ${args.foodType} in inventory` };
      }
      break;

    case 'moveTo':
      if (!args.target) {
        return { valid: false, reason: 'moveTo requires target' };
      }
      break;

    case 'searchFor':
      if (!args.itemType) {
        return { valid: false, reason: 'searchFor requires itemType' };
      }
      break;

    case 'addFuel':
      if (!entity.inventory.hasItem('stick')) {
        return { valid: false, reason: 'No sticks in inventory' };
      }
      const bonfire = entities.find(e => e.type === 'bonfire');
      if (!bonfire) {
        return { valid: false, reason: 'No bonfire in world' };
      }
      break;
  }

  return { valid: true };
}

// ============================================================
// ACTION EXECUTION
// ============================================================

function resolveTarget(targetSpec, entity, entities) {
  // If targetSpec is already an object with x/y, it's a direct target
  if (typeof targetSpec === 'object' && targetSpec.x !== undefined) {
    return targetSpec;
  }

  // Remove @ symbol if present (e.g., "@bon1" -> "bon1")
  const targetId = typeof targetSpec === 'string' ? targetSpec.replace(/^@/, '') : targetSpec;

  // Try to find visible entity by ID
  const visible = entity.getVisibleEntities();
  let target = visible.find(e => e.id === targetId);

  // If not found, also try by type for backwards compatibility
  if (!target) {
    target = visible.find(e => e.type === targetId);
  }

  // If not visible but in memory, use memory (search by type for memory)
  if (!target && entity.memory.discovered.has(targetId)) {
    const remembered = entity.memory.discovered.get(targetId);
    return { x: remembered.x, y: remembered.y, type: targetId };
  }

  return target;
}

async function executeAction(decision, entity, entities) {
  const state = getAIState(entity);
  const { intent, plan, next_action, bubble } = decision;

  // Update state
  state.currentIntent = intent;
  state.currentPlan = plan || [];

  // Show speech bubble
  if (bubble) {
    showBubble(entity, bubble);
  }

  // Validate action
  const validation = validateAction(next_action, entity, entities);
  if (!validation.valid) {
    const error = new Error(`Invalid action: ${validation.reason}`);
    console.error(`❌ ${error.message}`);
    console.error('Action:', next_action);
    state.actionHistory.push({
      name: next_action.name,
      args: next_action.args,
      result: { success: false, reason: validation.reason },
      timestamp: Date.now()
    });
    throw error;
  }

  // Resolve target if needed
  let target = null;
  if (next_action.args.target) {
    target = resolveTarget(next_action.args.target, entity, entities);
    if (!target) {
      const error = new Error(`Target not found: ${next_action.args.target}`);
      console.error(`❌ ${error.message}`);
      console.error('Action:', next_action);
      state.actionHistory.push({
        name: next_action.name,
        args: next_action.args,
        result: { success: false, reason: 'target_not_found' },
        timestamp: Date.now()
      });
      throw error;
    }
  }

  // Execute action with callback
  const callback = (result) => {
    state.lastActionResult = result;
    state.actionHistory.push({
      name: next_action.name,
      args: next_action.args,
      result: result,
      timestamp: Date.now()
    });

    // Trigger new decision after action completes
    if (state.enabled) {
      setTimeout(() => {
        triggerDecision(entity, entities, {
          actionCompleted: true,
          lastAction: next_action.name,
          lastResult: result
        });
      }, 100);
    }
  };

  // Call appropriate method
  try {
    switch (next_action.name) {
      case 'collect':
        entity.collect(target, next_action.args.itemType, callback);
        break;
      case 'drop':
        entity.drop(next_action.args.itemType, callback);
        break;
      case 'eat':
        entity.eat(next_action.args.foodType, callback);
        break;
      case 'moveTo':
        entity.moveTo(target, next_action.args.arrivalDistance, callback);
        break;
      case 'searchFor':
        entity.searchFor(next_action.args.itemType, callback);
        break;
      case 'addFuel':
        const bonfire = entities.find(e => e.type === 'bonfire');
        entity.addFuel(bonfire, callback);
        break;
      case 'sleep':
        entity.sleep(callback);
        break;
      case 'wander':
        entity.wander(next_action.args.duration, callback);
        break;
      default:
        throw new Error(`Unknown action: ${next_action.name}`);
    }
  } catch (error) {
    console.error(`❌ Error executing action:`, error);
    callback({ success: false, reason: 'execution_error', error: error.message });
  }
}

// ============================================================
// MAIN TRIGGER FUNCTION
// ============================================================

export async function triggerDecision(entity, entities, context = {}) {
  // Check if we should make a decision
  if (!shouldTriggerDecision(entity, context)) {
    return;
  }

  const state = getAIState(entity);

  try {
    // Record the call for rate limiting
    recordCall(entity);

    // Build prompt
    const prompt = buildPrompt(entity, entities, context);

    console.log('\n' + '='.repeat(80));
    console.log('🧠 LLM PROMPT:');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80) + '\n');

    // Call LLM
    const responseText = await callGemini(prompt);

    console.log('\n' + '='.repeat(80));
    console.log('🤖 LLM RESPONSE:');
    console.log('='.repeat(80));
    console.log(responseText);
    console.log('='.repeat(80) + '\n');

    // Parse response
    const parseResult = parseResponse(responseText);
    if (!parseResult.success) {
      throw new Error(`Failed to parse LLM response: ${parseResult.error}`);
    }

    const decision = parseResult.data;
    state.lastDecision = decision;

    // Execute action
    await executeAction(decision, entity, entities);

  } catch (error) {
    console.error('❌ AI Decision Error:', error);
    console.error('Entity:', entity.id, 'at', { x: entity.x, y: entity.y });
    console.error('Stack trace:', error.stack);
    // Don't suppress errors - let them be visible in console
    throw error;
  }
}

// ============================================================
// SPEECH BUBBLE UI
// ============================================================

let currentBubbleTimeout = null;

export function showBubble(entity, bubble) {
  if (!bubble || !bubble.text) return;

  const bubbleEl = document.getElementById('ai-bubble');
  const emojiEl = document.getElementById('ai-bubble-emoji');
  const textEl = document.getElementById('ai-bubble-text');

  if (!bubbleEl || !emojiEl || !textEl) return;

  // Update content
  emojiEl.textContent = bubble.emoji || '💭';
  textEl.textContent = bubble.text;

  // Position above character
  updateBubblePosition(entity);

  // Show bubble
  bubbleEl.classList.add('show');

  // Hide after 5 seconds
  if (currentBubbleTimeout) {
    clearTimeout(currentBubbleTimeout);
  }
  currentBubbleTimeout = setTimeout(() => {
    bubbleEl.classList.remove('show');
  }, 5000);
}

export function updateBubblePosition(entity) {
  const bubbleEl = document.getElementById('ai-bubble');
  if (!bubbleEl) return;

  // Position bubble above character (character.y - offset)
  const bubbleOffset = 60; // Distance above character
  bubbleEl.style.left = `${entity.x}px`;
  bubbleEl.style.top = `${entity.y - bubbleOffset}px`;
}

export function hideBubble() {
  const bubbleEl = document.getElementById('ai-bubble');
  if (bubbleEl) {
    bubbleEl.classList.remove('show');
  }
  if (currentBubbleTimeout) {
    clearTimeout(currentBubbleTimeout);
    currentBubbleTimeout = null;
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export function enableAI(entity) {
  const state = getAIState(entity);
  state.enabled = true;
  console.log(`🤖 AI enabled for ${entity.type}`);
}

export function disableAI(entity) {
  const state = getAIState(entity);
  state.enabled = false;
  console.log(`🤖 AI disabled for ${entity.type}`);
}

export function isAIEnabled(entity) {
  const state = getAIState(entity);
  return state.enabled;
}

export function getAIStats(entity) {
  const state = getAIState(entity);
  return {
    enabled: state.enabled,
    totalActions: state.actionHistory.length,
    recentActions: state.actionHistory.slice(-10),
    currentIntent: state.currentIntent,
    currentPlan: state.currentPlan,
    callsInWindow: state.callHistory.length
  };
}
