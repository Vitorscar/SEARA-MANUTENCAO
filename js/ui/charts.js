/* =========================================================
   charts.js — visualizações para tomada de decisão (v2.0)
   Melhorias: Segurança (XSS), Acessibilidade, Edge-cases 
   matemáticos, responsividade e micro-interações.
   ========================================================= */

const PALETA = ['#C8102E','#FDB913','#1E7A3D','#1D4ED8','#8C0C21','#D89A00','#059669','#6366F1','#DC2626','#7C3AED'];

/* ---------- Helpers de Segurança e Formatação ---------- */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function truncar(s, n){ return s.length > n ? esc(s.slice(0, n - 1)) + '…' : esc(s); }
function vazio(txt){ return `<div class="chart-empty" role="status" style="padding:40px 16px; text-align:center; color:var(--muted-2); background:var(--panel-2); border-radius:8px; border:1px dashed var(--border);">${esc(txt)}</div>`; }

/* =========================================================
   barChart — colunas verticais (com scroll para muitos itens)
   ========================================================= */
export function barChart({ data, cor }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);
  const color = cor || 'var(--red)';
  const TRACK_H = 150;
  // Define largura mínima para as barras não ficarem microscópicas
  const minBarWidth = data.length > 15 ? 32 : 0; 

  return `
    <div style="width:100%; overflow-x:auto; overflow-y:hidden; padding-bottom:8px;" role="img" aria-label="Gráfico de barras verticais">
      <div style="display:grid; grid-template-columns:repeat(${data.length}, minmax(${minBarWidth}px, 1fr)); gap:6px; align-items:end; height:${TRACK_H + 40}px; width:100%; min-width: ${data.length * (minBarWidth + 6)}px; padding:0 4px; box-sizing:border-box;">
        ${data.map(d => {
          const pct = d.value === 0 ? 0 : Math.max(6, (d.value / max) * 100);
          return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px; min-width:0; height:100%;" title="${esc(d.label)}: ${d.value}">
              <div style="font-size:10px; font-weight:800; color:var(--ink); font-family:var(--mono); line-height:1;">${esc(d.value)}</div>
              <div style="width:100%; max-width:38px; height:${TRACK_H}px; background:var(--panel-2); border-radius:5px; display:flex; align-items:flex-end; overflow:hidden; border:1px solid var(--border); box-sizing:border-box;">
                <div style="width:100%; height:${pct}%; background:${color}; border-radius:4px 4px 0 0; min-height:${d.value > 0 ? '4px' : '0'}; transition:height 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
              </div>
              <div style="font-size:9.5px; color:var(--ink-soft); text-align:center; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${truncar(d.label, 8)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* =========================================================
   hBarChart — barras horizontais
   ========================================================= */
export function hBarChart({ data }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);

  return `
    <div style="display:flex; flex-direction:column; gap:10px;" role="img" aria-label="Gráfico de barras horizontais">
      ${data.map((d, i) => {
        const pct = Math.max(4, (d.value / max) * 100);
        return `
          <div style="display:grid; grid-template-columns:minmax(80px, 120px) 1fr minmax(40px, auto); gap:10px; align-items:center;" title="${esc(d.label)}">
            <div style="font-size:12px; color:var(--muted); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(d.label)}</div>
            <div style="height:10px; background:var(--panel-2); border-radius:5px; overflow:hidden; border:1px solid var(--border);">
              <div style="height:100%; width:${pct}%; background:${PALETA[i % PALETA.length]}; border-radius:5px; transition:width 0.5s ease-out;"></div>
            </div>
            <div style="font-family:var(--mono); font-weight:800; font-size:12px; color:var(--ink); text-align:right;">${esc(d.display || d.value)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* =========================================================
   chartTendencia — linha dupla (volume + MTTR)
   ========================================================= */
export function chartTendencia({ data }){
  if(!data.length) return vazio('Sem dados no período');

  const W = 640, H = 220, padL = 34, padR = 34, padT = 16, padB = 40; // Aumentei padB para labels rotacionadas
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVolume = Math.max(...data.map(d => d.total), 1);
  const maxMttr   = Math.max(...data.map(d => d.mttr), 1);
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const ptsVol  = data.map((d,i) => ({ x: padL + i * step, y: padT + innerH - (d.total / maxVolume) * innerH, ...d }));
  const ptsMttr = data.map((d,i) => ({ x: padL + i * step, y: padT + innerH - (d.mttr / maxMttr) * innerH, ...d }));

  const pathVol  = ptsVol.map((p,i)  => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const pathMttr = ptsMttr.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const areaVol  = `${pathVol} L ${ptsVol[ptsVol.length-1].x} ${padT+innerH} L ${padL} ${padT+innerH} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const y = padT + p * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 3" opacity="0.6"/>`;
  }).join('');

  // Evita sobreposição de labels no eixo X
  const passoLabel = Math.max(1, Math.ceil(data.length / 10));

  return `
    <div style="width:100%;" role="img" aria-label="Gráfico de tendência de paradas e MTTR">
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:8px;">
        <span style="display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--muted);">
          <span style="width:14px; height:3px; border-radius:2px; background:var(--red);"></span> Paradas
        </span>
        <span style="display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--muted);">
          <span style="width:14px; height:3px; border-radius:2px; background:var(--sun-dark); border-style:dashed;"></span> MTTR (min)
        </span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; max-height:280px; display:block;" preserveAspectRatio="xMidYMid meet">
        ${grid}
        <path d="${areaVol}" fill="var(--red)" opacity="0.08"/>
        <path d="${pathVol}" fill="none" stroke="var(--red)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${pathMttr}" fill="none" stroke="var(--sun-dark)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3"/>
        ${ptsVol.map((p,i) => {
          const show = i % passoLabel === 0 || i === data.length - 1;
          const rotate = data.length > 15 ? 'transform="rotate(-45 ${p.x} ${H-8})" text-anchor="end"' : 'text-anchor="middle"';
          return `
            <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--red)" stroke="#fff" stroke-width="1.5" style="cursor:pointer;">
              <title>${esc(p.dia)}: ${p.total} paradas | MTTR: ${p.mttr}min</title>
            </circle>
            ${show ? `<text x="${p.x}" y="${H-8}" font-size="9.5" fill="var(--muted)" font-weight="600" ${rotate}>${esc(p.dia)}</text>` : ''}
          `;
        }).join('')}
      </svg>
    </div>
  `;
}

