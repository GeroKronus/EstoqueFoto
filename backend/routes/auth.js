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
        console.log('📝 Tentativa de registro:', { username, name, role, hasPassword: !!password });

        // Validações básicas
        if (!username || !password || !name) {
            console.log('❌ Dados incompletos:', { username: !!username, password: !!password, name: !!name });
            return res.status(400).json({
                error: 'Username, password e name são obrigatórios'
            });
        }

        if (password.length < 6) {
            console.log('❌ Senha muito curta:', password.length);
            return res.status(400).json({
                error: 'Password deve ter pelo menos 6 caracteres'
            });
        }

        if (email && !validator.isEmail(email)) {
            console.log('❌ Email inválido:', email);
            return res.status(400).json({
                error: 'Email inválido'
            });
        }

        if (!['admin', 'user'].includes(role)) {
            console.log('❌ Role inválida:', role);
            return res.status(400).json({
                error: 'Role deve ser admin ou user'
            });
        }

        // Verificar se username já existe
        console.log('🔍 Verificando se username existe...');
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            console.log('❌ Username já existe:', username);
            return res.status(409).json({
                error: 'Username já existe'
            });
        }

        // Hash da senha
        console.log('🔐 Gerando hash da senha...');
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log('✅ Hash gerado, tamanho:', passwordHash.length);

        // Criar usuário
        console.log('💾 Inserindo usuário no banco...');
        const userResult = await query(`
            INSERT INTO users (username, password_hash, name, email, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, name, email, role, active, created_at
        `, [username, passwordHash, name, email || null, role]);

        const newUser = userResult.rows[0];
        console.log('✅ Usuário criado:', newUser.id);

        // Gerar token
        console.log('🎫 Gerando token JWT...');
        const token = generateToken(newUser);
        console.log('✅ Token gerado');

        console.log('🎉 Registro concluído com sucesso para:', username);
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
        console.error('💥 ERRO AO REGISTRAR:', error);
        console.error('💥 Stack:', error.stack);
        console.error('💥 Message:', error.message);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// POST /api/auth/login - Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 Tentativa de login:', username);

        if (!username || !password) {
            console.log('❌ Username ou password ausente');
            return res.status(400).json({
                error: 'Username e password são obrigatórios'
            });
        }

        // Buscar usuário
        console.log('🔍 Buscando usuário no banco...');
        const userResult = await query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ Usuário não encontrado:', username);
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        const user = userResult.rows[0];
        console.log('✅ Usuário encontrado:', user.username, 'active:', user.active);

        if (!user.active) {
            console.log('❌ Usuário inativo:', username);
            return res.status(401).json({
                error: 'Usuário inativo'
            });
        }

        // Verificar senha
        console.log('🔑 Verificando senha com bcrypt...');
        console.log('🔑 Password hash exists:', !!user.password_hash);
        console.log('🔑 Password hash length:', user.password_hash ? user.password_hash.length : 0);

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        console.log('🔑 Senha válida:', isValidPassword);

        if (!isValidPassword) {
            console.log('❌ Senha incorreta para:', username);
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        // Atualizar último login
        console.log('📝 Atualizando último login...');
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Gerar token
        console.log('🎫 Gerando token JWT...');
        const token = generateToken(user);

        console.log('✅ Login bem-sucedido para:', username);
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
        console.error('💥 ERRO NO LOGIN:', error);
        console.error('💥 Stack:', error.stack);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: error.message
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

// GET /api/auth/check-first-access - Verificar se é primeiro acesso (PÚBLICO)
router.get('/check-first-access', async (req, res) => {
    try {
        // Contar usuários no sistema
        const result = await query('SELECT COUNT(*) as total FROM users');
        const totalUsers = parseInt(result.rows[0].total);

        res.json({
            isFirstAccess: totalUsers === 0,
            totalUsers
        });

    } catch (error) {
        console.error('Erro ao verificar primeiro acesso:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;