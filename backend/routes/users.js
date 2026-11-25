const express = require('express');
const User = require('../models/User');
const RolePermission = require('../models/RolePermission');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Roles the admin screen may list, create and switch on/off.
// Admin accounts are never created or deactivated from the UI.
const MANAGED_ROLES = ['doctor', 'staff', 'patient'];

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

// Fields an admin or staff member may set when creating a user.
const CREATE_FIELDS = [
  'firstName', 'lastName', 'email', 'password', 'role', 'phone', 'dateOfBirth', 'gender',
  'specialization', 'licenseNumber', 'experience', 'consultationFee',
  'department', 'shift', 'deskNumber'
];

const resolvePermissions = (role, stored) => {
  const out = {};
  PERMISSION_KEYS.forEach((key) => {
    if (role === 'admin') out[key] = true;
    else if (stored && typeof stored[key] === 'boolean') out[key] = stored[key];
    else out[key] = !!(DEFAULTS[role] && DEFAULTS[role][key]);
  });
  return out;
};

// GET /api/users/permissions - the full role matrix (admin only)
router.get('/permissions', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const rows = await RolePermission.find();
    const byRole = {};
    rows.forEach((r) => { byRole[r.role] = r.permissions; });

    const matrix = {};
    ['admin', 'doctor', 'staff', 'patient'].forEach((role) => {
      matrix[role] = resolvePermissions(role, byRole[role]);
    });

    res.json({ success: true, data: { permissions: matrix, keys: PERMISSION_KEYS } });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get permissions', error: error.message });
  }
});

// PUT /api/users/permissions/:role - save one role's permissions (admin only)
router.put('/permissions/:role', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.params;
    if (!MANAGED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Admin permissions cannot be changed' });
    }

    const incoming = req.body.permissions || {};
    const clean = {};
    PERMISSION_KEYS.forEach((key) => { clean[key] = incoming[key] === true; });

    const saved = await RolePermission.findOneAndUpdate(
      { role },
      { role, permissions: clean },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Permissions saved', data: { role, permissions: saved.permissions } });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to save permissions', error: error.message });
  }
});

// GET /api/users?role=doctor|staff|patient - directory, including inactive accounts
router.get('/', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { role } = req.query;
    if (role && !MANAGED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const query = { role: role || { $in: MANAGED_ROLES } };
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    res.json({ success: true, data: { users, count: users.length } });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users', error: error.message });
  }
});

// POST /api/users - create a doctor, staff member or patient
router.post('/', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!MANAGED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be doctor, staff or patient' });
    }
    // Front-desk staff may only register patients.
    if (req.user.role === 'staff' && role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only an admin can add doctors or staff' });
    }

    const data = {};
    CREATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== '') data[field] = req.body[field];
    });
    data.email = String(data.email || '').toLowerCase().trim();

    if (await User.findOne({ email: data.email })) {
      return res.status(409).json({ success: false, message: 'That email is already registered' });
    }

    // User.create runs the password-hashing hook, so the new account can log in.
    const user = await User.create(data);
    const safe = user.toObject();
    delete safe.password;

    res.status(201).json({ success: true, message: 'User created', data: { user: safe } });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
});

// PUT /api/users/:id/status - activate or deactivate an account (admin only)
router.put('/:id/status', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!MANAGED_ROLES.includes(target.role)) {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be changed here' });
    }
    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot change your own account' });
    }

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
