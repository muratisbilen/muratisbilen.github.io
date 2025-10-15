document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const leaderboardContainer = document.getElementById("leaderboard-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");

    const leaderboardBtnLogin = document.getElementById("view-leaderboard-from-login");
    const leaderboardBtnGame = document.getElementById("view-leaderboard-from-game");
    const backToLoginBtn = document.getElementById("back-to-login");
    const backToGameBtn = document.getElementById("back-to-game");

    let username = "";
    let startTime;
    let dictionary = [];
    let solution = "";
    let keyStatus = {};

    // Load words
    async function loadWords() {
        try {
            const response = await fetch('words.txt');
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();
            dictionary = text.split('\n')
                .map(word => word.trim().toLocaleLowerCase('tr-TR'))
                .filter(word => word.length === 5);
            if (dictionary.length === 0) {
                alert("Could not load word list. Please check the console for errors.");
                return;
            }
            console.log("Word list loaded successfully.");
        } catch (error) {
            console.error('Failed to load word list:', error);
            alert("Failed to load the word list. The game cannot start.");
        }
    }

    // Login
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
            alert("You have already played today. Come back tomorrow!");
        } else {
            loginContainer.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            await startGame();
        }
    }

    // Create board
    const gameBoard = document.getElementById("game-board");
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

    let currentRow = 0;
    let currentCol = 0;
    let isGameOver = false;

    function handleKeyPress(key) {
        if (isGameOver || currentCol >= 5) return;
        const row = gameBoard.children[currentRow];
        const box = row.children[currentCol];
        box.textContent = key;
        currentCol++;
    }

    function handleEnter() {
        if (isGameOver) return;
        if (currentCol === 5) {
            const guess = getCurrentGuess();
            if (dictionary.includes(guess)) {
                checkGuess(guess);
                if (!isGameOver) {
                    currentRow++;
                    currentCol = 0;
                }
            } else {
                alert("Kelime sözlükte yok!");
            }
        }
    }

    function handleDelete() {
        if (isGameOver || currentCol === 0) return;
        currentCol--;
        const row = gameBoard.children[currentRow];
        const box = row.children[currentCol];
        box.textContent = "";
    }

    function getCurrentGuess() {
        let guess = "";
        const row = gameBoard.children[currentRow];
        for (let i = 0; i < 5; i++) {
            guess += row.children[i].textContent;
        }
        return guess.toLocaleLowerCase('tr-TR');
    }

    function checkGuess(guess) {
        const row = gameBoard.children[currentRow];
        const solutionLetters = solution.split('');
        const guessLetters = guess.split('');

        // Green
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === solutionLetters[i]) {
                row.children[i].classList.add("green");
                updateKeyStatus(guessLetters[i], "green");
                solutionLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        // Yellow / Gray
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

        updateKeyboardDisplay();

        const endTime = new Date();
        const timeTaken = (endTime - startTime) / 1000;
        const steps = currentRow + 1;

        if (guess === solution) {
            isGameOver = true;
            const raw = 1 / (timeTaken * Math.pow(steps, 3)); 
			const score = Math.round(1000 * Math.log10(1 + raw * 1e6));
            saveScore(score, timeTaken, steps);
            setTimeout(() => alert(`Kazandınız! Puanınız: ${score.toFixed(5)}`), 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        } else if (currentRow === 5) {
            isGameOver = true;
            saveScore(0, timeTaken, 6);
            setTimeout(() => alert(`Kaybettiniz! Doğru kelime: ${solution}`), 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        }
    }

    function updateKeyStatus(letter, status) {
        const currentStatus = keyStatus[letter];
        if (currentStatus === 'green') return;
        if (currentStatus === 'yellow' && status !== 'green') return;
        keyStatus[letter] = status;
    }

    function updateKeyboardDisplay() {
        for (const letter in keyStatus) {
            const keyButton = document.querySelector(`[data-key='${letter}']`);
            if (keyButton) {
                keyButton.classList.remove('green', 'yellow', 'gray');
                keyButton.classList.add(keyStatus[letter]);
            }
        }
    }

    // Save score
    function saveScore(score, time, steps) {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().slice(0, 7);
        db.collection("dailyScores").add({ username, score, date: today, time, steps });

        const userMonthlyDocRef = db.collection("monthlyScores").doc(`${username}_${month}`);
        db.runTransaction((transaction) => {
            return transaction.get(userMonthlyDocRef).then((doc) => {
                if (!doc.exists) {
                    transaction.set(userMonthlyDocRef, { username, month, totalScore: score, playCount: 1, totalTime: time, totalSteps: steps });
                } else {
                    const newTotalScore = doc.data().totalScore + score;
                    const newPlayCount = doc.data().playCount + 1;
                    const newTotalTime = (doc.data().totalTime || 0) + time;
                    const newTotalSteps = (doc.data().totalSteps || 0) + steps;
                    transaction.update(userMonthlyDocRef, { 
                        totalScore: newTotalScore, 
                        playCount: newPlayCount,
                        totalTime: newTotalTime,
                        totalSteps: newTotalSteps
                    });
                }
            });
        });
        displayLeaderboards();
    }

    // 🏆 Leaderboard (table version, client-side sorting for daily)
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

        // DAILY leaderboard (client-side sort)
        db.collection("dailyScores").where("date", "==", today).get().then((qs) => {
            dailyEl.innerHTML = "";
            const data = [];
            qs.forEach(doc => data.push(doc.data()));
            data.sort((a, b) => b.score - a.score);
            const rows = data.slice(0, 10).map(d => [
                d.username,
                d.score.toFixed(0),
                d.time.toFixed(1) + "s",
                d.steps
            ]);
            dailyEl.appendChild(buildTable(["#", "Username", "Score", "Time", "Steps"], rows));
        });

        // MONTHLY leaderboard
        const month = new Date().toISOString().slice(0, 7);
        db.collection("monthlyScores").where("month", "==", month).get().then((qs) => {
            monthlySumEl.innerHTML = "";
            monthlyMeanEl.innerHTML = "";
            const data = [];
            qs.forEach(doc => data.push(doc.data()));

            // SUM Leaderboard
            data.sort((a, b) => b.totalScore - a.totalScore);
            const sumRows = data.slice(0, 10).map(d => [
                d.username,
                d.totalScore.toFixed(5),
                (d.totalTime || 0).toFixed(1) + "s",
                d.totalSteps || 0
            ]);
            monthlySumEl.appendChild(buildTable(["#", "Username", "Total Score", "Total Time", "Total Steps"], sumRows));

            // MEAN Leaderboard
            data.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount));
            const meanRows = data.slice(0, 10).map(d => {
                const avgScore = d.totalScore / d.playCount;
                const avgTime = d.totalTime / d.playCount;
                const avgSteps = d.totalSteps / d.playCount;
                return [d.username, avgScore.toFixed(5), avgTime.toFixed(1) + "s", avgSteps.toFixed(1)];
            });
            monthlyMeanEl.appendChild(buildTable(["#", "Username", "Avg Score", "Avg Time", "Avg Steps"], meanRows));
        });
    }

    // Keyboard
    const keyboard = [
        ["e","r","t","y","u","ı","o","p","ğ","ü"],
        ["a","s","d","f","g","h","j","k","l","ş","i"],
        ["enter","z","c","v","b","n","m","ö","ç","del"]
    ];

    const keyboardContainer = document.getElementById("keyboard-cont");
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

    document.addEventListener("keydown", (event) => {
        if (document.activeElement === usernameInput) return;
        const key = event.key.toLocaleLowerCase('tr-TR');
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
        if (dictionary.length > 0) {
            const epoch = new Date("2025-01-01T00:00:00Z");
			const now = new Date();
			const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
			const dayIndex = Math.floor((startOfTodayUTC - epoch) / (1000 * 60 * 60 * 24));

			// Use seeded random to pick index
			const randomValue = seededRandom(dayIndex);
			const wordIndex = Math.floor(randomValue * dictionary.length);

			solution = dictionary[wordIndex];console.log(`Today's word: ${solution}`);
            startTime = new Date();
            displayLeaderboards();
        }
    }

    // Navigation
    leaderboardBtnLogin.addEventListener("click", () => {
        loginContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
        displayLeaderboards();
        backToLoginBtn.style.display = "inline-block";
        backToGameBtn.style.display = "none";
    });

    leaderboardBtnGame.addEventListener("click", () => {
        gameContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
        displayLeaderboards();
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

    // Restore username
    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});


