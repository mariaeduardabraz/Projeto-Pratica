const { pool, query } = require('./db');
let cachedSchemaText = null;
let embedIndex = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isOverloaded(err) {
  try {
    const msg = (err && (err.message || err.toString())) || '';
    const status = err && (err.status || err.code);
    const nested = err && (err.error || err.response || {});
    const nestedStatus = nested && (nested.status || nested.code);
    const any = status || nestedStatus;
    if (any === 503 || String(any) === '503') return true;
    if (/UNAVAILABLE|overload|temporarily|busy/i.test(msg)) return true;
    const j = JSON.stringify(err);
    if (/UNAVAILABLE|overload|503/i.test(j)) return true;
  } catch (_) {}
  return false;
}

async function withRetry(fn, { retries = 3, baseDelayMs = 600 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt > retries || !isOverloaded(e)) throw e;
      const wait = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await sleep(wait);
    }
  }
}

function isDomainQuestion(questionRaw) {
  const q = (questionRaw || '').toLowerCase();
  const keywords = [
    'pessoa','pessoas','fornecedor','fornecedores','cliente','clientes','faturado','faturados',
    'classificacao','classificações','classificacoes','despesa','despesas','receita','receitas',
    'movimento','movimentos','conta','contas','parcela','parcelas','nota','valor','saldo','status'
  ];
  return keywords.some(k => q.includes(k));
}

