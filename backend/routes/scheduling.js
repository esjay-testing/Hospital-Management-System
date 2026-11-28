const express = require('express');
const User = require('../models/User');
const Department = require('../models/Department');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const serverError = (res, label, error) => {
  console.error(label, error);
  res.status(500).json({ success: false, message: label, error: error.message });
};
const isDuplicate = (error) => error && error.code === 11000;

const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/* ============================== DEPARTMENTS ============================== */

router.get('/departments', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('head', 'firstName lastName')
      .sort({ name: 1 })
      .lean();

    const people = await User.find({ isActive: true, role: { $in: ['doctor', 'staff'] } })
      .select('specialization department')
      .lean();

    departments.forEach((d) => {
      const name = d.name.toLowerCase();
      d.staffCount = people.filter(
        (p) => (p.specialization || '').toLowerCase() === name || (p.department || '').toLowerCase() === name
      ).length;
    });

    res.json({ success: true, data: { departments } });
  } catch (error) {
    serverError(res, 'Failed to get departments', error);
  }
});

router.post('/departments', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { name, head, description, status } = req.body;
    if (!name || !name.trim()) return fail(res, 400, 'Department name is required');

    const department = await Department.create({
      name,
      head: head || undefined,
      description,
      status: status === 'inactive' ? 'inactive' : 'active'
    });
    res.status(201).json({ success: true, data: { department } });
  } catch (error) {
    if (isDuplicate(error)) return fail(res, 409, 'A department with that name already exists');
    serverError(res, 'Failed to create department', error);
  }
});

router.put('/departments/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return fail(res, 404, 'Department not found');

    const { name, head, description, status } = req.body;
    if (name !== undefined) department.name = name;
    if (head !== undefined) department.head = head || undefined;
    if (description !== undefined) department.description = description;
    if (status === 'active' || status === 'inactive') department.status = status;

    await department.save();
    res.json({ success: true, data: { department } });
  } catch (error) {
    if (isDuplicate(error)) return fail(res, 409, 'A department with that name already exists');
    serverError(res, 'Failed to update department', error);
  }
});

/* ================================= ROOMS ================================= */

router.get('/rooms', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'firstName lastName')
      .sort({ unit: 1, name: 1 })
      .lean();

    const total = rooms.length;
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const cleaning = rooms.filter((r) => r.status === 'cleaning').length;
    const summary = {
      total,
      occupied,
      cleaning,
      available: total - occupied - cleaning,
      occupancyPercent: total ? Math.round((occupied / total) * 100) : 0
    };

    res.json({ success: true, data: { rooms, summary } });
  } catch (error) {
    serverError(res, 'Failed to get rooms', error);
  }
});

router.post('/rooms', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { name, unit, kind } = req.body;
    if (!name || !unit) return fail(res, 400, 'Room name and unit are required');

    const room = await Room.create({ name, unit, kind: ['bed', 'consultation', 'suite'].includes(kind) ? kind : 'bed' });
    res.status(201).json({ success: true, data: { room } });
  } catch (error) {
    if (isDuplicate(error)) return fail(res, 409, 'A room with that name already exists');
    serverError(res, 'Failed to create room', error);
  }
});

// One-click status change. Staff and admins can both do this.
router.put('/rooms/:id/status', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { status, patientId, doctorId } = req.body;
    if (!['available', 'occupied', 'cleaning'].includes(status)) return fail(res, 400, 'Invalid status');

    const room = await Room.findById(req.params.id);
    if (!room) return fail(res, 404, 'Room not found');

    room.status = status;
    if (status === 'occupied') {
      room.patientId = patientId || undefined;
      room.doctorId = doctorId || undefined;
    } else {
      room.patientId = undefined;
      room.doctorId = undefined;
    }
    await room.save();

    res.json({ success: true, data: { room } });
  } catch (error) {
    serverError(res, 'Failed to update room status', error);
  }
});

router.delete('/rooms/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    if (await Schedule.findOne({ roomId: req.params.id })) {
      return fail(res, 409, 'This room is used in doctor shifts. Remove those shifts first.');
    }
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return fail(res, 404, 'Room not found');
    res.json({ success: true, message: 'Room removed' });
  } catch (error) {
    serverError(res, 'Failed to remove room', error);
  }
});

/* ============================== SCHEDULES ================================ */

