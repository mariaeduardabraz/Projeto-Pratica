import React, { useState } from 'react';
import { ragApi } from '../services/apiClient';

export default function RagPage() {
  const [mode, setMode] = useState('simple');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const examples = [
    'Quantos fornecedores estão cadastrados?',
    'Liste as classificações de despesa ativas.',
    'Qual o total de valor das parcelas em aberto?',
    'Quais descrições de despesa existem?',
  ];

  function isTransientErrorMessage(msg) {
    const m = (msg || '').toLowerCase();
    return (
      m.includes('unavailable') ||
      m.includes('overload') ||
      m.includes('try again later') ||
      m.includes('tente novamente') ||
      m.includes('503') ||
      m.includes('tempo esgotado') ||
      m.includes('timeout')
    );
  }

  async function handleAsk(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const ask = async () => mode === 'embed'
        ? await ragApi.askEmbed(question.trim())
        : await ragApi.askSimple(question.trim());
      let data = null;
      try {
        data = await ask();
      } catch (err) {
        if (isTransientErrorMessage(err?.message)) {
          try {
            data = await ask();
          } catch (err2) {
            if (isTransientErrorMessage(err2?.message)) {
              setShowRetryModal(true);
              throw err2;
            }
            throw err2;
          }
        } else {
          throw err;
        }
      }
      setResult(data);
    } catch (e) {
      if (!isTransientErrorMessage(e?.message)) {
        setError('Não foi possível responder agora. Tente novamente em instantes.');
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h2>Consulta com RAG</h2>
      <div className="card" style={{ maxWidth: 1000, width: '100%' }}>
        <form onSubmit={handleAsk} className="form-grid" style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            placeholder="Digite sua pergunta sobre o banco de dados..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="simple">RAG Simples</option>
              <option value="embed">RAG Embeddings</option>
            </select>
            <button type="submit" disabled={loading}>{loading ? 'Consultando...' : 'Consultar'}</button>
          </div>
        </form>
        {error && <div style={{ color: '#dc2626', marginTop: 8 }}>{error}</div>}
      </div>

      {result && (
        <div className="card" style={{ maxWidth: 1000, width: '100%' }}>
          {'answer' in result && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Resposta</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</div>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ maxWidth: 1000, width: '100%' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Exemplos de perguntas</div>
        <div className="chips">
          {examples.map((ex) => (
            <button key={ex} className="chip" onClick={() => setQuestion(ex)}>{ex}</button>
          ))}
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
          Observação: o RAG responde apenas perguntas sobre os dados do sistema (Pessoas, Classificações, Movimentos, Parcelas). Perguntas fora desse escopo serão recusadas.
        </div>
      </div>

      {showRetryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
          onClick={() => setShowRetryModal(false)}
        >
          <div
            style={{
              width: 'min(480px, 95vw)',
              background: '#141414',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tente novamente</div>
            <div style={{ color: '#9ca3af', marginBottom: 12 }}>
              O provedor de IA está temporariamente indisponível. Aguarde alguns segundos e tente de novo.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowRetryModal(false)}>Fechar</button>
              <button onClick={() => { setShowRetryModal(false); handleAsk(); }}>Tentar novamente agora</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


