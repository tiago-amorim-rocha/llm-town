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

// ============================================================
// CONFIGURATION
// ============================================================

// Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyBjwZPqsu6vJf7FYZ9lB8DWr_PL6sdZ_KM'; // TODO: Move to config or env
const GEMINI_MODEL = 'gemini-1.5-flash'; // Fast, cost-effective
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Rate limiting
const MAX_CALLS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MIN_TIME_BETWEEN_CALLS = 2000; // 2 seconds minimum between calls

// Decision triggers
const IDLE_TRIGGER_DELAY = 5000; // Ask LLM if idle for 5 seconds

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
    console.log('🎯 Trigger: Action completed');
    return true;
  }

  if (context.needBecameCritical) {
    console.log('🚨 Trigger: Need became critical');
    return true;
  }

  if (context.hpLow && entity.hp < 30) {
    console.log('💔 Trigger: HP critical');
    return true;
  }

  // New important entity visible (food sources, bonfire)
  if (context.newEntityVisible) {
    const importantTypes = ['tree', 'grass', 'bonfire', 'apple', 'berry', 'stick'];
    if (importantTypes.includes(context.newEntityVisible.type)) {
      console.log(`👀 Trigger: Discovered ${context.newEntityVisible.type}`);
      return true;
    }
  }

  // Idle too long
  if (entity.currentMovementAction === null) {
    const idleTime = Date.now() - state.lastCallTime;
    if (idleTime > IDLE_TRIGGER_DELAY) {
      console.log('💤 Trigger: Idle too long');
      return true;
    }
  }

  return false;
}

// ============================================================
// PROMPT BUILDING
// ============================================================

function formatNeed(value, criticalThreshold) {
  let emoji = '🟢';
  let status = '';

  if (value < criticalThreshold) {
    emoji = '🔴';
    status = ' CRITICAL';
  } else if (value < 50) {
    emoji = '🟡';
    status = ' LOW';
  }

  return `${emoji} ${Math.round(value)}/100${status}`;
}

function formatEntity(entity, characterEntity) {
  const dist = Math.round(distance(characterEntity.x, characterEntity.y, entity.x, entity.y));
  let details = `${entity.type} (${dist}px away`;

  // Add inventory info if entity has items
  if (entity.inventory && entity.inventory.items.length > 0) {
    const items = entity.inventory.items.map(item => item.type);
    const itemCounts = {};
    items.forEach(item => {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    });
    const itemList = Object.entries(itemCounts).map(([item, count]) =>
      count > 1 ? `${count} ${item}s` : item
    ).join(', ');
    details += `, has: ${itemList}`;
  }

  // Add fuel info for bonfire
  if (entity.type === 'bonfire' && entity.fuel !== undefined) {
    const fuelPercent = Math.round((entity.fuel / entity.maxFuel) * 100);
    let fuelStatus = '';
    if (fuelPercent < 20) fuelStatus = ' 🔴 DYING';
    else if (fuelPercent < 50) fuelStatus = ' 🟡 LOW';
    details += `, fuel: ${Math.round(entity.fuel)}/${entity.maxFuel}${fuelStatus}`;
  }

  details += ')';
  return details;
}

function getActionAvailability(entity, entities) {
  const availability = {
    collect: entity.inventory.isFull() ? '❌ Inventory full (2/2)' : '✅ Available',
    drop: entity.inventory.isEmpty() ? '❌ Inventory empty' : '✅ Available',
    eat: entity.inventory.items.some(i => i.type === 'apple' || i.type === 'berry') ? '✅ Available' : '❌ No food',
    sleep: entity.energy < 90 ? '✅ Available' : '⚠️ Not tired',
    addFuel: '❌ Not near bonfire or no sticks',
    moveTo: '✅ Available',
    searchFor: '✅ Available',
    wander: '✅ Available'
  };

  // Check addFuel availability
  const hasSticks = entity.inventory.hasItem('stick');
  const bonfire = entities.find(e => e.type === 'bonfire');
  if (bonfire) {
    const distToBonfire = distance(entity.x, entity.y, bonfire.x, bonfire.y);
    if (hasSticks && distToBonfire <= config.COLLECTION_RANGE) {
      availability.addFuel = '✅ Available';
    } else if (!hasSticks) {
      availability.addFuel = '❌ No sticks in inventory';
    } else {
      availability.addFuel = `❌ Too far (${Math.round(distToBonfire)}px, need <${config.COLLECTION_RANGE}px)`;
    }
  }

  return availability;
}

