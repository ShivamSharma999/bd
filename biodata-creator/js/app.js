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

/* Size of the photo frame on the sheet, in CSS px. Keep in sync with
   --photo-w / --photo-h in css/style.css. Uploaded photos are cropped
   to exactly this shape so they're never stretched or squashed. */
const PHOTO_W = 159;
const PHOTO_H = 208;
const PHOTO_RATIO = PHOTO_W / PHOTO_H;
/* Stored photo resolution: 3x the frame, i.e. ~290dpi at print size. */
const PHOTO_OUTPUT_W = PHOTO_W * 3;
/* When a photo has to be cropped vertically, keep more of the top than
   the bottom (0 = keep the top, 0.5 = centred) so heads aren't cut off. */
const PHOTO_CROP_BIAS_TOP = 0.2;

/* Safety gap kept free at the bottom of every page, so tiny differences
   in font rendering between browsers can't push a row over the border. */
const PAGE_BOTTOM_SAFETY_PX = 2;
/* Never leave a section title with fewer rows than this stranded at the
   bottom of a page — move the whole section to the next page instead. */
const MIN_ROWS_BEFORE_BREAK = 2;

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

/**
 * Makes sure data read back from localStorage has the shape the rest of
 * the app expects. Without this, a stale template id (the sheet would
 * render completely unstyled) or a field with a missing value (a crash
 * on `.trim()`) would break the page on every load.
 */
function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return defaultState();

  const known = typeof TEMPLATES !== 'undefined' && TEMPLATES.some((t) => t.id === raw.templateId);

  return {
    templateId: known ? raw.templateId : 'classic',
    photo:
      typeof raw.photo === 'string' && raw.photo.startsWith('data:image/') ? raw.photo : null,
    sections: raw.sections
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({
        id: typeof s.id === 'string' && s.id ? s.id : makeId('s'),
        title: typeof s.title === 'string' ? s.title : '',
        fields: (Array.isArray(s.fields) ? s.fields : [])
          .filter((f) => f && typeof f === 'object')
          .map((f) => ({
            id: typeof f.id === 'string' && f.id ? f.id : makeId('f'),
            label: typeof f.label === 'string' ? f.label : '',
            value: typeof f.value === 'string' ? f.value : ''
          }))
      }))
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeState(JSON.parse(raw));
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

/**
 * Finds the person's name: a field labelled exactly "Name" or "Full Name"
 * (any capitalisation). Prefers one that actually has a value. Matching
 * loosely on "name" would wrongly pick "Father's Name" if the real name
 * field were deleted or renamed.
 */
function findNameField(st) {
  const matches = [];
  for (const section of st.sections) {
    for (const f of section.fields) {
      if (/^\s*(full\s+)?name\s*$/i.test(f.label)) matches.push(f);
    }
  }
  return matches.find((f) => f.value.trim() !== '') || matches[0] || null;
}

/** HTML for the heading block (emblem, title, name) — first page only. */
function headingHtml() {
  const nameField = findNameField(state);
  const name = (nameField && nameField.value.trim()) || '';

  const photoHtml = state.photo
    ? `<img src="${escapeAttr(state.photo)}" alt="Photograph" class="sheet-photo__img">`
    : `<span class="sheet-photo__placeholder">Photo</span>`;

  return `
    <div class="sheet-photo">${photoHtml}</div>
    <div class="sheet-heading">
      <div class="sheet-emblem">
        <span class="sheet-emblem__img">
          <img src="${EMBLEM_DATA_URL}" alt="ॐ">
        </span>
        <div class="sheet-emblem__om" aria-hidden="true">ॐ</div>
      </div>
      <h1 class="sheet-title">Biodata</h1>
      ${name ? `<p class="sheet-subtitle">${escapeHtml(name)}</p>` : ''}
    </div>`;
}

function emptyStateHtml() {
  return `<p class="sheet-empty">Start filling in your details on the left — they'll appear here as you type.</p>`;
}

/**
 * Appends a new A4 page to `container` and returns handles to it.
 * Only the first page carries the photo and heading; later pages are
 * just the bordered frame, ready for more sections.
 */
