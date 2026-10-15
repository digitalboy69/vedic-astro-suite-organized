/* ===== Retrograde planner ===== */
(function(){
'use strict';
if(typeof planetSpeed!=='function')return;
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0'),PL=['Mercury','Venus','Mars','Jupiter','Saturn'],STEP={Mercury:.5,Venus:1,Mars:1,Jupiter:1,Saturn:1};
const INFO={Mercury:['Communication, contracts, gadgets and travel need double-checking. Best for review, editing and reconnecting.','about 3 times a year · ~3 weeks each'],Venus:['Love, money and comforts get re-evaluated. Avoid big purchases or new commitments; old relationships resurface.','every ~19 months · ~6 weeks'],Mars:['Drive and action turn inward. Delays in starting things; avoid risky ventures and unnecessary fights.','every ~26 months · ~10 weeks'],Jupiter:['Growth turns inward: review beliefs, teachers, finances and plans. Expansion slows, wisdom deepens.','once a year · ~4 months'],Saturn:['Karmic review: responsibilities, structures and long-term goals are re-examined. Results arrive late.','once a year · ~4.5 months']};
const dOf=jd=>new Date(Math.round((jd-2440587.5)*864e5/6e4)*6e4),fd=jd=>{const d=dOf(jd);return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`},ft=jd=>{const d=dOf(jd);return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
function pos(l){const t=Math.round(normDeg(l)*3600),s=Math.floor(t/108000)%12,r=t%108000;return `${SIGNS[s].symbol} ${SIGNS[s].name} ${Math.floor(r/3600)}°${pad(Math.floor(r%3600/60))}′`;}
function span(d){d=Math.abs(d);if(d<1)return `${Math.max(1,Math.round(d*24))} h`;if(d<60)return `${Math.round(d)} d`;const m=d/30.44;return m<24?`${m.toFixed(1)} mo`:`${(m/12).toFixed(1)} y`;}
function stations(n,from,to){const out=[],st=STEP[n];let j=from,s0=planetSpeed(n,j)<0;for(;j<to;j+=st){const j1=j+st,s1=planetSpeed(n,j1)<0;if(s1!==s0){let lo=j,hi=j1;for(let i=0;i<40;i++){const m=(lo+hi)/2;if((planetSpeed(n,m)<0)===s0)lo=m;else hi=m;}out.push({jd:(lo+hi)/2,retro:s1});s0=s1;}}return out;}
function periods(n,y){const y0=toJulianDay(y,1,1,0,0,0),y1=toJulianDay(y+1,1,1,0,0,0),st=stations(n,y0-430,y1+430),out=[];
  for(let i=0;i<st.length;i++){if(!st[i].retro)continue;const e=st[i+1];if(!e||e.retro)continue;if(e.jd>y0&&st[i].jd<y1)out.push({s:st[i].jd,e:e.jd,ls:siderealLongitude(n,st[i].jd),le:siderealLongitude(n,e.jd)});}return {list:out,y0,y1};}
let year=null;
function render(){const now=currentJD,ny=dOf(now).getFullYear();if(year===null)year=ny;year=Math.max(1900,Math.min(2100,year|0));$('rtYear').value=year;
  $('rtChips').querySelectorAll('.filter-chip').forEach(c=>c.classList.toggle('active',year===ny+Number(c.dataset.y)));
  const data=PL.map(n=>({n,...periods(n,year)})),y0=data[0].y0,y1=data[0].y1,all=data.flatMap(d=>d.list.map(p=>({n:d.n,p})));
  const nowR=PL.filter(n=>planetSpeed(n,now)<0),inYear=now>=y0&&now<y1;
  const ev=[];data.forEach(d=>d.list.forEach(p=>{if(p.s>=y0&&p.s<y1)ev.push({n:d.n,jd:p.s,t:'℞ stations retrograde'});if(p.e>=y0&&p.e<y1)ev.push({n:d.n,jd:p.e,t:'stations direct'});}));ev.sort((a,b)=>a.jd-b.jd);
  const ref=inYear?now:y0,nx=ev.find(e=>e.jd>=ref),pct=j=>Math.max(0,Math.min(100,(j-y0)/(y1-y0)*100));
  let h=`<div class="rt-sum"><div><label>Retro periods</label><b>${all.length}</b><small>in ${year}</small></div><div><label>Mercury ℞</label><b>${data[0].list.length}×</b><small>${data[0].list.length?fd(data[0].list[0].s).slice(0,6)+(data[0].list.length>1?' …':''):'none'}</small></div><div><label>${inYear?'Next change':'First change'}</label><b>${nx?PLANET_GLYPHS[nx.n]:'—'}</b><small>${nx?nx.n+' · '+fd(nx.jd).slice(0,6):'none left'}</small></div></div>`;
  h+=`<div class="rt-now"><b style="color:#ff9a9a">℞ Retrograde on ${fd(now)}:</b> ${nowR.length?nowR.map(n=>`<span class="c" style="--pc:${PLANET_COLORS[n]}">${PLANET_GLYPHS[n]} ${n}</span>`).join(''):'none of the five visible planets'}<span>· Rahu &amp; Ketu are always retrograde</span></div>`;
  h+=`<div class="panel-heading">${year} at a glance</div><div class="rt-tl"><div class="rt-mo">${MONTHS.map(m=>`<span>${m[0]}</span>`).join('')}</div>${data.map(d=>`<div class="rt-row" style="--pc:${PLANET_COLORS[d.n]}"><span>${PLANET_GLYPHS[d.n]}</span><div class="rt-tr">${d.list.map(p=>`<i class="rt-seg" style="left:${pct(p.s)}%;width:${pct(p.e)-pct(p.s)}%" title="${d.n}: ${fd(p.s)} → ${fd(p.e)}"></i>`).join('')}${inYear?`<i class="rt-today" style="left:${pct(now)}%"></i>`:''}</div></div>`).join('')}</div>`;
  h+=`<div class="panel-heading">Dates &amp; details</div>`;
  data.forEach(d=>{const c=PLANET_COLORS[d.n];
    h+=`<div class="rt-card" style="--pc:${c}"><div class="rt-ch"><i>${PLANET_GLYPHS[d.n]}</i><div><b>${d.n}</b><small>${INFO[d.n][1]}</small></div><em>${d.list.length?d.list.length+' period'+(d.list.length>1?'s':''):'no ℞'}</em></div><div class="rt-why">${INFO[d.n][0]}</div>`;
    h+=d.list.length?d.list.map(p=>{const act=now>=p.s&&now<p.e,fut=p.s>now,dur=p.e-p.s,mv=Math.abs(angDiff(p.le,p.ls));
      return `<div class="rt-p${act?' on':''}" data-jd="${p.s}"><div class="rt-d"><b>${fd(p.s)} → ${fd(p.e)}</b><small>${ft(p.s)} → ${ft(p.e)} · ${span(dur)} retrograde · backs up ${mv.toFixed(1)}°</small></div><div class="rt-s">${pos(p.ls)} <span style="color:var(--text-faint)">➜</span> ${pos(p.le)}</div>${act?`<div class="rt-bar"><u style="width:${Math.round((now-p.s)/dur*100)}%"></u></div>`:''}<span class="rt-tag ${act?'now':fut?'up':''}">${act?'Retrograde now · ends in '+span(p.e-now):fut?'Starts in '+span(p.s-now):'Completed'}${p.s<y0?' · began before '+year:''}${p.e>=y1?' · continues into '+(year+1):''}</span></div>`;}).join(''):`<div class="rt-none">${d.n} stays direct for all of ${year}.</div>`;
    h+=`</div>`;});
  const rh=findIngresses('Rahu',y0,y1);
  h+=`<div class="rt-card" style="--pc:${PLANET_COLORS.Rahu}"><div class="rt-ch"><i>${PLANET_GLYPHS.Rahu}${PLANET_GLYPHS.Ketu}</i><div><b>Rahu &amp; Ketu</b><small>always retrograde · ~19.3° backwards a year</small></div><em>${rh.length} sign change${rh.length===1?'':'s'}</em></div><div class="rt-why">The lunar nodes (mean) never turn direct. They slide backwards through the zodiac, changing signs about every 18 months.</div>${rh.length?rh.map(e=>`<div class="rt-p" data-jd="${e.jd}"><div class="rt-d"><b>${fd(e.jd)}</b><small>${ft(e.jd)}</small></div><div class="rt-s">${PLANET_GLYPHS.Rahu} Rahu ${SIGNS[e.fromSign].symbol} ${SIGNS[e.fromSign].name} ➜ ${SIGNS[e.toSign].symbol} ${SIGNS[e.toSign].name} · ${PLANET_GLYPHS.Ketu} Ketu ${SIGNS[(e.fromSign+6)%12].symbol} ${SIGNS[(e.fromSign+6)%12].name} ➜ ${SIGNS[(e.toSign+6)%12].symbol} ${SIGNS[(e.toSign+6)%12].name}</div></div>`).join(''):`<div class="rt-none">No sign change in ${year}: Rahu stays in ${SIGNS[Math.floor(normDeg(siderealLongitude('Rahu',y0+1))/30)].name}.</div>`}</div>`;
  h+=`<div class="rt-none">Tap any period to see the 3D sky at that moment. Times are in your device timezone.</div>`;
  $('rtBody').innerHTML=h;}
function wire(){$('rtPrev').addEventListener('click',()=>{year--;render();});$('rtNext').addEventListener('click',()=>{year++;render();});
  $('rtYear').addEventListener('change',()=>{const v=parseInt($('rtYear').value,10);if(isFinite(v)){year=v;}render();});
  $('rtChips').addEventListener('click',e=>{const b=e.target.closest('[data-y]');if(!b)return;year=dOf(currentJD).getFullYear()+Number(b.dataset.y);render();});
  $('rtBody').addEventListener('click',e=>{const p=e.target.closest('.rt-p');if(p)jumpToJD(parseFloat(p.dataset.jd));});}
wire();document.querySelector('[data-tab="retro"]').addEventListener('click',()=>{year=null;setTimeout(render,0);});
window.__rtRender=render;window.__rt={periods,stations};
})();
