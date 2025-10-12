// Módulo de Ordens de Saída

class ExitOrdersManager {
    constructor(photoInventory) {
        this.photoInventory = photoInventory;
        this.currentOrder = {
            items: [] // Array de { equipmentId, equipmentName, quantity, unit, unitCost }
        };
    }

    // Renderizar seção de ordens de saída
    renderSection() {
        const section = document.getElementById('exit-orders-section');
        if (!section) return;

        section.innerHTML = `
            <div class="exit-orders-container">
                <div class="exit-orders-header">
                    <h2>📋 Ordens de Saída</h2>
                    <button class="btn-primary" onclick="exitOrdersManager.showNewOrderModal()">
                        ➕ Nova Ordem de Saída
                    </button>
                </div>

                <div class="exit-orders-filters">
                    <select id="exitOrderStatusFilter">
                        <option value="">Todos os Status</option>
                        <option value="ativa">Ativas</option>
                        <option value="cancelada">Canceladas</option>
                    </select>
                    <input type="date" id="exitOrderDateFrom" placeholder="Data inicial">
                    <input type="date" id="exitOrderDateTo" placeholder="Data final">
                    <button onclick="exitOrdersManager.loadOrders()">Filtrar</button>
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
            this.renderOrdersList(response.orders || []);
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

        container.innerHTML = orders.map(order => `
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

            const modalHtml = `
                <div id="viewExitOrderModal" class="modal" style="display: flex;">
                    <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
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

                            <h3>Itens da Ordem</h3>
                            <div class="exit-order-items-table">
                                ${order.items.map(item => `
                                    <div class="exit-order-item-row">
                                        <div>${item.equipmentName}</div>
                                        <div>${item.quantity} ${item.unit}</div>
                                        <div>R$ ${item.unitCost.toFixed(2)}</div>
                                        <div>R$ ${item.totalCost.toFixed(2)}</div>
                                    </div>
                                `).join('')}
                                <div class="exit-order-total-row">
                                    <div><strong>TOTAL</strong></div>
                                    <div><strong>${order.totalItems} itens</strong></div>
                                    <div></div>
                                    <div><strong>R$ ${order.totalValue.toFixed(2)}</strong></div>
                                </div>
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

    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
    }
}

// Inicializar globalmente quando o PhotoInventoryManager estiver pronto
window.exitOrdersManager = null;
