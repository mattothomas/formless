/**
 * PDF fill service.
 *
 * Supports two fill strategies:
 *   - coordinate: draws text at {page, x, y} from a fieldsFile JSON (SNAP)
 *   - acroform:   fills AcroForm fields by ID from formDef.acroFields map (Medicaid)
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
const FONT_SIZE = 9;

// ── Fill strategies ────────────────────────────────────────────────────────────

async function fillByCoordinates(formDef, flatData, outputPath) {
  const doc   = await PDFDocument.load(fs.readFileSync(formDef.pdfFile), { ignoreEncryption: true });
  const font  = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const fieldMap = JSON.parse(fs.readFileSync(formDef.fieldsFile, 'utf8')).fields;

  for (const field of fieldMap) {
    const value = (flatData[field.key] ?? '').toString().trim();
    if (!value) continue;
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width } = page.getSize();
    page.drawText(value, {
      x: Math.min(field.x, width - 10),
      y: Math.max(field.y, 5),
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await doc.save());
}

async function fillByAcroForm(formDef, flatData, outputPath) {
  const doc  = await PDFDocument.load(fs.readFileSync(formDef.pdfFile), { ignoreEncryption: true });
  const form = doc.getForm();

  for (const [semanticKey, acroId] of Object.entries(formDef.acroFields)) {
    const value = (flatData[semanticKey] ?? '').toString().trim();
    if (!value) continue;
    try {
      const field = form.getTextField(acroId);
      field.setText(value);
    } catch (e) {
      console.warn(`  Could not fill field "${acroId}" (${semanticKey}): ${e.message}`);
    }
  }

  // Flatten so values are baked in and not editable (optional — remove if you want editable output)
  form.flatten();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await doc.save());
}

// ── Public API ─────────────────────────────────────────────────────────────────

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

    console.log(`Filling "${formDef.name}" (${formDef.fillStrategy}) → ${filename}`);

    if (formDef.fillStrategy === 'acroform') {
      await fillByAcroForm(formDef, flatData, outputPath);
    } else {
      await fillByCoordinates(formDef, flatData, outputPath);
    }

    results.push({ formId: formDef.id, name: formDef.name, outputPath, filename });
  }

  return results;
}

export function hasEnoughData(extractedData) {
  const d = extractedData || {};
  return !!(d.firstName && d.monthlyIncome && d.monthlyIncome.length > 0);
}
