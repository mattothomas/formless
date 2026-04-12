/**
 * PDF generation service.
 *
 * Adapts Gemini's rich nested extractedData schema into the flat field map
 * that the SNAP template expects, then overlays text onto snap-template.pdf
 * using pdf-lib.
 *
 * The template lives at pdf/snap-template.pdf (created by pdf/create-template.js).
 * Run `cd ../pdf && node create-template.js` once if it doesn't exist yet.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../pdf/snap-template.pdf');

// Matches the coordinate map in pdf/fill.js exactly
const FIELD_MAP = [
  { key: 'full_name',         x: 72, y: 620 },
  { key: 'address',           x: 72, y: 555 },
  { key: 'zip_code',          x: 72, y: 490 },
  { key: 'dependents',        x: 72, y: 425 },
  { key: 'monthly_income',    x: 72, y: 360 },
  { key: 'employment_status', x: 72, y: 295 },
];

const TEXT_PADDING_X = 8;
const TEXT_PADDING_Y = 9;
const FONT_SIZE = 12;

// ── Schema adapter ──────────────────────────────────────────────────────────

function extractZip(address) {
  if (!address) return '';
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : '';
}

function deriveEmploymentStatus(monthlyIncome = []) {
  const sources = monthlyIncome.map((i) => (i.source || '').toLowerCase()).join(' ');
  if (!sources) return 'Unknown';
  if (sources.includes('unemploy')) return 'Unemployed';
  if (sources.includes('job') || sources.includes('wage') || sources.includes('employ') ||
      sources.includes('work') || sources.includes('salary')) return 'Employed';
  if (sources.includes('ssi') || sources.includes('disability')) return 'Receiving SSI/Disability';
  if (sources.includes('child support')) return 'Not employed (child support)';
  return 'Other';
}

function toFlatSchema(extractedData) {
  const d = extractedData;

  const firstName = d.firstName || '';
  const lastName  = d.lastName  || '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || '';

  const dependents = String((d.householdMembers || []).length);

  const totalMonthly = (d.monthlyIncome || []).reduce((sum, inc) => {
    const amt  = parseFloat(inc.amount) || 0;
    const freq = (inc.frequency || '').toLowerCase();
    if (freq === 'weekly')               return sum + amt * 4.33;
    if (freq === 'bi-weekly' || freq === 'biweekly') return sum + amt * 2.17;
    if (freq === 'annual' || freq === 'yearly')      return sum + amt / 12;
    return sum + amt; // assume monthly
  }, 0);

  return {
    full_name:         fullName,
    address:           d.address || '',
    zip_code:          extractZip(d.address),
    dependents,
    monthly_income:    totalMonthly > 0 ? `$${Math.round(totalMonthly).toLocaleString()}` : '',
    employment_status: deriveEmploymentStatus(d.monthlyIncome),
  };
}

// ── PDF writer ──────────────────────────────────────────────────────────────

/**
 * Generate a filled SNAP PDF from a Gemini extractedData object.
 *
 * @param {object} extractedData   The Gemini session extractedData (nested)
 * @param {string} outputPath      Full path where the PDF should be written
 * @returns {Promise<void>}
 */
export async function generateSnapPdf(extractedData, outputPath) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `SNAP template not found at ${TEMPLATE_PATH}. Run: cd pdf && node create-template.js`
    );
  }

  const flatData = toFlatSchema(extractedData);

  const pdfDoc = await PDFDocument.load(fs.readFileSync(TEMPLATE_PATH));
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.getPages()[0];

  for (const field of FIELD_MAP) {
    const value = (flatData[field.key] ?? '').toString().trim();
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
}

/**
 * Check whether we have the minimum data needed to generate a meaningful PDF.
 * Gemini may set readyForResults: true while name is still null — guard here.
 */
export function hasEnoughData(extractedData) {
  const d = extractedData;
  return !!(d.firstName && d.monthlyIncome && d.monthlyIncome.length > 0);
}
