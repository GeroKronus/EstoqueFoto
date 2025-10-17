-- Migration 016: Adicionar campo documento nos itens e status finalizada

-- Adicionar coluna document na tabela exit_order_items
ALTER TABLE exit_order_items
ADD COLUMN IF NOT EXISTS document VARCHAR(255);

-- Adicionar colunas de finalização na tabela exit_orders
ALTER TABLE exit_orders
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS document_number VARCHAR(255);

-- Comentários
COMMENT ON COLUMN exit_order_items.document IS 'Número do documento fiscal do item (NF, etc)';
COMMENT ON COLUMN exit_orders.finalized_at IS 'Data e hora de finalização da ordem';
COMMENT ON COLUMN exit_orders.finalized_by IS 'Usuário que finalizou a ordem';
COMMENT ON COLUMN exit_orders.document_number IS 'Número do documento fiscal da ordem (NF, etc)';

SELECT 'Migration 016 executada com sucesso!' as message;
