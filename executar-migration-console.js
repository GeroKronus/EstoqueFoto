// Cole este código no console do navegador (F12) enquanto estiver logado no sistema

(async function executeMigration008() {
    console.log('🔄 Executando Migration 008...');

    try {
        const response = await fetch('https://estoque.stonecoin.com.br/api/migrations/run/008', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        console.log('✅ Migration 008 executada com sucesso!');
        console.log('📊 Resultado:', data);

        if (data.tablesCreated && data.tablesCreated.length > 0) {
            console.log('📋 Tabelas criadas:', data.tablesCreated);
        }

        alert('✅ Migration 008 executada com sucesso!\n\nAtualize a página (F5) para usar as novas funcionalidades.');

        return data;

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        alert('❌ Erro: ' + error.message);
        throw error;
    }
})();
