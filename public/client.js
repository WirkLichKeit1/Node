const $ = (sel) => document.querySelector(sel);

const loginCard = $('#login-card');
const chatCard = $('#chat-card');
const registerCard = $('#register-card');
const inputUserId = $('#inputUserId');
const btnLogin = $('#btnLogin');
const loginInfo = $('#loginInfo');
const btnSair = $('#btnSair');
const meName = $('#meName');
const inputPeerId = $('#inputPeerId');
const btnCarregar = $('#btnCarregar');
const peerInfo = $('#peerInfo');
const messagesBox = $('#messages');
const sendForm = $('#sendForm');
const msgInput = $('#msgInput');
const inputName = $('#inputName');
const inputEmail = $('#inputEmail');
const inputSenha = $('#inputSenha');
const btnRegister = $('#btnRegister');
const btnShowLogin = $('#btnShowLogin');
const btnShowRegister = $('#btnShowRegister');
const registerInfo = $('#registerInfo');

let me = null;
let peer = null;
let pollInterval = null;
let lastMessageId = 0;
let isSending = false;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showError(element, message, type = 'error') {
  element.textContent = message;
  element.classList.remove('error', 'success');
  element.classList.add(type);
  setTimeout(() => element.classList.remove(type), 3000);
}

function isValidId(id) {
  const num = Number(id);
  return Number.isInteger(num) && num >= 1;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function fetchJSON(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    throw new Error(`Falha na conexão com o servidor: ${e.message}`);
  }
}

async function getUserById(id) {
  return fetchJSON(`/api/users/${id}`);
}

async function registerUser(name, email, senha) {
  return fetchJSON('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, senha })
  });
}

function setLoggedUser(user) {
  me = user;
  meName.textContent = `${me.name ?? '(sem nome)'} (Seu id: #${me.id})`;
  hide(loginCard);
  hide(registerCard);
  show(chatCard);
  peerInfo.textContent = 'Defina um ID de contato para carregar a conversa.';
  inputPeerId.value = '';
  messagesBox.innerHTML = '';
  lastMessageId = 0;
  peer = null;
  if (pollInterval) clearInterval(pollInterval);
}

btnLogin.addEventListener('click', async () => {
  const id = inputUserId.value.trim();
  if (!isValidId(id)) {
    showError(loginInfo, 'Por favor, informe um ID válido (número inteiro ≥ 1).');
    return;
  }
  btnLogin.classList.add('loading');
  try {
    const user = await getUserById(id);
    setLoggedUser(user);
  } catch (e) {
    showError(loginInfo, `Erro ao fazer login: ${e.message}`);
  } finally {
    btnLogin.classList.remove('loading');
  }
});

btnShowRegister.addEventListener('click', () => {
  hide(loginCard);
  show(registerCard);
  registerInfo.textContent = 'Preencha os campos para se cadastrar.';
  inputName.focus();
});

btnShowLogin.addEventListener('click', () => {
  hide(registerCard);
  show(loginCard);
  loginInfo.textContent = 'Informe seu ID e clique em Entrar.';
  inputUserId.focus();
});

btnRegister.addEventListener('click', async () => {
  const name = inputName.value.trim();
  const email = inputEmail.value.trim();
  const senha = inputSenha.value.trim();

  if (!name || !email || !senha) {
    showError(registerInfo, 'Por favor, preencha todos os campos.');
    return;
  }

  const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
  if (!emailRegex.test(email)) {
    showError(registerInfo, 'Por favor, insira um email válido.');
  }

  btnRegister.classList.add('loading');
  try {
    const user = await registerUser(name, email, senha);
    showError(registerInfo, `Cadastro realizado com sucesso! Seu ID é #${user.id}.`, 'success');
    inputName.value = '';
    inputEmail.value = '';
    inputSenha.value = '';
    setTimeout(() => {
      hide(registerCard);
      show(loginCard);
      inputUserId.value = user.id;
      inputUserId.focus();
    }, 2000);
  } catch (e) {
    showError(registerInfo, `Erro ao cadastrar: ${e.message}`);
  } finally {
    btnRegister.classList.remove('loading');
  }
});

