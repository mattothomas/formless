/**
 * Form registry — the single source of truth for every supported form.
 *
 * Two fill strategies are supported:
 *   - coordinate: draw text at {page, x, y} from a fieldsFile JSON (used by SNAP)
 *   - acroform:   fill AcroForm fields by ID using an acroFields map (used by Medicaid)
 *
 * Each entry's adapt() returns a flat { semantic_key: value } object.
 * For acroform forms, acroFields maps semantic_key → PDF field ID.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeFreq(freq = '') {
  const f = freq.toLowerCase();
  if (f.includes('bi') || f.includes('every 2')) return 'Bi-weekly';
  if (f.includes('week')) return 'Weekly';
  if (f.includes('month')) return 'Monthly';
  if (f.includes('annual') || f.includes('year')) return 'Yearly';
  return freq;
}

// ── SNAP Pennsylvania (Form C-257599) — coordinate-based ──────────────────────

const SNAP_PA = {
  id: 'snap-pa',
  name: 'Pennsylvania SNAP Application',
  programs: ['SNAP'],
  fillStrategy: 'coordinate',
  pdfFile: path.resolve(__dirname, '../pdf_files/SNAP_FORM_c_257599.pdf'),
  fieldsFile: path.resolve(__dirname, 'snap-pa-fields.json'),

  applies: (_data) => true,

  adapt(data) {
    const d = data || {};
    const members = d.householdMembers || [];
    const income  = d.monthlyIncome    || [];
    const flat    = {};

    flat.your_last_name    = d.lastName || '';
    flat.your_first_name   = d.firstName || '';
    flat.your_address      = d.address || '';
    flat.county            = d.county || '';
    flat.phone_number_home = d.phone || '';

    members.slice(0, 8).forEach((m, i) => {
      const n = i + 1;
      flat[`household_member_${n}_name`]         = m.name         || '';
      flat[`household_member_${n}_birthdate`]    = m.dob          || '';
      flat[`household_member_${n}_relationship`] = m.relationship || '';
    });

    income.slice(0, 5).forEach((inc, i) => {
      const n = i + 1;
      flat[`income_row${n}_person`]    = inc.person || d.firstName || '';
      flat[`income_row${n}_type`]      = inc.source    || '';
      flat[`income_row${n}_amount`]    = inc.amount    ? `$${inc.amount}` : '';
      flat[`income_row${n}_frequency`] = normalizeFreq(inc.frequency);
    });

    const exp = d.expenses || {};
    if (exp.rent)      flat.rent_amount              = `$${exp.rent}`;
    if (exp.mortgage)  flat.mortgage_amount          = `$${exp.mortgage}`;
    if (exp.utilities) flat.expenses_other           = `Utilities: $${exp.utilities}`;
    if (exp.childcare) flat.childcare_amount_per_month = `$${exp.childcare}`;

    return flat;
  },
};

// ── Medicaid Pennsylvania — AcroForm-based ─────────────────────────────────────

const MEDICAID_PA = {
  id: 'medicaid-pa',
  name: 'Pennsylvania Medicaid Financial Eligibility',
  programs: ['Medicaid'],
  fillStrategy: 'acroform',
  pdfFile: path.resolve(__dirname, '../pdf_files/Medicaid Financial Eligibility_form-1.pdf'),
  fieldsFile: null,

  // Semantic key → AcroForm field ID (from the fillable PDF)
  acroFields: {
    // Applicant info (page 2)
    applicant_name:   'text_259tdjd',
    current_address:  'text_365jdw',
    phone_number:     'text_368ejht',

    // Household members (page 3)
    member1_relationship: 'text_386nppv',
    member1_name:         'text_387aruf',
    member1_birth_date:   'text_388pjqx',

    member2_relationship: 'text_393cyct',
    member2_name:         'text_393trqp',
    member2_birth_date:   'text_393ajdh',

    member3_relationship: 'text_400fhjk',
    member3_name:         'text_400cbxw',
    member3_birth_date:   'text_400knwh',

    member4_relationship: 'text_407vjun',
    member4_name:         'text_407uee',
    member4_birth_date:   'text_407irbb',

    // Income rows (page 7) — whose, source, frequency, gross amount
    income_row1_whose:        'text_157gwwk',
    income_row1_source:       'text_152jxxf',
    income_row1_frequency:    'text_142uxvf',
    income_row1_gross_amount: 'text_132aovz',

    income_row2_whose:        'text_158rpug',
    income_row2_source:       'text_153thfm',
    income_row2_frequency:    'text_143mkfk',
    income_row2_gross_amount: 'text_133fzek',

    income_row3_whose:        'text_159bb',
    income_row3_source:       'text_154fduf',
    income_row3_frequency:    'text_144wgh',
    income_row3_gross_amount: 'text_134ecil',

    income_row4_whose:        'text_160qnlh',
    income_row4_source:       'text_155yans',
    income_row4_frequency:    'text_145mvfl',
    income_row4_gross_amount: 'text_135zahm',

    income_row5_whose:        'text_161tjar',
    income_row5_source:       'text_156jeuv',
    income_row5_frequency:    'text_146jvt',
    income_row5_gross_amount: 'text_136zoeh',

    // Shelter & utility expenses (page 7)
    shelter_rent:      'text_118kmle',
    shelter_telephone: 'text_125dqpv',
    shelter_gas:       'text_126emib',
    shelter_electric:  'text_127uggq',
    shelter_heating:   'text_128ikez',
    shelter_water:     'text_129lkxt',
    shelter_sewer:     'text_130nzvc',
    shelter_garbage:   'text_131dtoq',
  },

  applies: (data) => {
    const d = data || {};
    return !!(d.isPregnant || d.isPostpartum || d.isBreastfeeding || d.hasChildrenUnder5);
  },

  adapt(data) {
    const d = data || {};
    const members = d.householdMembers || [];
    const income  = d.monthlyIncome    || [];
    const exp     = d.expenses         || {};
    const flat    = {};

    // Applicant
    flat.applicant_name  = [d.firstName, d.lastName].filter(Boolean).join(' ');
    flat.current_address = d.address || '';
    flat.phone_number    = d.phone   || '';

    // Household members (up to 4)
    members.slice(0, 4).forEach((m, i) => {
      const n = i + 1;
      flat[`member${n}_name`]         = m.name         || '';
      flat[`member${n}_birth_date`]   = m.dob          || '';
      flat[`member${n}_relationship`] = m.relationship || '';
    });

    // Income rows (up to 5, one per source)
    income.slice(0, 5).forEach((inc, i) => {
      const n = i + 1;
      flat[`income_row${n}_whose`]        = inc.person || d.firstName || '';
      flat[`income_row${n}_source`]       = inc.source    || '';
      flat[`income_row${n}_frequency`]    = normalizeFreq(inc.frequency);
      flat[`income_row${n}_gross_amount`] = inc.amount ? `$${inc.amount}` : '';
    });

    // Shelter expenses
    if (exp.rent)      flat.shelter_rent     = `$${exp.rent}`;
    if (exp.utilities) flat.shelter_electric = `$${exp.utilities}`;

    return flat;
  },
};

// ── Registry export ───────────────────────────────────────────────────────────

export const FORMS = [SNAP_PA, MEDICAID_PA];

export function applicableForms(extractedData) {
  return FORMS.filter((f) => {
    if (f.fillStrategy === 'coordinate' && f.fieldsFile === null) return false;
    try { return f.applies(extractedData); } catch { return false; }
  });
}
