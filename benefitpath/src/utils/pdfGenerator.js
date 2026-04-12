// pdf-lib is loaded via CDN script tag in index.html → window.PDFLib

function getPdfLib() {
  if (!window.PDFLib) throw new Error('pdf-lib not loaded yet');
  return window.PDFLib;
}

// ── SNAP — coordinate overlay (coordinates probed from SNAP_FORM_c_257599.pdf) ─

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

  // pageNum is 1-indexed (matching snap-pa-fields.json)
  function draw(pageNum, x, y, text, size = 9) {
    const idx = pageNum - 1;
    if (idx < 0 || idx >= pages.length || !text) return;
    pages[idx].drawText(String(text), { x, y, size, font, color: BLACK });
  }

  // PAGE 3 — Applicant info
  draw(3, 50,  580, d.lastName  || '', 10);
  draw(3, 310, 580, d.firstName || '', 10);
  draw(3, 50,  543, d.address   || '', 10);
  draw(3, 50,  505, d.county    || '', 10);
  draw(3, 195, 505, d.phone     || '', 10);

  // PAGE 3 — Household members (probed y positions)
  const members = d.householdMembers || [];
  const memberYs = [240, 215, 190, 164, 139, 114, 89, 64];
  members.slice(0, 8).forEach((m, i) => {
    const y = memberYs[i];
    draw(3, 35,  y, m.name         || '', 9);
    draw(3, 385, y, m.dob          || '', 9);
    draw(3, 475, y, m.relationship || '', 9);
  });

  // PAGE 3 — Applicant signature
  draw(3, 150, 42, `${d.firstName || ''} ${d.lastName || ''}`.trim(), 10);
  draw(3, 500, 42, today, 10);

  // PAGE 4 — Income
  const incomes = d.monthlyIncome || [];
  const incomeYs = [438, 412, 386, 358, 332];
  incomes.slice(0, 5).forEach((inc, i) => {
    const y = incomeYs[i];
    draw(4, 100, y, inc.person || d.firstName || '', 9);
    draw(4, 310, y, inc.source    || '', 9);
    draw(4, 430, y, inc.amount ? `$${inc.amount}` : '', 9);
    draw(4, 530, y, inc.frequency || '', 9);
  });

  // PAGE 5 — Expenses
  const exp = d.expenses || {};
  if (exp.rent)      draw(5, 120, 82,  `$${exp.rent}`,                  9);
  if (exp.mortgage)  draw(5, 145, 56,  `$${exp.mortgage}`,              9);
  if (exp.childcare) draw(5, 360, 155, `$${exp.childcare}`,             9);
  if (exp.utilities) draw(5, 370, 218, `Utilities: $${exp.utilities}`,  9);

  // PAGE 7 — Final signature
  draw(7, 120, 282, `${d.firstName || ''} ${d.lastName || ''}`.trim(), 10);
  draw(7, 390, 282, today, 10);

  return pdfDoc.save();
}

// ── Medicaid — AcroForm field filling ─────────────────────────────────────────