router.get('/schedules', authenticateToken, authorize('admin', 'staff'), async (req, res) => {
  try {
    const query = req.query.doctorId ? { doctorId: req.query.doctorId } : {};
    const schedules = await Schedule.find(query)
      .populate('doctorId', 'firstName lastName specialization')
      .populate('roomId', 'name unit kind')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();
    res.json({ success: true, data: { schedules } });
  } catch (error) {
    serverError(res, 'Failed to get schedules', error);
  }
});

// Returns an error message when the shift clashes with another one, otherwise null.
const findShiftConflict = async ({ doctorId, dayOfWeek, startTime, endTime, roomId, ignoreId }) => {
  const sameDay = await Schedule.find({ kind: 'shift', dayOfWeek, _id: { $ne: ignoreId } })
    .populate('doctorId', 'firstName lastName')
    .populate('roomId', 'name')
    .lean();

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  for (const other of sameDay) {
    if (!overlaps(start, end, toMinutes(other.startTime), toMinutes(other.endTime))) continue;

    if (String(other.doctorId._id) === String(doctorId)) {
      return `This doctor already has a shift from ${other.startTime} to ${other.endTime} on that day.`;
    }
    if (roomId && other.roomId && String(other.roomId._id) === String(roomId)) {
      return `${other.roomId.name} is already booked by Dr. ${other.doctorId.lastName} from ${other.startTime} to ${other.endTime}.`;
    }
  }
  return null;
};

router.post('/schedules', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { doctorId, kind, dayOfWeek, startTime, endTime, roomId, date, note } = req.body;

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) return fail(res, 400, 'Choose a valid doctor');

    if (kind === 'leave') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail(res, 400, 'Choose a leave date');
      const entry = await Schedule.create({ doctorId, kind: 'leave', date, note });
      return res.status(201).json({ success: true, data: { schedule: entry } });
    }

    const day = Number(dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) return fail(res, 400, 'Choose a day of the week');
    if (!validTime(startTime) || !validTime(endTime)) return fail(res, 400, 'Enter times as HH:MM');
    if (toMinutes(startTime) >= toMinutes(endTime)) return fail(res, 400, 'End time must be after start time');

    const conflict = await findShiftConflict({ doctorId, dayOfWeek: day, startTime, endTime, roomId });
    if (conflict) return fail(res, 409, conflict);

    const entry = await Schedule.create({
      doctorId, kind: 'shift', dayOfWeek: day, startTime, endTime, roomId: roomId || undefined, note
    });
    res.status(201).json({ success: true, data: { schedule: entry } });
  } catch (error) {
    serverError(res, 'Failed to save schedule', error);
  }
});

router.put('/schedules/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const entry = await Schedule.findById(req.params.id);
    if (!entry) return fail(res, 404, 'Schedule entry not found');
    if (entry.kind !== 'shift') return fail(res, 400, 'Only shifts can be edited. Remove the leave day and add it again.');

    const dayOfWeek = req.body.dayOfWeek !== undefined ? Number(req.body.dayOfWeek) : entry.dayOfWeek;
    const startTime = req.body.startTime || entry.startTime;
    const endTime = req.body.endTime || entry.endTime;
    const roomId = req.body.roomId !== undefined ? req.body.roomId || undefined : entry.roomId;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return fail(res, 400, 'Choose a day of the week');
    if (!validTime(startTime) || !validTime(endTime)) return fail(res, 400, 'Enter times as HH:MM');
    if (toMinutes(startTime) >= toMinutes(endTime)) return fail(res, 400, 'End time must be after start time');

    const conflict = await findShiftConflict({
      doctorId: entry.doctorId, dayOfWeek, startTime, endTime, roomId, ignoreId: entry._id
    });
    if (conflict) return fail(res, 409, conflict);

    entry.dayOfWeek = dayOfWeek;
    entry.startTime = startTime;
    entry.endTime = endTime;
    entry.roomId = roomId;
    if (req.body.note !== undefined) entry.note = req.body.note;
    await entry.save();

    res.json({ success: true, data: { schedule: entry } });
  } catch (error) {
    serverError(res, 'Failed to update schedule', error);
  }
});

router.delete('/schedules/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const entry = await Schedule.findByIdAndDelete(req.params.id);
    if (!entry) return fail(res, 404, 'Schedule entry not found');
    res.json({ success: true, message: 'Removed' });
  } catch (error) {
    serverError(res, 'Failed to remove schedule', error);
  }
});

module.exports = router;
