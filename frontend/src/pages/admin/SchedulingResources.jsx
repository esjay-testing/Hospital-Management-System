import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import { schedulingAPI, doctorsAPI, patientsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

// ---------- constants and helpers ----------
const TABS = [
  { key: 'departments', label: 'Departments' },
  { key: 'timetables', label: 'Doctor timetables' },
  { key: 'rooms', label: 'Rooms and beds' },
  { key: 'allocation', label: 'Room allocation' },
]
const DAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' }, { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
]
const ROOM_STATUS = {
  available: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700' },
  occupied: { label: 'Occupied', cls: 'bg-amber-50 text-amber-700' },
  cleaning: { label: 'Cleaning or maintenance', cls: 'bg-sky-50 text-sky-700' },
}
const KIND_LABEL = { bed: 'Bed', consultation: 'Consultation room', suite: 'Procedure suite' }

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600'

const pick = (res, key) => res?.data?.data?.[key] || []
const msg = (err, fallback) => err?.response?.data?.message || fallback
const idOf = (v) => (v && typeof v === 'object' ? v._id : v)
const todayStr = () => new Date().toISOString().slice(0, 10)

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm text-slate-600">{label}</span>
    {children}
  </label>
)

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={onClose}>
    <div
      className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl"
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

const FormActions = ({ onClose, busy, label, extra }) => (
  <div className="flex items-center justify-between gap-2 pt-2">
    <div>{extra}</div>
    <div className="flex gap-2">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
        Cancel
      </button>
      <button type="submit" disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
        {busy ? 'Saving...' : label}
      </button>
    </div>
  </div>
)

const docName = (d) => (d ? `Dr. ${d.firstName} ${d.lastName}` : '')

// ---------- modals ----------
const DepartmentModal = ({ dept, doctors, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: dept?.name || '',
    head: idOf(dept?.head) || '',
    description: dept?.description || '',
    status: dept?.status || 'active',
  })
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }))

  const save = useMutation(
    () => (dept ? schedulingAPI.updateDepartment(dept._id, form) : schedulingAPI.createDepartment(form)),
    {
      onSuccess: () => { toast.success('Department saved'); onSaved(); onClose() },
      onError: (err) => toast.error(msg(err, 'Could not save the department')),
    }
  )

  return (
    <Modal title={dept ? 'Edit department' : 'Add department'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="Name"><input required className={inputCls} value={form.name} onChange={set('name')} /></Field>
        <Field label="Department head">
          <select className={inputCls} value={form.head} onChange={set('head')}>
            <option value="">Not assigned</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{docName(d)}</option>)}
          </select>
        </Field>
        <Field label="Description"><input className={inputCls} value={form.description} onChange={set('description')} /></Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Save department" />
      </form>
    </Modal>
  )
}

const ShiftModal = ({ shift, presetDoctor, presetDay, doctors, rooms, onClose, onSaved }) => {
  const [form, setForm] = useState({
    doctorId: idOf(shift?.doctorId) || presetDoctor || '',
    dayOfWeek: shift?.dayOfWeek ?? presetDay ?? 1,
    startTime: shift?.startTime || '08:00',
    endTime: shift?.endTime || '12:00',
    roomId: idOf(shift?.roomId) || '',
  })
  const [error, setError] = useState('')
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }))
  const usableRooms = rooms.filter((r) => r.kind !== 'bed')

  const save = useMutation(
    () => (shift
      ? schedulingAPI.updateSchedule(shift._id, form)
      : schedulingAPI.createSchedule({ ...form, kind: 'shift' })),
    {
      onSuccess: () => { toast.success('Shift saved'); onSaved(); onClose() },
      onError: (err) => setError(msg(err, 'Could not save this shift')),
    }
  )
  const remove = useMutation(() => schedulingAPI.deleteSchedule(shift._id), {
    onSuccess: () => { toast.success('Shift removed'); onSaved(); onClose() },
    onError: (err) => setError(msg(err, 'Could not remove this shift')),
  })

  return (
    <Modal title={shift ? 'Edit shift' : 'Add shift'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate() }} className="space-y-3">
        <Field label="Doctor">
          <select required disabled={!!shift} className={inputCls} value={form.doctorId} onChange={set('doctorId')}>
            <option value="">Choose a doctor</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{docName(d)}</option>)}
          </select>
        </Field>
        <Field label="Day">
          <select className={inputCls} value={form.dayOfWeek} onChange={set('dayOfWeek')}>
            {DAYS.map((d) => <option key={d.d} value={d.d}>{d.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><input required type="time" className={inputCls} value={form.startTime} onChange={set('startTime')} /></Field>
          <Field label="Ends"><input required type="time" className={inputCls} value={form.endTime} onChange={set('endTime')} /></Field>
        </div>
        <Field label="Consultation room or suite">
          <select className={inputCls} value={form.roomId} onChange={set('roomId')}>
            <option value="">No room assigned</option>
            {usableRooms.map((r) => <option key={r._id} value={r._id}>{r.name} ({r.unit})</option>)}
          </select>
        </Field>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <FormActions
          onClose={onClose}
          busy={save.isLoading}
          label="Save shift"
          extra={shift && (
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isLoading} className="text-sm text-red-600 hover:underline">
              Remove shift
            </button>
          )}
        />
      </form>
    </Modal>
  )
}

