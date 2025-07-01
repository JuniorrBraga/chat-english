// --- Seletores de Elementos do DOM (definidos no load) ---
let sentenceToPracticeEl, listenButton, recordButton, statusEl, feedbackSection,
    errorMessageEl, toggleVisibilityButton, menuButton, sideMenu, topicForm, 
    topicInput, progressSummaryEl, assessmentView, practiceView, 
    startAssessmentButton, trainingLevelEl, xpBar, menuOverlay, closeMenuButton, greetingEl;

// --- Ícones SVG ---
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

// --- Variáveis de Estado ---
let isRecording = false, recognition, currentSentence = '', micPermissionGranted = false, 
    isSentenceVisible = true, currentPage = '', userProfile = {}, conversationHistory = [],
    finalTranscript = '';

// --- Chaves e Configurações ---
const API_KEY = 'AIzaSyCmlG5pRiRD0WY3sszNDMBOJ7L-Lyr3eqs';
const PROGRESS_KEY = 'languageCoachProgress', ERRORS_KEY = 'languageCoachErrors', PROFILE_KEY = 'languageCoachProfile';
const XP_PER_LEVEL = 100;

// --- Bancos de Frases ---
const newWordsSentences = {
    A1: ["This is an apple.", "The sky is blue.", "My name is John.", "I have a black cat."],
    A2: ["I am going to the library to borrow a book.", "She works as a software developer.", "They are planning a trip to the mountains.", "We ate pasta for dinner yesterday."],
    B1: ["He was known for his meticulous attention to detail.", "The ubiquitous nature of smartphones has changed communication.", "She has a pragmatic approach to solving problems.", "Environmental conservation is a crucial issue for our generation."],
    B2: ["The politician's speech was rather superfluous.", "Despite the setback, she remained resilient and optimistic.", "The movie's plot was convoluted and hard to follow.", "His ephemeral success was quickly forgotten."]
};

const assessmentQuestions = [
    "What is your name?",
    "What did you do yesterday?",
    "What are your plans for the future?",
    "What is your opinion on the importance of learning new languages?"
];
let assessmentStep = 0;
let assessmentAnswers = [];

// --- Lógica de Persistência de Dados ---
function loadData(key, defaultValue) { const data = localStorage.getItem(key); return data ? JSON.parse(data) : defaultValue; }
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function loadUserProfile() { userProfile = loadData(PROFILE_KEY, { level: null, xp: 0 }); }

function updateProgress(newScore) {
    const progress = loadData(PROGRESS_KEY, { phrases: 0, totalScore: 0 });
    progress.phrases += 1;
    progress.totalScore += newScore;
    saveData(PROGRESS_KEY, progress);

    if (userProfile.level) {
        userProfile.xp += Math.round(newScore / 15);
        if (userProfile.xp >= XP_PER_LEVEL) {
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            const currentLevelIndex = levels.indexOf(userProfile.level);
            if (currentLevelIndex < levels.length - 1) {
                userProfile.level = levels[currentLevelIndex + 1];
                userProfile.xp = 0;
                alert(`Parabéns! Você subiu para o nível ${userProfile.level}!`);
            } else {
                userProfile.xp = XP_PER_LEVEL;
            }
        }
        saveData(PROFILE_KEY, userProfile);
    }
    updateDisplays();
}

function addError(sentence) { const errors = loadData(ERRORS_KEY, []); if (!errors.includes(sentence)) { errors.push(sentence); saveData(ERRORS_KEY, errors); } }

