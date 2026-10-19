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
    
    changeScreen('screen-game-match');

    // === ВОТ СЮДА ВСТАВЛЯЙ ЭТУ СТРОКУ ===
    renderGameTable(); 
    // ===================================

    startTurnTimer();
}

// Отрисовка карт на столе — ИСПРАВЛЕННАЯ ВЕРСИЯ
function renderGameTable() {
    const field = document.getElementById('playing-field');
    if (!field) return;

    // ИСПРАВЛЕНО: Вместо полной перезаписи innerHTML, мы проверяем, создана ли колода и зона боя.
    // Если их на столе ещё нет — создаем один раз, чтобы не стирать карты при каждом вызове!
    let battleZone = document.getElementById('table-battle-zone');
    if (!battleZone) {
        field.innerHTML = `
            <div class="deck-container" style="display:flex; align-items:center; z-index: 5;">
                <div class="card-deck">${deck.length}</div>
                <div class="card trump" style="color: ${(trumpSuit==='♥'||trumpSuit==='♦')?'red':'black'}">${trumpSuit}</div>
            </div>
            <div id="table-battle-zone" style="display:flex; gap: 20px; margin-left: 30px; flex-wrap: wrap;"></div>
        `;
        battleZone = document.getElementById('table-battle-zone');
    }

    // Обновляем количество оставшихся карт в колоде динамически
    const deckCountDisplay = field.querySelector('.card-deck');
    if (deckCountDisplay) deckCountDisplay.innerText = deck.length;

    // Очищаем только зону битвы перед перерисовкой карт на столе
    battleZone.innerHTML = '';
    
    tableCards.forEach(pair => {
        let pairDiv = document.createElement('div');
        pairDiv.className = 'battle-pair';

        let attCard = document.createElement('div');
        attCard.className = 'card';
        attCard.style.color = pair.attack.color;
        
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

        if (pair.defense) {
            let defData = Array.isArray(pair.defense) ? pair.defense[0] : pair.defense;
            
            if (defData) {
                let defCard = document.createElement('div');
                defCard.className = 'card defense-card';
                defCard.style.color = defData.color;
                
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

    // Отрисовка руки игрока
    const handContainer = document.getElementById('player-hand');
    if (handContainer) {
        handContainer.innerHTML = '';
        playerHand.forEach((card, index) => {
            let cardDiv = document.createElement('div');
            cardDiv.className = 'card playable';
            cardDiv.style.color = card.color;
            
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
    }

    // === СВЯЗЫВАНИЕ КНОПОК И ОБНОВЛЕНИЕ СТАТУСА ===
    const takeBtn = document.querySelector(".action-take");
    const finishBtn = document.querySelector(".action-finish");
    // ИСПРАВЛЕНО: Более точный селектор для текста состояния игры
    const statusText = document.getElementById("game-status-text") || document.querySelector('#screen-game-match p');

    if (takeBtn && finishBtn) {
        const hasCardsOnTable = tableCards.length > 0;
        const hasUncoveredCards = tableCards.some(pair => !pair.defense);

        if (isPlayerTurn) {
            if (statusText) statusText.innerText = "Ваш ход: выберите карту для атаки";
            takeBtn.disabled = true;
            finishBtn.disabled = !hasCardsOnTable || hasUncoveredCards;
        } else {
            if (statusText) statusText.innerText = "ИИ атакует: покройте карту или нажмите «Взять»";
            finishBtn.disabled = true;
            takeBtn.disabled = !hasUncoveredCards;
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
        
        currentPair.defense = aiHand.splice(bestCardIdx, 1)[0]; 
        renderGameTable();
    } else {
        showToast('ИИ не смог отбиться и забирает карты!');
        tableCards.forEach(pair => {
            aiHand.push(pair.attack);
           
            if (pair.defense) aiHand.push(pair.defense); 
        });
        tableCards = [];
        
        
        // Чтобы раунд начался заново, просто добираем карты. Ход остается у игрока.
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
// ... (начало функции aiAttackTurn без изменений) ...
let ranksOnTable = [];
tableCards.forEach(p => {
ranksOnTable.push(p.attack.rank);
if(p.defense) ranksOnTable.push(p.defense.rank);
});
let foundIdx = aiHand.findIndex(c => ranksOnTable.includes(c.rank));
// ИСПРАВЛЕНО: Вычисляем, сколько карт игроку еще нужно отбить
let unbeatCount = tableCards.filter(p => !p.defense).length;
let maxAllowedToAttack = playerHand.length + unbeatCount;
// ИСПРАВЛЕНО: Проверяем, чтобы карт на столе не стало больше, чем у игрока в руке
if (foundIdx !== -1 && tableCards.length < 6 && tableCards.length < maxAllowedToAttack) {
let card = aiHand.splice(foundIdx, 1)[0];
tableCards.push({ attack: card, defense: null });
renderGameTable();
} else {
showToast('ИИ пасует. Бито!');
tableCards = [];
// ИСПРАВЛЕНО: ИИ успешно атаковал, но спасовал.
// Значит, раунд окончен, карты уходят в отбой, и СЛЕДУЮЩИЙ ход переходит к ИГРОКУ.
isPlayerTurn = true;
endRound();
}
}
// Действие кнопки "Отбой"
function finishRoundAction() {
if (tableCards.length === 0 || !isPlayerTurn) return;
let allDefended = tableCards.every(pair => pair.defense !== null);
if (!allDefended) {
showToast('Нельзя объявить отбой, пока ИИ не ответил на ход!');
return;
}
tableCards = [];
// ИСПРАВЛЕНО: Раунд завершен успехом для игрока. Следующим атакует ИИ.
isPlayerTurn = false;
endRound();
// Передаем управление боту для его атаки
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
if (db[login]) {
showToast('Этот логин уже занят!'); // ЗАМЕНЕНО С ALERT
return;
}
db[login] = { password: pass, nickname: login, avatar: '👤' };
saveDB(db);
showToast('Регистрация успешна! Теперь вы можете войти.'); // ЗАМЕНЕНО С ALERT
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
showToast('Неверный логин или пароль!'); // ЗАМЕНЕНО С ALERT
}
}
function updateProfileUI() {
const nickDisplay = document.getElementById('nickname-display');
const avatarDisplay = document.getElementById('avatar-display');
if (!nickDisplay || !avatarDisplay) return; // Защита от ошибок, если элементы не загрузились
if (!currentUser) {
nickDisplay.innerHTML = 'Игрок: Гость';
avatarDisplay.innerText = '👤';
return;
}
const db = getDB();
nickDisplay.innerHTML = 'Игрок: ' + db[currentUser].nickname + '';
avatarDisplay.innerText = db[currentUser].avatar;
}
function manageNickname() {
if (!currentUser) {
showToast('Войдите через аккаунт!');
return;
}
let input = document.getElementById('new-nickname-input');
if (!input) {
const nickDisplay = document.getElementById('nickname-display');
if (nickDisplay) {
input = document.createElement('input');
input.type = 'text';
input.id = 'new-nickname-input';
input.placeholder = 'Введите новый ник';
input.style.marginTop = '10px';
nickDisplay.parentNode.insertBefore(input, nickDisplay.nextSibling);
showToast('Введите новый ник в появившемся поле и нажмите кнопку еще раз');
return;
}
}
const newNick = input.value.trim();
if (newNick === "") {
showToast('Поле никнейма не может быть пустым!');
return;
}
const db = getDB();
db[currentUser].nickname = newNick;
saveDB(db);
updateProfileUI();
input.remove();
showToast('Никнейм успешно изменен на ' + newNick + '!');
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
clearInterval(timerInterval);
timeLeft = defaultTime;
const timerDisplay = document.getElementById('game-timer');
if (timerDisplay) timerDisplay.innerText = timeLeft;
timerInterval = setInterval(() => {
timeLeft--;
if (timerDisplay) timerDisplay.innerText = timeLeft;
if (timeLeft <= 0) {
clearInterval(timerInterval);
showToast('Время вышло! Вы не успели сделать ход.');
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
