const express = require('express');
const router = express.Router();

const {
  listPeople,
  findPerson,
  createPerson,
  setPersonStatus,
  listClassification,
  findClassification,
  createClassification,
  setClassificationStatus,
  createMovement,
} = require('./repositories');
const { askSimple, askEmbed } = require('./rag');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');

// People (read-only for UI)
router.get('/people', async (req, res) => {
  const { type } = req.query;
  const data = await listPeople(type);
  res.json(data);
});

// People - create
router.post('/people', async (req, res) => {
  try {
    const { tipo, type, razaosocial, name, documento, document, status } = req.body || {};
    const tipoFinal = (tipo || type || '').toUpperCase();
    const razaoFinal = razaosocial || name;
    if (!['CLIENTE','FORNECEDOR','FATURADO'].includes(tipoFinal)) {
      return res.status(400).json({ error: 'tipo inválido. Use CLIENTE, FORNECEDOR ou FATURADO.' });
    }
    if (!razaoFinal) return res.status(400).json({ error: 'razaosocial (name) é obrigatório.' });
    const statusFinal = status ? status.toUpperCase() : 'ATIVO';
    if (!['ATIVO','INATIVO'].includes(statusFinal)) {
      return res.status(400).json({ error: 'status inválido. Use ATIVO ou INATIVO.' });
    }
    const created = await createPerson({ tipo: tipoFinal, razaosocial: razaoFinal, documento: document || documento || null, status: statusFinal });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar pessoa', details: err.message });
  }
});

// People - set status
router.patch('/people/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const statusFinal = (status || '').toUpperCase();
    if (!['ATIVO','INATIVO'].includes(statusFinal)) {
      return res.status(400).json({ error: 'status inválido. Use ATIVO ou INATIVO.' });
    }
    const updated = await setPersonStatus(id, statusFinal);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao atualizar status', details: err.message });
  }
});

router.get('/people/find', async (req, res) => {
  const { type, document, name } = req.query;
  const data = await findPerson({ type, documento: document, razaosocial: name });
  res.json(data);
});

// Classification (read-only for UI)
router.get('/classification', async (req, res) => {
  const { type } = req.query;
  const data = await listClassification(type);
  res.json(data);
});

// Classification - create
router.post('/classification', async (req, res) => {
  try {
    const { type, tipo, descricao, description, status } = req.body || {};
    const tipoFinal = (type || tipo || '').toUpperCase();
    if (!['DESPESA','RECEITA'].includes(tipoFinal)) {
      return res.status(400).json({ error: 'tipo inválido. Use DESPESA ou RECEITA.' });
    }
    const descFinal = descricao || description;
    if (!descFinal) return res.status(400).json({ error: 'descricao (description) é obrigatória.' });
    const statusFinal = status ? status.toUpperCase() : 'ATIVO';
    if (!['ATIVO','INATIVO'].includes(statusFinal)) {
      return res.status(400).json({ error: 'status inválido. Use ATIVO ou INATIVO.' });
    }
    const created = await createClassification({ type: tipoFinal, descricao: descFinal, status: statusFinal });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar classificação', details: err.message });
  }
});

// Classification - set status
router.patch('/classification/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const statusFinal = (status || '').toUpperCase();
    if (!['ATIVO','INATIVO'].includes(statusFinal)) {
      return res.status(400).json({ error: 'status inválido. Use ATIVO ou INATIVO.' });
    }
    const updated = await setClassificationStatus(id, statusFinal);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao atualizar status', details: err.message });
  }
});

router.get('/classification/find', async (req, res) => {
  const { type, description } = req.query;
  const data = await findClassification({ type, descricao: description });
  res.json(data);
});

// Analysis (Etapa 2)
router.post('/analysis/check', async (req, res) => {
  const { supplierName, supplierDoc, billedName, billedDoc, expenseDescription } = req.body || {};
  const fornecedor = await findPerson({ type: 'FORNECEDOR', documento: supplierDoc || null, razaosocial: supplierName || null });
  const faturado = await findPerson({ type: 'FATURADO', documento: billedDoc || null, razaosocial: billedName || null });
  const despesa = await findClassification({ type: 'DESPESA', descricao: expenseDescription || '' });
  res.json({ fornecedor, faturado, despesa });
});

