'use strict';

const {onDocumentCreated}=require('firebase-functions/v2/firestore');

const APP_BASE='https://vgovindam.github.io/milkflow-pumping-dashboard/';
const RECENT_MS=20*60*1000;
const INVALID_TOKEN_CODES=new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function parseWhen(v){
  if(!v)return NaN;
  if(typeof v?.toDate==='function')return v.toDate().getTime();
  const t=Date.parse(v);return Number.isFinite(t)?t:NaN;
}
function recentRecord(data,eventTime){
  const t=parseWhen(data?.createdAt)||parseWhen(data?.sourceClientAt)||parseWhen(eventTime);
  return Number.isFinite(t)&&Math.abs(Date.now()-t)<=RECENT_MS;
}
function to12(t){
  if(!t)return'';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);
  return`${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function sourceSuffix(data){
  const label=String(data?.sourceDeviceLabel||'').trim().slice(0,40);
  return label?` · from ${label}`:'';
}
function formatAlert(collection,data,names){
  const time=to12(data?.time), suffix=sourceSuffix(data);
  if(collection==='entries'){
    if(data?.type==='pump')return{title:`${names.mom} logged a pump`,body:`${Number(data.amountMl||0)} mL${time?` · ${time}`:''}${suffix}`,route:'mom-history'};
    return{title:`${names.mom} logged nursing`,body:`${Number(data?.durationMin||0)} min${time?` · ${time}`:''}${suffix}`,route:'mom-history'};
  }
  const kind=String(data?.eventType||'care');
  if(kind==='feeding'){
    const what=data?.feedingType==='formula'?'formula':'breast milk';
    return{title:`${names.baby} was fed`,body:`${Number(data?.amountOz||0).toFixed(1)} oz ${what}${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
  }
  if(kind==='nursing')return{title:`${names.baby} nursed`,body:`${Number(data?.durationMinutes??data?.totalMinutes??0)} min${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
  if(kind==='diaper'){
    const label=data?.subtype==='both'?'Mixed diaper':data?.subtype==='poop'?'Poopy diaper':'Wet diaper';
    return{title:`${names.baby} care logged`,body:`${label}${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
  }
  if(kind==='sleep'){
    const min=Number(data?.durationMinutes||0),duration=min>=60?`${Math.floor(min/60)} hr${min%60?` ${min%60} min`:''}`:`${min} min`;
    return{title:`${names.baby} sleep logged`,body:`${duration}${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
  }
  if(kind==='growth'){
    const wt=data?.weightLb!=null?`${data.weightLb} lb${data.weightOz!=null?` ${data.weightOz} oz`:''}`:'Growth measurement';
    return{title:`${names.baby} growth logged`,body:`${wt}${suffix}`,route:'baby-growth'};
  }
  if(kind==='milestone')return{title:`${names.baby} milestone logged`,body:`${String(data?.milestoneText||'Development milestone').slice(0,120)}${suffix}`,route:'development'};
  return{title:`${names.baby} care logged`,body:`New ${kind} entry${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
}

async function readSettledRecord(ref){
  // The create trigger can beat the browser's source-device merge. The old implementation
  // waited a single 900ms window and then permanently dropped the alert if the tag was late.
  // Retry for a few seconds, but never drop the family notification solely because the source
  // tag never arrived; in that rare fallback all enabled devices receive the push.
  let snap=await ref.get(),data=snap.exists?(snap.data()||{}):{};
  for(let i=0;i<6&&snap.exists&&!data.sourceDeviceId;i++){
    await sleep(500+i*250);
    snap=await ref.get();data=snap.exists?(snap.data()||{}):{};
  }
  return{snap,data};
}

function createCrossDeviceAlertFunctions({admin,db}){
  async function sendForCreate(event,collection){
    const uid=event.params.userId;
    if(!uid||!event.data)return null;

    const {snap:current,data}=await readSettledRecord(event.data.ref);
    if(!current.exists||data.voidedAt||!recentRecord(data,event.time))return null;
    const sourceDeviceId=String(data.sourceDeviceId||'');

    const userRoot=db.collection('users').doc(uid);
    const [deviceSnap,profileDoc]=await Promise.all([
      userRoot.collection('devices').get(),
      userRoot.collection('private').doc('profile').get()
    ]);
    const profile=profileDoc.exists?(profileDoc.data()||{}):{};
    const names={mom:profile.profile?.momName||'Mom',baby:profile.baby?.name||'Baby'};
    const targets=[];
    deviceSnap.forEach(doc=>{
      const d=doc.data()||{};
      if(sourceDeviceId&&doc.id===sourceDeviceId)return;
      if(d.entryAlerts!==true||!d.token)return;
      targets.push({ref:doc.ref,token:String(d.token)});
    });
    if(!targets.length)return null;

    const alert=formatAlert(collection,data,names);
    const alertId=`${collection}:${current.id}`;
    const link=`${APP_BASE}#${alert.route}`;
    const message={
      tokens:targets.map(x=>x.token),
      data:{
        title:alert.title,
        body:alert.body,
        route:alert.route,
        alertId,
        collection,
        recordId:current.id
      },
      webpush:{
        headers:{Urgency:'high'},
        fcmOptions:{link}
      }
    };

    const result=await admin.messaging().sendEachForMulticast(message);
    const cleanup=[];
    result.responses.forEach((r,i)=>{
      if(r.success)return;
      const code=r.error?.code||'';
      console.warn('Cross-device push failed',code,r.error?.message||'');
      if(INVALID_TOKEN_CODES.has(code))cleanup.push(targets[i].ref.set({token:admin.firestore.FieldValue.delete(),entryAlerts:false,tokenErrorAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}));
    });
    if(cleanup.length)await Promise.allSettled(cleanup);
    return{sent:result.successCount,failed:result.failureCount,sourceTagged:!!sourceDeviceId};
  }

  return{
    notifyMomEntry:onDocumentCreated({document:'users/{userId}/entries/{entryId}',region:'us-central1',memory:'256MiB',timeoutSeconds:30},event=>sendForCreate(event,'entries')),
    notifyBabyEvent:onDocumentCreated({document:'users/{userId}/familyEvents/{eventId}',region:'us-central1',memory:'256MiB',timeoutSeconds:30},event=>sendForCreate(event,'familyEvents'))
  };
}

module.exports={createCrossDeviceAlertFunctions,formatAlert,recentRecord};
