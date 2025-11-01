// === RENDERING MODULE ===
// Handles SVG rendering of the game scene

import * as config from './config.js';
import { SmartEntity } from './entities.js';
import { getCycleState, getDarknessOpacity } from './cycle.js';
import { getFriendlyVisibleEntities } from './visibility.js';

export function render(canvas, entities, SVG_COMPONENTS, getCharacterSVG, characterEntity) {
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const darknessOpacity = getDarknessOpacity();
  const cycleState = getCycleState();

  // Get union of all friendly entities' visibility
  const friendlyVisibleEntities = getFriendlyVisibleEntities(entities);

  // Render visible entities (only what friendly entities can see)
  const visibleEntitySVG = entities
    .filter(e => friendlyVisibleEntities.has(e))
    .map(e => {
      if (e instanceof SmartEntity) {
        return e.render(SVG_COMPONENTS, getCharacterSVG);
      } else {
        return e.render(SVG_COMPONENTS);
      }
    })
    .join('');

  // Render visibility circles for all friendly entities
  let visibilityCircles = '';
  for (const entity of entities) {
    if (entity instanceof SmartEntity && entity.isFriendly) {
      const radius = entity.getVisibilityRadius(cycleState);
      visibilityCircles += `
        <circle
          cx="${entity.x}"
          cy="${entity.y}"
          r="${radius}"
          fill="none"
          stroke="#ffdd1a"
          stroke-width="2"
          stroke-dasharray="5,5"
          opacity="0.6"
        />
      `;
    }
  }

  // Render inventory items floating above character
  let inventoryDisplay = '';
  if (characterEntity && characterEntity.inventory && characterEntity.inventory.items.length > 0) {
    const items = characterEntity.inventory.items;
    items.forEach((item, index) => {
      const offsetX = (index - (items.length - 1) / 2) * 15; // Space items horizontally
      const offsetY = -45; // Float above character's head
      const itemX = characterEntity.x + offsetX;
      const itemY = characterEntity.y + offsetY;

      // Render item using SVG components
      const itemScale = 0.25;
      if (item.type === 'apple') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">${SVG_COMPONENTS['apple'](itemScale)}</g>`;
      } else if (item.type === 'berry') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">${SVG_COMPONENTS['berry'](itemScale)}</g>`;
      }
    });
  }

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${config.BACKGROUND_COLOR}"/>

      <!-- Entities -->
      ${visibleEntitySVG}

      <!-- Visibility circles (friendly entities only) -->
      ${visibilityCircles}

      <!-- Inventory display -->
      ${inventoryDisplay}

      <!-- Darkness overlay for night -->
      <rect width="100%" height="100%" fill="#000000" opacity="${darknessOpacity}" pointer-events="none"/>
    </svg>
  `;
}
