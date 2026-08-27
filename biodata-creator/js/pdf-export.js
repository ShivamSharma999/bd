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
function exportPreviewToPDF(state, buttonEl) {
  const sheetEl = document.getElementById('biodataPreview');
  if (!sheetEl) return;

  if (typeof html2pdf === 'undefined') {
    alert(
      'The PDF library could not be loaded. Please check your internet connection and try again ' +
      '(this app downloads a small PDF-generation library the first time you export).'
    );
    return;
  }

  const originalLabel = buttonEl ? buttonEl.textContent : null;
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Preparing PDF…';
  }

  const opt = {
    margin: 0,
    filename: suggestedFileName(state),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  html2pdf()
    .set(opt)
    .from(sheetEl)
    .save()
    .catch((err) => {
      console.error('PDF export failed', err);
      alert('Sorry, something went wrong while creating the PDF. Please try again.');
    })
    .finally(() => {
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = originalLabel;
      }
    });
}

/**
 * Opens the browser print dialog, which the user can point at
 * "Save as PDF" as a no-dependency alternative to the button above.
 */
function printPreview() {
  window.print();
}
