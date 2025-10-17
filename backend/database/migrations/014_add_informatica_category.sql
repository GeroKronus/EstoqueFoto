-- Migration 014: Adicionar categoria Informática
-- Data: 2025-10-16
-- Descrição: Adiciona categoria de Informática para equipamentos de tecnologia

-- Inserir categoria Informática
INSERT INTO categories (name, slug, icon, description)
VALUES ('Informática', 'informatica', '💻', 'Equipamentos de informática e tecnologia')
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
WHERE slug = 'informatica';
