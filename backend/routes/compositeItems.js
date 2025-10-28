const express = require('express');
const { query, transaction } = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/composite-items - Listar todos os itens compostos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { active } = req.query;

        let whereClause = '';
        const params = [];

        if (active !== undefined) {
            whereClause = 'WHERE ci.active = $1';
            params.push(active === 'true');
        }

        const result = await query(`
            SELECT
                ci.id,
                ci.name,
                ci.description,
                ci.category_id,
                c.name as category_name,
                ci.active,
                ci.created_at,
                ci.updated_at,
                u.name as created_by_name,
                COUNT(cic.id) as component_count
            FROM composite_items ci
            LEFT JOIN categories c ON ci.category_id = c.id
            LEFT JOIN users u ON ci.created_by = u.id
            LEFT JOIN composite_item_components cic ON ci.id = cic.composite_item_id
            ${whereClause}
            GROUP BY ci.id, c.name, u.name
            ORDER BY ci.name ASC
        `, params);

        res.json({
            compositeItems: result.rows
        });

    } catch (error) {
        console.error('Erro ao listar itens compostos:', error);
        res.status(500).json({ error: 'Erro ao listar itens compostos' });
    }
});

// GET /api/composite-items/:id - Buscar item composto específico com componentes
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const itemResult = await query(`
            SELECT
                ci.id,
                ci.name,
                ci.description,
                ci.category_id,
                c.name as category_name,
                ci.active,
                ci.created_at,
                ci.updated_at,
                u.name as created_by_name
            FROM composite_items ci
            LEFT JOIN categories c ON ci.category_id = c.id
            LEFT JOIN users u ON ci.created_by = u.id
            WHERE ci.id = $1
        `, [id]);

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item composto não encontrado' });
        }

        const componentsResult = await query(`
            SELECT
                cic.id,
                cic.equipment_id,
                e.name as equipment_name,
                cic.quantity,
                e.unit,
                e.quantity as available_quantity,
                e.current_cost
            FROM composite_item_components cic
            JOIN equipment e ON cic.equipment_id = e.id
            WHERE cic.composite_item_id = $1
            ORDER BY e.name ASC
        `, [id]);

        const compositeItem = itemResult.rows[0];
        compositeItem.components = componentsResult.rows;

        res.json({ compositeItem });

    } catch (error) {
        console.error('Erro ao buscar item composto:', error);
        res.status(500).json({ error: 'Erro ao buscar item composto' });
    }
});

