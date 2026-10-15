/* ===== Bhava Bala: house strength (BPHS Ch.27) ===== */
(function(){
const IC=['🧍','💰','🦁','🏡','👶','🩺','💍','🔮','🙏','💼','🤝','🌙'],TH=['self & health','money & family','courage & effort','home & peace','children & creativity','work & health issues','marriage & partnership','change & the hidden','luck & guidance','career & status','gains & friends','loss, foreign lands & rest'];
const SEV=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'],ord=n=>n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:Math.min(n%10,4)%4]||'th');
const TYPES={nara:['Human sign','East',1],jala:['Water sign','North',4],keeta:['Scorpion sign','West',7],chatus:['Four-legged sign','South',10]};
const WEAK={nara:7,jala:10,keeta:1,chatus:4};
const adiff=(a,b)=>{const d=(((a-b)%360)+360)%360;return d>180?d-360:d;};
function signType(s,deg){if([2,5,6,10].includes(s)||(s===8&&deg<15))return 'nara';if(s===3||s===11||(s===9&&deg>=15))return 'jala';if(s===7)return 'keeta';return 'chatus';}
function drishti(from,to,pl){const d=normDeg(to-from);let v=0;
  if(d>=30&&d<60)v=(d-30)/2;else if(d>=60&&d<90)v=d-45;else if(d>=90&&d<120)v=(120-d)/2+30;else if(d>=120&&d<150)v=150-d;else if(d>=150&&d<180)v=(d-150)*2;else if(d>=180&&d<300)v=(300-d)/2;
  const z=(a,b)=>d>=a&&d<b;if((pl==='Mars'&&(z(90,120)||z(210,240)))||(pl==='Jupiter'&&(z(120,150)||z(240,270)))||(pl==='Saturn'&&(z(60,90)||z(270,300))))v=60;return v;}
window.computeBhavaBala=function(c,lat,lon){
  const B=computeBhavaChalit(c,lat,lon),L=c.siderealLongitudes,m=B.houses.map(h=>h.madhya),waxing=normDeg(L.Moon-L.Sun)<180;
  const ben=n=>n==='Moon'?waxing:['Jupiter','Venus','Mercury'].includes(n);
  const rows=m.map((M,i)=>{const h=i+1,sign=Math.floor(M/30)%12,deg=M%30,lord=SIGNS[sign].lord,sb=c.shadbala.planets[lord],A=sb.totalVirupas;
    const ty=signType(sign,deg),wk=m[WEAK[ty]-1],dist=Math.abs(adiff(M,wk)),D=dist/3;
    const asp=SEV.filter(n=>n!=='Sun'||true).map(n=>{const v=drishti(L[n],M,n);if(v<=0)return null;const full=(n==='Jupiter'||n==='Mercury'),sg=ben(n)?1:-1,val=full?v:sg*v/4;return {n,v,val,full};}).filter(Boolean);
    const R=asp.reduce((s,a)=>s+a.val,0);
    return {h,sign,deg,madhya:M,lord,lordRupas:sb.totalRupas,lordStrong:sb.isStrong,A,type:ty,dist,D,asp,R,total:A+D+R,rupas:(A+D+R)/60};});
  const mean=rows.reduce((s,r)=>s+r.total,0)/12;rows.forEach(r=>{const x=r.total/mean;r.tier=x>=1.2?['Very strong','vs']:x>=1.05?['Strong','g']:x>=.95?['Average','t']:x>=.8?['Below average','']:['Weak','w'];});
  const order=rows.slice().sort((a,b)=>b.total-a.total);order.forEach((r,i)=>r.rank=i+1);return {rows,mean};};
const heat=t=>{const S=[[0,[201,80,80]],[.5,[232,193,79]],[1,[94,196,183]]];for(let i=1;i<3;i++)if(t<=S[i][0]){const a=S[i-1],b=S[i],k=(t-a[0])/(b[0]-a[0]);return `rgb(${a[1].map((v,j)=>Math.round(v+(b[1][j]-v)*k))})`;}return 'rgb(94,196,183)';};
const f1=x=>x.toFixed(1),sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(1);
function view(c,P,mode){const bb=window.computeBhavaBala(c,P.lat,P.lon),rows=bb.rows,mx=Math.max(...rows.map(r=>r.total)),mn=Math.min(...rows.map(r=>r.total)),best=rows.find(r=>r.rank===1),worst=rows.find(r=>r.rank===12);
  const list=mode==='rank'?rows.slice().sort((a,b)=>a.rank-b.rank):rows;
  const tile=(l,r)=>`<div class="vx-t"><label>${l}</label><b>${IC[r.h-1]} House ${r.h}</b><small>${TH[r.h-1]} · ${f1(r.rupas)} rupas</small></div>`;
  const bars=list.map(r=>{const t=(r.total-mn*.6)/(mx-mn*.6);return `<a class="bb-row" href="#bb${r.h}" data-h="${r.h}"><span>${IC[r.h-1]}</span><b>${r.h}</b><i><u style="width:${Math.max(6,Math.round(t*100))}%;background:${heat((r.total-mn)/(mx-mn||1))}"></u></i><em>${f1(r.rupas)}</em></a>`}).join('');
  const cards=list.map(r=>{const tp=TYPES[r.type],wkh=WEAK[r.type],S=SIGNS[r.sign];
    const comp=(ic,name,val,max,col,txt)=>`<div class="bb-c"><div class="bb-ch"><span>${ic} ${name}</span><b style="color:${col}">${sg(val).replace('+','')}<small> virupas</small></b></div><div class="vx-bar" style="grid-template-columns:1fr"><i><u style="width:${Math.max(2,Math.min(100,Math.abs(val)/max*100))}%;background:${col}"></u></i></div><p>${txt}</p></div>`;
    const net=r.asp.length?r.asp.map(a=>`<span class="vx-chip ${a.val>=0?'g':'b'}">${PLANET_GLYPHS[a.n]} ${a.n} ${sg(a.val)}</span>`).join(''):'<span class="vx-chip">No aspects on this house</span>';
    const why=r.A>=r.D+r.R+120&&r.lordStrong?`Held up mostly by its strong lord ${r.lord}.`:!r.lordStrong?`Its lord ${r.lord} is below its required strength, which drags this house down.`:'Balanced support from lord, direction and aspects.';
    return `<details class="vx-pl bb" id="bb${r.h}"><summary><span class="vx-gl">${IC[r.h-1]}</span><div><b>House ${r.h} · ${TH[r.h-1]}</b><small>#${r.rank} of 12 · ${f1(r.rupas)} rupas</small></div><span class="vx-chip ${r.tier[1]}">${r.tier[0]}</span></summary><div class="rd-b">
      ${comp('👑','Lord strength (Bhavadhipati)',r.A,500,'#E8C14F',`${S.symbol} ${S.name} rules this house. Its lord <b>${r.lord}</b> has ${f1(r.lordRupas)} rupas of planetary strength (${r.lordStrong?'strong':'weak'}), so the house borrows that power.`)}
      ${comp('🧭','Direction (Dig Bala)',r.D,60,'#5EC4B7',`${S.name} is a ${tp[0].toLowerCase()}, which is strongest facing ${tp[1]} (house ${tp[2]}) and weakest at house ${wkh}. This house centre sits ${Math.round(r.dist)}° from its weakest point.`)}
      ${comp('🔭','Aspects (Drishti)',r.R,60,r.R>=0?'#7FA8FF':'#E25555',`Jupiter and Mercury count in full; other helpful planets add a quarter and harsh planets subtract a quarter. ${net}`)}
      <div class="vx-note ${r.tier[1]==='vs'||r.tier[1]==='g'?'g':r.tier[1]==='w'?'b':''}"><div><b>In plain words:</b> ${why}</div></div></div></details>`;}).join('');
  return `<div class="vx-grid">${tile('Strongest house',best)}${tile('Weakest house',worst)}<div class="vx-t"><label>Average</label><b>${f1(bb.mean/60)} rupas</b><small>${rows.filter(r=>r.tier[1]==='vs'||r.tier[1]==='g').length} strong · ${rows.filter(r=>r.tier[1]==='w'||r.tier[0]==='Below average').length} weak</small></div></div>
   <div class="bb-sw"><button type="button" data-m="house" class="${mode==='house'?'on':''}">By house</button><button type="button" data-m="rank" class="${mode==='rank'?'on':''}">By strength</button></div>
   <div class="bb-bars">${bars}</div><div class="rd-h">Tap a house for the full breakdown</div>${cards}
   <details class="bb-how"><summary>How is this calculated?</summary><p>Bhava Bala = <b>Bhavadhipati Bala</b> (Shadbala of the house lord) + <b>Bhava Dig Bala</b> (0–60, from the house centre's angle to its weakest point) + <b>Bhava Drishti Bala</b> (aspects on the house centre; Jupiter and Mercury in full, other benefics +¼, malefics −¼), as in BPHS Chapter 27. House centres use the Sripati (Bhava Chalit) method. 60 virupas = 1 rupa. Compare houses with each other: higher means a life area that flows more easily.</p></details>`;}
window.buildBhavaBalaPanel=function(c,P){window.__bbC=c;window.__bbP=P;let body;try{body=view(c,P,'house');}catch(e){console.warn('bhavabala',e);body='<div class="vx-note b"><div>Could not compute house strength for this chart.</div></div>';}
  return `<div class="section-heading"><h3>Bhava Bala — strength of your 12 houses</h3><div class="rule"></div></div><div class="vx-note"><div>Shadbala tells you how strong each <b>planet</b> is. Bhava Bala tells you how strong each <b>life area</b> is: which parts of life get natural support and which need extra effort.</div></div><div class="bb" id="bbRoot">${body}</div>`;};
document.addEventListener('click',e=>{const s=e.target.closest('.bb-sw button');if(s){const r=document.getElementById('bbRoot');r.innerHTML=view(window.__bbC,window.__bbP,s.dataset.m);return;}
  const a=e.target.closest('.bb-row');if(a){e.preventDefault();const d=document.getElementById('bb'+a.dataset.h);if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});}}});
})();
