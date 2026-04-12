/**
 * Coordinate probe tool.
 *
 * Stamps a grid of numbered dots across every page of a PDF so you can
 * open the output, find which dot sits closest to each blank field, and
 * record those coordinates in the form registry.
 *
 * Usage:
 *   node tools/probe-coordinates.js <input.pdf> <output.pdf>
 *
 * Example:
 *   node tools/probe-coordinates.js pdf_files/SNAP_FORM_c_257599.pdf tools/snap-probed.pdf
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/probe-coordinates.js <input.pdf> <output.pdf>');
  process.exit(1);
}

const bytes = fs.readFileSync(inputPath);
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const font = await doc.embedFont(StandardFonts.HelveticaBold);

const pages = doc.getPages();

for (let pi = 0; pi < pages.length; pi++) {
  const page = pages[pi];
  const { width, height } = page.getSize();

  // Grid: every 50 pts in x, every 40 pts in y
  const stepX = 50;
  const stepY = 40;

  for (let x = stepX; x < width; x += stepX) {
    for (let y = stepY; y < height; y += stepY) {
      const label = `${x},${y}`;

      // Dot
      page.drawCircle({ x, y, size: 2, color: rgb(1, 0, 0) });

      // Label (small, above the dot)
      page.drawText(label, {
        x: x + 3,
        y: y + 2,
        size: 5,
        font,
        color: rgb(0.8, 0, 0),
      });
    }
  }

  // Page number banner
  page.drawText(`— Page ${pi + 1} of ${pages.length} — ${path.basename(inputPath)}`, {
    x: 36,
    y: height - 20,
    size: 8,
    font,
    color: rgb(0, 0, 0.8),
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, await doc.save());
console.log(`Written: ${outputPath}`);
console.log(`Open it, find where each blank field is, and note the nearest x,y label.`);
