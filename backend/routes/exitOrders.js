const express = require('express');
const { query, transaction } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/exit-orders - Listar ordens de saída
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            status,
            dateFrom,
            dateTo,
            page = 1,
            limit = 50,
            sortBy = 'order_number',
            sortOrder = 'DESC'
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Filtro por status
        if (status) {
            paramCount++;
            whereConditions.push(`eo.status = $${paramCount}`);
            queryParams.push(status);
        }

        // Filtro por data inicial
        if (dateFrom) {
            paramCount++;
            whereConditions.push(`eo.created_at >= $${paramCount}`);
            queryParams.push(new Date(dateFrom));
        }

        // Filtro por data final
        if (dateTo) {
            paramCount++;
            whereConditions.push(`eo.created_at <= $${paramCount}`);
            queryParams.push(new Date(dateTo + ' 23:59:59'));
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Validar ordenação
        const validSortFields = ['order_number', 'created_at', 'total_value', 'total_items'];
        const validSortOrders = ['ASC', 'DESC'];

        const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'order_number';
        const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        // Paginação
        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        const ordersQuery = `
            SELECT
                eo.*,
                u.name as created_by_name,
                uc.name as cancelled_by_name
            FROM exit_orders eo
            LEFT JOIN users u ON eo.created_by = u.id
            LEFT JOIN users uc ON eo.cancelled_by = uc.id
            ${whereClause}
            ORDER BY eo.${finalSortBy} ${finalSortOrder}
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM exit_orders eo
            ${whereClause}
        `;

        const [ordersResult, countResult] = await Promise.all([
            query(ordersQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2))
        ]);

        const orders = ordersResult.rows.map(row => ({
            id: row.id,
            orderNumber: row.order_number,
            reason: row.reason,
            destination: row.destination,
            customerName: row.customer_name,
            customerDocument: row.customer_document,
            notes: row.notes,
            status: row.status,
            totalItems: parseInt(row.total_items),
            totalValue: parseFloat(row.total_value) || 0,
            createdBy: {
                id: row.created_by,
                name: row.created_by_name
            },
            createdAt: row.created_at,
            cancelledAt: row.cancelled_at,
            cancelledBy: row.cancelled_by ? {
                id: row.cancelled_by,
                name: row.cancelled_by_name
            } : null,
            cancellationReason: row.cancellation_reason
        }));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            orders,
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
        console.error('Erro ao buscar ordens de saída:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/exit-orders/:id - Buscar ordem específica com itens
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const orderQuery = `
            SELECT
                eo.*,
                u.name as created_by_name,
                uc.name as cancelled_by_name
            FROM exit_orders eo
            LEFT JOIN users u ON eo.created_by = u.id
            LEFT JOIN users uc ON eo.cancelled_by = uc.id
            WHERE eo.id = $1
        `;

        const itemsQuery = `
            SELECT
                eoi.*,
                e.name as current_equipment_name,
                c.name as category_name
            FROM exit_order_items eoi
            LEFT JOIN equipment e ON eoi.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE eoi.exit_order_id = $1
            ORDER BY eoi.equipment_name
        `;

        const [orderResult, itemsResult] = await Promise.all([
            query(orderQuery, [id]),
            query(itemsQuery, [id])
        ]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordem de saída não encontrada' });
        }

        const row = orderResult.rows[0];
        const order = {
            id: row.id,
            orderNumber: row.order_number,
            reason: row.reason,
            destination: row.destination,
            customerName: row.customer_name,
            customerDocument: row.customer_document,
            notes: row.notes,
            status: row.status,
            totalItems: parseInt(row.total_items),
            totalValue: parseFloat(row.total_value) || 0,
            createdBy: {
                id: row.created_by,
                name: row.created_by_name
            },
            createdAt: row.created_at,
            cancelledAt: row.cancelled_at,
            cancelledBy: row.cancelled_by ? {
                id: row.cancelled_by,
                name: row.cancelled_by_name
            } : null,
            cancellationReason: row.cancellation_reason,
            items: itemsResult.rows.map(item => ({
                id: item.id,
                equipmentId: item.equipment_id,
                equipmentName: item.equipment_name,
                currentEquipmentName: item.current_equipment_name,
                categoryName: item.category_name,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitCost: parseFloat(item.unit_cost),
                totalCost: parseFloat(item.total_cost),
                createdAt: item.created_at
            }))
        };

        res.json({ order });

    } catch (error) {
        console.error('Erro ao buscar ordem de saída:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/exit-orders - Criar nova ordem de saída
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            reason,
            destination,
            customerName,
            customerDocument,
            notes,
            items // Array de { equipmentId, quantity }
        } = req.body;

        // Validações
        if (!reason || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Motivo e pelo menos um item são obrigatórios'
            });
        }

        const result = await transaction(async (client) => {
            // Criar ordem de saída
            const orderResult = await client.query(`
                INSERT INTO exit_orders (
                    reason, destination, customer_name, customer_document,
                    notes, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [reason, destination, customerName, customerDocument, notes, req.user.id]);

            const order = orderResult.rows[0];

            // Processar cada item
            const processedItems = [];
            for (const item of items) {
                const { equipmentId, quantity } = item;

                if (!equipmentId || !quantity || quantity <= 0) {
                    throw new Error('Equipamento e quantidade válida são obrigatórios para cada item');
                }

                // Buscar equipamento
                const equipmentResult = await client.query(
                    'SELECT * FROM equipment WHERE id = $1 AND active = true',
                    [equipmentId]
                );

                if (equipmentResult.rows.length === 0) {
                    throw new Error(`Equipamento não encontrado: ${equipmentId}`);
                }

                const equipment = equipmentResult.rows[0];
                const currentQuantity = parseFloat(equipment.quantity);

                if (parseFloat(quantity) > currentQuantity) {
                    throw new Error(`Quantidade insuficiente de ${equipment.name}! Disponível: ${currentQuantity} ${equipment.unit}`);
                }

                // Atualizar estoque do equipamento
                const newQuantity = currentQuantity - parseFloat(quantity);
                const newTotalValue = newQuantity * parseFloat(equipment.current_cost);

                await client.query(`
                    UPDATE equipment
                    SET quantity = $1, total_value = $2, updated_at = NOW()
                    WHERE id = $3
                `, [newQuantity, newTotalValue, equipmentId]);

                // Adicionar item à ordem
                const itemResult = await client.query(`
                    INSERT INTO exit_order_items (
                        exit_order_id, equipment_id, equipment_name,
                        quantity, unit, unit_cost, total_cost
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `, [
                    order.id,
                    equipmentId,
                    equipment.name,
                    quantity,
                    equipment.unit,
                    equipment.current_cost,
                    parseFloat(quantity) * parseFloat(equipment.current_cost)
                ]);

                // Registrar na tabela de transações
                await client.query(`
                    INSERT INTO transactions (
                        type, equipment_id, equipment_name, category_name,
                        quantity, unit, cost, total_cost, reason, destination,
                        notes, created_by, user_name
                    )
                    SELECT
                        'saida', $1, e.name, c.name,
                        $2, e.unit, e.current_cost, $3,
                        $4, $5, $6, $7, $8
                    FROM equipment e
                    LEFT JOIN categories c ON e.category_id = c.id
                    WHERE e.id = $1
                `, [
                    equipmentId,
                    quantity,
                    parseFloat(quantity) * parseFloat(equipment.current_cost),
                    `Ordem #${order.order_number} - ${reason}`,
                    destination,
                    `OS #${order.order_number}${notes ? ' - ' + notes : ''}`,
                    req.user.id,
                    req.user.name
                ]);

                processedItems.push(itemResult.rows[0]);
            }

            return { order, items: processedItems };
        });

        res.status(201).json({
            message: `Ordem de saída #${result.order.order_number} criada com sucesso`,
            order: {
                id: result.order.id,
                orderNumber: result.order.order_number,
                reason: result.order.reason,
                destination: result.order.destination,
                totalItems: result.items.length,
                totalValue: result.items.reduce((sum, item) => sum + parseFloat(item.total_cost), 0),
                createdAt: result.order.created_at
            }
        });

    } catch (error) {
        console.error('Erro ao criar ordem de saída:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar ordem de saída' });
    }
});

