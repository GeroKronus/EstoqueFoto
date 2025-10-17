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
            '009': '009_add_conditional_items.sql',
            '011': '011_allow_zero_quantity_exit_items.sql',
            '012': '012_create_customers_table.sql',
            '013': '013_add_customer_references.sql',
            '014': '014_add_informatica_category.sql',
            '015': '015_add_insumos_category.sql',
            '016': '016_add_document_and_finalize.sql'
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
        } else if (migrationNumber == '011') {
            tablesToCheck = ['exit_order_items']; // Verifica se a tabela existe (a migration altera constraint)
        } else if (migrationNumber == '012') {
            tablesToCheck = ['customers']; // Verifica se a tabela customers foi criada
        } else if (migrationNumber == '013') {
            tablesToCheck = ['transactions', 'exit_orders']; // Verifica se as tabelas existem (a migration adiciona colunas)
        } else if (migrationNumber == '014') {
            tablesToCheck = ['categories']; // Verifica se a tabela categories existe (a migration adiciona categoria)
        } else if (migrationNumber == '015') {
            tablesToCheck = ['categories']; // Verifica se a tabela categories existe (a migration adiciona categoria)
        } else if (migrationNumber == '016') {
            tablesToCheck = ['exit_order_items', 'exit_orders']; // Verifica se as tabelas existem (a migration adiciona colunas)
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

// Endpoint para importar clientes do arquivo TXT
router.post('/import-customers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('📦 Iniciando importação de clientes via API...');

        const { importCustomers } = require('../database/importCustomers');

        await importCustomers();

        // Contar total de clientes importados
        const { query } = require('../database/connection');
        const result = await query('SELECT COUNT(*) as total FROM customers');
        const total = parseInt(result.rows[0].total);

        res.json({
            message: 'Clientes importados com sucesso',
            total_imported: total
        });

    } catch (error) {
        console.error('❌ Erro ao importar clientes:', error);
        res.status(500).json({
            error: 'Erro ao importar clientes',
            details: error.message
        });
    }
});

// Endpoint para corrigir a sequence do order_number
router.post('/fix-order-number-sequence', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔧 Corrigindo sequence do order_number...');

        const { query } = require('../database/connection');

        // Buscar o maior order_number existente
        const maxResult = await query('SELECT COALESCE(MAX(order_number), 0) as max_order_number FROM exit_orders');
        const maxOrderNumber = parseInt(maxResult.rows[0].max_order_number);

        // Resetar a sequence para o próximo valor disponível
        const nextValue = maxOrderNumber + 1;
        const setvalResult = await query("SELECT setval('exit_orders_order_number_seq', $1, false) as new_value", [nextValue]);
        const currentValue = parseInt(setvalResult.rows[0].new_value);

        console.log(`✅ Sequence corrigida: próximo order_number será ${currentValue}`);

        res.json({
            message: 'Sequence do order_number corrigida com sucesso',
            max_order_number: maxOrderNumber,
            next_order_number: currentValue,
            details: `A próxima ordem de saída terá o número ${currentValue}`
        });

    } catch (error) {
        console.error('❌ Erro ao corrigir sequence:', error);
        res.status(500).json({
            error: 'Erro ao corrigir sequence do order_number',
            details: error.message
        });
    }
});

// Endpoint para excluir todas as movimentações (entradas, saídas e ordens) mantendo estoque
router.post('/delete-all-exit-orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🗑️ Excluindo todas as movimentações...');

        const { query } = require('../database/connection');

        // Contar registros antes de excluir
        const ordersCount = await query('SELECT COUNT(*) as total FROM exit_orders');
        const totalOrders = parseInt(ordersCount.rows[0].total);

        const transactionsCount = await query('SELECT COUNT(*) as total FROM transactions');
        const totalTransactions = parseInt(transactionsCount.rows[0].total);

        // Excluir histórico de itens das ordens
        await query('DELETE FROM exit_order_items_history');

        // Excluir itens das ordens
        await query('DELETE FROM exit_order_items');

        // Excluir ordens de saída
        await query('DELETE FROM exit_orders');

        // Excluir todas as transações (entradas e saídas)
        await query('DELETE FROM transactions');

        // Resetar a sequence das ordens para começar do 1 novamente
        await query("SELECT setval('exit_orders_order_number_seq', 1, false)");

        console.log(`✅ ${totalOrders} ordens e ${totalTransactions} transações excluídas com sucesso`);

        res.json({
            message: 'Todas as movimentações foram excluídas com sucesso',
            total_orders_deleted: totalOrders,
            total_transactions_deleted: totalTransactions,
            details: 'O estoque foi mantido intacto. Apenas as movimentações (entradas, saídas e ordens) foram removidas.'
        });

    } catch (error) {
        console.error('❌ Erro ao excluir movimentações:', error);
        res.status(500).json({
            error: 'Erro ao excluir movimentações',
            details: error.message
        });
    }
});

module.exports = router;
