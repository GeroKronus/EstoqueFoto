# ⚡ Início Rápido - 15 Minutos

Coloque seu sistema no ar em 3 passos simples!

---

## 📋 Você vai precisar:

- [ ] Conta GitHub (criar repo com este código)
- [ ] Conta Railway (https://railway.app) - Grátis
- [ ] Conta Vercel (https://vercel.com) - Grátis

---

## 🚀 Passo 1: Criar Repositório GitHub (2 min)

### 1.1 Criar repo no GitHub:
1. Acesse https://github.com/new
2. Nome do repositório: **estoque-fotografia**
3. Privado ou Público (sua escolha)
4. **NÃO** inicializar com README
5. Criar repositório

### 1.2 Fazer push do código:

```bash
cd "D:\ClaudeTeste\estoque-fotografia"

# Adicionar remote
git remote add origin https://github.com/SEU-USUARIO/estoque-fotografia.git

# Push
git branch -M main
git push -u origin main
```

✅ **Código no GitHub!**

---

## 🔧 Passo 2: Deploy Backend (Railway) (5 min)

### 2.1 Criar projeto:
1. Acesse https://railway.app
2. Login com GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Selecionar **estoque-fotografia**

### 2.2 Configurar:
1. Clique em **Settings**
2. **Root Directory**: `backend`
3. Salvar

### 2.3 Adicionar PostgreSQL:
1. **New** → **Database** → **PostgreSQL**
2. Aguardar criar (30 segundos)

### 2.4 Variáveis de ambiente:
1. Clique no serviço **backend**
2. **Variables** → **New Variable**

Adicionar:
```
NODE_ENV=production
```

```
JWT_SECRET=
```
Para gerar JWT_SECRET, execute localmente:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Cole o resultado

```
FRONTEND_URL=https://estoque.stonecoin.com.br
```

3. **Deploy** acontece automaticamente

### 2.5 Pegar URL da API:
1. **Settings** → **Networking** → **Generate Domain**
2. **Copiar a URL** (ex: `estoque-api-production.up.railway.app`)

✅ **Backend rodando!**

Testar: `https://sua-url.railway.app/api/health`

---

## 🎨 Passo 3: Deploy Frontend (Vercel) (8 min)

### 3.1 Configurar URL da API:

**Localmente**, editar:
```
frontend/config.js
```

Linha 6, substituir:
```javascript
: 'https://SUA-URL-DO-RAILWAY.up.railway.app/api',
```

Commit:
```bash
git add frontend/config.js
git commit -m "Configura URL da API"
git push origin main
```

### 3.2 Deploy no Vercel:
1. Acesse https://vercel.com
2. **New Project**
3. **Import** repositório **estoque-fotografia**
4. Configurar:
   - **Root Directory**: `frontend`
   - **Framework**: Other
   - **Build Command**: (vazio)
   - **Output Directory**: `.`
5. **Deploy**

Aguardar 1-2 minutos.

### 3.3 Configurar Subdomínio:

**No Vercel:**
1. **Settings** → **Domains**
2. Adicionar: `estoque.stonecoin.com.br`

**No painel DNS (Registro.br/Cloudflare):**

Adicionar registro CNAME:
```
Tipo: CNAME
Nome: estoque
Destino: cname.vercel-dns.com
```

Aguardar propagação (5-30 minutos).

✅ **Sistema completo no ar!**

---

## 🎯 Acessar o Sistema:

```
https://estoque.stonecoin.com.br
```

### Primeiro Acesso:
1. Aparecerá **"Configuração Inicial"**
2. Criar conta de administrador
3. Pronto!

---

## 📊 Resumo das URLs:

| Serviço | URL | Status |
|---------|-----|--------|
| Frontend | https://estoque.stonecoin.com.br | ✅ Público |
| Backend | https://[seu-projeto].railway.app | ✅ API |
| Database | (interno Railway) | 🔒 Privado |

---

## 🆘 Problemas Comuns:

### Backend não sobe:
```
Railway → Backend → Deployments → View Logs
```
Verificar variáveis de ambiente.

### Frontend não conecta:
Verificar `frontend/config.js` linha 6 com URL correta.

### DNS não funciona:
- Aguardar até 24h
- Testar: `nslookup estoque.stonecoin.com.br`
- Limpar cache: `ipconfig /flushdns`

---

## 📖 Documentação Completa:

Veja `DEPLOY_GUIDE.md` para guia detalhado passo a passo.

---

## 🎉 Pronto!

Sistema isolado, seguro e profissional rodando em:
**https://estoque.stonecoin.com.br**

**Totalmente separado do stonecoin principal!** ✅
