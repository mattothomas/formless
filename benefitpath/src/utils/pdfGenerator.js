// pdf-lib is loaded via CDN script tag in index.html → window.PDFLib

function getPdfLib() {
  if (!window.PDFLib) throw new Error('pdf-lib not loaded yet');
  return window.PDFLib;
}

export async function generateSnapPDF(extractedData) {
  const { PDFDocument, rgb, StandardFonts } = getPdfLib();

  const res = await fetch('/snap-template.pdf');
  if (!res.ok) throw new Error('Could not load SNAP template from /snap-template.pdf');

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages  = pdfDoc.getPages();
  const BLACK  = rgb(0, 0, 0);
  const d      = extractedData;
  const today  = new Date().toLocaleDateString('en-US');

  function draw(pageIndex, x, y, text, size = 9) {
    if (pageIndex >= pages.length || !text) return;
    pages[pageIndex].drawText(String(text), { x, y, size, font, color: BLACK });
  }

  // PAGE 1 — Applicant info
  draw(0, 72,  648, d.lastName  || '', 10);
  draw(0, 230, 648, d.firstName || '', 10);
  draw(0, 72,  620, d.address   || '', 10);
  draw(0, 72,  595, d.county    || '', 10);
  draw(0, 280, 595, d.phone     || '', 10);

  // Household members — 6 rows, 20pt apart
  const members = d.householdMembers || [];
  members.slice(0, 6).forEach((m, i) => {
    const y = 540 - i * 20;
    draw(0, 72,  y, m.name         || '', 9);
    draw(0, 220, y, m.relationship || '', 9);
    draw(0, 310, y, m.dob          || '', 9);
    draw(0, 440, y, m.usCitizen ? 'Y' : 'N', 9);
  });

  // PAGE 2 — Income
  const incomes = d.monthlyIncome || [];
  incomes.slice(0, 6).forEach((inc, i) => {
    const y = 680 - i * 20;
    draw(1, 72,  y, inc.source    || '', 9);
    draw(1, 350, y, inc.amount ? `$${inc.amount}` : '', 9);
    draw(1, 430, y, inc.frequency || '', 9);
  });

  // PAGE 3 — Expenses
  if (d.expenses) {
    draw(2, 150, 400, d.expenses.rent      ? `$${d.expenses.rent}`      : '', 9);
    draw(2, 150, 380, d.expenses.mortgage  ? `$${d.expenses.mortgage}`  : '', 9);
    draw(2, 150, 360, d.expenses.utilities ? `$${d.expenses.utilities}` : '', 9);
    draw(2, 150, 340, d.expenses.childcare ? `$${d.expenses.childcare}` : '', 9);
  }

  // Signature page (page 5, index 4)
  const sigPage = Math.min(4, pages.length - 1);
  const sigY    = pages.length > 4 ? 480 : 200;
  draw(sigPage, 72,  sigY, `${d.firstName || ''} ${d.lastName || ''}`.trim(), 10);
  draw(sigPage, 350, sigY, today, 10);

  return pdfDoc.save();
}

export function downloadPDF(bytes, filename = 'PA-SNAP-Application.pdf') {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
