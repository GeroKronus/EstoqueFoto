require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { runMigrations } = require('./database/migrate');

// Importar rotas
const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const transactionRoutes = require('./routes/transactions');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

// Configuração de CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por IP
    message: {
        error: 'Muitas tentativas. Tente novamente em alguns minutos.'
    }
});

app.use('/api/', limiter);

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rota de debug - verificar conexão e dados
app.get('/api/debug', async (req, res) => {
    const { query } = require('./database/connection');

    try {
        // 1. Testar conexão
        const connectionTest = await query('SELECT NOW() as current_time, version() as pg_version');

        // 2. Contar usuários
        const userCount = await query('SELECT COUNT(*) as total FROM users');

        // 3. Listar usuários (sem senha)
        const users = await query('SELECT id, username, name, role, active, created_at FROM users ORDER BY created_at DESC LIMIT 10');

        // 4. Verificar variáveis de ambiente
        const envCheck = {
            DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
            DATABASE_URL_PREFIX: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NOT SET',
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        };

        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                current_time: connectionTest.rows[0].current_time,
                postgresql_version: connectionTest.rows[0].pg_version
            },
            users: {
                total_count: parseInt(userCount.rows[0].total),
                list: users.rows
            },
            environment: envCheck
        });

    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message,
            database: {
                connected: false,
                error_code: error.code,
                error_detail: error.detail
            },
            environment: {
                DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
                NODE_ENV: process.env.NODE_ENV
            }
        });
    }
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir o index.html em qualquer rota que não seja da API
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Middleware para rotas não encontradas (apenas para API)
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.path,
        method: req.method
    });
});

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro interno:', err);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Erro interno do servidor'
            : err.message,
        timestamp: new Date().toISOString()
    });
});

// Função para iniciar o servidor
async function startServer() {
    // Iniciar servidor primeiro (para passar no healthcheck)
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
        console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });

    // Rodar migrations em background (não-bloqueante)
    console.log('🔧 Verificando e aplicando migrations em background...');
    runMigrations()
        .then(() => {
            console.log('✅ Migrations concluídas com sucesso!');
        })
        .catch((error) => {
            console.error('⚠️ Erro ao executar migrations:', error.message);
            console.error('⚠️ Servidor continuará rodando, mas o banco pode não estar configurado.');
        });
}

// Iniciar servidor
startServer();

module.exports = app;