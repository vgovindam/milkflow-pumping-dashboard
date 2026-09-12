'use strict';

function createFamilyChat({onRequest,admin,db,OPENAI_API_KEY,ALLOWED_ORIGINS}){
  const OpenAI=require('openai');

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
  const cutoff=days=>{const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10);};
  const byWhen=(a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`);

  function cleanMom(e){
    return {id:e.id||null,type:e.type||null,date:e.date||null,time:e.time||null,amountMl:e.amountMl??null,durationMinutes:e.durationMinutes??e.duration??null,side:e.side||null,voidedAt:e.voidedAt||null};
  }
  function cleanBaby(e){
    return {id:e.id||null,eventType:e.eventType||e.event_type||null,date:e.date||null,time:e.time||null,subtype:e.subtype||null,feedingType:e.feedingType||e.feeding_type||null,amountOz:e.amountOz??e.amount_oz??null,durationMinutes:e.durationMinutes??e.duration_minutes??null,totalMinutes:e.totalMinutes??e.total_minutes??null,leftMinutes:e.leftMinutes??e.left_minutes??null,rightMinutes:e.rightMinutes??e.right_minutes??null,voidedAt:e.voidedAt||null};
  }
  function pumpDays(entries,overrides={}){
    const map={};
    for(const e of entries){
      if(e.type!=='pump'||e.voidedAt||!e.date)continue;
      const d=map[e.date]||(map[e.date]={date:e.date,count:0,totalMl:0,sessions:[]});
      d.count++; d.totalMl+=Number(e.amountMl)||0; d.sessions.push({time:e.time||null,amountMl:Number(e.amountMl)||0,durationMinutes:e.durationMinutes??e.duration??null});
    }
    for(const d of Object.values(map)){
      d.sessions.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
      const o=Number(overrides?.[d.date]); if(Number.isFinite(o)&&o>d.totalMl)d.totalMl=o;
    }
    return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);
  }
  function babyDays(events){
    const map={};
    for(const e of events){
      if(e.voidedAt||!e.date)continue;
      const d=map[e.date]||(map[e.date]={date:e.date,feeds:0,feedOz:0,nursing:0,nursingMinutes:0,wet:0,poop:0,both:0,sleepMinutes:0});
      const t=e.eventType||e.event_type;
      if(t==='feeding'){d.feeds++;d.feedOz+=Number(e.amountOz??e.amount_oz)||0;}
      else if(t==='nursing'){d.nursing++;d.nursingMinutes+=Number(e.totalMinutes??e.total_minutes??e.durationMinutes??e.duration_minutes)||0;}
      else if(t==='diaper'){const s=String(e.subtype||'').toLowerCase();if(s==='wet')d.wet++;else if(s==='poop'||s==='dirty')d.poop++;else if(s==='both'||s==='mixed')d.both++;}
      else if(t==='sleep')d.sleepMinutes+=Number(e.durationMinutes??e.duration_minutes)||0;
    }
    return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);
  }

  async function load(uid){
    const root=db.collection('users').doc(uid);
    const [momSnap,babySnap,profileDoc,chatSnap]=await Promise.all([
      root.collection('entries').where('date','>=',cutoff(45)).get(),
      root.collection('familyEvents').where('date','>=',cutoff(14)).get(),
      root.collection('private').doc('profile').get(),
      root.collection('familyChatMessages').orderBy('createdAt','desc').limit(12).get().catch(()=>null)
    ]);
    const raw=profileDoc.exists?(profileDoc.data()||{}):{};
    const mom=momSnap.docs.map(d=>cleanMom({id:d.id,...d.data()})).filter(e=>!e.voidedAt).sort(byWhen);
    const baby=babySnap.docs.map(d=>cleanBaby({id:d.id,...d.data()})).filter(e=>!e.voidedAt).sort(byWhen);
    const history=chatSnap?chatSnap.docs.map(d=>d.data()).reverse().map(x=>({role:x.role==='assistant'?'assistant':'user',text:String(x.text||'').slice(0,1600)})):[];
    return {
      profile:{dailyGoalMl:raw.profile?.dailyGoalMl??raw.dailyGoalMl??null,schedule:Array.isArray(raw.schedule)?raw.schedule:[],babyBirthDate:raw.baby?.birthDate||raw.babyBirthDate||null},
      pumpDays:pumpDays(mom,raw.dailyOverrides||{}),
      recentMom:mom.slice(-24),
      babyDays:babyDays(baby),
      recentBaby:baby.slice(-40),
      history
    };
  }

  const SYSTEM=`You are MilkFlow Family Chat, a private in-app assistant for one family's Mom and Baby tracker. Answer the user's actual question using only the structured tracker context supplied and the conversation history. Be warm, concise, practical, and plain-spoken.

Rules:
- Never invent a pump, amount, feed, diaper, nursing session, symptom, date, or total.
- Nursing minutes are not pumped milk and must never be converted to mL or oz.
- If the user asks for a pumping table or total, calculate exactly from supplied data and clearly mark incomplete days.
- For next-pump timing, use the supplied dynamicPlan when present. Actual logged pump times override the old fixed clock schedule.
- A single low-output pump, especially a shorter/problem session, does not by itself prove supply changed; prefer multi-day trends.
- For Baby, summarize only logged events. Do not infer intake from nursing duration.
- You may explain general health information, but do not diagnose. For urgent red flags, recommend prompt medical care.
- Do not claim you are the user's existing ChatGPT conversation or that you share ChatGPT account memory. You are the MilkFlow in-app assistant backed by the same family's tracker data.
- Keep normal answers under about 180 words unless the user asks for detail or a table.
`;

  const schema={type:'object',additionalProperties:false,properties:{reply:{type:'string'},topic:{type:'string',enum:['mom','baby','family','other']},needs_attention:{type:'boolean'}},required:['reply','topic','needs_attention']};

  async function callModel(payload){
    const client=new OpenAI({apiKey:OPENAI_API_KEY.value()});
    const models=[process.env.OPENAI_MODEL||'gpt-5.6-sol','gpt-5.6-terra'];
    let last;
    for(const model of [...new Set(models)]){
      try{
        const r=await client.responses.create({model,reasoning:{effort:'medium'},max_output_tokens:900,input:[{role:'system',content:[{type:'input_text',text:SYSTEM}]},{role:'user',content:[{type:'input_text',text:JSON.stringify(payload)}]}],text:{format:{type:'json_schema',name:'milkflow_family_chat',strict:true,schema}}});
        const parsed=JSON.parse(String(r.output_text||'{}'));
        if(!parsed.reply)throw new Error('Empty reply');
        return {reply:String(parsed.reply).slice(0,5000),topic:parsed.topic||'family',needs_attention:!!parsed.needs_attention,model,responseId:r.id||null};
      }catch(err){last=err;console.warn(`Family chat attempt failed on ${model}`,err?.message||err);}
    }
    throw last||new Error('Family chat unavailable');
  }

  return onRequest({region:'us-central1',secrets:[OPENAI_API_KEY],timeoutSeconds:30,memory:'256MiB'},async(req,res)=>{
    cors(req,res);
    if(req.method==='OPTIONS')return res.status(204).send('');
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
    try{
      const decoded=await auth(req),uid=decoded.uid;
      const message=String(req.body?.message||'').trim().slice(0,2500);
      if(!message)return res.status(400).json({ok:false,error:'Message required'});
      const cloud=await load(uid);
      const local=req.body?.context&&typeof req.body.context==='object'?req.body.context:{};
      const payload={currentLocalTime:local.currentLocalTime||null,currentWorkspace:local.currentWorkspace||null,dynamicPlan:local.dynamicPlan||null,localRecentMom:Array.isArray(local.recentMom)?local.recentMom.slice(-16):[],localRecentBaby:Array.isArray(local.recentBaby)?local.recentBaby.slice(-24):[],profile:cloud.profile,pumpDays:cloud.pumpDays,recentMom:cloud.recentMom,babyDays:cloud.babyDays,recentBaby:cloud.recentBaby,conversation:cloud.history,userMessage:message};
      const out=await callModel(payload);
      const col=db.collection('users').doc(uid).collection('familyChatMessages');
      const batch=db.batch();
      batch.set(col.doc(),{role:'user',text:message,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      batch.set(col.doc(),{role:'assistant',text:out.reply,topic:out.topic,needsAttention:out.needs_attention,model:out.model,responseId:out.responseId,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      await batch.commit().catch(err=>console.warn('Family chat history save skipped',err?.message||err));
      return res.status(200).json({ok:true,...out,generatedAt:new Date().toISOString()});
    }catch(err){
      const status=err?.status||500;
      console.error('familyChat request rejected',err?.message||err);
      return res.status(status).json({ok:false,error:status===401?'Please sign in again.':'MilkFlow chat is temporarily unavailable.'});
    }
  });
}

module.exports={createFamilyChat};
