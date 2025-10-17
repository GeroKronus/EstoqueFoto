-- Migration 017: Corrigir constraint de status e remover campo document dos itens

-- Remover constraint antiga
ALTER TABLE exit_orders
DROP CONSTRAINT IF EXISTS exit_orders_status_check;

-- Adicionar nova constraint com status 'finalizada'
ALTER TABLE exit_orders
ADD CONSTRAINT exit_orders_status_check
CHECK (status IN ('ativa', 'cancelada', 'finalizada'));

-- Remover coluna document da tabela exit_order_items
ALTER TABLE exit_order_items
DROP COLUMN IF EXISTS document;

-- Comentário
COMMENT ON CONSTRAINT exit_orders_status_check ON exit_orders IS 'Status permitidos: ativa, cancelada, finalizada';

SELECT 'Migration 017 executada com sucesso!' as message;