/* =========================================================
   chartPareto
   ========================================================= */
export function chartPareto({ data }){
  if(!data.length) return vazio('Sem dados de falhas');

  const W = 640, H = 260, padL = 34, padR = 34, padT = 16, padB = 66;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.62, 40); // Limita largura máxima da barra
  const maxMin = Math.max(...data.map(d => d.minutos), 1);

  const bars = data.map((d, i) => {
    const h = (d.minutos / maxMin) * innerH;
    const x = padL + i * slot + (slot - barW) / 2;
    const y = padT + innerH - h;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="var(--red)" rx="3" opacity="0.88" style="transition:opacity 0.2s;"><title>${esc(d.label)}: ${d.minutos}min</title></rect>`;
  }).join('');

  const cumPts = data.map((d, i) => ({
    x: padL + i * slot + slot / 2,
    y: padT + innerH - (d.acumuladoPct / 100) * innerH
  }));
  const cumPath = cumPts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const y80 = padT + innerH - 0.8 * innerH;

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; max-height:300px; display:block;" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gráfico de Pareto de falhas">
      <line x1="${padL}" y1="${y80}" x2="${W-padR}" y2="${y80}" stroke="var(--sun-dark)" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.5"/>
      <text x="${W-padR-4}" y="${y80-4}" text-anchor="end" font-size="9" fill="var(--sun-dark)" font-weight="800">80%</text>
      ${bars}
      <path d="${cumPath}" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"/>
      ${cumPts.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--ink)" stroke="#fff" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y-7}" text-anchor="middle" font-size="9" fill="var(--ink)" font-weight="800">${data[i].acumuladoPct}%</text>
      `).join('')}
      ${data.map((d, i) => {
        const x = padL + i * slot + slot / 2;
        const label = d.label.length > 12 ? d.label.slice(0,11) + '…' : d.label;
        const rotate = data.length > 8 ? `transform="rotate(-35 ${x} ${padT+innerH+28})" text-anchor="end"` : 'text-anchor="middle"';
        return `
          <text x="${x}" y="${padT+innerH+14}" text-anchor="middle" font-size="9.5" fill="var(--ink)" font-weight="700">${d.minutos}m</text>
          <text x="${x}" y="${padT+innerH+28}" font-size="9" fill="var(--muted)" ${rotate}>${esc(label)}</text>
        `;
      }).join('')}
    </svg>
  `;
}

/* =========================================================
   chartHeatmap
   ========================================================= */
export function chartHeatmap({ dados, max, turnos }, dowLabels){
  if(!dados.length) return vazio('Sem dados');

  return `
    <div style="width:100%; overflow-x:auto;" role="img" aria-label="Mapa de calor de paradas por turno e dia">
      <div style="display:grid; grid-template-columns:auto repeat(${dowLabels.length}, 1fr); gap:4px; align-items:center; min-width: 400px;">
        <div style="width:60px;"></div>
        ${dowLabels.map(d => `<div style="text-align:center; font-size:10.5px; font-weight:800; color:var(--muted); padding:4px 0; text-transform:uppercase;">${esc(d)}</div>`).join('')}
        ${turnos.map((t, tIdx) => `
          <div style="font-size:11px; font-weight:700; color:var(--ink-soft); padding-right:8px; text-align:right; white-space:nowrap;">${esc(t.replace(' Turno',''))}</div>
          ${dados.map((row, dIdx) => {
            const v = row[tIdx] || 0;
            const intensity = max > 0 ? v / max : 0;
            const bg = v === 0 ? 'var(--panel-2)' : `rgba(200, 16, 46, ${0.15 + intensity * 0.8})`;
            const txt = intensity > 0.55 ? '#fff' : 'var(--ink)';
            return `<div style="aspect-ratio:1; min-height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11.5px; font-weight:800; border:1px solid var(--border); background:${bg}; color:${txt}; transition:transform 0.2s;" title="${esc(dowLabels[dIdx])} · ${esc(t)} · ${v} parada(s)">${v > 0 ? v : ''}</div>`;
          }).join('')}
        `).join('')}
      </div>
    </div>
  `;
}

/* =========================================================
   chartRanking
   ========================================================= */
export function chartRanking({ data, cor }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data.map(d => d.value), 1);
  const color = cor || 'var(--red)';

  return `
    <div style="display:flex; flex-direction:column; gap:14px;" role="list" aria-label="Ranking">
      ${data.map((d, i) => {
        const pct = Math.max(4, (d.value / max) * 100);
        return `
          <div style="display:grid; grid-template-columns:26px 1fr; gap:10px; align-items:flex-start;" role="listitem">
            <div style="width:26px; height:26px; border-radius:50%; background:var(--red-dim); color:var(--red); font-weight:900; font-size:12px; display:flex; align-items:center; justify-content:center;">${i + 1}</div>
            <div style="min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:5px;">
                <span style="font-size:13px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(d.label)}</span>
                <span style="font-family:var(--mono); font-size:12.5px; font-weight:800; color:var(--ink); white-space:nowrap; text-align:right;">
                  ${esc(d.display || d.value)}
                  ${d.sub ? `<small style="display:block; font-size:10px; color:var(--muted); font-weight:600; margin-top:1px;">${esc(d.sub)}</small>` : ''}
                </span>
              </div>
              <div style="height:8px; background:var(--panel-2); border-radius:5px; overflow:hidden; border:1px solid var(--border);">
                <div style="height:100%; width:${pct}%; background:${color}; border-radius:5px; transition:width 0.5s ease-out;"></div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* =========================================================
   chartPorHora
   ========================================================= */
export function chartPorHora({ data }){
  if(!data.length) return vazio('Sem dados');
  const max = Math.max(...data, 1);

  return `
    <div style="display:grid; grid-template-columns:repeat(24, 1fr); gap:2px; align-items:end; height:150px; padding:0 4px;" role="img" aria-label="Gráfico de paradas por hora">
      ${data.map((v, h) => {
        const pct = (v / max) * 100;
        return `
          <div style="display:flex; flex-direction:column; align-items:center; gap:3px; height:100%; justify-content:flex-end; min-width:0;" title="${String(h).padStart(2,'0')}:00 — ${v} parada(s)">
            <div style="width:100%; height:${pct}%; background:linear-gradient(180deg, var(--red), var(--red-dark)); border-radius:3px 3px 0 0; min-height:2px; position:relative; transition:height 0.3s ease;">
              ${v > 0 ? `<span style="position:absolute; top:-14px; left:50%; transform:translateX(-50%); font-size:8.5px; font-weight:800; color:var(--red);">${v}</span>` : ''}
            </div>
            <div style="font-size:8.5px; color:var(--muted); font-weight:700;">${String(h).padStart(2,'0')}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* =========================================================
   chartDonut (Corrigido para fatias de 100% e 0%)
   ========================================================= */
export function chartDonut({ data }){
  if(!data.length) return vazio('Sem dados');
  const total = data.reduce((s,d) => s + d.value, 0) || 1;
  const raio = 40, cx = 50, cy = 50;
  let ang = -Math.PI / 2;

  const arcos = data.map((d, i) => {
    if (d.value === 0) return ''; // Ignora fatias zeradas
    
    let slice = (d.value / total) * Math.PI * 2;
    
    // Correção crítica: SVG não desenha arcos de 360 graus (2*PI) corretamente.
    // Subtraímos um epsilon minúsculo para forçar o SVG a renderizar o círculo completo.
    if (slice >= Math.PI * 2) slice = Math.PI * 2 - 0.0001; 

    const x1 = cx + Math.cos(ang) * raio;
    const y1 = cy + Math.sin(ang) * raio;
    const x2 = cx + Math.cos(ang + slice) * raio;
    const y2 = cy + Math.sin(ang + slice) * raio;
    const large = slice > Math.PI ? 1 : 0;
    
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${raio} ${raio} 0 ${large} 1 ${x2} ${y2} Z`;
    ang += slice;
    return `<path d="${path}" fill="${PALETA[i % PALETA.length]}" style="transition:opacity 0.2s;"><title>${esc(d.label)}: ${d.value} min (${Math.round(d.value/total*100)}%)</title></path>`;
  }).join('');

  return `
    <div style="display:grid; grid-template-columns:1fr; gap:14px; align-items:center;" role="img" aria-label="Gráfico de rosca de distribuição">
      <svg viewBox="0 0 100 100" style="width:170px; height:170px; margin:0 auto; display:block;">
        ${arcos}
        <circle cx="50" cy="50" r="24" fill="var(--panel)"/>
        <text x="50" y="47" text-anchor="middle" font-size="11" font-weight="900" fill="var(--ink)">${Math.round(total/60)}h</text>
        <text x="50" y="58" text-anchor="middle" font-size="5.5" fill="var(--ink-soft)">total</text>
      </svg>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${data.filter(d => d.value > 0).map((d, i) => {
          const pct = Math.round(d.value / total * 100);
          return `
            <div style="display:grid; grid-template-columns:12px 1fr auto; gap:8px; align-items:center; font-size:12.5px;">
              <span style="width:11px; height:11px; border-radius:3px; background:${PALETA[i % PALETA.length]};"></span>
              <span style="color:var(--muted); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(d.label)}</span>
              <span style="font-family:var(--mono); font-weight:800; color:var(--ink); font-size:12px;">${pct}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}