// --- Funções de UI e Lógica Principal ---
function assignDOMElements() {
    sentenceToPracticeEl = document.getElementById('sentence-to-practice');
    listenButton = document.getElementById('listen-button');
    recordButton = document.getElementById('record-button');
    statusEl = document.getElementById('status');
    feedbackSection = document.getElementById('feedback-section');
    errorMessageEl = document.getElementById('error-message');
    toggleVisibilityButton = document.getElementById('toggle-visibility-button');
    menuButton = document.getElementById('menu-button');
    sideMenu = document.getElementById('side-menu');
    topicForm = document.getElementById('topic-form');
    topicInput = document.getElementById('topic-input');
    progressSummaryEl = document.getElementById('progress-summary');
    assessmentView = document.getElementById('assessment-view');
    practiceView = document.getElementById('practice-view');
    startAssessmentButton = document.getElementById('start-assessment-button');
    trainingLevelEl = document.getElementById('training-level');
    xpBar = document.getElementById('xp-bar');
    menuOverlay = document.getElementById('menu-overlay');
    closeMenuButton = document.getElementById('close-menu-button');
    greetingEl = document.getElementById('greeting');
    currentPage = document.body.dataset.page;
}

function showError(message) { if (!errorMessageEl) return; errorMessageEl.innerHTML = message; errorMessageEl.classList.remove('hidden'); if (statusEl) statusEl.textContent = ''; }

function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.addEventListener('start', () => { isRecording = true; finalTranscript = ''; recordButton.classList.add('pulse', 'bg-red-700'); recordButton.classList.remove('bg-cyan-600'); statusEl.textContent = 'Ouvindo... (clique para parar)'; });
    
    recognition.addEventListener('result', (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        // Opcional: mostrar transcrição provisória
        // statusEl.textContent = interimTranscript;
    });

    recognition.addEventListener('end', () => {
        isRecording = false;
        recordButton.classList.remove('pulse', 'bg-red-700');
        recordButton.classList.add('bg-cyan-600');
        statusEl.textContent = 'Clique para gravar novamente';
        if (finalTranscript) {
            handleRecognitionResult(finalTranscript);
        }
    });
    recognition.addEventListener('error', (event) => { let e = `Erro: ${event.error}.`; if (event.error === 'no-speech') e = "Nenhuma fala detectada."; else if (event.error === 'not-allowed') e = "Permissão para microfone negada."; showError(e); });
}

async function requestMicrophonePermission() {
    statusEl.textContent = 'Aguardando permissão...';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        micPermissionGranted = true;
        statusEl.textContent = 'Permissão concedida!';
        recordButton.classList.remove('bg-cyan-600'); recordButton.classList.add('bg-red-600');
        setupRecognition();
    } catch (err) { showError("<strong>Permissão Negada.</strong> Você precisa permitir o uso do microfone."); statusEl.textContent = 'Acesso ao microfone negado.'; }
}

function checkCompatibility() {
    if (!window.isSecureContext) { showError("<strong>Conexão Insegura:</strong> HTTPS é necessário."); if(recordButton) recordButton.disabled = true; return false; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError("<strong>Navegador Incompatível:</strong> API de microfone não suportada."); if(recordButton) recordButton.disabled = true; return false; }
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { showError("<strong>Navegador Incompatível:</strong> API de Reconhecimento de Fala não suportada."); if(recordButton) recordButton.disabled = true; return false; }
    return true;
}

function loadNextSentence() {
    if (feedbackSection) feedbackSection.classList.add('hidden');
    if (errorMessageEl) errorMessageEl.classList.add('hidden');
    let sentencesPool = [];
    if (currentPage === 'erros') {
        sentencesPool = loadData(ERRORS_KEY, []);
        if (sentencesPool.length === 0) { sentenceToPracticeEl.textContent = "Você não tem erros para praticar. Bom trabalho!"; currentSentence = ''; recordButton.disabled = true; return; }
    } else if (currentPage === 'novas-palavras') {
        const level = userProfile.level || 'A1';
        sentencesPool = newWordsSentences[level] || newWordsSentences['A1'];
    }
    
    recordButton.disabled = false;
    const randomIndex = Math.floor(Math.random() * sentencesPool.length);
    currentSentence = sentencesPool[randomIndex];
    sentenceToPracticeEl.textContent = currentSentence;
    updateSentenceVisibility();
}