function createPage(container, isFirst) {
  const page = document.createElement('div');
  page.className = 'biodata-page';
  applyTemplateClass(page, state.templateId);
  page.innerHTML = `
    <div class="biodata-sheet">
      ${isFirst ? headingHtml() : ''}
      <div class="sheet-sections"></div>
    </div>`;
  container.appendChild(page);
  return {
    page,
    sheet: page.querySelector('.biodata-sheet'),
    sectionsEl: page.querySelector('.sheet-sections')
  };
}

/** Builds one section's DOM. `rows` is a list of fields. */
function createSectionEl(title, rows, isContinued) {
  const el = document.createElement('section');
  el.className = 'sheet-section';

  const shownTitle = (title || '').trim();
  const titleHtml = shownTitle
    ? `<h2 class="sheet-section__title">${escapeHtml(shownTitle)}${isContinued ? ' <span class="sheet-section__contd">(contd.)</span>' : ''}</h2>`
    : '';

  el.innerHTML = `${titleHtml}<div class="sheet-section__rows"></div>`;
  const rowsEl = el.querySelector('.sheet-section__rows');
  rows.forEach((f) => rowsEl.appendChild(createRowEl(f)));
  return el;
}

function createRowEl(f) {
  const row = document.createElement('div');
  row.className = 'field-row';
  row.innerHTML = `
    <span class="field-row__label">${escapeHtml(f.label)}</span>
    <span class="field-row__value">${escapeHtml(f.value)}</span>`;
  return row;
}

/**
 * True if everything currently on the page still sits inside the frame's
 * padding box. Uses offset* metrics, which are layout values and so are
 * unaffected by the CSS scale() used to fit the preview to the screen.
 */
function pageContentFits(ctx) {
  const last = ctx.sectionsEl.lastElementChild;
  if (!last) return true;
  const padBottom = parseFloat(getComputedStyle(ctx.sheet).paddingBottom) || 0;
  const limit = ctx.sheet.clientHeight - padBottom - PAGE_BOTTOM_SAFETY_PX;
  return last.offsetTop + last.offsetHeight <= limit;
}

/**
 * Lays the sheet out as real A4 pages. Content is added one row at a time
 * and measured by the browser itself (so it's right for any font, any
 * template and any screen). When a row would cross the bottom of the
 * frame it moves to a fresh page, which gets its own border and margins.
 * A row is never split across two pages.
 */
function renderPreview() {
  const container = document.getElementById('biodataPreview');
  container.innerHTML = '';

  // Only sections with at least one filled-in field are shown.
  const sections = state.sections
    .map((s) => ({
      title: s.title,
      rows: s.fields.filter((f) => f.value.trim() !== '')
    }))
    .filter((s) => s.rows.length > 0);

  let ctx = createPage(container, true);

  if (sections.length === 0) {
    ctx.sectionsEl.innerHTML = emptyStateHtml();
    fitPreviewToContainer();
    return;
  }

  for (const sec of sections) {
    let remaining = sec.rows.slice();
    let continued = false;

    while (remaining.length > 0) {
      const secEl = createSectionEl(sec.title, [], continued);
      const rowsEl = secEl.querySelector('.sheet-section__rows');
      ctx.sectionsEl.appendChild(secEl);

      // Add rows until the page is full.
      let placed = 0;
      for (const f of remaining) {
        rowsEl.appendChild(createRowEl(f));
        if (!pageContentFits(ctx)) {
          rowsEl.removeChild(rowsEl.lastChild);
          break;
        }
        placed++;
      }

      if (placed === remaining.length) break; // whole (rest of the) section fit

      const pageHasOtherContent = ctx.sectionsEl.children.length > 1;
      const tooFewToSplit = placed < Math.min(MIN_ROWS_BEFORE_BREAK, remaining.length);

      if (tooFewToSplit && pageHasOtherContent) {
        // Don't strand a title with one lonely row — start the section on a
        // fresh page instead, and retry it there.
        ctx.sectionsEl.removeChild(secEl);
        ctx = createPage(container, false);
        continue;
      }

      if (placed === 0) {
        // A single row taller than an entire page: place it anyway so we
        // always make progress (its overflow is clipped by the frame).
        rowsEl.appendChild(createRowEl(remaining[0]));
        placed = 1;
      } else if (remaining.length - placed === 1 && placed > MIN_ROWS_BEFORE_BREAK) {
        // Avoid carrying a single orphan row onto the next page.
        rowsEl.removeChild(rowsEl.lastChild);
        placed--;
      }

      remaining = remaining.slice(placed);
      continued = true;
      if (remaining.length > 0) ctx = createPage(container, false);
    }
  }

  fitPreviewToContainer();
}

