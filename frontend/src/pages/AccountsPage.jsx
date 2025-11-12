import React, { useMemo, useState } from 'react';
import { pessoasApi, classificacaoApi, movimentoApi } from '../services/apiClient';

function InstallmentEditor({ installments, setInstallments }) {
  const [identifier, setIdentifier] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');

  function addInstallment(e) {
    e.preventDefault();
    if (!identifier || !dueDate || !amount) {
      alert('Preencha identificação, vencimento e valor.');
      return;
    }
    setInstallments([
      ...installments,
      { identifier, dueDate, amount: Number(amount) },
    ]);
    setIdentifier('');
    setDueDate('');
    setAmount('');
  }

  function removeInstallment(idx) {
    setInstallments(installments.filter((_, i) => i !== idx));
  }

  return (
    <div className="card">
      <h4>Parcelas</h4>
      <form onSubmit={addInstallment} className="form-grid">
        <input placeholder="Identificação" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <input type="date" placeholder="Vencimento" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <input type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit">Adicionar Parcela</button>
      </form>
      {installments.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Identificação</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {installments.map((p, idx) => (
              <tr key={`${p.identifier}-${idx}`}>
                <td>{p.identifier}</td>
                <td>{p.dueDate}</td>
                <td>{p.amount.toFixed(2)}</td>
                <td>
                  <button onClick={() => removeInstallment(idx)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AccountsPage({ mode, title }) {
  const isApagar = mode === 'APAGAR';
  const people = useMemo(() => pessoasApi.list(isApagar ? 'FORNECEDOR' : 'CLIENTE').filter(p => p.active), [isApagar]);
  const billedPeople = useMemo(() => pessoasApi.list('FATURADO').filter(p => p.active), []);
  const classifications = useMemo(() => classificacaoApi.list(isApagar ? 'DESPESA' : 'RECEITA').filter(c => c.active), [isApagar]);

  const [personId, setPersonId] = useState('');
  const [billedId, setBilledId] = useState('');
  const [description, setDescription] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [classIds, setClassIds] = useState([]);
  const [installments, setInstallments] = useState([]);

  function toggleClassification(id) {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!personId || !description || !totalValue || installments.length === 0) {
      alert('Preencha pessoa, descrição, valor total e ao menos uma parcela.');
      return;
    }
    movimentoApi.create({
      type: isApagar ? 'APAGAR' : 'ARECEBER',
      personId: Number(personId),
      personType: isApagar ? 'FORNECEDOR' : 'CLIENTE',
      billedId: billedId ? Number(billedId) : null,
      classificationIds: classIds,
      description,
      totalValue: Number(totalValue),
      installments,
    });
    alert('Registro lançado com sucesso.');
    setPersonId('');
    setBilledId('');
    setDescription('');
    setTotalValue('');
    setClassIds([]);
    setInstallments([]);
  }

  return (
    <div className="page">
      <h2>{title}</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          {isApagar ? 'Fornecedor' : 'Cliente'}
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Selecione...</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{`${p.id} - ${p.name}`}</option>
            ))}
          </select>
        </label>

        <label>
          Faturado (opcional)
          <select value={billedId} onChange={(e) => setBilledId(e.target.value)}>
            <option value="">Selecione...</option>
            {billedPeople.map((p) => (
              <option key={p.id} value={p.id}>{`${p.id} - ${p.name}`}</option>
            ))}
          </select>
        </label>

        <label>
          Descrição do Movimento
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label>
          Valor Total
          <input type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
        </label>

        <div className="card">
          <h4>Classificações ({isApagar ? 'DESPESA' : 'RECEITA'})</h4>
          <div className="chips">
            {classifications.map((c) => (
              <label key={c.id} className={`chip ${classIds.includes(c.id) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={classIds.includes(c.id)}
                  onChange={() => toggleClassification(c.id)}
                />
                {`${c.id} - ${c.description}`}
              </label>
            ))}
          </div>
        </div>

        <InstallmentEditor installments={installments} setInstallments={setInstallments} />

        <div>
          <button type="submit">Registrar</button>
        </div>
      </form>
    </div>
  );
}


