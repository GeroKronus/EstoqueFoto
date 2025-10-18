// Módulo de Ordens de Serviço
class ServiceOrderManager {
    constructor() {
        this.currentOrders = [];
        this.currentView = 'list'; // 'list' ou 'details'
        this.selectedOrderId = null;
        this.customers = [];
        this.users = [];
        this.equipmentList = [];
        this.viewMode = 'table'; // 'cards' ou 'table' - PADRÃO: tabela
        this.expandedOrders = []; // Array de IDs de ordens expandidas (para tabela)
    }

    async initialize() {
        console.log('Inicializando Service Order Manager...');
        this.renderMainUI();
        await this.loadCustomers();
        await this.loadUsers();
        await this.loadEquipment();
        await this.loadOrders();
        this.renderOrdersList();
    }

    async loadCustomers() {
        try {
            const response = await window.api.request('/customers?limit=1000');
            this.customers = response.customers || [];
            console.log('[loadCustomers] Total de clientes carregados:', this.customers.length);
            console.log('[loadCustomers] Clientes ativos:', this.customers.filter(c => c.ativo).length);
        } catch (error) {
            console.error('[loadCustomers] Erro ao carregar clientes:', error);
            this.customers = [];
        }
    }

    async loadUsers() {
        try {
            const response = await window.api.request('/users/list');
            this.users = response.users || [];
            console.log('[loadUsers] Total de usuários carregados:', this.users.length);
        } catch (error) {
            console.error('[loadUsers] Erro ao carregar usuários:', error);
            this.users = [];
        }
    }

    async loadEquipment() {
        try {
            const response = await window.api.request('/equipment?includeZero=true');
            this.equipmentList = response.equipment || [];
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
        }
    }

