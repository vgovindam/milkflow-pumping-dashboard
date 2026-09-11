(() => {
  const stateKey = 'milkflow-family-v4-state';
  const icon = (name) => {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    const paths = {
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l2.5 2"/>',
      chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/>',
      snow: '<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
      baby: '<circle cx="12" cy="12" r="8"/><path d="M9.5 10h.01M14.5 10h.01M9.5 14c1.6 1.3 3.4 1.3 5 0"/><path d="M8 4.7c1.4-2 3.8-2.1 5.2-.8"/>',
      timeline: '<path d="M7 3v18M17 3v18"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      drop: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
      bottle: '<path d="M9 3h6M10 3v4l-2 3v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9l-2-3V3"/><path d="M8 13h8"/>',
      plus: '<path d="M12 5v14M5 12h14"/>'
    };
    return `<svg class="mf-icon" ${common}>${paths[name] || paths.heart}</svg>`;
  };

  function readState(){
    try { return JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch { return {}; }
  }

  function replaceNavIcons(){
    const map = {
      'mom-home':'heart','today':'clock','history':'history','trends':'chart','stash':'snow',
      'baby-home':'baby','baby-timeline':'timeline','settings':'settings'
    };
    document.querySelectorAll('[data-view]').forEach(btn => {
      const span = btn.querySelector('span');
      if (span && map[btn.dataset.view] && !span.querySelector('svg')) span.innerHTML = icon(map[btn.dataset.view]);
    });
  }

  function addFamilyStatus(){
    if (document.getElementById('familyDataStatus')) return;
    const title = document.getElementById('viewTitle');
    if (!title || title.textContent.trim() !== 'Family settings') return;
    const content = document.getElementById('content');
    if (!content) return;
    const s = readState();
    const events = Array.isArray(s.babyEvents) ? s.babyEvents : [];
    const synced = events.filter(e => e.synced).length;
    const signedIn = !!s.cloud?.enabled;
    const email = s.cloud?.email || '';
    const imported = events.length > 0;
    const cloudOk = imported && synced === events.length && signedIn;
    const card = document.createElement('section');
    card.id = 'familyDataStatus';
    card.className = 'family-status-card';
    card.innerHTML = `
      <div class="family-status-head">
        <div class="family-status-icon">${icon(cloudOk ? 'heart' : 'settings')}</div>
        <div><span class="eyebrow">FAMILY DATA</span><h3>${cloudOk ? 'Everything is saved' : 'Family data check'}</h3></div>
      </div>
      <div class="family-status-grid">
        <div><span>Family account</span><strong>${signedIn ? 'Signed in' : 'Not signed in'}</strong><small>${signedIn ? email : 'Sign in to keep data synced across devices'}</small></div>
        <div><span>${s.baby?.name || 'Baby'} history</span><strong>${imported ? `${events.length.toLocaleString()} records` : 'Not imported'}</strong><small>${imported ? '2026 baby history is loaded' : 'Import the baby tracker file once'}</small></div>
        <div><span>Cloud backup</span><strong>${cloudOk ? 'Up to date' : signedIn ? `${synced.toLocaleString()} saved` : 'Waiting for sign in'}</strong><small>${cloudOk ? 'All imported baby records are marked saved' : 'MilkFlow will keep syncing when signed in'}</small></div>
        <div><span>Older child</span><strong>Archived separately</strong><small>Older history is not mixed into the current baby view</small></div>
      </div>`;
    content.prepend(card);
  }

  function familyLanguage(){
    const eyebrow = document.getElementById('viewEyebrow');
    const title = document.getElementById('viewTitle');
    if (eyebrow) {
      const e = eyebrow.textContent.trim();
      const map = {'MOM COMMAND CENTER':'MOM CARE','MOM DATA':'MOM CARE','ANALYTICS':'MOM CARE','MILK STORAGE':'MOM CARE','BABY DATA':'BABY CARE','SYSTEM':'FAMILY SETTINGS'};
      if (map[e]) eyebrow.textContent = map[e];
    }
    if (title) {
      const map = {'Mom home':'Mom','Pumping history':'Pump history','Trends':'Milk trends','Stash & runway':'Freezer stash','Baby dashboard':'Baby','Baby timeline':'Baby history','Settings & import':'Family settings'};
      if (map[title.textContent.trim()]) title.textContent = map[title.textContent.trim()];
    }
    const syncTitle = document.getElementById('syncTitle');
    const syncSubtitle = document.getElementById('syncSubtitle');
    const badge = document.getElementById('cloudBadge');
    const s = readState();
    if (syncTitle) syncTitle.textContent = s.cloud?.enabled ? 'Family data saved' : 'Saved on this device';
    if (syncSubtitle) syncSubtitle.textContent = s.cloud?.enabled ? (s.cloud.email || 'Family account connected') : 'Sign in to share across family devices';
    if (badge) badge.textContent = s.cloud?.enabled ? 'Saved' : 'This device';

    const replacements = [
      ['Mom stays the default workspace. Pumping, supply trend, stash, recovery and reminders are front and center; baby tracking is connected but never mixed into your metrics.','Your pumping, milk supply, freezer stash and reminders are here first. Baby care is one tap away, with each person’s records kept separate.'],
      ['Smart mom insights','How you’re doing'],
      ['Based on your own recent pattern','Compared with your own recent pattern'],
      ['Your complete mom-side activity stream','Pumping and nursing, together in one history'],
      ['BABY WORKSPACE','BABY CARE'],
      ['Fast care tracking when you need it.','Everything for baby, right when you need it.'],
      ['Baby records stay completely separate from Mom metrics. This workspace is optimized for diapers, bottles and a chronological care timeline.','Log diapers, bottles, nursing and sleep quickly. Baby records stay separate from Mom’s pumping numbers.'],
      ['Swipe-style diaper shortcuts','Quick diaper log'],
      ['One tap now; details only when you need them.','One tap to save it. Add details only when you want to.'],
      ['Cloud & account','Family account'],
      ['Private Firebase sync','Keeps your family data available across signed-in devices'],
      ['Baby Tracker migration','Baby history'],
      ['Safe, non-destructive 2026 import','Imported from your previous baby tracker'],
      ['Active child','Current baby'],
      ['Older child','Older child history'],
      ['Import normalized JSON','Import baby history'],
      ['Stable migration IDs prevent duplicate imports.','Safe to import again; existing records are not duplicated.'],
      ['Pumping schedule','Pump schedule'],
      ['Used for next-pump guidance','Used for your next pump time and reminders'],
      ['Browser/app-style pump reminders','Helpful reminders for planned pumping times'],
      ['Mom targets','Mom preferences'],
      ['Personalize your dashboard','Adjust the numbers used on Mom’s dashboard']
    ];
    document.querySelectorAll('#content *').forEach(el => {
      if (el.children.length) return;
      let txt = el.textContent;
      for (const [a,b] of replacements) if (txt === a) { el.textContent = b; break; }
    });
    addFamilyStatus();
    replaceNavIcons();
  }

  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; familyLanguage(); });
  };
  document.addEventListener('DOMContentLoaded', refresh);
  new MutationObserver(refresh).observe(document.documentElement, {subtree:true, childList:true});
})();