// === MANUAL LLM MODE ===
// Allows user to act as the LLM and make decisions manually
// Perfect for testing trigger logic and understanding AI context

import * as entityRegistry from './entityRegistry.js';

// ============================================================
// STATE
// ============================================================

let isManualModeEnabled = false;
let pendingDecision = null; // { entity, entities, context, prompt, resolve, reject }

// ============================================================
// PUBLIC API
// ============================================================

export function isManualMode() {
  return isManualModeEnabled;
}

export function setManualMode(enabled) {
  isManualModeEnabled = enabled;
  const button = document.getElementById('manual-mode-button');

  if (button) {
    if (enabled) {
      button.classList.add('enabled');
      button.title = 'Manual Mode ON - Click when pulsing to decide';
    } else {
      button.classList.remove('enabled');
      button.classList.remove('decision-needed');
      button.title = 'Manual LLM Mode - Act as the AI';
    }
  }

  console.log(`🧠 Manual LLM Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Request a manual decision from the user
 * Called instead of the LLM API when in manual mode
 * @param {Object} entity - The entity needing a decision
 * @param {Array} entities - All entities in the scene
 * @param {Object} context - Decision context
 * @param {string} prompt - The formatted prompt
 * @returns {Promise<Object>} Decision object {intent, plan, next_action, bubble}
 */
export function requestManualDecision(entity, entities, context, prompt) {
  return new Promise((resolve, reject) => {
    pendingDecision = { entity, entities, context, prompt, resolve, reject };

    // Pulse the manual mode button to indicate decision needed
    const manualButton = document.getElementById('manual-mode-button');
    if (manualButton) {
      manualButton.classList.add('decision-needed');
      manualButton.title = 'Click to make a decision!';
    }

    console.log('🧠 Decision needed! Click the pulsing Manual Mode button (🧠) to decide.');
  });
}

/**
 * Cancel pending decision (e.g., if AI is disabled)
 */
export function cancelPendingDecision() {
  if (pendingDecision) {
    pendingDecision.reject(new Error('Decision cancelled'));
    pendingDecision = null;
    hidePulse();
  }
}

// ============================================================
// UI FUNCTIONS
// ============================================================

function showDecisionPanel() {
  if (!pendingDecision) return;

  const panel = document.getElementById('manual-decision-panel');
  if (!panel) return;

  // Extract clean prompt (remove system instructions)
  const cleanPrompt = extractCleanPrompt(pendingDecision.prompt);

  // Show prompt
  const promptEl = document.getElementById('manual-decision-prompt');
  if (promptEl) {
    promptEl.textContent = cleanPrompt;
  }

  // Parse available actions from prompt
  const actions = parseActionsFromPrompt(pendingDecision.prompt);
  populateActionDropdown(actions);

  // Show panel
  panel.classList.add('show');
  hidePulse();
}

function hideDecisionPanel() {
  const panel = document.getElementById('manual-decision-panel');
  if (panel) {
    panel.classList.remove('show');
  }
}

function hidePulse() {
  const manualButton = document.getElementById('manual-mode-button');
  if (manualButton) {
    manualButton.classList.remove('decision-needed');
    manualButton.title = isManualModeEnabled
      ? 'Manual Mode ON - Click when pulsing to decide'
      : 'Manual LLM Mode - Act as the AI';
  }
}

/**
 * Extract clean prompt without system instructions and JSON formatting
 */
function extractCleanPrompt(prompt) {
  // Remove "Actions:" section and everything after
  const actionsIndex = prompt.indexOf('\nActions:');
  if (actionsIndex > 0) {
    return prompt.substring(0, actionsIndex).trim();
  }
  return prompt.trim();
}

/**
 * Parse available actions from the prompt
 */
function parseActionsFromPrompt(prompt) {
  const actions = [];
  const lines = prompt.split('\n');
  let inActionsSection = false;

  for (const line of lines) {
    if (line.trim() === 'Actions:') {
      inActionsSection = true;
      continue;
    }

    if (inActionsSection && line.trim().startsWith('JSON only:')) {
      break;
    }

    if (inActionsSection && line.trim()) {
      // Parse action line: "searchFor: {"name":"searchFor","args":{"itemType":"apple"|"berry"|"stick"}}"
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const actionName = match[1];
        const jsonStr = match[2];
        try {
          const parsed = JSON.parse(jsonStr);
          actions.push({
            name: actionName,
            template: parsed
          });
        } catch (e) {
          console.warn('Failed to parse action:', line);
        }
      }
    }
  }

  return actions;
}

/**
 * Populate action dropdown
 */
function populateActionDropdown(actions) {
  const select = document.getElementById('manual-action');
  if (!select) return;

  select.innerHTML = '<option value="">-- Select Action --</option>';

  actions.forEach(action => {
    const option = document.createElement('option');
    option.value = action.name;
    option.textContent = action.name;
    option.dataset.template = JSON.stringify(action.template);
    select.appendChild(option);
  });

  // Update args section when action changes
  select.addEventListener('change', () => {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.template) {
      const template = JSON.parse(selectedOption.dataset.template);
      populateArgsInputs(template.args || {});
    } else {
      hideArgsSection();
    }
  });
}

/**
 * Populate args input fields
 */
function populateArgsInputs(args) {
  const container = document.getElementById('manual-args-inputs');
  const section = document.getElementById('manual-args-section');

  if (!container || !section) return;

  container.innerHTML = '';

  const argKeys = Object.keys(args);
  if (argKeys.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  argKeys.forEach(key => {
    const value = args[key];
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const label = document.createElement('label');
    label.textContent = key + ':';
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    label.style.fontSize = '12px';
    label.style.color = '#ccc';

    // Always use dropdown
    const select = document.createElement('select');
    select.className = 'manual-decision-select';
    select.dataset.argKey = key;

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select --';
    select.appendChild(placeholderOption);

    let options = [];

    // Check if value contains pipe (explicit options)
    if (typeof value === 'string' && value.includes('|')) {
      options = value.split('|').map(v => v.replace(/"/g, '').trim());
    } else {
      // Infer options from argument name or use generic from context
      if (key === 'itemType' || key === 'target') {
        // Get from entity registry searchable types
        options = entityRegistry.getSearchableTypes();
      } else if (key === 'foodType') {
        // Get consumable types
        options = entityRegistry.getConsumableTypes();
      } else {
        // Generic fallback - use visible entities from pending decision
        if (pendingDecision && pendingDecision.entity) {
          const visible = pendingDecision.entity.getVisibleEntities();
          options = [...new Set(visible.map(e => e.type))];
        }
      }
    }

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  });
}

function hideArgsSection() {
  const section = document.getElementById('manual-args-section');
  if (section) {
    section.style.display = 'none';
  }
}

/**
 * Execute the user's manual decision
 */
function executeManualDecision() {
  if (!pendingDecision) return;

  const actionName = document.getElementById('manual-action')?.value;
  if (!actionName) {
    alert('Please select an action!');
    return;
  }

  // Gather args
  const args = {};
  const argInputs = document.querySelectorAll('[data-arg-key]');
  argInputs.forEach(input => {
    const key = input.dataset.argKey;
    const value = input.value;
    if (value) {
      args[key] = value;
    }
  });

  // Auto-generate random emoji and simple text
  const emojis = ['💭', '🤔', '👍', '✨', '🎯', '🔥', '💪', '😊', '🌟', '⚡'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  const bubbleText = actionName; // Simple: just show the action name

  // Build decision object
  const decision = {
    intent: `Manual: ${actionName}`,
    plan: [],
    next_action: {
      name: actionName,
      args
    },
    bubble: {
      text: bubbleText,
      emoji: randomEmoji
    }
  };

  console.log('🧠 Manual decision:', decision);

  // Resolve the pending decision
  pendingDecision.resolve(decision);
  pendingDecision = null;

  // Hide panel
  hideDecisionPanel();
}

// ============================================================
// INITIALIZATION
// ============================================================

export function initManualLLMMode(triggerDecisionCallback) {
  // Store callback for triggering decisions
  window.__triggerManualDecision = triggerDecisionCallback;

  // Manual mode button
  const manualButton = document.getElementById('manual-mode-button');

  if (manualButton) {
    manualButton.addEventListener('click', () => {
      // If decision is pending, show the decision panel
      if (pendingDecision) {
        showDecisionPanel();
      } else {
        // Toggle manual mode on/off
        const newState = !isManualModeEnabled;
        setManualMode(newState);

        // If enabling manual mode, trigger initial decision
        if (newState && triggerDecisionCallback) {
          console.log('🧠 Manual mode enabled, triggering initial decision...');
          triggerDecisionCallback();
        }
      }
    });
  }

  // Close button
  const closeBtn = document.getElementById('manual-decision-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideDecisionPanel();
      // Re-show pulse if decision still pending
      if (pendingDecision) {
        const manualBtn = document.getElementById('manual-mode-button');
        if (manualBtn) {
          manualBtn.classList.add('decision-needed');
        }
      }
    });
  }

  // Execute button
  const executeBtn = document.getElementById('manual-execute-button');
  if (executeBtn) {
    executeBtn.addEventListener('click', executeManualDecision);
  }

  console.log('🧠 Manual LLM Mode initialized');
}