function buildPrompt(entity, entities, context = {}) {
  const state = getAIState(entity);
  const visible = entity.getVisibleEntities();
  const remembered = Array.from(entity.memory.discovered.values());
  const availability = getActionAvailability(entity, entities);
  const timeStr = formatInGameTime();
  const gameTime = getInGameTime();

  // Recent history (last 5 actions)
  const recentHistory = state.actionHistory.slice(-5);

  let prompt = `You are Lira, a survivor in a harsh wilderness. You must manage your needs to stay alive.

CURRENT SITUATION:
- Food: ${formatNeed(entity.food, 30)} (lose HP if < 30, regenerate HP if > 50)
- Warmth: ${formatNeed(entity.warmth, 30)} (lose HP if < 30, regenerate HP if > 50)
- Energy: ${formatNeed(entity.energy, 30)} (can't run if < 30, half speed if < 15, forced sleep if < 5, regenerate HP if > 50)
- HP: ${Math.round(entity.hp)}/100 ${entity.hp < 30 ? '🔴 CRITICAL' : entity.hp < 50 ? '🟡 LOW' : '🟢'}

TIME: ${timeStr} (${gameTime.phase})

INVENTORY (${entity.inventory.items.length}/2): ${entity.inventory.items.map(i => i.type).join(', ') || 'empty'}

WHAT YOU SEE RIGHT NOW:`;

  if (visible.length === 0) {
    prompt += '\n- Nothing nearby (explore to find resources)';
  } else {
    visible.forEach(e => {
      prompt += `\n- ${formatEntity(e, entity)}`;
    });
  }

  // Add remembered locations (limit to last 2 in-game days)
  const twoDaysMs = 2 * 24 * 3600 * 1000 / config.TIME_MULTIPLIER; // Convert 2 in-game days to real ms
  const recentMemories = remembered.filter(m => Date.now() - m.lastSeen < twoDaysMs);

  if (recentMemories.length > 0) {
    prompt += '\n\nREMEMBERED LOCATIONS (not visible now, but you know where they were):';
    recentMemories.forEach(mem => {
      const timeSince = Math.round((Date.now() - mem.lastSeen) / 1000);
      const direction = getDirection(entity.x, entity.y, mem.x, mem.y);
      const dist = Math.round(mem.distance);
      prompt += `\n- ${mem.type} (~${dist}px ${direction}, seen ${timeSince}s ago)`;
    });
  }

  if (recentHistory.length > 0) {
    prompt += '\n\nRECENT ACTIONS:';
    recentHistory.forEach(action => {
      const emoji = action.result?.success ? '✅' : '❌';
      prompt += `\n${emoji} ${action.name}(${JSON.stringify(action.args).slice(1, -1)})`;
      if (!action.result?.success && action.result?.reason) {
        prompt += ` - ${action.result.reason}`;
      }
    });
  }

  if (state.currentIntent) {
    prompt += `\n\nCURRENT PLAN: ${state.currentIntent}`;
    if (state.currentPlan.length > 0) {
      prompt += `\nSteps: ${state.currentPlan.join(' → ')}`;
    }
  }

  prompt += `\n\nAVAILABLE ACTIONS:
- collect(target, itemType): ${availability.collect}
  Collect apple/berry/stick from target entity. Must be within 50px. Takes time.

- drop(itemType): ${availability.drop}
  Drop item from inventory onto ground. Instant.

- eat(foodType): ${availability.eat}
  Eat apple or berry. Restores +40 food instantly.

- moveTo(target): ${availability.moveTo}
  Move directly to visible target or remembered location. Auto-runs if energy > 30.

- searchFor(itemType): ${availability.searchFor}
  Wander around searching for: apple, berry, stick, or bonfire. Takes ~80 in-game minutes.

- addFuel(bonfire): ${availability.addFuel}
  Add stick to bonfire for +20 fuel. Must be within 50px and have stick.

- sleep(): ${availability.sleep}
  Sleep until energy reaches 90. Restores energy fast. Wakes if HP < 20.

- wander(): ✅ Available
  Wander randomly. Use when exploring.

CRITICAL REMINDERS:
- HP regenerates ONLY when all needs > 50 (food, warmth, energy)
- Bonfire provides warmth within 100px radius
- Collecting takes time (24 min for apple, 20 min for berry)
- You can remember locations you've seen before

RESPONSE FORMAT (JSON only):
{
  "intent": "one sentence describing your goal",
  "plan": ["step1", "step2", "step3"],
  "next_action": {
    "name": "actionName",
    "args": {"param": "value"}
  },
  "bubble": {
    "text": "max 8 words showing your thought",
    "emoji": "one emoji"
  }
}

Examples:
- moveTo with visible: {"name": "moveTo", "args": {"target": "tree"}}
- moveTo with memory: {"name": "moveTo", "args": {"target": "bonfire", "useMemory": true}}
- collect: {"name": "collect", "args": {"target": "tree", "itemType": "apple"}}
- searchFor: {"name": "searchFor", "args": {"itemType": "bonfire"}}
- eat: {"name": "eat", "args": {"foodType": "apple"}}

What do you do next?`;

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

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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

  // If it's a string, try to find visible entity
  const targetType = targetSpec;
  const visible = entity.getVisibleEntities();
  let target = visible.find(e => e.type === targetType);

  // If not visible but useMemory is requested, use memory
  if (!target && entity.memory.discovered.has(targetType)) {
    const remembered = entity.memory.discovered.get(targetType);
    console.log(`📍 Using memory to navigate to ${targetType} at (${remembered.x}, ${remembered.y})`);
    return { x: remembered.x, y: remembered.y, type: targetType };
  }

  return target;
}

