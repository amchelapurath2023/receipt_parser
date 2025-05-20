import { createRef } from 'react';
import './App.css';

function App() {
  const fileInput = createRef();

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
    </div>
  );
}

export default App;