btnSair.addEventListener('click', () => {
  if (!confirm('Tem certeza que deseja sair?')) return;
  me = null;
  peer = null;
  inputUserId.value = '';
  inputPeerId.value = '';
  messagesBox.innerHTML = '';
  msgInput.value = '';
  lastMessageId = 0;
  if (pollInterval) clearInterval(pollInterval);
  hide(chatCard);
  show(loginCard);
  loginInfo.textContent = 'Informe seu ID e clique em Entrar.';
});

async function loadPeerAndMessages() {
  const id = inputPeerId.value.trim();
  if (!me) {
    showError(peerInfo, 'Faça login primeiro.');
    return;
  }
  if (!isValidId(id)) {
    showError(peerInfo, 'ID de contato inválido (número inteiro ≥ 1).');
    return;
  }
  btnCarregar.classList.add('loading');
  try {
    const user = await getUserById(id);
    peer = user;
    peerInfo.textContent = `Conversando com: ${peer.name ?? '(sem nome)'} (#${peer.id})`;
    await refreshMessages();
    startPolling();
  } catch (e) {
    showError(peerInfo, `Erro ao carregar contato: ${e.message}`);
  } finally {
    btnCarregar.classList.remove('loading');
  }
}

btnCarregar.addEventListener('click', loadPeerAndMessages);

function renderMessages(list) {
  const fragment = document.createDocumentFragment();
  const newMessages = list.filter(m => m.id > lastMessageId);

  if (newMessages.length === 0 && messagesBox.children.length > 0) return;

  if (newMessages.length === list.length) {
    messagesBox.innerHTML = '';
  }

  newMessages.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'msg ' + (m.from_id === me.id ? 'me' : 'peer');
    const who = m.from_id === me.id ? 'Você' : (peer?.name ?? `#${m.from_id}`);
    div.innerHTML = `<strong>${who}:</strong> ${escapeHtml(m.content)}<br><small>${formatDate(m.created_at)}</small>`;
    fragment.appendChild(div);
    lastMessageId = Math.max(lastMessageId, m.id);
  });

  messagesBox.appendChild(fragment);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  while (messagesBox.children.length > 100) {
    messagesBox.removeChild(messagesBox.firstChild);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

async function refreshMessages() {
  if (!me || !peer) return;
  messagesBox.classList.add('loading');
  try {
    const msgs = await fetchJSON(`/api/messages?userId=${me.id}&peerId=${peer.id}`);
    renderMessages(msgs);
  } catch (e) {
    showError(peerInfo, 'Erro ao carregar mensagens.');
  } finally {
    messagesBox.classList.remove('loading');
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!document.hidden) refreshMessages();
  }, 3000);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  } else if (!document.hidden && me && peer) {
    startPolling();
  }
});

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isSending) return;
  if (!me) return showError(peerInfo, 'Faça login primeiro.');
  if (!peer) return showError(peerInfo, 'Carregue um contato primeiro.');
  const text = msgInput.value.trim();
  if (!text) return;

  isSending = true;
  msgInput.disabled = true;
  try {
    await fetchJSON('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_id: me.id, to_id: peer.id, content: text })
    });
    msgInput.value = '';
    await refreshMessages();
  } catch (e) {
    showError(peerInfo, `Erro ao enviar mensagem: ${e.message}`);
  } finally {
    isSending = false;
    msgInput.disabled = false;
    msgInput.focus();
  }
});

inputUserId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnLogin.click();
  }
});

inputPeerId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnCarregar.click();
  }
});

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendForm.requestSubmit();
  }
});

inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inputEmail.focus();
  }
});

inputEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inputSenha.focus();
  }
});

inputSenha.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnRegister.click();
  }
});
