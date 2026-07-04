import { apiFetch } from './client.js';

export async function getChatMessages(orderId) {
  return apiFetch(`/api/chat/${orderId}`);
}

export async function saveChatMessages(orderId, messages) {
  return apiFetch(`/api/chat/${orderId}`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}
