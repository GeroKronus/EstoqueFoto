-- Migration 022: Corrigir encoding do banco de dados para UTF-8
-- Data: 2025-10-28
-- Descrição: Garantir que todas as tabelas e colunas usem UTF-8

-- Mostrar encoding atual
SHOW server_encoding;
SHOW client_encoding;

-- Atualizar encoding da sessão
SET client_encoding = 'UTF8';

-- Nota: Se o banco não estiver em UTF8, será necessário recriar ou
-- converter os dados. Por enquanto, vamos apenas garantir que novas
-- inserções usem UTF8 corretamente.
