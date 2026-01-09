// Configure these to point to your Go backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const endpoints = {
  upload: `${API_BASE_URL}/upload`,
  ws: (sessionId: string) => `${WS_BASE_URL}/ws/${sessionId}`,
};
