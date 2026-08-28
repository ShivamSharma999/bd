/**
 * app.js
 * -------------------------------------------------------------
 * Owns the app state (sections/fields, chosen template, photo),
 * renders the editor form and the live preview from that state,
 * and wires up every button (add field, delete field, add
 * section, delete section, upload photo, export PDF, print).
 *
 * State shape:
 * {
 *   templateId: 'classic' | 'modern' | 'royal' | 'floral',
 *   photo: <dataURL string or null>,
 *   sections: [
 *     { id, title, fields: [ { id, label, value }, ... ] },
 *     ...
 *   ]
 * }
 * -------------------------------------------------------------
 */

const GANESHA_EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" role="img" aria-label="Decorative emblem of Lord Ganesha">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F9E29B"/>
      <stop offset="50%" stop-color="#D9A63E"/>
      <stop offset="100%" stop-color="#B87F24"/>
    </linearGradient>
    <radialGradient id="plaque" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#7A2530"/>
      <stop offset="100%" stop-color="#4A1418"/>
    </radialGradient>
  </defs>

  <!-- mandala plaque background -->
  <circle cx="120" cy="145" r="120" fill="url(#plaque)"/>
  <circle cx="120" cy="145" r="113" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
  <circle cx="120" cy="145" r="104" fill="none" stroke="url(#gold)" stroke-width="1" stroke-dasharray="1 7"/>

  <!-- ears (drawn first so head layers over the join) -->
  <ellipse cx="62" cy="118" rx="27" ry="35" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.6" transform="rotate(-14 62 118)"/>
  <ellipse cx="178" cy="118" rx="27" ry="35" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.6" transform="rotate(14 178 118)"/>
  <ellipse cx="66" cy="118" rx="14" ry="21" fill="#7A2530" opacity="0.35" transform="rotate(-14 66 118)"/>
  <ellipse cx="174" cy="118" rx="14" ry="21" fill="#7A2530" opacity="0.35" transform="rotate(14 174 118)"/>

  <!-- crown -->
  <path d="M99 78 Q120 52 141 78 L136 90 Q120 78 104 90 Z" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.5"/>
  <path d="M120 52 L127 65 L113 65 Z" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.4"/>
  <circle cx="120" cy="47" r="5" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.2"/>

  <!-- head -->
  <ellipse cx="120" cy="118" rx="41" ry="37" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.8"/>

  <!-- tilak -->
  <path d="M118 98 Q120 90 122 98 Q120 104 118 98 Z" fill="#8B1E2B"/>

  <!-- eyes -->
  <path d="M103 116 Q109 110 115 116 Q109 121 103 116 Z" fill="#3A2210"/>
  <path d="M125 116 Q131 110 137 116 Q131 121 125 116 Z" fill="#3A2210"/>

  <!-- belly (drawn before limbs so shoulders/trunk attach on top of it) -->
  <ellipse cx="120" cy="212" rx="59" ry="46" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.8"/>

  <!-- dhoti / lower garment -->
  <path d="M63 230 Q120 264 177 230 Q178 248 120 258 Q62 248 63 230 Z" fill="#8B2B2B" stroke="#6E3E12" stroke-width="1.4"/>

  <!-- right arm (viewer's left), raised in blessing -->
  <path d="M84 190 Q60 180 55 158" fill="none" stroke="#6E3E12" stroke-width="16" stroke-linecap="round"/>
  <path d="M84 190 Q60 180 55 158" fill="none" stroke="url(#gold)" stroke-width="13" stroke-linecap="round"/>
  <circle cx="53" cy="153" r="10" fill="url(#gold)" stroke="#6E3E12" stroke-width="1.4"/>

  <!-- left arm (viewer's right), resting with sweet bowl -->
  <path d="M160 196 Q173 210 158 222" fill="none" stroke="#6E3E12" stroke-width="16" stroke-linecap="round"/>
  <path d="M160 196 Q173 210 158 222" fill="none" stroke="url(#gold)" stroke-width="13" stroke-linecap="round"/>
  <path d="M144 220 Q157 214 170 220 Q166 233 157 233 Q148 233 144 220 Z" fill="#F4DFA8" stroke="#6E3E12" stroke-width="1.3"/>

  <!-- trunk, curling forward on top of the belly -->
  <path d="M120 124 C114 142 130 150 124 165 C121 175 133 178 138 168" fill="none" stroke="#6E3E12" stroke-width="18" stroke-linecap="round"/>
  <path d="M120 124 C114 142 130 150 124 165 C121 175 133 178 138 168" fill="none" stroke="url(#gold)" stroke-width="15" stroke-linecap="round"/>

  <!-- modak sweet at trunk tip -->
  <path d="M138 168 Q150 162 153 175 Q154 187 142 188 Q131 187 132 176 Q134 169 138 168 Z" fill="#F4DFA8" stroke="#6E3E12" stroke-width="1.4"/>
  <path d="M138 171 L145 180 M143 168 L149 179" stroke="#6E3E12" stroke-width="1"/>

  <!-- mouse companion, tucked beside the belly -->
  <g transform="translate(-8 4)">
    <ellipse cx="92" cy="252" rx="15" ry="8" fill="#5B4128" stroke="#3D2A18" stroke-width="1"/>
    <circle cx="104" cy="246" r="6" fill="#5B4128" stroke="#3D2A18" stroke-width="1"/>
    <circle cx="101" cy="240" r="2.2" fill="#5B4128"/>
    <circle cx="108" cy="240" r="2.2" fill="#5B4128"/>
    <path d="M78 253 Q69 257 71 248" fill="none" stroke="#3D2A18" stroke-width="1.5"/>
  </g>
</svg>`;

const STORAGE_KEY = 'biodata-creator:v1';

let state = null;
let saveTimer = null;

/* ---------------------------------------------------------- */
/* Default content                                             */
/* ---------------------------------------------------------- */

function makeId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function field(label, value = '') {
  return { id: makeId('f'), label, value };
}

function defaultState() {
  return {
    templateId: 'classic',
    photo: null,
    sections: [
      {
        id: makeId('s'),
        title: 'Personal Details',
        fields: [
          field('Full Name'),
          field('Date of Birth'),
          field('Time of Birth'),
          field('Place of Birth'),
          field('Height'),
          field('Weight'),
          field('Complexion'),
          field('Blood Group'),
          field('Religion'),
          field('Caste'),
          field('Gothra'),
          field('Mother Tongue'),
          field('Marital Status'),
          field('Diet')
        ]
      },
      {
        id: makeId('s'),
        title: 'Education & Career',
        fields: [
          field('Education'),
          field('Occupation'),
          field('Organisation'),
          field('Annual Income')
        ]
      },
      {
        id: makeId('s'),
        title: 'Family Details',
        fields: [
          field("Father's Name"),
          field("Father's Occupation"),
          field("Mother's Name"),
          field("Mother's Occupation"),
          field('Siblings'),
          field('Family Status')
        ]
      },
      {
        id: makeId('s'),
        title: 'Contact Details',
        fields: [
          field('Address'),
          field('City'),
          field('Phone Number'),
          field('Email')
        ]
      },
      {
        id: makeId('s'),
        title: 'Additional Information',
        fields: [
          field('Hobbies & Interests'),
          field('About Me / Expectations')
        ]
      }
    ]
  };
}

/* ---------------------------------------------------------- */
/* Responsive scaling                                           */
/* -------------------------------------------------------------
 * The sheet itself always stays at its natural print width
 * (794px, ~A4 at 96dpi) so PDF export is always full quality and
 * consistent regardless of device. On screen, #sheetFrame scales
 * that sheet down with a CSS transform to fit whatever width is
 * available, so phones show a crisp, fully-visible miniature
 * instead of the browser auto-zooming the whole page out.
 * ---------------------------------------------------------- */

let resizeDebounce = null;

function fitPreviewToContainer() {
  const scrollEl = document.querySelector('.preview-scroll');
  const frame = document.getElementById('sheetFrame');
  const sheet = document.getElementById('biodataPreview');
  if (!scrollEl || !frame || !sheet) return;

  const available = scrollEl.clientWidth - 32; // small side margin
  const natural = sheet.offsetWidth || 794;
  const scale = Math.max(0.01, Math.min(1, available / natural));

  frame.style.transformOrigin = 'top left';
  frame.style.transform = `scale(${scale})`;
  frame.style.width = natural * scale + 'px';
  frame.style.height = sheet.offsetHeight * scale + 'px';
}

function scheduleFitOnResize() {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(fitPreviewToContainer, 100);
}

/* ---------------------------------------------------------- */
/* Persistence                                                  */
/* ---------------------------------------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read saved biodata, starting fresh.', err);
  }
  return defaultState();
}

function scheduleSave() {
  const statusEl = document.getElementById('autosaveStatus');
  if (statusEl) statusEl.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (statusEl) statusEl.textContent = 'Autosaved to this browser';
    } catch (err) {
      console.warn('Could not save biodata (storage may be full).', err);
      if (statusEl) statusEl.textContent = 'Could not autosave';
    }
  }, 350);
}

/* ---------------------------------------------------------- */
/* Rendering: editor panel                                      */
/* ---------------------------------------------------------- */

function renderSectionsEditor() {
  const root = document.getElementById('sectionsEditor');
  root.innerHTML = '';

  state.sections.forEach((section) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'edit-section';
    sectionEl.dataset.sectionId = section.id;

    const header = document.createElement('div');
    header.className = 'edit-section__header';
    header.innerHTML = `
      <input type="text" class="edit-section__title-input" value="${escapeAttr(section.title)}" aria-label="Section title">
      <button type="button" class="icon-btn icon-btn--danger" data-action="delete-section" title="Delete this section">✕</button>
    `;
    sectionEl.appendChild(header);

    const fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'edit-section__fields';

    section.fields.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'field-row-edit';
      row.dataset.fieldId = f.id;
      row.innerHTML = `
        <input type="text" class="field-row-edit__label" placeholder="Label" value="${escapeAttr(f.label)}" aria-label="Field label">
        <input type="text" class="field-row-edit__value" placeholder="Value" value="${escapeAttr(f.value)}" aria-label="Field value">
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete-field" title="Delete this field">✕</button>
      `;
      fieldsWrap.appendChild(row);
    });

    sectionEl.appendChild(fieldsWrap);

    const addFieldBtn = document.createElement('button');
    addFieldBtn.type = 'button';
    addFieldBtn.className = 'btn btn--ghost btn--small';
    addFieldBtn.dataset.action = 'add-field';
    addFieldBtn.textContent = '+ Add field';
    sectionEl.appendChild(addFieldBtn);

    root.appendChild(sectionEl);
  });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return escapeAttr(str);
}

/* ---------------------------------------------------------- */
/* Rendering: live preview sheet                                */
/* ---------------------------------------------------------- */

function renderPreview() {
  const sheet = document.getElementById('biodataPreview');
  applyTemplateClass(sheet, state.templateId);

  const nameField = findFieldByLabel(state, /full name|^name$/i);
  const name = (nameField && nameField.value.trim()) || '';

  const photoHtml = state.photo
    ? `<img src="${state.photo}" alt="Photograph" class="sheet-photo__img">`
    : `<span class="sheet-photo__placeholder">Photo</span>`;

  const sectionsHtml = state.sections
    .map((section) => {
      const filledFields = section.fields.filter((f) => f.value.trim() !== '');
      if (filledFields.length === 0) return '';
      const rows = filledFields
        .map(
          (f) => `
        <div class="field-row">
          <span class="field-row__label">${escapeHtml(f.label)}</span>
          <span class="field-row__value">${escapeHtml(f.value)}</span>
        </div>`
        )
        .join('');
      return `
        <section class="sheet-section">
          <h2 class="sheet-section__title">${escapeHtml(section.title)}</h2>
          <div class="sheet-section__rows">${rows}</div>
        </section>`;
    })
    .join('');

  sheet.innerHTML = `
    <div class="sheet-photo">${photoHtml}</div>
    <div class="sheet-heading">
      <div class="sheet-emblem">
        <span class="sheet-emblem__img">${GANESHA_EMBLEM_SVG}</span>
        <div class="sheet-emblem__om" aria-hidden="true">ॐ</div>
      </div>
      <h1 class="sheet-title">Biodata</h1>
      ${name ? `<p class="sheet-subtitle">${escapeHtml(name)}</p>` : ''}
    </div>
    <div class="sheet-sections">${sectionsHtml || emptyStateHtml()}</div>
  `;

  fitPreviewToContainer();
}

function emptyStateHtml() {
  return `<p class="sheet-empty">Start filling in your details on the left — they'll appear here as you type.</p>`;
}

/* ---------------------------------------------------------- */
/* Photo handling                                               */
/* ---------------------------------------------------------- */

function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // Downscale large photos so localStorage / the PDF stay light.
      const maxWidth = 600;
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      state.photo = canvas.toDataURL('image/jpeg', 0.9);
      renderPhotoControl();
      renderPreview();
      scheduleSave();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function renderPhotoControl() {
  const img = document.getElementById('photoPreviewImg');
  const placeholder = document.getElementById('photoPlaceholderText');
  const removeBtn = document.getElementById('removePhotoBtn');

  if (state.photo) {
    img.src = state.photo;
    img.hidden = false;
    placeholder.hidden = true;
    removeBtn.hidden = false;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
    removeBtn.hidden = true;
  }
}

/* ---------------------------------------------------------- */
/* Event wiring                                                 */
/* ---------------------------------------------------------- */

function pickTemplate(id) {
  state.templateId = id;
  renderTemplatePicker(document.getElementById('templateGrid'), state.templateId, pickTemplate);
  renderPreview();
  scheduleSave();
}

function initSectionsEditorEvents() {
  const root = document.getElementById('sectionsEditor');

  root.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    const sectionEl = e.target.closest('.edit-section');
    const sectionId = sectionEl && sectionEl.dataset.sectionId;
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;

    if (action === 'delete-section') {
      state.sections = state.sections.filter((s) => s.id !== sectionId);
      renderSectionsEditor();
      renderPreview();
      scheduleSave();
    }

    if (action === 'add-field') {
      section.fields.push(field('New Field'));
      renderSectionsEditor();
      renderPreview();
      scheduleSave();
      const inputs = root.querySelectorAll(
        `.edit-section[data-section-id="${sectionId}"] .field-row-edit__label`
      );
      const last = inputs[inputs.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
    }

    if (action === 'delete-field') {
      const rowEl = e.target.closest('.field-row-edit');
      const fieldId = rowEl && rowEl.dataset.fieldId;
      section.fields = section.fields.filter((f) => f.id !== fieldId);
      renderSectionsEditor();
      renderPreview();
      scheduleSave();
    }
  });

  root.addEventListener('input', (e) => {
    const sectionEl = e.target.closest('.edit-section');
    const sectionId = sectionEl && sectionEl.dataset.sectionId;
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;

    if (e.target.classList.contains('edit-section__title-input')) {
      section.title = e.target.value;
      renderPreview();
      scheduleSave();
      return;
    }

    const rowEl = e.target.closest('.field-row-edit');
    const fieldId = rowEl && rowEl.dataset.fieldId;
    const f = section.fields.find((fl) => fl.id === fieldId);
    if (!f) return;

    if (e.target.classList.contains('field-row-edit__label')) {
      f.label = e.target.value;
    } else if (e.target.classList.contains('field-row-edit__value')) {
      f.value = e.target.value;
    }
    renderPreview();
    scheduleSave();
  });
}

