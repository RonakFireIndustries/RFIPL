import apiClient from './client';

export function getDepartments(token) {
  return apiClient('GET', '/departments', null, token);
}

export function getActiveDepartments(token) {
  return apiClient('GET', '/departments/active', null, token);
}

export function getDepartment(id, token) {
  return apiClient('GET', `/departments/${id}`, null, token);
}

export function createDepartment(data, token) {
  return apiClient('POST', '/departments', data, token);
}

export function updateDepartment(id, data, token) {
  return apiClient('PUT', `/departments/${id}`, data, token);
}

export function deleteDepartment(id, token) {
  return apiClient('DELETE', `/departments/${id}`, null, token);
}