async function loadSchemaText() {
  if (cachedSchemaText) return cachedSchemaText;
  const tablesRes = await query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  const lines = [];
  for (const row of tablesRes.rows) {
    const t = row.table_name;
    lines.push(`Tabela ${t}:`);
    const cols = await query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public' and table_name=$1
      order by ordinal_position
    `, [t]);
    for (const c of cols.rows) {
      lines.push(` - ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' not null' : ''}`);
    }
  }
  cachedSchemaText = lines.join('\n');
  return cachedSchemaText;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function buildEmbedIndex(googleGenAI) {
  if (embedIndex) return embedIndex;
  const tablesRes = await query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  const texts = [];
  for (const row of tablesRes.rows) {
    const t = row.table_name;
    const cols = await query(`
      select column_name, data_type
      from information_schema.columns
      where table_schema='public' and table_name=$1
      order by ordinal_position
    `, [t]);
    for (const c of cols.rows) {
      texts.push(`${t}.${c.column_name} (${c.data_type})`);
    }
  }
  if (!googleGenAI) {
    // Fallback: trivial index with empty vectors
    embedIndex = texts.map((text) => ({ text, vector: [] }));
    return embedIndex;
  }
  const model = googleGenAI.getGenerativeModel({ model: 'text-embedding-004' });
  const chunks = [];
  for (let i = 0; i < texts.length; i += 100) {
    chunks.push(texts.slice(i, i + 100));
  }
  const vectors = [];
  for (const chunk of chunks) {
    const res = await withRetry(() =>
      model.batchEmbedContents({
        requests: chunk.map((t) => ({ content: { parts: [{ text: t }] } })),
      })
    );
    for (const r of res.embeddings) {
      vectors.push(r.values);
    }
  }
  embedIndex = texts.map((text, i) => ({ text, vector: vectors[i] || [] }));
  return embedIndex;
}

async function askSimple({ googleGenAI, question }) {
  if (!isDomainQuestion(question)) {
    return { answer: 'Pergunta fora do escopo do sistema. Faça perguntas sobre Pessoas, Classificações, Movimentos e Parcelas.', sql: null, rows: [], sqlError: null, refused: true };
  }
  const schema = await loadSchemaText();
  const model = googleGenAI.models.generateContent
    ? null
    : googleGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  // Prompt para gerar SQL de somente leitura
  const sqlPrompt = `
Gere um SELECT SQL para Postgres que responda à pergunta do usuário.
Restrições:
- NÃO faça INSERT/UPDATE/DELETE/CREATE/DROP; apenas SELECT.
- Use somente tabelas e colunas existentes no schema abaixo.
- Responda apenas perguntas sobre este domínio. Se a pergunta estiver fora do escopo do schema, responda exatamente: "Pergunta fora do escopo do sistema." e não gere SQL.
Retorne apenas o SQL puro, sem explicações.

Schema:
${schema}

Pergunta: ${question}
`;
  let sqlText = '';
  if (googleGenAI.models && googleGenAI.models.generateContent) {
    const res = await withRetry(() =>
      googleGenAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: sqlPrompt }] }],
      })
    );
    const text = typeof res.text === 'function' ? await res.text() : (res.text || '');
    sqlText = (text || '').trim();
  } else {
    const res = await withRetry(() =>
      model.generateContent({ contents: [{ role: 'user', parts: [{ text: sqlPrompt }] }] })
    );
    sqlText = (res.response.text() || '').trim();
  }
  // Sanitiza: remove crases e code fences
  sqlText = sqlText.replace(/```sql|```/g, '').trim();
  // Remove ponto e vírgula final que quebra subquery
  sqlText = sqlText.replace(/;+\s*$/g, '');
  if (/fora do escopo/i.test(sqlText)) {
    return { answer: 'Pergunta fora do escopo do sistema.', sql: null, rows: [], sqlError: null, refused: true };
  }

  let rows = [];
  let sqlError = null;
  try {
    const limited = `select * from (${sqlText}) as q limit 50`;
    const exec = await query(limited);
    rows = exec.rows || [];
  } catch (e) {
    sqlError = e.message || String(e);
  }

  const ansPrompt = `
Você é um assistente que responde em português com texto bem escrito e claro.
Regra: devolva APENAS a resposta final ao usuário, como um parágrafo curto (2 a 5 frases).
NÃO mostre código, SQL, mensagens de erro ou explicações técnicas.
Use linguagem natural e explique o resultado de forma compreensível.
Se não houver dados suficientes, responda: "Não encontrei registros.".

Pergunta do usuário: ${question}
Contexto (amostra de linhas, máx 50): ${JSON.stringify(rows).substring(0, 4000)}
`;
  let answer = '';
  if (googleGenAI.models && googleGenAI.models.generateContent) {
    const res = await withRetry(() =>
      googleGenAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: ansPrompt }] }],
      })
    );
    const text = typeof res.text === 'function' ? await res.text() : (res.text || '');
    answer = (text || '').trim();
  } else {
    const res = await withRetry(() =>
      model.generateContent({ contents: [{ role: 'user', parts: [{ text: ansPrompt }] }] })
    );
    answer = (res.response.text() || '').trim();
  }
  return { answer, sql: sqlText, rows, sqlError };
}

async function askEmbed({ googleEmbedding, googleGenAI, question, topK = 12 }) {
  if (!isDomainQuestion(question)) {
    return { answer: 'Pergunta fora do escopo do sistema. Foque em Pessoas, Classificações, Movimentos e Parcelas.', context: [], refused: true };
  }
  const schema = await loadSchemaText();
  const index = await buildEmbedIndex(googleEmbedding);
  let qVec = [];
  if (googleEmbedding) {
    const embedModel = googleEmbedding.getGenerativeModel({ model: 'text-embedding-004' });
    const res = await withRetry(() =>
      embedModel.embedContent({ content: { parts: [{ text: question }] } })
    );
    qVec = res.embedding.values;
  }
  let contexts = index.map((it) => ({ text: it.text, score: qVec.length ? cosineSimilarity(qVec, it.vector) : 0 }));
  contexts.sort((a, b) => b.score - a.score);
  const selected = contexts.slice(0, topK).map((c) => c.text);

  // 1) Gere SQL usando contexto + schema (read-only)
  const sqlPrompt = `
Gere um SELECT SQL para Postgres que responda à pergunta do usuário.
Use APENAS as colunas fornecidas no contexto e no schema.
Restrições:
- SOMENTE SELECT (sem INSERT/UPDATE/DELETE/CREATE/DROP).
- Se a pergunta estiver fora do escopo, responda exatamente: "Pergunta fora do escopo do sistema." e não gere SQL.
- Prefira retornos agregados quando a pergunta pedir quantidades (por ex., count(*)).
- Utilize EXATAMENTE os nomes de tabelas e colunas do schema. Não invente nomes.
- Exemplos:
  - "Quantos fornecedores estão cadastrados?" -> SELECT count(*) AS total FROM Pessoas WHERE tipo = 'FORNECEDOR'
  - "Liste as classificações de despesa ativas." -> SELECT descricao FROM Classificacao WHERE tipo = 'DESPESA' AND status = 'ATIVO'
  - "Qual o total de parcelas em aberto?" -> SELECT sum(valorparcela) AS total FROM ParcelasContas WHERE statusparcela = 'ABERTA'
Retorne apenas o SQL puro, sem explicações.

Pergunta: ${question}
Contexto:
${selected.join('\n')}

Schema:
${schema}
`;
  const model = googleGenAI.models && googleGenAI.models.generateContent
    ? null
    : googleGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  let sqlText = '';
  if (googleGenAI.models && googleGenAI.models.generateContent) {
    const res = await withRetry(() =>
      googleGenAI.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: sqlPrompt }] }] })
    );
    const text = typeof res.text === 'function' ? await res.text() : (res.text || '');
    sqlText = (text || '').trim();
  } else {
    const res = await withRetry(() => model.generateContent({ contents: [{ role: 'user', parts: [{ text: sqlPrompt }] }] }));
    sqlText = (res.response.text() || '').trim();
  }
  sqlText = sqlText.replace(/```sql|```/g, '').trim();
  sqlText = sqlText.replace(/;+\s*$/g, '');
  if (/fora do escopo/i.test(sqlText)) {
    return { answer: 'Pergunta fora do escopo do sistema.', context: selected, refused: true };
  }

  // 2) Executa o SQL com salvaguarda (limite se não for agregado)
  let rows = [];
  try {
    const isAggregate = /(count\s*\(|sum\s*\(|avg\s*\(|min\s*\(|max\s*\(|group\s+by)/i.test(sqlText);
    const hasLimit = /\blimit\b/i.test(sqlText);
    let finalSql = sqlText;
    if (!isAggregate && !hasLimit) {
      finalSql = `${sqlText} limit 50`;
    }
    const exec = await query(finalSql);
    rows = exec.rows || [];
  } catch (e) {
    // fallback: tenta wrapper como subquery (caso SQL gere colunas soltas)
    try {
      const exec2 = await query(`select * from (${sqlText}) as q limit 50`);
      rows = exec2.rows || [];
    } catch (_) {
      rows = [];
    }
  }

  // Fallback para RAG simples quando embeddings não retornarem linhas
  if (!rows || rows.length === 0) {
    try {
      const simple = await askSimple({ googleGenAI, question });
      if (simple && simple.answer) {
        return { answer: simple.answer, context: selected, fallback: 'simple' };
      }
    } catch (_) {}
  }

  // 3) Gera resposta natural
  const promptAns = `
Responda em português, com texto bem escrito (2 a 5 frases), claro e direto.
Pergunta: ${question}
Contexto de colunas: ${selected.join(', ')}
Amostra de linhas (máx 50): ${JSON.stringify(rows).substring(0, 4000)}
Regra: devolva apenas a resposta final; não mostre SQL nem explicações técnicas.
Se não houver dados, responda "Não encontrei registros.".
`;
  let answer = '';
  if (googleGenAI.models && googleGenAI.models.generateContent) {
    const res = await withRetry(() =>
      googleGenAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: promptAns }] }],
      })
    );
    const text = typeof res.text === 'function' ? await res.text() : (res.text || '');
    answer = (text || '').trim();
  } else {
    const res = await withRetry(() =>
      model.generateContent({ contents: [{ role: 'user', parts: [{ text: promptAns }] }] })
    );
    answer = (res.response.text() || '').trim();
  }
  return { answer, context: selected };
}

module.exports = {
  loadSchemaText,
  buildEmbedIndex,
  askSimple,
  askEmbed,
};


