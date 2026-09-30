import apiClient from './client';

export function getSalaryStructuresMaster(token) {
  return apiClient('GET', '/salary-structures-master', null, token);
}

export function getSalaryStructureMaster(id, token) {
  return apiClient('GET', `/salary-structures-master/${id}`, null, token);
}

export function createSalaryStructureMaster(data, token) {
  return apiClient('POST', '/salary-structures-master', data, token);
}

export function updateSalaryStructureMaster(id, data, token) {
  return apiClient('PUT', `/salary-structures-master/${id}`, data, token);
}

export function deleteSalaryStructureMaster(id, token) {
  return apiClient('DELETE', `/salary-structures-master/${id}`, null, token);
}

export function addSalaryStructureComponent(structureId, data, token) {
  return apiClient('POST', `/salary-structures-master/${structureId}/components`, data, token);
}

export function removeSalaryStructureComponent(structureId, componentId, token) {
  return apiClient('DELETE', `/salary-structures-master/${structureId}/components/${componentId}`, null, token);
}