// --- Seletores de Elementos do DOM (serão definidos no load) ---
let sentenceToPracticeEl, listenButton, recordButton, statusEl, feedbackSection,
    feedbackTitle, feedbackScore, correctedTextEl, feedbackTip, errorMessageEl,
    nextButton, toggleVisibilityButton, menuButton, sideMenu, topicForm, topicInput,
    progressSummaryEl;

// --- Ícones SVG ---
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

// --- Variáveis de Estado ---
let isRecording = false;
let recognition;
let currentSentence = '';
let micPermissionGranted = false;
let isSentenceVisible = true;
let currentPage = '';

// --- Chaves para o Local Storage ---
const PROGRESS_KEY = 'languageCoachProgress';
const ERRORS_KEY = 'languageCoachErrors';

// --- Lógica de Persistência de Dados (Progresso e Erros) ---
function loadData(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function updateProgress(newScore) {
    const progress = loadData(PROGRESS_KEY, { phrases: 0, totalScore: 0 });
    progress.phrases += 1;
    progress.totalScore += newScore;
    saveData(PROGRESS_KEY, progress);
    updateProgressDisplay();
}

function addError(sentence) {
    const errors = loadData(ERRORS_KEY, []);
    if (!errors.includes(sentence)) {
        errors.push(sentence);
        saveData(ERRORS_KEY, errors);
    }
}

// --- Funções de UI e Lógica Principal ---

function assignDOMElements() {
    // Associa os elementos do DOM às variáveis
    sentenceToPracticeEl = document.getElementById('sentence-to-practice');
    listenButton = document.getElementById('listen-button');
    recordButton = document.getElementById('record-button');
    statusEl = document.getElementById('status');
    feedbackSection = document.getElementById('feedback-section');
    feedbackTitle = document.getElementById('feedback-title');
    feedbackScore = document.getElementById('feedback-score');
    correctedTextEl = document.getElementById('corrected-text');
    feedbackTip = document.getElementById('feedback-tip');
    errorMessageEl = document.getElementById('error-message');
    nextButton = document.getElementById('next-button');
    toggleVisibilityButton = document.getElementById('toggle-visibility-button');
    menuButton = document.getElementById('menu-button');
    sideMenu = document.getElementById('side-menu');
    topicForm = document.getElementById('topic-form');
    topicInput = document.getElementById('topic-input');
    progressSummaryEl = document.getElementById('progress-summary');
    currentPage = document.body.dataset.page;
}

function showError(message) {
    if (!errorMessageEl) return;
    errorMessageEl.innerHTML = message;
    errorMessageEl.classList.remove('hidden');
    if (statusEl) statusEl.textContent = '';
}

function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.addEventListener('start', () => { isRecording = true; recordButton.classList.add('pulse', 'bg-red-700'); recordButton.classList.remove('bg-cyan-600', 'hover:bg-cyan-700'); statusEl.textContent = 'Ouvindo...'; });
    recognition.addEventListener('result', handleRecognitionResult);
    recognition.addEventListener('end', () => { isRecording = false; recordButton.classList.remove('pulse', 'bg-red-700'); recordButton.classList.add('bg-cyan-600', 'hover:bg-cyan-700'); statusEl.textContent = 'Clique para gravar novamente'; });
    recognition.addEventListener('error', (event) => { let errorMessage = `Erro no reconhecimento: ${event.error}.`; if (event.error === 'no-speech') { errorMessage = "Nenhuma fala foi detectada."; } else if (event.error === 'not-allowed') { errorMessage = "A permissão para o microfone foi negada."; } showError(errorMessage); });
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
    } catch (err) {
        showError("<strong>Permissão Negada.</strong> Você precisa permitir o uso do microfone.");
        statusEl.textContent = 'Acesso ao microfone negado.';
    }
}

function checkCompatibility() {
    if (!window.isSecureContext) { showError("<strong>Conexão Insegura:</strong> O acesso ao microfone requer HTTPS."); recordButton.disabled = true; return false; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError("<strong>Navegador Incompatível:</strong> API de microfone não suportada."); recordButton.disabled = true; return false; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showError("<strong>Navegador Incompatível:</strong> API de Reconhecimento de Fala não suportada."); recordButton.disabled = true; return false; }
    return true;
}

function loadNextSentence() {
    feedbackSection.classList.add('hidden');
    errorMessageEl.classList.add('hidden');

    if (currentPage === 'erros') {
        const errors = loadData(ERRORS_KEY, []);
        if (errors.length === 0) {
            sentenceToPracticeEl.textContent = "Você não tem erros para praticar. Bom trabalho!";
            currentSentence = '';
            recordButton.disabled = true; listenButton.disabled = true;
            return;
        }
        recordButton.disabled = false; listenButton.disabled = false;
        const randomIndex = Math.floor(Math.random() * errors.length);
        currentSentence = errors[randomIndex];
        sentenceToPracticeEl.textContent = currentSentence;
    }
    // Para 'conversa-livre', esperamos o input do usuário
    else if (currentPage === 'livre') {
        sentenceToPracticeEl.textContent = "Digite um tópico abaixo e clique em 'Gerar Frase'.";
        currentSentence = '';
        recordButton.disabled = true;
    }
     updateSentenceVisibility();
}

function updateSentenceVisibility() {
    if (!toggleVisibilityButton) return;
    if (isSentenceVisible) {
        sentenceToPracticeEl.classList.remove('hidden-text');
        toggleVisibilityButton.innerHTML = eyeIcon;
    } else {
        sentenceToPracticeEl.classList.add('hidden-text');
        toggleVisibilityButton.innerHTML = eyeOffIcon;
    }
}

