-- Migration: Criar tabelas de Ordens de Saída
-- Descrição: Sistema de ordens de saída com múltiplos itens, numeração sequencial e cancelamento

-- Tabela principal de ordens de saída
CREATE TABLE IF NOT EXISTS exit_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number SERIAL UNIQUE NOT NULL,

    -- Informações da ordem
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('aluguel', 'venda', 'manutencao', 'uso_interno', 'perda', 'outros')),
    destination VARCHAR(255),
    customer_name VARCHAR(255),
    customer_document VARCHAR(50),
    notes TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),

    -- Valores
    total_items INTEGER NOT NULL DEFAULT 0,
    total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,

    -- Auditoria
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Cancelamento
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de itens da ordem de saída
CREATE TABLE IF NOT EXISTS exit_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_order_id UUID NOT NULL REFERENCES exit_orders(id) ON DELETE CASCADE,

    -- Equipamento
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    equipment_name VARCHAR(255) NOT NULL, -- Snapshot do nome no momento da saída

    -- Quantidade e valores
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,

    -- Auditoria
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(exit_order_id, equipment_id) -- Um equipamento por ordem
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_exit_orders_order_number ON exit_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_exit_orders_status ON exit_orders(status);
CREATE INDEX IF NOT EXISTS idx_exit_orders_created_at ON exit_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exit_orders_created_by ON exit_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_exit_order_items_order_id ON exit_order_items(exit_order_id);
CREATE INDEX IF NOT EXISTS idx_exit_order_items_equipment_id ON exit_order_items(equipment_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_exit_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_exit_orders_updated_at
    BEFORE UPDATE ON exit_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_exit_orders_updated_at();

-- Função para calcular totais da ordem
CREATE OR REPLACE FUNCTION calculate_exit_order_totals(order_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE exit_orders
    SET
        total_items = (
            SELECT COUNT(*)
            FROM exit_order_items
            WHERE exit_order_id = order_id
        ),
        total_value = (
            SELECT COALESCE(SUM(total_cost), 0)
            FROM exit_order_items
            WHERE exit_order_id = order_id
        )
    WHERE id = order_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular totais quando itens mudam
CREATE OR REPLACE FUNCTION recalculate_exit_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_exit_order_totals(OLD.exit_order_id);
        RETURN OLD;
    ELSE
        PERFORM calculate_exit_order_totals(NEW.exit_order_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_exit_order_totals
    AFTER INSERT OR UPDATE OR DELETE ON exit_order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_exit_order_totals();

COMMENT ON TABLE exit_orders IS 'Ordens de saída de equipamentos com múltiplos itens';
COMMENT ON TABLE exit_order_items IS 'Itens individuais de cada ordem de saída';
COMMENT ON COLUMN exit_orders.order_number IS 'Número sequencial da ordem';
COMMENT ON COLUMN exit_orders.status IS 'Status da ordem: ativa ou cancelada';
