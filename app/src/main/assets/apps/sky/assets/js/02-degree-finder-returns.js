/* ============================================================================
   DEGREE FINDER + PLANET RETURNS
   Runs on the app's own sidereal (Lahiri) engine: siderealLongitude(), angDiff().
   ============================================================================ */
(function(){
'use strict';
if (typeof siderealLongitude !== 'function') return;
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const jdMs = jd => (jd - 2440587.5) * 86400000;
const dateAt = (jd, unit) => new Date(Math.round(jdMs(jd)/unit)*unit);
const fmtDate = (jd, sec) => { const d = dateAt(jd, sec?1000:60000); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtClock = (jd, sec) => { const d = dateAt(jd, sec?1000:60000); return `${pad(d.getHours())}:${pad(d.getMinutes())}${sec?':'+pad(d.getSeconds()):''}`; };
const fmtWD = jd => WD[dateAt(jd,60000).getDay()];
const fmtUTC = jd => { const d = dateAt(jd,1000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`; };
function fmtSpan(days){
  days = Math.abs(days);
  if (days < 2){ const tm = Math.round(days*1440); return `${Math.floor(tm/60)} h ${tm%60} m`; }
  if (days < 60){ const th = Math.round(days*24); return `${Math.floor(th/24)} d ${th%24} h`; }
  const y = Math.floor(days/365.2425), rem = days - y*365.2425, mo = Math.floor(rem/30.4369), d = Math.round(rem - mo*30.4369);
  return y ? `${y} y ${mo} mo` : `${mo} mo ${d} d`;
}
function ageText(jd, natalJD){ const yrs = (jd-natalJD)/365.2422, y = Math.floor(yrs), m = Math.floor((yrs-y)*12); return `age ${y} y ${m} mo`; }
/* degrees-within-sign → {sign, text} with correct carry at 29°59'59.5" */
function inSign(lon){
  let a = normDeg(lon), s = Math.floor(a/30), t = Math.round((a - s*30)*3600);
  if (t >= 108000){ t = 0; s = (s+1)%12; }
  return { sign:s, text:`${Math.floor(t/3600)}°${pad(Math.floor(t%3600/60))}'${pad(t%60)}"` };
}
const sgn = i => SIGNS[i].symbol + ' ' + SIGNS[i].name;

/* ---- parse 3°55'27" and friends ---- */
function parseDMS(str){
  let s = (str||'').trim();
  if (!s) return { err:'' };
  s = s.replace(/[′’‘`´]/g,"'").replace(/[″”“]/g,'"').replace(/''/g,'"').replace(/[º˚]/g,'°');
  if ((s.match(/\./g)||[]).length >= 2 && /^[\d.\s]+$/.test(s)) s = s.replace(/\./g,' ');
  const n = s.match(/\d+(?:\.\d+)?/g);
  if (!n || n.length > 3 || /[^\d.\s°'":dmsDMS,-]/.test(s)) return { err:'Could not read that. Try 3°55\'27"' };
  if (/-/.test(s)) return { err:'Use a positive degree (0–360).' };
  const v = n.map(Number), d = v[0], m = v[1]||0, sec = v[2]||0;
  if (m >= 60 || sec >= 60) return { err:'Minutes and seconds must be below 60.' };
  const deg = d + m/60 + sec/3600;
  if (deg >= 360) return { err:'Degree must be below 360.' };
  const t = Math.round(deg*3600);
  return { deg, text:`${Math.floor(t/3600)}°${pad(Math.floor(t%3600/60))}'${pad(t%60)}"` };
}

/* ---- search engine ---- */
const STEP = { Sun:0.5, Moon:0.2, Mars:0.5, Mercury:0.4, Jupiter:1, Venus:0.5, Saturn:1, Rahu:4, Ketu:4 };
// exact crossing of longitude T inside [early, late] (angDiff goes - → + for direct, + → - for retrograde)
function refine(name, T, early, late){
  const f = jd => angDiff(siderealLongitude(name, jd), T);
  let lo = early, hi = late; const direct = f(lo) < 0;
  for (let i=0; i<64 && hi-lo > 1e-8; i++){
    const mid = (lo+hi)/2, neg = f(mid) < 0;
    if (neg === direct) lo = mid; else hi = mid;
  }
  return { jd:(lo+hi)/2, retro:!direct };
}
const nextTick = () => new Promise(r => setTimeout(r, 0));
async function findHits(name, targets, startJD, dir, count, token, onProg){
  const step = STEP[name], limit = 600*365.25, hits = [];
  let jd = startJD, d0 = targets.map(T => angDiff(siderealLongitude(name, jd), T)), iter = 0;
  while (Math.abs(jd-startJD) < limit && hits.length < count){
    const jn = jd + dir*step, L = siderealLongitude(name, jn), d1 = targets.map(T => angDiff(L, T)), found = [];
    for (let k=0; k<targets.length; k++){
      const a = d0[k], b = d1[k];
      if (((a<0 && b>=0) || (a>=0 && b<0)) && Math.abs(a)<90 && Math.abs(b)<90)
        found.push(refine(name, targets[k], Math.min(jd,jn), Math.max(jd,jn)));
    }
    found.sort((x,y) => dir*(x.jd-y.jd));
    for (const h of found){ if (hits.length < count && (dir<0 ? h.jd < startJD : h.jd > startJD)) hits.push(h); }
    d0 = d1; jd = jn;
    if (++iter % 3000 === 0){
      if (token.cancel) return null;
      onProg && onProg(jd);
      await nextTick();
    }
  }
  return hits;
}
function scanRange(name, T, from, to){
  const step = STEP[name], out = [];
  let jd = from, d0 = angDiff(siderealLongitude(name, jd), T);
  while (jd < to){
    const jn = Math.min(jd+step, to), d1 = angDiff(siderealLongitude(name, jn), T);
    if (((d0<0 && d1>=0) || (d0>=0 && d1<0)) && Math.abs(d0)<90 && Math.abs(d1)<90) out.push(refine(name, T, jd, jn));
    d0 = d1; jd = jn;
    if (jn >= to) break;
  }
  return out;
}

/* ============================ DEGREE FINDER ============================ */
let dfPlanet = 'Saturn', dfDir = -1, dfTok = { cancel:false };
function currentPos(name){ return inSign(siderealLongitude(name, currentJD)); }
function buildDegree(){
  $('dfPlanets').innerHTML = PLANET_LIST.map(n =>
    `<button type="button" class="filter-chip${n===dfPlanet?' active':''}" data-p="${n}"><span class="df-chip-glyph" style="color:${n===dfPlanet?'#021210':PLANET_COLORS[n]}">${PLANET_GLYPHS[n]}</span>${n}</button>`).join('');
  $('dfSign').innerHTML = '<option value="any">Any sign</option>' + SIGNS.map((s,i) => `<option value="${i}">${s.symbol} ${s.name} (${s.sk})</option>`).join('');
  pickPlanet(dfPlanet);
  $('dfPlanets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) pickPlanet(b.dataset.p); });
  $('dfDir').addEventListener('click', e => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    dfDir = Number(b.dataset.dir);
    $('dfDir').querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c===b));
  });
  $('dfDeg').addEventListener('input', preview);
  $('dfDeg').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('dfDeg').blur(); runDegree(); } });
  $('dfGo').addEventListener('click', runDegree);
}
function pickPlanet(n){
  dfPlanet = n;
  $('dfPlanets').querySelectorAll('.filter-chip').forEach(c => {
    const on = c.dataset.p === n; c.classList.toggle('active', on);
    c.querySelector('.df-chip-glyph').style.color = on ? '#021210' : PLANET_COLORS[c.dataset.p];
  });
  const cp = currentPos(n);
  $('dfSign').value = String(cp.sign);
  $('dfDeg').placeholder = `now ${cp.text}`;
  preview();
}
function preview(){
  const el = $('dfPreview'), p = parseDMS($('dfDeg').value);
  el.classList.toggle('err', !!p.err);
  if (p.err !== undefined && p.err !== '') el.textContent = p.err;
  else if (p.err === '') el.textContent = '';
  else el.textContent = `Reads as ${p.text} = ${p.deg.toFixed(6)}°` + (p.deg >= 30 ? ' (full longitude)' : '');
  $('dfSign').disabled = (p.deg !== undefined && p.deg >= 30);
}
async function runDegree(){
  const res = $('dfResults'), note = $('dfNote'), p = parseDMS($('dfDeg').value);
  if (p.err !== undefined){ res.innerHTML = `<div class="empty-feed">${p.err || 'Enter a degree first, like 3°55\'27"'}</div>`; return; }
  let targets;
  if (p.deg >= 30) targets = [p.deg];
  else { const v = $('dfSign').value; targets = v === 'any' ? SIGNS.map((_,k) => k*30 + p.deg) : [Number(v)*30 + p.deg]; }
  dfTok.cancel = true; const tok = dfTok = { cancel:false };
  const startJD = currentJD, dir = dfDir, name = dfPlanet;
  $('dfGo').disabled = true;
  note.textContent = `${dir<0?'Looking back from':'Looking ahead from'} ${fmtDate(startJD)} · sidereal (Lahiri) · times in your device timezone`;
  res.innerHTML = `<div class="empty-feed"><span class="df-prog" id="dfProg">Scanning…</span></div>`;
  await nextTick();
  const hits = await findHits(name, targets, startJD, dir, 10, tok, jd => { const el = $('dfProg'); if (el) el.textContent = `Scanning… reached ${dateAt(jd,86400000).getFullYear()}`; });
  if (tok.cancel) return;
  $('dfGo').disabled = false;
  if (!hits.length){ res.innerHTML = `<div class="empty-feed">No matches found within 600 years.</div>`; return; }
  res.innerHTML = hits.map((h,i) => {
    const pos = inSign(siderealLongitude(name, h.jd));
    const motion = (name==='Rahu'||name==='Ketu') ? '' : `<div class="transit-card-tag">${h.retro ? '℞ Retrograde' : 'Direct'}</div>`;
    return `<div class="transit-card" data-jd="${h.jd}">
      <div class="transit-card-top"><div class="transit-card-title">#${i+1} · ${fmtDate(h.jd,true)}</div><div class="transit-card-date">${fmtClock(h.jd,true)}</div></div>
      <div class="transit-card-desc">${fmtWD(h.jd)} · ${fmtUTC(h.jd)}<br>${PLANET_GLYPHS[name]} ${name} at ${sgn(pos.sign)} ${pos.text}<br>${fmtSpan(h.jd-startJD)} ${dir<0?'before':'after'} the app date</div>${motion}</div>`;
  }).join('') + (hits.length < 10 ? `<div class="df-hint">Only ${hits.length} found within 600 years.</div>` : '');
  res.querySelectorAll('.transit-card').forEach(c => c.addEventListener('click', () => jumpToJD(parseFloat(c.dataset.jd))));
}

/* ============================ PLANET RETURNS ============================ */
const retCache = {};
function period(n){ return (n==='Mercury'||n==='Venus') ? 365.25 : 360/Math.abs(AVG_DAILY_MOTION[n]); }
function clusters(evs, thr){ const out = []; evs.forEach(e => { const c = out[out.length-1]; if (c && e.jd - c[c.length-1].jd < thr) c.push(e); else out.push([e]); }); return out; }
function calcReturns(name, natalJD, natalLon, now){
  const P = period(name), thr = 0.25*P, birthEps = natalJD + 0.02;
  const from = Math.max(birthEps, now - 1.15*P - thr), to = now + 1.15*P + thr;
  const evs = scanRange(name, natalLon, from, to).filter(e => e.jd > birthEps);
  const cl = clusters(evs, thr), ni = cl.findIndex(c => c[c.length-1].jd >= now);
  return { next: ni>=0 ? cl[ni] : null, prev: ni>0 ? cl[ni-1] : (ni<0 && cl.length ? cl[cl.length-1] : null), clipped: from === birthEps };
}
function retRow(e, name, natalJD, now){
  const past = e.jd < now, isNode = (name==='Rahu'||name==='Ketu'), showAge = !(name==='Sun'||name==='Moon');
  return `<div class="ret-row${past?' done':''}${(!isNode && e.retro)?' rx':''}" data-jd="${e.jd}">
    <span class="d">${fmtDate(e.jd)} · ${fmtClock(e.jd)}</span><span class="t">${past ? fmtSpan(now-e.jd)+' ago' : 'in '+fmtSpan(e.jd-now)}</span>
    <span class="m">${fmtWD(e.jd)}${showAge ? ' · '+ageText(e.jd, natalJD) : ''}${(!isNode && e.retro) ? ' · retrograde pass' : ''}</span></div>`;
}
async function renderReturns(){
  const feed = $('retFeed'), note = $('retNote'), prof = activeNatalProfile;
  if (!isValidProfile(prof)){
    note.textContent = '';
    feed.innerHTML = `<div class="empty-feed">No active natal profile.<br>Save your birth details in the Natal tab, then come back to see when every planet returns to its birth degree.<br><button type="button" class="btn-secondary-block" id="retGoNatal" style="margin-top:16px">Open Natal tab</button></div>`;
    $('retGoNatal').addEventListener('click', () => document.querySelector('[data-tab="natal"]').click());
    return;
  }
  const [Y,M,D] = prof.dob.split('-').map(Number), [hh,mm] = prof.tob.split(':').map(Number);
  const natalJD = toJulianDay(Y,M,D,hh,mm||0,0) - prof.tz/24, now = currentJD;
  const key = `${prof.name}|${prof.dob}|${prof.tob}|${prof.tz}|${Math.floor(now)}`;
  note.textContent = `${prof.name} · born ${fmtDate(natalJD)} · sidereal (Lahiri) · times in your device timezone`;
  if (retCache.key === key && retCache.html){ feed.innerHTML = retCache.html; wire(feed); return; }
  const tok = retCache.tok = {}; 
  feed.innerHTML = PLANET_LIST.map(n => `<div class="ret-card" id="ret-${n}" style="--pc:${PLANET_COLORS[n]}"><div class="ret-head"><span class="ret-glyph">${PLANET_GLYPHS[n]}</span><div><b>${n}</b><small>Calculating…</small></div></div></div>`).join('');
  for (const n of PLANET_LIST){
    await nextTick(); if (retCache.tok !== tok) return;
    const nl = siderealLongitude(n, natalJD), pos = inSign(nl), r = calcReturns(n, natalJD, nl, now);
    const nextHtml = r.next ? r.next.map(e => retRow(e,n,natalJD,now)).join('') : `<div class="ret-none">Not found in the scan window.</div>`;
    const prevHtml = r.prev ? r.prev.map(e => retRow(e,n,natalJD,now)).join('') : `<div class="ret-none">${r.clipped ? 'None yet since birth.' : '—'}</div>`;
    const el = $('ret-'+n); if (!el) return;
    el.innerHTML = `<div class="ret-head"><span class="ret-glyph">${PLANET_GLYPHS[n]}</span><div><b>${n}</b><small>Natal ${sgn(pos.sign)} ${pos.text}</small></div></div>
      <div class="ret-label">Next return</div>${nextHtml}<div class="ret-label">Previous return</div>${prevHtml}`;
  }
  if (retCache.tok === tok){ retCache.key = key; retCache.html = feed.innerHTML; wire(feed); }
}
function wire(feed){ feed.querySelectorAll('.ret-row').forEach(r => r.addEventListener('click', () => jumpToJD(parseFloat(r.dataset.jd)))); }

buildDegree();
document.querySelector('[data-tab="returns"]').addEventListener('click', renderReturns);
document.querySelector('[data-tab="degree"]').addEventListener('click', () => { const cp = currentPos(dfPlanet); $('dfDeg').placeholder = `now ${cp.text}`; });
const cardWrap = $('natalCardWrap');
if (cardWrap) new MutationObserver(() => { retCache.key = null; retCache.html = null; if ($('tab-returns').classList.contains('active')) renderReturns(); }).observe(cardWrap, { childList:true });
})();
