import apiClient from './client';

export function getAttendanceRules(token) {
  return apiClient('GET', '/attendance-rules', null, token);
}

export function updateAttendanceRules(data, token) {
  return apiClient('PUT', '/attendance-rules', data, token);
}