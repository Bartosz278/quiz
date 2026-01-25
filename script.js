document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz');
    const resultsContainer = document.getElementById('results');
    const submitButton = document.getElementById('submit');
    const questionsPerPageInput = document.getElementById('questions-per-page');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const startExamButton = document.getElementById('start-exam');
    const examQuestionsInput = document.getElementById('exam-questions');
    const shuffleModeCheckbox = document.getElementById('shuffle-mode');

    let quizData = null;
    let allQuestions = [];
    let displayQuestions_list = [];
    let userAnswers = {};
    let answeredQuestions = new Set();
    let currentPage = 1;
    let questionsPerPage = 1;
    let examMode = false;
    let examQuestions = [];
    let shuffleMode = false;

    async function loadQuizData() {
        try {
            const response = await fetch('quiz.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            quizData = await response.json();
            allQuestions = quizData.questions || [];
            displayQuestions_list = [...allQuestions];
            displayCurrentPage();
        } catch (error) {
            quizContainer.innerHTML = `<p>Nie udało się załadować quizu. Błąd: ${error.message}</p>`;
            console.error("Fetching quiz data failed:", error);
        }
    }

    function shuffleQuestions() {
        if (!examMode) {
            if (shuffleMode) {
                displayQuestions_list = [...allQuestions].sort(() => Math.random() - 0.5);
            } else {
                displayQuestions_list = [...allQuestions];
            }
            currentPage = 1;
            userAnswers = {};
            answeredQuestions = new Set();
            resultsContainer.innerHTML = '';
            displayCurrentPage();
        }
    }

    function displayCurrentPage() {
        questionsPerPage = parseInt(questionsPerPageInput.value) || 1;
        const questionsSource = examMode ? examQuestions : displayQuestions_list;
        const startIndex = (currentPage - 1) * questionsPerPage;
        const endIndex = startIndex + questionsPerPage;
        const questionsToDisplay = questionsSource.slice(startIndex, endIndex);
        
        displayQuestions(questionsToDisplay, startIndex);
        updatePaginationControls();
    }

    function displayQuestions(questions, startIndex) {
        quizContainer.innerHTML = '';
        
        questions.forEach((question, localIndex) => {
            const globalIndex = startIndex + localIndex;
            
            if (!question.question || !question.options) {
                return;
            }
            
            const questionElement = document.createElement('div');
            questionElement.classList.add('question');
            questionElement.dataset.questionIndex = globalIndex;

            const questionText = document.createElement('p');
            questionText.textContent = `${question.id}. ${question.question}`;
            questionElement.appendChild(questionText);

            const optionsElement = document.createElement('div');
            optionsElement.classList.add('options');

            const correctOptions = question.options.filter(opt => opt.correct === true);
            const isMultipleChoice = correctOptions.length > 1;

            question.options.forEach((option, optionIndex) => {
                if (!option.text) return;

                const optionContainer = document.createElement('div');
                optionContainer.classList.add('option');
                optionContainer.dataset.optionIndex = optionIndex;
                
                const inputType = isMultipleChoice ? 'checkbox' : 'radio';
                const input = document.createElement('input');
                input.type = inputType;
                input.name = `question-${globalIndex}`;
                input.value = optionIndex;
                input.id = `q${globalIndex}o${optionIndex}`;

                const label = document.createElement('label');
                label.htmlFor = `q${globalIndex}o${optionIndex}`;
                label.textContent = option.text;

                optionContainer.appendChild(input);
                optionContainer.appendChild(label);

                // Przywróć poprzedni stan, jeśli pytanie było już odpowiedziane
                if (userAnswers[globalIndex] && userAnswers[globalIndex].includes(optionIndex)) {
                    input.checked = true;
                    optionContainer.classList.add('selected');
                }

                // Jeśli pytanie już było odpowiedziane, pokaż wynik
                if (answeredQuestions.has(globalIndex)) {
                    if (option.correct) {
                        optionContainer.classList.add('correct');
                    } else if (userAnswers[globalIndex] && userAnswers[globalIndex].includes(optionIndex)) {
                        optionContainer.classList.add('incorrect');
                    }
                    input.disabled = true;
                } else {
                    // Dodaj event listener dla nowych odpowiedzi
                    optionContainer.addEventListener('click', (e) => {
                        if (e.target.tagName !== 'INPUT' && !answeredQuestions.has(globalIndex)) {
                            input.click();
                        }
                    });

                    input.addEventListener('change', () => {
                        if (!answeredQuestions.has(globalIndex)) {
                            handleAnswerSelection(globalIndex, optionIndex, isMultipleChoice, question);
                        }
                    });
                }
                
                optionsElement.appendChild(optionContainer);
            });

            questionElement.appendChild(optionsElement);
            
            // Dodaj przycisk "Sprawdź" dla pytań wielokrotnego wyboru
            if (isMultipleChoice && !answeredQuestions.has(globalIndex)) {
                const checkButton = document.createElement('button');
                checkButton.textContent = 'Sprawdź odpowiedź';
                checkButton.classList.add('check-answer-btn');
                checkButton.style.display = 'none';
                checkButton.dataset.questionIndex = globalIndex;
                checkButton.addEventListener('click', () => {
                    checkAndShowAnswer(globalIndex, question, questionElement);
                });
                questionElement.appendChild(checkButton);
            }
            
            quizContainer.appendChild(questionElement);
        });
    }
    
    function handleAnswerSelection(questionIndex, optionIndex, isMultipleChoice, question) {
        const questionElement = quizContainer.querySelector(`[data-question-index="${questionIndex}"]`);
        if (!questionElement) return;
        
        const options = questionElement.querySelectorAll('.option');
        
        if (!isMultipleChoice) {
            // Dla pytań jednokrotnego wyboru
            options.forEach(opt => opt.classList.remove('selected'));
            userAnswers[questionIndex] = [optionIndex];
            options[optionIndex].classList.add('selected');
            
            // Natychmiast sprawdź i pokaż wynik
            checkAndShowAnswer(questionIndex, question, questionElement);
        } else {
            // Dla pytań wielokrotnego wyboru
            if (!userAnswers[questionIndex]) {
                userAnswers[questionIndex] = [];
            }
            
            const answerIndex = userAnswers[questionIndex].indexOf(optionIndex);
            if (answerIndex > -1) {
                userAnswers[questionIndex].splice(answerIndex, 1);
                options[optionIndex].classList.remove('selected');
            } else {
                userAnswers[questionIndex].push(optionIndex);
                options[optionIndex].classList.add('selected');
            }
            
            // Pokaż przycisk "Sprawdź" jeśli użytkownik zaznaczył co najmniej jedną odpowiedź
            const checkButton = questionElement.querySelector('.check-answer-btn');
            if (checkButton) {
                if (userAnswers[questionIndex] && userAnswers[questionIndex].length > 0) {
                    checkButton.style.display = 'block';
                } else {
                    checkButton.style.display = 'none';
                }
            }
        }
    }

    function checkAndShowAnswer(questionIndex, question, questionElement) {
        const options = questionElement.querySelectorAll('.option');
        const correctOptions = question.options
            .map((opt, idx) => opt.correct ? idx : -1)
            .filter(idx => idx !== -1);
        
        const userSelection = userAnswers[questionIndex] || [];
        
        // Oznacz pytanie jako odpowiedziane
        answeredQuestions.add(questionIndex);
        
        // Ukryj przycisk "Sprawdź" jeśli istnieje
        const checkButton = questionElement.querySelector('.check-answer-btn');
        if (checkButton) {
            checkButton.style.display = 'none';
        }
        
        // Pokaż które odpowiedzi są poprawne/niepoprawne
        options.forEach((optionElement, optionIndex) => {
            const input = optionElement.querySelector('input');
            input.disabled = true;
            
            if (question.options[optionIndex].correct) {
                optionElement.classList.add('correct');
            } else if (userSelection.includes(optionIndex)) {
                optionElement.classList.add('incorrect');
                
                // Dodaj wyjaśnienie dlaczego odpowiedź jest błędna
                if (question.options[optionIndex].why_false) {
                    const explanation = document.createElement('div');
                    explanation.classList.add('explanation');
                    explanation.textContent = question.options[optionIndex].why_false;
                    optionElement.appendChild(explanation);
                }
            }
        });
    }

    function updatePaginationControls() {
        const questionsSource = examMode ? examQuestions : displayQuestions_list;
        const totalPages = Math.ceil(questionsSource.length / questionsPerPage);
        const modeText = examMode ? ' (Egzamin)' : '';
        pageInfo.textContent = `Strona ${currentPage} z ${totalPages}${modeText}`;
        
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages;
    }


    function startExam() {
        const numQuestions = parseInt(examQuestionsInput.value);
        
        if (!numQuestions || numQuestions < 1) {
            alert('Proszę wpisać poprawną liczbę pytań (minimum 1)');
            return;
        }
        
        if (numQuestions > allQuestions.length) {
            alert(`Maksymalna liczba pytań to ${allQuestions.length}`);
            return;
        }
        
        // Wyzeruj stan
        userAnswers = {};
        answeredQuestions = new Set();
        resultsContainer.innerHTML = '';
        currentPage = 1;
        
        // Losuj pytania
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
        examQuestions = shuffled.slice(0, numQuestions);
        
        examMode = true;
        questionsPerPageInput.value = '1';
        questionsPerPageInput.disabled = true;
        startExamButton.disabled = true;
        examQuestionsInput.disabled = true;
        shuffleModeCheckbox.disabled = true;
        
        displayCurrentPage();
    }
    
    function showResults() {
        let correctCount = 0;
        let totalAnswered = answeredQuestions.size;
        const questionsSource = examMode ? examQuestions : allQuestions;
        
        answeredQuestions.forEach(questionIndex => {
            const question = questionsSource[questionIndex];
            const correctOptions = question.options
                .map((opt, idx) => opt.correct ? idx : -1)
                .filter(idx => idx !== -1);
            
            const userSelection = userAnswers[questionIndex] || [];
            
            const isCorrect = correctOptions.length === userSelection.length &&
                            correctOptions.every(optIndex => userSelection.includes(optIndex));
            
            if (isCorrect) {
                correctCount++;
            }
        });
        
        const percentage = totalAnswered > 0 ? ((correctCount / totalAnswered) * 100).toFixed(1) : 0;
        const totalQuestions = questionsSource.length;
        const modeText = examMode ? 'egzaminu' : 'quizu';
        
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 1rem; background: #e7f3ff; border-radius: 5px; margin-top: 1rem;">
                <h2>Podsumowanie ${modeText}</h2>
                <p>Odpowiedziałeś na <strong>${totalAnswered}</strong> z <strong>${totalQuestions}</strong> pytań</p>
                <p>Poprawne odpowiedzi: <strong style="color: green;">${correctCount}</strong> / <strong>${totalAnswered}</strong></p>
                <p>Wynik: <strong style="font-size: 1.5em; color: ${percentage >= 70 ? 'green' : percentage >= 50 ? 'orange' : 'red'};">${percentage}%</strong></p>
                ${examMode ? '<button id="reset-exam" style="margin-top: 1rem; cursor: pointer;">exit</button>' : ''}
            </div>
        `;
        
        if (examMode) {
            const resetButton = document.getElementById('reset-exam');
            resetButton.addEventListener('click', resetExam);
        }
    }
    
    function resetExam() {
        examMode = false;
        examQuestions = [];
        userAnswers = {};
        answeredQuestions = new Set();
        resultsContainer.innerHTML = '';
        currentPage = 1;
        
        questionsPerPageInput.disabled = false;
        startExamButton.disabled = false;
        examQuestionsInput.disabled = false;
        examQuestionsInput.value = '';
        shuffleModeCheckbox.disabled = false;
        
        displayQuestions_list = shuffleMode ? [...allQuestions].sort(() => Math.random() - 0.5) : [...allQuestions];
        displayCurrentPage();
    }

    submitButton.addEventListener('click', showResults);

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
            window.scrollTo(0, 0);
        }
    });

    nextPageButton.addEventListener('click', () => {
        const questionsSource = examMode ? examQuestions : displayQuestions_list;
        const totalPages = Math.ceil(questionsSource.length / questionsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
            window.scrollTo(0, 0);
        }
    });
    
    startExamButton.addEventListener('click', startExam);

    shuffleModeCheckbox.addEventListener('change', (e) => {
        shuffleMode = e.target.checked;
        shuffleQuestions();
    });

    questionsPerPageInput.addEventListener('change', () => {
        currentPage = 1;
        displayCurrentPage();
    });

    loadQuizData();
});
