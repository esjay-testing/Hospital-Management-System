const mongoose = require('mongoose');

// kind "shift": a weekly repeating shift (dayOfWeek 0 = Sunday ... 6 = Saturday)
// kind "leave": a single day off (date as YYYY-MM-DD)
const scheduleSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['shift', 'leave'], default: 'shift' },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: String, // HH:MM
    endTime: String,   // HH:MM
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    date: String,
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
