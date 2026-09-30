import apiClient from './client';

export function getPayrolls(params, token) {
  const q = new URLSearchParams();
  if (params?.payrollPeriodId) q.set('payrollPeriodId', params.payrollPeriodId);
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  return apiClient('GET', `/payroll${qs ? `?${qs}` : ''}`, null, token);
}

export function getPayroll(id, token) {
  return apiClient('GET', `/payroll/${id}`, null, token);
}

export function createPayroll(data, token) {
  return apiClient('POST', '/payroll', data, token);
}

export function generatePayroll(data, token) {
  return apiClient('POST', '/payroll/generate', data, token);
}

export function createPayrollItem(payrollId, data, token) {
  return apiClient('POST', `/payroll/${payrollId}/items`, data, token);
}

export function getPayrollItems(payrollId, token) {
  return apiClient('GET', `/payroll/${payrollId}/items`, null, token);
}

export function deletePayrollItem(payrollId, itemId, token) {
  return apiClient('DELETE', `/payroll/${payrollId}/items/${itemId}`, null, token);
}

export function updatePayrollStatus(id, status, token) {
  return apiClient('PATCH', `/payroll/${id}/status`, { status }, token);
}

export function deletePayroll(id, token) {
  return apiClient('DELETE', `/payroll/${id}`, null, token);
}