# Biodata Creator

A small, self-contained vanilla JS app for putting together a biodata:
pick a template, fill in your details, add or delete whatever fields you
need, and download the result as a PDF.

## Running it

No build step and no server required — just open `index.html` in a
modern browser (Chrome, Edge, Firefox, Safari).

- **Internet connection needed once per session:** the app loads three
  small things from the internet the first time the page opens — two
  Google Fonts and the `html2pdf.js` library used for the PDF export
  button. Everything else runs fully offline.
- **Your data never leaves your device.** There's no backend — details
  and your uploaded photo are kept only in this browser's local storage
  on this machine, so the page remembers your work if you close and
  reopen it. Use "Reset everything" to clear it.

## Folder structure

```
biodata-creator/
├── index.html          Page structure
├── css/
│   └── style.css        All styling, including the 4 templates
├── js/
│   ├── templates.js      Template list + template-picker rendering
│   ├── pdf-export.js     PDF export (html2pdf.js) and print fallback
│   └── app.js            State, rendering, and all editing behaviour
├── assets/
│   └── ganesha.svg        Original decorative Ganesha emblem (header art)
└── README.md
```

## Using the app

1. **Choose a template** — Traditional, Modern, Royal, or Blush. You can
   switch anytime; your details carry over.
2. **Add a photo** (optional) — shown in the top-right corner of the sheet.
3. **Fill in your details** — organised into sections (Personal, Education
   & Career, Family, Contact, Additional Information).
   - Click into any label or value to edit it.
   - **+ Add field** adds a new row to a section.
   - **✕** next to a field deletes just that field; **✕** next to a
     section title deletes the whole section.
   - **+ Add a section** creates a new custom section.
   - Blank fields are automatically hidden from the preview and the PDF,
     so you don't have to delete fields you simply haven't filled in yet.
4. **Download PDF** generates a PDF of exactly what's shown in the
   preview. **Print** opens your browser's print dialog as a
   no-dependency alternative (choose "Save as PDF" as the destination).

## Customising further

- To change the default fields people start with, edit `defaultState()`
  in `js/app.js`.
- To add a 5th template, add an entry to the `TEMPLATES` array in
  `js/templates.js` and a matching `.template-yourid { ... }` block in
  `css/style.css` (copy one of the existing template blocks as a
  starting point — each one only needs to set a handful of CSS
  variables).
