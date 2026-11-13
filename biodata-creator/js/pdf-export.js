/**
 * pdf-export.js
 * -------------------------------------------------------------
 * Turns the live preview into a downloadable PDF using html2pdf.js
 * (bundled locally in js/vendor/, so it works offline).
 *
 * The preview is already laid out as separate A4 pages (see
 * renderPreview() in js/app.js), each with its own border and
 * margins. We photograph every page on its own and add each one to
 * the PDF as its own page — so what you see on screen, page for
 * page, is exactly what ends up in the file.
 *
 * Note: each PDF page is an image of the page, so text in the
 * downloaded PDF can't be selected or copied. The "Print" button
 * (browser print dialog → "Save as PDF") produces a text-based PDF
 * with the same page layout.
 * -------------------------------------------------------------
 */

const PDF_PAGE_MM = { w: 210, h: 297 }; // A4

/**
 * File name for the download, based on the person's name, e.g.
 * "shivam-kumar-sharma.pdf". Falls back to "biodata.pdf" if there is no
 * name. Letters from any script (e.g. Devanagari) are kept — stripping
 * everything except a–z would turn a Hindi name into just ".pdf".
 */
function suggestedFileName(state) {
  const nameField = findNameField(state);
  const raw = nameField ? nameField.value.trim() : '';
  const slug = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'biodata') + '.pdf';
}

/** Resolves once every <img> under `root` has loaded (or failed). */
function waitForImages(root) {
  const pending = Array.from(root.querySelectorAll('img')).filter(
    (img) => !(img.complete && img.naturalWidth > 0)
  );
  return Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
    )
  );
}

function nextFrames(n = 2) {
  return new Promise((resolve) => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
}

/**
 * Exports every page of #biodataPreview to a multi-page A4 PDF.
 * Shows a small busy state on the trigger button while working.
 */
async function exportPreviewToPDF(state, buttonEl) {
  const pageEls = Array.from(document.querySelectorAll('#biodataPreview .biodata-page'));
  if (pageEls.length === 0) return;

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

  // Capture copies of the pages from an off-screen, unscaled stage rather
  // than the on-screen preview. The preview is shrunk with a CSS transform
  // to fit small screens and may be scrolled; neither can affect the copies,
  // and the visible page doesn't jump around while exporting.
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText =
    'position:absolute;top:0;left:-10000px;width:794px;pointer-events:none;';
  pageEls.forEach((p) => stage.appendChild(p.cloneNode(true)));
  document.body.appendChild(stage);

  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await waitForImages(stage);
    await nextFrames(2);

    const filename = suggestedFileName(state);
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pages = Array.from(stage.children);
    let pdf = null;

    for (let i = 0; i < pages.length; i++) {
      if (buttonEl && pages.length > 1) {
        buttonEl.textContent = `Preparing page ${i + 1} of ${pages.length}…`;
      }

      const canvas = await html2pdf().set(opt).from(pages[i]).toCanvas().get('canvas');

      if (!pdf) {
        // The first page creates the document.
        pdf = await html2pdf().set(opt).from(canvas, 'canvas').toPdf().get('pdf');
      } else {
        pdf.addPage('a4', 'portrait');
        pdf.addImage(
          canvas.toDataURL('image/jpeg', opt.image.quality),
          'JPEG',
          0,
          0,
          PDF_PAGE_MM.w,
          PDF_PAGE_MM.h
        );
      }
    }

    pdf.save(filename);
  } catch (err) {
    console.error('PDF export failed', err);
    alert('Sorry, something went wrong while creating the PDF. Please try again.');
  } finally {
    stage.remove();
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
