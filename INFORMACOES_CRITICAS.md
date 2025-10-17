# ⚠️ INFORMAÇÕES VITAIS E CRÍTICAS DO PROJETO

**NUNCA PERCA ESTAS INFORMAÇÕES!**

---

## 📁 ESTRUTURA DE DIRETÓRIOS

### Diretórios do Projeto
- **`D:\ClaudeTeste\estoque-fotografia`** - DIRETÓRIO PRINCIPAL E CORRETO
  - Este é o diretório com código atualizado
  - Git configurado corretamente
  - Conectado ao repositório GitHub
  - **SEMPRE TRABALHE NESTE DIRETÓRIO**

- **`D:\Claude Code\EstoqueFotografia`** - DIRETÓRIO SECUNDÁRIO
  - Cópia do projeto em outro local
  - Pode ter históricos de git conflitantes
  - NÃO usar como diretório principal

### Regra de Ouro
**SEMPRE use `D:\ClaudeTeste\estoque-fotografia` como diretório de trabalho principal!**

---

## 🌿 BRANCHES GIT

### Branch Correto
- **Branch principal: `main`** (NÃO `master`)
- Railway está configurado para fazer deploy do branch `main`
- SEMPRE commitar e fazer push para `main`

### Comandos Git Essenciais
```bash
# Verificar branch atual
git branch

# Mudar para main se necessário
git checkout main

# Commitar mudanças
git add .
git commit -m "mensagem"

# Push para GitHub
git push origin main
```

---

## 🚂 CONFIGURAÇÃO RAILWAY

### Informações de Deploy
- **URL de Produção:** https://estoque.picstone.com.br
- **Branch de Deploy:** `main`
- **Repositório:** https://github.com/GeroKronus/EstoqueFoto

### Arquivos de Configuração
O Railway usa dois arquivos na **raiz do projeto**:

1. **`railway.toml`**
```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install"

[deploy]
startCommand = "cd backend && node server.js"
restartPolicyType = "always"
```

2. **`nixpacks.toml`**
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["cd backend && npm install"]

[start]
cmd = "cd backend && node server.js"
```

### Pontos Críticos
- ⚠️ **NÃO criar `package.json` na raiz** - O Railway usa `cd backend` para encontrar o package.json correto
- ✅ O `package.json` fica em `backend/package.json`
- ✅ Railway faz build automaticamente quando há push no branch `main`

---

## 📂 ESTRUTURA DO PROJETO

```
estoque-fotografia/
├── backend/
│   ├── node_modules/
│   ├── database/
│   │   ├── connection.js
│   │   ├── migrate.js
│   │   └── migrations/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── customers.js
│   │   ├── inventory.js
│   │   ├── exitOrders.js
│   │   └── serviceOrders.js
│   ├── public/
│   │   ├── index.html
│   │   ├── inventory.js
│   │   ├── customers.js
│   │   ├── exitOrders.js
│   │   └── serviceOrders.js
│   ├── package.json          ← AQUI está o package.json correto
│   ├── server.js
│   └── .env
├── railway.toml              ← Config do Railway na raiz
├── nixpacks.toml             ← Config do Nixpacks na raiz
└── README.md
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

