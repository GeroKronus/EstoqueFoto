class PhotoAuthManager {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.isFirstAccess = this.users.length === 0;

        console.log('PhotoAuthManager iniciando...', {
            totalUsers: this.users.length,
            isFirstAccess: this.isFirstAccess,
            adminSetupComplete: localStorage.getItem('photoAdminSetupComplete')
        });

        if (localStorage.getItem('photoAdminSetupComplete') === 'true') {
            localStorage.removeItem('photoAdminSetupComplete');
            if (this.restoreSession()) {
                console.log('Sessão restaurada após setup do admin');
                return;
            }
        }

        const hasSystemElements = document.getElementById('currentUserInfo') !== null;

        if (!hasSystemElements && this.restoreSession()) {
            console.log('Sessão ativa detectada, carregando interface do sistema');
            this.loadSystemInterface();
            return;
        }

        if (this.isFirstAccess) {
            this.showAdminSetup();
        } else {
            this.showLogin();
        }
    }

    loadUsers() {
        const stored = localStorage.getItem('photoSystemUsers');
        return stored ? JSON.parse(stored) : [];
    }

    saveUsers() {
        localStorage.setItem('photoSystemUsers', JSON.stringify(this.users));
    }

    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    createUser(username, password, name, role = 'user') {
        const existingUser = this.users.find(u => u.username === username);
        if (existingUser) {
            throw new Error('Nome de usuário já existe!');
        }

        const newUser = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            username,
            password: this.hashPassword(password),
            name,
            role,
            active: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.users.push(newUser);
        this.saveUsers();
        return newUser;
    }

    login(username, password) {
        const user = this.users.find(u =>
            u.username === username &&
            u.password === this.hashPassword(password) &&
            u.active
        );

        if (!user) {
            throw new Error('Usuário ou senha inválidos, ou usuário inativo!');
        }

        user.lastLogin = new Date().toISOString();
        this.currentUser = user;
        this.saveUsers();
        this.saveCurrentSession();
        return user;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('photoCurrentSession');
        this.showLogin();
    }

    saveCurrentSession() {
        if (this.currentUser) {
            localStorage.setItem('photoCurrentSession', JSON.stringify(this.currentUser));
        }
    }

    restoreSession() {
        const stored = localStorage.getItem('photoCurrentSession');
        if (stored) {
            try {
                const userData = JSON.parse(stored);
                const user = this.users.find(u => u.id === userData.id && u.active);
                if (user) {
                    this.currentUser = user;
                    console.log('Sessão restaurada para:', user.name);
                    return true;
                }
            } catch (error) {
                console.error('Erro ao restaurar sessão:', error);
                localStorage.removeItem('photoCurrentSession');
            }
        }
        return false;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    checkAndInitialize() {
        const userInfoElement = document.getElementById('currentUserInfo');
        const inventorySection = document.getElementById('inventory-section');

        if (userInfoElement && inventorySection && this.currentUser) {
            if (!window.photoInventory || !window.photoInventory.initialized) {
                console.log('Inicializando PhotoInventoryManager...');
                window.photoInventory = new PhotoInventoryManager();
                window.photoInventory.initialize();
            }
            return true;
        }
        return false;
    }

    showAdminSetup() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <h2>🔐 Configuração Inicial do Sistema</h2>
                    <p>Bem-vindo ao Sistema de Estoque de Equipamentos de Fotografia! Este é o primeiro acesso. Crie sua conta de administrador:</p>

                    <form id="adminSetupForm" class="auth-form">
                        <div class="form-group">
                            <label>Nome completo:</label>
                            <input type="text" id="adminName" required placeholder="Seu nome completo">
                        </div>
                        <div class="form-group">
                            <label>Nome de usuário:</label>
                            <input type="text" id="adminUsername" required placeholder="admin" pattern="[a-zA-Z0-9_]+" title="Apenas letras, números e underscore">
                        </div>
                        <div class="form-group">
                            <label>Senha:</label>
                            <input type="password" id="adminPassword" required placeholder="Mínimo 6 caracteres" minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Confirmar senha:</label>
                            <input type="password" id="adminPasswordConfirm" required placeholder="Digite a senha novamente">
                        </div>
                        <button type="submit" class="auth-btn-primary">🔑 Criar Conta de Administrador</button>
                    </form>

                    <div class="auth-footer">
                        <small>📸 Sistema de Controle de Estoque Fotográfico v1.0</small>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('adminSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminSetup();
        });
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
                            <input type="text" id="loginUsername" required placeholder="Digite seu usuário">
                        </div>
                        <div class="form-group">
                            <label>Senha:</label>
                            <input type="password" id="loginPassword" required placeholder="Digite sua senha">
                        </div>
                        <button type="submit" class="auth-btn-primary">Entrar no Sistema</button>
                    </form>

                    <div class="auth-footer">
                        <small>Sistema de Controle de Estoque Fotográfico v1.0</small>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    handleAdminSetup() {
        const name = document.getElementById('adminName').value;
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        const confirmPassword = document.getElementById('adminPasswordConfirm').value;

        if (password !== confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }

        if (password.length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres!');
            return;
        }

        try {
            const admin = this.createUser(username, password, name, 'admin');
            this.currentUser = admin;
            admin.lastLogin = new Date().toISOString();
            this.saveUsers();
            this.saveCurrentSession();
            localStorage.setItem('photoAdminSetupComplete', 'true');

            alert(`✅ Conta de administrador criada com sucesso!

👑 Bem-vindo, ${name}!

Você agora pode:
• Cadastrar outros usuários
• Gerenciar todo o sistema
• Zerar estoque para balanço

Carregando sistema...`);

            setTimeout(() => {
                this.initializeSystem();
            }, 2000);

        } catch (error) {
            alert('❌ Erro: ' + error.message);
        }
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        console.log('Tentativa de login:', {
            username: username,
            totalUsers: this.users.length
        });

        if (!username || !password) {
            alert('Por favor, preencha usuário e senha!');
            return;
        }

        try {
            this.login(username, password);
            console.log('Login bem-sucedido para:', username);
            this.loadSystemInterface();
        } catch (error) {
            console.error('Erro no login:', error);
            alert('❌ ' + error.message);
        }
    }

    loadSystemInterface() {
        console.log('Carregando interface do sistema para:', this.currentUser.name);

        document.body.innerHTML = `
            <div class="container">
                <header>
                    <div class="header-content">
                        <div class="header-title">
                            <h1>📸 Sistema de Estoque PicStone</h1>
                            <p>Controle Profissional de Equipamentos e Materiais</p>
                        </div>
                        <div class="header-user">
                            <span id="currentUserInfo"></span>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <nav class="main-nav">
                    <button class="nav-btn active" data-section="inventory">Estoque</button>
                    <button class="nav-btn" data-section="transactions">Movimentações</button>
                    <button class="nav-btn" data-section="reports">Relatórios</button>
                    <button class="nav-btn" data-section="settings">Configurações</button>
                    <button class="nav-btn admin-only" data-section="users" style="display: none;">👥 Usuários</button>
                </nav>

                <div id="inventory-section" class="section active">
                    <div class="controls">
                        <div class="quick-actions">
                            <h2>Ações Rápidas</h2>
                            <div class="action-buttons">
                                <button class="btn-primary" onclick="showModal('entryModal')">📥 Entrada</button>
                                <button class="btn-secondary" onclick="showModal('exitModal')">📤 Saída</button>
                                <button class="btn-warning" onclick="showModal('addProductModal')">➕ Novo Item</button>
                                <button class="btn-info admin-only" onclick="photoInventory.resetInventory()" style="display: none;">🔄 Reset Balanço</button>
                                <button class="btn-success" onclick="exportInventory()">📊 Exportar</button>
                            </div>
                        </div>

                        <div class="filters">
                            <h2>Filtros</h2>
                            <select id="filterCategory">
                                <option value="">Todas as categorias</option>
                                <option value="cameras">Câmeras</option>
                                <option value="lentes">Lentes</option>
                                <option value="iluminacao">Iluminação</option>
                                <option value="acessorios">Acessórios</option>
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

                    <div class="inventory-grid">
                        <div class="category-section" id="cameras-section">
                            <h3>📷 Câmeras</h3>
                            <div class="items-grid" id="cameras-items"></div>
                        </div>

                        <div class="category-section" id="lentes-section">
                            <h3>🔍 Lentes</h3>
                            <div class="items-grid" id="lentes-items"></div>
                        </div>

                        <div class="category-section" id="iluminacao-section">
                            <h3>💡 Iluminação</h3>
                            <div class="items-grid" id="iluminacao-items"></div>
                        </div>

                        <div class="category-section" id="acessorios-section">
                            <h3>🎯 Acessórios</h3>
                            <div class="items-grid" id="acessorios-items"></div>
                        </div>
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
                                <option value="cameras">📷 Câmeras</option>
                                <option value="lentes">🔍 Lentes</option>
                                <option value="iluminacao">💡 Iluminação</option>
                                <option value="acessorios">🎯 Acessórios</option>
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
                            <textarea id="newUserNotes" placeholder="Observações sobre o usuário (opcional)"></textarea>
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addUserModal')">Cancelar</button>
                                <button type="submit">Cadastrar Usuário</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            // Verificar se os elementos existem antes de inicializar
            const checkElements = () => {
                const camerasItems = document.getElementById('cameras-items');
                const stockSummary = document.getElementById('stockSummary');
                const entryItem = document.getElementById('entryItem');

                if (camerasItems && stockSummary && entryItem) {
                    // Verificar se já foi inicializado
                    if (!window.photoInventory || !window.photoInventory.initialized) {
                        console.log('Elementos encontrados, inicializando PhotoInventoryManager...');
                        window.photoInventory = new PhotoInventoryManager();
                        window.photoInventory.initialize();
                    } else {
                        console.log('PhotoInventoryManager já inicializado');
                    }
                } else {
                    console.log('Elementos ainda não carregados, tentando novamente...');
                    setTimeout(checkElements, 100);
                }
            };

            checkElements();
        }, 500);
    }

    initializeSystem() {
        console.log('Inicializando sistema para usuário:', this.currentUser.name);
        location.reload();
    }

    getUserPermissions() {
        if (!this.currentUser) return { canResetStock: false, canManageUsers: false };

        return {
            canResetStock: this.currentUser.role === 'admin',
            canManageUsers: this.currentUser.role === 'admin',
            canViewReports: true,
            canManageInventory: true
        };
    }

    deactivateUser(userId) {
        if (!this.isAdmin()) {
            throw new Error('Apenas administradores podem desativar usuários');
        }

        const user = this.users.find(u => u.id === userId);
        if (user) {
            user.active = false;
            this.saveUsers();
        }
    }

    reactivateUser(userId) {
        if (!this.isAdmin()) {
            throw new Error('Apenas administradores podem reativar usuários');
        }

        const user = this.users.find(u => u.id === userId);
        if (user) {
            user.active = true;
            this.saveUsers();
        }
    }
}

let photoAuthManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando autenticação de fotografia...');
    if (!photoAuthManager) {
        photoAuthManager = new PhotoAuthManager();
    }
});