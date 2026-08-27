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
    <div class="sheet-emblem">
      <img src="assets/ganesha.svg" alt="Lord Ganesha" class="sheet-emblem__img">
      <div class="sheet-emblem__om" aria-hidden="true">ॐ</div>
    </div>
    <h1 class="sheet-title">Biodata</h1>
    ${name ? `<p class="sheet-subtitle">${escapeHtml(name)}</p>` : ''}
    <div class="sheet-sections">${sectionsHtml || emptyStateHtml()}</div>
  `;
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
});
