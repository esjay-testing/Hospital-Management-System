const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [itemSchema], validate: [(v) => v.length > 0, 'Add at least one line item'] },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0 },
    amountRefunded: { type: Number, default: 0 },
    // "overdue" is worked out when invoices are read, so it is not stored.
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'refunded'],
      default: 'draft'
    },
    dueDate: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
