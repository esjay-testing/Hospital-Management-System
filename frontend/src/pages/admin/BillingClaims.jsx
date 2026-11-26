import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { Plus, Search, X } from 'lucide-react'
import { billingAPI, patientsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

// ---------- constants and helpers ----------
const CURRENCY = '₱'
const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'claims', label: 'Insurance claims' },
  { key: 'transactions', label: 'Payments and refunds' },
]
const INVOICE_STATUS = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Sent', cls: 'bg-sky-50 text-sky-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  partially_paid: { label: 'Partially paid', cls: 'bg-amber-50 text-amber-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700' },
  refunded: { label: 'Refunded', cls: 'bg-indigo-50 text-indigo-700' },
}
const CLAIM_STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-sky-50 text-sky-700' },
  under_review: { label: 'Under review', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
  denied: { label: 'Denied', cls: 'bg-red-50 text-red-700' },
}
const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'e_wallet', label: 'E-wallet' },
  { key: 'insurance', label: 'Insurance' },
]
const methodLabel = (k) => METHODS.find((m) => m.key === k)?.label || k

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600'

const pick = (res, key) => res?.data?.data?.[key] || []
const msg = (err, fallback) => err?.response?.data?.message || fallback
const money = (n) => `${CURRENCY}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const nameOf = (p) => (p ? `${p.firstName} ${p.lastName}` : 'Unknown')
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

const Badge = ({ map, status }) => (
  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${map[status]?.cls || 'bg-slate-100 text-slate-700'}`}>
    {map[status]?.label || status}
  </span>
)

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm text-slate-600">{label}</span>
    {children}
  </label>
)

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={onClose}>
    <div
      className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
)

const FormActions = ({ onClose, busy, label, danger }) => (
  <div className="flex justify-end gap-2 pt-2">
    <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
      Cancel
    </button>
    <button
      type="submit"
      disabled={busy}
      className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}
    >
      {busy ? 'Saving...' : label}
    </button>
  </div>
)

// ---------- create invoice ----------
const InvoiceModal = ({ patients, onClose, onSaved }) => {
  const [patientId, setPatientId] = useState('')
  const [dueDate, setDueDate] = useState(plusDays(14))
  const [status, setStatus] = useState('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: '' }])

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
  const setItem = (idx, field, value) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))

  const save = useMutation(() => billingAPI.createInvoice({ patientId, dueDate, status, notes, items }), {
    onSuccess: () => { toast.success('Invoice created'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not create the invoice')),
  })

  return (
    <Modal title="New invoice" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Patient">
            <select required className={inputCls} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Choose a patient</option>
              {patients.map((p) => <option key={p._id} value={p._id}>{nameOf(p)}</option>)}
            </select>
          </Field>
          <Field label="Due date"><input required type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>

        <div>
          <span className="mb-1 block text-sm text-slate-600">Line items</span>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <input required className={`${inputCls} col-span-12 sm:col-span-6`} placeholder="Description" value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} />
                <input required type="number" min="1" className={`${inputCls} col-span-4 sm:col-span-2`} placeholder="Qty" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} />
                <input required type="number" min="0" step="0.01" className={`${inputCls} col-span-6 sm:col-span-3`} placeholder="Price" value={it.unitPrice} onChange={(e) => setItem(idx, 'unitPrice', e.target.value)} />
                <button
                  type="button"
                  aria-label="Remove line"
                  disabled={items.length === 1}
                  onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}
                  className="col-span-2 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 sm:col-span-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((l) => [...l, { description: '', quantity: 1, unitPrice: '' }])} className="mt-2 text-sm font-medium text-teal-700 hover:underline">
            Add another line
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-slate-600">Total</span>
          <span className="font-semibold text-slate-900">{money(total)}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Notes (optional)"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Field label="Save as">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent to patient</option>
            </select>
          </Field>
        </div>
        <FormActions onClose={onClose} busy={save.isLoading} label="Create invoice" />
      </form>
    </Modal>
  )
}

