// Variáveis globais
let isAuthenticated = false;
let currentUser = null;

// Função para verificar autenticação ao carregar a página
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Verificar token com o servidor
        fetch('/api/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                isAuthenticated = true;
                currentUser = data.user;
                window.location.href = '/app.html';
            } else {
                handleLogout();
            }
        })
        .catch(error => {
            console.error('Erro ao verificar token:', error);
            handleLogout();
        });
    }
}

// Função para criar modal
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

    // Fechar modal quando clicar no X
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.remove();

    // Fechar modal quando clicar fora dele
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    };

    return modal;
}

// Função para fazer login
function login(username, password) {
    return fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Erro ao fazer login');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.token) {
            localStorage.setItem('token', data.token);
            isAuthenticated = true;
            currentUser = data.user;
            window.location.href = '/app.html';
        } else {
            throw new Error('Token não recebido');
        }
    });
}

// Função para fazer logout
function handleLogout() {
    localStorage.removeItem('token');
    isAuthenticated = false;
    currentUser = null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Login button
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const modal = createModal('Login', `
                <form id="login-form">
                    <div class="form-group">
                        <label for="username">Usuário:</label>
                        <input type="text" id="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Senha:</label>
                        <input type="password" id="password" required>
                    </div>
                    <button type="submit" class="primary-button">Entrar</button>
                </form>
            `);

            const form = modal.querySelector('#login-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                login(username, password)
                    .catch(error => {
                        alert(error.message);
                    });
            });
        });
    }

    // Register button
    const registerButton = document.getElementById('register-button');
    if (registerButton) {
        registerButton.addEventListener('click', () => {
            const modal = createModal('Cadastro', `
                <form id="register-form">
                    <div class="form-group">
                        <label for="register-username">Usuário:</label>
                        <input type="text" id="register-username" required>
                    </div>
                    <div class="form-group">
                        <label for="register-email">Email:</label>
                        <input type="email" id="register-email" required>
                    </div>
                    <div class="form-group">
                        <label for="register-password">Senha:</label>
                        <input type="password" id="register-password" required>
                    </div>
                    <div class="form-group">
                        <label for="register-confirm-password">Confirmar Senha:</label>
                        <input type="password" id="register-confirm-password" required>
                    </div>
                    <button type="submit" class="secondary-button">Cadastrar</button>
                </form>
            `);

            const form = modal.querySelector('#register-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const confirmPassword = document.getElementById('register-confirm-password').value;

                if (password !== confirmPassword) {
                    alert('As senhas não coincidem!');
                    return;
                }

                fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'Erro ao fazer cadastro');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.token) {
                        localStorage.setItem('token', data.token);
                        isAuthenticated = true;
                        currentUser = data.user;
                        window.location.href = '/app.html';
                    } else {
                        throw new Error('Token não recebido');
                    }
                })
                .catch(error => {
                    alert(error.message);
                });
            });
        });
    }
}); 