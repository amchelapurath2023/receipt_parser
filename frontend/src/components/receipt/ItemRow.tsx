import { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonChip } from './PersonChip';
import { cn } from '@/lib/utils';
import type { ReceiptItem, Person } from '@/types/receipt';

interface ItemRowProps {
  item: ReceiptItem;
  people: Person[];
  onUpdate: (updates: Partial<ReceiptItem>) => void;
  onDelete: () => void;
  onToggleAssignment: (personName: string) => void;
}

export function ItemRow({ 
  item, 
  people, 
  onUpdate, 
  onDelete, 
  onToggleAssignment,
}: ItemRowProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [tempName, setTempName] = useState(item.name);
  const [tempPrice, setTempPrice] = useState(item.price.toFixed(2));
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingPrice && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingPrice]);

  const handleNameBlur = () => {
    setEditingName(false);
    if (tempName !== item.name) {
      onUpdate({ name: tempName });
    }
  };

  const handlePriceBlur = () => {
    setEditingPrice(false);
    const newPrice = parseFloat(tempPrice) || 0;
    if (newPrice !== item.price) {
      onUpdate({ price: newPrice });
      setTempPrice(newPrice.toFixed(2));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, onBlur: () => void) => {
    if (e.key === 'Enter') {
      onBlur();
    } else if (e.key === 'Escape') {
      setTempName(item.name);
      setTempPrice(item.price.toFixed(2));
      setEditingName(false);
      setEditingPrice(false);
    }
  };

  return (
    <tr className="group hover:bg-muted/50 transition-colors">
      {/* Item Name */}
      <td className="py-3 px-4">
        {editingName ? (
          <Input
            ref={nameInputRef}
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => handleKeyDown(e, handleNameBlur)}
            className="h-8"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className={cn(
              'text-left w-full px-2 py-1 rounded hover:bg-muted -mx-2',
              !item.name && 'text-muted-foreground italic'
            )}
          >
            {item.name || 'Click to add name'}
          </button>
        )}
      </td>

      {/* Price */}
      <td className="py-3 px-4 w-32">
        {editingPrice ? (
          <Input
            ref={priceInputRef}
            type="number"
            step="0.01"
            value={tempPrice}
            onChange={(e) => setTempPrice(e.target.value)}
            onBlur={handlePriceBlur}
            onKeyDown={(e) => handleKeyDown(e, handlePriceBlur)}
            className="h-8 text-right font-mono"
          />
        ) : (
          <button
            onClick={() => setEditingPrice(true)}
            className="text-right w-full px-2 py-1 rounded hover:bg-muted font-mono"
          >
            ${item.price.toFixed(2)}
          </button>
        )}
      </td>

      {/* Assigned To */}
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1.5">
          {people.map((person) => {
            const isAssigned = item.assignedTo.includes(person.name);
            return (
              <PersonChip
                key={person.id}
                name={person.name}
                colorIndex={person.colorIndex}
                isSelected={isAssigned}
                onToggle={() => onToggleAssignment(person.name)}
                size="sm"
              />
            );
          })}
          {people.length === 0 && (
            <span className="text-sm text-muted-foreground italic">
              Add people first
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="py-3 px-4 w-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}