/* ---------------------------------------------------------- */
/* Photo handling                                               */
/* ---------------------------------------------------------- */

/**
 * Crops `img` to exactly the photo frame's shape (PHOTO_RATIO) and returns
 * it as a JPEG data URL.
 *
 * Why crop here rather than letting CSS `object-fit: cover` do it: the
 * browser honours object-fit on screen, but html2canvas (which builds the
 * PDF) does not — it just stretches the image to fill the frame. A photo
 * that already has the frame's exact shape needs no such help, so it looks
 * identical on screen, in the PDF and in print.
 */
function cropToFrame(img) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // The largest region of the source that has the frame's shape.
  let cropW = srcW;
  let cropH = srcW / PHOTO_RATIO;
  if (cropH > srcH) {
    cropH = srcH;
    cropW = srcH * PHOTO_RATIO;
  }
  const sx = (srcW - cropW) / 2; // centred horizontally
  const sy = (srcH - cropH) * PHOTO_CROP_BIAS_TOP; // biased towards the top

  // Don't upscale small photos beyond what they really contain.
  const outW = Math.round(Math.min(PHOTO_OUTPUT_W, cropW));
  const outH = Math.round(outW / PHOTO_RATIO);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  // JPEG has no transparency: without a white backdrop, transparent areas
  // of a PNG would turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function handlePhotoFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file (JPG or PNG).');
    return;
  }

  const fail = () =>
    alert(
      "Sorry, that image couldn't be read. Try a JPG or PNG — some formats " +
        '(such as HEIC from iPhones) aren\'t supported by browsers.'
    );

  const reader = new FileReader();
  reader.onerror = fail;
  reader.onload = () => {
    const img = new Image();
    img.onerror = fail;
    img.onload = () => {
      state.photo = cropToFrame(img);
      renderPhotoControl();
      renderPreview();
      scheduleSave();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Photos saved by earlier versions of the app were stored uncropped, so
 * they would still be stretched in the PDF. Re-crop any such photo once.
 */
function upgradeStoredPhoto() {
  if (!state.photo) return;
  const img = new Image();
  img.onload = () => {
    const ratio = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ratio - PHOTO_RATIO) / PHOTO_RATIO <= 0.01) return; // already the right shape
    state.photo = cropToFrame(img);
    renderPhotoControl();
    renderPreview();
    scheduleSave();
  };
  img.src = state.photo;
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
      // The ✕ is small and easy to hit by accident (especially on a phone),
      // and there is no undo — so confirm, but only if real data is at stake.
      const filled = section.fields.filter((f) => f.value.trim() !== '').length;
      if (filled > 0) {
        const label = section.title.trim() || 'this section';
        const sure = confirm(
          `Delete "${label}" and the ${filled} detail${filled === 1 ? '' : 's'} you've filled in?`
        );
        if (!sure) return;
      }
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
    // Clear the input so choosing the *same* file again (e.g. after
    // pressing Remove) still fires a change event.
    e.target.value = '';
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
  upgradeStoredPhoto();

  window.addEventListener('resize', scheduleFitOnResize);

  // Web fonts arrive after the first render and change how tall each row
  // is, which changes where the page breaks fall — so re-lay-out the pages
  // (not just re-scale them) once fonts have loaded.
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(renderPreview).catch(() => {});
    if (document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', renderPreview);
    }
  }
});
