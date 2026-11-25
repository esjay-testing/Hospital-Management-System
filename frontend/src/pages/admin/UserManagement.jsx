import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { Search, Plus, X } from 'lucide-react'
import { usersAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

// ---------- constants ----------
const TABS = [
  { key: 'doctor', label: 'Doctors', singular: 'doctor' },
  { key: 'staff', label: 'Staff', singular: 'staff member' },
  { key: 'patient', label: 'Patients', singular: 'patient' },
  { key: 'permissions', label: 'Roles and permissions' },
]

const PERMS = [
  { key: 'viewPatientCharts', label: 'View patient charts' },
  { key: 'prescribeMedication', label: 'Prescribe medication' },
  { key: 'manageBilling', label: 'Manage billing and refunds' },
  { key: 'editSchedules', label: 'Edit schedules' },
  { key: 'viewAuditLogs', label: 'View audit logs' },
  { key: 'manageUsers', label: 'Manage users' },
]
const ROLE_COLUMNS = [
  { key: 'admin', label: 'Admin' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'staff', label: 'Staff' },
  { key: 'patient', label: 'Patient' },
]

const emptyForm = (role) => ({
  role,
  firstName: '', lastName: '', email: '', password: '', phone: '',
  dateOfBirth: '', gender: 'female',
  specialization: '', licenseNumber: '', experience: '', consultationFee: '',
  department: '', shift: 'Morning', deskNumber: '',
})

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600'

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm text-slate-600">{label}</span>
    {children}
  </label>
)

const errorText = (err, fallback) => err?.response?.data?.message || fallback

