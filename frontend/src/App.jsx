import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import ExtractionPage from './pages/ExtractionPage.jsx';
import PeoplePage from './pages/PeoplePage.jsx';
import ClassificationPage from './pages/ClassificationPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RagPage from './pages/RagPage.jsx';
import Sidebar from './components/Sidebar.jsx';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <BrowserRouter>
      <div className={`app-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/extrator" element={<ExtractionPage />} />
            <Route path="/fornecedores" element={<PeoplePage type="FORNECEDOR" title="Manter Fornecedor" />} />
            <Route path="/clientes" element={<PeoplePage type="CLIENTE" title="Manter Cliente" />} />
            <Route path="/faturados" element={<PeoplePage type="FATURADO" title="Manter Faturado" />} />
            <Route path="/despesas" element={<ClassificationPage type="DESPESA" title="Manter Tipo de Despesa" />} />
            <Route path="/receitas" element={<ClassificationPage type="RECEITA" title="Manter Tipo de Receita" />} />
            <Route path="/rag" element={<RagPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;