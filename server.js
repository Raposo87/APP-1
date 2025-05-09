require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'seu_segredo_jwt';

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // limite de 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não suportado. Use apenas JPEG, PNG ou GIF.'));
        }
    }
});

// Middleware para CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Middleware para processar JSON
app.use(express.json());

// Servir arquivos estáticos da pasta atual
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Configuração do banco de dados
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'events.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                location TEXT NOT NULL,
                description TEXT,
                category TEXT,
                contact TEXT,
                image_url TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_deleted INTEGER DEFAULT 0,
                deleted_at DATETIME,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`);
            // Nova tabela para mensagens do chat
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                user_id INTEGER,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);
        });
    }
});

// Função para autenticar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('Token recebido:', token);
    
    if (!token) {
        console.log('Token não fornecido');
        return res.status(401).json({ message: 'Token não fornecido' });
    }
    
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) {
            console.log('Erro ao verificar token:', err);
            return res.status(403).json({ message: 'Token inválido' });
        }
        
        console.log('Token decodificado:', decoded);
        
        // Buscar o usuário no banco para garantir que temos o ID correto
        db.get('SELECT id, username, email FROM users WHERE username = ?', [decoded.username], (err, dbUser) => {
            if (err) {
                console.log('Erro ao buscar usuário:', err);
                return res.status(500).json({ message: 'Erro ao buscar usuário' });
            }
            
            if (!dbUser) {
                console.log('Usuário não encontrado:', decoded.username);
                return res.status(403).json({ message: 'Usuário não encontrado' });
            }
            
            console.log('Usuário encontrado:', dbUser);
            
            // Adicionar o ID do banco ao objeto do usuário
            req.user = {
                id: dbUser.id,
                username: dbUser.username,
                email: dbUser.email
            };
            
            next();
        });
    });
}

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para o favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content
});

// Rota de cadastro
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Usuário, email e senha são obrigatórios' });
    }
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
        if (user) {
            return res.status(400).json({ message: 'Usuário ou email já cadastrado' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Erro ao cadastrar usuário' });
            }
            // Gera token após cadastro
            const userObj = { 
                id: this.lastID,
                username, 
                email 
            };
            const token = jwt.sign(userObj, SECRET, { expiresIn: '2h' });
            res.json({ token, user: userObj });
        });
    });
});

// Rota de login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (!user) {
            return res.status(400).json({ message: 'Usuário não encontrado' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ message: 'Senha incorreta' });
        }
        const userObj = { 
            id: user.id,
            username: user.username, 
            email: user.email 
        };
        const token = jwt.sign(userObj, SECRET, { expiresIn: '2h' });
        res.json({ token, user: userObj });
    });
});

// Rota para verificar token
app.get('/api/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token não fornecido' });
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        res.json({ user });
    });
});

// Função para limpar eventos encerrados
function cleanupFinishedEvents() {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutos atrás

    // Primeiro, buscar os eventos que serão deletados para remover suas imagens
    db.all(`
        SELECT * FROM events 
        WHERE end_date < ? 
        AND is_deleted = 0
    `, [tenMinutesAgo.toISOString()], (err, eventsToDelete) => {
        if (err) {
            console.error('Erro ao buscar eventos para deletar:', err);
            return;
        }

        // Deletar as imagens dos eventos
        eventsToDelete.forEach(event => {
            if (event.image_url) {
                const imagePath = path.join(__dirname, event.image_url);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
        });

        // Deletar os eventos do banco de dados (as mensagens serão deletadas automaticamente pelo ON DELETE CASCADE)
        db.run(`
            DELETE FROM events 
            WHERE end_date < ? 
            AND is_deleted = 0
        `, [tenMinutesAgo.toISOString()], function(err) {
            if (err) {
                console.error('Erro ao deletar eventos encerrados:', err);
            } else if (this.changes > 0) {
                console.log(`${this.changes} eventos encerrados foram permanentemente removidos`);
            }
        });
    });
}

// Executar limpeza a cada minuto
setInterval(cleanupFinishedEvents, 60 * 1000);

// Rota para obter eventos
app.get('/api/events', (req, res) => {
    const now = new Date();
    console.log('Data atual:', now.toLocaleString('pt-BR'));

    // Primeiro, limpar eventos encerrados
    cleanupFinishedEvents();

    // Buscar todos os eventos com contagem de mensagens
    db.all(`
        SELECT e.*, 
               (SELECT COUNT(*) FROM messages WHERE event_id = e.id) as message_count
        FROM events e 
        ORDER BY e.date ASC
    `, [], (err, events) => {
        if (err) {
            console.error('Erro ao buscar eventos:', err);
            return res.status(500).json({ error: 'Erro ao buscar eventos' });
        }

        // Organizar eventos por status
        const organizedEvents = {
            upcoming: [],
            ongoing: [],
            finished: []
        };

        events.forEach(event => {
            const eventDate = new Date(event.date);
            const eventEndDate = new Date(event.end_date);

            if (eventDate > now) {
                organizedEvents.upcoming.push(event);
            } else if (eventEndDate > now) {
                organizedEvents.ongoing.push(event);
            } else {
                // Só adiciona à lista de finalizados se tiver menos de 10 minutos
                const minutesSinceEnd = (now - eventEndDate) / (1000 * 60);
                if (minutesSinceEnd <= 10) {
                    organizedEvents.finished.push(event);
                }
            }
        });

        console.log('Eventos organizados:', {
            upcoming: organizedEvents.upcoming.length,
            ongoing: organizedEvents.ongoing.length,
            finished: organizedEvents.finished.length
        });

        res.json(organizedEvents);
    });
});

// Rota de debug para verificar eventos no banco
app.get('/api/debug/events', (req, res) => {
    db.all('SELECT * FROM events', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Rota para criar evento (autenticado)
app.post('/api/events', authenticateToken, upload.single('image'), (req, res) => {
    const { name, date, end_date, location, description, category, contact } = req.body;
    const created_by = req.user.id;
    let image_url = null;
    if (req.file) {
        image_url = `/uploads/${req.file.filename}`;
    }

    if (!name || !date || !end_date || !location) {
        return res.status(400).json({ message: 'Nome, data, data de término e local são obrigatórios' });
    }

    // Validar e formatar as datas
    try {
        const startDate = new Date(date);
        const endDate = new Date(end_date);
        const now = new Date();

        // Validar se as datas são válidas
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: 'Datas inválidas' });
        }

        // Validar se a data de término é posterior à data de início
        if (endDate <= startDate) {
            return res.status(400).json({ message: 'A data de término deve ser posterior à data de início' });
        }

        // Formatar as datas para o formato correto
        const formattedStartDate = startDate.toISOString();
        const formattedEndDate = endDate.toISOString();

        db.run(
            'INSERT INTO events (name, date, end_date, location, description, category, contact, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, formattedStartDate, formattedEndDate, location, description, category, contact, image_url, created_by],
            function(err) {
                if (err) {
                    console.error('Erro ao criar evento:', err);
                    return res.status(500).json({ message: 'Erro ao criar evento' });
                }
                console.log('Evento criado com sucesso. ID:', this.lastID);
                res.json({
                    id: this.lastID,
                    name,
                    date: formattedStartDate,
                    end_date: formattedEndDate,
                    location,
                    description,
                    category,
                    contact,
                    image_url,
                    created_by
                });
            }
        );
    } catch (error) {
        console.error('Erro ao processar datas:', error);
        return res.status(400).json({ message: 'Erro ao processar as datas do evento' });
    }
});

// Rota para excluir evento (apenas pelo criador)
app.delete('/api/events/:id', authenticateToken, (req, res) => {
    const eventId = req.params.id;
    const username = req.user.username;

    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
        if (err || !event) {
            return res.status(404).json({ message: 'Evento não encontrado' });
        }
        if (event.created_by !== username) {
            return res.status(403).json({ message: 'Você não tem permissão para excluir este evento' });
        }

        // Excluir o evento e sua imagem (se existir)
        if (event.image_url) {
            const imagePath = path.join(__dirname, event.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Excluir o evento do banco de dados
        db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Erro ao excluir evento' });
            }
            res.json({ message: 'Evento excluído com sucesso' });
        });
    });
});

// Rota para buscar detalhes de um evento específico
app.get('/api/events/:id', (req, res) => {
    const eventId = req.params.id;
    
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar evento' });
        }
        
        if (!event) {
            return res.status(404).json({ message: 'Evento não encontrado' });
        }
        
        res.json(event);
    });
});

// Função auxiliar para calcular distância
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(value) {
    return value * Math.PI / 180;
}

// Rota para criar eventos fictícios para teste
app.post('/api/test-events', (req, res) => {
    const now = new Date();
    const testEvents = [
        {
            name: 'Show de Rock',
            date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas no futuro
            end_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 horas no futuro
            location: 'Arena Show',
            description: 'Grande show de rock com as melhores bandas da cidade!',
            category: 'Música',
            contact: 'contato@arenashow.com',
            created_by: 'admin'
        },
        {
            name: 'Workshop de Programação',
            date: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(), // 1 hora no futuro
            end_date: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3 horas no futuro
            location: 'Centro de Inovação',
            description: 'Aprenda programação web com os melhores profissionais!',
            category: 'Educação',
            contact: 'workshop@inovacao.com',
            created_by: 'admin'
        },
        {
            name: 'Festival de Comida',
            date: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hora atrás
            end_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas no futuro
            location: 'Parque Central',
            description: 'Venha experimentar as melhores comidas da região!',
            category: 'Gastronomia',
            contact: 'festival@comida.com',
            created_by: 'admin'
        },
        {
            name: 'Maratona de Corrida',
            date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
            end_date: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutos atrás
            location: 'Avenida Principal',
            description: 'Maratona anual com percursos de 5km, 10km e 21km!',
            category: 'Esporte',
            contact: 'maratona@corrida.com',
            created_by: 'admin'
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO events (name, date, end_date, location, description, category, contact, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    testEvents.forEach(event => {
        stmt.run([
            event.name,
            event.date,
            event.end_date,
            event.location,
            event.description,
            event.category,
            event.contact,
            event.created_by
        ], function(err) {
            if (err) {
                console.error('Erro ao inserir evento de teste:', err);
            } else {
                console.log('Evento de teste criado com ID:', this.lastID);
            }
        });
    });

    stmt.finalize();
    res.json({ message: 'Eventos de teste criados com sucesso!' });
});

// Rota para remover eventos de teste
app.delete('/api/test-events', (req, res) => {
    db.run('DELETE FROM events WHERE created_by = ?', ['admin'], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao remover eventos de teste' });
        }
        res.json({ message: 'Eventos de teste removidos com sucesso!' });
    });
});

// Rota para obter mensagens de um evento
app.get('/api/events/:eventId/messages', authenticateToken, (req, res) => {
    const eventId = req.params.eventId;
    
    db.all(`
        SELECT m.*, u.username 
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.event_id = ?
        ORDER BY m.created_at ASC
    `, [eventId], (err, messages) => {
        if (err) {
            console.error('Erro ao buscar mensagens:', err);
            return res.status(500).json({ error: 'Erro ao buscar mensagens' });
        }
        res.json(messages);
    });
});

// Rota para enviar uma mensagem
app.post('/api/events/:eventId/messages', authenticateToken, (req, res) => {
    const eventId = req.params.eventId;
    const { message } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    console.log('Tentando enviar mensagem:', {
        eventId,
        userId,
        username,
        message,
        user: req.user
    });

    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
    }

    if (!userId) {
        console.error('ID do usuário não encontrado:', req.user);
        return res.status(500).json({ error: 'Erro de autenticação' });
    }

    // Verificar se o evento existe e não está deletado
    db.get('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [eventId], (err, event) => {
        if (err) {
            console.error('Erro ao verificar evento:', err);
            return res.status(500).json({ error: 'Erro ao verificar evento' });
        }
        
        if (!event) {
            return res.status(404).json({ error: 'Evento não encontrado ou já encerrado' });
        }

        // Inserir a mensagem
        db.run(`
            INSERT INTO messages (event_id, user_id, username, message)
            VALUES (?, ?, ?, ?)
        `, [eventId, userId, username, message.trim()], function(err) {
            if (err) {
                console.error('Erro ao enviar mensagem:', err);
                return res.status(500).json({ error: 'Erro ao enviar mensagem' });
            }

            // Retornar a mensagem criada
            db.get(`
                SELECT m.*, u.username 
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.id = ?
            `, [this.lastID], (err, newMessage) => {
                if (err) {
                    console.error('Erro ao recuperar mensagem:', err);
                    return res.status(500).json({ error: 'Erro ao recuperar mensagem enviada' });
                }
                res.json(newMessage);
            });
        });
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
}); 