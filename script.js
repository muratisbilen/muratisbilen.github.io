document.addEventListener("DOMContentLoaded", () => {
    // --- HTML Element Selectors ---
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const leaderboardContainer = document.getElementById("leaderboard-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");
    const gameBoard = document.getElementById("game-board");
    const keyboardContainer = document.getElementById("keyboard-cont");

    const leaderboardBtnLogin = document.getElementById("view-leaderboard-from-login");
    const leaderboardBtnGame = document.getElementById("view-leaderboard-from-game");
    const backToLoginBtn = document.getElementById("back-to-login");
    const backToGameBtn = document.getElementById("back-to-game");

    // --- Game State Variables ---
    let username = "";
    let startTime;
    let dictionary = [];
    let solution = "";
    let keyStatus = {};
    let currentRow = 0;
    let currentCol = 0;
    let isGameOver = false;

    // --- Core Functions ---

    async function loadWords() {
        try {
            const response = await fetch('words.txt');
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();
            dictionary = text.split('\n').map(word => word.trim().toLocaleLowerCase('tr-TR')).filter(word => word.length === 5);
            if (dictionary.length === 0) {
                alert("Could not load word list.");
                return;
            }
        } catch (error) {
            console.error('Failed to load word list:', error);
            alert("Failed to load the word list. The game cannot start.");
        }
    }

    loginButton.addEventListener("click", () => {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            username = enteredUsername;
            localStorage.setItem("wordle_username", username);
            checkIfPlayedToday();
        }
    });

    async function checkIfPlayedToday() {
        const today = new Date().toISOString().split('T')[0];
        const lastPlayDate = localStorage.getItem(`wordle_last_play_${username}`);
        if (lastPlayDate === today) {
            alert("You have already completed the game today. Come back tomorrow!");
        } else {
            loginContainer.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            await startGame();
        }
    }

    for (let i = 0; i < 6; i++) {
        const row = document.createElement("div");
        row.className = "letter-row";
        for (let j = 0; j < 5; j++) {
            const box = document.createElement("div");
            box.className = "letter-box";
            row.appendChild(box);
        }
        gameBoard.appendChild(row);
    }

    async function saveGameState() {
        if (!username || isGameOver) return;
        const boardState = Array.from(gameBoard.children).map(row => Array.from(row.children).map(box => box.textContent || " ").join(""));
        const gameState = {
            solution: solution,
            board: boardState,
            currentRow: currentRow,
            currentCol: currentCol,
            startTime: startTime.toISOString(),
            keyStatus: keyStatus,
            isGameOver: isGameOver,
            lastUpdate: new Date().toISOString()
        };
        await db.collection("gameStates").doc(username).set(gameState);
    }

    async function restoreGameState() {
        if (!username) return false;
        const gameStateDoc = await db.collection("gameStates").doc(username).get();
        if (!gameStateDoc.exists) return false;

        const savedState = gameStateDoc.data();
        solution = savedState.solution;
        currentRow = savedState.currentRow;
        currentCol = savedState.currentCol;
        startTime = new Date(savedState.startTime);
        keyStatus = savedState.keyStatus || {};
        isGameOver = savedState.isGameOver;

        for (let i = 0; i < savedState.board.length; i++) {
            const row = gameBoard.children[i];
            const rowContent = savedState.board[i];
            for (let j = 0; j < rowContent.length; j++) {
                row.children[j].textContent = rowContent[j] === " " ? "" : rowContent[j];
            }
        }
        for (let i = 0; i < currentRow; i++) {
            const guess = savedState.board[i].trim().toLocaleLowerCase('tr-TR');
            if (guess.length === 5) applyRowColors(i, guess);
        }
        updateKeyboardDisplay();
        return true;
    }

    function handleKeyPress(key) {
        if (isGameOver || currentCol >= 5) return;
        gameBoard.children[currentRow].children[currentCol].textContent = key;
        currentCol++;
        saveGameState();
    }

    function handleDelete() {
        if (isGameOver || currentCol === 0) return;
        currentCol--;
        gameBoard.children[currentRow].children[currentCol].textContent = "";
        saveGameState();
    }

    function handleEnter() {
        if (isGameOver || currentCol !== 5) return;
        const guess = getCurrentGuess();
        if (dictionary.includes(guess)) {
            checkGuess(guess);
            if (!isGameOver) {
                currentRow++;
                currentCol = 0;
                saveGameState();
            }
        } else {
            alert("Kelime sözlükte yok!");
        }
    }

    function getCurrentGuess() {
        return Array.from(gameBoard.children[currentRow].children).map(box => box.textContent).join("").toLocaleLowerCase('tr-TR');
    }

    function applyRowColors(rowIndex, guess) {
        const row = gameBoard.children[rowIndex];
        const solutionLetters = solution.split('');
        const guessLetters = guess.split('');
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === solutionLetters[i]) {
                row.children[i].classList.add("green");
                updateKeyStatus(guessLetters[i], "green");
                solutionLetters[i] = null;
                guessLetters[i] = null;
            }
        }
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] !== null) {
                const letterIndex = solutionLetters.indexOf(guessLetters[i]);
                if (letterIndex > -1) {
                    row.children[i].classList.add("yellow");
                    updateKeyStatus(guessLetters[i], "yellow");
                    solutionLetters[letterIndex] = null;
                } else {
                    row.children[i].classList.add("gray");
                    updateKeyStatus(guessLetters[i], "gray");
                }
            }
        }
    }

    function checkGuess(guess) {
        applyRowColors(currentRow, guess);
        updateKeyboardDisplay();
        const timeTaken = (new Date() - startTime) / 1000;
        const steps = currentRow + 1;
        if (guess === solution || currentRow === 5) {
            isGameOver = true;
            let score = 0;
            if (guess === solution) {
                const raw = 1 / (timeTaken * Math.pow(steps, 3));
                score = Math.round(1000 * Math.log10(1 + raw * 1e6));
                setTimeout(() => alert(`Kazandınız! Puanınız: ${score.toFixed(5)}`), 100);
            } else {
                setTimeout(() => alert(`Kaybettiniz! Doğru kelime: ${solution}`), 100);
            }
            saveScore(score, timeTaken, guess === solution ? steps : 6);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
            db.collection("gameStates").doc(username).delete();
        }
    }

    function updateKeyStatus(letter, status) {
        const currentStatus = keyStatus[letter];
        if (currentStatus !== 'green' && (currentStatus !== 'yellow' || status === 'green')) {
            keyStatus[letter] = status;
        }
    }

    function updateKeyboardDisplay() {
        for (const letter in keyStatus) {
            const keyButton = document.querySelector(`[data-key='${letter}']`);
            if (keyButton) {
                keyButton.className = 'key-button'; // Reset classes
                keyButton.classList.add(keyStatus[letter]);
            }
        }
    }

    function saveScore(score, time, steps) {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().slice(0, 7);
        db.collection("dailyScores").add({ username, score, date: today, time, steps });
        const userMonthlyDocRef = db.collection("monthlyScores").doc(`${username}_${month}`);
        db.runTransaction(transaction => transaction.get(userMonthlyDocRef).then(doc => {
            if (!doc.exists) {
                transaction.set(userMonthlyDocRef, { username, month, totalScore: score, playCount: 1, totalTime: time, totalSteps: steps });
            } else {
                const data = doc.data();
                transaction.update(userMonthlyDocRef, {
                    totalScore: data.totalScore + score,
                    playCount: data.playCount + 1,
                    totalTime: (data.totalTime || 0) + time,
                    totalSteps: (data.totalSteps || 0) + steps
                });
            }
        }));
    }

    // ⭐ FIXED: This function is now more robust and will not crash
    function displayLeaderboards() {
        const today = new Date().toISOString().split('T')[0];
        const dailyEl = document.getElementById("daily-leaderboard");
        const monthlySumEl = document.getElementById("monthly-leaderboard-sum");
        const monthlyMeanEl = document.getElementById("monthly-leaderboard-mean");

        function buildTable(headers, rows) {
            const table = document.createElement("table");
            const thead = document.createElement("thead");
            const headRow = document.createElement("tr");
            headers.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);
            const tbody = document.createElement("tbody");
            rows.forEach((r, i) => {
                const tr = document.createElement("tr");
                const rankCell = document.createElement("td");
                rankCell.textContent = i + 1;
                tr.appendChild(rankCell);
                r.forEach(cell => {
                    const td = document.createElement("td");
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        }

        if (dailyEl) {
            db.collection("dailyScores").where("date", "==", today).get().then(qs => {
                dailyEl.innerHTML = "";
                const data = qs.docs.map(doc => doc.data()).sort((a, b) => b.score - a.score);
                const rows = data.slice(0, 10).map(d => [d.username, d.score.toFixed(5), d.time.toFixed(1) + "s", d.steps]);
                dailyEl.appendChild(buildTable(["#", "Username", "Score", "Time", "Steps"], rows));
            });
        }

        const month = new Date().toISOString().slice(0, 7);
        db.collection("monthlyScores").where("month", "==", month).get().then(qs => {
            const data = qs.docs.map(doc => doc.data());
            if (monthlySumEl) {
                monthlySumEl.innerHTML = "";
                data.sort((a, b) => b.totalScore - a.totalScore);
                const sumRows = data.slice(0, 10).map(d => [d.username, d.totalScore.toFixed(5), (d.totalTime || 0).toFixed(1) + "s", d.totalSteps || 0]);
                monthlySumEl.appendChild(buildTable(["#", "Username", "Total Score", "Total Time", "Total Steps"], sumRows));
            }
            if (monthlyMeanEl) {
                monthlyMeanEl.innerHTML = "";
                data.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount));
                const meanRows = data.slice(0, 10).map(d => [d.username, (d.totalScore / d.playCount).toFixed(5), (d.totalTime / d.playCount).toFixed(1) + "s", (d.totalSteps / d.playCount).toFixed(1)]);
                monthlyMeanEl.appendChild(buildTable(["#", "Username", "Avg Score", "Avg Time", "Avg Steps"], meanRows));
            }
        });
    }

    const keyboard = [
        ["e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
        ["enter", "z", "c", "v", "b", "n", "m", "ö", "ç", "del"]
    ];
    keyboard.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";
        row.forEach(key => {
            const keyButton = document.createElement("button");
            keyButton.className = "key-button";
            keyButton.textContent = key;
            keyButton.setAttribute("data-key", key);
            keyButton.addEventListener("click", () => {
                if (key === "enter") handleEnter();
                else if (key === "del") handleDelete();
                else handleKeyPress(key);
            });
            rowDiv.appendChild(keyButton);
        });
        keyboardContainer.appendChild(rowDiv);
    });

    document.addEventListener("keydown", e => {
        if (document.activeElement === usernameInput) return;
        const key = e.key.toLocaleLowerCase('tr-TR');
        if (key === "enter") handleEnter();
        else if (key === "backspace") handleDelete();
        else if (/^[a-zçğıöşü]$/.test(key)) handleKeyPress(key);
    });

    function seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    async function startGame() {
        await loadWords();
        if (dictionary.length === 0) return;
        if (!(await restoreGameState())) {
            const epoch = new Date("2025-01-01T00:00:00Z");
            const dayIndex = Math.floor((new Date(new Date().setUTCHours(0, 0, 0, 0)) - epoch) / (1000 * 60 * 60 * 24));
            const wordIndex = Math.floor(seededRandom(dayIndex) * dictionary.length);
            solution = dictionary[wordIndex];
            startTime = new Date();
            await saveGameState();
        }
    }

    leaderboardBtnLogin.addEventListener("click", () => {
        displayLeaderboards();
        loginContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
        backToLoginBtn.style.display = "inline-block";
        backToGameBtn.style.display = "none";
    });

    leaderboardBtnGame.addEventListener("click", () => {
        displayLeaderboards();
        gameContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
        backToLoginBtn.style.display = "none";
        backToGameBtn.style.display = "inline-block";
    });

    backToLoginBtn.addEventListener("click", () => {
        leaderboardContainer.classList.add("hidden");
        loginContainer.classList.remove("hidden");
    });

    backToGameBtn.addEventListener("click", () => {
        leaderboardContainer.classList.add("hidden");
        gameContainer.classList.remove("hidden");
    });

    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});