O arquivo `.env` fica em `backend/.env` e contém:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/database
JWT_SECRET=seu_secret_jwt_aqui
PORT=3000
NODE_ENV=production
```

**No Railway**, essas variáveis são configuradas no painel, NÃO no arquivo .env

---

## 🎯 MÓDULOS PRINCIPAIS DO SISTEMA

### 1. Controle de Estoque
- Arquivo: `backend/public/inventory.js`
- Rota: `backend/routes/inventory.js`
- Gerenciamento de produtos, categorias e movimentações

### 2. Ordens de Saída
- Arquivo: `backend/public/exitOrders.js`
- Rota: `backend/routes/exitOrders.js`
- Controle de saídas de estoque

### 3. Clientes
- Arquivo: `backend/public/customers.js`
- Rota: `backend/routes/customers.js`
- Cadastro e gerenciamento de clientes

### 4. Ordens de Serviço ⭐ (RECENTE)
- Arquivo: `backend/public/serviceOrders.js`
- Rota: `backend/routes/serviceOrders.js`
- **Features implementadas:**
  - ✅ Busca multi-campo (OS, cliente, equipamento, defeito)
  - ✅ Toggle Cards/Tabela (padrão: Tabela)
  - ✅ Botão admin "Limpar Testes" (visível apenas para admins)
  - ✅ Tela de detalhes reformulada com cards profissionais
  - ✅ Modal de nova OS com dropdown de clientes funcionando

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema: "refusing to merge unrelated histories"
**Causa:** Tentando merge entre diretórios com históricos git diferentes
**Solução:** Trabalhar apenas em `D:\ClaudeTeste\estoque-fotografia`

### Problema: "Changes not appearing on Railway"
**Causa:** Push feito para branch errado ou Railway configurado errado
**Solução:**
1. Verificar se está no branch `main`: `git branch`
2. Fazer push para `main`: `git push origin main`
3. Verificar Railway settings para confirmar que está deployando do `main`

### Problema: "Railway build failing"
**Causa:** Falta dos arquivos `railway.toml` ou `nixpacks.toml` na raiz
**Solução:** Garantir que ambos os arquivos existem e estão commitados

### Problema: "Customer dropdown showing undefined"
**Causa:** Nome de campos errados (camelCase vs snake_case)
**Solução:** API retorna `nome_fantasia` e `razao_social` (snake_case)

### Problema: "Search causing 500 errors"
**Causa:** Campos NULL não tratados no SQL ILIKE
**Solução:** Usar `COALESCE(campo, '')` para todos os campos na query

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

### 1. Fazer mudanças no código
```bash
cd D:\ClaudeTeste\estoque-fotografia
# Editar arquivos...
```

### 2. Testar localmente
```bash
cd backend
npm install
node server.js
# Abrir http://localhost:3000
```

### 3. Commitar e fazer push
```bash
git add .
git commit -m "feat: Descrição da mudança"
git push origin main
```

### 4. Verificar deploy no Railway
- Railway detecta push automaticamente
- Faz build e deploy
- Verificar em https://estoque.picstone.com.br

---

## 👤 INFORMAÇÕES DO USUÁRIO

- **Nome:** Rogério Isidoro
- **Screenshots:** `C:\Users\Rogério\Pictures\Screenshots`
- **Comando VIC:** Visualizar capturas de tela recentes

---

## 📝 COMMITS IMPORTANTES (HISTÓRICO)

```
a999b0e - feat: Reformular completamente tela de detalhes da OS com layout em cards
e8fe5c9 - fix: Corrigir erro 500 na busca de Ordens de Serviço
038805b - feat: Adicionar botão admin para limpar dados de teste + Tabela como visualização padrão
16e0c11 - fix: Adicionar funcionalidade de busca por texto nas Ordens de Serviço
6a0333f - fix: Corrigir nomes de campos de clientes no dropdown
```

---

## ⚡ COMANDOS RÁPIDOS

```bash
# Ir para diretório correto
cd D:\ClaudeTeste\estoque-fotografia

# Ver status
git status

# Ver branch atual
git branch

# Ver últimos commits
git log --oneline -10

# Push rápido
git add . && git commit -m "mensagem" && git push origin main

# Verificar Railway logs (via gh CLI)
gh api repos/GeroKronus/EstoqueFoto/deployments
```

---

## 🎯 LEMBRETE FINAL

**ESTE ARQUIVO É A FONTE DA VERDADE PARA O PROJETO!**

Sempre consulte este arquivo quando:
- Iniciar uma nova sessão
- Houver dúvidas sobre configuração
- Precisar lembrar da estrutura do projeto
- Houver problemas de deployment

**Mantenha este arquivo atualizado sempre que houver mudanças importantes!**

---

*Última atualização: 17/10/2025*
