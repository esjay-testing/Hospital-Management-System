import React, { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import {
  Users,
  UserCheck,
  Calendar,
  DollarSign,
  Home,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { appointmentsAPI, patientsAPI, doctorsAPI, healthCardsAPI, schedulingAPI, billingAPI } from '../../services/api'

// ---------- helpers ----------
const pick = (res, key) => res?.data?.data?.[key] || res?.data?.[key] || []
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
const money = (n) => `$${Number(n || 0).toLocaleString()}`
const idOf = (v) => (v && typeof v === 'object' ? v._id : v)

// Maps the backend's appointment fields to the front-desk statuses.
const flowStatus = (a) => {
  if (a.status === 'completed') return 'completed'
  if (a.status === 'cancelled') return 'cancelled'
  if (a.status === 'no_show') return 'no_show'
  if (a.checkedIn) return 'checked_in'
  return 'scheduled'
}

const STATUS = {
  scheduled: { label: 'Scheduled', cls: 'bg-slate-100 text-slate-700' },
  checked_in: { label: 'Checked in', cls: 'bg-teal-50 text-teal-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  no_show: { label: 'No-show', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-amber-50 text-amber-700' },
}

const StatusBadge = ({ status }) => {
  const s = STATUS[status]
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

const KpiCard = ({ icon: Icon, label, value, note, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-4 ${className}`}>
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <Icon className="h-5 w-5 text-teal-600" />
    </div>
    <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
  </div>
)

// ---------- page ----------
const AdminOverview = () => {
  const queryClient = useQueryClient()

  const apptQ = useQuery('appointments', () => appointmentsAPI.getAll())
  const patientsQ = useQuery('patients', () => patientsAPI.getAll())
  const doctorsQ = useQuery('doctors', () => doctorsAPI.getAll())
  const requestsQ = useQuery('health-card-requests', () => healthCardsAPI.getAllRequests())
  const roomsQ = useQuery('rooms', () => schedulingAPI.getRooms())
  const txnQ = useQuery('transactions', () => billingAPI.getTransactions())
  const invoicesQ = useQuery('invoices', () => billingAPI.getInvoices())
  const claimsQ = useQuery('claims', () => billingAPI.getClaims())

  const checkIn = useMutation((id) => appointmentsAPI.checkIn(id), {
    onSuccess: () => {
      toast.success('Patient checked in')
      queryClient.invalidateQueries('appointments')
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not check in this patient'),
  })

  const refreshAll = () => {
    queryClient.invalidateQueries('appointments')
    queryClient.invalidateQueries('patients')
    queryClient.invalidateQueries('doctors')
    queryClient.invalidateQueries('health-card-requests')
    queryClient.invalidateQueries('rooms')
    queryClient.invalidateQueries('transactions')
    queryClient.invalidateQueries('invoices')
    queryClient.invalidateQueries('claims')
  }

  const data = useMemo(() => {
    const appointments = pick(apptQ.data, 'appointments')
    const patients = pick(patientsQ.data, 'patients')
    const doctors = pick(doctorsQ.data, 'doctors')
    const requests = pick(requestsQ.data, 'requests')
    const now = new Date()

    const today = appointments
      .filter((a) => sameDay(a.appointmentDate, now))
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

    const counts = { scheduled: 0, checked_in: 0, completed: 0, no_show: 0, cancelled: 0 }
    today.forEach((a) => { counts[flowStatus(a)] += 1 })

    // Revenue = consultation fee of each paid appointment.
    const feeByDoctor = {}
    doctors.forEach((d) => { feeByDoctor[d._id] = d.consultationFee || 0 })
    let revenueToday = 0
    let revenueMonth = 0
    appointments.filter((a) => a.paymentStatus).forEach((a) => {
      const paidOn = new Date(a.paidAt || a.appointmentDate)
      const fee = feeByDoctor[idOf(a.doctorId)] || 0
      if (sameDay(paidOn, now)) revenueToday += fee
      if (paidOn.getMonth() === now.getMonth() && paidOn.getFullYear() === now.getFullYear()) revenueMonth += fee
    })

    // Once billing has recorded payments, revenue comes from them (payments minus refunds).
    const txns = pick(txnQ.data, 'transactions')
    let revenueSource = 'consultation fees'
    if (txns.length > 0) {
      revenueSource = 'payments'
      revenueToday = 0
      revenueMonth = 0
      txns.forEach((t) => {
        const d = new Date(t.createdAt)
        const signed = t.type === 'refund' ? -t.amount : t.amount
        if (sameDay(d, now)) revenueToday += signed
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) revenueMonth += signed
      })
    }

    const overdueInvoices = pick(invoicesQ.data, 'invoices').filter((i) => i.displayStatus === 'overdue').length
    const claims = pick(claimsQ.data, 'claims')
    const deniedClaims = claims.filter((c) => c.status === 'denied').length
    const pendingClaims = claims.filter((c) => ['submitted', 'under_review'].includes(c.status)).length

    const activeDoctors = doctors.filter((d) => d.isActive !== false)
    const unavailableDoctors = activeDoctors.filter((d) => d.isAvailable === false).length
    const unpaidCompleted = appointments.filter((a) => a.status === 'completed' && !a.paymentStatus).length
    const pendingCards = requests.filter((r) => r.status === 'pending').length

    const alerts = []
    if (counts.scheduled > 0) alerts.push({ tone: 'amber', text: `${counts.scheduled} appointment${counts.scheduled > 1 ? 's' : ''} today not checked in yet` })
    if (unpaidCompleted > 0) alerts.push({ tone: 'amber', text: `${unpaidCompleted} completed visit${unpaidCompleted > 1 ? 's' : ''} with no payment recorded` })
    if (pendingCards > 0) alerts.push({ tone: 'amber', text: `${pendingCards} health card request${pendingCards > 1 ? 's' : ''} waiting for review` })
    if (unavailableDoctors > 0) alerts.push({ tone: 'amber', text: `${unavailableDoctors} doctor${unavailableDoctors > 1 ? 's' : ''} marked unavailable` })
    if (overdueInvoices > 0) alerts.push({ tone: 'red', text: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}` })
    if (deniedClaims > 0) alerts.push({ tone: 'red', text: `${deniedClaims} insurance claim${deniedClaims > 1 ? 's were' : ' was'} denied and may need resubmitting` })
    if (pendingClaims > 0) alerts.push({ tone: 'amber', text: `${pendingClaims} insurance claim${pendingClaims > 1 ? 's' : ''} waiting for a decision` })
    if (counts.no_show > 0) alerts.push({ tone: 'red', text: `${counts.no_show} no-show${counts.no_show > 1 ? 's' : ''} today` })

    return { today, counts, patients, activeDoctors, revenueToday, revenueMonth, revenueSource, alerts }
  }, [apptQ.data, patientsQ.data, doctorsQ.data, requestsQ.data, txnQ.data, invoicesQ.data, claimsQ.data])

  const rooms = pick(roomsQ.data, 'rooms')
  const roomSummary = roomsQ.data?.data?.data?.summary
  const roomsByUnit = useMemo(() => {
    const map = {}
    rooms.forEach((r) => { (map[r.unit] = map[r.unit] || []).push(r) })
    return map
  }, [rooms])

  const loading = apptQ.isLoading || patientsQ.isLoading || doctorsQ.isLoading
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Operations overview</h1>
          <p className="text-sm text-slate-500">{dateLabel}</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {apptQ.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Appointments could not be loaded. Check your connection and select Refresh.
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={Users} label="Total patients" value={loading ? '...' : data.patients.length} />
        <KpiCard icon={UserCheck} label="Active doctors" value={loading ? '...' : data.activeDoctors.length} />
        <KpiCard icon={Calendar} label="Appointments today" value={loading ? '...' : data.today.length} />
        <KpiCard
          icon={DollarSign}
          label="Revenue today"
          value={loading ? '...' : money(data.revenueToday)}
          note={loading ? '' : `${money(data.revenueMonth)} this month, from ${data.revenueSource}`}
        />
        <KpiCard
          icon={Home}
          label="Bed and room occupancy"
          value={roomsQ.isLoading ? '...' : roomSummary && roomSummary.total > 0 ? `${roomSummary.occupancyPercent}%` : 'Not set up'}
          note={roomSummary && roomSummary.total > 0 ? `${roomSummary.occupied} of ${roomSummary.total} occupied` : 'Add rooms under Scheduling'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Bed and room occupancy by unit */}
      {rooms.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Beds and rooms</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" />Available</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500" />Occupied</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-500" />Cleaning</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(roomsByUnit).map(([unit, list]) => {
              const busy = list.filter((r) => r.status === 'occupied').length
              return (
                <div key={unit}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{unit}</span>
                    <span className="text-slate-500">{busy} of {list.length} occupied</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((r) => {
                      const color = r.status === 'occupied' ? 'bg-amber-500' : r.status === 'cleaning' ? 'bg-sky-500' : 'bg-emerald-500'
                      const who = r.patientId ? `, ${r.patientId.firstName} ${r.patientId.lastName}` : ''
                      return <span key={r._id} title={`${r.name}: ${r.status}${who}`} className={`h-6 w-6 rounded ${color}`} />
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Change a room's status under Scheduling, then Rooms and beds.</p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's flow */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">Today's front desk</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.keys(STATUS).map((key) => (
                <span key={key} className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[key].cls}`}>
                  {STATUS[key].label}: {data.counts[key]}
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading today's appointments...</p>
          ) : data.today.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No appointments are booked for today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.today.map((a) => {
                const status = flowStatus(a)
                const patient = a.patientId || {}
                const doctor = a.doctorId || {}
                const canCheckIn = status === 'scheduled'
                return (
                  <li key={a._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex w-24 shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {a.startTime}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {patient.firstName ? `${patient.firstName} ${patient.lastName}` : a.patientName || 'Patient'}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        Dr. {doctor.lastName || a.doctorName || 'Unassigned'}
                        {a.reason ? `, ${a.reason}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={status} />
                      {canCheckIn && (
                        <button
                          type="button"
                          onClick={() => checkIn.mutate(a._id)}
                          disabled={checkIn.isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Check in
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Alerts */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">Needs attention</h2>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Checking...</p>
          ) : data.alerts.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nothing needs attention right now.</p>
          ) : (
            <ul className="space-y-2 p-4">
              {data.alerts.map((al, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                    al.tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{al.text}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 p-4 text-xs text-slate-500">
            Pharmacy stock alerts will appear here once the Inventory module is added.
          </p>
        </section>
      </div>
    </div>
  )
}

export default AdminOverview
