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
        const migrationPath = path.join(__dirname, 'migrations', '020_add_role_alterada_transaction_type.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 020_add_role_alterada_transaction_type.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 020 executada com sucesso!');

        // Verificar a constraint atualizada
        const constraintResult = await client.query(`
            SELECT
                conname as constraint_name,
                pg_get_constraintdef(oid) as constraint_definition
            FROM pg_constraint
            WHERE conrelid = 'transactions'::regclass
            AND conname = 'transactions_type_check';
        `);

        console.log('📊 Constraint atualizada:');
        if (constraintResult.rows.length > 0) {
            const constraint = constraintResult.rows[0];
            console.log(`  ✓ ${constraint.constraint_name}`);
            console.log(`  📝 ${constraint.constraint_definition}`);
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
        console.log('ℹ️  O tipo "role_alterada" agora está disponível para a tabela transactions');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Falha:', error);
        process.exit(1);
    });
