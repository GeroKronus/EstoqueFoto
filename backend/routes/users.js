const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { query, transaction } = require('../database/connection');
const { authenticateToken, requireAdmin, checkUserAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/list - Listar usuários ativos para dropdowns (todos autenticados)
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT id, name, username, role
            FROM users
            WHERE active = true
            ORDER BY name ASC
        `);

        const users = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            username: row.username,
            role: row.role
        }));

        res.json({ users });

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/users - Listar usuários (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { active, role, page = 1, limit = 50 } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Filtro por status ativo
        if (active !== undefined) {
            paramCount++;
            whereConditions.push(`active = $${paramCount}`);
            queryParams.push(active === 'true');
        }

        // Filtro por role
        if (role) {
            paramCount++;
            whereConditions.push(`role = $${paramCount}`);
            queryParams.push(role);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Paginação
        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        const usersQuery = `
            SELECT
                u.id, u.username, u.name, u.email, u.role, u.active,
                u.created_at, u.updated_at, u.last_login,
                COUNT(e.id) as equipment_created,
                COUNT(t.id) as transactions_count
            FROM users u
            LEFT JOIN equipment e ON u.id = e.created_by
            LEFT JOIN transactions t ON u.id = t.created_by
            ${whereClause}
            GROUP BY u.id, u.username, u.name, u.email, u.role, u.active, u.created_at, u.updated_at, u.last_login
            ORDER BY u.created_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM users
            ${whereClause}
        `;

        const [usersResult, countResult] = await Promise.all([
            query(usersQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2))
        ]);

        const users = usersResult.rows.map(row => ({
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            role: row.role,
            active: row.active,
            stats: {
                equipmentCreated: parseInt(row.equipment_created),
                transactionsCount: parseInt(row.transactions_count)
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastLogin: row.last_login
        }));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            users,
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
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/users/:id - Buscar usuário específico
router.get('/:id', authenticateToken, checkUserAccess, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                u.id, u.username, u.name, u.email, u.role, u.active,
                u.created_at, u.updated_at, u.last_login,
                COUNT(DISTINCT e.id) as equipment_created,
                COUNT(DISTINCT t.id) as transactions_count,
                COUNT(DISTINCT CASE WHEN t.created_at >= CURRENT_DATE THEN t.id END) as transactions_today
            FROM users u
            LEFT JOIN equipment e ON u.id = e.created_by
            LEFT JOIN transactions t ON u.id = t.created_by
            WHERE u.id = $1
            GROUP BY u.id, u.username, u.name, u.email, u.role, u.active, u.created_at, u.updated_at, u.last_login
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        const row = result.rows[0];
        const user = {
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            role: row.role,
            active: row.active,
            stats: {
                equipmentCreated: parseInt(row.equipment_created),
                transactionsCount: parseInt(row.transactions_count),
                transactionsToday: parseInt(row.transactions_today)
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastLogin: row.last_login
        };

        res.json({ user });

    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/users - Criar novo usuário (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, name, email, role = 'user', notes } = req.body;

        // Validações
        if (!username || !password || !name) {
            return res.status(400).json({
                error: 'Username, password e name são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password deve ter pelo menos 6 caracteres'
            });
        }

        if (email && !validator.isEmail(email)) {
            return res.status(400).json({
                error: 'Email inválido'
            });
        }

        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({
                error: 'Role deve ser admin ou user'
            });
        }

        const result = await transaction(async (client) => {
            // Verificar se username já existe
            const existingUser = await client.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );

            if (existingUser.rows.length > 0) {
                throw new Error('Username já existe');
            }

            // Hash da senha
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Criar usuário
            const userResult = await client.query(`
                INSERT INTO users (username, password_hash, name, email, role)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, username, name, email, role, active, created_at
            `, [username, passwordHash, name, email, role]);

            const newUser = userResult.rows[0];

            // Registrar transação de criação de usuário
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'usuario_criado',
                `Usuário "${name}" (${username}) criado com perfil ${role}. ${notes ? 'Obs: ' + notes : ''}`,
                req.user.id,
                req.user.name
            ]);

            return newUser;
        });

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: result.id,
                username: result.username,
                name: result.name,
                email: result.email,
                role: result.role,
                active: result.active,
                createdAt: result.created_at
            }
        });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        if (error.message === 'Username já existe') {
            res.status(409).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// PUT /api/users/:id - Atualizar usuário
router.put('/:id', authenticateToken, checkUserAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role } = req.body;

        if (!name) {
            return res.status(400).json({
                error: 'Name é obrigatório'
            });
        }

        if (email && !validator.isEmail(email)) {
            return res.status(400).json({
                error: 'Email inválido'
            });
        }

        // Só admin pode alterar role
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Apenas administradores podem alterar roles'
            });
        }

        if (role && !['admin', 'user'].includes(role)) {
            return res.status(400).json({
                error: 'Role deve ser admin ou user'
            });
        }

        // Verificar se usuário existe
        const userExists = await query(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );

        if (userExists.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        const updateFields = ['name = $1', 'updated_at = NOW()'];
        const updateParams = [name];
        let paramCount = 1;

        if (email !== undefined) {
            paramCount++;
            updateFields.push(`email = $${paramCount}`);
            updateParams.push(email);
        }

        if (role && req.user.role === 'admin') {
            paramCount++;
            updateFields.push(`role = $${paramCount}`);
            updateParams.push(role);
        }

        paramCount++;
        updateParams.push(id);

        const result = await query(`
            UPDATE users
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username, name, email, role, active, updated_at
        `, updateParams);

        const user = result.rows[0];

        res.json({
            message: 'Usuário atualizado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                active: user.active,
                updatedAt: user.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// PUT /api/users/:id/deactivate - Desativar usuário (admin only)
router.put('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Não é possível desativar sua própria conta'
            });
        }

        const result = await transaction(async (client) => {
            // Buscar informações do usuário
            const userResult = await client.query(
                'SELECT * FROM users WHERE id = $1',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const user = userResult.rows[0];

            if (!user.active) {
                throw new Error('Usuário já está inativo');
            }

            // Desativar usuário
            await client.query(
                'UPDATE users SET active = false, updated_at = NOW() WHERE id = $1',
                [id]
            );

            // Registrar transação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'usuario_desativado',
                `Usuário "${user.name}" (${user.username}) foi desativado`,
                req.user.id,
                req.user.name
            ]);

            return user;
        });

        res.json({
            message: `Usuário "${result.name}" foi desativado com sucesso`
        });

    } catch (error) {
        console.error('Erro ao desativar usuário:', error);
        if (error.message === 'Usuário não encontrado' || error.message === 'Usuário já está inativo') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// PUT /api/users/:id/activate - Reativar usuário (admin only)
router.put('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await transaction(async (client) => {
            // Buscar informações do usuário
            const userResult = await client.query(
                'SELECT * FROM users WHERE id = $1',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const user = userResult.rows[0];

            if (user.active) {
                throw new Error('Usuário já está ativo');
            }

            // Reativar usuário
            await client.query(
                'UPDATE users SET active = true, updated_at = NOW() WHERE id = $1',
                [id]
            );

            // Registrar transação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'usuario_reativado',
                `Usuário "${user.name}" (${user.username}) foi reativado`,
                req.user.id,
                req.user.name
            ]);

            return user;
        });

        res.json({
            message: `Usuário "${result.name}" foi reativado com sucesso`
        });

    } catch (error) {
        console.error('Erro ao reativar usuário:', error);
        if (error.message === 'Usuário não encontrado' || error.message === 'Usuário já está ativo') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// PATCH /api/users/:id/role - Alterar role do usuário (admin only)
router.patch('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validar role
        if (!role || !['admin', 'user'].includes(role)) {
            return res.status(400).json({
                error: 'Role deve ser "admin" ou "user"'
            });
        }

        // Impedir que admin mude seu próprio role
        if (id === req.user.id) {
            return res.status(403).json({
                error: 'Você não pode alterar sua própria função (role)'
            });
        }

        const result = await transaction(async (client) => {
            // Buscar informações do usuário
            const userResult = await client.query(
                'SELECT id, username, name, role, active FROM users WHERE id = $1',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const user = userResult.rows[0];

            if (user.role === role) {
                throw new Error(`Usuário já possui a função ${role}`);
            }

            // Atualizar role
            const updateResult = await client.query(`
                UPDATE users
                SET role = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, username, name, email, role, active, updated_at
            `, [role, id]);

            // Registrar transação
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'role_alterada',
                `Função do usuário "${user.name}" (${user.username}) foi alterada de "${user.role}" para "${role}" por ${req.user.name}`,
                req.user.id,
                req.user.name
            ]);

            return updateResult.rows[0];
        });

        res.json({
            message: `Função do usuário "${result.name}" foi alterada para ${role === 'admin' ? 'Administrador' : 'Usuário Comum'} com sucesso`,
            user: {
                id: result.id,
                username: result.username,
                name: result.name,
                email: result.email,
                role: result.role,
                active: result.active,
                updatedAt: result.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao alterar role do usuário:', error);
        if (error.message === 'Usuário não encontrado' || error.message.includes('já possui a função')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// PATCH /api/users/:id/reset-password - Admin redefine senha de usuário (admin only)
router.patch('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        // Validações
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                error: 'A nova senha deve ter pelo menos 6 caracteres'
            });
        }

        // Impedir que admin redefina sua própria senha (deve usar a opção de alterar senha)
        if (id === req.user.id) {
            return res.status(403).json({
                error: 'Você não pode redefinir sua própria senha. Use a opção "Alterar Senha".'
            });
        }

        const result = await transaction(async (client) => {
            // Buscar informações do usuário
            const userResult = await client.query(
                'SELECT id, username, name, role, active FROM users WHERE id = $1',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const user = userResult.rows[0];

            if (!user.active) {
                throw new Error('Não é possível redefinir senha de usuário inativo');
            }

            // Hash da nova senha
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            // Atualizar senha
            await client.query(`
                UPDATE users
                SET password_hash = $1, updated_at = NOW()
                WHERE id = $2
            `, [hashedPassword, id]);

            // Registrar transação de auditoria
            await client.query(`
                INSERT INTO transactions (
                    type, equipment_id, equipment_name, category_name,
                    notes, created_by, user_name
                )
                VALUES ($1, NULL, '', '', $2, $3, $4)
            `, [
                'reset',
                `Senha do usuário "${user.name}" (${user.username}) foi redefinida pelo administrador ${req.user.name}`,
                req.user.id,
                req.user.name
            ]);

            return user;
        });

        console.log(`[ADMIN] Senha do usuário ${result.name} redefinida por ${req.user.name}`);

        res.json({
            message: `Senha de "${result.name}" foi redefinida com sucesso`,
            user: {
                id: result.id,
                username: result.username,
                name: result.name
            }
        });

    } catch (error) {
        console.error('Erro ao redefinir senha do usuário:', error);
        if (error.message === 'Usuário não encontrado' || error.message.includes('inativo')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// GET /api/users/stats/summary - Estatísticas gerais dos usuários (admin only)
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN active = true THEN 1 END) as active_users,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                COUNT(CASE WHEN last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_logins
            FROM users
        `);

        const stats = result.rows[0];

        res.json({
            totalUsers: parseInt(stats.total_users),
            activeUsers: parseInt(stats.active_users),
            adminUsers: parseInt(stats.admin_users),
            recentLogins: parseInt(stats.recent_logins),
            inactiveUsers: parseInt(stats.total_users) - parseInt(stats.active_users)
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de usuários:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;