const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuração do banco de dados
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Atualizar a tabela de eventos
db.serialize(() => {
    // Adicionar colunas se não existirem
    db.run(`ALTER TABLE events ADD COLUMN is_deleted INTEGER DEFAULT 0`);
    db.run(`ALTER TABLE events ADD COLUMN deleted_at DATETIME`);
    
    console.log('Banco de dados atualizado com sucesso!');
});

// Fechar conexão
db.close(); 