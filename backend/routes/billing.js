const express = require('express');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const Claim = require('../models/Claim');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();
const staffOrAdmin = [authenticateToken, authorize('admin', 'staff')];

const METHODS = ['cash', 'card', 'bank_transfer', 'e_wallet', 'insurance'];

// ---------- small helpers ----------
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const serverError = (res, label, error) => {
  console.error(label, error);
  res.status(500).json({ success: false, message: label, error: error.message });
};
const round = (n) => Math.round(Number(n) * 100) / 100;

const netPaid = (inv) => round(inv.amountPaid - inv.amountRefunded);
const balanceOf = (inv) => round(inv.total - netPaid(inv));

const displayStatus = (inv) => {
  const open = ['sent', 'partially_paid'].includes(inv.status);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return open && inv.dueDate && new Date(inv.dueDate) < startOfToday ? 'overdue' : inv.status;
};

// Adds the worked-out fields the screen needs.
const shape = (doc) => {
  const inv = doc.toObject ? doc.toObject() : doc;
  return { ...inv, netPaid: netPaid(inv), balance: balanceOf(inv), displayStatus: displayStatus(inv) };
};

// Sets the invoice status from the money that has actually moved.
const recalcStatus = (inv) => {
  const net = netPaid(inv);
  if (inv.amountRefunded > 0 && inv.amountRefunded >= inv.amountPaid) inv.status = 'refunded';
  else if (inv.total > 0 && net >= inv.total - 0.005) inv.status = 'paid';
  else if (net > 0) inv.status = 'partially_paid';
  else if (['paid', 'partially_paid', 'refunded'].includes(inv.status)) inv.status = 'sent';
};

const nextNumber = async (Model, field, prefix) => {
  const last = await Model.findOne().sort({ createdAt: -1 }).select(field).lean();
  const n = last && last[field] ? parseInt(String(last[field]).replace(/\D/g, ''), 10) + 1 : 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
};

// Records a payment against an invoice and updates its status.
const applyPayment = async (inv, amount, method, userId, extra = {}) => {
  inv.amountPaid = round(inv.amountPaid + amount);
  recalcStatus(inv);
  await inv.save();
  return Transaction.create({
    invoiceId: inv._id,
    patientId: inv.patientId,
    type: 'payment',
    amount,
    method,
    recordedBy: userId,
    ...extra
  });
};

/* ================================ INVOICES =============================== */

router.get('/invoices', ...staffOrAdmin, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('patientId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { invoices: invoices.map(shape) } });
  } catch (error) {
    serverError(res, 'Failed to get invoices', error);
  }
});

router.post('/invoices', ...staffOrAdmin, async (req, res) => {
  try {
    const { patientId, items, dueDate, notes, status } = req.body;

    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) return fail(res, 400, 'Choose a valid patient');

    const cleanItems = (Array.isArray(items) ? items : [])
      .map((i) => ({
        description: String(i.description || '').trim(),
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice)
      }))
      .filter((i) => i.description);

    if (cleanItems.length === 0) return fail(res, 400, 'Add at least one line item');
    if (cleanItems.some((i) => !(i.quantity >= 1) || !(i.unitPrice >= 0))) {
      return fail(res, 400, 'Each item needs a quantity of 1 or more and a price of 0 or more');
    }

    const total = round(cleanItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
    const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invoice = await Invoice.create({
      invoiceNumber: await nextNumber(Invoice, 'invoiceNumber', 'INV'),
      patientId,
      items: cleanItems,
      total,
      dueDate: due,
      notes,
      status: status === 'sent' ? 'sent' : 'draft',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: { invoice: shape(invoice) } });
  } catch (error) {
    serverError(res, 'Failed to create invoice', error);
  }
});

router.put('/invoices/:id/send', ...staffOrAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return fail(res, 404, 'Invoice not found');
    if (inv.status !== 'draft') return fail(res, 400, 'Only a draft invoice can be sent');

    inv.status = 'sent';
    await inv.save();
    res.json({ success: true, data: { invoice: shape(inv) } });
  } catch (error) {
    serverError(res, 'Failed to send invoice', error);
  }
});

router.post('/invoices/:id/payments', ...staffOrAdmin, async (req, res) => {
  try {
    const amount = round(req.body.amount);
    const method = METHODS.includes(req.body.method) ? req.body.method : 'cash';

    const inv = await Invoice.findById(req.params.id);
    if (!inv) return fail(res, 404, 'Invoice not found');
    if (['paid', 'refunded'].includes(inv.status)) return fail(res, 400, `This invoice is already ${inv.status}`);
    if (!(amount > 0)) return fail(res, 400, 'Enter an amount above zero');
    if (amount > balanceOf(inv) + 0.005) {
      return fail(res, 400, `The amount is more than the balance due (${balanceOf(inv).toFixed(2)})`);
    }

    const txn = await applyPayment(inv, amount, method, req.user._id, { reference: req.body.reference });
    res.status(201).json({ success: true, data: { invoice: shape(inv), transaction: txn } });
  } catch (error) {
    serverError(res, 'Failed to record payment', error);
  }
});

