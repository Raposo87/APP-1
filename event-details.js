// Função para carregar os detalhes do evento
async function loadEventDetails() {
    try {
        // Obter o ID do evento da URL
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');

        if (!eventId) {
            alert('ID do evento não encontrado');
            window.history.back();
            return;
        }

        // Buscar os detalhes do evento
        const response = await fetch(`http://localhost:3000/api/events/${eventId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes do evento');
        }

        const event = await response.json();

        // Preencher os elementos com os detalhes do evento
        document.getElementById('event-title').textContent = event.name;
        document.getElementById('event-date').textContent = `Início: ${formatDate(event.date)} - Término: ${formatDate(event.end_date)}`;
        document.getElementById('event-location').textContent = `Local: ${event.location}`;
        document.getElementById('event-category').textContent = event.category || 'Sem categoria';
        document.getElementById('event-description').textContent = event.description;
        document.getElementById('event-contact').textContent = event.contact ? `Contato: ${event.contact}` : '';

        // Carregar a imagem se existir
        const eventImage = document.getElementById('event-image');
        if (event.image_path) {
            eventImage.src = event.image_path;
            eventImage.style.display = 'block';
        } else {
            eventImage.style.display = 'none';
        }

    } catch (error) {
        console.error('Erro ao carregar detalhes do evento:', error);
        alert('Erro ao carregar detalhes do evento');
        window.history.back();
    }
}

// Função para formatar a data
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

// Carregar os detalhes do evento quando a página carregar
document.addEventListener('DOMContentLoaded', loadEventDetails); 