// Módulo de Ordens de Serviço
class ServiceOrderManager {
    constructor() {
        this.currentOrders = [];
        this.currentView = 'list'; // 'list' ou 'details'
        this.selectedOrderId = null;
    }

    async initialize() {
        console.log('Inicializando Service Order Manager...');
        this.renderMainUI();
        await this.loadOrders();
        this.renderOrdersList();
    }

    renderMainUI() {
        const section = document.getElementById('service-orders-section');
        if (!section) return;

        section.innerHTML = `
            <div class="os-container">
                <div class="os-header">
                    <div>
                        <h2>🔧 Ordens de Serviço</h2>
                    </div>
                    <div class="os-filters">
                        <input type="text" id="osSearchInput" placeholder="🔍 Buscar OS..." oninput="serviceOrderManager.handleSearch()">
                        <select id="osStatusFilter" onchange="serviceOrderManager.handleFilterChange()">
                            <option value="">Todos os status</option>
                            <option value="aguardando_orcamento">Aguardando Orçamento</option>
                            <option value="orcamento_pendente">Orçamento Pendente</option>
                            <option value="aprovado">Aprovado</option>
                            <option value="em_reparo">Em Reparo</option>
                            <option value="concluido">Concluído</option>
                            <option value="aguardando_retirada">Aguardando Retirada</option>
                            <option value="entregue">Entregue</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                        <button class="btn-new-os" onclick="serviceOrderManager.showNewOSModal()">
                            ➕ Nova OS
                        </button>
                    </div>
                </div>
                <div id="serviceOrdersContent"></div>
            </div>
        `;
    }

