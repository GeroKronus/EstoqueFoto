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
 * Garante que TODAS as tabelas e campos necessários existam
 * Verifica TODAS as features solicitadas pelo usuário
 */
router.post('/ensure-tables', async (req, res) => {
    const client = await pool.connect();
    const results = {
        tables_verified: [],
        tables_created: [],
        columns_added: [],
        indexes_created: [],
        errors: []
    };

    try {
        await client.query('BEGIN');
        console.log('🔍 Verificando TODAS as tabelas e campos necessários...');

        // ========================================
        // 1. TABELA: exit_order_item_history
        // Necessária para: Histórico de modificações de itens em ordens
        // ========================================
        try {
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
            results.tables_verified.push('exit_order_item_history');
            console.log('✅ Tabela exit_order_item_history verificada/criada');
        } catch (error) {
            console.error('❌ Erro ao criar exit_order_item_history:', error.message);
            results.errors.push(`exit_order_item_history: ${error.message}`);
        }

        // ========================================
        // 2. COLUNA: exit_order_items.is_conditional
        // Necessária para: Marcar itens condicionais (podem ser devolvidos)
        // ========================================
        try {
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
                        RAISE NOTICE 'Coluna is_conditional adicionada';
                    END IF;
                END $$;
            `);
            results.columns_added.push('exit_order_items.is_conditional');
            console.log('✅ Coluna is_conditional verificada/criada');
        } catch (error) {
            console.error('❌ Erro ao criar is_conditional:', error.message);
            results.errors.push(`is_conditional: ${error.message}`);
        }

        // ========================================
        // 3. COLUNA: exit_order_items.is_modified
        // Necessária para: Marcar itens que tiveram quantidades modificadas
        // ========================================
        try {
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
                        RAISE NOTICE 'Coluna is_modified adicionada';
                    END IF;
                END $$;
            `);
            results.columns_added.push('exit_order_items.is_modified');
            console.log('✅ Coluna is_modified verificada/criada');
        } catch (error) {
            console.error('❌ Erro ao criar is_modified:', error.message);
            results.errors.push(`is_modified: ${error.message}`);
        }

        // ========================================
        // 4. ÍNDICES para melhor performance
        // ========================================
        try {
            // Índice para buscar histórico por item
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_exit_order_item_history_order_item_id
                ON exit_order_item_history(order_item_id)
            `);
            results.indexes_created.push('idx_exit_order_item_history_order_item_id');

            // Índice para buscar itens condicionais
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_exit_order_items_conditional
                ON exit_order_items(is_conditional)
                WHERE is_conditional = TRUE
            `);
            results.indexes_created.push('idx_exit_order_items_conditional');

            console.log('✅ Índices criados para melhor performance');
        } catch (error) {
            console.error('⚠️ Erro ao criar índices:', error.message);
            results.errors.push(`indexes: ${error.message}`);
        }

        // ========================================
        // 5. VERIFICAR ESTRUTURA DAS TABELAS PRINCIPAIS
        // ========================================
        const mainTables = ['users', 'categories', 'equipment', 'transactions', 'exit_orders', 'exit_order_items'];
        for (const table of mainTables) {
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = $1
                )
            `, [table]);

            if (tableCheck.rows[0].exists) {
                results.tables_verified.push(table);
                console.log(`✅ Tabela ${table} existe`);
            } else {
                results.errors.push(`Tabela essencial ${table} NÃO EXISTE!`);
                console.error(`❌ Tabela ${table} NÃO EXISTE!`);
            }
        }

        await client.query('COMMIT');

        const summary = {
            success: results.errors.length === 0,
            message: results.errors.length === 0
                ? 'Banco de dados completamente configurado e pronto!'
                : 'Algumas tabelas foram configuradas, mas há erros',
            tables_verified: results.tables_verified,
            columns_added: results.columns_added,
            indexes_created: results.indexes_created,
            errors: results.errors,
            timestamp: new Date().toISOString()
        };

        res.json(summary);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro crítico ao verificar banco:', error);

        res.status(500).json({
            error: 'Erro ao verificar/criar estrutura do banco',
            message: error.message,
            details: results
        });
    } finally {
        client.release();
    }
});

/**
 * POST /api/admin/fix-exit-orders-constraint
 * Corrige a constraint de reason na tabela exit_orders
 * Adiciona novos valores: garantia, condicional, instalacao
 */
router.post('/fix-exit-orders-constraint', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🔧 Corrigindo constraint de reason na tabela exit_orders...');

        // Remover constraint antiga
        await client.query(`
            ALTER TABLE exit_orders DROP CONSTRAINT IF EXISTS exit_orders_reason_check
        `);
        console.log('✅ Constraint antiga removida');

        // Adicionar nova constraint com todos os valores
        await client.query(`
            ALTER TABLE exit_orders ADD CONSTRAINT exit_orders_reason_check
                CHECK (reason IN (
                    'venda',
                    'garantia',
                    'condicional',
                    'instalacao',
                    'uso_interno',
                    'perda',
                    'aluguel',
                    'manutencao',
                    'outros'
                ))
        `);
        console.log('✅ Nova constraint criada');

        // Adicionar comentário
        await client.query(`
            COMMENT ON COLUMN exit_orders.reason IS 'Motivo da saída: venda, garantia, condicional, instalacao, uso_interno, perda, aluguel, manutencao, outros'
        `);

        await client.query('COMMIT');
        console.log('✅ Constraint corrigida com sucesso!');

        res.json({
            success: true,
            message: 'Constraint de reason atualizada com sucesso',
            allowed_values: [
                'venda',
                'garantia',
                'condicional',
                'instalacao',
                'uso_interno',
                'perda',
                'aluguel',
                'manutencao',
                'outros'
            ],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao corrigir constraint:', error);

        res.status(500).json({
            error: 'Erro ao corrigir constraint',
            message: error.message,
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack
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

/**
 * GET /api/admin/backup
 * Gera backup completo do banco de dados PostgreSQL
 * Exporta: equipamentos, categorias, transações, ordens de saída e histórico
 * NÃO exporta: usuários (por segurança)
 */
router.get('/backup', async (req, res) => {
    try {
        console.log('📦 Iniciando backup completo do banco de dados...');

        // Buscar todas as tabelas necessárias
        const [categories, equipment, transactions, exitOrders, exitOrderItems, exitOrderHistory] = await Promise.all([
            query('SELECT * FROM categories ORDER BY name'),
            query('SELECT * FROM equipment ORDER BY name'),
            query('SELECT * FROM transactions ORDER BY created_at DESC'),
            query('SELECT * FROM exit_orders ORDER BY created_at DESC'),
            query('SELECT * FROM exit_order_items ORDER BY created_at'),
            query('SELECT * FROM exit_order_items_history ORDER BY changed_at DESC')
        ]);

        const backup = {
            version: '2.0',
            database: 'postgresql',
            backup_date: new Date().toISOString(),
            backup_by: {
                id: req.user.id,
                name: req.user.name,
                username: req.user.username
            },
            data: {
                categories: categories.rows,
                equipment: equipment.rows,
                transactions: transactions.rows,
                exit_orders: exitOrders.rows,
                exit_order_items: exitOrderItems.rows,
                exit_order_item_history: exitOrderHistory.rows
            },
            statistics: {
                total_categories: categories.rows.length,
                total_equipment: equipment.rows.length,
                total_transactions: transactions.rows.length,
                total_exit_orders: exitOrders.rows.length,
                total_exit_order_items: exitOrderItems.rows.length,
                total_history_entries: exitOrderHistory.rows.length
            }
        };

        console.log('✅ Backup gerado com sucesso');
        console.log('📊 Estatísticas:', backup.statistics);

        // Retornar JSON para download
        res.json(backup);

    } catch (error) {
        console.error('❌ Erro ao gerar backup:', error);
        res.status(500).json({
            error: 'Erro ao gerar backup',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/restore
 * Restaura backup completo do banco de dados
 * ATENÇÃO: Esta operação substitui TODOS os dados existentes!
 */
router.post('/restore', async (req, res) => {
    const client = await pool.connect();

    try {
        const backupData = req.body;

        // Validar estrutura do backup
        if (!backupData.version || !backupData.data) {
            return res.status(400).json({
                error: 'Formato de backup inválido',
                message: 'O arquivo de backup não possui a estrutura esperada'
            });
        }

        console.log('📥 Iniciando restauração de backup...');
        console.log('📊 Versão do backup:', backupData.version);
        console.log('📅 Data do backup:', backupData.backup_date);

        await client.query('BEGIN');

        // Função helper para verificar se tabela existe
        const tableExists = async (tableName) => {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = $1
                )
            `, [tableName]);
            return result.rows[0].exists;
        };

        // Limpar dados existentes (na ordem correta)
        console.log('🗑️ Limpando dados existentes...');

        if (await tableExists('exit_order_items_history')) {
            await client.query('DELETE FROM exit_order_items_history');
            console.log('✅ exit_order_items_history limpo');
        }

        if (await tableExists('exit_order_items')) {
            await client.query('DELETE FROM exit_order_items');
            console.log('✅ exit_order_items limpo');
        }

        if (await tableExists('exit_orders')) {
            await client.query('DELETE FROM exit_orders');
            console.log('✅ exit_orders limpo');
        }

        if (await tableExists('transactions')) {
            await client.query('DELETE FROM transactions');
            console.log('✅ transactions limpo');
        }

        if (await tableExists('equipment')) {
            await client.query('DELETE FROM equipment');
            console.log('✅ equipment limpo');
        }

        if (await tableExists('categories')) {
            await client.query('DELETE FROM categories');
            console.log('✅ categories limpo');
        }

        // Restaurar dados (na ordem correta)
        console.log('📥 Restaurando dados...');

        // 1. Categorias
        if (backupData.data.categories && backupData.data.categories.length > 0) {
            for (const category of backupData.data.categories) {
                // Gerar slug se não existir (compatibilidade com backups antigos)
                const slug = category.slug || category.name.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
                    .replace(/^-+|-+$/g, ''); // Remove hífens no início e fim

                const icon = category.icon || '📦'; // Ícone padrão se não existir

                await client.query(`
                    INSERT INTO categories (id, name, slug, icon, description, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [category.id, category.name, slug, icon, category.description, category.created_at, category.updated_at]);
            }
            console.log(`✅ ${backupData.data.categories.length} categorias restauradas`);
        }

        // 2. Equipamentos
        if (backupData.data.equipment && backupData.data.equipment.length > 0) {
            for (const equip of backupData.data.equipment) {
                await client.query(`
                    INSERT INTO equipment (
                        id, category_id, name, quantity, unit, min_stock,
                        current_cost, total_value, location, notes,
                        created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [
                    equip.id, equip.category_id, equip.name, equip.quantity,
                    equip.unit, equip.min_stock, equip.current_cost, equip.total_value,
                    equip.location, equip.notes, equip.created_at, equip.updated_at
                ]);
            }
            console.log(`✅ ${backupData.data.equipment.length} equipamentos restaurados`);
        }

        // 3. Transações
        if (backupData.data.transactions && backupData.data.transactions.length > 0) {
            for (const trans of backupData.data.transactions) {
                await client.query(`
                    INSERT INTO transactions (
                        id, type, equipment_id, equipment_name, category_name,
                        quantity, unit, cost, total_cost, supplier, notes,
                        created_by, user_name, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    trans.id, trans.type, trans.equipment_id, trans.equipment_name,
                    trans.category_name, trans.quantity, trans.unit, trans.cost,
                    trans.total_cost, trans.supplier, trans.notes, trans.created_by,
                    trans.user_name, trans.created_at
                ]);
            }
            console.log(`✅ ${backupData.data.transactions.length} transações restauradas`);
        }

        // 4. Ordens de saída
        if (backupData.data.exit_orders && backupData.data.exit_orders.length > 0) {
            for (const order of backupData.data.exit_orders) {
                // Mapear nomes de colunas (compatibilidade com backups antigos e novos)
                const createdBy = order.created_by || order.created_by_id;
                const cancelledBy = order.cancelled_by || order.cancelled_by_id;

                await client.query(`
                    INSERT INTO exit_orders (
                        id, order_number, status, reason, destination,
                        customer_name, customer_document, notes,
                        created_by, created_at, cancelled_at,
                        cancelled_by, cancellation_reason
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                `, [
                    order.id, order.order_number, order.status, order.reason,
                    order.destination, order.customer_name, order.customer_document,
                    order.notes, createdBy, order.created_at,
                    order.cancelled_at, cancelledBy, order.cancellation_reason
                ]);
            }
            console.log(`✅ ${backupData.data.exit_orders.length} ordens de saída restauradas`);
        }

        // 5. Itens de ordens de saída
        if (backupData.data.exit_order_items && backupData.data.exit_order_items.length > 0) {
            for (const item of backupData.data.exit_order_items) {
                await client.query(`
                    INSERT INTO exit_order_items (
                        id, exit_order_id, equipment_id, equipment_name,
                        quantity, unit, unit_cost, total_cost,
                        is_conditional, is_modified, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    item.id, item.exit_order_id, item.equipment_id,
                    item.equipment_name, item.quantity, item.unit,
                    item.unit_cost, item.total_cost, item.is_conditional,
                    item.is_modified, item.created_at
                ]);
            }
            console.log(`✅ ${backupData.data.exit_order_items.length} itens de ordens restaurados`);
        }

        // 6. Histórico de itens
        if (backupData.data.exit_order_item_history && backupData.data.exit_order_item_history.length > 0) {
            for (const history of backupData.data.exit_order_item_history) {
                // Mapear nomes de colunas (compatibilidade)
                const changedBy = history.changed_by || history.changed_by_id;
                const exitOrderItemId = history.exit_order_item_id || history.order_item_id;

                await client.query(`
                    INSERT INTO exit_order_items_history (
                        id, exit_order_id, exit_order_item_id, equipment_id,
                        previous_quantity, new_quantity, change_type,
                        quantity_difference, changed_by, changed_at, reason
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    history.id,
                    history.exit_order_id,
                    exitOrderItemId,
                    history.equipment_id,
                    history.previous_quantity,
                    history.new_quantity,
                    history.change_type || 'quantity_decreased', // Valor padrão se não existir
                    history.quantity_difference,
                    changedBy,
                    history.changed_at,
                    history.reason
                ]);
            }
            console.log(`✅ ${backupData.data.exit_order_item_history.length} registros de histórico restaurados`);
        }

        await client.query('COMMIT');
        console.log('✅ Backup restaurado com sucesso!');

        res.json({
            success: true,
            message: 'Backup restaurado com sucesso',
            restored: {
                categories: backupData.data.categories?.length || 0,
                equipment: backupData.data.equipment?.length || 0,
                transactions: backupData.data.transactions?.length || 0,
                exit_orders: backupData.data.exit_orders?.length || 0,
                exit_order_items: backupData.data.exit_order_items?.length || 0,
                history_entries: backupData.data.exit_order_item_history?.length || 0
            },
            backup_info: {
                version: backupData.version,
                backup_date: backupData.backup_date,
                backup_by: backupData.backup_by
            },
            restored_by: {
                id: req.user.id,
                name: req.user.name
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao restaurar backup:', error);

        res.status(500).json({
            error: 'Erro ao restaurar backup',
            message: error.message,
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    } finally {
        client.release();
    }
});

module.exports = router;
