document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const leaderboardContainer = document.getElementById("leaderboard-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");
    const showLeaderboardButton = document.getElementById("show-leaderboard-button");
    const backButton = document.getElementById("back-button");

    let username = "";
    let startTime;
    let dictionary = [];
    let solution = "";
    let keyStatus = {};

    // Function to fetch the word list
    async function loadWords() {
        try {
            const response = await fetch('words.txt');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const text = await response.text();
            dictionary = text.split('\n').map(word => word.trim().toLocaleLowerCase('tr-TR')).filter(word => word.length === 5);
            if (dictionary.length === 0) {
                 console.error("Dictionary is empty! Check words.txt.");
                 alert("Could not load word list. Please check the console for errors.");
                 return;
            }
            console.log("Word list loaded successfully.");
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

    showLeaderboardButton.addEventListener("click", () => {
        loginContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
        displayLeaderboards();
    });

    backButton.addEventListener("click", () => {
        leaderboardContainer.classList.add("hidden");
        loginContainer.classList.remove("hidden");
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

    const gameBoard = document.getElementById("game-board");
    for (let i = 0; i < 6; i++) {
        let row = document.createElement("div");
        row.className = "letter-row";
        for (let j = 0; j < 5; j++) {
            let box = document.createElement("div");
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
    
    function showLeaderboardAfterGame() {
        gameContainer.classList.add("hidden");
        leaderboardContainer.classList.remove("hidden");
    }

    function checkGuess(guess) {
        const row = gameBoard.children[currentRow];
        const solutionLetters = solution.split('');
        const guessLetters = guess.split('');

        // Rule 1: Correct letters in correct position (Green)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === solutionLetters[i]) {
                row.children[i].classList.add("green");
                updateKeyStatus(guessLetters[i], "green");
                solutionLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        // Rule 2 & 3: Correct letters in wrong position (Yellow) / Incorrect (Gray)
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
            const score = (1 / timeTaken) * (1 / Math.pow(steps, 3));
            saveScore(score, timeTaken, steps);
            setTimeout(() => {
                alert(`Kazandınız! Puanınız: ${score.toFixed(5)}`);
                showLeaderboardAfterGame();
            }, 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        } else if (currentRow === 5) {
            isGameOver = true;
            saveScore(0, timeTaken, 6); // Save with 0 score, but record time and 6 steps
            setTimeout(() => {
                alert(`Kaybettiniz! Doğru kelime: ${solution}`);
                showLeaderboardAfterGame();
            }, 100);
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
        }).then(() => {
            displayLeaderboards();
        });
    }

    function displayLeaderboards() {
        const today = new Date().toISOString().split('T')[0];
        db.collection("dailyScores").where("date", "==", today).orderBy("score", "desc").limit(10).get().then((querySnapshot) => {
            const dailyLeaderboard = document.getElementById("daily-leaderboard");
            dailyLeaderboard.innerHTML = "<li>Loading...</li>"; // Show loading state
            let dailyResults = [];
            querySnapshot.forEach((doc) => {
                dailyResults.push(doc.data());
            });
            dailyLeaderboard.innerHTML = ""; // Clear loading
            if (dailyResults.length === 0) {
                 dailyLeaderboard.innerHTML = "<li>No scores yet today.</li>";
            } else {
                dailyResults.forEach(data => {
                    const li = document.createElement("li");
                    li.textContent = `${data.username}: ${data.score.toFixed(5)} (${data.time.toFixed(1)}s, ${data.steps} adım)`;
                    dailyLeaderboard.appendChild(li);
                });
            }
        });

        const month = new Date().toISOString().slice(0, 7);
        db.collection("monthlyScores").where("month", "==", month).get().then((querySnapshot) => {
            const monthlyLeaderboardSum = document.getElementById("monthly-leaderboard-sum");
            const monthlyLeaderboardMean = document.getElementById("monthly-leaderboard-mean");
            monthlyLeaderboardSum.innerHTML = "<li>Loading...</li>";
            monthlyLeaderboardMean.innerHTML = "<li>Loading...</li>";
            
            let monthlyData = [];
            querySnapshot.forEach((doc) => { monthlyData.push(doc.data()); });

            monthlyLeaderboardSum.innerHTML = "";
            if (monthlyData.length === 0) {
                 monthlyLeaderboardSum.innerHTML = "<li>No scores yet this month.</li>";
            } else {
                monthlyData.sort((a, b) => b.totalScore - a.totalScore);
                monthlyData.slice(0, 10).forEach(data => {
                    const li = document.createElement("li");
                    li.textContent = `${data.username}: ${data.totalScore.toFixed(5)}`;
                    monthlyLeaderboardSum.appendChild(li);
                });
            }

            monthlyLeaderboardMean.innerHTML = "";
             if (monthlyData.length === 0) {
                 monthlyLeaderboardMean.innerHTML = "<li>No scores yet this month.</li>";
            } else {
                monthlyData.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount));
                monthlyData.slice(0, 10).forEach(data => {
                    const li = document.createElement("li");
                    const avgScore = (data.playCount > 0) ? (data.totalScore / data.playCount) : 0;
                    li.textContent = `${data.username}: ${avgScore.toFixed(5)}`;
                    monthlyLeaderboardMean.appendChild(li);
                });
            }
        });
    }

    const keyboard = [
        ["e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
        ["enter", "z", "c", "v", "b", "n", "m", "ö", "ç", "del"]
    ];

    const keyboardContainer = document.getElementById("keyboard-cont");
    keyboard.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";
        row.forEach(key => {
            const keyButton = document.createElement("button");
            keyButton.className = "key-button";
            keyButton.textContent = key;
            keyButton.setAttribute('data-key', key);
            keyButton.addEventListener("click", () => {
                if (key === "enter") { handleEnter(); } 
                else if (key === "del") { handleDelete(); } 
                else { handleKeyPress(key); }
            });
            rowDiv.appendChild(keyButton);
        });
        keyboardContainer.appendChild(rowDiv);
    });

    document.addEventListener("keydown", (event) => {
        if (document.activeElement === usernameInput) return;
        const key = event.key.toLocaleLowerCase('tr-TR');
        if (key === "enter") { handleEnter(); } 
        else if (key === "backspace") { handleDelete(); } 
        else if (/^[a-zçğıöşü]$/.test(key)) { handleKeyPress(key); }
    });

    async function startGame() {
        await loadWords();
        if (dictionary.length > 0) {
           const epoch = new Date("2025-01-01T00:00:00Z");
           const now = new Date();
           const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
           const dayIndex = Math.floor((startOfTodayUTC - epoch) / (1000 * 60 * 60 * 24));
           const wordIndex = dayIndex % dictionary.length;
           solution = dictionary[wordIndex];

           console.log(`Today's word (for testing): ${solution}`);
           startTime = new Date();
        }
    }

    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});
