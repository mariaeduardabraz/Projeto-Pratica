import React, { useEffect, useState } from 'react';
import { classificacaoApi } from '../services/apiClient';

export default function ClassificationPage({ type, title }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => classificacaoApi.list(type))
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (active) setError(e.message || 'Falha ao carregar classificações');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [type, refreshToken]);

  async function handleSetStatus(id, active) {
    try {
      setUpdatingId(id);
      // atualização otimista
      const snapshot = items;
      setItems((curr) => (Array.isArray(curr) ? curr.map((c) => (c.id === id ? { ...c, active } : c)) : curr));
      await classificacaoApi.setAtivo(id, active);
    } catch (e) {
      // rollback
      setItems((_) => (Array.isArray(items) ? items : []));
      alert('Falha ao atualizar status: ' + (e?.message || e));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page">
      <h2>{title}</h2>
      <div className="actions">
        <button onClick={() => setRefreshToken((v) => v + 1)}>Atualizar</button>
        <span style={{ color: '#6b7280', fontSize: 12 }}>Somente visualização. Cadastros são criados via extração.</span>
      </div>

      {loading && <div style={{ color: '#6b7280' }}>Carregando...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descrição</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.description}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ backgroundColor: c.active ? 'rgb(255, 42, 163)' : '#dc2626' }}
                    onClick={() => handleSetStatus(c.id, true)}
                    disabled={updatingId === c.id || c.active}
                  >
                    Ativo
                  </button>
                  <button
                    style={{ backgroundColor: !c.active ? 'rgb(255, 42, 163)' : '#dc2626' }}
                    onClick={() => handleSetStatus(c.id, false)}
                    disabled={updatingId === c.id || !c.active}
                  >
                    Inativo
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


