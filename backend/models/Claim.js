const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    claimNumber: { type: String, unique: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, trim: true },
    policyNumber: { type: String, trim: true },
    billedAmount: { type: Number, required: true, min: 0.01 },
    coveredAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'denied'],
      default: 'submitted'
    },
    denialReason: { type: String, trim: true },
    resubmissions: { type: Number, default: 0 },
    paymentRecorded: { type: Boolean, default: false },
    history: [historySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Claim', claimSchema);
