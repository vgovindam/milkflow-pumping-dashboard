(() => {
'use strict';
const STATE_KEY='milkflow-family-v4-state';
const MARKER_KEY='milkflow-diaper-normalization-v1';
const mapSubtype=v=>{const s=String(v||'').trim().toLowerCase();if(s==='dirty'||s==='poopy')return'poop';if(s==='mixed')return'both';if(s==='wet'||s==='poop'||s==='both')return s;return v||null;};

function normalizeLocal(){
  try{
    const raw=localStorage.getItem(STATE_KEY);if(!raw)return 0;
    const state=JSON.parse(raw);if(!Array.isArray(state.babyEvents))return 0;
    let changed=0;
    state.babyEvents=state.babyEvents.map(e=>{
      if(e?.eventType!=='diaper')return e;
      const next=mapSubtype(e.subtype||e.status);
      if(next&&next!==e.subtype){changed++;return {...e,sourceSubtype:e.sourceSubtype||e.subtype||e.status||null,subtype:next};}
      return e;
    });
    if(changed){localStorage.setItem(STATE_KEY,JSON.stringify(state));localStorage.setItem(MARKER_KEY,new Date().toISOString());}
    return changed;
  }catch(e){console.warn('Local diaper normalization skipped',e);return 0;}
}

async function normalizeCloud(user){
  try{
    if(!window.firebase?.firestore||!user)return;
    const db=firebase.firestore();
    const ref=db.collection('users').doc(user.uid).collection('familyEvents');
    const snap=await ref.where('eventType','==','diaper').get();
    const fixes=[];
    snap.forEach(doc=>{
      const d=doc.data()||{};const next=mapSubtype(d.subtype||d.status);
      if(next&&next!==d.subtype)fixes.push({ref:doc.ref,subtype:next,sourceSubtype:d.sourceSubtype||d.subtype||d.status||null});
    });
    for(let i=0;i<fixes.length;i+=400){
      const batch=db.batch();
      fixes.slice(i,i+400).forEach(f=>batch.set(f.ref,{subtype:f.subtype,sourceSubtype:f.sourceSubtype,normalizedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}));
      await batch.commit();
    }
    if(fixes.length) location.reload();
  }catch(e){console.warn('Cloud diaper normalization skipped',e);}
}

normalizeLocal();
window.addEventListener('DOMContentLoaded',()=>{
  try{
    if(!window.firebase?.auth)return;
    firebase.auth().onAuthStateChanged(user=>{if(user)normalizeCloud(user);});
  }catch(e){console.warn('Diaper normalization auth hook skipped',e);}
});
})();
