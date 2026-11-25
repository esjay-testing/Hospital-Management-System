const mongoose = require('mongoose');

// One document per role. Missing roles fall back to the defaults in routes/users.js.
const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: ['admin', 'doctor', 'staff', 'patient']
    },
    permissions: {
      viewPatientCharts: { type: Boolean, default: false },
      prescribeMedication: { type: Boolean, default: false },
      manageBilling: { type: Boolean, default: false },
      editSchedules: { type: Boolean, default: false },
      viewAuditLogs: { type: Boolean, default: false },
      manageUsers: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
