import apiClient from './client';

export function getAttendanceCorrections(params, token) {
  const q = new URLSearchParams();
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  return apiClient('GET', `/attendance-corrections${qs ? `?${qs}` : ''}`, null, token);
}

export function getAttendanceCorrection(id, token) {
  return apiClient('GET', `/attendance-corrections/${id}`, null, token);
}

export function createAttendanceCorrection(data, token) {
  return apiClient('POST', '/attendance-corrections', data, token);
}

export function updateAttendanceCorrection(id, data, token) {
  return apiClient('PUT', `/attendance-corrections/${id}`, data, token);
}

export function reviewAttendanceCorrection(id, data, token) {
  return apiClient('PATCH', `/attendance-corrections/${id}/review`, data, token);
}

export function deleteAttendanceCorrection(id, token) {
  return apiClient('DELETE', `/attendance-corrections/${id}`, null, token);
}