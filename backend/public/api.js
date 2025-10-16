// Módulo de API para comunicação com o backend

class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    // Método genérico para fazer requests
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        };

        // Adicionar token de autorização se existir
        const token = getAuthToken();
        if (token) {
            defaultOptions.headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, defaultOptions);

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            const isJson = contentType && contentType.includes('application/json');

            const data = isJson ? await response.json() : await response.text();

            if (!response.ok) {
                // Se token expirou, limpar autenticação
                if (response.status === 401) {
                    clearAuth();
                    window.location.reload();
                    return;
                }

                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error(`Erro na API (${endpoint}):`, error);
            throw error;
        }
    }

    // === AUTENTICAÇÃO ===
    async login(username, password) {
        return this.request(CONFIG.ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async register(userData) {
        return this.request(CONFIG.ENDPOINTS.AUTH.REGISTER, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getMe() {
        return this.request(CONFIG.ENDPOINTS.AUTH.ME);
    }

    async changePassword(currentPassword, newPassword) {
        return this.request(CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    async logout() {
        try {
            await this.request(CONFIG.ENDPOINTS.AUTH.LOGOUT, { method: 'POST' });
        } catch (error) {
            console.warn('Erro no logout da API:', error);
        } finally {
            clearAuth();
        }
    }

    // === CATEGORIAS ===
    async getCategories() {
        return this.request(CONFIG.ENDPOINTS.CATEGORIES);
    }

    async getCategory(id) {
        return this.request(`${CONFIG.ENDPOINTS.CATEGORIES}/${id}`);
    }

    async createCategory(categoryData) {
        return this.request(CONFIG.ENDPOINTS.CATEGORIES, {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    }

    async updateCategory(id, categoryData) {
        return this.request(`${CONFIG.ENDPOINTS.CATEGORIES}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    }

    async deleteCategory(id) {
        return this.request(`${CONFIG.ENDPOINTS.CATEGORIES}/${id}`, {
            method: 'DELETE'
        });
    }

    // === EQUIPAMENTOS ===
    async getEquipment(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${CONFIG.ENDPOINTS.EQUIPMENT}?${queryString}` : CONFIG.ENDPOINTS.EQUIPMENT;
        return this.request(endpoint);
    }

    async getEquipmentById(id) {
        return this.request(`${CONFIG.ENDPOINTS.EQUIPMENT}/${id}`);
    }

    async createEquipment(equipmentData) {
        return this.request(CONFIG.ENDPOINTS.EQUIPMENT, {
            method: 'POST',
            body: JSON.stringify(equipmentData)
        });
    }

    async updateEquipment(id, equipmentData) {
        return this.request(`${CONFIG.ENDPOINTS.EQUIPMENT}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(equipmentData)
        });
    }

    async deleteEquipment(id) {
        return this.request(`${CONFIG.ENDPOINTS.EQUIPMENT}/${id}`, {
            method: 'DELETE'
        });
    }

    // === TRANSAÇÕES ===
    async getTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${CONFIG.ENDPOINTS.TRANSACTIONS}?${queryString}` : CONFIG.ENDPOINTS.TRANSACTIONS;
        return this.request(endpoint);
    }

    async createEntry(entryData) {
        return this.request(`${CONFIG.ENDPOINTS.TRANSACTIONS}/entry`, {
            method: 'POST',
            body: JSON.stringify(entryData)
        });
    }

    async createExit(exitData) {
        return this.request(`${CONFIG.ENDPOINTS.TRANSACTIONS}/exit`, {
            method: 'POST',
            body: JSON.stringify(exitData)
        });
    }

    async getTransactionsSummary(period = 30) {
        return this.request(`${CONFIG.ENDPOINTS.TRANSACTIONS}/summary?period=${period}`);
    }

    // === USUÁRIOS ===
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${CONFIG.ENDPOINTS.USERS}?${queryString}` : CONFIG.ENDPOINTS.USERS;
        return this.request(endpoint);
    }

    async getUser(id) {
        return this.request(`${CONFIG.ENDPOINTS.USERS}/${id}`);
    }

    async createUser(userData) {
        return this.request(CONFIG.ENDPOINTS.USERS, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(id, userData) {
        return this.request(`${CONFIG.ENDPOINTS.USERS}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deactivateUser(id) {
        return this.request(`${CONFIG.ENDPOINTS.USERS}/${id}/deactivate`, {
            method: 'PUT'
        });
    }

    async activateUser(id) {
        return this.request(`${CONFIG.ENDPOINTS.USERS}/${id}/activate`, {
            method: 'PUT'
        });
    }

    async getUsersStats() {
        return this.request(`${CONFIG.ENDPOINTS.USERS}/stats/summary`);
    }

    // === ORDENS DE SAÍDA ===
    async getExitOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${CONFIG.ENDPOINTS.EXIT_ORDERS}?${queryString}` : CONFIG.ENDPOINTS.EXIT_ORDERS;
        return this.request(endpoint);
    }

    async getExitOrder(id) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${id}`);
    }

    async createExitOrder(orderData) {
        return this.request(CONFIG.ENDPOINTS.EXIT_ORDERS, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async cancelExitOrder(id, cancellationReason) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ cancellationReason })
        });
    }

    async updateExitOrderItem(orderId, itemId, newQuantity) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${orderId}/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ newQuantity })
        });
    }

    async deleteExitOrderItem(orderId, itemId) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${orderId}/items/${itemId}`, {
            method: 'DELETE'
        });
    }

    async getExitOrderItemHistory(orderId, itemId) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${orderId}/items/${itemId}/history`);
    }

    async toggleExitOrderItemConditional(orderId, itemId, isConditional) {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/${orderId}/items/${itemId}/conditional`, {
            method: 'PATCH',
            body: JSON.stringify({ isConditional })
        });
    }

    async getConditionalItemsSummary() {
        return this.request(`${CONFIG.ENDPOINTS.EXIT_ORDERS}/conditional/summary`);
    }

    // === ADMINISTRAÇÃO ===
    async ensureTables() {
        return this.request(`${CONFIG.ENDPOINTS.ADMIN}/ensure-tables`, {
            method: 'POST'
        });
    }

    async resetMovements() {
        return this.request(`${CONFIG.ENDPOINTS.ADMIN}/reset-movements`, {
            method: 'POST'
        });
    }

    async getSystemStats() {
        return this.request(`${CONFIG.ENDPOINTS.ADMIN}/system-stats`);
    }

    // === DASHBOARD ===
    async getDashboardData() {
        try {
            const [equipmentData, transactionsSummary, categoriesData] = await Promise.all([
                this.getEquipment({ limit: 1000 }),
                this.getTransactionsSummary(),
                this.getCategories()
            ]);

            return {
                equipment: equipmentData.equipment || [],
                transactions: transactionsSummary || {},
                categories: categoriesData.categories || []
            };
        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
            throw error;
        }
    }
}

// Criar instância global da API
window.api = new ApiService();