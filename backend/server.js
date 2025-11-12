require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001; 
const API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenAI({ apiKey: API_KEY });

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOverloadedError(err) {
    try {
        const msg = (err && (err.message || err.toString())) || '';
        const topLevelStatus = err && (err.status || err.code);
        const nested = err && (err.error || err.response || {});
        const nestedStatus = nested && (nested.status || nested.code);
        const httpStatus = (nested && nested.statusCode) || (nested && nested.response && nested.response.status);
        const anyStatus = topLevelStatus || nestedStatus || httpStatus;
        if (anyStatus === 503 || String(anyStatus) === '503') return true;
        if (anyStatus === 'UNAVAILABLE' || anyStatus === 'unavailable') return true;
        if (/overload|UNAVAILABLE|503/i.test(msg)) return true;
        const nestedMsg = JSON.stringify(err);
        if (/overload|UNAVAILABLE|503/i.test(nestedMsg)) return true;
    } catch (_) {}
    return false;
}

// DB bootstrap
const { bootstrapSchema } = require('./db');
bootstrapSchema().then(() => console.log('Schema verificado')).catch((e) => console.error('Erro ao criar schema', e));

// API routes (domain)
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Converte um arquivo local em um objeto inlineData (Base64)
function fileToGenerativePart(filePath, mimeType) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
    }
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

app.post('/api/extract-data', upload.single('invoicePDF'), async (req, res) => {
    
    // 1. Validação do Arquivo
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
    }

    const pdfPath = req.file.path;
    const pdfMimeType = req.file.mimetype;

    try {
        // 2. Prepara o PDF para o Gemini
        const pdfPart = fileToGenerativePart(pdfPath, pdfMimeType);

        // 3. Define as categorias e o Prompt
        const categorias = [
            "INSUMOS AGRÍCOLAS", "MANUTENÇÃO E OPERAÇÃO", "RECURSOS HUMANOS",
            "SERVIÇOS OPERACIONAIS", "INFRAESTRUTURA E UTILIDADES",
            "ADMINISTRATIVAS", "SEGUROS E PROTEÇÃO", "IMPOSTOS E TAXAS", "INVESTIMENTOS"
        ].join(", ");

        const prompt = `
            Você é um assistente especialista em extração de dados de notas fiscais. 
            Extraia os seguintes campos do documento PDF anexo e retorne APENAS o JSON. 
            Não inclua nenhum texto explicativo, apenas o objeto JSON.

            Campos obrigatórios:
            - Fornecedor (Razão Social, Nome Fantasia, CNPJ)
            - Faturado (Nome Completo, CPF)
            - NumeroDaNotaFiscal
            - DataDeEmissao (formato YYYY-MM-DD)
            - DescricaoDosProdutos (array de strings)
            - QuantidadeDeParcelas (em formato numérico, sempre 1)
            - DataDeVencimento (formato YYYY-MM-DD)
            - ValorTotal (em formato numérico com ponto decimal, ex: 123.45)
            - ClassificacaoDaDespesa (Classifique em uma das seguintes categorias: ${categorias}).
        `;

        // 4. Configuração para forçar a saída JSON
        const responseConfig = {
            responseMimeType: "application/json",
        };

        const models = ['gemini-2.5-flash'];
        const result = await genAI.models.generateContent({
            model: models[0],
            contents: [pdfPart, { text: prompt }],
            config: responseConfig
        });

        const maybeText = typeof result.text === 'function' ? await result.text() : result.text;
        const text =
            (maybeText && maybeText.toString()) ||
            (result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '');

                payload = JSON.parse((text || '').trim());
        payload = JSON.parse((text || '').trim());

        if (!payload) {
            throw lastErr || new Error('Falha ao obter resposta do modelo.');
        }

        // 6. Processamento e Envio da Resposta
        res.json(payload);

    } catch (error) {
        console.error('ERRO CRÍTICO NA API GEMINI OU NO SERVIDOR:', error); 

        if (isOverloadedError(error)) {
            return res.status(503).json({
                error: 'O modelo está sobrecarregado. Tente novamente em instantes.',
                details: (error && error.message) || 'UNAVAILABLE'
            });
        }

        res.status(500).json({
            error: 'Falha interna do servidor ao processar o PDF.',
            details: error.message || 'Verifique o log do servidor para mais informações.'
        });
    } finally {
        // 7. Limpa o arquivo temporário
        if (pdfPath) {
            fs.unlink(pdfPath, (err) => {
                if (err) console.error("Erro ao deletar arquivo temporário:", err);
            });
        }
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});