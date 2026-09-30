import apiClient from './client';

export function getDocumentsByEmployee(employeeId, token) {
  return apiClient('GET', `/documents/employee/${employeeId}`, null, token);
}

export function createDocument(data, token) {
  return apiClient('POST', '/documents', data, token);
}

export function updateDocument(id, data, token) {
  return apiClient('PUT', `/documents/${id}`, data, token);
}

export function deleteDocument(id, token) {
  return apiClient('DELETE', `/documents/${id}`, null, token);
}