// ---------- record payment ----------
const PaymentModal = ({ invoice, invoices, onClose, onSaved }) => {
  const [invoiceId, setInvoiceId] = useState(invoice?._id || '')
  const chosen = invoice || invoices.find((i) => i._id === invoiceId)
  const [amount, setAmount] = useState(invoice ? String(invoice.balance) : '')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const pickInvoice = (id) => {
    setInvoiceId(id)
    const found = invoices.find((i) => i._id === id)
    setAmount(found ? String(found.balance) : '')
  }

  const save = useMutation(() => billingAPI.recordPayment(invoiceId, { amount, method, reference }), {
    onSuccess: () => { toast.success('Payment recorded'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not record the payment')),
  })

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        {invoice ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {invoice.invoiceNumber}, {nameOf(invoice.patientId)}. Balance due {money(invoice.balance)}.
          </p>
        ) : (
          <Field label="Invoice">
            <select required className={inputCls} value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
              <option value="">Choose an invoice</option>
              {invoices.map((i) => <option key={i._id} value={i._id}>{i.invoiceNumber}, {nameOf(i.patientId)}, due {money(i.balance)}</option>)}
            </select>
          </Field>
        )}
        <Field label={`Amount${chosen ? ` (up to ${money(chosen.balance)})` : ''}`}>
          <input required type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Reference (optional)"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Record payment" />
      </form>
    </Modal>
  )
}

