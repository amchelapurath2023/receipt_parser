import { createRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import './App.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

function App() {
  const fileInput = createRef();
  const [items, setItems] = useState([]);
  const [total, setSubtotal] = useState(0);
  const [matches, setMatches] = useState(true);
  const [loading, setLoading] = useState(false);


  const priceBodyTemplate = (rowData) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(rowData.price);
  };
  
  const handleCalculate = () => {
    const assignments = {};
    let totalItemCost = 0;
  
    items.forEach(item => {
      const names = item.assignee.split(',').map(name => name.trim()).filter(Boolean);
      if (!item.price || names.length === 0) return;
  
      const share = item.price / names.length;
      totalItemCost += item.price;
  
      names.forEach(name => {
        assignments[name] = (assignments[name] || 0) + share;
      });
    });
  
    const taxAmount = matches ? 0 : total - totalItemCost;
    Object.keys(assignments).forEach(name => {
      const weight = assignments[name] / totalItemCost;
      assignments[name] += weight * taxAmount;
    });
  
    const rows = ['Name,Total'];
    Object.entries(assignments).forEach(([name, cost]) => {
      rows.push(`${name},${cost.toFixed(2)}`);
    });
    const csvContent = rows.join('\n');
  
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "split-costs.csv");
    link.click();
  };

  const onRowEditComplete = (e) => {
    const updatedItem = e.newData;
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const textEditor = (options) => (
    <InputText
      value={options.value}
      onChange={(e) => options.editorCallback(e.target.value)}
    />
  );

  const numberEditor = (options) => (
    <InputNumber
      value={options.value}
      onValueChange={(e) => options.editorCallback(e.value)}
      mode="decimal"
      minFractionDigits={2}
    />
  );

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: uuid(),
        item_name: '',
        price: 0,
        assignee: '',
      },
    ]);
  };

  const handleDeleteRow = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set('receipt', fileInput.current.files[0]);

    setLoading(true);
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      const parsedResponse = await response.json();
      const parsed = parsedResponse.items.map((item) => ({
        ...item,
        id: uuid(),
        assignee: '',
      }));
      setItems(parsed);
      setSubtotal(parsedResponse.total);
      setMatches(parsedResponse.matches);

      if (response.ok) {
        alert('File uploaded');
      } else {
        console.error('Some error occurred. Try again');
      }
    } catch (e) {
      console.error(e.message);
    }
    finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <form onSubmit={onSubmit}>
        <input type="file" name="receipt" ref={fileInput} />
        {loading && <p>Uploading and processing receipt...</p>}
        <input type="submit" value="Submit" disabled={loading} />
      </form>

      {!matches && (
        <div style={{
          backgroundColor: '#ffe6e6',
          color: '#b30000',
          padding: '10px',
          marginBottom: '10px',
          border: '1px solid #b30000',
          borderRadius: '4px'
        }}>
          ⚠️ Total price mismatch: Items may be missing or prices may be incorrect.
        </div>
      )}

      <DataTable
        value={items}
        editMode="row"
        dataKey="id"
        onRowEditComplete={onRowEditComplete}
      >
        <Column field="item_name" header="Item" editor={textEditor} />
        <Column field="price" header="Price" editor={numberEditor} body={priceBodyTemplate} />
        <Column field="assignee" header="People" editor={textEditor} />
        <Column rowEditor headerStyle={{ width: '10rem' }} />
        <Column
          header="Delete"
          body={(rowData) => (
            <button onClick={() => handleDeleteRow(rowData.id)}>🗑️</button>
          )}
          style={{ width: '5rem' }}
        />
      </DataTable>

      <button onClick={handleAddRow}>Add Item</button>
      <button onClick={handleCalculate} disabled={items.length === 0}>
      Calculate & Download CSV
    </button>
    </div>
  );
}

export default App;
