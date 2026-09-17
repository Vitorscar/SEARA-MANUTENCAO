/* =========================================================
   login.view.js — chapa (funcionário) + admin (SGA)
   ========================================================= */

import { loginPorChapa, loginAdmin } from '../services/auth.service.js';
import { CHAPA_REGEX }               from '../data/turnos.js';
import { toast }                     from '../ui/toast.js';
import { navigate }                  from '../core/router.js';

/* Estado persistente entre re-renders */
let aba    = 'chapa';
let logando = false;

/* =========================================================
   RENDER
   ========================================================= */
export function renderLogin(){
  document.getElementById('view').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">

        <div class="login-brand">
          <div class="login-mark">☀</div>
          <h1>Gestão de Paradas</h1>
          <p>Seara · Manutenção industrial</p>
        </div>

        <div class="login-tabs">
          <button type="button"
                  class="login-tab ${aba === 'chapa' ? 'active' : ''}"
                  data-tab="chapa">
            <span class="login-tab-ic">👷</span>
            <span>Chapa</span>
          </button>
          <button type="button"
                  class="login-tab ${aba === 'admin' ? 'active' : ''}"
                  data-tab="admin">
            <span class="login-tab-ic">🛡️</span>
            <span>Administrador</span>
          </button>
        </div>

        <div class="login-body" id="loginBody"></div>
        <div class="login-foot" id="loginFoot"></div>

      </div>
    </div>
  `;

  document.querySelectorAll('.login-tab').forEach(t => {
    t.onclick = () => {
      if(logando) return;
      aba = t.dataset.tab;
      document.querySelectorAll('.login-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderCorpo();
    };
  });

  renderCorpo();
}

/* =========================================================
   CORPO DA ABA ATIVA
   ========================================================= */
function renderCorpo(){
  const body = document.getElementById('loginBody');
  const foot = document.getElementById('loginFoot');
  if(!body || !foot) return;

  if(aba === 'chapa'){
    renderAbaChapa(body, foot);
  } else {
    renderAbaAdmin(body, foot);
  }
}

/* =========================================================
   ABA: CHAPA (funcionário)
   ========================================================= */
function renderAbaChapa(body, foot){
  foot.textContent = 'Digite sua chapa de 10 dígitos para entrar.';

  body.innerHTML = `
    <form id="formChapa" class="login-form" autocomplete="off" novalidate>
      <div class="field">
        <label for="fChapa">Número da chapa</label>
        <input type="text" id="fChapa" class="chapa-input"
               inputmode="numeric" maxlength="10"
               placeholder="0000000000"
               autocomplete="username"
               autocapitalize="off" autocorrect="off"
               spellcheck="false" enterkeyhint="go">
        <small class="chapa-hint">10 dígitos · apenas números</small>
      </div>
      <button type="submit" class="btn block primary" id="btnEntrar">Entrar</button>
      <p id="msgLogin" class="login-msg"></p>
    </form>
  `;

  const form = document.getElementById('formChapa');
  const inp  = document.getElementById('fChapa');
  const btn  = document.getElementById('btnEntrar');
  const msg  = document.getElementById('msgLogin');

  /* ---------- Filtro + feedback em tempo real ---------- */
  inp.addEventListener('input', () => {
    const limpo = inp.value.replace(/\D/g, '').slice(0, 10);
    if(limpo !== inp.value) inp.value = limpo;

    if(limpo.length === 0){
      inp.classList.remove('ok', 'erro');
      msg.textContent = '';
    } else if(limpo.length < 10){
      inp.classList.remove('ok', 'erro');
      msg.textContent = `${limpo.length}/10 dígitos`;
      msg.style.color = 'var(--ink-soft)';
    } else if(CHAPA_REGEX.test(limpo)){
      inp.classList.add('ok');
      inp.classList.remove('erro');
      msg.textContent = 'Chapa válida ✓';
      msg.style.color = 'var(--green)';
    } else {
      inp.classList.add('erro');
      inp.classList.remove('ok');
      msg.textContent = 'Formato inválido';
      msg.style.color = 'var(--red)';
    }
  });

  /* ---------- Colar: força só números ---------- */
  inp.addEventListener('paste', e => {
    e.preventDefault();
    const colado = (e.clipboardData?.getData('text') || '')
      .replace(/\D/g, '').slice(0, 10);
    inp.value = colado;
    inp.dispatchEvent(new Event('input'));
  });

  /* ---------- Submit ---------- */
  form.onsubmit = async e => {
    e.preventDefault();
    if(logando) return;

    const chapa = inp.value.replace(/\D/g, '');

    if(chapa.length !== 10){
      inp.classList.add('erro');
      msg.textContent = 'Chapa deve ter 10 dígitos.';
      msg.style.color = 'var(--red)';
      inp.focus();
      return;
    }

    logando = true;
    msg.textContent = '';
    inp.classList.remove('erro');
    btn.disabled = true;
    btn.textContent = 'Verificando…';

    try {
      const u = await loginPorChapa(chapa);
      msg.textContent = `Acesso autorizado. Bem-vindo, ${u.nome.split(' ')[0]}!`;
      msg.style.color = 'var(--green)';
      toast(`Bem-vindo, ${u.nome.split(' ')[0]}`, 'green');

      /* ⚡ Admin vai pra relatórios · Funcionário vai pra registro */
      const destino = u.role === 'admin' ? 'relatorios' : 'registro';

      setTimeout(() => {
        logando = false;
        navigate(destino);
      }, 400);

    } catch(err){
      logando = false;
      inp.classList.add('erro');
      msg.textContent = err.message || 'Falha na autenticação';
      msg.style.color = 'var(--red)';
      btn.disabled = false;
      btn.textContent = 'Entrar';
      inp.select();
    }
  };

  setTimeout(() => inp.focus(), 60);
}

/* =========================================================
   ABA: ADMIN (SGA)
   ========================================================= */
function renderAbaAdmin(body, foot){
  foot.textContent = 'Acesso restrito à coordenação.';

  body.innerHTML = `
    <form id="formAdmin" class="login-form" autocomplete="on" novalidate>
      <div class="field">
        <label for="fAdminLogin">Login</label>
        <input type="text" id="fAdminLogin"
               placeholder="Digite seu usuário"
               autocomplete="username"
               autocapitalize="off" autocorrect="off">
      </div>
      <div class="field">
        <label for="fAdminSenha">Senha</label>
        <input type="password" id="fAdminSenha"
               placeholder="Digite sua senha"
               autocomplete="current-password"
               enterkeyhint="go">
      </div>
      <button type="submit" class="btn block primary" id="btnAdmin">
        Entrar como administrador
      </button>
      <p id="msgAdmin" class="login-msg"></p>
    </form>
  `;

  const form = document.getElementById('formAdmin');
  const btn  = document.getElementById('btnAdmin');
  const msg  = document.getElementById('msgAdmin');

  form.onsubmit = async e => {
    e.preventDefault();
    if(logando) return;

    const login = document.getElementById('fAdminLogin').value.trim();
    const senha = document.getElementById('fAdminSenha').value;

    if(!login){
      msg.textContent = 'Informe o login.';
      msg.style.color = 'var(--red)';
      document.getElementById('fAdminLogin').focus();
      return;
    }
    if(!senha){
      msg.textContent = 'Informe a senha.';
      msg.style.color = 'var(--red)';
      document.getElementById('fAdminSenha').focus();
      return;
    }

    logando = true;
    msg.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando…';

    try {
      const u = await loginAdmin(login, senha);
      toast(`Bem-vindo, ${u.nome}`, 'green');

      /* ⚡ Admin vai direto pra relatórios */
      setTimeout(() => {
        logando = false;
        navigate('relatorios');
      }, 400);

    } catch(err){
      logando = false;
      msg.textContent = err.message || 'Credenciais inválidas';
      msg.style.color = 'var(--red)';
      btn.disabled = false;
      btn.textContent = 'Entrar como administrador';
      document.getElementById('fAdminSenha').value = '';
      document.getElementById('fAdminLogin').focus();
    }
  };

  setTimeout(() => document.getElementById('fAdminLogin').focus(), 60);
}