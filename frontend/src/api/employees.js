import apiClient from './client';

export function getEmployees(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiClient('GET', `/employees${qs ? '?' + qs : ''}`, null, token);
}

export function getEmployeeStats(token) {
  return apiClient('GET', '/employees/stats', null, token);
}

export function getEmployee(id, token) {
  return apiClient('GET', `/employees/${id}`, null, token);
}

export function createEmployee(data, token) {
  return apiClient('POST', '/employees', data, token);
}

export function updateEmployee(id, data, token) {
  return apiClient('PUT', `/employees/${id}`, data, token);
}

export function updateEmployeeStatus(id, employmentStatus, token) {
  return apiClient('PATCH', `/employees/${id}/status`, { employmentStatus }, token);
}

export function deleteEmployee(id, token) {
  return apiClient('DELETE', `/employees/${id}`, null, token);
}