function initGlobalControls() {
  document.getElementById('addSectionBtn').addEventListener('click', () => {
    state.sections.push({
      id: makeId('s'),
      title: 'New Section',
      fields: [field('New Field')]
    });
    renderSectionsEditor();
    renderPreview();
    scheduleSave();
    const editor = document.getElementById('sectionsEditor');
    const titleInputs = editor.querySelectorAll('.edit-section__title-input');
    const last = titleInputs[titleInputs.length - 1];
    if (last) {
      last.focus();
      last.select();
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    const sure = confirm('This clears every field and your photo on this device. Continue?');
    if (!sure) return;
    state = defaultState();
    renderAll();
    scheduleSave();
  });

  document.getElementById('photoInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    handlePhotoFile(file);
  });

  document.getElementById('removePhotoBtn').addEventListener('click', () => {
    state.photo = null;
    renderPhotoControl();
    renderPreview();
    scheduleSave();
  });

  document.getElementById('exportPdfBtn').addEventListener('click', (e) => {
    exportPreviewToPDF(state, e.currentTarget);
  });

  document.getElementById('printBtn').addEventListener('click', () => {
    printPreview();
  });
}

/* ---------------------------------------------------------- */
/* Boot                                                          */
/* ---------------------------------------------------------- */

function renderAll() {
  renderTemplatePicker(document.getElementById('templateGrid'), state.templateId, pickTemplate);
  renderPhotoControl();
  renderSectionsEditor();
  renderPreview();
}

document.addEventListener('DOMContentLoaded', () => {
  state = loadState();
  renderAll();
  initSectionsEditorEvents();
  initGlobalControls();
  fitPreviewToContainer();

  window.addEventListener('resize', scheduleFitOnResize);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitPreviewToContainer).catch(() => {});
  }
});
