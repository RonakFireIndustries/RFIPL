import apiClient from './client';

export function loginUser(email, password) {
  return apiClient('POST', '/auth/login', { email, password });
}

export function registerUser(email, password) {
  return apiClient('POST', '/auth/register', { email, password });
}

export function getMe(token) {
  return apiClient('GET', '/auth/me', null, token);
}

export function refreshToken(refreshToken) {
  return apiClient('POST', '/auth/refresh', { refreshToken });
}

export function logoutUser(refreshToken) {
  return apiClient('POST', '/auth/logout', { refreshToken });
}

export function forgotPassword(email) {
  return apiClient('POST', '/auth/forgot-password', { email });
}

export function resetPassword(resetToken, newPassword) {
  return apiClient('POST', '/auth/reset-password', { resetToken, newPassword });
}

export function changePassword(currentPassword, newPassword, token) {
  return apiClient('POST', '/auth/change-password', { currentPassword, newPassword }, token);
}