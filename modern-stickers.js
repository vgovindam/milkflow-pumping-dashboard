(() => {
'use strict';

function mount(){
  if(document.getElementById('mfModernStickerStyles'))return;
  const s=document.createElement('style');
  s.id='mfModernStickerStyles';
  s.textContent=`
  /* Modern sticker layer: soft 3D decals instead of clinical/lab-style icon badges. */
  .quick-tile{border:1px solid color-mix(in srgb,currentColor 9%,transparent);box-shadow:0 13px 28px rgba(34,31,56,.10),inset 0 1px rgba(255,255,255,.62)}
  .quick-tile .tile-art{width:64px;height:64px;right:13px;top:12px;border-radius:24px 20px 25px 18px;overflow:visible;border:2px solid rgba(255,255,255,.78);box-shadow:0 12px 24px rgba(48,37,89,.14),inset 0 1px 0 rgba(255,255,255,.82);transform:rotate(3deg);isolation:isolate}
  .quick-tile .tile-art::before{content:'✦';position:absolute;z-index:4;right:-5px;top:-8px;font-size:17px;line-height:1;color:#fff;text-shadow:0 3px 7px rgba(66,46,103,.2)}
  .quick-tile .tile-art::after{content:'';position:absolute;z-index:1;left:8px;top:7px;width:22px;height:12px;border-radius:999px;background:rgba(255,255,255,.55);transform:rotate(-20deg);filter:blur(.2px)}
  .quick-tile .tile-art .gly{width:35px;height:35px;position:relative;z-index:3;filter:drop-shadow(0 3px 3px rgba(42,31,75,.14))}
  .quick-tile.mom .tile-art{background:linear-gradient(145deg,#fff8ff 0%,#ead8ff 48%,#d7c4ff 100%)}
  .quick-tile.nurse .tile-art{background:linear-gradient(145deg,#fff8fb 0%,#ffddea 48%,#f6c8e1 100%)}
  .quick-tile.feed .tile-art{background:linear-gradient(145deg,#f8fffc 0%,#d8f5e8 50%,#c5eadc 100%)}
  .quick-tile.wet .tile-art{background:linear-gradient(145deg,#fbfeff 0%,#d9f0ff 50%,#c4e6fb 100%)}
  .quick-tile.poop .tile-art{background:linear-gradient(145deg,#fffdf7 0%,#fae8c5 50%,#f1d79b 100%)}
  .quick-tile.mixed .tile-art{background:linear-gradient(145deg,#fffaff 0%,#e7dfff 48%,#d8ccff 100%)}

  .orb-face{border-radius:38% 62% 45% 55% / 55% 42% 58% 45%;border:2px solid rgba(255,255,255,.82);box-shadow:0 14px 28px rgba(31,41,71,.14),inset 0 1px 0 rgba(255,255,255,.82)!important;overflow:visible}
  .orb-face::before{content:'✦';position:absolute;right:7px;top:6px;z-index:4;color:rgba(255,255,255,.95);font-size:15px;text-shadow:0 2px 6px rgba(33,46,75,.15)}
  .orb-face::after{content:'';position:absolute;left:15%;top:12%;width:32%;height:18%;border-radius:999px;background:rgba(255,255,255,.48);transform:rotate(-24deg);z-index:1}
  .orb-face .gly{position:relative;z-index:3;width:47%;height:47%;filter:drop-shadow(0 3px 3px rgba(35,45,67,.12))}

  .cta-medallion{border-radius:20px 16px 21px 15px;border:2px solid rgba(255,255,255,.48);background:linear-gradient(145deg,rgba(255,255,255,.32),rgba(255,255,255,.13));box-shadow:0 9px 20px rgba(16,85,77,.18),inset 0 1px rgba(255,255,255,.34);transform:rotate(-2deg)}
  .cta-medallion .gly{filter:drop-shadow(0 3px 3px rgba(0,0,0,.14))}

  .metric-icon,.act-icon,.rev-icon,.row-icon,.stash-art,.doctor-summary-card>div:first-child{border-radius:17px 13px 18px 14px!important;border:1px solid rgba(255,255,255,.64);box-shadow:0 7px 15px rgba(39,38,62,.09),inset 0 1px rgba(255,255,255,.62)}
  .metric-icon .ico,.act-icon .gly,.rev-icon .gly,.row-icon .gly,.stash-art .ico{filter:drop-shadow(0 2px 2px rgba(34,30,64,.10))}
  .gly .g-fill{opacity:.30}
  .gly .g-line{stroke-width:2.15}

  .greet-mark{border-radius:9px 12px 10px 13px;box-shadow:0 4px 9px rgba(32,32,54,.09);transform:rotate(-3deg)}
  .chip{box-shadow:0 4px 12px rgba(30,29,48,.05)}

  :root[data-theme="dark"] .quick-tile .tile-art,
  :root[data-theme="dark"] .orb-face{border-color:rgba(255,255,255,.16);box-shadow:0 13px 28px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.10)!important}
  :root[data-theme="dark"] .quick-tile.mom .tile-art{background:linear-gradient(145deg,#342949,#2a2141)}
  :root[data-theme="dark"] .quick-tile.nurse .tile-art{background:linear-gradient(145deg,#3a2632,#30202d)}
  :root[data-theme="dark"] .quick-tile.feed .tile-art{background:linear-gradient(145deg,#1d3a32,#172e28)}
  :root[data-theme="dark"] .quick-tile.wet .tile-art{background:linear-gradient(145deg,#203545,#182c3b)}
  :root[data-theme="dark"] .quick-tile.poop .tile-art{background:linear-gradient(145deg,#3b301c,#302514)}
  :root[data-theme="dark"] .quick-tile.mixed .tile-art{background:linear-gradient(145deg,#31294b,#29223e)}

  @media(max-width:700px){
    .quick-tile{min-height:138px;border-radius:22px}
    .quick-tile .tile-art{width:61px;height:61px;border-radius:23px 19px 24px 17px}
    .orb-face{width:clamp(80px,24vw,96px)}
  }
  `;
  document.head.appendChild(s);
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
