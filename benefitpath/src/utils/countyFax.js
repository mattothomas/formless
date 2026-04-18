// Pennsylvania County Assistance Office (CAO) fax numbers
// Source: PA Department of Human Services — pa.gov/agencies/dhs/contact/cao-information

export const COUNTY_FAX = {
  'Adams':          '717-334-4798',
  'Allegheny':      '412-565-3660',
  'Armstrong':      '724-543-2522',
  'Beaver':         '724-774-0164',
  'Bedford':        '814-623-0340',
  'Berks':          '610-736-4004',
  'Blair':          '814-946-7376',
  'Bradford':       '570-265-8118',
  'Bucks':          '215-781-3438',
  'Butler':         '724-284-8028',
  'Cambria':        '814-472-3500',
  'Cameron':        '814-486-3478',
  'Carbon':         '570-325-9115',
  'Centre':         '814-355-6880',
  'Chester':        '610-466-1130',
  'Clarion':        '814-226-5191',
  'Clearfield':     '814-765-4548',
  'Clinton':        '570-893-4043',
  'Columbia':       '570-784-6490',
  'Crawford':       '814-337-3617',
  'Cumberland':     '717-240-6282',
  'Dauphin':        '717-772-4703',
  'Delaware':       '610-447-5399',
  'Elk':            '814-776-5371',
  'Erie':           '814-461-2294',
  'Fayette':        '724-437-0560',
  'Forest':         '814-755-3502',
  'Franklin':       '717-264-0474',
  'Fulton':         '717-485-4094',
  'Greene':         '724-852-5211',
  'Huntingdon':     '814-643-3340',
  'Indiana':        '724-463-8800',
  'Jefferson':      '814-849-5403',
  'Juniata':        '717-436-7711',
  'Lackawanna':     '570-963-4843',
  'Lancaster':      '717-299-7565',
  'Lawrence':       '724-656-3007',
  'Lebanon':        '717-274-3645',
  'Lehigh':         '610-821-6499',
  'Luzerne':        '570-826-2178',
  'Lycoming':       '570-327-3619',
  'McKean':         '814-887-5404',
  'Mercer':         '724-981-7196',
  'Mifflin':        '717-248-4756',
  'Monroe':         '570-420-3930',
  'Montgomery':     '610-270-1678',
  'Montour':        '570-271-3531',
  'Northampton':    '610-250-1839',
  'Northumberland': '570-988-5435',
  'Perry':          '717-582-4617',
  'Philadelphia':   '215-560-3214',
  'Pike':           '570-775-0350',
  'Potter':         '814-274-0174',
  'Schuylkill':     '570-621-2957',
  'Snyder':         '570-837-4240',
  'Somerset':       '814-445-4095',
  'Sullivan':       '570-946-7702',
  'Susquehanna':    '570-853-3397',
  'Tioga':          '570-724-7014',
  'Union':          '570-524-4393',
  'Venango':        '814-432-9694',
  'Warren':         '814-726-1027',
  'Washington':     '724-228-6890',
  'Wayne':          '570-253-1869',
  'Westmoreland':   '724-832-5202',
  'Wyoming':        '570-836-4760',
  'York':           '717-771-1261',
};

// Lookup fax number from county name (case-insensitive, handles "X County" format)
export function getFaxForCounty(county) {
  if (!county) return null;
  const normalized = county.trim().replace(/\s+county$/i, '');
  const key = Object.keys(COUNTY_FAX).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );
  return key ? { county: key, fax: COUNTY_FAX[key] } : null;
}

// Map common PA zip code prefixes to county for fallback
const ZIP_PREFIX_TO_COUNTY = {
  '191': 'Philadelphia', '190': 'Philadelphia',
  '152': 'Allegheny',   '151': 'Allegheny', '150': 'Allegheny',
  '194': 'Montgomery',  '193': 'Montgomery',
  '189': 'Bucks',       '188': 'Bucks',
  '198': 'Delaware',    '197': 'Delaware',
  '193': 'Chester',     '193': 'Chester',
  '176': 'Lancaster',   '175': 'Lancaster',
  '174': 'York',        '173': 'York',
  '196': 'Berks',       '195': 'Berks',
  '170': 'Dauphin',     '171': 'Dauphin', '172': 'Dauphin',
  '187': 'Luzerne',     '186': 'Luzerne',
  '180': 'Northampton', '181': 'Northampton',
  '165': 'Erie',        '164': 'Erie',     '163': 'Erie',
  '184': 'Lackawanna',  '185': 'Lackawanna',
  '156': 'Westmoreland', '157': 'Westmoreland',
};

export function getFaxForZip(zip) {
  if (!zip) return null;
  const prefix3 = String(zip).slice(0, 3);
  const county = ZIP_PREFIX_TO_COUNTY[prefix3];
  if (!county) return null;
  return { county, fax: COUNTY_FAX[county] };
}

// Resolve fax from either county or zip
export function resolveFax(county, zip) {
  return getFaxForCounty(county) || getFaxForZip(zip) || null;
}
