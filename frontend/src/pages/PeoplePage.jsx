import React, { useEffect, useState } from 'react';
import { pessoasApi } from '../services/apiClient';

export default function PeoplePage({ type, title }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => pessoasApi.list(type))
      .then((data) => {
        if (active) setPeople(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (active) setError(e.message || 'Falha ao carregar pessoas');
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
      const snapshot = people;
      setPeople((curr) => (Array.isArray(curr) ? curr.map((p) => (p.id === id ? { ...p, active } : p)) : curr));
      await pessoasApi.setAtivo(id, active);
    } catch (e) {
      // rollback
      setPeople((_) => (Array.isArray(people) ? people : []));
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
            <th>Razão Social/Nome</th>
            <th>Documento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(people) && people.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.document || '-'}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ backgroundColor: p.active ? 'rgb(255, 42, 163)' : '#dc2626' }}
                    onClick={() => handleSetStatus(p.id, true)}
                    disabled={updatingId === p.id || p.active}
                  >
                    Ativo
                  </button>
                  <button
                    style={{ backgroundColor: !p.active ? 'rgb(255, 42, 163)' : '#dc2626' }}
                    onClick={() => handleSetStatus(p.id, false)}
                    disabled={updatingId === p.id || !p.active}
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


