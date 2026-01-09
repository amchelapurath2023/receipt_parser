const isProd = import.meta.env.PROD;

const BASE_DOMAIN = isProd 
    ? 'backend-receiptparser-production.up.railway.app' 
    : 'localhost:8000';

const httpProtocol = isProd ? 'https' : 'http';
const wsProtocol = isProd ? 'wss' : 'ws';

export const API_BASE_URL = `${httpProtocol}://${BASE_DOMAIN}`;
export const WS_BASE_URL = `${wsProtocol}://${BASE_DOMAIN}`;

export const endpoints = {
  upload: `${API_BASE_URL}/upload`,
  ws: (sessionId: string) => `${WS_BASE_URL}/ws/${sessionId}`,
};