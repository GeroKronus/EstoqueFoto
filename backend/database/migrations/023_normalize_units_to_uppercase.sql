-- Migration 023: Normalizar unidades para MAIÚSCULAS
-- Data: 2025-10-28
-- Descrição: Converter todos os valores de unit para maiúsculas em todas as tabelas

-- Atualizar equipment
UPDATE equipment
SET unit = UPPER(unit);

-- Atualizar transactions
UPDATE transactions
SET unit = UPPER(unit);

-- Atualizar exit_order_items
UPDATE exit_order_items
SET unit = UPPER(unit);

-- Atualizar composite_item_components (se houver campo unit)
-- Nota: composite_item_components usa equipment.unit, então não precisa atualizar

-- Criar índice para melhorar performance de buscas por unidade
CREATE INDEX IF NOT EXISTS idx_equipment_unit ON equipment(unit);
CREATE INDEX IF NOT EXISTS idx_transactions_unit ON transactions(unit);
