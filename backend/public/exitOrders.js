// Módulo de Ordens de Saída

class ExitOrdersManager {
    constructor(photoInventory) {
        this.photoInventory = photoInventory;
        this.currentOrder = {
            items: [] // Array de { equipmentId, equipmentName, quantity, unit, unitCost }
        };
        this.expandedOrders = []; // Array de IDs de ordens expandidas
    }

    // Renderizar seção de ordens de saída
    renderSection() {
        const section = document.getElementById('exit-orders-section');
        if (!section) return;

        // Carregar modo de visualização do localStorage
        this.viewMode = localStorage.getItem('exitOrdersViewMode') || 'table';

        section.innerHTML = `
            <div class="exit-orders-container">
                <div class="exit-orders-header">
                    <h2>📋 Ordens de Saída</h2>
                    <button class="btn-primary" onclick="exitOrdersManager.showNewOrderModal()">
                        ➕ Nova Ordem de Saída
                    </button>
                </div>

                <div class="exit-orders-filters">
                    <select id="exitOrderStatusFilter" onchange="exitOrdersManager.loadOrders()">
                        <option value="">Todos os Status</option>
                        <option value="ativa">Ativas</option>
                        <option value="cancelada">Canceladas</option>
                    </select>
                    <input type="date" id="exitOrderDateFrom" onchange="exitOrdersManager.loadOrders()">
                    <input type="date" id="exitOrderDateTo" onchange="exitOrdersManager.loadOrders()">
                    <button onclick="exitOrdersManager.loadOrders()">Filtrar</button>

                    <div class="view-mode-toggle" style="margin-left: auto;">
                        <label>Visualização:</label>
                        <div class="toggle-buttons">
                            <button id="exitOrdersViewCards" class="toggle-btn ${this.viewMode === 'cards' ? 'active' : ''}" onclick="exitOrdersManager.toggleViewMode('cards')">
                                🔲 Cards
                            </button>
                            <button id="exitOrdersViewTable" class="toggle-btn ${this.viewMode === 'table' ? 'active' : ''}" onclick="exitOrdersManager.toggleViewMode('table')">
                                📋 Tabela
                            </button>
                        </div>
                    </div>
                </div>

                <div id="exitOrdersList" class="exit-orders-list">
                    <div style="padding: 40px; text-align: center; color: #666;">
                        Carregando ordens de saída...
                    </div>
                </div>
            </div>
        `;

        this.loadOrders();
    }

    // Toggle modo de visualização
    toggleViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('exitOrdersViewMode', mode);

        // Atualizar botões
        document.getElementById('exitOrdersViewCards')?.classList.toggle('active', mode === 'cards');
        document.getElementById('exitOrdersViewTable')?.classList.toggle('active', mode === 'table');

