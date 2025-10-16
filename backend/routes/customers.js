const express = require('express');
const router = express.Router();
const { query, pool } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// GET /customers - Listar clientes com paginação e filtros
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            ativo = '',
            cidade = '',
            estado = ''
        } = req.query;

        const offset = (page - 1) * limit;

        // Construir query com filtros
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Filtro de busca (razão social, nome fantasia, CNPJ)
        if (search) {
            whereConditions.push(`(
                LOWER(razao_social) LIKE $${paramIndex} OR
                LOWER(nome_fantasia) LIKE $${paramIndex} OR
                cnpj LIKE $${paramIndex}
            )`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        // Filtro por status ativo
        if (ativo !== '') {
            whereConditions.push(`ativo = $${paramIndex}`);
            params.push(ativo === 'true');
            paramIndex++;
        }

        // Filtro por cidade
        if (cidade) {
            whereConditions.push(`LOWER(cidade) = $${paramIndex}`);
            params.push(cidade.toLowerCase());
            paramIndex++;
        }

        // Filtro por estado
        if (estado) {
            whereConditions.push(`LOWER(estado) = $${paramIndex}`);
            params.push(estado.toLowerCase());
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Contar total de registros
        const countResult = await query(
            `SELECT COUNT(*) as total FROM customers ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Buscar clientes com paginação
        const customersResult = await query(`
            SELECT
                id,
                razao_social,
                nome_fantasia,
                cnpj,
                endereco,
                bairro,
                cidade,
                cep,
                estado,
                inscricao_estadual,
                telefone,
                email,
                ativo,
                created_at,
                updated_at
            FROM customers
            ${whereClause}
            ORDER BY razao_social ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        res.json({
            customers: customersResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({
            error: 'Erro ao listar clientes',
            message: error.message
        });
    }
});

// GET /customers/:id - Buscar cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM customers WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Cliente não encontrado'
            });
        }

        res.json({ customer: result.rows[0] });

    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({
            error: 'Erro ao buscar cliente',
            message: error.message
        });
    }
});

// POST /customers - Criar novo cliente
router.post('/', async (req, res) => {
    try {
        const {
            razao_social,
            nome_fantasia,
            cnpj,
            endereco,
            bairro,
            cidade,
            cep,
            estado,
            inscricao_estadual,
            telefone,
            email
        } = req.body;

        // Validação básica
        if (!razao_social) {
            return res.status(400).json({
                error: 'Razão social é obrigatória'
            });
        }

        // Verificar se CNPJ já existe (se fornecido)
        if (cnpj) {
            const existingResult = await query(
                'SELECT id FROM customers WHERE cnpj = $1',
                [cnpj]
            );

            if (existingResult.rows.length > 0) {
                return res.status(400).json({
                    error: 'CNPJ já cadastrado'
                });
            }
        }

        const result = await query(`
            INSERT INTO customers (
                razao_social,
                nome_fantasia,
                cnpj,
                endereco,
                bairro,
                cidade,
                cep,
                estado,
                inscricao_estadual,
                telefone,
                email
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            razao_social,
            nome_fantasia,
            cnpj,
            endereco,
            bairro,
            cidade,
            cep,
            estado,
            inscricao_estadual,
            telefone,
            email
        ]);

        res.status(201).json({
            message: 'Cliente criado com sucesso',
            customer: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).json({
            error: 'Erro ao criar cliente',
            message: error.message
        });
    }
});

// PUT /customers/:id - Atualizar cliente
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            razao_social,
            nome_fantasia,
            cnpj,
            endereco,
            bairro,
            cidade,
            cep,
            estado,
            inscricao_estadual,
            telefone,
            email,
            ativo
        } = req.body;

        // Validação básica
        if (!razao_social) {
            return res.status(400).json({
                error: 'Razão social é obrigatória'
            });
        }

        // Verificar se cliente existe
        const existingCustomer = await query(
            'SELECT id FROM customers WHERE id = $1',
            [id]
        );

        if (existingCustomer.rows.length === 0) {
            return res.status(404).json({
                error: 'Cliente não encontrado'
            });
        }

        // Verificar se CNPJ já existe em outro cliente
        if (cnpj) {
            const cnpjCheck = await query(
                'SELECT id FROM customers WHERE cnpj = $1 AND id != $2',
                [cnpj, id]
            );

            if (cnpjCheck.rows.length > 0) {
                return res.status(400).json({
                    error: 'CNPJ já cadastrado para outro cliente'
                });
            }
        }

        const result = await query(`
            UPDATE customers SET
                razao_social = $1,
                nome_fantasia = $2,
                cnpj = $3,
                endereco = $4,
                bairro = $5,
                cidade = $6,
                cep = $7,
                estado = $8,
                inscricao_estadual = $9,
                telefone = $10,
                email = $11,
                ativo = $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13
            RETURNING *
        `, [
            razao_social,
            nome_fantasia,
            cnpj,
            endereco,
            bairro,
            cidade,
            cep,
            estado,
            inscricao_estadual,
            telefone,
            email,
            ativo !== undefined ? ativo : true,
            id
        ]);

        res.json({
            message: 'Cliente atualizado com sucesso',
            customer: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({
            error: 'Erro ao atualizar cliente',
            message: error.message
        });
    }
});

// DELETE /customers/:id - Desativar cliente (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se cliente existe
        const existingCustomer = await query(
            'SELECT id, razao_social FROM customers WHERE id = $1',
            [id]
        );

        if (existingCustomer.rows.length === 0) {
            return res.status(404).json({
                error: 'Cliente não encontrado'
            });
        }

        // Desativar cliente (soft delete)
        await query(
            'UPDATE customers SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Cliente desativado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao desativar cliente:', error);
        res.status(500).json({
            error: 'Erro ao desativar cliente',
            message: error.message
        });
    }
});

// POST /customers/:id/activate - Reativar cliente
router.post('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se cliente existe
        const existingCustomer = await query(
            'SELECT id, razao_social FROM customers WHERE id = $1',
            [id]
        );

        if (existingCustomer.rows.length === 0) {
            return res.status(404).json({
                error: 'Cliente não encontrado'
            });
        }

        // Reativar cliente
        await query(
            'UPDATE customers SET ativo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Cliente reativado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao reativar cliente:', error);
        res.status(500).json({
            error: 'Erro ao reativar cliente',
            message: error.message
        });
    }
});

// GET /customers/search/autocomplete - Busca para autocomplete
router.get('/search/autocomplete', async (req, res) => {
    try {
        const { q = '', limit = 10 } = req.query;

        if (!q || q.length < 2) {
            return res.json({ customers: [] });
        }

        const result = await query(`
            SELECT
                id,
                razao_social,
                nome_fantasia,
                cnpj,
                cidade,
                estado
            FROM customers
            WHERE
                ativo = true AND
                (
                    LOWER(razao_social) LIKE $1 OR
                    LOWER(nome_fantasia) LIKE $1 OR
                    cnpj LIKE $1
                )
            ORDER BY razao_social ASC
            LIMIT $2
        `, [`%${q.toLowerCase()}%`, limit]);

        res.json({ customers: result.rows });

    } catch (error) {
        console.error('Erro na busca autocomplete:', error);
        res.status(500).json({
            error: 'Erro na busca',
            message: error.message
        });
    }
});

module.exports = router;
