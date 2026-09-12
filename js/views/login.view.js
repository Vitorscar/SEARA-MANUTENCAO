/* =========================================================
   login.view.js — chapa (funcionário) + admin (backup)
   ========================================================= */

import { loginPorChapa, loginAdmin } from '../services/auth.service.js';
import { CHAPA_REGEX } from '../data/turnos.js';
import { toast } from '../ui/toast.js';
import { navigate } from '../core/router.js'; // ← Adicionado para navegação SPA

let aba = 'chapa'; // 'chapa' | 'admin'

export function renderLogin() {
  document.getElementById('view').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">

        <div class="login-brand">
          <div class="login-mark">☀</div>
          <h1>Gestão de Paradas</h1>
          <p>Seara · Manutenção industrial</p>
        </div>

        <div class="login-tabs">
          <button type="button" class="login-tab ${aba === 'chapa' ? 'active' : ''}" data-tab="chapa">
            <span class="login-tab-ic">👷</span>
            <span>Chapa</span>
          </button>
          <button type="button" class="login-tab ${aba === 'admin' ? 'active' : ''}" data-tab="admin">
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
      aba = t.dataset.tab;
      document.querySelectorAll('.login-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderCorpo();
    };
  });

  renderCorpo();
}

/* =========================================================
   Corpo da aba
   ========================================================= */
function renderCorpo() {
  const body = document.getElementById('loginBody');
  const foot = document.getElementById('loginFoot');

  /* ---------- CHAPA ---------- */
  if (aba === 'chapa') {
    foot.textContent = 'Use a chapa de 9 dígitos. O acesso é liberado apenas durante seu turno.';
    body.innerHTML = `
      <form id="formChapa" class="login-form" autocomplete="off" novalidate>
        <div class="field">
          <label for="fChapa">Número da chapa</label>
          <input type="text"
                 id="fChapa"
                 class="chapa-input"
                 inputmode="numeric"
                 pattern="\\d{9}"
                 maxlength="9"
                 placeholder="000000000"
                 autocomplete="username"
                 spellcheck="false">
          <small class="chapa-hint">9 dígitos · apenas números</small>
        </div>

        <button type="submit" class="btn block primary" id="btnEntrar">
          Entrar
        </button>

        <p id="msgLogin" class="login-msg"></p>
      </form>
    `;

    const form = document.getElementById('formChapa');
    const inp = document.getElementById('fChapa');
    const btn = document.getElementById('btnEntrar');
    const msg = document.getElementById('msgLogin');

    /* Filtra digitação: só números */
    inp.addEventListener('input', () => {
      const limpo = inp.value.replace(/\D/g, '').slice(0, 9);
      if (limpo !== inp.value) inp.value = limpo;

      /* Feedback em tempo real */
      if (limpo.length === 0) {
        inp.classList.remove('ok', 'erro');
        msg.textContent = '';
      } else if (limpo.length < 9) {
        inp.classList.remove('ok', 'erro');
        msg.textContent = `${limpo.length}/9 dígitos`;
        msg.style.color = 'var(--muted)';
      } else if (CHAPA_REGEX.test(limpo)) {
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

    /* Colar — garante que só números entram */
    inp.addEventListener('paste', e => {
      e.preventDefault();
      const colado = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 9);
      inp.value = colado;
      inp.dispatchEvent(new Event('input'));
    });

    form.onsubmit = async e => {
      e.preventDefault();
      msg.textContent = '';
      inp.classList.remove('erro');
      btn.disabled = true;
      btn.textContent = 'Verificando…';

      try {
        const u = await loginPorChapa(inp.value);
        msg.textContent = `Acesso autorizado. Bem-vindo, ${u.nome.split(' ')[0]}!`;
        msg.style.color = 'var(--green)';
        toast(`Bem-vindo, ${u.nome.split(' ')[0]}`, 'green');
        
        /* Navegação SPA em vez de reload */
        setTimeout(() => navigate('radar'), 500);
        
      } catch (err) {
        inp.classList.add('erro');
        msg.textContent = err.message || 'Falha na autenticação';
        msg.style.color = 'var(--red)';
        
        if (err.detalhe) {
          const d = document.createElement('small');
          d.style.display = 'block';
          d.style.color = 'var(--muted)';
          d.style.marginTop = '4px';
          d.textContent = err.detalhe;
          msg.appendChild(d);
        }
        
        btn.disabled = false;
        btn.textContent = 'Entrar';
        inp.select();
      }
    };

    setTimeout(() => inp.focus(), 60);
  }

  /* ---------- ADMIN ---------- */
  else {
    foot.textContent = 'Acesso restrito à coordenação de manutenção.';
    body.innerHTML = `
      <form id="formAdmin" class="login-form" autocomplete="on">
        <div class="field">
          <label for="fAdminLogin">Login</label>
          <input type="text" 
                 id="fAdminLogin" 
                 placeholder="Digite seu usuário"
                 autocomplete="username" 
                 value="">
        </div>
        <div class="field">
          <label for="fAdminSenha">Senha</label>
          <input type="password" 
                 id="fAdminSenha" 
                 placeholder="Digite sua senha"
                 autocomplete="current-password" 
                 value=""> <!-- Removido value="123456" por segurança -->
        </div>

        <button type="submit" class="btn block primary" id="btnAdmin">
          Entrar como administrador
        </button>

        <p id="msgAdmin" class="login-msg"></p>
      </form>
    `;

    const form = document.getElementById('formAdmin');
    const btn = document.getElementById('btnAdmin');
    const msg = document.getElementById('msgAdmin');

    form.onsubmit = async e => {
      e.preventDefault();
      msg.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Entrando…';

      try {
        const u = await loginAdmin(
          document.getElementById('fAdminLogin').value.trim(),
          document.getElementById('fAdminSenha').value
        );
        
        toast(`Bem-vindo, ${u.nome}`, 'green');
        
        /* Navegação SPA em vez de reload */
        setTimeout(() => navigate('radar'), 400);
        
      } catch (err) {
        msg.textContent = err.message || 'Credenciais inválidas';
        msg.style.color = 'var(--red)';
        btn.disabled = false;
        btn.textContent = 'Entrar como administrador';
        
        // Limpa a senha em caso de erro para segurança
        document.getElementById('fAdminSenha').value = '';
        document.getElementById('fAdminLogin').focus();
      }
    };

    setTimeout(() => document.getElementById('fAdminLogin').focus(), 60);
  }
}