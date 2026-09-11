/* =========================================================
   charts.js — visualizações para tomada de decisão
   Inclui: barChart, hBarChart (simples) + avançadas
   ========================================================= */

const PALETA = ['#C8102E','#FDB913','#1E7A3D','#1D4ED8','#8C0C21','#D89A00','#059669','#6366F1','#DC2626','#7C3AED'];

/* =========================================================
   SIMPLES — usadas no técnico e em qualquer lugar
   ========================================================= */

/* ---------- Barras verticais ---------- */
export function barChart({ data, cor }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);

  return `
    <div class="chart-bars">
      ${data.map(d => {
        const pct = (d.value / max) * 100;
        return `
          <div class="bar-col">
            <div class="bar-val">${d.value}</div>
            <div class="bar-track">
              <div class="bar-fill" style="height:${pct}%; background:${cor || 'var(--red)'};"></div>
            </div>
            <div class="bar-lbl" title="${d.label}">${truncar(d.label, 8)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ---------- Barras horizontais ---------- */
export function hBarChart({ data }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);

  return `
    <div class="chart-hbars">
      ${data.map((d, i) => `
        <div class="hb-row">
          <div class="hb-label" title="${d.label}">${d.label}</div>
          <div class="hb-track">
            <div class="hb-fill" style="width:${(d.value / max) * 100}%; background:${PALETA[i % PALETA.length]};"></div>
          </div>
          <div class="hb-value">${d.display || d.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* =========================================================
   AVANÇADAS — dashboard de relatórios
   ========================================================= */

/* ---------- 1) Tendência (linha dupla: volume + MTTR) ---------- */
export function chartTendencia({ data }){
  if(!data.length) return vazio('Sem dados no período');

  const W = 640, H = 200, padL = 34, padR = 34, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVolume = Math.max(...data.map(d => d.total), 1);
  const maxMttr   = Math.max(...data.map(d => d.mttr), 1);
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const ptsVol  = data.map((d,i) => ({
    x: padL + i * step,
    y: padT + innerH - (d.total / maxVolume) * innerH,
    ...d
  }));
  const ptsMttr = data.map((d,i) => ({
    x: padL + i * step,
    y: padT + innerH - (d.mttr / maxMttr) * innerH,
    ...d
  }));

  const pathVol  = ptsVol.map((p,i)  => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const pathMttr = ptsMttr.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const areaVol  = `${pathVol} L ${ptsVol[ptsVol.length-1].x} ${padT+innerH} L ${padL} ${padT+innerH} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const y = padT + p * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"
      stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 3" opacity="0.6"/>`;
  }).join('');

  return `
    <div class="chart-tendencia">
      <div class="chart-legend-top">
        <span class="legend-inline">
          <span class="legend-bar" style="background:var(--red)"></span> Paradas
        </span>
        <span class="legend-inline">
          <span class="legend-bar" style="background:var(--sun-dark)"></span> MTTR (min)
        </span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        ${grid}
        <path d="${areaVol}" fill="var(--red)" opacity="0.08"/>
        <path d="${pathVol}" fill="none" stroke="var(--red)" stroke-width="2.4"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${pathMttr}" fill="none" stroke="var(--sun-dark)" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3"/>
        ${ptsVol.map((p,i) => {
          const passo = Math.ceil(data.length / 7);
          const show = i % passo === 0 || i === data.length - 1;
          return `
            <circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--red)" stroke="#fff" stroke-width="1.5"/>
            ${show ? `<text x="${p.x}" y="${H-8}" text-anchor="middle" font-size="9.5"
                fill="var(--muted)" font-weight="600">${p.dia}</text>` : ''}
          `;
        }).join('')}
      </svg>
    </div>
  `;
}

