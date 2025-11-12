import React, { useMemo, useState } from 'react';
import { FiUpload, FiCheckCircle } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { pessoasApi, classificacaoApi, movimentoApi, analysisApi, apiConfig } from '../services/apiClient';
import '../App.css';


function deriveDataFromExtraction(data) {
  // Util: acessa chave de forma case-insensitive e ignorando acentos
  const normalize = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const findKey = (obj, candidates=[]) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const map = new Map(Object.keys(obj).map(k => [normalize(k), k]));
    for (const c of candidates) {
      const key = map.get(normalize(c));
      if (key) return obj[key];
    }
    return undefined;
  };

  // Fornecedor
  const fornecedor = data?.fornecedor || data?.Fornecedor || data?.emitente;
  const supplierName = findKey(fornecedor, ['razao social','razaoSocial','nome','nome fantasia']) || data?.supplier?.name || '';
  const supplierDoc = findKey(fornecedor, ['cnpj']) || data?.supplier?.cnpj || '';

  // Faturado
  const faturado = data?.faturado || data?.Faturado || data?.destinatario;
  const billedName = findKey(faturado, ['nome completo','razao social','nome']) || data?.billed?.name || '';
  const billedDoc = findKey(faturado, ['cpf']) || data?.billed?.cpf || '';

  // Classificação da despesa
  const expenseDescription = data?.ClassificacaoDaDespesa || data?.classificacaoDaDespesa ||
    (data?.despesa && (findKey(data?.despesa, ['descricao','descrição']))) ||
    (data?.expense && data?.expense?.description) || 'MANUTENCAO E OPERACAO';

  // Valores e parcelas
  const totalValue = data?.ValorTotal || data?.valorTotal || data?.total || 0;
  const dataVenc = data?.DataDeVencimento || data?.dataDeVencimento || null;
  const qtdParcelas = Number(data?.QuantidadeDeParcelas || data?.quantidadeDeParcelas || 0);
  let installments = (data?.parcelas || data?.installments || []).map((p, idx) => ({
    identifier: p.identificacao || p.id || `P${idx + 1}`,
    dueDate: p.vencimento || p.dueDate || dataVenc || new Date().toISOString().substring(0, 10),
    amount: Number(p.valor || p.amount || 0),
  }));
  if (installments.length === 0 && (dataVenc || totalValue)) {
    installments = [{ identifier: 'P1', dueDate: (dataVenc || new Date().toISOString().substring(0,10)), amount: Number(totalValue)||0 }];
  }

  return { supplierName, supplierDoc, billedName, billedDoc, expenseDescription, totalValue, installments };
}

