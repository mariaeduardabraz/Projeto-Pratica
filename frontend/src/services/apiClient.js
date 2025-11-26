// Client de API preparado para alternar entre Mock e HTTP real
import { pessoasApi as pessoasMock, classificacaoApi as classificacaoMock, movimentoApi as movimentoMock } from './mockApi';

const baseURL = import.meta?.env?.VITE_API_URL || 'https://projeto-pratica.onrender.com/api' || 'https://projeto-pratica-delta.vercel.app/' ;

// Alternar entre mock e HTTP real.
// Sem .env, usamos REAL por padrão (mock desativado).
const useMock = (import.meta?.env?.VITE_USE_MOCK ?? 'false') !== 'false';

function notImplemented() {
  throw new Error('HTTP client ainda não implementado.');
}

// Helper HTTP
async function http(path, { method = 'GET', body, headers, timeoutMs } = {}) {
  const controller = new AbortController();
  const ms = typeof timeoutMs === 'number' ? timeoutMs : 45000;
  const timer = setTimeout(() => controller.abort(), ms);

  const res = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  });
  clearTimeout(timer);

  // Parse resiliente do corpo (pode ser vazio, texto simples ou JSON)
  let text = '';
  try {
    text = await res.text();
  } catch {
    text = '';
  }

  let data = null;
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text; // mantém texto cru se não for JSON
    }
  }

  if (!res.ok) {
    const composed =
      (data && typeof data === 'object'
        ? [data.error, data.details].filter(Boolean).join(' – ')
        : (typeof data === 'string' ? data : null)) || `HTTP ${res.status}`;
    throw new Error(composed);
  }

  return data;
}

// Normalizadores
const normalizePessoa = (row) =>
  row && {
    id: row.idpessoas,
    name: row.razaosocial,
    document: row.documento,
    active: (row.status || 'ATIVO') === 'ATIVO',
  };

const normalizeClassificacao = (row) =>
  row && {
    id: row.idclassificacao,
    description: row.descricao,
    active: (row.status || 'ATIVO') === 'ATIVO',
    type: row.tipo,
  };

export const pessoasApi = useMock
  ? pessoasMock
  : {
      list: async (type) => {
        const data = await http(`/people${type ? `?type=${encodeURIComponent(type)}` : ''}`);
        return data.map(normalizePessoa);
      },
      create: async ({ type, name, document, active = true }) => {
        const created = await http('/people', {
          method: 'POST',
          body: { type, name, document, status: active ? 'ATIVO' : 'INATIVO' },
        });
        return normalizePessoa(created);
      },
      update: notImplemented,
      setAtivo: async (id, active) => {
        const updated = await http(`/people/${id}/status`, {
          method: 'PATCH',
          body: { status: active ? 'ATIVO' : 'INATIVO' },
        });
        return normalizePessoa(updated);
      },
      findByDocOrName: async ({ type, document, name }) => {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (document) params.set('document', document);
        if (name) params.set('name', name);
        const data = await http(`/people/find?${params.toString()}`);
        return normalizePessoa(data);
      },
    };

export const classificacaoApi = useMock
  ? classificacaoMock
  : {
      list: async (type) => {
        const data = await http(`/classification${type ? `?type=${encodeURIComponent(type)}` : ''}`);
        return data.map(normalizeClassificacao);
      },
      create: async ({ type, description, active = true }) => {
        const created = await http('/classification', {
          method: 'POST',
          body: { type, description, status: active ? 'ATIVO' : 'INATIVO' },
        });
        return normalizeClassificacao(created);
      },
      update: notImplemented,
      setAtivo: async (id, active) => {
        const updated = await http(`/classification/${id}/status`, {
          method: 'PATCH',
          body: { status: active ? 'ATIVO' : 'INATIVO' },
        });
        return normalizeClassificacao(updated);
      },
      findByDescricao: async ({ type, descricao }) => {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (descricao) params.set('description', descricao);
        const data = await http(`/classification/find?${params.toString()}`);
        return normalizeClassificacao(data);
      },
    };

