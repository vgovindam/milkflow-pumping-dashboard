(() => {
'use strict';

/*
 * MilkFlow interpretation engine.
 * Pure data in -> observations and source-backed education out.
 * No storage, Firebase, routing, DOM mutation, diagnosis, or clinical thresholds.
 */
const REVIEWED='2026-09-23';
const DISCLAIMER='General educational guidance only; check with your pediatrician, OB/GYN, lactation consultant, or other clinician for advice specific to you or your baby.';

const SOURCES={
  breastfeeding:{
    id:'cdc-breastfeeding-frequency',
    label:'CDC · How Much and How Often to Breastfeed',
    url:'https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/how-much-and-how-often.html',
    summary:'Feeding frequency changes as babies grow, and every baby is different.'
  },
  breastfeedingExpectations:{
    id:'cdc-breastfeeding-expectations',
    label:'CDC · What to Expect While Breastfeeding',
    url:'https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/what-to-expect-while-breastfeeding.html',
    summary:'Breastfeeding experiences differ; parents learn feeding cues, milk supply, and breast-health patterns over time.'
  },
  formula:{
    id:'cdc-formula-frequency',
    label:'CDC · How Much and How Often to Feed Infant Formula',
    url:'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html',
    summary:'Formula amount and frequency depend on the individual baby and change with growth.'
  },
  nutrition:{
    id:'cdc-infant-toddler-nutrition',
    label:'CDC · Infant and Toddler Nutrition',
    url:'https://www.cdc.gov/infant-toddler-nutrition/index.html',
    summary:'Public guidance on feeding infants and toddlers from birth through 24 months.'
  },
  sleep:{
    id:'aap-safe-sleep',
    label:'American Academy of Pediatrics · Safe Sleep',
    url:'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx',
    summary:'AAP guidance focuses on a safe sleep environment to reduce sleep-related infant risks.'
  },
  growth:{
    id:'who-growth-standards',
    label:'WHO · Child Growth Standards',
    url:'https://www.who.int/news-room/questions-and-answers/item/child-growth-standards',
    summary:'WHO growth standards describe child growth from birth through age 5 under optimal conditions.'
  },
  development:{
    id:'cdc-development-milestones',
    label:'CDC · Developmental Milestones',
    url:'https://www.cdc.gov/act-early/milestones/',
    summary:'CDC milestone tools support developmental monitoring and are not a substitute for validated screening.'
  }
};

const num=v=>Number.isFinite(+v)?+v:0;
const mean=a=>a.length?a.reduce((s,v)=>s+num(v),0)/a.length:0;
const median=a=>{
  const x=a.map(num).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!x.length)return 0;
  const i=Math.floor(x.length/2);
  return x.length%2?x[i]:(x[i-1]+x[i])/2;
};
const pct=(a,b)=>b?((a-b)/b)*100:null;
const round=(v,d=0)=>{const p=10**d;return Math.round(num(v)*p)/p;};
const signed=v=>v==null?null:(v>0?'+':'')+round(v)+'%';
function split(values){const clean=values.map(num),h=Math.floor(clean.length/2);return{prior:clean.slice(0,h),recent:clean.slice(h)};}
function compare(values,{noun='pattern'}={}){
  const active=values.map(num).filter(v=>v>0);
  if(active.length<4)return{kind:'insufficient',text:'More logged days will make the '+noun+' comparison more useful.',change:null,recent:mean(active),prior:0};
  const parts=split(values),p=mean(parts.prior.filter(v=>v>0)),r=mean(parts.recent.filter(v=>v>0)),change=p?pct(r,p):null;
  if(change==null)return{kind:'insufficient',text:'More earlier data is needed to compare this '+noun+'.',change:null,recent:r,prior:p};
  const magnitude=Math.abs(change),direction=change>0?'higher':'lower';
  const strength=magnitude<5?'about the same as':magnitude<15?'modestly '+direction+' than':direction+' than';
  return{kind:magnitude<5?'steady':(change>0?'up':'down'),change,recent:r,prior:p,text:'The recent half of this range is '+strength+' the earlier half ('+signed(change)+').'};
}
function gapsFromSessions(sessions){
  const byDay=new Map();
  for(const s of sessions||[]){
    if(!s?.date||!s?.time)continue;
    const parts=String(s.time).split(':').map(Number),h=parts[0],m=parts[1];
    if(!Number.isFinite(h)||!Number.isFinite(m))continue;
    const a=byDay.get(s.date)||[];a.push(h*60+m);byDay.set(s.date,a);
  }
  const gaps=[];
  for(const a of byDay.values()){a.sort((x,y)=>x-y);for(let i=1;i<a.length;i++)if(a[i]-a[i-1]>0)gaps.push(a[i]-a[i-1]);}
  return gaps;
}
function fmtMinutes(m){m=Math.round(num(m));if(!m)return'—';const h=Math.floor(m/60),r=m%60;return h?(r?h+'h '+r+'m':h+'h'):r+'m';}
function coverage(rows){const total=rows?.length||0,active=(rows||[]).filter(r=>r?.logged||r?.feeds||r?.diapers||r?.bottleOz||r?.sleepMin).length;return{total,active,pct:total?Math.round(active/total*100):0};}
function obs(label,value,detail,tone='neutral'){return{label,value:String(value),detail,tone};}
function sourceCard(source,title,body){return{title,body,source:{...source,reviewed:REVIEWED}};}

function mom(input={}){
  const days=Array.isArray(input.days)?input.days:[],sessions=Array.isArray(input.sessions)?input.sessions:[];
  const totals=days.map(d=>num(d.totalMl)),active=totals.filter(v=>v>0),direction=compare(totals,{noun:'pumping output'});
  const avgSession=sessions.length?mean(sessions.map(s=>num(s.amountMl))):0,gaps=gapsFromSessions(sessions);
  const bands=(input.bands||[]).filter(b=>num(b.value)>0).sort((a,b)=>num(b.value)-num(a.value)),strongest=bands[0]||null;
  const activeTotal=active.reduce((a,b)=>a+b,0),share=strongest&&activeTotal?Math.round(num(strongest.value)/activeTotal*100):0;
  return{
    kind:'mom',
    headline:direction.kind==='insufficient'?'MilkFlow is learning your pumping pattern':direction.kind==='steady'?'Your recent pumping output is fairly steady':direction.kind==='up'?'Your recent logged output is higher':'Your recent logged output is lower',
    summary:'These comparisons describe your own logged pattern; they are not a diagnosis of milk supply.',
    observations:[
      obs('Recent direction',direction.kind==='insufficient'?'Learning':direction.kind==='steady'?'Steady':direction.kind==='up'?'Higher':'Lower',direction.text,direction.kind),
      obs('Average session',avgSession?Math.round(avgSession)+' mL':'—',sessions.length?'Across '+sessions.length+' logged pumping session'+(sessions.length===1?'':'s')+'.':'No pumping sessions in this range.'),
      obs('Typical spacing',gaps.length?fmtMinutes(median(gaps)):'—',gaps.length?'Median gap across '+gaps.length+' same-day interval'+(gaps.length===1?'':'s')+'.':'Needs multiple sessions on the same day.'),
      obs('Strongest time window',strongest?strongest.label:'—',strongest?Math.round(num(strongest.value))+' mL logged in this window'+(share?' · about '+share+'% of active-day output in this range':'')+'.':'No time-of-day pattern yet.')
    ],
    education:[sourceCard(SOURCES.breastfeedingExpectations,'Breastfeeding and supply are individual','CDC notes that each breastfeeding experience is different and encourages support from a lactation consultant, nurse, or doctor when you have concerns about feeding, supply, or breast health.')],
    disclaimer:DISCLAIMER,sourceVersion:REVIEWED
  };
}

function baby(input={}){
  const rows=Array.isArray(input.rows)?input.rows:[],cov=coverage(rows);
  const feedCmp=compare(rows.map(r=>num(r.feeds)),{noun:'feeding frequency'}),bottleCmp=compare(rows.map(r=>num(r.bottleOz)),{noun:'bottle volume'}),wetCmp=compare(rows.map(r=>num(r.wetTotal)),{noun:'wet-diaper pattern'}),sleepCmp=compare(rows.map(r=>num(r.sleepMin)/60),{noun:'logged sleep'});
  const observations=[
    obs('Data coverage',cov.active+' of '+(cov.total||0)+' days',cov.total?cov.pct+'% of days in this range contain tracked care data.':'No days in this range.'),
    obs('Feeding pattern',feedCmp.kind==='insufficient'?'Learning':feedCmp.kind==='steady'?'Steady':feedCmp.kind==='up'?'Higher':'Lower',feedCmp.text,feedCmp.kind),
    obs('Bottle volume',bottleCmp.kind==='insufficient'?'Learning':bottleCmp.kind==='steady'?'Steady':bottleCmp.kind==='up'?'Higher':'Lower',bottleCmp.text,bottleCmp.kind),
    obs('Wet diapers',wetCmp.kind==='insufficient'?'Learning':wetCmp.kind==='steady'?'Steady':wetCmp.kind==='up'?'Higher':'Lower',wetCmp.text,wetCmp.kind)
  ];
  if(rows.some(r=>num(r.sleepMin)>0))observations.push(obs('Logged sleep',sleepCmp.kind==='insufficient'?'Learning':sleepCmp.kind==='steady'?'Steady':sleepCmp.kind==='up'?'Higher':'Lower',sleepCmp.text,sleepCmp.kind));
  const pref=String(input.feedingPreference||''),feedingSource=pref==='mostly_formula'?SOURCES.formula:pref==='mostly_breastfed'?SOURCES.breastfeeding:SOURCES.nutrition;
  const education=[
    sourceCard(feedingSource,'Feeding guidance changes with age and feeding type',feedingSource.summary),
    sourceCard(SOURCES.growth,'Growth is about trajectory, not one measurement','WHO growth standards are designed to follow growth over time. MilkFlow should show measurements and trajectory without diagnosing growth from a single point.'),
    sourceCard(SOURCES.development,'Milestones support monitoring, not diagnosis','CDC milestone checklists describe skills most children can do by an age and are conversation tools rather than diagnostic screening.')
  ];
  if(num(input.ageDays)<366)education.splice(1,0,sourceCard(SOURCES.sleep,'Safe sleep matters alongside sleep totals','AAP guidance emphasizes a safe sleep environment. Logged sleep duration alone cannot determine whether a sleep setup is safe.'));
  return{
    kind:'baby',
    headline:cov.active<3?'MilkFlow is learning this baby’s routine':'Here is what changed in the logged routine',
    summary:'MilkFlow compares recent logged care with earlier data in the selected range and keeps observations separate from medical guidance.',
    observations,
    education:education.slice(0,3),
    disclaimer:DISCLAIMER,sourceVersion:REVIEWED
  };
}

window.MilkFlowInsights={version:'1.0.0',reviewed:REVIEWED,sources:SOURCES,mom,baby,disclaimer:DISCLAIMER};
})();
