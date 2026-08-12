import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// === 1. FIREBASE KONFIGURATION (HIER DEINE DATEN EINTRAGEN!) ===
const firebaseConfig = {
    apiKey: "AIzaSyAqixXdDO8K-QDaMeCQggElzvje4ASa01s",
    authDomain: "schlitzergirlstracker.firebaseapp.com",
    projectId: "schlitzergirlstracker",
    storageBucket: "schlitzergirlstracker.firebasestorage.app",
    messagingSenderId: "238574044208",
    appId: "1:238574044208:web:7fc2c5456d8d7cace419f5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 2. VARIABLEN & NAVIGATION ===
const players = ["Carlo", "Jonas", "Marco"];
let currentGame = "";
let showAllHistory = false;

// DOM Elemente
const navHome = document.getElementById('nav-home');
const navStats = document.getElementById('nav-stats');
const pages = {
    home: document.getElementById('page-home'),
    game: document.getElementById('page-game'),
    stats: document.getElementById('page-stats')
};

function switchPage(pageName) {
    Object.values(pages).forEach(p => p.classList.add('hidden'));
    pages[pageName].classList.remove('hidden');
    navHome.classList.toggle('active', pageName === 'home');
    navStats.classList.toggle('active', pageName === 'stats');
    if(pageName === 'stats') loadStats();
}

navHome.addEventListener('click', () => switchPage('home'));
navStats.addEventListener('click', () => switchPage('stats'));
document.querySelector('.back-btn').addEventListener('click', () => switchPage('home'));

// === 3. SPIEL-SEITE LOGIK ===
const gameNames = { monopoly: "Monopoly", golf: "Golf with your Friends", worms: "Worms", uch: "Ultimate Chicken Horse" };

document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
        currentGame = card.getAttribute('data-game');
        document.getElementById('game-title').innerText = gameNames[currentGame];
        
        // Formular resetten & Datum auf heute setzen
        document.getElementById('entry-form').reset();
        document.getElementById('game-date').valueAsDate = new Date();
        
        // Monopoly Extras umschalten
        const monoExtras = document.getElementById('monopoly-extras');
        if(currentGame === 'monopoly') {
            monoExtras.classList.remove('hidden');
        } else {
            monoExtras.classList.add('hidden');
        }
        
        showAllHistory = false;
        loadHistory();
        switchPage('game');
    });
});

// === 4. DATEN SPEICHERN ===
document.getElementById('entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.innerText = "Speichert...";
    submitBtn.disabled = true;

    try {
        const gameData = {
            game: currentGame,
            date: document.getElementById('game-date').value,
            createdAt: serverTimestamp(),
            placements: {
                Carlo: parseInt(document.getElementById('place-carlo').value),
                Jonas: parseInt(document.getElementById('place-jonas').value),
                Marco: parseInt(document.getElementById('place-marco').value)
            }
        };

        if(currentGame === 'monopoly') {
            gameData.aborted = document.getElementById('game-aborted').checked;
            gameData.turnOrder = {
                Carlo: parseInt(document.getElementById('turn-carlo').value) || null,
                Jonas: parseInt(document.getElementById('turn-jonas').value) || null,
                Marco: parseInt(document.getElementById('turn-marco').value) || null
            };
        }

        await addDoc(collection(db, "games"), gameData);
        alert("Eintrag erfolgreich gespeichert!");
        document.getElementById('entry-form').reset();
        document.getElementById('game-date').valueAsDate = new Date();
        loadHistory(); // Historie sofort aktualisieren
    } catch (error) {
        console.error("Fehler beim Speichern: ", error);
        alert("Fehler beim Speichern. Siehe Konsole.");
    } finally {
        submitBtn.innerText = "Speichern";
        submitBtn.disabled = false;
    }
});

// === 5. HISTORIE LADEN ===
document.getElementById('load-all-btn').addEventListener('click', () => {
    showAllHistory = true;
    loadHistory();
});

async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = "<li>Lade Daten...</li>";
    
    // Sortiert nach Datum absteigend
    let q = query(collection(db, "games"), orderBy("date", "desc"));
    
    const querySnapshot = await getDocs(q);
    const allGames = [];
    querySnapshot.forEach(doc => allGames.push(doc.data()));
    
    // Filtern für das aktuelle Spiel
    const filteredGames = allGames.filter(g => g.game === currentGame);
    const displayGames = showAllHistory ? filteredGames : filteredGames.slice(0, 10);
    
    historyList.innerHTML = "";
    if(displayGames.length === 0) {
        historyList.innerHTML = "<li>Bisher keine Einträge.</li>";
        return;
    }

    displayGames.forEach(game => {
        const li = document.createElement('li');
        
        // Gewinner ermitteln (wer hat Platz 1)
        let winners = Object.keys(game.placements).filter(p => game.placements[p] === 1);
        let winnerText = game.aborted ? "<span class='red-text'>ABGEBROCHEN</span>" : `🏆 ${winners.join(", ")}`;

        // Datum formatieren
        const dateStr = new Date(game.date).toLocaleDateString('de-DE');

        li.innerHTML = `
            <div class="history-info">
                <strong>${dateStr}</strong>
                ${game.aborted ? "" : `<br>2. Platz: ${Object.keys(game.placements).find(p => game.placements[p] === 2) || "?"}`}
            </div>
            <div class="history-winners">${winnerText}</div>
        `;
        historyList.appendChild(li);
    });

    document.getElementById('load-all-btn').style.display = (showAllHistory || filteredGames.length <= 10) ? 'none' : 'block';
}

// === 6. STATISTIKEN / LEADERBOARD ===
let statsData = [];
let sortCol = 'total';
let sortDesc = true;

async function loadStats() {
    document.getElementById('stats-body').innerHTML = "<tr><td colspan='6'>Berechne Daten...</td></tr>";
    const querySnapshot = await getDocs(collection(db, "games"));
    
    // Grundgerüst für die Stats
    const stats = {
        Carlo: { name: 'Carlo', total: 0, monopoly: 0, golf: 0, worms: 0, uch: 0 },
        Jonas: { name: 'Jonas', total: 0, monopoly: 0, golf: 0, worms: 0, uch: 0 },
        Marco: { name: 'Marco', total: 0, monopoly: 0, golf: 0, worms: 0, uch: 0 }
    };

    // Wins zählen (Platz 1 && nicht abgebrochen)
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if(data.game === 'monopoly' && data.aborted) return; // Abgebrochene Spiele zählen nicht
        
        players.forEach(p => {
            if(data.placements && data.placements[p] === 1) {
                stats[p][data.game]++;
                stats[p].total++;
            }
        });
    });

    statsData = Object.values(stats);
    renderStatsTable();
}

// Tabellen-Sortierung
document.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
        const clickedCol = th.getAttribute('data-sort');
        if(sortCol === clickedCol) {
            sortDesc = !sortDesc; // Richtung umkehren
        } else {
            sortCol = clickedCol;
            sortDesc = true;
        }
        renderStatsTable();
    });
});

function renderStatsTable() {
    // Array sortieren
    statsData.sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];
        if (typeof valA === 'string') {
            return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return sortDesc ? valB - valA : valA - valB;
    });

    const tbody = document.getElementById('stats-body');
    tbody.innerHTML = "";
    statsData.forEach(player => {
        tbody.innerHTML += `
            <tr>
                <td>${player.name}</td>
                <td><strong>${player.total}</strong></td>
                <td>${player.monopoly}</td>
                <td>${player.golf}</td>
                <td>${player.worms}</td>
                <td>${player.uch}</td>
            </tr>
        `;
    });
}