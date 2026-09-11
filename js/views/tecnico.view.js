/* =========================================================
   tecnico.view.js — ficha do funcionário com gráficos + tabela
   ========================================================= */

import { state, getMaquina, getTecnico, statusTecnico } from '../core/state.js';
import { navigate } from '../core/router.js';
import { barChart, hBarChart } from '../ui/charts.js';
import { fmtMin, fmtDuracaoMin, escapeHtml } from '../core/utils.js';

let filtro = { ordenarPor: 'data', direcao: 'desc' };

export function renderTecnico({ id } = {}){
  const t = getTecnico(id);
  if(!t){
    document.getElementById('view').innerHTML =
      `<div class="empty">Funcionário não encontrado.</div>`;
    return;
  }

  const st = statusTecnico(t.id);
  const paradas = state.db.paradas.filter(p => p.tecnicoId === t.id);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  const hoje = new Date().toISOString().slice(0,10);
  const hojeParadas = encerradas.filter(p =>
    p.horaFim && new Date(p.horaFim).toISOString().slice(0,10) === hoje
  );
  const totalMin = encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0);
  const mttr = encerradas.length ? Math.round(totalMin / encerradas.length) : null;

  /* Chart 1: paradas por dia (últimos 14 dias) */
  const diasChart = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0,10);
    const cnt = encerradas.filter(p =>
      p.horaFim && new Date(p.horaFim).toISOString().slice(0,10) === key
    ).length;
    diasChart.push({
      label: d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      value: cnt
    });
  }

  /* Chart 2: top máquinas atendidas */
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

  /* Tabela ordenada */
  const historico = [...paradas].sort((a,b) => {
    const cmp = filtro.ordenarPor === 'data'
      ? a.horaInicio - b.horaInicio
      : (a.duracaoMin ?? minutosDecorridos(a)) - (b.duracaoMin ?? minutosDecorridos(b));
    return filtro.direcao === 'desc' ? -cmp : cmp;
  });

  document.getElementById('view').innerHTML = `
    <div class="tecnico-header">
      <button class="btn sm ghost" onclick="navigate('equipe')">← Voltar para equipe</button>
    </div>

    <div class="tecnico-perfil">
      <div class="tp-avatar">${iniciais(t.nome)}</div>
      <div class="tp-info">
        <h1 class="tp-nome">${escapeHtml(t.nome)}</h1>
        <div class="tp-meta">
          ${escapeHtml(t.especialidade)}
          ${t.matricula ? ` · ${escapeHtml(t.matricula)}` : ''}
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
            ? `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:24px;">Nenhuma parada registrada.</td></tr>`
            : historico.map(p => {
                const m = getMaquina(p.maquinaId);
                const dur = p.duracaoMin ?? minutosDecorridos(p);
                return `
                  <tr>
                    <td>${new Date(p.horaInicio).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}</td>
                    <td>${escapeHtml(m?.nome || '—')}</td>
                    <td>${fmtDuracaoMin(dur)}</td>
                    <td>
                      ${escapeHtml(p.categoria || '—')}<br>
                      <span style="color:var(--muted); font-size:11px;">${escapeHtml(p.subcausa || '')}</span>
                    </td>
                    <td>${escapeHtml(p.acaoComponente || '—')}</td>
                    <td><span class="tag tag-${tagStatus(p.status)}">${labelStatus(p.status)}</span></td>
                  </tr>
                `;
              }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('.hist-tabela th[data-sort]').forEach(th => {
    th.onclick = () => {
      const campo = th.dataset.sort;
      if(filtro.ordenarPor === campo){
        filtro.direcao = filtro.direcao === 'desc' ? 'asc' : 'desc';
      } else {
        filtro.ordenarPor = campo;
        filtro.direcao = 'desc';
      }
      renderTecnico({ id: t.id });
    };
  });
}

/* ---------- helpers locais ---------- */
function iniciais(nome){
  return nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
}
function minutosDecorridos(p){
  return Math.max(0, Math.round((Date.now() - p.horaInicio) / 60000));
}
function arrow(campo){
  if(filtro.ordenarPor !== campo) return '↕';
  return filtro.direcao === 'desc' ? '↓' : '↑';
}
function tagStatus(s){
  return { aguardando:'alto', atendendo:'medio', encerrada:'baixo', cancelada:'critico' }[s] || 'baixo';
}
function labelStatus(s){
  return { aguardando:'Aguardando', atendendo:'Atendendo', encerrada:'Encerrada', cancelada:'Cancelada' }[s] || s;
}