const LeaveModal = ({ presetDoctor, doctors, onClose, onSaved }) => {
  const [form, setForm] = useState({ doctorId: presetDoctor || '', date: todayStr(), note: '' })
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }))

  const save = useMutation(() => schedulingAPI.createSchedule({ ...form, kind: 'leave' }), {
    onSuccess: () => { toast.success('Leave day added'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not add this leave day')),
  })

  return (
    <Modal title="Add leave day" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="Doctor">
          <select required className={inputCls} value={form.doctorId} onChange={set('doctorId')}>
            <option value="">Choose a doctor</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{docName(d)}</option>)}
          </select>
        </Field>
        <Field label="Date"><input required type="date" className={inputCls} value={form.date} onChange={set('date')} /></Field>
        <Field label="Reason (optional)"><input className={inputCls} value={form.note} onChange={set('note')} /></Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Add leave day" />
      </form>
    </Modal>
  )
}

const RoomModal = ({ units, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', unit: '', kind: 'bed' })
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }))

  const save = useMutation(() => schedulingAPI.createRoom(form), {
    onSuccess: () => { toast.success('Room added'); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not add this room')),
  })

  return (
    <Modal title="Add room or bed" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="Name or number"><input required className={inputCls} value={form.name} onChange={set('name')} placeholder="Bed 12" /></Field>
        <Field label="Unit">
          <input required list="unit-options" className={inputCls} value={form.unit} onChange={set('unit')} placeholder="General Ward" />
          <datalist id="unit-options">
            {['General Ward', 'ICU', 'Consultation Rooms', 'Imaging Suites', ...units]
              .filter((u, i, a) => a.indexOf(u) === i)
              .map((u) => <option key={u} value={u} />)}
          </datalist>
        </Field>
        <Field label="Type">
          <select className={inputCls} value={form.kind} onChange={set('kind')}>
            <option value="bed">Bed</option>
            <option value="consultation">Consultation room</option>
            <option value="suite">Procedure suite</option>
          </select>
        </Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Add room" />
      </form>
    </Modal>
  )
}

const OccupyModal = ({ room, patients, doctors, onClose, onSaved }) => {
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')

  const save = useMutation(() => schedulingAPI.setRoomStatus(room._id, { status: 'occupied', patientId, doctorId }), {
    onSuccess: () => { toast.success(`${room.name} marked occupied`); onSaved(); onClose() },
    onError: (err) => toast.error(msg(err, 'Could not update this room')),
  })

  return (
    <Modal title={`Mark ${room.name} occupied`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-3">
        <Field label="Patient (optional)">
          <select className={inputCls} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Not recorded</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
        <Field label="Doctor in charge (optional)">
          <select className={inputCls} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Not recorded</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{docName(d)}</option>)}
          </select>
        </Field>
        <FormActions onClose={onClose} busy={save.isLoading} label="Mark occupied" />
      </form>
    </Modal>
  )
}

