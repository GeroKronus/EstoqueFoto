class PhotoAuthManager {
    constructor() {
        this.currentUser = null;
        this.isFirstAccess = false;

        console.log('🔐 PhotoAuthManager iniciando (modo PostgreSQL)...');

        // Verificar se já existe sessão ativa (JWT token)
        this.checkExistingSession();
    }

    async checkExistingSession() {
        const token = getAuthToken();

        if (token) {
            console.log('✅ Token JWT encontrado, verificando no backend...');
            try {
                // Verificar token no backend
                const userData = await window.api.getMe();
                this.currentUser = userData.user;
                console.log('✅ Sessão restaurada para:', this.currentUser.name);
                this.loadSystemInterface();
                return;
            } catch (error) {
                console.warn('⚠️ Token inválido ou expirado, redirecionando para login');
                clearAuth();
            }
        }

        // Sem token válido, mostrar login
        this.showLogin();
    }

    showLogin() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <h2>📸 Sistema de Estoque de Fotografia</h2>
                    <p>Controle profissional de equipamentos e materiais fotográficos</p>

                    <form id="loginForm" class="auth-form">
                        <div class="form-group">
                            <label>Usuário:</label>
                            <input type="text" id="loginUsername" required placeholder="Digite seu usuário" autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label>Senha:</label>
                            <input type="password" id="loginPassword" required placeholder="Digite sua senha" autocomplete="current-password">
                        </div>
                        <button type="submit" class="auth-btn-primary">Entrar no Sistema</button>
                    </form>

                    <div class="auth-footer">
                        <small>Sistema de Controle de Estoque Fotográfico v2.0 (PostgreSQL)</small>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        console.log('🔑 Tentativa de login via API:', username);

        if (!username || !password) {
            alert('Por favor, preencha usuário e senha!');
            return;
        }

        try {
            // Login via API backend
            const response = await window.api.login(username, password);

            if (response.token && response.user) {
                // Salvar JWT token
                setAuthToken(response.token);

                // Salvar dados do usuário
                this.currentUser = response.user;
                setCurrentUser(response.user);

                console.log('✅ Login bem-sucedido via API:', response.user.name);
                this.loadSystemInterface();
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (error) {
            console.error('❌ Erro no login:', error);
            alert('❌ ' + (error.message || 'Erro ao fazer login. Verifique suas credenciais.'));
        }
    }

    async logout() {
        try {
            await window.api.logout();
        } catch (error) {
            console.warn('Erro no logout:', error);
        }

        this.currentUser = null;
        clearAuth();
        this.showLogin();
    }

    getCurrentUser() {
        return this.currentUser;
    }

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

    loadSystemInterface() {
        const isAdmin = this.isAdmin();
        const adminClass = isAdmin ? 'admin-only show-admin' : 'admin-only';
        const adminStyle = isAdmin ? '' : 'display: none;';

        console.log('🎨 Carregando interface do sistema para:', this.currentUser.name, '(Admin:', isAdmin, ')');

        document.body.innerHTML = `
            <div class="container">
                <header>
                    <div class="header-content">
                        <div class="header-title">
                            <h1>📸 Sistema de Estoque Fotográfico</h1>
                            <p>Controle Profissional de Equipamentos e Materiais</p>
                        </div>
                        <div class="header-user">
                            <span id="currentUserInfo">👤 ${this.currentUser.name} ${isAdmin ? '👑' : ''}</span>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <nav class="main-nav">
                    <button class="nav-btn active" data-section="inventory">Estoque</button>
                    <button class="nav-btn" data-section="transactions">Movimentações</button>
                    <button class="nav-btn" data-section="reports">Relatórios</button>
                    <button class="nav-btn" data-section="settings">Configurações</button>
                    <button class="nav-btn ${adminClass}" data-section="users" style="${adminStyle}">👥 Usuários</button>
                </nav>

                <div id="inventory-section" class="section active">
                    <div class="controls">
                        <div class="quick-actions">
                            <h2>Ações Rápidas</h2>
                            <div class="action-buttons">
                                <button class="btn-primary" onclick="showModal('entryModal')">📥 Entrada</button>
                                <button class="btn-secondary" onclick="showModal('exitModal')">📤 Saída</button>
                                <button class="btn-warning" onclick="showModal('addProductModal')">➕ Novo Item</button>
                                <button class="btn-info ${adminClass}" onclick="photoInventory.resetInventory()" style="${adminStyle}">🔄 Reset Balanço</button>
                                <button class="btn-success" onclick="exportInventory()">📊 Exportar</button>
                            </div>
                        </div>

                        <div class="filters">
                            <h2>Filtros</h2>
                            <select id="filterCategory">
                                <option value="">Todas as categorias</option>
                            </select>
                            <input type="text" id="searchItem" placeholder="Buscar por nome">
                            <select id="stockFilter">
                                <option value="">Todos os estoques</option>
                                <option value="zero">Estoque Zero</option>
                                <option value="low">Estoque Baixo</option>
                                <option value="expired">Vencidos</option>
                            </select>
                        </div>
                    </div>

                    <div class="inventory-grid" id="inventoryGrid">
                        <!-- Categorias serão carregadas dinamicamente via API -->
                    </div>
                </div>

                <div id="transactions-section" class="section">
                    <div class="transaction-controls">
                        <h2>Histórico de Movimentações</h2>
                        <div class="date-filters">
                            <input type="date" id="dateFrom" placeholder="Data inicial">
                            <input type="date" id="dateTo" placeholder="Data final">
                            <select id="transactionType">
                                <option value="">Todos os tipos</option>
                                <option value="entrada">Entradas</option>
                                <option value="saida">Saídas</option>
                            </select>
                            <button onclick="filterTransactions()">Filtrar</button>
                        </div>
                    </div>
                    <div id="transactionsList" class="transactions-list"></div>
                </div>

                <div id="reports-section" class="section">
                    <div class="reports-grid">
                        <div class="report-card">
                            <h3>📊 Relatório de Movimentação</h3>
                            <p>Entradas e saídas por período</p>
                            <button onclick="generateMovementReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>💰 Relatório Financeiro</h3>
                            <p>Valores de estoque e custos</p>
                            <button onclick="generateFinancialReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>⚠️ Relatório de Alertas</h3>
                            <p>Itens vencidos e estoque baixo</p>
                            <button onclick="generateAlertsReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>📈 Relatório Gerencial</h3>
                            <p>Análise completa do estoque</p>
                            <button onclick="generateManagerialReport()">Gerar Relatório</button>
                        </div>
                    </div>
                    <div id="reportContent" class="report-content"></div>
                </div>

                <div id="settings-section" class="section">
                    <div class="settings-grid">
                        <div class="setting-card">
                            <h3>⚙️ Configurações Gerais</h3>
                            <label>Limite para estoque baixo:</label>
                            <input type="number" id="lowStockLimit" value="2" min="1">
                            <label>Alerta de vencimento (dias):</label>
                            <input type="number" id="expiryAlert" value="30" min="1">
                            <button onclick="saveSettings()">Salvar</button>
                        </div>
                        <div class="setting-card">
                            <h3>💾 Backup e Restauração</h3>
                            <button onclick="exportAllData()">Fazer Backup Completo</button>
                            <input type="file" id="importFile" accept=".json" onchange="importAllData(event)">
                            <label for="importFile" class="file-label">Restaurar Backup</label>
                        </div>
                    </div>
                </div>

                <div id="users-section" class="section">
                    <div class="user-management">
                        <h2>👥 Gerenciamento de Usuários</h2>
                        <div class="user-controls">
                            <button class="btn-primary" onclick="showModal('addUserModal')">➕ Cadastrar Usuário</button>
                        </div>
                        <div id="usersList" class="users-list"></div>
                    </div>
                </div>

                <div class="summary">
                    <h2>Dashboard do Estoque</h2>
                    <div id="stockSummary"></div>
                </div>

                <!-- Modais -->
                <div id="entryModal" class="modal">
                    <div class="modal-content">
                        <h2>📥 Entrada de Equipamentos</h2>
                        <form id="entryForm">
                            <select id="entryItem" required>
                                <option value="">Selecione o equipamento</option>
                            </select>
                            <input type="number" id="entryQuantity" placeholder="Quantidade" required min="0.01" step="0.01">
                            <input type="number" id="entryCost" placeholder="Custo unitário (R$)" min="0" step="0.01">
                            <input type="text" id="entrySupplier" placeholder="Fornecedor">
                            <input type="date" id="entryExpiry">
                            <textarea id="entryNotes" placeholder="Observações"></textarea>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('entryModal')">Cancelar</button>
                                <button type="submit">Registrar Entrada</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="exitModal" class="modal">
                    <div class="modal-content">
                        <h2>📤 Saída de Equipamentos</h2>
                        <form id="exitForm">
                            <select id="exitItem" required>
                                <option value="">Selecione o equipamento</option>
                            </select>
                            <input type="number" id="exitQuantity" placeholder="Quantidade" required min="0.01" step="0.01">
                            <select id="exitReason" required>
                                <option value="">Motivo da saída</option>
                                <option value="aluguel">Aluguel</option>
                                <option value="venda">Venda</option>
                                <option value="manutencao">Manutenção</option>
                                <option value="uso_interno">Uso Interno</option>
                                <option value="perda">Perda/Avaria</option>
                                <option value="outros">Outros</option>
                            </select>
                            <input type="text" id="exitDestination" placeholder="Cliente/Destino">
                            <textarea id="exitNotes" placeholder="Observações"></textarea>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('exitModal')">Cancelar</button>
                                <button type="submit">Registrar Saída</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="addProductModal" class="modal">
                    <div class="modal-content">
                        <h2>➕ Cadastrar Novo Item</h2>
                        <form id="addProductForm">
                            <select id="newProductCategory" required>
                                <option value="">Selecione a categoria</option>
                            </select>
                            <input type="text" id="newProductName" placeholder="Nome do equipamento" required>
                            <input type="text" id="newProductUnit" placeholder="Unidade (un, par, kit, etc.)" required>
                            <input type="number" id="newProductMinStock" placeholder="Estoque mínimo" required min="1" step="1">
                            <input type="number" id="newProductCost" placeholder="Custo médio estimado (R$)" min="0" step="0.01">
                            <input type="text" id="newProductLocation" placeholder="Localização (opcional)">
                            <textarea id="newProductNotes" placeholder="Observações sobre o equipamento"></textarea>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addProductModal')">Cancelar</button>
                                <button type="submit">Cadastrar Item</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="addUserModal" class="modal">
                    <div class="modal-content">
                        <h2>👤 Cadastrar Novo Usuário</h2>
                        <form id="addUserForm">
                            <input type="text" id="newUserName" placeholder="Nome completo" required>
                            <input type="text" id="newUserUsername" placeholder="Nome de usuário" required pattern="[a-zA-Z0-9_]+" title="Apenas letras, números e underscore">
                            <input type="password" id="newUserPassword" placeholder="Senha (mínimo 6 caracteres)" required minlength="6">
                            <input type="password" id="newUserPasswordConfirm" placeholder="Confirmar senha" required>
                            <select id="newUserRole" required>
                                <option value="">Selecione o nível de acesso</option>
                                <option value="user">👤 Usuário Padrão</option>
                                <option value="admin">👑 Administrador</option>
                            </select>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addUserModal')">Cancelar</button>
                                <button type="submit">Cadastrar Usuário</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Configurar evento de logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Inicializar sistema de inventário
        setTimeout(() => {
            console.log('🔧 Inicializando PhotoInventoryManager...');
            if (!window.photoInventory) {
                window.photoInventory = new PhotoInventoryManager();
            }
            window.photoInventory.initialize();
        }, 100);
    }
}

let photoAuthManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM carregado, inicializando autenticação...');
    if (!photoAuthManager) {
        photoAuthManager = new PhotoAuthManager();
    }
});
