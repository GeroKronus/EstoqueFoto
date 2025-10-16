-- Migration: Permitir quantidade zero em itens de ordens de saída
-- Descrição: Altera a constraint de quantidade para permitir valor 0, permitindo que usuários zerem itens

-- Remover constraint antiga
ALTER TABLE exit_order_items
DROP CONSTRAINT IF EXISTS exit_order_items_quantity_check;

-- Adicionar nova constraint permitindo zero ou valores positivos
ALTER TABLE exit_order_items
ADD CONSTRAINT exit_order_items_quantity_check CHECK (quantity >= 0);

COMMENT ON CONSTRAINT exit_order_items_quantity_check ON exit_order_items IS 'Permite quantidade zero para rastreamento de itens zerados por usuários';
