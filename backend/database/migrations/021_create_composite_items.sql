-- Migration 021: Criar sistema de Itens Compostos (Kits)
-- Data: 2025-10-28
-- Descrição: Permite criar itens compostos formados por múltiplos itens do estoque
--            Ao dar saída de um item composto, todos os componentes são baixados automaticamente

-- 1. Tabela de Itens Compostos
CREATE TABLE IF NOT EXISTS composite_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Componentes dos Itens Compostos
CREATE TABLE IF NOT EXISTS composite_item_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    composite_item_id UUID NOT NULL REFERENCES composite_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(composite_item_id, equipment_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_composite_items_active ON composite_items(active);
CREATE INDEX IF NOT EXISTS idx_composite_items_category ON composite_items(category_id);
CREATE INDEX IF NOT EXISTS idx_composite_item_components_composite ON composite_item_components(composite_item_id);
CREATE INDEX IF NOT EXISTS idx_composite_item_components_equipment ON composite_item_components(equipment_id);

-- 4. Comentários nas tabelas
COMMENT ON TABLE composite_items IS 'Itens compostos/kits formados por múltiplos equipamentos';
COMMENT ON TABLE composite_item_components IS 'Componentes que formam cada item composto';
COMMENT ON COLUMN composite_items.name IS 'Nome do item composto (ex: "Kit Iluminação Completo")';
COMMENT ON COLUMN composite_item_components.quantity IS 'Quantidade deste equipamento necessária para formar 1 unidade do item composto';
