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

  // PAGE 3 — Household members
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

// Maps semantic keys → PDF AcroForm text field IDs.
// Source: visual inspection of medicaid-template.pdf (479 AcroForm fields),
// cross-referenced with field sequence analysis in forms/medicaid-field-mapping.json.
const MEDICAID_ACRO = {
  // ── Applicant info (page 2) ───────────────────────────────────────────────
  applicant_name:            'text_259tdjd',
  birth_date:                'text_359xmpw',
  marital_status:            'text_360qyd',   // text backup; checkboxes also filled
  separation_date:           'text_361nzys',
  spouse_death_date:         'text_362vjx',
  spouse_name:               'text_363uyia',
  race_other:                'text_364nqnc',  // NOTE: registry had typo 'text_364ngnc'
  current_address:           'text_365jdw',
  previous_address:          'text_366znec',
  township:                  'text_367de',
  phone_number:              'text_368ejht',
  school_district:           'text_369yzem',
  date_moved_to_address:     'text_370lrjm',  // confidence 0.85

  // ── Previous benefits & facilities (page 2) ───────────────────────────────
  benefits_state:            'text_373mzzm',
  benefits_how_long:         'text_374svap',
  benefits_county:           'text_375oxyv',
  benefits_record_number:    'text_376jerm',
  nursing_facility_name:     'text_377mqfj',
  nursing_facility_address:  'text_378mgbg',
  nursing_facility_dates:    'text_379uolt',

  // ── Immigration (page 2) ──────────────────────────────────────────────────
  immigration_doc_type:      'text_380etjw',
  immigration_doc_id:        'text_381svcn',
  alien_number:              'text_382uxtl',
  country_of_origin:         'text_383szsh',
  sponsor_name_address:      'text_384iiog',

  // ── Household members (page 3) — relationship/name/dob confirmed ──────────
  member1_relationship:      'text_386nppv',
  member1_name:              'text_387aruf',
  member1_birth_date:        'text_388pjqx',
  member1_alias:             'text_389shuo',
  member1_sex_text:          'text_390mqvz',
  member1_race_code:         'text_391ljay',
  member1_ssn:               'text_392zkzq',

  member2_relationship:      'text_393cyct',
  member2_name:              'text_393trqp',
  member2_birth_date:        'text_393ajdh',
  member2_alias:             'text_393gep',
  member2_sex_text:          'text_393govi',
  member2_race_code:         'text_393gpwp',
  member2_ssn:               'text_393fysk',

  member3_relationship:      'text_400fhjk',
  member3_name:              'text_400cbxw',
  member3_birth_date:        'text_400knwh',
  member3_alias:             'text_400ynsa',
  member3_sex_text:          'text_400mejj',
  member3_race_code:         'text_400njsz',
  member3_ssn:               'text_400qovr',

  member4_relationship:      'text_407vjun',
  member4_name:              'text_407uee',
  member4_birth_date:        'text_407irbb',
  member4_alias:             'text_407ohoi',
  member4_sex_text:          'text_407rzjm',
  member4_race_code:         'text_407opyr',
  member4_ssn:               'text_407iex',

  // ── Military (page 3) ─────────────────────────────────────────────────────
  military_branch:           'text_415sgbu',
  military_date_entered:     'text_416kawl',
  military_date_left:        'text_417kjhz',
  military_claim_no:         'text_418wyza',

  // ── Medical insurance table rows 1–4 (page 4) ────────────────────────────
  insurance_1_covered:       'text_44vnav',
  insurance_1_company:       'text_45zaad',
  insurance_1_policy:        'text_46dymd',
  insurance_1_premium:       'text_56wxto',
  insurance_1_frequency:     'text_60mjrz',

  insurance_2_covered:       'text_47rujx',
  insurance_2_company:       'text_48fftk',
  insurance_2_policy:        'text_49smr',
  insurance_2_premium:       'text_57xgcv',
  insurance_2_frequency:     'text_61bpsi',

  insurance_3_covered:       'text_50nazp',
  insurance_3_company:       'text_51dyoj',
  insurance_3_policy:        'text_52ythl',
  insurance_3_premium:       'text_58ojhp',
  insurance_3_frequency:     'text_62tphq',

  insurance_4_covered:       'text_53zfip',
  insurance_4_company:       'text_54zvht',
  insurance_4_policy:        'text_55curn',
  insurance_4_premium:       'text_59axeh',
  insurance_4_frequency:     'text_63ecfg',

  // ── Real estate — property 1 (page 4) ────────────────────────────────────
  real_estate_1_location:    'text_64fzvf',
  real_estate_1_owner:       'text_65ekxn',
  real_estate_1_value:       'text_66jljx',
  real_estate_1_who_lives:   'text_67dgae',
  real_estate_1_realtor:     'text_68taab',
  real_estate_1_date_listed: 'text_69aplz',

  // ── Mobile home (page 4) ──────────────────────────────────────────────────
  mobile_home_location:      'text_447scvt',
  mobile_home_owner:         'text_447ypgl',
  mobile_home_value:         'text_447mtri',
  mobile_home_year_model:    'text_447eoke',
  mobile_home_who_lives:     'text_463vacj',
  mobile_home_realtor:       'text_447npli',
  mobile_home_date_listed:   'text_447exvu',

  // ── Burial arrangements — account 1 (page 5) ──────────────────────────────
  burial_1_owner:            'text_469awxb',
  burial_1_bank:             'text_470gxaa',
  burial_1_account:          'text_471jmts',
  burial_1_date:             'text_472qnbj',
  burial_spaces_count:       'text_473tdcl',
  burial_spaces_location:    'text_474rhwr',
  burial_1_value:            'text_475ywkl',
  burial_1_funeral_home:     'text_476qhqo',

  // ── Life insurance — row 1 (page 5) ──────────────────────────────────────
  life_ins_1_owner:          'text_309dsic',
  life_ins_1_company:        'text_311vweu',
  life_ins_1_policy:         'text_312ywgc',
  life_ins_1_face_value:     'text_313zzvh',
  life_ins_1_cash_value:     'text_314iiox',
  life_ins_1_beneficiary:    'text_315qojs',

  // ── Vehicles — row 1 (page 5) ────────────────────────────────────────────
  vehicle_1_owner:           'text_262jwad',
  vehicle_1_year_make_model: 'text_263vdol',
  vehicle_1_plate:           'text_264tzvm',
  vehicle_1_amount_owed:     'text_265kwqu',
  vehicle_1_pct_owned:       'text_266yzma',
  vehicle_1_comments:        'text_267ekud',

  // ── Other resources / bank accounts — row 1 (page 6) ─────────────────────
  resource_1_owner:          'text_211tqxs',
  resource_1_type:           'text_206mb',
  resource_1_value:          'text_209izkg',
  resource_1_bank:           'text_207gtac',
  resource_1_pct_owned:      'text_208ultz',
  resource_1_comments:       'text_210urir',

  // ── Transfers & expected income (page 6) ──────────────────────────────────
  transfer_type:             'text_199kfcw',
  transfer_market_value:     'text_464qypp',
  transfer_date:             'text_465cvae',
  transfer_explanation:      'textarea_204xpul',
  lump_sum_amount:           'text_466swqi',
  lump_sum_date:             'text_467tktd',
  lump_sum_explanation:      'textarea_173vaim',

  // ── Income rows (page 7) ─────────────────────────────────────────────────
  // Columns: whose | type | source | frequency | hours/wk | gross | comments
  income_row1_whose:         'text_157gwwk',
  income_row1_type:          'text_162uhnr',
  income_row1_source:        'text_152jxxf',
  income_row1_frequency:     'text_142uxvf',
  income_row1_hours:         'text_147bfds',
  income_row1_gross_amount:  'text_132aovz',
  income_row1_comments:      'text_137xwwh',

  income_row2_whose:         'text_158rpug',
  income_row2_type:          'text_163bwvg',
  income_row2_source:        'text_153thfm',
  income_row2_frequency:     'text_143mkfk',
  income_row2_hours:         'text_148mwpa',
  income_row2_gross_amount:  'text_133fzek',
  income_row2_comments:      'text_138geme',

  income_row3_whose:         'text_159bb',
  income_row3_type:          'text_164mgmm',
  income_row3_source:        'text_154fduf',
  income_row3_frequency:     'text_144wgh',
  income_row3_hours:         'text_149mfaf',
  income_row3_gross_amount:  'text_134ecil',
  income_row3_comments:      'text_139gszt',

  income_row4_whose:         'text_160qnlh',
  income_row4_type:          'text_165wk',
  income_row4_source:        'text_155yans',
  income_row4_frequency:     'text_145mvfl',
  income_row4_hours:         'text_150tdlx',
  income_row4_gross_amount:  'text_135zahm',
  income_row4_comments:      'text_140sejs',

  income_row5_whose:         'text_161tjar',
  income_row5_type:          'text_166jwwm',
  income_row5_source:        'text_156jeuv',
  income_row5_frequency:     'text_146jvt',
  income_row5_hours:         'text_151mamk',
  income_row5_gross_amount:  'text_136zoeh',
  income_row5_comments:      'text_141arur',

  // ── Shelter & utility expenses (page 7) — all 14 line items ──────────────
  shelter_rent:                  'text_118kmle',
  shelter_sales_lease:           'text_119efos',
  shelter_personal_care:         'text_120iyzu',
  shelter_condo_maintenance:     'text_121xlql',
  shelter_lot_rent:              'text_122sutw',
  shelter_property_taxes:        'text_123sqxc',
  shelter_homeowners_insurance:  'text_124foqw',
  shelter_telephone:             'text_125dqpv',  // monthly bill amount — NOT phone number
  shelter_gas:                   'text_126emib',
  shelter_electric:              'text_127uggq',
  shelter_heating:               'text_128ikez',
  shelter_water:                 'text_129lkxt',
  shelter_sewer:                 'text_130nzvc',
  shelter_garbage:               'text_131dtoq',

  // ── Rep payee (page 7) ────────────────────────────────────────────────────
  rep_payee_name:            'text_167jvng',
  rep_payee_address:         'text_168dzaa',

  // ── Authorized representative (page 8) ───────────────────────────────────
  authorized_rep_name:       'text_106qgcb',
  authorized_rep_address:    'text_107sbfj',
  authorized_rep_phone:      'text_108mrvk',

  // ── Applicant signature date (page 8) ─────────────────────────────────────
  applicant_signature_date:  'text_109xuv',

  // ── Power of attorney (page 8) ───────────────────────────────────────────
  poa_name:                  'text_76usxc',
  poa_relationship:          'text_79bwsp',
  poa_address:               'text_77rjij',
  poa_city:                  'text_78ephy',
  poa_state:                 'text_82gpsd',
  poa_zip:                   'text_81zhqf',
  poa_phone:                 'text_80eufk',
};

