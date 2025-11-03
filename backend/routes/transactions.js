const express = require('express');
const { query, transaction } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions - Listar transações com filtros
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            type,
            equipmentId,
            dateFrom,
            dateTo,
            page = 1,
            limit = 50,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Filtro por tipo
        if (type) {
            paramCount++;
            whereConditions.push(`t.type = $${paramCount}`);
            queryParams.push(type);
        }

        // Filtro por equipamento
        if (equipmentId) {
            paramCount++;
            whereConditions.push(`t.equipment_id = $${paramCount}`);
            queryParams.push(equipmentId);
        }

        // Filtro por data inicial
        if (dateFrom) {
            paramCount++;
            whereConditions.push(`t.created_at >= $${paramCount}`);
            queryParams.push(new Date(dateFrom));
        }

        // Filtro por data final
        if (dateTo) {
            paramCount++;
            whereConditions.push(`t.created_at <= $${paramCount}`);
            queryParams.push(new Date(dateTo + ' 23:59:59'));
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Validar ordenação
        const validSortFields = ['created_at', 'type', 'equipment_name', 'quantity', 'total_cost'];
        const validSortOrders = ['ASC', 'DESC'];

        const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        // Paginação
        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        const transactionsQuery = `
            SELECT
                t.*,
                u.name as created_by_name,
                e.name as current_equipment_name,
                c.name as current_category_name,
                cust.razao_social as customer_razao_social,
                cust.nome_fantasia as customer_nome_fantasia
            FROM transactions t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN equipment e ON t.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN customers cust ON t.customer_id = cust.id
            ${whereClause}
            ORDER BY t.${finalSortBy} ${finalSortOrder}
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM transactions t
            ${whereClause}
        `;

        const [transactionsResult, countResult] = await Promise.all([
            query(transactionsQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2)) // Remove limit e offset do count
        ]);

        const transactions = transactionsResult.rows.map(row => ({
            id: row.id,
            type: row.type,
            equipment: {
                id: row.equipment_id,
                name: row.equipment_name,
                currentName: row.current_equipment_name // Nome atual (pode ter mudado)
            },
            category: {
                name: row.category_name,
                currentName: row.current_category_name
            },
            quantity: parseFloat(row.quantity) || 0,
            unit: row.unit,
            cost: parseFloat(row.cost) || 0,
            totalCost: parseFloat(row.total_cost) || 0,
            supplier: row.supplier,
            destination: row.destination,
            reason: row.reason,
            expiryDate: row.expiry_date,
            notes: row.notes,
            createdAt: row.created_at,
            createdBy: {
                id: row.created_by,
                name: row.created_by_name || row.user_name
            },
            userName: row.user_name,
            customer: row.customer_id ? {
                id: row.customer_id,
                razaoSocial: row.customer_razao_social,
                nomeFantasia: row.customer_nome_fantasia
            } : null
        }));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            transactions,
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
        console.error('Erro ao buscar transações:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/transactions/entry - Registrar entrada de equipamento
router.post('/entry', authenticateToken, async (req, res) => {
    try {
        const {
            equipmentId,
            quantity,
            cost = 0,
            supplier,
            expiryDate,
            notes
        } = req.body;

        if (!equipmentId || !quantity || quantity <= 0) {
            return res.status(400).json({
                error: 'ID do equipamento e quantidade são obrigatórios'
            });
        }

        const result = await transaction(async (client) => {
            // Buscar equipamento atual
            const equipmentResult = await client.query(
                'SELECT * FROM equipment WHERE id = $1 AND active = true',
                [equipmentId]
            );

            if (equipmentResult.rows.length === 0) {
                throw new Error('Equipamento não encontrado');
            }

            const equipment = equipmentResult.rows[0];
            const oldQuantity = parseFloat(equipment.quantity);
            const newQuantity = oldQuantity + parseFloat(quantity);

            // Calcular novo custo médio se custo foi informado
            let newCurrentCost = parseFloat(equipment.current_cost);
            let newAvgCost = parseFloat(equipment.avg_cost);

            console.log('📊 Cálculo de custo médio:', {
                oldQuantity,
                newQuantity,
                costInformado: cost,
                avgCostAntigo: equipment.avg_cost,
                currentCostAntigo: equipment.current_cost
            });

            if (cost > 0 && newQuantity > 0) {
                const totalOldValue = oldQuantity * parseFloat(equipment.current_cost);
                const totalNewValue = parseFloat(quantity) * parseFloat(cost);
                newCurrentCost = (totalOldValue + totalNewValue) / newQuantity;

                // Atualizar avg_cost também (média ponderada)
                const totalOldAvgValue = oldQuantity * parseFloat(equipment.avg_cost);
                newAvgCost = (totalOldAvgValue + totalNewValue) / newQuantity;

                console.log('💰 Novo custo calculado:', {
                    totalOldAvgValue,
                    totalNewValue,
                    newAvgCost,
                    newCurrentCost
                });
            }

            const newTotalValue = newQuantity * newCurrentCost;

            // Atualizar equipamento
            const updateParams = [newQuantity, newCurrentCost, newAvgCost, newTotalValue, equipmentId];
            let paramIndex = 5;
            let updateFields = `
                quantity = $1,
                current_cost = $2,
                avg_cost = $3,
                total_value = $4,
            `;

            if (expiryDate) {
                paramIndex++;
                updateFields += `expiry_date = $${paramIndex},`;
                updateParams.push(expiryDate);
            }

            if (supplier) {
                paramIndex++;
                updateFields += `supplier = $${paramIndex},`;
                updateParams.push(supplier);
            }

            updateFields += `updated_at = NOW()`;

            await client.query(`
                UPDATE equipment
                SET ${updateFields}
                WHERE id = $5
            `, updateParams);

            // Buscar categoria para o log
            const categoryResult = await client.query(
                'SELECT name FROM categories WHERE id = $1',
                [equipment.category_id]
            );

            // Registrar transação
            const transactionResult = await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    quantity, unit, cost, total_cost, supplier, expiry_date,
                    notes, created_by, user_name
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                'entrada',
                equipmentId,
                equipment.name,
                categoryResult.rows[0]?.name || '',
                quantity,
                equipment.unit,
                cost,
                parseFloat(quantity) * parseFloat(cost),
                supplier,
                expiryDate,
                notes,
                req.user.id,
                req.user.name
            ]);

            return {
                transaction: transactionResult.rows[0],
                equipment: {
                    ...equipment,
                    quantity: newQuantity,
                    current_cost: newCurrentCost,
                    total_value: newTotalValue
                }
            };
        });

        res.status(201).json({
            message: `Entrada registrada: ${quantity} ${result.equipment.unit} de ${result.equipment.name}`,
            transaction: {
                id: result.transaction.id,
                type: result.transaction.type,
                equipmentName: result.transaction.equipment_name,
                quantity: parseFloat(result.transaction.quantity),
                unit: result.transaction.unit,
                cost: parseFloat(result.transaction.cost),
                totalCost: parseFloat(result.transaction.total_cost),
                createdAt: result.transaction.created_at
            },
            equipment: {
                id: result.equipment.id,
                name: result.equipment.name,
                quantity: result.equipment.quantity,
                currentCost: result.equipment.current_cost,
                totalValue: result.equipment.total_value
            }
        });

    } catch (error) {
        console.error('Erro ao registrar entrada:', error);
        if (error.message === 'Equipamento não encontrado') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// POST /api/transactions/exit - Registrar saída de equipamento
router.post('/exit', authenticateToken, async (req, res) => {
    try {
        const {
            equipmentId,
            quantity,
            reason,
            destination,
            notes,
            customerId // Novo campo
        } = req.body;

        if (!equipmentId || !quantity || quantity <= 0 || !reason) {
            return res.status(400).json({
                error: 'ID do equipamento, quantidade e motivo são obrigatórios'
            });
        }

        const result = await transaction(async (client) => {
            // Buscar equipamento atual
            const equipmentResult = await client.query(
                'SELECT * FROM equipment WHERE id = $1 AND active = true',
                [equipmentId]
            );

            if (equipmentResult.rows.length === 0) {
                throw new Error('Equipamento não encontrado');
            }

            const equipment = equipmentResult.rows[0];
            const currentQuantity = parseFloat(equipment.quantity);

            if (parseFloat(quantity) > currentQuantity) {
                throw new Error(`Quantidade insuficiente! Disponível: ${currentQuantity} ${equipment.unit}`);
            }

            const newQuantity = currentQuantity - parseFloat(quantity);
            const newTotalValue = newQuantity * parseFloat(equipment.current_cost);

            // Atualizar equipamento
            await client.query(`
                UPDATE equipment
                SET
                    quantity = $1,
                    total_value = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [newQuantity, newTotalValue, equipmentId]);

            // Buscar categoria para o log
            const categoryResult = await client.query(
                'SELECT name FROM categories WHERE id = $1',
                [equipment.category_id]
            );

            // Registrar transação
            const transactionResult = await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    quantity, unit, cost, total_cost, reason, destination,
                    notes, created_by, user_name, customer_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                'saida',
                equipmentId,
                equipment.name,
                categoryResult.rows[0]?.name || '',
                quantity,
                equipment.unit,
                equipment.current_cost,
                parseFloat(quantity) * parseFloat(equipment.current_cost),
                reason,
                destination,
                notes,
                req.user.id,
                req.user.name,
                customerId || null
            ]);

            return {
                transaction: transactionResult.rows[0],
                equipment: {
                    ...equipment,
                    quantity: newQuantity,
                    total_value: newTotalValue
                }
            };
        });

        res.status(201).json({
            message: `Saída registrada: ${quantity} ${result.equipment.unit} de ${result.equipment.name}`,
            transaction: {
                id: result.transaction.id,
                type: result.transaction.type,
                equipmentName: result.transaction.equipment_name,
                quantity: parseFloat(result.transaction.quantity),
                unit: result.transaction.unit,
                reason: result.transaction.reason,
                destination: result.transaction.destination,
                createdAt: result.transaction.created_at
            },
            equipment: {
                id: result.equipment.id,
                name: result.equipment.name,
                quantity: result.equipment.quantity,
                totalValue: result.equipment.total_value
            }
        });

    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        if (error.message === 'Equipamento não encontrado' || error.message.includes('Quantidade insuficiente')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// GET /api/transactions/summary - Resumo de transações
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { period = '30' } = req.query; // Período em dias

        const summaryQuery = `
            SELECT
                t.type,
                COUNT(*) as count,
                COALESCE(SUM(t.total_cost), 0) as total_value
            FROM transactions t
            WHERE t.created_at >= NOW() - INTERVAL '${parseInt(period)} days'
            GROUP BY t.type
            ORDER BY t.type
        `;

        const todayQuery = `
            SELECT
                t.type,
                COUNT(*) as count
            FROM transactions t
            WHERE DATE(t.created_at) = CURRENT_DATE
            GROUP BY t.type
        `;

        const [summaryResult, todayResult] = await Promise.all([
            query(summaryQuery),
            query(todayQuery)
        ]);

        const summary = {};
        const today = {};

        summaryResult.rows.forEach(row => {
            summary[row.type] = {
                count: parseInt(row.count),
                totalValue: parseFloat(row.total_value)
            };
        });

        todayResult.rows.forEach(row => {
            today[row.type] = parseInt(row.count);
        });

        res.json({
            period: parseInt(period),
            summary,
            today
        });

    } catch (error) {
        console.error('Erro ao gerar resumo de transações:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;