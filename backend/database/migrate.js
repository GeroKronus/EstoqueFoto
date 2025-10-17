require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, testConnection } = require('./connection');

async function runMigrations() {
    console.log('🚀 Iniciando migrações do banco de dados...');

    try {
        // Testar conexão
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Não foi possível conectar ao banco de dados');
        }

        // Ler arquivo de migrações
        const migrationsPath = path.join(__dirname, 'migrations.sql');
        const migrations = fs.readFileSync(migrationsPath, 'utf8');

        // Executar migrações
        console.log('📝 Executando migrações...');
        await query(migrations);

        console.log('✅ Migrações executadas com sucesso!');

        // Verificar tabelas criadas
        const tablesResult = await query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('📊 Tabelas criadas:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        return true;

    } catch (error) {
        console.error('❌ Erro ao executar migrações:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigrations };