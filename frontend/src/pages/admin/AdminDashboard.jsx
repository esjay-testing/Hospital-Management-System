import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { Activity, Clock, Calendar, Users, UserCheck, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { dashboardAPI } from '../../services/api'

const pad = (n) => String(n).padStart(2, '0')
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const prettyDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const shortDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Opens when an appointment card is selected.
const DepartmentModal = ({ title, subtitle, block, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
    <div
      className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {!block ? (
        <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
      ) : block.departments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No departments have been set up yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 text-right font-medium">Appointments</th>
                <th className="py-2 text-right font-medium">Patients</th>
              </tr>
            </thead>
            <tbody>
              {block.departments.map((d) => (
                <tr key={d.name} className="border-b border-gray-100">
                  <td className="py-2.5 pr-3 font-medium text-gray-900">{d.name}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-800">{d.appointments}</td>
                  <td className="py-2.5 text-right text-gray-800">{d.patients}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-gray-900">
                <td className="pt-3 pr-3">All departments</td>
                <td className="pt-3 pr-3 text-right">{block.total}</td>
                <td className="pt-3 text-right">{block.patients}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  </div>
)

const StatCard = ({ name, value, icon: Icon, bgColor, onClick }) => {
  const body = (
    <div className="flex items-start justify-between">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-600">{name}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {onClick && <p className="mt-2 text-xs text-blue-600">View by department</p>}
      </div>
      <div className={`${bgColor} flex h-12 w-12 items-center justify-center rounded-xl shadow-lg`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  )

  const cls = 'rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-lg transition-all duration-300'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:-translate-y-1 hover:shadow-xl`}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

const AdminDashboard = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(null) // 'today' | 'upcoming' | null
  const todayKey = localDay()

  const { data, isLoading, isError } = useQuery(
    ['admin-summary', todayKey],
    () => dashboardAPI.getAdminSummary({ today: todayKey }),
    { refetchOnWindowFocus: true }
  )
  const summary = data?.data?.data
  const show = (v) => (isLoading || !summary ? '...' : v)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Welcome message */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 shadow-xl lg:p-10">
          <div className="flex items-center">
            <div className="mr-4 rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h1 className="mb-1 text-3xl font-bold text-white">Welcome back, {user?.firstName}!</h1>
              <p className="text-lg text-blue-100">Here's what's happening in your admin dashboard</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-blue-100/90">
            Manage appointments, doctors, and administrative services all in one secure,
            professional platform designed for healthcare excellence.
          </p>
        </div>

        <div className="mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
            <p className="mt-1 text-gray-600">Welcome to your healthcare management dashboard</p>
          </div>

          {isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              The dashboard could not be loaded. Check your connection and refresh the page.
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              name="Today's Appointments"
              value={show(summary?.today.total)}
              icon={Clock}
              bgColor="bg-blue-500"
              onClick={() => setOpen('today')}
            />
            <StatCard
              name="Upcoming Appointments"
              value={show(summary?.upcoming.total)}
              icon={Calendar}
              bgColor="bg-green-500"
              onClick={() => setOpen('upcoming')}
            />
            <StatCard name="Total Patients" value={show(summary?.totals.patients)} icon={Users} bgColor="bg-purple-500" />
            <StatCard name="Total Doctors" value={show(summary?.totals.doctors)} icon={UserCheck} bgColor="bg-orange-500" />
          </div>
        </div>

        <footer className="mt-12 border-t border-gray-200 py-6 text-center text-sm text-gray-500">
          <p>© MediCare Hospital Management System. All rights reserved.</p>
        </footer>
      </div>

      {open === 'today' && (
        <DepartmentModal
          title="Today's appointments by department"
          subtitle={prettyDay(todayKey)}
          block={summary?.today}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'upcoming' && (
        <DepartmentModal
          title="Upcoming appointments by department"
          subtitle={summary ? `${shortDay(summary.upcoming.from)} to ${shortDay(summary.upcoming.to)}` : 'Next 7 days'}
          block={summary?.upcoming}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

export default AdminDashboard
