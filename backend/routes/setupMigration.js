const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Endpoint público TEMPORÁRIO para executar migration 007
// REMOVER APÓS USO POR SEGURANÇA!
router.get('/run-migration-007', async (req, res) => {
    try {
        console.log('🔧 Iniciando execução da migration 007...');

        // Verificar se migration já foi executada
        const { pool } = require('../database/db');

        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'exit_orders'
            );
        `);

        if (tableCheck.rows[0].exists) {
            return res.json({
                message: '⚠️ Migration 007 já foi executada anteriormente',
                status: 'already_executed',
                tables: ['exit_orders', 'exit_order_items']
            });
        }

        // Ler arquivo de migration
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_create_exit_orders.sql');

        if (!fs.existsSync(migrationPath)) {
            return res.status(404).json({
                error: 'Arquivo de migration 007_create_exit_orders.sql não encontrado',
                path: migrationPath
            });
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executando migration SQL...');

        // Executar migration
        await pool.query(migrationSQL);

        console.log('✅ Migration 007 executada com sucesso!');

        // Verificar tabelas criadas
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('exit_orders', 'exit_order_items')
            ORDER BY table_name;
        `);

        const tablesCreated = result.rows.map(r => r.table_name);

        res.json({
            message: '✅ Migration 007 executada com sucesso!',
            status: 'success',
            tablesCreated: tablesCreated,
            timestamp: new Date().toISOString(),
            warning: '⚠️ REMOVA esta rota após executar por segurança!'
        });

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        res.status(500).json({
            error: 'Erro ao executar migration',
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
    }
});

// Endpoint para verificar status das tabelas
router.get('/check-tables', async (req, res) => {
    try {
        const { pool } = require('../database/db');

        const result = await pool.query(`
            SELECT
                table_name,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        // Verificar se exit_orders existe
        const exitOrdersExists = result.rows.some(r => r.table_name === 'exit_orders');
        const exitOrderItemsExists = result.rows.some(r => r.table_name === 'exit_order_items');

        res.json({
            status: 'ok',
            migration_007_executed: exitOrdersExists && exitOrderItemsExists,
            tables: result.rows,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro ao verificar tabelas:', error);
        res.status(500).json({
            error: 'Erro ao verificar tabelas',
            message: error.message
        });
    }
});

module.exports = router;