// Checkbox field IDs derived from AcroForm field sequence analysis + page images.
// Confidence noted per group. All fills are wrapped in try/catch in generateMedicaidPDF.
// Sequence source: benefitpath/public/medicaid-template_inspection/fields.json
const MEDICAID_CHECKBOX_IDS = {
  // Page 2 — language preference (confidence: 0.92)
  lang_english:  'checkbox_6ksza',
  lang_spanish:  'checkbox_7lvoj',
  lang_other:    'checkbox_8urpd',

  // Page 2 — interpreter needed (confidence: 0.92)
  interp_yes:    'checkbox_9zgsn',
  interp_no:     'checkbox_10vtxm',

  // Page 2 — applicant sex (confidence: 0.92)
  sex_male:      'checkbox_11wjqm',
  sex_female:    'checkbox_12crqm',

  // Page 2 — marital status (confidence: 0.92)
  marital_single:    'checkbox_13oobf',
  marital_separated: 'checkbox_14vliy',
  marital_married:   'checkbox_15rizs',
  marital_divorced:  'checkbox_16qgny',
  marital_widowed:   'checkbox_17tlpj',

  // Page 2 — race / optional (confidence: 0.90)
  race_black:           'checkbox_18cpwp',
  race_asian:           'checkbox_19clfx',
  race_native_hawaiian: 'checkbox_20fwme',
  race_american_indian: 'checkbox_21gysx',
  race_white:           'checkbox_22jigk',
  race_other:           'checkbox_23nowj',

  // Page 2 — previous benefits (confidence: 0.90)
  prev_benefits_yes: 'checkbox_24svxk',
  prev_benefits_no:  'checkbox_25ynr',

  // Page 2 — nursing facility (confidence: 0.90)
  nursing_yes: 'checkbox_26okpw',
  nursing_no:  'checkbox_27fopp',

  // Page 2 — US citizenship (confidence: 0.90)
  citizen_yes: 'checkbox_28ynbl',
  citizen_no:  'checkbox_29rrks',

  // Page 2 — eligible immigration status (confidence: 0.88)
  immigration_yes: 'checkbox_30gfuc',
  immigration_no:  'checkbox_31wbzw',

  // Page 2 — US residency before 1996 (confidence: 0.88)
  us_1996_yes: 'checkbox_32ubmd',
  us_1996_no:  'checkbox_33ddya',

  // Page 3 — military status (confidence: 0.85)
  mil_veteran:        'checkbox_34cmuj',
  mil_active:         'checkbox_35lyxn',
  mil_national_guard: 'checkbox_36dnoa',
  mil_reserves:       'checkbox_37jjpk',
  mil_widow:          'checkbox_38dkg',

  // Page 3/4 boundary — unpaid medical bills (confidence: 0.80)
  unpaid_bills_yes: 'checkbox_42ucjm',
  unpaid_bills_no:  'checkbox_43zirr',

  // Page 4 — mobile home None (confidence: 0.95 — confirmed from field prefix)
  mobile_home_none: 'checkbox_447kcai',

  // Page 4 — mobile home checkboxes (confidence: 0.90)
  mobile_income_producing_yes: 'checkbox_447qnpw',
  mobile_income_producing_no:  'checkbox_447jpks',
  mobile_resident_yes:         'checkbox_447stiu',
  mobile_resident_no:          'checkbox_447khoj',
  mobile_listed_sale_yes:      'checkbox_447zmsx',
  mobile_listed_sale_no:       'checkbox_447qkqt',

  // Page 4 — real estate None (confidence: 0.75)
  real_estate_none: 'checkbox_430jmfr',

  // Page 5 — vehicles None (confidence: 0.75)
  vehicles_none: 'checkbox_260anqa',

  // Page 6 — transfers within 60 months (confidence: 0.92)
  transferred_assets_yes:  'checkbox_200hhoa',
  transferred_assets_no:   'checkbox_201jxfq',
  transferred_trust_yes:   'checkbox_202lilt',
  transferred_trust_no:    'checkbox_203sjgr',

  // Page 7 — expected lump sum (confidence: 0.90)
  lump_sum_yes: 'checkbox_169xdpv',
  lump_sum_no:  'checkbox_170yojk',

  // Page 7 — heating/AC separate from rent (confidence: 0.90)
  heating_separate_yes: 'checkbox_116aklt',
  heating_separate_no:  'checkbox_117bbos',

  // Page 8/9 — renewal period (confidence: 0.90)
  renewal_5yr:        'checkbox_110tmrx',
  renewal_4yr:        'checkbox_111tbjf',
  renewal_3yr:        'checkbox_112yshk',
  renewal_2yr:        'checkbox_113iub',
  renewal_1yr:        'checkbox_114bznf',
  renewal_no_tax:     'checkbox_115ivaz',

  // Page 10 — POA type (confidence: 0.80)
  poa_representative: 'checkbox_83kqbu',
  poa_power_of_atty:  'checkbox_84euej',
};

