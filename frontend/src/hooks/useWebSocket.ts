import { useEffect, useRef, useCallback, useState } from 'react';
import { endpoints } from '@/config/api';
import type { ReceiptItem, Person } from '@/types/receipt';

interface UseWebSocketOptions {
  sessionId: string | null;
  onItemsUpdate: (items: ReceiptItem[]) => void;
  onPeopleUpdate: (people: Person[]) => void;
  onReceiptDataUpdate?: (data: { subtotal: number; tax: number; total: number; items?: ReceiptItem[] }) => void;
}

interface SyncMessage {
  type: 'sync';
  payload: {
    items: ReceiptItem[];
    people: Person[];
    subtotal: number;
    tax: number;
    total: number;
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

interface UsersMessage {
  type: 'users';
  payload: {
    count: number;
  };
}

type WebSocketMessage = SyncMessage | ItemsMessage | PeopleMessage | UsersMessage;

export function useWebSocket({ sessionId, onItemsUpdate, onPeopleUpdate, onReceiptDataUpdate }: UseWebSocketOptions) {
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
        } else if (data.type === 'users') {
          setConnectedUsers(data.payload.count);
        } else if (data.type === 'sync') {
          console.log('Received sync:', data.payload);
          // Handle full state sync - let the receipt data handler take care of items
          if (data.payload.people) onPeopleUpdate(data.payload.people);
          if (onReceiptDataUpdate) {
            onReceiptDataUpdate({
              subtotal: data.payload.subtotal || 0,
              tax: data.payload.tax || 0,
              total: data.payload.total || 0,
              items: data.payload.items || []
            });
          } else if (data.payload.items) {
            // Fallback if no receipt data handler
            onItemsUpdate(data.payload.items);
          }
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
  }, [sessionId, onItemsUpdate, onPeopleUpdate, onReceiptDataUpdate]);

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

  const sendSync = useCallback((items: ReceiptItem[], people: Person[], subtotal: number, tax: number, total: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'sync', 
        payload: { items, people, subtotal, tax, total } 
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