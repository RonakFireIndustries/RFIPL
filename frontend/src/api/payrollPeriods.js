import apiClient from './client';

export function getPayrollPeriods(token) {
  return apiClient('GET', '/payroll-periods', null, token);
}

export function getPayrollPeriod(id, token) {
  return apiClient('GET', `/payroll-periods/${id}`, null, token);
}

export function createPayrollPeriod(data, token) {
  return apiClient('POST', '/payroll-periods', data, token);
}

export function updatePayrollPeriod(id, data, token) {
  return apiClient('PUT', `/payroll-periods/${id}`, data, token);
}

export function deletePayrollPeriod(id, token) {
  return apiClient('DELETE', `/payroll-periods/${id}`, null, token);
}