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
        const migrationPath = path.join(__dirname, 'migrations', '021_create_composite_items.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 021_create_composite_items.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 021 executada com sucesso!');

        // Verificar tabelas criadas
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('composite_items', 'composite_item_components')
            ORDER BY table_name;
        `);

        console.log('📊 Tabelas criadas:');
        if (tablesResult.rows.length > 0) {
            tablesResult.rows.forEach(row => {
                console.log(`  ✓ ${row.table_name}`);
            });
        } else {
            console.log('  ⚠️ Nenhuma tabela encontrada');
        }

        // Verificar índices
        const indexesResult = await client.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename IN ('composite_items', 'composite_item_components')
            AND schemaname = 'public'
            ORDER BY indexname;
        `);

        console.log('📑 Índices criados:');
        if (indexesResult.rows.length > 0) {
            indexesResult.rows.forEach(row => {
                console.log(`  ✓ ${row.indexname}`);
            });
        }

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
        console.log('ℹ️  Sistema de Itens Compostos (Kits) está pronto para uso');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Falha:', error);
        process.exit(1);
    });
