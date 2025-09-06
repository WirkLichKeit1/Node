const $ = (sel) => document.querySelector(sel);

const loginCard = $('#login-card');
const chatCard = $('#chat-card');

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

let me = null;
let peer = null;
let pollInterval = null;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getUserById(id) {
  return fetchJSON(`/api/users/${id}`);
}

function setLoggedUser(user) {
  me = user;
  meName.textContent = `${me.name ?? '(sem nome)'} (Seu id: #${me.id})`;
  hide(loginCard);
  show(chatCard);
  peerInfo.textContent = 'Defina um ID de contato para carregar a conversa.';
}

btnLogin.addEventListener('click', async () => {
  const id = Number(inputUserId.value);
  if (!Number.isInteger(id) || id < 1) {
    loginInfo.textContent = 'Informe um ID válido (inteiro ≥ 1).';
    return;
  }
  try {
    const user = await getUserById(id);
    setLoggedUser(user);
  } catch (e) {
    loginInfo.textContent = `Erro: ${e.message}`;
  }
});

btnSair.addEventListener('click', () => {
  me = null;
  peer = null;
  inputUserId.value = '';
  inputPeerId.value = '';
  messagesBox.innerHTML = '';
  msgInput.value = '';
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  hide(chatCard);
  show(loginCard);
  loginInfo.textContent = 'Informe seu ID e clique em Entrar.';
});

async function loadPeerAndMessages() {
  const id = Number(inputPeerId.value);
  if (!Number.isInteger(id) || id < 1) {
    peerInfo.textContent = 'ID de contato inválido.';
    return;
  }
  if (!me) {
    peerInfo.textContent = 'Faça login primeiro.';
    return;
  }
  try {
    const user = await getUserById(id);
    peer = user;
    peerInfo.textContent = `Conversando com: ${peer.name ?? '(sem nome)'} (#${peer.id})`;
    await refreshMessages();
    startPolling();
  } catch (e) {
    peerInfo.textContent = `Erro: ${e.message}`;
  }
}

btnCarregar.addEventListener('click', loadPeerAndMessages);

function renderMessages(list) {
  messagesBox.innerHTML = '';
  list.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'msg ' + (m.from_id === me.id ? 'me' : 'peer');
    const who = m.from_id === me.id ? 'Você' : (peer?.name ?? `#${m.from_id}`);
    div.innerHTML = `<strong>${who}:</strong> ${escapeHtml(m.content)}<br><small>${m.created_at}</small>`;
    messagesBox.appendChild(div);
  });
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

async function refreshMessages() {
  if (!me || !peer) return;
  try {
    const msgs = await fetchJSON(`/api/messages?userId=${me.id}&peerId=${peer.id}`);
    renderMessages(msgs);
  } catch (e) {
    console.error('Falha ao atualizar mensagens:', e.message);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(refreshMessages, 1000);
}

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!me) return alert('Faça login primeiro.');
  if (!peer) return alert('Carregue um contato primeiro.');
  const text = msgInput.value.trim();
  if (!text) return;

  try {
    await fetchJSON('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_id: me.id, to_id: peer.id, content: text })
    });
    msgInput.value = '';
    await refreshMessages();
  } catch (e) {
    alert('Erro ao enviar: ' + e.message);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const loginCard = document.getElementById("login-card");
  const chatCard = document.getElementById("chat-card");

  const inputUserId = document.getElementById("inputUserId");
  const btnLogin = document.getElementById("btnLogin");
  const loginInfo = document.getElementById("loginInfo");

  const meName = document.getElementById("meName");
  const btnSair = document.getElementById("btnSair");

  btnLogin.addEventListener("click", async () => {
    const userId = inputUserId.value.trim();
    if (!userId) {
      loginInfo.textContent = "Digite um ID válido!";
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();

      if (data.error) {
        loginInfo.textContent = "Usuário não encontrado!";
      } else {
        document.documentElement.dataset.userId = userId;
        meName.textContent = data.name;
        loginCard.classList.add("hidden");
        chatCard.classList.remove("hidden");
      }
    } catch (err) {
      console.error(err);
      loginInfo.textContent = "Erro ao conectar ao servidor!";
    }
  });

  btnSair.addEventListener("click", () => {
    document.documentElement.dataset.userId = "";
    inputUserId.value = "";
    loginCard.classList.remove("hidden");
    chatCard.classList.add("hidden");
  });

  inputUserId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnLogin.click();
    }
  });

  inputPeerId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnCarregar.click();
    }
  });

  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendForm.requestSubmit();
    }
  });
});