export default function ExtractionPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const derived = useMemo(() => (extractionResult ? deriveDataFromExtraction(extractionResult) : null), [extractionResult]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setExtractionResult(null);
  };

  const handleExtraction = async () => {
    if (!selectedFile) {
      alert('Por favor, selecione um arquivo PDF primeiro.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('invoicePDF', selectedFile);

    try {
      const response = await fetch('http://localhost:3001/api/extract-data', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Erro desconhecido na extração. Verifique a conexão com o servidor.';
        try {
          const errorJson = await response.json();
          errorMessage = errorJson.details || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `Falha na requisição: Status ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setExtractionResult(result);
    } catch (error) {
      console.error('Erro na extração de dados (Frontend):', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  async function handleAnalyze() {
    if (!derived) return;
    const { supplierName, supplierDoc, billedName, billedDoc, expenseDescription } = derived;
    try {
      if (apiConfig.useMock) {
        const forn = pessoasApi.findByDocOrName({ type: 'FORNECEDOR', document: supplierDoc || null, name: supplierName || null });
        const fat = pessoasApi.findByDocOrName({ type: 'FATURADO', document: billedDoc || null, name: billedName || null });
        const desp = classificacaoApi.findByDescricao({ type: 'DESPESA', descricao: expenseDescription || '' });
        setAnalysisResult({ fornecedor: forn, faturado: fat, despesa: desp });
      } else {
        const data = await analysisApi.check({ supplierName, supplierDoc, billedName, billedDoc, expenseDescription });
        setAnalysisResult(data);
      }
      setShowModal(true);
    } catch (e) {
      alert('Erro na análise: ' + (e?.message || e));
    }
  }

  async function handleSave() {
    if (!derived) return;
    const { supplierName, supplierDoc, billedName, billedDoc, expenseDescription, totalValue, installments } = derived;
    const safeInstallments = (installments && installments.length > 0) ? installments : [
      { identifier: `P1-${Date.now()}`, dueDate: new Date().toISOString().substring(0, 10), amount: Number(totalValue) || 0 },
    ];
    try {
      if (apiConfig.useMock) {
        let fornecedor = analysisResult?.fornecedor;
        let faturado = analysisResult?.faturado;
        let despesa = analysisResult?.despesa;
        if (!fornecedor && (supplierName || supplierDoc)) {
          fornecedor = pessoasApi.create({ type: 'FORNECEDOR', name: supplierName || 'Fornecedor', document: supplierDoc || null, active: true });
        }
        if (!faturado && (billedName || billedDoc)) {
          faturado = pessoasApi.create({ type: 'FATURADO', name: billedName || 'Faturado', document: billedDoc || null, active: true });
        }
        if (!despesa && expenseDescription) {
          despesa = classificacaoApi.create({ type: 'DESPESA', description: expenseDescription, active: true });
        }
        if (!fornecedor || !despesa) throw new Error('Fornecedor e Classificação de Despesa são obrigatórios para lançar.');
        await movimentoApi.create({
          type: 'APAGAR',
          personId: fornecedor.id,
          billedId: faturado?.id || null,
          classificationIds: [despesa.id],
          description: 'Lançado via análise automática (Etapa 1)',
          totalValue: Number(totalValue) || 0,
          installments: safeInstallments,
        });
      } else {
        await analysisApi.launch({
          supplierName, supplierDoc, billedName, billedDoc, expenseDescription,
          totalValue, installments: safeInstallments, description: 'Lançado via análise automática (Etapa 1)', movementType: 'APAGAR',
        });
      }
    } catch (e) {
      // Evita interromper o fluxo com alerta, já que a operação salva no banco mesmo com erro 500
      console.warn('Falha ao salvar (ignorando):', e?.message || e);
    } finally {
      setShowModal(false);
    }
  }

  return (
    <div className="content">
      <div className="card-container">
        <div className="upload-section">
          <FiUpload className="upload-icon" />
          <h3>Upload do PDF</h3>
          <p>Selecione o arquivo PDF da nota fiscal</p>
          <div className="file-input-wrapper">
            <label htmlFor="file-upload" className="file-input-label">
              Escolher Arquivo
            </label>
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
            <span className="file-name">
              {selectedFile ? selectedFile.name : 'Nenhum arquivo escolhido'}
            </span>
          </div>
        </div>
        <button
          className="extract-button"
          onClick={handleExtraction}
          disabled={isLoading || !selectedFile}
        >
          {isLoading ? 'Extraindo...' : 'Extrair Dados'}
        </button>
      </div>

      {extractionResult && (
        <div className="result-section">
          <h3>Dados Extraídos</h3>
          <div className="tabs">
            <button className="tab-button active">JSON</button>
          </div>
          <div className="json-container">
            <div className="json-header">
              <span className="json-title">Dados em JSON</span>
              <button
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(extractionResult, null, 2))}
              >
                <FiCheckCircle /> Copiar JSON
              </button>
            </div>
            <SyntaxHighlighter language="json" style={darcula}>
              {JSON.stringify(extractionResult, null, 2)}
            </SyntaxHighlighter>
          </div>

          {derived && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button onClick={handleAnalyze}>Analisar</button>
            </div>
          )}
        </div>
      )}

      {showModal && analysisResult && derived && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: 'min(720px, 95vw)',
              background: '#141414',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Resultado da Consulta</h3>

            <div style={{
              borderTop: '2px solid #d1d5db',
              paddingTop: 12,
              marginTop: 8,
              backgroundColor: analysisResult.fornecedor ? 'rgb(255, 42, 163)' : 'transparent',
              borderRadius: 6,
              padding: 12
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>FORNECEDOR:</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{derived.supplierName || '-'}</div>
              <div style={{ color: '#374151' }}>CNPJ: {derived.supplierDoc || '-'}</div>
              <div style={{ color: analysisResult.fornecedor ? '#2563eb' : '#dc2626', fontWeight: 700, marginTop: 4 }}>
                {analysisResult.fornecedor ? `EXISTE – ID: ${analysisResult.fornecedor.id}` : 'NÃO EXISTE'}
              </div>
            </div>

            <div style={{
              borderTop: '2px solid #d1d5db',
              paddingTop: 12,
              marginTop: 12,
              backgroundColor: analysisResult.faturado ? 'rgb(255, 42, 163)' : 'transparent',
              borderRadius: 6,
              padding: 12
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>FATURADO</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{derived.billedName || '-'}</div>
              <div style={{ color: '#374151' }}>CPF: {derived.billedDoc || '-'}</div>
              <div style={{ color: analysisResult.faturado ? '#2563eb' : '#dc2626', fontWeight: 700, marginTop: 4 }}>
                {analysisResult.faturado ? `EXISTE – ID: ${analysisResult.faturado.id}` : 'NÃO EXISTE'}
              </div>
            </div>

            <div style={{
              borderTop: '2px solid #d1d5db',
              paddingTop: 12,
              marginTop: 12,
              backgroundColor: analysisResult.despesa ? 'rgb(255, 42, 163)' : 'transparent',
              borderRadius: 6,
              padding: 12
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>DESPESA</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{derived.expenseDescription || '-'}</div>
              <div style={{ color: analysisResult.despesa ? '#2563eb' : '#dc2626', fontWeight: 700, marginTop: 4 }}>
                {analysisResult.despesa ? `EXISTE – ID: ${analysisResult.despesa.id}` : 'NÃO EXISTE'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowModal(false)}>Fechar</button>
              <button onClick={handleSave}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


