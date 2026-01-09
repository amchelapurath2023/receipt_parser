import { useState, useCallback } from 'react';

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>(() => {
    // Check URL for session ID first
    const urlParams = new URLSearchParams(window.location.search);
    const urlSession = urlParams.get('session');
    if (urlSession) {
      return urlSession.toUpperCase();
    }
    
    // Check localStorage for existing session
    const stored = localStorage.getItem('receipt-session-id');
    if (stored) {
      return stored;
    }
    
    // Generate new session
    const newId = generateSessionId();
    localStorage.setItem('receipt-session-id', newId);
    return newId;
  });

  const generateNewSession = useCallback(() => {
    const newId = generateSessionId();
    localStorage.setItem('receipt-session-id', newId);
    setSessionId(newId);
    
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
    
    return newId;
  }, []);

  const updateSessionId = useCallback((newId: string) => {
    const upperId = newId.toUpperCase();
    localStorage.setItem('receipt-session-id', upperId);
    setSessionId(upperId);
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('session', upperId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  return {
    sessionId,
    setSessionId: updateSessionId,
    generateNewSession,
  };
}
