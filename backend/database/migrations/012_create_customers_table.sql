-- Migration 012: Criar tabela de clientes
-- Data: 2025-01-16

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(20),
    endereco VARCHAR(255),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    cep VARCHAR(10),
    estado VARCHAR(2),
    inscricao_estadual VARCHAR(50),
    telefone VARCHAR(50),
    email VARCHAR(255),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice para busca por CNPJ
CREATE INDEX IF NOT EXISTS idx_customers_cnpj ON customers(cnpj);

-- Criar índice para busca por razão social
CREATE INDEX IF NOT EXISTS idx_customers_razao_social ON customers(razao_social);

-- Criar índice para busca por nome fantasia
CREATE INDEX IF NOT EXISTS idx_customers_nome_fantasia ON customers(nome_fantasia);

-- Criar índice para busca por cidade
CREATE INDEX IF NOT EXISTS idx_customers_cidade ON customers(cidade);

-- Comentários na tabela
COMMENT ON TABLE customers IS 'Tabela de clientes do sistema';
COMMENT ON COLUMN customers.razao_social IS 'Razão social do cliente';
COMMENT ON COLUMN customers.nome_fantasia IS 'Nome fantasia do cliente';
COMMENT ON COLUMN customers.cnpj IS 'CNPJ do cliente';
COMMENT ON COLUMN customers.ativo IS 'Indica se o cliente está ativo no sistema';
