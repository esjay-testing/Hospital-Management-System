const express = require('express');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Department = require('../models/Department');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();
const DAY = 86400000;

// GET /api/dashboard/admin-summary?today=YYYY-MM-DD
// Counts only. It never returns a name, a reason for a visit or any medical detail.
router.get('/admin-summary', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    // "Today" is the administrator's own calendar day, sent by the browser.
    const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : new Date().toISOString().slice(0, 10);
    const todayStart = new Date(`${todayKey}T00:00:00Z`);
    const lastDay = new Date(todayStart.getTime() + 7 * DAY);
    const lastKey = lastDay.toISOString().slice(0, 10);

    const [patientCount, doctors, departmentDocs, appointments] = await Promise.all([
      User.countDocuments({ role: 'patient', isActive: { $ne: false } }),
      User.find({ role: 'doctor' }).select('department specialization isActive').lean(),
      Department.find().select('name').lean(),
      Appointment.find({
        appointmentDate: { $gte: todayStart, $lte: new Date(lastDay.getTime() + DAY - 1) },
        status: { $ne: 'cancelled' }
      })
        .select('appointmentDate doctorId patientId doctorSpecialization')
        .lean()
    ]);

    // One display name per department, ignoring upper and lower case.
    const names = {};
    const remember = (n) => { const name = String(n || '').trim(); if (name && !names[name.toLowerCase()]) names[name.toLowerCase()] = name; };
    departmentDocs.forEach((d) => remember(d.name));

    const doctorDept = {};
    doctors.forEach((d) => {
      const dept = (d.department || d.specialization || '').trim();
      doctorDept[String(d._id)] = dept;
      remember(dept);
    });

    const blank = () => {
      const rows = {};
      Object.keys(names).forEach((k) => { rows[k] = { name: names[k], appointments: 0, patientIds: new Set() }; });
      return { rows, all: new Set(), total: 0 };
    };
    const today = blank();
    const upcoming = blank();

    appointments.forEach((a) => {
      const dept = (doctorDept[String(a.doctorId)] || a.doctorSpecialization || 'General').trim() || 'General';
      remember(dept);
      const key = dept.toLowerCase();
      const day = new Date(a.appointmentDate).toISOString().slice(0, 10);

      const bucket = day === todayKey ? today : day > todayKey && day <= lastKey ? upcoming : null;
      if (!bucket) return;

      if (!bucket.rows[key]) bucket.rows[key] = { name: names[key], appointments: 0, patientIds: new Set() };
      bucket.rows[key].appointments += 1;
      bucket.rows[key].patientIds.add(String(a.patientId));
      bucket.all.add(String(a.patientId));
      bucket.total += 1;
    });

    const finish = (bucket) =>
      Object.values(bucket.rows)
        .map((r) => ({ name: r.name, appointments: r.appointments, patients: r.patientIds.size }))
        .sort((a, b) => b.appointments - a.appointments || a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        totals: {
          patients: patientCount,
          doctors: doctors.filter((d) => d.isActive !== false).length
        },
        today: { date: todayKey, total: today.total, patients: today.all.size, departments: finish(today) },
        upcoming: {
          from: new Date(todayStart.getTime() + DAY).toISOString().slice(0, 10),
          to: lastKey,
          total: upcoming.total,
          patients: upcoming.all.size,
          departments: finish(upcoming)
        }
      }
    });
  } catch (error) {
    console.error('Admin summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load the dashboard', error: error.message });
  }
});

module.exports = router;
