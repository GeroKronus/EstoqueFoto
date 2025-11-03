class CompositeItemsManager {
    constructor() {
        this.compositeItems = [];
        this.equipmentList = [];
        this.categories = [];
        this.currentEditingItem = null;
        this.tempComponents = [];
        this.viewMode = 'table'; // 'cards' ou 'table' - padrão: table
    }

    async init() {
        console.log('🎯 Inicializando gerenciador de itens compostos...');
        await this.loadCompositeItems();
        await this.loadEquipmentList();
        await this.loadCategories();
        this.render();
    }

    async loadCompositeItems() {
        try {
            const response = await window.api.request('/composite-items');
            this.compositeItems = response.compositeItems || [];
            console.log(`✅ ${this.compositeItems.length} itens compostos carregados`);
        } catch (error) {
            console.error('Erro ao carregar itens compostos:', error);
            window.notify.error('Erro ao carregar itens compostos');
        }
    }

    async loadEquipmentList() {
        try {
            // Carregar direto da API ao invés de depender do window.photoInventory
            const response = await window.api.getEquipment({ limit: 1000 });
            if (response && response.equipment) {
                this.equipmentList = response.equipment.map(eq => ({
                    id: eq.id,
                    name: eq.name,
                    quantity: eq.quantity,
                    unit: eq.unit,
                    active: eq.active || true
                }));
            } else {
                this.equipmentList = [];
            }
            console.log(`✅ ${this.equipmentList.length} equipamentos disponíveis`);
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
            this.equipmentList = [];
        }
    }

    async loadCategories() {
        try {
            // Carregar direto da API ao invés de depender do window.photoInventory
            const response = await window.api.getCategories();
            if (response && response.categories) {
                this.categories = response.categories;
            } else {
                this.categories = [];
            }
            console.log(`✅ ${this.categories.length} categorias carregadas`);
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
            this.categories = [];
        }
    }

    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="composite-items-container">
                <div class="page-header">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h1>📦 Itens Compostos (Kits)</h1>
                            <p>Crie kits formados por múltiplos equipamentos. Ao dar saída de um kit, todos os componentes são baixados automaticamente.</p>
                        </div>
                        ${photoAuthManager.isAdmin() ? `
                            <button class="btn-primary" onclick="compositeItemsManager.showCreateModal()">
                                ➕ Novo Item Composto
                            </button>
                        ` : ''}
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 5px; background: #f5f5f5; padding: 4px; border-radius: 8px;">
                            <button
                                class="btn-view-mode ${this.viewMode === 'cards' ? 'active' : ''}"
                                onclick="compositeItemsManager.setViewMode('cards')"
                                style="padding: 8px 16px; border: none; background: ${this.viewMode === 'cards' ? '#4CAF50' : 'transparent'}; color: ${this.viewMode === 'cards' ? 'white' : '#666'}; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                                🔲 Cards
                            </button>
                            <button
                                class="btn-view-mode ${this.viewMode === 'table' ? 'active' : ''}"
                                onclick="compositeItemsManager.setViewMode('table')"
                                style="padding: 8px 16px; border: none; background: ${this.viewMode === 'table' ? '#4CAF50' : 'transparent'}; color: ${this.viewMode === 'table' ? 'white' : '#666'}; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                                📋 Tabela
                            </button>
                        </div>
                    </div>
                </div>

                <div id="compositeItemsList" class="composite-items-list">
                    ${this.renderList()}
                </div>
            </div>
        `;
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }

    renderList() {
        if (this.compositeItems.length === 0) {
            return `
                <div class="empty-state">
                    <p>📦 Nenhum item composto cadastrado ainda.</p>
                    ${photoAuthManager.isAdmin() ? `
                        <button class="btn-primary" onclick="compositeItemsManager.showCreateModal()">
                            ➕ Criar Primeiro Item Composto
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return this.viewMode === 'cards' ? this.renderCards() : this.renderTable();
    }

    renderCards() {
        return this.compositeItems.map(item => `
            <div class="composite-item-card ${!item.active ? 'inactive' : ''}">
                <div class="composite-item-header">
                    <div>
                        <h3>${item.name}</h3>
                        ${item.category_name ? `<span class="category-badge">${item.category_name}</span>` : ''}
                        ${!item.active ? '<span class="inactive-badge">❌ Inativo</span>' : ''}
                    </div>
                    <div class="composite-item-actions">
                        <button class="btn-icon" onclick="compositeItemsManager.viewDetails('${item.id}')" title="Ver detalhes">
                            👁️
                        </button>
                        ${photoAuthManager.isAdmin() && item.active ? `
                            <button class="btn-icon" onclick="compositeItemsManager.showEditModal('${item.id}')" title="Editar">
                                ✏️
                            </button>
                            <button class="btn-icon btn-danger" onclick="compositeItemsManager.deleteItem('${item.id}', '${item.name}')" title="Excluir">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="composite-item-body">
                    ${item.description ? `<p class="description">${item.description}</p>` : ''}
                    <div class="composite-item-stats">
                        <span>📋 ${item.component_count} componente(s)</span>
                        <span>👤 Criado por: ${item.created_by_name || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderTable() {
        return `
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="width: 25%;">Nome do Kit</th>
                        <th style="width: 15%;">Categoria</th>
                        <th style="width: 30%;">Descrição</th>
                        <th style="width: 8%; text-align: center;">Componentes</th>
                        <th style="width: 12%;">Criado por</th>
                        <th style="width: 10%; text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.compositeItems.map(item => `
                        <tr class="${!item.active ? 'inactive-row' : ''}">
                            <td style="width: 25%;">
                                <strong>${item.name}</strong>
                                ${!item.active ? '<br><span style="color: #f44336; font-size: 0.85em;">✗ Inativo</span>' : ''}
                            </td>
                            <td style="width: 15%;">
                                ${item.category_name ? `<span class="category-badge">${item.category_name}</span>` : '-'}
                            </td>
                            <td style="width: 30%;">${item.description || '-'}</td>
                            <td style="width: 8%; text-align: center;">
                                <strong style="font-size: 1.1em;">${item.component_count}</strong>
                            </td>
                            <td style="width: 12%;">${item.created_by_name || 'N/A'}</td>
                            <td style="width: 10%; text-align: center;">
                                <button class="btn-icon" onclick="compositeItemsManager.viewDetails('${item.id}')" title="Ver detalhes">
                                    👁️
                                </button>
                                ${photoAuthManager.isAdmin() && item.active ? `
                                    <button class="btn-icon" onclick="compositeItemsManager.showEditModal('${item.id}')" title="Editar">
                                        ✏️
                                    </button>
                                    <button class="btn-icon btn-danger" onclick="compositeItemsManager.deleteItem('${item.id}', '${item.name}')" title="Excluir">
                                        🗑️
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    showCreateModal() {
        if (!photoAuthManager.isAdmin()) {
            window.notify.error('Apenas administradores podem criar itens compostos');
            return;
        }

        this.currentEditingItem = null;
        this.tempComponents = [];

        const modalHtml = `
            <div class="modal" id="compositeItemModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <h2>📦 Novo Item Composto</h2>

                    <form id="compositeItemForm" style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label>Nome do Item Composto *</label>
                            <input type="text" id="compositeName" required placeholder="Ex: Kit Iluminação Completo" style="width: 100%; padding: 10px;">
                        </div>

                        <div>
                            <label>Categoria</label>
                            <select id="compositeCategory" style="width: 100%; padding: 10px;">
                                <option value="">Sem categoria</option>
                                ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                            </select>
                        </div>

                        <div>
                            <label>Descrição</label>
                            <textarea id="compositeDescription" placeholder="Descrição opcional do kit..." style="width: 100%; padding: 10px; min-height: 60px;"></textarea>
                        </div>

                        <div style="border-top: 2px solid #e0e0e0; padding-top: 15px;">
                            <label style="font-size: 16px; font-weight: 600;">Componentes do Kit *</label>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <div style="flex: 1; position: relative;">
                                    <input type="text" id="componentEquipmentSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchComponentEquipment(this.value)" style="width: 100%; padding: 10px;">
                                    <input type="hidden" id="componentEquipment">
                                    <div id="componentEquipmentResults" class="autocomplete-results" style="display: none;"></div>
                                </div>
                                <input type="number" id="componentQuantity" placeholder="Qtd" min="0.001" step="0.001" style="width: 100px; padding: 10px;">
                                <button type="button" class="btn-primary" onclick="compositeItemsManager.addComponent()">
                                    ➕ Adicionar
                                </button>
                            </div>

                            <div id="componentsList" style="margin-top: 15px;">
                                ${this.renderComponentsList()}
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" onclick="closeModal('compositeItemModal')">Cancelar</button>
                            <button type="submit" class="btn-primary">💾 Criar Item Composto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('compositeItemModal');
        if (modal && typeof preventModalCloseOnBackdropClick === 'function') {
            preventModalCloseOnBackdropClick(modal);
        }

        document.getElementById('compositeItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCompositeItem();
        });
    }

    addComponent() {
        const equipmentId = document.getElementById('componentEquipment').value;
        const quantity = parseFloat(document.getElementById('componentQuantity').value);

        if (!equipmentId) {
            window.notify.warning('Selecione um equipamento');
            return;
        }

        if (!quantity || quantity <= 0) {
            window.notify.warning('Informe uma quantidade válida');
            return;
        }

        // Verificar se já foi adicionado
        if (this.tempComponents.find(c => c.equipmentId === equipmentId)) {
            window.notify.warning('Este equipamento já foi adicionado');
            return;
        }

        const equipment = this.equipmentList.find(e => e.id === equipmentId);
        if (!equipment) return;

        this.tempComponents.push({
            equipmentId,
            equipmentName: equipment.name,
            quantity,
            unit: equipment.unit
        });

        document.getElementById('componentEquipment').value = '';
        document.getElementById('componentQuantity').value = '';
        document.getElementById('componentsList').innerHTML = this.renderComponentsList();
    }

    removeComponent(equipmentId) {
        this.tempComponents = this.tempComponents.filter(c => c.equipmentId !== equipmentId);

        // Atualizar tanto o modal de criação quanto o de edição
        const createList = document.getElementById('componentsList');
        const editList = document.getElementById('editComponentsList');

        if (createList) {
            createList.innerHTML = this.renderComponentsList();
        }
        if (editList) {
            editList.innerHTML = this.renderComponentsList();
        }
    }

    renderComponentsList() {
        if (this.tempComponents.length === 0) {
            return '<p style="color: #666; text-align: center; padding: 20px;">Nenhum componente adicionado ainda</p>';
        }

        return `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px;">
                ${this.tempComponents.map(comp => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                        <span><strong>${comp.quantity} ${comp.unit}</strong> × ${comp.equipmentName}</span>
                        <button type="button" class="btn-icon btn-danger" onclick="compositeItemsManager.removeComponent('${comp.equipmentId}')">
                            🗑️
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async createCompositeItem() {
        const name = document.getElementById('compositeName').value.trim();
        const categoryId = document.getElementById('compositeCategory').value || null;
        const description = document.getElementById('compositeDescription').value.trim() || null;

        if (!name) {
            window.notify.error('Nome é obrigatório');
            return;
        }

        if (this.tempComponents.length === 0) {
            window.notify.error('Adicione pelo menos um componente');
            return;
        }

        try {
            await window.api.request('/composite-items', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    categoryId,
                    description,
                    components: this.tempComponents.map(c => ({
                        equipmentId: c.equipmentId,
                        quantity: c.quantity
                    }))
                })
            });

            window.notify.success('Item composto criado com sucesso!');
            closeModal('compositeItemModal');
            await this.loadCompositeItems();
            this.render();
        } catch (error) {
            console.error('Erro ao criar item composto:', error);
            window.notify.error(error.message || 'Erro ao criar item composto');
        }
    }

    async viewDetails(itemId) {
        try {
            const response = await window.api.request(`/composite-items/${itemId}`);
            const item = response.compositeItem;

            const availability = await window.api.request(`/composite-items/${itemId}/availability`);

            const modalHtml = `
                <div class="modal" id="viewCompositeModal" data-dynamic="true" style="display: flex;">
                    <div class="modal-content" style="max-width: 700px;">
                        <h2>📦 ${item.name}</h2>

                        ${item.description ? `<p style="color: #666; margin-bottom: 15px;">${item.description}</p>` : ''}

                        <div style="background: #e3f2fd; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #2196F3;">
                            <strong>📊 Disponibilidade:</strong> Você pode montar <strong>${availability.maxAvailableKits}</strong> kit(s) com o estoque atual
                        </div>

                        <h3 style="margin-bottom: 10px;">Componentes:</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f5f5f5;">
                                    <th style="padding: 10px; text-align: left;">Equipamento</th>
                                    <th style="padding: 10px; text-align: center;">Necessário</th>
                                    <th style="padding: 10px; text-align: center;">Disponível</th>
                                    <th style="padding: 10px; text-align: center;">Kits possíveis</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${item.components.map(comp => {
                                    const possible = Math.floor(comp.available_quantity / comp.quantity);
                                    const rowColor = possible === 0 ? 'background: #ffebee;' : '';
                                    return `
                                        <tr style="${rowColor}">
                                            <td style="padding: 10px;">${comp.equipment_name}</td>
                                            <td style="padding: 10px; text-align: center;">${comp.quantity} ${comp.unit}</td>
                                            <td style="padding: 10px; text-align: center;">${comp.available_quantity} ${comp.unit}</td>
                                            <td style="padding: 10px; text-align: center; font-weight: 600;">${possible}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>

                        <div class="modal-actions">
                            <button type="button" onclick="closeModal('viewCompositeModal')">Fechar</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Prevenir fechamento ao clicar fora do modal
            const modal = document.getElementById('viewCompositeModal');
            if (modal && typeof preventModalCloseOnBackdropClick === 'function') {
                preventModalCloseOnBackdropClick(modal);
            }
        } catch (error) {
            console.error('Erro ao visualizar item composto:', error);
            window.notify.error('Erro ao carregar detalhes');
        }
    }

    async showEditModal(itemId) {
        if (!photoAuthManager.isAdmin()) {
            window.notify.error('Apenas administradores podem editar itens compostos');
            return;
        }

        try {
            // Buscar item composto com componentes
            const response = await window.api.getCompositeItem(itemId);
            const item = response.compositeItem;

            this.currentEditingItem = item;
            this.tempComponents = item.components.map(comp => ({
                equipmentId: comp.equipment_id,
                equipmentName: comp.equipment_name,
                quantity: parseFloat(comp.quantity),
                unit: comp.unit
            }));

            const modalHtml = `
                <div class="modal" id="editCompositeItemModal" data-dynamic="true" style="display: flex;">
                    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                        <h2>✏️ Editar Item Composto</h2>

                        <form id="editCompositeItemForm" style="display: flex; flex-direction: column; gap: 15px;">
                            <div>
                                <label>Nome do Item Composto *</label>
                                <input type="text" id="editCompositeName" required value="${item.name}" style="width: 100%; padding: 10px;">
                            </div>

                            <div>
                                <label>Categoria</label>
                                <select id="editCompositeCategory" style="width: 100%; padding: 10px;">
                                    <option value="">Sem categoria</option>
                                    ${this.categories.map(cat => `
                                        <option value="${cat.id}" ${item.category_id === cat.id ? 'selected' : ''}>
                                            ${cat.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div>
                                <label>Descrição</label>
                                <textarea id="editCompositeDescription" placeholder="Descrição opcional do kit..." style="width: 100%; padding: 10px; min-height: 60px;">${item.description || ''}</textarea>
                            </div>

                            <div style="border-top: 2px solid #e0e0e0; padding-top: 15px;">
                                <label style="font-size: 16px; font-weight: 600;">Componentes do Kit *</label>
                                <div style="display: flex; gap: 10px; margin-top: 10px;">
                                    <div style="flex: 1; position: relative;">
                                        <input type="text" id="editComponentEquipmentSearch" placeholder="🔍 Buscar equipamento..." autocomplete="off" oninput="searchEditComponentEquipment(this.value)" style="width: 100%; padding: 10px;">
                                        <input type="hidden" id="editComponentEquipment">
                                        <div id="editComponentEquipmentResults" class="autocomplete-results" style="display: none;"></div>
                                    </div>
                                    <input type="number" id="editComponentQuantity" placeholder="Qtd" min="0.001" step="0.001" style="width: 100px; padding: 10px;">
                                    <button type="button" class="btn-primary" onclick="compositeItemsManager.addComponentToEdit()">
                                        ➕ Adicionar
                                    </button>
                                </div>

                                <div id="editComponentsList" style="margin-top: 15px;">
                                    ${this.renderComponentsList()}
                                </div>
                            </div>

                            <div class="modal-actions">
                                <button type="button" onclick="closeModal('editCompositeItemModal')">Cancelar</button>
                                <button type="submit" class="btn-primary">💾 Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Prevenir fechamento ao clicar fora do modal
            const modal = document.getElementById('editCompositeItemModal');
            if (modal && typeof preventModalCloseOnBackdropClick === 'function') {
                preventModalCloseOnBackdropClick(modal);
            }

            document.getElementById('editCompositeItemForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateCompositeItem();
            });

        } catch (error) {
            console.error('Erro ao carregar item para edição:', error);
            window.notify.error('Erro ao carregar item composto');
        }
    }

    addComponentToEdit() {
        const equipmentId = document.getElementById('editComponentEquipment').value;
        const quantity = parseFloat(document.getElementById('editComponentQuantity').value);

        if (!equipmentId) {
            window.notify.warning('Selecione um equipamento');
            return;
        }

        if (!quantity || quantity <= 0) {
            window.notify.warning('Informe uma quantidade válida');
            return;
        }

        // Verificar se já foi adicionado
        if (this.tempComponents.find(c => c.equipmentId === equipmentId)) {
            window.notify.warning('Este equipamento já foi adicionado');
            return;
        }

        const equipment = this.equipmentList.find(e => e.id === equipmentId);
        if (!equipment) return;

        this.tempComponents.push({
            equipmentId,
            equipmentName: equipment.name,
            quantity,
            unit: equipment.unit
        });

        document.getElementById('editComponentEquipment').value = '';
        document.getElementById('editComponentQuantity').value = '';
        document.getElementById('editComponentsList').innerHTML = this.renderComponentsList();
    }

    async updateCompositeItem() {
        const name = document.getElementById('editCompositeName').value.trim();
        const categoryId = document.getElementById('editCompositeCategory').value || null;
        const description = document.getElementById('editCompositeDescription').value.trim() || null;

        if (!name) {
            window.notify.error('Nome é obrigatório');
            return;
        }

        if (this.tempComponents.length === 0) {
            window.notify.error('Adicione pelo menos um componente');
            return;
        }

        try {
            await window.api.updateCompositeItem(this.currentEditingItem.id, {
                name,
                categoryId,
                description,
                components: this.tempComponents.map(c => ({
                    equipmentId: c.equipmentId,
                    quantity: c.quantity
                }))
            });

            window.notify.success('Item composto atualizado com sucesso!');
            closeModal('editCompositeItemModal');
            await this.loadCompositeItems();
            this.render();
        } catch (error) {
            console.error('Erro ao atualizar item composto:', error);
            window.notify.error(error.message || 'Erro ao atualizar item composto');
        }
    }

    async deleteItem(itemId, itemName) {
        const confirmed = await window.notify.confirm({
            title: '⚠️ Excluir Item Composto',
            message: `Tem certeza que deseja excluir "${itemName}"?\n\nEsta ação não pode ser desfeita.`,
            type: 'danger',
            confirmText: 'Sim, Excluir',
            cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        try {
            await window.api.request(`/composite-items/${itemId}`, { method: 'DELETE' });
            window.notify.success('Item composto excluído com sucesso!');
            await this.loadCompositeItems();
            this.render();
        } catch (error) {
            console.error('Erro ao excluir item composto:', error);
            window.notify.error(error.message || 'Erro ao excluir item composto');
        }
    }
}

// Instância global
window.compositeItemsManager = new CompositeItemsManager();

// Autocomplete para componentes - CRIAR
let searchComponentEquipmentTimeout;

function searchComponentEquipment(query) {
    clearTimeout(searchComponentEquipmentTimeout);

    const resultsDiv = document.getElementById('componentEquipmentResults');

    if (!query || query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    searchComponentEquipmentTimeout = setTimeout(() => {
        try {
            if (!window.compositeItemsManager || !window.compositeItemsManager.equipmentList) {
                resultsDiv.innerHTML = '<div class="autocomplete-item">Nenhum equipamento disponível</div>';
                resultsDiv.style.display = 'block';
                return;
            }

            // Filtrar equipamentos por qualquer parte do nome (case-insensitive)
            const searchLower = query.toLowerCase();
            const filteredItems = window.compositeItemsManager.equipmentList.filter(item =>
                item.active !== false && item.name.toLowerCase().includes(searchLower)
            );

            if (filteredItems.length > 0) {
                const sortedItems = filteredItems.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                resultsDiv.innerHTML = sortedItems.map(item => {
                    const stockInfo = item.quantity > 0
                        ? `${item.quantity} ${item.unit}`
                        : 'SEM ESTOQUE';
                    return `
                        <div class="autocomplete-item" onclick="selectComponentEquipment('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
                            <strong>${item.name}</strong>
                            <br><small>${stockInfo}</small>
                        </div>
                    `;
                }).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div class="autocomplete-item">Nenhum equipamento encontrado</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao buscar equipamentos:', error);
        }
    }, 200);
}

function selectComponentEquipment(id, name) {
    document.getElementById('componentEquipment').value = id;
    document.getElementById('componentEquipmentSearch').value = name;
    document.getElementById('componentEquipmentResults').style.display = 'none';
}

// Autocomplete para componentes - EDITAR
let searchEditComponentEquipmentTimeout;

function searchEditComponentEquipment(query) {
    clearTimeout(searchEditComponentEquipmentTimeout);

    const resultsDiv = document.getElementById('editComponentEquipmentResults');

    if (!query || query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    searchEditComponentEquipmentTimeout = setTimeout(() => {
        try {
            if (!window.compositeItemsManager || !window.compositeItemsManager.equipmentList) {
                resultsDiv.innerHTML = '<div class="autocomplete-item">Nenhum equipamento disponível</div>';
                resultsDiv.style.display = 'block';
                return;
            }

            // Filtrar equipamentos por qualquer parte do nome (case-insensitive)
            const searchLower = query.toLowerCase();
            const filteredItems = window.compositeItemsManager.equipmentList.filter(item =>
                item.active !== false && item.name.toLowerCase().includes(searchLower)
            );

            if (filteredItems.length > 0) {
                const sortedItems = filteredItems.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                resultsDiv.innerHTML = sortedItems.map(item => {
                    const stockInfo = item.quantity > 0
                        ? `${item.quantity} ${item.unit}`
                        : 'SEM ESTOQUE';
                    return `
                        <div class="autocomplete-item" onclick="selectEditComponentEquipment('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
                            <strong>${item.name}</strong>
                            <br><small>${stockInfo}</small>
                        </div>
                    `;
                }).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div class="autocomplete-item">Nenhum equipamento encontrado</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao buscar equipamentos:', error);
        }
    }, 200);
}

function selectEditComponentEquipment(id, name) {
    document.getElementById('editComponentEquipment').value = id;
    document.getElementById('editComponentEquipmentSearch').value = name;
    document.getElementById('editComponentEquipmentResults').style.display = 'none';
}

// Fechar autocomplete ao clicar fora
document.addEventListener('click', function(e) {
    const componentResultsDiv = document.getElementById('componentEquipmentResults');
    const componentSearchInput = document.getElementById('componentEquipmentSearch');
    const editComponentResultsDiv = document.getElementById('editComponentEquipmentResults');
    const editComponentSearchInput = document.getElementById('editComponentEquipmentSearch');

    if (componentResultsDiv && componentSearchInput && e.target !== componentSearchInput && !componentResultsDiv.contains(e.target)) {
        componentResultsDiv.style.display = 'none';
    }

    if (editComponentResultsDiv && editComponentSearchInput && e.target !== editComponentSearchInput && !editComponentResultsDiv.contains(e.target)) {
        editComponentResultsDiv.style.display = 'none';
    }
});
