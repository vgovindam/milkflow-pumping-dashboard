'use strict';

function createFamilyChat({onRequest,admin,db,OPENAI_API_KEY,ALLOWED_ORIGINS}){
  const OpenAI=require('openai');
  const MAX_MESSAGE=1800, WINDOW_MS=15*60*1000, WINDOW_LIMIT=20, DAY_LIMIT=120;

  function cors(req,res){
    const origin=req.headers.origin;
    if(origin&&ALLOWED_ORIGINS.has(origin))res.set('Access-Control-Allow-Origin',origin);
    res.set('Vary','Origin');
    res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods','POST, OPTIONS');
  }
  async function auth(req){
    const v=String(req.headers.authorization||'');
    if(!v.startsWith('Bearer '))throw Object.assign(new Error('Missing sign-in token'),{status:401});
    try{return await admin.auth().verifyIdToken(v.slice(7));}
    catch{throw Object.assign(new Error('Invalid sign-in token'),{status:401});}
  }
  function cutoff(days){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10);}
  function cleanMom(e){return{id:e.id||null,type:e.type||null,date:e.date||null,time:e.time||null,amountMl:e.amountMl??null,durationMinutes:e.durationMinutes??e.durationMin??e.duration??null,side:e.side||null,voidedAt:e.voidedAt||null};}
  function cleanBaby(e){return{id:e.id||null,babyId:e.babyId||e.baby_id||null,eventType:e.eventType||e.event_type||null,date:e.date||null,time:e.time||null,subtype:e.subtype||null,feedingType:e.feedingType||e.feeding_type||null,amountOz:e.amountOz??e.amount_oz??null,durationMinutes:e.durationMinutes??e.duration_minutes??null,totalMinutes:e.totalMinutes??e.total_minutes??null,side:e.side||null,voidedAt:e.voidedAt||null};}
  function average(rows,key){const v=rows.map(x=>Number(x[key])).filter(Number.isFinite);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null;}

  function pumpDays(entries,overrides={}){
    const map={};
    for(const e of entries){
      if(e.type!=='pump'||e.voidedAt||!e.date)continue;
      const d=map[e.date]||(map[e.date]={date:e.date,count:0,totalMl:0,sessions:[]});
      d.count++;d.totalMl+=Number(e.amountMl)||0;d.sessions.push({time:e.time||null,amountMl:Number(e.amountMl)||0});
    }
    for(const d of Object.values(map)){
      d.sessions.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
      const o=Number(overrides?.[d.date]);if(Number.isFinite(o)&&o>d.totalMl)d.totalMl=o;
    }
    return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).slice(-35);
  }
  function babyDays(events){
    const map={};
    for(const e of events){
      if(e.voidedAt||!e.date)continue;
      const key=`${e.babyId||'baby'}:${e.date}`;
      const d=map[key]||(map[key]={babyId:e.babyId||null,date:e.date,nursing:0,nursingMinutes:0,feeds:0,feedOz:0,wet:0,poop:0,both:0,sleepMinutes:0});
      if(e.eventType==='nursing'){d.nursing++;d.nursingMinutes+=Number(e.totalMinutes??e.durationMinutes)||0;}
      else if(e.eventType==='feeding'){d.feeds++;d.feedOz+=Number(e.amountOz)||0;}
      else if(e.eventType==='diaper'){
        const s=String(e.subtype||'').toLowerCase();
        if(s==='wet')d.wet++;else if(s==='poop'||s==='dirty')d.poop++;else if(s==='both'||s==='mixed')d.both++;
      }else if(e.eventType==='sleep')d.sleepMinutes+=Number(e.durationMinutes)||0;
    }
    return Object.values(map).sort((a,b)=>`${a.date}${a.babyId||''}`.localeCompare(`${b.date}${b.babyId||''}`)).slice(-35);
  }
  function buildMetrics(pDays,mom,bDays,todayKey){
    // Calendar dates, not array positions, define completed days. Yesterday
    // remains complete even if there have been no pump entries today.
    const completed=pDays.filter(x=>x.date<todayKey),recent=completed.slice(-7),prior=completed.slice(-14,-7);
    const babyComplete=bDays.filter(x=>x.date<todayKey).slice(-7);
    const sessions=mom.filter(e=>e.type==='pump'),recentSessions=sessions.filter(e=>e.date>=cutoff(14)&&e.date<todayKey);
    const morning=recentSessions.filter(e=>Number(String(e.time||'99').slice(0,2))<10);
    const high=recentSessions.reduce((best,e)=>(Number(e.amountMl)||0)>(Number(best?.amountMl)||0)?e:best,null);
    const avg=(rows,key,places=1)=>{const nums=rows.map(x=>Number(x[key])).filter(Number.isFinite);return nums.length?Number((nums.reduce((sum,n)=>sum+n,0)/nums.length).toFixed(places)):null;};
    const todayPump=pDays.find(x=>x.date===todayKey)||{totalMl:0,count:0};
    const todayBaby=bDays.find(x=>x.date===todayKey)||null;
    const a=avg(recent,'totalMl'),b=avg(prior,'totalMl');
    const diff=recent.length>=3&&prior.length>=3&&b>0?Number(((a-b)/b*100).toFixed(1)):null;
    return {
      pumping:{todaySoFar:{totalMl:todayPump.totalMl,count:todayPump.count,partial:true},recentCompletedDays:recent.length,avgDailyMl7:avg(recent,'totalMl',0),avgPumpCount7:avg(recent,'count'),previousCompletedDays:prior.length,previousAvgDailyMl7:avg(prior,'totalMl',0),changePct7:diff,morningSessionAvgMl:avg(morning,'amountMl',0),highestRecentSession:high?{date:high.date,time:high.time,amountMl:Number(high.amountMl)||0}:null},
      baby:{todaySoFar:todayBaby?{...todayBaby,partial:true}:null,completedDays:babyComplete.length,avgBottleOz:avg(babyComplete,'feedOz'),avgBottleFeeds:avg(babyComplete,'feeds'),avgNursingSessions:avg(babyComplete,'nursing'),avgWetIncludingMixed:avg(babyComplete.map(x=>({...x,wetTotal:x.wet+x.both})),'wetTotal'),avgPoopIncludingMixed:avg(babyComplete.map(x=>({...x,poopTotal:x.poop+x.both})),'poopTotal'),avgSleepMinutes:avg(babyComplete.filter(x=>x.sleepMinutes>0),'sleepMinutes')}
    };
  }
  async function load(uid,todayKey){
    const root=db.collection('users').doc(uid);
    const [momSnap,babySnap,profileDoc,chatSnap]=await Promise.all([
      root.collection('entries').where('date','>=',cutoff(30)).get(),
      root.collection('familyEvents').where('date','>=',cutoff(30)).get(),
      root.collection('private').doc('profile').get(),
      root.collection('familyChatMessages').orderBy('createdAt','desc').limit(14).get().catch(()=>null)
    ]);
    const raw=profileDoc.exists?(profileDoc.data()||{}):{};
    const mom=momSnap.docs.map(d=>cleanMom({id:d.id,...d.data()})).filter(e=>!e.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`));
    const baby=babySnap.docs.map(d=>cleanBaby({id:d.id,...d.data()})).filter(e=>!e.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`));
    const babyActive=raw.baby?.id?baby.filter(e=>!e.babyId||e.babyId===raw.baby.id):baby;
    const pDays=pumpDays(mom,raw.dailyOverrides||{}),bDays=babyDays(babyActive);
    const history=chatSnap?chatSnap.docs.map(d=>d.data()).reverse().map(x=>({role:x.role==='assistant'?'assistant':'user',text:String(x.text||'').slice(0,700)})).slice(-10):[];
    return{profile:{dailyGoalMl:raw.profile?.dailyGoalMl??raw.dailyGoalMl??null,dailyPumpTarget:raw.profile?.dailyPumpTarget??null,schedule:Array.isArray(raw.schedule)?raw.schedule:[],baby:raw.baby||null},pumpDays:pDays.slice(-14),recentMom:mom.slice(-30),babyDays:bDays.slice(-14),recentBaby:babyActive.slice(-36),history,metrics:buildMetrics(pDays,mom,bDays,todayKey)};
  }

  // Domain gate: family care/lactation are allowed even when the user never
  // says "MilkFlow" or "pump"; reject clearly unrelated subjects instead.
  function outOfScope(message){
    const text=String(message||'').toLowerCase();
    return /\b(write (?:me )?code|programming|javascript|python script|sql query|debug code|grow (?:a )?plant|gardening|fertilizer|lawn|stock market|bitcoin|crypto trading|election results|sports scores|football lineup|hotel booking|makeup tutorial|celebrity gossip|tattoo design)\b/.test(text);
  }
  function inScope(message,history=[]){
    const text=String(message||'').toLowerCase().trim();
    if(outOfScope(text))return false;
    if(/\b(pump|pumping|express|milk|supply|session|schedule|wean|lactat|breast|nurs|feed|feeding|bottle|formula|diaper|wet|poop|sleep|nap|baby|infant|newborn|toddler|child|kid|parent|postpartum|birth|development|growth|weight|height|milestone|vaccin|immuniz|rash|fever|temperature|chills|sore|tender|pain|mastitis|clog|blocked duct|lump|engorg|bleb|fussy|crying|colic|reflux|spit.up|hydration|dehydrat|doctor|pediatric|obgyn|ob.gyn|period|cycle|birth control|breastfeeding|wellbeing|care|tracker|log|logged|today|tomorrow|yesterday|next|total|average|avg|trend|compare|output|ounce|oz|ml|mother|mom|saahas|vinni|milkflow)\b/.test(text))return true;
    return history.length>0&&text.length<=180&&/^(why|how|what|and|then|okay|ok|yes|no|compare|is that|should i|what if|tell me|can i|how about|also|more|please|it |this |that )/.test(text);
  }
  async function consumeQuota(root,uid){
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),ref=root.collection('familyChatUsage').doc(day);
    return db.runTransaction(async tx=>{
      const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{};
      const recent=(Array.isArray(data.recentMs)?data.recentMs:[]).map(Number).filter(t=>Number.isFinite(t)&&now-t<WINDOW_MS);
      const count=Number(data.dayCount||0);
      if(recent.length>=WINDOW_LIMIT)return{ok:false,reason:'window',retryAfterMs:Math.max(1000,WINDOW_MS-(now-recent[0]))};
      if(count>=DAY_LIMIT)return{ok:false,reason:'day',retryAfterMs:null};
      recent.push(now);
      tx.set(ref,{uid,day,dayCount:count+1,recentMs:recent.slice(-WINDOW_LIMIT),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      return{ok:true};
    });
  }

  const SYSTEM=`You are MilkFlow Care Chat, a warm, capable, safety-aware family-care assistant for pumping and raising a baby. This is NOT a generic chatbot.
Scope: breast pumping, milk output/supply, storage, schedules, nursing, lactation, mastitis/tenderness/fever/engorgement, pump fit and hygiene, postpartum wellbeing related to feeding, baby feeds/formula, bottles, feeding cues, diapers, sleep, developmental milestones, age-appropriate care, common infant symptoms, and interpretation of MilkFlow logs, trends, reminders and insights. Briefly decline coding, plants, markets and other unrelated requests.
Data: The server supplies authoritative authenticated tracker records and precomputed daily metrics. Use the computed numbers and dates; never invent a log, clinical assessment, or nursing milk volume. A missing entry is not proof an event did not happen. Today is incomplete: NEVER compare today's partial totals with full-day history as a decline. Averages refer to completed LOGGED days; mention coverage and missing logging. Bottle ounces exclude nursing intake. Clarify per-session and per-day metrics. Follow recent context in follow-up questions.
Be proactive, specific, useful and kind. Explain meaningful changes and possible contributing factors without claiming causality. Distinguish permanent 1–8 pump target from today/tomorrow overrides. Offer small next steps and relevant follow-up questions. Never auto-record or change data; client controls require explicit user confirmation.
Medical: provide general breast-care/parenting guidance, never diagnose, prescribe antibiotics or give patient-specific medication doses. For breast tenderness or inflammatory mastitis, cold packs, comfortable usual milk removal, avoiding deep massage and aggressive emptying can help. With breast pain AND fever/chills or spreading redness, advise same-day clinical contact. For baby younger than 3 months with temperature 100.4 F / 38 C or higher, urgent medical evaluation; breathing difficulty, unresponsiveness or severe dehydration warrants emergency care. Ask for age, symptoms and temperature, don't assume.
Keep most replies about 90–200 words, but adapt to urgency and complexity. Lead with what matters.`;
  const schema={type:'object',additionalProperties:false,properties:{reply:{type:'string'},topic:{type:'string',enum:['mom','baby','family','other']},needs_attention:{type:'boolean'}},required:['reply','topic','needs_attention']};
  async function callModel(payload){
    const client=new OpenAI({apiKey:OPENAI_API_KEY.value()}),models=[...new Set([process.env.OPENAI_MODEL||'gpt-5.6-sol','gpt-5.6-terra'])];
    let last;
    for(const model of models){
      try{
        const r=await client.responses.create({model,reasoning:{effort:'medium'},max_output_tokens:700,input:[{role:'system',content:[{type:'input_text',text:SYSTEM}]},{role:'user',content:[{type:'input_text',text:JSON.stringify(payload)}]}],text:{format:{type:'json_schema',name:'milkflow_family_chat',strict:true,schema}}});
        const parsed=JSON.parse(String(r.output_text||'{}'));if(!parsed.reply)throw new Error('Empty reply');
        return{reply:String(parsed.reply).slice(0,3200),topic:parsed.topic||'family',needs_attention:!!parsed.needs_attention,source:'ai'};
      }catch(err){last=err;console.warn(`Family chat attempt failed on ${model}`,err?.message||err);}
    }
    throw last||new Error('Family chat unavailable');
  }
  function rulesReply(p){
    const q=String(p.userMessage||'').toLowerCase(),normal=Number(p.profile?.dailyPumpTarget),plan=p.dynamicPlan||{},m=p.metrics?.pumping||{},b=p.metrics?.baby||{};
    const aboutBaby=/baby|infant|newborn|saahas|my son|my daughter/.test(q);
    if(aboutBaby&&/fever|temperature|breathing|unresponsive/.test(q))
      return{reply:'For a baby under three months, a measured temperature of 100.4°F (38°C) or above needs urgent medical evaluation. Breathing difficulty or unresponsiveness needs emergency care. How old is baby and what temperature was measured?',topic:'baby',needs_attention:true,source:'rules'};
    if(/mastitis|breast.*(tender|pain|lump|red|hot)|clog|plugged duct|engorg|nipple pain|tenderness|sore breast|fever|chills/.test(q)){
      const concern=/fever|chill|red|hot|mastitis/.test(q);
      return{reply:concern?'Breast pain with fever, chills or spreading redness merits same-day advice from your clinician or OB/midwife. Mastitis is one possible cause. Use a cold compress, continue your usual comfortable pumping/feeding rhythm, rest and hydrate; avoid hard massage or additional pumping to empty. What temperature did you measure, and is there redness?':'For breast tenderness, cold compresses, checking flange fit and comfortable pump settings may help. Keep your usual rhythm; avoid deep massage or extra emptying sessions. Get clinician advice promptly for fever, chills, spreading redness, a worsening lump or severe pain. Which breast hurts?',topic:'mom',needs_attention:concern,source:'rules'};
    }
    if(/normal|usual|default|permanent/.test(q)&&/pump|session|target/.test(q)&&Number.isFinite(normal))
      return{reply:'Your normal target is '+normal+' pumps per day; today may have a one-day override.',topic:'mom',needs_attention:false,source:'rules'};
    if(/next.*pump|when.*pump|pump.*next/.test(q)&&plan.future?.length){
      const n=Number(plan.future[0]),h=Math.floor(n/60)%24,mm=n%60;
      return{reply:'Your next planned pump is about '+(((h+11)%12)+1)+':'+String(mm).padStart(2,'0')+' '+(h>=12?'PM':'AM')+'. Your normal target is '+(normal||'the saved setting')+'/day.',topic:'mom',needs_attention:false,source:'rules'};
    }
    if(/avg|average|7.?day|weekly|compare|trend|how much|output|better|worse/.test(q)&&m.avgDailyMl7!=null)
      return{reply:'Your last '+m.recentCompletedDays+' completed logged pumping days averaged '+m.avgDailyMl7+' mL/day and '+m.avgPumpCount7+' pumps/day.'+(m.previousAvgDailyMl7==null?'':' The previous '+m.previousCompletedDays+' days averaged '+m.previousAvgDailyMl7+' mL/day'+(m.changePct7==null?'':' ('+Math.abs(m.changePct7)+'% '+(m.changePct7>=0?'higher':'lower')+')')+'.')+' Today so far: '+(m.todaySoFar?.totalMl||0)+' mL in '+(m.todaySoFar?.count||0)+' pumps (excluded from the comparison).',topic:'mom',needs_attention:false,source:'rules'};
    if(/baby|feed|nurs|diaper|wet|poop|sleep/.test(q)){
      const d=b.todaySoFar;
      if(d)return{reply:'Baby today so far: '+d.feeds+' logged bottle feeds ('+d.feedOz+' oz), '+d.nursing+' nursing sessions and '+(d.wet+d.poop+d.both)+' diapers ('+(d.wet+d.both)+' wet/mixed). Bottle totals exclude nursing milk. Logged activity cannot alone establish adequate intake.',topic:'baby',needs_attention:false,source:'rules'};
    }
    return{reply:'I can help with pumping patterns, milk supply, breast tenderness or fever, breastfeeding, baby feeding, sleep, growth, parenting care and app records. I can also answer follow-up questions about your completed-day averages.',topic:'family',needs_attention:false,source:'rules'};
  }
  async function saveMessage(root,id,data){try{await root.collection('familyChatMessages').doc(id).set({...data,createdAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});}catch(err){console.warn('Family chat history write failed',err?.message||err);}}

  return onRequest({region:'us-central1',secrets:[OPENAI_API_KEY],timeoutSeconds:30,memory:'256MiB'},async(req,res)=>{
    cors(req,res);
    if(req.method==='OPTIONS')return res.status(204).send('');
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
    let requestRef=null,requestId=null;
    try{
      const decoded=await auth(req),uid=decoded.uid,rawId=String(req.body?.requestId||'').trim();
      requestId=/^[A-Za-z0-9_-]{8,100}$/.test(rawId)?rawId:`legacy-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const mode=req.body?.mode==='status'?'status':'run',root=db.collection('users').doc(uid);
      requestRef=root.collection('familyChatRequests').doc(requestId);
      if(mode==='status'){
        const snap=await requestRef.get();if(!snap.exists)return res.status(404).json({ok:false,status:'missing',requestId});
        const saved=snap.data()||{};
        if(saved.status==='completed'&&saved.result)return res.status(200).json({ok:true,status:'completed',requestId,...saved.result});
        if(saved.status==='failed')return res.status(200).json({ok:false,status:'failed',requestId,error:saved.error||'Request failed'});
        return res.status(202).json({ok:false,status:'processing',requestId});
      }
      const message=String(req.body?.message||'').trim();
      if(!message)return res.status(400).json({ok:false,error:'Message required'});
      if(message.length>MAX_MESSAGE)return res.status(400).json({ok:false,error:`Message too long. Keep MilkFlow Chat messages under ${MAX_MESSAGE} characters.`});
      const now=Date.now();
      const gate=await db.runTransaction(async tx=>{
        const snap=await tx.get(requestRef),saved=snap.exists?(snap.data()||{}):{};
        if(saved.status==='completed'&&saved.result)return{state:'completed',result:saved.result};
        const age=now-Number(saved.startedAtMs||0);if(saved.status==='processing'&&age>=0&&age<45000)return{state:'processing'};
        tx.set(requestRef,{status:'processing',message,startedAtMs:now,updatedAtMs:now,attempts:Number(saved.attempts||0)+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
        return{state:'run'};
      });
      if(gate.state==='completed')return res.status(200).json({ok:true,status:'completed',requestId,...gate.result});
      if(gate.state==='processing')return res.status(202).json({ok:false,status:'processing',requestId});

      let cloud={profile:{},pumpDays:[],recentMom:[],babyDays:[],recentBaby:[],history:[],metrics:{}};
      try{cloud=await load(uid,String(req.body?.context?.localDay||new Date().toISOString().slice(0,10)));}catch(err){console.warn('Family chat cloud context unavailable',err?.message||err);}
      if(!inScope(message,cloud.history)){
        const out={reply:'I’m MilkFlow’s Mom + Baby tracker assistant, so I stay focused on pumping, feeding, diapers, sleep, baby/tracker patterns, and your MilkFlow plan. I can’t help with unrelated topics here.',topic:'other',needs_attention:false,source:'scope'};
        await Promise.all([requestRef.set({status:'completed',result:out,completedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}),saveMessage(root,`${requestId}-user`,{role:'user',text:message}),saveMessage(root,`${requestId}-assistant`,{role:'assistant',text:out.reply})]);
        return res.status(200).json({ok:true,status:'completed',requestId,...out});
      }
      const quota=await consumeQuota(root,uid);
      if(!quota.ok){
        const out={reply:quota.reason==='window'?'You’ve sent quite a few AI questions in a short period. MilkFlow logging and plan controls still work normally; try open-ended coaching again a little later.':'You’ve reached today’s MilkFlow AI-chat allowance. Logging, schedules, notifications, and tracker features still work normally.',topic:'family',needs_attention:false,source:'quota'};
        await requestRef.set({status:'completed',result:out,completedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
        return res.status(429).json({ok:false,status:'completed',requestId,...out,retryAfterMs:quota.retryAfterMs||null});
      }
      const local=req.body?.context&&typeof req.body.context==='object'?req.body.context:{};
      const deviceConversation=Array.isArray(local.localConversation)?local.localConversation.slice(-6).map(x=>({role:x.role==='assistant'?'assistant':'user',text:String(x.text||'').slice(0,700)})):[];
      const payload={currentLocalTime:local.currentLocalTime||null,localDay:local.localDay||null,timeZone:local.timeZone||null,currentWorkspace:local.currentWorkspace||null,activeBaby:local.activeBaby||null,dynamicPlan:local.dynamicPlan||null,pumpChoices:local.pumpChoices||null,profile:cloud.profile,metrics:cloud.metrics,pumpDays:cloud.pumpDays.slice(-14),babyDays:cloud.babyDays.slice(-14),recentMom:cloud.recentMom.slice(-18),recentBaby:cloud.recentBaby.slice(-24),conversation:cloud.history.slice(-8),deviceConversation,userMessage:message};
      let out;try{out=await callModel(payload);}catch(err){console.warn('Using family chat tracker fallback',err?.message||err);out=rulesReply(payload);}
      const result={reply:out.reply,topic:out.topic||'family',needs_attention:!!out.needs_attention,source:out.source||'ai'};
      await Promise.all([requestRef.set({status:'completed',result,completedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}),saveMessage(root,`${requestId}-user`,{role:'user',text:message}),saveMessage(root,`${requestId}-assistant`,{role:'assistant',text:result.reply})]);
      return res.status(200).json({ok:true,status:'completed',requestId,...result});
    }catch(err){
      console.error('Family chat failed',err);
      if(requestRef){try{await requestRef.set({status:'failed',error:String(err?.message||'Request failed').slice(0,500),failedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});}catch{}}
      const status=Number(err?.status)||500;
      return res.status(status).json({ok:false,status:'failed',requestId,error:status<500?err.message:'MilkFlow Chat is temporarily unavailable.'});
    }
  });
}

module.exports={createFamilyChat};
