document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");

    let username = "";
    let startTime;

    loginButton.addEventListener("click", () => {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            username = enteredUsername;
            localStorage.setItem("wordle_username", username);
            checkIfPlayedToday();
        }
    });

    function checkIfPlayedToday() {
        const today = new Date().toISOString().split('T')[0];
        const lastPlayDate = localStorage.getItem(`wordle_last_play_${username}`);

        if (lastPlayDate === today) {
            alert("You have already played today. Come back tomorrow!");
        } else {
            loginContainer.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            startGame();
        }
    }

    const dictionary = ["apple", "grape", "melon", "lemon", "peach"]; // A small dictionary for demonstration
    let solution = dictionary[Math.floor(Math.random() * dictionary.length)];

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

    function handleKeyPress(key) {
        if (currentCol < 5) {
            const row = gameBoard.children[currentRow];
            const box = row.children[currentCol];
            box.textContent = key;
            currentCol++;
        }
    }

    function handleEnter() {
        if (currentCol === 5) {
            const guess = getCurrentGuess();
            if (dictionary.includes(guess)) {
                checkGuess(guess);
                currentRow++;
                currentCol = 0;
            } else {
                alert("Word not in dictionary!");
            }
        }
    }

    function handleDelete() {
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
        for (let i = 0; i < 5; i++) {
            const box = row.children[i];
            const letter = guess[i];

            if (letter === solution[i]) {
                box.classList.add("green");
            } else if (solution.includes(letter)) {
                box.classList.add("yellow");
            } else {
                box.classList.add("gray");
            }
        }

        if (guess === solution) {
            const endTime = new Date();
            const timeTaken = (endTime - startTime) / 1000;
            const score = (1 / timeTaken) * (1 / Math.pow(currentRow + 1, 3));
            saveScore(score);
            alert(`You won! Your score is ${score.toFixed(5)}`);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        } else if (currentRow === 5) {
            saveScore(0);
            alert(`You lost! The word was ${solution}`);
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
            .orderBy("totalScore", "desc")
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

                // Sum
                monthlyData.forEach(data => {
                    const li = document.createElement("li");
                    li.textContent = `${data.username}: ${data.totalScore.toFixed(5)}`;
                    monthlyLeaderboardSum.appendChild(li);
                });

                // Mean
                monthlyData.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount));
                monthlyData.forEach(data => {
                    const li = document.createElement("li");
                    li.textContent = `${data.username}: ${(data.totalScore / data.playCount).toFixed(5)}`;
                    monthlyLeaderboardMean.appendChild(li);
                });
            });
    }

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

    function startGame() {
        startTime = new Date();
        displayLeaderboards();
    }

    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});