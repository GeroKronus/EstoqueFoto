const express = require('express');
const { query, transaction } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Função auxiliar para gerar número de OS (formato: OS-2025-0001)
async function generateOSNumber() {
    const year = new Date().getFullYear();
    const result = await query(
        "SELECT nextval('service_orders_number_seq') as next_number"
    );
    const number = result.rows[0].next_number;
    return `OS-${year}-${String(number).padStart(4, '0')}`;
}

// GET /api/service-orders - Listar ordens de serviço
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            status,
            customer_id,
            tecnico_id,
            date_from,
            date_to,
            search,
            page = 1,
            limit = 50
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            whereConditions.push(`so.status = $${paramCount}`);
            queryParams.push(status);
        }

        if (customer_id) {
            paramCount++;
            whereConditions.push(`so.customer_id = $${paramCount}`);
            queryParams.push(customer_id);
        }

        if (tecnico_id) {
            paramCount++;
            whereConditions.push(`so.tecnico_responsavel_id = $${paramCount}`);
            queryParams.push(tecnico_id);
        }

        if (date_from) {
            paramCount++;
            whereConditions.push(`so.data_entrada >= $${paramCount}`);
            queryParams.push(new Date(date_from));
        }

        if (date_to) {
            paramCount++;
            whereConditions.push(`so.data_entrada <= $${paramCount}`);
            queryParams.push(new Date(date_to + ' 23:59:59'));
        }

        // Busca por texto livre em múltiplos campos
        if (search && search.trim()) {
            paramCount++;
            const searchPattern = `%${search.trim()}%`;
            whereConditions.push(`(
                so.numero_os ILIKE $${paramCount} OR
                COALESCE(c.razao_social, '') ILIKE $${paramCount} OR
                COALESCE(c.nome_fantasia, '') ILIKE $${paramCount} OR
                COALESCE(so.defeito_relatado, '') ILIKE $${paramCount} OR
                COALESCE(so.defeito_constatado, '') ILIKE $${paramCount} OR
                COALESCE(so.equipamento_marca, '') ILIKE $${paramCount} OR
                COALESCE(so.equipamento_modelo, '') ILIKE $${paramCount} OR
                COALESCE(so.equipamento_serial, '') ILIKE $${paramCount}
            )`);
            queryParams.push(searchPattern);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        const ordersQuery = `
            SELECT
                so.*,
                c.razao_social as customer_razao_social,
                c.nome_fantasia as customer_nome_fantasia,
                c.telefone as customer_telefone,
                t.name as tecnico_name,
                r.name as recebido_por_name,
                e.name as entregue_por_name,
                cb.name as created_by_name
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            LEFT JOIN users t ON so.tecnico_responsavel_id = t.id
            LEFT JOIN users r ON so.recebido_por_id = r.id
            LEFT JOIN users e ON so.entregue_por_id = e.id
            LEFT JOIN users cb ON so.created_by = cb.id
            ${whereClause}
            ORDER BY so.data_entrada DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            ${whereClause}
        `;

        const [ordersResult, countResult] = await Promise.all([
            query(ordersQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2))
        ]);

        const orders = ordersResult.rows.map(row => ({
            id: row.id,
            numeroOS: row.numero_os,
            customer: row.customer_id ? {
                id: row.customer_id,
                razaoSocial: row.customer_razao_social,
                nomeFantasia: row.customer_nome_fantasia,
                telefone: row.customer_telefone
            } : null,
            status: row.status,
            equipamento: {
                marca: row.equipamento_marca,
                modelo: row.equipamento_modelo,
                serial: row.equipamento_serial
            },
            defeitoRelatado: row.defeito_relatado,
            defeitoConstatado: row.defeito_constatado,
            acessorios: row.acessorios,
            tecnicoResponsavel: row.tecnico_responsavel_id ? {
                id: row.tecnico_responsavel_id,
                name: row.tecnico_name
            } : null,
            recebidoPor: row.recebido_por_id ? {
                id: row.recebido_por_id,
                name: row.recebido_por_name
            } : null,
            entreguePor: row.entregue_por_id ? {
                id: row.entregue_por_id,
                name: row.entregue_por_name
            } : null,
            valorOrcado: parseFloat(row.valor_orcado) || 0,
            valorFinal: parseFloat(row.valor_final) || 0,
            prazoEstimado: row.prazo_estimado,
            dataEntrada: row.data_entrada,
            dataOrcamento: row.data_orcamento,
            dataAprovacao: row.data_aprovacao,
            dataConclusao: row.data_conclusao,
            dataEntrega: row.data_entrega,
            garantiaDias: row.garantia_dias,
            observacoes: row.observacoes,
            fotosEntrada: row.fotos_entrada,
            createdAt: row.created_at,
            createdBy: row.created_by ? {
                id: row.created_by,
                name: row.created_by_name
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
        console.error('Erro ao listar ordens de serviço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/service-orders/:id - Obter uma ordem de serviço específica
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const orderResult = await query(`
            SELECT
                so.*,
                c.razao_social as customer_razao_social,
                c.nome_fantasia as customer_nome_fantasia,
                c.telefone as customer_telefone,
                c.email as customer_email,
                c.endereco as customer_endereco,
                t.name as tecnico_name,
                r.name as recebido_por_name,
                e.name as entregue_por_name,
                cb.name as created_by_name
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            LEFT JOIN users t ON so.tecnico_responsavel_id = t.id
            LEFT JOIN users r ON so.recebido_por_id = r.id
            LEFT JOIN users e ON so.entregue_por_id = e.id
            LEFT JOIN users cb ON so.created_by = cb.id
            WHERE so.id = $1
        `, [id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
        }

        const row = orderResult.rows[0];

        // Buscar itens (peças) da OS
        const itemsResult = await query(`
            SELECT
                soi.*,
                e.name as equipment_name,
                e.unit as equipment_unit,
                cb.name as created_by_name
            FROM service_order_items soi
            LEFT JOIN equipment e ON soi.equipment_id = e.id
            LEFT JOIN users cb ON soi.created_by = cb.id
            WHERE soi.service_order_id = $1
            ORDER BY soi.created_at
        `, [id]);

        // Buscar histórico
        const historyResult = await query(`
            SELECT *
            FROM service_order_history
            WHERE service_order_id = $1
            ORDER BY created_at DESC
        `, [id]);

        // Buscar pagamentos
        const paymentsResult = await query(`
            SELECT
                sop.*,
                u.name as created_by_name
            FROM service_order_payments sop
            LEFT JOIN users u ON sop.created_by = u.id
            WHERE sop.service_order_id = $1
            ORDER BY sop.data_pagamento
        `, [id]);

        const order = {
            id: row.id,
            numeroOS: row.numero_os,
            customer: row.customer_id ? {
                id: row.customer_id,
                razaoSocial: row.customer_razao_social,
                nomeFantasia: row.customer_nome_fantasia,
                telefone: row.customer_telefone,
                email: row.customer_email,
                endereco: row.customer_endereco
            } : null,
            status: row.status,
            equipamento: {
                marca: row.equipamento_marca,
                modelo: row.equipamento_modelo,
                serial: row.equipamento_serial
            },
            defeitoRelatado: row.defeito_relatado,
            defeitoConstatado: row.defeito_constatado,
            acessorios: row.acessorios,
            tecnicoResponsavel: row.tecnico_responsavel_id ? {
                id: row.tecnico_responsavel_id,
                name: row.tecnico_name
            } : null,
            recebidoPor: row.recebido_por_id ? {
                id: row.recebido_por_id,
                name: row.recebido_por_name
            } : null,
            entreguePor: row.entregue_por_id ? {
                id: row.entregue_por_id,
                name: row.entregue_por_name
            } : null,
            valorOrcado: parseFloat(row.valor_orcado) || 0,
            valorFinal: parseFloat(row.valor_final) || 0,
            prazoEstimado: row.prazo_estimado,
            dataEntrada: row.data_entrada,
            dataOrcamento: row.data_orcamento,
            dataAprovacao: row.data_aprovacao,
            dataConclusao: row.data_conclusao,
            dataEntrega: row.data_entrega,
            garantiaDias: row.garantia_dias,
            observacoes: row.observacoes,
            fotosEntrada: row.fotos_entrada,
            items: itemsResult.rows.map(item => ({
                id: item.id,
                equipmentId: item.equipment_id,
                descricao: item.descricao,
                equipmentName: item.equipment_name,
                quantidade: parseFloat(item.quantidade),
                unit: item.equipment_unit,
                valorUnitario: parseFloat(item.valor_unitario),
                valorTotal: parseFloat(item.valor_total),
                createdAt: item.created_at,
                createdBy: item.created_by ? {
                    id: item.created_by,
                    name: item.created_by_name
                } : null
            })),
            history: historyResult.rows.map(h => ({
                id: h.id,
                userId: h.user_id,
                userName: h.user_name,
                action: h.action,
                oldValue: h.old_value,
                newValue: h.new_value,
                details: h.details,
                createdAt: h.created_at
            })),
            payments: paymentsResult.rows.map(p => ({
                id: p.id,
                valor: parseFloat(p.valor),
                formaPagamento: p.forma_pagamento,
                dataPagamento: p.data_pagamento,
                observacoes: p.observacoes,
                createdAt: p.created_at,
                createdBy: p.created_by ? {
                    id: p.created_by,
                    name: p.created_by_name
                } : null
            })),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by ? {
                id: row.created_by,
                name: row.created_by_name
            } : null
        };

        res.json({ order });

    } catch (error) {
        console.error('Erro ao buscar ordem de serviço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/service-orders - Criar nova ordem de serviço
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            customer_id,
            equipamento_marca,
            equipamento_modelo,
            equipamento_serial,
            defeito_relatado,
            acessorios,
            observacoes,
            fotos_entrada
        } = req.body;

        if (!defeito_relatado) {
            return res.status(400).json({ error: 'Defeito relatado é obrigatório' });
        }

        const result = await transaction(async (client) => {
            // Gerar número de OS
            const numeroOS = await generateOSNumber();

            // Criar ordem de serviço
            const orderResult = await client.query(`
                INSERT INTO service_orders (
                    numero_os,
                    customer_id,
                    equipamento_marca,
                    equipamento_modelo,
                    equipamento_serial,
                    defeito_relatado,
                    acessorios,
                    observacoes,
                    fotos_entrada,
                    recebido_por_id,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                numeroOS,
                customer_id || null,
                equipamento_marca,
                equipamento_modelo,
                equipamento_serial,
                defeito_relatado,
                acessorios,
                observacoes,
                fotos_entrada ? JSON.stringify(fotos_entrada) : null,
                req.user.id, // Quem recebeu
                req.user.id
            ]);

            // Registrar no histórico
            await client.query(`
                INSERT INTO service_order_history (
                    service_order_id,
                    user_id,
                    user_name,
                    action,
                    new_value,
                    details
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                orderResult.rows[0].id,
                req.user.id,
                req.user.name,
                'OS criada',
                'aguardando_orcamento',
                `OS ${numeroOS} criada por ${req.user.name}`
            ]);

            return orderResult.rows[0];
        });

        res.status(201).json({
            message: 'Ordem de serviço criada com sucesso',
            order: {
                id: result.id,
                numeroOS: result.numero_os,
                status: result.status,
                createdAt: result.created_at
            }
        });

    } catch (error) {
        console.error('Erro ao criar ordem de serviço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PATCH /api/service-orders/:id/status - Atualizar status da OS
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, defeito_constatado, valor_orcado, prazo_estimado, tecnico_responsavel_id } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status é obrigatório' });
        }

        const validStatuses = [
            'aguardando_orcamento',
            'orcamento_pendente',
            'aprovado',
            'em_reparo',
            'concluido',
            'aguardando_retirada',
            'entregue',
            'cancelado'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const result = await transaction(async (client) => {
            // Buscar OS atual
            const currentResult = await client.query(
                'SELECT * FROM service_orders WHERE id = $1',
                [id]
            );

            if (currentResult.rows.length === 0) {
                throw new Error('Ordem de serviço não encontrada');
            }

            const currentOS = currentResult.rows[0];
            const oldStatus = currentOS.status;

            // Preparar campos para atualizar
            let updateFields = ['status = $1', 'updated_at = NOW()'];
            let params = [status, id];
            let paramCount = 2;

            // Adicionar data de orçamento se mudou para orcamento_pendente
            if (status === 'orcamento_pendente' && oldStatus !== 'orcamento_pendente') {
                paramCount++;
                updateFields.push(`data_orcamento = $${paramCount}`);
                params.splice(-1, 0, new Date());
            }

            // Adicionar data de aprovação se mudou para aprovado
            if (status === 'aprovado' && oldStatus !== 'aprovado') {
                paramCount++;
                updateFields.push(`data_aprovacao = $${paramCount}`);
                params.splice(-1, 0, new Date());
            }

            // Adicionar data de conclusão se mudou para concluido
            if (status === 'concluido' && oldStatus !== 'concluido') {
                paramCount++;
                updateFields.push(`data_conclusao = $${paramCount}`);
                params.splice(-1, 0, new Date());
            }

            // Adicionar data de entrega se mudou para entregue
            if (status === 'entregue' && oldStatus !== 'entregue') {
                paramCount++;
                updateFields.push(`data_entrega = $${paramCount}`);
                params.splice(-1, 0, new Date());

                paramCount++;
                updateFields.push(`entregue_por_id = $${paramCount}`);
                params.splice(-1, 0, req.user.id);
            }

            // Adicionar defeito constatado se fornecido
            if (defeito_constatado !== undefined) {
                paramCount++;
                updateFields.push(`defeito_constatado = $${paramCount}`);
                params.splice(-1, 0, defeito_constatado);
            }

            // Adicionar valor orçado se fornecido
            if (valor_orcado !== undefined) {
                paramCount++;
                updateFields.push(`valor_orcado = $${paramCount}`);
                params.splice(-1, 0, valor_orcado);
            }

            // Adicionar prazo estimado se fornecido
            if (prazo_estimado !== undefined) {
                paramCount++;
                updateFields.push(`prazo_estimado = $${paramCount}`);
                params.splice(-1, 0, prazo_estimado);
            }

            // Adicionar técnico responsável se fornecido
            if (tecnico_responsavel_id !== undefined) {
                paramCount++;
                updateFields.push(`tecnico_responsavel_id = $${paramCount}`);
                params.splice(-1, 0, tecnico_responsavel_id);
            }

            // Atualizar OS
            const updateQuery = `
                UPDATE service_orders
                SET ${updateFields.join(', ')}
                WHERE id = $${paramCount + 1}
                RETURNING *
            `;

            const updateResult = await client.query(updateQuery, params);

            // Registrar no histórico
            await client.query(`
                INSERT INTO service_order_history (
                    service_order_id,
                    user_id,
                    user_name,
                    action,
                    old_value,
                    new_value,
                    details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                id,
                req.user.id,
                req.user.name,
                'Status alterado',
                oldStatus,
                status,
                `Status alterado de "${oldStatus}" para "${status}" por ${req.user.name}`
            ]);

            return updateResult.rows[0];
        });

        res.json({
            message: 'Status atualizado com sucesso',
            order: {
                id: result.id,
                numeroOS: result.numero_os,
                status: result.status,
                updatedAt: result.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        if (error.message === 'Ordem de serviço não encontrada') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// POST /api/service-orders/:id/items - Adicionar peça à OS
router.post('/:id/items', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { equipment_id, descricao, quantidade, valor_unitario } = req.body;

        if (!descricao || !quantidade) {
            return res.status(400).json({ error: 'Descrição e quantidade são obrigatórios' });
        }

        const result = await transaction(async (client) => {
            // Verificar se OS existe
            const osResult = await client.query(
                'SELECT * FROM service_orders WHERE id = $1',
                [id]
            );

            if (osResult.rows.length === 0) {
                throw new Error('Ordem de serviço não encontrada');
            }

            const valorUnit = parseFloat(valor_unitario) || 0;
            const qtd = parseFloat(quantidade);
            const valorTotal = qtd * valorUnit;

            // Se tem equipment_id, dar baixa no estoque
            if (equipment_id) {
                const equipResult = await client.query(
                    'SELECT * FROM equipment WHERE id = $1 AND active = true',
                    [equipment_id]
                );

                if (equipResult.rows.length === 0) {
                    throw new Error('Equipamento não encontrado no estoque');
                }

                const equip = equipResult.rows[0];
                const currentQty = parseFloat(equip.quantity);

                if (currentQty < qtd) {
                    throw new Error(`Quantidade insuficiente no estoque! Disponível: ${currentQty}`);
                }

                // Atualizar estoque
                const newQty = currentQty - qtd;
                await client.query(`
                    UPDATE equipment
                    SET quantity = $1, total_value = $1 * current_cost, updated_at = NOW()
                    WHERE id = $2
                `, [newQty, equipment_id]);

                // Registrar transação de saída
                await client.query(`
                    INSERT INTO transactions (
                        type, equipment_id, equipment_name, category_name,
                        quantity, unit, cost, total_cost,
                        reason, destination, notes,
                        created_by, user_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                `, [
                    'saida',
                    equipment_id,
                    equip.name,
                    '', // categoria (buscar se necessário)
                    qtd,
                    equip.unit,
                    equip.current_cost,
                    qtd * parseFloat(equip.current_cost),
                    'Uso em OS',
                    `OS ${osResult.rows[0].numero_os}`,
                    `Peça utilizada na ordem de serviço ${osResult.rows[0].numero_os}`,
                    req.user.id,
                    req.user.name
                ]);
            }

            // Adicionar item à OS
            const itemResult = await client.query(`
                INSERT INTO service_order_items (
                    service_order_id,
                    equipment_id,
                    descricao,
                    quantidade,
                    valor_unitario,
                    valor_total,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                id,
                equipment_id || null,
                descricao,
                qtd,
                valorUnit,
                valorTotal,
                req.user.id
            ]);

            // Registrar no histórico
            await client.query(`
                INSERT INTO service_order_history (
                    service_order_id,
                    user_id,
                    user_name,
                    action,
                    new_value,
                    details
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                id,
                req.user.id,
                req.user.name,
                'Peça adicionada',
                descricao,
                `${qtd} x ${descricao} adicionado por ${req.user.name}`
            ]);

            return itemResult.rows[0];
        });

        res.status(201).json({
            message: 'Peça adicionada com sucesso',
            item: {
                id: result.id,
                descricao: result.descricao,
                quantidade: parseFloat(result.quantidade),
                valorUnitario: parseFloat(result.valor_unitario),
                valorTotal: parseFloat(result.valor_total)
            }
        });

    } catch (error) {
        console.error('Erro ao adicionar peça:', error);
        if (error.message.includes('não encontrad')) {
            res.status(404).json({ error: error.message });
        } else if (error.message.includes('insuficiente')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// POST /api/service-orders/:id/payments - Adicionar pagamento
router.post('/:id/payments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor, forma_pagamento, observacoes } = req.body;

        if (!valor || !forma_pagamento) {
            return res.status(400).json({ error: 'Valor e forma de pagamento são obrigatórios' });
        }

        const formasPagamento = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outros'];
        if (!formasPagamento.includes(forma_pagamento)) {
            return res.status(400).json({ error: 'Forma de pagamento inválida' });
        }

        const result = await transaction(async (client) => {
            // Verificar se OS existe
            const osResult = await client.query(
                'SELECT * FROM service_orders WHERE id = $1',
                [id]
            );

            if (osResult.rows.length === 0) {
                throw new Error('Ordem de serviço não encontrada');
            }

            // Adicionar pagamento
            const paymentResult = await client.query(`
                INSERT INTO service_order_payments (
                    service_order_id,
                    valor,
                    forma_pagamento,
                    observacoes,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                id,
                valor,
                forma_pagamento,
                observacoes,
                req.user.id
            ]);

            // Registrar no histórico
            await client.query(`
                INSERT INTO service_order_history (
                    service_order_id,
                    user_id,
                    user_name,
                    action,
                    new_value,
                    details
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                id,
                req.user.id,
                req.user.name,
                'Pagamento registrado',
                `R$ ${parseFloat(valor).toFixed(2)}`,
                `Pagamento de R$ ${parseFloat(valor).toFixed(2)} via ${forma_pagamento} por ${req.user.name}`
            ]);

            return paymentResult.rows[0];
        });

        res.status(201).json({
            message: 'Pagamento registrado com sucesso',
            payment: {
                id: result.id,
                valor: parseFloat(result.valor),
                formaPagamento: result.forma_pagamento,
                dataPagamento: result.data_pagamento
            }
        });

    } catch (error) {
        console.error('Erro ao registrar pagamento:', error);
        if (error.message === 'Ordem de serviço não encontrada') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// DELETE /api/service-orders/test-data - Deletar dados de teste (ADMIN ONLY)
router.delete('/test-data', authenticateToken, async (req, res) => {
    try {
        // Verificar se usuário é admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' });
        }

        const result = await transaction(async (client) => {
            // Buscar TODAS as OSs
            const allOSResult = await client.query(`
                SELECT so.id, so.numero_os
                FROM service_orders so
            `);

            const allOSIds = allOSResult.rows.map(row => row.id);
            const deletedCount = allOSIds.length;

            if (deletedCount === 0) {
                return { deletedCount: 0, message: 'Nenhuma ordem de serviço encontrada' };
            }

            // Deletar em cascata (histórico, itens e pagamentos serão deletados automaticamente se houver ON DELETE CASCADE)
            // Caso contrário, deletar manualmente:

            // Deletar histórico
            await client.query(`
                DELETE FROM service_order_history
                WHERE service_order_id = ANY($1)
            `, [allOSIds]);

            // Deletar itens
            await client.query(`
                DELETE FROM service_order_items
                WHERE service_order_id = ANY($1)
            `, [allOSIds]);

            // Deletar pagamentos
            await client.query(`
                DELETE FROM service_order_payments
                WHERE service_order_id = ANY($1)
            `, [allOSIds]);

            // Deletar as OSs
            await client.query(`
                DELETE FROM service_orders
                WHERE id = ANY($1)
            `, [allOSIds]);

            console.log(`[ADMIN] ${req.user.name} deletou ${deletedCount} OSs:`, allOSResult.rows.map(r => r.numero_os));

            return {
                deletedCount,
                message: `${deletedCount} ordem(ns) de serviço deletada(s) com sucesso`,
                deletedOS: allOSResult.rows.map(r => r.numero_os)
            };
        });

        res.json(result);

    } catch (error) {
        console.error('Erro ao deletar dados de teste:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
