// Módulo de Ordens de Saída

class ExitOrdersManager {
    constructor(photoInventory) {
        this.photoInventory = photoInventory;
        this.currentOrder = {
            items: [] // Array de { equipmentId, equipmentName, quantity, unit, unitCost }
        };
        this.expandedOrders = []; // Array de IDs de ordens expandidas
        this.pendingOrderToExpand = null; // ID da ordem que deve ser expandida após renderização
    }

    // Renderizar seção de ordens de saída
    renderSection() {
        const section = document.getElementById('exit-orders-section');
        if (!section) return;

        // Limpar estado de ordens expandidas ao entrar na seção
        this.expandedOrders = [];

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
                    <input
                        type="text"
                        id="exitOrderSearchFilter"
                        placeholder="🔍 Buscar por cliente, equipamento, etc..."
                        oninput="exitOrdersManager.applyFilters()"
                        style="width: 300px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;"
                    >
                    <select id="exitOrderStatusFilter" onchange="exitOrdersManager.loadOrders()" style="flex: 1; min-width: 300px;">
                        <option value="">Todos os Status</option>
                        <option value="ativa">Ativas</option>
                        <option value="finalizada">Finalizadas</option>
                        <option value="cancelada">Canceladas</option>
                        <option value="condicional">Condicionais (c/ itens para devolução)</option>
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
            this.allOrders = response.orders || []; // Guardar todas as ordens
            this.applyFilters(); // Aplicar filtro de texto
        } catch (error) {
            console.error('Erro ao carregar ordens:', error);
            window.notify.error('Erro ao carregar ordens de saída');
        }
    }

    // Aplicar filtros de texto
    applyFilters() {
        const searchText = document.getElementById('exitOrderSearchFilter')?.value.toLowerCase().trim() || '';

        if (!this.allOrders) {
            return;
        }

        // Se não há texto de busca, mostrar todas as ordens
        if (!searchText) {
            this.currentOrders = this.allOrders;
            this.renderOrdersList(this.currentOrders);
            return;
        }

        // Filtrar ordens baseado no texto de busca
        this.currentOrders = this.allOrders.filter(order => {
            // Buscar em: motivo, cliente, destino, criado por, equipamentos e número do documento
            const reason = this.translateReason(order.reason).toLowerCase();
            const customer = (order.customer?.razaoSocial || order.customerName || '').toLowerCase();
            const destination = (order.destination || '').toLowerCase();
            const createdBy = (order.createdBy?.name || '').toLowerCase();
            const equipmentNames = (order.equipmentNames || '').toLowerCase();
            const documentNumber = (order.documentNumber || '').toLowerCase();

            return reason.includes(searchText) ||
                   customer.includes(searchText) ||
                   destination.includes(searchText) ||
                   createdBy.includes(searchText) ||
                   equipmentNames.includes(searchText) ||
                   documentNumber.includes(searchText);
        });

        this.renderOrdersList(this.currentOrders);
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

        // Processar ordem pendente para expansão automática
        if (this.pendingOrderToExpand) {
            const orderId = this.pendingOrderToExpand;
            this.pendingOrderToExpand = null; // Limpar para não processar novamente

            // Aguardar um momento para o DOM ser atualizado
            setTimeout(async () => {
                await this.expandAndScrollToOrder(orderId);
            }, 100);
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
                        ${(order.customer?.razaoSocial || order.customerName) ? `<div><strong>Cliente:</strong> ${order.customer?.razaoSocial || order.customerName}</div>` : ''}
                        <div><strong>Itens:</strong> ${order.totalItems}</div>
                        <div><strong>Valor Total:</strong> R$ ${order.totalValue.toFixed(2)}</div>
                        <div><strong>Criado por:</strong> ${order.createdBy.name}</div>
                        ${order.status === 'finalizada' && order.documentNumber ? `
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                                <div><strong>Documento Saída:</strong> ${order.documentNumber}</div>
                                <div><strong>Finalizada em:</strong> ${this.formatDateTime(order.finalizedAt)}</div>
                                <div><strong>Finalizada por:</strong> ${order.finalizedBy?.name || '-'}</div>
                            </div>
                        ` : ''}
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
                <td>${order.customer?.razaoSocial || order.customerName || order.destination || '-'}</td>
                <td style="text-align: center;">${order.totalItems}</td>
                <td><strong>R$ ${order.totalValue.toFixed(2)}</strong></td>
                <td>${order.createdBy.name}</td>
                <td class="actions-cell-compact">
                    ${order.status === 'ativa' ? `
                        <button class="btn-icon" onclick="exitOrdersManager.finalizeOrder('${order.id}')" title="Finalizar ordem">
                            ✅
                        </button>
                        <button class="btn-icon" onclick="exitOrdersManager.cancelOrder('${order.id}')" title="Cancelar ordem">
                            ❌
                        </button>
                    ` : ''}
                </td>
            </tr>
            <tr id="${detailsId}" class="order-details-row" style="display: ${isExpanded ? 'table-row' : 'none'};">
                <td colspan="10">
                    <div class="order-details-container" id="order-details-content-${order.id}">
                        <!-- Conteúdo será carregado ao expandir -->
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

            // Mostrar indicador de carregamento
            const container = document.getElementById(`order-details-content-${orderId}`);
            if (container) {
                container.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">⏳ Carregando itens...</div>';
            }

            // Carregar detalhes da ordem
            await this.loadOrderDetails(orderId);
        }
    }

    // Carregar detalhes da ordem para exibição expandida
    async loadOrderDetails(orderId) {
        const container = document.getElementById(`order-details-content-${orderId}`);

        try {
            console.log('🔍 Carregando detalhes da ordem:', orderId);
            const response = await window.api.getExitOrder(orderId);
            console.log('✅ Resposta recebida:', response);

            const order = response.order;

            if (!order) {
                throw new Error('Ordem não encontrada na resposta');
            }

            if (!order.items || !Array.isArray(order.items)) {
                console.warn('⚠️ Ordem sem itens ou itens inválidos:', order);
                order.items = [];
            }

            console.log('📦 Ordem carregada com', order.items.length, 'itens');

            // Renderizar detalhes expandidos
            container.innerHTML = this.renderExpandedOrderDetails(order);

            console.log('✅ Detalhes renderizados com sucesso');

        } catch (error) {
            console.error('❌ Erro ao carregar detalhes da ordem:', error);
            console.error('Stack trace:', error.stack);
            container.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #f44336;">
                    ❌ Erro ao carregar detalhes da ordem<br>
                    <small style="color: #666; font-size: 0.85rem;">${error.message}</small><br>
                    <button class="btn-secondary btn-small" onclick="exitOrdersManager.loadOrderDetails('${orderId}')" style="margin-top: 10px;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    // Expandir e fazer scroll até uma ordem específica
    async expandAndScrollToOrder(orderId) {
        // Garantir que a ordem está marcada como expandida
        if (!this.expandedOrders.includes(orderId)) {
            this.expandedOrders.push(orderId);
        }

        // Encontrar elementos da ordem
        const detailsRow = document.getElementById(`order-details-${orderId}`);
        const expandBtn = document.querySelector(`[onclick*="toggleOrderDetails('${orderId}')"]`);
        const orderRow = document.querySelector(`[data-order-id="${orderId}"]`);

        if (!detailsRow || !expandBtn || !orderRow) {
            console.warn('Ordem não encontrada na tabela:', orderId);
            return;
        }

        // Expandir a linha
        detailsRow.style.display = 'table-row';
        expandBtn.classList.add('expanded');

        // Mostrar indicador de carregamento
        const container = document.getElementById(`order-details-content-${orderId}`);
        if (container) {
            container.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">⏳ Carregando itens...</div>';
        }

        // Carregar os detalhes da ordem
        await this.loadOrderDetails(orderId);

        // Fazer scroll suave até a ordem
        orderRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Adicionar destaque temporário
        orderRow.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
            orderRow.style.backgroundColor = '';
        }, 2000);
    }

    // Renderizar detalhes expandidos da ordem (com edição inline)
    renderExpandedOrderDetails(order) {
        const isEditable = order.status === 'ativa';

        let html = `
            <div class="expanded-order-details">
                <div class="expanded-order-info">
                    ${order.destination ? `<div><strong>Destino:</strong> ${order.destination}</div>` : ''}
                    ${(order.customer?.razaoSocial || order.customerName) ? `<div><strong>Cliente:</strong> ${order.customer?.razaoSocial || order.customerName}</div>` : ''}
                    ${order.customerDocument ? `<div><strong>Doc:</strong> ${order.customerDocument}</div>` : ''}
                    ${order.notes ? `<div><strong>Obs:</strong> ${order.notes}</div>` : ''}
                    ${order.status === 'finalizada' && order.documentNumber ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                            <div><strong>Documento Saída:</strong> ${order.documentNumber}</div>
                            <div><strong>Finalizada em:</strong> ${this.formatDateTime(order.finalizedAt)}</div>
                            <div><strong>Finalizada por:</strong> ${order.finalizedBy?.name || '-'}</div>
                        </div>
                    ` : ''}
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
                                step="1"
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
                            <button
                                class="btn-delete-inline"
                                onclick="exitOrdersManager.deleteOrderItem('${order.id}', '${item.id}')"
                                title="Excluir item">
                                🗑️
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
                ${isEditable && window.currentUser?.role === 'admin' ? `
                    <div style="margin-top: 15px; text-align: right;">
                        <button class="btn-add-item" onclick="exitOrdersManager.showAddItemModal('${order.id}')" title="Adicionar novo item à ordem">
                            ➕ Adicionar Item
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        return html;
    }

    // Salvar edição inline
    async saveInlineEdit(orderId, itemId) {
        const qtyInput = document.getElementById(`inline-qty-${itemId}`);

        const newQuantity = parseFloat(qtyInput.value);

        if (isNaN(newQuantity) || newQuantity < 0) {
            window.notify.warning('Quantidade inválida');
            return;
        }

        try {
            // Atualizar quantidade
            const qtyResponse = await window.api.updateExitOrderItem(orderId, itemId, newQuantity);

            window.notify.success(qtyResponse.message);

            // Recarregar detalhes da ordem (mantém expandida)
            await this.loadOrderDetails(orderId);

            // Atualizar a ordem na lista em memória (para atualizar totais sem re-renderizar)
            if (this.currentOrders) {
                const orderIndex = this.currentOrders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    const updatedOrderResponse = await window.api.getExitOrder(orderId);
                    const updatedOrder = updatedOrderResponse.order;
                    this.currentOrders[orderIndex].totalItems = updatedOrder.totalItems;
                    this.currentOrders[orderIndex].totalValue = updatedOrder.totalValue;

                    // Atualizar apenas os valores na tabela sem re-renderizar
                    const orderRow = document.querySelector(`[data-order-id="${orderId}"]`);
                    if (orderRow) {
                        const itemsCell = orderRow.querySelector('td:nth-child(7)');
                        const valueCell = orderRow.querySelector('td:nth-child(8)');
                        if (itemsCell) itemsCell.textContent = updatedOrder.totalItems;
                        if (valueCell) valueCell.innerHTML = `<strong>R$ ${updatedOrder.totalValue.toFixed(2)}</strong>`;
                    }
                }
            }

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

    // Excluir item da ordem
    async deleteOrderItem(orderId, itemId) {
        const confirmed = await window.notify.confirm({
            title: 'Excluir Item da Ordem',
            message: 'Tem certeza que deseja excluir este item da ordem?\n\nO item será devolvido ao estoque.',
            type: 'warning',
            confirmText: 'Excluir',
            cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        try {
            const response = await window.api.deleteExitOrderItem(orderId, itemId);
            window.notify.success(response.message);

            // Recarregar detalhes da ordem
            await this.loadOrderDetails(orderId);

            // Atualizar a ordem na lista em memória
            if (this.currentOrders) {
                const orderIndex = this.currentOrders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    const updatedOrderResponse = await window.api.getExitOrder(orderId);
                    const updatedOrder = updatedOrderResponse.order;
                    this.currentOrders[orderIndex].totalItems = updatedOrder.totalItems;
                    this.currentOrders[orderIndex].totalValue = updatedOrder.totalValue;

                    // Atualizar apenas os valores na tabela
                    const orderRow = document.querySelector(`[data-order-id="${orderId}"]`);
                    if (orderRow) {
                        const itemsCell = orderRow.querySelector('td:nth-child(7)');
                        const valueCell = orderRow.querySelector('td:nth-child(8)');
                        if (itemsCell) itemsCell.textContent = updatedOrder.totalItems;
                        if (valueCell) valueCell.innerHTML = `<strong>R$ ${updatedOrder.totalValue.toFixed(2)}</strong>`;
                    }
                }
            }

            // Recarregar estoque
            this.photoInventory.items = await this.photoInventory.loadItems();
            this.photoInventory.renderAllItems();
            this.photoInventory.updateSummary();
            this.photoInventory.populateModalSelects();

        } catch (error) {
            console.error('Erro ao excluir item:', error);
            window.notify.error('Erro: ' + error.message);
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
                                <option value="venda">Venda</option>
                                <option value="garantia">Garantia</option>
                                <option value="condicional">Condicional</option>
                                <option value="instalacao">Instalação</option>
                                <option value="uso_interno">Uso Interno</option>
                                <option value="perda">Perda/Avaria</option>
                                <option value="outros">Outros</option>
                            </select>
                            <select id="newExitOrderCustomerId" onchange="exitOrdersManager.onCustomerSelect(this.value)">
                                <option value="">👤 Selecione um cliente (opcional)</option>
                            </select>
                            <input type="text" id="newExitOrderDestination" placeholder="Destino/Local (opcional)">
                            <input type="text" id="newExitOrderCustomerDoc" placeholder="CNPJ do Cliente" readonly style="background: #f5f5f5;">
                            <textarea id="newExitOrderNotes" placeholder="Observações"></textarea>
                        </div>

                        <div class="form-section">
                            <h3>Itens da Ordem</h3>
                            <div class="add-item-form">
                                <select id="newExitOrderItemSelect">
                                    <option value="">Selecione um equipamento</option>
                                </select>
                                <input type="number" id="newExitOrderItemQuantity" placeholder="Quantidade" min="1" step="1">
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

        // Povoar select de clientes
        this.populateCustomersSelect();

        // Resetar ordem atual
        this.currentOrder = { items: [] };
        this.updateOrderSummary();
    }

    // Povoar select de equipamentos
    populateEquipmentSelect() {
        const select = document.getElementById('newExitOrderItemSelect');
        if (!select) return;

        // CORREÇÃO: Sempre usar a referência atualizada do window.photoInventory
        // para garantir que temos os dados mais recentes do estoque
        const currentInventory = window.photoInventory || this.photoInventory;

        const availableItems = currentInventory.items
            .filter(item => item.quantity > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        select.innerHTML = '<option value="">Selecione um equipamento</option>' +
            availableItems.map(item =>
                `<option value="${item.id}" data-quantity="${item.quantity}" data-unit="${item.unit}" data-cost="${item.currentCost}">
                    ${item.name} (${item.quantity} ${item.unit} disponíveis)
                </option>`
            ).join('');
    }

    // Povoar select de clientes
    async populateCustomersSelect() {
        const select = document.getElementById('newExitOrderCustomerId');
        if (!select) {
            console.warn('Select de clientes não encontrado');
            return;
        }

        try {
            console.log('🔍 Buscando clientes...');
            // Buscar todos os clientes ativos
            const response = await window.api.searchCustomers('', 1000);
            console.log('✅ Resposta da API:', response);

            if (response.customers && response.customers.length > 0) {
                console.log(`📦 ${response.customers.length} clientes recebidos`);

                const activeCustomers = response.customers
                    .filter(c => c.ativo !== false)
                    .sort((a, b) => {
                        const nameA = (a.razao_social).toLowerCase();
                        const nameB = (b.razao_social).toLowerCase();
                        return nameA.localeCompare(nameB, 'pt-BR');
                    });

                console.log(`✔️ ${activeCustomers.length} clientes ativos filtrados`);

                // Armazenar clientes para uso posterior
                this.customersData = {};
                activeCustomers.forEach(customer => {
                    this.customersData[customer.id] = customer;
                });

                select.innerHTML = '<option value="">👤 Selecione um cliente (opcional)</option>' +
                    activeCustomers.map(customer =>
                        `<option value="${customer.id}">
                            ${customer.razao_social}${customer.cidade ? ` - ${customer.cidade}` : ''}
                        </option>`
                    ).join('');

                console.log('✅ Dropdown populado com sucesso');
            } else {
                console.warn('⚠️ Nenhum cliente retornado pela API');
                select.innerHTML = '<option value="">👤 Nenhum cliente cadastrado</option>';
            }
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            select.innerHTML = '<option value="">👤 Erro ao carregar clientes</option>';
        }
    }

    // Callback quando cliente é selecionado
    onCustomerSelect(customerId) {
        const docInput = document.getElementById('newExitOrderCustomerDoc');

        if (!customerId || !this.customersData || !this.customersData[customerId]) {
            // Limpar CNPJ se nenhum cliente selecionado
            if (docInput) docInput.value = '';
            return;
        }

        const customer = this.customersData[customerId];

        // Preencher CNPJ automaticamente
        if (docInput && customer.cnpj) {
            docInput.value = customer.cnpj;
        }
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
        this.renderNewOrderItems();
        this.updateOrderSummary();
    }

    // Remover item da ordem
    removeItemFromOrder(equipmentId) {
        this.currentOrder.items = this.currentOrder.items.filter(
            item => item.equipmentId !== equipmentId
        );
        this.renderNewOrderItems();
        this.updateOrderSummary();
    }

    // Renderizar itens da nova ordem (durante criação)
    renderNewOrderItems() {
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

        // Renderizar como tabela com capacidade de editar quantidades
        let html = `
            <table class="order-items-preview-table">
                <thead>
                    <tr>
                        <th>Equipamento</th>
                        <th style="width: 180px;">Quantidade</th>
                        <th style="width: 100px;">Custo Unit.</th>
                        <th style="width: 100px;">Total</th>
                        <th style="width: 80px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.currentOrder.items.forEach(item => {
            html += `
                <tr>
                    <td><strong>${item.equipmentName}</strong></td>
                    <td>
                        <input
                            type="number"
                            id="preview-qty-${item.equipmentId}"
                            value="${item.quantity}"
                            min="1"
                            step="1"
                            class="inline-edit-input"
                            onchange="exitOrdersManager.updatePreviewItemQuantity('${item.equipmentId}', this.value)"
                        />
                        <span class="item-unit">${item.unit}</span>
                    </td>
                    <td>R$ ${item.unitCost.toFixed(2)}</td>
                    <td><strong>R$ ${item.totalCost.toFixed(2)}</strong></td>
                    <td style="text-align: center;">
                        <button
                            class="btn-danger btn-small"
                            onclick="exitOrdersManager.removeItemFromOrder('${item.equipmentId}')"
                            title="Remover item">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // Atualizar quantidade de item no preview (antes de criar a ordem)
    updatePreviewItemQuantity(equipmentId, newQuantity) {
        const qty = parseFloat(newQuantity);

        if (isNaN(qty) || qty <= 0) {
            window.notify.warning('Quantidade inválida');
            // Restaurar valor anterior
            const item = this.currentOrder.items.find(i => i.equipmentId === equipmentId);
            if (item) {
                document.getElementById(`preview-qty-${equipmentId}`).value = item.quantity;
            }
            return;
        }

        // Verificar estoque disponível - usar referência atualizada
        const currentInventory = window.photoInventory || this.photoInventory;
        const equipment = currentInventory.items.find(e => e.id === equipmentId);
        if (equipment && qty > equipment.quantity) {
            window.notify.error(`Quantidade insuficiente! Disponível: ${equipment.quantity} ${equipment.unit}`);
            // Restaurar valor anterior
            const item = this.currentOrder.items.find(i => i.equipmentId === equipmentId);
            if (item) {
                document.getElementById(`preview-qty-${equipmentId}`).value = item.quantity;
            }
            return;
        }

        // Atualizar item
        const item = this.currentOrder.items.find(i => i.equipmentId === equipmentId);
        if (item) {
            item.quantity = qty;
            item.totalCost = qty * item.unitCost;

            // Atualizar apenas o total na linha (sem re-renderizar tudo)
            const row = document.querySelector(`tr:has(#preview-qty-${equipmentId})`);
            if (row) {
                const totalCell = row.querySelector('td:nth-child(4)');
                if (totalCell) {
                    totalCell.innerHTML = `<strong>R$ ${item.totalCost.toFixed(2)}</strong>`;
                }
            }

            // Atualizar resumo
            this.updateOrderSummary();
        }
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
        const customerDocument = document.getElementById('newExitOrderCustomerDoc').value.trim();
        const notes = document.getElementById('newExitOrderNotes').value.trim();
        const customerId = document.getElementById('newExitOrderCustomerId').value;

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
                customerDocument,
                notes,
                customerId: customerId || null,
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

    // Modal para adicionar item a ordem existente (apenas admin)
    showAddItemModal(orderId) {
        if (window.currentUser?.role !== 'admin') {
            window.notify.error('Apenas administradores podem adicionar itens');
            return;
        }

        const modalHtml = `
            <div id="addItemToOrderModal" class="modal" style="display: flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <h2>➕ Adicionar Item à Ordem</h2>

                    <div class="add-item-form" style="display: flex; flex-direction: column; gap: 15px; margin: 20px 0;">
                        <select id="addItemEquipmentSelect" style="padding: 10px;">
                            <option value="">Selecione um equipamento</option>
                        </select>
                        <input type="number" id="addItemQuantity" placeholder="Quantidade" min="1" step="1" style="padding: 10px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="addItemConditional" style="width: auto; transform: scale(1.5);">
                            <span>🔄 Marcar como condicional (pode ser devolvido)</span>
                        </label>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="exitOrdersManager.closeAddItemModal()">Cancelar</button>
                        <button type="button" class="btn-primary" onclick="exitOrdersManager.addItemToExistingOrder('${orderId}')">
                            ➕ Adicionar Item
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const existingModal = document.getElementById('addItemToOrderModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Povoar select de equipamentos
        this.populateAddItemEquipmentSelect();
    }

    // Povoar select de equipamentos para adicionar item
    populateAddItemEquipmentSelect() {
        const select = document.getElementById('addItemEquipmentSelect');
        if (!select) return;

        const currentInventory = window.photoInventory || this.photoInventory;

        const availableItems = currentInventory.items
            .filter(item => item.quantity > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        select.innerHTML = '<option value="">Selecione um equipamento</option>' +
            availableItems.map(item =>
                `<option value="${item.id}" data-quantity="${item.quantity}" data-unit="${item.unit}" data-cost="${item.currentCost}">
                    ${item.name} (${item.quantity} ${item.unit} disponíveis)
                </option>`
            ).join('');
    }

    // Adicionar item a ordem existente
    async addItemToExistingOrder(orderId) {
        const select = document.getElementById('addItemEquipmentSelect');
        const quantityInput = document.getElementById('addItemQuantity');
        const conditionalCheckbox = document.getElementById('addItemConditional');

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
        const availableQuantity = parseFloat(option.dataset.quantity);
        const unit = option.dataset.unit;

        // Verificar estoque
        if (quantity > availableQuantity) {
            window.notify.error(`Quantidade insuficiente! Disponível: ${availableQuantity} ${unit}`);
            return;
        }

        try {
            const response = await window.api.request(`/exit-orders/${orderId}/items`, {
                method: 'POST',
                body: JSON.stringify({
                    equipmentId,
                    quantity,
                    isConditional: conditionalCheckbox.checked
                })
            });

            window.notify.success('Item adicionado com sucesso!');
            this.closeAddItemModal();

            // Recarregar lista de ordens (já renderiza automaticamente)
            await this.loadOrders();

        } catch (error) {
            console.error('Erro ao adicionar item:', error);
            window.notify.error(error.message || 'Erro ao adicionar item');
        }
    }

    closeAddItemModal() {
        const modal = document.getElementById('addItemToOrderModal');
        if (modal) modal.remove();
    }

    // Visualizar ordem
    async viewOrder(orderId) {
        try {
            const response = await window.api.getExitOrder(orderId);
            const order = response.order;

            this.currentEditingOrder = order; // Armazenar ordem atual
            this.isEditMode = false; // Modo de edição

            const totalItems = order.items.length;
            const totalValue = order.items.reduce((sum, item) => sum + item.totalCost, 0);

            const modalHtml = `
                <div id="viewExitOrderModal" class="modal" style="display: flex;">
                    <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">

                        <!-- Cabeçalho -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
                            <h2 style="margin: 0;">📋 Ordem de Saída #${order.orderNumber}</h2>
                            <span class="exit-order-status status-${order.status}" style="font-size: 16px; padding: 8px 16px;">
                                ${order.status.toUpperCase()}
                            </span>
                        </div>

                        <!-- Informações Principais em Cards -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Data de Criação</div>
                                <div style="font-weight: 600;">${this.formatDateTime(order.createdAt)}</div>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Criado por</div>
                                <div style="font-weight: 600;">${order.createdBy.name}</div>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Motivo</div>
                                <div style="font-weight: 600;">${this.translateReason(order.reason)}</div>
                            </div>
                        </div>

                        <!-- Detalhes Adicionais -->
                        <div style="background: #fafafa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${order.destination ? `
                                    <tr>
                                        <td style="padding: 6px 0; width: 150px; color: #666;">Destino/Local:</td>
                                        <td style="padding: 6px 0; font-weight: 500;">${order.destination}</td>
                                    </tr>
                                ` : ''}
                                ${(order.customer?.razaoSocial || order.customerName) ? `
                                    <tr>
                                        <td style="padding: 6px 0; color: #666;">Cliente:</td>
                                        <td style="padding: 6px 0; font-weight: 500;">${order.customer?.razaoSocial || order.customerName}</td>
                                    </tr>
                                ` : ''}
                                ${order.customerDocument ? `
                                    <tr>
                                        <td style="padding: 6px 0; color: #666;">Documento:</td>
                                        <td style="padding: 6px 0; font-weight: 500;">${order.customerDocument}</td>
                                    </tr>
                                ` : ''}
                                ${order.notes ? `
                                    <tr>
                                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Observações:</td>
                                        <td style="padding: 6px 0;">${order.notes}</td>
                                    </tr>
                                ` : ''}
                            </table>
                        </div>

                        ${order.status === 'cancelada' ? `
                            <div style="background: #ffebee; padding: 15px; border-radius: 6px; border-left: 4px solid #f44336; margin-bottom: 20px;">
                                <strong style="color: #c62828;">❌ Ordem Cancelada</strong><br>
                                <div style="margin-top: 8px; font-size: 14px;">
                                    <strong>Cancelado em:</strong> ${this.formatDateTime(order.cancelledAt)}<br>
                                    <strong>Cancelado por:</strong> ${order.cancelledBy.name}
                                    ${order.cancellationReason ? `<br><strong>Motivo:</strong> ${order.cancellationReason}` : ''}
                                </div>
                            </div>
                        ` : ''}

                        ${order.status === 'finalizada' && order.documentNumber ? `
                            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; border-left: 4px solid #4CAF50; margin-bottom: 20px;">
                                <strong style="color: #2e7d32;">✅ Ordem Finalizada</strong><br>
                                <div style="margin-top: 8px; font-size: 14px;">
                                    <strong>Documento Saída:</strong> ${order.documentNumber}<br>
                                    <strong>Finalizada em:</strong> ${this.formatDateTime(order.finalizedAt)}<br>
                                    <strong>Finalizada por:</strong> ${order.finalizedBy?.name || '-'}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Tabela de Itens -->
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <h3 style="margin: 0;">Itens da Ordem</h3>
                                ${order.status === 'ativa' ? `
                                    <button id="toggleEditModeBtn" class="btn-secondary btn-small" onclick="exitOrdersManager.toggleEditMode()">
                                        ✏️ Editar
                                    </button>
                                ` : ''}
                            </div>

                            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e0e0e0;">
                                <thead>
                                    <tr style="background: #f5f5f5; border-bottom: 2px solid #e0e0e0;">
                                        <th style="padding: 12px; text-align: left; font-weight: 600;">Equipamento</th>
                                        <th style="padding: 12px; text-align: center; width: 120px; font-weight: 600;">Quantidade</th>
                                        <th style="padding: 12px; text-align: right; width: 120px; font-weight: 600;">Custo Unit.</th>
                                        <th style="padding: 12px; text-align: right; width: 120px; font-weight: 600;">Total</th>
                                    </tr>
                                </thead>
                                <tbody id="exitOrderItemsContainer">
                                    ${this.renderOrderItems(order.items, false)}
                                </tbody>
                                <tfoot>
                                    <tr style="background: #fafafa; border-top: 2px solid #e0e0e0; font-weight: 600;">
                                        <td style="padding: 12px;">TOTAL</td>
                                        <td style="padding: 12px; text-align: center;">${totalItems} ${totalItems === 1 ? 'item' : 'itens'}</td>
                                        <td style="padding: 12px;"></td>
                                        <td style="padding: 12px; text-align: right; color: #2e7d32; font-size: 16px;">R$ ${totalValue.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <!-- Botões de Ação -->
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
            const isConditional = item.isConditional || false;
            const rowStyle = isModified ? 'background: #fff3e0;' : (isConditional ? 'background: #e3f2fd;' : '');

            if (editMode) {
                // Modo de edição com inputs
                html += `
                    <tr style="${rowStyle} ${isModified ? 'cursor: pointer;' : ''}" ${isModified ? `onclick="exitOrdersManager.showItemHistory('${item.id}')"` : ''}>
                        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
                            ${item.equipmentName}
                            ${isModified ? '<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">✏️ Modificado</span>' : ''}
                            ${isConditional ? '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">🔄 Condicional</span>' : ''}
                        </td>
                        <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e0e0e0;">
                            <input
                                type="number"
                                id="item-qty-${item.id}"
                                value="${item.quantity}"
                                min="1"
                                step="1"
                                style="width: 70px; padding: 6px; text-align: center; border: 1px solid #ccc; border-radius: 4px;"
                            />
                            ${item.unit}
                            <button class="btn-primary btn-small" onclick="exitOrdersManager.updateItemQuantity('${item.id}', document.getElementById('item-qty-${item.id}').value); event.stopPropagation();" style="margin-left: 8px; padding: 4px 8px; font-size: 12px;">
                                💾
                            </button>
                        </td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0;">R$ ${item.unitCost.toFixed(2)}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0; font-weight: 600;">R$ ${item.totalCost.toFixed(2)}</td>
                    </tr>
                `;
            } else {
                // Modo visualização normal
                html += `
                    <tr style="${rowStyle} ${isModified ? 'cursor: pointer;' : ''}" ${isModified ? `onclick="exitOrdersManager.showItemHistory('${item.id}')"` : ''}>
                        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
                            ${item.equipmentName}
                            ${isModified ? '<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">✏️ Modificado</span>' : ''}
                            ${isConditional ? '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">🔄 Condicional</span>' : ''}
                        </td>
                        <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e0e0e0;">${item.quantity} ${item.unit}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0;">R$ ${item.unitCost.toFixed(2)}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0; font-weight: 600;">R$ ${item.totalCost.toFixed(2)}</td>
                    </tr>
                `;
            }
        });

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

    // Finalizar ordem
    async finalizeOrder(orderId) {
        const confirmed = await window.notify.confirm({
            title: 'Finalizar Ordem de Saída',
            message: 'Tem certeza que deseja finalizar esta ordem?\n\nApós finalizar, a ordem não poderá mais ser editada.',
            type: 'info',
            confirmText: 'Finalizar',
            cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        // Pedir número do documento
        const documentNumber = prompt('Número do documento fiscal (NF, etc):');

        if (!documentNumber || !documentNumber.trim()) {
            window.notify.warning('Número do documento é obrigatório para finalizar a ordem');
            return;
        }

        try {
            await window.api.finalizeExitOrder(orderId, documentNumber.trim());

            // Recarregar ordens
            this.loadOrders();

            window.notify.success('Ordem finalizada com sucesso!');

        } catch (error) {
            console.error('Erro ao finalizar ordem:', error);
            window.notify.error('Erro ao finalizar ordem: ' + error.message);
        }
    }

    // Helpers
    translateReason(reason) {
        const reasons = {
            'venda': 'Venda',
            'garantia': 'Garantia',
            'condicional': 'Condicional',
            'instalacao': 'Instalação',
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
