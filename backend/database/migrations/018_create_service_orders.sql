-- Migration 018: Criar tabelas para Ordens de Serviço
-- Sistema de controle de assistência técnica

-- Tabela principal de Ordens de Serviço
CREATE TABLE IF NOT EXISTS service_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_os VARCHAR(20) UNIQUE NOT NULL, -- Ex: OS-2025-0001
    customer_id INTEGER REFERENCES customers(id),

    -- Status da OS
    status VARCHAR(30) NOT NULL DEFAULT 'aguardando_orcamento'
        CHECK (status IN (
            'aguardando_orcamento',
            'orcamento_pendente',
            'aprovado',
            'em_reparo',
            'concluido',
            'aguardando_retirada',
            'entregue',
            'cancelado'
        )),

    -- Informações do equipamento do cliente
    equipamento_marca VARCHAR(100),
    equipamento_modelo VARCHAR(100),
    equipamento_serial VARCHAR(100),
    defeito_relatado TEXT NOT NULL,
    defeito_constatado TEXT,
    acessorios TEXT, -- Cabos, bateria, case, etc.

    -- Responsáveis
    tecnico_responsavel_id UUID REFERENCES users(id),
    recebido_por_id UUID REFERENCES users(id),
    entregue_por_id UUID REFERENCES users(id),

    -- Valores
    valor_orcado DECIMAL(12,2) DEFAULT 0 CHECK (valor_orcado >= 0),
    valor_final DECIMAL(12,2) DEFAULT 0 CHECK (valor_final >= 0),

    -- Prazos e datas
    prazo_estimado DATE,
    data_entrada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_orcamento TIMESTAMP WITH TIME ZONE,
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    data_entrega TIMESTAMP WITH TIME ZONE,

    -- Garantia e observações
    garantia_dias INTEGER DEFAULT 90 CHECK (garantia_dias >= 0),
    observacoes TEXT,

    -- Fotos do equipamento na entrada (JSON array de URLs)
    fotos_entrada JSONB,

    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Tabela de peças utilizadas na OS
CREATE TABLE IF NOT EXISTS service_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipment(id), -- Peça do estoque

    -- Informações da peça no momento do uso
    descricao VARCHAR(255) NOT NULL, -- Nome da peça
    quantidade DECIMAL(10,3) NOT NULL CHECK (quantidade > 0),
    valor_unitario DECIMAL(12,2) DEFAULT 0 CHECK (valor_unitario >= 0),
    valor_total DECIMAL(12,2) DEFAULT 0 CHECK (valor_total >= 0),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Tabela de histórico de alterações da OS
CREATE TABLE IF NOT EXISTS service_order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255) NOT NULL,

    action VARCHAR(100) NOT NULL, -- Ex: "Status alterado", "Peça adicionada", etc.
    old_value TEXT,
    new_value TEXT,
    details TEXT, -- Detalhes adicionais da ação

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos (opcional)
CREATE TABLE IF NOT EXISTS service_order_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,

    valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
    forma_pagamento VARCHAR(30) NOT NULL
        CHECK (forma_pagamento IN (
            'dinheiro',
            'pix',
            'cartao_credito',
            'cartao_debito',
            'boleto',
            'outros'
        )),
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observacoes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_tecnico ON service_orders(tecnico_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_numero ON service_orders(numero_os);
CREATE INDEX IF NOT EXISTS idx_service_orders_data_entrada ON service_orders(data_entrada);
CREATE INDEX IF NOT EXISTS idx_service_order_items_order ON service_order_items(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_order_items_equipment ON service_order_items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_service_order_history_order ON service_order_history(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_order_payments_order ON service_order_payments(service_order_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_service_orders_updated_at BEFORE UPDATE ON service_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sequence para número de OS (formato: OS-2025-0001)
CREATE SEQUENCE IF NOT EXISTS service_orders_number_seq START 1;

-- Comentários nas tabelas
COMMENT ON TABLE service_orders IS 'Ordens de Serviço para controle de assistência técnica';
COMMENT ON TABLE service_order_items IS 'Peças utilizadas nas ordens de serviço';
COMMENT ON TABLE service_order_history IS 'Histórico de alterações nas ordens de serviço';
COMMENT ON TABLE service_order_payments IS 'Pagamentos das ordens de serviço';
