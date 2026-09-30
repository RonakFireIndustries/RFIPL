import apiClient from './client';

export function getAttendanceRecords(params, token) {
  const q = new URLSearchParams();
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  if (params?.fromDate) q.set('fromDate', params.fromDate);
  if (params?.toDate) q.set('toDate', params.toDate);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  return apiClient('GET', `/attendance${qs ? `?${qs}` : ''}`, null, token);
}

export function getAttendanceRecord(id, token) {
  return apiClient('GET', `/attendance/${id}`, null, token);
}

export function createAttendanceRecord(data, token) {
  return apiClient('POST', '/attendance', data, token);
}

export function updateAttendanceRecord(id, data, token) {
  return apiClient('PUT', `/attendance/${id}`, data, token);
}

export function deleteAttendanceRecord(id, token) {
  return apiClient('DELETE', `/attendance/${id}`, null, token);
}

export function punchAttendance(type, position, token) {
  return apiClient('POST', '/attendance/punch', {
    type,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    deviceTimestamp: position.timestamp || Date.now(),
  }, token);
}

export function getMyAttendance(token) {
  return apiClient('GET', '/attendance/self', null, token);
}