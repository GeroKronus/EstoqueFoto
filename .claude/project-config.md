# ⚠️ CONFIGURAÇÕES CRÍTICAS DO PROJETO

## 🔴 IMPORTANTE: Leia SEMPRE antes de fazer commits/push

### 📁 Diretório Correto
- **Working Directory:** `D:\Claude Code\EstoqueFotografia`
- ❌ **NÃO usar:** `D:\ClaudeTeste\estoque-fotografia` (diretório antigo/errado)

### 🌿 Branch para Deploy
- **Branch do Railway:** `main` (NÃO é master!)
- **Comando correto de push:**
  ```bash
  git push origin master:main --force
  ```
  OU
  ```bash
  # Fazer push para ambos os branches
  git push origin master && git push origin master:main --force
  ```

### 📦 Repositório
- **URL:** https://github.com/GeroKronus/EstoqueFoto.git
- **Deploy Automático:** Railway monitora o branch `main`
- **Branches existentes:** `master` (local) e `main` (deploy)

### 🚀 Fluxo de Deploy Correto

1. Fazer alterações no código
2. Adicionar ao git: `git add <arquivos>`
3. Commit: `git commit -m "mensagem"`
4. **SEMPRE fazer push para AMBOS os branches:**
   ```bash
   cd "D:\Claude Code\EstoqueFotografia"
   git push origin master
   git push origin master:main --force
   ```
5. Aguardar deploy automático do Railway (~30-60 segundos)

### 🎨 Padrões de Layout

#### Toggle de Visualização (Cards/Tabela)
- **Estrutura HTML exata (usar em TODOS os módulos):**
  ```html
  <div class="view-mode-toggle">
      <label>Visualização:</label>
      <div class="toggle-buttons">
          <button id="viewModeCards" class="toggle-btn active" onclick="..." title="Visualização em Cards">
              🔲 Cards
          </button>
          <button id="viewModeTable" class="toggle-btn" onclick="..." title="Visualização em Tabela">
              📋 Tabela
          </button>
      </div>
  </div>
  ```

#### Estilos CSS (já existem globalmente em style.css)
- `.view-mode-toggle` - Container do toggle
- `.toggle-buttons` - Container dos botões
- `.toggle-btn` - Estilo dos botões
- `.toggle-btn.active` - Botão ativo (fundo verde #4CAF50)

### 📝 Arquivos Principais

#### Frontend (backend/public/)
- `auth.js` - Login, módulos, interface principal (REFERÊNCIA para layout)
- `serviceOrders.js` - Ordens de Serviço
- `exitOrders.js` - Ordens de Saída
- `style.css` - Estilos globais (compartilhado por todos)
- `api.js` - Comunicação com backend
- `notifications.js` - Sistema de notificações

#### Backend (backend/)
- `server.js` - Servidor Express
- `routes/` - Rotas da API
- `database/` - Conexão e migrações

### 🔧 Comandos Git Essenciais

```bash
# Verificar status
git status

# Ver branch atual e remotos
git branch -a

# Ver últimos commits
git log --oneline -5

# Ver commits do branch main remoto
git log origin/main --oneline -5

# Force push para main (deploy)
git push origin master:main --force

# Fetch atualizações
git fetch origin
```

### ❗ Erros Comuns a EVITAR

1. ❌ Fazer push só para `master` (Railway não vai deployar)
2. ❌ Usar diretório `D:\ClaudeTeste\estoque-fotografia`
3. ❌ Criar estruturas HTML diferentes do padrão do Estoque
4. ❌ Esquecer de adicionar IDs nos botões de toggle
5. ❌ Usar estilos inline em vez das classes globais
6. ❌ **NÃO criar `package.json` na raiz** - O projeto usa apenas `backend/package.json`
7. ❌ **NÃO commitar `node_modules/`** - Sempre usar .gitignore
8. ❌ **NÃO mudar `railway.toml`** para remover `cd backend` - É necessário!

### ✅ Checklist Antes de Fazer Push

- [ ] Estou no diretório correto? (`D:\Claude Code\EstoqueFotografia`)
- [ ] O código segue o padrão visual do módulo Estoque?
- [ ] Fiz commit com mensagem descritiva?
- [ ] Vou fazer push para o branch `main`? (ou ambos master e main)
- [ ] Testei localmente se possível?

---

**Última atualização:** 2025-10-17
**Atualizar este arquivo sempre que houver mudanças críticas no projeto!**
