


// ========================================
// STUDYPLAN - MAIN JAVASCRIPT
// ========================================

const STORAGE_KEY = "studyplan_data_v1";

// ========================================
// DATA STORAGE
// ========================================

function makeId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}

function today() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function readOldArray(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
}

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error("Could not load StudyPlan data:", error);
    }

    return {
        subjects: readOldArray("subjects").map(item =>
            typeof item === "string"
                ? { id: makeId(), name: item }
                : {
                    id: item.id || makeId(),
                    name: item.name || item.subject || ""
                }
        ),

        questions: readOldArray("questions").map(item => ({
            id: item.id || makeId(),
            subject: item.subject || "",
            question: item.question || "",
            answer: item.answer || "",
            difficulty: item.difficulty || "Medium",
            revisions: Number(item.revisions) || 0
        })),

        tasks: readOldArray("tasks").map(item => ({
            id: item.id || makeId(),
            name: item.name || item.task || "",
            subject: item.subject || "",
            date: item.date || "",
            done: Boolean(item.done)
        })),

        exams: readOldArray("exams").map(item => ({
            id: item.id || makeId(),
            subject: item.subject || "",
            date: item.date || "",
            time: item.time || "",
            venue: item.venue || ""
        })),

        studySessions: readOldArray("studySessions").map(item => ({
            id: item.id || makeId(),
            date: item.date || today(),
            minutes: Number(item.minutes) || 0
        }))
    };
}

let data = loadData();

data.subjects = Array.isArray(data.subjects) ? data.subjects : [];
data.questions = Array.isArray(data.questions) ? data.questions : [];
data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
data.exams = Array.isArray(data.exams) ? data.exams : [];
data.studySessions = Array.isArray(data.studySessions)
    ? data.studySessions
    : [];

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderAll();
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    if (hours === 0) return `${remaining} min`;
    if (remaining === 0) return `${hours} hr`;

    return `${hours} hr ${remaining} min`;
}

// ========================================
// STUDY STREAK CALCULATIONS
// ========================================

// Move a date forward or backward by a number of days.
function shiftDate(dateString, amount) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

// Calculate total study minutes for each date.
function getDailyStudyTotals() {
    const totals = {};

    data.studySessions.forEach(session => {
        const date = session.date;
        const minutes = Number(session.minutes) || 0;

        if (!date) return;

        totals[date] = (totals[date] || 0) + minutes;
    });

    return totals;
}

