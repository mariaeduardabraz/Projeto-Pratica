# Backend - Projeto Adm

## Variáveis de ambiente

Crie um arquivo `.env` em `backend/` com:

```
GEMINI_API_KEY=seu_token
DATABASE_URL=postgres://usuario:senha@localhost:5432/projeto_adm
```

## Rodando

1. Instale dependências (na pasta `backend`):
   ```bash
   npm install
   ```
2. Suba um Postgres local e crie o banco `projeto_adm` (ou ajuste `DATABASE_URL`).
3. Inicie o servidor (cria/valida o schema automaticamente):
   ```bash
   npm run dev
   ```

## Endpoints principais

- GET `/api/people?type=FORNECEDOR|CLIENTE|FATURADO`
- GET `/api/people/find?type=FORNECEDOR&document=...&name=...`
- GET `/api/classification?type=DESPESA|RECEITA`
- GET `/api/classification/find?type=DESPESA&description=...`
- POST `/api/analysis/check` – body: `{ supplierName, supplierDoc, billedName, billedDoc, expenseDescription }`
- POST `/api/analysis/launch` – cria faltantes e lança movimento APAGAR
- POST `/api/movements` – registra movimento APAGAR/ARECEBER diretamente

O schema segue o ERD fornecido, com regras de negócio:
- Cadastros não são excluídos (campo `status` para inativar/reativar)
- Movimento pode ter N classificações (tabela `MovimentoContas_has_Classificacao`)
- Parcelas com `Identificacao` única e vínculo com o movimento.
