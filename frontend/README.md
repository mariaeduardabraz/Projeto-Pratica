# Projeto Administrativo - Extração de Dados de Notas Fiscais

Este projeto, desenvolvido como parte da avaliação N2 - Etapa 1 da matéria de Prática de Engenharia de Software, ministrada pelo professor João Dionísio Paraíba, é uma aplicação web para extrair dados de notas fiscais em formato PDF usando a API do Google Gemini. A aplicação é dividida em um front-end com React e um back-end com Node.js, que se comunicam para processar o arquivo e retornar as informações em formato JSON.

## Funcionalidades

  * **Upload de PDF**: A interface permite que o usuário carregue um arquivo PDF de nota fiscal.
  * **Extração de Dados**: O back-end envia o conteúdo do PDF para a API do Gemini.
  * **Processamento Inteligente**: O Gemini extrai dados específicos da nota fiscal, como Fornecedor, Faturado, Valor Total e Número da Nota.
  * [cite\_start]**Classificação de Despesas**: Com base na descrição dos produtos, o Gemini interpreta e classifica a despesa em uma das categorias predefinidas (ex: MANUTENÇÃO E OPERAÇÃO, INSUMOS AGRÍCOLAS)[cite: 40, 41, 42].
  * **Exibição em JSON**: Os dados extraídos são exibidos na interface em formato JSON, prontos para uso.

## Tecnologias Utilizadas

  * **Front-end**: JavaScript, React, Vite.js
  * **Back-end**: Node.js, Express.js
  * **Serviços de IA**: Google Gemini API

## Estrutura do Projeto

O projeto segue uma arquitetura de back-end e front-end separados, dentro de uma pasta principal.

## Como Configurar e Executar

Siga os passos abaixo para configurar e rodar a aplicação em sua máquina.

### **Passo 1: Chave da API do Google Gemini**

Antes de tudo, você precisa de uma chave da API do Google Gemini.

  * Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
  * Gere uma nova chave e guarde-a em segurança.

### **Passo 2: Configuração do Back-end (Node.js)**

1.  Abra o terminal e navegue até a pasta `backend`.
    ```bash
    cd projeto-administrativo/backend
    ```
2.  Instale as dependências do Node.js.
    ```bash
    npm install
    ```
3.  Abra o arquivo `server.js` e substitua a chave pela sua chave de API do Gemini.
    ```javascript
    const API_KEY = 'SUA_CHAVE_AQUI';
    ```
4.  Inicie o servidor.
    ```bash
    node server.js
    ```
    O servidor estará rodando em `http://localhost:3001`.

### **Passo 3: Configuração do Front-end (React)**

1.  Abra um novo terminal e navegue até a pasta `frontend`.
    ```bash
    cd projeto-administrativo/frontend
    ```
2.  Instale as dependências do React.
    ```bash
    npm install
    ```
3.  Inicie a aplicação React.
    ```bash
    npm run dev
    ```
    A aplicação estará acessível em `http://localhost:5173`.

### **Passo 4: Executando a Aplicação**

1.  Com o front-end e o back-end rodando, abra o seu navegador e acesse `http://localhost:5173`.
2.  Clique em "Escolher Arquivo" e selecione um PDF de nota fiscal que tenha texto.
3.  Clique em "Extrair Dados". A requisição será enviada para o back-end, que processará o PDF com o Gemini e retornará o JSON preenchido para a tela.

## Executando com Docker (recomendado)

Este projeto já inclui Dockerfiles para front e back e um `docker-compose.yml` na raiz que orquestra:

- PostgreSQL (porta do host 5434 → container 5432)
- Backend Node/Express (porta 3001)
- Frontend (Nginx servindo build do Vite, porta 5173)

### Pré-requisitos

- Docker e Docker Compose instalados
- Chave da API do Gemini em um arquivo `.env` na raiz do projeto (mesmo nível do `docker-compose.yml`)

Crie o arquivo `.env` (na raiz do repositório, não em `frontend/` nem `backend/`):

```
GEMINI_API_KEY=SEU_TOKEN_DO_GEMINI
```

Obs.: Sem essa variável, a extração de PDF e as rotas de RAG que dependem do LLM não funcionarão.

### Subir tudo

Na raiz do projeto:

```bash
docker compose up -d --build
```

Após subir:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001/api
- Postgres: host=localhost port=5434 db=projeto_adm user=postgres pass=postgres

O `docker-compose.yml` já configura:
- `DATABASE_URL` do backend apontando para o serviço `db`
- `VITE_API_URL` do frontend apontando para `http://localhost:3001/api`

### Parar/retomar

```bash
# parar os serviços
docker compose down

# subir novamente (sem rebuild)
docker compose up -d
```

### Logs

```bash
# todos os serviços
docker compose logs -f

# apenas backend
docker compose logs -f backend

# apenas db
docker compose logs -f db
```

### Limpar volumes (apaga dados do banco)

```bash
docker compose down -v
```

### Ajustes de porta

Se alguma porta estiver ocupada:
- Altere as portas expostas no `docker-compose.yml` (por exemplo, `5173:80` do frontend ou `3001:3001` do backend).
- Para o Postgres, já usamos a porta do host `5434` mapeada para `5432` do container.