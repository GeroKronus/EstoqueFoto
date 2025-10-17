// Módulo de Ordens de Serviço
class ServiceOrderManager {
    constructor() {
        this.currentOrders = [];
        this.currentView = 'list'; // 'list' ou 'details'
        this.selectedOrderId = null;
        this.customers = [];
        this.users = [];
        this.equipmentList = [];
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
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    }

    async loadUsers() {
        try {
            const response = await window.api.request('/users');
            this.users = response.users || [];
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
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
                        <button class="btn-new-os" onclick="serviceOrderManager.showNewOSModal().catch(e => console.error(e))">
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
                                            <td>${this.getPaymentMethodLabel(payment.formaPagamento)}</td>
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
        // Garantir que os dados estejam carregados
        if (this.customers.length === 0) {
            await this.loadCustomers();
        }
        if (this.users.length === 0) {
            await this.loadUsers();
        }

        console.log('Clientes carregados:', this.customers.length);
        console.log('Usuários carregados:', this.users.length);

        const customerOptions = this.customers
            .filter(c => c.ativo)
            .map(c => `<option value="${c.id}">${c.nomeFantasia || c.razaoSocial}</option>`)
            .join('');

        const techOptions = this.users
            .map(u => `<option value="${u.id}">${u.name}</option>`)
            .join('');

        const modalHtml = `
            <div class="modal" id="newOSModal" style="display: flex;">
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

        document.getElementById('newOSForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateOS();
        });
    }

    async handleCreateOS() {
        const data = {
            customerId: parseInt(document.getElementById('osCustomerId').value),
            equipamentoMarca: document.getElementById('osEquipMarca').value || null,
            equipamentoModelo: document.getElementById('osEquipModelo').value || null,
            equipamentoSerial: document.getElementById('osEquipSerial').value || null,
            acessorios: document.getElementById('osAcessorios').value || null,
            defeitoRelatado: document.getElementById('osDefeitoRelatado').value,
            tecnicoResponsavelId: document.getElementById('osTecnicoId').value || null,
            garantiaDias: parseInt(document.getElementById('osGarantiaDias').value) || 90,
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
            <div class="modal" id="updateStatusModal" style="display: flex;">
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
        if (valorOrcado) data.valorOrcado = parseFloat(valorOrcado);

        const prazoEstimado = document.getElementById('osPrazoEstimado')?.value;
        if (prazoEstimado) data.prazoEstimado = prazoEstimado;

        const defeitoConstatado = document.getElementById('osDefeitoConstatado')?.value;
        if (defeitoConstatado) data.defeitoConstatado = defeitoConstatado;

        const valorFinal = document.getElementById('osValorFinal')?.value;
        if (valorFinal) data.valorFinal = parseFloat(valorFinal);

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
            <div class="modal" id="addItemModal" style="display: flex;">
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
            equipmentId: equipmentId,
            descricao: descricao || null,
            quantidade: parseFloat(document.getElementById('osItemQuantidade').value),
            valorUnitario: parseFloat(document.getElementById('osItemValorUnitario').value)
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
            <div class="modal" id="addPaymentModal" style="display: flex;">
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

        document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddPayment(orderId);
        });
    }

    async handleAddPayment(orderId) {
        const data = {
            valor: parseFloat(document.getElementById('osPaymentValor').value),
            formaPagamento: document.getElementById('osPaymentForma').value,
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
}

// Instância global
window.serviceOrderManager = new ServiceOrderManager();
