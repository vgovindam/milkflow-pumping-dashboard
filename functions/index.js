'use strict';

const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const OpenAI=require('openai');
const {buildContext,fallbackAdvice}=require('./pump-context');

admin.initializeApp();
const db=admin.firestore();
const OPENAI_API_KEY=defineSecret('OPENAI_API_KEY');
const ALLOWED_ORIGINS=new Set([
  'https://vgovindam.github.io',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173'
]);

const SYSTEM_PROMPT=`You are the optional explanatory layer for MilkFlow, a private pumping tracker.
The app already has a deterministic pump-scheduling engine. Treat its localRecommendation as the source of truth for the immediate next-pump timing. Your job is to explain the pattern in a concise, human way using ONLY the structured context supplied.

Rules:
- Never invent sessions, amounts, nursing intake, symptoms, or missing days.
- Nursing duration is separate from pumped milk; never estimate milk volume from nursing minutes.
- Treat dailyOverride totals as already incorporated into the supplied daily totals.
- Prefer multi-day patterns (3-7+ complete days) over a single high or low session.
- When a 5-pump trial is selected, compare it with the prior 6-pump baseline when the data supports that comparison. If there are too few complete days, say the trend is still building.
- Do not tell the user to stack or double pumps simply to catch a missed clock slot.
- Tired and Travel are flexible-day modes: explain how the actual session pattern changes the day without implying the original clock must be recovered exactly.
- If postpartumWeeks is under 12 and the target is reduced, use cautious wording because supply may still be establishing. Do not claim a reduction will definitely lower supply.
- Do not diagnose. If the supplied context has no symptom information, do not invent medical warnings.
- Never claim certainty. Be specific about which logged signals support the suggestion.
- Keep the main message under 120 words. Use warm, plain language, not clinical or robotic prose.
- If the localRecommendation and the historical trend conflict, keep the immediate local timing but explain the longer-term trend separately.
`;

const RESPONSE_SCHEMA={
  type:'object',
  additionalProperties:false,
  properties:{
    headline:{type:'string'},
    message:{type:'string'},
    confidence:{type:'string',enum:['high','medium','low']},
    signals:{type:'array',items:{type:'string'},maxItems:4},
    safety_note:{type:'string'}
  },
  required:['headline','message','confidence','signals','safety_note']
};

function setCors(req,res){
  const origin=req.headers.origin;
  if(origin&&ALLOWED_ORIGINS.has(origin))res.set('Access-Control-Allow-Origin',origin);
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
}

async function authenticate(req){
  const value=String(req.headers.authorization||'');
  if(!value.startsWith('Bearer '))throw Object.assign(new Error('Missing sign-in token'),{status:401});
  return admin.auth().verifyIdToken(value.slice(7));
}

function cutoffISO(days=45){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}

async function loadCloud(uid){
  const root=db.collection('users').doc(uid), cutoff=cutoffISO(45);
  const [entrySnap,profileDoc,coachDoc,coachDaysSnap]=await Promise.all([
    root.collection('entries').where('date','>=',cutoff).get(),
    root.collection('private').doc('profile').get(),
    root.collection('private').doc('pumpCoach').get(),
    root.collection('pumpCoachDays').where('date','>=',cutoff).get()
  ]);
  const profile=profileDoc.exists?(profileDoc.data()||{}):{};
  return {
    entries:entrySnap.docs.map(d=>({id:d.id,...d.data()})),
    profile:{
      dailyGoalMl:profile.dailyGoalMl??null,
      schedule:Array.isArray(profile.schedule)?profile.schedule:[],
      babyBirthDate:profile.baby?.birthDate||profile.babyBirthDate||null,
      dailyOverrides:profile.dailyOverrides||{}
    },
    coach:coachDoc.exists?(coachDoc.data()||{}):{},
    coachDays:coachDaysSnap.docs.map(d=>({date:d.id,...d.data()}))
  };
}

function cleanResult(x,fallback){
  if(!x||typeof x!=='object')return fallback;
  const message=String(x.message||'').trim();
  if(!message)return fallback;
  return {
    headline:String(x.headline||fallback.headline).trim().slice(0,90),
    message:message.slice(0,1200),
    confidence:['high','medium','low'].includes(x.confidence)?x.confidence:'medium',
    signals:Array.isArray(x.signals)?x.signals.map(v=>String(v).slice(0,180)).slice(0,4):[],
    safety_note:String(x.safety_note||'').trim().slice(0,400)
  };
}

async function callAI(context){
  const client=new OpenAI({apiKey:OPENAI_API_KEY.value()});
  const models=[process.env.OPENAI_MODEL||'gpt-5.6-sol','gpt-5.6-terra'];
  let lastError=null;
  for(const model of [...new Set(models)]){
    try{
      const response=await client.responses.create({
        model,
        reasoning:{effort:'medium'},
        max_output_tokens:700,
        input:[
          {role:'system',content:[{type:'input_text',text:SYSTEM_PROMPT}]},
          {role:'user',content:[{type:'input_text',text:JSON.stringify(context)}]}
        ],
        text:{format:{type:'json_schema',name:'milkflow_pump_coach',strict:true,schema:RESPONSE_SCHEMA}}
      });
      const text=String(response.output_text||'').trim();
      if(!text)throw new Error('Empty AI response');
      return {result:JSON.parse(text),model,responseId:response.id||null};
    }catch(err){lastError=err;console.warn(`AI coach attempt failed on ${model}`,err?.message||err)}
  }
  throw lastError||new Error('AI coach unavailable');
}

exports.pumpCoachAI=onRequest({region:'us-central1',secrets:[OPENAI_API_KEY],timeoutSeconds:30,memory:'256MiB'},async(req,res)=>{
  setCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).send('');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
  try{
    const decoded=await authenticate(req), uid=decoded.uid;
    const client=req.body?.context&&typeof req.body.context==='object'?req.body.context:{};
    client.reason=req.body?.reason||client.reason||'update';
    const cloud=await loadCloud(uid);
    const context=buildContext({client,cloudEntries:cloud.entries,cloudProfile:cloud.profile,cloudCoach:cloud.coach,cloudCoachDays:cloud.coachDays});
    const fallback=fallbackAdvice(context);
    let source='rules',model=null,responseId=null,result=fallback;
    try{
      const ai=await callAI(context);
      result=cleanResult(ai.result,fallback);source='ai';model=ai.model;responseId=ai.responseId;
    }catch(err){console.warn('Using deterministic AI-coach fallback',err?.message||err)}

    const payload={ok:true,source,model,responseId,...result,contextVersion:context.schemaVersion,generatedAt:new Date().toISOString()};
    await db.collection('users').doc(uid).collection('private').doc('pumpCoachAI').set({
      ...payload,
      responseId:responseId||null,
      requestReason:context.requestReason,
      plan:context.plan,
      trends:context.trends,
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true}).catch(err=>console.warn('AI coach state save skipped',err?.message||err));
    return res.status(200).json(payload);
  }catch(err){
    const status=err?.status||401;
    console.error('pumpCoachAI request rejected',err?.message||err);
    return res.status(status).json({ok:false,error:status===401?'Please sign in again.':'AI coach request could not be processed.'});
  }
});
