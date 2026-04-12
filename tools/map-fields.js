/**
 * Auto-map form fields from a PDF using Claude vision.
 *
 * For each page in the PDF:
 *   1. Renders the page to a PNG at 150 DPI
 *   2. Sends the image to Claude with a prompt asking it to identify all
 *      form fields and return their coordinates
 *   3. Merges results into a single registry JSON file
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node tools/map-fields.js <input.pdf> <output.json>
 *
 * Example:
 *   node tools/map-fields.js pdf_files/SNAP_FORM_c_257599.pdf forms/snap-pa-fields.json
 */

import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/map-fields.js <input.pdf> <output.json>');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const client = new Anthropic();

// ── Render PDF pages to images via Ghostscript ───────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formless-'));
console.log(`Rendering pages → ${tmpDir}`);

// Render all pages at once: output files will be page-001.png, page-002.png, …
execSync(
  `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dTextAlphaBits=4 ` +
  `-sOutputFile="${path.join(tmpDir, 'page-%03d.png')}" "${path.resolve(inputPath)}"`,
  { stdio: 'pipe' }
);

function pageImagePath(i) {
  return path.join(tmpDir, `page-${String(i).padStart(3, '0')}.png`);
}

// Get page count from pdf-lib (lighter than loading all pages)
import { PDFDocument } from 'pdf-lib';
const pdfBytes = fs.readFileSync(inputPath);
const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
const pageCount = doc.getPageCount();
const { width: pdfWidth, height: pdfHeight } = doc.getPages()[0].getSize();

console.log(`${pageCount} pages, PDF size: ${pdfWidth}×${pdfHeight} pts`);

// ── Process each page ─────────────────────────────────────────────────────────

const allFields = [];
let pageNum = 1;

for (let i = 1; i <= pageCount; i++) {
  console.log(`\nPage ${i}/${pageCount} — rendering…`);
  const imagePath = pageImagePath(i);
  if (!fs.existsSync(imagePath)) {
    console.warn(`  Image not found for page ${i}, skipping`);
    continue;
  }
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');

  console.log(`  Sending to Claude vision…`);

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: `This is page ${i} of a US government assistance application PDF (${path.basename(inputPath)}).

The PDF page is ${pdfWidth} × ${pdfHeight} points (PDF coordinate space), rendered at 150 DPI.
The image is 1275 × 1650 pixels.

Scale factor: x_pdf = x_pixel × ${(pdfWidth / 1275).toFixed(4)}, y_pdf = (1650 - y_pixel) × ${(pdfHeight / 1650).toFixed(4)}
(PDF y=0 is at the BOTTOM of the page)

Identify every blank form field where an applicant would write information.
For each field, provide:
- A snake_case key describing what it collects (e.g. "applicant_first_name", "household_member_1_dob", "monthly_income_wages")
- The PDF coordinates (x, y in PDF points) of where to start writing text — aim for just inside the left edge of the blank, slightly above the baseline
- The page number: ${i}

Only include fields where information should be written. Skip labels, instructions, checkboxes you can't determine, and decorative lines.

Respond ONLY with a JSON array, no prose:
[
  { "key": "field_key", "page": ${i}, "x": 123, "y": 456, "description": "brief human label" },
  ...
]

If this page has no writable fields, return an empty array: []`,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].text.trim();

  // Extract JSON from the response (may be wrapped in ```json blocks)
  let fields;
  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ;
    fields = JSON.parse(match ? match[1] : raw);
  } catch {
    console.warn(`  Could not parse JSON for page ${i}:`, raw.slice(0, 200));
    fields = [];
  }

  console.log(`  Found ${fields.length} fields`);
  fields.forEach(f => console.log(`    ${f.key} → (${f.x}, ${f.y}) — ${f.description}`));

  allFields.push(...fields);
  pageNum++;
}

// ── Write registry ────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const registry = {
  source: path.basename(inputPath),
  pdfSize: { width: pdfWidth, height: pdfHeight },
  generatedAt: new Date().toISOString(),
  fields: allFields,
};

fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2));
console.log(`\nDone. Field map written to: ${outputPath}`);
console.log(`Total fields found: ${allFields.length}`);

// Cleanup temp images
fs.rmSync(tmpDir, { recursive: true });
