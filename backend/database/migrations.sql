-- Migrations para Sistema de Estoque Fotográfico

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de equipamentos
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    unit VARCHAR(20) NOT NULL DEFAULT 'un',
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    min_stock INTEGER DEFAULT 1 CHECK (min_stock >= 0),
    avg_cost DECIMAL(12,2) DEFAULT 0 CHECK (avg_cost >= 0),
    current_cost DECIMAL(12,2) DEFAULT 0 CHECK (current_cost >= 0),
    total_value DECIMAL(12,2) DEFAULT 0 CHECK (total_value >= 0),
    location VARCHAR(255),
    notes TEXT,
    expiry_date DATE,
    supplier VARCHAR(255),
    is_custom BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste', 'criacao', 'produto_excluido', 'usuario_criado', 'usuario_desativado', 'usuario_reativado', 'reset')),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    equipment_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(100),
    quantity DECIMAL(10,3) DEFAULT 0,
    unit VARCHAR(20),
    cost DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    supplier VARCHAR(255),
    destination VARCHAR(255),
    reason VARCHAR(255),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    user_name VARCHAR(255) NOT NULL
);

-- Tabela de sessões (opcional, para controle de sessões)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON equipment(active);
CREATE INDEX IF NOT EXISTS idx_equipment_quantity ON equipment(quantity);
CREATE INDEX IF NOT EXISTS idx_transactions_equipment ON transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- Triggers para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir categorias padrão
INSERT INTO categories (name, slug, icon, description) VALUES
    ('Câmeras', 'cameras', '📷', 'Câmeras fotográficas digitais e analógicas'),
    ('Lentes', 'lentes', '🔍', 'Lentes e objetivas para câmeras'),
    ('Iluminação', 'iluminacao', '💡', 'Equipamentos de iluminação para fotografia'),
    ('Acessórios', 'acessorios', '🎯', 'Acessórios diversos para fotografia'),
    ('Informática', 'informatica', '💻', 'Equipamentos de informática e tecnologia'),
    ('Insumos', 'insumos', '📦', 'Cabos, conectores, etc.')
ON CONFLICT (slug) DO NOTHING;