-- Tabela de protocolos (metadados)
CREATE TABLE IF NOT EXISTS protocolos (
    uuid TEXT PRIMARY KEY,
    numero TEXT UNIQUE,
    status TEXT,
    nome_residente TEXT,
    data_ocorrencia DATE,
    data_abertura TIMESTAMP,
    data_encerramento TIMESTAMP,
    ultima_atualizacao TIMESTAMP
);

-- Tabela de etapas (dados das 17 etapas)
CREATE TABLE IF NOT EXISTS etapas (
    id SERIAL PRIMARY KEY,
    protocolo_uuid TEXT REFERENCES protocolos(uuid) ON DELETE CASCADE,
    numero_etapa INT,
    dados JSONB,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS anexos (
    id SERIAL PRIMARY KEY,
    protocolo_uuid TEXT REFERENCES protocolos(uuid) ON DELETE CASCADE,
    etapa_numero INT,
    nome_arquivo TEXT,
    tamanho_bytes INT,
    tipo_mime TEXT,
    caminho_storage TEXT,
    criado_em TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_protocolos_numero ON protocolos(numero);
CREATE INDEX idx_protocolos_status ON protocolos(status);
CREATE INDEX idx_etapas_protocolo ON etapas(protocolo_uuid);
CREATE INDEX idx_anexos_protocolo ON anexos(protocolo_uuid);

-- RLS Policies (segurança)
ALTER TABLE protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexos ENABLE ROW LEVEL SECURITY;
