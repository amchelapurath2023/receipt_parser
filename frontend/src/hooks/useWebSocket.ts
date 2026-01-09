import { useEffect, useRef, useCallback, useState } from 'react';
import { endpoints } from '@/config/api';
import type { ReceiptItem, Person } from '@/types/receipt';

interface UseWebSocketOptions {
  sessionId: string | null;
  onItemsUpdate: (items: ReceiptItem[]) => void;
  onPeopleUpdate: (people: Person[]) => void;
}

interface SyncMessage {
  type: 'sync';
  payload: {
    items: ReceiptItem[];
    people: Person[];
    subtotal?: number;
    tax?: number;
    total?: number;
  };
}

interface ItemsMessage {
  type: 'items';
  payload: ReceiptItem[];
}

interface PeopleMessage {
  type: 'people';
  payload: Person[];
}

type WebSocketMessage = SyncMessage | ItemsMessage | PeopleMessage;

export function useWebSocket({ sessionId, onItemsUpdate, onPeopleUpdate }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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
        const data: WebSocketMessage = JSON.parse(event.data);
        
        if (data.type === 'items') {
          onItemsUpdate(data.payload);
        } else if (data.type === 'people') {
          onPeopleUpdate(data.payload);
        } else if (data.type === 'sync') {
          // Handle full state sync
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
      
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (sessionId) connect();
      }, 2000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [sessionId, onItemsUpdate, onPeopleUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const sendItems = useCallback((items: ReceiptItem[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'items', payload: items }));
    }
  }, []);

  const sendPeople = useCallback((people: Person[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'people', payload: people }));
    }
  }, []);

  const sendSync = useCallback((items: ReceiptItem[], people: Person[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'sync', 
        payload: { items, people } 
      }));
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
    sendSync,
    connect,
    disconnect,
  };
}