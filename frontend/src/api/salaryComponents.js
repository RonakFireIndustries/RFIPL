import apiClient from './client';

export function getSalaryComponents(token) {
  return apiClient('GET', '/salary-components', null, token);
}

export function getSalaryComponent(id, token) {
  return apiClient('GET', `/salary-components/${id}`, null, token);
}

export function createSalaryComponent(data, token) {
  return apiClient('POST', '/salary-components', data, token);
}

export function updateSalaryComponent(id, data, token) {
  return apiClient('PUT', `/salary-components/${id}`, data, token);
}

export function deleteSalaryComponent(id, token) {
  return apiClient('DELETE', `/salary-components/${id}`, null, token);
}