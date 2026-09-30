import apiClient from './client';

export function getSalaryStructures(employeeId, token) {
  return apiClient('GET', `/salary-structures/employee/${employeeId}`, null, token);
}

export function getActiveSalaryStructure(employeeId, token) {
  return apiClient('GET', `/salary-structures/active/${employeeId}`, null, token);
}

export function createSalaryStructure(data, token) {
  return apiClient('POST', '/salary-structures', data, token);
}

export function updateSalaryStructure(id, data, token) {
  return apiClient('PUT', `/salary-structures/${id}`, data, token);
}

export function deleteSalaryStructure(id, token) {
  return apiClient('DELETE', `/salary-structures/${id}`, null, token);
}