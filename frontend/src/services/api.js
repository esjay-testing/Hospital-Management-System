import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api'),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { currentPassword, newPassword }),
  logout: () => api.post('/auth/logout'),
}

// Patients API
export const patientsAPI = {
  getAll: () => api.get('/patients'),
  getById: (id) => api.get(`/patients/${id}`),
  create: (patientData) => api.post('/patients', patientData),
  update: (id, patientData) => api.put(`/patients/${id}`, patientData),
  delete: (id) => api.delete(`/patients/${id}`),
  permanentDelete: (id) => api.delete(`/patients/${id}/permanent`),
  getHealthCard: (id) => api.get(`/patients/${id}/health-card`),
}

// Doctors API
export const doctorsAPI = {
  getAll: () => api.get('/doctors'),
  getById: (id) => api.get(`/doctors/${id}`),
  create: (doctorData) => api.post('/doctors', doctorData),
  update: (id, doctorData) => api.put(`/doctors/${id}`, doctorData),
  delete: (id) => api.delete(`/doctors/${id}`),
  getBySpecialization: (specialization) => 
    api.get(`/doctors/specialization/${specialization}`),
  updateAvailability: (id, isAvailable) => 
    api.put(`/doctors/${id}/availability`, { isAvailable }),
}

// Appointments API
export const appointmentsAPI = {
  getAll: () => api.get('/appointments'),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (appointmentData) => api.post('/appointments', appointmentData),
  update: (id, appointmentData) => api.put(`/appointments/${id}`, appointmentData),
  delete: (id) => api.delete(`/appointments/${id}`),
  cancel: (id) => api.put(`/appointments/${id}/cancel`),
  checkIn: (id) => api.put(`/appointments/${id}/checkin`),
  getAvailability: (doctorId, date) => 
    api.get(`/appointments/availability/${doctorId}?date=${date}`),
  processPayment: (id) => api.put(`/appointments/${id}/payment`),
}

// Medical Records API
export const medicalRecordsAPI = {
  getAll: () => api.get('/medical-records'),
  getByPatient: (patientId) => api.get(`/medical-records/patient/${patientId}`),
  getById: (id) => api.get(`/medical-records/${id}`),
  create: (recordData) => api.post('/medical-records', recordData),
  update: (id, recordData) => api.put(`/medical-records/${id}`, recordData),
  complete: (id) => api.put(`/medical-records/${id}/complete`),
  addMedication: (id, medication) => api.post(`/medical-records/${id}/medication`, medication),
  addLabResult: (id, labResult) => api.post(`/medical-records/${id}/lab-result`, labResult),
}

// Health Cards API
export const healthCardsAPI = {
  getAll: () => api.get('/health-cards'),
  getById: (id) => api.get(`/health-cards/${id}`),
  getByPatient: (patientId) => api.get(`/health-cards/patient/${patientId}`),
  create: (cardData) => api.post('/health-cards', cardData),
  update: (id, cardData) => api.put(`/health-cards/${id}`, cardData),
  block: (id, reason) => api.put(`/health-cards/${id}/block`, { reason }),
  unblock: (id) => api.put(`/health-cards/${id}/unblock`),
  validate: (cardNumber) => api.get(`/health-cards/validate/${cardNumber}`),
  getByCardNumber: (cardNumber) => api.get(`/health-cards/card/${cardNumber}`),
  // Health card requests
  createRequest: (requestData) => api.post('/health-cards/request', requestData),
  getAllRequests: () => api.get('/health-cards/requests'),
  getMyRequest: () => api.get('/health-cards/request/my-request'),
  approveRequest: (id, expiryDate) => api.put(`/health-cards/request/${id}/approve`, { expiryDate }),
  rejectRequest: (id, rejectionReason) => api.put(`/health-cards/request/${id}/reject`, { rejectionReason }),
}

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  create: (notificationData) => api.post('/notifications', notificationData),
  delete: (id) => api.delete(`/notifications/${id}`),
  getByType: (type) => api.get(`/notifications/type/${type}`),
}

export const usersAPI = {
  getAll: (role) => api.get('/users', { params: { role } }),
  create: (data) => api.post('/users', data),
  setStatus: (id, isActive) => api.put(`/users/${id}/status`, { isActive }),
  getPermissions: () => api.get('/users/permissions'),
  updatePermissions: (role, permissions) => api.put(`/users/permissions/${role}`, { permissions }),
}

export const schedulingAPI = {
  getDepartments: () => api.get('/scheduling/departments'),
  createDepartment: (data) => api.post('/scheduling/departments', data),
  updateDepartment: (id, data) => api.put(`/scheduling/departments/${id}`, data),
  getRooms: () => api.get('/scheduling/rooms'),
  createRoom: (data) => api.post('/scheduling/rooms', data),
  setRoomStatus: (id, data) => api.put(`/scheduling/rooms/${id}/status`, data),
  deleteRoom: (id) => api.delete(`/scheduling/rooms/${id}`),
  getSchedules: () => api.get('/scheduling/schedules'),
  createSchedule: (data) => api.post('/scheduling/schedules', data),
  updateSchedule: (id, data) => api.put(`/scheduling/schedules/${id}`, data),
  deleteSchedule: (id) => api.delete(`/scheduling/schedules/${id}`),
}

export const inventoryAPI = {
  getItems: () => api.get('/inventory/items'),
  createItem: (data) => api.post('/inventory/items', data),
  updateItem: (id, data) => api.put(`/inventory/items/${id}`, data),
  restock: (id, data) => api.post(`/inventory/items/${id}/restock`, data),
  dispense: (id, data) => api.post(`/inventory/items/${id}/dispense`, data),
  adjust: (id, data) => api.post(`/inventory/items/${id}/adjust`, data),
  setBatchStatus: (id, batch, status) =>
    api.post(`/inventory/items/${id}/batches/${encodeURIComponent(batch)}/status`, { status }),
  getMovements: () => api.get('/inventory/movements'),
}

export const billingAPI = {
  getInvoices: () => api.get('/billing/invoices'),
  createInvoice: (data) => api.post('/billing/invoices', data),
  sendInvoice: (id) => api.put(`/billing/invoices/${id}/send`),
  recordPayment: (id, data) => api.post(`/billing/invoices/${id}/payments`, data),
  issueRefund: (id, data) => api.post(`/billing/invoices/${id}/refunds`, data),
  getTransactions: () => api.get('/billing/transactions'),
  getClaims: () => api.get('/billing/claims'),
  createClaim: (data) => api.post('/billing/claims', data),
  updateClaimStatus: (id, data) => api.put(`/billing/claims/${id}/status`, data),
  resubmitClaim: (id) => api.post(`/billing/claims/${id}/resubmit`),
}

export const dashboardAPI = {
  getAdminSummary: (params) => api.get('/dashboard/admin-summary', { params }),
}

export default api