// Calculate and display the study streak.
function renderStreak() {
    const dailyTotals = getDailyStudyTotals();

    // A day qualifies only when it has at least 30 minutes.
    const qualifyingDates = new Set(
        Object.keys(dailyTotals).filter(
            date => dailyTotals[date] >= 30
        )
    );

    const sortedDates = [...qualifyingDates].sort();

    // Calculate longest streak.
    let longest = 0;
    let currentRun = 0;
    let previousDate = null;

    sortedDates.forEach(date => {
        const currentTime = Date.parse(date + "T00:00:00Z");

        const previousTime = previousDate
            ? Date.parse(previousDate + "T00:00:00Z")
            : null;

        const difference = previousDate
            ? (currentTime - previousTime) / 86400000
            : 0;

        if (difference === 1) {
            currentRun++;
        } else {
            currentRun = 1;
        }

        longest = Math.max(longest, currentRun);
        previousDate = date;
    });

    // Calculate current streak.
    const todayKey = today();

    // If today's goal is not complete yet, yesterday can
    // still be the starting point of the current streak.
    let streakDate = qualifyingDates.has(todayKey)
        ? todayKey
        : shiftDate(todayKey, -1);

    let current = 0;

    while (qualifyingDates.has(streakDate)) {
        current++;
        streakDate = shiftDate(streakDate, -1);
    }

    // Today's study minutes.
    const todayMinutes = dailyTotals[todayKey] || 0;

    const percentage = Math.min(
        100,
        (todayMinutes / 30) * 100
    );

    // Update streak numbers.
    document.getElementById("currentStreak").textContent = current;
    document.getElementById("longestStreak").textContent = longest;

    document.getElementById("todayStudyTime").textContent =
        `${todayMinutes} / 30 min`;

    document.getElementById("todayStreakProgress").style.width =
        percentage + "%";

    // Update message.
    const message = document.getElementById("streakMessage");

    if (todayMinutes >= 30) {
        message.textContent = "🎉 Today's study goal completed!";
    } else if (current > 0) {
        message.textContent =
            `🔥 ${30 - todayMinutes} more minutes to continue your streak!`;
    } else {
        message.textContent =
            `Study ${30 - todayMinutes} more minutes to start your streak!`;
    }

    // Calculate the Monday of the current week.
    const todayDate = new Date(todayKey + "T00:00:00");
    const weekday = todayDate.getDay();
    const mondayOffset = (weekday + 6) % 7;

    const monday = shiftDate(todayKey, -mondayOffset);

    // Display the weekly calendar.
    const calendar = document.getElementById("streakCalendar");
    calendar.innerHTML = "";

    for (let i = 0; i < 7; i++) {
        const date = shiftDate(monday, i);

        const completed = qualifyingDates.has(date);
        const isToday = date === todayKey;

        const dayName = new Date(date + "T00:00:00")
            .toLocaleDateString("en-IN", {
                weekday: "short"
            });

        const dayNumber = Number(date.slice(8, 10));

        calendar.innerHTML += `
            <div class="streak-day
                ${completed ? "is-complete" : ""}
                ${isToday ? "is-today" : ""}">

                <span class="streak-day-name">${dayName}</span>

                <span class="streak-day-dot">
                    ${completed ? "✓" : "·"}
                </span>

                <span class="streak-day-date">
                    ${dayNumber}
                </span>
            </div>
        `;
    }
}


// ========================================
// SUBJECTS
// ========================================

document.getElementById("subjectForm").addEventListener("submit", event => {
    event.preventDefault();

    const input = document.getElementById("subjectName");
    const name = input.value.trim();

    if (!name) return;

    const alreadyExists = data.subjects.some(subject =>
        subject.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
        alert("This subject already exists.");
        return;
    }

    data.subjects.push({
        id: makeId(),
        name
    });

    input.value = "";
    saveData();
});

function deleteSubject(id) {
    const subject = data.subjects.find(item => item.id === id);

    if (!subject) return;

    if (!confirm(`Delete ${subject.name}? Related questions and tasks will remain.`)) {
        return;
    }

    data.subjects = data.subjects.filter(item => item.id !== id);
    saveData();
}

function renderSubjects() {
    const list = document.getElementById("subjectList");
    const questionSelect = document.getElementById("questionSubject");
    const taskSelect = document.getElementById("taskSubject");

    list.innerHTML = "";

    questionSelect.innerHTML =
        '<option value="">Select a subject</option>';

    taskSelect.innerHTML =
        '<option value="">General study</option>';

    data.subjects.forEach(subject => {
        list.innerHTML += `
            <div class="subject-card">
                <div>
                    <h3>📘 ${escapeHTML(subject.name)}</h3>
                    <p>Added to your study space</p>
                </div>

                <button class="small-btn delete-btn"
                    type="button"
                    onclick="deleteSubject('${subject.id}')">
                    Delete
                </button>
            </div>
        `;

        const option1 = document.createElement("option");
        option1.value = subject.name;
        option1.textContent = subject.name;
        questionSelect.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = subject.name;
        option2.textContent = subject.name;
        taskSelect.appendChild(option2);
    });
}

// ========================================
// QUESTIONS AND ANSWERS
// ========================================

document.getElementById("questionForm").addEventListener("submit", event => {
    event.preventDefault();

    const subject = document.getElementById("questionSubject").value;
    const question = document.getElementById("questionText").value.trim();
    const answer = document.getElementById("answerText").value.trim();
    const difficulty = document.getElementById("questionDifficulty").value;

    if (!subject || !question || !answer) {
        alert("Please complete all question fields.");
        return;
    }

    data.questions.push({
        id: makeId(),
        subject,
        question,
        answer,
        difficulty,
        revisions: 0
    });

    event.target.reset();
    saveData();
});

