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
        let joinConditionalItems = false;

        // Filtro por status
        if (status) {
            if (status === 'condicional') {
                // Filtro especial: ordens com itens condicionais
                joinConditionalItems = true;
                whereConditions.push(`eo.status = 'ativa'`);
                whereConditions.push(`eoi.is_conditional = true`);
            } else {
                // Filtro normal por status (ativa/cancelada)
                paramCount++;
                whereConditions.push(`eo.status = $${paramCount}`);
                queryParams.push(status);
            }
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

        // Se filtro condicional, adicionar JOIN e DISTINCT
        const ordersQuery = `
            SELECT ${joinConditionalItems ? 'DISTINCT' : ''}
                eo.*,
                u.name as created_by_name,
                uc.name as cancelled_by_name,
                cust.razao_social as customer_razao_social,
                cust.nome_fantasia as customer_nome_fantasia
            FROM exit_orders eo
            ${joinConditionalItems ? 'INNER JOIN exit_order_items eoi ON eo.id = eoi.exit_order_id' : ''}
            LEFT JOIN users u ON eo.created_by = u.id
            LEFT JOIN users uc ON eo.cancelled_by = uc.id
            LEFT JOIN customers cust ON eo.customer_id = cust.id
            ${whereClause}
            ORDER BY eo.${finalSortBy} ${finalSortOrder}
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(${joinConditionalItems ? 'DISTINCT eo.id' : '*'}) as total
            FROM exit_orders eo
            ${joinConditionalItems ? 'INNER JOIN exit_order_items eoi ON eo.id = eoi.exit_order_id' : ''}
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
            cancellationReason: row.cancellation_reason,
            customer: row.customer_id ? {
                id: row.customer_id,
                razaoSocial: row.customer_razao_social,
                nomeFantasia: row.customer_nome_fantasia
            } : null
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

// GET /api/exit-orders/conditional/summary - Buscar ordens com itens condicionais
router.get('/conditional/summary', authenticateToken, async (req, res) => {
    try {
        const ordersQuery = `
            SELECT DISTINCT
                eo.id,
                eo.order_number,
                eo.reason,
                eo.destination,
                eo.customer_name,
                eo.status,
                eo.created_at,
                u.name as created_by_name,
                COUNT(eoi.id) FILTER (WHERE eoi.is_conditional = true) as conditional_items_count
            FROM exit_orders eo
            INNER JOIN exit_order_items eoi ON eo.id = eoi.exit_order_id
            LEFT JOIN users u ON eo.created_by = u.id
            WHERE eo.status = 'ativa' AND eoi.is_conditional = true
            GROUP BY eo.id, eo.order_number, eo.reason, eo.destination,
                     eo.customer_name, eo.status, eo.created_at, u.name
            ORDER BY eo.order_number DESC
        `;

        const result = await query(ordersQuery);

        const orders = result.rows.map(row => ({
            id: row.id,
            orderNumber: row.order_number,
            reason: row.reason,
            destination: row.destination,
            customerName: row.customer_name,
            status: row.status,
            conditionalItemsCount: parseInt(row.conditional_items_count),
            createdBy: row.created_by_name,
            createdAt: row.created_at
        }));

        res.json({
            totalOrders: orders.length,
            totalConditionalItems: orders.reduce((sum, o) => sum + o.conditionalItemsCount, 0),
            orders
        });

    } catch (error) {
        console.error('Erro ao buscar ordens com itens condicionais:', error);
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
                uc.name as cancelled_by_name,
                cust.razao_social as customer_razao_social,
                cust.nome_fantasia as customer_nome_fantasia
            FROM exit_orders eo
            LEFT JOIN users u ON eo.created_by = u.id
            LEFT JOIN users uc ON eo.cancelled_by = uc.id
            LEFT JOIN customers cust ON eo.customer_id = cust.id
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
            customer: row.customer_id ? {
                id: row.customer_id,
                razaoSocial: row.customer_razao_social,
                nomeFantasia: row.customer_nome_fantasia
            } : null,
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
                isModified: item.is_modified || false,
                isConditional: item.is_conditional || false,
                originalQuantity: item.original_quantity ? parseFloat(item.original_quantity) : null,
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
            items, // Array de { equipmentId, quantity }
            customerId // Novo campo
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
                    notes, created_by, customer_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [reason, destination, customerName, customerDocument, notes, req.user.id, customerId || null]);

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
                // Se o motivo for 'condicional', marcar todos os itens como condicionais automaticamente
                const isConditional = reason === 'condicional';

                const itemResult = await client.query(`
                    INSERT INTO exit_order_items (
                        exit_order_id, equipment_id, equipment_name,
                        quantity, unit, unit_cost, total_cost, is_conditional
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `, [
                    order.id,
                    equipmentId,
                    equipment.name,
                    quantity,
                    equipment.unit,
                    equipment.current_cost,
                    parseFloat(quantity) * parseFloat(equipment.current_cost),
                    isConditional
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

// PUT /api/exit-orders/:orderId/items/:itemId - Editar quantidade de um item da ordem
router.put('/:orderId/items/:itemId', authenticateToken, async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { newQuantity } = req.body;

        // Validações
        if (newQuantity === undefined || newQuantity === null) {
            return res.status(400).json({ error: 'Nova quantidade é obrigatória' });
        }

        if (parseFloat(newQuantity) < 0) {
            return res.status(400).json({ error: 'Quantidade não pode ser negativa' });
        }

        const result = await transaction(async (client) => {
            // Buscar ordem
            const orderResult = await client.query(
                'SELECT * FROM exit_orders WHERE id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Ordem de saída não encontrada');
            }

            const order = orderResult.rows[0];

            if (order.status !== 'ativa') {
                throw new Error('Apenas ordens ativas podem ser editadas');
            }

            // Buscar item da ordem
            const itemResult = await client.query(
                'SELECT * FROM exit_order_items WHERE id = $1 AND exit_order_id = $2',
                [itemId, orderId]
            );

            if (itemResult.rows.length === 0) {
                throw new Error('Item não encontrado nesta ordem');
            }

            const orderItem = itemResult.rows[0];
            const previousQuantity = parseFloat(orderItem.quantity);
            const newQty = parseFloat(newQuantity);
            const quantityDifference = newQty - previousQuantity;

            // Se não houve mudança, retornar
            if (quantityDifference === 0) {
                return { orderItem, modified: false };
            }

            // Buscar equipamento
            const equipmentResult = await client.query(
                'SELECT * FROM equipment WHERE id = $1',
                [orderItem.equipment_id]
            );

            if (equipmentResult.rows.length === 0) {
                throw new Error('Equipamento não encontrado');
            }

            const equipment = equipmentResult.rows[0];
            const currentStockQuantity = parseFloat(equipment.quantity);

            // Se aumentou a quantidade na ordem, verificar estoque disponível
            if (quantityDifference > 0) {
                if (quantityDifference > currentStockQuantity) {
                    throw new Error(`Quantidade insuficiente em estoque! Disponível: ${currentStockQuantity} ${equipment.unit}`);
                }
            }

            // Ajustar estoque
            // Se aumentou: diminuir do estoque
            // Se diminuiu: aumentar no estoque
            const newStockQuantity = currentStockQuantity - quantityDifference;
            const newTotalValue = newStockQuantity * parseFloat(equipment.current_cost);

            await client.query(`
                UPDATE equipment
                SET quantity = $1, total_value = $2, updated_at = NOW()
                WHERE id = $3
            `, [newStockQuantity, newTotalValue, equipment.id]);

            // Calcular novos valores do item
            const newTotalCost = newQty * parseFloat(orderItem.unit_cost);

            // Atualizar item da ordem
            // Se a quantidade original não foi salva ainda, salvar
            const originalQty = orderItem.original_quantity || previousQuantity;

            await client.query(`
                UPDATE exit_order_items
                SET
                    quantity = $1,
                    total_cost = $2,
                    is_modified = $3,
                    original_quantity = $4,
                    is_conditional = FALSE
                WHERE id = $5
            `, [newQty, newTotalCost, true, originalQty, itemId]);

            // Registrar no histórico
            let changeType;
            let changeReason;

            if (newQty === 0) {
                changeType = 'quantity_zeroed';
                changeReason = `Quantidade zerada (era ${previousQuantity} ${equipment.unit})`;
            } else if (quantityDifference > 0) {
                changeType = 'quantity_increased';
                changeReason = `Quantidade alterada de ${previousQuantity} para ${newQty} ${equipment.unit}`;
            } else {
                changeType = 'quantity_decreased';
                changeReason = `Quantidade alterada de ${previousQuantity} para ${newQty} ${equipment.unit}`;
            }

            await client.query(`
                INSERT INTO exit_order_items_history (
                    exit_order_id, exit_order_item_id, equipment_id,
                    previous_quantity, new_quantity, change_type,
                    quantity_difference, changed_by, reason
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                orderId,
                itemId,
                equipment.id,
                previousQuantity,
                newQty,
                changeType,
                quantityDifference,
                req.user.id,
                changeReason
            ]);

            // Registrar transação apropriada
            if (quantityDifference > 0) {
                // Aumentou: registrar saída adicional
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
                    equipment.id,
                    Math.abs(quantityDifference),
                    Math.abs(quantityDifference) * parseFloat(equipment.current_cost),
                    `Edição OS #${order.order_number} - ${order.reason}`,
                    order.destination,
                    `Aumento de quantidade - OS #${order.order_number}`,
                    req.user.id,
                    req.user.name
                ]);
            } else if (quantityDifference < 0) {
                // Diminuiu: registrar entrada (devolução parcial ou total se zerou)
                const transactionNote = newQty === 0
                    ? `Item zerado - OS #${order.order_number}`
                    : `Redução de quantidade - OS #${order.order_number}`;

                await client.query(`
                    INSERT INTO transactions (
                        type, equipment_id, equipment_name, category_name,
                        quantity, unit, cost, total_cost, supplier,
                        notes, created_by, user_name
                    )
                    SELECT
                        'entrada', $1, e.name, c.name,
                        $2, e.unit, e.current_cost, $3,
                        'Devolução Parcial OS',
                        $4, $5, $6
                    FROM equipment e
                    LEFT JOIN categories c ON e.category_id = c.id
                    WHERE e.id = $1
                `, [
                    equipment.id,
                    Math.abs(quantityDifference),
                    Math.abs(quantityDifference) * parseFloat(equipment.current_cost),
                    transactionNote,
                    req.user.id,
                    req.user.name
                ]);
            }

            // Buscar item atualizado
            const updatedItemResult = await client.query(
                'SELECT * FROM exit_order_items WHERE id = $1',
                [itemId]
            );

            return { orderItem: updatedItemResult.rows[0], modified: true };
        });

        res.json({
            message: result.modified ? 'Quantidade do item atualizada com sucesso' : 'Nenhuma alteração realizada',
            item: {
                id: result.orderItem.id,
                equipmentName: result.orderItem.equipment_name,
                quantity: parseFloat(result.orderItem.quantity),
                unit: result.orderItem.unit,
                totalCost: parseFloat(result.orderItem.total_cost),
                isModified: result.orderItem.is_modified,
                originalQuantity: parseFloat(result.orderItem.original_quantity)
            }
        });

    } catch (error) {
        console.error('Erro ao editar item da ordem:', error);
        res.status(400).json({ error: error.message || 'Erro ao editar item' });
    }
});

