-- Migration 015: Adicionar categoria Insumos
-- Data: 2025-10-16
-- Descrição: Adiciona categoria de Insumos para cabos, conectores e materiais diversos

-- Inserir categoria Insumos
INSERT INTO categories (name, slug, icon, description)
VALUES ('Insumos', 'insumos', '📦', 'Cabos, conectores, etc.')
ON CONFLICT (slug) DO NOTHING;

-- Verificar se foi inserida
SELECT
    id,
    name,
    slug,
    icon,
    description,
    created_at
FROM categories
WHERE slug = 'insumos';