function updateSentenceVisibility() {
    if (!toggleVisibilityButton) return;
    if (isSentenceVisible) { sentenceToPracticeEl.classList.remove('hidden-text'); toggleVisibilityButton.innerHTML = eyeIcon; } 
    else { sentenceToPracticeEl.classList.add('hidden-text'); toggleVisibilityButton.innerHTML = eyeOffIcon; }
}

function toggleSentenceVisibility() { isSentenceVisible = !isSentenceVisible; updateSentenceVisibility(); }
function listenToSentence() { if (!currentSentence) return; const utterance = new SpeechSynthesisUtterance(currentSentence); utterance.lang = 'en-US'; utterance.rate = 0.9; window.speechSynthesis.speak(utterance); }

function toggleRecording() {
    if (!recognition) return;
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function handleRecordButtonClick() { 
    if (!micPermissionGranted) { 
        requestMicrophonePermission(); 
    } else { 
        if (!recognition) setupRecognition(); 
        toggleRecording(); 
    } 
}

function handleRecognitionResult(userTranscript) {
    if (currentPage === 'treinamento' && !userProfile.level) {
        handleAssessmentAnswer(userTranscript);
    } else if (currentPage === 'livre') {
        conversationHistory.push({ role: 'user', parts: [{ text: userTranscript }] });
        statusEl.textContent = 'Avaliando e respondendo...';
        getConversationalFeedback(userTranscript);
    } else {
        statusEl.textContent = 'Avaliando sua resposta...';
        getSentenceBasedEvaluation(userTranscript);
    }
}

async function callGeminiAPI(prompt, isJson = false, history = []) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const payload = { contents: [...history, { role: 'user', parts: [{ text: prompt }] }] };
    if (isJson) {
        payload.generationConfig = { responseMimeType: "application/json" };
    }
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
        const result = await response.json();
        if (!result.candidates || !result.candidates[0].content.parts[0].text) throw new Error("Resposta inválida da API.");
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Erro na API do Gemini:", error);
        showError("Erro de comunicação com a IA. Tente novamente.");
        return null;
    }
}