function normalizeFreq(freq = '') {
  const f = freq.toLowerCase();
  if (f.includes('bi') || f.includes('every 2')) return 'Bi-weekly';
  if (f.includes('week')) return 'Weekly';
  if (f.includes('month')) return 'Monthly';
  if (f.includes('annual') || f.includes('year')) return 'Yearly';
  return freq;
}

function classifyIncomeType(source = '') {
  const s = source.toLowerCase();
  if (s.includes('wage') || s.includes('salary') || s.includes('employ') ||
      s.includes('job') || s.includes('work') || s.includes('self-employ') ||
      s.includes('commission') || s.includes('tips')) return 'Earned';
  return 'Unearned';
}

function adaptForMedicaid(data) {
  const d       = data || {};
  const members = d.householdMembers || [];
  const income  = d.monthlyIncome    || [];
  const exp     = d.expenses         || {};
  const ins     = d.medicalInsurance || [];
  const flat    = {};
  const today   = new Date().toLocaleDateString('en-US');
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Applicant';

  const county = d.county || (d.address || '').split(',').slice(-2, -1)[0]?.trim() || '';
  const city   = (d.address || '').split(',')[1]?.trim() || county;
  const zip    = (d.address || '').match(/\d{5}/)?.[0] || '';

  // ── Applicant info ─────────────────────────────────────────────────────────
  flat.applicant_name      = fullName;
  flat.birth_date          = d.dateOfBirth || '';
  flat.marital_status      = d.maritalStatus || '';
  flat.current_address     = d.address || '';
  flat.phone_number        = d.phone || '';
  flat.township            = city;
  flat.school_district     = county ? `${county} School District` : '';
  flat.previous_address    = d.previousAddress || d.address || '';
  if (d.dateMovedToAddress) flat.date_moved_to_address = d.dateMovedToAddress;

  if (d.maritalStatus === 'separated')  flat.separation_date    = d.separationDate    || '';
  if (d.maritalStatus === 'widowed')    flat.spouse_death_date  = d.spouseDeathDate   || '';
  if (['married','separated','widowed'].includes(d.maritalStatus)) {
    flat.spouse_name = d.spouseName || '';
  }

  // ── Citizenship — only populate immigration fields for non-citizens ─────────
  const isUsCitizen = d.isUsCitizen !== false; // default true
  if (!isUsCitizen) {
    flat.country_of_origin     = d.countryOfOrigin      || '';
    flat.immigration_doc_type  = d.immigrationDocType   || '';
    flat.immigration_doc_id    = d.immigrationDocId     || '';
    flat.alien_number          = d.alienNumber          || '';
    flat.sponsor_name_address  = d.sponsorNameAddress   || '';
  }

  // ── Previous benefits ──────────────────────────────────────────────────────
  if (d.hadPreviousBenefits) {
    flat.benefits_state         = d.previousBenefitsState    || '';
    flat.benefits_how_long      = d.previousBenefitsDuration || '';
    flat.benefits_county        = d.previousBenefitsCounty   || '';
    flat.benefits_record_number = d.previousBenefitsRecord   || '';
  }

  // ── Nursing facility ───────────────────────────────────────────────────────
  if (d.hadNursingFacilityStay) {
    flat.nursing_facility_name    = d.nursingFacilityName    || '';
    flat.nursing_facility_address = d.nursingFacilityAddress || '';
    flat.nursing_facility_dates   = d.nursingFacilityDates   || '';
  }

  // ── Military ──────────────────────────────────────────────────────────────
  if (d.hasMilitaryService) {
    flat.military_branch       = d.militaryBranch      || '';
    flat.military_date_entered = d.militaryDateEntered || '';
    flat.military_date_left    = d.militaryDateLeft    || '';
    flat.military_claim_no     = d.militaryClaimNo     || '';
  }

  // ── Household members ──────────────────────────────────────────────────────
  members.slice(0, 4).forEach((m, i) => {
    const n = i + 1;
    flat[`member${n}_name`]         = m.name         || '';
    flat[`member${n}_birth_date`]   = m.dob          || '';
    flat[`member${n}_relationship`] = m.relationship || '';
    if (m.aliasMaidenName) flat[`member${n}_alias`]      = m.aliasMaidenName;
    if (m.sex)             flat[`member${n}_sex_text`]   = m.sex === 'male' ? 'M' : 'F';
    if (m.ssn)             flat[`member${n}_ssn`]        = m.ssn;
  });

  // ── Medical insurance ──────────────────────────────────────────────────────
  if (d.hasHealthInsurance === false || ins.length === 0) {
    // Confirmed uninsured — leave rows blank (reviewer sees empty = not covered)
  } else if (ins.length > 0) {
    ins.slice(0, 4).forEach((policy, i) => {
      const n = i + 1;
      flat[`insurance_${n}_covered`]   = policy.coveredPerson  || fullName;
      flat[`insurance_${n}_company`]   = policy.company        || '';
      flat[`insurance_${n}_policy`]    = policy.policyNumber   || '';
      flat[`insurance_${n}_premium`]   = policy.premiumAmount  ? `$${policy.premiumAmount}` : '';
      flat[`insurance_${n}_frequency`] = normalizeFreq(policy.premiumFrequency || '');
    });
  } else {
    // Unknown — note that applicant may or may not have insurance
    flat.insurance_1_covered   = fullName;
    flat.insurance_1_company   = 'See attached — verification required';
    flat.insurance_1_policy    = '';
    flat.insurance_1_premium   = '';
    flat.insurance_1_frequency = '';
  }

  // ── Real estate ────────────────────────────────────────────────────────────
  if (d.ownsRealEstate && d.realEstate && d.realEstate.length > 0) {
    const re = d.realEstate[0];
    flat.real_estate_1_location   = re.location      || '';
    flat.real_estate_1_owner      = re.owner         || fullName;
    flat.real_estate_1_value      = re.estimatedValue ? `$${re.estimatedValue}` : '';
    flat.real_estate_1_who_lives  = re.whoLives      || '';
    flat.real_estate_1_realtor    = re.realtorInfo   || '';
    flat.real_estate_1_date_listed= re.dateListed    || '';
  }

  // ── Mobile home ────────────────────────────────────────────────────────────
  if (d.ownsMobileHome && d.mobileHome) {
    const mh = d.mobileHome;
    flat.mobile_home_location   = mh.location  || '';
    flat.mobile_home_owner      = mh.owner     || fullName;
    flat.mobile_home_value      = mh.value     ? `$${mh.value}` : '';
    flat.mobile_home_year_model = mh.yearModel || '';
    flat.mobile_home_who_lives  = mh.whoLives  || '';
  }

  // ── Burial — leave blank unless data provided ──────────────────────────────
  if (d.burialArrangements && d.burialArrangements.length > 0) {
    const b = d.burialArrangements[0];
    flat.burial_1_owner         = b.owner                  || '';
    flat.burial_1_bank          = b.bankInsuranceCompany   || '';
    flat.burial_1_account       = b.accountNumbers         || '';
    flat.burial_1_date          = b.dateEstablished        || '';
    flat.burial_spaces_count    = b.burialSpacesCount      ? String(b.burialSpacesCount) : '';
    flat.burial_spaces_location = b.burialSpacesLocation   || '';
    flat.burial_1_value         = b.value ? `$${b.value}` : '';
    flat.burial_1_funeral_home  = b.funeralHome            || '';
  }

  // ── Life insurance — leave blank unless data provided ─────────────────────
  if (d.lifeInsurance && d.lifeInsurance.length > 0) {
    const li = d.lifeInsurance[0];
    flat.life_ins_1_owner       = li.owner       || fullName;
    flat.life_ins_1_company     = li.company     || '';
    flat.life_ins_1_policy      = li.policyNumber || '';
    flat.life_ins_1_face_value  = li.faceValue   ? `$${li.faceValue}` : '';
    flat.life_ins_1_cash_value  = li.cashValue   ? `$${li.cashValue}` : '';
    flat.life_ins_1_beneficiary = li.beneficiary || '';
  }

  // ── Vehicles — leave blank unless data provided ────────────────────────────
  if (d.vehicles && d.vehicles.length > 0) {
    const v = d.vehicles[0];
    flat.vehicle_1_owner           = v.owner         || fullName;
    flat.vehicle_1_year_make_model = v.yearMakeModel || '';
    flat.vehicle_1_plate           = v.plateNumber   || '';
    flat.vehicle_1_amount_owed     = v.amountOwed    ? `$${v.amountOwed}` : '$0';
    flat.vehicle_1_pct_owned       = v.percentOwned  ? `${v.percentOwned}%` : '100%';
    flat.vehicle_1_comments        = '';
  }

  // ── Bank accounts ──────────────────────────────────────────────────────────
  if (d.bankAccounts && d.bankAccounts.length > 0) {
    const acct = d.bankAccounts[0];
    flat.resource_1_owner    = acct.owner        || fullName;
    flat.resource_1_type     = acct.type         || '';
    flat.resource_1_value    = acct.currentValue ? `$${acct.currentValue}` : '';
    flat.resource_1_bank     = acct.bankName     || '';
    flat.resource_1_pct_owned = acct.percentOwned ? `${acct.percentOwned}%` : '100%';
    flat.resource_1_comments = '';
  }

  // ── Transfers ──────────────────────────────────────────────────────────────
  if (d.transferredAssets) {
    flat.transfer_type         = d.transferType        || '';
    flat.transfer_market_value = d.transferMarketValue ? `$${d.transferMarketValue}` : '';
    flat.transfer_date         = d.transferDate        || '';
    flat.transfer_explanation  = d.transferExplanation || '';
  }

  // ── Expected lump sum ──────────────────────────────────────────────────────
  if (d.expectingLumpSum) {
    flat.lump_sum_amount      = d.lumpSumAmount ? `$${d.lumpSumAmount}` : '';
    flat.lump_sum_date        = d.lumpSumDate   || '';
    flat.lump_sum_explanation = d.lumpSumExplanation || '';
  }

  // ── Income rows ────────────────────────────────────────────────────────────
  if (income.length > 0) {
    income.slice(0, 5).forEach((inc, i) => {
      const n = i + 1;
      flat[`income_row${n}_whose`]       = inc.person    || d.firstName || fullName;
      flat[`income_row${n}_type`]        = classifyIncomeType(inc.source || '');
      flat[`income_row${n}_source`]      = inc.source    || '';
      flat[`income_row${n}_frequency`]   = normalizeFreq(inc.frequency || '');
      flat[`income_row${n}_gross_amount`]= inc.amount    ? `$${inc.amount}` : '';
      if (inc.hoursPerWeek) flat[`income_row${n}_hours`] = String(inc.hoursPerWeek);
    });
  } else {
    flat.income_row1_whose        = fullName;
    flat.income_row1_type         = 'Unearned';
    flat.income_row1_source       = 'No current income';
    flat.income_row1_frequency    = 'N/A';
    flat.income_row1_gross_amount = '$0.00';
  }

  // ── Shelter & utility expenses ─────────────────────────────────────────────
  if (exp.rent)                     flat.shelter_rent                 = `$${exp.rent}`;
  if (exp.mortgage)                 flat.shelter_rent                 = `$${exp.mortgage}`; // same field
  if (exp.condoFees)                flat.shelter_condo_maintenance    = `$${exp.condoFees}`;
  if (exp.propertyTaxes)            flat.shelter_property_taxes       = `$${exp.propertyTaxes}`;
  if (exp.homeownersInsurance)      flat.shelter_homeowners_insurance = `$${exp.homeownersInsurance}`;
  if (exp.utilities)                flat.shelter_electric             = `$${exp.utilities}`;
  if (exp.gas)                      flat.shelter_gas                  = `$${exp.gas}`;
  if (exp.heating)                  flat.shelter_heating              = `$${exp.heating}`;
  if (exp.water)                    flat.shelter_water                = `$${exp.water}`;
  if (exp.sewer)                    flat.shelter_sewer                = `$${exp.sewer}`;
  if (exp.garbage)                  flat.shelter_garbage              = `$${exp.garbage}`;
  // FIX: shelter_telephone must be a monthly dollar amount, never the phone number string
  if (exp.telephone && !isNaN(parseFloat(exp.telephone))) {
    flat.shelter_telephone = `$${exp.telephone}`;
  }

  // ── Rep payee — default self ───────────────────────────────────────────────
  flat.rep_payee_name    = fullName;
  flat.rep_payee_address = d.address || '';

  // ── Authorized representative — self-applying ─────────────────────────────
  flat.authorized_rep_name    = fullName;
  flat.authorized_rep_address = d.address || '';
  flat.authorized_rep_phone   = d.phone   || '';

  // ── POA — none ─────────────────────────────────────────────────────────────
  flat.poa_name         = 'None';
  flat.poa_relationship = 'N/A';
  flat.poa_address      = 'N/A';
  flat.poa_city         = city;
  flat.poa_state        = 'PA';
  flat.poa_zip          = zip;
  flat.poa_phone        = 'N/A';

  // ── Signature date ─────────────────────────────────────────────────────────
  flat.applicant_signature_date = today;

  return flat;
}

