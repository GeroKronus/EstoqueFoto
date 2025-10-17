const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Token de acesso requerido',
            code: 'NO_TOKEN'
        });
    }

    try {
        // Verificar e decodificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuário no banco
        const userResult = await query(
            'SELECT id, username, name, role, active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const user = userResult.rows[0];

        if (!user.active) {
            return res.status(401).json({
                error: 'Usuário inativo',
                code: 'USER_INACTIVE'
            });
        }

        // Adicionar informações do usuário ao request
        req.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        };

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        console.error('Erro na autenticação:', error);
        return res.status(500).json({
            error: 'Erro interno na autenticação'
        });
    }
};

// Middleware para verificar se é administrador
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Autenticação requerida',
            code: 'AUTH_REQUIRED'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Acesso restrito a administradores',
            code: 'ADMIN_REQUIRED'
        });
    }

    next();
};

// Middleware para verificar se o usuário pode acessar o recurso
const checkUserAccess = (req, res, next) => {
    const targetUserId = req.params.userId || req.body.userId;

    // Admin pode acessar qualquer coisa
    if (req.user.role === 'admin') {
        return next();
    }

    // Usuário só pode acessar próprios recursos
    if (targetUserId && targetUserId !== req.user.id) {
        return res.status(403).json({
            error: 'Acesso negado a este recurso',
            code: 'ACCESS_DENIED'
        });
    }

    next();
};

// Função para gerar token JWT
const generateToken = (user) => {
    const payload = {
        userId: user.id,
        username: user.username,
        role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '7d' // Token válido por 7 dias
    });
};

// Função para decodificar token sem verificar (para informações)
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    checkUserAccess,
    generateToken,
    decodeToken
};