import apiClient from './client';

export function getOvertimeRecords(params, token) {
  const q = new URLSearchParams();
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  if (params?.status) q.set('status', params.status);
  if (params?.fromDate) q.set('fromDate', params.fromDate);
  if (params?.toDate) q.set('toDate', params.toDate);
  const qs = q.toString();
  return apiClient('GET', `/overtime${qs ? `?${qs}` : ''}`, null, token);
}

export function getOvertimeRecord(id, token) {
  return apiClient('GET', `/overtime/${id}`, null, token);
}

export function createOvertimeRecord(data, token) {
  return apiClient('POST', '/overtime', data, token);
}

export function updateOvertimeRecord(id, data, token) {
  return apiClient('PUT', `/overtime/${id}`, data, token);
}

export function approveOvertimeRecord(id, data, token) {
  return apiClient('PATCH', `/overtime/${id}/approve`, data, token);
}

export function deleteOvertimeRecord(id, token) {
  return apiClient('DELETE', `/overtime/${id}`, null, token);
}