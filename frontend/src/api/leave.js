import apiClient from './client';

export function getLeaveTypes(token) {
  return apiClient('GET', '/leave-types', null, token);
}

export function createLeaveType(data, token) {
  return apiClient('POST', '/leave-types', data, token);
}

export function updateLeaveType(id, data, token) {
  return apiClient('PUT', `/leave-types/${id}`, data, token);
}

export function deleteLeaveType(id, token) {
  return apiClient('DELETE', `/leave-types/${id}`, null, token);
}

export function getLeaveRequests(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiClient('GET', `/leave-requests${qs ? `?${qs}` : ''}`, null, token);
}

export function getMyLeaveRequests(token) {
  return apiClient('GET', '/leave-requests/mine', null, token);
}

export function getLeaveBalance(token, year) {
  const qs = year ? `?year=${year}` : '';
  return apiClient('GET', `/leave-requests/balance${qs}`, null, token);
}

export function getApprovalQueue(token, status) {
  const qs = status ? `?status=${status}` : '';
  return apiClient('GET', `/leave-requests/approvals${qs}`, null, token);
}

export function createLeaveRequest(data, token) {
  return apiClient('POST', '/leave-requests', data, token);
}

export function reviewLeaveRequest(id, data, token) {
  return apiClient('PATCH', `/leave-requests/${id}/review`, data, token);
}

export function cancelLeaveRequest(id, token) {
  return apiClient('DELETE', `/leave-requests/${id}`, null, token);
}