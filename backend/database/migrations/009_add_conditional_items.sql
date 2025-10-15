-- Migration 009: Adicionar campo de itens condicionais
-- Permite marcar itens da ordem de saída como condicionais (podem ser devolvidos)

-- Adicionar coluna is_conditional na tabela exit_order_items
ALTER TABLE exit_order_items
ADD COLUMN IF NOT EXISTS is_conditional BOOLEAN DEFAULT FALSE;

-- Criar índice para consultas rápidas de itens condicionais
CREATE INDEX IF NOT EXISTS idx_exit_order_items_conditional
ON exit_order_items(is_conditional) WHERE is_conditional = TRUE;

-- Comentários
COMMENT ON COLUMN exit_order_items.is_conditional IS 'Indica se o item é condicional (cliente pode devolver, ainda não foi pago)';
