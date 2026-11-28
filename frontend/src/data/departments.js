// Edit these lists to match your hospital. The Users forms and filters read from here.

// Each department and the specializations a doctor in that department can have.
export const DEPARTMENT_SPECIALIZATIONS = {
  Cardiology: [
    'Cardiac Electrophysiology',
    'Echocardiography',
    'Heart Failure',
    'Interventional Cardiology',
    'Preventive Cardiology',
  ],
  Dermatology: [
    'Cosmetic Dermatology',
    'Dermatopathology',
    'Medical Dermatology',
    'Pediatric Dermatology',
  ],
  'Emergency Medicine': [
    'Critical Care',
    'Pediatric Emergency Medicine',
    'Toxicology',
    'Trauma Care',
  ],
  'General Medicine': [
    'Family Medicine',
    'Geriatrics',
    'Infectious Disease',
    'Internal Medicine',
    'Preventive Medicine',
  ],
  Neurology: [
    'Epilepsy',
    'Movement Disorders',
    'Neuromuscular Medicine',
    'Pediatric Neurology',
    'Stroke',
  ],
  'Obstetrics and Gynecology': [
    'Gynecologic Oncology',
    'Maternal-Fetal Medicine',
    'Reproductive Endocrinology',
    'Urogynecology',
  ],
  Oncology: [
    'Hematology',
    'Medical Oncology',
    'Radiation Oncology',
    'Surgical Oncology',
  ],
  Orthopedics: [
    'Hand Surgery',
    'Joint Replacement',
    'Pediatric Orthopedics',
    'Spine Surgery',
    'Sports Medicine',
  ],
  Pediatrics: [
    'Adolescent Medicine',
    'Neonatology',
    'Pediatric Cardiology',
    'Pediatric Infectious Disease',
    'Pediatric Neurology',
  ],
  Psychiatry: [
    'Addiction Psychiatry',
    'Child and Adolescent Psychiatry',
    'Clinical Psychology',
    'Geriatric Psychiatry',
  ],
  Radiology: [
    'Breast Imaging',
    'Diagnostic Radiology',
    'Interventional Radiology',
    'Nuclear Medicine',
    'Ultrasound',
  ],
  Surgery: [
    'Cardiothoracic Surgery',
    'General Surgery',
    'Neurosurgery',
    'Plastic Surgery',
    'Vascular Surgery',
  ],
}

export const DEPARTMENTS = Object.keys(DEPARTMENT_SPECIALIZATIONS)

// Desks a staff member can be assigned to.
export const DESKS = [
  'Billing Desk',
  'Information Desk',
  'Reception Desk',
  'Registration Desk',
  'Triage Desk',
]

export const SHIFTS = ['Morning', 'Afternoon', 'Night']