// ---------- issue refund ----------
const RefundModal = ({ invoice, onClose, onSaved }) => {
  const [amount, setAmount] = useState(String(invoice.netPaid))
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState('cash')
  const [confirmed, setConfirmed] = useState(false)

  const save = useMutation(() => billingAPI.issueRefund(invoice._id, { amount, reason, method }), {
    onSuccess: () => { toast.success('Refund issued'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not issue the refund')),
  })

  return (
    <Modal title="Issue refund" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          {invoice.invoiceNumber}, {nameOf(invoice.patientId)}. Up to {money(invoice.netPaid)} can be refunded.
        </p>
        <Field label="Refund amount">
          <input required type="number" min="0.01" step="0.01" max={invoice.netPaid} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reason"><input required className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Paid back by">
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
          I confirm this refund of {money(amount)} and understand it is recorded permanently.
        </label>
        <FormActions onClose={onClose} busy={save.isLoading} label="Issue refund" danger />
      </form>
    </Modal>
  )
}

// ---------- invoice detail ----------
const InvoiceDetail = ({ invoice, txns, isAdmin, onClose, onSent, onPay, onRefund, onClaim }) => {
  const open = !['paid', 'refunded'].includes(invoice.status) && invoice.balance > 0
  return (
    <Modal title={invoice.invoiceNumber} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-3">
        <Badge map={INVOICE_STATUS} status={invoice.displayStatus} />
        <span className="text-sm text-slate-600">{nameOf(invoice.patientId)}</span>
        <span className="text-sm text-slate-500">Due {fmtDate(invoice.dueDate)}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-2 text-slate-800">{it.description}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{money(it.unitPrice)}</td>
                <td className="py-2 text-right">{money(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd>{money(invoice.total)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>{money(invoice.amountPaid)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Refunded</dt><dd>{money(invoice.amountRefunded)}</dd></div>
        <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold"><dt>Balance due</dt><dd>{money(invoice.balance)}</dd></div>
      </dl>

      {invoice.notes && <p className="mt-3 text-sm text-slate-600">Notes: {invoice.notes}</p>}

      {txns.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Payments and refunds</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {txns.map((t) => (
              <li key={t._id} className="flex justify-between gap-3 py-1.5">
                <span className="text-slate-600">
                  {fmtDate(t.createdAt)}, {t.type === 'refund' ? 'Refund' : 'Payment'} by {methodLabel(t.method).toLowerCase()}
                  {t.reason ? `, ${t.reason}` : ''}
                </span>
                <span className={t.type === 'refund' ? 'text-red-700' : 'text-emerald-700'}>
                  {t.type === 'refund' ? '-' : '+'}{money(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {invoice.status === 'draft' && (
          <button type="button" onClick={onSent} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Mark as sent</button>
        )}
        {open && (
          <button type="button" onClick={onClaim} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Submit insurance claim</button>
        )}
        {isAdmin && invoice.netPaid > 0 && (
          <button type="button" onClick={onRefund} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Issue refund</button>
        )}
        {open && (
          <button type="button" onClick={onPay} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Record payment</button>
        )}
      </div>
    </Modal>
  )
}

// ---------- new claim ----------
const ClaimModal = ({ presetInvoice, invoices, onClose, onSaved }) => {
  const [invoiceId, setInvoiceId] = useState(presetInvoice?._id || '')
  const [provider, setProvider] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [billedAmount, setBilledAmount] = useState(presetInvoice ? String(presetInvoice.balance) : '')

  const pickInvoice = (id) => {
    setInvoiceId(id)
    const found = invoices.find((i) => i._id === id)
    setBilledAmount(found ? String(found.balance) : '')
  }

  const save = useMutation(() => billingAPI.createClaim({ invoiceId, provider, policyNumber, billedAmount }), {
    onSuccess: () => { toast.success('Claim submitted'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not submit the claim')),
  })

  return (
    <Modal title="New insurance claim" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="Invoice">
          <select required className={inputCls} value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
            <option value="">Choose an invoice</option>
            {invoices.map((i) => <option key={i._id} value={i._id}>{i.invoiceNumber}, {nameOf(i.patientId)}, due {money(i.balance)}</option>)}
          </select>
        </Field>
        <Field label="Insurance provider"><input required className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value)} /></Field>
        <Field label="Policy number (optional)"><input className={inputCls} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} /></Field>
        <Field label="Billed amount"><input required type="number" min="0.01" step="0.01" className={inputCls} value={billedAmount} onChange={(e) => setBilledAmount(e.target.value)} /></Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Submit claim" />
      </form>
    </Modal>
  )
}

// ---------- update claim status ----------
const ClaimStatusModal = ({ claim, onClose, onSaved }) => {
  const [status, setStatus] = useState('under_review')
  const [coveredAmount, setCoveredAmount] = useState(String(claim.billedAmount))
  const [denialReason, setDenialReason] = useState('')

  const save = useMutation(() => billingAPI.updateClaimStatus(claim._id, { status, coveredAmount, denialReason }), {
    onSuccess: () => { toast.success('Claim updated'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not update the claim')),
  })

  return (
    <Modal title={`Update ${claim.claimNumber}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="New status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </Field>
        {status === 'approved' && (
          <>
            <Field label={`Covered amount (billed ${money(claim.billedAmount)})`}>
              <input required type="number" min="0.01" step="0.01" max={claim.billedAmount} className={inputCls} value={coveredAmount} onChange={(e) => setCoveredAmount(e.target.value)} />
            </Field>
            <p className="text-xs text-slate-500">Approving records the covered amount as an insurance payment on the invoice.</p>
          </>
        )}
        {status === 'denied' && (
          <Field label="Reason for denial"><input required className={inputCls} value={denialReason} onChange={(e) => setDenialReason(e.target.value)} /></Field>
        )}
        <FormActions onClose={onClose} busy={save.isLoading} label="Update claim" />
      </form>
    </Modal>
  )
}

// ---------- page ----------
const BillingClaims = () => {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('invoices')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)

  const invoicesQ = useQuery('invoices', () => billingAPI.getInvoices())
  const claimsQ = useQuery('claims', () => billingAPI.getClaims())
  const txnQ = useQuery('transactions', () => billingAPI.getTransactions())
  const patientsQ = useQuery('patients', () => patientsAPI.getAll())

  const invoices = pick(invoicesQ.data, 'invoices')
  const claims = pick(claimsQ.data, 'claims')
  const txns = pick(txnQ.data, 'transactions')
  const patients = pick(patientsQ.data, 'patients')

  const refresh = () => {
    queryClient.invalidateQueries('invoices')
    queryClient.invalidateQueries('claims')
    queryClient.invalidateQueries('transactions')
  }

  const sendInvoice = useMutation((id) => billingAPI.sendInvoice(id), {
    onSuccess: () => { toast.success('Invoice marked as sent'); refresh() },
    onError: (err) => toast.error(msg(err, 'Could not send this invoice')),
  })
  const resubmit = useMutation((id) => billingAPI.resubmitClaim(id), {
    onSuccess: () => { toast.success('Claim resubmitted'); refresh() },
    onError: (err) => toast.error(msg(err, 'Could not resubmit this claim')),
  })

  const switchTab = (key) => { setTab(key); setSearch(''); setFilter('all') }
  const openInvoices = invoices.filter((i) => !['paid', 'refunded'].includes(i.status) && i.balance > 0)
  const detailInvoice = modal?.type === 'detail' ? invoices.find((i) => i._id === modal.id) : null

  // summary strip
  const stats = useMemo(() => {
    const now = new Date()
    const outstanding = invoices.filter((i) => i.status !== 'draft').reduce((s, i) => s + Math.max(i.balance, 0), 0)
    const overdue = invoices.filter((i) => i.displayStatus === 'overdue')
    const monthNet = txns
      .filter((t) => { const d = new Date(t.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
      .reduce((s, t) => s + (t.type === 'refund' ? -t.amount : t.amount), 0)
    return { outstanding, overdueCount: overdue.length, overdueAmount: overdue.reduce((s, i) => s + i.balance, 0), monthNet }
  }, [invoices, txns])

  const q = search.trim().toLowerCase()
  const shownInvoices = invoices.filter((i) =>
    (filter === 'all' || i.displayStatus === filter) &&
    (!q || `${i.invoiceNumber} ${nameOf(i.patientId)}`.toLowerCase().includes(q)))
  const shownClaims = claims.filter((c) =>
    (filter === 'all' || c.status === filter) &&
    (!q || `${c.claimNumber} ${c.provider} ${nameOf(c.patientId)}`.toLowerCase().includes(q)))
  const shownTxns = txns.filter((t) =>
    (filter === 'all' || t.type === filter) &&
    (!q || `${t.invoiceId?.invoiceNumber || ''} ${nameOf(t.patientId)}`.toLowerCase().includes(q)))
  const txnTotals = shownTxns.reduce(
    (a, t) => (t.type === 'refund' ? { ...a, refunds: a.refunds + t.amount } : { ...a, payments: a.payments + t.amount }),
    { payments: 0, refunds: 0 }
  )

  const filterOptions = {
    invoices: Object.entries(INVOICE_STATUS).map(([k, v]) => [k, v.label]),
    claims: Object.entries(CLAIM_STATUS).map(([k, v]) => [k, v.label]),
    transactions: [['payment', 'Payments'], ['refund', 'Refunds']],
  }[tab]

  const headerButtons = (
    <div className="flex flex-wrap gap-2">
      {tab === 'invoices' && (
        <button type="button" onClick={() => setModal({ type: 'invoice' })} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
          <Plus className="h-4 w-4" />New invoice
        </button>
      )}
      {tab === 'claims' && (
        <button type="button" onClick={() => setModal({ type: 'claim' })} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
          <Plus className="h-4 w-4" />New claim
        </button>
      )}
      {tab === 'transactions' && (
        <button type="button" onClick={() => setModal({ type: 'payment' })} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
          <Plus className="h-4 w-4" />Record payment
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing and claims</h1>
          <p className="text-sm text-slate-500">Invoices, insurance claims, payments and refunds.</p>
        </div>
        {headerButtons}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Outstanding balance</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(stats.outstanding)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Overdue</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{money(stats.overdueAmount)}</div>
          <div className="text-xs text-slate-500">{stats.overdueCount} invoice{stats.overdueCount === 1 ? '' : 's'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Collected this month (after refunds)</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(stats.monthNet)}</div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search by number or patient" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${inputCls} sm:w-48`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            {filterOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>

        {/* Invoices */}
        {tab === 'invoices' && (
          invoicesQ.isLoading ? <p className="p-6 text-sm text-slate-500">Loading invoices...</p>
          : shownInvoices.length === 0 ? <p className="p-6 text-sm text-slate-500">{invoices.length === 0 ? 'No invoices yet. Select New invoice to create the first one.' : 'No invoices match this search.'}</p>
          : (
            <ul className="divide-y divide-slate-100">
              {shownInvoices.map((i) => (
                <li key={i._id}>
                  <button type="button" onClick={() => setModal({ type: 'detail', id: i._id })} className="flex w-full flex-col gap-2 p-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">{i.invoiceNumber}</div>
                      <div className="truncate text-xs text-slate-500">{nameOf(i.patientId)}, due {fmtDate(i.dueDate)}</div>
                    </div>
                    <div className="text-sm text-slate-700 sm:w-28 sm:text-right">{money(i.total)}</div>
                    <div className="text-xs text-slate-500 sm:w-28 sm:text-right">Balance {money(i.balance)}</div>
                    <div className="sm:w-28 sm:text-right"><Badge map={INVOICE_STATUS} status={i.displayStatus} /></div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {/* Claims */}
        {tab === 'claims' && (
          claimsQ.isLoading ? <p className="p-6 text-sm text-slate-500">Loading claims...</p>
          : shownClaims.length === 0 ? <p className="p-6 text-sm text-slate-500">{claims.length === 0 ? 'No insurance claims yet.' : 'No claims match this search.'}</p>
          : (
            <ul className="divide-y divide-slate-100">
              {shownClaims.map((c) => (
                <li key={c._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{c.claimNumber}, {c.provider}</div>
                    <div className="truncate text-xs text-slate-500">
                      {nameOf(c.patientId)}, invoice {c.invoiceId?.invoiceNumber}{c.resubmissions > 0 ? `, resubmitted ${c.resubmissions}x` : ''}
                    </div>
                    {c.status === 'denied' && c.denialReason && <div className="text-xs text-red-700">Denied: {c.denialReason}</div>}
                  </div>
                  <div className="text-xs text-slate-600 sm:w-40 sm:text-right">
                    Billed {money(c.billedAmount)}<br />Covered {money(c.coveredAmount)}
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge map={CLAIM_STATUS} status={c.status} />
                    {c.status === 'denied' ? (
                      <button type="button" onClick={() => resubmit.mutate(c._id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Resubmit</button>
                    ) : c.status !== 'approved' ? (
                      <button type="button" onClick={() => setModal({ type: 'claimStatus', claim: c })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Update</button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* Payments and refunds */}
        {tab === 'transactions' && (
          txnQ.isLoading ? <p className="p-6 text-sm text-slate-500">Loading transactions...</p>
          : shownTxns.length === 0 ? <p className="p-6 text-sm text-slate-500">{txns.length === 0 ? 'No payments or refunds recorded yet.' : 'Nothing matches this search.'}</p>
          : (
            <>
              <ul className="divide-y divide-slate-100">
                {shownTxns.map((t) => (
                  <li key={t._id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">
                        {t.type === 'refund' ? 'Refund' : 'Payment'}, {t.invoiceId?.invoiceNumber}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {nameOf(t.patientId)}, {methodLabel(t.method)}, {fmtDate(t.createdAt)}
                        {t.recordedBy ? `, by ${nameOf(t.recordedBy)}` : ''}{t.reason ? `, ${t.reason}` : ''}
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${t.type === 'refund' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {t.type === 'refund' ? '-' : '+'}{money(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-slate-100 p-4 text-sm">
                <span className="text-slate-600">Payments {money(txnTotals.payments)}</span>
                <span className="text-slate-600">Refunds {money(txnTotals.refunds)}</span>
                <span className="font-semibold text-slate-900">Net {money(txnTotals.payments - txnTotals.refunds)}</span>
              </div>
            </>
          )
        )}
      </section>

      {modal?.type === 'invoice' && <InvoiceModal patients={patients} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'payment' && <PaymentModal invoice={modal.invoice} invoices={openInvoices} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'refund' && <RefundModal invoice={modal.invoice} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'claim' && <ClaimModal presetInvoice={modal.invoice} invoices={openInvoices} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'claimStatus' && <ClaimStatusModal claim={modal.claim} onClose={() => setModal(null)} onSaved={refresh} />}
      {detailInvoice && (
        <InvoiceDetail
          invoice={detailInvoice}
          txns={txns.filter((t) => t.invoiceId?._id === detailInvoice._id)}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSent={() => sendInvoice.mutate(detailInvoice._id)}
          onPay={() => setModal({ type: 'payment', invoice: detailInvoice })}
          onRefund={() => setModal({ type: 'refund', invoice: detailInvoice })}
          onClaim={() => setModal({ type: 'claim', invoice: detailInvoice })}
        />
      )}
    </div>
  )
}

export default BillingClaims
