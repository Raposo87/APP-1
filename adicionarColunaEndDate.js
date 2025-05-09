const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run("ALTER TABLE events ADD COLUMN end_date DATETIME;", function(err) {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('A coluna end_date já existe.');
        } else {
            console.error('Erro ao adicionar coluna end_date:', err);
        }
    } else {
        console.log('Coluna end_date adicionada com sucesso!');
    }
    db.close();
}); 