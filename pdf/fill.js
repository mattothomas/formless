/**
 * fill.js
 *
 * Loads snap-template.pdf and overlays user data at the coordinates defined
 * in FIELD_MAP, producing a filled application PDF.
 *
 * As a module:
 *   const { fillSnapPdf } = require("./fill");
 *   await fillSnapPdf(data, "./output/filled.pdf");
 *
 * As a CLI (quick test):
 *   node fill.js                   ← uses built-in sample data
 *   node fill.js '{"full_name":"Jane Doe", ...}'
 *   node fill.js '{"full_name":"Jane Doe"}' ./output/my-app.pdf
 */

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs   = require("fs");
const path = require("path");

// ── Field coordinate map ──────────────────────────────────────────────────
// x/y mark the bottom-left corner of each input box (matches create-template.js).
// TEXT_PADDING offsets the text so it sits centered inside the box.
const TEXT_PADDING_X = 8;
const TEXT_PADDING_Y = 9; // visually centers 12pt text in a 30pt-tall box
const FONT_SIZE = 12;

const FIELD_MAP = [
  { key: "full_name",         x: 72, y: 620 },
  { key: "address",           x: 72, y: 555 },
  { key: "zip_code",          x: 72, y: 490 },
  { key: "dependents",        x: 72, y: 425 },
  { key: "monthly_income",    x: 72, y: 360 },
  { key: "employment_status", x: 72, y: 295 },
];

/**
 * Fill the SNAP template with the provided data.
 *
 * @param {Object} data       - Keys matching SNAP_FIELDS (missing keys are skipped).
 * @param {string} outputPath - Where to write the filled PDF.
 */
async function fillSnapPdf(data, outputPath) {
  const templatePath = path.join(__dirname, "snap-template.pdf");

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template not found at ${templatePath}. Run: node create-template.js`
    );
  }

  const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.getPages()[0];

  for (const field of FIELD_MAP) {
    const value = (data[field.key] ?? "").toString().trim();
    if (!value) continue;

    page.drawText(value, {
      x:    field.x + TEXT_PADDING_X,
      y:    field.y + TEXT_PADDING_Y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await pdfDoc.save());
  console.log("Filled PDF written to:", outputPath);
}

module.exports = { fillSnapPdf };

// ── CLI entry point ───────────────────────────────────────────────────────
if (require.main === module) {
  const SAMPLE_DATA = {
    full_name:         "Jane Doe",
    address:           "123 Maple Street, Springfield, IL",
    zip_code:          "62701",
    dependents:        "2",
    monthly_income:    "1,200",
    employment_status: "Part-time employed",
  };

  const rawArg    = process.argv[2];
  const data      = rawArg ? JSON.parse(rawArg) : SAMPLE_DATA;
  const outputArg = process.argv[3] ?? path.join(__dirname, "output", "filled-snap.pdf");

  fillSnapPdf(data, outputArg).catch((err) => {
    console.error("PDF generation failed:", err.message);
    process.exit(1);
  });
}
