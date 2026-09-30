import apiClient from './client';

export function getEmergencyContactByEmployee(employeeId, token) {
  return apiClient('GET', `/emergency-contacts/employee/${employeeId}`, null, token);
}

export function createEmergencyContact(data, token) {
  return apiClient('POST', '/emergency-contacts', data, token);
}

export function updateEmergencyContact(id, data, token) {
  return apiClient('PUT', `/emergency-contacts/${id}`, data, token);
}

export function deleteEmergencyContact(id, token) {
  return apiClient('DELETE', `/emergency-contacts/${id}`, null, token);
}