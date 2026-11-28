const express = require('express');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const RolePermission = require('../models/RolePermission');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Roles the admin screen may list, create and switch on or off.
// Admin accounts are never created or deactivated from the UI.
const MANAGED_ROLES = ['doctor', 'staff', 'patient'];
const SHIFTS = ['Morning', 'Afternoon', 'Night'];

// Medical details are never sent to this screen.
const HIDDEN = '-password -bloodType -allergies -emergencyContact';

const PERMISSION_KEYS = [
  'viewPatientCharts',
  'prescribeMedication',
  'manageBilling',
  'editSchedules',
  'viewAuditLogs',
  'manageUsers'
];

const DEFAULTS = {
  doctor: { viewPatientCharts: true, prescribeMedication: true },
  staff: { viewPatientCharts: true, manageBilling: true, editSchedules: true },
  patient: {}
};

// Fields an admin may set when creating a user.
const CREATE_FIELDS = [
  'firstName', 'lastName', 'email', 'password', 'role', 'phone', 'dateOfBirth', 'gender', 'address',
  'licenseNumber', 'experience', 'deskNumber', 'shift'
];

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const clean = (v) => String(v || '').trim();
const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const resolvePermissions = (role, stored) => {
  const out = {};
  PERMISSION_KEYS.forEach((key) => {
    if (role === 'admin') out[key] = true;
    else if (stored && typeof stored[key] === 'boolean') out[key] = stored[key];
    else out[key] = !!(DEFAULTS[role] && DEFAULTS[role][key]);
  });
  return out;
};

// Turns the schedule sent by the form into rows, or explains what is wrong.
const cleanSchedule = (raw) => {
  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    const day = Number(item.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'Choose valid days for the schedule' };
    if (seen.has(day)) return { error: 'Each day can only be added once' };
    if (!validTime(item.startTime) || !validTime(item.endTime)) return { error: 'Enter schedule times as hours and minutes' };
    if (toMinutes(item.startTime) >= toMinutes(item.endTime)) return { error: 'Each schedule must end after it starts' };
    seen.add(day);
    rows.push({ dayOfWeek: day, startTime: item.startTime, endTime: item.endTime });
  }
  return { rows };
};

const cleanList = (raw) =>
  [...new Set((Array.isArray(raw) ? raw : []).map((s) => clean(s).slice(0, 80)).filter(Boolean))];

/* ================================ PERMISSIONS ============================= */
// Kept for later. The Users screen no longer shows the permission matrix.

router.get('/permissions', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const rows = await RolePermission.find();
    const byRole = {};
    rows.forEach((r) => { byRole[r.role] = r.permissions; });
    const matrix = {};
    ['admin', 'doctor', 'staff', 'patient'].forEach((role) => { matrix[role] = resolvePermissions(role, byRole[role]); });
    res.json({ success: true, data: { permissions: matrix, keys: PERMISSION_KEYS } });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get permissions', error: error.message });
  }
});

router.put('/permissions/:role', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.params;
    if (!MANAGED_ROLES.includes(role)) return fail(res, 400, 'Admin permissions cannot be changed');
    const incoming = req.body.permissions || {};
    const cleaned = {};
    PERMISSION_KEYS.forEach((key) => { cleaned[key] = incoming[key] === true; });
    const saved = await RolePermission.findOneAndUpdate(
      { role },
      { role, permissions: cleaned },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: 'Permissions saved', data: { role, permissions: saved.permissions } });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to save permissions', error: error.message });
  }
});

/* =================================== USERS ================================ */

// GET /api/users?role=doctor|staff|patient - directory, including inactive accounts.
// Doctors come with their weekly schedule and leave days.
router.get('/', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { role } = req.query;
    if (role && !MANAGED_ROLES.includes(role)) return fail(res, 400, 'Invalid role');

    const users = await User.find({ role: role || { $in: MANAGED_ROLES } })
      .select(HIDDEN)
      .sort({ createdAt: -1 })
      .lean();

    const doctorIds = users.filter((u) => u.role === 'doctor').map((u) => u._id);
    if (doctorIds.length) {
      const entries = await Schedule.find({ doctorId: { $in: doctorIds } }).lean();
      const byDoctor = {};
      entries.forEach((e) => {
        const key = String(e.doctorId);
        byDoctor[key] = byDoctor[key] || { schedule: [], leaveDates: [] };
        if (e.kind === 'leave') byDoctor[key].leaveDates.push(e.date);
        else byDoctor[key].schedule.push({ dayOfWeek: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime });
      });
      users.forEach((u) => {
        if (u.role !== 'doctor') return;
        const found = byDoctor[String(u._id)] || { schedule: [], leaveDates: [] };
        u.schedule = found.schedule.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        u.leaveDates = found.leaveDates;
      });
    }

    res.json({ success: true, data: { users, count: users.length } });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users', error: error.message });
  }
});

// POST /api/users - create a doctor, staff member or patient
router.post('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!MANAGED_ROLES.includes(role)) return fail(res, 400, 'Role must be doctor, staff or patient');

    const data = {};
    CREATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== '') data[field] = req.body[field];
    });
    data.email = clean(data.email).toLowerCase();

    let scheduleRows = [];

    if (role === 'doctor') {
      const departments = cleanList(req.body.departments);
      const specializations = cleanList(req.body.specializations);
      if (departments.length === 0) return fail(res, 400, 'Choose at least one department');
      if (specializations.length === 0) return fail(res, 400, 'Choose at least one specialization');
      if (!data.licenseNumber) return fail(res, 400, 'Enter the medical license number');

      const sched = cleanSchedule(req.body.schedule);
      if (sched.error) return fail(res, 400, sched.error);
      scheduleRows = sched.rows;

      data.departments = departments;
      data.department = departments[0];
      data.specializations = specializations;
      data.specialization = specializations.join(', ');
    }

    if (role === 'staff') {
      const department = clean(req.body.department);
      if (!department) return fail(res, 400, 'Choose a department');
      if (!data.deskNumber) return fail(res, 400, 'Choose a desk');
      if (!SHIFTS.includes(data.shift)) return fail(res, 400, 'Choose a shift');
      data.department = department;
    }

    if (await User.findOne({ email: data.email })) {
      return fail(res, 409, 'That email is already registered');
    }

    // User.create runs the password-hashing hook, so the new account can log in.
    const user = await User.create(data);

    if (scheduleRows.length) {
      try {
        await Schedule.insertMany(scheduleRows.map((r) => ({ doctorId: user._id, kind: 'shift', ...r })));
      } catch (scheduleError) {
        await User.deleteOne({ _id: user._id });
        throw scheduleError;
      }
    }

    const safe = user.toObject();
    delete safe.password;
    res.status(201).json({ success: true, message: 'User created', data: { user: safe } });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.name === 'ValidationError') return fail(res, 400, error.message);
    res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
});

// PUT /api/users/:id/status - activate or deactivate an account (admin only)
router.put('/:id/status', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return fail(res, 400, 'isActive must be true or false');

    const target = await User.findById(req.params.id);
    if (!target) return fail(res, 404, 'User not found');
    if (!MANAGED_ROLES.includes(target.role)) return fail(res, 403, 'Admin accounts cannot be changed here');
    if (target._id.equals(req.user._id)) return fail(res, 400, 'You cannot change your own account');

    target.isActive = isActive;
    await target.save();

    res.json({
      success: true,
      message: isActive ? 'Account activated' : 'Account deactivated',
      data: { id: target._id, isActive: target.isActive }
    });
  } catch (error) {
    console.error('Set status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
});

module.exports = router;
