const { Pool } = require('pg');

// Configuração da conexão com PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // máximo de conexões
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Teste de conexão
pool.on('connect', () => {
    console.log('✅ Conectado ao banco PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Erro na conexão com PostgreSQL:', err);
});

// Função helper para executar queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`Query executada em ${duration}ms:`, text.substring(0, 50));
        return res;
    } catch (error) {
        console.error('Erro na query:', error);
        throw error;
    }
};

// Função para transações
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Função para testar conexão
const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() as current_time');
        console.log('🔌 Teste de conexão bem-sucedido:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('❌ Falha no teste de conexão:', error);
        return false;
    }
};

module.exports = {
    pool,
    query,
    transaction,
    testConnection
};