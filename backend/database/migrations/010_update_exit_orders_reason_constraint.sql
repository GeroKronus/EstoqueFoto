-- Migration: Atualizar constraint de reason na tabela exit_orders
-- Descrição: Adicionar novos motivos de saída: garantia, condicional, instalacao

-- Remover constraint antiga
ALTER TABLE exit_orders DROP CONSTRAINT IF EXISTS exit_orders_reason_check;

-- Adicionar nova constraint com todos os valores
ALTER TABLE exit_orders ADD CONSTRAINT exit_orders_reason_check
    CHECK (reason IN (
        'venda',
        'garantia',
        'condicional',
        'instalacao',
        'uso_interno',
        'perda',
        'aluguel',
        'manutencao',
        'outros'
    ));

COMMENT ON COLUMN exit_orders.reason IS 'Motivo da saída: venda, garantia, condicional, instalacao, uso_interno, perda, aluguel, manutencao, outros';
