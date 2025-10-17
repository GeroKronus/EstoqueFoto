#!/bin/bash
# Script para detectar a stack do projeto

echo "🔍 Detector de Stack - Stonecoin.com.br"
echo "========================================="
echo ""

# Verificar Node.js
if [ -f "package.json" ]; then
    echo "✅ DETECTADO: Node.js"
    echo ""
    echo "Detalhes do package.json:"

    # Verificar Next.js
    if grep -q "next" package.json; then
        echo "  → Framework: Next.js"
    fi

    # Verificar Express
    if grep -q "express" package.json; then
        echo "  → Framework: Express"
    fi

    # Verificar React
    if grep -q "react" package.json; then
        echo "  → Frontend: React"
    fi

    echo ""
    echo "Scripts disponíveis:"
    grep -A 10 '"scripts"' package.json | head -15

    exit 0
fi

# Verificar Python
if [ -f "requirements.txt" ] || [ -f "Pipfile" ] || [ -f "pyproject.toml" ]; then
    echo "✅ DETECTADO: Python"

    if [ -f "requirements.txt" ]; then
        echo ""
        echo "Dependências (requirements.txt):"
        cat requirements.txt | head -10

        # Verificar Flask
        if grep -q "Flask" requirements.txt; then
            echo "  → Framework: Flask"
        fi

        # Verificar Django
        if grep -q "Django" requirements.txt; then
            echo "  → Framework: Django"
        fi
    fi

    exit 0
fi

# Verificar PHP
if [ -f "composer.json" ] || [ -f "index.php" ]; then
    echo "✅ DETECTADO: PHP"

    if [ -f "composer.json" ]; then
        echo ""
        echo "Composer encontrado:"
        cat composer.json | head -20
    fi

    exit 0
fi

# Verificar Go
if [ -f "go.mod" ]; then
    echo "✅ DETECTADO: Go"
    exit 0
fi

# Verificar Ruby
if [ -f "Gemfile" ]; then
    echo "✅ DETECTADO: Ruby (Rails/Sinatra)"
    exit 0
fi

# Se chegou aqui, pode ser HTML estático
if [ -f "index.html" ]; then
    echo "✅ DETECTADO: HTML Estático (sem backend)"
    echo ""
    echo "Arquivos encontrados:"
    ls -la *.html 2>/dev/null
    exit 0
fi

echo "❌ Não foi possível detectar a stack automaticamente"
echo ""
echo "Arquivos na raiz do projeto:"
ls -la

exit 1
