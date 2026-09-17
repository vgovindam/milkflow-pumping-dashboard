(() => {
'use strict';

/* Keeps the adaptive pump plan from showing a next session in the past.
   This module owns plan reconciliation only; it never changes layout or app state records. */
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const round5=m=>Math.round(m/5)*5;

function correctedPlan(raw){
  if(!raw||!Array.isArray(raw.future)||!raw.future.length||!(raw.remaining>0))return raw;
  const now=new Date(),nowM=now.getHours()*60+now.getMinutes(),first=Number(raw.future[0]);
  if(!Number.isFinite(first)||first>=nowM-10)return raw;
  const target=Number(raw.target)||6,minGap=target===5?180:150,remaining=Math.max(1,Number(raw.remaining)||raw.future.length);
  const last=raw.last||raw.actual?.at?.(-1),lastM=mins(last?.time);
  const next=round5(Math.max(nowM+5,Number.isFinite(lastM)?lastM+minGap:nowM+5));
  const end=target===5?1440:1445,room=Math.max(0,end-next),natural=target===5?240:195;
  const step=remaining>1?clamp(Math.round(room/(remaining-1)),minGap,natural):0,future=[next];
  for(let i=1;i<remaining;i++)future.push(round5(next+step*i));
  return {...raw,future,source:'actual',last};
}

function install(){
  const api=window.MilkFlowDynamicPump;
  if(!api||api.__reconciled)return false;
  api.__reconciled=true;
  const original={
    getPlan:api.getPlan?.bind(api),previewTarget:api.previewTarget?.bind(api),setTodayTarget:api.setTodayTarget?.bind(api),
    setTodayNextTime:api.setTodayNextTime?.bind(api),clearTodayNextTime:api.clearTodayNextTime?.bind(api)
  };
  if(original.getPlan)api.getPlan=()=>correctedPlan(original.getPlan());
  if(original.previewTarget)api.previewTarget=n=>correctedPlan(original.previewTarget(n));
  if(original.setTodayTarget)api.setTodayTarget=n=>correctedPlan(original.setTodayTarget(n));
  if(original.setTodayNextTime)api.setTodayNextTime=v=>correctedPlan(original.setTodayNextTime(v));
  if(original.clearTodayNextTime)api.clearTodayNextTime=()=>correctedPlan(original.clearTodayNextTime());
  return true;
}

if(!install())window.addEventListener('DOMContentLoaded',install,{once:true});
window.addEventListener('pageshow',install);
})();
