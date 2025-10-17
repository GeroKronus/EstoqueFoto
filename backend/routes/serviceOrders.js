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

module.exports = router;
