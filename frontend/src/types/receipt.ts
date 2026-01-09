export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

export interface Person {
  id: string;
  name: string;
  colorIndex: number;
}

export interface PersonSummary {
  name: string;
  subtotal: number;
  taxShare: number;
  total: number;
  items: { name: string; price: number; split: number }[];
}

export interface ReceiptData {
  items: ReceiptItem[];
  people: Person[];
  subtotal: number;
  tax: number;
  total: number;
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export interface WebSocketMessage {
  type: 'items' | 'people' | 'sync';
  payload: unknown;
}
