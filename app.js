// ===============================
// app.js - Lógica do aplicativo
// ===============================

// Variáveis globais
let isAuthenticated = false;
let currentUser = null;
let events = [];

// Carregar eventos do localStorage ao iniciar
if (localStorage.getItem('events')) {
    events = JSON.parse(localStorage.getItem('events'));
}

// Elementos DOM
const eventForm = document.getElementById('event-form');
const eventsList = document.getElementById('events-list');
const categoryFilter = document.getElementById('category-filter');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const showEventFormButton = document.getElementById('show-event-form');
const deleteFinishedEventsButton = document.getElementById('delete-finished-events');

// Localização do usuário (opcional)
let userLocation = null;

// Solicitar localização do usuário
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            // Você pode usar userLocation futuramente para ordenar por proximidade
        },
        (error) => {
            console.log('Localização não permitida ou indisponível.');
        }
    );
}

// Configuração da API
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://web-production-3c00e.up.railway.app'; // URL do backend em produção

// Função para salvar eventos no localStorage
function saveEvents() {
    localStorage.setItem('events', JSON.stringify(events));
}

// Função para filtrar eventos dos próximos 5 dias
function getUpcomingEvents(category = '') {
    const now = new Date();
    return events.filter(ev => {
        const evDate = new Date(ev.date);
        const evEndDate = new Date(ev.end_date);
        const inRange = evDate >= now || evEndDate > now;
        const matchesCategory = category ? ev.category === category : true;
        return inRange && matchesCategory;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Função para obter a localização do usuário
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('Localização obtida:', position.coords);
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Erro ao obter localização:', error);
                    // Coordenadas padrão (Lisboa) caso não consiga obter a localização
                    resolve({
                        latitude: 38.7223,
                        longitude: -9.1393
                    });
                }
            );
        } else {
            console.log('Geolocalização não suportada, usando coordenadas padrão');
            resolve({
                latitude: 38.7223,
                longitude: -9.1393
            });
        }
    });
}

// Função para buscar eventos próximos
async function fetchNearbyEvents() {
    try {
        const location = await getUserLocation();
        console.log('Buscando eventos próximos com localização:', location);
        
        const response = await fetch(`${API_URL}/events/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radius=50`);
        console.log('Status da resposta:', response.status);
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao buscar eventos');
        }
        
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Erro ao buscar eventos próximos:', error);
        return [];
    }
}

// Função para filtrar eventos das próximas 5 horas
async function getNextFiveHoursEvents() {
    try {
        const events = await fetchNearbyEvents();
        console.log('Eventos recebidos para filtragem:', events);
        
        const now = new Date();
        const fiveHoursLater = new Date(now.getTime() + 5 * 60 * 60 * 1000);
        console.log('Filtrando eventos entre:', now, 'e', fiveHoursLater);
        
        const filteredEvents = events.filter(ev => {
            const evDate = new Date(ev.date);
            const isInRange = evDate >= now && evDate <= fiveHoursLater;
            console.log('Evento:', ev.name, 'Data:', evDate, 'Está no intervalo:', isInRange);
            return isInRange;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        console.log('Eventos filtrados:', filteredEvents);
        return filteredEvents;
    } catch (error) {
        console.error('Erro ao filtrar eventos:', error);
        return [];
    }
}

// Função para calcular e exibir a contagem regressiva
function getEventCountdown(startDate, endDate) {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Se o evento já terminou
    if (now >= end) {
        return 'Evento encerrado';
    }

    // Se o evento já começou
    if (now >= start && now < end) {
        const diff = end - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `Termina em: ${hours}h ${minutes}m`;
    }

    // Evento ainda não começou
    // Se for hoje ou amanhã (a partir da meia-noite)
    const isToday = now.toDateString() === start.toDateString();
    const isTomorrow = (new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).toDateString() === start.toDateString();
    if (isToday || (isTomorrow && start - now < 24 * 60 * 60 * 1000 && start.getHours() < 24)) {
        const diff = start - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `Começa em: ${hours}h ${minutes}m`;
    }

    // Caso contrário, mostrar data e hora normalmente
    return `Início: ${formatDate(startDate)}`;
}

// Atualizar contagem regressiva em todos os eventos
function updateAllCountdowns() {
    const countdowns = document.querySelectorAll('.event-countdown');
    countdowns.forEach(el => {
        const start = el.getAttribute('data-start');
        const end = el.getAttribute('data-end');
        el.textContent = getEventCountdown(start, end);
    });
}

setInterval(updateAllCountdowns, 1000);

// Função para renderizar eventos na tela
function renderEvents(events) {
    const eventsContainer = document.getElementById('events-container');
    if (!eventsContainer) {
        console.error('Container de eventos não encontrado!');
        return;
    }
    eventsContainer.innerHTML = '';

    // Criar seções para cada tipo de evento
    const sections = {
        upcoming: createEventSection('Próximos Eventos', events.upcoming),
        ongoing: createEventSection('Eventos em Andamento', events.ongoing),
        finished: createEventSection('Eventos Recentemente Encerrados', events.finished)
    };

    // Adicionar seções ao container na ordem correta
    eventsContainer.appendChild(sections.upcoming);
    eventsContainer.appendChild(sections.ongoing);
    eventsContainer.appendChild(sections.finished);

    // Inicializar carrosséis para cada seção
    initializeCarousels();
}

function createEventSection(title, events) {
    const section = document.createElement('div');
    section.className = 'event-section';
    section.id = title.toLowerCase().replace(/\s+/g, '-');
    section.innerHTML = `
        <h2 class="section-title">${title}</h2>
        <div class="events-container">
            <button class="carousel-nav carousel-prev">❮</button>
            <button class="carousel-nav carousel-next">❯</button>
            <div class="cards-wrapper"></div>
        </div>
    `;

    const cardsWrapper = section.querySelector('.cards-wrapper');
    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.onclick = () => window.location.href = `event-details.html?id=${event.id}`;

        // Categoria
        let categoryHtml = `<span class='event-category'><strong>Categoria:</strong> ${event.category || 'Não especificada'}</span>`;
        // Chat
        let chatHtml = '';
        if (event.message_count && event.message_count > 0) {
            chatHtml = `<div class='event-chat-row'><span class='chat-label'>Chat:</span> <span class='chat-dot'>${event.message_count}</span></div>`;
        }

        card.innerHTML = `
            ${event.image_url ? `<img src="${event.image_url}" alt="${event.name}" class="event-image">` : ''}
            <h3 class="event-title">${event.name}</h3>
            <p class="event-date"><strong>Início:</strong> ${formatDate(event.date)}</p>
            <p class="event-end-date"><strong>Término:</strong> ${formatDate(event.end_date)}</p>
            <p class="event-location"><strong>Local:</strong> ${event.location}</p>
            <div>${categoryHtml}</div>
            ${chatHtml}
            <p class="event-description">${event.description || ''}</p>
        `;

        cardsWrapper.appendChild(card);
    });

    return section;
}

