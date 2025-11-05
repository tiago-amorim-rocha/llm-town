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
      lastActionResult: null,
      isPending: false // Track if LLM call is currently in progress
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

  // Already waiting for LLM response (prevent parallel calls)
  if (state.isPending) {
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

  // Currently executing an action (collecting, sleeping, searching)
  // Note: searching is checked separately below for smart interrupts
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

    // Threats ALWAYS interrupt
    if (newCategory === 'threat') {
      return true;
    }

    // If currently searching for something specific
    if (entity.currentMovementAction === 'searching' && entity.movementActionData.searchTarget) {
      const searchCategory = entity.movementActionData.targetCategory;

      // Same category as what we're searching for - don't interrupt
      // (e.g., searching for berry, found apple - both food, let search continue)
      if (searchCategory === newCategory) {
        return false;
      }

      // Different category - allow interrupt
      // (e.g., searching for berry, found wolf - different priority)
      return true;
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

    // If aimlessly wandering (no specific goal), allow trigger for any new entity
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

  // Build context message (why are we asking for a decision?)
  let contextMessage = '';
  if (context.actionCompleted && context.lastAction) {
    const result = context.lastResult?.success ? 'succeeded' : 'failed';
    contextMessage = `\nLast action: ${context.lastAction} ${result}`;
    if (context.lastAction === 'searchFor' && context.lastResult?.success) {
      contextMessage += ` (found ${context.lastResult.foundType || 'target'})`;
    }
  } else if (context.newEntityVisible) {
    const newEntity = context.newEntityVisible;
    contextMessage = `\nNew: ${newEntity.type} now visible`;

    // Add relevance to current goal if applicable
    if (state.currentIntent) {
      if (newEntity.type === 'tree' && state.currentIntent.includes('food')) {
        contextMessage += ` (can provide apples)`;
      } else if (newEntity.type === 'grass' && state.currentIntent.includes('food')) {
        contextMessage += ` (can provide berries)`;
      } else if (newEntity.type === 'tree' && state.currentIntent.includes('fuel')) {
        contextMessage += ` (can provide sticks)`;
      } else if (newEntity.type === 'bonfire' && (state.currentIntent.includes('warm') || state.currentIntent.includes('sleep') || state.currentIntent.includes('rest'))) {
        contextMessage += ` (relevant to your goal)`;
      } else if (newEntity.type === 'wolf') {
        contextMessage += ` ⚠️ THREAT`;
      }
    }
  } else if (context.needBecameCritical) {
    contextMessage = `\nAlert: critical need detected`;
  }

  // Add recent action history (last 5 actions for pattern recognition)
  let historyMessage = '';
  if (state.actionHistory.length > 0) {
    const recentActions = state.actionHistory.slice(-5).map(action => {
      const status = action.result.success ? '✓' : '✗';
      let desc = `${status} ${action.name}`;

      // Add relevant details
      if (action.name === 'searchFor' && action.result.success) {
        desc += ` (found ${action.result.foundType || 'target'})`;
      } else if (!action.result.success && action.result.reason) {
        desc += ` (${action.result.reason})`;
      }

      return desc;
    });
    historyMessage = `\nRecent actions: ${recentActions.join(', ')}`;
  }

  // Add current goal/activity (give LLM context about their own state)
  let activityMessage = '';
  if (state.currentIntent) {
    activityMessage = `\nYour current goal: ${state.currentIntent}`;

    // Add what they're actively doing right now
    if (entity.currentMovementAction === 'searching' && entity.movementActionData.searchTarget) {
      activityMessage += ` (searching for ${entity.movementActionData.searchTarget})`;
    } else if (entity.currentMovementAction === 'moving_to' && entity.movementActionData.targetEntity) {
      const targetType = entity.movementActionData.targetEntity.type;
      activityMessage += ` (moving to ${targetType})`;
    } else if (entity.currentMovementAction === 'wandering') {
      activityMessage += ` (wandering)`;
    }
  }

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

  // Translate memory (filtered, with directions and time estimates)
  const memoryLine = translator.translateMemory(visible, entity.memory.discovered, entity, needs);

  // Build minimal prompt (words only, no numbers)
  let prompt = `You are Lira — practical and cautious but kind.
Assume commonsense. Treat the need words as literal state tags (not storytelling).
${contextMessage}${historyMessage}${activityMessage}

Situation: ${timeDescription}. Goal: survive and thrive.
Needs: ${needsLine}
Inventory: ${inventoryLine}

Current visibility:
${nearbyLine}`;

  if (memoryLine) {
    prompt += `\n\nRemembered locations (not currently visible):
${memoryLine}`;
  }

  // Filter available actions based on current state
  const availableActions = [];

  // Always available
  availableActions.push('- searchFor: {"name":"searchFor","args":{"itemType":"apple"|"berry"|"stick"|"bonfire"}}\n  → Wander to find item type');
  availableActions.push('- moveTo: {"name":"moveTo","args":{"target":"<type>"}}\n  → Walk to entity (visible OR remembered)');
  availableActions.push('- wander: {"name":"wander","args":{}}\n  → Explore randomly');

  // collect - only if inventory not full and collectibles visible
  if (!entity.inventory.isFull()) {
    const hasCollectibles = visible.some(e =>
      ['tree', 'grass', 'stick', 'apple', 'berry'].includes(e.type)
    );
    if (hasCollectibles) {
      availableActions.push('- collect: {"name":"collect","args":{"target":"<type>","itemType":"<type>"}}\n  → Get item (tree→apple, grass→berry, stick→stick)');
    }
  }

  // addFuel - only if has sticks and bonfire visible
  if (entity.inventory.hasItem('stick')) {
    const bonfireVisible = visible.some(e => e.type === 'bonfire');
    if (bonfireVisible) {
      availableActions.push('- addFuel: {"name":"addFuel","args":{}}\n  → Add stick to bonfire');
    }
  }

  // eat - only if has food
  const hasApple = entity.inventory.hasItem('apple');
  const hasBerry = entity.inventory.hasItem('berry');
  if (hasApple || hasBerry) {
    const foodTypes = [];
    if (hasApple) foodTypes.push('"apple"');
    if (hasBerry) foodTypes.push('"berry"');
    availableActions.push(`- eat: {"name":"eat","args":{"foodType":${foodTypes.join('|')}}}\n  → Consume food from inventory`);
  }

  // sleep - only if tired
  if (entity.energy < 80) {
    availableActions.push('- sleep: {"name":"sleep","args":{}}\n  → Rest to restore energy');
  }

  prompt += `
Constraints: carry up to two items max.

Available actions right now:
${availableActions.join('\n')}

Respond only with strict JSON:
{
  "intent": "<short goal>",
  "plan": ["<step1>", "<step2>", "<step3>"],
  "next_action": {"name":"...","args":{...}},
  "bubble": {"text":"<≤8 words>","emoji":"<one>"}
}

Examples:
- Need fuel, bonfire visible, stick visible: {"intent":"fuel fire","plan":["collect stick","add to bonfire"],"next_action":{"name":"collect","args":{"target":"stick","itemType":"stick"}},"bubble":{"text":"getting stick","emoji":"🪵"}}
- Stick in inventory, bonfire visible: {"intent":"add fuel","plan":["add fuel"],"next_action":{"name":"addFuel","args":{}},"bubble":{"text":"fueling fire","emoji":"🔥"}}`;

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

  // Remove @ symbol if present (e.g., "@bonfire" -> "bonfire")
  const targetType = typeof targetSpec === 'string' ? targetSpec.replace(/^@/, '') : targetSpec;

  // Get visible entities
  const visible = entity.getVisibleEntities();

  // Find best target by type (prefer "at hand" > "nearby" > "far")
  const candidates = visible.filter(e => e.type === targetType);

  if (candidates.length > 0) {
    // Sort by distance (closest first)
    candidates.sort((a, b) => {
      const distA = distance(entity.x, entity.y, a.x, a.y);
      const distB = distance(entity.x, entity.y, b.x, b.y);
      return distA - distB;
    });
    return candidates[0]; // Return closest
  }

  // If not visible but in memory, use memory
  if (entity.memory.discovered.has(targetType)) {
    const remembered = entity.memory.discovered.get(targetType);
    return { x: remembered.x, y: remembered.y, type: targetType };
  }

  return null;
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

    // Mark as pending to prevent parallel calls
    state.isPending = true;

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

    // Clear pending flag after successful execution
    state.isPending = false;

  } catch (error) {
    // Clear pending flag on error
    state.isPending = false;

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
