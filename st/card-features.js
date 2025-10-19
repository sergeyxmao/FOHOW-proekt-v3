// ============== НАЧАЛО ФАЙЛА CARD-FEATURES.JS ==============

// Глобальная функция для применения значков к карточке
function applyCardBadges(cardData) {
    if (!cardData || !cardData.element) return;

    const cardElement = cardData.element;
    const badges = cardData.badges || {};

    const fendouBadge = cardElement.querySelector('.fendou-badge');
    const slfBadge = cardElement.querySelector('.slf-badge');
    const rankBadge = cardElement.querySelector('.rank-badge');

    if (fendouBadge) fendouBadge.classList.toggle('visible', !!badges.fendou);
    if (slfBadge) slfBadge.classList.toggle('visible', !!badges.slf);
    
    if (rankBadge) {
        if (badges.rank) {
            rankBadge.src = `rank-${badges.rank}.png`;
            rankBadge.classList.add('visible');
        } else {
            rankBadge.classList.remove('visible');
        }
    }
}

// Глобальная функция для инициализации всего функционала
function initializeCardFeatures(getCards, saveState) {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'card-context-menu';
    document.body.appendChild(contextMenu);

    let currentCardData = null;

    const ranks = {
        'emerald': 'Изумруд', 'sapphire': 'Сапфир', 'diamond': 'Алмаз', 
        'brilliant3': 'Бриллиант 3', 'brilliant5': 'Бриллиант 5', 'brilliant7': 'Бриллиант 7', 
        'ambassador': 'Амбасадор'
    };

    function showContextMenu(e, cardData) {
        e.preventDefault();
        if (!cardData) return;

        currentCardData = cardData;

        const badges = cardData.badges || {};

        let rankHtml = '';
        for (const key in ranks) {
            rankHtml += `<div class="context-menu-item ${badges.rank === key ? 'active' : ''}" data-type="rank" data-value="${key}">${ranks[key]}</div>`;
        }

        contextMenu.innerHTML = `
            <div class="context-menu-section">
                <div class="context-menu-item ${badges.fendou ? 'active' : ''}" data-type="badge" data-value="fendou">FENDOU</div>
            </div>
            <div class="context-menu-section">
                <div class="context-menu-item ${badges.slf ? 'active' : ''}" data-type="badge" data-value="slf">SLF</div>
            </div>
            <div class="context-menu-section">
                ${rankHtml}
            </div>
        `;

        contextMenu.style.display = 'block';
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > winWidth) {
            x = winWidth - menuWidth - 5;
        }
        if (y + menuHeight > winHeight) {
            y = winHeight - menuHeight - 5;
        }

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
        currentCardData = null;
    }

    document.addEventListener('contextmenu', (e) => {
        const header = e.target.closest('.card-header');
        if (!header) return;
        
        const cardElement = header.closest('.card');
        const cardData = getCards().find(c => c.id === cardElement.id);
        if (cardData) {
            showContextMenu(e, cardData);
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.card-context-menu')) {
            hideContextMenu();
        }
    });

    contextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item || !currentCardData) return;

        // Инициализация badges, если не существует
        if (!currentCardData.badges) {
            currentCardData.badges = {};
        }

        const { type, value } = item.dataset;

        if (type === 'badge') {
            currentCardData.badges[value] = !currentCardData.badges[value];
        } else if (type === 'rank') {
            currentCardData.badges.rank = currentCardData.badges.rank === value ? null : value;
        }

        applyCardBadges(currentCardData);
        saveState();
        hideContextMenu();
    });
}