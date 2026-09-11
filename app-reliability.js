(() => {
'use strict';

// Small compatibility layer for installed/bookmarked PWAs. It deliberately does not own
// application state; it only hardens numeric entry and restores sane interaction state
// after iOS/standalone page restores.

function normalizeStepperInputs(root=document){
  root.querySelectorAll?.('[data-stepper] input[type="number"]').forEach(input => {
    const box = input.closest('[data-stepper]');
    const decimals = Number(box?.dataset.dec || 0);
    // The +/- buttons may move in convenient 5/10-unit jumps, but manual entry should
    // never be restricted to those jumps. e.g. 179 mL must be valid even if +/- is 10 mL.
    input.step = decimals > 0 ? 'any' : '1';
    input.inputMode = decimals > 0 ? 'decimal' : 'numeric';
  });
}

function repairInteractionState(){
  // iOS standalone can restore a page from its back/forward cache with stale overlay classes.
  // Never unlock while a real dialog or sheet is open; otherwise remove only stale blockers.
  const dialogOpen = !!document.querySelector('dialog[open]');
  const sheetOpen = !!document.querySelector('.sheet.open');
  if(!dialogOpen && !sheetOpen){
    document.body.classList.remove('locked');
    document.getElementById('scrim')?.classList.remove('open');
  }
  normalizeStepperInputs(document);
}

const observer = new MutationObserver(mutations => {
  for(const m of mutations){
    for(const node of m.addedNodes){
      if(node.nodeType === 1) normalizeStepperInputs(node);
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  normalizeStepperInputs(document);
  observer.observe(document.body,{subtree:true,childList:true});
});
window.addEventListener('pageshow', repairInteractionState);
document.addEventListener('focusin', e => {
  if(e.target?.matches?.('[data-stepper] input[type="number"]')) normalizeStepperInputs(e.target.closest('[data-stepper]'));
});
})();
