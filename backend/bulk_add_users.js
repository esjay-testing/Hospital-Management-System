const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const User = require('./models/User');

const DEFAULT_PASSWORD = 'ChangeMe123'; // everyone starts with this

const doctors = [
  { firstName: 'Maria', 
    lastName: 'Santos', 
    email: 'maria.santos@hospital.com',
    phone: '+63-900-000-0001', 
    dateOfBirth: '1985-02-10', 
    gender: 'female',
    specialization: 'Cardiology', 
    licenseNumber: 'MD100001', 
    experience: 8, 
    consultationFee: 200 },
  { firstName: 'Jose', 
    lastName: 'Reyes', 
    email: 'jose.reyes@hospital.com',
    phone: '+63-900-000-0002', 
    dateOfBirth: '1979-07-22', 
    gender: 'male',
    specialization: 'Pediatrics', 
    licenseNumber: 'MD100002', 
    experience: 14, 
    consultationFee: 150 },
  // copy a block above for each new doctor
];

const patients = [
  { firstName: 'Ana', 
    lastName: 'Cruz', 
    email: 'ana.cruz@email.com',
    phone: '+63-900-111-0001', 
    dateOfBirth: '1996-04-12', 
    gender: 'female',
    bloodType: 'O+', 
    allergies: ['Penicillin'],
    emergencyContact: { 
        name: 'Rosa Cruz', 
        phone: '+63-900-111-0099',
        relationship: 'Mother' 
    } },

  { firstName: 'Mark', 
    lastName: 'Lim', 
    email: 'mark.lim@email.com',
    phone: '+63-900-111-0002', 
    dateOfBirth: '1990-11-03', 
    gender: 'male',
    bloodType: 'A-', 
    allergies: ['Peanuts', 'Shellfish'],
    emergencyContact: {
        name: 'Liza Lim', 
        phone: '+63-900-111-0088',
        relationship: 'Sister' 
    }},
  // copy a block above for each new patient
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const all = [
    ...doctors.map((d) => ({ ...d, role: 'doctor' })),
    ...patients.map((p) => ({ ...p, role: 'patient' })),
  ];

  let added = 0, skipped = 0, failed = 0;
  for (const u of all) {
    const email = u.email.toLowerCase();
    if (await User.findOne({ email })) {
      console.log('Skipped (already exists):', email);
      skipped++;
      continue;
    }
    try {
      await User.create({
        ...u,
        email,
        password: DEFAULT_PASSWORD,
        dateOfBirth: new Date(u.dateOfBirth),
      });
      added++;
    } catch (e) {
      console.log('Failed:', email, '-', e.message);
      failed++;
    }
  }

  console.log(`Done. Added ${added}, skipped ${skipped}, failed ${failed}.`);
  await mongoose.disconnect();
})();