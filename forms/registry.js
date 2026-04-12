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

  // Complete AcroForm field ID map — every fillable text field on the form.
  // Keys are semantic names; values are the PDF field IDs from the fillable PDF.
  // The adapt() function only populates keys it has data for — the rest stay blank.
  acroFields: {
    // ── Applicant info (page 2) ───────────────────────────────────────────────
    applicant_name:          'text_259tdjd',
    birth_date:              'text_359xmpw',
    marital_status:          'text_360qyd',
    separation_date:         'text_361nzys',
    spouse_death_date:       'text_362vjx',
    spouse_name:             'text_363uyia',
    race_other:              'text_364ngnc',
    current_address:         'text_365jdw',
    phone_number:            'text_368ejht',
    previous_address:        'text_366znec',
    township:                'text_367de',
    school_district:         'text_369yzem',

    // ── Previous benefits & facilities (page 2) ───────────────────────────────
    benefits_state:          'text_373mzzm',
    benefits_how_long:       'text_374svap',
    benefits_county:         'text_375oxyv',
    benefits_record_number:  'text_376jerm',
    nursing_facility_name:   'text_377mqfj',
    nursing_facility_address:'text_378mgbg',
    nursing_facility_dates:  'text_379uolt',

    // ── Immigration (page 2) ──────────────────────────────────────────────────
    immigration_doc_type:    'text_380etjw',
    immigration_doc_id:      'text_381svcn',
    alien_number:            'text_382uxtl',
    country_of_origin:       'text_383szsh',
    sponsor_name_address:    'text_384iiog',

    // ── Household members (page 3) ────────────────────────────────────────────
    member1_relationship:    'text_386nppv',
    member1_name:            'text_387aruf',
    member1_birth_date:      'text_388pjqx',

    member2_relationship:    'text_393cyct',
    member2_name:            'text_393trqp',
    member2_birth_date:      'text_393ajdh',

    member3_relationship:    'text_400fhjk',
    member3_name:            'text_400cbxw',
    member3_birth_date:      'text_400knwh',

    member4_relationship:    'text_407vjun',
    member4_name:            'text_407uee',
    member4_birth_date:      'text_407irbb',

    // ── Military (page 3) ─────────────────────────────────────────────────────
    military_branch:         'text_415sgbu',
    military_date_entered:   'text_416kawl',
    military_date_left:      'text_417kjhz',
    military_claim_no:       'text_418wyza',

    // ── Medical insurance table — row 1 (page 4) ──────────────────────────────
    insurance_1_covered:     'text_44vnav',
    insurance_1_company:     'text_45zaad',
    insurance_1_policy:      'text_46dymd',
    insurance_1_premium:     'text_56wxto',
    insurance_1_frequency:   'text_60mjrz',

    // ── Real estate — property 1 (page 4) ────────────────────────────────────
    real_estate_1_location:  'text_64fzvf',
    real_estate_1_owner:     'text_65ekxn',
    real_estate_1_value:     'text_66jljx',
    real_estate_1_who_lives: 'text_67dgae',
    real_estate_1_realtor:   'text_68taab',
    real_estate_1_date_listed:'text_69aplz',

    // ── Mobile home (page 4) ──────────────────────────────────────────────────
    mobile_home_location:    'text_447scvt',
    mobile_home_owner:       'text_447ypgl',
    mobile_home_value:       'text_447mtri',
    mobile_home_year_model:  'text_447eoke',
    mobile_home_who_lives:   'text_463vacj',
    mobile_home_realtor:     'text_447npli',
    mobile_home_date_listed: 'text_447exvu',

    // ── Burial arrangements — account 1 (page 5) ──────────────────────────────
    burial_1_owner:          'text_469awxb',
    burial_1_bank:           'text_470gxaa',
    burial_1_account:        'text_471jmts',
    burial_1_date:           'text_472qnbj',
    burial_spaces_count:     'text_473tdcl',
    burial_spaces_location:  'text_474rhwr',
    burial_1_value:          'text_475ywkl',
    burial_1_funeral_home:   'text_476qhqo',

    // ── Life insurance table — row 1 (page 5) ────────────────────────────────
    life_ins_1_owner:        'text_309dsic',
    life_ins_1_company:      'text_311vweu',
    life_ins_1_policy:       'text_312ywgc',
    life_ins_1_face_value:   'text_313zzvh',
    life_ins_1_cash_value:   'text_314iiox',
    life_ins_1_beneficiary:  'text_315qojs',

    // ── Vehicles table — row 1 (page 5) ──────────────────────────────────────
    vehicle_1_owner:         'text_262jwad',
    vehicle_1_year_make_model:'text_263vdol',
    vehicle_1_plate:         'text_264tzvm',
    vehicle_1_amount_owed:   'text_265kwqu',
    vehicle_1_pct_owned:     'text_266yzma',
    vehicle_1_comments:      'text_267ekud',

    // ── Other resources / bank accounts — row 1 (page 6) ─────────────────────
    resource_1_owner:        'text_211tqxs',
    resource_1_type:         'text_206mb',
    resource_1_value:        'text_209izkg',
    resource_1_bank:         'text_207gtac',
    resource_1_pct_owned:    'text_208ultz',
    resource_1_comments:     'text_210urir',

    // ── Transfers & expected income (page 6) ──────────────────────────────────
    transfer_type:           'text_199kfcw',
    transfer_market_value:   'text_464qypp',
    transfer_date:           'text_465cvae',
    transfer_explanation:    'textarea_204xpul',
    lump_sum_amount:         'text_466swqi',
    lump_sum_date:           'text_467tktd',
    lump_sum_explanation:    'textarea_173vaim',

    // ── Income rows (page 7) — whose, source, frequency, gross amount ─────────
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

    // ── Rep payee (page 7) ────────────────────────────────────────────────────
    rep_payee_name:    'text_167jvng',
    rep_payee_address: 'text_168dzaa',

    // ── Authorized representative (page 8) ───────────────────────────────────
    authorized_rep_name:    'text_106qgcb',
    authorized_rep_address: 'text_107sbfj',
    authorized_rep_phone:   'text_108mrvk',

    // ── Applicant signature (page 8) ─────────────────────────────────────────
    applicant_signature_date: 'text_109xuv',

    // ── Power of attorney (page 8) ───────────────────────────────────────────
    poa_name:         'text_76usxc',
    poa_relationship: 'text_79bwsp',
    poa_address:      'text_77rjij',
    poa_city:         'text_78ephy',
    poa_state:        'text_82gpsd',
    poa_zip:          'text_81zhqf',
    poa_phone:        'text_80eufk',
  },

  // Medicaid applies broadly — income below ~138% FPL, or pregnant, elderly, disabled
  applies: (_data) => true,

  adapt(data) {
    const d = data || {};
    const members = d.householdMembers || [];
    const income  = d.monthlyIncome    || [];
    const exp     = d.expenses         || {};
    const flat    = {};

    // Applicant
    flat.applicant_name  = [d.firstName, d.lastName].filter(Boolean).join(' ');
    flat.birth_date      = d.dateOfBirth   || '';
    flat.marital_status  = d.maritalStatus || '';
    flat.current_address = d.address       || '';
    flat.phone_number    = d.phone         || '';

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
    if (exp.gas)       flat.shelter_gas      = `$${exp.gas}`;
    if (exp.heating)   flat.shelter_heating  = `$${exp.heating}`;

    // Signature date (auto-filled)
    flat.applicant_signature_date = new Date().toLocaleDateString('en-US');

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
