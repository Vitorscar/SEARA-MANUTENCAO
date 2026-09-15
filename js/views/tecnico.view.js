/* =========================================================
   tecnico.view.js — ficha do funcionário
   Gráficos + KPIs + histórico de paradas
   ========================================================= */

import { state, getMaquina, getTecnico, statusTecnico } from '../core/state.js';
import { navigate }                                     from '../core/router.js';
import { barChart, hBarChart }                          from '../ui/charts.js';
import { fmtMin, fmtDuracaoMin, escapeHtml }            from '../core/utils.js';

/* ---------- Estado do filtro da tabela (módulo-scoped) ---------- */
let filtro = { ordenarPor: 'data', direcao: 'desc' };

/* =========================================================
   FUNÇÃO PRINCIPAL (chamada pelo router)
   ========================================================= */
export function renderTecnico(params = {}){
  const view = document.getElementById('view');
  if(!view) return;

  /* ---------- 1) Resolve o id ---------- */
  const id = params?.id
           || state.tecnicoAtualId
           || state.currentParams?.id;

  if(!id){
    view.innerHTML = `<div class="empty" style="padding:40px;text-align:center;">
      Nenhum funcionário selecionado.<br>
      <button class="btn btn--secondary" style="width:auto;margin-top:12px;"
              onclick="tecnicoVoltar()">Voltar</button>
    </div>`;
    return;
  }

  const t = getTecnico(id);
  if(!t){
    view.innerHTML = `<div class="empty" style="padding:40px;text-align:center;">
      Funcionário não encontrado.<br>
      <button class="btn btn--secondary" style="width:auto;margin-top:12px;"
              onclick="tecnicoVoltar()">Voltar</button>
    </div>`;
    return;
  }

  /* ---------- 2) Dados base ---------- */
  const st      = statusTecnico(t.id);
  const paradas = (state.db?.paradas || []).filter(p => p.tecnicoId === t.id);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  /* ---------- 3) KPIs ---------- */
  const hoje = hojeISO();
  const hojeParadas = encerradas.filter(p => p.horaFim && paraISO(p.horaFim) === hoje);
  const totalMin    = encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0);
  const mttr        = encerradas.length
    ? Math.round(totalMin / encerradas.length)
    : null;

  /* ---------- 4) Gráfico: paradas por dia (14 dias) ---------- */
  const diasChart = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(Date.now() - i * 86400000);
    const key = paraISO(d);
    const cnt = encerradas.filter(p =>
      p.horaFim && paraISO(p.horaFim) === key
    ).length;
    diasChart.push({
      label: d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      value: cnt
    });
  }

  /* ---------- 5) Gráfico: top máquinas ---------- */
  const porMaquina = {};
  encerradas.forEach(p => {
    const m = getMaquina(p.maquinaId);
    const n = m?.nome || '—';
    porMaquina[n] = (porMaquina[n] || 0) + 1;
  });
  const topMaq = Object.entries(porMaquina)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  /* ---------- 6) Histórico ordenado ---------- */
  const historico = [...paradas].sort((a,b) => {
    const cmp = filtro.ordenarPor === 'data'
      ? (a.horaInicio || 0) - (b.horaInicio || 0)
      : ((a.duracaoMin ?? minutosDecorridos(a)) -
         (b.duracaoMin ?? minutosDecorridos(b)));
    return filtro.direcao === 'desc' ? -cmp : cmp;
  });

  /* ---------- 7) HTML ---------- */
  view.innerHTML = `
    <div class="tecnico-header">
      <button type="button" class="btn btn--ghost" style="width:auto"
              onclick="tecnicoVoltar()">← Voltar</button>
    </div>

    <div class="tecnico-perfil">
      <div class="tp-avatar">${iniciais(t.nome)}</div>
      <div class="tp-info">
        <h1 class="tp-nome">${escapeHtml(t.nome)}</h1>
        <div class="tp-meta">
          ${escapeHtml(t.especialidade || '—')}
          ${t.chapa ? ` · Chapa ${escapeHtml(t.chapa)}` : ''}
          ${t.turno ? ` · ${escapeHtml(t.turno)}` : ''}
        </div>
      </div>
      <span class="eq-status ${st.status === 'atendendo' ? 'sun' : 'green'}">
        <span class="dot ${st.status === 'atendendo' ? 'sun' : 'green'}"></span>
        ${st.status === 'atendendo' ? 'Atendendo' : 'Disponível'}
      </span>
    </div>

    ${st.status === 'atendendo' ? `
      <div class="tp-current">
        <div class="tp-current-lbl">Atendendo agora</div>
        <div class="tp-current-body">
          <b>${escapeHtml(st.maquina || '—')}</b>
          <span class="tp-current-time">${fmtMin(Date.now() - st.desde)}</span>
        </div>
      </div>
    ` : ''}

    <div class="kpi-grid">
      <div class="kpi"><b>${hojeParadas.length}</b><span>Hoje</span></div>
      <div class="kpi"><b>${encerradas.length}</b><span>Total</span></div>
      <div class="kpi"><b>${mttr ? mttr + 'm' : '—'}</b><span>MTTR médio</span></div>
      <div class="kpi"><b>${fmtDuracaoMin(totalMin)}</b><span>Tempo total</span></div>
    </div>

    <div class="section-head"><h2>Paradas — últimos 14 dias</h2></div>
    <div class="chart-card">
      ${barChart({ data: diasChart, cor:'var(--red)' })}
    </div>

    <div class="section-head"><h2>Máquinas que atendeu</h2></div>
    <div class="chart-card">
      ${hBarChart({ data: topMaq })}
    </div>

    <div class="section-head"><h2>Histórico de paradas</h2></div>
    <div class="hist-tabela-wrap">
      <table class="hist-tabela">
        <thead>
          <tr>
            <th data-sort="data">Data ${arrow('data')}</th>
            <th>Máquina</th>
            <th data-sort="duracao">Duração ${arrow('duracao')}</th>
            <th>Falha</th>
            <th>Ação</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${historico.length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">
                 Nenhuma parada registrada.
               </td></tr>`
            : historico.map(p => {
                const m   = getMaquina(p.maquinaId);
                const dur = p.duracaoMin ?? minutosDecorridos(p);
                return `
                  <tr>
                    <td>${formatarData(p.horaInicio)}</td>
                    <td>${escapeHtml(m?.nome || '—')}</td>
                    <td>${fmtDuracaoMin(dur)}</td>
                    <td>
                      ${escapeHtml(p.categoria || '—')}<br>
                      <span style="color:var(--muted);font-size:11px;">
                        ${escapeHtml(p.subcausa || p.componente || '')}
                      </span>
                    </td>
                    <td>${escapeHtml(p.acaoComponente || '—')}</td>
                    <td><span class="tag tag-${tagStatus(p.status)}">${labelStatus(p.status)}</span></td>
                  </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  /* ---------- 8) Ordenação ---------- */
  view.querySelectorAll('.hist-tabela th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const campo = th.dataset.sort;
      if(filtro.ordenarPor === campo){
        filtro.direcao = filtro.direcao === 'desc' ? 'asc' : 'desc';
      } else {
        filtro.ordenarPor = campo;
        filtro.direcao = 'desc';
      }
      renderTecnico({ id: t.id });
    });
  });
}

/* =========================================================
   CONTROLLER (para uso com registerRoute)
   ========================================================= */
export const tecnicoController = {
  async mount(root, params){
    renderTecnico(params || {});
  },
  unmount(){}
};

/* =========================================================
   HELPERS
   ========================================================= */
function iniciais(nome){
  return String(nome || '?')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0,2)
    .join('')
    .toUpperCase();
}

function minutosDecorridos(p){
  if(!p?.horaInicio) return 0;
  return Math.max(0, Math.round((Date.now() - p.horaInicio) / 60000));
}

function arrow(campo){
  if(filtro.ordenarPor !== campo) return '↕';
  return filtro.direcao === 'desc' ? '↓' : '↑';
}

function tagStatus(s){
  return {
    aguardando: 'alto',
    atendendo:  'medio',
    encerrada:  'baixo',
    cancelada:  'critico'
  }[s] || 'baixo';
}

function labelStatus(s){
  return {
    aguardando: 'Aguardando',
    atendendo:  'Atendendo',
    encerrada:  'Encerrada',
    cancelada:  'Cancelada'
  }[s] || s;
}

function hojeISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function paraISO(ts){
  const d = ts instanceof Date ? ts : new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatarData(ts){
  if(!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
}