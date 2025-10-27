# 🔐 CRUD de Estoque - Controle de Permissões por Tipo de Usuário

## 📋 Resumo

O CRUD (Create, Read, Update, Delete) de itens de estoque foi configurado com permissões diferenciadas:
- ✅ **Todos os usuários** podem: visualizar, criar itens e fazer movimentações
- 🔒 **Apenas administradores** podem: editar e deletar itens do cadastro

---

## 🛡️ Proteções Implementadas

### Backend (Rotas API)

**Arquivo:** `backend/routes/equipment.js`

| Método | Rota | Proteção | Descrição |
|--------|------|----------|-----------|
| GET | `/api/equipment` | `authenticateToken` | ✅ Todos os usuários podem listar |
| GET | `/api/equipment/:id` | `authenticateToken` | ✅ Todos os usuários podem visualizar |
| POST | `/api/equipment` | `authenticateToken` | ✅ **Todos os usuários** podem criar |
| PUT | `/api/equipment/:id` | `authenticateToken` + `requireAdmin` | 🔒 **SOMENTE ADMIN** pode editar |
| DELETE | `/api/equipment/:id` | `authenticateToken` + `requireAdmin` | 🔒 **SOMENTE ADMIN** pode deletar |

**Middleware de Autorização:**
- `authenticateToken`: Verifica se o usuário está autenticado
- `requireAdmin`: Verifica se o usuário tem role = 'admin'

**Arquivo de referência:** `backend/middleware/auth.js`

---

### Frontend (Interface do Usuário)

**Arquivos:** `backend/public/auth.js` e `backend/public/script.js`

#### 1. Botão "➕ Novo Item" - **Visível para todos**

**Localização:** Seção de Ações Rápidas no módulo de Estoque

```javascript
// O botão é visível para TODOS os usuários
<button class="btn-warning"
        onclick="showModal('addProductModal')">
    ➕ Novo Item
</button>
```

**Permissão:** Qualquer usuário autenticado pode criar novos itens.

#### 2. Função `addNewProduct()` - **Sem restrição de admin**

**Arquivo:** `backend/public/script.js` (linha ~401)

```javascript
async addNewProduct() {
    // Validação de campos
    if (!category || !name || !unit || isNaN(minStock) || minStock < 1) {
        window.notify.warning('Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
    }

    // Chamada à API - backend verifica apenas autenticação
    await window.api.createEquipment({ ... });
}
```

**Nota:** A verificação de admin foi removida - todos os usuários podem criar itens.

#### 3. Função `deleteProduct()` - **Verificação de Permissão ADMIN**

**Arquivo:** `backend/public/script.js` (linha ~456)

```javascript
async deleteProduct(productId) {
    // Verificação obrigatória no início da função
    if (!photoAuthManager.isAdmin()) {
        window.notify.warning('Apenas administradores podem excluir equipamentos!');
        return;
    }

    // ... restante do código
}
```

#### 4. Botões de Deletar - **Renderização Condicional**

**Cards de Equipamentos:**
```javascript
${photoAuthManager.isAdmin() ? `
    <button class="btn-delete-product" onclick="photoInventory.deleteProduct('${item.id}')">
        🗑️
    </button>
` : ''}
```

**Tabela de Equipamentos:**
```javascript
${photoAuthManager.isAdmin() ? `
    <button class="btn-table-action btn-delete-small"
            onclick="photoInventory.deleteProduct('${item.id}')"
            title="Excluir">
        🗑️
    </button>
` : ''}
```

---

## 🔑 Sistema de Autenticação

### Verificação de Role

**Classe:** `PhotoAuthManager` em `backend/public/auth.js`

```javascript
isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
}

getUserPermissions() {
    if (!this.currentUser) return {
        canResetStock: false,
        canManageUsers: false,
        canViewReports: false,
        canManageInventory: false
    };

    return {
        canResetStock: this.currentUser.role === 'admin',
        canManageUsers: this.currentUser.role === 'admin',
        canViewReports: true,
        canManageInventory: true
    };
}
```

### Usuário Armazenado

O sistema armazena o usuário atual em:
- `localStorage` com chave `estoque_user`
- Token JWT em `localStorage` com chave `estoque_token`
- Objeto global `window.currentUser`
- Propriedade `photoAuthManager.currentUser`

---

## 👥 Permissões por Tipo de Usuário

### 👑 Administrador (role: 'admin')

✅ **Pode fazer TUDO:**
- Ver lista de equipamentos
- ✅ **Criar novos equipamentos**
- ✅ **Editar equipamentos existentes** (exclusivo)
- ✅ **Deletar equipamentos** (exclusivo)
- Fazer movimentações (entrada/saída)
- Criar ordens de saída
- Zerar estoque (reset balanço)
- Gerenciar usuários
- Acessar configurações avançadas

### 👤 Usuário Comum (role: 'user')

✅ **Pode:**
- Ver lista de equipamentos
- ✅ **Criar novos equipamentos**
- Fazer movimentações (entrada/saída)
- Criar ordens de saída
- Ver relatórios
- Gerenciar clientes

❌ **NÃO Pode:**
- ❌ Editar equipamentos existentes
- ❌ Deletar equipamentos
- ❌ Zerar estoque
- ❌ Gerenciar usuários
- ❌ Acessar configurações de admin

---

## 🚨 Tratamento de Erros

### Backend

Quando um usuário sem permissão tenta acessar rotas protegidas:

