const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Aplicar middlewares de autenticação e admin em todas as rotas
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/reset-movements
 * Reseta todos os movimentos, mantendo apenas os itens cadastrados
 * ATENÇÃO: Esta é uma operação DESTRUTIVA e IRREVERSÍVEL!
 */
router.post('/reset-movements', async (req, res) => {
    const client = await require('../database/connection').pool.connect();

    try {
        // Iniciar transação
        await client.query('BEGIN');

        // 1. Excluir histórico de itens de ordens de saída
        const historyResult = await client.query('DELETE FROM exit_order_item_history');
        console.log(`🗑️ ${historyResult.rowCount} registros deletados de exit_order_item_history`);

        // 2. Excluir itens de ordens de saída
        const orderItemsResult = await client.query('DELETE FROM exit_order_items');
        console.log(`🗑️ ${orderItemsResult.rowCount} registros deletados de exit_order_items`);

        // 3. Excluir ordens de saída
        const ordersResult = await client.query('DELETE FROM exit_orders');
        console.log(`🗑️ ${ordersResult.rowCount} registros deletados de exit_orders`);

        // 4. Excluir transações
        const transactionsResult = await client.query('DELETE FROM transactions');
        console.log(`🗑️ ${transactionsResult.rowCount} registros deletados de transactions`);

        // 5. Resetar quantidades dos equipamentos para zero
        const equipmentResult = await client.query(`
            UPDATE equipment
            SET quantity = 0,
                current_cost = 0,
                total_value = 0,
                updated_at = CURRENT_TIMESTAMP
        `);
        console.log(`🔄 ${equipmentResult.rowCount} equipamentos tiveram quantidades zeradas`);

        // 6. Resetar sequências (auto-increment) das tabelas
        await client.query("SELECT setval('exit_orders_order_number_seq', 1, false)");
        console.log(`🔄 Sequência de order_number resetada`);

        // Commit da transação
        await client.query('COMMIT');

        // Log da operação
        console.log(`⚠️ RESET DE MOVIMENTOS executado por: ${req.user.name} (ID: ${req.user.id})`);

        res.json({
            message: 'Todos os movimentos foram zerados com sucesso',
            details: {
                exit_order_history_deleted: historyResult.rowCount,
                exit_order_items_deleted: orderItemsResult.rowCount,
                exit_orders_deleted: ordersResult.rowCount,
                transactions_deleted: transactionsResult.rowCount,
                equipment_reset: equipmentResult.rowCount
            },
            executed_by: {
                id: req.user.id,
                name: req.user.name,
                username: req.user.username
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Rollback em caso de erro
        await client.query('ROLLBACK');
        console.error('❌ Erro ao resetar movimentos:', error);

        res.status(500).json({
            error: 'Erro ao resetar movimentos',
            message: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/admin/system-stats
 * Retorna estatísticas do sistema
 */
router.get('/system-stats', async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM equipment) as total_equipment,
                (SELECT COUNT(*) FROM categories) as total_categories,
                (SELECT COUNT(*) FROM transactions) as total_transactions,
                (SELECT COUNT(*) FROM exit_orders) as total_exit_orders,
                (SELECT COUNT(*) FROM exit_orders WHERE status = 'ativa') as active_exit_orders,
                (SELECT SUM(quantity) FROM equipment) as total_items_in_stock,
                (SELECT SUM(total_value) FROM equipment) as total_inventory_value
        `);

        res.json({
            stats: stats.rows[0],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            error: 'Erro ao obter estatísticas do sistema',
            message: error.message
        });
    }
});

module.exports = router;