// PATCH /api/exit-orders/:orderId/items/:itemId/conditional - Marcar/desmarcar item como condicional
router.patch('/:orderId/items/:itemId/conditional', authenticateToken, async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { isConditional } = req.body;

        // Validações
        if (isConditional === undefined || isConditional === null) {
            return res.status(400).json({ error: 'Campo isConditional é obrigatório' });
        }

        const result = await transaction(async (client) => {
            // Buscar ordem
            const orderResult = await client.query(
                'SELECT * FROM exit_orders WHERE id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Ordem de saída não encontrada');
            }

            const order = orderResult.rows[0];

            if (order.status !== 'ativa') {
                throw new Error('Apenas ordens ativas podem ser editadas');
            }

            // Buscar item da ordem
            const itemResult = await client.query(
                'SELECT * FROM exit_order_items WHERE id = $1 AND exit_order_id = $2',
                [itemId, orderId]
            );

            if (itemResult.rows.length === 0) {
                throw new Error('Item não encontrado nesta ordem');
            }

            // Atualizar status condicional do item
            await client.query(`
                UPDATE exit_order_items
                SET is_conditional = $1
                WHERE id = $2
            `, [isConditional, itemId]);

            // Buscar item atualizado
            const updatedItemResult = await client.query(
                'SELECT * FROM exit_order_items WHERE id = $1',
                [itemId]
            );

            return updatedItemResult.rows[0];
        });

        res.json({
            message: isConditional ? 'Item marcado como condicional' : 'Item desmarcado como condicional',
            item: {
                id: result.id,
                equipmentName: result.equipment_name,
                isConditional: result.is_conditional
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar status condicional do item:', error);
        res.status(400).json({ error: error.message || 'Erro ao atualizar item' });
    }
});