function reviseQuestion(id) {
    const question = data.questions.find(item => item.id === id);

    if (!question) return;

    question.revisions++;
    saveData();
}

function deleteQuestion(id) {
    if (!confirm("Delete this question?")) return;

    data.questions = data.questions.filter(item => item.id !== id);
    saveData();
}

function renderQuestions() {
    const list = document.getElementById("questionList");

    list.innerHTML = "";

    if (data.questions.length === 0) {
        list.innerHTML =
            '<p class="muted">No questions saved yet.</p>';
        return;
    }

    data.questions.forEach((item, index) => {
        list.innerHTML += `
            <article class="item-card">
                <div class="item-top">
                    <div>
                        <span class="tag">
                            ${escapeHTML(item.subject)}
                        </span>

                        <span class="tag difficulty-${escapeHTML(item.difficulty)}">
                            ${escapeHTML(item.difficulty)}
                        </span>

                        <h3>
                            Q${index + 1}. ${escapeHTML(item.question)}
                        </h3>
                    </div>
                </div>

                <details>
                    <summary>Show answer</summary>
                    <p>${escapeHTML(item.answer)}</p>
                </details>

                <div class="item-actions">
                    <span class="tag">
                        Revised ${item.revisions} times
                    </span>

                    <button class="small-btn" type="button"
                        onclick="reviseQuestion('${item.id}')">
                        + Mark revised
                    </button>

                    <button class="small-btn delete-btn" type="button"
                        onclick="deleteQuestion('${item.id}')">
                        Delete
                    </button>
                </div>
            </article>
        `;
    });
}

 // ========================================
 // FLASHCARD MODE
 // ========================================

let flashcardIndex = 0;
let flashcardShowingAnswer = false;

// Get questions based on selected subject.
function getFlashcardQuestions() {
    const selectedSubject =
        document.getElementById("flashcardSubject").value;

    if (selectedSubject === "all") {
        return data.questions;
    }

    return data.questions.filter(
        item => item.subject === selectedSubject
    );
}

// Show the current flashcard.
function renderFlashcards() {
    const questions = getFlashcardQuestions();

    const content = document.getElementById("flashcardContent");
    const label = document.getElementById("flashcardLabel");
    const counter = document.getElementById("flashcardCounter");
    const revisions = document.getElementById("flashcardRevisionCount");

    const flipButton = document.getElementById("flipFlashcard");
    const previousButton = document.getElementById("previousFlashcard");
    const nextButton = document.getElementById("nextFlashcard");
    const reviseButton = document.getElementById("markFlashcardRevised");

    const message = document.getElementById("flashcardMessage");

    if (questions.length === 0) {
        content.textContent = "No saved questions available.";
        label.textContent = "FLASHCARDS";
        counter.textContent = "0 / 0";
        revisions.textContent = "No revisions";

        flipButton.disabled = true;
        previousButton.disabled = true;
        nextButton.disabled = true;
        reviseButton.disabled = true;

        message.textContent =
            "Save some questions in Questions & Answers first.";

        return;
    }

    // Keep index within available questions.
    flashcardIndex =
        ((flashcardIndex % questions.length) + questions.length)
        % questions.length;

    const item = questions[flashcardIndex];

    counter.textContent =
        `${flashcardIndex + 1} / ${questions.length}`;

    revisions.textContent =
        `Revised ${item.revisions || 0} times`;

    if (flashcardShowingAnswer) {
        label.textContent = "ANSWER";
        content.textContent = item.answer;
        flipButton.textContent = "👀 Show Question";
    } else {
        label.textContent = "QUESTION";
        content.textContent = item.question;
        flipButton.textContent = "👀 Show Answer";
    }

    flipButton.disabled = false;
    previousButton.disabled = false;
    nextButton.disabled = false;
    reviseButton.disabled = false;

    message.textContent = "";
}