// Refunds are admin only.
router.post('/invoices/:id/refunds', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const amount = round(req.body.amount);
    const reason = String(req.body.reason || '').trim();

    const inv = await Invoice.findById(req.params.id);
    if (!inv) return fail(res, 404, 'Invoice not found');
    if (!reason) return fail(res, 400, 'A reason is required for a refund');
    if (!(amount > 0)) return fail(res, 400, 'Enter an amount above zero');
    if (amount > netPaid(inv) + 0.005) {
      return fail(res, 400, `You can refund at most ${netPaid(inv).toFixed(2)} on this invoice`);
    }

    inv.amountRefunded = round(inv.amountRefunded + amount);
    recalcStatus(inv);
    await inv.save();

    const txn = await Transaction.create({
      invoiceId: inv._id,
      patientId: inv.patientId,
      type: 'refund',
      amount,
      method: METHODS.includes(req.body.method) ? req.body.method : 'cash',
      reason,
      recordedBy: req.user._id
    });

    res.status(201).json({ success: true, data: { invoice: shape(inv), transaction: txn } });
  } catch (error) {
    serverError(res, 'Failed to issue refund', error);
  }
});

/* ============================== TRANSACTIONS ============================= */

router.get('/transactions', ...staffOrAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('invoiceId', 'invoiceNumber')
      .populate('patientId', 'firstName lastName')
      .populate('recordedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: { transactions } });
  } catch (error) {
    serverError(res, 'Failed to get transactions', error);
  }
});

/* ================================= CLAIMS ================================ */

router.get('/claims', ...staffOrAdmin, async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('patientId', 'firstName lastName')
      .populate('invoiceId', 'invoiceNumber total')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { claims } });
  } catch (error) {
    serverError(res, 'Failed to get claims', error);
  }
});

router.post('/claims', ...staffOrAdmin, async (req, res) => {
  try {
    const { invoiceId, provider, policyNumber, note } = req.body;

    const inv = await Invoice.findById(invoiceId);
    if (!inv) return fail(res, 400, 'Choose a valid invoice');
    if (!provider || !String(provider).trim()) return fail(res, 400, 'Enter the insurance provider');

    const billed = req.body.billedAmount !== undefined && req.body.billedAmount !== ''
      ? round(req.body.billedAmount)
      : inv.total;
    if (!(billed > 0) || billed > inv.total + 0.005) {
      return fail(res, 400, 'The billed amount must be above zero and not more than the invoice total');
    }

    const claim = await Claim.create({
      claimNumber: await nextNumber(Claim, 'claimNumber', 'CLM'),
      invoiceId: inv._id,
      patientId: inv.patientId,
      provider,
      policyNumber,
      billedAmount: billed,
      history: [{ status: 'submitted', note: note || 'Claim submitted', by: req.user._id }]
    });

    res.status(201).json({ success: true, data: { claim } });
  } catch (error) {
    serverError(res, 'Failed to create claim', error);
  }
});

router.put('/claims/:id/status', ...staffOrAdmin, async (req, res) => {
  try {
    const { status, coveredAmount, denialReason, note } = req.body;
    if (!['under_review', 'approved', 'denied'].includes(status)) return fail(res, 400, 'Invalid status');

    const claim = await Claim.findById(req.params.id);
    if (!claim) return fail(res, 404, 'Claim not found');

    if (status === 'approved') {
      const covered = round(coveredAmount);
      if (!(covered > 0) || covered > claim.billedAmount + 0.005) {
        return fail(res, 400, 'The covered amount must be above zero and not more than the billed amount');
      }
      claim.coveredAmount = covered;
      claim.denialReason = undefined;
    }
    if (status === 'denied') {
      if (!String(denialReason || '').trim()) return fail(res, 400, 'Enter the reason for the denial');
      claim.denialReason = String(denialReason).trim();
      claim.coveredAmount = 0;
    }

    claim.status = status;
    claim.history.push({ status, note: note || denialReason || '', by: req.user._id });

    // An approved claim pays the invoice, so the invoice status and revenue update by themselves.
    if (status === 'approved' && !claim.paymentRecorded) {
      const inv = await Invoice.findById(claim.invoiceId);
      if (inv && !['paid', 'refunded'].includes(inv.status)) {
        const pay = Math.min(claim.coveredAmount, balanceOf(inv));
        if (pay > 0) {
          await applyPayment(inv, round(pay), 'insurance', req.user._id, {
            claimId: claim._id,
            reference: claim.claimNumber
          });
        }
      }
      claim.paymentRecorded = true;
    }

    await claim.save();
    res.json({ success: true, data: { claim } });
  } catch (error) {
    serverError(res, 'Failed to update claim', error);
  }
});

router.post('/claims/:id/resubmit', ...staffOrAdmin, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return fail(res, 404, 'Claim not found');
    if (claim.status !== 'denied') return fail(res, 400, 'Only a denied claim can be resubmitted');

    claim.status = 'submitted';
    claim.resubmissions += 1;
    claim.denialReason = undefined;
    claim.history.push({ status: 'submitted', note: req.body.note || 'Claim resubmitted', by: req.user._id });
    await claim.save();

    res.json({ success: true, data: { claim } });
  } catch (error) {
    serverError(res, 'Failed to resubmit claim', error);
  }
});

module.exports = router;
