import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { Search, Plus, X, ChevronDown } from 'lucide-react'
import { usersAPI } from '../../services/api'
import { DEPARTMENT_SPECIALIZATIONS, DEPARTMENTS, DESKS, SHIFTS } from '../../data/departments'

// ---------- constants and helpers ----------
const TABS = [
  { key: 'doctor', label: 'Doctors', singular: 'doctor' },
  { key: 'staff', label: 'Staff', singular: 'staff member' },
  { key: 'patient', label: 'Patients', singular: 'patient' },
]

const WEEK = [
  { dow: 1, label: 'Monday', short: 'Mon' },
  { dow: 2, label: 'Tuesday', short: 'Tue' },
  { dow: 3, label: 'Wednesday', short: 'Wed' },
  { dow: 4, label: 'Thursday', short: 'Thu' },
  { dow: 5, label: 'Friday', short: 'Fri' },
  { dow: 6, label: 'Saturday', short: 'Sat' },
  { dow: 0, label: 'Sunday', short: 'Sun' },
]

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600'

const pad = (n) => String(n).padStart(2, '0')
const localKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const errorText = (err, fallback) => err?.response?.data?.message || fallback
const fullName = (u) => `${u.firstName} ${u.lastName}`
const unique = (list) => [...new Set(list.filter(Boolean))]

const time12 = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
const sexLabel = (g) => ({ male: 'Male', female: 'Female', other: 'Other' }[g] || 'Not recorded')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not recorded')
const ageOf = (dob) => {
  if (!dob) return null
  const b = new Date(dob)
  const n = new Date()
  let age = n.getFullYear() - b.getUTCFullYear()
  if (n.getMonth() < b.getUTCMonth() || (n.getMonth() === b.getUTCMonth() && n.getDate() < b.getUTCDate())) age -= 1
  return age
}

// Doctors saved before departments and specializations became lists still have single values.
const docDepartments = (u) => (u.departments?.length ? u.departments : u.department ? [u.department] : [])
const docSpecs = (u) => (u.specializations?.length ? u.specializations : u.specialization ? [u.specialization] : [])
const availableToday = (u, dow, key) =>
  u.isActive !== false && (u.schedule || []).some((s) => s.dayOfWeek === dow) && !(u.leaveDates || []).includes(key)

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm text-slate-600">{label}</span>
    {children}
  </label>
)

const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={onClose}>
    <div
      className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
)

