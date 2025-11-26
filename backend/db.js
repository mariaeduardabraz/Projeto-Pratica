require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || `postgresql://extrair_dados_postgres_user:aH7KKavYK6t1dVR7U9B8wrkenMI7BPaP@dpg-d4jlkinpm1nc738vu0ag-a/extrair_dados_postgres`;

const pool = new Pool({ connectionString });

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function bootstrapSchema() {
  // Cria tabelas se não existirem, conforme ERD
  await query(`
    create table if not exists Pessoas (
      idPessoas serial primary key,
      tipo varchar(45) not null check (tipo in ('CLIENTE','FORNECEDOR','FATURADO')),
      razaosocial varchar(150) not null,
      fantasia varchar(150),
      documento varchar(45),
      status varchar(45) not null default 'ATIVO'
    );

    create table if not exists Classificacao (
      idClassificacao serial primary key,
      tipo varchar(45) not null check (tipo in ('DESPESA','RECEITA')),
      descricao varchar(150) not null,
      status varchar(45) not null default 'ATIVO'
    );

    create table if not exists MovimentoContas (
      idMovimentoContas serial primary key,
      tipo varchar(45) not null check (tipo in ('APAGAR','ARECEBER')),
      numeronotafiscal varchar(45),
      dataemissao date,
      descricao varchar(300),
      status varchar(45) not null default 'ABERTO',
      valortotal numeric(12,2) not null default 0,
      Pessoas_idFornecedorCliente integer not null references Pessoas(idPessoas),
      Pessoas_idFaturado integer references Pessoas(idPessoas)
    );

    create table if not exists ParcelasContas (
      idParcelasContas serial primary key,
      Identificacao varchar(45) not null unique,
      datavencimento date not null,
      valorparcela numeric(12,2) not null,
      valorpago numeric(12,2) not null default 0,
      valorsaldo numeric(12,2) not null default 0,
      statusparcela varchar(45) not null default 'ABERTA',
      MovimentoContas_idMovimentoContas integer not null references MovimentoContas(idMovimentoContas)
    );

    create table if not exists MovimentoContas_has_Classificacao (
      MovimentoContas_idMovimentoContas integer not null references MovimentoContas(idMovimentoContas) on delete cascade,
      Classificacao_idClassificacao integer not null references Classificacao(idClassificacao) on delete restrict,
      primary key (MovimentoContas_idMovimentoContas, Classificacao_idClassificacao)
    );
  `);
}

module.exports = { pool, query, withTransaction, bootstrapSchema };


