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
        const migrationPath = path.join(__dirname, 'migrations', '011_allow_zero_quantity_exit_items.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 011_allow_zero_quantity_exit_items.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 011 executada com sucesso!');

        // Verificar a constraint atualizada
        const constraintResult = await client.query(`
            SELECT
                tc.constraint_name,
                cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc
                ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name = 'exit_order_items'
            AND tc.constraint_name = 'exit_order_items_quantity_check';
        `);

        console.log('📊 Constraint atualizada:');
        if (constraintResult.rows.length > 0) {
            const row = constraintResult.rows[0];
            console.log(`  ✓ ${row.constraint_name}: ${row.check_clause}`);
        } else {
            console.log('  ⚠️ Constraint não encontrada');
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
        console.log('ℹ️  A tabela exit_order_items agora permite quantidade >= 0');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Falha:', error);
        process.exit(1);
    });
