(() => {
'use strict';

const PRINT_ID = 'mfDoctorPrint';

function text(el){ return (el?.textContent || '').replace(/\s+/g,' ').trim(); }
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function parseCount(line,label){
  const m = String(line||'').match(new RegExp(`(\\d+)\\s+${label}`,'i'));
  return m ? m[1] : '—';
}

function doctorData(){
  if(document.body.dataset.screen !== 'doctor') return null;
  const snapshot = document.querySelector('.doctor-summary-card');
  const snapshotTitle = text(snapshot?.querySelector('strong')) || 'Baby care summary';
  const snapshotSub = text(snapshot?.querySelector('span')) || 'Logged care summary';

  const metrics = [...document.querySelectorAll('.qa-grid > div')].map(card => ({
    label: text(card.querySelector('span')),
    value: text(card.querySelector('strong')),
    note: text(card.querySelector('small'))
  })).filter(x => x.label || x.value);

  const daily = [...document.querySelectorAll('.daily-table .daily-row:not(.daily-head)')].map(row => {
    const date = text(row.querySelector('.daily-date strong'));
    const rollup = text(row.querySelector('.daily-date small'));
    const cells = [...row.querySelectorAll('.daily-cell')];
    const byClass = cls => {
      const c = cells.find(x => x.classList.contains(cls));
      return text(c?.querySelector('b')) || '—';
    };
    return {
      date,
      wet: byClass('wet'),
      poop: byClass('poop'),
      mixed: byClass('mixed'),
      diapers: parseCount(rollup,'diapers'),
      feeds: byClass('feeds'),
      milk: byClass('milk')
    };
  }).filter(r => r.date);

  const range = snapshotTitle.match(/(\d+)-day/i)?.[1];
  const babyName = snapshotTitle.split('·')[0]?.trim() || 'Baby';
  return {snapshotTitle,snapshotSub,metrics,daily,range,babyName};
}

function summaryRows(metrics){
  if(!metrics.length) return '<tr><td colspan="3">No summary metrics available.</td></tr>';
  return metrics.map(m => `<tr>
    <td class="metric">${escapeHtml(m.label)}</td>
    <td class="value">${escapeHtml(m.value)}</td>
    <td class="note">${escapeHtml(m.note || '—')}</td>
  </tr>`).join('');
}

function dailyRows(rows){
  if(!rows.length) return '<tr><td colspan="7">No daily records available in this range.</td></tr>';
  return rows.map(r => `<tr>
    <td>${escapeHtml(r.date)}</td>
    <td>${escapeHtml(r.wet)}</td>
    <td>${escapeHtml(r.poop)}</td>
    <td>${escapeHtml(r.mixed)}</td>
    <td>${escapeHtml(r.diapers)}</td>
    <td>${escapeHtml(r.feeds)}</td>
    <td>${escapeHtml(r.milk)}</td>
  </tr>`).join('');
}

function prepareDoctorPrint(){
  const data = doctorData();
  if(!data) return false;
  document.getElementById(PRINT_ID)?.remove();

  const generated = new Intl.DateTimeFormat('en-US',{
    year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  }).format(new Date());
  const first = data.daily.at(-1)?.date || '—';
  const last = data.daily[0]?.date || '—';

  const el = document.createElement('section');
  el.id = PRINT_ID;
  el.className = 'mf-doctor-print';
  el.setAttribute('aria-hidden','true');
  el.innerHTML = `
    <header class="mf-print-header">
      <div>
        <div class="mf-print-kicker">MilkFlow · Parent-entered care log</div>
        <h1>${escapeHtml(data.babyName)} — Pediatric Care Summary</h1>
        <div class="mf-print-subtitle">${escapeHtml(data.snapshotTitle)} · ${escapeHtml(data.snapshotSub)}</div>
      </div>
      <div class="mf-print-meta">
        <div><strong>Report period:</strong> ${escapeHtml(first)} – ${escapeHtml(last)}</div>
        <div><strong>Selected range:</strong> ${escapeHtml(data.range ? `${data.range} days` : 'Current range')}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generated)}</div>
      </div>
    </header>

    <section class="mf-print-section">
      <h2>Clinical snapshot</h2>
      <table class="mf-print-table" aria-label="Clinical snapshot">
        <thead><tr><th>Measure</th><th>Value</th><th>Context</th></tr></thead>
        <tbody>${summaryRows(data.metrics)}</tbody>
      </table>
    </section>

    <section class="mf-print-section">
      <h2>Daily care log</h2>
      <table class="mf-print-table mf-print-daily" aria-label="Daily care log">
        <thead><tr><th>Date</th><th>Wet only</th><th>Poopy only</th><th>Mixed</th><th>Total diapers</th><th>Feeds</th><th>Bottle milk</th></tr></thead>
        <tbody>${dailyRows(data.daily)}</tbody>
      </table>
    </section>

    <footer class="mf-print-note">
      This report summarizes care entered by the family and is intended to support a pediatric visit. It is not a diagnosis or a substitute for the clinician’s medical record.
      <div class="mf-print-source">Wet and poopy averages shown in MilkFlow include mixed diapers where noted. Bottle milk reflects logged bottle volume only; nursing volume is not estimated.</div>
    </footer>`;
  document.body.appendChild(el);
  return true;
}

// The app owns the Print button. Capture its click first so the structured print document
// exists before app.js calls window.print(). This stays isolated to the Doctor screen.
document.addEventListener('click', e => {
  if(document.body.dataset.screen !== 'doctor') return;
  if(!e.target.closest('[data-print]')) return;
  prepareDoctorPrint();
}, true);
window.addEventListener('beforeprint', prepareDoctorPrint);
window.addEventListener('afterprint', () => document.getElementById(PRINT_ID)?.remove());

})();