async function executeAction(decision, entity, entities) {
  const state = getAIState(entity);
  const { intent, plan, next_action, bubble } = decision;

  // Update state
  state.currentIntent = intent;
  state.currentPlan = plan || [];

  // Log decision
  console.log(`🤖 AI Decision for ${entity.type}:`);
  console.log(`   Intent: ${intent}`);
  console.log(`   Plan: ${plan?.join(' → ')}`);
  console.log(`   Action: ${next_action.name}(${JSON.stringify(next_action.args).slice(1, -1)})`);
  console.log(`   Bubble: ${bubble?.emoji} "${bubble?.text}"`);

  // Validate action
  const validation = validateAction(next_action, entity, entities);
  if (!validation.valid) {
    console.error(`❌ Invalid action: ${validation.reason}`);
    state.actionHistory.push({
      name: next_action.name,
      args: next_action.args,
      result: { success: false, reason: validation.reason },
      timestamp: Date.now()
    });
    return;
  }

  // Resolve target if needed
  let target = null;
  if (next_action.args.target) {
    target = resolveTarget(next_action.args.target, entity, entities);
    if (!target) {
      console.error(`❌ Target not found: ${next_action.args.target}`);
      state.actionHistory.push({
        name: next_action.name,
        args: next_action.args,
        result: { success: false, reason: 'target_not_found' },
        timestamp: Date.now()
      });
      return;
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

    console.log(`${result.success ? '✅' : '❌'} Action ${next_action.name} ${result.success ? 'succeeded' : 'failed'}`);

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

    console.log('🧠 Calling LLM for decision...');

    // Build prompt
    const prompt = buildPrompt(entity, entities, context);

    // Call LLM
    const responseText = await callGemini(prompt);

    // Parse response
    const parseResult = parseResponse(responseText);
    if (!parseResult.success) {
      console.error('❌ Failed to parse LLM response');
      return;
    }

    const decision = parseResult.data;
    state.lastDecision = decision;

    // Execute action
    await executeAction(decision, entity, entities);

  } catch (error) {
    console.error('❌ AI Decision Error:', error);

    // Fallback: do nothing, just warn
    console.warn('⚠️ AI disabled due to error. Entity will remain idle.');
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
