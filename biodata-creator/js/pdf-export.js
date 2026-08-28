/**
 * pdf-export.js
 * -------------------------------------------------------------
 * Turns the live preview sheet into a downloadable PDF using
 * html2pdf.js (loaded from a CDN in index.html — an internet
 * connection is needed the first time the page loads).
 *
 * A plain-browser "Print" fallback is also provided, which uses
 * the print stylesheet in css/style.css so the sheet can be
 * saved as a PDF through the browser's own print dialog too.
 * -------------------------------------------------------------
 */

function suggestedFileName(state) {
  const nameField = findFieldByLabel(state, /full name|name/i);
  const raw = (nameField && nameField.value.trim()) || 'biodata';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '.pdf';
}

function findFieldByLabel(state, labelPattern) {
  for (const section of state.sections) {
    for (const field of section.fields) {
      if (labelPattern.test(field.label)) return field;
    }
  }
  return null;
}

/**
 * Exports the #biodataPreview element to a PDF file.
 * Shows a small busy state on the trigger button while working.
 */
async function exportPreviewToPDF(state, buttonEl) {
  const sheetEl = document.getElementById('biodataPreview');
  const frameEl = document.getElementById('sheetFrame');
  if (!sheetEl) return;

  if (typeof html2pdf === 'undefined') {
    alert(
      'The PDF library did not load, so a PDF can\'t be created right now. ' +
      'Try reloading the page — if it keeps happening, the js/vendor/html2pdf.bundle.min.js ' +
      'file may be missing from this copy of the app.'
    );
    return;
  }

  const originalLabel = buttonEl ? buttonEl.textContent : null;
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Preparing PDF…';
  }

  // --- Neutralise anything that could make html2canvas capture the
  //     wrong region: a scrolled page/panel, or the responsive scale
  //     transform used to fit small screens. Both are restored in the
  //     `finally` block below regardless of success or failure. ---
  const scrollEl = document.querySelector('.preview-scroll');
  const prevWindowScroll = { x: window.scrollX, y: window.scrollY };
  const prevInnerScroll = scrollEl ? { top: scrollEl.scrollTop, left: scrollEl.scrollLeft } : null;
  const prevFrameStyle = frameEl
    ? { transform: frameEl.style.transform, width: frameEl.style.width, height: frameEl.style.height }
    : null;

  try {
    window.scrollTo(0, 0);
    if (scrollEl) {
      scrollEl.scrollTop = 0;
      scrollEl.scrollLeft = 0;
    }
    if (frameEl) {
      frameEl.style.transform = 'none';
      frameEl.style.width = '';
      frameEl.style.height = '';
    }

    // Let the browser apply the layout changes above before we capture.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const opt = {
      margin: 0,
      filename: suggestedFileName(state),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: sheetEl.scrollWidth,
        windowHeight: sheetEl.scrollHeight
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await html2pdf().set(opt).from(sheetEl).save();
  } catch (err) {
    console.error('PDF export failed', err);
    alert('Sorry, something went wrong while creating the PDF. Please try again.');
  } finally {
    if (frameEl && prevFrameStyle) {
      frameEl.style.transform = prevFrameStyle.transform;
      frameEl.style.width = prevFrameStyle.width;
      frameEl.style.height = prevFrameStyle.height;
    }
    if (typeof fitPreviewToContainer === 'function') fitPreviewToContainer();

    window.scrollTo(prevWindowScroll.x, prevWindowScroll.y);
    if (scrollEl && prevInnerScroll) {
      scrollEl.scrollTop = prevInnerScroll.top;
      scrollEl.scrollLeft = prevInnerScroll.left;
    }

    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = originalLabel;
    }
  }
}

/**
 * Opens the browser print dialog, which the user can point at
 * "Save as PDF" as a no-dependency alternative to the button above.
 */
function printPreview() {
  window.print();
}
