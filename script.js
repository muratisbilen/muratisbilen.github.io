document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");

    let username = "";
    let startTime;
    let dictionary = [];
    let solution = "";

    // Function to fetch the word list
    async function loadWords() {
        try {
            const response = await fetch('words.txt');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const text = await response.text();
            // Split by newline and filter out any empty lines
            dictionary = text.split('\n').map(word => word.trim().toLowerCase()).filter(word => word.length === 5);
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

    async function checkIfPlayedToday() {
        const today = new Date().toISOString().split('T')[0];
        const lastPlayDate = localStorage.getItem(`wordle_last_play_${username}`);

        if (lastPlayDate === today) {
            alert("You have already played today. Come back tomorrow!");
        } else {
            loginContainer.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            await startGame(); // Make this async to wait for words
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
        if (isGameOver) return; // Stop input if game is over
        if (currentCol < 5) {
            const row = gameBoard.children[currentRow];
            const box = row.children[currentCol];
            box.textContent = key;
            currentCol++;
        }
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
                alert("Word not in our dictionary!");
            }
        }
    }

    function handleDelete() {
        if (isGameOver) return;
        if (currentCol > 0) {
            currentCol--;
            const row = gameBoard.children[currentRow];
            const box = row.children[currentCol];
            box.textContent = "";
        }
    }

    function getCurrentGuess() {
        const row = gameBoard.children[currentRow];
        let guess = "";
        for (let i = 0; i < 5; i++) {
            guess += row.children[i].textContent;
        }
        return guess.toLowerCase();
    }

    function checkGuess(guess) {
        const row = gameBoard.children[currentRow];
        const solutionLetters = solution.split('');
        const guessLetters = guess.split('');

        // Rule 1: Correct letters in correct position (Green)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === solutionLetters[i]) {
                row.children[i].classList.add("green");
                solutionLetters[i] = null; // Mark as used
                guessLetters[i] = null; // Mark as handled
            }
        }

        // Rule 2 & 3: Correct letters in wrong position (Yellow)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] !== null) {
                const letterIndex = solutionLetters.indexOf(guessLetters[i]);
                if (letterIndex > -1) {
                    row.children[i].classList.add("yellow");
                    solutionLetters[letterIndex] = null; // Mark as used
                } else {
                    row.children[i].classList.add("gray");
                }
            }
        }

        if (guess === solution) {
            isGameOver = true;
            const endTime = new Date();
            const timeTaken = (endTime - startTime) / 1000;
            const score = (1 / timeTaken) * (1 / Math.pow(currentRow + 1, 3));
            saveScore(score);
            setTimeout(() => alert(`You won! Your score is ${score.toFixed(5)}`), 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        } else if (currentRow === 5) {
            isGameOver = true;
            saveScore(0);
            setTimeout(() => alert(`You lost! The word was: ${solution}`), 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        }
    }

    function saveScore(score) {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().slice(0, 7);

        db.collection("dailyScores").add({
            username: username,
            score: score,
            date: today
        });

        const userMonthlyDocRef = db.collection("monthlyScores").doc(`${username}_${month}`);
        db.runTransaction((transaction) => {
            return transaction.get(userMonthlyDocRef).then((doc) => {
                if (!doc.exists) {
                    transaction.set(userMonthlyDocRef, {
                        username: username,
                        month: month,
                        totalScore: score,
                        playCount: 1
                    });
                } else {
                    const newTotalScore = doc.data().totalScore + score;
                    const newPlayCount = doc.data().playCount + 1;
                    transaction.update(userMonthlyDocRef, {
                        totalScore: newTotalScore,
                        playCount: newPlayCount
                    });
                }
            });
        });
        displayLeaderboards();
    }

    function displayLeaderboards() {
        // Daily Leaderboard
        const today = new Date().toISOString().split('T')[0];
        db.collection("dailyScores")
            .where("date", "==", today)
            .orderBy("score", "desc")
            .limit(10)
            .get()
            .then((querySnapshot) => {
                const dailyLeaderboard = document.getElementById("daily-leaderboard");
                dailyLeaderboard.innerHTML = "";
                querySnapshot.forEach((doc) => {
                    const li = document.createElement("li");
                    li.textContent = `${doc.data().username}: ${doc.data().score.toFixed(5)}`;
                    dailyLeaderboard.appendChild(li);
                });
            });

        // Monthly Leaderboards
        const month = new Date().toISOString().slice(0, 7);
        db.collection("monthlyScores")
            .where("month", "==", month)
            .get()
            .then((querySnapshot) => {
                const monthlyLeaderboardSum = document.getElementById("monthly-leaderboard-sum");
                const monthlyLeaderboardMean = document.getElementById("monthly-leaderboard-mean");
                monthlyLeaderboardSum.innerHTML = "";
                monthlyLeaderboardMean.innerHTML = "";
                let monthlyData = [];
                querySnapshot.forEach((doc) => {
                    monthlyData.push(doc.data());
                });

                // Sum (Top 10)
                monthlyData.sort((a, b) => b.totalScore - a.totalScore);
                monthlyData.slice(0, 10).forEach(data => {
                    const li = document.createElement("li");
                    li.textContent = `${data.username}: ${data.totalScore.toFixed(5)}`;
                    monthlyLeaderboardSum.appendChild(li);
                });

                // Mean (Top 10)
                monthlyData.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount));
                monthlyData.slice(0, 10).forEach(data => {
                    const li = document.createElement("li");
                    const avgScore = (data.playCount > 0) ? (data.totalScore / data.playCount) : 0;
                    li.textContent = `${data.username}: ${avgScore.toFixed(5)}`;
                    monthlyLeaderboardMean.appendChild(li);
                });
            });
    }
    
    // --- ON-SCREEN KEYBOARD SETUP ---
    const keyboard = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["enter", "z", "x", "c", "v", "b", "n", "m", "del"]
    ];

    const keyboardContainer = document.getElementById("keyboard-cont");
    keyboard.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";
        row.forEach(key => {
            const keyButton = document.createElement("button");
            keyButton.className = "key-button";
            keyButton.textContent = key;
            keyButton.addEventListener("click", () => {
                if (key === "enter") {
                    handleEnter();
                } else if (key === "del") {
                    handleDelete();
                } else {
                    handleKeyPress(key);
                }
            });
            rowDiv.appendChild(keyButton);
        });
        keyboardContainer.appendChild(rowDiv);
    });
    
    // --- NEW: PHYSICAL KEYBOARD SUPPORT ---
    document.addEventListener("keydown", (event) => {
        // Do not run the keyboard listener if the user is typing their username
        if (document.activeElement === usernameInput) return;
    
        const key = event.key.toLowerCase();
        if (key === "enter") {
            handleEnter();
        } else if (key === "backspace") {
            handleDelete();
        } else if (key >= "a" && key <= "z" && key.length === 1) {
            // Checks if the key is a single letter
            handleKeyPress(key);
        }
    });


    async function startGame() {
        await loadWords(); // Wait for the dictionary to load
        if (dictionary.length > 0) {
           solution = dictionary[Math.floor(Math.random() * dictionary.length)];
           console.log(`Today's word (for testing): ${solution}`);
           startTime = new Date();
           displayLeaderboards();
        }
    }

    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});