// POST /api/composite-items - Criar novo item composto (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, categoryId, components } = req.body;

        // Validações
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        if (!components || components.length === 0) {
            return res.status(400).json({ error: 'É necessário adicionar pelo menos um componente' });
        }

        const result = await transaction(async (client) => {
            // Verificar se já existe item com mesmo nome
            const existingResult = await client.query(
                'SELECT id FROM composite_items WHERE LOWER(name) = LOWER($1)',
                [name.trim()]
            );

            if (existingResult.rows.length > 0) {
                throw new Error('Já existe um item composto com este nome');
            }

            // Criar item composto
            const itemResult = await client.query(`
                INSERT INTO composite_items (name, description, category_id, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [name.trim(), description || null, categoryId || null, req.user.id]);

            const compositeItem = itemResult.rows[0];

            // Adicionar componentes
            for (const component of components) {
                if (!component.equipmentId || !component.quantity || component.quantity <= 0) {
                    throw new Error('Dados inválidos de componente');
                }

                // Verificar se equipamento existe
                const equipmentResult = await client.query(
                    'SELECT id, name FROM equipment WHERE id = $1 AND active = true',
                    [component.equipmentId]
                );

                if (equipmentResult.rows.length === 0) {
                    throw new Error(`Equipamento não encontrado ou inativo`);
                }

                await client.query(`
                    INSERT INTO composite_item_components (composite_item_id, equipment_id, quantity)
                    VALUES ($1, $2, $3)
                `, [compositeItem.id, component.equipmentId, component.quantity]);
            }

            // Registrar transação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'criacao',
                `Item composto "${name}" criado com ${components.length} componente(s)`,
                req.user.id,
                req.user.name
            ]);

            return compositeItem;
        });

        console.log(`[ADMIN] Item composto "${name}" criado por ${req.user.name}`);

        res.status(201).json({
            message: 'Item composto criado com sucesso',
            compositeItem: result
        });

    } catch (error) {
        console.error('Erro ao criar item composto:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar item composto' });
    }
});

// PUT /api/composite-items/:id - Atualizar item composto (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, categoryId, components, active } = req.body;

        const result = await transaction(async (client) => {
            // Verificar se item existe
            const existingResult = await client.query(
                'SELECT * FROM composite_items WHERE id = $1',
                [id]
            );

            if (existingResult.rows.length === 0) {
                throw new Error('Item composto não encontrado');
            }

            const oldItem = existingResult.rows[0];

            // Verificar nome duplicado (exceto o próprio item)
            if (name && name.trim() !== oldItem.name) {
                const duplicateResult = await client.query(
                    'SELECT id FROM composite_items WHERE LOWER(name) = LOWER($1) AND id != $2',
                    [name.trim(), id]
                );

                if (duplicateResult.rows.length > 0) {
                    throw new Error('Já existe um item composto com este nome');
                }
            }

            // Atualizar item composto
            const updateResult = await client.query(`
                UPDATE composite_items
                SET
                    name = COALESCE($1, name),
                    description = COALESCE($2, description),
                    category_id = COALESCE($3, category_id),
                    active = COALESCE($4, active),
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `, [
                name ? name.trim() : null,
                description !== undefined ? description : null,
                categoryId !== undefined ? categoryId : null,
                active !== undefined ? active : null,
                id
            ]);

            // Se forneceu novos componentes, substituir todos
            if (components && Array.isArray(components)) {
                // Deletar componentes antigos
                await client.query(
                    'DELETE FROM composite_item_components WHERE composite_item_id = $1',
                    [id]
                );

                // Adicionar novos componentes
                for (const component of components) {
                    if (!component.equipmentId || !component.quantity || component.quantity <= 0) {
                        throw new Error('Dados inválidos de componente');
                    }

                    const equipmentResult = await client.query(
                        'SELECT id FROM equipment WHERE id = $1 AND active = true',
                        [component.equipmentId]
                    );

                    if (equipmentResult.rows.length === 0) {
                        throw new Error(`Equipamento não encontrado ou inativo`);
                    }

                    await client.query(`
                        INSERT INTO composite_item_components (composite_item_id, equipment_id, quantity)
                        VALUES ($1, $2, $3)
                    `, [id, component.equipmentId, component.quantity]);
                }
            }

            return updateResult.rows[0];
        });

        console.log(`[ADMIN] Item composto "${result.name}" atualizado por ${req.user.name}`);

        res.json({
            message: 'Item composto atualizado com sucesso',
            compositeItem: result
        });

    } catch (error) {
        console.error('Erro ao atualizar item composto:', error);
        res.status(400).json({ error: error.message || 'Erro ao atualizar item composto' });
    }
});

// DELETE /api/composite-items/:id - Excluir item composto (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await transaction(async (client) => {
            // Verificar se item existe
            const itemResult = await client.query(
                'SELECT * FROM composite_items WHERE id = $1',
                [id]
            );

            if (itemResult.rows.length === 0) {
                throw new Error('Item composto não encontrado');
            }

            const item = itemResult.rows[0];

            // Deletar componentes (CASCADE já faz isso, mas vamos explicitar)
            await client.query(
                'DELETE FROM composite_item_components WHERE composite_item_id = $1',
                [id]
            );

            // Deletar item composto
            await client.query('DELETE FROM composite_items WHERE id = $1', [id]);

            // Registrar transação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'produto_excluido',
                `Item composto "${item.name}" foi excluído`,
                req.user.id,
                req.user.name
            ]);

            return item;
        });

        console.log(`[ADMIN] Item composto "${result.name}" excluído por ${req.user.name}`);

        res.json({
            message: `Item composto "${result.name}" excluído com sucesso`
        });

    } catch (error) {
        console.error('Erro ao excluir item composto:', error);
        res.status(400).json({ error: error.message || 'Erro ao excluir item composto' });
    }
});

// GET /api/composite-items/:id/availability - Verificar disponibilidade (quantos kits podem ser montados)
router.get('/:id/availability', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                ci.name as composite_name,
                cic.equipment_id,
                e.name as equipment_name,
                cic.quantity as required_quantity,
                e.quantity as available_quantity,
                e.unit,
                FLOOR(e.quantity / cic.quantity) as possible_kits
            FROM composite_items ci
            JOIN composite_item_components cic ON ci.id = cic.composite_item_id
            JOIN equipment e ON cic.equipment_id = e.id
            WHERE ci.id = $1
            ORDER BY possible_kits ASC
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item composto não encontrado ou sem componentes' });
        }

        // O número máximo de kits que podem ser montados é limitado pelo componente com menor disponibilidade
        const maxKits = Math.min(...result.rows.map(row => row.possible_kits));

        res.json({
            compositeName: result.rows[0].composite_name,
            maxAvailableKits: maxKits,
            components: result.rows
        });

    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
    }
});

module.exports = router;
