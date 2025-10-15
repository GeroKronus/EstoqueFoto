// Cole este código no console do navegador (F12)

(async function executeMigration008() {
    console.log('🔄 Executando Migration 008...');

    // Buscar token de várias fontes possíveis
    let token = sessionStorage.getItem('auth_token') ||
                localStorage.getItem('auth_token') ||
                sessionStorage.getItem('token') ||
                localStorage.getItem('token');

    console.log('🔑 Token encontrado:', token ? 'Sim' : 'Não');

    if (!token) {
        alert('❌ Token não encontrado! Faça login novamente.');
        return;
    }

    try {
        const response = await fetch('https://estoque.stonecoin.com.br/api/migrations/run/008', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Status da resposta:', response.status);

        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        if (!response.ok) {
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        console.log('✅ Migration 008 executada com sucesso!');
        console.log('📊 Resultado completo:', data);

        if (data.tablesCreated && data.tablesCreated.length > 0) {
            console.log('📋 Tabelas criadas:', data.tablesCreated);
        }

        alert('✅ Migration 008 executada com sucesso!\n\nAtualize a página (F5) para usar as novas funcionalidades.\n\nTabelas criadas: ' + (data.tablesCreated || []).join(', '));

        return data;

    } catch (error) {
        console.error('❌ Erro completo:', error);
        alert('❌ Erro: ' + error.message + '\n\nVerifique o console para mais detalhes.');
        throw error;
    }
})();
