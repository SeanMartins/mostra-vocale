import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicView from './components/PublicView';
import AdminView from './components/AdminView';
import './App.css';

const MOSTRA_TITLE = process.env.REACT_APP_MOSTRA_TITLE || 'Mostra';
const MOSTRA_IMAGE = process.env.REACT_APP_MOSTRA_IMAGE || '/image.jpeg';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicView
              mostraTitle={MOSTRA_TITLE}
              mostraImage={MOSTRA_IMAGE}
            />
          }
        />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