// POST /api/exit-orders/:id/cancel - Cancelar ordem de saída
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;

        const result = await transaction(async (client) => {
            // Buscar ordem
            const orderResult = await client.query(
                'SELECT * FROM exit_orders WHERE id = $1',
                [id]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Ordem de saída não encontrada');
            }

            const order = orderResult.rows[0];

            if (order.status === 'cancelada') {
                throw new Error('Ordem já está cancelada');
            }

            // Buscar itens da ordem
            const itemsResult = await client.query(
                'SELECT * FROM exit_order_items WHERE exit_order_id = $1',
                [id]
            );

            // Devolver itens ao estoque
            for (const item of itemsResult.rows) {
                // Buscar equipamento atual
                const equipmentResult = await client.query(
                    'SELECT * FROM equipment WHERE id = $1',
                    [item.equipment_id]
                );

                if (equipmentResult.rows.length > 0) {
                    const equipment = equipmentResult.rows[0];
                    const currentQuantity = parseFloat(equipment.quantity);
                    const returnQuantity = parseFloat(item.quantity);
                    const newQuantity = currentQuantity + returnQuantity;
                    const newTotalValue = newQuantity * parseFloat(equipment.current_cost);

                    // Atualizar estoque
                    await client.query(`
                        UPDATE equipment
                        SET quantity = $1, total_value = $2, updated_at = NOW()
                        WHERE id = $3
                    `, [newQuantity, newTotalValue, item.equipment_id]);

                    // Registrar entrada de devolução
                    await client.query(`
                        INSERT INTO transactions (
                            type, equipment_id, equipment_name, category_name,
                            quantity, unit, cost, total_cost, supplier,
                            notes, created_by, user_name
                        )
                        SELECT
                            'entrada', $1, e.name, c.name,
                            $2, e.unit, e.current_cost, $3,
                            'Devolução OS',
                            $4, $5, $6
                        FROM equipment e
                        LEFT JOIN categories c ON e.category_id = c.id
                        WHERE e.id = $1
                    `, [
                        item.equipment_id,
                        returnQuantity,
                        returnQuantity * parseFloat(equipment.current_cost),
                        `Cancelamento OS #${order.order_number}${cancellationReason ? ' - ' + cancellationReason : ''}`,
                        req.user.id,
                        req.user.name
                    ]);
                }
            }

            // Marcar ordem como cancelada
            const cancelResult = await client.query(`
                UPDATE exit_orders
                SET
                    status = 'cancelada',
                    cancelled_at = NOW(),
                    cancelled_by = $1,
                    cancellation_reason = $2
                WHERE id = $3
                RETURNING *
            `, [req.user.id, cancellationReason, id]);

            return cancelResult.rows[0];
        });

        res.json({
            message: `Ordem de saída #${result.order_number} cancelada com sucesso`,
            order: {
                id: result.id,
                orderNumber: result.order_number,
                status: result.status,
                cancelledAt: result.cancelled_at,
                cancellationReason: result.cancellation_reason
            }
        });

    } catch (error) {
        console.error('Erro ao cancelar ordem de saída:', error);
        res.status(400).json({ error: error.message || 'Erro ao cancelar ordem de saída' });
    }
});

module.exports = router;