function toggleSentenceVisibility() {
    isSentenceVisible = !isSentenceVisible;
    updateSentenceVisibility();
}

function listenToSentence() { if (!currentSentence) return; const utterance = new SpeechSynthesisUtterance(currentSentence); utterance.lang = 'en-US'; utterance.rate = 0.9; window.speechSynthesis.speak(utterance); }
function handleRecordButtonClick() { if (!micPermissionGranted) { requestMicrophonePermission(); } else { if (!recognition) setupRecognition(); toggleRecording(); } }
function toggleRecording() { if (!recognition || !currentSentence) return; if (isRecording) { recognition.stop(); } else { recognition.start(); } }
function handleRecognitionResult(event) { const userTranscript = event.results[0][0].transcript; statusEl.textContent = 'Avaliando sua resposta...'; getEvaluationFromGemini(userTranscript); }

async function generateSentenceFromTopic(topic) {
    statusEl.textContent = 'Gerando frase sobre o tópico...';
    recordButton.disabled = true;
    const apiKey = ""; // Insira sua chave da API aqui
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const prompt = `Generate a single, interesting English practice sentence about the topic: "${topic}". The sentence should be appropriate for an intermediate learner. Respond ONLY with the sentence in plain text, without any quotes or extra formatting.`;
    
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.candidates && result.candidates[0].content.parts[0].text) {
            currentSentence = result.candidates[0].content.parts[0].text.trim();
            sentenceToPracticeEl.textContent = currentSentence;
            statusEl.textContent = 'Frase gerada! Clique no microfone para responder.';
            recordButton.disabled = false;
        } else {
            throw new Error("A API não retornou uma frase válida.");
        }
    } catch (error) {
        showError("Não foi possível gerar a frase. Tente outro tópico.");
        statusEl.textContent = 'Erro ao gerar frase.';
    }
}


async function getEvaluationFromGemini(userTranscript) {
    const apiKey = ""; // Insira sua chave da API aqui
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const prompt = `You are an English language coach. Target sentence: "${currentSentence}" User said: "${userTranscript}". Your task is to: 1. Analyze the user's sentence. 2. Provide a score from 0 to 100. 3. Create a "correctedText" with <del> and <ins> tags. 4. Provide a concise, helpful "tip" in PORTUGUESE. Respond ONLY with a valid JSON object with keys "score", "correctedText", "tip".`;
    const schema = { type: "OBJECT", properties: { "score": { "type": "NUMBER" }, "correctedText": { "type": "STRING" }, "tip": { "type": "STRING" } }, required: ["score", "correctedText", "tip"] };
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) {
            const evaluation = JSON.parse(result.candidates[0].content.parts[0].text);
            displayFeedback(evaluation);
            updateProgress(evaluation.score);
            if (evaluation.score < 85) { addError(currentSentence); }
        } else { throw new Error("A API não retornou uma avaliação válida."); }
    } catch (error) { showError("Desculpe, não consegui avaliar sua resposta."); }
}

function displayFeedback(feedback) {
    feedbackScore.textContent = `${feedback.score}%`;
    if (feedback.score >= 95) { feedbackTitle.textContent = "Excelente!"; feedbackScore.className = 'text-2xl font-bold bg-green-500/20 text-green-300 px-3 py-1 rounded-lg'; } else if (feedback.score >= 80) { feedbackTitle.textContent = "Muito Bom!"; feedbackScore.className = 'text-2xl font-bold bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg'; } else { feedbackTitle.textContent = "Continue Praticando!"; feedbackScore.className = 'text-2xl font-bold bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg'; }
    correctedTextEl.innerHTML = feedback.correctedText;
    feedbackTip.textContent = feedback.tip;
    feedbackSection.classList.remove('hidden');
}

function updateProgressDisplay() {
    const progress = loadData(PROGRESS_KEY, { phrases: 0, totalScore: 0 });
    const errors = loadData(ERRORS_KEY, []);
    const avgScore = progress.phrases > 0 ? Math.round(progress.totalScore / progress.phrases) : 0;
    
    const phrasesEl = document.getElementById('phrases-practiced');
    const avgScoreEl = document.getElementById('avg-score');
    const errorsEl = document.getElementById('errors-to-review');

    if (phrasesEl) phrasesEl.textContent = progress.phrases;
    if (avgScoreEl) avgScoreEl.textContent = `${avgScore}%`;
    if (errorsEl) errorsEl.textContent = errors.length;
}

// --- Event Listeners ---
function setupEventListeners() {
    if (menuButton) {
        menuButton.addEventListener('click', () => {
            document.body.classList.toggle('menu-open');
        });
    }
    if (listenButton) listenButton.addEventListener('click', listenToSentence);
    if (recordButton) recordButton.addEventListener('click', handleRecordButtonClick);
    if (nextButton) nextButton.addEventListener('click', loadNextSentence);
    if (toggleVisibilityButton) toggleVisibilityButton.addEventListener('click', toggleSentenceVisibility);
    if (topicForm) {
        topicForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = topicInput.value.trim();
            if (topic) {
                generateSentenceFromTopic(topic);
                topicInput.value = '';
            }
        });
    }
}

// --- Inicialização ---
window.addEventListener('load', () => {
    assignDOMElements();
    setupEventListeners();
    updateProgressDisplay();

    if (currentPage === 'livre' || currentPage === 'erros') {
        if (checkCompatibility()) {
            loadNextSentence();
        }
        updateSentenceVisibility();
    }
});
