'use strict';

const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const mins=t=>{const [h,m]=String(t||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2};
const stamp=e=>Date.parse(e?.voidedAt||e?.editedAt||e?.createdAt||'')||0;

function mergeRecords(...lists){
  const m=new Map();
  for(const list of lists){
    for(const e of (Array.isArray(list)?list:[])){
      if(!e?.id)continue;
      const old=m.get(e.id);
      if(!old||stamp(e)>=stamp(old))m.set(e.id,e);
    }
  }
  return [...m.values()];
}

function recentDate(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days);return iso(d)}
function ageWeeks(birthDate){
  if(!birthDate)return null;
  const b=new Date(`${birthDate}T12:00:00`),n=new Date();n.setHours(12,0,0,0);
  const days=Math.floor((n-b)/86400000);
  return Number.isFinite(days)&&days>=0?Math.round(days/7*10)/10:null;
}

function summarizeDays(entries,overrides,days=30){
  const cutoff=recentDate(days-1),live=entries.filter(e=>!e?.voidedAt&&e.date>=cutoff);
  const out=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const key=iso(d);
    const pumps=live.filter(e=>e.type==='pump'&&e.date===key&&e.time).sort((a,b)=>a.time.localeCompare(b.time));
    const nursing=live.filter(e=>e.type==='nursing'&&e.date===key);
    const logged=pumps.reduce((n,e)=>n+(+e.amountMl||0),0),floor=+(overrides?.[key]||0),total=Math.max(logged,Number.isFinite(floor)?floor:0);
    const gaps=[];for(let j=1;j<pumps.length;j++){const g=mins(pumps[j].time)-mins(pumps[j-1].time);if(g>=30&&g<=720)gaps.push(g)}
    out.push({
      date:key,
      pumpCount:pumps.length,
      totalMl:Math.round(total),
      avgMlPerPump:pumps.length?Math.round(logged/pumps.length):0,
      firstPump:pumps[0]?.time||null,
      lastPump:pumps[pumps.length-1]?.time||null,
      avgGapMin:gaps.length?Math.round(avg(gaps)):null,
      longestGapMin:gaps.length?Math.max(...gaps):null,
      nursingCount:nursing.length,
      nursingMinutes:nursing.reduce((n,e)=>n+(+e.durationMin||0),0)
    });
  }
  return out;
}

function trend(days,n=7,offset=0){
  const slice=days.slice(Math.max(0,days.length-n-offset),days.length-offset||undefined).filter(x=>x.totalMl>0);
  return slice.length?Math.round(avg(slice.map(x=>x.totalMl))):0;
}

function fallbackAdvice(ctx){
  const t=ctx.today||{}, target=ctx.plan?.target||6, remaining=Math.max(0,target-(t.pumpCount||0));
  const next=ctx.localRecommendation?.next||null, mode=ctx.plan?.mode||'normal';
  let message='Your logged pattern is available and the built-in coach is keeping the plan based on your actual sessions.';
  if(remaining===0) message=`You have reached today's ${target}-pump target. Keep using your normal next-day plan unless you intentionally add another session.`;
  else if(next) message=`Use the built-in next suggestion ${next}. ${remaining} ${remaining===1?'session remains':'sessions remain'} for today's ${target}-pump target.`;
  if(mode==='tired') message+=' Since today is marked Tired, prioritize a workable interval rather than trying to force every original clock slot.';
  if(mode==='travel') message+=' Travel mode should follow the sessions you actually complete rather than the original clock.';
  if(ctx.trends?.delta7Pct!=null&&ctx.trends.delta7Pct<=-8) message+=' Your recent 7-day output is lower than the prior week, so avoid making a further reduction until the pattern is clearer if maintaining output is your goal.';
  if(ctx.postpartumWeeks!=null&&ctx.postpartumWeeks<12&&target===5) message+=' Because this is still early postpartum, treat five pumps as a cautious trial and watch several complete days rather than assuming the reduction will be neutral for supply.';
  return {headline:'Pump plan updated',message,confidence:'high',signals:[],safety_note:''};
}

function buildContext({client={},cloudEntries=[],cloudProfile={},cloudCoach={},cloudCoachDays=[]}){
  const entries=mergeRecords(cloudEntries,client.recentEntries||[]).filter(e=>['pump','nursing'].includes(e.type));
  const overrides={...(cloudProfile.dailyOverrides||{}),...(client.dailyOverrides||{})};
  const days=summarizeDays(entries,overrides,30);
  const seven=trend(days,7,0),prior=trend(days,7,7),delta7Pct=prior?Math.round((seven-prior)/prior*100):null;
  const today=days[days.length-1]||{};
  const pumps=entries.filter(e=>!e?.voidedAt&&e.type==='pump'&&e.date&&e.time).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const recentSessions=pumps.slice(-18).map(e=>({date:e.date,time:e.time,amountMl:+e.amountMl||0,durationMin:+e.durationMin||null}));
  const gaps=[];for(let i=1;i<recentSessions.length;i++){if(recentSessions[i].date!==recentSessions[i-1].date)continue;const g=mins(recentSessions[i].time)-mins(recentSessions[i-1].time);if(g>=60&&g<=600)gaps.push(g)}
  const plan={
    target:+client.coach?.target||+cloudCoach.target||6,
    mode:client.coach?.mode||cloudCoach.mode||'normal',
    schedule:Array.isArray(client.schedule)&&client.schedule.length?client.schedule:(cloudProfile.schedule||[]),
    dailyGoalMl:+client.goalMl||+cloudProfile.dailyGoalMl||null
  };
  const coachDays=[...(Array.isArray(cloudCoachDays)?cloudCoachDays:[]),...Object.values(client.coachDays||{})]
    .filter(x=>x?.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30)
    .map(x=>({date:x.date,target:+x.target||null,mode:x.mode||null,pumps:+x.pumps||0,totalMl:+x.totalMl||0,avgGapMin:+x.avgGapMin||null}));
  return {
    schemaVersion:2,
    requestReason:client.reason||'update',
    generatedAt:new Date().toISOString(),
    timeZone:client.timeZone||null,
    postpartumWeeks:ageWeeks(client.babyBirthDate||cloudProfile.babyBirthDate||null),
    plan,
    today,
    lastPump:recentSessions[recentSessions.length-1]||null,
    recentSessions,
    daily:days,
    coachDays,
    trends:{sevenDayAvgMl:seven,priorSevenDayAvgMl:prior,delta7Pct,typicalGapMin:gaps.length?Math.round(median(gaps)):null},
    localRecommendation:client.localRecommendation||null
  };
}

module.exports={buildContext,fallbackAdvice,mergeRecords};
