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
  // TEMPORARILY SHOW ALL ENTITIES FOR TESTING
  const visibleEntitySVG = entities
    // .filter(e => friendlyVisibleEntities.has(e))
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

  // Render sleep indicator
  let sleepIndicator = '';
  if (characterEntity && characterEntity.isSleeping) {
    const zzzX = characterEntity.x + 20;
    const zzzY = characterEntity.y - 40;
    sleepIndicator = `
      <text x="${zzzX}" y="${zzzY}" font-size="24" fill="#ffffff" font-family="Arial" opacity="0.8">
        💤
      </text>
    `;
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
      } else if (item.type === 'stick') {
        inventoryDisplay += `<g transform="translate(${itemX}, ${itemY})">${SVG_COMPONENTS['stick'](itemScale)}</g>`;
      }
    });
  }

  // Render fuel bars for bonfires
  let fuelBars = '';
  for (const entity of entities) {
    if (entity.type === 'bonfire' && entity.fuel !== undefined) {
      const fuelPercent = (entity.fuel / entity.maxFuel) * 100;
      const barWidth = 60;
      const barHeight = 6;
      const barX = entity.x - barWidth / 2;
      const barY = entity.y + 35; // Below bonfire

      // Background bar
      fuelBars += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="#1a1d23" stroke="#333" stroke-width="1" rx="3"/>`;

      // Fuel level (color changes based on level)
      let fuelColor = '#ff9800'; // Orange
      if (fuelPercent < 30) fuelColor = '#e74c3c'; // Red when low
      else if (fuelPercent > 70) fuelColor = '#f39c12'; // Yellow when high

      const fuelWidth = (barWidth - 2) * (fuelPercent / 100);
      fuelBars += `<rect x="${barX + 1}" y="${barY + 1}" width="${fuelWidth}" height="${barHeight - 2}" fill="${fuelColor}" rx="2"/>`;
    }
  }

  canvas.innerHTML = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${config.BACKGROUND_COLOR}"/>

      <!-- Entities -->
      ${visibleEntitySVG}

      <!-- Visibility circles (friendly entities only) -->
      ${visibilityCircles}

      <!-- Sleep indicator -->
      ${sleepIndicator}

      <!-- Inventory display -->
      ${inventoryDisplay}

      <!-- Bonfire fuel bars -->
      ${fuelBars}

      <!-- Darkness overlay for night -->
      <rect width="100%" height="100%" fill="#000000" opacity="${darknessOpacity}" pointer-events="none"/>
    </svg>
  `;
}