// Maps semantic keys → PDF AcroForm field IDs
const MEDICAID_ACRO = {
  // Applicant info (page 2)
  applicant_name:            'text_259tdjd',
  birth_date:                'text_359xmpw',
  marital_status:            'text_360qyd',
  separation_date:           'text_361nzys',
  spouse_death_date:         'text_362vjx',
  spouse_name:               'text_363uyia',
  race_other:                'text_364ngnc',
  current_address:           'text_365jdw',
  phone_number:              'text_368ejht',
  previous_address:          'text_366znec',
  township:                  'text_367de',
  school_district:           'text_369yzem',

  // Previous benefits & facilities (page 2)
  benefits_state:            'text_373mzzm',
  benefits_how_long:         'text_374svap',
  benefits_county:           'text_375oxyv',
  benefits_record_number:    'text_376jerm',
  nursing_facility_name:     'text_377mqfj',
  nursing_facility_address:  'text_378mgbg',
  nursing_facility_dates:    'text_379uolt',

  // Immigration (page 2)
  immigration_doc_type:      'text_380etjw',
  immigration_doc_id:        'text_381svcn',
  alien_number:              'text_382uxtl',
  country_of_origin:         'text_383szsh',
  sponsor_name_address:      'text_384iiog',

  // Household members (page 3)
  member1_relationship:      'text_386nppv',
  member1_name:              'text_387aruf',
  member1_birth_date:        'text_388pjqx',
  member2_relationship:      'text_393cyct',
  member2_name:              'text_393trqp',
  member2_birth_date:        'text_393ajdh',
  member3_relationship:      'text_400fhjk',
  member3_name:              'text_400cbxw',
  member3_birth_date:        'text_400knwh',
  member4_relationship:      'text_407vjun',
  member4_name:              'text_407uee',
  member4_birth_date:        'text_407irbb',

  // Military (page 3)
  military_branch:           'text_415sgbu',
  military_date_entered:     'text_416kawl',
  military_date_left:        'text_417kjhz',
  military_claim_no:         'text_418wyza',

  // Medical insurance — row 1 (page 4)
  insurance_1_covered:       'text_44vnav',
  insurance_1_company:       'text_45zaad',
  insurance_1_policy:        'text_46dymd',
  insurance_1_premium:       'text_56wxto',
  insurance_1_frequency:     'text_60mjrz',

  // Real estate — property 1 (page 4)
  real_estate_1_location:    'text_64fzvf',
  real_estate_1_owner:       'text_65ekxn',
  real_estate_1_value:       'text_66jljx',
  real_estate_1_who_lives:   'text_67dgae',
  real_estate_1_realtor:     'text_68taab',
  real_estate_1_date_listed: 'text_69aplz',

  // Mobile home (page 4)
  mobile_home_location:      'text_447scvt',
  mobile_home_owner:         'text_447ypgl',
  mobile_home_value:         'text_447mtri',
  mobile_home_year_model:    'text_447eoke',
  mobile_home_who_lives:     'text_463vacj',
  mobile_home_realtor:       'text_447npli',
  mobile_home_date_listed:   'text_447exvu',

  // Burial arrangements — account 1 (page 5)
  burial_1_owner:            'text_469awxb',
  burial_1_bank:             'text_470gxaa',
  burial_1_account:          'text_471jmts',
  burial_1_date:             'text_472qnbj',
  burial_spaces_count:       'text_473tdcl',
  burial_spaces_location:    'text_474rhwr',
  burial_1_value:            'text_475ywkl',
  burial_1_funeral_home:     'text_476qhqo',

  // Life insurance — row 1 (page 5)
  life_ins_1_owner:          'text_309dsic',
  life_ins_1_company:        'text_311vweu',
  life_ins_1_policy:         'text_312ywgc',
  life_ins_1_face_value:     'text_313zzvh',
  life_ins_1_cash_value:     'text_314iiox',
  life_ins_1_beneficiary:    'text_315qojs',

  // Vehicles — row 1 (page 5)
  vehicle_1_owner:           'text_262jwad',
  vehicle_1_year_make_model: 'text_263vdol',
  vehicle_1_plate:           'text_264tzvm',
  vehicle_1_amount_owed:     'text_265kwqu',
  vehicle_1_pct_owned:       'text_266yzma',
  vehicle_1_comments:        'text_267ekud',

  // Other resources / bank accounts — row 1 (page 6)
  resource_1_owner:          'text_211tqxs',
  resource_1_type:           'text_206mb',
  resource_1_value:          'text_209izkg',
  resource_1_bank:           'text_207gtac',
  resource_1_pct_owned:      'text_208ultz',
  resource_1_comments:       'text_210urir',

  // Transfers & expected income (page 6)
  transfer_type:             'text_199kfcw',
  transfer_market_value:     'text_464qypp',
  transfer_date:             'text_465cvae',
  transfer_explanation:      'textarea_204xpul',
  lump_sum_amount:           'text_466swqi',
  lump_sum_date:             'text_467tktd',
  lump_sum_explanation:      'textarea_173vaim',

  // Income rows (page 7)
  income_row1_whose:         'text_157gwwk',
  income_row1_source:        'text_152jxxf',
  income_row1_frequency:     'text_142uxvf',
  income_row1_gross_amount:  'text_132aovz',
  income_row2_whose:         'text_158rpug',
  income_row2_source:        'text_153thfm',
  income_row2_frequency:     'text_143mkfk',
  income_row2_gross_amount:  'text_133fzek',
  income_row3_whose:         'text_159bb',
  income_row3_source:        'text_154fduf',
  income_row3_frequency:     'text_144wgh',
  income_row3_gross_amount:  'text_134ecil',
  income_row4_whose:         'text_160qnlh',
  income_row4_source:        'text_155yans',
  income_row4_frequency:     'text_145mvfl',
  income_row4_gross_amount:  'text_135zahm',
  income_row5_whose:         'text_161tjar',
  income_row5_source:        'text_156jeuv',
  income_row5_frequency:     'text_146jvt',
  income_row5_gross_amount:  'text_136zoeh',

  // Shelter & utility expenses (page 7)
  shelter_rent:              'text_118kmle',
  shelter_telephone:         'text_125dqpv',
  shelter_gas:               'text_126emib',
  shelter_electric:          'text_127uggq',
  shelter_heating:           'text_128ikez',
  shelter_water:             'text_129lkxt',
  shelter_sewer:             'text_130nzvc',
  shelter_garbage:           'text_131dtoq',

  // Rep payee (page 7)
  rep_payee_name:            'text_167jvng',
  rep_payee_address:         'text_168dzaa',

  // Authorized representative (page 8)
  authorized_rep_name:       'text_106qgcb',
  authorized_rep_address:    'text_107sbfj',
  authorized_rep_phone:      'text_108mrvk',

  // Applicant signature (page 8)
  applicant_signature_date:  'text_109xuv',

  // Power of attorney (page 8)
  poa_name:                  'text_76usxc',
  poa_relationship:          'text_79bwsp',
  poa_address:               'text_77rjij',
  poa_city:                  'text_78ephy',
  poa_state:                 'text_82gpsd',
  poa_zip:                   'text_81zhqf',
  poa_phone:                 'text_80eufk',
};

