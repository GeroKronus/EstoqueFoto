class CompositeItemsManager {
    constructor() {
        this.compositeItems = [];
        this.equipmentList = [];
        this.categories = [];
        this.currentEditingItem = null;
        this.tempComponents = [];
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
            const inventory = window.photoInventory || {};
            this.equipmentList = inventory.items || [];
            console.log(`✅ ${this.equipmentList.length} equipamentos disponíveis`);
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
        }
    }

    async loadCategories() {
        try {
            const inventory = window.photoInventory || {};
            this.categories = inventory.categories || [];
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    }

    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="composite-items-container">
                <div class="page-header">
                    <h1>📦 Itens Compostos (Kits)</h1>
                    <p>Crie kits formados por múltiplos equipamentos. Ao dar saída de um kit, todos os componentes são baixados automaticamente.</p>
                    ${photoAuthManager.isAdmin() ? `
                        <button class="btn-primary" onclick="compositeItemsManager.showCreateModal()">
                            ➕ Novo Item Composto
                        </button>
                    ` : ''}
                </div>

                <div id="compositeItemsList" class="composite-items-list">
                    ${this.renderList()}
                </div>
            </div>
        `;
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
                                <select id="componentEquipment" style="flex: 1; padding: 10px;">
                                    <option value="">Selecione um equipamento</option>
                                    ${this.equipmentList.filter(e => e.active).map(e =>
                                        `<option value="${e.id}">${e.name} (${e.quantity} ${e.unit})</option>`
                                    ).join('')}
                                </select>
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
        document.getElementById('componentsList').innerHTML = this.renderComponentsList();
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
        } catch (error) {
            console.error('Erro ao visualizar item composto:', error);
            window.notify.error('Erro ao carregar detalhes');
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
