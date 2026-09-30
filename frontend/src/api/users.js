import apiClient from './client';

export function getUsers(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiClient('GET', `/users${qs ? '?' + qs : ''}`, null, token);
}