function normalizeFreq(freq = '') {
  const f = freq.toLowerCase();
  if (f.includes('bi') || f.includes('every 2')) return 'Bi-weekly';
  if (f.includes('week')) return 'Weekly';
  if (f.includes('month')) return 'Monthly';
  if (f.includes('annual') || f.includes('year')) return 'Yearly';
  return freq;
}

function adaptForMedicaid(data) {
  const d       = data || {};
  const members = d.householdMembers || [];
  const income  = d.monthlyIncome    || [];
  const exp     = d.expenses         || {};
  const flat    = {};

  flat.applicant_name  = [d.firstName, d.lastName].filter(Boolean).join(' ');
  flat.birth_date      = d.dateOfBirth   || '';
  flat.marital_status  = d.maritalStatus || '';
  flat.current_address = d.address       || '';
  flat.phone_number    = d.phone         || '';

  members.slice(0, 4).forEach((m, i) => {
    const n = i + 1;
    flat[`member${n}_name`]         = m.name         || '';
    flat[`member${n}_birth_date`]   = m.dob          || '';
    flat[`member${n}_relationship`] = m.relationship || '';
  });

  income.slice(0, 5).forEach((inc, i) => {
    const n = i + 1;
    flat[`income_row${n}_whose`]        = inc.person || d.firstName || '';
    flat[`income_row${n}_source`]       = inc.source    || '';
    flat[`income_row${n}_frequency`]    = normalizeFreq(inc.frequency);
    flat[`income_row${n}_gross_amount`] = inc.amount ? `$${inc.amount}` : '';
  });

  if (exp.rent)      flat.shelter_rent     = `$${exp.rent}`;
  if (exp.utilities) flat.shelter_electric = `$${exp.utilities}`;
  if (exp.gas)       flat.shelter_gas      = `$${exp.gas}`;
  if (exp.heating)   flat.shelter_heating  = `$${exp.heating}`;

  flat.applicant_signature_date = new Date().toLocaleDateString('en-US');

  return flat;
}

export async function generateMedicaidPDF(extractedData) {
  const { PDFDocument } = getPdfLib();

  const res = await fetch('/medicaid-template.pdf');
  if (!res.ok) throw new Error('Could not load Medicaid template from /medicaid-template.pdf');

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form   = pdfDoc.getForm();
  const flat   = adaptForMedicaid(extractedData);

  for (const [semanticKey, acroId] of Object.entries(MEDICAID_ACRO)) {
    const value = (flat[semanticKey] ?? '').toString().trim();
    if (!value) continue;
    try {
      form.getTextField(acroId).setText(value);
    } catch {
      // Field may not exist in this version of the PDF — skip silently
    }
  }

  // Flatten so values are visible as plain text (not editable form fields)
  try { form.flatten(); } catch { /* ignore if already flat */ }

  return pdfDoc.save();
}

// ── Shared download helper ─────────────────────────────────────────────────────

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