// Flip between question and answer.
function flipFlashcard() {
    flashcardShowingAnswer = !flashcardShowingAnswer;
    renderFlashcards();
}

// Go to previous flashcard.
function previousFlashcard() {
    flashcardIndex--;
    flashcardShowingAnswer = false;
    renderFlashcards();
}

// Go to next flashcard.
function nextFlashcard() {
    flashcardIndex++;
    flashcardShowingAnswer = false;
    renderFlashcards();
}

// Mark current question as revised.
function markFlashcardRevised() {
    const questions = getFlashcardQuestions();

    if (questions.length === 0) return;

    const item = questions[flashcardIndex];

    // Update the original saved question.
    const originalQuestion = data.questions.find(
        question => question.id === item.id
    );

    if (!originalQuestion) return;

    originalQuestion.revisions =
        (Number(originalQuestion.revisions) || 0) + 1;

    // Move to next card.
    flashcardIndex++;
    flashcardShowingAnswer = false;

    saveData();

    document.getElementById("flashcardMessage").textContent =
        "✓ Revision saved successfully!";
}

// Populate subject dropdown.
function renderFlashcardSubjects() {
    const select = document.getElementById("flashcardSubject");
    const previousValue = select.value || "all";

    select.innerHTML = '<option value="all">All Subjects</option>';

    const subjects = [
        ...new Set(data.questions.map(item => item.subject))
    ];

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        select.appendChild(option);
    });

    select.value = subjects.includes(previousValue)
        ? previousValue
        : "all";
}

// Event listeners.
document.getElementById("flashcardSubject")
    .addEventListener("change", () => {
        flashcardIndex = 0;
        flashcardShowingAnswer = false;
        renderFlashcards();
    });

document.getElementById("flipFlashcard")
    .addEventListener("click", flipFlashcard);

document.getElementById("previousFlashcard")
    .addEventListener("click", previousFlashcard);

document.getElementById("nextFlashcard")
    .addEventListener("click", nextFlashcard);

document.getElementById("markFlashcardRevised")
    .addEventListener("click", markFlashcardRevised);


// ========================================
// STUDY TASKS
// ========================================

document.getElementById("taskForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("taskName").value.trim();
    const subject = document.getElementById("taskSubject").value;
    const date = document.getElementById("taskDate").value;

    if (!name) return;

    data.tasks.push({
        id: makeId(),
        name,
        subject,
        date,
        done: false
    });

    event.target.reset();
    saveData();
});

function toggleTask(id) {
    const task = data.tasks.find(item => item.id === id);

    if (!task) return;

    task.done = !task.done;
    saveData();
}

function deleteTask(id) {
    data.tasks = data.tasks.filter(item => item.id !== id);
    saveData();
}

function renderTasks() {
    const list = document.getElementById("taskList");

    list.innerHTML = "";

    if (data.tasks.length === 0) {
        list.innerHTML =
            '<p class="muted">No tasks added yet.</p>';
        return;
    }

    data.tasks.forEach(task => {
        list.innerHTML += `
            <article class="item-card ${task.done ? "completed" : ""}">
                <div class="item-top">
                    <div>
                        <h3>${escapeHTML(task.name)}</h3>
                        <p>${escapeHTML(task.subject || "General study")}</p>
                        <p>Due: ${escapeHTML(task.date || "No date set")}</p>
                    </div>

                    <span class="tag">
                        ${task.done ? "Completed" : "Pending"}
                    </span>
                </div>

                <div class="item-actions">
                    <button class="small-btn" type="button"
                        onclick="toggleTask('${task.id}')">
                        ${task.done ? "Undo" : "✓ Mark completed"}
                    </button>

                    <button class="small-btn delete-btn" type="button"
                        onclick="deleteTask('${task.id}')">
                        Delete
                    </button>
                </div>
            </article>
        `;
    });
}