/* ---------- 2) Pareto ---------- */
export function chartPareto({ data }){
  if(!data.length) return vazio('Sem dados de falhas');

  const W = 640, H = 240, padL = 34, padR = 34, padT = 16, padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / data.length;
  const barW = slot * 0.62;
  const maxMin = Math.max(...data.map(d => d.minutos), 1);

  const bars = data.map((d, i) => {
    const h = (d.minutos / maxMin) * innerH;
    const x = padL + i * slot + (slot - barW) / 2;
    const y = padT + innerH - h;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}"
              fill="var(--red)" rx="3" opacity="0.88"/>`;
  }).join('');

  const cumPts = data.map((d, i) => ({
    x: padL + i * slot + slot / 2,
    y: padT + innerH - (d.acumuladoPct / 100) * innerH
  }));
  const cumPath = cumPts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const y80 = padT + innerH - 0.8 * innerH;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      <line x1="${padL}" y1="${y80}" x2="${W-padR}" y2="${y80}"
        stroke="var(--sun-dark)" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.5"/>
      <text x="${W-padR-4}" y="${y80-4}" text-anchor="end" font-size="9"
        fill="var(--sun-dark)" font-weight="800">80%</text>

      ${bars}
      <path d="${cumPath}" fill="none" stroke="var(--ink)" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"/>

      ${cumPts.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--ink)" stroke="#fff" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y-7}" text-anchor="middle" font-size="9"
          fill="var(--ink)" font-weight="800">${data[i].acumuladoPct}%</text>
      `).join('')}

      ${data.map((d, i) => {
        const x = padL + i * slot + slot / 2;
        const label = d.label.length > 12 ? d.label.slice(0,11) + '…' : d.label;
        return `
          <text x="${x}" y="${padT+innerH+14}" text-anchor="middle" font-size="9.5"
            fill="var(--ink)" font-weight="700">${d.minutos}m</text>
          <text x="${x}" y="${padT+innerH+28}" text-anchor="middle" font-size="9"
            fill="var(--muted)">${label}</text>
        `;
      }).join('')}
    </svg>
  `;
}

/* ---------- 3) Heatmap Turno × Dia ---------- */
export function chartHeatmap({ dados, max, turnos }, dowLabels){
  if(!dados.length) return vazio('Sem dados');

  return `
    <div class="heatmap">
      <div class="heatmap-grid">
        <div class="heatmap-corner"></div>
        ${dowLabels.map(d => `<div class="heatmap-dow">${d}</div>`).join('')}

        ${turnos.map((t, tIdx) => `
          <div class="heatmap-turno">${t.replace(' Turno','')}</div>
          ${dados.map((row, dIdx) => {
            const v = row[tIdx];
            const intensity = max > 0 ? v / max : 0;
            const bg = v === 0
              ? 'var(--panel-2)'
              : `rgba(200, 16, 46, ${0.1 + intensity * 0.85})`;
            const txt = intensity > 0.55 ? '#fff' : 'var(--ink)';
            return `
              <div class="heatmap-cell" style="background:${bg}; color:${txt}"
                   title="${dowLabels[dIdx]} · ${t} · ${v} parada(s)">
                ${v > 0 ? v : ''}
              </div>
            `;
          }).join('')}
        `).join('')}
      </div>
      <div class="heatmap-scale">
        <span class="heatmap-lbl">Menos</span>
        ${[0.1, 0.3, 0.5, 0.7, 0.9].map(i =>
          `<span class="heatmap-dot" style="background:rgba(200,16,46,${i})"></span>`
        ).join('')}
        <span class="heatmap-lbl">Mais</span>
      </div>
    </div>
  `;
}

/* ---------- 4) Ranking ---------- */
export function chartRanking({ data, cor }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);

  return `
    <div class="chart-ranking">
      ${data.map((d, i) => `
        <div class="rank-row">
          <div class="rank-pos">${i + 1}</div>
          <div class="rank-body">
            <div class="rank-head">
              <span class="rank-name" title="${d.label}">${d.label}</span>
              <span class="rank-val">
                <b>${d.display || d.value}</b>
                ${d.sub ? `<small>${d.sub}</small>` : ''}
              </span>
            </div>
            <div class="rank-track">
              <div class="rank-fill" style="width:${(d.value / max) * 100}%; background:${cor || 'var(--red)'};"></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ---------- 5) Distribuição horária ---------- */
export function chartPorHora({ data }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data, 1);

  return `
    <div class="chart-hours">
      ${data.map((v, h) => {
        const pct = (v / max) * 100;
        return `
          <div class="hour-col" title="${String(h).padStart(2,'0')}:00 — ${v} parada(s)">
            <div class="hour-fill" style="height:${pct}%;">
              ${v > 0 ? `<span class="hour-val">${v}</span>` : ''}
            </div>
            <div class="hour-lbl">${String(h).padStart(2,'0')}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ---------- 6) Donut ---------- */
export function chartDonut({ data }){
  if(!data.length) return vazio('Sem dados');
  const total = data.reduce((s,d) => s + d.value, 0) || 1;
  const raio = 40, cx = 50, cy = 50;
  let ang = -Math.PI / 2;

  const arcos = data.map((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const x1 = cx + Math.cos(ang) * raio;
    const y1 = cy + Math.sin(ang) * raio;
    const x2 = cx + Math.cos(ang + slice) * raio;
    const y2 = cy + Math.sin(ang + slice) * raio;
    const large = slice > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${raio} ${raio} 0 ${large} 1 ${x2} ${y2} Z`;
    ang += slice;
    return `<path d="${path}" fill="${PALETA[i % PALETA.length]}">
      <title>${d.label}: ${d.value} min</title>
    </path>`;
  }).join('');

  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 100 100" class="donut-svg">
        ${arcos}
        <circle cx="50" cy="50" r="24" fill="var(--panel)"/>
        <text x="50" y="47" text-anchor="middle" font-size="11"
              font-weight="900" fill="var(--ink)">${Math.round(total/60)}h</text>
        <text x="50" y="58" text-anchor="middle" font-size="5.5"
              fill="var(--ink-soft)">total</text>
      </svg>
      <div class="donut-legend">
        ${data.map((d, i) => {
          const pct = Math.round(d.value / total * 100);
          return `
            <div class="donut-leg">
              <span class="leg-dot" style="background:${PALETA[i % PALETA.length]}"></span>
              <span class="leg-lbl">${d.label}</span>
              <span class="leg-val">${pct}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ---------- Helpers ---------- */
function truncar(s, n){ return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function vazio(txt){ return `<div class="chart-empty">${txt}</div>`; }