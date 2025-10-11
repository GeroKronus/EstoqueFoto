const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { query, transaction } = require('../database/connection');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register - Registrar novo usuário
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, email, role = 'user' } = req.body;

        // Validações básicas
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

        // Verificar se username já existe
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'Username já existe'
            });
        }

        // Hash da senha
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Criar usuário
        const userResult = await query(`
            INSERT INTO users (username, password_hash, name, email, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, name, email, role, active, created_at
        `, [username, passwordHash, name, email, role]);

        const newUser = userResult.rows[0];

        // Gerar token
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                active: newUser.active,
                createdAt: newUser.created_at
            },
            token
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/auth/login - Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username e password são obrigatórios'
            });
        }

        // Buscar usuário
        const userResult = await query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        const user = userResult.rows[0];

        if (!user.active) {
            return res.status(401).json({
                error: 'Usuário inativo'
            });
        }

        // Verificar senha
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        // Atualizar último login
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Gerar token
        const token = generateToken(user);

        res.json({
            message: 'Login realizado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                active: user.active,
                lastLogin: new Date().toISOString()
            },
            token
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/auth/me - Informações do usuário atual
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userResult = await query(
            'SELECT id, username, name, email, role, active, created_at, last_login FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        const user = userResult.rows[0];

        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                active: user.active,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });

    } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/auth/change-password - Alterar senha
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Senha atual e nova senha são obrigatórias'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'Nova senha deve ter pelo menos 6 caracteres'
            });
        }

        // Buscar usuário com senha
        const userResult = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = userResult.rows[0];

        // Verificar senha atual
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Senha atual incorreta'
            });
        }

        // Hash da nova senha
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Atualizar senha
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newPasswordHash, req.user.id]
        );

        res.json({
            message: 'Senha alterada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/auth/logout - Logout (placeholder para futuras implementações)
router.post('/logout', authenticateToken, (req, res) => {
    // Em uma implementação completa, aqui poderíamos invalidar o token
    // Por ora, o logout é feito no frontend removendo o token
    res.json({
        message: 'Logout realizado com sucesso'
    });
});

module.exports = router;