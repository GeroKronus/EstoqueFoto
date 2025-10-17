const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Conectado ao PostgreSQL');

        // Ler arquivo de migration
        const migrationPath = path.join(__dirname, 'migrations', '007_create_exit_orders.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 007_create_exit_orders.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 007 executada com sucesso!');

        // Verificar tabelas criadas
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('exit_orders', 'exit_order_items')
            ORDER BY table_name;
        `);

        console.log('📊 Tabelas criadas:');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('🎉 Processo concluído!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Falha:', error);
        process.exit(1);
    });
