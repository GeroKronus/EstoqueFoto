const express = require('express');
const router = express.Router();
const { query, pool } = require('../database/connection');
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
    let client;

    try {
        client = await pool.connect();

        // Iniciar transação
        await client.query('BEGIN');
        console.log('✅ Transação iniciada');

        // Função helper para deletar de uma tabela se ela existir
        const deleteIfExists = async (tableName) => {
            try {
                const result = await client.query(`
                    DELETE FROM ${tableName} WHERE 1=1
                `);
                console.log(`🗑️ ${result.rowCount} registros deletados de ${tableName}`);
                return result.rowCount;
            } catch (error) {
                if (error.code === '42P01') { // Tabela não existe
                    console.log(`⚠️ Tabela ${tableName} não existe (pulando)`);
                    return 0;
                }
                throw error; // Outros erros devem ser propagados
            }
        };

        // Deletar na ordem correta respeitando foreign keys
        // 1. Excluir histórico de itens de ordens de saída (dependência de exit_order_items)
        const historyDeleted = await deleteIfExists('exit_order_item_history');

        // 2. Excluir itens de ordens de saída (dependência de exit_orders)
        const orderItemsDeleted = await deleteIfExists('exit_order_items');

        // 3. Excluir ordens de saída
        const ordersDeleted = await deleteIfExists('exit_orders');

        // 4. Excluir transações (dependência de equipment)
        const transactionsDeleted = await deleteIfExists('transactions');

        // 5. Resetar quantidades dos equipamentos para zero
        const equipmentResult = await client.query(`
            UPDATE equipment
            SET quantity = 0,
                current_cost = 0,
                total_value = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE 1=1
        `);
        console.log(`🔄 ${equipmentResult.rowCount} equipamentos tiveram quantidades zeradas`);

        // 6. Resetar sequências (auto-increment) das tabelas (se existir)
        try {
            await client.query("SELECT setval('exit_orders_order_number_seq', 1, false)");
            console.log(`🔄 Sequência de order_number resetada`);
        } catch (error) {
            if (error.code === '42P01') {
                console.log('⚠️ Sequência exit_orders_order_number_seq não existe (pulando)');
            } else {
                throw error;
            }
        }

        // Commit da transação
        await client.query('COMMIT');
        console.log('✅ Transação commitada com sucesso');

        // Log da operação
        console.log(`⚠️ RESET DE MOVIMENTOS executado por: ${req.user.name} (ID: ${req.user.id})`);

        res.json({
            message: 'Todos os movimentos foram zerados com sucesso',
            details: {
                exit_order_history_deleted: historyDeleted,
                exit_order_items_deleted: orderItemsDeleted,
                exit_orders_deleted: ordersDeleted,
                transactions_deleted: transactionsDeleted,
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
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log('🔄 Rollback executado');
            } catch (rollbackError) {
                console.error('❌ Erro ao fazer rollback:', rollbackError);
            }
        }

        console.error('❌ Erro ao resetar movimentos:', error);
        console.error('Stack trace:', error.stack);

        res.status(500).json({
            error: 'Erro ao resetar movimentos',
            message: error.message,
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    } finally {
        if (client) {
            client.release();
            console.log('🔌 Conexão liberada');
        }
    }
});

/**
 * POST /api/admin/ensure-tables
 * Garante que todas as tabelas necessárias existam
 */
router.post('/ensure-tables', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🔍 Verificando e criando tabelas faltantes...');

        // 1. Criar tabela exit_order_item_history se não existir
        await client.query(`
            CREATE TABLE IF NOT EXISTS exit_order_item_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_item_id UUID NOT NULL REFERENCES exit_order_items(id) ON DELETE CASCADE,
                previous_quantity DECIMAL(10, 2) NOT NULL,
                new_quantity DECIMAL(10, 2) NOT NULL,
                quantity_difference DECIMAL(10, 2) NOT NULL,
                reason TEXT,
                changed_by_id UUID NOT NULL REFERENCES users(id),
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela exit_order_item_history verificada/criada');

        // 2. Adicionar coluna is_conditional se não existir
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'exit_order_items'
                    AND column_name = 'is_conditional'
                ) THEN
                    ALTER TABLE exit_order_items
                    ADD COLUMN is_conditional BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);
        console.log('✅ Coluna is_conditional verificada/criada');

        // 3. Adicionar coluna is_modified se não existir
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'exit_order_items'
                    AND column_name = 'is_modified'
                ) THEN
                    ALTER TABLE exit_order_items
                    ADD COLUMN is_modified BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);
        console.log('✅ Coluna is_modified verificada/criada');

        await client.query('COMMIT');

        res.json({
            message: 'Todas as tabelas necessárias foram verificadas e criadas',
            tables_created: [
                'exit_order_item_history',
            ],
            columns_added: [
                'exit_order_items.is_conditional',
                'exit_order_items.is_modified'
            ],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao criar tabelas:', error);

        res.status(500).json({
            error: 'Erro ao criar tabelas',
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