    renderMainUI() {
        const section = document.getElementById('service-orders-section');
        if (!section) return;

        section.innerHTML = `
            <div class="os-container">
                <div class="os-header">
                    <div>
                        <h2 onclick="serviceOrderManager.backToList()" style="cursor: pointer; user-select: none;" title="Voltar para lista de ordens">🔧 Ordens de Serviço</h2>
                    </div>
                    <div class="os-filters">
                        <input type="text" id="osSearchInput" placeholder="🔍 Buscar por OS, cliente, equipamento ou defeito..." oninput="serviceOrderManager.handleSearch()">
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
                        <button class="btn-new-os" onclick="serviceOrderManager.showNewOSModal().catch(e => console.error(e))">
                            ➕ Nova OS
                        </button>
                        <div style="display: flex; align-items: center; gap: 10px; margin-left: 20px;">
                            <span style="font-weight: 500; color: #666;">Visualização:</span>
                            <div class="view-toggle">
                                <button class="view-btn ${this.viewMode === 'cards' ? 'active' : ''}" onclick="serviceOrderManager.toggleView('cards')">
                                    🔲 Cards
                                </button>
                                <button class="view-btn ${this.viewMode === 'table' ? 'active' : ''}" onclick="serviceOrderManager.toggleView('table')">
                                    📋 Tabela
                                </button>
                            </div>
                        </div>
                        ${window.currentUser?.role === 'admin' ? `
                            <button class="btn-new-os" style="background: #f44336; margin-left: 20px;" onclick="serviceOrderManager.showClearTestDataModal()" title="Limpar dados de teste">
                                🗑️ Limpar Testes
                            </button>
                        ` : ''}
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

    async toggleView(mode) {
        this.viewMode = mode;
        this.renderMainUI();
        // Recarregar dados do servidor para garantir que está atualizado
        await this.loadOrders();
        this.renderOrdersList();
    }

    renderOrdersList() {
        const container = document.getElementById('serviceOrdersContent');
        if (!container) return;

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

        if (this.viewMode === 'table') {
            this.renderTableView();
        } else {
            this.renderCardsView();
        }
    }

    renderCardsView() {
        const container = document.getElementById('serviceOrdersContent');
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

        const ordersHtml = this.currentOrders.map(order => {
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

    renderTableView() {
        const container = document.getElementById('serviceOrdersContent');
        container.innerHTML = `
            <table class="exit-orders-table">
                <thead>
                    <tr>
                        <th style="width: 50px;"></th>
                        <th>OS #</th>
                        <th>Status</th>
                        <th>Cliente</th>
                        <th>Equipamento</th>
                        <th>Defeito Relatado</th>
                        <th>Técnico</th>
                        <th>Data Entrada</th>
                        <th style="width: 120px;">Valor</th>
                        <th style="width: 100px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentOrders.map(order => this.renderTableOrderRow(order)).join('')}
                </tbody>
            </table>
        `;
    }

    renderTableOrderRow(order) {
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
        const customerName = order.customer?.razaoSocial || order.customer?.nomeFantasia || 'Não informado';
        const equipamento = `${order.equipamento?.marca || ''} ${order.equipamento?.modelo || ''}`.trim() || 'Não informado';
        const isExpanded = this.expandedOrders?.includes(order.id);

        return `
            <tr class="exit-order-table-row ${order.status === 'cancelado' ? 'cancelled-row' : ''}" data-order-id="${order.id}">
                <td class="expand-cell">
                    <button class="expand-btn ${isExpanded ? 'expanded' : ''}" onclick="serviceOrderManager.toggleOrderDetails('${order.id}')" title="Expandir/Recolher detalhes">
                        ▶
                    </button>
                </td>
                <td><strong>${order.numeroOS}</strong></td>
                <td><span class="status-badge status-${order.status}">${statusLabel}</span></td>
                <td>${customerName}</td>
                <td>${equipamento}</td>
                <td>${order.defeitoRelatado.substring(0, 50)}${order.defeitoRelatado.length > 50 ? '...' : ''}</td>
                <td>${order.tecnicoResponsavel?.name || '-'}</td>
                <td>${new Date(order.dataEntrada).toLocaleDateString('pt-BR')}<br><small style="color: #666;">${new Date(order.dataEntrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                <td><strong>${order.valorFinal > 0 ? `R$ ${order.valorFinal.toFixed(2)}` : order.valorOrcado > 0 ? `R$ ${order.valorOrcado.toFixed(2)}` : '-'}</strong></td>
                <td class="actions-cell-compact">
                    <button class="btn-icon" onclick="serviceOrderManager.showUpdateStatusModal('${order.id}')" title="Atualizar status">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="serviceOrderManager.showOrderDetails('${order.id}')" title="Ver detalhes completos">
                        👁️
                    </button>
                </td>
            </tr>
            <tr id="order-details-${order.id}" class="order-details-row" style="display: ${isExpanded ? 'table-row' : 'none'};">
                <td colspan="10">
                    <div class="order-details-container" id="order-details-content-${order.id}">
                        <!-- Conteúdo será carregado ao expandir -->
                    </div>
                </td>
            </tr>
        `;
    }

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
                container.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">⏳ Carregando detalhes...</div>';
            }

            // Carregar detalhes da ordem
            await this.loadOrderDetailsInline(orderId);
        }
    }

    async loadOrderDetailsInline(orderId) {
        const container = document.getElementById(`order-details-content-${orderId}`);

        try {
            const order = await this.getOrder(orderId);

            if (!order) {
                throw new Error('Ordem não encontrada');
            }

            // Renderizar detalhes expandidos
            container.innerHTML = this.renderExpandedOrderDetails(order);

        } catch (error) {
            console.error('Erro ao carregar detalhes da ordem:', error);
            container.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #f44336;">
                    ❌ Erro ao carregar detalhes da ordem<br>
                    <small style="color: #666; font-size: 0.85rem;">${error.message}</small>
                </div>
            `;
        }
    }

    renderExpandedOrderDetails(order) {
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

        let html = `
            <div class="expanded-order-details">
                <div class="expanded-order-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    ${order.customer ? `<div><strong>Cliente:</strong> ${order.customer.razaoSocial || order.customer.nomeFantasia}</div>` : ''}
                    ${order.customer?.telefone ? `<div><strong>Telefone:</strong> ${order.customer.telefone}</div>` : ''}
                    ${order.equipamento?.serial ? `<div><strong>Serial/IMEI:</strong> ${order.equipamento.serial}</div>` : ''}
                    ${order.acessorios ? `<div><strong>Acessórios:</strong> ${order.acessorios}</div>` : ''}
                    ${order.garantiaDias ? `<div><strong>Garantia:</strong> ${order.garantiaDias} dias</div>` : ''}
                    ${order.prazoEstimado ? `<div><strong>Prazo Estimado:</strong> ${new Date(order.prazoEstimado).toLocaleDateString('pt-BR')}</div>` : ''}
                    ${order.recebidoPor ? `<div><strong>Recebido por:</strong> ${order.recebidoPor.name}</div>` : ''}
                </div>

                ${order.defeitoConstatado ? `
                    <div style="background: #fff3cd; padding: 12px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #ff9800;">
                        <strong>⚠️ Defeito Constatado:</strong> ${order.defeitoConstatado}
                    </div>
                ` : ''}

                ${order.observacoes ? `
                    <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #2196F3;">
                        <strong>📌 Observações:</strong> ${order.observacoes}
                    </div>
                ` : ''}

                ${order.items && order.items.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <strong>🔧 Peças Utilizadas:</strong>
                        <table class="order-items-table" style="margin-top: 10px;">
                            <thead>
                                <tr>
                                    <th>Descrição</th>
                                    <th style="text-align: center;">Qtd</th>
                                    <th style="text-align: right;">Unit.</th>
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
                                <tr class="total-row">
                                    <td colspan="3" style="text-align: right;"><strong>Total Peças:</strong></td>
                                    <td style="text-align: right;"><strong>R$ ${order.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                ${order.payments && order.payments.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <strong>💳 Pagamentos:</strong>
                        <table class="order-items-table" style="margin-top: 10px;">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Forma</th>
                                    <th style="text-align: right;">Valor</th>
                                    <th>NF</th>
                                    <th>Obs</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.payments.map(payment => `
                                    <tr>
                                        <td>${new Date(payment.dataPagamento).toLocaleDateString('pt-BR')}</td>
                                        <td>${this.getPaymentMethodLabel(payment.formaPagamento)}</td>
                                        <td style="text-align: right;"><strong>R$ ${payment.valor.toFixed(2)}</strong></td>
                                        <td style="color: #2196F3; font-weight: 500;">${payment.numeroNotaFiscal || '-'}</td>
                                        <td>${payment.observacoes || '-'}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right;"><strong>Total Pago:</strong></td>
                                    <td style="text-align: right;"><strong>R$ ${order.payments.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}</strong></td>
                                    <td colspan="2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
        `;

        return html;
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
                <!-- CABEÇALHO COMPACTO -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: white; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <button onclick="serviceOrderManager.backToList()" class="btn-os-action btn-os-back" style="padding: 8px 16px;">← Voltar</button>
                        <h2 style="margin: 0;">${order.numeroOS}</h2>
                        <div class="os-status status-${order.status}">${statusLabel}</div>
                    </div>
                    <button onclick="serviceOrderManager.showUpdateStatusModal('${order.id}')" class="btn-os-action btn-os-primary">
                        ✏️ Atualizar Status
                    </button>
                </div>

                <!-- INFORMAÇÕES PRINCIPAIS EM CARDS -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">

                    <!-- CARD: CLIENTE E CONTATO -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #4CAF50; padding-bottom: 8px;">🏢 Cliente e Contato</h3>
                        ${order.customer ? `
                            <div style="display: grid; gap: 10px;">
                                <div><strong style="color: #666; font-size: 12px;">RAZÃO SOCIAL:</strong><br>${order.customer.razaoSocial}</div>
                                ${order.customer.nomeFantasia ? `<div><strong style="color: #666; font-size: 12px;">NOME FANTASIA:</strong><br>${order.customer.nomeFantasia}</div>` : ''}
                                ${order.customer.telefone ? `<div><strong style="color: #666; font-size: 12px;">TELEFONE:</strong><br>${order.customer.telefone}</div>` : ''}
                            </div>
                        ` : '<p style="color: #999;">Cliente não informado</p>'}
                    </div>

                    <!-- CARD: EQUIPAMENTO -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #2196F3; padding-bottom: 8px;">📱 Equipamento</h3>
                        <div style="display: grid; gap: 10px;">
                            ${order.equipamento?.marca ? `<div><strong style="color: #666; font-size: 12px;">MARCA:</strong><br>${order.equipamento.marca}</div>` : ''}
                            ${order.equipamento?.modelo ? `<div><strong style="color: #666; font-size: 12px;">MODELO:</strong><br>${order.equipamento.modelo}</div>` : ''}
                            ${order.equipamento?.serial ? `<div><strong style="color: #666; font-size: 12px;">SERIAL/IMEI:</strong><br>${order.equipamento.serial}</div>` : ''}
                            ${order.acessorios ? `<div><strong style="color: #666; font-size: 12px;">ACESSÓRIOS:</strong><br>${order.acessorios}</div>` : ''}
                            ${!order.equipamento?.marca && !order.equipamento?.modelo && !order.equipamento?.serial && !order.acessorios ? '<p style="color: #999;">Nenhuma informação</p>' : ''}
                        </div>
                    </div>

                    <!-- CARD: DEFEITOS -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #ff9800; padding-bottom: 8px;">⚠️ Defeitos</h3>
                        <div style="display: grid; gap: 15px;">
                            <div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #ff9800;">
                                <strong style="color: #666; font-size: 12px;">RELATADO PELO CLIENTE:</strong><br>
                                <span style="font-size: 14px;">${order.defeitoRelatado}</span>
                            </div>
                            ${order.defeitoConstatado ? `
                                <div style="background: #ffebee; padding: 12px; border-radius: 6px; border-left: 4px solid #f44336;">
                                    <strong style="color: #666; font-size: 12px;">CONSTATADO PELO TÉCNICO:</strong><br>
                                    <span style="font-size: 14px;">${order.defeitoConstatado}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- CARD: VALORES E PRAZOS -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #9C27B0; padding-bottom: 8px;">💰 Valores e Prazos</h3>
                        <div style="display: grid; gap: 10px;">
                            ${order.valorOrcado > 0 ? `<div><strong style="color: #666; font-size: 12px;">VALOR ORÇADO:</strong><br><span style="font-size: 18px; color: #2196F3;">R$ ${order.valorOrcado.toFixed(2)}</span></div>` : ''}
                            ${order.valorFinal > 0 ? `<div><strong style="color: #666; font-size: 12px;">VALOR FINAL:</strong><br><span style="font-size: 18px; color: #4CAF50; font-weight: bold;">R$ ${order.valorFinal.toFixed(2)}</span></div>` : ''}
                            <div><strong style="color: #666; font-size: 12px;">GARANTIA:</strong><br>${order.garantiaDias} dias</div>
                            ${order.prazoEstimado ? `<div><strong style="color: #666; font-size: 12px;">PRAZO ESTIMADO:</strong><br>${new Date(order.prazoEstimado).toLocaleDateString('pt-BR')}</div>` : ''}
                        </div>
                    </div>

                    <!-- CARD: DATAS E RESPONSÁVEIS -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #607D8B; padding-bottom: 8px;">📅 Datas e Responsáveis</h3>
                        <div style="display: grid; gap: 10px; font-size: 13px;">
                            <div><strong style="color: #666; font-size: 12px;">DATA ENTRADA:</strong><br>${new Date(order.dataEntrada).toLocaleString('pt-BR')}</div>
                            ${order.dataOrcamento ? `<div><strong style="color: #666; font-size: 12px;">ORÇAMENTO:</strong><br>${new Date(order.dataOrcamento).toLocaleDateString('pt-BR')}</div>` : ''}
                            ${order.dataAprovacao ? `<div><strong style="color: #666; font-size: 12px;">APROVAÇÃO:</strong><br>${new Date(order.dataAprovacao).toLocaleDateString('pt-BR')}</div>` : ''}
                            ${order.dataConclusao ? `<div><strong style="color: #666; font-size: 12px;">CONCLUSÃO:</strong><br>${new Date(order.dataConclusao).toLocaleDateString('pt-BR')}</div>` : ''}
                            ${order.dataEntrega ? `<div><strong style="color: #666; font-size: 12px;">ENTREGA:</strong><br>${new Date(order.dataEntrega).toLocaleDateString('pt-BR')}</div>` : ''}
                            <div style="margin-top: 5px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                                ${order.recebidoPor ? `<div style="margin-bottom: 5px;"><strong style="color: #666; font-size: 12px;">RECEBIDO:</strong> ${order.recebidoPor.name}</div>` : ''}
                                ${order.tecnicoResponsavel ? `<div><strong style="color: #666; font-size: 12px;">TÉCNICO:</strong> ${order.tecnicoResponsavel.name}</div>` : ''}
                            </div>
                        </div>
                    </div>

                    ${order.observacoes ? `
                        <!-- CARD: OBSERVAÇÕES -->
                        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; border-left: 4px solid #2196F3;">
                            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1976D2;">📌 Observações</h3>
                            <p style="margin: 0; line-height: 1.6;">${order.observacoes}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- SEÇÕES DE PEÇAS E PAGAMENTOS EM CARDS -->
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">

                    <!-- CARD: PEÇAS UTILIZADAS -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; font-size: 16px; color: #444;">🔧 Peças Utilizadas</h3>
                            <button onclick="serviceOrderManager.showAddItemModal('${order.id}')" class="btn-os-action btn-os-primary" style="font-size: 14px; padding: 8px 16px;">
                                + Adicionar Peça
                            </button>
                        </div>
                        ${order.items && order.items.length > 0 ? `
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead>
                                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                        <th style="padding: 10px; text-align: left;">Descrição</th>
                                        <th style="padding: 10px; text-align: center; width: 100px;">Qtd</th>
                                        <th style="padding: 10px; text-align: right; width: 120px;">Unit.</th>
                                        <th style="padding: 10px; text-align: right; width: 120px;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => `
                                        <tr style="border-bottom: 1px solid #eee;">
                                            <td style="padding: 10px;">${item.descricao}</td>
                                            <td style="padding: 10px; text-align: center;">${item.quantidade}</td>
                                            <td style="padding: 10px; text-align: right; color: #666;">R$ ${item.valorUnitario.toFixed(2)}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600;">R$ ${item.valorTotal.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #f0f7ff; font-weight: bold;">
                                        <td colspan="3" style="padding: 12px; text-align: right;">TOTAL PEÇAS:</td>
                                        <td style="padding: 12px; text-align: right; color: #2196F3; font-size: 16px;">
                                            R$ ${order.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ` : '<p style="color: #999; text-align: center; padding: 20px;">Nenhuma peça adicionada ainda.</p>'}
                    </div>

                    <!-- CARD: PAGAMENTOS -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; font-size: 16px; color: #444;">💳 Pagamentos</h3>
                            <button onclick="serviceOrderManager.showAddPaymentModal('${order.id}')" class="btn-os-action btn-os-primary" style="font-size: 14px; padding: 8px 16px;">
                                + Registrar Pagamento
                            </button>
                        </div>
                        ${order.payments && order.payments.length > 0 ? `
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead>
                                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                        <th style="padding: 10px; text-align: left; width: 120px;">Data</th>
                                        <th style="padding: 10px; text-align: left;">Forma</th>
                                        <th style="padding: 10px; text-align: right; width: 120px;">Valor</th>
                                        <th style="padding: 10px; text-align: left; width: 100px;">NF</th>
                                        <th style="padding: 10px; text-align: left;">Observações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.payments.map(payment => `
                                        <tr style="border-bottom: 1px solid #eee;">
                                            <td style="padding: 10px;">${new Date(payment.dataPagamento).toLocaleDateString('pt-BR')}</td>
                                            <td style="padding: 10px;">${this.getPaymentMethodLabel(payment.formaPagamento)}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: 600; color: #4CAF50;">R$ ${payment.valor.toFixed(2)}</td>
                                            <td style="padding: 10px; color: #2196F3; font-weight: 500;">${payment.numeroNotaFiscal || '-'}</td>
                                            <td style="padding: 10px; color: #666; font-size: 13px;">${payment.observacoes || '-'}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #e8f5e9; font-weight: bold;">
                                        <td colspan="2" style="padding: 12px; text-align: right;">TOTAL PAGO:</td>
                                        <td style="padding: 12px; text-align: right; color: #4CAF50; font-size: 16px;">
                                            R$ ${order.payments.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                                        </td>
                                        <td colspan="2"></td>
                                    </tr>
                                </tbody>
                            </table>
                        ` : '<p style="color: #999; text-align: center; padding: 20px;">Nenhum pagamento registrado ainda.</p>'}
                    </div>

                    <!-- CARD: HISTÓRICO -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #444; border-bottom: 2px solid #607D8B; padding-bottom: 8px;">📝 Histórico</h3>
                        ${order.history && order.history.length > 0 ? `
                            <div style="display: grid; gap: 10px;">
                                ${order.history.map(h => `
                                    <div style="padding: 12px; background: #f9f9f9; border-left: 3px solid #607D8B; border-radius: 4px;">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                                            <strong style="color: #333; font-size: 14px;">${h.action}</strong>
                                            <span style="color: #666; font-size: 12px;">${new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                                        </div>
                                        ${h.details ? `<div style="color: #666; font-size: 13px; margin: 5px 0;">${h.details}</div>` : ''}
                                        <div style="color: #999; font-size: 12px;">Por: ${h.userName}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: #999; text-align: center; padding: 20px;">Nenhum histórico disponível.</p>'}
                    </div>
                </div>
            </div>
        `;
    }

    backToList() {
        this.currentView = 'list';
        this.selectedOrderId = null;
        this.renderOrdersList();
    }

    getPaymentMethodLabel(method) {
        const labels = {
            'dinheiro': 'Dinheiro',
            'pix': 'PIX',
            'cartao_credito': 'Cartão de Crédito',
            'cartao_debito': 'Cartão de Débito',
            'boleto': 'Boleto',
            'outros': 'Outros'
        };
        return labels[method] || method;
    }

    // ========== MODAL NOVA OS ==========
    async showNewOSModal() {
        // SEMPRE recarregar clientes e usuários para garantir dados atualizados
        console.log('[showNewOSModal] Recarregando clientes e usuários...');
        await this.loadCustomers();
        await this.loadUsers();

        console.log('[showNewOSModal] Clientes carregados:', this.customers.length);
        console.log('[showNewOSModal] Usuários carregados:', this.users.length);

        const activeCustomers = this.customers.filter(c => c.ativo);
        console.log('[showNewOSModal] Clientes ativos:', activeCustomers.length);
        console.log('[showNewOSModal] Primeiros 3 clientes:', activeCustomers.slice(0, 3).map(c => ({ id: c.id, nome: c.razao_social })));

        const customerOptions = activeCustomers
            .map(c => `<option value="${c.id}">${c.razao_social}</option>`)
            .join('');

        console.log('[showNewOSModal] customerOptions length:', customerOptions.length);

        const techOptions = this.users
            .map(u => `<option value="${u.id}">${u.name}</option>`)
            .join('');

        const modalHtml = `
            <div class="modal" id="newOSModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 800px;">
                    <h2>🔧 Nova Ordem de Serviço</h2>
                    <form id="newOSForm">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="grid-column: 1 / -1;">
                                <label>Cliente *</label>
                                <select id="osCustomerId" required>
                                    <option value="">Selecione o cliente</option>
                                    ${customerOptions}
                                </select>
                            </div>

                            <div>
                                <label>Marca do Equipamento</label>
                                <input type="text" id="osEquipMarca" placeholder="Ex: Apple, Samsung">
                            </div>

                            <div>
                                <label>Modelo do Equipamento</label>
                                <input type="text" id="osEquipModelo" placeholder="Ex: iPhone 13">
                            </div>

                            <div>
                                <label>Serial/IMEI</label>
                                <input type="text" id="osEquipSerial" placeholder="Número de série">
                            </div>

                            <div>
                                <label>Acessórios</label>
                                <input type="text" id="osAcessorios" placeholder="Ex: Cabo, carregador">
                            </div>

                            <div style="grid-column: 1 / -1;">
                                <label>Defeito Relatado *</label>
                                <textarea id="osDefeitoRelatado" required placeholder="Descreva o problema relatado pelo cliente" style="height: 80px;"></textarea>
                            </div>

                            <div>
                                <label>Técnico Responsável</label>
                                <select id="osTecnicoId">
                                    <option value="">Nenhum (atribuir depois)</option>
                                    ${techOptions}
                                </select>
                            </div>

                            <div>
                                <label>Garantia (dias)</label>
                                <input type="number" id="osGarantiaDias" value="90" min="0">
                            </div>

                            <div style="grid-column: 1 / -1;">
                                <label>Observações</label>
                                <textarea id="osObservacoes" placeholder="Observações gerais" style="height: 60px;"></textarea>
                            </div>
                        </div>

                        <div class="modal-actions" style="margin-top: 20px;">
                            <button type="button" onclick="closeModal('newOSModal')">Cancelar</button>
                            <button type="submit">Criar OS</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('newOSModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        document.getElementById('newOSForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateOS();
        });
    }

    async handleCreateOS() {
        const data = {
            customer_id: parseInt(document.getElementById('osCustomerId').value),
            equipamento_marca: document.getElementById('osEquipMarca').value || null,
            equipamento_modelo: document.getElementById('osEquipModelo').value || null,
            equipamento_serial: document.getElementById('osEquipSerial').value || null,
            acessorios: document.getElementById('osAcessorios').value || null,
            defeito_relatado: document.getElementById('osDefeitoRelatado').value,
            tecnico_responsavel_id: document.getElementById('osTecnicoId').value || null,
            garantia_dias: parseInt(document.getElementById('osGarantiaDias').value) || 90,
            observacoes: document.getElementById('osObservacoes').value || null
        };

        try {
            const response = await window.api.request('/service-orders', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            window.notify.success('Ordem de Serviço criada com sucesso!');
            closeModal('newOSModal');
            await this.loadOrders();
            this.renderOrdersList();

            // Mostrar detalhes da OS criada
            this.showOrderDetails(response.order.id);
        } catch (error) {
            console.error('Erro ao criar OS:', error);
            window.notify.error(error.message || 'Erro ao criar ordem de serviço');
        }
    }

    // ========== MODAL ATUALIZAR STATUS ==========
    async showUpdateStatusModal(orderId) {
        const order = await this.getOrder(orderId);
        if (!order) return;

        const statusOptions = [
            { value: 'aguardando_orcamento', label: 'Aguardando Orçamento' },
            { value: 'orcamento_pendente', label: 'Orçamento Pendente' },
            { value: 'aprovado', label: 'Aprovado' },
            { value: 'em_reparo', label: 'Em Reparo' },
            { value: 'concluido', label: 'Concluído' },
            { value: 'aguardando_retirada', label: 'Aguardando Retirada' },
            { value: 'entregue', label: 'Entregue' },
            { value: 'cancelado', label: 'Cancelado' }
        ];

        const optionsHtml = statusOptions.map(s =>
            `<option value="${s.value}" ${s.value === order.status ? 'selected' : ''}>${s.label}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal" id="updateStatusModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <h2>📝 Atualizar Status - ${order.numeroOS}</h2>
                    <form id="updateStatusForm">
                        <div>
                            <label>Status Atual</label>
                            <input type="text" value="${statusOptions.find(s => s.value === order.status)?.label || order.status}" disabled style="background: #f5f5f5;">
                        </div>

                        <div>
                            <label>Novo Status *</label>
                            <select id="osNewStatus" required>
                                ${optionsHtml}
                            </select>
                        </div>

                        <div id="additionalFields"></div>

                        <div class="modal-actions" style="margin-top: 20px;">
                            <button type="button" onclick="closeModal('updateStatusModal')">Cancelar</button>
                            <button type="submit">Atualizar Status</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('updateStatusModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        // Mostrar campos adicionais baseado no status
        document.getElementById('osNewStatus').addEventListener('change', (e) => {
            this.updateStatusFields(e.target.value);
        });

        document.getElementById('updateStatusForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUpdateStatus(orderId);
        });
    }

    updateStatusFields(status) {
        const container = document.getElementById('additionalFields');
        let html = '';

        if (status === 'orcamento_pendente' || status === 'aprovado') {
            html += `
                <div>
                    <label>Valor Orçado (R$)</label>
                    <input type="number" id="osValorOrcado" step="0.01" min="0" placeholder="0.00">
                </div>
                <div>
                    <label>Prazo Estimado</label>
                    <input type="date" id="osPrazoEstimado">
                </div>
            `;
        }

        if (status === 'em_reparo') {
            html += `
                <div>
                    <label>Defeito Constatado</label>
                    <textarea id="osDefeitoConstatado" placeholder="Descreva o defeito após análise" style="height: 80px;"></textarea>
                </div>
            `;
        }

        if (status === 'concluido') {
            html += `
                <div>
                    <label>Valor Final (R$)</label>
                    <input type="number" id="osValorFinal" step="0.01" min="0" placeholder="0.00">
                </div>
            `;
        }

        container.innerHTML = html;
    }

    async handleUpdateStatus(orderId) {
        const newStatus = document.getElementById('osNewStatus').value;
        const data = { status: newStatus };

        // Campos opcionais baseados no status
        const valorOrcado = document.getElementById('osValorOrcado')?.value;
        if (valorOrcado) data.valor_orcado = parseFloat(valorOrcado);

        const prazoEstimado = document.getElementById('osPrazoEstimado')?.value;
        if (prazoEstimado) data.prazo_estimado = prazoEstimado;

        const defeitoConstatado = document.getElementById('osDefeitoConstatado')?.value;
        if (defeitoConstatado) data.defeito_constatado = defeitoConstatado;

        const valorFinal = document.getElementById('osValorFinal')?.value;
        if (valorFinal) data.valor_final = parseFloat(valorFinal);

        try {
            await window.api.request(`/service-orders/${orderId}/status`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });

            window.notify.success('Status atualizado com sucesso!');
            closeModal('updateStatusModal');
            await this.showOrderDetails(orderId);
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            window.notify.error(error.message || 'Erro ao atualizar status');
        }
    }

    // ========== MODAL ADICIONAR PEÇA ==========
    async showAddItemModal(orderId) {
        // Garantir que os equipamentos estejam carregados
        if (this.equipmentList.length === 0) {
            await this.loadEquipment();
        }

        const equipOptions = this.equipmentList
            .filter(e => e.quantity > 0)
            .map(e => `<option value="${e.id}" data-price="${e.averageCost || 0}">${e.name} (Estoque: ${e.quantity} ${e.unit})</option>`)
            .join('');

        const modalHtml = `
            <div class="modal" id="addItemModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <h2>🔧 Adicionar Peça à OS</h2>
                    <form id="addItemForm">
                        <div>
                            <label>Peça do Estoque</label>
                            <select id="osItemEquipmentId" onchange="serviceOrderManager.updateItemPrice()">
                                <option value="">Selecione uma peça</option>
                                ${equipOptions}
                            </select>
                        </div>

                        <div>
                            <label>Ou descreva manualmente</label>
                            <input type="text" id="osItemDescricao" placeholder="Descrição da peça (obrigatório se não selecionar do estoque)">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                            <div>
                                <label>Quantidade *</label>
                                <input type="number" id="osItemQuantidade" step="0.001" min="0.001" required onchange="serviceOrderManager.updateItemTotal()">
                            </div>

                            <div>
                                <label>Valor Unitário (R$) *</label>
                                <input type="number" id="osItemValorUnitario" step="0.01" min="0" required onchange="serviceOrderManager.updateItemTotal()">
                            </div>

                            <div>
                                <label>Valor Total (R$)</label>
                                <input type="number" id="osItemValorTotal" step="0.01" min="0" disabled style="background: #f5f5f5; font-weight: bold;">
                            </div>
                        </div>

                        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <strong>ℹ️ Importante:</strong>
                            <p style="margin: 5px 0; font-size: 14px;">
                                Se você selecionar uma peça do estoque, ela será automaticamente deduzida do inventário.
                            </p>
                        </div>

                        <div class="modal-actions">
                            <button type="button" onclick="closeModal('addItemModal')">Cancelar</button>
                            <button type="submit">Adicionar Peça</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('addItemModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        document.getElementById('addItemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddItem(orderId);
        });
    }

    updateItemPrice() {
        const select = document.getElementById('osItemEquipmentId');
        const selectedOption = select.options[select.selectedIndex];

        if (selectedOption && selectedOption.value) {
            const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
            document.getElementById('osItemValorUnitario').value = price.toFixed(2);
            this.updateItemTotal();
        }
    }

    updateItemTotal() {
        const qty = parseFloat(document.getElementById('osItemQuantidade')?.value) || 0;
        const price = parseFloat(document.getElementById('osItemValorUnitario')?.value) || 0;
        const total = qty * price;

        const totalInput = document.getElementById('osItemValorTotal');
        if (totalInput) {
            totalInput.value = total.toFixed(2);
        }
    }

    async handleAddItem(orderId) {
        const equipmentId = document.getElementById('osItemEquipmentId').value || null;
        const descricao = document.getElementById('osItemDescricao').value;

        if (!equipmentId && !descricao) {
            window.notify.error('Selecione uma peça do estoque ou descreva manualmente');
            return;
        }

        const data = {
            equipment_id: equipmentId,
            descricao: descricao || null,
            quantidade: parseFloat(document.getElementById('osItemQuantidade').value),
            valor_unitario: parseFloat(document.getElementById('osItemValorUnitario').value)
        };

        try {
            await window.api.request(`/service-orders/${orderId}/items`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            window.notify.success('Peça adicionada com sucesso!');
            closeModal('addItemModal');
            await this.showOrderDetails(orderId);
        } catch (error) {
            console.error('Erro ao adicionar peça:', error);
            window.notify.error(error.message || 'Erro ao adicionar peça');
        }
    }

    // ========== MODAL ADICIONAR PAGAMENTO ==========
    async showAddPaymentModal(orderId) {
        const modalHtml = `
            <div class="modal" id="addPaymentModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <h2>💳 Registrar Pagamento</h2>
                    <form id="addPaymentForm">
                        <div>
                            <label>Valor (R$) *</label>
                            <input type="number" id="osPaymentValor" step="0.01" min="0.01" required placeholder="0.00">
                        </div>

                        <div>
                            <label>Forma de Pagamento *</label>
                            <select id="osPaymentForma" required>
                                <option value="">Selecione</option>
                                <option value="dinheiro">Dinheiro</option>
                                <option value="pix">PIX</option>
                                <option value="cartao_credito">Cartão de Crédito</option>
                                <option value="cartao_debito">Cartão de Débito</option>
                                <option value="boleto">Boleto</option>
                                <option value="outros">Outros</option>
                            </select>
                        </div>

                        <div>
                            <label>Número da Nota Fiscal</label>
                            <input type="text" id="osPaymentNotaFiscal" placeholder="Ex: 12345" maxlength="50">
                        </div>

                        <div>
                            <label>Observações</label>
                            <textarea id="osPaymentObs" placeholder="Informações adicionais sobre o pagamento" style="height: 80px;"></textarea>
                        </div>

                        <div class="modal-actions" style="margin-top: 20px;">
                            <button type="button" onclick="closeModal('addPaymentModal')">Cancelar</button>
                            <button type="submit">Registrar Pagamento</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('addPaymentModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddPayment(orderId);
        });
    }

    async handleAddPayment(orderId) {
        const data = {
            valor: parseFloat(document.getElementById('osPaymentValor').value),
            forma_pagamento: document.getElementById('osPaymentForma').value,
            numero_nota_fiscal: document.getElementById('osPaymentNotaFiscal').value || null,
            observacoes: document.getElementById('osPaymentObs').value || null
        };

        try {
            await window.api.request(`/service-orders/${orderId}/payments`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            window.notify.success('Pagamento registrado com sucesso!');
            closeModal('addPaymentModal');
            await this.showOrderDetails(orderId);
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            window.notify.error(error.message || 'Erro ao registrar pagamento');
        }
    }

    // ========== MODAL LIMPAR DADOS DE TESTE (ADMIN ONLY) ==========
    showClearTestDataModal() {
        if (window.currentUser?.role !== 'admin') {
            window.notify.error('Apenas administradores podem limpar dados de teste');
            return;
        }

        const modalHtml = `
            <div class="modal" id="clearTestDataModal" data-dynamic="true" style="display: flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <h2 style="color: #f44336;">⚠️ DELETAR TODAS AS ORDENS DE SERVIÇO</h2>
                    <div style="background: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f; margin: 20px 0;">
                        <strong style="color: #d32f2f; font-size: 18px;">⚠️ PERIGO - ATENÇÃO!</strong>
                        <p style="margin: 10px 0; font-weight: bold;">Esta ação irá deletar TODAS as Ordens de Serviço do sistema, incluindo:</p>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Histórico de alterações</li>
                            <li>Peças utilizadas</li>
                            <li>Pagamentos registrados</li>
                        </ul>
                        <p style="margin: 10px 0; color: #d32f2f; font-weight: bold; font-size: 16px;">Esta ação NÃO PODE ser desfeita!</p>
                    </div>
                    <div style="margin: 20px 0;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="confirmClearTest" style="width: auto; transform: scale(1.5);">
                            <span style="font-weight: bold;">Sim, eu entendo e quero deletar TODAS as ordens de serviço do sistema</span>
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('clearTestDataModal')">Cancelar</button>
                        <button type="button" onclick="serviceOrderManager.handleClearTestData()" style="background: #d32f2f;" id="btnConfirmClearTest" disabled>
                            🗑️ DELETAR TODAS AS ORDENS
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Habilitar botão somente se checkbox marcado
        document.getElementById('confirmClearTest').addEventListener('change', (e) => {
            document.getElementById('btnConfirmClearTest').disabled = !e.target.checked;
        });

        // Prevenir fechamento ao clicar fora do modal
        const modal = document.getElementById('clearTestDataModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
                e.preventDefault();
            }
        });
    }

    async handleClearTestData() {
        const confirmed = document.getElementById('confirmClearTest').checked;
        if (!confirmed) {
            window.notify.error('Por favor, confirme a ação marcando o checkbox');
            return;
        }

        try {
            // Desabilitar botão durante a operação
            const btn = document.getElementById('btnConfirmClearTest');
            btn.disabled = true;
            btn.textContent = '⏳ Deletando...';

            const response = await window.api.request('/service-orders/test-data', {
                method: 'DELETE'
            });

            window.notify.success(`${response.deletedCount || 0} ordens de serviço foram deletadas com sucesso!`);
            closeModal('clearTestDataModal');

            // Recarregar lista
            await this.loadOrders();
            this.renderOrdersList();

        } catch (error) {
            console.error('Erro ao limpar dados de teste:', error);
            window.notify.error(error.message || 'Erro ao limpar dados de teste');

            // Reabilitar botão em caso de erro
            const btn = document.getElementById('btnConfirmClearTest');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🗑️ Deletar Dados de Teste';
            }
        }
    }
}

// Instância global
window.serviceOrderManager = new ServiceOrderManager();
