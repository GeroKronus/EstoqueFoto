const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Endpoint para executar migrations (apenas para admin)
router.post('/run/:migrationNumber', authenticateToken, requireAdmin, async (req, res) => {
    const { migrationNumber } = req.params;

    try {
        // Mapear números de migration para arquivos
        const migrationFiles = {
            '007': '007_create_exit_orders.sql',
            '008': '008_create_exit_order_history.sql',
            '009': '009_add_conditional_items.sql'
        };

        const migrationFile = migrationFiles[String(migrationNumber).padStart(3, '0')];

        if (!migrationFile) {
            return res.status(404).json({
                error: `Migration ${migrationNumber} não encontrada`
            });
        }

        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);

        if (!fs.existsSync(migrationPath)) {
            return res.status(404).json({
                error: `Arquivo de migration ${migrationFile} não encontrado`
            });
        }

        // Ler conteúdo da migration
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log(`📄 Executando migration: ${migrationFile}`);

        // Executar migration
        const { query } = require('../database/connection');
        await query(migrationSQL);

        console.log(`✅ Migration ${migrationFile} executada com sucesso`);

        // Verificar tabelas criadas (dinâmico baseado no número)
        let tablesToCheck = [];
        if (migrationNumber == '007') {
            tablesToCheck = ['exit_orders', 'exit_order_items'];
        } else if (migrationNumber == '008') {
            tablesToCheck = ['exit_order_items_history'];
        } else if (migrationNumber == '009') {
            tablesToCheck = ['exit_order_items']; // Verifica se a tabela existe (a migration adiciona coluna)
        }

        const result = await query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ANY($1)
            ORDER BY table_name;
        `, [tablesToCheck]);

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
        const { query } = require('../database/connection');
        const result = await query(`
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
