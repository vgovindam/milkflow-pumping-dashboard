/* MilkFlow — printable pediatric visit summary.
 *
 * This file owns ONE thing: turning the doctor report model into a document that prints
 * well on a sheet of paper. It does not read the rendered screen and it does not compute
 * any care figures of its own — app.js publishes window.MilkFlowReports.doctorSummary()
 * and that is the single source for both the screen and this page. If the model is not
 * available the file does nothing at all, and the browser prints the app normally, rather
 * than printing a half-built report.
 */
(() => {
'use strict';

const PRINT_ID = 'mfDoctorPrint';
/* "All" can be several hundred days. A clinician reads the recent stretch and the totals, and
   a three-hundred-row table is what made printing crawl - the period total below still counts
   every day in the range, so nothing is lost from the summary. */
const DAILY_ROW_CAP = 60;
const PRINTING_CLASS = 'mf-printing-report';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const one = n => (Math.round((+n || 0) * 10) / 10).toFixed(1);

/* A clinician reads dates, not ISO strings. Noon avoids the timezone edge that turns
   2026-09-05 into the 4th west of UTC. */
const DAY_FMT = new Intl.DateTimeFormat(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
const FULL_FMT = new Intl.DateTimeFormat(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
const STAMP_FMT = new Intl.DateTimeFormat(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
const day = iso => iso ? DAY_FMT.format(new Date(`${iso}T12:00:00`)) : '—';
const full = iso => iso ? FULL_FMT.format(new Date(`${iso}T12:00:00`)) : '—';

function report(){
  try { return window.MilkFlowReports?.doctorSummary?.() || null; }
  catch { return null; }
}

function identity(r){
  const bits = [r.baby.name];
  if(r.baby.age) bits.push(r.baby.age);
  const born = r.baby.birthDate ? ` (born ${full(r.baby.birthDate)})` : '';
  return `${bits.join(', ')}${born}`;
}

function periodLine(p){
  const span = `${full(p.from)} – ${full(p.to)}`;
  const kept = `${p.days} day${p.days === 1 ? '' : 's'}, ${p.daysWithRecords} with records`;
  return `${span} · ${kept}`;
}

function measureRows(measures){
  if(!measures.length) return '<tr><td colspan="3">No care has been logged in this period.</td></tr>';
  return measures.map(m => `<tr>
      <th scope="row">${esc(m.label)}</th>
      <td class="value">${esc(m.value)}</td>
      <td class="note">${esc([m.note, m.date ? full(m.date) : ''].filter(Boolean).join(' '))}</td>
    </tr>`).join('');
}

function insightRows(model){
  const rows=model?.observations||[];
  if(!rows.length)return '';
  return `<section class="mf-print-section"><h2>Recent logged pattern</h2><table class="mf-print-table mf-print-measures"><thead><tr><th scope="col">Pattern</th><th scope="col">Status</th><th scope="col">Context</th></tr></thead><tbody>${rows.map(o=>`<tr><th scope="row">${esc(o.label)}</th><td class="value">${esc(o.value)}</td><td class="note">${esc(o.detail)}</td></tr>`).join('')}</tbody></table></section>`;
}
function dailyRows(rows){
  if(!rows.length) return '<tr><td colspan="8">No daily records in this period.</td></tr>';
  return rows.map(r => r.logged ? `<tr>
      <th scope="row">${esc(day(r.date))}</th>
      <td>${r.wetOnly}</td><td>${r.poopOnly}</td><td>${r.mixed}</td>
      <td>${r.diapers}</td><td>${r.feeds}</td>
      <td>${r.bottleOz ? one(r.bottleOz) : '—'}</td>
      <td>${r.sleepMin ? one(r.sleepMin / 60) : '—'}</td>
    </tr>` : `<tr class="mf-print-blank">
      <th scope="row">${esc(day(r.date))}</th>
      <td colspan="7">Nothing logged</td>
    </tr>`).join('');
}

function totalsRow(t){
  return `<tr class="mf-print-total">
      <th scope="row">Period total</th>
      <td>${t.wetOnly}</td><td>${t.poopOnly}</td><td>${t.mixed}</td>
      <td>${t.diapers}</td><td>${t.feeds}</td>
      <td>${t.bottleOz ? one(t.bottleOz) : '—'}</td>
      <td>${t.sleepMin ? one(t.sleepMin / 60) : '—'}</td>
    </tr>`;
}

function buildPrintDocument(force=false){
  if(!force && document.getElementById(PRINT_ID)) return true;
  const r = report();
  if(!r) return false;

  document.getElementById(PRINT_ID)?.remove();
  const el = document.createElement('section');
  el.id = PRINT_ID;
  el.className = 'mf-doctor-print';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <header class="mf-print-header">
      <p class="mf-print-kicker">MilkFlow · care logged at home by the family</p>
      <h1>Summary for ${esc(r.baby.name)}’s visit</h1>
      <dl class="mf-print-facts">
        <dt>Child</dt><dd>${esc(identity(r))}</dd>
        <dt>Period covered</dt><dd>${esc(periodLine(r.period))}</dd>
        <dt>Prepared</dt><dd>${esc(STAMP_FMT.format(new Date(r.generatedAt)))}</dd>
      </dl>
    </header>

    <section class="mf-print-section">
      <h2>At a glance</h2>
      <table class="mf-print-table mf-print-measures">
        <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Context</th></tr></thead>
        <tbody>${measureRows(r.measures)}</tbody>
      </table>
    </section>

    ${insightRows(r.insights)}

    <section class="mf-print-section">
      <h2>Day by day</h2>
      <table class="mf-print-table mf-print-daily">
        <thead><tr>
          <th scope="col">Date</th><th scope="col">Wet</th><th scope="col">Dirty</th><th scope="col">Mixed</th>
          <th scope="col">Diapers</th><th scope="col">Feeds</th><th scope="col">Bottle oz</th><th scope="col">Sleep h</th>
        </tr></thead>
        <tbody>${dailyRows(r.daily.slice(0, DAILY_ROW_CAP))}${totalsRow(r.totals)}</tbody>
      </table>
    </section>

    <footer class="mf-print-note">
      <p><strong>How to read this.</strong> Daily averages are worked out across the ${r.period.daysWithRecords} day${r.period.daysWithRecords === 1 ? '' : 's'} that have records, not across all ${r.period.days} days, so a day nobody had a chance to log does not read as a day with no wet diapers. “Wet” and “Dirty” counts include mixed changes. Bottle volume is logged bottles only — nursing volume is not estimated. Sleep is logged sleep only.</p>
      <p class="mf-print-source">${r.daily.length > DAILY_ROW_CAP ? `Day by day lists the most recent ${DAILY_ROW_CAP} days of the ${r.period.days}-day range; the period total covers all of it. ` : ''}Entered by the family in the MilkFlow app. This is a record of care at home, not a clinical assessment or a diagnosis. ${esc(r.insights?.disclaimer||'')}</p>
    </footer>`;
  document.body.appendChild(el);
  document.body.classList.add(PRINTING_CLASS);
  return true;
}

function teardown(){
  document.getElementById(PRINT_ID)?.remove();
  document.body.classList.remove(PRINTING_CLASS);
}

function nextPaint(){
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
let printing=false;
async function printReport(){
  if(printing)return false;
  printing=true;
  const button=document.querySelector('[data-print]');
  button?.setAttribute('aria-busy','true');
  try{
    if(!buildPrintDocument(true))return false;
    await nextPaint();
    window.print();
    return true;
  }finally{
    button?.removeAttribute('aria-busy');
    printing=false;
  }
}
/* Browser menu / Cmd-P still gets a document, but the normal app button uses printReport()
   so document construction and the native print dialog cannot race each other. */
window.addEventListener('beforeprint', () => {
  if(document.body.dataset.screen === 'doctor' && !document.getElementById(PRINT_ID)) buildPrintDocument();
});
window.addEventListener('afterprint', teardown);

/* Exposed for app.js and QA. */
window.MilkFlowDoctorPrint = {build: buildPrintDocument, print: printReport, teardown};

})();