function buildCheckboxDecisions(data) {
  const d = data || {};
  const exp = d.expenses || {};
  const isUsCitizen = d.isUsCitizen !== false;
  const ids = MEDICAID_CHECKBOX_IDS;
  const check = {};

  // Language preference
  const lang = (d.languagePreference || 'english').toLowerCase();
  check[ids.lang_english] = lang === 'english';
  check[ids.lang_spanish] = lang === 'spanish';
  check[ids.lang_other]   = lang !== 'english' && lang !== 'spanish';

  // Interpreter
  check[ids.interp_yes] = !!d.interpreterNeeded;
  check[ids.interp_no]  = !d.interpreterNeeded;

  // Sex
  if (d.sex === 'male')   check[ids.sex_male]   = true;
  if (d.sex === 'female') check[ids.sex_female] = true;

  // Marital status
  const ms = (d.maritalStatus || '').toLowerCase();
  check[ids.marital_single]    = ms === 'single';
  check[ids.marital_separated] = ms === 'separated';
  check[ids.marital_married]   = ms === 'married';
  check[ids.marital_divorced]  = ms === 'divorced';
  check[ids.marital_widowed]   = ms === 'widowed';

  // Citizenship
  check[ids.citizen_yes] = isUsCitizen;
  check[ids.citizen_no]  = !isUsCitizen;
  if (!isUsCitizen) {
    check[ids.immigration_yes] = !!d.hasEligibleImmigrationStatus;
    check[ids.immigration_no]  = !d.hasEligibleImmigrationStatus;
    check[ids.us_1996_yes] = !!d.hadUsResidencyBefore1996;
    check[ids.us_1996_no]  = !d.hadUsResidencyBefore1996;
  } else {
    // Don't fill immigration sub-questions for citizens
  }

  // Previous benefits
  check[ids.prev_benefits_yes] = !!d.hadPreviousBenefits;
  check[ids.prev_benefits_no]  = !d.hadPreviousBenefits;

  // Nursing facility
  check[ids.nursing_yes] = !!d.hadNursingFacilityStay;
  check[ids.nursing_no]  = !d.hadNursingFacilityStay;

  // Unpaid medical bills
  check[ids.unpaid_bills_yes] = !!d.hasUnpaidMedicalBills;
  check[ids.unpaid_bills_no]  = !d.hasUnpaidMedicalBills;

  // Military
  const milStatus = (d.militaryStatus || '').toLowerCase();
  if (d.hasMilitaryService) {
    check[ids.mil_veteran]        = milStatus.includes('veteran');
    check[ids.mil_active]         = milStatus.includes('active');
    check[ids.mil_national_guard] = milStatus.includes('national');
    check[ids.mil_reserves]       = milStatus.includes('reserve');
    check[ids.mil_widow]          = milStatus.includes('widow') || milStatus.includes('dependent');
  }

  // Mobile home / real estate None when no data
  const hasRealEstate = d.ownsRealEstate && d.realEstate && d.realEstate.length > 0;
  check[ids.real_estate_none] = !hasRealEstate;
  check[ids.mobile_home_none] = !(d.ownsMobileHome && d.mobileHome);

  // Vehicles None when no data
  const hasVehicles = d.vehicles && d.vehicles.length > 0;
  check[ids.vehicles_none] = !hasVehicles;

  // Transfers
  check[ids.transferred_assets_yes] = !!d.transferredAssets;
  check[ids.transferred_assets_no]  = !d.transferredAssets;
  check[ids.transferred_trust_yes]  = !!d.transferredToTrust;
  check[ids.transferred_trust_no]   = !d.transferredToTrust;

  // Lump sum
  check[ids.lump_sum_yes] = !!d.expectingLumpSum;
  check[ids.lump_sum_no]  = !d.expectingLumpSum;

  // Heating/AC separate from rent
  const heatingCost = parseFloat(exp.heating || 0);
  check[ids.heating_separate_yes] = heatingCost > 0;
  check[ids.heating_separate_no]  = heatingCost === 0;

  // Renewal — default to maximum 5 years
  check[ids.renewal_5yr] = true;

  return check;
}

export async function generateMedicaidPDF(extractedData) {
  const { PDFDocument } = getPdfLib();

  const res = await fetch('/medicaid-template.pdf');
  if (!res.ok) throw new Error('Could not load Medicaid template from /medicaid-template.pdf');

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form   = pdfDoc.getForm();
  const flat   = adaptForMedicaid(extractedData);

  // Fill text fields
  for (const [semanticKey, acroId] of Object.entries(MEDICAID_ACRO)) {
    const value = (flat[semanticKey] ?? '').toString().trim();
    if (!value) continue;
    try { form.getTextField(acroId).setText(value); } catch { /* field absent in this PDF version */ }
  }

  // Fill checkboxes
  const checkboxDecisions = buildCheckboxDecisions(extractedData);
  for (const [fieldId, shouldCheck] of Object.entries(checkboxDecisions)) {
    if (!shouldCheck) continue;
    try { form.getCheckBox(fieldId).check(); } catch { /* field absent or wrong type */ }
  }

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
