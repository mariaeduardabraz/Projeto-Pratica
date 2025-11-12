import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoasApi, classificacaoApi, movimentoApi, apiConfig } from '../services/apiClient';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [peopleStats, setPeopleStats] = useState({ fornecedores: 0, clientes: 0, faturados: 0 });
  const [classStats, setClassStats] = useState({ despesas: 0, receitas: 0 });
  const [movStats, setMovStats] = useState({ apagar: 0, areceber: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const p1 = Promise.resolve().then(() => pessoasApi.list('FORNECEDOR'));
    const p2 = Promise.resolve().then(() => pessoasApi.list('CLIENTE'));
    const p3 = Promise.resolve().then(() => pessoasApi.list('FATURADO'));
    const c1 = Promise.resolve().then(() => classificacaoApi.list('DESPESA'));
    const c2 = Promise.resolve().then(() => classificacaoApi.list('RECEITA'));
    const mApagar = apiConfig.useMock ? Promise.resolve().then(() => movimentoApi.listByTipo('APAGAR')) : Promise.resolve([]);
    const mReceber = apiConfig.useMock ? Promise.resolve().then(() => movimentoApi.listByTipo('ARECEBER')) : Promise.resolve([]);

    Promise.all([p1, p2, p3, c1, c2, mApagar, mReceber])
      .then(([forn, cli, fat, des, rec, ap, ar]) => {
        if (!active) return;
        setPeopleStats({
          fornecedores: (Array.isArray(forn) ? forn : []).length,
          clientes: (Array.isArray(cli) ? cli : []).length,
          faturados: (Array.isArray(fat) ? fat : []).length,
        });
        setClassStats({
          despesas: (Array.isArray(des) ? des : []).length,
          receitas: (Array.isArray(rec) ? rec : []).length,
        });
        setMovStats({
          apagar: Array.isArray(ap) ? ap.length : 0,
          areceber: Array.isArray(ar) ? ar.length : 0,
        });
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Falha ao carregar dados do dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const totalPessoas = peopleStats.fornecedores + peopleStats.clientes + peopleStats.faturados;
  const totalClass = classStats.despesas + classStats.receitas;
  const showMov = useMemo(() => apiConfig.useMock, []);

  function ProgressBar({ value, total, color='var(--button-color)' }) {
    const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    return (
      <div style={{ width: '100%', height: 6, background: '#1f1f1f', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    );
  }

  return (
    <div className="page" style={{ width: '100%' }}>
      <div className="card" style={{ textAlign: 'left', width: '100%' }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Dashboard</h2>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Visão geral do financeiro</div>
      </div>

      {loading && <div style={{ color: '#6b7280' }}>Carregando...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Cadastros</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{totalPessoas}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Pessoas</div>
              <ProgressBar value={peopleStats.fornecedores} total={totalPessoas} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                <span>Fornecedores</span><span>{peopleStats.fornecedores}</span>
              </div>
              <ProgressBar value={peopleStats.clientes} total={totalPessoas} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                <span>Clientes</span><span>{peopleStats.clientes}</span>
              </div>
              <ProgressBar value={peopleStats.faturados} total={totalPessoas} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                <span>Faturados</span><span>{peopleStats.faturados}</span>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{totalClass}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Classificações</div>
              <ProgressBar value={classStats.despesas} total={totalClass} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                <span>Despesas</span><span>{classStats.despesas}</span>
              </div>
              <ProgressBar value={classStats.receitas} total={totalClass} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                <span>Receitas</span><span>{classStats.receitas}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Ações rápidas</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 8,
              width: '100%',
            }}
          >
            <button style={{ width: '100%' }} onClick={() => navigate('/extrator')}>Abrir Extrator</button>
            <button style={{ width: '100%' }} onClick={() => navigate('/fornecedores')}>Fornecedores</button>
            <button style={{ width: '100%' }} onClick={() => navigate('/clientes')}>Clientes</button>
            <button style={{ width: '100%' }} onClick={() => navigate('/faturados')}>Faturados</button>
            <button style={{ width: '100%' }} onClick={() => navigate('/despesas')}>Despesas</button>
            <button style={{ width: '100%' }} onClick={() => navigate('/receitas')}>Receitas</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Comece por aqui</div>
            <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
              Utilize o extrator para capturar dados da nota e depois confira o resultado.
            </div>
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              <button onClick={() => navigate('/extrator')}>Extrair dados do PDF</button>
            </div>
          </div>
          <div style={{ background: '#0f0f10', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Dica</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              Mantenha seus cadastros de Fornecedores, Faturados e Classificações atualizados
              para que a análise identifique corretamente os itens.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


