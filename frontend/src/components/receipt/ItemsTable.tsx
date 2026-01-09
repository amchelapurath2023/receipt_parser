import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ItemRow } from './ItemRow';
import type { ReceiptItem, Person } from '@/types/receipt';

interface ItemsTableProps {
  items: ReceiptItem[];
  people: Person[];
  subtotal: number;
  calculatedSubtotal: number;
  hasMatch: boolean;
  onUpdateItem: (id: string, updates: Partial<ReceiptItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
  onToggleAssignment: (itemId: string, personName: string) => void;
}

export function ItemsTable({
  items,
  people,
  subtotal,
  calculatedSubtotal,
  hasMatch,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onToggleAssignment,
}: ItemsTableProps) {
  return (
    <div className="space-y-4">
      {/* Mismatch Warning */}
      {!hasMatch && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Items total (${calculatedSubtotal.toFixed(2)}) doesn't match receipt subtotal (${subtotal.toFixed(2)}). 
            Please verify the items.
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Item</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground w-32">Price</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Assigned To</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                people={people}
                onUpdate={(updates) => onUpdateItem(item.id, updates)}
                onDelete={() => onDeleteItem(item.id)}
                onToggleAssignment={(personName) => onToggleAssignment(item.id, personName)}
              />
            ))}
          </tbody>
        </table>

        {/* Add Item Button */}
        <div className="p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={onAddItem}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="flex justify-end gap-8 px-4 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground">Items Total:</span>
          <span className="font-mono font-medium">${calculatedSubtotal.toFixed(2)}</span>
        </div>
        {subtotal > 0 && (
          <div className="flex gap-2">
            <span className="text-muted-foreground">Receipt Subtotal:</span>
            <span className="font-mono font-medium">${subtotal.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
