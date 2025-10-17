# Instruções de Deploy - Estoque de Fotografia no Railway

## Cenário: Deploy via GitHub no Railway (www.stonecoin.com.br)

### Opção 1: Node.js/Express

#### 1. Estrutura de Pastas no Repositório
```
seu-repo/
├── server.js (ou app.js, index.js)
├── public/
│   └── estoque/
│       ├── index.html
│       ├── auth.js
│       ├── database.js
│       ├── script.js
│       └── style.css
├── package.json
└── ...
```

#### 2. Configuração do Express (adicionar no seu server.js)
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));

// Rota específica para o estoque
app.get('/estoque', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'estoque', 'index.html'));
});

// Suas outras rotas...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

---

### Opção 2: Next.js

#### 1. Estrutura de Pastas
```
seu-repo/
├── pages/
├── public/
│   └── estoque/
│       ├── index.html
│       ├── auth.js
│       ├── database.js
│       ├── script.js
│       └── style.css
├── next.config.js
└── ...
```

#### 2. Configuração do Next.js (next.config.js)
```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/estoque',
        destination: '/estoque/index.html',
      },
    ];
  },
}
```

#### 3. Criar página em pages/estoque/index.js (ALTERNATIVA)
```javascript
export default function Estoque() {
  return (
    <iframe
      src="/estoque/index.html"
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  );
}
```

---

### Opção 3: Aplicação Estática Pura (HTML/PHP)

#### 1. Estrutura
```
seu-repo/
├── index.html (ou index.php)
├── estoque/
│   ├── index.html
│   ├── auth.js
│   ├── database.js
│   ├── script.js
│   └── style.css
└── ...
```

#### 2. Configuração no Railway
- Nenhuma configuração adicional necessária
- Acesso direto via: www.stonecoin.com.br/estoque/

---

### Opção 4: Python/Flask

#### 1. Estrutura
```
seu-repo/
├── app.py
├── static/
│   └── estoque/
│       ├── index.html
│       ├── auth.js
│       ├── database.js
│       ├── script.js
│       └── style.css
└── ...
```

#### 2. Configuração no Flask (app.py)
```python
from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='static')

@app.route('/estoque')
def estoque():
    return send_from_directory('static/estoque', 'index.html')

@app.route('/estoque/<path:filename>')
def estoque_assets(filename):
    return send_from_directory('static/estoque', filename)

# Suas outras rotas...

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

---

## 🚀 Passo a Passo de Deploy

### 1. Preparar os Arquivos Localmente
```bash
# No seu repositório local
mkdir -p public/estoque  # ou static/estoque dependendo da stack

# Copiar os 5 arquivos para a pasta estoque
cp index.html auth.js database.js script.js style.css public/estoque/
```

### 2. Commit e Push para GitHub
```bash
git add .
git commit -m "Adiciona sistema de estoque em /estoque"
git push origin main  # ou master
```

### 3. Deploy Automático no Railway
- Railway detectará o push automaticamente
- Fará o build e deploy
- Aguarde 1-2 minutos

### 4. Testar
Acesse: https://www.stonecoin.com.br/estoque

---

## ⚠️ IMPORTANTE: Ajustes de Segurança

### Problema: LocalStorage em Produção
Como os dados ficam apenas no navegador, **qualquer pessoa pode ver e modificar**:
- Senhas (mesmo com hash)
- Dados do estoque
- Transações

### Soluções:

#### Solução 1: Proteção por Senha HTTP (Temporária)
Adicionar autenticação básica HTTP antes de acessar a página.

**No Express:**
```javascript
const basicAuth = require('express-basic-auth');

app.use('/estoque', basicAuth({
  users: { 'admin': 'senha-forte-aqui' },
  challenge: true,
  realm: 'Estoque Fotografia'
}));
```

#### Solução 2: Adicionar Backend (Recomendado)
- Criar API REST para salvar dados em banco de dados
- Usar JWT para autenticação
- Proteger rotas com middleware

#### Solução 3: Firebase/Supabase (Rápido)
- Adicionar Firebase Authentication
- Usar Firestore para dados
- Mantém o front-end como está

---

## 🔒 Recomendação de Segurança

Para uso profissional, você DEVE:
1. ✅ Migrar localStorage para banco de dados
2. ✅ Implementar autenticação real (JWT, OAuth)
3. ✅ Usar HTTPS (Railway já fornece)
4. ✅ Sanitizar inputs (prevenir XSS)
5. ✅ Validar dados no servidor

**Se precisar de ajuda para implementar backend seguro, é só pedir!**

---

## 📞 Próximos Passos

1. Me informe qual stack você usa (Node.js, Next.js, Python, etc.)
2. Eu ajusto as instruções específicas para seu caso
3. Você faz o commit e push
4. Railway faz o deploy automaticamente
5. Testamos juntos

**Qual stack você usa no stonecoin.com.br?**
