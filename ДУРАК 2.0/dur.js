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

    renderGameTable();
    changeScreen('screen-game-match');
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
        let pairDiv = document.createElement('div');
        pairDiv.style.position = 'relative';
        pairDiv.style.width = '75px';
        pairDiv.style.height = '120px';

        let attCard = document.createElement('div');
        attCard.className = 'card';
        attCard.style.color = pair.attack.color;
        attCard.innerText = pair.attack.rank + pair.attack.suit;
        pairDiv.appendChild(attCard);

        if (pair.defense) {
            let defCard = document.createElement('div');
            defCard.className = 'card';
            defCard.style.color = pair.defense.color;
            defCard.style.position = 'absolute';
            defCard.style.top = '20px';
            defCard.style.left = '15px';
            defCard.style.zIndex = '2';
            defCard.innerText = pair.defense.rank + pair.defense.suit;
            pairDiv.appendChild(defCard);
        }
        battleZone.appendChild(pairDiv);
    });

    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    playerHand.forEach((card, index) => {
        let cardDiv = document.createElement('div');
        cardDiv.className = 'card playable';
        cardDiv.style.color = card.color;
        cardDiv.innerText = card.rank + card.suit;
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
    // Если сейчас ход бота, клик по карте означает попытку защититься
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
            alert('Подкидывать можно только карты тех достоинств, которые уже есть на столе!');
            return;
        }
    }

    playerHand.splice(cardIndex, 1);
    tableCards.push({ attack: selectedCard, defense: null });
    renderGameTable();

    // Бот думает и защищается через 0.8 сек
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
            if (bestCardIdx === -1 || RANK_VALUES[c.rank] < RANK_VALUES[aiHand[bestCardIdx].rank]) {
                bestCardIdx = i;
            }
        }
    }

    if (bestCardIdx === -1 && attackCard.suit !== trumpSuit) {
        for (let i = 0; i < aiHand.length; i++) {
            if (aiHand[i].suit === trumpSuit) {
                if (bestCardIdx === -1 || RANK_VALUES[aiHand[i].rank] < RANK_VALUES[aiHand[bestCardIdx].rank]) {
                    bestCardIdx = i;
                }
            }
        }
    }

    if (bestCardIdx !== -1) {
        // Исправлено: извлекаем объект карты из массива, который вернул splice
        currentPair.defense = aiHand.splice(bestCardIdx, 1)[0]; 
        renderGameTable();
    } else {
        alert('ИИ не смог отбиться и забирает карты!');
        tableCards.forEach(pair => {
            aiHand.push(pair.attack);
            if (pair.defense) aiHand.push(pair.defense);
        });
        tableCards = [];
        isPlayerTurn = true; // Ход остаётся у игрока
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
    if (defenseCard.suit === attackCard.suit && RANK_VALUES[defenseCard.rank] > RANK_VALUES[attackCard.rank]) {
        canBeat = true;
    } else if (defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit) {
        canBeat = true;
    }

    if (!canBeat) {
        alert('Этой картой нельзя побить карту ИИ!');
        return;
    }

    playerHand.splice(cardIndex, 1);
    currentPair.defense = defenseCard;
    renderGameTable();

    // Даем боту подумать, подкинет ли он еще что-то
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
        let card = aiHand.splice(0, 1)[0];
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
        let card = aiHand.splice(foundIdx, 1)[0];
        tableCards.push({ attack: card, defense: null });
        renderGameTable();
    } else {
        alert('ИИ пасует. Бито!');
        tableCards = [];
        isPlayerTurn = true; // Следующий ход за игроком
        endRound();
    }
}

// Действие кнопки "Отбой"
function finishRoundAction() {
    if (tableCards.length === 0 || !isPlayerTurn) return;
    let allDefended = tableCards.every(pair => pair.defense !== null);
    if (!allDefended) {
        alert('Нельзя объявить отбой, пока ИИ не ответил на ход!');
        return;
    }
    tableCards = [];
    isPlayerTurn = false; // Ход переходит к ИИ
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

// Завершение раунда и проверка на победу/проигрыш
function endRound() {
    while (playerHand.length < 6 && deck.length > 0) playerHand.push(deck.shift());
    while (aiHand.length < 6 && deck.length > 0) aiHand.push(deck.shift());
    
    renderGameTable();
    
    // Проверка условий конца игры (когда колода пуста)
    if (deck.length === 0) {
        if (playerHand.length === 0 && aiHand.length === 0) {
            showGameResult('НИЧЬЯ!');
        } else if (playerHand.length === 0) {
            showGameResult('ВЫ ПОБЕДИЛИ!');
        } else if (aiHand.length === 0) {
            showGameResult('ИИ ПОБЕДИЛ! ВЫ ДУРАК!');
        }
    }
}

// Показ экрана результатов (Срабатывает и при нажатии "Сдаться")
function showGameResult(text) {
    // Находим текстовое поле для вывода сообщения
    const textElement = document.getElementById('game-results-text');
    if (textElement) {
        textElement.innerText = text;
    }
    
    // СВЯЗЬ: Сначала меняем текст, а затем принудительно включаем экран результатов
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
