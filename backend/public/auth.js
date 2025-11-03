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
                window.currentUser = userData.user; // Disponibilizar globalmente
                console.log('✅ Sessão restaurada para:', this.currentUser.name);
                this.showModuleSelection();
                return;
            } catch (error) {
                console.warn('⚠️ Token inválido ou expirado, redirecionando para login');
                clearAuth();
            }
        }

        // Verificar se é primeiro acesso (sem usuários no banco)
        try {
            console.log('🔍 Verificando se há usuários no sistema...');
            console.log('🔗 API URL:', window.CONFIG.API_BASE_URL);

            // Usar endpoint público /auth/check-first-access
            const url = `${window.CONFIG.API_BASE_URL}/auth/check-first-access`;
            console.log('🌐 Chamando:', url);

            const response = await fetch(url);
            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 Data recebida:', data);

            if (data.isFirstAccess) {
                console.log('🆕 Nenhum usuário encontrado - Primeiro acesso!');
                this.isFirstAccess = true;
                this.showAdminSetup();
                return;
            }

            console.log(`✅ ${data.totalUsers} usuário(s) encontrado(s)`);
        } catch (error) {
            console.error('❌ Erro ao verificar usuários:', error);
            // Em caso de erro, mostrar login normal
        }

        // Mostrar login normal
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
                            <div style="position: relative;">
                                <input type="password" id="loginPassword" required placeholder="Digite sua senha" autocomplete="current-password" style="padding-right: 45px;">
                                <button type="button" onclick="photoAuthManager.togglePasswordVisibility('loginPassword', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 20px; padding: 0; color: #666;" title="Mostrar/Ocultar senha">
                                    👁️
                                </button>
                            </div>
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
                this.showModuleSelection();
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (error) {
            console.error('❌ Erro no login:', error);
            alert('❌ ' + (error.message || 'Erro ao fazer login. Verifique suas credenciais.'));
        }
    }

    togglePasswordVisibility(inputId, buttonElement) {
        const input = document.getElementById(inputId);
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            buttonElement.textContent = '🙈';
            buttonElement.title = 'Ocultar senha';
        } else {
            input.type = 'password';
            buttonElement.textContent = '👁️';
            buttonElement.title = 'Mostrar senha';
        }
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
                        <small>📸 Sistema de Controle de Estoque Fotográfico v2.0 (PostgreSQL)</small>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('adminSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminSetup();
        });
    }

    async handleAdminSetup() {
        const name = document.getElementById('adminName').value.trim();
        const username = document.getElementById('adminUsername').value.trim();
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
            console.log('🔧 Criando primeiro administrador via API...');

            // Criar administrador via API
            const response = await window.api.register({
                username,
                password,
                name,
                role: 'admin'
            });

            if (response.token && response.user) {
                console.log('✅ Administrador criado com sucesso!');

                // Salvar JWT token
                setAuthToken(response.token);

                // Salvar dados do usuário
                this.currentUser = response.user;
                setCurrentUser(response.user);

                alert(`✅ Conta de administrador criada com sucesso!

👑 Bem-vindo, ${name}!

Você agora pode:
• Cadastrar outros usuários
• Gerenciar todo o sistema
• Zerar estoque para balanço

Carregando sistema...`);

                setTimeout(() => {
                    this.showModuleSelection();
                }, 1000);
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (error) {
            console.error('❌ Erro ao criar administrador:', error);
            alert('❌ Erro: ' + (error.message || 'Erro ao criar administrador. Tente novamente.'));
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

    async handleChangePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        // Validações
        if (newPassword !== confirmNewPassword) {
            window.notify.error('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            window.notify.error('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (currentPassword === newPassword) {
            window.notify.error('A nova senha deve ser diferente da senha atual');
            return;
        }

        try {
            await window.api.changePassword(currentPassword, newPassword);

            window.notify.success('Senha alterada com sucesso!');

            // Limpar formulário
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';

            // Fechar modal
            closeModal('changePasswordModal');
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            window.notify.error(error.message || 'Erro ao alterar senha');
        }
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

    showModuleSelection() {
        const isAdmin = this.isAdmin();

        console.log('📦 Mostrando seleção de módulos para:', this.currentUser.name);

        document.body.innerHTML = `
            <div class="container">
                <header>
                    <div class="header-content">
                        <div class="header-title">
                            <h1>📸 Sistema PicStone</h1>
                            <p>Selecione o módulo que deseja acessar</p>
                        </div>
                        <div class="header-user">
                            <span id="currentUserInfo">👤 ${this.currentUser.name} ${isAdmin ? '👑' : ''}</span>
                            <button id="changePasswordBtn" class="change-password-btn">🔑 Alterar Senha</button>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <div class="module-selection">
                    <div class="module-card" onclick="photoAuthManager.loadInventoryModule()">
                        <div class="module-icon">📦</div>
                        <h2>Controle de Estoque</h2>
                        <p>Gerenciar equipamentos, movimentações, ordens de saída e inventário</p>
                        <ul class="module-features">
                            <li>✓ Estoque de equipamentos</li>
                            <li>✓ Ordens de saída</li>
                            <li>✓ Movimentações</li>
                            <li>✓ Relatórios de estoque</li>
                        </ul>
                    </div>

                    <div class="module-card" onclick="photoAuthManager.loadServicesModule()">
                        <div class="module-icon">🔧</div>
                        <h2>Controle de Serviços</h2>
                        <p>Gerenciar ordens de serviço, clientes e acompanhar reparos</p>
                        <ul class="module-features">
                            <li>✓ Ordens de serviço</li>
                            <li>✓ Gerenciar clientes</li>
                            <li>✓ Controle de peças</li>
                            <li>✓ Relatórios de OS</li>
                        </ul>
                    </div>
                </div>

                <!-- Modal Alterar Senha -->
                <div id="changePasswordModal" class="modal">
                    <div class="modal-content">
                        <h2>🔑 Alterar Senha</h2>
                        <form id="changePasswordForm">
                            <input type="password" id="currentPassword" placeholder="Senha atual" required minlength="6" autocomplete="current-password">
                            <input type="password" id="newPassword" placeholder="Nova senha (mínimo 6 caracteres)" required minlength="6" autocomplete="new-password">
                            <input type="password" id="confirmNewPassword" placeholder="Confirmar nova senha" required minlength="6" autocomplete="new-password">
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('changePasswordModal')">Cancelar</button>
                                <button type="submit">Alterar Senha</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Configurar eventos
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            showModal('changePasswordModal');
        });
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });
    }

    loadInventoryModule() {
        const isAdmin = this.isAdmin();
        const adminClass = isAdmin ? 'admin-only show-admin' : 'admin-only';
        const adminStyle = isAdmin ? '' : 'display: none;';

        console.log('📦 Carregando módulo de Estoque para:', this.currentUser.name);

        document.body.innerHTML = `
            <div class="container">
                <header>
                    <div class="header-content">
                        <div class="header-title">
                            <h1>📦 Controle de Estoque PicStone</h1>
                            <p>Gerenciamento de Equipamentos e Materiais</p>
                        </div>
                        <div class="header-user">
                            <button id="backToModulesBtn" class="change-password-btn">⬅️ Módulos</button>
                            <span id="currentUserInfo">👤 ${this.currentUser.name} ${isAdmin ? '👑' : ''}</span>
                            <button id="changePasswordBtn" class="change-password-btn">🔑 Alterar Senha</button>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <nav class="main-nav">
                    <button class="nav-btn active" data-section="inventory">📦 Estoque</button>
                    <button class="nav-btn" data-section="exit-orders">📋 Ordens de Saída</button>
                    <button class="nav-btn" data-section="composite-items">📦 Itens Compostos</button>
                    <button class="nav-btn" data-section="transactions">📊 Movimentações</button>
                    <button class="nav-btn" data-section="customers">👥 Clientes</button>
                    <button class="nav-btn" data-section="reports">📈 Relatórios</button>
                    <button class="nav-btn" data-section="settings">⚙️ Configurações</button>
                    <button class="nav-btn ${adminClass}" data-section="users" style="${adminStyle}">👑 Usuários</button>
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
                            </select>
                            <div class="view-mode-toggle">
                                <label>Visualização:</label>
                                <div class="toggle-buttons">
                                    <button id="viewModeCards" class="toggle-btn active" onclick="photoInventory.toggleViewMode()" title="Visualização em Cards">
                                        🔲 Cards
                                    </button>
                                    <button id="viewModeTable" class="toggle-btn" onclick="photoInventory.toggleViewMode()" title="Visualização em Tabela">
                                        📋 Tabela
                                    </button>
                                </div>
                            </div>
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
                            <input type="text" id="searchTransaction" placeholder="🔍 Buscar por usuário ou produto..." oninput="filterTransactions()">
                            <input type="date" id="dateFrom" placeholder="Data inicial" onchange="filterTransactions()">
                            <input type="date" id="dateTo" placeholder="Data final" onchange="filterTransactions()">
                            <select id="transactionType" onchange="filterTransactions()">
                                <option value="">Todos os tipos</option>
                                <option value="entrada">Entradas</option>
                                <option value="saida">Saídas</option>
                            </select>
                            <div class="view-mode-toggle" style="margin-left: 20px;">
                                <label>Visualização:</label>
                                <div class="toggle-buttons">
                                    <button id="transactionViewCards" class="toggle-btn active" onclick="toggleTransactionViewMode()" title="Visualização em Cards">
                                        🔲 Cards
                                    </button>
                                    <button id="transactionViewTable" class="toggle-btn" onclick="toggleTransactionViewMode()" title="Visualização em Tabela">
                                        📋 Tabela
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="transactionsList" class="transactions-list"></div>
                </div>

                <div id="exit-orders-section" class="section">
                    <!-- Conteúdo será carregado por exitOrders.js -->
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
                            <p>Estoque baixo e sem estoque</p>
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

                <div id="composite-items-section" class="section">
                    <div id="mainContent">
                        <!-- Conteúdo será carregado por compositeItems.js -->
                    </div>
                </div>

                <div id="customers-section" class="section">
                    <div class="user-management">
                        <h2>👥 Gerenciamento de Clientes</h2>
                        <div class="user-controls" style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                            <button class="btn-primary" onclick="showModal('addCustomerModal')">➕ Cadastrar Cliente</button>
                            <input type="text" id="searchCustomer" placeholder="🔍 Buscar cliente..." style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px;" oninput="searchCustomers()">
                            <select id="customerCityFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todas as cidades</option>
                            </select>
                            <select id="customerStatusFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todos os status</option>
                                <option value="true">Ativos</option>
                                <option value="false">Inativos</option>
                            </select>
                        </div>
                        <div id="customersList" class="users-list"></div>
                        <div id="customersPagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;"></div>
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
                            <div style="position: relative;">
                                <input type="text" id="entryItemSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchEntryItem(this.value)" required>
                                <input type="hidden" id="entryItem">
                                <div id="entryItemResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="number" id="entryQuantity" placeholder="Quantidade" required min="1" step="1">
                            <input type="number" id="entryCost" placeholder="Preço unitário (R$)" min="0" step="0.01">
                            <input type="text" id="entrySupplier" placeholder="Fornecedor">
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
                            <div style="position: relative;">
                                <input type="text" id="exitItemSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchExitItem(this.value)" required>
                                <input type="hidden" id="exitItem">
                                <div id="exitItemResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="number" id="exitQuantity" placeholder="Quantidade" required min="1" step="1">
                            <select id="exitReason" required>
                                <option value="">Motivo da saída</option>
                                <option value="venda">Venda</option>
                                <option value="garantia">Garantia</option>
                                <option value="condicional">Condicional</option>
                                <option value="instalacao">Instalação</option>
                                <option value="uso_interno">Uso Interno</option>
                                <option value="perda">Perda/Avaria</option>
                                <option value="outros">Outros</option>
                            </select>
                            <div style="position: relative;">
                                <input type="text" id="exitCustomerSearch" placeholder="🔍 Buscar cliente..." autocomplete="off" oninput="searchExitCustomer(this.value)">
                                <input type="hidden" id="exitCustomerId">
                                <div id="exitCustomerResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="text" id="exitDestination" placeholder="Cliente/Destino (texto livre)">
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
                            <label for="newProductCategory">📁 Categoria *</label>
                            <select id="newProductCategory" required>
                                <option value="">Selecione a categoria</option>
                            </select>

                            <label for="newProductName">📦 Nome do Equipamento *</label>
                            <input type="text" id="newProductName" placeholder="Ex: Flash Godox 400" required>

                            <label for="newProductUnit">📏 Unidade de Medida *</label>
                            <input type="text" id="newProductUnit" placeholder="Ex: un, par, kit, etc." required>

                            <label for="newProductMinStock">⚠️ Estoque Mínimo (alerta) *</label>
                            <input type="number" id="newProductMinStock" placeholder="Ex: 5" required min="1" step="1">

                            <label for="newProductCost">💰 Preço Médio Unitário (R$)</label>
                            <input type="number" id="newProductCost" placeholder="Ex: 1500.00" min="0" step="0.01">

                            <label for="newProductLocation">📍 Localização (opcional)</label>
                            <input type="text" id="newProductLocation" placeholder="Ex: Prateleira A3">

                            <label for="newProductNotes">📝 Observações</label>
                            <textarea id="newProductNotes" placeholder="Informações adicionais sobre o equipamento"></textarea>

                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addProductModal')">Cancelar</button>
                                <button type="submit">Cadastrar Item</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="editProductModal" class="modal">
                    <div class="modal-content">
                        <h2>✏️ Editar Item</h2>
                        <form id="editProductForm">
                            <input type="hidden" id="editProductId">

                            <label for="editProductCategory">📁 Categoria *</label>
                            <select id="editProductCategory" required>
                                <option value="">Selecione a categoria</option>
                            </select>

                            <label for="editProductName">📦 Nome do Equipamento *</label>
                            <input type="text" id="editProductName" placeholder="Ex: Flash Godox 400" required>

                            <label for="editProductUnit">📏 Unidade de Medida *</label>
                            <input type="text" id="editProductUnit" placeholder="Ex: un, par, kit, etc." required>

                            <label for="editProductQuantity">📊 Quantidade em Estoque *</label>
                            <input type="number" id="editProductQuantity" placeholder="Ex: 10" required min="0" step="1">
                            <small style="color: #666; display: block; margin-top: -8px; margin-bottom: 12px;">⚠️ Alterar este valor registrará um ajuste manual de estoque</small>

                            <label for="editProductMinStock">⚠️ Estoque Mínimo (alerta) *</label>
                            <input type="number" id="editProductMinStock" placeholder="Ex: 5" required min="1" step="1">

                            <label for="editProductCost">💰 Preço Médio Unitário (R$)</label>
                            <input type="number" id="editProductCost" placeholder="Ex: 1500.00" min="0" step="0.01">

                            <label for="editProductLocation">📍 Localização (opcional)</label>
                            <input type="text" id="editProductLocation" placeholder="Ex: Prateleira A3">

                            <label for="editProductNotes">📝 Observações</label>
                            <textarea id="editProductNotes" placeholder="Informações adicionais sobre o equipamento"></textarea>

                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('editProductModal')">Cancelar</button>
                                <button type="submit">Salvar Alterações</button>
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

                <!-- Modal Adicionar Cliente -->
                <div id="addCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>➕ Cadastrar Novo Cliente</h2>
                        <form id="addCustomerForm" onsubmit="addCustomer(event); return false;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="newCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="newCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="newCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="newCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="newCustomerBairro" placeholder="Bairro">
                                <input type="text" id="newCustomerCidade" placeholder="Cidade">
                                <input type="text" id="newCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="newCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="newCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="newCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="newCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('addCustomerModal')">Cancelar</button>
                                <button type="submit">Cadastrar Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal Editar Cliente -->
                <div id="editCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>✏️ Editar Cliente</h2>
                        <form id="editCustomerForm" onsubmit="updateCustomer(event); return false;">
                            <input type="hidden" id="editCustomerId">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="editCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="editCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="editCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="editCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="editCustomerBairro" placeholder="Bairro">
                                <input type="text" id="editCustomerCidade" placeholder="Cidade">
                                <input type="text" id="editCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="editCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="editCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="editCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="editCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                                <div style="grid-column: 1 / -1;">
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                        <input type="checkbox" id="editCustomerAtivo" style="width: auto;">
                                        <span>Cliente ativo</span>
                                    </label>
                                </div>
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('editCustomerModal')">Cancelar</button>
                                <button type="submit">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal de Alerta de Itens Condicionais -->
                <div id="conditionalItemsAlertModal" class="modal">
                    <div class="modal-content conditional-alert-modal">
                        <div class="conditional-alert-header">
                            <h2>🔄 Itens Condicionais Pendentes</h2>
                            <p>Existem itens condicionais em ordens de saída ativas (podem ser devolvidos pelo cliente)</p>
                        </div>
                        <div id="conditionalItemsAlertContent" class="conditional-alert-content">
                            <!-- Conteúdo será preenchido dinamicamente -->
                        </div>
                        <div class="modal-actions">
                            <button type="button" onclick="closeModal('conditionalItemsAlertModal')" class="btn-primary">Fechar</button>
                        </div>
                    </div>
                </div>

                <!-- Modal Alterar Senha -->
                <div id="changePasswordModal" class="modal">
                    <div class="modal-content">
                        <h2>🔑 Alterar Senha</h2>
                        <form id="changePasswordForm">
                            <input type="password" id="currentPassword" placeholder="Senha atual" required minlength="6" autocomplete="current-password">
                            <input type="password" id="newPassword" placeholder="Nova senha (mínimo 6 caracteres)" required minlength="6" autocomplete="new-password">
                            <input type="password" id="confirmNewPassword" placeholder="Confirmar nova senha" required minlength="6" autocomplete="new-password">
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('changePasswordModal')">Cancelar</button>
                                <button type="submit">Alterar Senha</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Configurar eventos
        document.getElementById('backToModulesBtn').addEventListener('click', () => this.showModuleSelection());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            showModal('changePasswordModal');
        });
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

        // Inicializar sistema de inventário
        setTimeout(() => {
            console.log('🔧 Inicializando PhotoInventoryManager...');
            window.photoInventory = new PhotoInventoryManager();
            window.photoInventory.initialize();

            // Verificar itens condicionais
            setTimeout(() => {
                console.log('🔍 Verificando itens condicionais...');
                if (typeof checkConditionalItems === 'function') {
                    checkConditionalItems();
                }
            }, 2000);
        }, 100);
    }

    loadServicesModule() {
        const isAdmin = this.isAdmin();

        console.log('🔧 Carregando módulo de Serviços para:', this.currentUser.name);

        document.body.innerHTML = `
            <div class="container">
                <header>
                    <div class="header-content">
                        <div class="header-title">
                            <h1>🔧 Controle de Serviços PicStone</h1>
                            <p>Gerenciamento de Ordens de Serviço</p>
                        </div>
                        <div class="header-user">
                            <button id="backToModulesBtn" class="change-password-btn">⬅️ Módulos</button>
                            <span id="currentUserInfo">👤 ${this.currentUser.name} ${isAdmin ? '👑' : ''}</span>
                            <button id="changePasswordBtn" class="change-password-btn">🔑 Alterar Senha</button>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <nav class="main-nav">
                    <button class="nav-btn active" data-section="service-orders">🔧 Ordens de Serviço</button>
                    <button class="nav-btn" data-section="composite-items">📦 Itens Compostos</button>
                    <button class="nav-btn" data-section="customers">👥 Clientes</button>
                    <button class="nav-btn" data-section="reports">📈 Relatórios</button>
                </nav>

                <div id="service-orders-section" class="section active">
                    <!-- Conteúdo será carregado por serviceOrders.js -->
                </div>

                <div id="customers-section" class="section">
                    <div class="user-management">
                        <h2>👥 Gerenciamento de Clientes</h2>
                        <div class="user-controls" style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                            <button class="btn-primary" onclick="showModal('addCustomerModal')">➕ Cadastrar Cliente</button>
                            <input type="text" id="searchCustomer" placeholder="🔍 Buscar cliente..." style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px;" oninput="searchCustomers()">
                            <select id="customerCityFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todas as cidades</option>
                            </select>
                            <select id="customerStatusFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todos os status</option>
                                <option value="true">Ativos</option>
                                <option value="false">Inativos</option>
                            </select>
                        </div>
                        <div id="customersList" class="users-list"></div>
                        <div id="customersPagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;"></div>
                    </div>
                </div>

                <div id="reports-section" class="section">
                    <div class="reports-grid">
                        <div class="report-card">
                            <h3>🔧 Relatório de OS por Status</h3>
                            <p>Ordens de serviço agrupadas por status</p>
                            <button onclick="generateServiceOrderStatusReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>💰 Relatório Financeiro de OS</h3>
                            <p>Valores orçados, recebidos e pendentes</p>
                            <button onclick="generateServiceOrderFinancialReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>👥 Relatório por Cliente</h3>
                            <p>Histórico de serviços por cliente</p>
                            <button onclick="generateServiceOrderCustomerReport()">Gerar Relatório</button>
                        </div>
                        <div class="report-card">
                            <h3>⏱️ Relatório de Prazos</h3>
                            <p>Análise de prazos e entregas</p>
                            <button onclick="generateServiceOrderDeadlineReport()">Gerar Relatório</button>
                        </div>
                    </div>
                    <div id="reportContent" class="report-content"></div>
                </div>

                <!-- Modal Adicionar Cliente -->
                <div id="addCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>➕ Cadastrar Novo Cliente</h2>
                        <form id="addCustomerForm" onsubmit="addCustomer(event); return false;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="newCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="newCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="newCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="newCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="newCustomerBairro" placeholder="Bairro">
                                <input type="text" id="newCustomerCidade" placeholder="Cidade">
                                <input type="text" id="newCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="newCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="newCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="newCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="newCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('addCustomerModal')">Cancelar</button>
                                <button type="submit">Cadastrar Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal Editar Cliente -->
                <div id="editCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>✏️ Editar Cliente</h2>
                        <form id="editCustomerForm" onsubmit="updateCustomer(event); return false;">
                            <input type="hidden" id="editCustomerId">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="editCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="editCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="editCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="editCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="editCustomerBairro" placeholder="Bairro">
                                <input type="text" id="editCustomerCidade" placeholder="Cidade">
                                <input type="text" id="editCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="editCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="editCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="editCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="editCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                                <div style="grid-column: 1 / -1;">
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                        <input type="checkbox" id="editCustomerAtivo" style="width: auto;">
                                        <span>Cliente ativo</span>
                                    </label>
                                </div>
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('editCustomerModal')">Cancelar</button>
                                <button type="submit">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal Alterar Senha -->
                <div id="changePasswordModal" class="modal">
                    <div class="modal-content">
                        <h2>🔑 Alterar Senha</h2>
                        <form id="changePasswordForm">
                            <input type="password" id="currentPassword" placeholder="Senha atual" required minlength="6" autocomplete="current-password">
                            <input type="password" id="newPassword" placeholder="Nova senha (mínimo 6 caracteres)" required minlength="6" autocomplete="new-password">
                            <input type="password" id="confirmNewPassword" placeholder="Confirmar nova senha" required minlength="6" autocomplete="new-password">
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('changePasswordModal')">Cancelar</button>
                                <button type="submit">Alterar Senha</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Configurar eventos
        document.getElementById('backToModulesBtn').addEventListener('click', () => this.showModuleSelection());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            showModal('changePasswordModal');
        });
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

        // Configurar navegação entre seções
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');

                // Remover active de todos os botões e seções
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

                // Adicionar active ao botão clicado e seção correspondente
                e.target.classList.add('active');
                const sectionEl = document.getElementById(`${section}-section`);
                if (sectionEl) {
                    sectionEl.classList.add('active');
                }

                // Se for seção de ordens de serviço, reinicializar
                if (section === 'service-orders' && window.serviceOrderManager) {
                    console.log('Recarregando ordens de serviço...');
                    window.serviceOrderManager.loadOrders().then(() => {
                        window.serviceOrderManager.renderOrdersList();
                    });
                }

                // Se for seção de clientes, carregar clientes
                if (section === 'customers' && typeof loadCustomers === 'function') {
                    loadCustomers();
                }
            });
        });

        // Inicializar Service Orders Manager
        setTimeout(() => {
            console.log('🔧 Inicializando ServiceOrderManager...');

            // Verificar se o manager já existe, se sim, destruir primeiro
            if (window.serviceOrderManager) {
                console.log('Limpando instância anterior do ServiceOrderManager...');
                window.serviceOrderManager = null;
            }

            // Criar nova instância
            window.serviceOrderManager = new ServiceOrderManager();
            window.serviceOrderManager.initialize();

            // Também inicializar customer management se necessário
            if (typeof loadCustomers === 'function') {
                console.log('Carregando gerenciamento de clientes...');
            }
        }, 100);
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
                            <h1>📸 Sistema de Estoque PicStone</h1>
                            <p>Controle Profissional de Equipamentos e Materiais</p>
                        </div>
                        <div class="header-user">
                            <span id="currentUserInfo">👤 ${this.currentUser.name} ${isAdmin ? '👑' : ''}</span>
                            <button id="changePasswordBtn" class="change-password-btn">🔑 Alterar Senha</button>
                            <button id="logoutBtn" class="logout-btn">🚪 Sair</button>
                        </div>
                    </div>
                </header>

                <nav class="main-nav">
                    <button class="nav-btn active" data-section="inventory">Estoque</button>
                    <button class="nav-btn" data-section="exit-orders">📋 Ordens de Saída</button>
                    <button class="nav-btn" data-section="service-orders">🔧 Ordens de Serviço</button>
                    <button class="nav-btn" data-section="composite-items">📦 Itens Compostos</button>
                    <button class="nav-btn" data-section="transactions">Movimentações</button>
                    <button class="nav-btn" data-section="customers">👥 Clientes</button>
                    <button class="nav-btn" data-section="reports">Relatórios</button>
                    <button class="nav-btn" data-section="settings">Configurações</button>
                    <button class="nav-btn ${adminClass}" data-section="users" style="${adminStyle}">👑 Usuários</button>
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
                            </select>
                            <div class="view-mode-toggle">
                                <label>Visualização:</label>
                                <div class="toggle-buttons">
                                    <button id="viewModeCards" class="toggle-btn active" onclick="photoInventory.toggleViewMode()" title="Visualização em Cards">
                                        🔲 Cards
                                    </button>
                                    <button id="viewModeTable" class="toggle-btn" onclick="photoInventory.toggleViewMode()" title="Visualização em Tabela">
                                        📋 Tabela
                                    </button>
                                </div>
                            </div>
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
                            <input type="text" id="searchTransaction" placeholder="🔍 Buscar por usuário ou produto..." oninput="filterTransactions()">
                            <input type="date" id="dateFrom" placeholder="Data inicial" onchange="filterTransactions()">
                            <input type="date" id="dateTo" placeholder="Data final" onchange="filterTransactions()">
                            <select id="transactionType" onchange="filterTransactions()">
                                <option value="">Todos os tipos</option>
                                <option value="entrada">Entradas</option>
                                <option value="saida">Saídas</option>
                            </select>
                            <div class="view-mode-toggle" style="margin-left: 20px;">
                                <label>Visualização:</label>
                                <div class="toggle-buttons">
                                    <button id="transactionViewCards" class="toggle-btn active" onclick="toggleTransactionViewMode()" title="Visualização em Cards">
                                        🔲 Cards
                                    </button>
                                    <button id="transactionViewTable" class="toggle-btn" onclick="toggleTransactionViewMode()" title="Visualização em Tabela">
                                        📋 Tabela
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="transactionsList" class="transactions-list"></div>
                </div>

                <div id="exit-orders-section" class="section">
                    <!-- Conteúdo será carregado por exitOrders.js -->
                </div>

                <div id="service-orders-section" class="section">
                    <!-- Conteúdo será carregado por serviceOrders.js -->
                </div>

                <div id="composite-items-section" class="section">
                    <div id="mainContent">
                        <!-- Conteúdo será carregado por compositeItems.js -->
                    </div>
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
                            <p>Estoque baixo e sem estoque</p>
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

                <div id="composite-items-section" class="section">
                    <div id="mainContent">
                        <!-- Conteúdo será carregado por compositeItems.js -->
                    </div>
                </div>

                <div id="customers-section" class="section">
                    <div class="user-management">
                        <h2>👥 Gerenciamento de Clientes</h2>
                        <div class="user-controls" style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                            <button class="btn-primary" onclick="showModal('addCustomerModal')">➕ Cadastrar Cliente</button>
                            <input type="text" id="searchCustomer" placeholder="🔍 Buscar cliente..." style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px;" oninput="searchCustomers()">
                            <select id="customerCityFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todas as cidades</option>
                            </select>
                            <select id="customerStatusFilter" onchange="loadCustomers()" style="padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Todos os status</option>
                                <option value="true">Ativos</option>
                                <option value="false">Inativos</option>
                            </select>
                        </div>
                        <div id="customersList" class="users-list"></div>
                        <div id="customersPagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;"></div>
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
                            <div style="position: relative;">
                                <input type="text" id="entryItemSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchEntryItem(this.value)" required>
                                <input type="hidden" id="entryItem">
                                <div id="entryItemResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="number" id="entryQuantity" placeholder="Quantidade" required min="1" step="1">
                            <input type="number" id="entryCost" placeholder="Preço unitário (R$)" min="0" step="0.01">
                            <input type="text" id="entrySupplier" placeholder="Fornecedor">
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
                            <div style="position: relative;">
                                <input type="text" id="exitItemSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchExitItem(this.value)" required>
                                <input type="hidden" id="exitItem">
                                <div id="exitItemResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="number" id="exitQuantity" placeholder="Quantidade" required min="1" step="1">
                            <select id="exitReason" required>
                                <option value="">Motivo da saída</option>
                                <option value="venda">Venda</option>
                                <option value="garantia">Garantia</option>
                                <option value="condicional">Condicional</option>
                                <option value="instalacao">Instalação</option>
                                <option value="uso_interno">Uso Interno</option>
                                <option value="perda">Perda/Avaria</option>
                                <option value="outros">Outros</option>
                            </select>
                            <div style="position: relative;">
                                <input type="text" id="exitCustomerSearch" placeholder="🔍 Buscar cliente..." autocomplete="off" oninput="searchExitCustomer(this.value)">
                                <input type="hidden" id="exitCustomerId">
                                <div id="exitCustomerResults" class="autocomplete-results" style="display: none;"></div>
                            </div>
                            <input type="text" id="exitDestination" placeholder="Cliente/Destino (texto livre)">
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
                            <label for="newProductCategory">📁 Categoria *</label>
                            <select id="newProductCategory" required>
                                <option value="">Selecione a categoria</option>
                            </select>

                            <label for="newProductName">📦 Nome do Equipamento *</label>
                            <input type="text" id="newProductName" placeholder="Ex: Flash Godox 400" required>

                            <label for="newProductUnit">📏 Unidade de Medida *</label>
                            <input type="text" id="newProductUnit" placeholder="Ex: un, par, kit, etc." required>

                            <label for="newProductMinStock">⚠️ Estoque Mínimo (alerta) *</label>
                            <input type="number" id="newProductMinStock" placeholder="Ex: 5" required min="1" step="1">

                            <label for="newProductCost">💰 Preço Médio Unitário (R$)</label>
                            <input type="number" id="newProductCost" placeholder="Ex: 1500.00" min="0" step="0.01">

                            <label for="newProductLocation">📍 Localização (opcional)</label>
                            <input type="text" id="newProductLocation" placeholder="Ex: Prateleira A3">

                            <label for="newProductNotes">📝 Observações</label>
                            <textarea id="newProductNotes" placeholder="Informações adicionais sobre o equipamento"></textarea>

                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('addProductModal')">Cancelar</button>
                                <button type="submit">Cadastrar Item</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="editProductModal" class="modal">
                    <div class="modal-content">
                        <h2>✏️ Editar Item</h2>
                        <form id="editProductForm">
                            <input type="hidden" id="editProductId">

                            <label for="editProductCategory">📁 Categoria *</label>
                            <select id="editProductCategory" required>
                                <option value="">Selecione a categoria</option>
                            </select>

                            <label for="editProductName">📦 Nome do Equipamento *</label>
                            <input type="text" id="editProductName" placeholder="Ex: Flash Godox 400" required>

                            <label for="editProductUnit">📏 Unidade de Medida *</label>
                            <input type="text" id="editProductUnit" placeholder="Ex: un, par, kit, etc." required>

                            <label for="editProductQuantity">📊 Quantidade em Estoque *</label>
                            <input type="number" id="editProductQuantity" placeholder="Ex: 10" required min="0" step="1">
                            <small style="color: #666; display: block; margin-top: -8px; margin-bottom: 12px;">⚠️ Alterar este valor registrará um ajuste manual de estoque</small>

                            <label for="editProductMinStock">⚠️ Estoque Mínimo (alerta) *</label>
                            <input type="number" id="editProductMinStock" placeholder="Ex: 5" required min="1" step="1">

                            <label for="editProductCost">💰 Preço Médio Unitário (R$)</label>
                            <input type="number" id="editProductCost" placeholder="Ex: 1500.00" min="0" step="0.01">

                            <label for="editProductLocation">📍 Localização (opcional)</label>
                            <input type="text" id="editProductLocation" placeholder="Ex: Prateleira A3">

                            <label for="editProductNotes">📝 Observações</label>
                            <textarea id="editProductNotes" placeholder="Informações adicionais sobre o equipamento"></textarea>

                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('editProductModal')">Cancelar</button>
                                <button type="submit">Salvar Alterações</button>
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

                <!-- Modal Adicionar Cliente -->
                <div id="addCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>➕ Cadastrar Novo Cliente</h2>
                        <form id="addCustomerForm" onsubmit="addCustomer(event); return false;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="newCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="newCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="newCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="newCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="newCustomerBairro" placeholder="Bairro">
                                <input type="text" id="newCustomerCidade" placeholder="Cidade">
                                <input type="text" id="newCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="newCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="newCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="newCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="newCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('addCustomerModal')">Cancelar</button>
                                <button type="submit">Cadastrar Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal Editar Cliente -->
                <div id="editCustomerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>✏️ Editar Cliente</h2>
                        <form id="editCustomerForm" onsubmit="updateCustomer(event); return false;">
                            <input type="hidden" id="editCustomerId">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <input type="text" id="editCustomerRazaoSocial" placeholder="Razão Social *" required style="grid-column: 1 / -1;">
                                <input type="text" id="editCustomerNomeFantasia" placeholder="Nome Fantasia">
                                <input type="text" id="editCustomerCNPJ" placeholder="CNPJ" maxlength="18">
                                <input type="text" id="editCustomerEndereco" placeholder="Endereço">
                                <input type="text" id="editCustomerBairro" placeholder="Bairro">
                                <input type="text" id="editCustomerCidade" placeholder="Cidade">
                                <input type="text" id="editCustomerCEP" placeholder="CEP" maxlength="10">
                                <input type="text" id="editCustomerEstado" placeholder="Estado (UF)" maxlength="2" pattern="[A-Z]{2}" title="Digite o UF em maiúsculas (ex: ES)">
                                <input type="text" id="editCustomerInscricaoEstadual" placeholder="Inscrição Estadual">
                                <input type="tel" id="editCustomerTelefone" placeholder="Telefone">
                                <input type="email" id="editCustomerEmail" placeholder="E-mail" style="grid-column: 1 / -1;">
                                <div style="grid-column: 1 / -1;">
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                        <input type="checkbox" id="editCustomerAtivo" style="width: auto;">
                                        <span>Cliente ativo</span>
                                    </label>
                                </div>
                            </div>
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" onclick="closeModal('editCustomerModal')">Cancelar</button>
                                <button type="submit">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Modal de Alerta de Itens Condicionais -->
                <div id="conditionalItemsAlertModal" class="modal">
                    <div class="modal-content conditional-alert-modal">
                        <div class="conditional-alert-header">
                            <h2>🔄 Itens Condicionais Pendentes</h2>
                            <p>Existem itens condicionais em ordens de saída ativas (podem ser devolvidos pelo cliente)</p>
                        </div>
                        <div id="conditionalItemsAlertContent" class="conditional-alert-content">
                            <!-- Conteúdo será preenchido dinamicamente -->
                        </div>
                        <div class="modal-actions">
                            <button type="button" onclick="closeModal('conditionalItemsAlertModal')" class="btn-primary">Fechar</button>
                        </div>
                    </div>
                </div>

                <!-- Modal Alterar Senha -->
                <div id="changePasswordModal" class="modal">
                    <div class="modal-content">
                        <h2>🔑 Alterar Senha</h2>
                        <form id="changePasswordForm">
                            <input type="password" id="currentPassword" placeholder="Senha atual" required minlength="6" autocomplete="current-password">
                            <input type="password" id="newPassword" placeholder="Nova senha (mínimo 6 caracteres)" required minlength="6" autocomplete="new-password">
                            <input type="password" id="confirmNewPassword" placeholder="Confirmar nova senha" required minlength="6" autocomplete="new-password">
                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('changePasswordModal')">Cancelar</button>
                                <button type="submit">Alterar Senha</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Configurar evento de logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Configurar evento de alterar senha
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            showModal('changePasswordModal');
        });

        // Configurar formulário de alteração de senha
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

        // Inicializar sistema de inventário
        // IMPORTANTE: Sempre recriar a instância após reconstruir a interface
        setTimeout(() => {
            console.log('🔧 Inicializando PhotoInventoryManager...');
            // Sempre criar nova instância para garantir estado limpo
            window.photoInventory = new PhotoInventoryManager();
            window.photoInventory.initialize();

            // Verificar itens condicionais após 2 segundos (tempo para inicializar tudo)
            setTimeout(() => {
                console.log('🔍 Verificando itens condicionais...');
                if (typeof checkConditionalItems === 'function') {
                    checkConditionalItems();
                }
            }, 2000);
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
