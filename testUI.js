// === TEST UI MODULE ===
// Testing interface for character actions

import { distance } from './utils.js';

let isOpen = false;
let statusText = '';
let statusTimeout = null;

function showStatus(message, duration = 3000) {
  statusText = message;
  updateStatusDisplay();

  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    statusText = '';
    updateStatusDisplay();
  }, duration);
}

function updateStatusDisplay() {
  const statusElement = document.getElementById('action-status');
  if (statusElement) {
    statusElement.textContent = statusText;
  }
}

export function initTestUI(characterEntity, getEntities) {
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'testui-toggle';
  toggleButton.textContent = '🎮';
  toggleButton.title = 'Toggle Action Menu';
  document.body.appendChild(toggleButton);

  // Create UI panel
  const panel = document.createElement('div');
  panel.id = 'testui-panel';
  panel.innerHTML = `
    <div id="testui-header">
      <span>Character Actions</span>
      <div id="inventory-info">Empty</div>
    </div>
    <div id="testui-actions">
      <!-- Movement -->
      <button class="action-btn" data-action="wander-short" title="Wander 3s">🚶</button>
      <button class="action-btn" data-action="wander-long" title="Wander 10s">🏃</button>
      <button class="action-btn" data-action="stop" title="Stop">🛑</button>

      <!-- Search -->
      <button class="action-btn" data-action="search-apple" title="Search Apple">🔍🍎</button>
      <button class="action-btn" data-action="search-berry" title="Search Berry">🔍🫐</button>

      <!-- Collect -->
      <button class="action-btn" data-action="collect-nearest" title="Collect Nearest">🎯</button>
      <button class="action-btn" data-action="collect-apple" title="Collect Apple">🍎</button>
      <button class="action-btn" data-action="collect-berry" title="Collect Berry">🫐</button>

      <!-- Drop -->
      <button class="action-btn" data-action="drop-apple" title="Drop Apple">📦🍎</button>
      <button class="action-btn" data-action="drop-berry" title="Drop Berry">📦🫐</button>
    </div>
    <div id="action-status"></div>
  `;
  document.body.appendChild(panel);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #testui-toggle {
      position: fixed;
      bottom: calc(80px + env(safe-area-inset-bottom));
      right: calc(20px + env(safe-area-inset-right));
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #1a1d23;
      border: 2px solid #333;
      color: #eee;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: all 0.2s;
    }

    #testui-toggle:hover {
      background: #252831;
      border-color: #555;
    }

    #testui-panel {
      position: fixed;
      bottom: calc(140px + env(safe-area-inset-bottom));
      right: calc(20px + env(safe-area-inset-right));
      width: 350px;
      max-width: calc(100vw - 40px);
      background: #1a1d23;
      border: 2px solid #333;
      border-radius: 8px;
      display: none;
      flex-direction: column;
      z-index: 999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 15px;
      gap: 12px;
    }

    #testui-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
      color: #eee;
      font-size: 14px;
      font-weight: 600;
    }

    #inventory-info {
      font-size: 12px;
      color: #ffdd1a;
      font-weight: 500;
    }

    #testui-actions {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      padding: 10px 0;
    }

    .action-btn {
      width: 55px;
      height: 55px;
      border-radius: 50%;
      background: #2a5d2a;
      border: 2px solid #3a7d3a;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
    }

    .action-btn:hover {
      background: #3a7d3a;
      border-color: #ffdd1a;
      transform: scale(1.1);
      box-shadow: 0 2px 12px rgba(255, 221, 26, 0.4);
    }

    .action-btn:active {
      transform: scale(0.95);
    }

    .action-btn:disabled {
      background: #333;
      border-color: #444;
      color: #666;
      cursor: not-allowed;
      transform: none;
    }

    #action-status {
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      color: #ffdd1a;
      font-size: 12px;
      min-height: 20px;
      text-align: center;
      font-weight: 500;
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
      #testui-panel {
        width: calc(100vw - 40px);
      }

      #testui-actions {
        grid-template-columns: repeat(4, 1fr);
      }

      .action-btn {
        width: 50px;
        height: 50px;
        font-size: 18px;
      }
    }
  `;
  document.head.appendChild(style);

  // Toggle panel visibility
  toggleButton.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    toggleButton.textContent = isOpen ? '✕' : '🎮';
  });

  // Update inventory display periodically
  setInterval(() => {
    const invInfo = document.getElementById('inventory-info');
    if (invInfo && characterEntity) {
      const items = characterEntity.inventory.items;
      if (items.length === 0) {
        invInfo.textContent = 'Empty';
      } else {
        const itemCounts = {};
        items.forEach(item => {
          itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
        });
        const itemText = Object.entries(itemCounts)
          .map(([type, count]) => `${count}x ${type === 'apple' ? '🍎' : '🫐'}`)
          .join(' ');
        invInfo.textContent = itemText;
      }
    }
  }, 200);

  // Helper: Find nearest entity of type with item
  function findNearestWithItem(itemType) {
    const visibleEntities = characterEntity.getVisibleEntities();

    let targetType = null;
    if (itemType === 'apple') targetType = 'tree';
    else if (itemType === 'berry') targetType = 'grass';

    if (!targetType) return null;

    const candidates = visibleEntities.filter(e =>
      e.type === targetType &&
      e.inventory &&
      e.inventory.hasItem(itemType)
    );

    if (candidates.length === 0) return null;

    // Find nearest
    let nearest = candidates[0];
    let minDist = distance(characterEntity.x, characterEntity.y, nearest.x, nearest.y);

    for (const candidate of candidates) {
      const dist = distance(characterEntity.x, characterEntity.y, candidate.x, candidate.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = candidate;
      }
    }

    return nearest;
  }

  // Helper: Find nearest collectible entity (any type)
  function findNearestCollectible() {
    const visibleEntities = characterEntity.getVisibleEntities();

    const candidates = visibleEntities.filter(e =>
      e.inventory && !e.inventory.isEmpty()
    );

    if (candidates.length === 0) return null;

    let nearest = candidates[0];
    let minDist = distance(characterEntity.x, characterEntity.y, nearest.x, nearest.y);

    for (const candidate of candidates) {
      const dist = distance(characterEntity.x, characterEntity.y, candidate.x, candidate.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = candidate;
      }
    }

    return nearest;
  }

  // Action handlers
  const actions = {
    'wander-short': () => {
      showStatus('🚶 Wandering 3s...');
      characterEntity.wander(3000, (result) => {
        if (result.success) showStatus('✅ Wander complete');
      });
    },

    'wander-long': () => {
      showStatus('🏃 Wandering 10s...');
      characterEntity.wander(10000, (result) => {
        if (result.success) showStatus('✅ Wander complete');
      });
    },

    'stop': () => {
      characterEntity.stopCurrentAction();
      showStatus('🛑 Stopped');
    },

    'search-apple': () => {
      showStatus('🔍 Searching apple...');
      characterEntity.searchFor('apple', (result) => {
        if (result.success) {
          showStatus('✅ Found apple!');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'search-berry': () => {
      showStatus('🔍 Searching berry...');
      characterEntity.searchFor('berry', (result) => {
        if (result.success) {
          showStatus('✅ Found berry!');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'collect-nearest': () => {
      const target = findNearestCollectible();
      if (!target) {
        showStatus('❌ Nothing in sight');
        return;
      }
      const itemType = target.inventory.items[0].type;
      showStatus(`🎯 Collecting...`);
      characterEntity.collect(target, itemType, (result) => {
        if (result.success) {
          showStatus(`✅ Collected ${itemType === 'apple' ? '🍎' : '🫐'}!`);
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'collect-apple': () => {
      const target = findNearestWithItem('apple');
      if (!target) {
        showStatus('❌ No apples visible');
        return;
      }
      showStatus('🍎 Collecting...');
      characterEntity.collect(target, 'apple', (result) => {
        if (result.success) {
          showStatus('✅ Got apple! 🍎');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'collect-berry': () => {
      const target = findNearestWithItem('berry');
      if (!target) {
        showStatus('❌ No berries visible');
        return;
      }
      showStatus('🫐 Collecting...');
      characterEntity.collect(target, 'berry', (result) => {
        if (result.success) {
          showStatus('✅ Got berry! 🫐');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'drop-apple': () => {
      if (!characterEntity.inventory.hasItem('apple')) {
        showStatus('❌ No apples');
        return;
      }
      showStatus('📦 Dropping...');
      characterEntity.drop('apple', (result) => {
        if (result.success) {
          showStatus('✅ Dropped apple');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    },

    'drop-berry': () => {
      if (!characterEntity.inventory.hasItem('berry')) {
        showStatus('❌ No berries');
        return;
      }
      showStatus('📦 Dropping...');
      characterEntity.drop('berry', (result) => {
        if (result.success) {
          showStatus('✅ Dropped berry');
        } else {
          showStatus(`❌ ${result.reason}`);
        }
      });
    }
  };

  // Attach click handlers to all action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    const action = btn.dataset.action;
    if (actions[action]) {
      btn.addEventListener('click', actions[action]);
    }
  });

  console.log('🎮 Test UI initialized! Click the 🎮 button to toggle action menu.');
}