// ---------- multi-select dropdown with pills ----------
const MultiSelectPills = ({ label, options, selected, onChange, placeholder, emptyHint }) => {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef(null)

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  const shown = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))

  return (
    <div ref={box}>
      <span className="mb-1 block text-sm text-slate-600">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        className="flex min-h-[42px] cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
      >
        {selected.length === 0 && <span className="px-1 text-sm text-slate-400">{placeholder}</span>}
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onClick={(e) => { e.stopPropagation(); toggle(s) }}
              className="rounded-full hover:bg-teal-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="mt-1 rounded-lg border border-slate-200 bg-white p-2">
          {options.length === 0 ? (
            <p className="p-2 text-sm text-slate-500">{emptyHint}</p>
          ) : (
            <>
              {options.length > 6 && (
                <input className={`${inputCls} mb-2`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              )}
              <ul className="max-h-48 overflow-y-auto">
                {shown.map((o) => (
                  <li key={o}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                      <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={selected.includes(o)} onChange={() => toggle(o)} />
                      {o}
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="p-2 text-sm text-slate-500">Nothing matches.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- weekly schedule setter ----------
const ScheduleSetter = ({ value, onChange }) => {
  const set = (dow, patch) => onChange(value.map((r) => (r.dayOfWeek === dow ? { ...r, ...patch } : r)))
  const first = value.find((r) => r.on)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">Days and hours available</span>
        {first && (
          <button
            type="button"
            onClick={() => onChange(value.map((r) => (r.on ? { ...r, startTime: first.startTime, endTime: first.endTime } : r)))}
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            Use the same hours for all selected days
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {WEEK.map((d) => {
          const row = value.find((r) => r.dayOfWeek === d.dow)
          return (
            <li key={d.dow} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label className="flex w-24 items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={row.on} onChange={(e) => set(d.dow, { on: e.target.checked })} />
                {d.label}
              </label>
              {row.on ? (
                <div className="flex items-center gap-2">
                  <input type="time" aria-label={`${d.label} start`} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={row.startTime} onChange={(e) => set(d.dow, { startTime: e.target.value })} />
                  <span className="text-sm text-slate-500">to</span>
                  <input type="time" aria-label={`${d.label} end`} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={row.endTime} onChange={(e) => set(d.dow, { endTime: e.target.value })} />
                </div>
              ) : (
                <span className="text-xs text-slate-400">Not available</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- add user ----------
const emptyForm = () => ({
  firstName: '', lastName: '', email: '', password: '', phone: '', dateOfBirth: '', gender: 'female',
  street: '', city: '', state: '', zipCode: '', country: '',
  departments: [], specializations: [], licenseNumber: '', experience: '',
  schedule: WEEK.map((d) => ({ dayOfWeek: d.dow, on: false, startTime: '08:00', endTime: '17:00' })),
  department: '', deskNumber: '', shift: 'Morning',
})

const AddUserModal = ({ role, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const tab = TABS.find((t) => t.key === role)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Specializations on offer depend on the departments chosen.
  const specOptions = useMemo(
    () => unique(form.departments.flatMap((d) => DEPARTMENT_SPECIALIZATIONS[d] || [])).sort(),
    [form.departments]
  )

  const setDepartments = (next) =>
    setForm((f) => {
      const allowed = unique(next.flatMap((d) => DEPARTMENT_SPECIALIZATIONS[d] || []))
      return { ...f, departments: next, specializations: f.specializations.filter((s) => allowed.includes(s)) }
    })

  const create = useMutation((payload) => usersAPI.create(payload), {
    onSuccess: () => {
      toast.success(`Added ${form.firstName} ${form.lastName}`)
      onCreated()
      onClose()
    },
    onError: (err) => setError(errorText(err, 'Could not add this user')),
  })

  const submit = (e) => {
    e.preventDefault()
    setError('')

    const payload = {
      role,
      firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password,
      phone: form.phone, dateOfBirth: form.dateOfBirth, gender: form.gender,
      address: { street: form.street, city: form.city, state: form.state, zipCode: form.zipCode, country: form.country },
    }

    if (role === 'doctor') {
      const days = form.schedule.filter((r) => r.on)
      if (form.departments.length === 0) return setError('Choose at least one department.')
      if (form.specializations.length === 0) return setError('Choose at least one specialization.')
      if (days.length === 0) return setError('Set at least one day the doctor is available.')
      if (days.some((r) => r.startTime >= r.endTime)) return setError('Each available day must end after it starts.')
      Object.assign(payload, {
        departments: form.departments,
        specializations: form.specializations,
        licenseNumber: form.licenseNumber,
        experience: form.experience,
        schedule: days.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime })),
      })
    }

    if (role === 'staff') {
      Object.assign(payload, { department: form.department, deskNumber: form.deskNumber, shift: form.shift })
    }

    create.mutate(payload)
  }

  return (
    <Modal title={`Add ${tab.singular}`} onClose={onClose} wide={role === 'doctor'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input required className={inputCls} value={form.firstName} onChange={set('firstName')} /></Field>
          <Field label="Last name"><input required className={inputCls} value={form.lastName} onChange={set('lastName')} /></Field>
        </div>
        <Field label="Email"><input required type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
        <Field label="Temporary password (at least 6 characters)">
          <input required minLength={6} type="text" className={inputCls} value={form.password} onChange={set('password')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input required className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Date of birth"><input required type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        </div>
        <Field label="Sex">
          <select className={inputCls} value={form.gender} onChange={set('gender')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>

        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Address</p>
          <Field label="Street"><input className={inputCls} value={form.street} onChange={set('street')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
            <Field label="Province or state"><input className={inputCls} value={form.state} onChange={set('state')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zip code"><input className={inputCls} value={form.zipCode} onChange={set('zipCode')} /></Field>
            <Field label="Country"><input className={inputCls} value={form.country} onChange={set('country')} /></Field>
          </div>
        </div>

        {role === 'doctor' && (
          <>
            <MultiSelectPills
              label="Departments"
              options={DEPARTMENTS}
              selected={form.departments}
              onChange={setDepartments}
              placeholder="Choose one or more departments"
              emptyHint="No departments are set up."
            />
            <MultiSelectPills
              label="Specializations"
              options={specOptions}
              selected={form.specializations}
              onChange={(next) => setForm((f) => ({ ...f, specializations: next }))}
              placeholder={form.departments.length ? 'Choose one or more specializations' : 'Choose a department first'}
              emptyHint="Choose a department first. The specializations for it will appear here."
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Medical license number"><input required className={inputCls} value={form.licenseNumber} onChange={set('licenseNumber')} /></Field>
              <Field label="Years of experience"><input type="number" min="0" className={inputCls} value={form.experience} onChange={set('experience')} /></Field>
            </div>
            <ScheduleSetter value={form.schedule} onChange={(schedule) => setForm((f) => ({ ...f, schedule }))} />
          </>
        )}

        {role === 'staff' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Department">
              <select required className={inputCls} value={form.department} onChange={set('department')}>
                <option value="">Choose</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Desk">
              <select required className={inputCls} value={form.deskNumber} onChange={set('deskNumber')}>
                <option value="">Choose</option>
                {DESKS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Shift">
              <select className={inputCls} value={form.shift} onChange={set('shift')}>
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={create.isLoading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            {create.isLoading ? 'Adding...' : `Add ${tab.singular}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- full personal information ----------
const Row = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
    <dt className="text-sm text-slate-500 sm:w-44 sm:shrink-0">{label}</dt>
    <dd className="text-sm text-slate-900">{children}</dd>
  </div>
)

const DetailsModal = ({ user, onClose }) => {
  const a = user.address || {}
  const address = [a.street, a.city, a.state, a.zipCode, a.country].filter(Boolean).join(', ')
  const age = ageOf(user.dateOfBirth)
  const active = user.isActive !== false

  return (
    <Modal title={fullName(user)} subtitle={TABS.find((t) => t.key === user.role)?.singular} onClose={onClose} wide>
      <dl className="divide-y divide-slate-100">
        <Row label="Sex">{sexLabel(user.gender)}</Row>
        <Row label="Date of birth">{fmtDate(user.dateOfBirth)}{age !== null ? `, ${age} years old` : ''}</Row>
        <Row label="Email">{user.email}</Row>
        <Row label="Phone">{user.phone || 'Not recorded'}</Row>
        <Row label="Address">{address || 'Not recorded'}</Row>
        <Row label="Account">{active ? 'Active' : 'Inactive'}, created {fmtDate(user.createdAt)}</Row>

        {user.role === 'doctor' && (
          <>
            <Row label="Departments">{docDepartments(user).join(', ') || 'Not assigned'}</Row>
            <Row label="Specializations">
              {docSpecs(user).length ? (
                <span className="flex flex-wrap gap-1.5">
                  {docSpecs(user).map((s) => <span key={s} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{s}</span>)}
                </span>
              ) : 'Not recorded'}
            </Row>
            <Row label="Medical license">{user.licenseNumber || 'Not recorded'}</Row>
            <Row label="Experience">{user.experience !== undefined && user.experience !== null ? `${user.experience} years` : 'Not recorded'}</Row>
            <Row label="Weekly schedule">
              {(user.schedule || []).length ? (
                <ul className="space-y-0.5">
                  {user.schedule.map((s) => (
                    <li key={s.dayOfWeek}>{WEEK.find((d) => d.dow === s.dayOfWeek)?.label}: {time12(s.startTime)} to {time12(s.endTime)}</li>
                  ))}
                </ul>
              ) : 'No schedule set'}
            </Row>
            {(user.leaveDates || []).filter((d) => d >= localKey()).length > 0 && (
              <Row label="Upcoming leave">{user.leaveDates.filter((d) => d >= localKey()).sort().join(', ')}</Row>
            )}
          </>
        )}

        {user.role === 'staff' && (
          <>
            <Row label="Department">{user.department || 'Not assigned'}</Row>
            <Row label="Desk">{user.deskNumber || 'Not assigned'}</Row>
            <Row label="Shift">{user.shift || 'Not assigned'}</Row>
          </>
        )}
      </dl>
      {user.role === 'patient' && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Medical information is not available to administrators.
        </p>
      )}
    </Modal>
  )
}

// ---------- confirm dialog ----------
const ConfirmDialog = ({ user, busy, onCancel, onConfirm }) => {
  const turningOff = user.isActive !== false
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">{turningOff ? 'Deactivate' : 'Activate'} {fullName(user)}?</h2>
        <p className="mt-2 text-sm text-slate-600">
          {turningOff
            ? 'They will be signed out and will not be able to log in until you activate the account again.'
            : 'They will be able to log in again.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${turningOff ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            {turningOff ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, note }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="text-sm text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
  </div>
)

const emptyFilters = { search: '', department: '', specialization: '', day: '', time: '', desk: '', shift: '', status: 'all' }

// ---------- page ----------
const UserManagement = () => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('doctor')
  const [filters, setFilters] = useState(emptyFilters)
  const [showAdd, setShowAdd] = useState(false)
  const [details, setDetails] = useState(null)
  const [confirmUser, setConfirmUser] = useState(null)

  const usersQ = useQuery(['users', tab], () => usersAPI.getAll(tab))
  const users = usersQ.data?.data?.data?.users || []
  const setFilter = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  const refreshUsers = () => {
    queryClient.invalidateQueries('users')
    queryClient.invalidateQueries('doctors')
    queryClient.invalidateQueries('patients')
    queryClient.invalidateQueries('admin-summary')
  }

  const setStatus = useMutation(({ id, isActive }) => usersAPI.setStatus(id, isActive), {
    onSuccess: (res) => {
      toast.success(res?.data?.message || 'Status updated')
      setConfirmUser(null)
      refreshUsers()
    },
    onError: (err) => toast.error(errorText(err, 'Could not change this account')),
  })

  const switchTab = (key) => { setTab(key); setFilters(emptyFilters) }

  // numbers at the top of each tab
  const todayDow = new Date().getDay()
  const todayKey = localKey()
  const counts = useMemo(() => {
    const active = users.filter((u) => u.isActive !== false)
    return {
      total: users.length,
      active: active.length,
      availableToday: users.filter((u) => availableToday(u, todayDow, todayKey)).length,
      perShift: SHIFTS.map((s) => ({ shift: s, count: active.filter((u) => u.shift === s).length })),
    }
  }, [users, todayDow, todayKey])

  // choices for the filters
  const departmentChoices = useMemo(
    () => unique([...DEPARTMENTS, ...users.flatMap((u) => (u.role === 'doctor' ? docDepartments(u) : [u.department]))]).sort(),
    [users]
  )
  const specializationChoices = useMemo(() => {
    if (filters.department && DEPARTMENT_SPECIALIZATIONS[filters.department]) {
      const inDept = users.filter((u) => docDepartments(u).includes(filters.department)).flatMap(docSpecs)
      return unique([...DEPARTMENT_SPECIALIZATIONS[filters.department], ...inDept]).sort()
    }
    return unique(users.flatMap(docSpecs)).sort()
  }, [users, filters.department])
  const deskChoices = useMemo(() => unique([...DESKS, ...users.map((u) => u.deskNumber)]).sort(), [users])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return users.filter((u) => {
      if (filters.status === 'active' && u.isActive === false) return false
      if (filters.status === 'inactive' && u.isActive !== false) return false
      if (q && !fullName(u).toLowerCase().includes(q)) return false

      if (u.role === 'doctor') {
        if (filters.department && !docDepartments(u).includes(filters.department)) return false
        if (filters.specialization && !docSpecs(u).includes(filters.specialization)) return false
        if (filters.day !== '' || filters.time) {
          const shifts = (u.schedule || []).filter((s) => filters.day === '' || s.dayOfWeek === Number(filters.day))
          const fits = shifts.some((s) => !filters.time || (s.startTime <= filters.time && filters.time < s.endTime))
          if (!fits) return false
        }
      }
      if (u.role === 'staff') {
        if (filters.department && u.department !== filters.department) return false
        if (filters.desk && u.deskNumber !== filters.desk) return false
        if (filters.shift && u.shift !== filters.shift) return false
      }
      return true
    })
  }, [users, filters])

  const currentTab = TABS.find((t) => t.key === tab)
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(emptyFilters)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Add people and switch their accounts on or off.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add {currentTab.singular}
        </button>
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

      {/* Numbers */}
      {!usersQ.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tab === 'doctor' && (
            <>
              <Stat label="Total doctors" value={counts.total} />
              <Stat label="Available today" value={counts.availableToday} note="Active doctors scheduled today" />
            </>
          )}
          {tab === 'staff' && (
            <>
              <Stat label="Total staff" value={counts.total} />
              {counts.perShift.map((s) => <Stat key={s.shift} label={`${s.shift} shift`} value={s.count} note="Active staff" />)}
            </>
          )}
          {tab === 'patient' && (
            <>
              <Stat label="Total patients" value={counts.total} />
              <Stat label="Active patients" value={counts.active} />
            </>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        {/* Filters */}
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search by name" value={filters.search} onChange={setFilter('search')} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tab !== 'patient' && (
              <Field label="Department">
                <select className={inputCls} value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value, specialization: '' }))}>
                  <option value="">All departments</option>
                  {departmentChoices.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            )}

            {tab === 'doctor' && (
              <>
                <Field label="Specialization">
                  <select className={inputCls} value={filters.specialization} onChange={setFilter('specialization')}>
                    <option value="">All specializations</option>
                    {specializationChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Available on">
                  <select className={inputCls} value={filters.day} onChange={setFilter('day')}>
                    <option value="">Any day</option>
                    {WEEK.map((d) => <option key={d.dow} value={d.dow}>{d.label}</option>)}
                  </select>
                </Field>
                <Field label="Available at">
                  <input type="time" className={inputCls} value={filters.time} onChange={setFilter('time')} />
                </Field>
              </>
            )}

            {tab === 'staff' && (
              <>
                <Field label="Desk">
                  <select className={inputCls} value={filters.desk} onChange={setFilter('desk')}>
                    <option value="">All desks</option>
                    {deskChoices.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Shift">
                  <select className={inputCls} value={filters.shift} onChange={setFilter('shift')}>
                    <option value="">All shifts</option>
                    {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </>
            )}

            <Field label="Account">
              <select className={inputCls} value={filters.status} onChange={setFilter('status')}>
                <option value="all">Active and inactive</option>
                <option value="active">Active accounts</option>
                <option value="inactive">Inactive accounts</option>
              </select>
            </Field>
          </div>

          {filtersActive && (
            <button type="button" onClick={() => setFilters(emptyFilters)} className="text-sm font-medium text-teal-700 hover:underline">
              Reset filters
            </button>
          )}
        </div>

        {/* List */}
        {usersQ.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading {currentTab.label.toLowerCase()}...</p>
        ) : usersQ.isError ? (
          <p className="p-6 text-sm text-red-700">The list could not be loaded. Check your connection and try again.</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{users.length === 0 ? `No ${currentTab.label.toLowerCase()} yet.` : 'No one matches these filters.'}</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const active = u.isActive !== false
                const dept = u.role === 'doctor' ? docDepartments(u).join(', ') : u.department
                return (
                  <li key={u._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => setDetails(u)} className="text-left text-sm font-medium text-slate-900 hover:text-teal-700 hover:underline">
                        {fullName(u)}
                      </button>
                      {u.role !== 'patient' && <div className="truncate text-xs text-slate-500">{dept || 'No department'}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                      <button type="button" onClick={() => setConfirmUser(u)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        {active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-slate-100 p-4 text-xs text-slate-500">Showing {filtered.length} of {users.length}</p>
          </>
        )}
      </section>

      {showAdd && <AddUserModal role={tab} onClose={() => setShowAdd(false)} onCreated={refreshUsers} />}
      {details && <DetailsModal user={details} onClose={() => setDetails(null)} />}
      {confirmUser && (
        <ConfirmDialog
          user={confirmUser}
          busy={setStatus.isLoading}
          onCancel={() => setConfirmUser(null)}
          onConfirm={() => setStatus.mutate({ id: confirmUser._id, isActive: confirmUser.isActive === false })}
        />
      )}
    </div>
  )
}

export default UserManagement
