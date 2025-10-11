const express = require('express');
const { query, transaction } = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipment - Listar equipamentos com filtros
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            category,
            search,
            stockFilter,
            page = 1,
            limit = 100,
            sortBy = 'name',
            sortOrder = 'ASC'
        } = req.query;

        let whereConditions = ['e.active = true'];
        let queryParams = [];
        let paramCount = 0;

        // Filtro por categoria
        if (category) {
            paramCount++;
            whereConditions.push(`c.slug = $${paramCount}`);
            queryParams.push(category);
        }

        // Filtro de busca por nome
        if (search) {
            paramCount++;
            whereConditions.push(`e.name ILIKE $${paramCount}`);
            queryParams.push(`%${search}%`);
        }

        // Filtro de estoque
        if (stockFilter) {
            switch (stockFilter) {
                case 'zero':
                    whereConditions.push('e.quantity = 0');
                    break;
                case 'low':
                    whereConditions.push('e.quantity > 0 AND e.quantity <= e.min_stock');
                    break;
                case 'expired':
                    whereConditions.push('e.expiry_date < CURRENT_DATE');
                    break;
            }
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Validar ordenação
        const validSortFields = ['name', 'quantity', 'current_cost', 'total_value', 'created_at'];
        const validSortOrders = ['ASC', 'DESC'];

        const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
        const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

        // Paginação
        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        const equipmentQuery = `
            SELECT
                e.*,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                CASE
                    WHEN e.quantity = 0 THEN 'zero'
                    WHEN e.quantity <= e.min_stock THEN 'low'
                    WHEN e.expiry_date < CURRENT_DATE THEN 'expired'
                    ELSE 'normal'
                END as stock_status
            FROM equipment e
            LEFT JOIN categories c ON e.category_id = c.id
            ${whereClause}
            ORDER BY e.${finalSortBy} ${finalSortOrder}
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM equipment e
            LEFT JOIN categories c ON e.category_id = c.id
            ${whereClause}
        `;

        const [equipmentResult, countResult] = await Promise.all([
            query(equipmentQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2)) // Remove limit e offset do count
        ]);

        const equipment = equipmentResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            category: {
                id: row.category_id,
                name: row.category_name,
                slug: row.category_slug,
                icon: row.category_icon
            },
            unit: row.unit,
            quantity: parseFloat(row.quantity),
            minStock: parseInt(row.min_stock),
            avgCost: parseFloat(row.avg_cost),
            currentCost: parseFloat(row.current_cost),
            totalValue: parseFloat(row.total_value),
            location: row.location,
            notes: row.notes,
            expiryDate: row.expiry_date,
            supplier: row.supplier,
            isCustom: row.is_custom,
            stockStatus: row.stock_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by
        }));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            equipment,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Erro ao buscar equipamentos:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/equipment/:id - Buscar equipamento específico
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                e.*,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                u.name as created_by_name,
                CASE
                    WHEN e.quantity = 0 THEN 'zero'
                    WHEN e.quantity <= e.min_stock THEN 'low'
                    WHEN e.expiry_date < CURRENT_DATE THEN 'expired'
                    ELSE 'normal'
                END as stock_status
            FROM equipment e
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = $1 AND e.active = true
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Equipamento não encontrado'
            });
        }

        const row = result.rows[0];
        const equipment = {
            id: row.id,
            name: row.name,
            category: {
                id: row.category_id,
                name: row.category_name,
                slug: row.category_slug,
                icon: row.category_icon
            },
            unit: row.unit,
            quantity: parseFloat(row.quantity),
            minStock: parseInt(row.min_stock),
            avgCost: parseFloat(row.avg_cost),
            currentCost: parseFloat(row.current_cost),
            totalValue: parseFloat(row.total_value),
            location: row.location,
            notes: row.notes,
            expiryDate: row.expiry_date,
            supplier: row.supplier,
            isCustom: row.is_custom,
            stockStatus: row.stock_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: {
                id: row.created_by,
                name: row.created_by_name
            }
        };

        res.json({ equipment });

    } catch (error) {
        console.error('Erro ao buscar equipamento:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/equipment - Criar novo equipamento
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            categoryId,
            unit = 'un',
            minStock = 1,
            avgCost = 0,
            location,
            notes
        } = req.body;

        if (!name || !categoryId) {
            return res.status(400).json({
                error: 'Nome e categoria são obrigatórios'
            });
        }

        // Verificar se categoria existe
        const categoryExists = await query(
            'SELECT id FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryExists.rows.length === 0) {
            return res.status(404).json({
                error: 'Categoria não encontrada'
            });
        }

        const result = await transaction(async (client) => {
            // Criar equipamento
            const equipmentResult = await client.query(`
                INSERT INTO equipment (
                    name, category_id, unit, min_stock, avg_cost, current_cost,
                    location, notes, is_custom, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $5, $6, $7, true, $8)
                RETURNING *
            `, [name, categoryId, unit, minStock, avgCost, location, notes, req.user.id]);

            const equipment = equipmentResult.rows[0];

            // Registrar transação de criação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    quantity, unit, cost, total_cost, notes, created_by, user_name
                )
                VALUES ($1, $2, $3, (SELECT name FROM categories WHERE id = $4), $5, $6, $7, $8, $9, $10, $11)
            `, [
                'criacao',
                equipment.id,
                equipment.name,
                categoryId,
                0,
                unit,
                avgCost,
                0,
                `Equipamento cadastrado no sistema. ${notes ? 'Observações: ' + notes : ''}`,
                req.user.id,
                req.user.name
            ]);

            return equipment;
        });

        res.status(201).json({
            message: 'Equipamento criado com sucesso',
            equipment: {
                id: result.id,
                name: result.name,
                categoryId: result.category_id,
                unit: result.unit,
                quantity: parseFloat(result.quantity),
                minStock: parseInt(result.min_stock),
                avgCost: parseFloat(result.avg_cost),
                currentCost: parseFloat(result.current_cost),
                totalValue: parseFloat(result.total_value),
                location: result.location,
                notes: result.notes,
                isCustom: result.is_custom,
                createdAt: result.created_at
            }
        });

    } catch (error) {
        console.error('Erro ao criar equipamento:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// PUT /api/equipment/:id - Atualizar equipamento
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            categoryId,
            unit,
            minStock,
            avgCost,
            location,
            notes
        } = req.body;

        if (!name || !categoryId) {
            return res.status(400).json({
                error: 'Nome e categoria são obrigatórios'
            });
        }

        // Verificar se equipamento existe
        const equipmentExists = await query(
            'SELECT id FROM equipment WHERE id = $1 AND active = true',
            [id]
        );

        if (equipmentExists.rows.length === 0) {
            return res.status(404).json({
                error: 'Equipamento não encontrado'
            });
        }

        // Verificar se categoria existe
        const categoryExists = await query(
            'SELECT id FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryExists.rows.length === 0) {
            return res.status(404).json({
                error: 'Categoria não encontrada'
            });
        }

        const result = await query(`
            UPDATE equipment
            SET
                name = $1,
                category_id = $2,
                unit = $3,
                min_stock = $4,
                avg_cost = $5,
                location = $6,
                notes = $7,
                updated_at = NOW()
            WHERE id = $8 AND active = true
            RETURNING *
        `, [name, categoryId, unit, minStock, avgCost, location, notes, id]);

        const equipment = result.rows[0];

        res.json({
            message: 'Equipamento atualizado com sucesso',
            equipment: {
                id: equipment.id,
                name: equipment.name,
                categoryId: equipment.category_id,
                unit: equipment.unit,
                quantity: parseFloat(equipment.quantity),
                minStock: parseInt(equipment.min_stock),
                avgCost: parseFloat(equipment.avg_cost),
                currentCost: parseFloat(equipment.current_cost),
                totalValue: parseFloat(equipment.total_value),
                location: equipment.location,
                notes: equipment.notes,
                updatedAt: equipment.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar equipamento:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// DELETE /api/equipment/:id - Deletar equipamento (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await transaction(async (client) => {
            // Buscar informações do equipamento
            const equipmentResult = await client.query(
                'SELECT * FROM equipment WHERE id = $1 AND active = true',
                [id]
            );

            if (equipmentResult.rows.length === 0) {
                throw new Error('Equipamento não encontrado');
            }

            const equipment = equipmentResult.rows[0];

            // Verificar se há movimentações
            const transactionsCount = await client.query(
                'SELECT COUNT(*) as count FROM transactions WHERE equipment_id = $1',
                [id]
            );

            const hasTransactions = parseInt(transactionsCount.rows[0].count) > 0;

            // Marcar como inativo
            await client.query(
                'UPDATE equipment SET active = false, updated_at = NOW() WHERE id = $1',
                [id]
            );

            // Registrar transação de exclusão
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    quantity, unit, notes, created_by, user_name
                )
                VALUES ($1, $2, $3, (SELECT name FROM categories WHERE id = $4), $5, $6, $7, $8, $9)
            `, [
                'produto_excluido',
                equipment.id,
                equipment.name,
                equipment.category_id,
                equipment.quantity,
                equipment.unit,
                `Equipamento "${equipment.name}" foi excluído do sistema. ${equipment.quantity > 0 ? `Tinha ${equipment.quantity} ${equipment.unit} em estoque.` : ''} ${hasTransactions ? 'Possuía histórico de movimentações.' : ''}`,
                req.user.id,
                req.user.name
            ]);

            return equipment;
        });

        res.json({
            message: `Equipamento "${result.name}" foi excluído com sucesso`
        });

    } catch (error) {
        console.error('Erro ao deletar equipamento:', error);
        if (error.message === 'Equipamento não encontrado') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

module.exports = router;