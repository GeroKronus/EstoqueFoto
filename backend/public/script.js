class PhotoInventoryManager {
    constructor() {
        this.items = [];
        this.transactions = [];
        this.settings = {};
        this.categories = [];
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        console.log('Inicializando PhotoInventoryManager...');
        this.initialized = true;
        this.initializeSystem();
    }

    async initializeSystem() {
        console.log('Carregando categorias do PostgreSQL...');
        await this.loadCategories();
        console.log('Categorias carregadas:', this.categories);

        console.log('Carregando equipamentos do PostgreSQL...');
        this.items = await this.loadItems();
        console.log('Equipamentos carregados:', this.items.length);

        console.log('Carregando transações do PostgreSQL...');
        this.transactions = await this.loadTransactions();
        console.log('Transações carregadas:', this.transactions.length);

        this.settings = this.loadSettings();
        this.initializeEventListeners();
        this.setupUserInterface();
        await this.populateCategoryDropdowns();
        this.createCategorySections();
        this.renderAllItems();
        this.updateSummary();
        this.populateModalSelects();
    }

    async loadItems() {
        try {
            const response = await window.api.getEquipment({ limit: 1000 });
            if (response && response.equipment) {
                // Mapear formato do backend para formato esperado pelo frontend
                return response.equipment.map(eq => ({
                    id: eq.id,
                    category: eq.category.slug,
                    name: eq.name,
                    quantity: eq.quantity,
                    unit: eq.unit,
                    minStock: eq.minStock,
                    avgCost: eq.avgCost,
                    currentCost: eq.currentCost,
                    totalValue: eq.totalValue,
                    expiryDate: eq.expiryDate,
                    supplier: eq.supplier,
                    location: eq.location,
                    notes: eq.notes,
                    isCustomProduct: eq.isCustom,
                    createdAt: eq.createdAt,
                    lastUpdated: eq.updatedAt
                }));
            }
            console.error('Formato de resposta inválido ao carregar equipamentos');
            return [];
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
            return [];
        }
    }

    async loadTransactions() {
        try {
            const response = await window.api.getTransactions({ limit: 1000 });
            if (response && response.transactions) {
                // Mapear formato do backend para formato esperado pelo frontend
                return response.transactions.map(t => ({
                    id: t.id,
                    type: t.type,
                    itemName: t.equipment?.name || '',
                    category: t.equipment?.category?.slug || '',
                    quantity: t.quantity,
                    unit: t.equipment?.unit || '',
                    cost: t.cost || 0,
                    totalCost: (t.quantity || 0) * (t.cost || 0),
                    supplier: t.supplier || '',
                    reason: t.reason || '',
                    destination: t.destination || '',
                    notes: t.notes || '',
                    timestamp: t.createdAt
                }));
            }
            return [];
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
            return [];
        }
    }

    loadSettings() {
        const stored = localStorage.getItem('photoSettings');
        return stored ? JSON.parse(stored) : this.getDefaultSettings();
    }

    async loadCategories() {
        try {
            const response = await window.api.getCategories();
            if (response && response.categories) {
                this.categories = response.categories;
                console.log('✅ Categorias carregadas do PostgreSQL:', this.categories.length);
            } else {
                console.error('❌ Formato de resposta inválido ao carregar categorias');
                this.categories = [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
            this.categories = [];
        }
    }

    async populateCategoryDropdowns() {
        // Dropdown de filtro
        const filterCategory = document.getElementById('filterCategory');
        if (filterCategory) {
            filterCategory.innerHTML = '<option value="">Todas as categorias</option>';
            this.categories.forEach(category => {
                const option = new Option(category.name, category.slug);
                filterCategory.add(option);
            });
        }

        // Dropdown de novo produto
        const newProductCategory = document.getElementById('newProductCategory');
        if (newProductCategory) {
            newProductCategory.innerHTML = '<option value="">Selecione a categoria</option>';
            this.categories.forEach(category => {
                const option = new Option(category.name, category.slug);
                newProductCategory.add(option);
            });
        }
    }

    createCategorySections() {
        const inventoryGrid = document.getElementById('inventoryGrid');
        if (!inventoryGrid) {
            console.log('❌ inventoryGrid não encontrado');
            return;
        }

        console.log('🏗️ Criando seções de categoria no DOM...');
        inventoryGrid.innerHTML = '';

        this.categories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = `${category.slug}-section`;

            section.innerHTML = `
                <h2 class="category-title">
                    ${category.icon} ${category.name}
                </h2>
                <div class="category-items" id="${category.slug}-items">
                    <!-- Itens serão renderizados aqui -->
                </div>
            `;

            inventoryGrid.appendChild(section);
        });

        console.log('✅ Seções de categoria criadas:', this.categories.length);
    }

    getDefaultSettings() {
        return {
            lowStockLimit: 2,
            expiryAlert: 30,
            autoBackup: true
        };
    }

    initializeEventListeners() {
        const filterCategory = document.getElementById('filterCategory');
        const searchItem = document.getElementById('searchItem');
        const stockFilter = document.getElementById('stockFilter');
        const entryForm = document.getElementById('entryForm');
        const exitForm = document.getElementById('exitForm');
        const addProductForm = document.getElementById('addProductForm');
        const addUserForm = document.getElementById('addUserForm');
        const logoutBtn = document.getElementById('logoutBtn');

        if (filterCategory) {
            filterCategory.addEventListener('change', () => this.filterItems());
        }

        if (searchItem) {
            searchItem.addEventListener('input', () => this.filterItems());
        }

        if (stockFilter) {
            stockFilter.addEventListener('change', () => this.filterItems());
        }

        if (entryForm) {
            entryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processEntry();
            });
        }

        if (exitForm) {
            exitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processExit();
            });
        }

        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addNewProduct();
            });
        }

        if (addUserForm) {
            addUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addNewUser();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                photoAuthManager.logout();
            });
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });
    }

    setupUserInterface() {
        const user = photoAuthManager.getCurrentUser();
        const permissions = photoAuthManager.getUserPermissions();

        const currentUserInfo = document.getElementById('currentUserInfo');
        if (currentUserInfo) {
            currentUserInfo.textContent = `👤 ${user.name} ${user.role === 'admin' ? '👑' : ''}`;
        }

        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = permissions.canResetStock ? 'block' : 'none';
        });

        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            if (permissions.canResetStock) {
                actionButtons.style.gridTemplateColumns = '1fr 1fr 1fr';
                actionButtons.style.gridTemplateRows = '1fr 1fr';
            } else {
                actionButtons.style.gridTemplateColumns = '1fr 1fr';
                actionButtons.style.gridTemplateRows = '1fr 1fr';
            }
        }
    }

    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(`${sectionName}-section`).classList.add('active');
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        if (sectionName === 'transactions') {
            this.renderTransactions();
        } else if (sectionName === 'users' && photoAuthManager.isAdmin()) {
            this.renderUsers();
        } else if (sectionName === 'exit-orders') {
            if (!window.exitOrdersManager) {
                window.exitOrdersManager = new ExitOrdersManager(this);
            }
            window.exitOrdersManager.renderSection();
        }
    }

    async processEntry() {
        const itemId = document.getElementById('entryItem').value;
        const quantity = parseFloat(document.getElementById('entryQuantity').value);
        const cost = parseFloat(document.getElementById('entryCost').value) || 0;
        const supplier = document.getElementById('entrySupplier').value;
        const expiryDate = document.getElementById('entryExpiry').value;
        const notes = document.getElementById('entryNotes').value;

        if (!itemId || !quantity || quantity <= 0) {
            window.notify.warning('Por favor, selecione um equipamento e informe a quantidade.');
            return;
        }

        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            window.notify.error('Equipamento não encontrado!');
            return;
        }

        try {
            console.log('Registrando entrada no PostgreSQL...', { itemId, quantity, cost });

            const response = await window.api.createEntry({
                equipmentId: itemId,
                quantity,
                cost,
                supplier,
                expiryDate: expiryDate || null,
                notes
            });

            console.log('Entrada registrada com sucesso:', response);

            // Recarregar lista de equipamentos
            this.items = await this.loadItems();
            this.renderAllItems();
            this.updateSummary();
            this.populateModalSelects();
            closeModal('entryModal');

            document.getElementById('entryForm').reset();
            window.notify.success(`Entrada registrada: ${quantity} ${item.unit} de ${item.name}`);

        } catch (error) {
            console.error('Erro ao registrar entrada:', error);
            window.notify.error(`Erro ao registrar entrada: ${error.message}`);
        }
    }

    async processExit() {
        const itemId = document.getElementById('exitItem').value;
        const quantity = parseFloat(document.getElementById('exitQuantity').value);
        const reason = document.getElementById('exitReason').value;
        const destination = document.getElementById('exitDestination').value;
        const notes = document.getElementById('exitNotes').value;

        if (!itemId || !quantity || quantity <= 0 || !reason) {
            window.notify.warning('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            window.notify.error('Equipamento não encontrado!');
            return;
        }

        if (quantity > item.quantity) {
            window.notify.error(`Quantidade insuficiente! Disponível: ${item.quantity} ${item.unit}`);
            return;
        }

        try {
            console.log('Registrando saída no PostgreSQL...', { itemId, quantity, reason });

            const response = await window.api.createExit({
                equipmentId: itemId,
                quantity,
                reason,
                destination,
                notes
            });

            console.log('Saída registrada com sucesso:', response);

            // Recarregar lista de equipamentos
            this.items = await this.loadItems();
            this.renderAllItems();
            this.updateSummary();
            this.populateModalSelects();
            closeModal('exitModal');

            document.getElementById('exitForm').reset();
            window.notify.success(`Saída registrada: ${quantity} ${item.unit} de ${item.name}`);

        } catch (error) {
            console.error('Erro ao registrar saída:', error);
            window.notify.error(`Erro ao registrar saída: ${error.message}`);
        }
    }

    async addNewProduct() {
        const category = document.getElementById('newProductCategory').value;
        const name = document.getElementById('newProductName').value.trim();
        const unit = document.getElementById('newProductUnit').value.trim();
        const minStock = parseInt(document.getElementById('newProductMinStock').value);
        const cost = parseFloat(document.getElementById('newProductCost').value) || 0;
        const location = document.getElementById('newProductLocation').value.trim();
        const notes = document.getElementById('newProductNotes').value.trim();

        if (!category || !name || !unit || isNaN(minStock) || minStock < 1) {
            window.notify.warning('Por favor, preencha todos os campos obrigatórios corretamente.');
            return;
        }

        try {
            // Buscar ID da categoria
            const categoryObj = this.categories.find(cat => cat.slug === category);
            if (!categoryObj) {
                window.notify.error('Categoria não encontrada!');
                return;
            }

            console.log('Criando equipamento no PostgreSQL...', { name, categoryId: categoryObj.id });

            const response = await window.api.createEquipment({
                name,
                categoryId: categoryObj.id,
                unit,
                minStock,
                avgCost: cost,
                location,
                notes
            });

            console.log('Equipamento criado com sucesso:', response);

            // Recarregar lista de equipamentos
            this.items = await this.loadItems();
            this.renderAllItems();
            this.updateSummary();
            this.populateModalSelects();
            closeModal('addProductModal');

            document.getElementById('addProductForm').reset();

            const categoryName = categoryObj ? categoryObj.name : category;
            window.notify.success(`Equipamento "${name}" cadastrado com sucesso na categoria ${categoryName}!`);

        } catch (error) {
            console.error('Erro ao cadastrar equipamento:', error);
            window.notify.error(`Erro ao cadastrar equipamento: ${error.message}`);
        }
    }

    async deleteProduct(productId) {
        if (!photoAuthManager.isAdmin()) {
            window.notify.warning('Apenas administradores podem excluir equipamentos!');
            return;
        }

        const product = this.items.find(item => item.id === productId);
        if (!product) {
            window.notify.error('Equipamento não encontrado!');
            return;
        }

        const hasStock = product.quantity > 0;

        let confirmMessage = `Tem certeza que deseja excluir o equipamento "${product.name}"?`;

        if (hasStock) {
            confirmMessage += `\n\nO equipamento possui ${product.quantity} ${product.unit} em estoque.\n\nEsta ação NÃO PODE ser desfeita!`;
        } else {
            confirmMessage += `\n\nEsta ação NÃO PODE ser desfeita!`;
        }

        const confirmed = await window.notify.confirm({
            title: 'Excluir Equipamento',
            message: confirmMessage,
            type: 'danger',
            confirmText: 'Excluir',
            cancelText: 'Cancelar'
        });

        if (!confirmed) {
            return;
        }

        try {
            console.log('Excluindo equipamento do PostgreSQL...', productId);

            await window.api.deleteEquipment(productId);

            console.log('Equipamento excluído com sucesso');

            // Recarregar lista de equipamentos
            this.items = await this.loadItems();
            this.renderAllItems();
            this.updateSummary();
            this.populateModalSelects();

            window.notify.success(`Equipamento "${product.name}" foi excluído com sucesso!`);

        } catch (error) {
            console.error('Erro ao excluir equipamento:', error);
            window.notify.error(`Erro ao excluir equipamento: ${error.message}`);
        }
    }

    async addNewUser() {
        if (!photoAuthManager.isAdmin()) {
            window.notify.warning('Apenas administradores podem cadastrar usuários!');
            return;
        }

        const name = document.getElementById('newUserName').value.trim();
        const username = document.getElementById('newUserUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const confirmPassword = document.getElementById('newUserPasswordConfirm').value;
        const role = document.getElementById('newUserRole').value;

        if (!name || !username || !password || !role) {
            window.notify.warning('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        if (password !== confirmPassword) {
            window.notify.error('As senhas não coincidem!');
            return;
        }

        if (password.length < 6) {
            window.notify.warning('A senha deve ter pelo menos 6 caracteres!');
            return;
        }

        try {
            console.log('Criando usuário no PostgreSQL...', { username, name, role });

            const response = await window.api.createUser({
                username,
                password,
                name,
                role
            });

            console.log('Usuário criado com sucesso:', response);

            // Recarregar lista de usuários
            await this.renderUsers();
            closeModal('addUserModal');

            document.getElementById('addUserForm').reset();
            window.notify.success(`Usuário "${name}" cadastrado com sucesso!`);

        } catch (error) {
            console.error('Erro ao cadastrar usuário:', error);
            window.notify.error('Erro: ' + error.message);
        }
    }

    async renderUsers() {
        if (!photoAuthManager.isAdmin()) return;

        const container = document.getElementById('usersList');
        if (!container) {
            console.log('Container usersList não encontrado');
            return;
        }

        try {
            console.log('Carregando usuários do PostgreSQL...');
            const response = await window.api.getUsers();
            const users = response.users || [];

            console.log('Usuários carregados:', users.length);

            if (users.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Nenhum usuário encontrado.</div>';
                return;
            }

            const currentUser = photoAuthManager.getCurrentUser();

            container.innerHTML = users.map(user => {
                const isCurrentUser = user.id === currentUser.id;
                const badgeClass = user.role === 'admin' ? 'admin-badge' : 'user-badge';
                const badgeText = user.role === 'admin' ? '👑 Admin' : '👤 Usuário';

                return `
                    <div class="user-item ${!user.active ? 'inactive' : ''}">
                        <div class="user-info">
                            <div class="user-name">
                                ${user.name}
                                <span class="${badgeClass}">${badgeText}</span>
                                ${isCurrentUser ? ' (Você)' : ''}
                            </div>
                            <div class="user-details">
                                <div>👤 ${user.username} | Criado: ${this.formatDate(user.createdAt)}</div>
                                <div>${user.lastLogin ? `Último acesso: ${this.formatDateTime(user.lastLogin)}` : 'Nunca acessou'}</div>
                                <div>Status: ${user.active ? '✅ Ativo' : '❌ Inativo'}</div>
                            </div>
                        </div>
                        <div class="user-actions">
                            ${!isCurrentUser ? `
                                ${user.active ? `
                                    <button class="btn-user-action btn-deactivate" onclick="photoInventory.deactivateUser('${user.id}')">
                                        ⏸️ Desativar
                                    </button>
                                ` : `
                                    <button class="btn-user-action btn-reactivate" onclick="photoInventory.reactivateUser('${user.id}')">
                                        ▶️ Reativar
                                    </button>
                                `}
                            ` : '<span style="color: #666; font-size: 0.9rem;">Usuário atual</span>'}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #f44336;">Erro ao carregar usuários: ' + error.message + '</div>';
        }
    }

    async deactivateUser(userId) {
        if (!photoAuthManager.isAdmin()) {
            window.notify.warning('Apenas administradores podem desativar usuários!');
            return;
        }

        try {
            // Buscar informações do usuário
            const response = await window.api.getUser(userId);
            const user = response.user;

            if (!user) {
                window.notify.error('Usuário não encontrado!');
                return;
            }

            const confirmed = await window.notify.confirm({
                title: 'Desativar Usuário',
                message: `Tem certeza que deseja desativar o usuário "${user.name}"?`,
                type: 'warning',
                confirmText: 'Desativar',
                cancelText: 'Cancelar'
            });

            if (!confirmed) return;

            console.log('Desativando usuário no PostgreSQL...', userId);

            await window.api.deactivateUser(userId);

            console.log('Usuário desativado com sucesso');

            // Recarregar lista de usuários
            await this.renderUsers();

            window.notify.success(`Usuário "${user.name}" foi desativado com sucesso!`);
        } catch (error) {
            console.error('Erro ao desativar usuário:', error);
            window.notify.error('Erro: ' + error.message);
        }
    }

    async reactivateUser(userId) {
        if (!photoAuthManager.isAdmin()) {
            window.notify.warning('Apenas administradores podem reativar usuários!');
            return;
        }

        try {
            // Buscar informações do usuário
            const response = await window.api.getUser(userId);
            const user = response.user;

            if (!user) {
                window.notify.error('Usuário não encontrado!');
                return;
            }

            const confirmed = await window.notify.confirm({
                title: 'Reativar Usuário',
                message: `Tem certeza que deseja reativar o usuário "${user.name}"?`,
                type: 'question',
                confirmText: 'Reativar',
                cancelText: 'Cancelar'
            });

            if (!confirmed) return;

            console.log('Reativando usuário no PostgreSQL...', userId);

            await window.api.activateUser(userId);

            console.log('Usuário reativado com sucesso');

            // Recarregar lista de usuários
            await this.renderUsers();

            window.notify.success(`Usuário "${user.name}" foi reativado com sucesso!`);
        } catch (error) {
            console.error('Erro ao reativar usuário:', error);
            window.notify.error('Erro: ' + error.message);
        }
    }

    populateModalSelects() {
        const entrySelect = document.getElementById('entryItem');
        const exitSelect = document.getElementById('exitItem');

        if (!entrySelect || !exitSelect) {
            console.log('Aguardando selects dos modais');
            return;
        }

        entrySelect.innerHTML = '<option value="">Selecione o equipamento</option>';
        exitSelect.innerHTML = '<option value="">Selecione o equipamento</option>';

        const sortedItems = [...this.items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        sortedItems.forEach(item => {
            const entryOption = new Option(item.name, item.id);
            entrySelect.add(entryOption);

            if (item.quantity > 0) {
                const exitOption = new Option(`${item.name} (${item.quantity} ${item.unit})`, item.id);
                exitSelect.add(exitOption);
            }
        });
    }

    renderAllItems() {
        console.log('🎨 renderAllItems chamado. Items:', this.items.length, 'Categorias:', this.categories.length);

        if (!this.categories || this.categories.length === 0) {
            console.log('⏳ Aguardando categorias serem carregadas...');
            return;
        }

        if (!this.items || this.items.length === 0) {
            console.log('⏳ Nenhum equipamento para renderizar');
        }

        this.categories.forEach(category => {
            const container = document.getElementById(`${category.slug}-items`);

            if (!container) {
                console.log(`❌ Container não encontrado: ${category.slug}-items`);
                return;
            }

            container.innerHTML = '';

            const categoryItems = this.items.filter(item => item.category === category.slug);
            console.log(`📦 Categoria ${category.name} (${category.slug}): ${categoryItems.length} items`);

            categoryItems.forEach(item => {
                console.log(`  - Renderizando: ${item.name}`);
                const itemElement = this.createItemElement(item);
                container.appendChild(itemElement);
            });
        });

        console.log('✅ renderAllItems concluído');
    }

    createItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-card';

        const isExpired = this.isExpired(item.expiryDate);
        const isLowStock = item.quantity <= (item.minStock || this.settings.lowStockLimit);
        const isZeroStock = item.quantity === 0;

        if (isExpired) {
            itemDiv.classList.add('expired');
        } else if (isZeroStock) {
            itemDiv.classList.add('zero-stock');
        } else if (isLowStock) {
            itemDiv.classList.add('low-stock');
        }

        const expiryInfo = item.expiryDate ?
            `<div class="item-expiry">Validade: ${this.formatDate(item.expiryDate)}</div>` :
            '<div class="item-expiry">Sem validade definida</div>';

        const valueInfo = item.totalValue > 0 ?
            `<div class="item-value">Valor: R$ ${item.totalValue.toFixed(2)}</div>` : '';

        const stockStatus = isZeroStock ? 'SEM ESTOQUE' :
                          isLowStock ? 'ESTOQUE BAIXO' :
                          isExpired ? 'VENCIDO' : '';

        itemDiv.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-quantity">${item.quantity} ${item.unit}</div>
            <div class="item-cost">Custo: R$ ${item.currentCost.toFixed(2)}</div>
            ${valueInfo}
            ${expiryInfo}
            ${stockStatus ? `<div class="item-status">${stockStatus}</div>` : ''}
            <div class="item-actions">
                <button class="btn-entry" onclick="selectItemForEntry('${item.id}')">
                    📥 Entrada
                </button>
                <button class="btn-exit" onclick="selectItemForExit('${item.id}')" ${item.quantity <= 0 ? 'disabled' : ''}>
                    📤 Saída
                </button>
                ${photoAuthManager.isAdmin() ? `
                    <button class="btn-delete-product" onclick="photoInventory.deleteProduct('${item.id}')" title="Excluir equipamento (Apenas Admin)">
                        🗑️
                    </button>
                ` : ''}
            </div>
        `;

        return itemDiv;
    }

    filterItems() {
        const categoryFilter = document.getElementById('filterCategory').value;
        const searchTerm = document.getElementById('searchItem').value.toLowerCase();
        const stockFilter = document.getElementById('stockFilter').value;

        if (!this.categories || this.categories.length === 0) {
            console.log('⏳ Aguardando categorias para filtrar...');
            return;
        }

        this.categories.forEach(category => {
            const section = document.getElementById(`${category.slug}-section`);
            const container = document.getElementById(`${category.slug}-items`);

            if (!section || !container) {
                return;
            }

            let categoryItems = this.items.filter(item => item.category === category.slug);

            if (categoryFilter && categoryFilter !== category.slug) {
                section.classList.add('hidden');
                return;
            }

            if (searchTerm) {
                categoryItems = categoryItems.filter(item =>
                    item.name.toLowerCase().includes(searchTerm)
                );
            }

            if (stockFilter) {
                switch (stockFilter) {
                    case 'zero':
                        categoryItems = categoryItems.filter(item => item.quantity === 0);
                        break;
                    case 'low':
                        categoryItems = categoryItems.filter(item =>
                            item.quantity > 0 && item.quantity <= (item.minStock || this.settings.lowStockLimit));
                        break;
                    case 'expired':
                        categoryItems = categoryItems.filter(item => this.isExpired(item.expiryDate));
                        break;
                }
            }

            if (categoryItems.length === 0 && (categoryFilter || searchTerm || stockFilter)) {
                section.classList.add('hidden');
            } else {
                section.classList.remove('hidden');
                container.innerHTML = '';
                categoryItems.forEach(item => {
                    const itemElement = this.createItemElement(item);
                    container.appendChild(itemElement);
                });
            }
        });
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        const sortedTransactions = this.transactions.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        container.innerHTML = sortedTransactions.map(transaction => {
            const typeClass = transaction.type === 'entrada' ? 'transaction-entry' : 'transaction-exit';
            const icon = transaction.type === 'entrada' ? '📥' : '📤';

            return `
                <div class="transaction-item ${typeClass}">
                    <div class="transaction-header">
                        <span class="transaction-icon">${icon}</span>
                        <span class="transaction-type">${transaction.type.toUpperCase()}</span>
                        <span class="transaction-date">${this.formatDateTime(transaction.timestamp)}</span>
                    </div>
                    <div class="transaction-details">
                        <div><strong>${transaction.itemName}</strong> (${this.getCategoryName(transaction.category)})</div>
                        <div>Quantidade: ${transaction.quantity} ${transaction.unit}</div>
                        <div>Valor unitário: R$ ${transaction.cost.toFixed(2)}</div>
                        <div>Valor total: R$ ${transaction.totalCost.toFixed(2)}</div>
                        ${transaction.supplier ? `<div>Fornecedor: ${transaction.supplier}</div>` : ''}
                        ${transaction.reason ? `<div>Motivo: ${transaction.reason}</div>` : ''}
                        ${transaction.destination ? `<div>Destino: ${transaction.destination}</div>` : ''}
                        ${transaction.notes ? `<div>Observações: ${transaction.notes}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateSummary() {
        const totalValue = this.items.reduce((sum, item) => sum + item.totalValue, 0);
        const zeroStockItems = this.items.filter(item => item.quantity === 0).length;
        const lowStockItems = this.items.filter(item =>
            item.quantity > 0 && item.quantity <= (item.minStock || this.settings.lowStockLimit)
        ).length;
        const expiredItems = this.items.filter(item => this.isExpired(item.expiryDate)).length;

        const todayTransactions = this.transactions.filter(t => {
            const transactionDate = new Date(t.timestamp).toDateString();
            const today = new Date().toDateString();
            return transactionDate === today;
        });

        const todayEntries = todayTransactions.filter(t => t.type === 'entrada').length;
        const todayExits = todayTransactions.filter(t => t.type === 'saida').length;

        const summaryContainer = document.getElementById('stockSummary');

        if (!summaryContainer) {
            console.log('Aguardando container do resumo');
            return;
        }

        summaryContainer.innerHTML = `
            <div class="summary-card">
                <div class="summary-number">R$ ${totalValue.toFixed(2)}</div>
                <div class="summary-label">Valor Total do Estoque</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${this.items.length}</div>
                <div class="summary-label">Equipamentos Cadastrados</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #666">${zeroStockItems}</div>
                <div class="summary-label">Sem Estoque</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #ff9800">${lowStockItems}</div>
                <div class="summary-label">Estoque Baixo</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #f44336">${expiredItems}</div>
                <div class="summary-label">Itens Vencidos</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #4CAF50">${todayEntries}</div>
                <div class="summary-label">Entradas Hoje</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #2196F3">${todayExits}</div>
                <div class="summary-label">Saídas Hoje</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${this.transactions.length}</div>
                <div class="summary-label">Total Movimentações</div>
            </div>
        `;
    }

    async resetInventory() {
        if (!photoAuthManager.isAdmin()) {
            window.notify.warning('Apenas administradores podem zerar o estoque!');
            return;
        }

        const confirmed = await window.notify.confirm({
            title: 'Zerar Estoque',
            message: 'ATENÇÃO: Tem certeza que deseja zerar todo o estoque?\n\nEsta ação não pode ser desfeita e irá:\n• Zerar quantidade de todos os equipamentos\n• Manter histórico de transações\n• Ser registrada no log do sistema',
            type: 'danger',
            confirmText: 'Zerar Estoque',
            cancelText: 'Cancelar'
        });

        if (!confirmed) {
            return;
        }

        try {
            console.log('Zerando estoque no PostgreSQL...');

            // Atualizar cada equipamento para quantidade 0
            const updatePromises = this.items.map(async (item) => {
                try {
                    await window.api.updateEquipment(item.id, {
                        name: item.name,
                        categoryId: this.categories.find(c => c.slug === item.category)?.id,
                        unit: item.unit,
                        minStock: item.minStock,
                        avgCost: item.avgCost,
                        location: item.location,
                        notes: item.notes
                    });

                    // Criar uma saída para zerar o estoque (se tiver quantidade)
                    if (item.quantity > 0) {
                        await window.api.createExit({
                            equipmentId: item.id,
                            quantity: item.quantity,
                            reason: 'reset_estoque',
                            destination: 'Balanço de estoque',
                            notes: `Reset completo do estoque para balanço realizado por ${photoAuthManager.getCurrentUser().name}`
                        });
                    }
                } catch (error) {
                    console.error(`Erro ao zerar equipamento ${item.name}:`, error);
                }
            });

            await Promise.all(updatePromises);

            console.log('Estoque zerado com sucesso!');

            // Recarregar lista de equipamentos
            this.items = await this.loadItems();
            this.renderAllItems();
            this.updateSummary();
            this.populateModalSelects();

            window.notify.success('Estoque zerado com sucesso! Pronto para o balanço.');

        } catch (error) {
            console.error('Erro ao zerar estoque:', error);
            window.notify.error(`Erro ao zerar estoque: ${error.message}`);
        }
    }

    isExpired(expiryDate) {
        if (!expiryDate) return false;
        const today = new Date();
        const expiry = new Date(expiryDate);
        return expiry < today;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
    }

    getCategoryName(categorySlug) {
        const category = this.categories.find(cat => cat.slug === categorySlug);
        return category ? category.name : categorySlug;
    }

    saveData() {
        // Salvar apenas configurações locais no localStorage
        // Equipamentos e transações são salvos no PostgreSQL via API
        localStorage.setItem('photoSettings', JSON.stringify(this.settings));
    }
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function selectItemForEntry(itemId) {
    document.getElementById('entryItem').value = itemId;
    showModal('entryModal');
}

function selectItemForExit(itemId) {
    document.getElementById('exitItem').value = itemId;
    showModal('exitModal');
}

function filterTransactions() {

}

function generateMovementReport() {

}

function generateFinancialReport() {

}

function generateAlertsReport() {

}

function generateManagerialReport() {

}

function exportInventory() {
    const data = {
        items: photoInventory.items,
        transactions: photoInventory.transactions,
        timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque_fotografia_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
}

function exportAllData() {
    exportInventory();
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.items && importedData.transactions) {
                photoInventory.items = importedData.items;
                photoInventory.transactions = importedData.transactions;
                photoInventory.saveData();
                photoInventory.renderAllItems();
                photoInventory.updateSummary();
                photoInventory.populateModalSelects();
                window.notify.success('Backup restaurado com sucesso!');
            } else {
                window.notify.error('Formato de arquivo inválido!');
            }
        } catch (error) {
            window.notify.error('Erro ao importar dados: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function saveSettings() {
    photoInventory.settings.lowStockLimit = parseInt(document.getElementById('lowStockLimit').value);
    photoInventory.settings.expiryAlert = parseInt(document.getElementById('expiryAlert').value);
    photoInventory.saveData();
    window.notify.success('Configurações salvas com sucesso!');
}

window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Autenticação é inicializada pelo auth.js