// GET /api/exit-orders/:orderId/items/:itemId/history - Buscar histórico de alterações de um item
router.get('/:orderId/items/:itemId/history', authenticateToken, async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const historyQuery = `
            SELECT
                h.*,
                u.name as changed_by_name,
                e.name as equipment_name,
                e.unit as equipment_unit
            FROM exit_order_items_history h
            LEFT JOIN users u ON h.changed_by = u.id
            LEFT JOIN equipment e ON h.equipment_id = e.id
            WHERE h.exit_order_id = $1 AND h.exit_order_item_id = $2
            ORDER BY h.changed_at DESC
        `;

        const result = await query(historyQuery, [orderId, itemId]);

        const history = result.rows.map(row => ({
            id: row.id,
            equipmentName: row.equipment_name,
            equipmentUnit: row.equipment_unit,
            previousQuantity: parseFloat(row.previous_quantity),
            newQuantity: parseFloat(row.new_quantity),
            quantityDifference: parseFloat(row.quantity_difference),
            changeType: row.change_type,
            changedBy: {
                id: row.changed_by,
                name: row.changed_by_name
            },
            changedAt: row.changed_at,
            reason: row.reason
        }));

        res.json({ history });

    } catch (error) {
        console.error('Erro ao buscar histórico do item:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE /api/exit-orders/:orderId/items/:itemId - Excluir item da ordem
router.delete('/:orderId/items/:itemId', authenticateToken, async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const result = await transaction(async (client) => {
            // Buscar ordem
            const orderResult = await client.query(
                'SELECT * FROM exit_orders WHERE id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Ordem de saída não encontrada');
            }

            const order = orderResult.rows[0];

            if (order.status !== 'ativa') {
                throw new Error('Apenas ordens ativas podem ser editadas');
            }

            // Buscar item da ordem
            const itemResult = await client.query(
                'SELECT * FROM exit_order_items WHERE id = $1 AND exit_order_id = $2',
                [itemId, orderId]
            );

            if (itemResult.rows.length === 0) {
                throw new Error('Item não encontrado nesta ordem');
            }

            const orderItem = itemResult.rows[0];

            // Buscar equipamento
            const equipmentResult = await client.query(
                'SELECT * FROM equipment WHERE id = $1',
                [orderItem.equipment_id]
            );

            if (equipmentResult.rows.length === 0) {
                throw new Error('Equipamento não encontrado');
            }

            const equipment = equipmentResult.rows[0];

            // Devolver quantidade ao estoque
            const currentStockQuantity = parseFloat(equipment.quantity);
            const returnQuantity = parseFloat(orderItem.quantity);
            const newStockQuantity = currentStockQuantity + returnQuantity;
            const newTotalValue = newStockQuantity * parseFloat(equipment.current_cost);

            await client.query(`
                UPDATE equipment
                SET quantity = $1, total_value = $2, updated_at = NOW()
                WHERE id = $3
            `, [newStockQuantity, newTotalValue, equipment.id]);

            // Excluir item da ordem
            await client.query('DELETE FROM exit_order_items WHERE id = $1', [itemId]);

            // Registrar transação de devolução
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    quantity, unit, cost, total_cost, supplier,
                    notes, created_by, user_name
                )
                SELECT
                    'entrada', $1, e.name, c.name,
                    $2, e.unit, e.current_cost, $3,
                    'Devolução - Item Removido',
                    $4, $5, $6
                FROM equipment e
                LEFT JOIN categories c ON e.category_id = c.id
                WHERE e.id = $1
            `, [
                equipment.id,
                returnQuantity,
                returnQuantity * parseFloat(equipment.current_cost),
                `Item removido da OS #${order.order_number}`,
                req.user.id,
                req.user.name
            ]);

            return { orderItem, equipment };
        });

        res.json({
            message: `Item ${result.orderItem.equipment_name} excluído da ordem e devolvido ao estoque`,
            returnedQuantity: parseFloat(result.orderItem.quantity),
            unit: result.orderItem.unit
        });

    } catch (error) {
        console.error('Erro ao excluir item da ordem:', error);
        res.status(400).json({ error: error.message || 'Erro ao excluir item' });
    }
});

module.exports = router;