// ---------- add user modal ----------
const AddUserModal = ({ role, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm(role))
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const tab = TABS.find((t) => t.key === role)

  const create = useMutation((payload) => usersAPI.create(payload), {
    onSuccess: () => {
      toast.success(`Added ${form.firstName} ${form.lastName}`)
      onCreated()
      onClose()
    },
    onError: (err) => toast.error(errorText(err, 'Could not add this user')),
  })

  const submit = (e) => {
    e.preventDefault()
    create.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add {tab.singular}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

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
          <Field label="Gender">
            <select className={inputCls} value={form.gender} onChange={set('gender')}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>

          {role === 'doctor' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Specialty"><input required className={inputCls} value={form.specialization} onChange={set('specialization')} /></Field>
                <Field label="Medical license number"><input required className={inputCls} value={form.licenseNumber} onChange={set('licenseNumber')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Years of experience"><input type="number" min="0" className={inputCls} value={form.experience} onChange={set('experience')} /></Field>
                <Field label="Consultation fee"><input type="number" min="0" className={inputCls} value={form.consultationFee} onChange={set('consultationFee')} /></Field>
              </div>
            </>
          )}

          {role === 'staff' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Department"><input className={inputCls} value={form.department} onChange={set('department')} /></Field>
              <Field label="Shift">
                <select className={inputCls} value={form.shift} onChange={set('shift')}>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Night</option>
                </select>
              </Field>
              <Field label="Desk"><input className={inputCls} value={form.deskNumber} onChange={set('deskNumber')} /></Field>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={create.isLoading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {create.isLoading ? 'Adding...' : `Add ${tab.singular}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- confirm dialog ----------
const ConfirmDialog = ({ user, busy, onCancel, onConfirm }) => {
  const turningOff = user.isActive !== false
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">
          {turningOff ? 'Deactivate' : 'Activate'} {user.firstName} {user.lastName}?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {turningOff
            ? 'They will be signed out and will not be able to log in until you activate the account again.'
            : 'They will be able to log in again.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
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

// ---------- permissions matrix ----------
const PermissionsMatrix = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery('role-permissions', () => usersAPI.getPermissions())
  const [matrix, setMatrix] = useState(null)
  const [dirty, setDirty] = useState([])

  useEffect(() => {
    const incoming = data?.data?.data?.permissions
    if (incoming) {
      setMatrix(incoming)
      setDirty([])
    }
  }, [data])

  const toggle = (role, key) => {
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: !m[role][key] } }))
    setDirty((d) => (d.includes(role) ? d : [...d, role]))
  }

  const save = useMutation(
    () => Promise.all(dirty.map((role) => usersAPI.updatePermissions(role, matrix[role]))),
    {
      onSuccess: () => {
        toast.success('Permissions saved')
        queryClient.invalidateQueries('role-permissions')
      },
      onError: (err) => toast.error(errorText(err, 'Could not save permissions')),
    }
  )

  if (isLoading || !matrix) return <p className="p-6 text-sm text-slate-500">Loading permissions...</p>
  if (isError) return <p className="p-6 text-sm text-red-700">Permissions could not be loaded.</p>

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="p-4 font-medium">Permission</th>
              {ROLE_COLUMNS.map((r) => (
                <th key={r.key} className="p-4 text-center font-medium">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.key} className="border-b border-slate-50">
                <td className="p-4 text-slate-800">{p.label}</td>
                {ROLE_COLUMNS.map((r) => (
                  <td key={r.key} className="p-4 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-600"
                      checked={!!matrix[r.key]?.[p.key]}
                      disabled={r.key === 'admin'}
                      onChange={() => toggle(r.key, p.key)}
                      aria-label={`${r.label}: ${p.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Admin permissions are locked so the system can never be left without an administrator.
          Saved settings are stored now, and each later module will read them.
        </p>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={dirty.length === 0 || save.isLoading}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {save.isLoading ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ---------- page ----------
const UserManagement = () => {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const visibleTabs = TABS.filter((t) => t.key !== 'permissions' || isAdmin)
  const [tab, setTab] = useState('doctor')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [confirmUser, setConfirmUser] = useState(null)

  const isDirectory = tab !== 'permissions'
  const usersQ = useQuery(['users', tab], () => usersAPI.getAll(tab), { enabled: isDirectory })
  const users = usersQ.data?.data?.data?.users || []

  const refreshUsers = () => {
    queryClient.invalidateQueries('users')
    queryClient.invalidateQueries('doctors')
    queryClient.invalidateQueries('patients')
  }

  const setStatus = useMutation(({ id, isActive }) => usersAPI.setStatus(id, isActive), {
    onSuccess: (res) => {
      toast.success(res?.data?.message || 'Status updated')
      setConfirmUser(null)
      refreshUsers()
    },
    onError: (err) => toast.error(errorText(err, 'Could not change this account')),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (statusFilter === 'active' && u.isActive === false) return false
      if (statusFilter === 'inactive' && u.isActive !== false) return false
      if (!q) return true
      const haystack = [u.firstName, u.lastName, u.email, u.phone, u.specialization, u.licenseNumber, u.department, u._id]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [users, search, statusFilter])

  const detailLine = (u) => {
    if (u.role === 'doctor') return [u.specialization, u.licenseNumber && `License ${u.licenseNumber}`].filter(Boolean).join(', ')
    if (u.role === 'staff') return [u.department, u.shift && `${u.shift} shift`, u.deskNumber && `Desk ${u.deskNumber}`].filter(Boolean).join(', ')
    return [u.phone, u.bloodType && `Blood type ${u.bloodType}`].filter(Boolean).join(', ')
  }

  const currentTab = TABS.find((t) => t.key === tab)
  // Front-desk staff may register patients only.
  const canAdd = isDirectory && (isAdmin || tab === 'patient')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users and access</h1>
          <p className="text-sm text-slate-500">Add people, switch accounts on or off, and set what each role can do.</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add {currentTab.singular}
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSearch(''); setStatusFilter('all') }}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        {isDirectory ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Search by name, email, ID or specialty"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className={`${inputCls} sm:w-40`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {usersQ.isLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading {currentTab.label.toLowerCase()}...</p>
            ) : usersQ.isError ? (
              <p className="p-6 text-sm text-red-700">The list could not be loaded. Check your connection and try again.</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                {users.length === 0 ? `No ${currentTab.label.toLowerCase()} yet.` : 'No one matches this search.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const active = u.isActive !== false
                  return (
                    <li key={u._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{u.firstName} {u.lastName}</div>
                        <div className="truncate text-xs text-slate-500">{u.email}</div>
                        {detailLine(u) && <div className="truncate text-xs text-slate-500">{detailLine(u)}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmUser(u)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <PermissionsMatrix />
        )}
      </section>

      {showAdd && <AddUserModal role={tab} onClose={() => setShowAdd(false)} onCreated={refreshUsers} />}
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
