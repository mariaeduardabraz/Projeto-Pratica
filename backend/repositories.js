const { query, withTransaction } = require('./db');

// Pessoas
async function listPeople(type) {
  const sql = type ? 'select * from Pessoas where tipo = $1 order by idPessoas desc' : 'select * from Pessoas order by idPessoas desc';
  const res = await query(sql, type ? [type] : []);
  return res.rows;
}

async function findPerson({ type, documento, razaosocial }) {
  const conditions = [];
  const params = [];
  if (type) { params.push(type); conditions.push(`tipo = $${params.length}`); }
  if (documento) { params.push(documento); conditions.push(`documento = $${params.length}`); }
  if (razaosocial) { params.push(razaosocial); conditions.push(`lower(razaosocial) = lower($${params.length})`); }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const res = await query(`select * from Pessoas ${where} limit 1`, params);
  return res.rows[0] || null;
}

async function createPerson({ tipo, razaosocial, documento = null, fantasia = null, status = 'ATIVO' }) {
  const res = await query(
    `insert into Pessoas(tipo, razaosocial, fantasia, documento, status) values ($1,$2,$3,$4,$5) returning *`,
    [tipo, razaosocial, fantasia, documento, status]
  );
  return res.rows[0];
}

async function setPersonStatus(id, status) {
  const res = await query(`update Pessoas set status=$1 where idPessoas=$2 returning *`, [status, id]);
  return res.rows[0];
}

// Classificacao
async function listClassification(type) {
  const sql = type ? 'select * from Classificacao where tipo = $1 order by idClassificacao desc' : 'select * from Classificacao order by idClassificacao desc';
  const res = await query(sql, type ? [type] : []);
  return res.rows;
}

async function findClassification({ type, descricao }) {
  const res = await query(`select * from Classificacao where tipo=$1 and lower(descricao)=lower($2) limit 1`, [type, descricao]);
  return res.rows[0] || null;
}

async function createClassification({ type, descricao, status = 'ATIVO' }) {
  const res = await query(
    `insert into Classificacao(tipo, descricao, status) values ($1,$2,$3) returning *`,
    [type, descricao, status]
  );
  return res.rows[0];
}

async function setClassificationStatus(id, status) {
  const res = await query(`update Classificacao set status=$1 where idClassificacao=$2 returning *`, [status, id]);
  return res.rows[0];
}

// Movimento
async function createMovement({ tipo, numeronotafiscal=null, dataemissao=null, descricao=null, valortotal=0, fornecedorClienteId, faturadoId=null, classificacaoIds=[], parcelas=[] }) {
  return await withTransaction(async (client) => {
    const movRes = await client.query(
      `insert into MovimentoContas(tipo, numeronotafiscal, dataemissao, descricao, valortotal, Pessoas_idFornecedorCliente, Pessoas_idFaturado)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [tipo, numeronotafiscal, dataemissao, descricao, valortotal, fornecedorClienteId, faturadoId]
    );
    const mov = movRes.rows[0];
    const movId = mov.idmovimentocontas;
    for (const classId of classificacaoIds) {
      await client.query(`insert into MovimentoContas_has_Classificacao(MovimentoContas_idMovimentoContas, Classificacao_idClassificacao) values ($1,$2) on conflict do nothing`, [movId, classId]);
    }
    for (let idx = 0; idx < parcelas.length; idx++) {
      const parc = parcelas[idx];
      const valor = Number(parc.valor || parc.amount || 0);
      let identificacao = parc.identificacao || parc.identifier || `P${idx + 1}-${Date.now()}`;

      // Tenta inserir a parcela; em caso de duplicidade de identificação, gera um sufixo único e tenta novamente.
      let inserted = false;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        try {
          await client.query(
            `insert into ParcelasContas(Identificacao, datavencimento, valorparcela, valorpago, valorsaldo, statusparcela, MovimentoContas_idMovimentoContas)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [identificacao, parc.vencimento || parc.dueDate, valor, 0, valor, 'ABERTA', movId]
          );
          inserted = true;
        } catch (e) {
          if (e && e.code === '23505' && attempt < 2) {
            identificacao = `${identificacao}-${Math.random().toString(36).slice(2, 6)}`;
            continue;
          }
          throw e;
        }
      }
    }
    return mov;
  });
}

module.exports = {
  listPeople,
  findPerson,
  createPerson,
  setPersonStatus,
  listClassification,
  findClassification,
  createClassification,
  setClassificationStatus,
  createMovement,
};


