-- Migration 019: Adicionar número de nota fiscal aos pagamentos
-- Permite registrar o número da NF ao registrar pagamentos de OS

ALTER TABLE service_order_payments
ADD COLUMN IF NOT EXISTS numero_nota_fiscal VARCHAR(50);

COMMENT ON COLUMN service_order_payments.numero_nota_fiscal IS 'Número da Nota Fiscal emitida para este pagamento';
