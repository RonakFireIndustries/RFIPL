import apiClient from './client';

export function getBankDetailsByEmployee(employeeId, token) {
  return apiClient('GET', `/bank-details/employee/${employeeId}`, null, token);
}

export function createBankDetails(data, token) {
  return apiClient('POST', '/bank-details', data, token);
}

export function updateBankDetails(id, data, token) {
  return apiClient('PUT', `/bank-details/${id}`, data, token);
}

export function deleteBankDetails(id, token) {
  return apiClient('DELETE', `/bank-details/${id}`, null, token);
}