const mongoose = require('mongoose');

// One row per payment or refund. The invoice totals are the sum of these.
const transactionSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['payment', 'refund'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'e_wallet', 'insurance'],
      default: 'cash'
    },
    reason: { type: String, trim: true },
    reference: { type: String, trim: true },
    claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
