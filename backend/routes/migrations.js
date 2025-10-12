const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Endpoint para executar migrations (apenas para admin)
router.post('/run/:migrationNumber', authenticateToken, requireAdmin, async (req, res) => {
    const { migrationNumber } = req.params;

    try {
        // Verificar se o arquivo de migration existe
        const migrationFile = `${String(migrationNumber).padStart(3, '0')}_create_exit_orders.sql`;
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);

        if (!fs.existsSync(migrationPath)) {
            return res.status(404).json({
                error: `Migration ${migrationFile} não encontrada`
            });
        }

        // Ler conteúdo da migration
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log(`📄 Executando migration: ${migrationFile}`);

        // Executar migration
        const { pool } = require('../database/db');
        await pool.query(migrationSQL);

        console.log(`✅ Migration ${migrationFile} executada com sucesso`);

        // Verificar tabelas criadas
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('exit_orders', 'exit_order_items')
            ORDER BY table_name;
        `);

        res.json({
            message: `Migration ${migrationFile} executada com sucesso`,
            tablesCreated: result.rows.map(r => r.table_name)
        });

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        res.status(500).json({
            error: 'Erro ao executar migration',
            details: error.message
        });
    }
});

// Endpoint para listar tabelas existentes
router.get('/tables', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { pool } = require('../database/db');
        const result = await pool.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        res.json({
            tables: result.rows
        });

    } catch (error) {
        console.error('❌ Erro ao listar tabelas:', error);
        res.status(500).json({
            error: 'Erro ao listar tabelas',
            details: error.message
        });
    }
});

module.exports = router;
