// Sistema de Notificações Modais Elegantes

class NotificationSystem {
    constructor() {
        this.createNotificationContainer();
        this.createConfirmModal();
    }

    createNotificationContainer() {
        if (document.getElementById('notification-container')) return;

        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

    createConfirmModal() {
        if (document.getElementById('confirm-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            ">
                <div class="confirm-dialog" style="
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.3s ease;
                ">
                    <div class="confirm-icon" style="
                        font-size: 48px;
                        text-align: center;
                        margin-bottom: 16px;
                    "></div>
                    <h3 class="confirm-title" style="
                        margin: 0 0 12px 0;
                        font-size: 20px;
                        font-weight: 600;
                        color: #333;
                        text-align: center;
                    "></h3>
                    <p class="confirm-message" style="
                        margin: 0 0 24px 0;
                        font-size: 14px;
                        color: #666;
                        line-height: 1.5;
                        white-space: pre-line;
                    "></p>
                    <div class="confirm-buttons" style="
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                    ">
                        <button class="confirm-cancel" style="
                            padding: 10px 20px;
                            border: 1px solid #ddd;
                            background: white;
                            color: #666;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.2s;
                        ">Cancelar</button>
                        <button class="confirm-ok" style="
                            padding: 10px 20px;
                            border: none;
                            background: #4CAF50;
                            color: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.2s;
                        ">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'none';
        document.body.appendChild(modal);

        // Adicionar animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            .confirm-cancel:hover {
                background: #f5f5f5 !important;
            }
            .confirm-ok:hover {
                background: #45a049 !important;
            }
            .confirm-ok.danger {
                background: #f44336 !important;
            }
            .confirm-ok.danger:hover {
                background: #da190b !important;
            }
        `;
        document.head.appendChild(style);
    }

    show(message, type = 'info', duration = 4000) {
        // Garantir que o container existe
        this.createNotificationContainer();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };

        notification.innerHTML = `
            <div style="
                background: ${colors[type]};
                color: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 300px;
                animation: slideInRight 0.3s ease;
            ">
                <span style="font-size: 24px;">${icons[type]}</span>
                <span style="flex: 1; font-size: 14px; line-height: 1.4;">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    opacity: 0.8;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
        `;

        const container = document.getElementById('notification-container');
        if (!container) {
            console.error('Container de notificações não encontrado!');
            return;
        }
        container.appendChild(notification);

        // Adicionar animação
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Auto remover
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }

    async confirm(options) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const title = modal.querySelector('.confirm-title');
            const message = modal.querySelector('.confirm-message');
            const icon = modal.querySelector('.confirm-icon');
            const okButton = modal.querySelector('.confirm-ok');
            const cancelButton = modal.querySelector('.confirm-cancel');

            // Configurar conteúdo
            title.textContent = options.title || 'Confirmação';
            message.textContent = options.message || 'Tem certeza?';

            // Configurar ícone
            const icons = {
                question: '❓',
                warning: '⚠️',
                danger: '🗑️',
                info: 'ℹ️'
            };
            icon.textContent = icons[options.type || 'question'];

            // Configurar botão OK
            okButton.textContent = options.confirmText || 'Confirmar';
            okButton.className = 'confirm-ok';
            if (options.type === 'danger' || options.type === 'warning') {
                okButton.classList.add('danger');
            }

            // Configurar botão Cancelar
            cancelButton.textContent = options.cancelText || 'Cancelar';

            // Event listeners
            const handleConfirm = () => {
                modal.style.display = 'none';
                resolve(true);
                cleanup();
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                resolve(false);
                cleanup();
            };

            const handleOverlayClick = (e) => {
                if (e.target.classList.contains('confirm-overlay')) {
                    handleCancel();
                }
            };

            const cleanup = () => {
                okButton.removeEventListener('click', handleConfirm);
                cancelButton.removeEventListener('click', handleCancel);
                modal.querySelector('.confirm-overlay').removeEventListener('click', handleOverlayClick);
            };

            okButton.addEventListener('click', handleConfirm);
            cancelButton.addEventListener('click', handleCancel);
            modal.querySelector('.confirm-overlay').addEventListener('click', handleOverlayClick);

            // Mostrar modal
            modal.style.display = 'block';
        });
    }
}

// Criar instância global
window.notify = new NotificationSystem();

// Sobrescrever alert e confirm nativos (opcional)
window.showNotification = (message, type = 'info') => {
    window.notify.show(message, type);
};

window.showConfirm = async (options) => {
    if (typeof options === 'string') {
        options = { message: options };
    }
    return window.notify.confirm(options);
};