function initializeCarousels() {
    document.querySelectorAll('.event-section').forEach(section => {
        const container = section.querySelector('.events-container');
        const wrapper = container.querySelector('.cards-wrapper');
        const prevBtn = container.querySelector('.carousel-prev');
        const nextBtn = container.querySelector('.carousel-next');
        const cards = wrapper.querySelectorAll('.event-card');
        
        if (cards.length > 2) {
            let currentIndex = 0;
            const cardWidth = cards[0].offsetWidth + 16; // Largura do card + gap
            
            // Função para atualizar a posição dos cards
            function updateCardsPosition() {
                wrapper.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
                
                // Atualizar estado dos botões
                prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
                nextBtn.style.display = currentIndex < cards.length - 2 ? 'flex' : 'none';
            }
            
            // Configurar botões de navegação
            prevBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    updateCardsPosition();
                }
            });
            
            nextBtn.addEventListener('click', () => {
                if (currentIndex < cards.length - 2) {
                    currentIndex++;
                    updateCardsPosition();
                }
            });
            
            // Inicializar posição
            updateCardsPosition();
        } else {
            // Se houver 2 ou menos cards, esconder os botões de navegação
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    });
}

// Função para criar um card de evento
function createEventCard(ev, status) {
    const li = document.createElement('li');
    li.className = 'event-card';
    
    const startDate = new Date(ev.date.replace('T', ' '));
    const endDate = new Date(ev.end_date.replace('T', ' '));
    const now = new Date();
    
    // Adicionar classe baseada no status do evento
    if (startDate > now) {
        li.classList.add('upcoming');
    } else if (endDate > now) {
        li.classList.add('ongoing');
    } else {
        li.classList.add('finished');
    }
    
    li.innerHTML = `
        ${ev.image_url ? `<img src="${ev.image_url}" alt="${ev.name}" class="event-image">` : ''}
        <span class="event-title">${ev.name}</span>
        <span class="event-date">Início: ${formatDate(ev.date)}</span>
        <span class="event-end-date">Término: ${formatDate(ev.end_date)}</span>
        <span class="event-location">${ev.location}</span>
        <span class="event-description">${ev.description.length > 100 ? ev.description.slice(0, 100) + '...' : ev.description}</span>
        ${ev.category ? `<span class="event-category">Categoria: ${ev.category}</span>` : ''}
        ${ev.contact ? `<span class="event-contact">Contato: ${ev.contact}</span>` : ''}
    `;
    
    // Adicionar evento de clique para navegar para a página de detalhes
    li.addEventListener('click', () => {
        window.location.href = `event-details.html?id=${ev.id}`;
    });
    
    return li;
}

