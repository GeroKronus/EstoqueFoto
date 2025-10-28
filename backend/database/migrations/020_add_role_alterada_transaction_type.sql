-- Migration 020: Adicionar tipo 'role_alterada' ao CHECK constraint da tabela transactions
-- Data: 2025-10-27
-- Descrição: Permite registrar alterações de role de usuários no histórico de transações

-- 1. Remover constraint antiga
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 2. Adicionar nova constraint com 'role_alterada'
ALTER TABLE transactions
ADD CONSTRAINT transactions_type_check
CHECK (type IN (
    'entrada',
    'saida',
    'ajuste',
    'criacao',
    'produto_excluido',
    'usuario_criado',
    'usuario_desativado',
    'usuario_reativado',
    'role_alterada',
    'reset'
));
