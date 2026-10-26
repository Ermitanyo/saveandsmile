const { Validator } = require('./validate');
const { manilaDate } = require('./time');

// Checkbox keys that mirror the clinic's paper patient form.
const MEDICAL_HISTORY = [
  'hospitalization', 'cns_disorder', 'cvs_disorder', 'lung_respiratory', 'thyroid_gland', 'gi_disorder',
  'gut_disorder', 'hepatitis_liver', 'heart_disease', 'blood_dyscrasias', 'hypertension', 'pregnancy',
  'syncope', 'diabetes', 'medication', 'allergy', 'others',
];
const DENTAL_HISTORY = [
  'extraction', 'anesthesia_reaction', 'complication', 'swelling', 'stain', 'plaque', 'calculus',
  'gingivitis', 'periodontal_disease',
];
const CIVIL_STATUS = ['single', 'married', 'widowed', 'separated', 'other'];

const TEXT_FIELDS = {
  civilStatus: 30, occupation: 120, address: 255, telephone: 30, officeAddress: 255, officeTelephone: 30,
  responsiblePerson: 120, emergencyContactName: 120, emergencyContactPhone: 30, medicalOther: 255,
  medications: 255, allergyFood: 255, allergyDrug: 255, hospitalizationNotes: 255, physicianName: 120,
  physicianContact: 120, lastDentalVisit: 120,
};

const pickList = (v, field, allowed) => {
  const raw = v.body[field];
  if (raw === undefined) return;
  if (!Array.isArray(raw) || raw.some((x) => !allowed.includes(x))) {
    v.fail(field, `${field} contains an unknown option`);
    return;
  }
  v.data[field] = [...new Set(raw)];
};

/**
 * Validates the optional patient-information form. Only the fields that were sent are returned,
 * so a partial update never erases the rest of the profile.
 */
function parseProfile(body) {
  const v = new Validator(body);

  Object.entries(TEXT_FIELDS).forEach(([field, max]) => v.string(field, { required: false, max }));
  // string(required:false) stores null for missing values; drop the ones that were not sent
  Object.keys(TEXT_FIELDS).forEach((f) => { if (!v.has(f)) delete v.data[f]; });

  if (v.has('civilStatus') && v.body.civilStatus) {
    if (!CIVIL_STATUS.includes(String(v.body.civilStatus).toLowerCase())) v.fail('civilStatus', 'Choose a valid civil status');
    else v.data.civilStatus = String(v.body.civilStatus).toLowerCase();
  }

  if (v.has('birthDate')) {
    v.date('birthDate', { label: 'Birth date', required: false });
    if (v.data.birthDate && v.data.birthDate > manilaDate(new Date())) v.fail('birthDate', 'Birth date cannot be in the future');
    if (v.data.birthDate && v.data.birthDate < '1900-01-01') v.fail('birthDate', 'Enter a valid birth date');
  }

  pickList(v, 'medicalHistory', MEDICAL_HISTORY);
  pickList(v, 'dentalHistory', DENTAL_HISTORY);

  if (v.has('gingivitisSeverity')) {
    if (v.body.gingivitisSeverity === null || v.body.gingivitisSeverity === '') v.data.gingivitisSeverity = null;
    else v.oneOf('gingivitisSeverity', ['mild', 'moderate', 'severe'], { required: false });
  }

  if (v.has('privacyConsent')) v.boolean('privacyConsent');

  return v.done();
}

module.exports = { parseProfile, MEDICAL_HISTORY, DENTAL_HISTORY, CIVIL_STATUS };
