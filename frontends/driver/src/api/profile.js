import { apiFetch } from './client.js';

export async function getProfile(email) {
  return apiFetch(`/api/profile/${encodeURIComponent(email)}`);
}

export async function updateProfile(email, data) {
  return apiFetch(`/api/profile/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
