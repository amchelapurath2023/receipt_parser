import { useState, useCallback, useMemo } from 'react';
import type { ReceiptItem, Person, PersonSummary } from '@/types/receipt';

export function useReceiptState() {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);

  const calculatedSubtotal = useMemo(() => 
    items.reduce((sum, item) => sum + item.price, 0), 
    [items]
  );

  const hasMatch = useMemo(() => 
    Math.abs(calculatedSubtotal - subtotal) < 0.01 && subtotal > 0,
    [calculatedSubtotal, subtotal]
  );

  const addItem = useCallback((name: string = '', price: number = 0) => {
    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      name,
      price,
      assignedTo: [],
    };
    setItems(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<ReceiptItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const addPerson = useCallback((name: string) => {
    const colorIndex = (people.length % 6) + 1;
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name,
      colorIndex,
    };
    setPeople(prev => [...prev, newPerson]);
    return newPerson;
  }, [people.length]);

  const removePerson = useCallback((id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(name => 
        !people.find(p => p.id === id && p.name === name)
      ),
    })));
  }, [people]);

  const toggleAssignment = useCallback((itemId: string, personName: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const isAssigned = item.assignedTo.includes(personName);
      return {
        ...item,
        assignedTo: isAssigned
          ? item.assignedTo.filter(n => n !== personName)
          : [...item.assignedTo, personName],
      };
    }));
  }, []);

  const calculateSplit = useCallback((): PersonSummary[] => {
    const taxRate = subtotal > 0 ? tax / subtotal : 0;
    
    return people.map(person => {
      const personItems = items
        .filter(item => item.assignedTo.includes(person.name))
        .map(item => ({
          name: item.name,
          price: item.price,
          split: item.assignedTo.length,
        }));

      const personSubtotal = personItems.reduce(
        (sum, item) => sum + item.price / item.split,
        0
      );
      const personTax = personSubtotal * taxRate;

      return {
        name: person.name,
        subtotal: personSubtotal,
        taxShare: personTax,
        total: personSubtotal + personTax,
        items: personItems,
      };
    });
  }, [items, people, subtotal, tax]);

  const loadReceiptData = useCallback((data: {
    items?: ReceiptItem[];
    subtotal?: number;
    tax?: number;
    total?: number;
  }) => {
    if (data.items) setItems(data.items);
    setSubtotal(Number(data.subtotal) || 0);
    setTax(Number(data.tax) || 0);
    setTotal(Number(data.total) || 0);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setPeople([]);
    setSubtotal(0);
    setTax(0);
    setTotal(0);
  }, []);

  return {
    items,
    setItems,
    people,
    setPeople,
    subtotal,
    setSubtotal,
    tax,
    setTax,
    total,
    setTotal,
    calculatedSubtotal,
    hasMatch,
    addItem,
    updateItem,
    deleteItem,
    addPerson,
    removePerson,
    toggleAssignment,
    calculateSplit,
    loadReceiptData,
    reset,
  };
}
