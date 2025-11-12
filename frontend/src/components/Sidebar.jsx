import { NavLink } from 'react-router-dom';
import { FiMenu, FiGrid, FiUpload, FiUsers, FiUser, FiFileText, FiTrendingDown, FiTrendingUp, FiSearch } from 'react-icons/fi';

export default function Sidebar({ collapsed = false, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="toggle-btn"
        onClick={onToggle}
        aria-label="Alternar menu"
        title="Alternar menu"
      >
        <FiMenu />
      </button>
      {!collapsed && <div className="brand">Financeiro</div>}
      <nav className="menu">
        <NavLink to="/" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Dashboard">
          <FiGrid style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Dashboard'}
        </NavLink>
        <NavLink to="/extrator" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Extrator">
          <FiUpload style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Extrator'}
        </NavLink>

        {!collapsed && <div className="menu-section">Cadastros</div>}
        <NavLink to="/fornecedores" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Fornecedores">
          <FiFileText style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Fornecedores'}
        </NavLink>
        <NavLink to="/clientes" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Clientes">
          <FiUsers style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Clientes'}
        </NavLink>
        <NavLink to="/faturados" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Faturados">
          <FiUser style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Faturados'}
        </NavLink>

        {!collapsed && <div className="menu-section">Classificações</div>}
        <NavLink to="/despesas" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Despesas">
          <FiTrendingDown style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Despesas'}
        </NavLink>
        <NavLink to="/receitas" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Receitas">
          <FiTrendingUp style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Receitas'}
        </NavLink>
        <NavLink to="/rag" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Consulta RAG">
          <FiSearch style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'Consulta RAG'}
        </NavLink>
      </nav>
    </aside>
  );
}

