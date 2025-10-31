// Main application entry point
// This file is loaded with cache busting via index.html

import * as debugConsole from './console.js';

// Example: Initialize your app
function init() {
  // Initialize debug console FIRST
  debugConsole.init();

  console.log('🚀 Application loaded!');
  console.log('📦 Build version:', window.__BUILD || 'unknown');
  console.log('✨ Initializing application...');

  // Your application code here
  // Example: Update UI, set up event listeners, etc.
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for other modules if needed
export { init };
