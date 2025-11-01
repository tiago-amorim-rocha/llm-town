// === TEST UI MODULE ===
// Testing interface for character actions

import { distance } from './utils.js';

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
  // Create UI container
  const uiContainer = document.createElement('div');
  uiContainer.id = 'test-ui';
  uiContainer.innerHTML = `
    <div id="test-menu">
      <h3>Character Actions</h3>

      <div class="action-section">
        <h4>Movement</h4>
        <button id="btn-wander-short">Wander (3s)</button>
        <button id="btn-wander-long">Wander (10s)</button>
        <button id="btn-stop">Stop Action</button>
      </div>

      <div class="action-section">
        <h4>Search</h4>
        <button id="btn-search-apple">Search Apple</button>
        <button id="btn-search-berry">Search Berry</button>
      </div>

      <div class="action-section">
        <h4>Collect</h4>
        <button id="btn-collect-nearest">Collect Nearest</button>
        <button id="btn-collect-apple">Collect Apple</button>
        <button id="btn-collect-berry">Collect Berry</button>
      </div>

      <div class="action-section">
        <h4>Drop</h4>
        <button id="btn-drop-apple">Drop Apple</button>
        <button id="btn-drop-berry">Drop Berry</button>
      </div>

      <div class="action-section">
        <h4>Info</h4>
        <div id="inventory-info">Inventory: Empty</div>
        <div id="action-status"></div>
      </div>
    </div>
  `;

  document.body.appendChild(uiContainer);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #test-ui {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #test-menu {
      background: rgba(20, 20, 20, 0.95);
      border: 2px solid #ffdd1a;
      border-radius: 8px;
      padding: 15px;
      color: #ffffff;
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    #test-menu h3 {
      margin: 0 0 15px 0;
      color: #ffdd1a;
      font-size: 18px;
      border-bottom: 2px solid #ffdd1a;
      padding-bottom: 8px;
    }

    #test-menu h4 {
      margin: 12px 0 8px 0;
      color: #aaaaaa;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .action-section {
      margin-bottom: 10px;
    }

    .action-section:last-of-type {
      border-top: 1px solid #444;
      padding-top: 10px;
    }

    #test-menu button {
      display: block;
      width: 100%;
      padding: 10px;
      margin: 5px 0;
      background: #2a5d2a;
      color: #ffffff;
      border: 1px solid #3a7d3a;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    #test-menu button:hover {
      background: #3a7d3a;
      border-color: #ffdd1a;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(255, 221, 26, 0.3);
    }

    #test-menu button:active {
      transform: translateY(0);
    }

    #test-menu button:disabled {
      background: #333;
      border-color: #555;
      color: #666;
      cursor: not-allowed;
      transform: none;
    }

    #inventory-info, #action-status {
      padding: 8px;
      margin: 5px 0;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      font-size: 12px;
      min-height: 20px;
    }

    #action-status {
      color: #ffdd1a;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  // Update inventory display periodically
  setInterval(() => {
    const invInfo = document.getElementById('inventory-info');
    if (invInfo && characterEntity) {
      const items = characterEntity.inventory.items;
      if (items.length === 0) {
        invInfo.textContent = 'Inventory: Empty';
      } else {
        const itemCounts = {};
        items.forEach(item => {
          itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
        });
        const itemText = Object.entries(itemCounts)
          .map(([type, count]) => `${count}x ${type}`)
          .join(', ');
        invInfo.textContent = `Inventory: ${itemText}`;
      }
    }
  }, 200);

  // Helper: Find nearest entity of type with item
  function findNearestWithItem(itemType) {
    const entities = getEntities();
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
  document.getElementById('btn-wander-short').addEventListener('click', () => {
    showStatus('🚶 Starting 3s wander...');
    characterEntity.wander(3000, (result) => {
      if (result.success) {
        showStatus('✅ Wander complete');
      }
    });
  });

  document.getElementById('btn-wander-long').addEventListener('click', () => {
    showStatus('🚶 Starting 10s wander...');
    characterEntity.wander(10000, (result) => {
      if (result.success) {
        showStatus('✅ Wander complete');
      }
    });
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    characterEntity.stopCurrentAction();
    showStatus('🛑 Action stopped');
  });

  document.getElementById('btn-search-apple').addEventListener('click', () => {
    showStatus('🔍 Searching for apple...');
    characterEntity.searchFor('apple', (result) => {
      if (result.success) {
        showStatus('✅ Found apple!');
      } else {
        showStatus(`❌ Search failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-search-berry').addEventListener('click', () => {
    showStatus('🔍 Searching for berry...');
    characterEntity.searchFor('berry', (result) => {
      if (result.success) {
        showStatus('✅ Found berry!');
      } else {
        showStatus(`❌ Search failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-collect-nearest').addEventListener('click', () => {
    const target = findNearestCollectible();
    if (!target) {
      showStatus('❌ No collectibles in sight');
      return;
    }

    // Find what item type to collect
    const itemType = target.inventory.items[0].type;
    showStatus(`🎯 Collecting ${itemType} from ${target.type}...`);

    characterEntity.collect(target, itemType, (result) => {
      if (result.success) {
        showStatus(`✅ Collected ${itemType}!`);
      } else {
        showStatus(`❌ Collection failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-collect-apple').addEventListener('click', () => {
    const target = findNearestWithItem('apple');
    if (!target) {
      showStatus('❌ No apples in sight');
      return;
    }

    showStatus('🎯 Collecting apple...');
    characterEntity.collect(target, 'apple', (result) => {
      if (result.success) {
        showStatus('✅ Collected apple!');
      } else {
        showStatus(`❌ Collection failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-collect-berry').addEventListener('click', () => {
    const target = findNearestWithItem('berry');
    if (!target) {
      showStatus('❌ No berries in sight');
      return;
    }

    showStatus('🎯 Collecting berry...');
    characterEntity.collect(target, 'berry', (result) => {
      if (result.success) {
        showStatus('✅ Collected berry!');
      } else {
        showStatus(`❌ Collection failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-drop-apple').addEventListener('click', () => {
    if (!characterEntity.inventory.hasItem('apple')) {
      showStatus('❌ No apples to drop');
      return;
    }

    showStatus('📦 Dropping apple...');
    characterEntity.drop('apple', (result) => {
      if (result.success) {
        showStatus('✅ Dropped apple!');
      } else {
        showStatus(`❌ Drop failed: ${result.reason}`);
      }
    });
  });

  document.getElementById('btn-drop-berry').addEventListener('click', () => {
    if (!characterEntity.inventory.hasItem('berry')) {
      showStatus('❌ No berries to drop');
      return;
    }

    showStatus('📦 Dropping berry...');
    characterEntity.drop('berry', (result) => {
      if (result.success) {
        showStatus('✅ Dropped berry!');
      } else {
        showStatus(`❌ Drop failed: ${result.reason}`);
      }
    });
  });

  console.log('🎮 Test UI initialized! Use the menu on the right to test character actions.');
}
