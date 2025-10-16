const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function importCustomers() {
    const client = await pool.connect();

    try {
        console.log('📦 Iniciando importação de clientes...');

        // Ler o arquivo TXT
        const filePath = path.join(__dirname, '../Tbl_clientes_reduzida.txt');
        const fileContent = fs.readFileSync(filePath, 'latin1'); // Usando latin1 para suportar caracteres especiais

        const lines = fileContent.split('\n');

        // Pular a primeira linha (cabeçalho)
        const dataLines = lines.slice(1).filter(line => line.trim());

        console.log(`📊 Total de linhas para importar: ${dataLines.length}`);

        await client.query('BEGIN');

        let imported = 0;
        let skipped = 0;

        for (const line of dataLines) {
            // Parse da linha CSV com delimitador ";"
            const fields = line.split(';').map(field => {
                // Remover aspas duplas do início e fim
                let cleaned = field.trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                    cleaned = cleaned.substring(1, cleaned.length - 1);
                }
                return cleaned || null;
            });

            if (fields.length < 12) {
                console.log(`⚠️  Linha inválida (poucos campos): ${line.substring(0, 50)}...`);
                skipped++;
                continue;
            }

            const [
                idCliente,
                razaoSocial,
                nomeFantasia,
                cnpj,
                endereco,
                bairro,
                cidade,
                cep,
                estado,
                inscricaoEstadual,
                telefone,
                email
            ] = fields;

            // Validar campos obrigatórios
            if (!razaoSocial) {
                console.log(`⚠️  Cliente sem razão social, pulando linha: ${line.substring(0, 50)}...`);
                skipped++;
                continue;
            }

            try {
                await client.query(`
                    INSERT INTO customers (
                        razao_social,
                        nome_fantasia,
                        cnpj,
                        endereco,
                        bairro,
                        cidade,
                        cep,
                        estado,
                        inscricao_estadual,
                        telefone,
                        email,
                        ativo
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [
                    razaoSocial,
                    nomeFantasia,
                    cnpj,
                    endereco,
                    bairro,
                    cidade,
                    cep,
                    estado,
                    inscricaoEstadual,
                    telefone,
                    email,
                    true // ativo por padrão
                ]);

                imported++;

                if (imported % 10 === 0) {
                    console.log(`✅ Importados: ${imported} clientes...`);
                }
            } catch (error) {
                console.error(`❌ Erro ao importar cliente "${razaoSocial}":`, error.message);
                skipped++;
            }
        }

        await client.query('COMMIT');

        console.log('\n📊 Resumo da importação:');
        console.log(`✅ Importados com sucesso: ${imported}`);
        console.log(`⚠️  Pulados: ${skipped}`);
        console.log(`📦 Total de linhas processadas: ${dataLines.length}`);

        // Verificar total de clientes no banco
        const result = await client.query('SELECT COUNT(*) as total FROM customers');
        console.log(`\n💾 Total de clientes no banco: ${result.rows[0].total}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na importação:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Executar importação se chamado diretamente
if (require.main === module) {
    importCustomers()
        .then(() => {
            console.log('\n✅ Importação concluída com sucesso!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Falha na importação:', error);
            process.exit(1);
        });
}

module.exports = { importCustomers };