        // Re-renderizar com os dados atuais
        if (this.currentOrders) {
            this.renderOrdersList(this.currentOrders);
        }
    }

    // Carregar ordens
    async loadOrders() {
        try {
            const status = document.getElementById('exitOrderStatusFilter')?.value;
            const dateFrom = document.getElementById('exitOrderDateFrom')?.value;
            const dateTo = document.getElementById('exitOrderDateTo')?.value;

            const params = {};
            if (status) params.status = status;
            if (dateFrom) params.dateFrom = dateFrom;
            if (dateTo) params.dateTo = dateTo;

            const response = await window.api.getExitOrders(params);
            this.currentOrders = response.orders || [];
            this.renderOrdersList(this.currentOrders);
        } catch (error) {
            console.error('Erro ao carregar ordens:', error);
            window.notify.error('Erro ao carregar ordens de saída');
        }
    }

    // Renderizar lista de ordens
    renderOrdersList(orders) {
        const container = document.getElementById('exitOrdersList');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    Nenhuma ordem de saída encontrada.
                </div>
            `;
            return;
        }

        if (this.viewMode === 'table') {
            container.innerHTML = this.renderTableView(orders);
        } else {
            container.innerHTML = this.renderCardsView(orders);
        }
    }

    // Renderizar visualização em cards (modo anterior)
    renderCardsView(orders) {
        return orders.map(order => `
            <div class="exit-order-card ${order.status === 'cancelada' ? 'cancelled' : ''}">
                <div class="exit-order-header">
                    <div class="exit-order-number">
                        OS #${order.orderNumber}
                        <span class="exit-order-status status-${order.status}">${order.status.toUpperCase()}</span>
                    </div>
                    <div class="exit-order-date">${this.formatDateTime(order.createdAt)}</div>
                </div>
                <div class="exit-order-body">
                    <div class="exit-order-info">
                        <div><strong>Motivo:</strong> ${this.translateReason(order.reason)}</div>
                        ${order.destination ? `<div><strong>Destino:</strong> ${order.destination}</div>` : ''}
                        ${order.customerName ? `<div><strong>Cliente:</strong> ${order.customerName}</div>` : ''}
                        <div><strong>Itens:</strong> ${order.totalItems}</div>
                        <div><strong>Valor Total:</strong> R$ ${order.totalValue.toFixed(2)}</div>
                        <div><strong>Criado por:</strong> ${order.createdBy.name}</div>
                    </div>
                </div>
                <div class="exit-order-actions">
                    <button class="btn-secondary" onclick="exitOrdersManager.viewOrder('${order.id}')">
                        👁️ Visualizar
                    </button>
                    ${order.status === 'ativa' ? `
                        <button class="btn-danger" onclick="exitOrdersManager.cancelOrder('${order.id}')">
                            ❌ Cancelar
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // Renderizar visualização em tabela
    renderTableView(orders) {
        return `
            <table class="exit-orders-table">
                <thead>
                    <tr>
                        <th style="width: 50px;"></th>
                        <th>OS #</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Motivo</th>
                        <th>Cliente/Destino</th>
                        <th>Itens</th>
                        <th>Valor Total</th>
                        <th>Criado por</th>
                        <th style="width: 120px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => this.renderTableOrderRow(order)).join('')}
                </tbody>
            </table>
        `;
    }

    // Renderizar linha da ordem na tabela
    renderTableOrderRow(order) {
        const rowId = `order-row-${order.id}`;
        const detailsId = `order-details-${order.id}`;
        const isExpanded = this.expandedOrders?.includes(order.id);

        return `
            <tr class="exit-order-table-row ${order.status === 'cancelada' ? 'cancelled-row' : ''}" data-order-id="${order.id}">
                <td class="expand-cell">
                    <button class="expand-btn ${isExpanded ? 'expanded' : ''}" onclick="exitOrdersManager.toggleOrderDetails('${order.id}')" title="Expandir/Recolher itens">
                        ▶
                    </button>
                </td>
                <td><strong>${order.orderNumber}</strong></td>
                <td>${this.formatDate(order.createdAt)}<br><small style="color: #666;">${this.formatTime(order.createdAt)}</small></td>
                <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
                <td>${this.translateReason(order.reason)}</td>
                <td>${order.customerName || order.destination || '-'}</td>
                <td style="text-align: center;">${order.totalItems}</td>
                <td><strong>R$ ${order.totalValue.toFixed(2)}</strong></td>
                <td>${order.createdBy.name}</td>
                <td class="actions-cell-compact">
                    ${order.status === 'ativa' ? `
                        <button class="btn-icon" onclick="exitOrdersManager.cancelOrder('${order.id}')" title="Cancelar ordem">
                            ❌
                        </button>
                    ` : ''}
                </td>
            </tr>
            <tr id="${detailsId}" class="order-details-row" style="display: ${isExpanded ? 'table-row' : 'none'};">
                <td colspan="10">
                    <div class="order-details-container" id="order-details-content-${order.id}">
                        <div style="padding: 15px; text-align: center; color: #666;">
                            Carregando itens...
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    // Expandir/Recolher detalhes da ordem
    async toggleOrderDetails(orderId) {
        const detailsRow = document.getElementById(`order-details-${orderId}`);
        const expandBtn = event.target;
        const isCurrentlyExpanded = this.expandedOrders.includes(orderId);

        if (isCurrentlyExpanded) {
            // Recolher
            detailsRow.style.display = 'none';
            expandBtn.classList.remove('expanded');
            this.expandedOrders = this.expandedOrders.filter(id => id !== orderId);
        } else {
            // Expandir
            detailsRow.style.display = 'table-row';
            expandBtn.classList.add('expanded');
            this.expandedOrders.push(orderId);

            // Carregar detalhes da ordem
            await this.loadOrderDetails(orderId);
        }
    }

    // Carregar detalhes da ordem para exibição expandida
    async loadOrderDetails(orderId) {
        const container = document.getElementById(`order-details-content-${orderId}`);

        try {
            const response = await window.api.getExitOrder(orderId);
            const order = response.order;

            // Renderizar detalhes expandidos
            container.innerHTML = this.renderExpandedOrderDetails(order);

        } catch (error) {
            console.error('Erro ao carregar detalhes da ordem:', error);
            container.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #f44336;">
                    Erro ao carregar detalhes da ordem
                </div>
            `;
        }
    }

    // Renderizar detalhes expandidos da ordem (com edição inline)
    renderExpandedOrderDetails(order) {
        const isEditable = order.status === 'ativa';

        let html = `
            <div class="expanded-order-details">
                <div class="expanded-order-info">
                    ${order.destination ? `<div><strong>Destino:</strong> ${order.destination}</div>` : ''}
                    ${order.customerName ? `<div><strong>Cliente:</strong> ${order.customerName}</div>` : ''}
                    ${order.customerDocument ? `<div><strong>Doc:</strong> ${order.customerDocument}</div>` : ''}
                    ${order.notes ? `<div><strong>Obs:</strong> ${order.notes}</div>` : ''}
                </div>

                <table class="order-items-table">
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th style="width: 200px;">Quantidade</th>
                            <th>Custo Unit.</th>
                            <th>Total</th>
                            ${isEditable ? '<th style="width: 100px;">Condicional</th>' : ''}
                            ${isEditable ? '<th style="width: 80px;"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        order.items.forEach(item => {
            const isModified = item.isModified || false;
            const isConditional = item.isConditional || false;
            const rowClass = isModified ? 'modified-item-row' : (isConditional ? 'conditional-item-row' : '');

            html += `
                <tr class="${rowClass}" data-item-id="${item.id}">
                    <td>
                        ${item.equipmentName}
                        ${isModified ? '<span class="modified-badge">✏️ Modificado</span>' : ''}
                        ${isConditional ? '<span class="conditional-badge">🔄 Condicional</span>' : ''}
                    </td>
                    <td>
                        ${isEditable ? `
                            <input
                                type="number"
                                id="inline-qty-${item.id}"
                                value="${item.quantity}"
                                min="0"
                                step="0.01"
                                class="inline-edit-input"
                            />
                            <span class="item-unit">${item.unit}</span>
                        ` : `${item.quantity} ${item.unit}`}
                    </td>
                    <td>R$ ${item.unitCost.toFixed(2)}</td>
                    <td><strong>R$ ${item.totalCost.toFixed(2)}</strong></td>
                    ${isEditable ? `
                        <td class="conditional-cell" style="text-align: center;">
                            <input
                                type="checkbox"
                                id="conditional-${item.id}"
                                ${isConditional ? 'checked' : ''}
                                onchange="exitOrdersManager.toggleConditional('${order.id}', '${item.id}', this.checked)"
                                class="conditional-checkbox"
                                title="Marcar como condicional (pode ser devolvido)"
                            />
                        </td>
                        <td class="item-actions">
                            <button
                                class="btn-save-inline"
                                onclick="exitOrdersManager.saveInlineEdit('${order.id}', '${item.id}')"
                                title="Salvar alteração">
                                💾
                            </button>
                            ${isModified ? `
                                <button
                                    class="btn-history-inline"
                                    onclick="exitOrdersManager.showItemHistoryInline('${order.id}', '${item.id}')"
                                    title="Ver histórico">
                                    📜
                                </button>
                            ` : ''}
                        </td>
                    ` : ''}
                </tr>
            `;
        });

        const totalValue = order.items.reduce((sum, item) => sum + item.totalCost, 0);

        html += `
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td><strong>TOTAL</strong></td>
                            <td><strong>${order.items.length} itens</strong></td>
                            <td></td>
                            <td><strong>R$ ${totalValue.toFixed(2)}</strong></td>
                            ${isEditable ? '<td></td><td></td>' : ''}
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        return html;
    }

    // Salvar edição inline
    async saveInlineEdit(orderId, itemId) {
        const input = document.getElementById(`inline-qty-${itemId}`);
        const newQuantity = parseFloat(input.value);

        if (isNaN(newQuantity) || newQuantity < 0) {
            window.notify.warning('Quantidade inválida');
            return;
        }

        try {
            const response = await window.api.updateExitOrderItem(orderId, itemId, newQuantity);
            window.notify.success(response.message);

            // Recarregar detalhes da ordem
            await this.loadOrderDetails(orderId);

            // Recarregar lista de ordens (para atualizar totais)
            await this.loadOrders();

            // Recarregar estoque
            this.photoInventory.items = await this.photoInventory.loadItems();
            this.photoInventory.renderAllItems();
            this.photoInventory.updateSummary();
            this.photoInventory.populateModalSelects();

        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            window.notify.error('Erro: ' + error.message);
        }
    }

    // Mostrar histórico inline
    async showItemHistoryInline(orderId, itemId) {
        try {
            const response = await window.api.getExitOrderItemHistory(orderId, itemId);
            const history = response.history;

            if (!history || history.length === 0) {
                window.notify.info('Nenhuma alteração registrada para este item');
                return;
            }

            const modalHtml = `
                <div id="itemHistoryModal" class="modal" style="display: flex;">
                    <div class="modal-content" style="max-width: 600px;">
                        <h2>📜 Histórico de Alterações</h2>
                        <h3>${history[0].equipmentName}</h3>

                        <div class="history-list">
                            ${history.map(entry => `
                                <div class="history-entry">
                                    <div class="history-header">
                                        <strong>📅 ${this.formatDateTime(entry.changedAt)}</strong>
                                        <span style="background: #2196F3; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                                            👤 ${entry.changedBy.name}
                                        </span>
                                    </div>
                                    <div class="history-details">
                                        <div>Quantidade alterada de <strong>${entry.previousQuantity} ${entry.equipmentUnit}</strong> para <strong>${entry.newQuantity} ${entry.equipmentUnit}</strong></div>
                                        <div>Diferença: <strong style="color: ${entry.quantityDifference > 0 ? '#f44336' : '#4CAF50'}">${entry.quantityDifference > 0 ? '+' : ''}${entry.quantityDifference} ${entry.equipmentUnit}</strong></div>
                                        ${entry.reason ? `<div class="history-reason">${entry.reason}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div class="modal-actions">
                            <button type="button" onclick="exitOrdersManager.closeItemHistoryModal()">Fechar</button>
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('itemHistoryModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHtml);

        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            window.notify.error('Erro ao carregar histórico');
        }
    }

    // Toggle item condicional
    async toggleConditional(orderId, itemId, isConditional) {
        try {
            const response = await window.api.toggleExitOrderItemConditional(orderId, itemId, isConditional);
            window.notify.success(response.message);

            // Recarregar detalhes da ordem
            await this.loadOrderDetails(orderId);

        } catch (error) {
            console.error('Erro ao atualizar status condicional:', error);
            window.notify.error('Erro: ' + error.message);

            // Reverter checkbox
            const checkbox = document.getElementById(`conditional-${itemId}`);
            if (checkbox) {
                checkbox.checked = !isConditional;
            }
        }
    }

    // Mostrar modal de nova ordem
    showNewOrderModal() {
        // Criar modal dinamicamente
        const modalHtml = `
            <div id="newExitOrderModal" class="modal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <h2>📋 Nova Ordem de Saída</h2>

                    <div class="exit-order-form">
                        <div class="form-section">
                            <h3>Informações Gerais</h3>
                            <select id="newExitOrderReason" required>
                                <option value="">Motivo da saída</option>
                                <option value="aluguel">Aluguel</option>
                                <option value="venda">Venda</option>
                                <option value="manutencao">Manutenção</option>
                                <option value="uso_interno">Uso Interno</option>
                                <option value="perda">Perda/Avaria</option>
                                <option value="outros">Outros</option>
                            </select>
                            <input type="text" id="newExitOrderDestination" placeholder="Destino/Local">
                            <input type="text" id="newExitOrderCustomerName" placeholder="Nome do Cliente (opcional)">
                            <input type="text" id="newExitOrderCustomerDoc" placeholder="CPF/CNPJ do Cliente (opcional)">
                            <textarea id="newExitOrderNotes" placeholder="Observações"></textarea>
                        </div>

                        <div class="form-section">
                            <h3>Itens da Ordem</h3>
                            <div class="add-item-form">
                                <select id="newExitOrderItemSelect">
                                    <option value="">Selecione um equipamento</option>
                                </select>
                                <input type="number" id="newExitOrderItemQuantity" placeholder="Quantidade" min="0.01" step="0.01">
                                <button type="button" class="btn-primary" onclick="exitOrdersManager.addItemToOrder()">
                                    ➕ Adicionar Item
                                </button>
                            </div>

                            <div id="exitOrderItemsList" class="exit-order-items-list">
                                <div style="padding: 20px; text-align: center; color: #666;">
                                    Nenhum item adicionado ainda
                                </div>
                            </div>

                            <div class="exit-order-total">
                                <strong>Total de Itens:</strong> <span id="exitOrderTotalItems">0</span><br>
                                <strong>Valor Total:</strong> R$ <span id="exitOrderTotalValue">0.00</span>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="exitOrdersManager.closeNewOrderModal()">Cancelar</button>
                        <button type="button" class="btn-primary" onclick="exitOrdersManager.createOrder()">Criar Ordem</button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar modal ao body
        const existingModal = document.getElementById('newExitOrderModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Povoar select de equipamentos
        this.populateEquipmentSelect();

        // Resetar ordem atual
        this.currentOrder = { items: [] };
        this.updateOrderSummary();
    }

    // Povoar select de equipamentos
    populateEquipmentSelect() {
        const select = document.getElementById('newExitOrderItemSelect');
        if (!select) return;

        const availableItems = this.photoInventory.items
            .filter(item => item.quantity > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        select.innerHTML = '<option value="">Selecione um equipamento</option>' +
            availableItems.map(item =>
                `<option value="${item.id}" data-quantity="${item.quantity}" data-unit="${item.unit}" data-cost="${item.currentCost}">
                    ${item.name} (${item.quantity} ${item.unit} disponíveis)
                </option>`
            ).join('');
    }

    // Adicionar item à ordem
    addItemToOrder() {
        const select = document.getElementById('newExitOrderItemSelect');
        const quantityInput = document.getElementById('newExitOrderItemQuantity');

        if (!select.value) {
            window.notify.warning('Selecione um equipamento');
            return;
        }

        const quantity = parseFloat(quantityInput.value);
        if (!quantity || quantity <= 0) {
            window.notify.warning('Informe uma quantidade válida');
            return;
        }

        const option = select.options[select.selectedIndex];
        const equipmentId = option.value;
        const equipmentName = option.text.split('(')[0].trim();
        const availableQuantity = parseFloat(option.dataset.quantity);
        const unit = option.dataset.unit;
        const unitCost = parseFloat(option.dataset.cost);

        // Verificar se já está na lista
        if (this.currentOrder.items.find(item => item.equipmentId === equipmentId)) {
            window.notify.warning('Este equipamento já foi adicionado');
            return;
        }

        // Verificar estoque
        if (quantity > availableQuantity) {
            window.notify.error(`Quantidade insuficiente! Disponível: ${availableQuantity} ${unit}`);
            return;
        }

        // Adicionar item
        this.currentOrder.items.push({
            equipmentId,
            equipmentName,
            quantity,
            unit,
            unitCost,
            totalCost: quantity * unitCost
        });

        // Limpar formulário
        select.value = '';
        quantityInput.value = '';

        // Atualizar lista
        this.renderOrderItems();
        this.updateOrderSummary();
    }

    // Remover item da ordem
    removeItemFromOrder(equipmentId) {
        this.currentOrder.items = this.currentOrder.items.filter(
            item => item.equipmentId !== equipmentId
        );
        this.renderOrderItems();
        this.updateOrderSummary();
    }

    // Renderizar itens da ordem
    renderOrderItems() {
        const container = document.getElementById('exitOrderItemsList');
        if (!container) return;

        if (this.currentOrder.items.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    Nenhum item adicionado ainda
                </div>
            `;
            return;
        }

        container.innerHTML = this.currentOrder.items.map(item => `
            <div class="exit-order-item">
                <div class="exit-order-item-info">
                    <strong>${item.equipmentName}</strong><br>
                    ${item.quantity} ${item.unit} × R$ ${item.unitCost.toFixed(2)} = R$ ${item.totalCost.toFixed(2)}
                </div>
                <button class="btn-danger btn-small" onclick="exitOrdersManager.removeItemFromOrder('${item.equipmentId}')">
                    🗑️
                </button>
            </div>
        `).join('');
    }

    // Atualizar resumo da ordem
    updateOrderSummary() {
        const totalItems = this.currentOrder.items.length;
        const totalValue = this.currentOrder.items.reduce((sum, item) => sum + item.totalCost, 0);

        const totalItemsEl = document.getElementById('exitOrderTotalItems');
        const totalValueEl = document.getElementById('exitOrderTotalValue');

        if (totalItemsEl) totalItemsEl.textContent = totalItems;
        if (totalValueEl) totalValueEl.textContent = totalValue.toFixed(2);
    }

    // Criar ordem
    async createOrder() {
        const reason = document.getElementById('newExitOrderReason').value;
        const destination = document.getElementById('newExitOrderDestination').value.trim();
        const customerName = document.getElementById('newExitOrderCustomerName').value.trim();
        const customerDocument = document.getElementById('newExitOrderCustomerDoc').value.trim();
        const notes = document.getElementById('newExitOrderNotes').value.trim();

        // Validações
        if (!reason) {
            window.notify.warning('Selecione o motivo da saída');
            return;
        }

        if (this.currentOrder.items.length === 0) {
            window.notify.warning('Adicione pelo menos um item à ordem');
            return;
        }

        try {
            const orderData = {
                reason,
                destination,
                customerName,
                customerDocument,
                notes,
                items: this.currentOrder.items.map(item => ({
                    equipmentId: item.equipmentId,
                    quantity: item.quantity
                }))
            };

            console.log('Criando ordem de saída:', orderData);

            const response = await window.api.createExitOrder(orderData);

            console.log('Ordem criada:', response);

            // Recarregar estoque
            this.photoInventory.items = await this.photoInventory.loadItems();
            this.photoInventory.renderAllItems();
            this.photoInventory.updateSummary();
            this.photoInventory.populateModalSelects();

            // Fechar modal e recarregar ordens
            this.closeNewOrderModal();
            this.loadOrders();

            window.notify.success(response.message || 'Ordem de saída criada com sucesso!');

        } catch (error) {
            console.error('Erro ao criar ordem:', error);
            window.notify.error('Erro ao criar ordem: ' + error.message);
        }
    }

    // Fechar modal de nova ordem
    closeNewOrderModal() {
        const modal = document.getElementById('newExitOrderModal');
        if (modal) modal.remove();
    }

    // Visualizar ordem
    async viewOrder(orderId) {
        try {
            const response = await window.api.getExitOrder(orderId);
            const order = response.order;

            this.currentEditingOrder = order; // Armazenar ordem atual
            this.isEditMode = false; // Modo de edição

            const modalHtml = `
                <div id="viewExitOrderModal" class="modal" style="display: flex;">
                    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                        <h2>📋 Ordem de Saída #${order.orderNumber}</h2>

                        <div class="exit-order-details">
                            <div class="detail-row">
                                <strong>Status:</strong>
                                <span class="exit-order-status status-${order.status}">${order.status.toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Data de Criação:</strong> ${this.formatDateTime(order.createdAt)}
                            </div>
                            <div class="detail-row">
                                <strong>Criado por:</strong> ${order.createdBy.name}
                            </div>
                            <div class="detail-row">
                                <strong>Motivo:</strong> ${this.translateReason(order.reason)}
                            </div>
                            ${order.destination ? `<div class="detail-row"><strong>Destino:</strong> ${order.destination}</div>` : ''}
                            ${order.customerName ? `<div class="detail-row"><strong>Cliente:</strong> ${order.customerName}</div>` : ''}
                            ${order.customerDocument ? `<div class="detail-row"><strong>Documento:</strong> ${order.customerDocument}</div>` : ''}
                            ${order.notes ? `<div class="detail-row"><strong>Observações:</strong> ${order.notes}</div>` : ''}

                            ${order.status === 'cancelada' ? `
                                <div class="cancellation-info">
                                    <strong>Cancelado em:</strong> ${this.formatDateTime(order.cancelledAt)}<br>
                                    <strong>Cancelado por:</strong> ${order.cancelledBy.name}<br>
                                    ${order.cancellationReason ? `<strong>Motivo:</strong> ${order.cancellationReason}` : ''}
                                </div>
                            ` : ''}

                            <h3>Itens da Ordem
                                ${order.status === 'ativa' ? `
                                    <button id="toggleEditModeBtn" class="btn-secondary btn-small" onclick="exitOrdersManager.toggleEditMode()" style="margin-left: 10px;">
                                        ✏️ Editar
                                    </button>
                                ` : ''}
                            </h3>
                            <div id="exitOrderItemsContainer" class="exit-order-items-table">
                                ${this.renderOrderItems(order.items, false)}
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" onclick="exitOrdersManager.closeViewOrderModal()">Fechar</button>
                            ${order.status === 'ativa' ? `
                                <button type="button" class="btn-danger" onclick="exitOrdersManager.cancelOrderFromView('${order.id}')">
                                    ❌ Cancelar Ordem
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('viewExitOrderModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHtml);

        } catch (error) {
            console.error('Erro ao visualizar ordem:', error);
            window.notify.error('Erro ao carregar ordem');
        }
    }

    // Renderizar itens da ordem (modo visualização ou edição)
    renderOrderItems(items, editMode) {
        let html = '';

        items.forEach(item => {
            const isModified = item.isModified || false;
            const rowClass = isModified ? 'exit-order-item-row modified-item' : 'exit-order-item-row';

            if (editMode) {
                // Modo de edição com inputs
                html += `
                    <div class="${rowClass}" ${isModified ? `onclick="exitOrdersManager.showItemHistory('${item.id}')"` : ''} style="${isModified ? 'cursor: pointer;' : ''}">
                        <div>${item.equipmentName} ${isModified ? '<span class="modified-badge">✏️ Modificado</span>' : ''}</div>
                        <div>
                            <input
                                type="number"
                                id="item-qty-${item.id}"
                                value="${item.quantity}"
                                min="0"
                                step="0.01"
                                style="width: 80px; padding: 4px;"
                            />
                            ${item.unit}
                            <button class="btn-primary btn-small" onclick="exitOrdersManager.updateItemQuantity('${item.id}', document.getElementById('item-qty-${item.id}').value); event.stopPropagation();" style="margin-left: 5px;">
                                💾 Salvar
                            </button>
                        </div>
                        <div>R$ ${item.unitCost.toFixed(2)}</div>
                        <div>R$ ${item.totalCost.toFixed(2)}</div>
                    </div>
                `;
            } else {
                // Modo visualização normal
                html += `
                    <div class="${rowClass}" ${isModified ? `onclick="exitOrdersManager.showItemHistory('${item.id}')"` : ''} style="${isModified ? 'cursor: pointer;' : ''}">
                        <div>${item.equipmentName} ${isModified ? '<span class="modified-badge">✏️ Modificado</span>' : ''}</div>
                        <div>${item.quantity} ${item.unit}</div>
                        <div>R$ ${item.unitCost.toFixed(2)}</div>
                        <div>R$ ${item.totalCost.toFixed(2)}</div>
                    </div>
                `;
            }
        });

        // Total
        const totalItems = items.length;
        const totalValue = items.reduce((sum, item) => sum + item.totalCost, 0);

        html += `
            <div class="exit-order-total-row">
                <div><strong>TOTAL</strong></div>
                <div><strong>${totalItems} itens</strong></div>
                <div></div>
                <div><strong>R$ ${totalValue.toFixed(2)}</strong></div>
            </div>
        `;

        return html;
    }

    // Alternar modo de edição
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const container = document.getElementById('exitOrderItemsContainer');
        const btn = document.getElementById('toggleEditModeBtn');

        if (this.isEditMode) {
            btn.textContent = '👁️ Visualizar';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-warning');
        } else {
            btn.textContent = '✏️ Editar';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-secondary');
        }

        container.innerHTML = this.renderOrderItems(this.currentEditingOrder.items, this.isEditMode);
    }

    // Atualizar quantidade de um item
    async updateItemQuantity(itemId, newQuantity) {
        try {
            const orderId = this.currentEditingOrder.id;
            const newQty = parseFloat(newQuantity);

            if (isNaN(newQty) || newQty < 0) {
                window.notify.warning('Quantidade inválida');
                return;
            }

            const response = await window.api.updateExitOrderItem(orderId, itemId, newQty);

            window.notify.success(response.message);

            // Recarregar ordem
            const updatedOrder = await window.api.getExitOrder(orderId);
            this.currentEditingOrder = updatedOrder.order;

            // Atualizar visualização
            const container = document.getElementById('exitOrderItemsContainer');
            container.innerHTML = this.renderOrderItems(this.currentEditingOrder.items, this.isEditMode);

            // Recarregar estoque
            this.photoInventory.items = await this.photoInventory.loadItems();
            this.photoInventory.renderAllItems();
            this.photoInventory.updateSummary();
            this.photoInventory.populateModalSelects();

        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            window.notify.error('Erro: ' + error.message);
        }
    }

    // Mostrar histórico de alterações de um item
    async showItemHistory(itemId) {
        try {
            const orderId = this.currentEditingOrder.id;
            const response = await window.api.getExitOrderItemHistory(orderId, itemId);
            const history = response.history;

            if (!history || history.length === 0) {
                window.notify.info('Nenhuma alteração registrada para este item');
                return;
            }

            const modalHtml = `
                <div id="itemHistoryModal" class="modal" style="display: flex;">
                    <div class="modal-content" style="max-width: 600px;">
                        <h2>📜 Histórico de Alterações</h2>
                        <h3>${history[0].equipmentName}</h3>

                        <div class="history-list">
                            ${history.map(entry => `
                                <div class="history-entry">
                                    <div class="history-header">
                                        <strong>📅 ${this.formatDateTime(entry.changedAt)}</strong>
                                        <span style="background: #2196F3; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                                            👤 ${entry.changedBy.name}
                                        </span>
                                    </div>
                                    <div class="history-details">
                                        <div>Quantidade alterada de <strong>${entry.previousQuantity} ${entry.equipmentUnit}</strong> para <strong>${entry.newQuantity} ${entry.equipmentUnit}</strong></div>
                                        <div>Diferença: <strong style="color: ${entry.quantityDifference > 0 ? '#f44336' : '#4CAF50'}">${entry.quantityDifference > 0 ? '+' : ''}${entry.quantityDifference} ${entry.equipmentUnit}</strong></div>
                                        ${entry.reason ? `<div class="history-reason">${entry.reason}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div class="modal-actions">
                            <button type="button" onclick="exitOrdersManager.closeItemHistoryModal()">Fechar</button>
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('itemHistoryModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHtml);

        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            window.notify.error('Erro ao carregar histórico');
        }
    }

    // Fechar modal de histórico
    closeItemHistoryModal() {
        const modal = document.getElementById('itemHistoryModal');
        if (modal) modal.remove();
    }

    // Fechar modal de visualização
    closeViewOrderModal() {
        const modal = document.getElementById('viewExitOrderModal');
        if (modal) modal.remove();
    }

    // Cancelar ordem
    async cancelOrder(orderId) {
        const confirmed = await window.notify.confirm({
            title: 'Cancelar Ordem de Saída',
            message: 'Tem certeza que deseja cancelar esta ordem?\n\nTodos os itens serão devolvidos ao estoque.',
            type: 'warning',
            confirmText: 'Cancelar Ordem',
            cancelText: 'Não Cancelar'
        });

        if (!confirmed) return;

        // Pedir motivo do cancelamento
        const reason = prompt('Motivo do cancelamento (opcional):');

        try {
            await window.api.cancelExitOrder(orderId, reason || '');

            // Recarregar estoque
            this.photoInventory.items = await this.photoInventory.loadItems();
            this.photoInventory.renderAllItems();
            this.photoInventory.updateSummary();
            this.photoInventory.populateModalSelects();

            // Recarregar ordens
            this.loadOrders();

            window.notify.success('Ordem cancelada com sucesso! Itens devolvidos ao estoque.');

        } catch (error) {
            console.error('Erro ao cancelar ordem:', error);
            window.notify.error('Erro ao cancelar ordem: ' + error.message);
        }
    }

    // Cancelar ordem da visualização
    async cancelOrderFromView(orderId) {
        this.closeViewOrderModal();
        await this.cancelOrder(orderId);
    }

    // Helpers
    translateReason(reason) {
        const reasons = {
            'aluguel': 'Aluguel',
            'venda': 'Venda',
            'manutencao': 'Manutenção',
            'uso_interno': 'Uso Interno',
            'perda': 'Perda/Avaria',
            'outros': 'Outros'
        };
        return reasons[reason] || reason;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
    }
}

// Inicializar globalmente quando o PhotoInventoryManager estiver pronto
window.exitOrdersManager = null;
