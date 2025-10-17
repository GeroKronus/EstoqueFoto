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
        const migrationPath = path.join(__dirname, 'migrations', '008_create_exit_order_history.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 008_create_exit_order_history.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 008 executada com sucesso!');

        // Verificar tabelas e colunas criadas
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('exit_order_items_history')
            ORDER BY table_name;
        `);

        console.log('📊 Tabelas criadas:');
        tablesResult.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

        // Verificar novas colunas
        const columnsResult = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'exit_order_items'
            AND column_name IN ('is_modified', 'original_quantity')
            ORDER BY column_name;
        `);

        console.log('📊 Novas colunas em exit_order_items:');
        columnsResult.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
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