export const movimentoApi = useMock
  ? movimentoMock
  : {
      create: async ({ type, personId, billedId = null, classificationIds = [], description, totalValue, installments = [], numeroNotaFiscal = null, dataEmissao = null }) => {
        await http('/movements', {
          method: 'POST',
          body: {
            tipo: type,
            fornecedorClienteId: personId,
            faturadoId: billedId,
            classificacaoIds: classificationIds,
            descricao: description,
            valortotal: totalValue,
            numeroNotaFiscal,
            dataEmissao,
            parcelas: installments,
          },
        });
        return true;
      },
      listByTipo: notImplemented,
      getParcelas: notImplemented,
    };

export const analysisApi = useMock
  ? {
      check: async ({ supplierName, supplierDoc, billedName, billedDoc, expenseDescription }) => {
        const forn = await pessoasMock.findByDocOrName({ type: 'FORNECEDOR', document: supplierDoc || null, name: supplierName || null });
        const fat = await pessoasMock.findByDocOrName({ type: 'FATURADO', document: billedDoc || null, name: billedName || null });
        const desp = await classificacaoMock.findByDescricao({ type: 'DESPESA', descricao: expenseDescription || '' });
        return { fornecedor: forn, faturado: fat, despesa: desp };
      },
      launch: async ({ supplierName, supplierDoc, billedName, billedDoc, expenseDescription, totalValue, installments = [], numeroNotaFiscal = null, dataEmissao = null, description = 'Lançado via análise automática', movementType = 'APAGAR' }) => {
        // Emula criação via mock
        let fornecedor = await pessoasMock.findByDocOrName({ type: 'FORNECEDOR', document: supplierDoc || null, name: supplierName || null });
        if (!fornecedor && (supplierName || supplierDoc)) {
          fornecedor = await pessoasMock.create({ type: 'FORNECEDOR', name: supplierName || 'Fornecedor', document: supplierDoc || null, active: true });
        }
        let faturado = await pessoasMock.findByDocOrName({ type: 'FATURADO', document: billedDoc || null, name: billedName || null });
        if (!faturado && (billedName || billedDoc)) {
          faturado = await pessoasMock.create({ type: 'FATURADO', name: billedName || 'Faturado', document: billedDoc || null, active: true });
        }
        let despesa = await classificacaoMock.findByDescricao({ type: 'DESPESA', descricao: expenseDescription || '' });
        if (!despesa && expenseDescription) {
          despesa = await classificacaoMock.create({ type: 'DESPESA', description: expenseDescription, active: true });
        }
        if (!fornecedor || !despesa) throw new Error('Fornecedor e Classificação de Despesa são obrigatórios para lançar.');
        await movimentoMock.create({
          type: movementType,
          personId: fornecedor.id,
          billedId: faturado?.id || null,
          classificationIds: [despesa.id],
          description,
          totalValue: Number(totalValue) || 0,
          installments,
        });
        return { ok: true };
      },
    }
  : {
      check: async ({ supplierName, supplierDoc, billedName, billedDoc, expenseDescription }) => {
        const data = await http('/analysis/check', {
          method: 'POST',
          body: { supplierName, supplierDoc, billedName, billedDoc, expenseDescription },
        });
        const fornecedor = normalizePessoa(data.fornecedor);
        const faturado = normalizePessoa(data.faturado);
        const despesa = normalizeClassificacao(data.despesa);
        return { fornecedor, faturado, despesa };
      },
      launch: async ({ supplierName, supplierDoc, billedName, billedDoc, expenseDescription, totalValue, installments = [], numeroNotaFiscal = null, dataEmissao = null, description = 'Lançado via análise automática', movementType = 'APAGAR' }) => {
        await http('/analysis/launch', {
          method: 'POST',
          body: { supplierName, supplierDoc, billedName, billedDoc, expenseDescription, totalValue, installments, numeroNotaFiscal, dataEmissao, description, movementType },
        });
        return { ok: true };
      },
    };

export const apiConfig = { baseURL, useMock };

// RAG API
export const ragApi = {
  askSimple: async (question) => {
    return await http('/rag/ask-simple', {
      method: 'POST',
      body: { question },
      timeoutMs: 90000,
    });
  },
  askEmbed: async (question) => {
    return await http('/rag/ask-embed', {
      method: 'POST',
      body: { question },
      timeoutMs: 90000,
    });
  },
};


