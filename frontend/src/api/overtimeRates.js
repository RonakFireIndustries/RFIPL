import apiClient from './client';

export function getOvertimeRates(employeeId, token) {
  return apiClient('GET', `/overtime-rates/employee/${employeeId}`, null, token);
}

export function getActiveOvertimeRate(employeeId, token) {
  return apiClient('GET', `/overtime-rates/active/${employeeId}`, null, token);
}

export function createOvertimeRate(data, token) {
  return apiClient('POST', '/overtime-rates', data, token);
}

export function updateOvertimeRate(id, data, token) {
  return apiClient('PUT', `/overtime-rates/${id}`, data, token);
}

export function deleteOvertimeRate(id, token) {
  return apiClient('DELETE', `/overtime-rates/${id}`, null, token);
}