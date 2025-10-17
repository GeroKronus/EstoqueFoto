# 📸 Sistema de Estoque PicStone

Sistema profissional de controle de estoque para equipamentos fotográficos com backend Node.js, PostgreSQL e deploy automático no Railway.

## 🚀 Acesso Online

- **Frontend**: https://estoque.stonecoin.com.br
- **API Backend**: https://[seu-projeto].railway.app/api

## ✨ Características

- ✅ Backend Node.js + Express + PostgreSQL
- ✅ Autenticação JWT segura
- ✅ Sistema multi-usuário com roles (Admin/Usuário)
- ✅ API RESTful completa
- ✅ Deploy automático no Railway
- ✅ Frontend responsivo
- ✅ Banco de dados persistente
- ✅ Totalmente isolado de outras aplicações

## 📁 Estrutura

```
estoque-fotografia/
├── backend/           # API Node.js + Express
│   ├── database/     # Migrations SQL
│   ├── middleware/   # Autenticação e validação
│   ├── routes/       # Endpoints da API
│   └── server.js     # Servidor principal
├── frontend/         # Interface HTML/CSS/JS
│   ├── index.html
│   ├── auth.js
│   ├── script.js
│   └── style.css
└── docs/             # Documentação
```

## 🚀 Deploy Rápido

### 1. Backend no Railway

1. **Criar conta**: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. **Selecionar este repositório**
4. **Root Directory**: `/backend`
5. Railway cria PostgreSQL automaticamente

**Variáveis de Ambiente (Railway adiciona automaticamente)**:
- `DATABASE_URL` - ✅ Criado pelo Railway
- `NODE_ENV=production`
- `JWT_SECRET` - Gerar um token seguro
- `PORT` - ✅ Definido pelo Railway

### 2. Frontend (Escolha uma opção)

#### Opção A: Vercel (Recomendado)
1. **Criar conta**: https://vercel.com
2. **New Project** → **Import este repositório**
3. **Root Directory**: `/frontend`
4. **Build Settings**: Nenhum (HTML estático)

#### Opção B: Netlify
1. **Criar conta**: https://netlify.com
2. **New site** → **Import projeto**
3. **Base directory**: `frontend`
4. **Publish directory**: `frontend`

#### Opção C: Railway (junto com backend)
1. **Add Service** no mesmo projeto
2. **Root Directory**: `/frontend`
3. Usar Nginx ou servidor estático

### 3. Configurar DNS

No painel do seu domínio (Registro.br, Cloudflare, etc.):

```
Tipo: CNAME
Nome: estoque
Valor: [seu-projeto].vercel.app
TTL: Auto
```

## 🔧 Desenvolvimento Local

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

### Backend

```bash
cd backend
npm install

# Configurar .env
cp .env.example .env
# Editar DATABASE_URL com suas credenciais

# Executar migrations
npm run migrate

# Iniciar servidor
npm start
# API rodando em http://localhost:3001
```

### Frontend

```bash
cd frontend

# Atualizar config.js com URL da API local
# API_URL=http://localhost:3001/api

# Abrir no navegador
open index.html
# ou usar servidor local:
npx serve .
```

## 📊 API Endpoints

### Autenticação
- `POST /api/auth/register` - Criar primeiro usuário (admin)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário logado
- `PUT /api/auth/change-password` - Alterar senha

### Equipamentos
- `GET /api/equipment` - Listar todos
- `POST /api/equipment` - Criar novo
- `PUT /api/equipment/:id` - Atualizar
- `DELETE /api/equipment/:id` - Deletar (admin)

### Transações
- `GET /api/transactions` - Histórico
- `POST /api/transactions/entry` - Entrada
- `POST /api/transactions/exit` - Saída
- `GET /api/transactions/summary` - Dashboard

### Usuários (Admin)
- `GET /api/users` - Listar
- `POST /api/users` - Criar
- `PUT /api/users/:id/deactivate` - Desativar
- `PUT /api/users/:id/activate` - Reativar

### Categorias
- `GET /api/categories` - Listar todas
- `POST /api/categories` - Criar (admin)

## 🗄️ Banco de Dados

```sql
users           # Usuários do sistema
categories      # Categorias de equipamentos
equipment       # Equipamentos cadastrados
transactions    # Histórico de movimentações
```

## 🔐 Segurança

- ✅ JWT com expiração de 24h
- ✅ Senhas com bcrypt (10 rounds)
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet.js para headers seguros
- ✅ CORS configurado
- ✅ Validação de inputs
- ✅ SQL injection prevention

## 📖 Documentação Completa

Veja a pasta `/docs` para:
- Guia de deploy detalhado
- Documentação da API
- Troubleshooting
- Exemplos de uso

## 🆘 Suporte

### Logs Railway
```bash
# No dashboard do Railway
Project → Deployments → Ver logs
```

### Health Check
```bash
curl https://sua-api.railway.app/api/health
```

### Reset de Banco (desenvolvimento)
```bash
cd backend
npm run migrate:reset
```

## 🎯 Funcionalidades

### ✅ Gestão de Estoque
- Cadastro de equipamentos
- 4 categorias padrão (expansível)
- Controle de quantidade
- Alertas de estoque baixo
- Datas de validade

### ✅ Movimentações
- Entrada de produtos
- Saída (aluguel, venda, uso)
- Histórico completo
- Auditoria por usuário

### ✅ Dashboard
- Resumo em tempo real
- Estatísticas
- Alertas
- Valor total do estoque

### ✅ Multi-usuário
- Roles: Admin e Usuário
- Permissões granulares
- Auditoria de ações

## 📄 Licença

MIT License - Uso livre para fins comerciais e pessoais.

## 🏗️ Status

✅ **Pronto para produção**

Versão: 1.0.0
Última atualização: 2025
