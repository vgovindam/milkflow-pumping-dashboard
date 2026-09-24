/* Six worlds, seven distinct illustrations each. Drawings occupy the upper-left of a
   64px tile; index.mjs adds the same small, semantic care-action badge at bottom right. */
const actions=['milk','nurse','formula','wet','poop','mixed','pump'];
const draw=(body,color,outline='#354456')=>`<g stroke="${outline}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${body}</g>`;
const eye=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.25" fill="#24313d" stroke="none"/>`;
const dot=(x,y,color,r=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`;
const ocean=[
 ['clownfish',c=>draw(`<path d="M9 28Q24 9 44 25L51 17V39L43 32Q23 47 9 28Z" fill="${c.coat}"/><path d="M21 18Q26 27 22 37M34 19Q37 28 34 37" fill="none" stroke="${c.inner}" stroke-width="4"/>${eye(17,26)}`,c.coat)],
 ['octopus',c=>draw(`<path d="M17 30V23a13 13 0 0 1 26 0v7Q40 36 30 37T17 30Z" fill="${c.coat}"/><path d="M17 31Q8 32 13 41T24 37Q21 46 28 45Q32 45 31 37Q37 46 42 43Q47 39 39 35Q52 43 50 34L43 30" fill="none" stroke="${c.coat2}" stroke-width="5"/>${eye(25,25)}${eye(36,25)}`,c.coat)],
 ['seahorse',c=>draw(`<path d="M29 9Q43 7 43 20L49 24L42 29Q43 40 32 39Q25 39 28 46Q32 50 36 44" fill="${c.coat}"/><path d="M27 15L21 13L25 23M28 30L18 35L28 36" fill="${c.coat2}"/>${eye(37,19)}`,c.coat)],
 ['crab',c=>draw(`<path d="M17 28Q28 19 41 28V37Q29 47 17 37Z" fill="${c.coat}"/><path d="M19 29L12 22L9 27M39 29L47 22L51 27M18 36L10 41M41 36L49 41" fill="none" stroke="${c.coat2}" stroke-width="4"/>${eye(25,29)}${eye(34,29)}`,c.coat)],
 ['sea turtle',c=>draw(`<ellipse cx="29" cy="29" rx="16" ry="13" fill="${c.coat}"/><path d="M17 25L9 20L8 28L16 31M40 24L48 19L50 26L44 31M20 38L17 45M37 38L42 45" fill="${c.coat2}"/><path d="M24 18L29 27L35 19M16 29H42M24 38L29 28L35 38" fill="none" stroke="${c.inner}"/>${eye(49,24)}`,c.coat)],
 ['jellyfish',c=>draw(`<path d="M11 28a18 18 0 0 1 36 0Z" fill="${c.coat}"/><path d="M14 30Q9 40 15 44M21 30Q24 42 19 47M29 30Q25 42 30 48M37 30Q42 42 36 47M44 30Q48 38 43 45" fill="none" stroke="${c.coat2}" stroke-width="3"/>${eye(24,24)}${eye(34,24)}`,c.coat)],
 ['whale',c=>draw(`<path d="M8 32Q18 17 40 23Q49 25 50 33L56 28V39L48 36Q34 49 16 40Z" fill="${c.coat}"/><path d="M27 22Q28 14 23 12M30 22Q35 14 38 14" fill="none" stroke="${c.inner}" stroke-width="2.7"/>${eye(42,29)}`,c.coat)]
];
const star=(x,y,r,color)=>`<path d="M${x} ${y-r}L${x+r*.27} ${y-r*.27}L${x+r} ${y}L${x+r*.27} ${y+r*.27}L${x} ${y+r}L${x-r*.27} ${y+r*.27}L${x-r} ${y}L${x-r*.27} ${y-r*.27}Z" fill="${color}"/>`;
const celestial=[
 ['crescent moon',c=>draw(`<path d="M36 9A20 20 0 1 0 49 38Q31 43 36 9Z" fill="${c.coat}"/>${star(15,13,3,c.inner)}${star(48,14,3,c.inner)}`,c.coat)],
 ['north star',c=>draw(`${star(29,27,20,c.coat)}${dot(29,27,c.inner,5)}${dot(49,12,c.inner,2)}`,c.coat)],
 ['ringed planet',c=>draw(`<circle cx="30" cy="27" r="15" fill="${c.coat}"/><ellipse cx="30" cy="27" rx="25" ry="7" transform="rotate(-24 30 27)" fill="none" stroke="${c.inner}" stroke-width="4"/>${dot(26,23,c.coat2,4)}`,c.coat)],
 ['comet',c=>draw(`<path d="M9 39Q26 35 35 18M12 46Q25 38 35 26" fill="none" stroke="${c.coat2}" stroke-width="3"/>${star(39,23,12,c.coat)}`,c.coat)],
 ['little galaxy',c=>draw(`<path d="M8 31Q22 5 43 18Q58 27 42 41Q26 53 16 35Q11 23 27 20Q41 16 40 32" fill="none" stroke="${c.coat}" stroke-width="6"/>${star(33,29,6,c.inner)}${dot(13,14,c.coat2)}`,c.coat)],
 ['constellation',c=>draw(`<path d="M12 31L23 13L34 27L47 12M34 27L43 41L50 36" fill="none" stroke="${c.coat2}" stroke-width="2"/>${[[12,31],[23,13],[34,27],[47,12],[43,41],[50,36]].map(([x,y])=>star(x,y,3.5,c.coat)).join('')}`,c.coat)],
 ['sunrise',c=>draw(`<circle cx="29" cy="27" r="13" fill="${c.coat}"/>${Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return `<path d="M${(29+17*Math.cos(a)).toFixed(1)} ${(27+17*Math.sin(a)).toFixed(1)}L${(29+23*Math.cos(a)).toFixed(1)} ${(27+23*Math.sin(a)).toFixed(1)}" fill="none" stroke="${c.coat2}" stroke-width="2.5"/>`}).join('')}`,c.coat)]
];
const woodland=[
 ['red fox',c=>draw(`<path d="M10 14L21 20Q29 16 37 20L49 14L44 36Q29 49 14 36Z" fill="${c.coat}"/><path d="M13 34Q26 29 29 39Q32 29 45 34Q29 49 13 34Z" fill="${c.inner}"/>${eye(22,28)}${eye(36,28)}${dot(29,38,c.outline,2)}`,c.coat)],
 ['little owl',c=>draw(`<path d="M15 14L22 19Q30 15 38 19L46 14V36Q30 49 14 36Z" fill="${c.coat}"/><circle cx="23" cy="27" r="6" fill="${c.inner}"/><circle cx="37" cy="27" r="6" fill="${c.inner}"/>${eye(23,27)}${eye(37,27)}<path d="M27 34L30 38L33 34Z" fill="${c.coat2}"/>`,c.coat)],
 ['fawn',c=>draw(`<path d="M14 13Q23 15 22 21Q30 18 38 21Q37 14 47 13Q46 23 42 27Q47 42 30 44Q13 42 18 27Q14 23 14 13Z" fill="${c.coat}"/><path d="M23 19L19 8M36 19L42 8" fill="none" stroke="${c.coat2}" stroke-width="3"/>${eye(23,29)}${eye(37,29)}${dot(30,36,c.outline,2)}`,c.coat)],
 ['hedgehog',c=>draw(`<path d="M10 33L8 26L15 25L13 18L21 20L25 12L31 18L39 14L39 22L47 22L44 31Q51 42 35 44H24Q9 44 10 33Z" fill="${c.coat2}"/><path d="M16 32Q25 23 42 29Q47 43 32 44Q17 45 16 32Z" fill="${c.coat}"/>${eye(36,33)}${dot(46,37,c.outline,2)}`,c.coat)],
 ['cottontail rabbit',c=>draw(`<ellipse cx="21" cy="15" rx="5" ry="13" transform="rotate(-15 21 15)" fill="${c.coat}"/><ellipse cx="37" cy="15" rx="5" ry="13" transform="rotate(15 37 15)" fill="${c.coat}"/><ellipse cx="29" cy="33" rx="17" ry="14" fill="${c.coat}"/>${eye(22,31)}${eye(36,31)}${dot(29,36,c.coat2,2.4)}`,c.coat)],
 ['brown bear',c=>draw(`<circle cx="15" cy="19" r="7" fill="${c.coat2}"/><circle cx="43" cy="19" r="7" fill="${c.coat2}"/><circle cx="29" cy="30" r="19" fill="${c.coat}"/><ellipse cx="29" cy="37" rx="9" ry="6" fill="${c.inner}"/>${eye(22,28)}${eye(36,28)}${dot(29,35,c.outline,2)}`,c.coat)],
 ['red squirrel',c=>draw(`<path d="M37 38Q53 46 50 29Q47 20 41 25Q51 12 55 25Q61 47 39 47Z" fill="${c.coat2}"/><path d="M18 18L22 10L27 18Q36 14 42 20V36Q31 48 17 39Z" fill="${c.coat}"/>${eye(25,27)}${eye(36,27)}${dot(31,36,c.outline,2)}`,c.coat)]
];
const sunset=[
 ['acacia tree',c=>draw(`<path d="M30 21V47M30 29L17 20M30 26L43 18" fill="none" stroke="${c.coat2}" stroke-width="4"/><path d="M7 20Q7 12 20 12Q24 5 30 12Q38 6 42 14Q52 12 53 22Q45 28 35 23Q27 29 19 23Q10 27 7 20Z" fill="${c.coat}"/>`,c.coat)],
 ['desert sun',c=>draw(`<circle cx="30" cy="26" r="17" fill="${c.coat}"/><path d="M7 46Q28 34 53 45" fill="none" stroke="${c.coat2}" stroke-width="4"/>`,c.coat)],
 ['sand dune',c=>draw(`<path d="M5 39Q17 19 30 29Q43 12 56 39V47H5Z" fill="${c.coat}"/><path d="M5 44Q28 29 56 45" fill="none" stroke="${c.coat2}" stroke-width="3"/>${dot(45,16,c.inner,5)}`,c.coat)],
 ['sunset flamingo',c=>draw(`<path d="M26 43V30Q14 27 18 18Q23 11 32 16Q37 20 31 23Q25 24 26 30Q40 23 43 33Q43 43 26 43Z" fill="${c.coat}"/><path d="M26 42L24 50M35 41L37 50" fill="none" stroke="${c.coat2}" stroke-width="2"/><path d="M31 19L37 21L31 23Z" fill="${c.inner}"/>${eye(25,18)}`,c.coat)],
 ['sunset oryx',c=>draw(`<path d="M18 23L14 5M39 22L44 5" fill="none" stroke="${c.coat2}" stroke-width="2.8"/><path d="M15 22Q28 12 42 22L44 37Q29 47 14 37Z" fill="${c.coat}"/><path d="M22 30L25 34M36 30L33 34" stroke="${c.inner}" stroke-width="3"/>${eye(23,27)}${eye(36,27)}`,c.coat)],
 ['golden horizon',c=>draw(`<path d="M5 35H54M11 42Q30 35 51 43" fill="none" stroke="${c.coat2}" stroke-width="3"/><path d="M15 35A15 15 0 0 1 45 35Z" fill="${c.coat}"/>${star(49,12,4,c.inner)}`,c.coat)],
 ['baobab',c=>draw(`<path d="M24 47Q27 37 25 27L13 21M25 27L36 15M27 31L47 24M27 27L28 8" fill="none" stroke="${c.coat2}" stroke-width="6"/><path d="M8 20Q15 13 20 20M30 10Q35 3 41 13M42 22Q48 15 53 22" fill="none" stroke="${c.coat}" stroke-width="6"/>`,c.coat)]
];
const flower=(petals,center,color,stem='#61906b')=>draw(`<path d="M29 34V48M29 42Q21 35 16 40M29 43Q39 36 44 40" fill="none" stroke="${stem}" stroke-width="2.8"/>${petals}${center}`,color);
const floral=[
 ['daisy',c=>flower(Array.from({length:9},(_,i)=>`<ellipse cx="29" cy="${18}" rx="4" ry="9" transform="rotate(${i*40} 29 28)" fill="${c.coat}"/>`).join(''),dot(29,28,c.inner,7),c.coat)],
 ['pink tulip',c=>flower(`<path d="M17 18L23 22L29 15L35 22L41 18Q43 38 29 39Q15 38 17 18Z" fill="${c.coat}"/><path d="M29 16V36" fill="none" stroke="${c.coat2}"/>`,dot(29,30,c.inner,2),c.coat)],
 ['sunflower',c=>flower(Array.from({length:12},(_,i)=>`<ellipse cx="29" cy="16" rx="3.5" ry="9" transform="rotate(${i*30} 29 28)" fill="${c.coat}"/>`).join(''),dot(29,28,c.coat2,9),c.coat)],
 ['lavender',c=>flower(Array.from({length:8},(_,i)=>`<ellipse cx="${i%2?34:24}" cy="${12+Math.floor(i/2)*7}" rx="5" ry="3.5" fill="${c.coat}"/>`).join(''),dot(29,10,c.inner,3),c.coat)],
 ['poppy',c=>flower(Array.from({length:5},(_,i)=>`<ellipse cx="29" cy="17" rx="8" ry="12" transform="rotate(${i*72} 29 28)" fill="${c.coat}"/>`).join(''),dot(29,28,c.coat2,6),c.coat)],
 ['bluebell',c=>flower(`<path d="M18 22Q29 14 40 22L45 32Q39 38 35 33Q30 40 26 33Q20 38 15 32Z" fill="${c.coat}"/>`,dot(29,24,c.inner,3),c.coat)],
 ['rose',c=>flower(`<path d="M29 14Q39 9 43 21Q48 29 40 38Q32 44 21 38Q12 33 16 24Q17 16 29 14Z" fill="${c.coat}"/><path d="M20 27Q28 17 38 24Q42 30 32 35Q22 37 24 26Q29 21 35 26" fill="none" stroke="${c.coat2}" stroke-width="2.5"/>`,dot(29,28,c.inner,2),c.coat)]
];
const clouds=[
 ['paper kite',c=>draw(`<path d="M29 7L45 27L29 41L13 27Z" fill="${c.coat}"/><path d="M13 27H45M29 7V41M29 41Q37 46 31 50" fill="none" stroke="${c.coat2}" stroke-width="2"/>`,c.coat)],
 ['sleepy cloud',c=>draw(`<path d="M14 39Q7 38 9 31Q10 25 17 26Q18 13 30 15Q40 14 42 26Q51 26 51 35Q50 42 42 42H17Z" fill="${c.coat}"/>${eye(25,31)}${eye(36,31)}`,c.coat)],
 ['rainbow',c=>draw(`<path d="M8 41A21 21 0 0 1 50 41" fill="none" stroke="${c.coat}" stroke-width="5"/><path d="M14 41A15 15 0 0 1 44 41" fill="none" stroke="${c.coat2}" stroke-width="5"/><path d="M20 41A9 9 0 0 1 38 41" fill="none" stroke="${c.inner}" stroke-width="5"/>`,c.coat)],
 ['raindrop',c=>draw(`<path d="M29 8Q42 27 42 33A13 13 0 0 1 16 33Q16 27 29 8Z" fill="${c.coat}"/><path d="M20 33Q20 40 27 42" fill="none" stroke="${c.inner}" stroke-width="3"/>`,c.coat)],
 ['wind swirl',c=>draw(`<path d="M8 23H42Q52 23 50 16Q47 10 40 15M7 30H48Q55 31 51 38Q47 43 42 39M14 37H31Q38 38 35 44Q32 48 27 45" fill="none" stroke="${c.coat}" stroke-width="4"/>${star(14,14,3,c.inner)}`,c.coat)],
 ['little star',c=>draw(`${star(29,28,20,c.coat)}${star(47,12,4,c.inner)}${star(11,44,3,c.inner)}`,c.coat)],
 ['hot air balloon',c=>draw(`<path d="M29 8Q45 8 45 23Q45 33 34 39H24Q13 33 13 23Q13 8 29 8Z" fill="${c.coat}"/><path d="M24 39L26 44H32L34 39M24 44H34V49H24Z" fill="${c.coat2}"/><path d="M29 8Q18 24 27 38M29 8Q40 24 31 38" fill="none" stroke="${c.inner}"/>`,c.coat)]
];
const worlds={
 ocean:{label:'Ocean friends',art:ocean,colors:['#EF9C62','#A884CA','#F4C978','#F19A76','#85C8AD','#B8A4DE','#83BBD6'],inner:'#FFF3CC',outline:'#315978'},
 celestial:{label:'Moon and stars',art:celestial,colors:['#F8D990','#F3E3A0','#AFB6EC','#E9A5CB','#BFA6DC','#96C7DC','#F4C27B'],inner:'#FFF2C9',outline:'#454679'},
 woodland:{label:'Woodland forest',art:woodland,colors:['#D98556','#AD906C','#C6A775','#A78C6F','#E8C5A5','#B68C6B','#C98554'],inner:'#F9E8C9',outline:'#534A34'},
 'safari-sunset':{label:'Safari sunset',art:sunset,colors:['#758C59','#EBC16F','#D8A172','#EEA4A5','#D2AB83','#EDAD69','#847C60'],inner:'#FFE6A1',outline:'#644A34'},
 'floral-meadow':{label:'Floral meadow',art:floral,colors:['#F7E7D1','#E998A8','#F9CC60','#AD90D6','#E88780','#92ACD8','#DB7C9B'],inner:'#F7C968',outline:'#475B47'},
 'cozy-clouds':{label:'Cozy clouds',art:clouds,colors:['#F6BD9B','#DAEBF4','#F8B8A2','#A7D6EF','#B4C9EA','#F7D79A','#F5B69D'],inner:'#FFF8E5',outline:'#5A6886'}
};
export default Object.fromEntries(Object.entries(worlds).map(([id,w])=>[id,{
  id,label:w.label,cast:Object.fromEntries(actions.map((action,i)=>{const [name,render]=w.art[i];return [action,{name,coat:w.colors[i],coat2:w.colors[(i+2)%7],inner:w.inner,render:c=>render({...c,outline:w.outline})}]})),
  mascot:{name:w.art[0][0],coat:w.colors[0],coat2:w.colors[2],inner:w.inner,render:c=>w.art[0][1]({...c,outline:w.outline})}
}]));