    async loadOrders(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await window.api.request(`/service-orders?${params}`);
            this.currentOrders = response.orders || [];
            return this.currentOrders;
        } catch (error) {
            console.error('Erro ao carregar ordens de serviço:', error);
            window.notify.error('Erro ao carregar ordens de serviço');
            return [];
        }
    }

    async getOrder(id) {
        try {
            const response = await window.api.request(`/service-orders/${id}`);
            return response.order;
        } catch (error) {
            console.error('Erro ao buscar ordem de serviço:', error);
            window.notify.error('Erro ao buscar ordem de serviço');
            return null;
        }
    }

    handleSearch() {
        const search = document.getElementById('osSearchInput').value;
        const status = document.getElementById('osStatusFilter').value;
        this.loadOrders({ search, status }).then(() => this.renderOrdersList());
    }

    handleFilterChange() {
        this.handleSearch();
    }

    renderOrdersList() {
        const container = document.getElementById('serviceOrdersContent');
        if (!container) return;

        const statusColors = {
            'aguardando_orcamento': '#ff9800',
            'orcamento_pendente': '#2196F3',
            'aprovado': '#4CAF50',
            'em_reparo': '#9C27B0',
            'concluido': '#00BCD4',
            'aguardando_retirada': '#8BC34A',
            'entregue': '#4CAF50',
            'cancelado': '#f44336'
        };

        const statusLabels = {
            'aguardando_orcamento': 'Aguardando Orçamento',
            'orcamento_pendente': 'Orçamento Pendente',
            'aprovado': 'Aprovado',
            'em_reparo': 'Em Reparo',
            'concluido': 'Concluído',
            'aguardando_retirada': 'Aguardando Retirada',
            'entregue': 'Entregue',
            'cancelado': 'Cancelado'
        };

        if (this.currentOrders.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔧</div>
                    <h3>Nenhuma Ordem de Serviço encontrada</h3>
                    <p style="margin-top: 10px;">Clique no botão "Nova OS" para criar a primeira ordem de serviço.</p>
                </div>
            `;
            return;
        }

        const ordersHtml = this.currentOrders.map(order => {
            const statusColor = statusColors[order.status] || '#666';
            const statusLabel = statusLabels[order.status] || order.status;
            const customerName = order.customer?.nomeFantasia || order.customer?.razaoSocial || 'Cliente não informado';
            const equipamento = `${order.equipamento?.marca || ''} ${order.equipamento?.modelo || ''}`.trim() || 'Não informado';

            return `
                <div class="os-card status-${order.status}" onclick="serviceOrderManager.showOrderDetails('${order.id}')">
                    <div class="os-card-header">
                        <div class="os-numero">${order.numeroOS}</div>
                        <div class="os-status status-${order.status}">${statusLabel}</div>
                    </div>
                    <div class="os-info">
                        <div>🏢 <strong>Cliente:</strong> ${customerName}</div>
                        <div>📱 <strong>Equipamento:</strong> ${equipamento}</div>
                        <div>⚠️ <strong>Defeito:</strong> ${order.defeitoRelatado.substring(0, 50)}${order.defeitoRelatado.length > 50 ? '...' : ''}</div>
                        ${order.tecnicoResponsavel ? `<div>🔧 <strong>Técnico:</strong> ${order.tecnicoResponsavel.name}</div>` : ''}
                        <div>📅 <strong>Entrada:</strong> ${new Date(order.dataEntrada).toLocaleDateString('pt-BR')}</div>
                    </div>
                    ${order.valorOrcado > 0 || order.valorFinal > 0 ? `
                        <div class="os-valores">
                            ${order.valorOrcado > 0 ? `
                                <div class="os-valor-item">
                                    <div class="os-valor-label">Orçado</div>
                                    <div class="os-valor-value">R$ ${order.valorOrcado.toFixed(2)}</div>
                                </div>
                            ` : ''}
                            ${order.valorFinal > 0 ? `
                                <div class="os-valor-item">
                                    <div class="os-valor-label">Final</div>
                                    <div class="os-valor-value">R$ ${order.valorFinal.toFixed(2)}</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="os-grid">
                ${ordersHtml}
            </div>
        `;
    }

    async showOrderDetails(orderId) {
        this.selectedOrderId = orderId;
        this.currentView = 'details';

        const container = document.getElementById('serviceOrdersContent');
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Carregando detalhes...</p></div>';

        const order = await this.getOrder(orderId);
        if (!order) {
            this.currentView = 'list';
            this.renderOrdersList();
            return;
        }

        const statusLabels = {
            'aguardando_orcamento': 'Aguardando Orçamento',
            'orcamento_pendente': 'Orçamento Pendente',
            'aprovado': 'Aprovado',
            'em_reparo': 'Em Reparo',
            'concluido': 'Concluído',
            'aguardando_retirada': 'Aguardando Retirada',
            'entregue': 'Entregue',
            'cancelado': 'Cancelado'
        };

        const statusLabel = statusLabels[order.status] || order.status;

        container.innerHTML = `
            <div class="os-details">
                <div class="os-details-header">
                    <div class="os-details-title">
                        <h2>${order.numeroOS}</h2>
                        <div class="os-status status-${order.status}">${statusLabel}</div>
                    </div>
                    <div class="os-actions">
                        <button onclick="serviceOrderManager.backToList()" class="btn-os-action btn-os-back">← Voltar</button>
                        <button onclick="serviceOrderManager.showUpdateStatusModal('${order.id}')" class="btn-os-action btn-os-primary">
                            Atualizar Status
                        </button>
                    </div>
                </div>

                <div class="os-details-grid">
                    <!-- Cliente -->
                    <div class="os-details-section">
                        <h3>🏢 Cliente</h3>
                        ${order.customer ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Razão Social:</div>
                                <div class="os-info-value">${order.customer.razaoSocial}</div>
                            </div>
                            ${order.customer.nomeFantasia ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Nome Fantasia:</div>
                                    <div class="os-info-value">${order.customer.nomeFantasia}</div>
                                </div>
                            ` : ''}
                            ${order.customer.telefone ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Telefone:</div>
                                    <div class="os-info-value">${order.customer.telefone}</div>
                                </div>
                            ` : ''}
                            ${order.customer.email ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Email:</div>
                                    <div class="os-info-value">${order.customer.email}</div>
                                </div>
                            ` : ''}
                        ` : '<p>Cliente não informado</p>'}
                    </div>

                    <!-- Equipamento -->
                    <div class="os-details-section">
                        <h3>📱 Equipamento</h3>
                        ${order.equipamento?.marca ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Marca:</div>
                                <div class="os-info-value">${order.equipamento.marca}</div>
                            </div>
                        ` : ''}
                        ${order.equipamento?.modelo ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Modelo:</div>
                                <div class="os-info-value">${order.equipamento.modelo}</div>
                            </div>
                        ` : ''}
                        ${order.equipamento?.serial ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Serial:</div>
                                <div class="os-info-value">${order.equipamento.serial}</div>
                            </div>
                        ` : ''}
                        ${order.acessorios ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Acessórios:</div>
                                <div class="os-info-value">${order.acessorios}</div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Defeitos -->
                    <div class="os-details-section" style="grid-column: 1 / -1;">
                        <h3>⚠️ Defeitos</h3>
                        <div class="os-info-row">
                            <div class="os-info-label">Relatado:</div>
                            <div class="os-info-value">${order.defeitoRelatado}</div>
                        </div>
                        ${order.defeitoConstatado ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Constatado:</div>
                                <div class="os-info-value">${order.defeitoConstatado}</div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Valores -->
                    <div class="os-details-section">
                        <h3>💰 Valores e Prazos</h3>
                        ${order.valorOrcado > 0 ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Valor Orçado:</div>
                                <div class="os-info-value">R$ ${order.valorOrcado.toFixed(2)}</div>
                            </div>
                        ` : ''}
                        ${order.valorFinal > 0 ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Valor Final:</div>
                                <div class="os-info-value">R$ ${order.valorFinal.toFixed(2)}</div>
                            </div>
                        ` : ''}
                        ${order.prazoEstimado ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Prazo Estimado:</div>
                                <div class="os-info-value">${new Date(order.prazoEstimado).toLocaleDateString('pt-BR')}</div>
                            </div>
                        ` : ''}
                        <div class="os-info-row">
                            <div class="os-info-label">Garantia:</div>
                            <div class="os-info-value">${order.garantiaDias} dias</div>
                        </div>
                    </div>

                    <!-- Responsáveis -->
                    <div class="os-details-section">
                        <h3>👥 Responsáveis</h3>
                        ${order.tecnicoResponsavel ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Técnico:</div>
                                <div class="os-info-value">${order.tecnicoResponsavel.name}</div>
                            </div>
                        ` : ''}
                        ${order.recebidoPor ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Recebido por:</div>
                                <div class="os-info-value">${order.recebidoPor.name}</div>
                            </div>
                        ` : ''}
                        ${order.entreguePor ? `
                            <div class="os-info-row">
                                <div class="os-info-label">Entregue por:</div>
                                <div class="os-info-value">${order.entreguePor.name}</div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Datas -->
                    <div class="os-details-section" style="grid-column: 1 / -1;">
                        <h3>📅 Datas</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            <div class="os-info-row">
                                <div class="os-info-label">Entrada:</div>
                                <div class="os-info-value">${new Date(order.dataEntrada).toLocaleString('pt-BR')}</div>
                            </div>
                            ${order.dataOrcamento ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Orçamento:</div>
                                    <div class="os-info-value">${new Date(order.dataOrcamento).toLocaleString('pt-BR')}</div>
                                </div>
                            ` : ''}
                            ${order.dataAprovacao ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Aprovação:</div>
                                    <div class="os-info-value">${new Date(order.dataAprovacao).toLocaleString('pt-BR')}</div>
                                </div>
                            ` : ''}
                            ${order.dataConclusao ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Conclusão:</div>
                                    <div class="os-info-value">${new Date(order.dataConclusao).toLocaleString('pt-BR')}</div>
                                </div>
                            ` : ''}
                            ${order.dataEntrega ? `
                                <div class="os-info-row">
                                    <div class="os-info-label">Entrega:</div>
                                    <div class="os-info-value">${new Date(order.dataEntrega).toLocaleString('pt-BR')}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Peças -->
                    <div class="os-details-section" style="grid-column: 1 / -1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3>🔧 Peças Utilizadas</h3>
                            <button onclick="serviceOrderManager.showAddItemModal('${order.id}')" class="btn-os-action btn-os-primary">
                                + Adicionar Peça
                            </button>
                        </div>
                        ${order.items && order.items.length > 0 ? `
                            <table class="os-items-table">
                                <thead>
                                    <tr>
                                        <th>Descrição</th>
                                        <th style="text-align: center;">Quantidade</th>
                                        <th style="text-align: right;">Valor Unit.</th>
                                        <th style="text-align: right;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => `
                                        <tr>
                                            <td>${item.descricao}</td>
                                            <td style="text-align: center;">${item.quantidade}</td>
                                            <td style="text-align: right;">R$ ${item.valorUnitario.toFixed(2)}</td>
                                            <td style="text-align: right;"><strong>R$ ${item.valorTotal.toFixed(2)}</strong></td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #f5f5f5; font-weight: bold;">
                                        <td colspan="3" style="text-align: right;">Total:</td>
                                        <td style="text-align: right;">
                                            R$ ${order.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ` : '<p style="color: #666;">Nenhuma peça adicionada ainda.</p>'}
                    </div>

                    <!-- Pagamentos -->
                    <div class="os-details-section" style="grid-column: 1 / -1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3>💳 Pagamentos</h3>
                            <button onclick="serviceOrderManager.showAddPaymentModal('${order.id}')" class="btn-os-action btn-os-primary">
                                + Registrar Pagamento
                            </button>
                        </div>
                        ${order.payments && order.payments.length > 0 ? `
                            <table class="os-items-table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Forma de Pagamento</th>
                                        <th style="text-align: right;">Valor</th>
                                        <th>Observações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.payments.map(payment => `
                                        <tr>
                                            <td>${new Date(payment.dataPagamento).toLocaleDateString('pt-BR')}</td>
                                            <td>${payment.formaPagamento}</td>
                                            <td style="text-align: right;"><strong>R$ ${payment.valor.toFixed(2)}</strong></td>
                                            <td>${payment.observacoes || '-'}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #f5f5f5; font-weight: bold;">
                                        <td colspan="2" style="text-align: right;">Total Pago:</td>
                                        <td style="text-align: right;">
                                            R$ ${order.payments.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        ` : '<p style="color: #666;">Nenhum pagamento registrado ainda.</p>'}
                    </div>

                    <!-- Histórico -->
                    <div class="os-details-section" style="grid-column: 1 / -1;">
                        <h3>📝 Histórico</h3>
                        ${order.history && order.history.length > 0 ? `
                            <div class="os-history">
                                ${order.history.map(h => `
                                    <div class="os-history-item">
                                        <div class="os-history-header">
                                            <div class="os-history-action">${h.action}</div>
                                            <div class="os-history-date">${new Date(h.createdAt).toLocaleString('pt-BR')}</div>
                                        </div>
                                        ${h.details ? `<div class="os-history-details">${h.details}</div>` : ''}
                                        <div class="os-history-user">Por: ${h.userName}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: #666;">Nenhum histórico disponível.</p>'}
                    </div>

                    ${order.observacoes ? `
                        <div class="os-details-section" style="grid-column: 1 / -1;">
                            <h3>📌 Observações</h3>
                            <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800;">
                                ${order.observacoes}
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    backToList() {
        this.currentView = 'list';
        this.selectedOrderId = null;
        this.renderOrdersList();
    }

    showNewOSModal() {
        window.notify.info('Modal de nova OS em desenvolvimento');
        // TODO: Implementar modal completo de criação de OS
    }

    showUpdateStatusModal(orderId) {
        window.notify.info('Modal de atualização de status em desenvolvimento');
        // TODO: Implementar modal de atualização de status
    }

    showAddItemModal(orderId) {
        window.notify.info('Modal de adicionar peça em desenvolvimento');
        // TODO: Implementar modal de adicionar peça
    }

    showAddPaymentModal(orderId) {
        window.notify.info('Modal de adicionar pagamento em desenvolvimento');
        // TODO: Implementar modal de registro de pagamento
    }
}

// Instância global
window.serviceOrderManager = new ServiceOrderManager();
