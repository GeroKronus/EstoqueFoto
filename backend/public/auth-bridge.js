// Bridge para sincronizar auth localStorage com API backend

(function() {
    console.log('🌉 Auth Bridge inicializado - conectando localStorage ao backend');

    // Interceptar o createUser original
    if (typeof PhotoAuthManager !== 'undefined') {
        const originalCreate = PhotoAuthManager.prototype.createUser;

        PhotoAuthManager.prototype.createUser = async function(username, password, name, role = 'user') {
            console.log('🔗 Bridge interceptando createUser:', { username, name, role });

            try {
                // 1. Criar no localStorage (comportamento original)
                const localUser = originalCreate.call(this, username, password, name, role);
                console.log('✅ Usuário criado no localStorage:', localUser.id);

                // 2. Salvar no backend via API
                try {
                    const apiResponse = await window.api.register({
                        username,
                        password, // Backend vai fazer hash
                        name,
                        role
                    });

                    console.log('✅ Usuário salvo no backend:', apiResponse);

                    // Atualizar ID local com ID do backend
                    const userIndex = this.users.findIndex(u => u.id === localUser.id);
                    if (userIndex !== -1) {
                        this.users[userIndex].backendId = apiResponse.user.id;
                        this.saveUsers();
                    }

                } catch (apiError) {
                    console.error('⚠️ Erro ao salvar no backend (usuário mantido localmente):', apiError);
                    // Não falha - mantém funcionando com localStorage
                }

                return localUser;

            } catch (error) {
                console.error('❌ Erro ao criar usuário:', error);
                throw error;
            }
        };

        console.log('✅ createUser interceptado com sucesso');
    }

    // Sincronizar usuários existentes no localStorage com backend
    async function syncExistingUsers() {
        const stored = localStorage.getItem('photoSystemUsers');
        if (!stored) return;

        try {
            const localUsers = JSON.parse(stored);
            console.log(`🔄 Sincronizando ${localUsers.length} usuários locais com backend...`);

            for (const user of localUsers) {
                // Pular se já tem backendId
                if (user.backendId) continue;

                try {
                    // Tentar criar no backend
                    // Nota: não temos a senha original, então vamos usar um placeholder
                    const response = await window.api.register({
                        username: user.username,
                        password: 'migrated_' + user.id, // Senha temporária
                        name: user.name,
                        role: user.role
                    });

                    console.log(`✅ Usuário ${user.username} sincronizado com backend`);
                    user.backendId = response.user.id;

                } catch (error) {
                    // Se já existe, apenas loga
                    if (error.message && error.message.includes('já existe')) {
                        console.log(`ℹ️ Usuário ${user.username} já existe no backend`);
                    } else {
                        console.warn(`⚠️ Erro ao sincronizar ${user.username}:`, error.message);
                    }
                }
            }

            // Salvar usuários atualizados
            localStorage.setItem('photoSystemUsers', JSON.stringify(localUsers));
            console.log('✅ Sincronização concluída');

        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
        }
    }

    // Executar sync quando o DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(syncExistingUsers, 2000);
        });
    } else {
        setTimeout(syncExistingUsers, 2000);
    }
})();
