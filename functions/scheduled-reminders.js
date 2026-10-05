'use strict';

const {onSchedule}=require('firebase-functions/v2/scheduler');

/* Reminders that reach a phone with the app closed.
 *
 * Everything before this ran inside the page: a timer, a toast, and at best a notification
 * that the browser suppressed because the page was visible. None of it can fire when the app
 * is shut, which is exactly when a pump reminder is worth having. A web page cannot wake
 * itself; only a push can, so the schedule has to be evaluated somewhere that is always
 * awake.
 *
 * Runs every five minutes. For each family it reads the profile the app already syncs -
 * schedule, reminder settings, timezone - decides whether a pump slot or a feed gap is due
 * right now in THAT family's wall clock, and pushes to their registered devices.
 */

const APP_BASE='https://vgovindam.github.io/milkflow-pumping-dashboard/';
const WINDOW_MIN=3;           // a 5-minute cron cannot land on the minute; accept a small window
const INVALID_TOKEN_CODES=new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

const {localNow,toMinutes,to12}=require('./reminder-clock');

function createScheduledReminders({admin,db}){
  async function devicesFor(userRoot){
    const snap=await userRoot.collection('devices').get();
    const out=[];
    snap.forEach(doc=>{ const d=doc.data()||{}; if(d.token&&d.entryAlerts===true) out.push({ref:doc.ref,token:String(d.token)}); });
    return out;
  }

  async function push(targets,{title,body,route,tag}){
    if(!targets.length) return 0;
    const result=await admin.messaging().sendEachForMulticast({
      tokens:targets.map(t=>t.token),
      /* data-only, so the service worker's onBackgroundMessage owns how it is rendered and
         the phone never shows two notifications for one event. */
      data:{title,body,route,alertId:tag},
      webpush:{headers:{Urgency:'high'},fcmOptions:{link:`${APP_BASE}#${route}`}}
    });
    const cleanup=[];
    result.responses.forEach((r,i)=>{
      if(r.success) return;
      const code=r.error?.code||'';
      console.warn('Scheduled reminder push failed',code,r.error?.message||'');
      if(INVALID_TOKEN_CODES.has(code))
        cleanup.push(targets[i].ref.set({token:admin.firestore.FieldValue.delete(),entryAlerts:false},{merge:true}));
    });
    if(cleanup.length) await Promise.allSettled(cleanup);
    return result.successCount;
  }

  async function runForUser(userDoc){
    const userRoot=userDoc.ref;
    const profileSnap=await userRoot.collection('private').doc('profile').get();
    if(!profileSnap.exists) return;
    const p=profileSnap.data()||{};
    const reminders=p.reminders||{};
    if(reminders.enabled!==true&&reminders.feedEnabled!==true) return;

    const now=localNow(p.timeZone);
    if(!now) return;
    const stateRef=userRoot.collection('private').doc('reminderState');
    const state=(await stateRef.get()).data()||{};
    const names={mom:p.profile?.momName||'Mom',baby:p.baby?.name||'Baby'};
    const targets=await devicesFor(userRoot);
    if(!targets.length) return;
    const writes={};

    /* Pump: a scheduled slot, offset by the family's lead time. */
    if(reminders.enabled===true&&Array.isArray(p.schedule)){
      const lead=Number(reminders.leadMin)||0;
      for(let i=0;i<p.schedule.length;i++){
        const slot=toMinutes(p.schedule[i]);
        if(slot===null) continue;
        const target=slot-lead;
        if(Math.abs(now.minutes-target)>WINDOW_MIN) continue;
        const key=`${now.date}-pump-${i}`;
        if(state.lastPump===key) break;
        /* Already pumped around this slot? Then there is nothing to remind anyone about. */
        const since=await userRoot.collection('entries')
          .where('date','==',now.date).where('type','==','pump').get();
        const done=since.docs.some(d=>{
          const m=toMinutes((d.data()||{}).time);
          return m!==null&&Math.abs(m-slot)<=45&&!(d.data()||{}).voidedAt;
        });
        if(!done) await push(targets,{title:`Pump ${i+1} at ${to12(p.schedule[i])}`,body:`${names.mom}, your next session is coming up`,route:'mom-home',tag:'milkflow-pump'});
        writes.lastPump=key;
        break;
      }
    }

    /* Feed: a gap since the last one, rather than a clock time. */
    if(reminders.feedEnabled===true){
      const gap=Number(reminders.feedGapMin)||180;
      const recent=await userRoot.collection('familyEvents').orderBy('createdAt','desc').limit(40).get();
      let last=null;
      recent.forEach(d=>{
        const e=d.data()||{};
        if(e.voidedAt) return;
        if(e.eventType!=='feeding'&&e.eventType!=='nursing') return;
        const at=Date.parse(`${e.date}T${e.time||'00:00'}:00`);
        if(Number.isFinite(at)&&(!last||at>last.at)) last={at,id:d.id,time:e.time};
      });
      if(last){
        const overdueBy=Math.floor((Date.now()-last.at)/60000)-gap;
        if(overdueBy>=0&&overdueBy<=WINDOW_MIN*4){
          const key=`${last.id}-${gap}`;
          if(state.lastFeed!==key){
            await push(targets,{title:`${names.baby} is due for a feed`,body:`Last feed was around ${to12(last.time)}`,route:'baby-home',tag:'milkflow-feed'});
            writes.lastFeed=key;
          }
        }
      }
    }

    if(Object.keys(writes).length) await stateRef.set(writes,{merge:true});
  }

  return {
    careReminders:onSchedule({schedule:'every 5 minutes',region:'us-central1',timeZone:'UTC',memory:'256MiB',timeoutSeconds:120},async()=>{
      const users=await db.collection('users').get();
      const results=await Promise.allSettled(users.docs.map(runForUser));
      const failed=results.filter(r=>r.status==='rejected');
      if(failed.length) console.warn(`careReminders: ${failed.length} of ${users.size} families failed`,failed[0].reason?.message||'');
      return null;
    })
  };
}

module.exports={createScheduledReminders};
