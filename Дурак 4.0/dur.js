function getDB() { return JSON.parse(localStorage.getItem('users_db')) || {}; }
function saveDB(db) { localStorage.setItem('users_db', JSON.stringify(db)); }
let currentUser = null;

// --- ИГРОВОЙ ДВИЖОК ДУРАКА И ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ ---
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

let deck = [];
let trumpSuit = '';
let playerHand = [];
let aiHand = [];
let tableCards = [];
let isPlayerTurn = true; // true - атакует игрок, false - атакует ИИ

// Смена экранов
function changeScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
    
    const wrapper = document.getElementById('wrapper');
    if(screenId === 'screen-game-match') {
        wrapper.classList.add('game-table');
    } else {
        wrapper.classList.remove('game-table');
    }
}

// Генерация колоды
function createDeck() {
    deck = [];
    for (let suit of SUITS) {
        for (let rank of RANKS) {
            deck.push({ rank, suit, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' });
        }
    }
    deck.sort(() => Math.random() - 0.5);
}

// Старт игры (Раздача карт)
function startGame() {
    const diff = document.getElementById('difficulty-select').value;
    const diffTranslation = { 'easy': 'Легкий', 'medium': 'Шулер', 'hard': 'Магистр' };
    document.getElementById('current-diff').innerText = diffTranslation[diff];

    createDeck();
    let trumpCard = deck[deck.length - 1];
    trumpSuit = trumpCard.suit;
    document.getElementById('trump-suit-indicator').innerText = trumpSuit;

    playerHand = deck.splice(0, 6);
    aiHand = deck.splice(0, 6);
    tableCards = [];
    isPlayerTurn = true; // Игрок начинает первым

    endRound(); 
    
    changeScreen('screen-game-match');
    startTurnTimer();
}

// Отрисовка карт на столе
function renderGameTable() {
    const field = document.getElementById('playing-field');
    field.innerHTML = `
        <div style="position: absolute; left: 25px; display:flex; align-items:center; z-index: 5;">
            <div class="card-deck">${deck.length}</div>
            <div class="card trump" style="color: ${(trumpSuit==='♥'||trumpSuit==='♦')?'red':'black'}">${trumpSuit}</div>
        </div>
        <div id="table-battle-zone" style="display:flex; gap: 20px; margin-left: 140px; flex-wrap: wrap;"></div>
    `;

    const battleZone = document.getElementById('table-battle-zone');
    tableCards.forEach(pair => {
        // Создаем контейнер для пары карт (атака + защита)
        let pairDiv = document.createElement('div');
        pairDiv.className = 'battle-pair'; // Используем класс из CSS

        // Создаем карту атаки (нижнюю)
        let attCard = document.createElement('div');
        attCard.className = 'card';
        attCard.style.color = pair.attack.color;
        
        // ЗАМЕНА: Добавляем уголки и центр для карты атаки на столе
        attCard.innerHTML = `
            <div class="card-corner top-left">
                <div>${pair.attack.rank}</div>
                <div>${pair.attack.suit}</div>
            </div>
            <div class="card-center">${pair.attack.suit}</div>
            <div class="card-corner bottom-right">
                <div>${pair.attack.rank}</div>
                <div>${pair.attack.suit}</div>
            </div>
        `;
        pairDiv.appendChild(attCard);

        // Если карта побита, создаем карту защиты (верхнюю, со смещением)
        if (pair.defense) {
            // Обрабатываем структуру защиты, так как в логике ИИ там может быть массив
            let defData = Array.isArray(pair.defense) ? pair.defense[0] : pair.defense;
            
            if (defData) {
                let defCard = document.createElement('div');
                defCard.className = 'card defense-card'; // Добавили класс смещения из CSS
                defCard.style.color = defData.color;
                
                // ЗАМЕНА: Добавляем уголки и центр для карты защиты на столе
                defCard.innerHTML = `
                    <div class="card-corner top-left">
                        <div>${defData.rank}</div>
                        <div>${defData.suit}</div>
                    </div>
                    <div class="card-center">${defData.suit}</div>
                    <div class="card-corner bottom-right">
                        <div>${defData.rank}</div>
                        <div>${defData.suit}</div>
                    </div>
                `;
                pairDiv.appendChild(defCard);
            }
        }
        battleZone.appendChild(pairDiv);
    });



    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    playerHand.forEach((card, index) => {
        let cardDiv = document.createElement('div');
        cardDiv.className = 'card playable';
        cardDiv.style.color = card.color;
        
        // ЗАМЕНА ТУТ: Формируем реальную структуру карты (уголки + центр)
        cardDiv.innerHTML = `
            <div class="card-corner top-left">
                <div>${card.rank}</div>
                <div>${card.suit}</div>
            </div>
            <div class="card-center">${card.suit}</div>
            <div class="card-corner bottom-right">
                <div>${card.rank}</div>
                <div>${card.suit}</div>
            </div>
        `;
        
        cardDiv.onclick = function() { playerTurn(index); };
        handContainer.appendChild(cardDiv);
    });

    const cards = handContainer.querySelectorAll('.card.playable');
    cards.forEach((c, i) => {
        let angle = (i - (cards.length - 1) / 2) * 5; 
        c.style.transform = `rotate(${angle}deg) translateY(${Math.abs(angle) * 1.5}px)`;
    });

    // === СВЯЗЫВАНИЕ КНОПОК ПО НОВЫМ КЛАССАМ ===
    const takeBtn = document.querySelector(".action-take");
    const finishBtn = document.querySelector(".action-finish");
    const statusText = document.querySelector('#screen-game-match p');

    if (takeBtn && finishBtn) {
        const hasCardsOnTable = tableCards.length > 0;
        const hasUncoveredCards = tableCards.some(pair => !pair.defense);

        if (isPlayerTurn) {
            if (statusText) statusText.innerText = "Ваш ход: выберите карту для атаки";
            takeBtn.disabled = true; // Атакующий не может брать карты
            finishBtn.disabled = !hasCardsOnTable || hasUncoveredCards; // Отбой активен, когда всё побито
        } else {
            if (statusText) statusText.innerText = "ИИ атакует: покройте карту или нажмите «Взять»";
            finishBtn.disabled = true; // Защищающийся не может объявить отбой
            takeBtn.disabled = !hasUncoveredCards; // Взять активно, если есть что брать
        }
    }
}

// Ход игрока
function playerTurn(cardIndex) {
    if (!isPlayerTurn) {
        playerDefenseTurn(cardIndex);
        return;
    }
    let selectedCard = playerHand[cardIndex];
    if (tableCards.length > 0) {
        let ranksOnTable = [];
        tableCards.forEach(p => {
            ranksOnTable.push(p.attack.rank);
            if(p.defense) ranksOnTable.push(p.defense.rank);
        });
        if (!ranksOnTable.includes(selectedCard.rank)) {
            // ЗАМЕНЕНО ТУТ:
            showToast('Подкидывать можно только карты тех достоинств, которые уже есть на столе!');
            return;
        }
    }
    playerHand.splice(cardIndex, 1);
    tableCards.push({ attack: selectedCard, defense: null });
    renderGameTable();
    setTimeout(aiDefenseTurn, 800);
}

// Ход защиты ИИ
function aiDefenseTurn() {
    let currentPair = tableCards[tableCards.length - 1];
    if (!currentPair || currentPair.defense) return;
    let attackCard = currentPair.attack;
    let bestCardIdx = -1;

    for (let i = 0; i < aiHand.length; i++) {
        let c = aiHand[i];
        if (c.suit === attackCard.suit && RANK_VALUES[c.rank] > RANK_VALUES[attackCard.rank]) {
            if (bestCardIdx === -1 || RANK_VALUES[c.rank] < RANK_VALUES[aiHand[bestCardIdx].rank]) bestCardIdx = i;
        }
    }
    if (bestCardIdx === -1 && attackCard.suit !== trumpSuit) {
        for (let i = 0; i < aiHand.length; i++) {
            if (aiHand[i].suit === trumpSuit) {
                if (bestCardIdx === -1 || RANK_VALUES[aiHand[i].rank] < RANK_VALUES[aiHand[bestCardIdx].rank]) bestCardIdx = i;
            }
        }
    }
    if (bestCardIdx !== -1) {
        currentPair.defense = aiHand.splice(bestCardIdx, 1);
        renderGameTable();
    } else {
        // ЗАМЕНЕНО ТУТ:
        showToast('ИИ не смог отбиться и забирает карты!');
        tableCards.forEach(pair => {
            aiHand.push(pair.attack);
            if (pair.defense) aiHand.push(pair.defense);
        });
        tableCards = [];
        isPlayerTurn = true;
        endRound();
    }
}


// Защита игрока (когда ходит ИИ)
function playerDefenseTurn(cardIndex) {
    let currentPair = tableCards[tableCards.length - 1];
    if (!currentPair || currentPair.defense) return; 
    let defenseCard = playerHand[cardIndex];
    let attackCard = currentPair.attack;

    let canBeat = false;
    if (defenseCard.suit === attackCard.suit && RANK_VALUES[defenseCard.rank] > RANK_VALUES[attackCard.rank]) canBeat = true;
    else if (defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit) canBeat = true;

    if (!canBeat) { 
        // ЗАМЕНЕНО ТУТ:
        showToast('Этой картой нельзя побить карту ИИ!'); 
        return; 
    }
    playerHand.splice(cardIndex, 1);
    currentPair.defense = defenseCard;
    renderGameTable();
    setTimeout(aiAttackTurn, 800);
}


// Атака ИИ (подброс карт)
function aiAttackTurn() {
    if (aiHand.length === 0) { 
        tableCards = []; 
        isPlayerTurn = true; 
        endRound(); 
        return; 
    }
    
    if (tableCards.length === 0) {
        let card = aiHand.splice(0, 1)[0]; // Берем сам объект карты из массива splice
        tableCards.push({ attack: card, defense: null });
        renderGameTable();
        return;
    }
    
    let ranksOnTable = [];
    tableCards.forEach(p => { 
        ranksOnTable.push(p.attack.rank); 
        if(p.defense) ranksOnTable.push(p.defense.rank); 
    });
    
    let foundIdx = aiHand.findIndex(c => ranksOnTable.includes(c.rank));

    if (foundIdx !== -1 && tableCards.length < 6) {
        let card = aiHand.splice(foundIdx, 1)[0]; // Берем объект карты
        tableCards.push({ attack: card, defense: null });
        renderGameTable();
    } else {
        // === ЗАМЕНЕНО ТУТ: Убрали последний alert у бота, поставили тост ===
        showToast('ИИ пасует. Бито!');
        // =================================================================
        
        tableCards = [];
        isPlayerTurn = true; // Ход переходит к вам
        endRound();
    }
}


// Действие кнопки "Отбой"
function finishRoundAction() {
    if (tableCards.length === 0 || !isPlayerTurn) return;
    let allDefended = tableCards.every(pair => pair.defense !== null);
    if (!allDefended) { 
        // ЗАМЕНЕНО ТУТ:
        showToast('Нельзя объявить отбой, пока ИИ не ответил на ход!'); 
        return; 
    }
    tableCards = [];
    isPlayerTurn = false;
    endRound();
    setTimeout(aiAttackTurn, 600);
}


// Действие кнопки "Взять"
function takeCardsAction() {
    // Если на столе пусто или сейчас ход игрока — защищающийся игрок не может взять карты
    if (tableCards.length === 0 || isPlayerTurn) return;
    
    tableCards.forEach(pair => {
        playerHand.push(pair.attack);
        if (pair.defense) playerHand.push(pair.defense);
    });
    tableCards = [];
    isPlayerTurn = false; // Ход остается у ИИ, так как игрок взял карты
    endRound();
    
    // Вызываем атаку ИИ с задержкой
    if (typeof aiAttackTurn === 'function') {
        setTimeout(aiAttackTurn, 600);
    }
}

// Конец раунда (С ДОБОРОМ И АВТОМАТИЧЕСКОЙ СОРТИРОВКОЙ КАРТ)
function endRound() {
    // 1. Сначала добираем карты из колоды до 6 штук
    while (playerHand.length < 6 && deck.length > 0) playerHand.push(deck.shift());
    while (aiHand.length < 6 && deck.length > 0) aiHand.push(deck.shift());

    // 2. ВЫДЕЛЕННЫЙ БЛОК: СОРТИРОВКА КАРТ В РУКЕ ИГРОКА
    playerHand.sort((cardA, cardB) => {
        // Проверяем, является ли масть козырной
        const isTrumpA = cardA.suit === trumpSuit;
        const isTrumpB = cardB.suit === trumpSuit;

        // ПРАВИЛО 1: Козыри всегда сдвигаем в самый правый край руки
        if (isTrumpA && !isTrumpB) return 1;
        if (!isTrumpA && isTrumpB) return -1;

        // ПРАВИЛО 2: Если обе карты козыри или обе НЕ козыри, сортируем по мастям
        if (cardA.suit !== cardB.suit) {
            // Сравниваем строки мастей по алфавиту
            return cardA.suit.localeCompare(cardB.suit);
        }

        // ПРАВИЛО 3: Если масти одинаковые, сортируем по силе от меньшей к большей
        return RANK_VALUES[cardA.rank] - RANK_VALUES[cardB.rank];
    });

    // 3. Отрисовываем стол с уже отсортированными картами
    renderGameTable();

    // 4. Проверяем условия завершения игры
    if (playerHand.length === 0 && aiHand.length === 0) showGameResult('НИЧЬЯ!');
    else if (playerHand.length === 0) showGameResult('ВЫ ПОБЕДИЛИ!');
    else if (aiHand.length === 0) showGameResult('ИИ ПОБЕДИЛ! ВЫ ДУРАК!');
}


// Показ экрана результатов (Срабатывает и при нажатии "Сдаться")
function showGameResult(text) {
    stopTurnTimer(); // Останавливаем таймер
    
    const textElement = document.getElementById('game-results-text');
    if (textElement) {
        textElement.innerText = text;
        
        // Сбрасываем старые классы окраски
        textElement.classList.remove('win', 'lose', 'draw');
        
        // Проверяем, какой текст пришёл, и красим в нужный цвет
        if (text.includes('ПОБЕДИЛИ')) {
            textElement.classList.add('win'); // Текст станет БОЛЬШИМ и ЗЕЛЕНЫМ
        } else if (text.includes('ПРОИГРАЛИ') || text.includes('СДАЛИСЬ') || text.includes('ДУРАК')) {
            textElement.classList.add('lose'); // Текст станет БОЛЬШИМ и КРАСНЫМ
        } else {
            textElement.classList.add('draw'); // Ничья станет золотой
        }
    }
    
    changeScreen('screen-match-results'); 
}

// ========================================================
// --- УПРАВЛЕНИЕ АККАУНТОМ И ПРОФИЛЕМ ---
// ========================================================
function enterAsGuest() { 
    currentUser = null; 
    updateProfileUI(); 
    changeScreen('screen-main-menu'); 
}

function handleRegister(event) {
    event.preventDefault();
    const login = document.getElementById('reg-login').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const db = getDB();
    if (db[login]) { alert('Этот логин уже занят!'); return; }
    db[login] = { password: pass, nickname: login, avatar: '👤' };
    saveDB(db);
    alert('Регистрация успешна!');
    changeScreen('screen-auth');
}

function handleAuth(event) {
    event.preventDefault();
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const db = getDB();
    if (db[login] && db[login].password === pass) {
        currentUser = login;
        updateProfileUI();
        changeScreen('screen-main-menu');
    } else { 
        alert('Неверный логин или пароль!'); 
    }
}

function updateProfileUI() {
    const nickDisplay = document.getElementById('nickname-display');
    const avatarDisplay = document.getElementById('avatar-display');
    
    if (!nickDisplay || !avatarDisplay) return; // Защита от ошибок, если элементы не загрузились

    if (!currentUser) {
        nickDisplay.innerHTML = 'Игрок: <strong>Гость</strong>';
        avatarDisplay.innerText = '👤';
        return;
    }
    const db = getDB();
    nickDisplay.innerHTML = 'Игрок: <strong>' + db[currentUser].nickname + '</strong>';
    avatarDisplay.innerText = db[currentUser].avatar;
}

function manageNickname() {
    if (!currentUser) { alert('Войдите через аккаунт!'); return; }
    const n = prompt('Новый ник:');
    if (n && n.trim() !== "") { 
        const db = getDB(); 
        db[currentUser].nickname = n.trim(); 
        saveDB(db); 
        updateProfileUI(); 
    }
}

function changeAvatar(e) { 
    if (!currentUser) return; 
    const db = getDB(); 
    db[currentUser].avatar = e; 
    saveDB(db); 
    updateProfileUI(); 
}

function deleteAvatar() { 
    changeAvatar('👤'); // Исправлено: теперь сбрасывает на базовый силуэт
}

function logout() { 
    currentUser = null; 
    updateProfileUI(); 
    changeScreen('screen-login'); 
}

// ПЕРВЫЙ ЗАПУСК СИТА
document.addEventListener('DOMContentLoaded', function() {
    changeScreen('screen-login');
});

let timerInterval = null;
let defaultTime = 600; // <--- Фиксируем 600 секунд на ход в специальной переменной
let timeLeft = defaultTime;

function startTurnTimer() {
    // Сбрасываем старый таймер, если он запущен
    clearInterval(timerInterval); 
    timeLeft = defaultTime; // Теперь эта переменная существует и ошибки не будет!
    
    const timerDisplay = document.getElementById('game-timer');
    if (timerDisplay) timerDisplay.innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            // === ЗАМЕНЕНО ТУТ: Убрали старый alert, поставили красивый тост ===
            showToast('Время вышло! Вы не успели сделать ход.');
            // =================================================================
            
            showGameResult('ВРЕМЯ ИСТЕКЛО! ВЫ ДУРАК!');
        }
    }, 1000);
}


function stopTurnTimer() {
    clearInterval(timerInterval);
}

// Функция показа красивого тоста под картами (вместо alert)
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Создаем элемент уведомления
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    // Добавляем на страницу
    container.appendChild(toast);

    // Через 3 секунды плавно скрываем и полностью удаляем из кода
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
