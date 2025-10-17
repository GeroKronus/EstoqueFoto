# Dockerfile para Backend - Estoque Fotografia
FROM node:18-alpine

# Configurar diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema (se necessário)
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte
COPY . .

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs \
    && adduser -S backend -u 1001

# Definir permissões
RUN chown -R backend:nodejs /app
USER backend

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Comando de inicialização
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]