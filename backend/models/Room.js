const mongoose = require('mongoose');

// One document per bed, consultation room or procedure suite.
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, required: true, trim: true }, // e.g. General Ward, ICU, Imaging Suites
    kind: { type: String, enum: ['bed', 'consultation', 'suite'], default: 'bed' },
    status: { type: String, enum: ['available', 'occupied', 'cleaning'], default: 'available' },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