// Função para renderizar o carrossel de eventos das próximas 5 horas
async function renderCarousel() {
    const carousel = document.getElementById('carousel');
    const nextFiveHoursEvents = await getNextFiveHoursEvents();
    carousel.innerHTML = '';
    
    if (!nextFiveHoursEvents || nextFiveHoursEvents.error) {
        console.error('Erro ao renderizar carrossel:', nextFiveHoursEvents?.error);
        carousel.innerHTML = '<div class="carousel-item"><p>Erro ao carregar eventos. Por favor, tente novamente.</p></div>';
        return;
    }
    
    if (nextFiveHoursEvents.length === 0) {
        carousel.innerHTML = '<div class="carousel-item"><p>Nenhum evento nas próximas 5 horas.</p></div>';
        return;
    }
    
    nextFiveHoursEvents.forEach(ev => {
        const div = document.createElement('div');
        div.className = 'carousel-item';
        div.innerHTML = `
            ${ev.image_path ? `<img src="${ev.image_path}" alt="${ev.name}" class="carousel-image">` : ''}
            <h3>${ev.name}</h3>
            <p>Início: ${formatDate(ev.date)}</p>
            <p>Término: ${formatDate(ev.end_date)}</p>
            <p class="event-countdown" data-start="${ev.date}" data-end="${ev.end_date}"></p>
            <p>${ev.location}</p>
            <p class="event-distance">Distância: ${Math.round(ev.distance * 10) / 10} km</p>
        `;
        carousel.appendChild(div);
    });
    
    // Iniciar o carrossel infinito
    startCarousel();
    // Iniciar a contagem regressiva para os eventos do carrossel
    updateAllCountdowns();
}

// Função para iniciar o carrossel
function startCarousel() {
    const carousel = document.querySelector('.carousel');
    if (!carousel) return;

    let currentIndex = 0;
    const items = carousel.querySelectorAll('.carousel-item');
    if (items.length <= 1) return;

    setInterval(() => {
        currentIndex = (currentIndex + 1) % items.length;
        carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
    }, 3000);
}

// Função para formatar data/hora de forma legível
function formatDate(dateStr) {
    if (!dateStr) return 'Data não definida';
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.error('Data inválida:', dateStr);
            return 'Data inválida';
        }
        
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Erro ao formatar data';
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    const eventForm = document.getElementById('event-form');
    const showEventFormButton = document.getElementById('show-event-form');
    if (showEventFormButton && eventForm) {
        showEventFormButton.addEventListener('click', function(e) {
            e.preventDefault();
            eventForm.style.display = eventForm.style.display === 'none' ? 'block' : 'none';
        });
    }
    // Carregar eventos do servidor
    loadEvents();
    // Configurar event listeners
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterEvents);
    }
    // Verificar autenticação
    checkAuth();
});

