import apiClient from './client';

export function getActiveWorkLocation(token) {
  return apiClient('GET', '/work-locations/active', null, token);
}

export function getWorkLocations(token) {
  return apiClient('GET', '/work-locations', null, token);
}

export function getWorkLocation(id, token) {
  return apiClient('GET', `/work-locations/${id}`, null, token);
}

export function createWorkLocation(data, token) {
  return apiClient('POST', '/work-locations', data, token);
}

export function updateWorkLocation(id, data, token) {
  return apiClient('PUT', `/work-locations/${id}`, data, token);
}

export function deleteWorkLocation(id, token) {
  return apiClient('DELETE', `/work-locations/${id}`, null, token);
}