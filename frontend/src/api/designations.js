import apiClient from './client';

export function getDesignations(token) {
  return apiClient('GET', '/designations', null, token);
}

export function getActiveDesignations(token) {
  return apiClient('GET', '/designations/active', null, token);
}

export function getDesignation(id, token) {
  return apiClient('GET', `/designations/${id}`, null, token);
}

export function createDesignation(data, token) {
  return apiClient('POST', '/designations', data, token);
}

export function updateDesignation(id, data, token) {
  return apiClient('PUT', `/designations/${id}`, data, token);
}

export function deleteDesignation(id, token) {
  return apiClient('DELETE', `/designations/${id}`, null, token);
}