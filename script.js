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

    // --- Firebase Initialization ---
    const firebaseConfig = {
      apiKey: "AIzaSyBuM3n3_r9o5SlJ8VSwRx-dhHf5fbAL3Sg",
      authDomain: "baydledb.firebaseapp.com",
      projectId: "baydledb",
      storageBucket: "baydledb.firebasestorage.app",
      messagingSenderId: "16708584389",
      appId: "1:16708584389:web:61d8b684a5c512023181ac",
      measurementId: "G-H67RVJRKD7"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

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

    // Load words from the text file
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

    // Handle user login
    loginButton.addEventListener("click", () => {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            username = enteredUsername;
            localStorage.setItem("wordle_username", username);
            checkIfPlayedToday();
        }
    });

    // Check if the user has already completed the game today
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

    // Dynamically create the game board
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

    // ⭐ 1. SAVE GAME STATE TO FIREBASE
    async function saveGameState() {
        if (!username || isGameOver) return;

        const boardState = Array.from(gameBoard.children).map(row =>
            Array.from(row.children).map(box => box.textContent || " ").join("")
        );

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
        // Use the username as the document ID for easy lookup
        await db.collection("gameStates").doc(username).set(gameState);
    }

    // ⭐ 2. RESTORE GAME STATE FROM FIREBASE
    async function restoreGameState() {
        if (!username) return false;

        const gameStateDoc = await db.collection("gameStates").doc(username).get();
        if (!gameStateDoc.exists) {
            console.log("No saved game state found in Firebase.");
            return false;
        }

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
            if (guess.length === 5) {
                applyRowColors(i, guess);
            }
        }

        updateKeyboardDisplay();
        console.log("Game state restored from Firebase.");
        return true;
    }
    
    // ⭐ 3. EVENT HANDLERS MODIFIED TO SAVE STATE
    function handleKeyPress(key) {
        if (isGameOver || currentCol >= 5) return;
        const row = gameBoard.children[currentRow];
        const box = row.children[currentCol];
        box.textContent = key;
        currentCol++;
        saveGameState();
    }

    function handleDelete() {
        if (isGameOver || currentCol === 0) return;
        currentCol--;
        const row = gameBoard.children[currentRow];
        const box = row.children[currentCol];
        box.textContent = "";
        saveGameState();
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
                    saveGameState();
                }
            } else {
                alert("Kelime sözlükte yok!");
            }
        }
    }

    function getCurrentGuess() {
        let guess = "";
        const row = gameBoard.children[currentRow];
        for (let i = 0; i < 5; i++) {
            guess += row.children[i].textContent;
        }
        return guess.toLocaleLowerCase('tr-TR');
    }

    // Helper function to apply colors to a row, used for both checking and restoring
    function applyRowColors(rowIndex, guess) {
        const row = gameBoard.children[rowIndex];
        const solutionLetters = solution.split('');
        const guessLetters = guess.split('');

        // Green pass
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === solutionLetters[i]) {
                row.children[i].classList.add("green");
                updateKeyStatus(guessLetters[i], "green");
                solutionLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        // Yellow/Gray pass
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
    
    // ⭐ 4. CHECK GUESS LOGIC MODIFIED FOR CLEANUP
    function checkGuess(guess) {
        applyRowColors(currentRow, guess);
        updateKeyboardDisplay();

        const endTime = new Date();
        const timeTaken = (endTime - startTime) / 1000;
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
            
            // Mark today's game as completed
            localStorage.setItem(`wordle_last_play_${username}`, new Date().toISOString().split('T')[0]);
            
            // Delete the in-progress game state from Firebase
            db.collection("gameStates").doc(username).delete().then(() => {
                console.log("Game state deleted from Firebase.");
            });
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
        });
        displayLeaderboards();
    }

    function displayLeaderboards() {
        // This function is unchanged
        // ... (your existing leaderboard code)
    }

    const keyboard = [
        ["e","r","t","y","u","ı","o","p","ğ","ü"],
        ["a","s","d","f","g","h","j","k","l","ş","i"],
        ["enter","z","c","v","b","n","m","ö","ç","del"]
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

    // ⭐ 5. STARTGAME MODIFIED TO RESTORE OR INITIALIZE
    async function startGame() {
        await loadWords();
        if (dictionary.length === 0) return;

        const restored = await restoreGameState();

        if (!restored) {
            // If no state, start a new game
            const epoch = new Date("2025-01-01T00:00:00Z");
            const now = new Date();
            const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const dayIndex = Math.floor((startOfTodayUTC - epoch) / (1000 * 60 * 60 * 24));

            const randomValue = seededRandom(dayIndex);
            const wordIndex = Math.floor(randomValue * dictionary.length);

            solution = dictionary[wordIndex];
            startTime = new Date();
            // Save the initial state of the new game
            await saveGameState();
        }
        console.log(`Today's word: ${solution}`);
        displayLeaderboards();
    }

    // --- Navigation ---
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

    // Restore username on page load
    const storedUsername = localStorage.getItem("wordle_username");
    if (storedUsername) {
        usernameInput.value = storedUsername;
        username = storedUsername;
    }
});
