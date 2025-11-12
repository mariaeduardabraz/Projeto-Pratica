import React, { useEffect, useMemo, useState } from 'react';
import { pessoasApi, classificacaoApi, movimentoApi } from '../services/apiClient';

export default function AnalysisPage({ initialData }) {
  const [supplierName, setSupplierName] = useState(initialData?.supplierName || '');
  const [supplierDoc, setSupplierDoc] = useState(initialData?.supplierDoc || '');
  const [billedName, setBilledName] = useState(initialData?.billedName || '');
  const [billedDoc, setBilledDoc] = useState(initialData?.billedDoc || '');
  const [expenseDescription, setExpenseDescription] = useState(initialData?.expenseDescription || '');
  const [totalValue, setTotalValue] = useState(initialData?.totalValue || 0);
  const [installments, setInstallments] = useState(initialData?.installments || []);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Auto-consulta quando houver dados iniciais
    if (supplierName || supplierDoc || billedName || billedDoc || expenseDescription) {
      handleConsult();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConsult() {
    const forn = pessoasApi.findByDocOrName({ type: 'FORNECEDOR', document: supplierDoc || null, name: supplierName || null });
    const fat = pessoasApi.findByDocOrName({ type: 'FATURADO', document: billedDoc || null, name: billedName || null });
    const desp = classificacaoApi.findByDescricao({ type: 'DESPESA', descricao: expenseDescription || '' });
    setResult({ fornecedor: forn, faturado: fat, despesa: desp });
  }

  function createMissingAndLaunch() {
    let fornecedor = result?.fornecedor;
    let faturado = result?.faturado;
    let despesa = result?.despesa;

    if (!fornecedor) {
      fornecedor = pessoasApi.create({ type: 'FORNECEDOR', name: supplierName, document: supplierDoc || null, active: true });
    }
    if (!faturado) {
      faturado = pessoasApi.create({ type: 'FATURADO', name: billedName, document: billedDoc || null, active: true });
    }
    if (!despesa) {
      despesa = classificacaoApi.create({ type: 'DESPESA', description: expenseDescription, active: true });
    }

    const safeInstallments = (installments && installments.length > 0) ? installments : [
      { identifier: 'P1', dueDate: new Date().toISOString().substring(0, 10), amount: Number(totalValue) || 0 },
    ];

    movimentoApi.create({
      type: 'APAGAR',
      personId: fornecedor.id,
      personType: 'FORNECEDOR',
      billedId: faturado?.id || null,
      classificationIds: [despesa.id],
      description: 'Lançado via análise automática',
      totalValue: Number(totalValue) || 0,
      installments: safeInstallments,
    });
    alert('Registro lançado com sucesso.');
    setResult({ fornecedor, faturado, despesa });
  }

  function renderStatus(item, title) {
    if (!item) {
      return (
        <div className="card warning">
          <strong>{title}</strong>
          <div>Não existe</div>
        </div>
      );
    }
    return (
      <div className="card success">
        <strong>{title}</strong>
        <div>EXISTE – ID: {item.id}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Etapa 2 – Análise e Lançamento</h2>
      <div className="grid-2">
        <div className="card">
          <h4>Fornecedor</h4>
          <input placeholder="Razão Social" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <input placeholder="CNPJ" value={supplierDoc} onChange={(e) => setSupplierDoc(e.target.value)} />
        </div>
        <div className="card">
          <h4>Faturado</h4>
          <input placeholder="Nome" value={billedName} onChange={(e) => setBilledName(e.target.value)} />
          <input placeholder="CPF" value={billedDoc} onChange={(e) => setBilledDoc(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h4>Despesa</h4>
        <input placeholder="Descrição da Despesa" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />
      </div>

      <div className="actions">
        <button onClick={handleConsult}>Consultar no Banco (Mock)</button>
      </div>

      {result && (
        <div className="grid-3">
          <div>
            <strong>FORNECEDOR:</strong>
            <div>{supplierName || '-'}</div>
            <div>CNPJ: {supplierDoc || '-'}</div>
            {renderStatus(result.fornecedor, 'Fornecedor')}
          </div>
          <div>
            <strong>FATURADO:</strong>
            <div>{billedName || '-'}</div>
            <div>CPF: {billedDoc || '-'}</div>
            {renderStatus(result.faturado, 'Faturado')}
          </div>
          <div>
            <strong>DESPESA:</strong>
            <div>{expenseDescription || '-'}</div>
            {renderStatus(result.despesa, 'Classificação de Despesa')}
          </div>
        </div>
      )}

      {result && (
        <div className="actions">
          <button onClick={createMissingAndLaunch}>Criar e Lançar Movimento</button>
        </div>
      )}
    </div>
  );
}


