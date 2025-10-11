const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories - Listar todas as categorias
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT
                c.*,
                COUNT(e.id) as equipment_count,
                COALESCE(SUM(e.quantity), 0) as total_quantity,
                COALESCE(SUM(e.total_value), 0) as total_value
            FROM categories c
            LEFT JOIN equipment e ON c.id = e.category_id AND e.active = true
            GROUP BY c.id, c.name, c.slug, c.icon, c.description, c.created_at, c.updated_at
            ORDER BY c.name
        `);

        const categories = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            icon: row.icon,
            description: row.description,
            stats: {
                equipmentCount: parseInt(row.equipment_count),
                totalQuantity: parseInt(row.total_quantity),
                totalValue: parseFloat(row.total_value)
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            categories,
            total: categories.length
        });

    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/categories/:id - Buscar categoria específica
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                c.*,
                COUNT(e.id) as equipment_count,
                COALESCE(SUM(e.quantity), 0) as total_quantity,
                COALESCE(SUM(e.total_value), 0) as total_value
            FROM categories c
            LEFT JOIN equipment e ON c.id = e.category_id AND e.active = true
            WHERE c.id = $1
            GROUP BY c.id, c.name, c.slug, c.icon, c.description, c.created_at, c.updated_at
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Categoria não encontrada'
            });
        }

        const row = result.rows[0];
        const category = {
            id: row.id,
            name: row.name,
            slug: row.slug,
            icon: row.icon,
            description: row.description,
            stats: {
                equipmentCount: parseInt(row.equipment_count),
                totalQuantity: parseInt(row.total_quantity),
                totalValue: parseFloat(row.total_value)
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };

        res.json({ category });

    } catch (error) {
        console.error('Erro ao buscar categoria:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/categories - Criar nova categoria (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, slug, icon, description } = req.body;

        if (!name || !slug) {
            return res.status(400).json({
                error: 'Nome e slug são obrigatórios'
            });
        }

        // Verificar se slug já existe
        const existingCategory = await query(
            'SELECT id FROM categories WHERE slug = $1',
            [slug]
        );

        if (existingCategory.rows.length > 0) {
            return res.status(409).json({
                error: 'Slug já existe'
            });
        }

        const result = await query(`
            INSERT INTO categories (name, slug, icon, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, slug, icon || '', description || '']);

        const category = result.rows[0];

        res.status(201).json({
            message: 'Categoria criada com sucesso',
            category: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                icon: category.icon,
                description: category.description,
                createdAt: category.created_at,
                updatedAt: category.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// PUT /api/categories/:id - Atualizar categoria (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, icon, description } = req.body;

        if (!name || !slug) {
            return res.status(400).json({
                error: 'Nome e slug são obrigatórios'
            });
        }

        // Verificar se categoria existe
        const existingCategory = await query(
            'SELECT id FROM categories WHERE id = $1',
            [id]
        );

        if (existingCategory.rows.length === 0) {
            return res.status(404).json({
                error: 'Categoria não encontrada'
            });
        }

        // Verificar se slug já existe em outra categoria
        const duplicateSlug = await query(
            'SELECT id FROM categories WHERE slug = $1 AND id != $2',
            [slug, id]
        );

        if (duplicateSlug.rows.length > 0) {
            return res.status(409).json({
                error: 'Slug já existe em outra categoria'
            });
        }

        const result = await query(`
            UPDATE categories
            SET name = $1, slug = $2, icon = $3, description = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [name, slug, icon || '', description || '', id]);

        const category = result.rows[0];

        res.json({
            message: 'Categoria atualizada com sucesso',
            category: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                icon: category.icon,
                description: category.description,
                createdAt: category.created_at,
                updatedAt: category.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// DELETE /api/categories/:id - Deletar categoria (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se existem equipamentos nesta categoria
        const equipmentCount = await query(
            'SELECT COUNT(*) as count FROM equipment WHERE category_id = $1',
            [id]
        );

        if (parseInt(equipmentCount.rows[0].count) > 0) {
            return res.status(409).json({
                error: 'Não é possível deletar categoria que possui equipamentos'
            });
        }

        const result = await query(
            'DELETE FROM categories WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Categoria não encontrada'
            });
        }

        res.json({
            message: 'Categoria deletada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar categoria:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;