// ========================================
// EXAM TIMETABLE
// ========================================

document.getElementById("examForm").addEventListener("submit", event => {
    event.preventDefault();

    const subject = document.getElementById("examSubject").value.trim();
    const date = document.getElementById("examDate").value;
    const time = document.getElementById("examTime").value;
    const venue = document.getElementById("examVenue").value.trim();

    if (!subject || !date || !time) return;

    data.exams.push({
        id: makeId(),
        subject,
        date,
        time,
        venue
    });

    event.target.reset();
    saveData();
});

function deleteExam(id) {
    data.exams = data.exams.filter(item => item.id !== id);
    saveData();
}

function renderExams() {
    const list = document.getElementById("examList");
    const dashboardList = document.getElementById("dashboardExams");

    const sorted = [...data.exams].sort((a, b) =>
        new Date(`${a.date}T${a.time}`) -
        new Date(`${b.date}T${b.time}`)
    );

    list.innerHTML = "";
    dashboardList.innerHTML = "";

    if (sorted.length === 0) {
        list.innerHTML =
            '<p class="muted">No exams added yet.</p>';

        dashboardList.innerHTML =
            '<p class="muted">No upcoming exams.</p>';

        return;
    }

    sorted.forEach(exam => {
        list.innerHTML += `
            <article class="item-card">
                <h3>📅 ${escapeHTML(exam.subject)}</h3>
                <p>Date: ${escapeHTML(exam.date)}</p>
                <p>Time: ${escapeHTML(exam.time)}</p>
                <p>Venue: ${escapeHTML(exam.venue || "Not added")}</p>

                <div class="item-actions">
                    <button class="small-btn delete-btn" type="button"
                        onclick="deleteExam('${exam.id}')">
                        Delete
                    </button>
                </div>
            </article>
        `;

        dashboardList.innerHTML += `
            <article class="item-card">
                <h3>${escapeHTML(exam.subject)}</h3>
                <p>${escapeHTML(exam.date)} · ${escapeHTML(exam.time)}</p>
                <p>${escapeHTML(exam.venue || "Venue not added")}</p>
            </article>
        `;
    });
}

// ========================================
// STUDY TIME LOGGING
// ========================================

document.getElementById("studyDate").value = today();

document.getElementById("studyLogForm").addEventListener("submit", event => {
    event.preventDefault();

    const minutes = Number(
        document.getElementById("studyMinutes").value
    );

    const date = document.getElementById("studyDate").value;

    if (!Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 1440 ||
        !date) {

        alert("Enter a valid study time and date.");
        return;
    }

    data.studySessions.push({
        id: makeId(),
        date,
        minutes
    });

    document.getElementById("studyMinutes").value = "";
    document.getElementById("studyDate").value = today();

    saveData();
});

function renderSessions() {
    const list = document.getElementById("sessionList");

    const sorted = [...data.studySessions].sort((a, b) =>
        b.date.localeCompare(a.date)
    );

    list.innerHTML = "";

    if (sorted.length === 0) {
        list.innerHTML =
            '<p class="muted">No study sessions logged yet.</p>';
        return;
    }

    sorted.slice(0, 10).forEach(session => {
        list.innerHTML += `
            <article class="item-card">
                <h3>${escapeHTML(session.date)}</h3>
                <p>📖 ${formatMinutes(Number(session.minutes) || 0)}</p>
            </article>
        `;
    });
}

// ========================================
// WEEKLY STUDY GRAPH
// ========================================