```json
{
  "error": "Acesso restrito a administradores",
  "code": "ADMIN_REQUIRED"
}
```

**Status HTTP:** `403 Forbidden`

### Frontend

Quando um usuário sem permissão tenta executar ações protegidas:

```javascript
window.notify.warning('Apenas administradores podem [ação]!');
```

A mensagem é exibida como notificação na interface.

---

## 📊 Fluxo de Verificação

### Criar Novo Equipamento

```
1. Usuário clica em "➕ Novo Item"
   └─> Botão visível para TODOS os usuários

2. Modal é aberto (addProductModal)

3. Usuário preenche formulário e submete

4. Frontend: photoInventory.addNewProduct()
   └─> Valida campos obrigatórios
   └─> Nenhuma verificação de admin

5. Backend: POST /api/equipment
   └─> authenticateToken (verifica JWT)
   └─> ✅ Sem verificação de admin

6. Se OK: Equipamento criado
   Se NÃO: Erro 401 se não autenticado
```

### Deletar Equipamento

```
1. Botão "🗑️" visível apenas se isAdmin() === true

2. Usuário clica no botão

3. Frontend: photoInventory.deleteProduct(id)
   └─> Verifica if (!isAdmin()) return

4. Confirmação do usuário

5. Backend: DELETE /api/equipment/:id
   └─> authenticateToken (verifica JWT)
   └─> requireAdmin (verifica role)

6. Se OK: Equipamento marcado como inativo
   Se NÃO: Erro 403 "Acesso restrito"
```

---

## 🧪 Como Testar

### 1. Testar como Administrador

```bash
# Fazer login com usuário admin
# Username: admin
# Password: [senha configurada]

# Verificar que:
- ✅ Botão "➕ Novo Item" está visível
- ✅ Botões "🗑️" aparecem em cards e tabelas
- ✅ Pode criar novo equipamento
- ✅ Pode deletar equipamento
```

### 2. Testar como Usuário Comum

```bash
# Criar um usuário com role='user' via interface admin
# Fazer logout e login com o novo usuário

# Verificar que:
- ✅ Botão "➕ Novo Item" ESTÁ visível
- ✅ PODE criar novos equipamentos
- ❌ Botões "🗑️" NÃO aparecem em cards e tabelas
- ❌ Se tentar deletar via console, recebe erro
```

### 3. Testar via API (Postman/cURL)

```bash
# Login para obter token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"senha"}'

# Tentar criar equipamento (deve falhar)
curl -X POST http://localhost:3001/api/equipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DO_USER" \
  -d '{"name":"Teste","categoryId":1,"unit":"un","minStock":1}'

# Resposta esperada: 403 Forbidden
# {"error":"Acesso restrito a administradores","code":"ADMIN_REQUIRED"}
```

---

## 📝 Observações Importantes

### 1. Soft Delete

Quando um equipamento é deletado, ele **não é removido do banco**, apenas marcado como inativo:

```sql
UPDATE equipment SET active = false WHERE id = :id
```

Isso preserva:
- Histórico de transações
- Integridade referencial
- Auditoria completa

### 2. Movimentações (Entrada/Saída)

**Todos os usuários** podem fazer movimentações de estoque:
- ✅ Entrada de equipamentos
- ✅ Saída de equipamentos
- ✅ Criar ordens de saída
- ✅ **Criar novos itens no cadastro**

Apenas **EDITAR e DELETAR** do cadastro são restritos a admins.

### 3. Edição de Equipamentos

Atualmente **não há interface** para editar equipamentos existentes. A funcionalidade existe no backend (`PUT /api/equipment/:id`) mas não tem modal/formulário no frontend.

**Sugestão futura:** Adicionar botão "✏️ Editar" ao lado do "🗑️ Deletar".

---

## 🔄 Próximos Passos (Opcional)

1. **Adicionar função de editar equipamento**
   - Criar modal `editProductModal`
   - Adicionar botão "✏️" em cards e tabelas
   - Implementar função `editProduct()` com verificação admin

2. **Histórico de alterações**
   - Registrar quem criou/editou/deletou cada equipamento
   - Tabela `equipment_history` similar a `exit_order_items_history`

3. **Permissões granulares**
   - Criar roles: 'admin', 'manager', 'operator', 'viewer'
   - Permitir diferentes níveis de acesso

4. **Auditoria completa**
   - Log de todas as tentativas de acesso não autorizado
   - Dashboard de segurança para admins

---

## ✅ Checklist de Implementação

- [x] Backend: **REMOVER** `requireAdmin` de POST /api/equipment (permitir todos)
- [x] Backend: Manter `requireAdmin` em PUT /api/equipment (apenas admin)
- [x] Backend: Manter `requireAdmin` em DELETE /api/equipment (apenas admin)
- [x] Frontend: Botão "➕ Novo Item" visível para todos
- [x] Frontend: **REMOVER** verificação admin de `addNewProduct()`
- [x] Frontend: Manter proteção em `deleteProduct()` (apenas admin)
- [x] Frontend: Renderização condicional de botões deletar (apenas admin)
- [x] Testar com usuário admin: criar, editar, deletar ✅
- [x] Testar com usuário comum: criar ✅, editar ❌, deletar ❌
- [x] Atualizar documentação ✅

---

**Data da Implementação:** 27/10/2025
**Versão do Sistema:** v2.0
**Autor:** Claude Code AI Assistant
