(() => {
'use strict';

/*
 * Cross-device care alerts.
 *
 * This module does not own MilkFlow records. It watches the same authenticated
 * Firestore collections the app already syncs, tags only brand-new local writes with
 * a source device id, and alerts another signed-in device when a new record arrives.
 *
 * Visible app: realtime Firestore -> in-app alert.
 * Background/closed installed PWA: FCM -> service worker notification, when the user
 * has granted notification permission and this device has a registered push token.
 */
const DEVICE_KEY='milkflow-device-id-v1';
const PREF_KEY='milkflow-cross-device-alerts-v1';
const STATE_KEY='milkflow-family-v4-state';
const MESSAGING_SDK='https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js';
const RECENT_MS=15*60*1000;
const BUILD='stable45-human13';

function makeId(){
  try{if(crypto?.randomUUID)return crypto.randomUUID();}catch{}
  return `mf-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
}
function getDeviceId(){
  let id='';
  try{id=localStorage.getItem(DEVICE_KEY)||'';}catch{}
  if(id)return id;
  id=makeId();
  try{localStorage.setItem(DEVICE_KEY,id);}catch{}
  return id;
}
const DEVICE_ID=getDeviceId();

function preference(){
  try{const raw=localStorage.getItem(PREF_KEY);return raw===null?true:raw!=='off';}catch{return true;}
}
function setPreference(on){try{localStorage.setItem(PREF_KEY,on?'on':'off');}catch{}}
function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function currentNames(){const s=readState();return{mom:s.profile?.momName||'Mom',baby:s.baby?.name||'Baby'};}
function deviceLabel(){
  const ua=navigator.userAgent||'';
  if(/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))return'iPad';
  if(/iPhone/i.test(ua))return'iPhone';
  if(/Android/i.test(ua))return'Android';
  if(/Macintosh|Mac OS X/i.test(ua))return'Mac';
  if(/Windows/i.test(ua))return'Windows PC';
  return'Other device';
}
function to12(t){
  if(!t)return'';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);
  return`${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function recentRecord(data){
  const t=Date.parse(data?.createdAt||'');
  return Number.isFinite(t)&&Math.abs(Date.now()-t)<=RECENT_MS;
}
function formatAlert(collection,data){
  const names=currentNames(), time=to12(data?.time), suffix=data?.sourceDeviceLabel?` · from ${data.sourceDeviceLabel}`:'';
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
    const min=Number(data?.durationMinutes||0), duration=min>=60?`${Math.floor(min/60)} hr${min%60?` ${min%60} min`:''}`:`${min} min`;
    return{title:`${names.baby} sleep logged`,body:`${duration}${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
  }
  if(kind==='growth'){
    const wt=data?.weightLb!=null?`${data.weightLb} lb${data.weightOz!=null?` ${data.weightOz} oz`:''}`:'Growth measurement';
    return{title:`${names.baby} growth logged`,body:`${wt}${suffix}`,route:'baby-growth'};
  }
  if(kind==='milestone')return{title:`${names.baby} milestone logged`,body:`${String(data?.milestoneText||'Development milestone')}${suffix}`,route:'development'};
  return{title:`${names.baby} care logged`,body:`New ${kind} entry${time?` · ${time}`:''}${suffix}`,route:'baby-history'};
}

let auth=null,db=null,currentUser=null,messaging=null,pushToken='',sdkPromise=null;
let watchers=[];
const seen=new Set();

function stopWatchers(){watchers.forEach(fn=>{try{fn();}catch{}});watchers=[];}
function seenKey(collection,id){return`${collection}:${id}`;}
function markSeen(key){seen.add(key);if(seen.size>120){const first=seen.values().next().value;seen.delete(first);}}
function showToast(title,body,route){
  const toast=document.getElementById('toast');if(!toast)return;
  toast.replaceChildren();
  const span=document.createElement('span');
  const strong=document.createElement('strong');strong.textContent=title;
  const detail=document.createElement('span');detail.textContent=` ${body}`;
  span.append(strong,detail);toast.appendChild(span);
  if(route){
    const btn=document.createElement('button');btn.type='button';btn.className='toast-action';btn.textContent='View';
    btn.addEventListener('click',()=>{toast.classList.remove('show');location.hash=`#${route}`;});
    toast.appendChild(btn);
  }
  toast.classList.add('show');clearTimeout(toast._mfAlertTimer);toast._mfAlertTimer=setTimeout(()=>toast.classList.remove('show'),5200);
}
function announceVisible(collection,id,data){
  if(!preference()||document.visibilityState!=='visible'||!recentRecord(data))return;
  const key=seenKey(collection,id);if(seen.has(key))return;markSeen(key);
  const a=formatAlert(collection,data);showToast(a.title,a.body,a.route);
}

async function tagLocalWrite(doc){
  const data=doc.data()||{};
  if(data.sourceDeviceId||!recentRecord(data))return;
  try{
    await doc.ref.set({
      sourceDeviceId:DEVICE_ID,
      sourceDeviceLabel:deviceLabel(),
      sourceClientAt:new Date().toISOString()
    },{merge:true});
  }catch(err){console.warn('MilkFlow device tag skipped',err?.message||err);}
}
function watchCollection(name){
  let primed=false;
  const ref=db.collection('users').doc(currentUser.uid).collection(name);
  const unsub=ref.onSnapshot({includeMetadataChanges:true},snap=>{
    for(const change of snap.docChanges({includeMetadataChanges:true})){
      if(change.type==='removed')continue;
      const data=change.doc.data()||{};
      if(change.doc.metadata.hasPendingWrites){
        tagLocalWrite(change.doc);
        continue;
      }
      if(!primed)continue;
      if(!data.sourceDeviceId||data.sourceDeviceId===DEVICE_ID)continue;
      if(change.type==='added'||change.type==='modified')announceVisible(name,change.doc.id,data);
    }
    primed=true;
  },err=>console.warn(`MilkFlow ${name} alert stream`,err?.message||err));
  watchers.push(unsub);
}
function startWatchers(){stopWatchers();if(!db||!currentUser)return;watchCollection('entries');watchCollection('familyEvents');}

function messagingSupported(){return'Notification'in window&&'serviceWorker'in navigator&&location.protocol==='https:';}
function loadMessagingSdk(){
  if(window.firebase?.messaging)return Promise.resolve();
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${MESSAGING_SDK}"]`);
    if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
    const script=document.createElement('script');script.src=MESSAGING_SDK;script.async=true;
    script.onload=resolve;script.onerror=()=>reject(new Error('Firebase Messaging SDK did not load'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}
async function writeDeviceRegistration(token,enabled=true){
  if(!db||!currentUser)return;
  await db.collection('users').doc(currentUser.uid).collection('devices').doc(DEVICE_ID).set({
    deviceId:DEVICE_ID,
    label:deviceLabel(),
    token:token||null,
    entryAlerts:!!enabled,
    platform:navigator.platform||'',
    userAgent:(navigator.userAgent||'').slice(0,240),
    appBuild:BUILD,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    lastSeen:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
}
async function registerPush({ask=false}={}){
  if(!currentUser||!messagingSupported())return false;
  let permission=Notification.permission;
  if(permission!=='granted'&&ask)permission=await Notification.requestPermission();
  if(permission!=='granted')return false;
  try{
    await loadMessagingSdk();
    if(!window.firebase?.messaging)return false;
    const reg=await navigator.serviceWorker.ready;
    messaging=firebase.messaging();
    const cfg=window.MILKFLOW_CONFIG||{};
    const options={serviceWorkerRegistration:reg};
    if(cfg.webPushVapidKey)options.vapidKey=cfg.webPushVapidKey;
    pushToken=await messaging.getToken(options);
    if(!pushToken)throw new Error('No push token returned');
    await writeDeviceRegistration(pushToken,true);
    if(!messaging.__milkflowForegroundBound){
      messaging.__milkflowForegroundBound=true;
      messaging.onMessage(payload=>{
        const d=payload?.data||{},key=d.alertId||'';
        if(key&&seen.has(key))return;
        if(key)markSeen(key);
        if(document.visibilityState==='visible'&&preference())showToast(d.title||'MilkFlow update',d.body||'New care was logged on another device.',d.route||'');
      });
    }
    return true;
  }catch(err){console.warn('MilkFlow push registration unavailable',err?.message||err);return false;}
}
async function disableRemote(){
  if(!db||!currentUser)return;
  try{await db.collection('users').doc(currentUser.uid).collection('devices').doc(DEVICE_ID).set({entryAlerts:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}catch{}
}
async function enableAlerts(){
  setPreference(true);
  if(currentUser&&messagingSupported())await registerPush({ask:true});
  renderSettingsPanel();
}
async function disableAlerts(){setPreference(false);await disableRemote();renderSettingsPanel();}

function permissionText(){
  if(!currentUser)return'Sign in with the same family account on both devices first.';
  if(!preference())return'Off on this device.';
  if(!messagingSupported())return'In-app alerts are on while MilkFlow is open. System push is not supported in this browser.';
  if(Notification.permission==='denied')return'In-app alerts are on. System notifications are blocked in this device’s browser settings.';
  if(Notification.permission==='granted'&&pushToken)return'On · in-app alerts plus background push notifications on this device.';
  if(Notification.permission==='granted')return'In-app alerts are on. Background push registration will retry automatically.';
  return'In-app alerts are on. Enable system alerts to receive them when MilkFlow is in the background.';
}
function renderSettingsPanel(){
  if(document.body.dataset.screen!=='set-reminders')return;
  const view=document.getElementById('view');if(!view)return;
  let panel=document.getElementById('mfCrossDeviceAlerts');
  if(!panel){panel=document.createElement('section');panel.id='mfCrossDeviceAlerts';panel.className='panel';view.appendChild(panel);}
  const on=preference(), canAsk=currentUser&&messagingSupported()&&Notification.permission==='default';
  const buttonLabel=!on?'Turn on':canAsk?'Enable system alerts':'Turn off';
  panel.innerHTML=`<div class="panel-head"><h3>Cross-device alerts</h3><span class="panel-note">Family account</span></div><div class="setting-row"><div><strong>${on?'On':'Off'}</strong><span>When another signed-in device logs Pump, Nursing, Feed, Diaper, Sleep or Growth, this device is alerted. The device that entered it is excluded.</span></div><button type="button" data-cross-device-alert-toggle="${!on||canAsk?'on':'off'}">${buttonLabel}</button></div><p class="chart-note">${permissionText()}</p>`;
}

async function onUser(user){
  currentUser=user||null;pushToken='';stopWatchers();
  if(!currentUser){renderSettingsPanel();return;}
  db=firebase.firestore();startWatchers();
  if(preference()&&messagingSupported()&&Notification.permission==='granted')await registerPush({ask:false});
  renderSettingsPanel();
}
function init(){
  const cfg=window.MILKFLOW_CONFIG||{};
  if(!window.firebase||!cfg.firebaseConfig)return setTimeout(init,120);
  try{if(!firebase.apps.length)firebase.initializeApp(cfg.firebaseConfig);}catch{}
  auth=firebase.auth();db=firebase.firestore();auth.onAuthStateChanged(onUser);
  window.addEventListener('milkflow:base-rendered',renderSettingsPanel);
  window.addEventListener('pageshow',renderSettingsPanel);
  document.addEventListener('click',e=>{
    const toggle=e.target.closest('[data-cross-device-alert-toggle]');
    if(toggle){e.preventDefault();toggle.dataset.crossDeviceAlertToggle==='on'?enableAlerts():disableAlerts();return;}
    if(e.target.closest('[data-signout]'))disableRemote();
  },true);
}

window.MilkFlowCrossDeviceAlerts={deviceId:DEVICE_ID,enable:enableAlerts,disable:disableAlerts,status:()=>({enabled:preference(),permission:'Notification'in window?Notification.permission:'unsupported',pushReady:!!pushToken,user:currentUser?.uid||null})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
