// Configuração da API
const CONFIG = {
    // URL base da API
    API_BASE_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3001/api'
        : 'https://estoquefoto-production.up.railway.app/api', // URL real de produção

    // Configurações de requests
    REQUEST_TIMEOUT: 30000, // 30 segundos

    // Configurações de autenticação
    TOKEN_KEY: 'photo_auth_token',
    USER_KEY: 'photo_current_user',

    // Configurações de paginação
    DEFAULT_PAGE_SIZE: 100,

    // Configurações de cache
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutos

    // Endpoints da API
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/auth/login',
            REGISTER: '/auth/register',
            ME: '/auth/me',
            CHANGE_PASSWORD: '/auth/change-password',
            LOGOUT: '/auth/logout'
        },
        CATEGORIES: '/categories',
        EQUIPMENT: '/equipment',
        TRANSACTIONS: '/transactions',
        USERS: '/users',
        EXIT_ORDERS: '/exit-orders'
    }
};

// Função helper para construir URLs da API
function getApiUrl(endpoint) {
    return CONFIG.API_BASE_URL + endpoint;
}

// Função para obter token de autenticação
function getAuthToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
}

// Função para definir token de autenticação
function setAuthToken(token) {
    if (token) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
    } else {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
    }
}

// Função para obter usuário atual
function getCurrentUser() {
    const userStr = localStorage.getItem(CONFIG.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
}

// Função para definir usuário atual
function setCurrentUser(user) {
    if (user) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(CONFIG.USER_KEY);
    }
}

// Função para limpar dados de autenticação
function clearAuth() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
}

// Função para fazer requests autenticados
async function authenticatedRequest(url, options = {}) {
    const token = getAuthToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);

        // Se token expirou, redirecionar para login
        if (response.status === 401) {
            clearAuth();
            window.location.reload();
            return;
        }

        return response;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Função para exibir notificações
function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Adicionar estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
    `;

    // Cores por tipo
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };

    notification.style.backgroundColor = colors[type] || colors.info;

    // Adicionar ao DOM
    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 100);

    // Remover após 5 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Função para formatar datas
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Função para formatar data e hora
function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

// Função para formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

// Exportar configurações (para usar em módulos)
window.CONFIG = CONFIG;
window.getApiUrl = getApiUrl;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.clearAuth = clearAuth;
window.authenticatedRequest = authenticatedRequest;
window.showNotification = showNotification;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;