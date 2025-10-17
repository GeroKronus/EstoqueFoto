-- Script para corrigir a sequence do order_number na tabela exit_orders
-- Este script resolve o erro: duplicate key value violates unique constraint "exit_orders_order_number_key"

-- ===== DIAGNÓSTICO =====
-- 1. Verificar o maior order_number existente na tabela
SELECT 'Maior order_number na tabela:' as info, MAX(order_number) as max_order_number FROM exit_orders;

-- 2. Verificar o valor atual da sequence
SELECT 'Valor atual da sequence:' as info, currval('exit_orders_order_number_seq') as current_value;

-- ===== CORREÇÃO =====
-- 3. Resetar a sequence para o próximo valor disponível após o maior order_number
-- O segundo parâmetro 'false' significa que o próximo nextval() retornará este valor
-- O 'true' significaria que já foi usado e o próximo será +1
SELECT 'Resetando sequence...' as info,
       setval('exit_orders_order_number_seq', (SELECT COALESCE(MAX(order_number), 0) FROM exit_orders) + 1, false) as new_value;

-- ===== VERIFICAÇÃO =====
-- 4. Confirmar que a sequence foi atualizada
SELECT 'Novo valor da sequence:' as info, currval('exit_orders_order_number_seq') as current_value;

-- 5. Teste - simular qual seria o próximo order_number (não salva na sequence)
SELECT 'Próximo order_number será:' as info, nextval('exit_orders_order_number_seq') as next_value;
SELECT 'Voltando a sequence para valor anterior (por ser apenas teste)' as info,
       setval('exit_orders_order_number_seq', currval('exit_orders_order_number_seq') - 1, false) as restored_value;

-- ===== INSTRUÇÕES DE USO =====
-- Para executar no terminal PostgreSQL:
--   psql -U seu_usuario -d nome_do_banco -f fix_order_number_sequence.sql
--
-- Ou copie apenas a linha de correção (linha 14-15) e execute no seu cliente SQL:
--   SELECT setval('exit_orders_order_number_seq', (SELECT COALESCE(MAX(order_number), 0) FROM exit_orders) + 1, false);