router.post('/analysis/launch', async (req, res) => {
  const {
    supplierName,
    supplierDoc,
    billedName,
    billedDoc,
    expenseDescription,
    totalValue,
    installments = [],
    numeroNotaFiscal = null,
    dataEmissao = null,
    description = 'Lançado via análise automática',
    movementType = 'APAGAR',
  } = req.body || {};

  // find or create
  let fornecedor = await findPerson({ type: 'FORNECEDOR', documento: supplierDoc || null, razaosocial: supplierName || null });
  if (!fornecedor && (supplierName || supplierDoc)) {
    fornecedor = await createPerson({ tipo: 'FORNECEDOR', razaosocial: supplierName || 'Fornecedor', documento: supplierDoc || null });
  }
  let faturado = await findPerson({ type: 'FATURADO', documento: billedDoc || null, razaosocial: billedName || null });
  if (!faturado && (billedName || billedDoc)) {
    faturado = await createPerson({ tipo: 'FATURADO', razaosocial: billedName || 'Faturado', documento: billedDoc || null });
  }
  let despesa = await findClassification({ type: 'DESPESA', descricao: expenseDescription || '' });
  if (!despesa && expenseDescription) {
    despesa = await createClassification({ type: 'DESPESA', descricao: expenseDescription });
  }

  if (!fornecedor || !despesa) {
    return res.status(400).json({ error: 'Fornecedor e Classificação de Despesa são obrigatórios para lançar.' });
  }

  try {
    const mov = await createMovement({
      tipo: movementType,
      numeronotafiscal: numeroNotaFiscal,
      dataemissao: dataEmissao,
      descricao: description,
      valortotal: Number(totalValue || 0),
      fornecedorClienteId: fornecedor.idpessoas,
      faturadoId: faturado ? faturado.idpessoas : null,
      classificacaoIds: [despesa.idclassificacao],
      parcelas: installments,
    });
    res.json({ ok: true, movementId: mov.idmovimentocontas });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ error: 'Identificação de parcela duplicada.' });
    }
    res.status(500).json({ error: 'Falha ao lançar movimento', details: err.message });
  }
});

// Movements (register directly)
router.post('/movements', async (req, res) => {
  try {
    const { tipo, fornecedorClienteId, faturadoId=null, classificacaoIds=[], descricao=null, valortotal=0, numeroNotaFiscal=null, dataEmissao=null, parcelas=[] } = req.body || {};
    if (!tipo || !fornecedorClienteId) return res.status(400).json({ error: 'tipo e fornecedorClienteId são obrigatórios' });
    const mov = await createMovement({
      tipo,
      numeronotafiscal: numeroNotaFiscal,
      dataemissao: dataEmissao,
      descricao,
      valortotal: Number(valortotal || 0),
      fornecedorClienteId,
      faturadoId,
      classificacaoIds,
      parcelas,
    });
    res.json(mov);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ error: 'Identificação de parcela duplicada.' });
    }
    res.status(500).json({ error: 'Falha ao criar movimento', details: err.message });
  }
});

module.exports = router;


// RAG endpoints
router.post('/rag/ask-simple', async (req, res) => {
  try {
    const { question } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || null;
    if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY não configurada' });
    const genAICompat = new GoogleGenAI({ apiKey });
    const result = await askSimple({ googleGenAI: genAICompat, question });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Falha no RAG simples', details: err.message });
  }
});

router.post('/rag/ask-embed', async (req, res) => {
  try {
    const { question } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || null;
    if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY não configurada' });
    const genAICompat = new GoogleGenAI({ apiKey });
    const genAIOfficial = new GoogleGenerativeAI(apiKey);
    const result = await askEmbed({ googleEmbedding: genAIOfficial, googleGenAI: genAICompat, question });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Falha no RAG embeddings', details: err.message });
  }
});
