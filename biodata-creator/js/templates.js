/**
 * templates.js
 * -------------------------------------------------------------
 * Defines the visual templates available for the biodata sheet
 * and renders the small clickable template-picker cards in the
 * editor panel. The actual look of each template lives in
 * css/style.css (look for ".template-classic", ".template-modern",
 * ".template-royal", ".template-floral") — this file just holds
 * the metadata and wires up selection.
 * -------------------------------------------------------------
 */

const TEMPLATES = [
  {
    id: 'classic',
    name: 'Traditional',
    description: 'Maroon & gold, ornate border',
    swatch: ['#6B1E23', '#D9A63E', '#FBF3E4']
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean ivory, minimal rules',
    swatch: ['#FFFFFF', '#B8892E', '#24211D']
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Navy & gold crest banner',
    swatch: ['#16345C', '#C9A227', '#FFFEFB']
  },
  {
    id: 'floral',
    name: 'Blush',
    description: 'Soft rose, rounded card',
    swatch: ['#FFF8F6', '#B85C6B', '#F3D8DE']
  }
];

/**
 * Renders the template picker cards into #templateGrid.
 * `activeId` is highlighted as selected.
 * `onSelect(id)` is called when the user picks a template.
 */
function renderTemplatePicker(containerEl, activeId, onSelect) {
  containerEl.innerHTML = '';

  TEMPLATES.forEach((tpl) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'template-card' + (tpl.id === activeId ? ' template-card--active' : '');
    card.setAttribute('aria-pressed', tpl.id === activeId ? 'true' : 'false');
    card.dataset.templateId = tpl.id;

    const swatchHtml = tpl.swatch
      .map((c) => `<span class="template-card__dot" style="background:${c}"></span>`)
      .join('');

    card.innerHTML = `
      <span class="template-card__swatches">${swatchHtml}</span>
      <span class="template-card__name">${tpl.name}</span>
      <span class="template-card__desc">${tpl.description}</span>
    `;

    card.addEventListener('click', () => onSelect(tpl.id));
    containerEl.appendChild(card);
  });
}

/**
 * Swaps the template class on the preview sheet element.
 */
function applyTemplateClass(sheetEl, templateId) {
  TEMPLATES.forEach((tpl) => sheetEl.classList.remove('template-' + tpl.id));
  sheetEl.classList.add('template-' + templateId);
}
