import { createRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import './App.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

function App() {
  const fileInput = createRef();
  const [items, setItems] = useState([]);
  const [total, setSubtotal] = useState(0);
  const [matches, setMatches] = useState(true);
  const [editingRows, setEditingRows] = useState({});


  const onRowEditComplete = (e) => {
    const updatedItem = e.newData;
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const textEditor = (options) => {
    return (
      <input
        type="text"
        value={options.value}
        onChange={(e) => options.editorCallback(e.target.value)}
      />
    );
  };
  
  const numberEditor = (options) => {
    return (
      <input
        type="number"
        value={options.value}
        onChange={(e) => options.editorCallback(parseFloat(e.target.value))}
      />
    );
  };

  const handleAddRow = () => {
    setEditingRows({});
    setItems([
      ...items,
      {
        id: uuid(),
        item_name: "",
        price: 0,
        assignee: ""
      }
    ]);
  };

  const handleDeleteRow = (id) => {
    setEditingRows(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setItems(prev => prev.filter(item => item.id !== id));
  };
  
  
  

  const onSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("receipt", fileInput.current.files[0]);

    try {
      const response = await fetch('/upload', {
        method: "POST",
        body: formData
      });
      const parsedResponse = await response.json();
      const parsed = parsedResponse.items.map((item) => {
        const row = {
          ...item,
          id: uuid(),
          assignee: "",
        };
        return row;
      });
      setItems(parsed);
      setSubtotal(parsedResponse.total);
      setMatches(parsedResponse.matches);

      if (response.ok){
        alert("File uploaded");
      }
      else{
        console.error("Some error occurred. Try again")
      }
    } catch (e){
      console.error(e.message)
    }

  }
  return (
    <div className="App">
    <form onSubmit={onSubmit}>
        <input type="file" name="receipt" ref={fileInput} />
        <input type="submit" value="Submit" /> 
    </form>
    <DataTable
  value={items}
  editMode="row"
  dataKey="id" // use a stable key
  editingRows={editingRows}
  onRowEditChange={(e) => setEditingRows(e.data)}
  onRowEditComplete={onRowEditComplete}
>
  <Column field="item_name" header="Item" editor={textEditor} />
  <Column field="price" header="Price" editor={numberEditor} />
  <Column field="assignee" header="People" editor={textEditor} />
  <Column
  header="Edit"
  body={(rowData) => {
    const isEditing = !!editingRows[rowData.id];

    if (isEditing) {
      return (
        <>
          <button
            onClick={() => {
              const updatedItem = items.find((item) => item.id === rowData.id);
              onRowEditComplete({ newData: updatedItem });
              setEditingRows({});
            }}
          >
            ✅
          </button>
          <button
            onClick={() => {
              setEditingRows({});
            }}
          >
            ❌
          </button>
        </>
      );
    }

    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          setEditingRows({ [rowData.id]: true });
        }}
      >
        ✏️
      </button>
    );
  }}
  style={{ width: '10rem' }}
/>


  <Column
  header="Delete"
  body={(rowData, options) => (
    <button onClick={() => handleDeleteRow(rowData.id)}>🗑️</button>
  )}
  style={{ width: '5rem' }}
/>

  </DataTable>

  <button onClick={handleAddRow} disabled={Object.keys(editingRows).length > 0}>
  Add Item
</button>


    </div>
  );
}

export default App;
