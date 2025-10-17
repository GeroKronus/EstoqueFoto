-- Migration 008: Criar tabela de histórico de alterações de ordens de saída
-- Data: 2025-01-15
-- Descrição: Permite rastrear todas as alterações nas quantidades dos itens das ordens de saída

-- Tabela de histórico de alterações de itens de ordens de saída
CREATE TABLE IF NOT EXISTS exit_order_items_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_order_id UUID NOT NULL REFERENCES exit_orders(id) ON DELETE CASCADE,
    exit_order_item_id UUID NOT NULL REFERENCES exit_order_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id),

    -- Valores antes da alteração
    previous_quantity DECIMAL(10,2) NOT NULL,

    -- Valores após a alteração
    new_quantity DECIMAL(10,2) NOT NULL,

    -- Informações da alteração
    change_type VARCHAR(50) NOT NULL, -- 'quantity_increased', 'quantity_decreased', 'item_removed', 'item_added'
    quantity_difference DECIMAL(10,2) NOT NULL, -- Positivo = aumentou, Negativo = diminuiu

    -- Auditoria
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,

    -- Índices para melhor performance
    CONSTRAINT check_quantities CHECK (previous_quantity >= 0 AND new_quantity >= 0)
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_exit_order_items_history_order ON exit_order_items_history(exit_order_id);
CREATE INDEX IF NOT EXISTS idx_exit_order_items_history_item ON exit_order_items_history(exit_order_item_id);
CREATE INDEX IF NOT EXISTS idx_exit_order_items_history_equipment ON exit_order_items_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_exit_order_items_history_date ON exit_order_items_history(changed_at);

-- Adicionar campo para indicar se o item foi modificado
ALTER TABLE exit_order_items
ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT FALSE;

-- Adicionar campo para armazenar a quantidade original
ALTER TABLE exit_order_items
ADD COLUMN IF NOT EXISTS original_quantity DECIMAL(10,2);

-- Atualizar items existentes com quantidade original igual à quantidade atual
UPDATE exit_order_items
SET original_quantity = quantity
WHERE original_quantity IS NULL;

-- Comentários nas tabelas
COMMENT ON TABLE exit_order_items_history IS 'Histórico de todas as alterações feitas nos itens das ordens de saída';
COMMENT ON COLUMN exit_order_items_history.change_type IS 'Tipo de alteração: quantity_increased, quantity_decreased, item_removed, item_added';
COMMENT ON COLUMN exit_order_items_history.quantity_difference IS 'Diferença na quantidade (positivo = aumentou, negativo = diminuiu)';
