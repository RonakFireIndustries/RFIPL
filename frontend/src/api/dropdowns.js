import apiClient from './client';

export function getShifts(token) {
  return apiClient('GET', '/shifts', null, token);
}

export function getSalaryStructuresMaster(token) {
  return apiClient('GET', '/salary-structures-master', null, token);
}

export function getEmployees(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiClient('GET', `/employees${qs ? '?' + qs : ''}`, null, token);
}