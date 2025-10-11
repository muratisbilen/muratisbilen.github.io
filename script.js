document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENT SELECTORS ---
    const loginContainer = document.getElementById("login-container");
    const gameContainer = document.getElementById("game-container");
    const usernameInput = document.getElementById("username-input");
    const loginButton = document.getElementById("login-button");
    const gameBoard = document.getElementById("game-board");
    const keyboardContainer = document.getElementById("keyboard-cont");
    
    // Leaderboard Modal Elements
    const leaderboardModal = document.getElementById("leaderboard-modal");
    const openLeaderboardBtn = document.getElementById("leaderboard-btn");
    const closeLeaderboardBtn = document.querySelector(".close-btn");
    const tabLinks = document.querySelectorAll(".tab-link");
    const tabContents = document.querySelectorAll(".tab-content");

    // --- GAME STATE VARIABLES ---
    let username = "";
    let startTime;
    let dictionary = [];
    let solution = "";
    let keyStatus = {};
    let currentRow = 0;
    let currentCol = 0;
    let isGameOver = false;

    // --- INITIAL SETUP ---

    // Fetch word list from file
    async function loadWords() {
        try {
            const response = await fetch('words.txt');
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();
            dictionary = text.split('\n').map(word => word.trim().toLocaleLowerCase('tr-TR')).filter(word => word.length === 5);
            if (dictionary.length === 0) {
                 console.error("Dictionary is empty!");
                 alert("Kelime listesi yüklenemedi.");
            }
        } catch (error) {
            console.error('Failed to load word list:', error);
            alert("Kelime listesi yüklenemedi. Oyun başlatılamıyor.");
        }
    }

    // --- EVENT LISTENERS ---

    // Login
    loginButton.addEventListener("click", () => {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            username = enteredUsername;
            localStorage.setItem("wordle_username", username);
            checkIfPlayedToday();
        }
    });

    // Leaderboard Modal Listeners
    openLeaderboardBtn.addEventListener("click", () => leaderboardModal.classList.remove("hidden"));
    closeLeaderboardBtn.addEventListener("click", () => leaderboardModal.classList.add("hidden"));
    window.addEventListener("click", (event) => {
        if (event.target == leaderboardModal) {
            leaderboardModal.classList.add("hidden");
        }
    });

    // Tab switching listener
    tabLinks.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = document.getElementById(tab.dataset.tab + '-tab');

            tabLinks.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            tab.classList.add('active');
            targetTab.classList.add('active');
        });
    });

    // --- CORE GAME LOGIC ---
    
    // Check if user has already played today
    async function checkIfPlayedToday() {
        const today = new Date().toISOString().split('T')[0];
        const lastPlayDate = localStorage.getItem(`wordle_last_play_${username}`);

        if (lastPlayDate === today) {
            alert("Bugün zaten oynadınız. Yarın tekrar gelin!");
        } else {
            loginContainer.classList.add("hidden");
            gameContainer.classList.remove("hidden");
            await startGame();
        }
    }

    // Main function to start a new game
    async function startGame() {
        isGameOver = false; // Reset game state
        await loadWords();
        if (dictionary.length > 0) {
           solution = dictionary[Math.floor(Math.random() * dictionary.length)];
           console.log(`Today's word (for testing): ${solution}`);
           startTime = new Date();
           displayLeaderboards(); // Fetch leaderboards at the start
        }
    }
    
    function handleKeyPress(key) {
        if (isGameOver || currentCol >= 5) return;
        gameBoard.children[currentRow].children[currentCol].textContent = key;
        currentCol++;
    }

    function handleEnter() {
        if (isGameOver || currentCol !== 5) return;
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

    function handleDelete() {
        if (isGameOver || currentCol === 0) return;
        currentCol--;
        gameBoard.children[currentRow].children[currentCol].textContent = "";
    }
    
    function getCurrentGuess() {
        let guess = "";
        const row = gameBoard.children[currentRow];
        for (let i = 0; i < 5; i++) {
            guess += row.children[i].textContent;
        }
        return guess.toLocaleLowerCase('tr-TR');
    }

    // Check guess and update UI
    function checkGuess(guess) {
        const row = gameBoard.children[currentRow];
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
        
        updateKeyboardDisplay();

        if (guess === solution || currentRow === 5) {
            isGameOver = true;
            const didWin = guess === solution;
            const score = didWin ? calculateScore() : 0;
            saveScore(score);
            setTimeout(() => {
                const message = didWin 
                    ? `Kazandınız! Puanınız: ${score.toFixed(5)}` 
                    : `Kaybettiniz! Doğru kelime: ${solution}`;
                alert(message);
            }, 100);
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
        }
    }

    function calculateScore() {
        const endTime = new Date();
        const timeTaken = (endTime - startTime) / 1000;
        return (1 / timeTaken) * (1 / Math.pow(currentRow + 1, 3));
    }

    // --- LEADERBOARD & DATA HANDLING ---
    
    function saveScore(score) {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().slice(0, 7);
        db.collection("dailyScores").add({ username, score, date: today });

        const userMonthlyDocRef = db.collection("monthlyScores").doc(`${username}_${month}`);
        db.runTransaction((transaction) => {
            return transaction.get(userMonthlyDocRef).then((doc) => {
                if (!doc.exists) {
                    transaction.set(userMonthlyDocRef, { username, month, totalScore: score, playCount: 1 });
                } else {
                    const newTotalScore = doc.data().totalScore + score;
                    const newPlayCount = doc.data().playCount + 1;
                    transaction.update(userMonthlyDocRef, { totalScore: newTotalScore, playCount: newPlayCount });
                }
            });
        }).then(() => {
            // Update the leaderboards on screen as soon as the score is saved.
            displayLeaderboards();
        });
    }

    function displayLeaderboards() {
        // Daily
        const today = new Date().toISOString().split('T')[0];
        db.collection("dailyScores").where("date", "==", today).orderBy("score", "desc").limit(10).get().then(snap => {
            const list = document.getElementById("daily-leaderboard-list");
            list.innerHTML = "";
            snap.forEach(doc => {
                const li = document.createElement("li");
                li.textContent = `${doc.data().username}: ${doc.data().score.toFixed(5)}`;
                list.appendChild(li);
            });
        });

        // Monthly
        const month = new Date().toISOString().slice(0, 7);
        db.collection("monthlyScores").where("month", "==", month).get().then(snap => {
            let monthlyData = [];
            snap.forEach(doc => monthlyData.push(doc.data()));

            // Sum List
            const sumList = document.getElementById("monthly-leaderboard-sum-list");
            sumList.innerHTML = "";
            monthlyData.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10).forEach(data => {
                const li = document.createElement("li");
                li.textContent = `${data.username}: ${data.totalScore.toFixed(5)}`;
                sumList.appendChild(li);
            });

            // Mean List
            const meanList = document.getElementById("monthly-leaderboard-mean-list");
            meanList.innerHTML = "";
            monthlyData.sort((a, b) => (b.totalScore / b.playCount) - (a.totalScore / a.playCount)).slice(0, 10).forEach(data => {
                const li = document.createElement("li");
                const avg = data.playCount > 0 ? (data.totalScore / data.playCount) : 0;
                li.textContent = `${data.username}: ${avg.toFixed(5)}`;
                meanList.appendChild(li);
            });
        });
    }

    // --- ON-SCREEN & PHYSICAL KEYBOARD ---

    // Generate on-screen keyboard
    const keyboardLayout = [
        ["e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
        ["enter", "z", "c", "v", "b", "n", "m", "ö", "ç", "del"]
    ];
    keyboardLayout.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";
        row.forEach(key => {
            const btn = document.createElement("button");
            btn.className = "key-button";
            btn.textContent = key;
            btn.dataset.key = key;
            btn.addEventListener("click", () => {
                if (key === "enter") handleEnter();
                else if (key === "del") handleDelete();
                else handleKeyPress(key);
            });
            rowDiv.appendChild(btn);
        });
        keyboardContainer.appendChild(rowDiv);
    });
    
    // Update keyboard colors
    function updateKeyStatus(letter, status) {
        const current = keyStatus[letter];
        if (current === 'green' || (current === 'yellow' && status !== 'green')) return;
        keyStatus[letter] = status;
    }
    function updateKeyboardDisplay() {
        for (const letter in keyStatus) {
            const keyBtn = keyboardContainer.querySelector(`[data-key='${letter}']`);
            if (keyBtn) {
                keyBtn.classList.remove('green', 'yellow', 'gray');
                keyBtn.classList.add(keyStatus[letter]);
            }
        }
    }
    
    // Physical keyboard listener
    document.addEventListener("keydown", (e) => {
        if (document.activeElement === usernameInput) return;
        const key = e.key.toLocaleLowerCase('tr-TR');
        if (key === "enter") handleEnter();
        else if (key === "backspace") handleDelete();
        else if (/^[a-zçğıöşü]$/.test(key)) handleKeyPress(key);
    });

    // --- INITIALIZE ---
    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }

    // Build the empty game board
    for (let i = 0; i < 6; i++) {
        let row = document.createElement("div");
        row.className = "letter-row";
        for (let j = 0; j < 5; j++) {
            row.appendChild(document.createElement("div"));
            row.children[j].className = "letter-box";
        }
        gameBoard.appendChild(row);
    }
});
