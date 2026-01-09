import { useEffect, useRef, useCallback, useState } from 'react';
import { endpoints } from '@/config/api';
import type { ReceiptItem, Person } from '@/types/receipt';

interface UseWebSocketOptions {
  sessionId: string | null;
  onItemsUpdate: (items: ReceiptItem[]) => void;
  onPeopleUpdate: (people: Person[]) => void;
}

export function useWebSocket({ sessionId, onItemsUpdate, onPeopleUpdate }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1);

  const connect = useCallback(() => {
    if (!sessionId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(endpoints.ws(sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'items') {
          onItemsUpdate(data.payload);
        } else if (data.type === 'people') {
          onPeopleUpdate(data.payload);
        } else if (data.type === 'users') {
          setConnectedUsers(data.payload.count || 1);
        } else if (data.type === 'sync') {
          if (data.payload.items) onItemsUpdate(data.payload.items);
          if (data.payload.people) onPeopleUpdate(data.payload.people);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [sessionId, onItemsUpdate, onPeopleUpdate]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const sendItems = useCallback((items: ReceiptItem[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sync', payload: items }));
    }
  }, []);

  const sendPeople = useCallback((people: Person[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'people', payload: people }));
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  return {
    isConnected,
    connectedUsers,
    sendItems,
    sendPeople,
    connect,
    disconnect,
  };
}
