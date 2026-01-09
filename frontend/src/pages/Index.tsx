import { useCallback, useMemo, useEffect } from 'react';
import { Header } from '@/components/receipt/Header';
import { SessionBar } from '@/components/receipt/SessionBar';
import { UploadZone } from '@/components/receipt/UploadZone';
import { PeopleManager } from '@/components/receipt/PeopleManager';
import { ItemsTable } from '@/components/receipt/ItemsTable';
import { SplitSummary } from '@/components/receipt/SplitSummary';
import { useReceiptState } from '@/hooks/useReceiptState';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSessionId } from '@/hooks/useSessionId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { sessionId, setSessionId, generateNewSession } = useSessionId();
  
  const {
    items, setItems, people, setPeople, subtotal, tax, total,
    calculatedSubtotal, hasMatch, addItem, updateItem, deleteItem,
    addPerson, removePerson, toggleAssignment, calculateSplit, loadReceiptData, reset,
    setSubtotal, setTax, setTotal,
  } = useReceiptState();

  const handleItemsUpdate = useCallback((newItems: typeof items) => setItems(newItems), [setItems]);
  const handlePeopleUpdate = useCallback((newPeople: typeof people) => setPeople(newPeople), [setPeople]);
  
  const handleReceiptDataUpdate = useCallback((data: { subtotal: number; tax: number; total: number; items: typeof items }) => {
    // Update items separately through setItems to avoid conflicts
    setItems(data.items);
    // Update receipt totals
    setSubtotal(data.subtotal);
    setTax(data.tax);
    setTotal(data.total);
  }, [setItems, setSubtotal, setTax, setTotal]);

  const { isConnected, connectedUsers, sendItems, sendPeople, sendSync } = useWebSocket({
    sessionId, 
    onItemsUpdate: handleItemsUpdate, 
    onPeopleUpdate: handlePeopleUpdate,
    onReceiptDataUpdate: handleReceiptDataUpdate,
  });

  // Send full state sync when connection is established
  useEffect(() => {
    if (isConnected && (items.length > 0 || people.length > 0)) {
      // Use setTimeout to avoid sending on every state change
      const timer = setTimeout(() => {
        console.log('Syncing state:', { items: items.length, people: people.length, subtotal, tax, total });
        sendSync(items, people, subtotal, tax, total);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<typeof items[0]>) => {
    const updatedItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
    updateItem(id, updates);
    sendSync(updatedItems, people, subtotal, tax, total);
  }, [updateItem, items, people, subtotal, tax, total, sendSync]);

  const handleDeleteItem = useCallback((id: string) => { 
    const filteredItems = items.filter(item => item.id !== id);
    deleteItem(id); 
    sendSync(filteredItems, people, subtotal, tax, total);
  }, [deleteItem, items, people, subtotal, tax, total, sendSync]);

  const handleAddItem = useCallback(() => { 
    const newItem = addItem(); 
    sendSync([...items, newItem], people, subtotal, tax, total);
  }, [addItem, items, people, subtotal, tax, total, sendSync]);

  // FIX: Now syncs item assignments
  const handleToggleAssignment = useCallback((itemId: string, personName: string) => {
    toggleAssignment(itemId, personName);
    // Send updated items after assignment change
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const assigned = new Set(item.assignedTo);
        if (assigned.has(personName)) {
          assigned.delete(personName);
        } else {
          assigned.add(personName);
        }
        return { ...item, assignedTo: Array.from(assigned) };
      }
      return item;
    });
    sendSync(updatedItems, people, subtotal, tax, total);
  }, [toggleAssignment, items, people, subtotal, tax, total, sendSync]);

  const handleAddPerson = useCallback((name: string) => { 
    const newPerson = addPerson(name); 
    sendSync(items, [...people, newPerson], subtotal, tax, total);
  }, [addPerson, items, people, subtotal, tax, total, sendSync]);

  const handleRemovePerson = useCallback((id: string) => { 
    const filteredPeople = people.filter(p => p.id !== id);
    removePerson(id); 
    sendSync(items, filteredPeople, subtotal, tax, total);
  }, [removePerson, items, people, subtotal, tax, total, sendSync]);

  const handleJoinSession = useCallback((newSessionId: string) => { 
    reset(); 
    setSessionId(newSessionId); 
  }, [reset, setSessionId]);

  const handleNewSession = useCallback(() => { 
    reset(); 
    generateNewSession(); 
  }, [reset, generateNewSession]);

  // FIX: Send full sync when receipt is uploaded
  const handleUploadSuccess = useCallback((data: { items: typeof items; subtotal: number; tax: number; total: number; }) => { 
    loadReceiptData(data); 
    sendSync(data.items, people, data.subtotal, data.tax, data.total);
  }, [loadReceiptData, sendSync, people]);

  const summaries = useMemo(() => calculateSplit(), [calculateSplit]);

  const handleDownloadCSV = useCallback(() => {
    const headers = ['Person', 'Item', 'Price', 'Split', 'Share', 'Tax', 'Total'];
    const rows: string[][] = [];
    summaries.forEach(s => s.items.forEach((item, idx) => rows.push([idx === 0 ? s.name : '', item.name, `$${item.price.toFixed(2)}`, `1/${item.split}`, `$${(item.price / item.split).toFixed(2)}`, idx === 0 ? `$${s.taxShare.toFixed(2)}` : '', idx === 0 ? `$${s.total.toFixed(2)}` : ''])));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `receipt-split-${sessionId}.csv`; a.click();
  }, [summaries, sessionId]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <SessionBar sessionId={sessionId} connectedUsers={connectedUsers} isConnected={isConnected} onJoinSession={handleJoinSession} onNewSession={handleNewSession} />
        <Card><CardHeader><CardTitle>Upload Receipt</CardTitle></CardHeader><CardContent><UploadZone onUploadSuccess={handleUploadSuccess} sessionId={sessionId} /></CardContent></Card>
        <Card><CardHeader><CardTitle>People</CardTitle></CardHeader><CardContent><PeopleManager people={people} onAddPerson={handleAddPerson} onRemovePerson={handleRemovePerson} /></CardContent></Card>
        {items.length > 0 && <div className="animate-fade-in"><h2 className="text-lg font-semibold mb-4">Items</h2><ItemsTable items={items} people={people} subtotal={subtotal} calculatedSubtotal={calculatedSubtotal} hasMatch={hasMatch} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} onAddItem={handleAddItem} onToggleAssignment={handleToggleAssignment} /></div>}
        {items.length > 0 && people.length > 0 && <div className="animate-fade-in"><h2 className="text-lg font-semibold mb-4">Split Summary</h2><SplitSummary summaries={summaries} people={people} tax={tax} total={total} onDownloadCSV={handleDownloadCSV} /></div>}
      </main>
    </div>
  );
};

export default Index;