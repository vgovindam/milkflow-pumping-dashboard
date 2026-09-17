(() => {
'use strict';

// Interaction reliability only. It never owns application state, routing, theme, or layout.
function normalizeStepperInputs(root=document){
  const nodes=root?.matches?.('[data-stepper]')?[root]:root?.querySelectorAll?.('[data-stepper]')||[];
  for(const box of nodes){
    const input=box.querySelector?.('input[type="number"]');
    if(!input)continue;
    const decimals=Number(box.dataset.dec||0);
    input.step=decimals>0?'any':'1';
    input.inputMode=decimals>0?'decimal':'numeric';
  }
}

function repairInteractionState(){
  const dialogOpen=!!document.querySelector('dialog[open]');
  const sheetOpen=!!document.querySelector('.sheet.open');
  if(!dialogOpen&&!sheetOpen){
    document.body.classList.remove('locked');
    document.getElementById('scrim')?.classList.remove('open');
  }
  normalizeStepperInputs(document);
}

window.addEventListener('DOMContentLoaded',()=>normalizeStepperInputs(document),{once:true});
window.addEventListener('pageshow',repairInteractionState);
document.addEventListener('focusin',e=>{
  const box=e.target?.closest?.('[data-stepper]');
  if(box)normalizeStepperInputs(box);
});
document.addEventListener('pointerdown',e=>{
  const box=e.target?.closest?.('[data-stepper]');
  if(box)normalizeStepperInputs(box);
},{passive:true});
})();