async function generateSentenceFromTopic(topic) {
    statusEl.textContent = 'Gerando frase...';
    recordButton.disabled = true;
    conversationHistory = [];
    const prompt = `You are a friendly English tutor. Start a short, simple conversation with a user whose English level is ${userProfile.level || 'B1'}. The user wants to talk about: "${topic}". Ask them one opening question about the topic. Respond ONLY with the question in plain text.`;
    const sentence = await callGeminiAPI(prompt);
    if (sentence) {
        currentSentence = sentence.trim().replace(/\"/g, "");
        conversationHistory.push({ role: 'model', parts: [{ text: currentSentence }] });
        sentenceToPracticeEl.textContent = currentSentence;
        statusEl.textContent = 'Frase gerada! Clique para responder.';
        recordButton.disabled = false;
    } else {
        statusEl.textContent = 'Erro ao gerar frase.';
    }
}

async function getSentenceBasedEvaluation(userTranscript) {
    const prompt = `You are an English coach. Target sentence: "${currentSentence}". User said: "${userTranscript}". Your task is to: 1. Analyze the user's sentence. 2. Provide a score from 0 to 100. 3. Create a "correctedText" with <del> and <ins> tags. 4. Provide a concise, helpful "tip" in PORTUGUESE. Respond ONLY with a valid JSON object with keys "score", "correctedText", "tip".`;
    const resultText = await callGeminiAPI(prompt, true);
    if (resultText) {
        try {
            const evaluation = JSON.parse(resultText);
            displayFeedback(evaluation);
            updateProgress(evaluation.score);
            if (evaluation.score < 85) { addError(currentSentence); }
        } catch (e) { showError("Erro ao processar a avaliação da IA."); }
    }
}

async function getConversationalFeedback(userTranscript) {
    const prompt = `The user's English level is ${userProfile.level || 'B1'}. Based on the ongoing conversation, evaluate the user's last response: "${userTranscript}". Then, continue the conversation naturally.
    Your task is to provide two things in a JSON object:
    1. "feedback": An object with a "score" (0-100 for grammar/relevance), a "correctedText" (the user's text with corrections using <del> and <ins>), and a "tip" in PORTUGUESE.
    2. "nextSentence": Your next natural response in the conversation.
    Respond ONLY with the valid JSON object.`;
    const resultText = await callGeminiAPI(prompt, true, conversationHistory.slice(0, -1)); // Envia o histórico SEM a última resposta do usuário
    if (resultText) {
        try {
            const result = JSON.parse(resultText);
            displayFeedback(result.feedback, result.nextSentence);
            updateProgress(result.feedback.score);
            if (result.feedback.score < 85) { addError(userTranscript); }
        } catch (e) { showError("Erro ao processar a resposta da IA."); }
    }
}

function displayFeedback(feedback, nextSentence = null) {
    const { score, correctedText, tip } = feedback;
    let title, scoreClass;
    if (score >= 95) { title = "Excelente!"; scoreClass = 'bg-green-500/20 text-green-300'; } 
    else if (score >= 80) { title = "Muito Bom!"; scoreClass = 'bg-yellow-500/20 text-yellow-300'; } 
    else { title = "Continue Praticando!"; scoreClass = 'bg-orange-500/20 text-orange-300'; }
    
    let nextButtonText = "Próxima Frase";
    if (currentPage === 'livre') {
        nextButtonText = "Continuar Conversa";
    }

    const feedbackHTML = `
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold">${title}</h2>
            <span class="text-2xl font-bold ${scoreClass} px-3 py-1 rounded-lg">${score}%</span>
        </div>
        <div class="space-y-4">
            <div>
                <h3 class="font-semibold text-cyan-400 mb-1">Como melhorar</h3>
                <p class="feedback-card bg-gray-800 p-3 rounded-md text-gray-300">${correctedText}</p>
            </div>
            <div>
                <h3 class="font-semibold text-cyan-400 mb-1">Dica do Gemini</h3>
                <p class="bg-gray-800 p-3 rounded-md text-gray-300">${tip}</p>
            </div>
        </div>
        <button id="next-button" class="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">${nextButtonText}</button>
    `;
    feedbackSection.innerHTML = feedbackHTML;
    feedbackSection.classList.remove('hidden');
    document.getElementById('next-button').addEventListener('click', () => {
        if (currentPage === 'livre' && nextSentence) {
            feedbackSection.classList.add('hidden');
            currentSentence = nextSentence.trim().replace(/\"/g, "");
            conversationHistory.push({ role: 'model', parts: [{ text: currentSentence }] });
            sentenceToPracticeEl.textContent = currentSentence;
            statusEl.textContent = "Responda à pergunta.";
            listenToSentence();
        } else {
            loadNextSentence();
        }
    });
}

function updateDisplays() {
    const progress = loadData(PROGRESS_KEY, { phrases: 0, totalScore: 0 });
    const errors = loadData(ERRORS_KEY, []);
    const avgScore = progress.phrases > 0 ? Math.round(progress.totalScore / progress.phrases) : 0;
    
    if (document.getElementById('user-level')) document.getElementById('user-level').textContent = userProfile.level || '--';
    if (document.getElementById('phrases-practiced')) document.getElementById('phrases-practiced').textContent = progress.phrases;
    if (document.getElementById('avg-score')) document.getElementById('avg-score').textContent = `${avgScore}%`;
    if (document.getElementById('errors-to-review')) document.getElementById('errors-to-review').textContent = errors.length;
    if (trainingLevelEl) trainingLevelEl.textContent = `Nível: ${userProfile.level}`;
    if (xpBar) xpBar.style.width = `${(userProfile.xp / XP_PER_LEVEL) * 100}%`;
}

// --- Lógica Específica da Página de Treinamento ---
function startLevelAssessment() { assessmentStep = 0; assessmentAnswers = []; assessmentView.classList.add('hidden'); practiceView.classList.remove('hidden'); askNextAssessmentQuestion(); }
function askNextAssessmentQuestion() {
    if (assessmentStep < assessmentQuestions.length) {
        currentSentence = assessmentQuestions[assessmentStep];
        sentenceToPracticeEl.textContent = currentSentence;
        statusEl.textContent = `Pergunta ${assessmentStep + 1} de ${assessmentQuestions.length}`;
        if(micPermissionGranted) listenToSentence();
    } else { finishAssessment(); }
}
function handleAssessmentAnswer(transcript) {
    if (isRecording) recognition.stop();
    assessmentAnswers.push(transcript); 
    assessmentStep++; 
    askNextAssessmentQuestion(); 
}

async function finishAssessment() {
    statusEl.textContent = "Avaliando seu nível...";
    const prompt = `Based on these answers to questions of increasing difficulty: "${assessmentAnswers.join('; ')}", what is the user's most likely CEFR English level (A1, A2, B1, B2)? Respond with ONLY the level code, e.g., "B1".`;
    const level = await callGeminiAPI(prompt);
    if (level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level.trim())) {
        userProfile.level = level.trim();
        userProfile.xp = 0;
        saveData(PROFILE_KEY, userProfile);
        alert(`Seu nível foi avaliado como ${userProfile.level}! Você será redirecionado para a Conversa Livre para começar a praticar.`);
        window.location.href = 'conversa-livre.html';
    } else {
        showError("Não foi possível avaliar seu nível. Tente novamente.");
        assessmentView.classList.remove('hidden');
        practiceView.classList.add('hidden');
    }
}

function setGreeting() {
    if (!greetingEl) return;
    const hour = new Date().getHours();
    if (hour < 12) { greetingEl.textContent = "Bom dia!"; } 
    else if (hour < 18) { greetingEl.textContent = "Boa tarde!"; } 
    else { greetingEl.textContent = "Boa noite!"; }
}

// --- Event Listeners ---
function setupEventListeners() {
    if (menuButton) menuButton.addEventListener('click', () => document.body.classList.add('menu-open'));
    if (closeMenuButton) closeMenuButton.addEventListener('click', () => document.body.classList.remove('menu-open'));
    if (menuOverlay) menuOverlay.addEventListener('click', () => document.body.classList.remove('menu-open'));
    if (listenButton) listenButton.addEventListener('click', listenToSentence);
    if (recordButton) recordButton.addEventListener('click', handleRecordButtonClick);
    if (toggleVisibilityButton) toggleVisibilityButton.addEventListener('click', toggleSentenceVisibility);
    if (startAssessmentButton) startAssessmentButton.addEventListener('click', startLevelAssessment);
    if (topicForm) {
        topicForm.addEventListener('submit', (e) => { e.preventDefault(); const topic = topicInput.value.trim(); if (topic) { generateSentenceFromTopic(topic); } });
    }
}

// --- Inicialização ---
window.addEventListener('load', () => {
    assignDOMElements();
    setupEventListeners();
    loadUserProfile();
    updateDisplays();

    if (currentPage === 'treinamento') {
        setGreeting();
        if (userProfile.level) {
            window.location.href = 'conversa-livre.html';
        } else {
            assessmentView.classList.remove('hidden');
            practiceView.classList.add('hidden');
        }
    } else if (currentPage === 'erros' || currentPage === 'novas-palavras') {
        loadNextSentence();
    } else if (currentPage === 'livre') {
        if(recordButton) recordButton.disabled = true;
        if(sentenceToPracticeEl) sentenceToPracticeEl.textContent = "Digite um tópico acima para iniciar uma conversa.";
        // Inicia uma conversa aleatória se o usuário simplesmente clicar no microfone
        recordButton.addEventListener('click', () => {
            if (!currentSentence) {
                generateSentenceFromTopic("a random topic");
            }
        });
    }
    
    if (checkCompatibility()) {
        updateSentenceVisibility();
    }
});
