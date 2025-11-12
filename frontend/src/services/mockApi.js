import { readFromStorage, writeToStorage, nextId } from './storage';

const KEYS = {
  pessoas: 'adm_pessoas',
  classificacoes: 'adm_classificacoes',
  movimentos: 'adm_movimentos',
  parcelas: 'adm_parcelas',
};

function initCollections() {
  const empty = [];
  if (!readFromStorage(KEYS.pessoas, null)) writeToStorage(KEYS.pessoas, empty);
  if (!readFromStorage(KEYS.classificacoes, null)) writeToStorage(KEYS.classificacoes, empty);
  if (!readFromStorage(KEYS.movimentos, null)) writeToStorage(KEYS.movimentos, empty);
  if (!readFromStorage(KEYS.parcelas, null)) writeToStorage(KEYS.parcelas, empty);
}

initCollections();

// People: types => 'CLIENTE' | 'FORNECEDOR' | 'FATURADO'
export const pessoasApi = {
  list: (type) => {
    const all = readFromStorage(KEYS.pessoas, []);
    return type ? all.filter((p) => p.type === type) : all;
  },
  create: ({ type, name, document, active = true }) => {
    const all = readFromStorage(KEYS.pessoas, []);
    const id = nextId('seq_pessoas');
    const novo = { id, type, name, document: document || null, active };
    all.push(novo);
    writeToStorage(KEYS.pessoas, all);
    return novo;
  },
  update: (id, data) => {
    const all = readFromStorage(KEYS.pessoas, []);
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Person not found');
    all[idx] = { ...all[idx], ...data };
    writeToStorage(KEYS.pessoas, all);
    return all[idx];
  },
  setAtivo: (id, active) => {
    return pessoasApi.update(id, { active });
  },
  findByDocOrName: ({ type, document, name }) => {
    const all = pessoasApi.list(type);
    const found = all.find((p) => {
      const byDoc = document && p.document && p.document === document;
      const byName = name && p.name.toLowerCase() === name.toLowerCase();
      return byDoc || byName;
    });
    return found || null;
  },
};

// Classificacao: tipos => 'DESPESA' | 'RECEITA'
export const classificacaoApi = {
  list: (type) => {
    const all = readFromStorage(KEYS.classificacoes, []);
    return type ? all.filter((c) => c.type === type) : all;
  },
  create: ({ type, description, active = true }) => {
    const all = readFromStorage(KEYS.classificacoes, []);
    const id = nextId('seq_classificacoes');
    const novo = { id, type, description, active };
    all.push(novo);
    writeToStorage(KEYS.classificacoes, all);
    return novo;
  },
  update: (id, data) => {
    const all = readFromStorage(KEYS.classificacoes, []);
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Classification not found');
    all[idx] = { ...all[idx], ...data };
    writeToStorage(KEYS.classificacoes, all);
    return all[idx];
  },
  setAtivo: (id, active) => classificacaoApi.update(id, { active }),
  findByDescricao: ({ type, descricao }) => {
    const all = classificacaoApi.list(type);
    const found = all.find((c) => c.description.toLowerCase() === descricao.toLowerCase());
    return found || null;
  },
};

// Movimentos e Parcelas
export const movimentoApi = {
  create: ({ type, personId, personType, billedId = null, classificationIds = [], description, totalValue, installments = [] }) => {
    const movimentos = readFromStorage(KEYS.movimentos, []);
    const parcelasAll = readFromStorage(KEYS.parcelas, []);

    const movementId = nextId('seq_movimentos');
    const novoMov = {
      id: movementId,
      type, // 'APAGAR' | 'ARECEBER'
      personId, // supplierId (apagar) or clientId (areceber)
      personType,
      billedId,
      classificationIds,
      description,
      totalValue,
      createdAt: new Date().toISOString(),
    };
    movimentos.push(novoMov);

    installments.forEach((inst) => {
      const installmentId = nextId('seq_parcelas');
      parcelasAll.push({
        id: installmentId,
        movementId,
        identifier: inst.identifier,
        dueDate: inst.dueDate,
        amount: inst.amount,
      });
    });

    writeToStorage(KEYS.movimentos, movimentos);
    writeToStorage(KEYS.parcelas, parcelasAll);
    return novoMov;
  },
  listByTipo: (type) => {
    const movimentos = readFromStorage(KEYS.movimentos, []);
    return movimentos.filter((m) => m.type === type);
  },
  getParcelas: (movementId) => {
    const parcelasAll = readFromStorage(KEYS.parcelas, []);
    return parcelasAll.filter((p) => p.movementId === movementId);
  },
};


