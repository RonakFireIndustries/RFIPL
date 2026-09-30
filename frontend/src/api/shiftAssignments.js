import apiClient from './client';

export function getShiftAssignments(employeeId, token) {
  return apiClient('GET', `/shift-assignments/employee/${employeeId}`, null, token);
}

export function getActiveShiftAssignment(employeeId, token) {
  return apiClient('GET', `/shift-assignments/active/${employeeId}`, null, token);
}

export function createShiftAssignment(data, token) {
  return apiClient('POST', '/shift-assignments', data, token);
}

export function updateShiftAssignment(id, data, token) {
  return apiClient('PUT', `/shift-assignments/${id}`, data, token);
}

export function deleteShiftAssignment(id, token) {
  return apiClient('DELETE', `/shift-assignments/${id}`, null, token);
}