// ---------- page ----------
const SchedulingResources = () => {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('departments')
  const [modal, setModal] = useState(null)

  const doctorsQ = useQuery('doctors', () => doctorsAPI.getAll())
  const patientsQ = useQuery('patients', () => patientsAPI.getAll())
  const deptQ = useQuery('departments', () => schedulingAPI.getDepartments())
  const roomsQ = useQuery('rooms', () => schedulingAPI.getRooms())
  const schedQ = useQuery('schedules', () => schedulingAPI.getSchedules())

  const doctors = pick(doctorsQ.data, 'doctors')
  const patients = pick(patientsQ.data, 'patients')
  const departments = pick(deptQ.data, 'departments')
  const rooms = pick(roomsQ.data, 'rooms')
  const schedules = pick(schedQ.data, 'schedules')
  const summary = roomsQ.data?.data?.data?.summary

  const refresh = () => {
    queryClient.invalidateQueries('departments')
    queryClient.invalidateQueries('rooms')
    queryClient.invalidateQueries('schedules')
  }

  const setStatus = useMutation(({ id, status }) => schedulingAPI.setRoomStatus(id, { status }), {
    onSuccess: refresh,
    onError: (err) => toast.error(msg(err, 'Could not update this room')),
  })
  const removeRoom = useMutation((id) => schedulingAPI.deleteRoom(id), {
    onSuccess: () => { toast.success('Room removed'); refresh() },
    onError: (err) => toast.error(msg(err, 'Could not remove this room')),
  })
  const removeLeave = useMutation((id) => schedulingAPI.deleteSchedule(id), {
    onSuccess: refresh,
    onError: (err) => toast.error(msg(err, 'Could not remove this leave day')),
  })

  const shifts = schedules.filter((s) => s.kind === 'shift')
  const leaves = schedules.filter((s) => s.kind === 'leave' && s.date >= todayStr())
  const units = useMemo(() => [...new Set(rooms.map((r) => r.unit))], [rooms])

  const roomsByUnit = useMemo(() => {
    const map = {}
    rooms.forEach((r) => { (map[r.unit] = map[r.unit] || []).push(r) })
    return map
  }, [rooms])

  const headerAction = () => {
    if (!isAdmin) return null
    const actions = {
      departments: { label: 'Add department', onClick: () => setModal({ type: 'dept' }) },
      timetables: { label: 'Add shift', onClick: () => setModal({ type: 'shift' }) },
      rooms: { label: 'Add room or bed', onClick: () => setModal({ type: 'room' }) },
    }
    const a = actions[tab]
    if (!a) return null
    return (
      <button type="button" onClick={a.onClick} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
        <Plus className="h-4 w-4" />
        {a.label}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Scheduling and resources</h1>
          <p className="text-sm text-slate-500">Departments, doctor shifts, and the rooms and beds they use.</p>
        </div>
        {headerAction()}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Departments */}
      {tab === 'departments' && (
        deptQ.isLoading ? <p className="text-sm text-slate-500">Loading departments...</p>
        : departments.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No departments yet.{isAdmin ? ' Select Add department to create the first one.' : ''}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <div key={d._id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{d.name}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {d.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {d.description && <p className="mt-1 text-sm text-slate-500">{d.description}</p>}
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Head</dt><dd className="text-slate-800">{d.head ? docName(d.head) : 'Not assigned'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Active staff</dt><dd className="text-slate-800">{d.staffCount}</dd></div>
                </dl>
                {isAdmin && (
                  <button type="button" onClick={() => setModal({ type: 'dept', dept: d })} className="mt-3 text-sm font-medium text-teal-700 hover:underline">
                    Edit
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Doctor timetables */}
      {tab === 'timetables' && (
        <section className="rounded-xl border border-slate-200 bg-white">
          {doctors.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No doctors to schedule yet. Add doctors under Users first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="w-48 p-3 font-medium">Doctor</th>
                    {DAYS.map((d) => <th key={d.d} className="p-3 font-medium">{d.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doc) => {
                    const myLeaves = leaves.filter((l) => idOf(l.doctorId) === doc._id)
                    return (
                      <tr key={doc._id} className="border-b border-slate-50 align-top">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{docName(doc)}</div>
                          <div className="text-xs text-slate-500">{doc.specialization}</div>
                          {myLeaves.map((l) => (
                            <div key={l._id} className="mt-1 flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                              <span>Leave {l.date}{l.note ? `, ${l.note}` : ''}</span>
                              {isAdmin && (
                                <button type="button" aria-label="Remove leave day" onClick={() => removeLeave.mutate(l._id)}>
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {isAdmin && (
                            <button type="button" onClick={() => setModal({ type: 'leave', doctor: doc._id })} className="mt-1 text-xs font-medium text-teal-700 hover:underline">
                              Add leave day
                            </button>
                          )}
                        </td>
                        {DAYS.map((day) => {
                          const cell = shifts.filter((s) => idOf(s.doctorId) === doc._id && s.dayOfWeek === day.d)
                          return (
                            <td key={day.d} className="p-2">
                              <div className="space-y-1">
                                {cell.map((s) => (
                                  <button
                                    key={s._id}
                                    type="button"
                                    disabled={!isAdmin}
                                    onClick={() => setModal({ type: 'shift', shift: s })}
                                    className="block w-full rounded-lg bg-teal-50 px-2 py-1 text-left text-xs text-teal-800 enabled:hover:bg-teal-100"
                                  >
                                    {s.startTime} to {s.endTime}
                                    {s.roomId?.name ? <span className="block text-teal-600">{s.roomId.name}</span> : null}
                                  </button>
                                ))}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    aria-label={`Add shift for ${docName(doc)} on ${day.label}`}
                                    onClick={() => setModal({ type: 'shift', doctor: doc._id, day: day.d })}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Rooms and beds */}
      {tab === 'rooms' && (
        <div className="space-y-4">
          {summary && (
            <p className="text-sm text-slate-600">
              {summary.occupied} of {summary.total} occupied ({summary.occupancyPercent}%), {summary.available} available, {summary.cleaning} cleaning or in maintenance.
            </p>
          )}
          {roomsQ.isLoading ? <p className="text-sm text-slate-500">Loading rooms...</p>
          : rooms.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No rooms or beds yet.{isAdmin ? ' Select Add room or bed to set up your first unit.' : ''}
            </p>
          ) : (
            Object.entries(roomsByUnit).map(([unit, list]) => {
              const busy = list.filter((r) => r.status === 'occupied').length
              const pct = Math.round((busy / list.length) * 100)
              return (
                <section key={unit} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{unit}</h3>
                    <span className="text-sm text-slate-500">{busy} of {list.length} occupied</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((r) => (
                      <div key={r._id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{r.name}</div>
                            <div className="text-xs text-slate-500">{KIND_LABEL[r.kind]}</div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROOM_STATUS[r.status].cls}`}>
                            {ROOM_STATUS[r.status].label}
                          </span>
                        </div>
                        {r.status === 'occupied' && (r.patientId || r.doctorId) && (
                          <div className="mt-2 text-xs text-slate-600">
                            {r.patientId && <div>Patient: {r.patientId.firstName} {r.patientId.lastName}</div>}
                            {r.doctorId && <div>{docName(r.doctorId)}</div>}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {r.status !== 'available' && (
                            <button type="button" onClick={() => setStatus.mutate({ id: r._id, status: 'available' })} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                              Mark available
                            </button>
                          )}
                          {r.status !== 'occupied' && (
                            <button type="button" onClick={() => setModal({ type: 'occupy', room: r })} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                              Mark occupied
                            </button>
                          )}
                          {r.status !== 'cleaning' && (
                            <button type="button" onClick={() => setStatus.mutate({ id: r._id, status: 'cleaning' })} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                              Mark cleaning
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(`Remove ${r.name}?`)) removeRoom.mutate(r._id) }}
                              className="px-1 text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </div>
      )}

      {/* Room allocation */}
      {tab === 'allocation' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Each consultation room and suite with the doctors assigned to it by day. Saving a shift is blocked if it would double-book a room or a doctor.
          </p>
          {rooms.filter((r) => r.kind !== 'bed').length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No consultation rooms or suites yet. Add some on the Rooms and beds tab.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {rooms.filter((r) => r.kind !== 'bed').map((r) => {
                const mine = shifts.filter((s) => idOf(s.roomId) === r._id)
                return (
                  <div key={r._id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.unit}</div>
                    {mine.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">No doctor assigned yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-1 text-sm">
                        {DAYS.map((day) => mine.filter((s) => s.dayOfWeek === day.d).map((s) => (
                          <li key={s._id} className="flex justify-between gap-3">
                            <span className="text-slate-500">{day.label} {s.startTime} to {s.endTime}</span>
                            <span className="text-slate-800">{docName(s.doctorId)}</span>
                          </li>
                        )))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {modal?.type === 'dept' && (
        <DepartmentModal dept={modal.dept} doctors={doctors} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === 'shift' && (
        <ShiftModal shift={modal.shift} presetDoctor={modal.doctor} presetDay={modal.day} doctors={doctors} rooms={rooms} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === 'leave' && (
        <LeaveModal presetDoctor={modal.doctor} doctors={doctors} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.type === 'room' && <RoomModal units={units} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'occupy' && (
        <OccupyModal room={modal.room} patients={patients} doctors={doctors} onClose={() => setModal(null)} onSaved={refresh} />
      )}
    </div>
  )
}

export default SchedulingResources
