import apiClient from './client';

export function getShifts(token) {
  return apiClient('GET', '/shifts', null, token);
}

export function getShift(id, token) {
  return apiClient('GET', `/shifts/${id}`, null, token);
}

export function createShift(data, token) {
  return apiClient('POST', '/shifts', data, token);
}

export function updateShift(id, data, token) {
  return apiClient('PUT', `/shifts/${id}`, data, token);
}

export function deleteShift(id, token) {
  return apiClient('DELETE', `/shifts/${id}`, null, token);
}