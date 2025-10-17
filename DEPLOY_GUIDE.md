# 🚀 Guia Completo de Deploy

Este guia te levará do zero até ter o sistema rodando em produção com subdomínio personalizado.

---

## 📋 Pré-requisitos

- [ ] Conta no Railway (https://railway.app) - Grátis
- [ ] Conta no Vercel (https://vercel.com) - Grátis
- [ ] Repositório no GitHub com este código
- [ ] Acesso ao painel de DNS do domínio stonecoin.com.br

---

## 🎯 Arquitetura Final

```
Frontend: https://estoque.stonecoin.com.br
Backend:  https://estoque-api-[random].railway.app
Database: PostgreSQL (Railway)
```

---

## 📦 Parte 1: Deploy do Backend (Railway)

### Passo 1: Criar Projeto no Railway

1. Acesse https://railway.app
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Autorize o Railway a acessar seu GitHub
5. Selecione o repositório **estoque-fotografia**

### Passo 2: Configurar Root Directory

1. Após selecionar o repo, clique em **"Settings"**
2. Em **"Root Directory"**, coloque: `backend`
3. Salvar

### Passo 3: Adicionar PostgreSQL

1. No mesmo projeto, clique em **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway criará automaticamente:
   - ✅ Banco PostgreSQL
   - ✅ Variável `DATABASE_URL` (conectada automaticamente ao backend)

### Passo 4: Configurar Variáveis de Ambiente

1. Clique no serviço do **backend**
2. Vá em **"Variables"**
3. Adicionar as seguintes variáveis:

```bash
NODE_ENV=production

# Gerar JWT Secret (execute no terminal local):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=cole_aqui_o_token_gerado_acima

# Frontend URL (vai ser configurado depois)
FRONTEND_URL=https://estoque.stonecoin.com.br
```

4. **NÃO precisa** adicionar `DATABASE_URL` - Railway faz isso automaticamente!

### Passo 5: Deploy do Backend

1. Railway detecta automaticamente e faz o deploy
2. Aguarde 2-3 minutos
3. Quando terminar, vá em **"Settings"** → **"Networking"**
4. Clique em **"Generate Domain"**
5. **Copie a URL gerada** (exemplo: `estoque-api-production-abc123.up.railway.app`)

### Passo 6: Verificar se Funcionou

Abra no navegador:
```
https://sua-url.railway.app/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

✅ **Backend pronto!**

---

## 🎨 Parte 2: Deploy do Frontend (Vercel)

### Passo 1: Configurar URL da API

1. **Localmente**, edite o arquivo:
   ```
   frontend/config.js
   ```

2. Na linha 6, substitua:
   ```javascript
   : 'https://seu-backend.railway.app/api', // URL real de produção
   ```

   Por:
   ```javascript
   : 'https://SUA-URL-DO-RAILWAY.up.railway.app/api',
   ```

3. **Commit e push**:
   ```bash
   git add frontend/config.js
   git commit -m "Configura URL da API em produção"
   git push origin main
   ```

### Passo 2: Deploy no Vercel

1. Acesse https://vercel.com
2. Clique em **"Add New..."** → **"Project"**
3. Selecione **"Import Git Repository"**
4. Escolha o repositório **estoque-fotografia**
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: (deixe vazio)
   - **Output Directory**: (deixe vazio ou coloque `.`)

6. Clique em **"Deploy"**
7. Aguarde 1-2 minutos

### Passo 3: Anotar URL Temporária

Vercel vai te dar uma URL temporária tipo:
```
https://estoque-fotografia-abc123.vercel.app
```

✅ **Frontend pronto (temporário)!**

---

## 🌐 Parte 3: Configurar Subdomínio Personalizado

### Passo 1: Adicionar Domínio Customizado no Vercel

1. No dashboard do Vercel, clique no projeto
2. Vá em **"Settings"** → **"Domains"**
3. Adicione: `estoque.stonecoin.com.br`
4. Vercel vai te mostrar o que configurar no DNS

### Passo 2: Configurar DNS (Registro.br / Cloudflare)

#### Se usa Registro.br:

1. Acesse https://registro.br
2. Vá em **"Meus Domínios"** → **stonecoin.com.br**
3. Clique em **"Alterar Servidores DNS"** ou **"Zona DNS"**
4. Adicione um novo registro:

```
Tipo: CNAME
Nome: estoque
Destino: cname.vercel-dns.com
TTL: 3600 (ou deixe padrão)
```

#### Se usa Cloudflare:

1. Acesse Cloudflare Dashboard
2. Selecione **stonecoin.com.br**
3. Vá em **"DNS"** → **"Records"**
4. Clique em **"Add record"**

```
Type: CNAME
Name: estoque
Target: cname.vercel-dns.com
Proxy status: DNS only (nuvem cinza, NÃO laranja)
TTL: Auto
```

5. Salvar

### Passo 3: Aguardar Propagação

- ⏱️ Tempo: 5 minutos a 24 horas (geralmente 15-30 minutos)
- Vercel automaticamente emite certificado SSL

### Passo 4: Verificar

Acesse: https://estoque.stonecoin.com.br

✅ **Sistema completo no ar!**

---

## 🔒 Parte 4: Primeiro Acesso e Configuração

### Criar Conta de Administrador

1. Acesse: https://estoque.stonecoin.com.br
2. Na primeira vez, aparecerá **"Configuração Inicial"**
3. Preencha:
   - **Nome completo**: Seu nome
   - **Usuário**: admin (ou outro)
   - **Senha**: Senha forte (mínimo 6 caracteres)
   - **Confirmar senha**: Mesma senha

4. Clique em **"Criar Conta de Administrador"**

✅ **Pronto! Sistema configurado!**

---

## 🎯 Checklist Final

- [ ] Backend no Railway funcionando
- [ ] PostgreSQL criado no Railway
- [ ] Frontend no Vercel funcionando
- [ ] Subdomínio configurado no DNS
- [ ] HTTPS funcionando (Vercel faz automático)
- [ ] Conta de admin criada
- [ ] Login funcionando
- [ ] Pode cadastrar equipamentos

---

## 🔧 Configurações Adicionais (Opcional)

### Atualizar CORS no Backend

Se tiver problema de CORS depois do deploy:

1. Vá no Railway → Backend → Variables
2. Confirme que `FRONTEND_URL` está correto:
   ```
   FRONTEND_URL=https://estoque.stonecoin.com.br
   ```
3. Redeploy se necessário

### Configurar Domínio Customizado no Railway (Backend)

Opcional - se quiser URL personalizada para a API:

1. Railway → Backend → Settings → Networking
2. Custom Domain: `api-estoque.stonecoin.com.br`
3. Adicionar CNAME no DNS apontando para Railway

---

## 🆘 Troubleshooting

### Backend não sobe:

```bash
# Ver logs no Railway
Railway Dashboard → Backend → Deployments → Clique no deploy → View Logs
```

**Erros comuns:**
- `DATABASE_URL not found` → Verificar se PostgreSQL está linkado
- `JWT_SECRET not found` → Adicionar variável
- Porta errada → Railway define PORT automaticamente, não precisa configurar

### Frontend não conecta na API:

1. Verificar `frontend/config.js` linha 6
2. Testar API manualmente: `https://sua-api.railway.app/api/health`
3. Verificar CORS no backend (variável `FRONTEND_URL`)

### DNS não propaga:

```bash
# Testar DNS (Windows)
nslookup estoque.stonecoin.com.br

# Deve retornar IP do Vercel
```

- Aguardar até 24h
- Limpar cache do DNS: `ipconfig /flushdns` (Windows)
- Testar em modo anônimo do navegador

### Erro de certificado SSL:

- Vercel emite automaticamente
- Aguardar 5-10 minutos após DNS propagar
- Verificar se proxy do Cloudflare está DESLIGADO (nuvem cinza)

---

## 📊 Monitoramento

### Logs do Backend:
```
Railway → Backend → Deployments → View Logs
```

### Logs do Frontend:
```
Vercel → Project → Deployments → View Function Logs
```

### Métricas Railway:
```
Railway → Backend → Metrics
- CPU Usage
- Memory
- Network
```

---

## 🔄 Atualizar o Sistema

### Fazer Mudanças:

```bash
# Editar código localmente
# Exemplo: adicionar nova funcionalidade

git add .
git commit -m "Nova funcionalidade X"
git push origin main
```

### Deploy Automático:
- ✅ Railway detecta push → Faz deploy do backend
- ✅ Vercel detecta push → Faz deploy do frontend
- ⏱️ Tempo total: ~2-3 minutos

---

## 💰 Custos

### Railway (Free Tier):
- ✅ $5 de crédito grátis/mês
- ✅ Backend Node.js: ~$2-3/mês (low traffic)
- ✅ PostgreSQL: Incluído no free tier

### Vercel (Free Tier):
- ✅ 100% gratuito para projetos pessoais
- ✅ Bandwidth ilimitado
- ✅ SSL automático

### **Total estimado: GRÁTIS ou ~$0-3/mês**

---

## 🎉 Sucesso!

Seu sistema está no ar em:

**Frontend**: https://estoque.stonecoin.com.br
**Backend**: https://[seu-projeto].railway.app

---

## 📞 Suporte

Algum problema? Verifique:
1. Logs do Railway
2. Console do navegador (F12)
3. Testar API manualmente
4. Verificar variáveis de ambiente

---

**Última atualização**: 2025
**Versão do guia**: 1.0
