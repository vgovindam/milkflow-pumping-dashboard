(() => {
'use strict';

/* Network fallback only. No DOM or application-state ownership. */
if(window.__milkflowFamilyChatFetch)return;
const nativeFetch=window.fetch?.bind(window);if(!nativeFetch)return;
window.__milkflowFamilyChatFetch=true;
window.fetch=async function(input,init){
  const cfg=window.MILKFLOW_CONFIG||{},primary=String(cfg.familyChatEndpoint||''),url=typeof input==='string'?input:(input?.url||'');
  if(!primary||url!==primary)return nativeFetch(input,init);
  const endpoints=[primary,...(Array.isArray(cfg.familyChatEndpoints)?cfg.familyChatEndpoints:[])].map(String).filter((v,i,a)=>v&&a.indexOf(v)===i);
  let lastResponse=null,lastError=null;
  for(const endpoint of endpoints){
    try{
      const res=await nativeFetch(endpoint,init);lastResponse=res;
      if(res.ok||![404,408,425,429,500,502,503,504].includes(res.status))return res;
    }catch(err){lastError=err;}
  }
  if(lastResponse)return lastResponse;
  throw lastError||new TypeError('MilkFlow family chat is temporarily unreachable');
};
})();
