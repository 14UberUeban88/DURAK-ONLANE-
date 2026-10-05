// --- БАЗА ДАННЫХ (LOCALSTORAGE) ---
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
}

// Ход игрока
function playerTurn(cardIndex) {
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

    // Бот (ИИ) думает и делает ответный ход защиты через 0.8 секунд
    setTimeout(aiDefenseTurn, 800);
}

// ХОД ИСКУССТВЕННОГО ИНТЕЛЛЕКТА БОТА
function aiDefenseTurn() {
    let currentPair = tableCards[tableCards.length - 1];
    if (!currentPair || currentPair.defense) return;

    let attackCard = currentPair.attack;
    let bestCardIdx = -1;

    // Бот ищет самую слабую карту той же масти, чтобы побить
    for (let i = 0; i < aiHand.length; i++) {
        let c = aiHand[i];
        if (c.suit === attackCard.suit && RANK_VALUES[c.rank] > RANK_VALUES[attackCard.rank]) {
            if (bestCardIdx === -1 || RANK_VALUES[c.rank] < RANK_VALUES[aiHand[bestCardIdx].rank]) {
                bestCardIdx = i;
            }
        }
    }

    // Если не нашел по масти, ищет минимальный козырь
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
        currentPair.defense = aiHand.splice(bestCardIdx, 1);
        renderGameTable();
    } else {
        alert('ИИ не смог отбиться и забирает карты!');
        tableCards.forEach(pair => {
            aiHand.push(pair.attack);
            if (pair.defense) aiHand.push(pair.defense);
        });
        tableCards = [];
        endRound();
    }
}

function finishRoundAction() {
    if (tableCards.length === 0) return;
    let allDefended = tableCards.every(pair => pair.defense !== null);
    if (!allDefended) {
        alert('Нельзя объявить отбой, пока ИИ не ответил на ход!');
        return;
    }
    tableCards = [];
    endRound();
}

function takeCardsAction() {
    if (tableCards.length === 0) return;
    tableCards.forEach(pair => {
        playerHand.push(pair.attack);
        if (pair.defense) playerHand.push(pair.defense);
    });
    tableCards = [];
    endRound();
}

function endRound() {
    while (playerHand.length < 6 && deck.length > 0) playerHand.push(deck.shift());
    while (aiHand.length < 6 && deck.length > 0) aiHand.push(deck.shift());
    renderGameTable();

    if (playerHand.length === 0 && aiHand.length === 0) showGameResult('НИЧЬЯ!');
    else if (playerHand.length === 0) showGameResult('ВЫ ПОБЕДИЛИ!');
    else if (aiHand.length === 0) showGameResult('ИИ ПОБЕДИЛ! ВЫ ДУРАК!');
}

function showGameResult(text) {
    changeScreen('screen-match-results');
    document.getElementById('game-results-text').innerText = text;
}

// УПРАВЛЕНИЕ АККАУНТОМ И ПРОФИЛЕМ
function enterAsGuest() { currentUser = null; updateProfileUI(); changeScreen('screen-main-menu'); }

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
    } else { alert('Неверный логин или пароль!'); }
}

function updateProfileUI() {
    if (!currentUser) {
        document.getElementById('nickname-display').innerHTML = 'Игрок: <strong>Гость</strong>';
        document.getElementById('avatar-display').innerText = '👤';
        return;
    }
    const db = getDB();
    document.getElementById('nickname-display').innerHTML = 'Игрок: <strong>' + db[currentUser].nickname + '</strong>';
    document.getElementById('avatar-display').innerText = db[currentUser].avatar;
}

function manageNickname() {
    if (!currentUser) { alert('Войдите через аккаунт!'); return; }
    const n = prompt('Новый ник:');
    if (n && n.trim() !== "") { const db = getDB(); db[currentUser].nickname = n.trim(); saveDB(db); updateProfileUI(); }
}

function changeAvatar(e) { if (!currentUser) return; const db = getDB(); db[currentUser].avatar = e; saveDB(db); updateProfileUI(); }
function deleteAvatar() { changeAvatar('👤'); }
function logout() { currentUser = null; updateProfileUI(); changeScreen('screen-login'); }

// ПЕРВЫЙ ЗАПУСК
document.addEventListener('DOMContentLoaded', function() { 
    changeScreen('screen-login'); 
});
