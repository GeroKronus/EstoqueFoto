# Configuração do Projeto - Estoque Fotografia

## Informações Essenciais

### Diretórios
- **Diretório de Trabalho**: `D:\ClaudeTeste\estoque-fotografia`
- **Working Directory para Git**: `/d/ClaudeTeste/estoque-fotografia`
- **Backend**: `D:\ClaudeTeste\estoque-fotografia\backend`
- **Frontend (public)**: `D:\ClaudeTeste\estoque-fotografia\backend\public`
- **Database**: `D:\ClaudeTeste\estoque-fotografia\backend\database`

### Git & GitHub
- **Repositório Remoto**: `https://github.com/GeroKronus/EstoqueFoto.git`
- **Branch Principal**: `main`
- **Push Automático**: Sempre fazer push após commit (padrão do projeto)

### Arquivos Principais
- **Frontend**:
  - `backend/public/script.js` - Funções gerais e gerenciamento
  - `backend/public/exitOrders.js` - Gerenciamento de ordens de saída
  - `backend/public/auth.js` - Interface de autenticação e admin
  - `backend/public/index.html` - HTML principal
  - `backend/public/style.css` - Estilos

- **Backend**:
  - `backend/routes/exitOrders.js` - Rotas API de ordens de saída
  - `backend/routes/migrations.js` - Rotas para executar migrations
  - `backend/database/connection.js` - Conexão com PostgreSQL
  - `backend/middleware/auth.js` - Middleware de autenticação

- **Database**:
  - `backend/database/migrations/` - Arquivos SQL de migration
  - `backend/database/runMigration*.js` - Scripts para executar migrations

### Comandos Git Frequentes
```bash
# SEMPRE usar este diretório base:
cd /d/ClaudeTeste/estoque-fotografia

# Verificar status
git status

# Adicionar e commitar
git add -A
git commit -m "mensagem"

# Push (SEMPRE fazer após commit)
git push
```

### Padrão de Commit
```
Título curto e descritivo

- Detalhe 1
- Detalhe 2
- Detalhe 3

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Tecnologias
- **Frontend**: Vanilla JavaScript (sem frameworks)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Autenticação**: JWT
- **Hosting**: Render.com

### Preferências do Usuário
- Comunicação sempre em português
- Push automático após cada commit
- Usar TodoWrite para tarefas complexas (3+ passos)
- Commits descritivos com emoji do Claude Code

### Migrations Executadas
- 007: Criar tabelas exit_orders e exit_order_items
- 008: Criar tabela exit_order_items_history
- 009: Adicionar coluna is_conditional em exit_order_items
- 011: Permitir quantidade >= 0 em exit_order_items

## Notas Importantes
1. NUNCA esquecer de usar `/d/ClaudeTeste/estoque-fotografia` para comandos git
2. SEMPRE fazer push após commit (é o padrão do projeto)
3. Verificar `git status` antes de qualquer operação git
4. O working directory do Claude Code pode ser diferente do diretório do projeto
