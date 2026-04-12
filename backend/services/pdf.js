/**
 * PDF fill service.
 *
 * Loads real government PDFs from pdf_files/, applies the field coordinate map
 * from forms/snap-pa-fields.json (and siblings), and draws the user's data at
 * the correct positions using pdf-lib.
 *
 * Entry points:
 *   generateForms(extractedData, outputDir)  → array of { formId, name, outputPath, filename }
 *   hasEnoughData(extractedData)             → boolean guard before generating
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applicableForms } from '../../forms/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_SIZE = 9; // Real government forms have tight fields — smaller than a blank template

/**
 * Fill a single form and write it to outputPath.
 */
async function fillForm(formDef, flatData, outputPath) {
  const pdfBytes = fs.readFileSync(formDef.pdfFile);
  const doc  = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  const fieldMap = JSON.parse(fs.readFileSync(formDef.fieldsFile, 'utf8')).fields;

  for (const field of fieldMap) {
    const value = (flatData[field.key] ?? '').toString().trim();
    if (!value) continue;

    // field.page is 1-indexed
    const page = pages[field.page - 1];
    if (!page) continue;

    const { width } = page.getSize();
    const x = Math.min(field.x, width - 10);
    const y = Math.max(field.y, 5);

    page.drawText(value, {
      x,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await doc.save());
}

/**
 * Generate filled PDFs for all forms that apply to this user.
 *
 * @param {object} extractedData   Gemini session extractedData (nested schema)
 * @param {string} outputDir       Directory to write the filled PDFs into
 * @returns {Promise<Array<{formId, name, outputPath, filename}>>}
 */
export async function generateForms(extractedData, outputDir) {
  const forms = applicableForms(extractedData);

  if (forms.length === 0) {
    throw new Error('No applicable forms found for this user\'s data.');
  }

  const results = [];

  for (const formDef of forms) {
    const flatData   = formDef.adapt(extractedData);
    const filename   = `${formDef.id}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);

    console.log(`Filling "${formDef.name}" → ${filename}`);
    await fillForm(formDef, flatData, outputPath);

    results.push({ formId: formDef.id, name: formDef.name, outputPath, filename });
  }

  return results;
}

/**
 * Check whether we have enough data to produce a meaningful filled form.
 * Gemini may set readyForResults: true while name is still null — guard here.
 */
export function hasEnoughData(extractedData) {
  const d = extractedData || {};
  return !!(d.firstName && d.monthlyIncome && d.monthlyIncome.length > 0);
}