function renderChart(elementId) {
    const chart = document.getElementById(elementId);

    chart.innerHTML = "";

    const days = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        const minutes = data.studySessions
            .filter(session => session.date === key)
            .reduce(
                (sum, session) =>
                    sum + (Number(session.minutes) || 0),
                0
            );

        days.push({
            label: date.toLocaleDateString("en", {
                weekday: "short"
            }),
            minutes
        });
    }

    const maxMinutes = Math.max(
        60,
        ...days.map(day => day.minutes)
    );

    days.forEach(day => {
        const height = day.minutes === 0
            ? 3
            : Math.max(5, (day.minutes / maxMinutes) * 135);

        chart.innerHTML += `
            <div class="chart-column">
                <span class="chart-value">${day.minutes}</span>

                <div class="chart-bar-area">
                    <div class="chart-bar"
                         style="height:${height}px"
                         title="${day.minutes} minutes">
                    </div>
                </div>

                <span class="chart-day">${day.label}</span>
            </div>
        `;
    });
}

// ========================================
// DASHBOARD
// ========================================

function renderDashboard() {
    const completed = data.tasks.filter(task => task.done).length;
    const total = data.tasks.length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    const minutes = data.studySessions.reduce(
        (sum, session) =>
            sum + (Number(session.minutes) || 0),
        0
    );

    document.getElementById("totalSubjects").textContent =
        data.subjects.length;

    document.getElementById("totalQuestions").textContent =
        data.questions.length;

    document.getElementById("completedTasks").textContent =
        `${completed}/${total}`;

    document.getElementById("totalStudyTime").textContent =
        formatMinutes(minutes);

    document.getElementById("taskProgressBar").style.width =
        percentage + "%";

    document.getElementById("taskProgressText").textContent =
        percentage + "%";
}

// ========================================
// FOCUS TIMER
// ========================================

let timerDuration = 25 * 60;
let remainingSeconds = timerDuration;
let timerInterval = null;
let timerEndTime = null;
let timerRunning = false;

const timerDisplay = document.getElementById("timerDisplay");
const timerMessage = document.getElementById("timerMessage");

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setCustomTimer() {
    if (timerRunning) {
        alert("Pause the timer before changing its duration.");
        return;
    }

    const minutes = Number(
        document.getElementById("customMinutes").value
    );

    if (!Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 600) {

        alert("Enter a time between 1 and 600 minutes.");
        return;
    }

    timerDuration = minutes * 60;
    remainingSeconds = timerDuration;

    updateTimerDisplay();
    timerMessage.textContent = "Timer is ready.";
}

function startTimer() {
    if (timerRunning) return;

    if (remainingSeconds <= 0) {
        remainingSeconds = timerDuration;
    }

    timerRunning = true;
    timerEndTime = Date.now() + remainingSeconds * 1000;

    timerMessage.textContent =
        "Stay focused. You've got this!";

    timerInterval = setInterval(() => {
        remainingSeconds = Math.max(
            0,
            Math.ceil((timerEndTime - Date.now()) / 1000)
        );

        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            finishTimer();
        }
    }, 250);
}

function pauseTimer() {
    if (!timerRunning) return;

    remainingSeconds = Math.max(
        0,
        Math.ceil((timerEndTime - Date.now()) / 1000)
    );

    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;

    updateTimerDisplay();
    timerMessage.textContent = "Timer paused.";
}

function resetTimer() {
    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;

    remainingSeconds = timerDuration;
    timerEndTime = null;

    updateTimerDisplay();
    timerMessage.textContent =
        "Timer reset. Ready when you are.";
}

function finishTimer() {
    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;
    remainingSeconds = 0;

    updateTimerDisplay();

    const completedMinutes = Math.round(timerDuration / 60);

    data.studySessions.push({
        id: makeId(),
        date: today(),
        minutes: completedMinutes
    });

    saveData();

    timerMessage.textContent =
        "Session complete! Well done.";

    if (document.getElementById("alarmEnabled").checked) {
        playAlarm();
    }

    if ("Notification" in window &&
        Notification.permission === "granted") {

        new Notification("StudyPlan", {
            body: "Your focus session is complete!"
        });
    }
}

function playAlarm() {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        const audio = new AudioContextClass();

        [0, 0.35, 0.7].forEach(delay => {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = 800;
            gain.gain.value = 0.12;

            oscillator.connect(gain);
            gain.connect(audio.destination);

            oscillator.start(audio.currentTime + delay);
            oscillator.stop(audio.currentTime + delay + 0.2);
        });

        setTimeout(() => audio.close(), 1500);

    } catch (error) {
        console.log("Audio could not play:", error);
    }
}

