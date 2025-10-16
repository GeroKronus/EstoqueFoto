-- Migration 013: Adicionar referências de clientes em transactions e exit_orders
-- Data: 2025-10-16
-- Descrição: Adiciona customer_id como FK para customers nas tabelas de transações e ordens de saída

-- 1. Adicionar coluna customer_id na tabela transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- 2. Adicionar coluna customer_id na tabela exit_orders
ALTER TABLE exit_orders
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- 3. Criar índices para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_exit_orders_customer_id ON exit_orders(customer_id);

-- 4. Comentários
COMMENT ON COLUMN transactions.customer_id IS 'ID do cliente destinatário da transação (somente para saídas)';
COMMENT ON COLUMN exit_orders.customer_id IS 'ID do cliente destinatário da ordem de saída';

-- NOTA: Mantemos customer_name e customer_document para retrocompatibilidade e dados históricos
-- Mas a partir de agora, devemos usar customer_id quando possível
