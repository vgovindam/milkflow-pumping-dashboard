(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const readState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};

/* The interpretation engine is shared by multiple screens. App callers from older builds did
 * not mark today's row as incomplete for Mom, so make that invariant explicit at the engine
 * boundary: a calendar day still in progress can be shown live, but never compared with full days. */
function protectInsightEngine(){
  const engine=window.MilkFlowInsights;if(!engine?.mom||engine.__completedDayGuard)return false;
  const original=engine.mom.bind(engine);
  engine.mom=input=>{
    const current=today(),days=(Array.isArray(input?.days)?input.days:[]).map(d=>({...d,complete:d?.complete===false?false:String(d?.date||'')<current}));
    return original({...input,days});
  };
  engine.__completedDayGuard=true;
  return true;
}

function completedPumpDays(){
  const s=readState(),current=today(),entries=(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e.date<current),map=new Map();
  for(const e of entries){const d=map.get(e.date)||{date:e.date,total:0,count:0};d.total+=Number(e.amountMl)||0;d.count++;map.set(e.date,d);}
  for(const [date,total] of Object.entries(s.dailyOverrides||{})){if(date>=current)continue;const d=map.get(date)||{date,total:0,count:0};if(Number(total)>d.total)d.total=Number(total);map.set(date,d);}
  return [...map.values()].filter(d=>d.total>0).sort((a,b)=>a.date.localeCompare(b.date));
}
function comparison(rows){if(rows.length<4)return null;const half=Math.floor(rows.length/2),prior=rows.slice(0,half),recent=rows.slice(half);if(!prior.length||!recent.length)return null;return{prior:avg(prior.map(r=>r.total)),recent:avg(recent.map(r=>r.total))};}
function metricByLabel(label){return [...document.querySelectorAll('.metric')].find(el=>el.querySelector('span')?.textContent?.trim()===label)||null;}
function panelByTitle(title){return [...document.querySelectorAll('.panel')].find(el=>el.querySelector('.panel-head h3')?.textContent?.trim().startsWith(title))||null;}
function correctMomTrendDom(){
  if(document.body.dataset.screen!=='mom-trends'&&location.hash!=='#mom-trends')return;
  const rows=completedPumpDays();if(!rows.length)return;
  const perDay=Math.round(avg(rows.map(r=>r.total))),pumpsPerDay=avg(rows.map(r=>r.count)).toFixed(1);
  const per=metricByLabel('Per pumping day');if(per){const strong=per.querySelector('strong'),small=per.querySelector('small');if(strong)strong.textContent=`${perDay} mL`;if(small)small.textContent=`${rows.length} completed active day${rows.length===1?'':'s'}`;}
  const ppd=metricByLabel('Pumps / day');if(ppd){const strong=ppd.querySelector('strong'),small=ppd.querySelector('small');if(strong)strong.textContent=pumpsPerDay;if(small)small.textContent='on completed active days';}
  const cmp=comparison(rows),panel=panelByTitle('Supply direction'),badge=panel?.querySelector('.delta');
  if(!badge)return;
  if(!cmp||!cmp.prior){badge.textContent='Learning';badge.className='delta flat';return;}
  const change=Math.round((cmp.recent-cmp.prior)/cmp.prior*100);if(!Number.isFinite(change)||Math.abs(change)<3){badge.textContent='Steady';badge.className='delta flat';return;}
  const up=change>0;badge.className=`delta ${up?'up':'down'}`;badge.innerHTML=`${up?'▲':'▼'} ${Math.abs(change)}%<em>vs previous completed days</em>`;
}
function reconcile(){protectInsightEngine();requestAnimationFrame(correctMomTrendDom);}
protectInsightEngine();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reconcile,{once:true});else reconcile();
window.addEventListener('milkflow:base-rendered',reconcile);
window.addEventListener('storage',e=>{if(e.key===STATE_KEY)setTimeout(reconcile,60);});
})();