document.getElementById("setTimerBtn")
    .addEventListener("click", setCustomTimer);

document.getElementById("startTimer")
    .addEventListener("click", startTimer);

document.getElementById("pauseTimer")
    .addEventListener("click", pauseTimer);

document.getElementById("resetTimer")
    .addEventListener("click", resetTimer);

document.getElementById("startTimer").addEventListener("click", () => {
    if ("Notification" in window &&
        Notification.permission === "default") {

        Notification.requestPermission();
    }
});

// ========================================
// DARK MODE
// ========================================

const themeToggle = document.getElementById("themeToggle");

function updateThemeButton() {
    if (document.body.classList.contains("dark")) {
        themeToggle.textContent = "☀️ Light mode";
    } else {
        themeToggle.textContent = "🌙 Dark mode";
    }
}

const savedTheme = localStorage.getItem("studyplan_theme");

if (savedTheme === "dark") {
    document.body.classList.add("dark");
}

updateThemeButton();

themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark");

    const currentTheme =
        document.body.classList.contains("dark")
            ? "dark"
            : "light";

    localStorage.setItem("studyplan_theme", currentTheme);

    updateThemeButton();
});

// ========================================
// DOWNLOAD MY NOTES
// QUESTIONS AND ANSWERS ONLY
// ========================================

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

function exportTXT() {
    let text = "STUDYPLAN - MY SAVED NOTES\n";
    text += "============================\n\n";

    if (data.questions.length === 0) {
        text += "No questions have been saved yet.\n";
    } else {
        // Export questions grouped by subject.
        data.subjects.forEach(subject => {
            const subjectQuestions = data.questions.filter(
                item => item.subject === subject.name
            );

            if (subjectQuestions.length === 0) return;

            text += `SUBJECT: ${subject.name}\n`;
            text += "----------------------------\n\n";

            subjectQuestions.forEach((item, index) => {
                text += `Question ${index + 1}:\n`;
                text += `${item.question}\n\n`;

                text += `Answer:\n`;
                text += `${item.answer}\n\n`;

                text += "----------------------------\n\n";
            });
        });

        // Include questions whose subject was deleted.
        const knownSubjects = data.subjects.map(
            subject => subject.name
        );

        const otherQuestions = data.questions.filter(
            item => !knownSubjects.includes(item.subject)
        );

        if (otherQuestions.length > 0) {
            text += "OTHER / UNSORTED QUESTIONS\n";
            text += "----------------------------\n\n";

            otherQuestions.forEach((item, index) => {
                text += `Question ${index + 1}:\n`;
                text += `${item.question}\n\n`;

                text += `Answer:\n`;
                text += `${item.answer}\n\n`;

                text += "----------------------------\n\n";
            });
        }
    }

    downloadFile(
        "StudyPlan_My_Notes.txt",
        text,
        "text/plain;charset=utf-8"
    );

    const message = document.getElementById("backupMessage");

    if (message) {
        message.textContent =
            "Your questions and answers have been downloaded.";
    }
}

// CONNECT THE DOWNLOAD BUTTON TO THE FUNCTION
const downloadNotesButton = document.getElementById("exportTxt");

if (downloadNotesButton) {
    downloadNotesButton.addEventListener("click", exportTXT);
}

// ========================================
// RENDER EVERYTHING
// ========================================

function renderAll() {
    renderSubjects();
    renderQuestions();
    renderFlashcardSubjects();
    renderFlashcards();
    renderTasks();
    renderExams();
    renderSessions();
    renderChart("weeklyChart");
    renderChart("progressChart");
    renderDashboard();
    renderStreak();
}

renderAll();
updateTimerDisplay();

// ========================================
// SIDEBAR ACTIVE LINK
// ========================================

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});
