import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonChip } from './PersonChip';
import type { Person } from '@/types/receipt';

interface PeopleManagerProps {
  people: Person[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
}

export function PeopleManager({ people, onAddPerson, onRemovePerson }: PeopleManagerProps) {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (name && !people.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      onAddPerson(name);
      setNewName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add person..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button 
          size="sm" 
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              colorIndex={person.colorIndex}
              onRemove={() => onRemovePerson(person.id)}
            />
          ))}
        </div>
      )}

      {people.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Add people to split the receipt with
        </p>
      )}
    </div>
  );
}
