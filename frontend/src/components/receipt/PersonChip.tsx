import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonChipProps {
  name: string;
  colorIndex: number;
  isSelected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

const colorClasses: Record<number, string> = {
  1: 'bg-assignee-1/20 text-assignee-1 border-assignee-1/30',
  2: 'bg-assignee-2/20 text-assignee-2 border-assignee-2/30',
  3: 'bg-assignee-3/20 text-assignee-3 border-assignee-3/30',
  4: 'bg-assignee-4/20 text-assignee-4 border-assignee-4/30',
  5: 'bg-assignee-5/20 text-assignee-5 border-assignee-5/30',
  6: 'bg-assignee-6/20 text-assignee-6 border-assignee-6/30',
};

const selectedColorClasses: Record<number, string> = {
  1: 'bg-assignee-1 text-white border-assignee-1',
  2: 'bg-assignee-2 text-white border-assignee-2',
  3: 'bg-assignee-3 text-white border-assignee-3',
  4: 'bg-assignee-4 text-white border-assignee-4',
  5: 'bg-assignee-5 text-white border-assignee-5',
  6: 'bg-assignee-6 text-white border-assignee-6',
};

export function PersonChip({ 
  name, 
  colorIndex, 
  isSelected = false, 
  onToggle, 
  onRemove,
  size = 'md',
}: PersonChipProps) {
  const baseClasses = isSelected 
    ? selectedColorClasses[colorIndex] || selectedColorClasses[1]
    : colorClasses[colorIndex] || colorClasses[1];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border rounded-full font-medium transition-all',
        baseClasses,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        onToggle && 'cursor-pointer hover:opacity-80',
      )}
      onClick={onToggle}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:opacity-70"
        >
          <X className={cn('w-3 h-3', size === 'sm' && 'w-2.5 h-2.5')} />
        </button>
      )}
    </span>
  );
}