// Verificar autenticação
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        if (window.location.pathname.includes('app.html')) {
            window.location.href = 'index.html';
        }
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/verify-token`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            isAuthenticated = true;
            currentUser = data.user;
            updateUIForAuth();
            
            if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
                window.location.href = 'app.html';
            } else {
                loadEvents();
            }
        } else {
            localStorage.removeItem('token');
            isAuthenticated = false;
            currentUser = null;
            if (window.location.pathname.includes('app.html')) {
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('token');
        isAuthenticated = false;
        currentUser = null;
        if (window.location.pathname.includes('app.html')) {
            window.location.href = 'index.html';
        }
    }
}

// Atualizar UI baseado no estado de autenticação
function updateUIForAuth() {
    const userInfo = document.querySelector('.user-info p');
    const logoutButton = document.getElementById('logout-button');
    const eventForm = document.getElementById('event-form');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');

    if (isAuthenticated && currentUser) {
        if (userInfo) userInfo.textContent = `Olá, ${currentUser.username}`;
        if (logoutButton) logoutButton.style.display = 'block';
        if (eventForm) eventForm.style.display = 'block';
        if (loginButton) loginButton.style.display = 'none';
        if (registerButton) registerButton.style.display = 'none';
    } else {
        if (userInfo) userInfo.textContent = 'Não logado';
        if (logoutButton) logoutButton.style.display = 'none';
        if (eventForm) eventForm.style.display = 'none';
        if (loginButton) loginButton.style.display = 'block';
        if (registerButton) registerButton.style.display = 'block';
    }
}

// Mostrar modal de login
function showLoginModal() {
    const modal = createModal('Login', `
        <form id="login-form">
            <div class="form-group">
                <label for="login-username">Usuário:</label>
                <input type="text" id="login-username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="login-password">Senha:</label>
                <input type="password" id="login-password" required autocomplete="current-password">
            </div>
            <button type="submit" class="primary-button">Entrar</button>
        </form>
    `);

    const form = modal.querySelector('#login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                isAuthenticated = true;
                currentUser = data.user;
                modal.remove();
                
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 100);
            } else {
                alert(data.message || 'Usuário ou senha incorretos');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            alert('Erro ao conectar com o servidor. Tente novamente.');
        }
    });
}

// Mostrar modal de registro
function showRegisterModal() {
    const modal = createModal('Cadastro', `
        <form id="register-form">
            <div class="form-group">
                <label for="register-username">Usuário:</label>
                <input type="text" id="register-username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="register-email">Email:</label>
                <input type="email" id="register-email" required autocomplete="email">
            </div>
            <div class="form-group">
                <label for="register-password">Senha:</label>
                <input type="password" id="register-password" required 
                    minlength="8" 
                    pattern="^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$"
                    autocomplete="new-password">
                <small>A senha deve ter pelo menos 8 caracteres, incluindo letras, números e um caractere especial</small>
            </div>
            <div class="form-group">
                <label for="register-confirm-password">Confirmar Senha:</label>
                <input type="password" id="register-confirm-password" required autocomplete="new-password">
            </div>
            <button type="submit" class="primary-button">Cadastrar</button>
        </form>
    `);

    const form = modal.querySelector('#register-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password !== confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }

        if (password.length < 8) {
            alert('A senha deve ter pelo menos 8 caracteres');
            return;
        }

        if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)) {
            alert('A senha deve conter pelo menos uma letra, um número e um caractere especial');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Cadastro realizado com sucesso! Faça login para continuar.');
                modal.remove();
            } else {
                alert(data.message || 'Erro ao fazer cadastro');
            }
        } catch (error) {
            console.error('Erro ao fazer cadastro:', error);
            alert('Erro ao conectar com o servidor. Tente novamente.');
        }
    });
}

// Criar modal
function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${title}</h2>
            ${content}
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.remove();

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    };

    return modal;
}

// Função para fazer logout
function logout() {
    localStorage.removeItem('token');
    isAuthenticated = false;
    currentUser = null;
    window.location.href = 'index.html';
}

// Carregar eventos
async function loadEvents() {
    try {
        const response = await fetch(`${API_URL}/api/events`);
        if (response.ok) {
            const data = await response.json();
            console.log('Dados recebidos do servidor:', data);
            
            if (!data || typeof data !== 'object') {
                console.error('Formato de dados inválido:', data);
                return;
            }
            
            events = {
                upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
                ongoing: Array.isArray(data.ongoing) ? data.ongoing : [],
                finished: Array.isArray(data.finished) ? data.finished : []
            };
            
            console.log('Eventos organizados:', {
                upcoming: events.upcoming.length,
                ongoing: events.ongoing.length,
                finished: events.finished.length
            });
            
            renderEvents(events);
        } else {
            console.error('Erro ao carregar eventos:', response.status);
        }
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
    }
}

// Filtrar eventos por categoria
function filterEvents() {
    const categoryFilter = document.getElementById('category-filter');
    const selectedCategory = categoryFilter.value;

    const filteredEvents = selectedCategory
        ? events.filter(event => event.category === selectedCategory)
        : events;

    renderEvents(filteredEvents);
}

// Manipular envio do formulário de eventos
async function handleEventSubmit(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append('name', document.getElementById('event-name').value);
    formData.append('date', document.getElementById('event-date').value);
    formData.append('end_date', document.getElementById('event-end-date').value);
    formData.append('location', document.getElementById('event-location').value);
    formData.append('description', document.getElementById('event-description').value);
    formData.append('category', document.getElementById('event-category').value);
    formData.append('contact', document.getElementById('event-contact').value);

    const imageFile = document.getElementById('event-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    // Validação básica
    if (!formData.get('name') || !formData.get('date') || !formData.get('end_date') || !formData.get('location')) {
        alert('Nome, data, data de término e local são obrigatórios');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            alert('Evento criado com sucesso!');
            event.target.reset();
            loadEvents();
        } else {
            const error = await response.json();
            alert(error.message || 'Erro ao criar evento');
        }
    } catch (error) {
        console.error('Erro ao criar evento:', error);
        alert('Erro ao criar evento. Tente novamente.');
    }
}

// Atualizar eventos a cada minuto
setInterval(loadEvents, 60000);

// Adicionar eventos para o menu lateral
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    const logoutButton = document.getElementById('logout-button');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            document.querySelector('main').classList.add('sidebar-active');
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
            document.querySelector('main').classList.remove('sidebar-active');
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});

// ===============================
// Observação:
// Para um app real, seria necessário um back-end para persistência e multiusuários.
// =============================== 