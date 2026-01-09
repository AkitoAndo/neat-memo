// API endpoint will be replaced during deployment
const API_ENDPOINT = window.API_ENDPOINT || '';

async function init() {
    const messageEl = document.getElementById('message');

    try {
        const response = await fetch(`${API_ENDPOINT}/hello`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        messageEl.textContent = data.message;
        messageEl.classList.remove('loading');
    } catch (error) {
        console.error('API Error:', error);
        messageEl.textContent = 'Hello World (API未接続)';
        messageEl.classList.remove('loading');
    }
}

document.addEventListener('DOMContentLoaded', init);
