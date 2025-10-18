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
        const migrationPath = path.join(__dirname, 'migrations', '019_add_invoice_to_payments.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration 019_add_invoice_to_payments.sql...');

        // Executar migration
        await client.query(migrationSQL);

        console.log('✅ Migration 019 executada com sucesso!');

        // Verificar a nova coluna
        const columnResult = await client.query(`
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'service_order_payments'
            AND column_name = 'numero_nota_fiscal';
        `);

        console.log('📊 Coluna adicionada:');
        if (columnResult.rows.length > 0) {
            const col = columnResult.rows[0];
            console.log(`  ✓ ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}) - Nullable: ${col.is_nullable}`);
        } else {
            console.log('  ⚠️ Coluna não encontrada');
        }

        // Verificar comentário
        const commentResult = await client.query(`
            SELECT
                col_description('service_order_payments'::regclass, ordinal_position) as column_comment
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'service_order_payments'
            AND column_name = 'numero_nota_fiscal';
        `);

        if (commentResult.rows.length > 0 && commentResult.rows[0].column_comment) {
            console.log(`  📝 Comentário: "${commentResult.rows[0].column_comment}"`);
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
        console.log('ℹ️  A tabela service_order_payments agora possui a coluna numero_nota_fiscal');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Falha:', error);
        process.exit(1);
    });
