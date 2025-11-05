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
  const toggle = document.getElementById('manual-mode-toggle');
  const checkbox = document.getElementById('manual-mode-checkbox');

  if (toggle) {
    if (enabled) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  if (checkbox) {
    checkbox.checked = enabled;
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

    // Pulse the AI button to indicate decision needed
    const aiButton = document.getElementById('ai-toggle-button');
    if (aiButton) {
      aiButton.classList.add('decision-needed');
      aiButton.title = 'Click to make a decision!';

      // Auto-open panel when button is clicked
      const clickHandler = () => {
        showDecisionPanel();
        aiButton.removeEventListener('click', clickHandler);
      };
      aiButton.addEventListener('click', clickHandler);
    }

    console.log('🧠 Decision needed! Click the pulsing AI button to decide.');
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
  populateQuickActions(actions);

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
  const aiButton = document.getElementById('ai-toggle-button');
  if (aiButton) {
    aiButton.classList.remove('decision-needed');
    aiButton.title = 'Toggle AI Control';
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
 * Populate quick action buttons
 */
function populateQuickActions(actions) {
  const container = document.getElementById('manual-quick-actions');
  if (!container) return;

  container.innerHTML = '';

  // Create buttons for common actions
  const commonActions = ['searchFor', 'collect', 'eat', 'sleep', 'wander'];

  commonActions.forEach(actionName => {
    const action = actions.find(a => a.name === actionName);
    if (action) {
      const btn = document.createElement('button');
      btn.className = 'manual-decision-action-btn';
      btn.textContent = getActionEmoji(actionName) + ' ' + actionName;
      btn.onclick = () => selectAction(actionName, action.template);
      container.appendChild(btn);
    }
  });
}

function getActionEmoji(actionName) {
  const emojiMap = {
    searchFor: '🔍',
    moveTo: '🚶',
    collect: '🎯',
    eat: '🍽️',
    sleep: '😴',
    wander: '🌀',
    addFuel: '🪵',
    drop: '📤'
  };
  return emojiMap[actionName] || '⚡';
}

function selectAction(actionName, template) {
  const select = document.getElementById('manual-action');
  if (select) {
    select.value = actionName;
    select.dispatchEvent(new Event('change'));
  }
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

    let input;

    // Check if value contains pipe (options)
    if (typeof value === 'string' && value.includes('|')) {
      const options = value.split('|').map(v => v.replace(/"/g, '').trim());
      input = document.createElement('select');
      input.className = 'manual-decision-select';

      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = '-- Select --';
      input.appendChild(placeholderOption);

      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'manual-decision-input';
      input.placeholder = typeof value === 'string' ? value.replace(/[<>"]/g, '') : String(value);
    }

    input.dataset.argKey = key;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
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

  // Gather inputs
  const intent = document.getElementById('manual-intent')?.value || 'Take action';
  const planText = document.getElementById('manual-plan')?.value || '';
  const plan = planText.split('\n').filter(line => line.trim());

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

  const bubbleText = document.getElementById('manual-bubble-text')?.value || '';
  const bubbleEmoji = document.getElementById('manual-bubble-emoji')?.value || '💭';

  // Build decision object
  const decision = {
    intent,
    plan,
    next_action: {
      name: actionName,
      args
    },
    bubble: {
      text: bubbleText,
      emoji: bubbleEmoji
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

export function initManualLLMMode() {
  // Toggle checkbox
  const checkbox = document.getElementById('manual-mode-checkbox');
  const toggle = document.getElementById('manual-mode-toggle');

  if (checkbox && toggle) {
    checkbox.addEventListener('change', (e) => {
      setManualMode(e.target.checked);
    });

    toggle.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        setManualMode(checkbox.checked);
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
        const aiButton = document.getElementById('ai-toggle-button');
        if (aiButton) {
          aiButton.classList.add('decision-needed');
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
