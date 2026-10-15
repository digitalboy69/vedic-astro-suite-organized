/* =============================================================================
   APP META LAYER  ·  v2.0.0
   -----------------------------------------------------------------------------
   ARCHITECTURE MAP (search these names to jump around)
   1. Astronomy & maths ........ computeChart, calcVarga, computeLiveSky, find*Boundary*
   2. Classical engines ........ calculateVimshottariDasha, computeShadbala, computeFullAshtakavarga,
                                 calculateCharaKarakas, findPlanetaryWars, calc*Lagna*
   3. Panel builders (HTML) .... buildOverviewPanel, buildPlanetsPanel, buildDashaSection, buildYogaSection,
                                 buildShadbalaSection, buildAshtakavargaSection, buildRelationshipsSection
   4. Chart drawing ............ buildNorthIndianSvg, buildSouthIndianSvg, buildWesternWheelSvg
   5. Navigation ............... buildHomePanel, switchAppTab (+ history/back-button routing below)
   6. Profiles & storage ....... loadProfiles, saveProfiles, refreshProfileSelect, renderProfileCards
   7. Export ................... buildFullReportText, openExportModal (download / copy, local only)
   8. Orchestrator ............. renderResults(profile)  — builds every panel, then shows Home
   META HELPERS (this block): APP.store · APP.toast · APP.safe · APP.copy · APP.debounce · APP.report
   RULES: every panel builder is wrapped in an error boundary (see bottom), so one failing section never
          takes down the whole app. Add new panels to SAFE_BUILDERS and HOME_ITEMS.
   ============================================================================= */
const APP = (() => {
  const NS = 'va_ui_';
  const store = {
    get(k, d){ try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch(e){ return false; } },
    remove(k){ try { localStorage.removeItem(NS + k); } catch(e){} }
  };
  let box = null, lastErr = 0;
  function toast(msg, type = 'info', ms = 3200){
    if (!box){
      box = document.createElement('div'); box.id = 'appToasts';
      box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div'); t.className = 'app-toast ' + type; t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  }
  function report(label, err){
    const now = Date.now(); if (now - lastErr < 4000) return; lastErr = now;
    toast('Something went wrong' + (label ? ' in ' + label : '') + '. Your data is safe — please try again.', 'error', 4500);
  }
  function safe(label, fn, fallback){
    try { return fn(); }
    catch(err){ console.error('[' + label + ']', err); report(label, err); return typeof fallback === 'function' ? fallback(err) : fallback; }
  }
  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch(e){
      try {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
      } catch(e2){ return false; }
    }
  }
  function debounce(fn, ms = 250){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  return { name: 'Vedic Astrology', version: '2.0.0', store, toast, report, safe, copy, debounce, debug: /debug/.test(location.hash) };
})();

/* global safety nets: nothing fails silently any more */
window.addEventListener('error', (e) => {
  if (!e.message || /ResizeObserver|Script error/i.test(e.message)) return;
  console.error(e.error || e.message); APP.report('', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  const m = String((e.reason && e.reason.message) || e.reason || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) APP.toast('Network problem — check your connection.', 'error');
  else { console.error(e.reason); APP.report('', e.reason); }
});
window.addEventListener('offline', () => APP.toast('You are offline — place search needs internet.', 'error', 4500));
window.addEventListener('online', () => APP.toast('Back online ✓', 'success', 2000));

/* ============================================================================
   ENGINE (embedded) — Sidereal Lahiri Vedic calculations
   ============================================================================ */
const DEG = Math.PI / 180, RAD = 180 / Math.PI, J2000 = 2451545.0;
function normDeg(d){ d = d % 360; return d < 0 ? d + 360 : d; }

function toJulianDay(year, month, day, hour, minute, second){
  let Y = year, M = month;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFrac = day + (hour + minute/60 + second/3600) / 24;
  return Math.floor(365.25*(Y+4716)) + Math.floor(30.6001*(M+1)) + dayFrac + B - 1524.5;
}

function lahiriAyanamsa(jd){
  const ayan1900 = 22 + 27/60 + 54.33/3600;
  const precessionRate = 50.2564 / 3600;
  const years = (jd - 2415020.0) / 365.25;
  let ayan = ayan1900 + precessionRate * years;
  const correction = 0.000139 * Math.sin((jd - 2415020.0) / 365.25 * 0.98565 * DEG);
  ayan += correction;
  return ayan;
}

function sunLongitude(jd){
  const T = (jd - J2000) / 36525.0;
  const L0 = normDeg(280.46646 + 36000.76983*T + 0.0003032*T*T);
  const M = normDeg(357.52911 + 35999.05029*T - 0.0001537*T*T);
  const Mrad = M*DEG;
  const C = (1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mrad) + (0.019993-0.000101*T)*Math.sin(2*Mrad) + 0.000289*Math.sin(3*Mrad);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136*T;
  const lambda = trueLong - 0.00569 - 0.00478*Math.sin(omega*DEG);
  return normDeg(lambda);
}

function moonLongitude(jd){
  const T = (jd - J2000) / 36525.0;
  const Lp = normDeg(218.3164477 + 481267.88123421*T - 0.0015786*T*T + T*T*T/538841 - T*T*T*T/65194000);
  const D = normDeg(297.8501921 + 445267.1114034*T - 0.0018819*T*T + T*T*T/545868 - T*T*T*T/113065000);
  const M = normDeg(357.5291092 + 35999.0502909*T - 0.0001536*T*T + T*T*T/24490000);
  const Mp = normDeg(134.9633964 + 477198.8675055*T + 0.0087414*T*T + T*T*T/69699 - T*T*T*T/14712000);
  const F = normDeg(93.2720950 + 483202.0175233*T - 0.0036539*T*T - T*T*T/3526000 + T*T*T*T/863310000);
  const Dr=D*DEG, Mr=M*DEG, Mpr=Mp*DEG, Fr=F*DEG;
  let sumL = 0;
  const terms = [
    [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
    [0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],
    [2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
    [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],
    [4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
    [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
    [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],
    [2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],
    [0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
    [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
    [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],
    [2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
    [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],
    [1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],
    [0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]
  ];
  for (const [d,m,mp,f,coef] of terms){
    const arg = d*Dr + m*Mr + mp*Mpr + f*Fr;
    sumL += coef * Math.sin(arg);
  }
  return normDeg(Lp + sumL/1000000);
}

const PLANET_ELEMENTS = {
  mercury:{a:0.387098,e:0.205635,i:7.0047,L:252.2503,Lrate:149472.6746,peri:77.4561,periRate:0.1588,node:48.3308,nodeRate:-0.1254},
  venus:{a:0.723330,e:0.006773,i:3.3946,L:181.9791,Lrate:58517.8156,peri:131.5637,periRate:0.0048,node:76.6799,nodeRate:-0.2780},
  mars:{a:1.523688,e:0.093405,i:1.8497,L:355.4330,Lrate:19140.2993,peri:336.0602,periRate:0.4438,node:49.5581,nodeRate:-0.2910},
  jupiter:{a:5.202561,e:0.048498,i:1.3033,L:34.3515,Lrate:3034.9057,peri:14.3312,periRate:0.2155,node:100.4644,nodeRate:0.1767},
  saturn:{a:9.554747,e:0.055546,i:2.4886,L:50.0774,Lrate:1222.1138,peri:93.0572,periRate:0.5150,node:113.6634,nodeRate:-0.2566}
};
Object.assign(PLANET_ELEMENTS,{
  uranus:{a:19.18797948,e:0.04685740,i:0.77298127,L:313.23810451,Lrate:428.48202785,peri:170.95427630,periRate:0.40805281,node:74.01692503,nodeRate:0.04240589},
  neptune:{a:30.06952752,e:0.00895439,i:1.77005520,L:-55.12002969,Lrate:218.45945325,peri:44.96476227,periRate:-0.32241464,node:131.78422574,nodeRate:-0.00508664},
  pluto:{a:39.48686035,e:0.24885238,i:17.14104260,L:238.96535011,Lrate:145.18042903,peri:224.09702598,periRate:-0.04062942,node:110.30167986,nodeRate:-0.01183482}
});
const EARTH_ELEMENTS = {a:1.000001,e:0.016709,i:0.0,L:100.4664,Lrate:35999.3729,peri:102.9373,periRate:0.3225,node:0,nodeRate:0};

function solveKepler(M, e){
  let E = M;
  for (let i=0;i<50;i++){
    const dE = (E - e*Math.sin(E) - M) / (1 - e*Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}
function heliocentricPos(elements, T){
  const a=elements.a, e=elements.e, i=elements.i*DEG;
  const L = normDeg(elements.L + elements.Lrate*T)*DEG;
  const peri = normDeg(elements.peri + elements.periRate*T)*DEG;
  const node = normDeg(elements.node + elements.nodeRate*T)*DEG;
  const M = L - peri;
  const E = solveKepler(normDeg(M*RAD)*DEG, e);
  const xv = a*(Math.cos(E)-e);
  const yv = a*(Math.sqrt(1-e*e)*Math.sin(E));
  const v = Math.atan2(yv,xv);
  const r = Math.sqrt(xv*xv+yv*yv);
  const omega = peri - node;
  const xh = r*(Math.cos(node)*Math.cos(v+omega) - Math.sin(node)*Math.sin(v+omega)*Math.cos(i));
  const yh = r*(Math.sin(node)*Math.cos(v+omega) + Math.cos(node)*Math.sin(v+omega)*Math.cos(i));
  return {x:xh,y:yh};
}
function planetGeocentricLongitude(name, jd){
  const T = (jd-J2000)/36525.0;
  const earth = heliocentricPos(EARTH_ELEMENTS,T);
  const planet = heliocentricPos(PLANET_ELEMENTS[name],T);
  const xg = planet.x-earth.x, yg = planet.y-earth.y;
  // Elements are referred to the fixed J2000 equinox; the ayanamsa is subtracted from tropical-of-DATE longitudes
  // (as for Sun/Moon/Rahu), so add the general precession since J2000 to put all bodies in the same frame.
  return normDeg(Math.atan2(yg,xg)*RAD + 1.3969713*T + 0.0003086*T*T);
}
function isRetrograde(name, jd){
  const l1 = planetGeocentricLongitude(name, jd-0.25);
  const l2 = planetGeocentricLongitude(name, jd+0.25);
  let diff = l2-l1;
  if (diff>180) diff-=360; if (diff<-180) diff+=360;
  return diff<0;
}
function rahuLongitude(jd){
  const T = (jd-J2000)/36525.0;
  return normDeg(125.0445479 - 1934.1362891*T + 0.0020754*T*T + T*T*T/467441 - T*T*T*T/60616000);
}

function getSiderealLongitudeAt(name, jd){
  const ayan = lahiriAyanamsa(jd);
  let tropical;
  switch(name){
    case "Sun": tropical = sunLongitude(jd); break;
    case "Moon": tropical = moonLongitude(jd); break;
    case "Mercury": tropical = planetGeocentricLongitude("mercury", jd); break;
    case "Venus": tropical = planetGeocentricLongitude("venus", jd); break;
    case "Mars": tropical = planetGeocentricLongitude("mars", jd); break;
    case "Jupiter": tropical = planetGeocentricLongitude("jupiter", jd); break;
    case "Saturn": tropical = planetGeocentricLongitude("saturn", jd); break;
    case "Rahu": return normDeg(rahuLongitude(jd) - ayan);
    case "Ketu": return normDeg(rahuLongitude(jd) - ayan + 180);
  }
  return normDeg(tropical - ayan);
}

function getPlanetSpeed(name, jd){
  if (name === "Rahu" || name === "Ketu"){
    const T = (jd-J2000)/36525.0;
    const dTdJD = 1/36525.0;
    const speed = (-1934.1362891 + 2*0.0020754*T + 3*T*T/467441 - 4*T*T*T/60616000) * dTdJD;
    return speed; 
  }
  const dt = 0.5; 
  const l1 = getSiderealLongitudeAt(name, jd-dt);
  const l2 = getSiderealLongitudeAt(name, jd+dt);
  let diff = l2 - l1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff / (2*dt);
}

/* ============================================================================
   DIVISIONAL TRANSIT TIMING ENGINE
   Powers the "Transit Timer" and "Sandhi Table" tabs: given any body (a graha
   or the Ascendant) and any varga (D1-D60), finds precisely when it entered
   its current division and when it will leave — using real evaluated motion
   (adaptive scan + bisection on the body's actual longitude function), not a
   flat linear guess, so retrograde loops and speed changes are respected.
   ============================================================================ */

// Julian Day -> JS UTC Date (Meeus algorithm), the inverse of toJulianDay().
function jdToDate(jd){
  const jdShifted = jd + 0.5;
  const Z = Math.floor(jdShifted);
  const F = jdShifted - Z;
  let A = Z;
  if (Z >= 2299161){
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayFrac);
  const month = (E < 14) ? E - 1 : E - 13;
  const year = (month > 2) ? C - 4716 : C - 4715;
  const hoursFrac = (dayFrac - day) * 24;
  const hours = Math.floor(hoursFrac + 1e-7);
  const minutesFrac = (hoursFrac - hours) * 60;
  const minutes = Math.floor(minutesFrac + 1e-5);
  const secondsFrac = (minutesFrac - minutes) * 60;
  const seconds = Math.round(secondsFrac);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, Math.min(seconds, 59)));
}

// Julian Day (UT) for the real current moment.
function nowJulianDay(){
  const now = new Date();
  return toJulianDay(now.getUTCFullYear(), now.getUTCMonth()+1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds() + now.getUTCMilliseconds()/1000);
}

// A JD, rendered as a wall-clock date/time string at a fixed UTC offset (the
// same "local time" convention used everywhere else in this app).
function jdToLocalParts(jd, tzOffsetHours){
  const utcDate = jdToDate(jd);
  const local = new Date(utcDate.getTime() + tzOffsetHours*3600*1000);
  const pad2 = n => String(n).padStart(2,'0');
  return {
    dateStr: `${local.getUTCFullYear()}-${pad2(local.getUTCMonth()+1)}-${pad2(local.getUTCDate())}`,
    timeStr: `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:${pad2(local.getUTCSeconds())}`,
  };
}

// Signed angular difference a-b, wrapped into (-180, 180].
function angDiffSigned(a, b){
  let d = a - b;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
}

// Finds the JD at which lonFn(jd) crosses boundaryDeg, searching away from
// nowJD in the given direction (+1 = future, -1 = past). dtLinearGuess (days,
// positive) sizes the initial search window; if the crossing isn't found
// there (e.g. a slow outer planet stationed near the boundary), the search
// widens geometrically. Returns null if nothing is found within ~600 days.
function findBoundaryCrossingJD(lonFn, nowJD, boundaryDeg, direction, dtLinearGuess){
  const err = (jd) => angDiffSigned(lonFn(jd), boundaryDeg);
  const e0 = err(nowJD);
  if (Math.abs(e0) < 1e-9) return nowJD;

  let segStart = nowJD;
  let windowSize = Math.max(dtLinearGuess * 1.4, 0.0007); // floor ~1 minute
  const maxTotal = 4500; // days (slow planets can sit in one sign/division for ~3 years, with retrograde loops)
  let totalSearched = 0;
  let bracketLo = null, bracketHi = null;

  while (totalSearched < maxTotal){
    const segEnd = segStart + direction * windowSize;
    const substeps = 50;
    let prevJD = segStart, prevErr = err(segStart);
    for (let i=1;i<=substeps;i++){
      const jd = segStart + (segEnd - segStart) * i / substeps;
      const e = err(jd);
      if ((prevErr >= 0 && e < 0) || (prevErr <= 0 && e > 0)){
        bracketLo = Math.min(prevJD, jd); bracketHi = Math.max(prevJD, jd);
        break;
      }
      prevJD = jd; prevErr = e;
    }
    if (bracketLo !== null) break;
    totalSearched += windowSize;
    segStart = segEnd;
    windowSize *= 1.8;
  }
  if (bracketLo === null) return null;

  let lo = bracketLo, hi = bracketHi;
  const signAtLo = err(lo) >= 0;
  for (let i=0;i<50;i++){
    const mid = (lo+hi)/2;
    const eMid = err(mid);
    if ((eMid >= 0) === signAtLo) lo = mid; else hi = mid;
  }
  return (lo+hi)/2;
}

// Given a body ("Ascendant" or one of the 9 grahas) and a varga key ("D1".."D60"),
// computes: current division, when it was entered, when it will be left, and
// how much time remains — using the body's true evaluated motion.
function computeDivisionTiming(bodyName, vargaKey, lat, lon){
  const nowJD = nowJulianDay();
  const lonFn = bodyName === "Ascendant"
    ? (jd) => normDeg(ascendantLongitude(jd, lat, lon) - lahiriAyanamsa(jd))
    : (jd) => getSiderealLongitudeAt(bodyName, jd);

  const currentLon = lonFn(nowJD);
  const n = VARGAS[vargaKey].n;
  const width = 30 / n;
  const divIndexAbs = Math.floor((currentLon + 1e-9) / width);
  const lowerB = divIndexAbs * width;
  const upperB = (divIndexAbs + 1) * width;

  let speed;
  if (bodyName === "Ascendant"){
    const dt = 0.0007;
    let l1 = lonFn(nowJD - dt), l2 = lonFn(nowJD + dt);
    let diff = l2 - l1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    speed = diff / (2*dt);
  } else {
    speed = getPlanetSpeed(bodyName, nowJD);
  }
  const retrograde = speed < 0;
  const absSpeed = Math.max(Math.abs(speed), 0.00005);

  // A retrograde-prone body can leave its division in EITHER direction, so "next change" is the earlier of the two
  // boundary crossings ahead of now, and "entered" is the most recent crossing behind now (not just the one in the
  // direction of current motion).
  const nextBoundary = retrograde ? lowerB : upperB;
  const enteredBoundary = retrograde ? upperB : lowerB;
  const dtNextLinear = Math.abs(nextBoundary - currentLon) / absSpeed;
  const dtEnteredLinear = Math.abs(currentLon - enteredBoundary) / absSpeed;
  const dtUp = Math.abs(upperB - currentLon) / absSpeed, dtLo = Math.abs(currentLon - lowerB) / absSpeed;
  const cl = x => Math.min(x, 30);   // near a station the speed is ~0, so cap the search window or crossings get skipped
  const futs = [findBoundaryCrossingJD(lonFn, nowJD, upperB, +1, cl(dtUp)), findBoundaryCrossingJD(lonFn, nowJD, lowerB, +1, cl(dtLo))].filter(x => x !== null);
  const jdNext = futs.length ? Math.min(...futs) : null;
  const pastU = findBoundaryCrossingJD(lonFn, nowJD, upperB, -1, cl(dtUp)), pastL = findBoundaryCrossingJD(lonFn, nowJD, lowerB, -1, cl(dtLo));
  const pasts = [pastU, pastL].filter(x => x !== null);
  const jdEnteredRaw = pasts.length ? Math.max(...pasts) : null;
  const enteredViaUpper = jdEnteredRaw !== null && jdEnteredRaw === pastU;
  const jdEntered = jdEnteredRaw !== null ? jdEnteredRaw : (nowJD - (retrograde ? -dtEnteredLinear : dtEnteredLinear));

  // One more division back: search further into the past from jdEntered for
  // the boundary before the one just found, using the same local width as a
  // search-window guess (division widths change gradually, so this is a good
  // starting bracket — the actual crossing is still found by real evaluation).
  const beforeBoundary = (jdEnteredRaw !== null ? enteredViaUpper : retrograde) ? (upperB + width) : (lowerB - width);
  const jdBeforeRaw = findBoundaryCrossingJD(lonFn, jdEntered, beforeBoundary, -1, cl(dtEnteredLinear));
  const jdBefore = jdBeforeRaw !== null ? jdBeforeRaw : (jdEntered - dtEnteredLinear);

  const signIdx = getSignIndex(currentLon);
  const degInSign = getDegInSign(currentLon);
  const divWithinSign = Math.floor((degInSign + 1e-9) / width) + 1; // 1..n
  const vargaSignIdx = calcVarga(vargaKey, currentLon);

  return {
    bodyName, vargaKey, n, width, currentLon, signIdx, degInSign,
    divIndexAbs, divWithinSign, vargaSignIdx, lowerB, upperB,
    speed, retrograde,
    nowJD,
    jdNext: jdNext !== null ? jdNext : (nowJD + (retrograde ? -dtNextLinear : dtNextLinear)),
    jdEntered, jdBefore,
    remainingDays: (jdNext !== null ? jdNext : (nowJD + dtNextLinear)) - nowJD,
    sinceDays: nowJD - jdEntered,
  };
}

// Given a birth moment (JD, UT) and a birth location, finds the precise start
// and end time of the D1 Ascendant sign that was rising at that exact moment —
// e.g. "Leo was rising from 1:02:44 to 3:19:01". Anchored to the birth time,
// not to "now".
function computeAscendantD1Window(lat, lon, birthJD){
  const lonFn = (jd) => normDeg(ascendantLongitude(jd, lat, lon) - lahiriAyanamsa(jd));
  const birthLon = lonFn(birthJD);
  const d1SignIdx = getSignIndex(birthLon);
  const d1Lower = d1SignIdx * 30, d1Upper = d1SignIdx * 30 + 30;

  const dt = 0.0007;
  let l1 = lonFn(birthJD - dt), l2 = lonFn(birthJD + dt);
  let diff = l2 - l1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const speed = diff / (2*dt);
  const absSpeed = Math.max(Math.abs(speed), 1e-5);

  const dtEnteredGuess = Math.abs(birthLon - d1Lower) / absSpeed;
  const dtExitGuess = Math.abs(d1Upper - birthLon) / absSpeed;
  const jdD1Start = findBoundaryCrossingJD(lonFn, birthJD, d1Lower, -1, dtEnteredGuess) ?? (birthJD - dtEnteredGuess);
  const jdD1End = findBoundaryCrossingJD(lonFn, birthJD, d1Upper, +1, dtExitGuess) ?? (birthJD + dtExitGuess);

  return { lonFn, birthLon, d1SignIdx, d1Lower, d1Upper, jdD1Start, jdD1End, speed };
}

// For the selected varga, walks the ENTIRE D1 Ascendant window found above
// (from its precise start to its precise end) and lists out every single
// division inside it in order — e.g. for D9, all 9 slices of that ~2h window,
// each with its own precise start time, end time, and resulting varga sign —
// marking whichever slice the exact birth moment falls into.
function computeVargaTimelineForD1Window(vargaKey, lat, lon, birthJD){
  const w = computeAscendantD1Window(lat, lon, birthJD);
  const n = VARGAS[vargaKey].n;
  const width = 30 / n;
  const startIndexAbs = Math.round(w.d1Lower / width);

  const rows = [];
  let curJD = w.jdD1Start;
  for (let i=0; i<n; i++){
    const divIndexAbs = startIndexAbs + i;
    const divUpperDeg = (divIndexAbs + 1) * width;
    let divEndJD;
    if (i === n-1){
      divEndJD = w.jdD1End; // last slice always closes exactly at the D1 exit time
    } else {
      const guessDt = (w.jdD1End - curJD) / (n - i);
      divEndJD = findBoundaryCrossingJD(w.lonFn, curJD, divUpperDeg, +1, guessDt) ?? (curJD + guessDt);
    }
    const vargaSignIdx = calcVarga(vargaKey, divIndexAbs*width + width/2);
    const containsBirth = birthJD >= curJD - 1e-9 && birthJD <= divEndJD + 1e-9;
    rows.push({ index: i+1, startJD: curJD, endJD: divEndJD, vargaSignIdx, containsBirth });
    curJD = divEndJD;
  }
  return { ...w, n, width, rows };
}

// Formats a duration in days as a compact human string ("2h 14m 08s", "3d 6h").
function formatDurationHMS(days){
  const totalSeconds = Math.max(0, Math.round(Math.abs(days) * 86400));
  const d = Math.floor(totalSeconds/86400);
  const h = Math.floor((totalSeconds%86400)/3600);
  const m = Math.floor((totalSeconds%3600)/60);
  const s = totalSeconds%60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2,'0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`;
  return `${s}s`;
}

function greenwichSiderealTime(jd){
  const T = (jd-J2000)/36525.0;
  return normDeg(280.46061837 + 360.98564736629*(jd-J2000) + 0.000387933*T*T - T*T*T/38710000);
}
function obliquityOfEcliptic(jd){
  const T = (jd-J2000)/36525.0;
  return 23.439291 - 0.0130042*T - 0.00000016*T*T + 0.000000504*T*T*T;
}
function ascendantLongitude(jd, lat, lon){
  const gst = greenwichSiderealTime(jd);
  const lst = normDeg(gst+lon);
  const eps = obliquityOfEcliptic(jd)*DEG;
  const lstRad = lst*DEG, latRad = lat*DEG;
  const y = -Math.cos(lstRad);
  const x = Math.sin(lstRad)*Math.cos(eps) + Math.tan(latRad)*Math.sin(eps);
  let asc = Math.atan2(y,x)*RAD;
  return normDeg(asc+180);
}

const SIGNS = [
  {name:"Aries",sk:"Mesha",lord:"Mars",element:"Fire",modality:"Movable",symbol:"♈"},
  {name:"Taurus",sk:"Vrishabha",lord:"Venus",element:"Earth",modality:"Fixed",symbol:"♉"},
  {name:"Gemini",sk:"Mithuna",lord:"Mercury",element:"Air",modality:"Dual",symbol:"♊"},
  {name:"Cancer",sk:"Karka",lord:"Moon",element:"Water",modality:"Movable",symbol:"♋"},
  {name:"Leo",sk:"Simha",lord:"Sun",element:"Fire",modality:"Fixed",symbol:"♌"},
  {name:"Virgo",sk:"Kanya",lord:"Mercury",element:"Earth",modality:"Dual",symbol:"♍"},
  {name:"Libra",sk:"Tula",lord:"Venus",element:"Air",modality:"Movable",symbol:"♎"},
  {name:"Scorpio",sk:"Vrishchika",lord:"Mars",element:"Water",modality:"Fixed",symbol:"♏"},
  {name:"Sagittarius",sk:"Dhanu",lord:"Jupiter",element:"Fire",modality:"Dual",symbol:"♐"},
  {name:"Capricorn",sk:"Makara",lord:"Saturn",element:"Earth",modality:"Movable",symbol:"♑"},
  {name:"Aquarius",sk:"Kumbha",lord:"Saturn",element:"Air",modality:"Fixed",symbol:"♒"},
  {name:"Pisces",sk:"Meena",lord:"Jupiter",element:"Water",modality:"Dual",symbol:"♓"}
];
const NAKSHATRAS = [
  {name:"Ashwini",lord:"Ketu",deity:"Ashwini Kumaras"},{name:"Bharani",lord:"Venus",deity:"Yama"},
  {name:"Krittika",lord:"Sun",deity:"Agni"},{name:"Rohini",lord:"Moon",deity:"Brahma"},
  {name:"Mrigashira",lord:"Mars",deity:"Soma"},{name:"Ardra",lord:"Rahu",deity:"Rudra"},
  {name:"Punarvasu",lord:"Jupiter",deity:"Aditi"},{name:"Pushya",lord:"Saturn",deity:"Brihaspati"},
  {name:"Ashlesha",lord:"Mercury",deity:"Nagas"},{name:"Magha",lord:"Ketu",deity:"Pitrs"},
  {name:"Purva Phalguni",lord:"Venus",deity:"Bhaga"},{name:"Uttara Phalguni",lord:"Sun",deity:"Aryaman"},
  {name:"Hasta",lord:"Moon",deity:"Savitar"},{name:"Chitra",lord:"Mars",deity:"Tvashtar"},
  {name:"Swati",lord:"Rahu",deity:"Vayu"},{name:"Vishakha",lord:"Jupiter",deity:"Indragni"},
  {name:"Anuradha",lord:"Saturn",deity:"Mitra"},{name:"Jyeshtha",lord:"Mercury",deity:"Indra"},
  {name:"Mula",lord:"Ketu",deity:"Nirriti"},{name:"Purva Ashadha",lord:"Venus",deity:"Apas"},
  {name:"Uttara Ashadha",lord:"Sun",deity:"Vishvadevas"},{name:"Shravana",lord:"Moon",deity:"Vishnu"},
  {name:"Dhanishta",lord:"Mars",deity:"Vasus"},{name:"Shatabhisha",lord:"Rahu",deity:"Varuna"},
  {name:"Purva Bhadrapada",lord:"Jupiter",deity:"Aja Ekapada"},{name:"Uttara Bhadrapada",lord:"Saturn",deity:"Ahir Budhnya"},
  {name:"Revati",lord:"Mercury",deity:"Pushan"}
];
function getSignIndex(lon){ return Math.floor(normDeg(lon)/30); }
function getDegInSign(lon){ return normDeg(lon)%30; }
function getNakshatra(lon){
  const l = normDeg(lon);
  const nakSpan = 360/27;
  const idx = Math.floor(l/nakSpan);
  const posInNak = l % nakSpan;
  const pada = Math.floor(posInNak/(nakSpan/4)) + 1;
  return {index:idx, pada, degInNak:posInNak, ...NAKSHATRAS[idx]};
}

const VARGAS = {
  D1:{n:1,name:"Rashi",full:"Birth Chart",desc:"Physical body, overall life, personality"},
  D2:{n:2,name:"Hora",full:"Wealth Chart",desc:"Wealth, financial prosperity, resources"},
  D3:{n:3,name:"Drekkana",full:"Siblings Chart",desc:"Siblings, courage, communication"},
  D4:{n:4,name:"Chaturthamsa",full:"Fortune & Property",desc:"Fixed assets, property, home, happiness"},
  D5:{n:5,name:"Panchamsa",full:"Power & Authority",desc:"Fame, authority, spiritual merit"},
  D6:{n:6,name:"Shashthamsa",full:"Health Chart",desc:"Disease, debts, enemies, obstacles"},
  D7:{n:7,name:"Saptamsa",full:"Children Chart",desc:"Children, progeny, creativity"},
  D8:{n:8,name:"Ashtamsa",full:"Longevity Chart",desc:"Longevity, sudden events, transformation"},
  D9:{n:9,name:"Navamsa",full:"Marriage & Dharma",desc:"Marriage, spouse, inner dharma, fortune"},
  D10:{n:10,name:"Dasamsa",full:"Career Chart",desc:"Career, profession, status, achievements"},
  D11:{n:11,name:"Rudramsa",full:"Death & Destruction",desc:"Death-like events, endings, destruction"},
  D12:{n:12,name:"Dwadasamsa",full:"Parents Chart",desc:"Parents, ancestry, lineage"},
  D16:{n:16,name:"Shodasamsa",full:"Vehicles & Comfort",desc:"Vehicles, comforts, mental peace"},
  D20:{n:20,name:"Vimsamsa",full:"Spiritual Chart",desc:"Spiritual pursuits, worship, sadhana"},
  D24:{n:24,name:"Chaturvimsamsa",full:"Education Chart",desc:"Education, learning, knowledge"},
  D27:{n:27,name:"Bhamsa",full:"Strengths & Weaknesses",desc:"Inherent strengths and weaknesses"},
  D30:{n:30,name:"Trimsamsa",full:"Misfortunes Chart",desc:"Miseries, evils, misfortunes"},
  D40:{n:40,name:"Khavedamsa",full:"Auspicious Effects",desc:"Maternal legacy, auspicious/inauspicious effects"},
  D45:{n:45,name:"Akshavedamsa",full:"General Indications",desc:"Character, conduct, general life indications"},
  D60:{n:60,name:"Shashtiamsa",full:"Past Karma Chart",desc:"Past-life karma, overall life refinement"}
};

function calcVarga(varga, lon){
  const signIdx = getSignIndex(lon);
  const degInSign = getDegInSign(lon);
  const odd = signIdx % 2 === 0;
  switch(varga){
    case "D1": return signIdx;
    case "D2": { if (odd) return degInSign<15 ? 4 : 3; return degInSign<15 ? 3 : 4; }
    case "D3": { const part = Math.floor(degInSign/10); if (part===0) return signIdx; if (part===1) return (signIdx+4)%12; return (signIdx+8)%12; }
    case "D4": { const part = Math.floor(degInSign/7.5); return (signIdx+part*3)%12; }
    case "D5": {
      // Verified against two independent matching sources: 5 parts of an ODD sign go
      // into Aries, Aquarius, Sagittarius, Gemini, Libra (in that order); 5 parts of an
      // EVEN sign go into Taurus, Virgo, Pisces, Capricorn, Scorpio.
      const D5_ODD = [0,10,8,2,6];
      const D5_EVEN = [1,5,11,9,7];
      const part = Math.min(4, Math.floor(degInSign/6));
      return odd ? D5_ODD[part] : D5_EVEN[part];
    }
    case "D6": { const part = Math.floor(degInSign/5); const base = odd?0:6; return (base+part)%12; }
    case "D7": { const part = Math.floor(degInSign/(30/7)); const base = odd?signIdx:(signIdx+6)%12; return (base+part)%12; }
    case "D8": {
      // Verified: uses movable/fixed/dual modality (NOT odd/even), starting from
      // Aries/Leo/Sagittarius respectively -- confirmed by two independent sources.
      const part = Math.floor(degInSign/3.75);
      const modality = signIdx % 3;
      let start;
      if (modality===0) start=0; else if (modality===1) start=4; else start=8;
      return (start+part)%12;
    }
    case "D9": {
      // CRITICAL FIX: the previous formula used fixed absolute starting points
      // (movable->Aries, fixed->Leo, dual->Sagittarius always) which is WRONG for
      // 11 of 12 signs. The verified BPHS rule is RELATIVE to each specific sign:
      // movable sign -> count from itself; fixed sign -> count from the 9th sign
      // from itself; dual sign -> count from the 5th sign from itself. Verified
      // against a direct BPHS-sourced worked example (Taurus 17 deg -> Gemini)
      // and cross-checked for internal consistency across all 12 signs via the
      // classical element-group (fire/earth/air/water) description, which
      // independently derives the same starting signs.
      const part = Math.floor(degInSign/(30/9));
      const modality = signIdx % 3;
      let start;
      if (modality===0) start = signIdx;
      else if (modality===1) start = (signIdx+8)%12;
      else start = (signIdx+4)%12;
      return (start+part)%12;
    }
    case "D10": { const part = Math.floor(degInSign/3); const base = odd?signIdx:(signIdx+8)%12; return (base+part)%12; }
    case "D11": {
      // Verified: 11 equal divisions (not 12 as before). Starting sign = the sign
      // reached by counting anti-zodiacally from Aries the same number of steps as
      // the sign-being-divided is from Aries zodiacally. Confirmed against two
      // worked examples (Mercury 11 deg Gemini -> Gemini; Jupiter 19 deg Scorpio ->
      // starts from Virgo), both matching exactly.
      const part = Math.floor(degInSign/(30/11));
      const startSign = (12 - signIdx) % 12;
      return (startSign + part) % 12;
    }
    case "D12": { const part = Math.floor(degInSign/2.5); return (signIdx+part)%12; }
    case "D16": {
      // BPHS Ch.6 v.36: "Shodashamsha from Aries for movable signs, from Leo for fixed signs, from Sagittarius for dual signs."
      // (The earlier odd/even -> Aries/Libra rule was wrong.)
      const part = Math.floor(degInSign/1.875);
      const modality = signIdx % 3;
      const start = modality===0 ? 0 : (modality===1 ? 4 : 8);
      return (start+part)%12;
    }
    case "D20": {
      // Verified: uses movable/fixed/dual modality (NOT odd/even). Starting signs:
      // movable->Aries, fixed->Sagittarius, dual->Leo -- confirmed by three
      // independent matching sources. Note this ordering (fixed->Sagittarius,
      // dual->Leo) is swapped relative to D8/D45's Aries/Leo/Sagittarius pattern.
      const part = Math.floor(degInSign/1.5);
      const modality = signIdx % 3;
      let start;
      if (modality===0) start=0; else if (modality===1) start=8; else start=4;
      return (start+part)%12;
    }
    case "D24": { const part = Math.floor(degInSign/1.25); const base = odd?4:3; return (base+part)%12; }
    case "D27": { const part = Math.floor(degInSign/(30/27)); const elementBase = [0,3,6,9][signIdx%4]; return (elementBase+part)%12; }
    case "D30": {
      if (odd){
        if (degInSign<5) return 0; if (degInSign<10) return 10; if (degInSign<18) return 8; if (degInSign<25) return 2; return 6;
      } else {
        if (degInSign<5) return 1; if (degInSign<12) return 5; if (degInSign<20) return 11; if (degInSign<25) return 9; return 7;
      }
    }
    case "D40": { const part = Math.floor(degInSign/0.75); const base = odd?0:6; return (base+part)%12; }
    case "D45": {
      // Verified: uses movable/fixed/dual modality (NOT odd/even, and the previous
      // code only had 2 branches when 3 are needed). Starting signs: movable->Aries,
      // fixed->Leo, dual->Sagittarius -- confirmed by four independent matching
      // sources (same pattern as D8).
      const part = Math.floor(degInSign/(30/45));
      const modality = signIdx % 3;
      let start;
      if (modality===0) start=0; else if (modality===1) start=4; else start=8;
      return (start+part)%12;
    }
    case "D60": { const part = Math.floor(degInSign/0.5); return (signIdx+part)%12; }
    default: return signIdx;
  }
}

const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
// Outer (trans-Saturnian) planets: plotted on the charts and listed, but kept out of the classical Vedic engines.
const OUTER_LIST = ["Uranus","Neptune","Pluto"];
const OUTER_GLYPHS = {Uranus:"♅",Neptune:"♆",Pluto:"♇"};
const OUTER_COL = {Uranus:"#7DE3E0",Neptune:"#5B7CFA",Pluto:"#C9A38A"};
const OUTER_SK = {Uranus:"Prajapati",Neptune:"Varuna",Pluto:"Yama"};
window.__showOuter = true;
/* ---- Outer (trans-Saturnian) planet knowledge, shared by popups, reports and aspects ---- */
const OUTER_INFO = {
  Uranus:{ic:'⚡', role:'The Awakener', sk:'Prajapati',
    about:'Uranus is the planet of sudden change, originality and freedom. It breaks old structures so something truer can appear. Where it sits in your chart shows where you refuse to be ordinary, where life jolts you awake, and where you innovate. Its pace is slow (about 7 years per sign), so it colours a whole generation and is personal mainly through its house and its aspects to your own planets.',
    themes:['Sudden change','Innovation','Freedom','Rebellion','Technology','Eccentricity','Awakening','Surprises'],
    body:['Nervous system','Circulation','Ankles','Electrical impulses'], rules:'Aquarius (modern co-ruler with Saturn)', cycle:'≈ 84 years, about 7 years per sign', yrs:84, perSign:'≈ 7 years',
    facts:[['📏','Diameter','50,724 km (3.98× Earth)'],['☀️','Distance from Sun','19.2 AU (2.9 billion km)'],['🔄','Year','84 Earth years'],['⏱️','Day length','17 h 14 m'],['🌀','Quirk','Spins on its side (98° tilt)'],['🔭','Discovered','1781, William Herschel'],['🌡️','Cloud tops','≈ −224 °C'],['💍','Rings','13 faint rings']]},
  Neptune:{ic:'🔱', role:'The Dreamer', sk:'Varuna',
    about:'Neptune is the planet of imagination, compassion and illusion. It dissolves boundaries: it gives inspiration, music, faith and empathy, and also confusion, escapism and blind spots. Its house shows where you dream, idealise and sacrifice; its aspects show which planets it softens or clouds. It moves very slowly (about 14 years per sign).',
    themes:['Dreams','Compassion','Spirituality','Imagination','Illusion','Escapism','Intuition','Dissolving boundaries'],
    body:['Pineal gland','Immune system','Feet','Lymph'], rules:'Pisces (modern ruler)', cycle:'≈ 165 years, about 14 years per sign', yrs:165, perSign:'≈ 14 years',
    facts:[['📏','Diameter','49,244 km (3.86× Earth)'],['☀️','Distance from Sun','30.1 AU (4.5 billion km)'],['🔄','Year','164.8 Earth years'],['⏱️','Day length','16 h 6 m'],['🌬️','Winds','Up to ≈ 2,100 km/h'],['🔭','Discovered','1846, found by maths first'],['🌡️','Cloud tops','≈ −214 °C'],['🌑','Largest moon','Triton (orbits backwards)']]},
  Pluto:{ic:'♇', role:'The Transformer', sk:'Yama',
    about:'Pluto is the planet of deep transformation, power and rebirth. It strips away what is no longer true, then rebuilds. Its house shows where you meet intensity, control, secrets and renewal; aspects to your planets show what gets purged and reborn. Its orbit is very elongated, so it spends anywhere from about 12 to 31 years in a sign.',
    themes:['Transformation','Power','Death & rebirth','Secrets','Obsession','Regeneration','Purging','Depth'],
    body:['Reproductive organs','Excretory system','Regeneration'], rules:'Scorpio (modern co-ruler with Mars)', cycle:'≈ 248 years, about 12–31 years per sign', yrs:248, perSign:'≈ 12–31 years',
    facts:[['📏','Diameter','2,377 km (0.19× Earth)'],['☀️','Distance from Sun','29.7 – 49.3 AU'],['🔄','Year','247.9 Earth years'],['⏱️','Day length','6.4 Earth days'],['🪐','Status','Dwarf planet since 2006'],['🔭','Discovered','1930, Clyde Tombaugh'],['🌡️','Surface','≈ −229 °C'],['🌑','Moons','5 (largest: Charon)']]}
};
const OUTER_VEDIC_NOTE = 'Classical Jyotish works with the seven visible planets plus Rahu and Ketu. Uranus, Neptune and Pluto have no Parashari drishti, dasha or Shadbala, so their aspects here are Western-style (by angle and orb). Some Indian astrologers call them Prajapati, Varuna and Yama (names vary by author). Use them as supporting colour, not as primary significators.';
const OUTER_ASPECTS = [
  {name:'Conjunction', angle:0, symbol:'☌', orb:8, verb:'merges with'}, {name:'Sextile', angle:60, symbol:'⚹', orb:4, verb:'supports'},
  {name:'Square', angle:90, symbol:'□', orb:7, verb:'pressures'}, {name:'Trine', angle:120, symbol:'△', orb:7, verb:'flows with'},
  {name:'Opposition', angle:180, symbol:'☍', orb:8, verb:'pulls against'}
];
const OUTER_HOUSE_KW = ['self, body and identity','money, family and speech','courage, skills and siblings','home, mother and inner peace','creativity, children and romance','work, health and daily service','partnerships and marriage','change, the hidden and shared resources','beliefs, teachers and long journeys','career, status and public life','gains, friends and ambitions','endings, sleep, foreign lands and the spiritual'];
function outerHouseLine(name, h){ const t = OUTER_INFO[name].themes; return `${name} brings ${t[0].toLowerCase()}, ${t[1].toLowerCase()} and ${t[2].toLowerCase()} into the area of ${OUTER_HOUSE_KW[h-1]} (house ${h}).`; }
// targets: [[label, longitude], ...]; returns aspects within orb, tightest first. Orb is widened for Sun/Moon/Ascendant by 1°.
function outerAspectsTo(lon, targets, selfName){
  const res = [];
  targets.forEach(([n,l])=>{
    if (n===selfName) return;
    const diff = (((lon - l) % 360) + 360) % 360, d = diff > 180 ? 360 - diff : diff; // separation 0..180
    OUTER_ASPECTS.forEach(a=>{ const dev = Math.abs(d - a.angle), orb = a.orb + ((n==='Sun'||n==='Moon'||n==='Ascendant')?1:0); if (dev <= orb) res.push({target:n, asp:a, dev}); });
  });
  return res.sort((x,y)=>x.dev-y.dev);
}

const PLANET_GLYPHS = {Sun:"☉",Moon:"☽",Mars:"♂",Mercury:"☿",Jupiter:"♃",Venus:"♀",Saturn:"♄",Rahu:"☊",Ketu:"☋"};

const EXALTATION = {
  Sun: { sign: 0, deg: 10 },
  Moon: { sign: 1, deg: 3 },
  Mars: { sign: 9, deg: 28 },
  Mercury: { sign: 5, deg: 15 },
  Jupiter: { sign: 3, deg: 5 },
  Venus: { sign: 11, deg: 27 },
  Saturn: { sign: 6, deg: 20 },
  Rahu: { sign: 1, deg: null },
  Ketu: { sign: 7, deg: null }
};
function getDebilitation(name){
  const ex = EXALTATION[name];
  return { sign: (ex.sign+6)%12, deg: ex.deg };
}
const MOOLATRIKONA = {
  Sun: { sign: 4, from: 0, to: 20 },
  Moon: { sign: 1, from: 3, to: 30 },
  Mars: { sign: 0, from: 0, to: 12 },
  Mercury: { sign: 5, from: 15, to: 20 },
  Jupiter: { sign: 8, from: 0, to: 10 },
  Venus: { sign: 6, from: 0, to: 15 },
  Saturn: { sign: 10, from: 0, to: 20 }
};
const OWN_SIGNS = {
  Sun: [4], Moon: [3], Mars: [0,7], Mercury: [2,5], Jupiter: [8,11], Venus: [1,6], Saturn: [9,10],
  Rahu: [], Ketu: []
};
const NATURAL_RELATIONS = {
  Sun: { friends:["Moon","Mars","Jupiter"], enemies:["Venus","Saturn"], neutrals:["Mercury"] },
  Moon: { friends:["Sun","Mercury"], enemies:[], neutrals:["Mars","Jupiter","Venus","Saturn"] },
  Mars: { friends:["Sun","Moon","Jupiter"], enemies:["Mercury"], neutrals:["Venus","Saturn"] },
  Mercury: { friends:["Sun","Venus"], enemies:["Moon"], neutrals:["Mars","Jupiter","Saturn"] },
  Jupiter: { friends:["Sun","Moon","Mars"], enemies:["Mercury","Venus"], neutrals:["Saturn"] },
  Venus: { friends:["Mercury","Saturn"], enemies:["Sun","Moon"], neutrals:["Mars","Jupiter"] },
  Saturn: { friends:["Mercury","Venus"], enemies:["Sun","Moon","Mars"], neutrals:["Jupiter"] }
};

function getDignity(name, signIdx, degInSign){
  if (name==="Rahu" || name==="Ketu"){
    const ex = EXALTATION[name];
    const deb = getDebilitation(name);
    if (signIdx===ex.sign) return { status:"Exalted", label:"Exalted (convention-dependent)" };
    if (signIdx===deb.sign) return { status:"Debilitated", label:"Debilitated (convention-dependent)" };
    return { status:"Neutral", label:"—" };
  }
  const ex = EXALTATION[name];
  const deb = getDebilitation(name);
  if (signIdx===ex.sign){
    if (Math.abs(degInSign-ex.deg)<0.5) return { status:"Exalted", label:"Deep Exaltation (Paramoccha)" };
    return { status:"Exalted", label:"Exalted" };
  }
  if (signIdx===deb.sign){
    if (Math.abs(degInSign-deb.deg)<0.5) return { status:"Debilitated", label:"Deep Debilitation" };
    return { status:"Debilitated", label:"Debilitated" };
  }
  const mt = MOOLATRIKONA[name];
  if (mt && signIdx===mt.sign && degInSign>=mt.from && degInSign<=mt.to){
    return { status:"Moolatrikona", label:"Moolatrikona" };
  }
  if (OWN_SIGNS[name] && OWN_SIGNS[name].includes(signIdx)){
    return { status:"OwnSign", label:"Own Sign (Swakshetra)" };
  }
  const signLord = SIGNS[signIdx].lord;
  if (signLord===name) return { status:"OwnSign", label:"Own Sign (Swakshetra)" };
  const rel = NATURAL_RELATIONS[name];
  if (rel){
    if (rel.friends.includes(signLord)) return { status:"Friend", label:"Friendly Sign" };
    if (rel.enemies.includes(signLord)) return { status:"Enemy", label:"Enemy Sign" };
    return { status:"Neutral", label:"Neutral Sign" };
  }
  return { status:"Neutral", label:"—" };
}

const COMBUSTION_ORBS = { Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15 };
const COMBUSTION_ORBS_RETRO = { Mercury: 12, Venus: 8, Mars: 8 };

function getCombustion(name, planetLon, sunLon, retrograde){
  if (name==="Sun" || name==="Rahu" || name==="Ketu" || name==="Moon" && false) {}
  if (!(name in COMBUSTION_ORBS)) return { combust:false };
  let orb = COMBUSTION_ORBS[name];
  if (retrograde && COMBUSTION_ORBS_RETRO[name]) orb = COMBUSTION_ORBS_RETRO[name];
  const sep = Math.abs(angDiffLocal(planetLon, sunLon));
  return { combust: sep <= orb, separation: sep, orb };
}
function angDiffLocal(a,b){ let d = normDeg(a-b); if (d>180) d -= 360; return Math.abs(d); }

const WAR_ELIGIBLE = ["Mars","Mercury","Jupiter","Venus","Saturn"];
function findPlanetaryWars(siderealLongitudes){
  const wars = [];
  for (let i=0;i<WAR_ELIGIBLE.length;i++){
    for (let j=i+1;j<WAR_ELIGIBLE.length;j++){
      const a = WAR_ELIGIBLE[i], b = WAR_ELIGIBLE[j];
      const sep = angDiffLocal(siderealLongitudes[a], siderealLongitudes[b]);
      if (sep <= 1.0){
        const winner = normDeg(siderealLongitudes[a]) < normDeg(siderealLongitudes[b]) ? a : b;
        wars.push({ planetA:a, planetB:b, separation:sep, winner });
      }
    }
  }
  return wars;
}

const SPECIAL_ASPECTS = { Mars: [4,8], Jupiter: [5,9], Saturn: [3,10] };
function getAspectedHouses(name, houseOfPlanet){
  const houses = new Set();
  houses.add(((houseOfPlanet-1+6)%12)+1);
  if (SPECIAL_ASPECTS[name]){
    SPECIAL_ASPECTS[name].forEach(offset=>{
      houses.add(((houseOfPlanet-1+offset-1)%12)+1);
    });
  }
  return [...houses].sort((a,b)=>a-b);
}

function angleErrorForTarget(lonA, lonB, targetAngle){
  let diff = normDeg(lonA - lonB);
  let error = diff - targetAngle;
  error = ((error + 180) % 360 + 360) % 360 - 180;
  return error;
}

function findAspectEventsInRange(bodyA, bodyB, targetAngle, startJD, endJD, stepDays){
  stepDays = stepDays || 1;
  const events = [];
  let jd = startJD;
  let prevErr = angleErrorForTarget(getSiderealLongitudeAt(bodyA,jd), getSiderealLongitudeAt(bodyB,jd), targetAngle);
  jd += stepDays;
  while (jd <= endJD){
    const err = angleErrorForTarget(getSiderealLongitudeAt(bodyA,jd), getSiderealLongitudeAt(bodyB,jd), targetAngle);
    if ((prevErr>0 && err<=0) || (prevErr<0 && err>=0)){
      if (Math.abs(prevErr) < 90 && Math.abs(err) < 90){
        let lo = jd-stepDays, hi = jd;
        for (let iter=0; iter<40; iter++){
          const mid = (lo+hi)/2;
          const e = angleErrorForTarget(getSiderealLongitudeAt(bodyA,mid), getSiderealLongitudeAt(bodyB,mid), targetAngle);
          if ((e>0)===(prevErr>0)) lo=mid; else hi=mid;
        }
        events.push({ jd: hi });
      }
    }
    prevErr = err;
    jd += stepDays;
  }
  return events;
}

function stepDaysForPair(bodyA, bodyB){
  const fast = ["Moon"];
  if (fast.includes(bodyA) || fast.includes(bodyB)) return 0.5;
  const medium = ["Sun","Mercury","Venus","Mars"];
  if (medium.includes(bodyA) || medium.includes(bodyB)) return 1;
  return 2;
}

function findNearestAspectForPair(bodyA, bodyB, targetAngle, referenceJD, maxSearchDays){
  maxSearchDays = maxSearchDays || 3650;
  const stepDays = stepDaysForPair(bodyA, bodyB);
  const future = findAspectEventsInRange(bodyA, bodyB, targetAngle, referenceJD, referenceJD+maxSearchDays, stepDays);
  const past = findAspectEventsInRange(bodyA, bodyB, targetAngle, referenceJD-maxSearchDays, referenceJD, stepDays);
  return { next: future.length ? future[0] : null, previous: past.length ? past[past.length-1] : null };
}

const WESTERN_ASPECTS = [
  { name:"Conjunction", angle:0, symbol:"☌", orb:8 },
  { name:"Sextile", angle:60, symbol:"⚹", orb:6 },
  { name:"Square", angle:90, symbol:"□", orb:8 },
  { name:"Trine", angle:120, symbol:"△", orb:8 },
  { name:"Opposition", angle:180, symbol:"☍", orb:8 }
];

const DASHA_YEARS = { Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17 };
const DASHA_SEQUENCE = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const DASHA_TOTAL_YEARS = 120;

function addYearsToDate(date, years){
  const ms = years * 365.25 * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + ms);
}

function calculateVimshottariDasha(moonSiderealLon, birthDateUTC){
  const nakSpan = 360/27;
  const nakIndex = Math.floor(normDeg(moonSiderealLon) / nakSpan);
  const degIntoNak = normDeg(moonSiderealLon) % nakSpan;
  const fractionRemaining = (nakSpan - degIntoNak) / nakSpan;
  const startLord = NAKSHATRAS[nakIndex].lord;
  const balanceYears = fractionRemaining * DASHA_YEARS[startLord];

  const mahadashas = [];
  let cursorDate = new Date(birthDateUTC.getTime());
  // The first mahadasha is only PART of the full cycle: the child is born inside it. Remember the full length and the
  // (virtual) moment it began, so antardashas/pratyantars can be laid out on the FULL cycle and then cut at birth.
  const fullFirst = DASHA_YEARS[startLord];
  mahadashas.push({ lord:startLord, years:balanceYears, startDate:new Date(cursorDate.getTime()), endDate:addYearsToDate(cursorDate, balanceYears),
                    fullYears:fullFirst, fullStart:addYearsToDate(cursorDate, -(fullFirst - balanceYears)) });
  cursorDate = addYearsToDate(cursorDate, balanceYears);

  let seqPos = (DASHA_SEQUENCE.indexOf(startLord)+1) % 9;
  let totalSoFar = balanceYears;
  while (totalSoFar < 130){
    const lord = DASHA_SEQUENCE[seqPos];
    const years = DASHA_YEARS[lord];
    const start = new Date(cursorDate.getTime());
    const end = addYearsToDate(cursorDate, years);
    mahadashas.push({ lord, years, startDate:start, endDate:end });
    cursorDate = end;
    totalSoFar += years;
    seqPos = (seqPos+1)%9;
  }
  return { nakIndex, startLord, balanceYears, mahadashas };
}

function calculateAntardashas(parent){
  // Sub-periods of ANY level. If `parent` was cut off at birth (first mahadasha and the periods inside it that
  // straddle birth), the 9 sub-periods are laid out on its FULL length from its virtual start, then clipped to
  // [parent.startDate, parent.endDate]; earlier ones (before birth) are dropped. Full-length parents are unchanged.
  const startLordIdx = DASHA_SEQUENCE.indexOf(parent.lord);
  const fullYears = parent.fullYears != null ? parent.fullYears : parent.years;
  let cursor = new Date((parent.fullStart || parent.startDate).getTime());
  const t0 = parent.startDate.getTime(), t1 = parent.endDate.getTime();
  const out = [];
  for (let i=0;i<9;i++){
    const adLord = DASHA_SEQUENCE[(startLordIdx+i)%9];
    const adYears = (fullYears * DASHA_YEARS[adLord]) / DASHA_TOTAL_YEARS;
    const fs = new Date(cursor.getTime()), fe = addYearsToDate(cursor, adYears);
    cursor = fe;
    if (fe.getTime() <= t0 + 1) continue;          // finished before birth
    if (fs.getTime() >= t1 - 1) break;
    const start = fs.getTime() < t0 ? new Date(t0) : fs;
    const end   = fe.getTime() > t1 + 1 ? new Date(t1) : fe;
    const item = { lord:adLord, years:(end.getTime()-start.getTime())/(365.25*86400000), startDate:start, endDate:end };
    if (start !== fs || end !== fe){ item.fullYears = adYears; item.fullStart = fs; }
    out.push(item);
  }
  return out;
}
const calculateSubPeriods = calculateAntardashas;

function findActiveDasha(mahadashas, atDate){
  const md = mahadashas.find(m=> atDate>=m.startDate && atDate<m.endDate);
  if (!md) return null;
  const ads = calculateSubPeriods(md);
  const ad = ads.find(a=> atDate>=a.startDate && atDate<a.endDate);
  let pd = null, pds = null, sd = null, sds = null, prd = null, prds = null;
  if (ad){
    pds = calculateSubPeriods(ad);
    pd = pds.find(p=> atDate>=p.startDate && atDate<p.endDate);
    if (pd){
      sds = calculateSubPeriods(pd);
      sd = sds.find(s=> atDate>=s.startDate && atDate<s.endDate);
      if (sd){
        prds = calculateSubPeriods(sd);
        prd = prds.find(p=> atDate>=p.startDate && atDate<p.endDate);
      }
    }
  }
  return {
    mahadasha: md, antardasha: ad, allAntardashas: ads,
    pratyantardasha: pd, allPratyantardashas: pds,
    sookshmaDasha: sd, allSookshmaDashas: sds,
    pranaDasha: prd, allPranaDashas: prds
  };
}

const CONTRIBUTION_TABLE = {
  Sun: { Sun:[1,2,4,7,8,9,10,11], Moon:[3,6,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[3,5,6,9,10,11,12], Jupiter:[5,6,9,11], Venus:[6,7,12], Saturn:[1,2,4,7,8,9,10,11], Lagna:[3,4,6,10,11,12] },
  Moon: { Sun:[3,6,7,8,10,11], Moon:[1,3,6,7,10,11], Mars:[2,3,5,6,9,10,11], Mercury:[1,3,4,5,7,8,10,11], Jupiter:[1,4,7,8,10,11,12], Venus:[3,4,5,7,9,10,11], Saturn:[3,5,6,11], Lagna:[3,6,10,11] },
  Mars: { Sun:[3,5,6,10,11], Moon:[3,6,11], Mars:[1,2,4,7,8,10,11], Mercury:[3,5,6,11], Jupiter:[6,10,11,12], Venus:[6,8,11,12], Saturn:[1,4,7,8,9,10,11], Lagna:[1,3,6,10,11] },
  Mercury: { Sun:[5,6,9,11,12], Moon:[2,4,6,8,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[1,3,5,6,9,10,11,12], Jupiter:[6,8,11,12], Venus:[1,2,3,4,5,8,9,11], Saturn:[1,2,4,7,8,9,10,11], Lagna:[1,2,4,6,8,10,11] },
  Jupiter: { Sun:[1,2,3,4,7,8,9,10,11], Moon:[2,5,7,9,11], Mars:[1,2,4,7,8,10,11], Mercury:[1,2,4,5,6,9,10,11], Jupiter:[1,2,3,4,7,8,10,11], Venus:[2,5,6,9,10,11], Saturn:[3,5,6,12], Lagna:[1,2,4,5,6,7,9,10,11] },
  Venus: { Sun:[8,11,12], Moon:[1,2,3,4,5,8,9,11,12], Mars:[3,5,6,9,11,12], Mercury:[3,5,6,9,11], Jupiter:[5,8,9,10,11], Venus:[1,2,3,4,5,8,9,10,11], Saturn:[3,4,5,8,9,10,11], Lagna:[1,2,3,4,5,8,9,11] },
  Saturn: { Sun:[1,2,4,7,8,10,11], Moon:[3,6,11], Mars:[3,5,6,10,11,12], Mercury:[6,8,9,10,11,12], Jupiter:[5,6,11,12], Venus:[6,11,12], Saturn:[3,5,6,11], Lagna:[1,3,4,6,10,11] }
};
const BAV_PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
const CONTRIBUTORS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Lagna"];
function signsFromOffsets(contributorSignIdx, offsets){ return offsets.map(offset => (contributorSignIdx + offset - 1) % 12); }
function computeBAV(forPlanet, signPositions){
  const bav = new Array(12).fill(0);
  const rules = CONTRIBUTION_TABLE[forPlanet];
  CONTRIBUTORS.forEach(contributor=>{
    const contributorSign = signPositions[contributor];
    const offsets = rules[contributor];
    const receivingSigns = signsFromOffsets(contributorSign, offsets);
    receivingSigns.forEach(signIdx=> bav[signIdx]++);
  });
  return bav;
}
function computeFullAshtakavarga(signPositions){
  const bavTables = {};
  BAV_PLANETS.forEach(p=> bavTables[p] = computeBAV(p, signPositions));
  const sav = new Array(12).fill(0);
  BAV_PLANETS.forEach(p=> bavTables[p].forEach((v,i)=> sav[i]+=v));
  return { bavTables, sav };
}

const KENDRA_HOUSES = [1,4,7,10];
const TRIKONA_HOUSES = [1,5,9];
const DUSTHANA_HOUSES = [6,8,12];
function housesApart(fromHouse, toHouse){
  let d = toHouse - fromHouse;
  if (d < 0) d += 12;
  return d + 1;
}

function detectPanchaMahapurushaYogas(planets){
  const results = [];
  const MAHAPURUSHA_PLANETS = { Mars: "Ruchaka", Mercury: "Bhadra", Jupiter: "Hamsa", Venus: "Malavya", Saturn: "Sasa" };
  for (const name in MAHAPURUSHA_PLANETS){
    const p = planets[name];
    if (!p) continue;
    const inKendra = KENDRA_HOUSES.includes(p.house);
    const inOwnOrExalted = (OWN_SIGNS[name]&&OWN_SIGNS[name].includes(p.sign)) || p.sign===EXALTATION[name].sign;
    if (inKendra && inOwnOrExalted){
      results.push({ yoga: MAHAPURUSHA_PLANETS[name], planet:name, house:p.house, sign:p.sign });
    }
  }
  return results;
}
function detectGajaKesariYoga(planets){
  const moonHouse = planets.Moon.house;
  const jupiterHouse = planets.Jupiter.house;
  const dist = housesApart(moonHouse, jupiterHouse);
  const kendraFromMoon = [1,4,7,10].includes(dist);
  return kendraFromMoon ? { yoga:"Gaja Kesari", moonHouse, jupiterHouse, distance:dist } : null;
}
function getHouseLord(houseNum, ascSign){
  const signOfHouse = (ascSign + houseNum - 1) % 12;
  return SIGNS[signOfHouse].lord;
}
function detectRajaYogas(planets, ascSign){
  const results = [];
  const seen = new Set();
  const kendraLords = new Set(KENDRA_HOUSES.map(h=>getHouseLord(h,ascSign)));
  const trikonaLords = new Set(TRIKONA_HOUSES.map(h=>getHouseLord(h,ascSign)));
  kendraLords.forEach(kLord=>{
    trikonaLords.forEach(tLord=>{
      if (kLord===tLord) return;
      const key = [kLord,tLord].sort().join('-');
      if (seen.has(key)) return;
      const kPlanet = planets[kLord];
      const tPlanet = planets[tLord];
      if (!kPlanet || !tPlanet) return;
      const conjunct = kPlanet.house === tPlanet.house;
      const mutualAspect = kPlanet.aspectsHouses && tPlanet.aspectsHouses &&
        kPlanet.aspectsHouses.includes(tPlanet.house) && tPlanet.aspectsHouses.includes(kPlanet.house);
      if (conjunct || mutualAspect){
        seen.add(key);
        results.push({ yoga:"Raja Yoga", kendraLord:kLord, trikonaLord:tLord, type: conjunct?"conjunction":"mutual aspect" });
      }
    });
  });
  return results;
}
function detectParivartanaYogas(planets, ascSign){
  const results = [];
  const checked = new Set();
  for (let h1=1; h1<=12; h1++){
    const lord1 = getHouseLord(h1, ascSign);
    const lord1Planet = planets[lord1];
    if (!lord1Planet) continue;
    const lord1CurrentHouse = lord1Planet.house;
    if (lord1CurrentHouse === h1) continue;
    const lord2 = getHouseLord(lord1CurrentHouse, ascSign);
    if (lord2 === lord1) continue;
    const lord2Planet = planets[lord2];
    if (!lord2Planet) continue;
    if (lord2Planet.house === h1){
      const key = [lord1,lord2].sort().join('-');
      if (!checked.has(key)){
        checked.add(key);
        results.push({ yoga:"Parivartana (Exchange)", houseA:h1, lordA:lord1, houseB:lord1CurrentHouse, lordB:lord2 });
      }
    }
  }
  return results;
}
function detectViparitaRajaYoga(planets, ascSign){
  // Classical definition: the lord of the 6th (Harsha), 8th (Sarala) or 12th (Vimala) is placed in the 6th, 8th or 12th house.
  const NAME = { 6:'Harsha', 8:'Sarala', 12:'Vimala' }, results = [];
  DUSTHANA_HOUSES.forEach(h=>{
    const lord = getHouseLord(h, ascSign), p = planets[lord];
    if (p && DUSTHANA_HOUSES.includes(p.house))
      results.push({ yoga: NAME[h]+' Viparita Raja Yoga', houseA:h, lordA:lord, houseB:p.house, lordB:lord, type: h===p.house ? `${h}th lord in its own house` : `${h}th lord placed in the ${p.house}th house` });
  });
  return results;
}
function detectNeechaBhanga(planets, ascSign){
  const results = [];
  const NEECHA_ELIGIBLE = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
  for (const name of NEECHA_ELIGIBLE){
    const p = planets[name];
    const deb = getDebilitation(name);
    if (!p || p.sign !== deb.sign) continue;
    const dispositor = SIGNS[p.sign].lord;
    const dispositorPlanet = planets[dispositor];
    if (!dispositorPlanet) continue;
    const kendraFromLagna = KENDRA_HOUSES.includes(dispositorPlanet.house);
    const moonHouse = planets.Moon.house;
    const distFromMoon = housesApart(moonHouse, dispositorPlanet.house);
    const kendraFromMoon = KENDRA_HOUSES.includes(distFromMoon);
    const exLord = SIGNS[EXALTATION[name].sign].lord, exP = planets[exLord];
    const exKendra = exP && exLord !== dispositor && (KENDRA_HOUSES.includes(exP.house) || KENDRA_HOUSES.includes(housesApart(moonHouse, exP.house)));
    if (kendraFromLagna || kendraFromMoon){
      results.push({ yoga:"Neecha Bhanga Raja Yoga", planet:name, dispositor, condition: kendraFromLagna?"dispositor in kendra from Lagna":"dispositor in kendra from Moon" });
    } else if (exKendra){
      results.push({ yoga:"Neecha Bhanga Raja Yoga", planet:name, dispositor:exLord, condition:`lord of its exaltation sign, in a kendra` });
    }
  }
  return results;
}

const KARAKA_NAMES = ["Atmakaraka","Amatyakaraka","Bhratrikaraka","Matrikaraka","Putrakaraka","Gnatikaraka","Darakaraka"];
const KARAKA_SIGNIFICANCE = {
  Atmakaraka: "Soul, core identity, the central life lesson this incarnation is built around.",
  Amatyakaraka: "Career, profession, advisors and authority figures who shape your path.",
  Bhratrikaraka: "Siblings, courage, effort, close companions.",
  Matrikaraka: "Mother, home environment, emotional foundations.",
  Putrakaraka: "Children, creativity, intelligence, disciples or creative output.",
  Gnatikaraka: "Extended relatives, rivals, recurring obstacles that force growth.",
  Darakaraka: "Spouse, business partners, what marriage and partnership teach you."
};
const KARAKA_ELIGIBLE = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

function calculateCharaKarakas(planetDegrees){
  const ranked = KARAKA_ELIGIBLE
    .map(name => ({ name, deg: planetDegrees[name] }))
    .sort((a,b) => b.deg - a.deg);
  const result = {};
  ranked.forEach((p, idx) => {
    result[KARAKA_NAMES[idx]] = { planet: p.name, degree: p.deg };
  });
  return result;
}

const BALA_PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
const NAISARGIKA_BALA = { Sun: 60, Moon: 51.43, Venus: 42.86, Jupiter: 34.29, Mercury: 25.71, Mars: 17.14, Saturn: 8.57 };
function getNaisargikaBala(name){ return NAISARGIKA_BALA[name]; }
const DIG_BALA_HOME_HOUSE = { Sun:10, Mars:10, Moon:4, Venus:4, Mercury:1, Jupiter:1, Saturn:7 };
function getDigBala(name, house){
  const homeHouse = DIG_BALA_HOME_HOUSE[name];
  let dist = Math.abs(house - homeHouse);
  if (dist > 6) dist = 12 - dist;
  return Math.max(0, 60 * (1 - dist/6));
}
function getUcchaBala(exaltSignIdx, exaltDeg, planetSignIdx, planetDegInSign){
  const exaltAbsLon = exaltSignIdx*30 + exaltDeg;
  const planetAbsLon = planetSignIdx*30 + planetDegInSign;
  const debilAbsLon = normDeg(exaltAbsLon + 180);
  let distFromDebil = normDeg(planetAbsLon - debilAbsLon);
  if (distFromDebil > 180) distFromDebil = 360 - distFromDebil;
  return (distFromDebil/180) * 60;
}
const ODD_SIGN_STRONG = ["Sun","Mars","Jupiter"];
const EVEN_SIGN_STRONG = ["Moon","Venus"];
function isOddSign(signIdx){ return signIdx % 2 === 0; }
function getOjaYugmaBala(name, rashiSignIdx, navamsaSignIdx){
  if (name==="Mercury" || name==="Saturn") return 30;
  let bala = 0;
  const rashiOdd = isOddSign(rashiSignIdx);
  const navamsaOdd = isOddSign(navamsaSignIdx);
  if (ODD_SIGN_STRONG.includes(name)){ bala += rashiOdd ? 15 : 0; bala += navamsaOdd ? 15 : 0; } 
  else if (EVEN_SIGN_STRONG.includes(name)){ bala += !rashiOdd ? 15 : 0; bala += !navamsaOdd ? 15 : 0; }
  return bala;
}
function getKendradiBala(house){
  const kendra = [1,4,7,10];
  const panapara = [2,5,8,11];
  if (kendra.includes(house)) return 60;
  if (panapara.includes(house)) return 30;
  return 15;
}
const MALE_PLANETS = ["Sun","Mars","Jupiter"];
const FEMALE_PLANETS = ["Moon","Venus"];
const NEUTER_PLANETS = ["Mercury","Saturn"];
function getDrekkanaBala(name, degInSign){
  const drekkanaIdx = Math.floor(degInSign/10);
  if (drekkanaIdx===0 && MALE_PLANETS.includes(name)) return 15;
  if (drekkanaIdx===1 && FEMALE_PLANETS.includes(name)) return 15;
  if (drekkanaIdx===2 && NEUTER_PLANETS.includes(name)) return 15;
  return 0;
}
const VARGA_DIGNITY_POINTS = { Moolatrikona: 45, OwnSign: 30, GreatFriend: 22.5, Friend: 15, Neutral: 7.5, Enemy: 3.75, GreatEnemy: 1.875 };
const SAPTAVARGA_KEYS = ["D1","D2","D3","D7","D9","D12","D30"];
function dignityStatusToVargaPoints(status){
  switch(status){
    case "Exalted": return VARGA_DIGNITY_POINTS.Moolatrikona;
    case "Moolatrikona": return VARGA_DIGNITY_POINTS.Moolatrikona;
    case "OwnSign": return VARGA_DIGNITY_POINTS.OwnSign;
    case "Friend": return VARGA_DIGNITY_POINTS.Friend;
    case "Neutral": return VARGA_DIGNITY_POINTS.Neutral;
    case "Enemy": return VARGA_DIGNITY_POINTS.Enemy;
    case "Debilitated": return VARGA_DIGNITY_POINTS.GreatEnemy;
    default: return VARGA_DIGNITY_POINTS.Neutral;
  }
}
function getSaptavargajaBala(vargaDignityStatuses){
  return vargaDignityStatuses.reduce((sum, status) => sum + dignityStatusToVargaPoints(status), 0);
}
function getNathonnataBala(name, hoursFromLocalMidnight){
  if (name === "Mercury") return 60;
  const DIURNAL = ["Sun","Jupiter","Venus"];
  let peakHour = DIURNAL.includes(name) ? 12 : 0;
  let dist = Math.abs(hoursFromLocalMidnight - peakHour);
  if (dist > 12) dist = 24 - dist;
  return 60 * (1 - dist/12);
}
function getPakshaBala(name, moonLon, sunLon){
  let sep = normDeg(moonLon - sunLon);
  const BENEFICS = ["Moon","Mercury","Jupiter","Venus"];
  const MALEFICS = ["Sun","Mars","Saturn"];
  let benefStrength = sep/180 * 60;
  if (sep > 180) benefStrength = (360-sep)/180 * 60;
  if (BENEFICS.includes(name)) return benefStrength;
  if (MALEFICS.includes(name)) return 60 - benefStrength;
  return 30;
}
function getTribhagaBala(name, hourFraction, isDaytime){
  const third = Math.floor(Math.min(0.9999, hourFraction)*3);
  if (isDaytime){
    if (third===0 && name==="Mercury") return 60;
    if (third===1 && name==="Sun") return 60;
    if (third===2 && name==="Saturn") return 60;
  } else {
    if (third===0 && name==="Moon") return 60;
    if (third===1 && name==="Venus") return 60;
    if (third===2 && name==="Mars") return 60;
  }
  if (name==="Jupiter") return 60;
  return 0;
}
function getVarshaMasaDinaHoraBala(name, yearLordName, monthLordName, dayLordName, horaLordName){
  let bala = 0;
  if (name === yearLordName) bala += 15;
  if (name === monthLordName) bala += 30;
  if (name === dayLordName) bala += 45;
  if (name === horaLordName) bala += 60;
  return bala;
}

const KALI_EPOCH_JDN = 588465;
const WEEKDAY_LORD_BY_INDEX = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
function getAhargana(julianDayNumber){ return Math.floor(julianDayNumber) - KALI_EPOCH_JDN; }
function getWeekdayLordFromAhargana(ahargana){
  const idx = ((ahargana + 4) % 7 + 7) % 7;
  return { index: idx, lord: WEEKDAY_LORD_BY_INDEX[idx] };
}
function getDinaLord(julianDayNumber){ return getWeekdayLordFromAhargana(getAhargana(julianDayNumber)).lord; }
function getVarshaLord(yearStartJDN){ return getWeekdayLordFromAhargana(getAhargana(yearStartJDN)).lord; }
function getMasaLord(monthStartJDN){ return getWeekdayLordFromAhargana(getAhargana(monthStartJDN)).lord; }
const CHALDEAN_SEQUENCE = ["Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars"];
function getHoraLord(weekdayIndex, jdAtBirth, sunriseJD, sunsetJD, nextSunriseJD){
  const dayLord = WEEKDAY_LORD_BY_INDEX[weekdayIndex];
  const startSeqIdx = CHALDEAN_SEQUENCE.indexOf(dayLord);
  let horaIndex;
  if (jdAtBirth >= sunriseJD && jdAtBirth < sunsetJD){
    const horaLength = (sunsetJD - sunriseJD) / 12;
    horaIndex = Math.floor((jdAtBirth - sunriseJD) / horaLength);
  } else {
    const horaLength = (nextSunriseJD - sunsetJD) / 12;
    const nightOffset = jdAtBirth >= sunsetJD ? (jdAtBirth - sunsetJD) : (jdAtBirth + 1 - sunsetJD);
    horaIndex = 12 + Math.floor(Math.max(0,nightOffset) / horaLength);
  }
  return CHALDEAN_SEQUENCE[(startSeqIdx + horaIndex) % 7];
}
function getAyanaBala(name, declinationDeg, isNorthern){
  if (name === "Mercury") return 60;
  const NORTHERN_STRONG = ["Sun","Mars","Jupiter","Venus"];
  const obliquity = 23.4333;
  const prefersNorthern = NORTHERN_STRONG.includes(name);
  const aligned = (isNorthern && prefersNorthern) || (!isNorthern && !prefersNorthern);
  const magnitude = Math.min(Math.abs(declinationDeg), obliquity);
  const bala = aligned ? 30 + (magnitude/obliquity)*30 : 30 - (magnitude/obliquity)*30;
  return Math.max(0, Math.min(60, bala));
}
function getDeclinationDeg(tropicalLongitudeDeg, obliquityDeg){
  const DEG2RAD = Math.PI/180, RAD2DEG = 180/Math.PI;
  const sinDecl = Math.sin(obliquityDeg*DEG2RAD) * Math.sin(tropicalLongitudeDeg*DEG2RAD);
  return Math.asin(sinDecl) * RAD2DEG;
}
function getKalaBala(components){
  const { nathonnata, paksha, tribhaga, vmdh, ayana, yuddha } = components;
  return nathonnata + paksha + tribhaga + vmdh + ayana + (yuddha||0);
}
const MEAN_DAILY_MOTION = { Mars:0.524, Mercury:1.383, Jupiter:0.0831, Venus:1.2, Saturn:0.0334 };
function getChestaBala(name, actualSpeed, sunAyanaBala, moonPakshaBala){
  if (name === "Sun") return sunAyanaBala;
  if (name === "Moon") return Math.min(60, moonPakshaBala * 2 / 2);
  const mean = MEAN_DAILY_MOTION[name];
  if (actualSpeed < 0){
    const ratio = Math.min(2, Math.abs(actualSpeed)/mean);
    return Math.min(60, 30 + ratio*15);
  } else {
    const ratio = Math.min(1, actualSpeed/mean);
    return Math.max(0, 30 - ratio*30) + (actualSpeed < mean*0.3 ? 15 : 0);
  }
}
const NATURAL_BENEFICS = ["Jupiter","Venus","Mercury","Moon"];
const NATURAL_MALEFICS = ["Sun","Mars","Saturn","Rahu","Ketu"];
function getDrikBalaContribution(aspectingPlanet, orbDegrees, maxOrb){
  const strength = Math.max(0, 30 * (1 - orbDegrees/maxOrb));
  const isBenefic = NATURAL_BENEFICS.includes(aspectingPlanet);
  return isBenefic ? strength : -strength;
}
const REQUIRED_RUPAS = { Sun:6.5, Moon:6, Mars:5, Mercury:7, Jupiter:6.5, Venus:5.5, Saturn:5 };

function findSunSignEntryBefore(beforeJD, targetSignIdx){
  let jd = beforeJD;
  let prevSign = getSignIndex(normDeg(sunLongitude(jd) - lahiriAyanamsa(jd)));
  for (let i=0; i<400; i++){
    const testJD = beforeJD - i;
    const sign = getSignIndex(normDeg(sunLongitude(testJD) - lahiriAyanamsa(testJD)));
    const prevTestSign = getSignIndex(normDeg(sunLongitude(testJD-1) - lahiriAyanamsa(testJD-1)));
    if (sign === targetSignIdx && prevTestSign !== targetSignIdx){
      let lo = testJD-1, hi = testJD;
      for (let iter=0; iter<30; iter++){
        const mid = (lo+hi)/2;
        const midSign = getSignIndex(normDeg(sunLongitude(mid) - lahiriAyanamsa(mid)));
        if (midSign === targetSignIdx) hi = mid; else lo = mid;
      }
      return hi;
    }
  }
  return beforeJD - 30;
}

function computeShadbala(siderealLongitudes, planets, ascSignIdx, jd, localJD, hourOfDayLocal, isDaytimeNow, sunriseJD, sunsetJD, nextSunriseJD, weekdayIndex){
  const results = {};
  const sunLon = siderealLongitudes.Sun;
  const moonLon = siderealLongitudes.Moon;
  const obliquity = obliquityOfEcliptic(jd);

  function ayanaBalaFor(name){
    const tropicalLon = normDeg(siderealLongitudes[name] + lahiriAyanamsa(jd));
    const decl = getDeclinationDeg(tropicalLon, obliquity);
    return getAyanaBala(name, decl, decl >= 0);
  }
  const sunAyana = ayanaBalaFor("Sun");
  const moonPaksha = getPakshaBala("Moon", moonLon, sunLon);

  const jdn = Math.floor(localJD + 0.5);
  const dinaLord = getDinaLord(jdn);
  const horaLord = getHoraLord(weekdayIndex, jd, sunriseJD, sunsetJD, nextSunriseJD);
  const yearStartJD = findSunSignEntryBefore(jd, 0);
  const currentSunSign = getSignIndex(sunLon);
  const monthStartJD = findSunSignEntryBefore(jd, currentSunSign);
  const varshaLord = getVarshaLord(Math.floor(yearStartJD+0.5));
  const masaLord = getMasaLord(Math.floor(monthStartJD+0.5));

  BALA_PLANETS.forEach(name=>{
    const p = planets[name];
    const signIdx = p.sign;
    const degInSign = p.degInSign;
    const house = p.house;

    const ex = EXALTATION[name];
    const uchcha = getUcchaBala(ex.sign, ex.deg, signIdx, degInSign);
    const vargaDignityStatuses = SAPTAVARGA_KEYS.map(vk=>{
      const vSign = calcVarga(vk, siderealLongitudes[name]);
      return getDignity(name, vSign, 15).status;
    });
    const saptavargaja = getSaptavargajaBala(vargaDignityStatuses);
    const navamsaSign = calcVarga("D9", siderealLongitudes[name]);
    const ojaYugma = getOjaYugmaBala(name, signIdx, navamsaSign);
    const kendradi = getKendradiBala(house);
    const drekkana = getDrekkanaBala(name, degInSign);
    const sthanaBala = uchcha + saptavargaja + ojaYugma + kendradi + drekkana;

    const digBala = getDigBala(name, house);

    const nathonnata = getNathonnataBala(name, hourOfDayLocal);
    const paksha = getPakshaBala(name, moonLon, sunLon);
    const hourFraction = isDaytimeNow
      ? (jd - sunriseJD) / (sunsetJD - sunriseJD)
      : (jd >= sunsetJD ? (jd - sunsetJD) : (jd + 1 - sunsetJD)) / (nextSunriseJD - sunsetJD);
    const tribhaga = getTribhagaBala(name, Math.max(0,Math.min(0.999,hourFraction)), isDaytimeNow);
    const vmdh = getVarshaMasaDinaHoraBala(name, varshaLord, masaLord, dinaLord, horaLord);
    const ayana = ayanaBalaFor(name);
    const kalaBala = getKalaBala({ nathonnata, paksha, tribhaga, vmdh, ayana, yuddha:0 });

    const chestaBala = getChestaBala(name, p.speed, sunAyana, moonPaksha);
    const naisargikaBala = getNaisargikaBala(name);

    let drikBala = 0;
    BALA_PLANETS.forEach(other=>{
      if (other===name) return;
      const sep = angDiffLocal(siderealLongitudes[other], siderealLongitudes[name]);
      const aspectAngles = [0,60,90,120,180];
      let minDist = 180;
      aspectAngles.forEach(a=>{ minDist = Math.min(minDist, Math.abs(sep-a)); });
      if (minDist <= 15){
        drikBala += getDrikBalaContribution(other, minDist, 15);
      }
    });

    const totalVirupas = sthanaBala + digBala + kalaBala + chestaBala + naisargikaBala + drikBala;
    const totalRupas = totalVirupas / 60;
    const requiredRupas = REQUIRED_RUPAS[name];

    results[name] = {
      sthanaBala: { total: sthanaBala, uchcha, saptavargaja, ojaYugma, kendradi, drekkana },
      digBala,
      kalaBala: { total: kalaBala, nathonnata, paksha, tribhaga, vmdh, ayana },
      chestaBala, naisargikaBala, drikBala,
      totalVirupas, totalRupas, requiredRupas,
      isStrong: totalRupas >= requiredRupas,
      percentOfRequired: (totalRupas/requiredRupas)*100
    };
  });

  return { planets: results, dinaLord, horaLord, varshaLord, masaLord };
}

function getSunriseSunsetJD(jd, lat, lon){
  // The old routine assumed `jd` was exactly 0h UT, so sunrise/sunset were wrong by hours for real birth instants.
  // Use the same refraction-corrected routine as the Panchang tab, for the solar-local day containing `jd`.
  const tzs = lon/15, ds = jdToLocalParts(jd, tzs).dateStr.split('-').map(Number);
  const rs = pnRiseSet(ds[0], ds[1], ds[2], lat, lon, tzs);
  if (rs.rise != null && rs.set != null) return { sunriseJD: rs.rise, sunsetJD: rs.set };
  return getSunriseSunsetApprox(jd, lat, lon);
}
function getSunriseSunsetApprox(jd, lat, lon){
  const DEG2RAD = Math.PI/180, RAD2DEG = 180/Math.PI;
  const noonJD = jd + 0.5 - lon/360; 
  const sunLon = sunLongitude(noonJD);
  const obliquity = obliquityOfEcliptic(noonJD);
  const decl = getDeclinationDeg(sunLon, obliquity);

  const latRad = lat*DEG2RAD, declRad = decl*DEG2RAD;
  const cosH = -Math.tan(latRad)*Math.tan(declRad);
  let H;
  if (cosH > 1){ H = 0; } 
  else if (cosH < -1){ H = 180; } 
  else { H = Math.acos(cosH) * RAD2DEG; }

  const hourAngleDays = H/360;
  const sunriseJD = noonJD - hourAngleDays;
  const sunsetJD = noonJD + hourAngleDays;
  return { sunriseJD, sunsetJD };
}

function computeChart(dateStr, timeStr, lat, lon, tzOffsetHours){
  const [year,month,day] = dateStr.split("-").map(Number);
  const [hour,minute,second] = timeStr.split(":").map(Number);
  const sec = second || 0;
  const localJD = toJulianDay(year,month,day,hour,minute,sec);
  const jd = localJD - tzOffsetHours/24;
  const ayanamsa = lahiriAyanamsa(jd);

  const tropicalLongitudes = {
    Sun: sunLongitude(jd), Moon: moonLongitude(jd),
    Mercury: planetGeocentricLongitude("mercury",jd), Venus: planetGeocentricLongitude("venus",jd),
    Mars: planetGeocentricLongitude("mars",jd), Jupiter: planetGeocentricLongitude("jupiter",jd),
    Saturn: planetGeocentricLongitude("saturn",jd)
  };
  const rahuTropical = rahuLongitude(jd);
  const siderealLongitudes = {};
  for (const p in tropicalLongitudes) siderealLongitudes[p] = normDeg(tropicalLongitudes[p]-ayanamsa);
  siderealLongitudes.Rahu = normDeg(rahuTropical-ayanamsa);
  siderealLongitudes.Ketu = normDeg(siderealLongitudes.Rahu+180);

  const retro = {
    Mercury:isRetrograde("mercury",jd), Venus:isRetrograde("venus",jd), Mars:isRetrograde("mars",jd),
    Jupiter:isRetrograde("jupiter",jd), Saturn:isRetrograde("saturn",jd),
    Sun:false, Moon:false, Rahu:true, Ketu:true
  };

  const ascTropical = ascendantLongitude(jd, lat, lon);
  const ascSidereal = normDeg(ascTropical-ayanamsa);
  const ascSignIdx = getSignIndex(ascSidereal);

  const planets = {};
  for (const name of PLANET_LIST){
    const l = siderealLongitudes[name];
    const signIdx = getSignIndex(l);
    const house = ((signIdx-ascSignIdx+12)%12)+1;
    const nak = getNakshatra(l);
    const dignity = getDignity(name, signIdx, getDegInSign(l));
    const combustion = getCombustion(name, l, siderealLongitudes.Sun, retro[name]);
    const degInSign = getDegInSign(l);
    const speed = getPlanetSpeed(name, jd);
    planets[name] = {
      name, longitude:l, sign:signIdx, degInSign, degRemainingInSign: 30-degInSign, house, nakshatra:nak,
      retrograde:retro[name], dignity, combustion, speed,
      aspectsHouses: getAspectedHouses(name, house)
    };
  }
  const wars = findPlanetaryWars(siderealLongitudes);
  wars.forEach(w=>{
    planets[w.planetA].war = { with:w.planetB, won: w.winner===w.planetA, separation:w.separation };
    planets[w.planetB].war = { with:w.planetA, won: w.winner===w.planetB, separation:w.separation };
  });

  const birthUTC = new Date(Date.UTC(year, month-1, day, hour, minute, sec) - tzOffsetHours*60*60*1000);
  const dashaData = calculateVimshottariDasha(siderealLongitudes.Moon, birthUTC);

  const yogas = {
    panchaMahapurusha: detectPanchaMahapurushaYogas(planets),
    gajaKesari: detectGajaKesariYoga(planets),
    rajaYogas: detectRajaYogas(planets, ascSignIdx),
    parivartana: detectParivartanaYogas(planets, ascSignIdx),
    viparitaRaja: detectViparitaRajaYoga(planets, ascSignIdx),
    neechaBhanga: detectNeechaBhanga(planets, ascSignIdx)
  };

  const ashtakavargaSignPositions = { Lagna: ascSignIdx };
  BAV_PLANETS.forEach(name=> ashtakavargaSignPositions[name] = planets[name].sign);
  const ashtakavarga = computeFullAshtakavarga(ashtakavargaSignPositions);

  const karakaDegrees = {};
  KARAKA_ELIGIBLE.forEach(name => karakaDegrees[name] = planets[name].degInSign);
  const charaKarakas = calculateCharaKarakas(karakaDegrees);

  const todaySunriseSunset = getSunriseSunsetJD(jd, lat, lon);
  const tomorrowSunriseSunset = getSunriseSunsetJD(jd+1, lat, lon);
  const isDaytimeNow = jd >= todaySunriseSunset.sunriseJD && jd < todaySunriseSunset.sunsetJD;
  const localHourFraction = ((jd + 0.5) % 1);
  const hourOfDayLocal = ((localHourFraction*24) + tzOffsetHours + 24) % 24;
  const weekdayIndex = (Math.floor(jd + 0.5 + tzOffsetHours/24) + 1) % 7; 

  const shadbala = computeShadbala(
    siderealLongitudes, planets, ascSignIdx, jd, localJD,
    hourOfDayLocal, isDaytimeNow,
    todaySunriseSunset.sunriseJD, todaySunriseSunset.sunsetJD, tomorrowSunriseSunset.sunriseJD,
    weekdayIndex
  );

  const vargaResults = {};
  for (const key in VARGAS){
    const ascVargaSign = calcVarga(key, ascSidereal);
    const planetVargaSign = {};
    PLANET_LIST.forEach(name=> planetVargaSign[name] = calcVarga(key, siderealLongitudes[name]));

    const houses = [];
    for (let h=1; h<=12; h++){
      const signIdx = (ascVargaSign + h - 1) % 12;
      const sign = SIGNS[signIdx];
      const planetsHere = PLANET_LIST.filter(name=> planetVargaSign[name]===signIdx).map(name=>({
        name, retrograde: retro[name],
        dignity: key==="D1" ? planets[name].dignity : getDignity(name, signIdx, 15)
      }));
      houses.push({
        houseNum: h, sign: signIdx, signName: sign.name, signSanskrit: sign.sk,
        signLord: sign.lord, signSymbol: sign.symbol, element: sign.element, modality: sign.modality,
        planets: planetsHere, isEmpty: planetsHere.length===0
      });
    }
    vargaResults[key] = { ascendantSign: ascVargaSign, houses, planetVargaSign };
  }
  const outer = {};
  OUTER_LIST.forEach(n=>{
    const k = n.toLowerCase(), l = normDeg(planetGeocentricLongitude(k,jd) - ayanamsa), sg = getSignIndex(l);
    const rx = isRetrograde(k,jd);
    outer[n] = { name:n, longitude:l, sign:sg, degInSign:getDegInSign(l), house:((sg-ascSignIdx+12)%12)+1, nakshatra:getNakshatra(l), retrograde:rx };
    for (const vk in vargaResults){ const V = vargaResults[vk]; (V.outerSign = V.outerSign || {})[n] = calcVarga(vk, l); (V.outerRx = V.outerRx || {})[n] = rx; }
  });

  return {
    julianDay: jd, ayanamsa, tzOffsetHours,
    sunriseJD: todaySunriseSunset.sunriseJD, sunsetJD: todaySunriseSunset.sunsetJD,
    prevSunsetJD: (function(){ const y = getSunriseSunsetJD(jd-1, lat, lon); return y.sunsetJD; })(),
    ascendant: { longitude: ascSidereal, sign: ascSignIdx, degInSign: getDegInSign(ascSidereal), nakshatra: getNakshatra(ascSidereal) },
    planets, outer, vargas: vargaResults, siderealLongitudes, wars, dashaData, yogas, ashtakavarga, charaKarakas, shadbala
  };
}

/* ============================================================================
   BIRTH TIME RECTIFICATION — lightweight per-second Ascendant/D60 scan.
   Computes only what shifts second-to-second (Ascendant + Moon sidereal
   longitude) rather than a full computeChart(), so hundreds/thousands of
   candidate seconds can be scanned interactively without recomputing all
   twenty divisional charts, Shadbala, dashas, etc. for every candidate.
   ============================================================================ */
function rectifyPoint(dateStr, timeStr, lat, lon, tzOffsetHours){
  const [year,month,day] = dateStr.split("-").map(Number);
  const [hour,minute,second] = timeStr.split(":").map(Number);
  const sec = second || 0;
  const localJD = toJulianDay(year,month,day,hour,minute,sec);
  const jd = localJD - tzOffsetHours/24;
  const ayanamsa = lahiriAyanamsa(jd);
  const ascSidereal = normDeg(ascendantLongitude(jd, lat, lon) - ayanamsa);
  const moonSidereal = normDeg(moonLongitude(jd) - ayanamsa);
  const ascD60Part = Math.floor(getDegInSign(ascSidereal)/0.5); // 0..59 -> amsa # within sign
  const moonD60Part = Math.floor(getDegInSign(moonSidereal)/0.5);
  return {
    dateStr, timeStr, jd,
    asc: { longitude: ascSidereal, sign: getSignIndex(ascSidereal), degInSign: getDegInSign(ascSidereal),
           nak: getNakshatra(ascSidereal), d60Sign: calcVarga("D60", ascSidereal), d60Amsa: ascD60Part+1 },
    moon: { longitude: moonSidereal, sign: getSignIndex(moonSidereal), degInSign: getDegInSign(moonSidereal),
            nak: getNakshatra(moonSidereal), d60Sign: calcVarga("D60", moonSidereal), d60Amsa: moonD60Part+1 }
  };
}

function shiftLocalDateTime(dateStr, timeStr, offsetSeconds){
  const [year,month,day] = dateStr.split("-").map(Number);
  const [hour,minute,second] = timeStr.split(":").map(Number);
  const base = new Date(Date.UTC(year, month-1, day, hour, minute, second||0));
  const t = new Date(base.getTime() + offsetSeconds*1000);
  const d2 = `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`;
  const t2 = `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}:${String(t.getUTCSeconds()).padStart(2,'0')}`;
  return { dateStr: d2, timeStr: t2 };
}

/* ============================================================================
   SPECIAL LAGNAS (UDAYA, ARUDHA PADAS, HORA, GHATI, INDU, SHREE, ETC.)
   ============================================================================
   Every "lagna" below resolves to a sidereal longitude (0-360). Once we have
   that longitude, it can be fed through the exact same varga-house pipeline
   used for the main Rashi/Divisional charts, so every one of these can be
   rendered as its own D1..D60 chart set.
*/
const ARUDHA_HOUSE_META = {
  AL:  { fromHouse: 1,  name: "Arudha Lagna",   sanskrit: "Pada Lagna",       desc: "Public image, perceived status, how the world sees you." },
  UL:  { fromHouse: 12, name: "Upapada Lagna",  sanskrit: "Gauna Pada / A7",  desc: "Marriage, spouse, and the nature of primary partnerships." },
  A2:  { fromHouse: 2,  name: "Dhana Pada",     sanskrit: "A2",               desc: "Perceived wealth, family resources, speech." },
  A3:  { fromHouse: 3,  name: "Bhatru Pada",    sanskrit: "A3",               desc: "Siblings, courage, effort, valor." },
  A4:  { fromHouse: 4,  name: "Matru Pada",     sanskrit: "A4",               desc: "Mother, home, property, inner comfort." },
  A5:  { fromHouse: 5,  name: "Mantra Pada",    sanskrit: "A5",               desc: "Intelligence, mantra, children, past-life merit." },
  A6:  { fromHouse: 6,  name: "Roga Pada",      sanskrit: "A6",               desc: "Disease, enemies, litigation, service." },
  A8:  { fromHouse: 8,  name: "Mrityu Pada",    sanskrit: "A8",               desc: "Longevity, transformation, sudden events." },
  A9:  { fromHouse: 9,  name: "Pitri Pada",     sanskrit: "A9",               desc: "Father, fortune, dharma, guru." },
  A10: { fromHouse: 10, name: "Rajya Pada",     sanskrit: "A10",              desc: "Career, public status, authority." },
  A11: { fromHouse: 11, name: "Labha Pada",     sanskrit: "A11",              desc: "Gains, income, elder siblings, aspirations." }
};

// Classical Arudha Pada algorithm (BPHS): count from the house to its lord's
// house, then count the same number of houses again from the lord's house.
// If the result would fall in the same house or the 7th from the house
// itself (i.e. the Pada would be identical to, or in opposition to, the
// house it represents), the CORRECTED rule (BPHS 29.4-29.5, cross-verified
// against multiple translations) is to take the 10th house FROM THAT
// INTERMEDIATE RESULT — i.e. add 9 signs (0-indexed), not 10.
function calcArudhaPadaSign(houseSignIdx, ascSignIdx, planets){
  const houseLordName = SIGNS[houseSignIdx].lord;
  const lordSignIdx = planets[houseLordName].sign;
  let distance = ((lordSignIdx - houseSignIdx + 12) % 12); // houses counted from the house to its lord (0-11)
  let padaSignIdx = (lordSignIdx + distance) % 12;
  // Check: is padaSignIdx the same as houseSignIdx (1st) or opposite (7th)?
  const diffFromHouse = ((padaSignIdx - houseSignIdx + 12) % 12); // 0 = same sign, 6 = opposite
  if (diffFromHouse === 0 || diffFromHouse === 6){
    padaSignIdx = (padaSignIdx + 9) % 12; // 10th FROM the intermediate result = +9 offset
  }
  return padaSignIdx;
}

function calcAllArudhaPadas(chart, ascSignIdx){
  const result = {};
  for (const key in ARUDHA_HOUSE_META){
    const meta = ARUDHA_HOUSE_META[key];
    const houseSignIdx = (ascSignIdx + meta.fromHouse - 1) % 12;
    result[key] = calcArudhaPadaSign(houseSignIdx, ascSignIdx, chart.planets);
  }
  return result;
}

// Sun's sidereal longitude at the most recent sunrise before birth (the anchor of Hora/Ghati/Bhava/Vighati lagnas).
// (Earlier these used the Sun's longitude AT BIRTH, which drifts up to ~1° from the sunrise position.)
function lastSunriseInfo(chart){
  let sr = chart.sunriseJD; if (chart.julianDay < sr) sr -= 1;
  return { jd: sr, sun: getSiderealLongitudeAt('Sun', sr) };
}
// Hora Lagna (BPHS Ch.5, cross-checked against multiple worked examples):
// starts at the Sun's longitude at sunrise and advances 1 full sign (30°)
// per 2.5 ghatis (= 1 hour) of elapsed time since the most recent sunrise.
// Computed at full degree precision, then reduced to a sign.
function calcHoraLagnaLongitude(chart){
  let elapsedDays = chart.julianDay - chart.sunriseJD;
  if (elapsedDays < 0) elapsedDays += 1; // birth was before today's sunrise -> measure from previous sunrise
  const elapsedGhatis = elapsedDays * 60; // 60 ghatis in a full day
  const degreesTravelled = (elapsedGhatis / 2.5) * 30; // 1 rashi (30°) per 2.5 ghatis
  return normDeg(lastSunriseInfo(chart).sun + degreesTravelled);
}
function calcHoraLagnaSign(chart){
  return getSignIndex(calcHoraLagnaLongitude(chart));
}

// Ghati Lagna (BPHS Ch.5): starts at the SUN'S longitude at sunrise (not the
// Ascendant) and advances 1 full sign (30°) per ghati (24 min) elapsed since
// the most recent sunrise.
function calcGhatiLagnaLongitude(chart){
  let elapsedDays = chart.julianDay - chart.sunriseJD;
  if (elapsedDays < 0) elapsedDays += 1;
  const elapsedGhatis = elapsedDays * 60;
  const degreesTravelled = elapsedGhatis * 30; // 1 rashi (30°) per ghati
  return normDeg(lastSunriseInfo(chart).sun + degreesTravelled);
}
function calcGhatiLagnaSign(chart){
  return getSignIndex(calcGhatiLagnaLongitude(chart));
}

// Varnada Lagna (BPHS + cross-verified worked examples from multiple Jaimini
// sources): for the Lagna and separately for the Hora Lagna, count signs
// directly from Aries if the sign is odd, or in reverse from Pisces if the
// sign is even. If both counts share the same odd/even parity, add them;
// otherwise take their absolute difference (treating a result of 0 as 12).
// Reduce that total to the 1-12 range, then count it out from Aries (if the
// natal Lagna is odd) or in reverse from Pisces (if the natal Lagna is even).
function countFromAriesOrPisces(signIdx){
  const oneIndexed = signIdx + 1;
  const isOdd = (oneIndexed % 2) === 1;
  return isOdd ? oneIndexed : (12 - signIdx);
}
function calcVarnadaLagnaSign(ascSignIdx, horaSignIdx){
  const nLagna = countFromAriesOrPisces(ascSignIdx);
  const nHora = countFromAriesOrPisces(horaSignIdx);
  const lagnaOdd = (ascSignIdx % 2) === 0; // 0-indexed even sign == 1-indexed odd sign
  const horaOdd = (horaSignIdx % 2) === 0;
  let result;
  if (lagnaOdd === horaOdd){
    result = nLagna + nHora;
  } else {
    result = Math.abs(nLagna - nHora);
    if (result === 0) result = 12;
  }
  result = result % 12;
  if (result === 0) result = 12;
  return lagnaOdd ? (result - 1) % 12 : (12 - result) % 12;
}

// Indu Lagna: uses the "Kalas" assigned to the lord of the 9th house counted
// from the Moon, and the lord of the 9th house counted from the Lagna. Their
// Kala values are added; the sum (reduced mod 12, with 0 treated as 12) is
// counted forward from the Moon's own sign (Moon's sign = count 1).
const INDU_LAGNA_KALAS = { Sun:30, Moon:16, Mars:6, Mercury:8, Jupiter:10, Venus:12, Saturn:1 };
function calcInduLagnaSign(chart, ascSignIdx){
  const moonSignIdx = getSignIndex(chart.siderealLongitudes.Moon);
  const ninthFromMoonSignIdx = (moonSignIdx + 8) % 12;
  const ninthFromLagnaSignIdx = (ascSignIdx + 8) % 12;
  const lordOfNinthFromMoon = SIGNS[ninthFromMoonSignIdx].lord;
  const lordOfNinthFromLagna = SIGNS[ninthFromLagnaSignIdx].lord;
  const totalKalas = (INDU_LAGNA_KALAS[lordOfNinthFromMoon] || 0) + (INDU_LAGNA_KALAS[lordOfNinthFromLagna] || 0);
  let remainder = totalKalas % 12;
  if (remainder === 0) remainder = 12;
  return (moonSignIdx + remainder - 1) % 12;
}

// Shree Lagna: the fraction of the Moon's current Nakshatra already crossed
// is scaled across the full 360° zodiac and added to the Ascendant's exact
// longitude (not merely its sign — precision matters near sign boundaries).
function calcShreeLagnaLongitude(chart){
  const moonLon = chart.siderealLongitudes.Moon;
  const nakSpanDeg = 360/27;
  const posInNak = normDeg(moonLon) % nakSpanDeg;
  const fraction = posInNak / nakSpanDeg; // 0..1 through the current nakshatra
  const mappedDeg = fraction * 360; // stretched across a full sign-wheel
  return normDeg(chart.ascendant.longitude + mappedDeg);
}
function calcShreeLagnaSign(chart){
  return getSignIndex(calcShreeLagnaLongitude(chart));
}

// Pranapada Lagna (BPHS Ch.6 v.71-74, verified against the text's own three
// worked examples): time elapsed since the most recent sunrise, in vighatis,
// is converted at 2° per vighati (i.e. divide by 15 to get rashis directly)
// and added to the SUN'S OWN LONGITUDE. If the Sun is in a fixed sign, add a
// further 240°; if in a dual sign, add a further 120° (movable signs: no
// further addition).
function calcPranapadaLagnaLongitude(chart){
  const sunLon = chart.siderealLongitudes.Sun;
  const sunSignIdx = getSignIndex(sunLon);
  let elapsedDays = chart.julianDay - chart.sunriseJD;
  if (elapsedDays < 0) elapsedDays += 1;
  const elapsedVighatis = elapsedDays * 3600; // 1 day = 60 ghatis * 60 vighatis = 3600 vighatis
  const xDeg = normDeg(elapsedVighatis * 2); // 30 deg per 15 vighatis = 2 deg/vighati
  const modality = sunSignIdx % 3; // 0 = movable, 1 = fixed, 2 = dual
  let offsetDeg = 0;
  if (modality === 1) offsetDeg = 240;
  else if (modality === 2) offsetDeg = 120;
  return normDeg(sunLon + xDeg + offsetDeg);
}
function calcPranapadaLagnaSign(chart){
  return getSignIndex(calcPranapadaLagnaLongitude(chart));
}

// Karakamsha Lagna: the Navamsa (D9) sign occupied by the Atmakaraka planet
// (the planet with the highest degree among the 7 classical grahas).
function calcKarakamshaSign(chart){
  const atmakaraka = chart.charaKarakas.Atmakaraka.planet;
  return chart.vargas.D9.planetVargaSign[atmakaraka];
}

// Swamsha Lagna (Lagnamsa): the Navamsa chart's own Ascendant (the D9 Lagna
// sign) — distinct from the Karakamsha (the Atmakaraka's D9 sign). Classical
// texts group both under the umbrella term "Svamsa" when a shared rule
// applies to them, but as a standalone point Swamsha = the D9 Lagna itself.
function calcSwamshaLagnaSign(chart){
  return chart.vargas.D9.ascendantSign;
}

// Padanadhamsa Lagna (per Jaimini Sutramritam / Krishna Mishra's Phaladeepika
// Ratnamala, and multiple cross-checked commentaries): the Navamsa (D9) sign
// occupied by the LORD of the Arudha Lagna (AL) — i.e. find AL in the Rashi
// chart, find its ruling planet, and see which sign that planet falls in
// within the D9 chart.
function calcPadanadhamsaLagnaSign(chart, alSignIdx){
  const alLord = SIGNS[alSignIdx].lord;
  return chart.vargas.D9.planetVargaSign[alLord];
}

// Bhava Lagna (BPHS Ch.5, same family as Hora/Ghati Lagna): starts at the
// Sun's longitude at sunrise and advances 1 full sign (30°) per 5 ghatis
// (2 hours) elapsed since the most recent sunrise — this is the slowest of
// the three "sunrise-anchored" special lagnas, moving at roughly the same
// average pace as the true Ascendant itself.
function calcBhavaLagnaLongitude(chart){
  let elapsedDays = chart.julianDay - chart.sunriseJD;
  if (elapsedDays < 0) elapsedDays += 1;
  const elapsedGhatis = elapsedDays * 60;
  const degreesTravelled = (elapsedGhatis / 5) * 30; // 1 rashi (30°) per 5 ghatis
  return normDeg(lastSunriseInfo(chart).sun + degreesTravelled);
}
function calcBhavaLagnaSign(chart){
  return getSignIndex(calcBhavaLagnaLongitude(chart));
}

// Vighati Lagna: the fourth and fastest member of the sunrise-anchored
// family (Bhava: 5 ghati/rashi, Hora: 2.5 ghati/rashi, Ghati: 1 ghati/rashi),
// completing the same "1 rashi per unit" pattern one level finer — 1 full
// sign (30°) per Vighati (24 seconds) elapsed since the most recent sunrise.
// This makes it extremely time-sensitive, useful chiefly for disambiguating
// near-simultaneous births (classically invoked before resorting to D-60).
function calcVighatiLagnaLongitude(chart){
  let elapsedDays = chart.julianDay - chart.sunriseJD;
  if (elapsedDays < 0) elapsedDays += 1;
  const elapsedVighatis = elapsedDays * 3600; // 1 day = 3600 vighatis
  const degreesTravelled = elapsedVighatis * 30; // 1 rashi (30°) per vighati
  return normDeg(lastSunriseInfo(chart).sun + degreesTravelled);
}
function calcVighatiLagnaSign(chart){
  return getSignIndex(calcVighatiLagnaLongitude(chart));
}

// Bhrigu Bindu (Rahu-Moon midpoint / "destiny point"): the point exactly
// midway between the Moon and Rahu along the SHORTER arc between them.
function calcBhriguBinduLongitude(chart){
  const moonLon = chart.siderealLongitudes.Moon;
  const rahuLon = chart.siderealLongitudes.Rahu;
  const gap = normDeg(rahuLon - moonLon); // 0-360, moving from Moon to Rahu
  let midpoint = normDeg((moonLon + rahuLon) / 2);
  if (gap > 180) midpoint = normDeg(midpoint + 180); // flip to the shorter arc
  return midpoint;
}
function calcBhriguBinduSign(chart){
  return getSignIndex(calcBhriguBinduLongitude(chart));
}

// Paka Lagna ("ripening" ascendant): simply the sign occupied by the Lagna
// Lord (the ruler of the natal Ascendant) — shows what a person actually
// gravitates toward, versus the raw potential shown by the Lagna itself.
function calcPakaLagnaSign(chart, ascSignIdx){
  const lagnaLord = SIGNS[ascSignIdx].lord;
  return chart.planets[lagnaLord].sign;
}

const SPECIAL_LAGNAS_META = {
  UL_LAGNA:   { key:"UL_LAGNA",   name:"Udaya Lagna",        sanskrit:"Lagna / Ascendant",  group:"core",   desc:"The Ascendant itself — physical body, personality, overall life direction." },
  AL:         { key:"AL",         name:"Arudha Lagna",       sanskrit:"AL / Pada Lagna",    group:"arudha", desc: ARUDHA_HOUSE_META.AL.desc },
  KL:         { key:"KL",         name:"Karakamsha Lagna",   sanskrit:"KL",                 group:"karaka", desc:"The Navamsa sign of the Atmakaraka — soul purpose and spiritual identity." },
  UL:         { key:"UL",         name:"Upapada Lagna",      sanskrit:"UL / Gauna Pada / A7",group:"arudha",desc: ARUDHA_HOUSE_META.UL.desc },
  HL:         { key:"HL",         name:"Hora Lagna",         sanskrit:"HL",                 group:"kala",   desc:"Wealth and resource flow, based on elapsed time since sunrise." },
  GL:         { key:"GL",         name:"Ghati Lagna",        sanskrit:"GL",                 group:"kala",   desc:"Fame, honors, and government favor, based on elapsed time since sunrise." },
  BL:         { key:"BL",         name:"Bhava Lagna",        sanskrit:"BL",                 group:"kala",   desc:"General nature, mentality, and physical/mental constitution — the slowest of the sunrise-anchored lagnas." },
  VGL:        { key:"VGL",        name:"Vighati Lagna",      sanskrit:"VGL / Pal Lagna",    group:"kala",   desc:"An extremely fine-grained timing point, classically used to distinguish near-simultaneous births (e.g. twins)." },
  VL:         { key:"VL",         name:"Varnada Lagna",      sanskrit:"VL",                 group:"kala",   desc:"Social standing, class, and reputation." },
  INDU:       { key:"INDU",       name:"Indu Lagna",         sanskrit:"Indu Lagna",         group:"karaka", desc:"Financial prosperity and accumulated wealth (a special money-point)." },
  SL:         { key:"SL",         name:"Shree Lagna",        sanskrit:"SL",                 group:"karaka", desc:"General auspiciousness, prosperity, and good fortune." },
  PRANAPADA:  { key:"PRANAPADA",  name:"Pranapada Lagna",    sanskrit:"Pranapada",          group:"kala",   desc:"Vitality, life-force, and how one meets fated events." },
  SWAMSHA:    { key:"SWAMSHA",    name:"Swamsha Lagna",      sanskrit:"Swamsha / Lagnamsa", group:"karaka", desc:"The Navamsa chart's own Ascendant (Lagnamsa) — inner self and dharmic path, distinct from the Karakamsha." },
  PADANADHAMSA:{key:"PADANADHAMSA",name:"Padanadhamsa Lagna",sanskrit:"Padanadhamsa",       group:"arudha", desc:"The Navamsa sign of the Arudha Lagna's own lord — a refinement of public image at the soul-division level." },
  BB:         { key:"BB",         name:"Bhrigu Bindu",       sanskrit:"BB / Destiny Point", group:"karaka", desc:"The midpoint of Moon and Rahu — a sensitive karmic 'destiny point' activated by transits and dashas." },
  PAKA:       { key:"PAKA",       name:"Paka Lagna",         sanskrit:"Paka Lagna",         group:"arudha", desc:"The sign occupied by the Lagna Lord — what a person actually gravitates toward, versus raw Lagna potential." },
  CHANDRA:    { key:"CHANDRA",    name:"Chandra Lagna",      sanskrit:"Moon Sign",          group:"core",   desc:"The Moon's own sign, used as an alternate ascendant for mind and emotion." },
  SURYA:      { key:"SURYA",      name:"Surya Lagna",        sanskrit:"Sun Sign",           group:"core",   desc:"The Sun's own sign, used as an alternate ascendant for soul and vitality." },
  A2:         { key:"A2",         name:"Dhana Pada",         sanskrit:"A2",                 group:"arudha", desc: ARUDHA_HOUSE_META.A2.desc },
  A3:         { key:"A3",         name:"Bhatru Pada",        sanskrit:"A3",                 group:"arudha", desc: ARUDHA_HOUSE_META.A3.desc },
  A4:         { key:"A4",         name:"Matru Pada",         sanskrit:"A4",                 group:"arudha", desc: ARUDHA_HOUSE_META.A4.desc },
  A5:         { key:"A5",         name:"Mantra Pada",        sanskrit:"A5",                 group:"arudha", desc: ARUDHA_HOUSE_META.A5.desc },
  A6:         { key:"A6",         name:"Roga Pada",          sanskrit:"A6",                 group:"arudha", desc: ARUDHA_HOUSE_META.A6.desc },
  A8:         { key:"A8",         name:"Mrityu Pada",        sanskrit:"A8",                 group:"arudha", desc: ARUDHA_HOUSE_META.A8.desc },
  A9:         { key:"A9",         name:"Pitri Pada",         sanskrit:"A9",                 group:"arudha", desc: ARUDHA_HOUSE_META.A9.desc },
  A10:        { key:"A10",        name:"Rajya Pada",         sanskrit:"A10",                group:"arudha", desc: ARUDHA_HOUSE_META.A10.desc },
  A11:        { key:"A11",        name:"Labha Pada",         sanskrit:"A11",                group:"arudha", desc: ARUDHA_HOUSE_META.A11.desc }
};
const SPECIAL_LAGNAS_ORDER = ["UL_LAGNA","AL","KL","UL","HL","GL","BL","VGL","VL","INDU","SL","PRANAPADA","SWAMSHA","PADANADHAMSA","BB","PAKA","CHANDRA","SURYA","A2","A3","A4","A5","A6","A8","A9","A10","A11"];

// Computes the sign index (0-11, Aries=0) for every special lagna.
function computeAllSpecialLagnaSigns(chart){
  const ascSignIdx = chart.ascendant.sign;
  const arudhaPadas = calcAllArudhaPadas(chart, ascSignIdx);
  const horaSignIdx = calcHoraLagnaSign(chart);

  const signs = {
    UL_LAGNA: ascSignIdx,
    AL: arudhaPadas.AL,
    KL: calcKarakamshaSign(chart),
    UL: arudhaPadas.UL,
    HL: horaSignIdx,
    GL: calcGhatiLagnaSign(chart),
    BL: calcBhavaLagnaSign(chart),
    VGL: calcVighatiLagnaSign(chart),
    VL: calcVarnadaLagnaSign(ascSignIdx, horaSignIdx),
    INDU: calcInduLagnaSign(chart, ascSignIdx),
    SL: calcShreeLagnaSign(chart),
    PRANAPADA: calcPranapadaLagnaSign(chart),
    SWAMSHA: calcSwamshaLagnaSign(chart),
    PADANADHAMSA: calcPadanadhamsaLagnaSign(chart, arudhaPadas.AL),
    BB: calcBhriguBinduSign(chart),
    PAKA: calcPakaLagnaSign(chart, ascSignIdx),
    CHANDRA: getSignIndex(chart.siderealLongitudes.Moon),
    SURYA: getSignIndex(chart.siderealLongitudes.Sun),
    A2: arudhaPadas.A2, A3: arudhaPadas.A3, A4: arudhaPadas.A4, A5: arudhaPadas.A5,
    A6: arudhaPadas.A6, A8: arudhaPadas.A8, A9: arudhaPadas.A9, A10: arudhaPadas.A10, A11: arudhaPadas.A11
  };
  return signs;
}

// Builds a full varga-shaped dataset (ascendantSign, houses, planetVargaSign)
// for a chosen special lagna acting as the new Ascendant, for a given
// divisional chart (D1..D60). Planets keep their own divisional placement;
// only the reference point (Lagna) changes, exactly as classical Jyotish
// treats these special points as alternate ascendants for house-counting.
function buildVargaFromLagna(chart, lagnaSignIdx, vargaKey){
  const planetVargaSign = {};
  PLANET_LIST.forEach(name => {
    planetVargaSign[name] = chart.vargas[vargaKey].planetVargaSign[name];
  });
  const houses = [];
  for (let h=1; h<=12; h++){
    const signIdx = (lagnaSignIdx + h - 1) % 12;
    const sign = SIGNS[signIdx];
    const planetsHere = PLANET_LIST.filter(name => planetVargaSign[name] === signIdx).map(name => ({
      name, retrograde: chart.planets[name].retrograde,
      dignity: vargaKey === "D1" ? chart.planets[name].dignity : getDignity(name, signIdx, 15)
    }));
    houses.push({
      houseNum: h, sign: signIdx, signName: sign.name, signSanskrit: sign.sk,
      signLord: sign.lord, signSymbol: sign.symbol, element: sign.element, modality: sign.modality,
      planets: planetsHere, isEmpty: planetsHere.length === 0
    });
  }
  const V0 = chart.vargas[vargaKey];
  return { ascendantSign: lagnaSignIdx, houses, planetVargaSign, outerSign: V0.outerSign, outerRx: V0.outerRx };
}

// Plain-text render of one lagna's chart (for a chosen divisional chart) —
// used by the "Copy Current Chart" button in the Lagnas tab.
function lagnaChartToPlainText(chart, lagnaKey, vargaKey, vdata, aspectRows){
  const lagnaMeta = SPECIAL_LAGNAS_META[lagnaKey];
  const vargaMeta = VARGAS[vargaKey];
  const ascSign = SIGNS[vdata.ascendantSign];
  let out = `${lagnaMeta.name} (${lagnaMeta.sanskrit}) — ${vargaKey} ${vargaMeta.name}\n`;
  out += '='.repeat(60) + '\n';
  out += `${lagnaMeta.desc}\n`;
  out += `Ascendant (this Lagna): ${ascSign.name} (${ascSign.sk})\n\n`;
  out += `HOUSES\n${'-'.repeat(60)}\n`;
  vdata.houses.forEach(h => {
    const occupants = h.isEmpty ? 'Empty' : h.planets.map(p => `${p.name}${p.retrograde ? ' (R)' : ''}`).join(', ');
    out += `H${h.houseNum} — ${h.signName} (${h.signSanskrit}), Lord: ${h.signLord} :: ${occupants}\n`;
  });
  if (aspectRows){
    out += `\n${aspectRowsToPlainText(aspectRows, `${lagnaKey} · ${vargaKey}`)}`;
  }
  return out;
}

// Plain-text render of ALL 23 special lagnas at once (their sign placements
// and a full D1 house breakdown for each) — used by "Copy All Lagnas".
function allLagnasToPlainText(chart, specialLagnaSigns, vargaKey){
  const vargaMeta = VARGAS[vargaKey];
  let out = `SPECIAL LAGNAS — FULL EXPORT (cast on ${vargaKey} ${vargaMeta.name})\n`;
  out += '='.repeat(70) + '\n\n';
  const groupLabels = { core: "Core Ascendants", arudha: "Arudha Padas", karaka: "Karaka-Based", kala: "Time-Based (Kala)" };
  ["core","arudha","karaka","kala"].forEach(group => {
    out += `${groupLabels[group].toUpperCase()}\n${'-'.repeat(70)}\n`;
    SPECIAL_LAGNAS_ORDER.filter(k => SPECIAL_LAGNAS_META[k].group === group).forEach(key => {
      const meta = SPECIAL_LAGNAS_META[key];
      const signIdx = specialLagnaSigns[key];
      const sign = SIGNS[signIdx];
      out += `\n${meta.name} (${meta.sanskrit}): ${sign.name} (${sign.sk})\n`;
      out += `  ${meta.desc}\n`;
      const vdata = buildVargaFromLagna(chart, signIdx, vargaKey);
      vdata.houses.forEach(h => {
        if (h.isEmpty) return;
        const occupants = h.planets.map(p => `${p.name}${p.retrograde ? ' (R)' : ''}`).join(', ');
        out += `    H${h.houseNum} ${h.signName}: ${occupants}\n`;
      });
    });
    out += '\n';
  });
  return out;
}

/* ============================================================================
   UI & DOM LOGIC
   ============================================================================ */
const TZ_OPTIONS = [-12,-11,-10,-9.5,-9,-8,-7,-6,-5,-4.5,-4,-3.5,-3,-2,-1,0,1,2,3,3.5,4,4.5,5,5.5,5.75,6,6.5,7,8,8.75,9,9.5,10,10.5,11,12,12.75,13,14];
function fmtTz(v){
  const sign = v>=0?"+":"-";
  const abs = Math.abs(v);
  const h = Math.floor(abs);
  const m = Math.round((abs-h)*60);
  return `UTC${sign}${h}${m?":"+String(m).padStart(2,"0"):":00"}`;
}
function populateTz(){
  const sel = document.getElementById('tzInput');
  sel.innerHTML = "";
  TZ_OPTIONS.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = fmtTz(v);
    if (v===5.5) opt.selected = true;
    sel.appendChild(opt);
  });
}

let selectedLat=null, selectedLon=null, tzAutoGuess=null;
let searchDebounce=null;
const placeInput = document.getElementById('placeInput');
const locationResults = document.getElementById('locationResults');
const locationStatus = document.getElementById('locationStatus');
const coordReadout = document.getElementById('coordReadout');

placeInput.addEventListener('input', ()=>{
  const q = placeInput.value.trim();
  selectedLat = null; selectedLon = null;
  coordReadout.textContent = "— not yet selected —";
  clearTimeout(searchDebounce);
  if (q.length < 3){ locationResults.classList.remove('open'); locationResults.innerHTML=""; return; }
  locationStatus.textContent = "Searching…";
  // Increased debounce to 1000ms to enforce 1 req/sec limit
  searchDebounce = setTimeout(()=> doLocationSearch(q), 1000);
});

async function doLocationSearch(q){
  try{
    const appEmail = "contact@yourdomain.com"; // Replace with your actual email
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7&q=${encodeURIComponent(q)}&email=${appEmail}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    renderLocationResults(data);
    locationStatus.textContent = data.length ? "" : "No matches found — try a broader search";
  } catch(err){
    locationStatus.textContent = "Location search unavailable right now — you can still enter coordinates manually below.";
    locationResults.classList.remove('open');
  }
}

function renderLocationResults(results){
  locationResults.innerHTML = "";
  if (!results.length){ locationResults.classList.remove('open'); return; }
  results.forEach(r=>{
    const div = document.createElement('div');
    div.className = 'location-item';
    const main = r.display_name.split(',')[0];
    div.innerHTML = `<span class="lname">${main}</span><span class="lsub">${r.display_name}</span>`;
    div.addEventListener('click', ()=> selectLocation(r));
    locationResults.appendChild(div);
  });
  locationResults.classList.add('open');
}

function selectLocation(r){
  placeInput.value = r.display_name;
  selectedLat = parseFloat(r.lat);
  selectedLon = parseFloat(r.lon);
  coordReadout.textContent = `${selectedLat.toFixed(4)}°, ${selectedLon.toFixed(4)}°`;
  locationResults.classList.remove('open');
  locationStatus.textContent = "";
  guessTimezone(selectedLat, selectedLon, r);
}


/* Map + coordinates pickers (shared popup hosted by the outer page) */
try{ if (window.parent && window.parent!==window && window.parent.LocPicker) window.parent.LocPicker.attach(document, placeInput, r=>selectLocation(r), {title:'Place of birth', get:()=> selectedLat!=null ? {lat:selectedLat, lon:selectedLon} : null}); }catch(e){}

/* Accurate timezone guess: country rule first (fixes +5:30 India etc.), then longitude */
const TZ_BY_COUNTRY={in:5.5,lk:5.5,np:5.75,ir:3.5,af:4.5,mm:6.5,bd:6,pk:5,bt:6,mv:5,uz:5,cn:8,sg:8,my:8,ph:8,hk:8,tw:8,kr:9,jp:9,th:7,vn:7,kh:7,la:7,nz:12,ae:4,om:4,sa:3,qa:3,kw:3,bh:3,ye:3,iq:3,tr:3,eg:2,ke:3,et:3,tz:3,ug:3,za:2,ng:1,gh:0,gb:0,ie:0,pt:0,is:0};
function estimateTz(lat, lon, r){
  const cc = r && r.address && r.address.country_code ? r.address.country_code.toLowerCase() : '';
  let tz;
  if (cc === 'au') tz = lon < 129 ? 8 : (lon < 138 ? 9.5 : 10);
  else if (cc in TZ_BY_COUNTRY) tz = TZ_BY_COUNTRY[cc];
  else tz = Math.round(lon/15);           // whole hours only; no more half-hour rounding errors
  return TZ_OPTIONS.reduce((a,b)=> Math.abs(b-tz)<Math.abs(a-tz)?b:a);
}
function setTzSelect(sel, v){ [...sel.options].forEach(o=>{ o.selected = (parseFloat(o.value)===v); }); }
function guessTimezone(lat, lon, r){
  const closest = estimateTz(lat, lon, r);
  setTzSelect(document.getElementById('tzInput'), closest);
  document.getElementById('tzHint').textContent = `Estimated from longitude — please verify against local records`;
}

document.addEventListener('click', (e)=>{
  if (!e.target.closest('.location-wrap')) locationResults.classList.remove('open');
});

const STORAGE_KEY = 'Vedic Astrology_profiles_v1';
function loadProfiles(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }catch(e){ return []; } }
function saveProfiles(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
function refreshProfileSelect(){
  const profiles = loadProfiles();
  const sel = document.getElementById('profileSelect');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">— Select a profile —</option>';
  profiles.forEach((p,i)=>{
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
}

let currentChartForModal = null; 
let currentProfileForExport = null; 

/* ===== Planets panel + detail popup (redesigned) ===== */
function plDigInfo(pl){
  const st = pl.dignity.status;
  const good = st==='Exalted'||st==='OwnSign'||st==='Moolatrikona', bad = st==='Debilitated';
  return {good, bad, cls: good?'good':bad?'bad':''};
}
function buildPlanetsPanel(chart){
  let nRetro=0,nStrong=0,nChall=0;
  const cards = PLANET_LIST.map(name=>{
    const pl = chart.planets[name], sg = SIGNS[pl.sign], d = plDigInfo(pl), c = DASHA_PLANET_COLORS[name]||'#888';
    const combust = pl.combustion && pl.combustion.combust, warLose = pl.war && !pl.war.won;
    const flags = [];
    if (pl.retrograde){ flags.push('retro'); nRetro++; }
    if (d.good){ flags.push('strong'); nStrong++; }
    if (d.bad || combust || warLose){ flags.push('chall'); nChall++; }
    const tags = [
      d.cls ? `<span class="pl-tag ${d.cls}">${pl.dignity.label}</span>` : (pl.dignity.label && pl.dignity.label!=='—' ? `<span class="pl-tag">${pl.dignity.label}</span>` : ''),
      combust ? `<span class="pl-tag bad">Combust ${pl.combustion.separation.toFixed(1)}°</span>` : '',
      pl.war ? `<span class="pl-tag ${pl.war.won?'good':'bad'}">${pl.war.won?'Wins':'Loses'} vs ${pl.war.with}</span>` : ''
    ].join('');
    return `<button type="button" class="pl-card" data-planet-click="${name}" data-flags="${flags.join(' ')}" style="--pc:${c}">
      <span class="pl-top"><span class="pl-dot" style="background:${c}">${PLANET_GLYPHS[name]}</span>
        <span class="pl-name"><b>${name}${pl.retrograde?' <em>℞</em>':''}</b><small>${pl.nakshatra.name} · Pada ${pl.nakshatra.pada}</small></span>
        <span class="pl-house">H${pl.house}</span></span>
      <span class="pl-sign">${sg.symbol} ${sg.name}<em>${formatDeg(pl.degInSign)}</em></span>
      <span class="pl-track"><i style="width:${(pl.degInSign/30*100).toFixed(1)}%"></i></span>
      <span class="pl-tags">${tags}</span>
    </button>`;
  }).join('');

  const outerCards = OUTER_LIST.map(n=>{
    const o = chart.outer[n], sg = SIGNS[o.sign], c = OUTER_COL[n];
    return `<button type="button" class="pl-card" data-planet-click="${n}" data-flags="outer" style="--pc:${c}">
      <span class="pl-top"><span class="pl-dot" style="background:${c}">${OUTER_GLYPHS[n]}</span>
        <span class="pl-name"><b>${n}${o.retrograde?' <em>℞</em>':''}</b><small>${o.nakshatra.name} · Pada ${o.nakshatra.pada}</small></span>
        <span class="pl-house">H${o.house}</span></span>
      <span class="pl-sign">${sg.symbol} ${sg.name}<em>${formatDeg(o.degInSign)}</em></span>
      <span class="pl-track"><i style="width:${(o.degInSign/30*100).toFixed(1)}%"></i></span>
      <span class="pl-tags"><span class="pl-tag">${OUTER_INFO[n].role}</span></span></button>`;
  }).join('');
  const outerAsp = OUTER_LIST.map(n=>{
    const o = chart.outer[n], tg = PLANET_LIST.map(x=>[x, chart.planets[x].longitude]).concat(OUTER_LIST.map(x=>[x, chart.outer[x].longitude])).concat([['Ascendant', chart.ascendant.longitude]]);
    const a = outerAspectsTo(o.longitude, tg, n).map(r=>`<span class="pl-asp">${r.asp.symbol} ${r.target} ${r.dev.toFixed(1)}°</span>`).join('') || '<span class="pl-asp">no close aspects</span>';
    return `<div class="pl-arow" data-planet-click="${n}"><span class="pl-dot sm" style="background:${OUTER_COL[n]}">${OUTER_GLYPHS[n]}</span><span class="pl-an"><b>${n}</b><small>in House ${o.house}</small></span><span class="pl-achips">${a}</span></div>`;
  }).join('');

  const asp = PLANET_LIST.map(name=>{
    const pl = chart.planets[name], c = DASHA_PLANET_COLORS[name]||'#888';
    const chips = pl.aspectsHouses.map(h=>`<span class="pl-asp">H${h} ${SIGNS[(chart.ascendant.sign+h-1)%12].symbol}</span>`).join('');
    return `<div class="pl-arow" data-planet-click="${name}"><span class="pl-dot sm" style="background:${c}">${PLANET_GLYPHS[name]}</span><span class="pl-an"><b>${name}</b><small>in House ${pl.house}</small></span><span class="pl-achips">${chips}</span></div>`;
  }).join('');

  return `<div class="pl">
    <div class="pl-intro">Where every planet stood at birth. Tap any planet for its full story — use the filters to spot what stands out.</div>
    <div class="pl-chips">
      <button type="button" class="pl-chip on" data-pl-f="all">All <b>${PLANET_LIST.length}</b></button>
      <button type="button" class="pl-chip" data-pl-f="retro">℞ Retrograde <b>${nRetro}</b></button>
      <button type="button" class="pl-chip" data-pl-f="strong">💪 Strong <b>${nStrong}</b></button>
      <button type="button" class="pl-chip" data-pl-f="chall">⚠ Challenged <b>${nChall}</b></button>
    </div>
    <div class="pl-grid">${cards}</div>
    <div class="pl-empty" id="plEmpty" hidden>No planets match this filter in your chart.</div>
    <div class="pl-sec"><h5>Outer planets <span>Modern · tap for details</span></h5><div class="pl-grid">${outerCards}</div>
      <div class="pl-asplist" style="margin-top:10px">${outerAsp}</div></div>
    <div class="pl-sec"><h5>Who looks at whom <span>Drishti · aspected houses</span></h5><div class="pl-asplist">${asp}</div></div></div>`;
}
document.addEventListener('click',(e)=>{
  const f = e.target.closest('[data-pl-f]'); if(!f) return;
  const k = f.dataset.plF; let shown = 0;
  document.querySelectorAll('.pl-chip').forEach(c=>c.classList.toggle('on', c===f));
  document.querySelectorAll('.pl-card').forEach(c=>{ const ok = k==='all' || c.dataset.flags.split(' ').includes(k); c.hidden = !ok; if(ok) shown++; });
  document.getElementById('plEmpty').hidden = shown>0;
});

let pdCurrent = null;
function pdBlock(title, inner){ return `<div class="pd-blk"><div class="pd-blk-t">${title}</div>${inner}</div>`; }
function openOuterDetail(name){
  const chart = currentChartForModal, o = chart.outer && chart.outer[name]; if (!o) return;
  pdCurrent = name; const I = OUTER_INFO[name], sign = SIGNS[o.sign], c = OUTER_COL[name];
  const nakSpan = 360/27, nakPct = Math.max(0,Math.min(100,(o.nakshatra.degInNak||0)/nakSpan*100)), degRem = nakSpan - (o.nakshatra.degInNak||0);
  document.getElementById('pdBox').style.setProperty('--pc', c);
  document.getElementById('pdGlyph').textContent = OUTER_GLYPHS[name];
  document.getElementById('pdTitle').textContent = name;
  document.getElementById('pdSubtitle').textContent = `${sign.symbol} ${sign.name} · House ${o.house} · ${I.sk}`;
  document.getElementById('pdPills').innerHTML = [`<span class="pd-pill gold">${I.role}</span>`, `<span class="pd-pill ${o.retrograde?'bad':''}">${o.retrograde?'℞ Retrograde':'Direct motion'}</span>`, '<span class="pd-pill">Outer planet</span>'].join('');
  const k = name.toLowerCase(), l1 = planetGeocentricLongitude(k, chart.julianDay-0.25), l2 = planetGeocentricLongitude(k, chart.julianDay+0.25);
  let dd = l2-l1; if (dd>180) dd-=360; if (dd<-180) dd+=360; const speed = Math.abs(dd*2);
  let h = '';
  h += pdBlock('What it means', `<div class="pd-jsub" style="font-size:13px;line-height:1.6;color:var(--text-main)">${I.about}</div>`);
  h += pdBlock(`In your chart: house ${o.house}`, `<div class="pd-jsub" style="font-size:13px;line-height:1.6;color:var(--text-main)">${outerHouseLine(name, o.house)}</div>`);
  h += pdBlock(`Journey through ${sign.name}`, `<div class="pd-journey"><div class="pd-jtrack"><i style="width:${(o.degInSign/30*100).toFixed(1)}%"></i><u style="left:${(o.degInSign/30*100).toFixed(1)}%"></u></div>
    <div class="pd-jlbl"><span>0°</span><b>${formatDeg(o.degInSign)} travelled</b><span>30°</span></div>
    <div class="pd-jsub">Typical stay in a sign: ${I.perSign}</div></div>`);
  h += `<div class="pd-mini"><div><small>Sign lord</small><b>${sign.lord}</b></div><div><small>House</small><b>${o.house}</b></div><div><small>Daily speed</small><b>${speed.toFixed(3)}°</b></div><div><small>Nakshatra lord</small><b>${o.nakshatra.lord}</b></div></div>`;
  h += pdBlock('Nakshatra', `<div class="pd-nak"><b>${o.nakshatra.name}</b><span>Pada ${o.nakshatra.pada}</span></div><div class="pd-jtrack thin"><i style="width:${nakPct.toFixed(1)}%"></i></div><div class="pd-jsub">${formatDeg(degRem)} remaining in this nakshatra</div>`);
  const tg = PLANET_LIST.map(n=>[n, chart.planets[n].longitude]).concat(OUTER_LIST.map(n=>[n, chart.outer[n].longitude])).concat([['Ascendant', chart.ascendant.longitude]]);
  const asp = outerAspectsTo(o.longitude, tg, name);
  h += pdBlock('Aspects (Western orbs)', asp.length ? asp.map(a=>`<div class="pd-alert"><b>${a.asp.symbol} ${a.asp.name} ${a.target}</b><span>${name} ${a.asp.verb} ${a.target} · ${a.dev.toFixed(1)}° orb</span></div>`).join('') : '<div class="pd-jsub">No close aspects to your planets or Ascendant.</div>');
  h += pdBlock('Key themes', `<div class="pl-achips">${I.themes.map(t=>`<span class="pl-asp">${t}</span>`).join('')}</div>`);
  h += pdBlock('Facts', `<div class="pd-mini" style="grid-template-columns:repeat(2,1fr)">${I.facts.map(f=>`<div><small>${f[0]} ${f[1]}</small><b style="font-size:12.5px">${f[2]}</b></div>`).join('')}</div>`);
  document.getElementById('pdStatGrid').innerHTML = h;
  document.getElementById('pdNote').textContent = OUTER_VEDIC_NOTE;
  document.getElementById('pdStrengthBtn').style.display = 'none';
  document.getElementById('pdBox').scrollTop = 0;
  document.getElementById('planetDetailModal').classList.add('show');
}
function openPlanetDetail(planetName){
  if (!currentChartForModal) return;
  document.getElementById('pdStrengthBtn').style.display = '';
  if (OUTER_LIST.includes(planetName)) return openOuterDetail(planetName);
  const chart = currentChartForModal, pl = chart.planets[planetName];
  if (!pl) return;
  pdCurrent = planetName;
  const sign = SIGNS[pl.sign], d = plDigInfo(pl), c = DASHA_PLANET_COLORS[planetName]||'#D4AF37';
  const nakSpan = 360/27, nakPct = Math.max(0,Math.min(100,pl.nakshatra.degInNak/nakSpan*100));
  const degRemNak = nakSpan - pl.nakshatra.degInNak;
  document.getElementById('pdBox').style.setProperty('--pc', c);
  document.getElementById('pdGlyph').textContent = PLANET_GLYPHS[planetName];
  document.getElementById('pdTitle').textContent = planetName;
  document.getElementById('pdSubtitle').textContent = `${sign.symbol} ${sign.name} · House ${pl.house}`;

  // role pills
  const pills = [`<span class="pd-pill ${d.cls}">${pl.dignity.label}</span>`,
    `<span class="pd-pill ${pl.retrograde?'bad':''}">${pl.retrograde?'℞ Retrograde':'Direct motion'}</span>`];
  KARAKA_NAMES.forEach(k=>{ if (chart.charaKarakas[k] && chart.charaKarakas[k].planet===planetName) pills.push(`<span class="pd-pill gold">${k}</span>`); });
  const act = findActiveDasha(chart.dashaData.mahadashas, new Date());
  if (act){
    if (act.mahadasha.lord===planetName) pills.push('<span class="pd-pill gold">Running Mahadasha</span>');
    if (act.antardasha && act.antardasha.lord===planetName) pills.push('<span class="pd-pill gold">Running Antardasha</span>');
  }
  document.getElementById('pdPills').innerHTML = pills.join('');

  let h = '';
  h += pdBlock(`Journey through ${sign.name}`, `<div class="pd-journey"><div class="pd-jtrack"><i style="width:${(pl.degInSign/30*100).toFixed(1)}%"></i><u style="left:${(pl.degInSign/30*100).toFixed(1)}%"></u></div>
    <div class="pd-jlbl"><span>0°</span><b>${formatDeg(pl.degInSign)} travelled</b><span>30°</span></div>
    <div class="pd-jsub">${formatDeg(pl.degRemainingInSign)} left before it enters the next sign</div></div>`);
  h += `<div class="pd-mini">
    <div><small>Sign lord</small><b>${sign.lord}</b></div><div><small>House</small><b>${pl.house}</b></div>
    <div><small>Daily speed</small><b>${Math.abs(pl.speed).toFixed(3)}°</b></div><div><small>Nakshatra lord</small><b>${pl.nakshatra.lord}</b></div></div>`;
  h += pdBlock('Nakshatra', `<div class="pd-nak"><b>${pl.nakshatra.name}</b><span>Pada ${pl.nakshatra.pada}</span></div>
    <div class="pd-jtrack thin"><i style="width:${nakPct.toFixed(1)}%"></i></div><div class="pd-jsub">${formatDeg(degRemNak)} remaining in this nakshatra</div>`);
  if (chart.shadbala && chart.shadbala.planets && chart.shadbala.planets[planetName]){
    const s = chart.shadbala.planets[planetName], p = Math.min(100, s.percentOfRequired);
    h += pdBlock('Strength (Shadbala)', `<div class="pd-str"><b>${s.totalRupas.toFixed(2)} <small>/ ${s.requiredRupas} Rupas</small></b><span class="pd-pill ${s.isStrong?'good':'bad'}">${s.isStrong?'Strong':'Below threshold'}</span></div>
      <div class="pd-jtrack thin"><i style="width:${p}%;background:${s.isStrong?'var(--teal-bright)':'#C95050'}"></i></div><div class="pd-jsub">${s.percentOfRequired.toFixed(0)}% of required strength</div>`);
  }
  h += pdBlock('Aspects (Drishti)', `<div class="pl-achips">${pl.aspectsHouses.map(x=>`<span class="pl-asp">H${x} ${SIGNS[(chart.ascendant.sign+x-1)%12].symbol}</span>`).join('')}</div>`);
  if (pl.combustion && pl.combustion.separation !== undefined){
    h += `<div class="pd-alert ${pl.combustion.combust?'bad':''}"><b>${pl.combustion.combust?'🔥 Combust':'☀ Not combust'}</b><span>${pl.combustion.separation.toFixed(2)}° from the Sun (orb ${pl.combustion.orb}°)</span></div>`;
  }
  if (pl.war){
    h += `<div class="pd-alert ${pl.war.won?'':'bad'}"><b>⚔ Planetary war</b><span>${pl.war.won?'Wins against':'Loses against'} ${pl.war.with}, ${pl.war.separation.toFixed(2)}° apart</span></div>`;
  }
  document.getElementById('pdStatGrid').innerHTML = h;
  document.getElementById('pdNote').textContent = `Sidereal longitude ${formatDeg(normDeg(pl.longitude))} · Speed is instantaneous and varies through the orbit; planets slow near stations before turning retrograde or direct.`;
  const box = document.getElementById('pdBox'); box.scrollTop = 0;
  document.getElementById('planetDetailModal').classList.add('show');
}
document.addEventListener('click',(e)=>{
  const go = e.target.closest('[data-pd-go]');
  if (go && pdCurrent){
    const ALLP = PLANET_LIST.concat(OUTER_LIST), i = ALLP.indexOf(pdCurrent), n = ALLP.length;
    openPlanetDetail(ALLP[(i + parseInt(go.dataset.pdGo) + n) % n]); return;
  }
  if (e.target.closest('#pdStrengthBtn')){
    document.getElementById('planetDetailModal').classList.remove('show'); switchAppTab('panel-shadbala');
  }
});

document.addEventListener('click', (e)=>{
  const clickable = e.target.closest('[data-planet-click]');
  if (clickable){
    openPlanetDetail(clickable.dataset.planetClick);
    return;
  }
  const shadbalaCard = e.target.closest('[data-shadbala-toggle]');
  if (shadbalaCard){
    shadbalaCard.classList.toggle('expanded');
  }
});

document.getElementById('pdModalClose').addEventListener('click', ()=>{
  document.getElementById('planetDetailModal').classList.remove('show');
});
document.getElementById('planetDetailModal').addEventListener('click', (e)=>{
  if (e.target.id === 'planetDetailModal') document.getElementById('planetDetailModal').classList.remove('show');
});

// Contact & Bug Report Modal Logic
document.getElementById('contactDevBtn').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.remove('show'); // Auto-close menu
  document.getElementById('contactModal').classList.add('show');
});
document.getElementById('contactModalClose').addEventListener('click', () => {
  document.getElementById('contactModal').classList.remove('show');
});
document.getElementById('contactModal').addEventListener('click', (e) => {
  if (e.target.id === 'contactModal') document.getElementById('contactModal').classList.remove('show');
});

// Main Menu Modal Logic
document.getElementById('openMenuBtn').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.add('show');
});
document.getElementById('mainMenuClose').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.remove('show');
});
document.getElementById('mainMenuModal').addEventListener('click', (e) => {
  if (e.target.id === 'mainMenuModal') document.getElementById('mainMenuModal').classList.remove('show');
});

// Auto-close menu when a profile action is taken
document.getElementById('deleteProfileBtn').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.remove('show');
});
document.getElementById('newProfileBtn').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.remove('show');
});
document.getElementById('exportReportBtn').addEventListener('click', () => {
  document.getElementById('mainMenuModal').classList.remove('show');
});

/* ============================================================================
   BIRTH TIME RECTIFICATION — full-screen tab panel (rewired on every render,
   since results.innerHTML — and therefore this panel's DOM — is rebuilt
   each time a profile loads or the chart is recalculated).
   ============================================================================ */
let rectSelectedIdx = null;
let rectRows = [];

function fmtDegShort(deg){
  const d = Math.floor(deg);
  const mFull = (deg-d)*60;
  let m = Math.floor(mFull);
  let s = Math.round((mFull-m)*60);
  if (s === 60){ s = 0; m += 1; }
  let dd = d;
  if (m === 60){ m = 0; dd += 1; }
  return `${String(dd).padStart(2,'0')}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`;
}

function runRectificationScan(){
  if (!currentProfileForExport){ return; }
  const lat = currentProfileForExport.lat, lon = currentProfileForExport.lon, tz = currentProfileForExport.tz;
  const dateStr = document.getElementById('rectDate').value;
  const centerTime = document.getElementById('rectCenterTime').value;
  const windowMin = parseInt(document.getElementById('rectWindow').value, 10);
  const step = parseInt(document.getElementById('rectStep').value, 10);
  const wrap = document.getElementById('rectResultsWrap');

  if (!dateStr || !centerTime){
    wrap.innerHTML = `<div class="rect-empty">Please enter a date and a center time to scan around.</div>`;
    return;
  }
  const totalRange = windowMin*60;
  const steps = Math.floor((totalRange*2)/step) + 1;
  if (steps > 6000){
    wrap.innerHTML = `<div class="rect-empty">That window/step combination is ${steps.toLocaleString()} candidate seconds — too many to scan smoothly. Widen the step or narrow the window.</div>`;
    return;
  }

  rectRows = [];
  for (let off = -totalRange; off <= totalRange; off += step){
    const shifted = shiftLocalDateTime(dateStr, centerTime, off);
    const pt = rectifyPoint(shifted.dateStr, shifted.timeStr, lat, lon, tz);
    pt.offsetSec = off;
    rectRows.push(pt);
  }
  rectSelectedIdx = null;
  document.getElementById('rectDetail').classList.remove('show');
  renderRectificationTable();
}

function renderRectificationTable(){
  const wrap = document.getElementById('rectResultsWrap');
  if (!wrap) return;
  if (rectRows.length === 0){ wrap.innerHTML = ""; return; }

  let rowsHtml = "";
  for (let i=0; i<rectRows.length; i++){
    const r = rectRows[i];
    const prev = i>0 ? rectRows[i-1] : null;
    const d60Boundary = prev && (prev.asc.sign !== r.asc.sign || prev.asc.d60Amsa !== r.asc.d60Amsa);
    const nakBoundary = prev && (prev.asc.nak.index !== r.asc.nak.index || prev.asc.nak.pada !== r.asc.nak.pada);
    const isCenter = r.offsetSec === 0;
    const cls = [
      d60Boundary ? 'rect-d60-boundary' : '',
      nakBoundary ? 'rect-nak-boundary' : '',
      i===rectSelectedIdx ? 'rect-selected' : ''
    ].filter(Boolean).join(' ');
    const ascSign = SIGNS[r.asc.sign];
    const moonD60Sign = SIGNS[r.moon.d60Sign];
    rowsHtml += `<tr class="${cls}" data-idx="${i}">
      <td>${r.timeStr}${isCenter ? ' <span style="color:var(--gold-bright);font-family:var(--font-sans);font-size:10px;">● recorded</span>' : ''}</td>
      <td>${ascSign.symbol} ${ascSign.name} ${fmtDegShort(r.asc.degInSign)}</td>
      <td>${escapeHtml(r.asc.nak.name)}-${r.asc.nak.pada}</td>
      <td>#${r.asc.d60Amsa} → ${SIGNS[r.asc.d60Sign].name}</td>
      <td>#${r.moon.d60Amsa} → ${moonD60Sign.name}</td>
    </tr>`;
  }

  wrap.innerHTML = `
    <div class="rect-summary">
      <span>${rectRows.length.toLocaleString()} candidate seconds scanned · click any row to inspect &amp; apply</span>
      <span class="rect-legend">
        <span><i style="background:var(--gold-dim);"></i> new D60 (Shashtiamsha) division begins</span>
        <span><i style="background:var(--teal-bright);"></i> new Nakshatra pada begins</span>
      </span>
    </div>
    <div class="rect-table-wrap" style="max-height:480px; overflow-y:auto;">
      <table class="rect-table">
        <thead><tr><th>Local Time</th><th>Ascendant</th><th>Asc Nakshatra-Pada</th><th>Asc D60 Amsa</th><th>Moon D60 Amsa</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  wrap.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      rectSelectedIdx = parseInt(tr.dataset.idx, 10);
      renderRectificationTable();
      renderRectificationDetail();
      document.getElementById('rectDetail').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });
}

function renderRectificationDetail(){
  const detail = document.getElementById('rectDetail');
  if (!detail) return;
  if (rectSelectedIdx === null || !rectRows[rectSelectedIdx]){ detail.classList.remove('show'); return; }
  const r = rectRows[rectSelectedIdx];
  const ascSign = SIGNS[r.asc.sign];
  const moonSign = SIGNS[r.moon.sign];
  detail.innerHTML = `
    <h4>Candidate: ${r.dateStr} · ${r.timeStr} local</h4>
    <div class="rect-detail-grid">
      <div><span class="rd-label">Ascendant</span><span class="rd-value">${ascSign.symbol} ${ascSign.name} ${fmtDegShort(r.asc.degInSign)}</span></div>
      <div><span class="rd-label">Asc Nakshatra / Pada</span><span class="rd-value">${escapeHtml(r.asc.nak.name)} · Pada ${r.asc.nak.pada}</span></div>
      <div><span class="rd-label">Asc D60 (Shashtiamsha)</span><span class="rd-value">Amsa #${r.asc.d60Amsa} of 60 → ${SIGNS[r.asc.d60Sign].name}</span></div>
      <div><span class="rd-label">Moon Sign / Degree</span><span class="rd-value">${moonSign.symbol} ${moonSign.name} ${fmtDegShort(r.moon.degInSign)}</span></div>
      <div><span class="rd-label">Moon D60 (Shashtiamsha)</span><span class="rd-value">Amsa #${r.moon.d60Amsa} of 60 → ${SIGNS[r.moon.d60Sign].name}</span></div>
      <div><span class="rd-label">Julian Day (UT)</span><span class="rd-value">${r.jd.toFixed(6)}</span></div>
    </div>
    <div class="rect-detail-actions">
      <button type="button" class="btn btn-primary btn-sm" id="rectApplyBtn">✓ Apply This Second & Recalculate Full Chart</button>
      <button type="button" class="btn btn-ghost btn-sm" id="rectCopyBtn">📋 Copy Time</button>
    </div>`;
  detail.classList.add('show');

  document.getElementById('rectApplyBtn').addEventListener('click', () => {
    const updatedProfile = { ...currentProfileForExport, dob: r.dateStr, tob: r.timeStr };
    const profiles = loadProfiles();
    const idx = profiles.findIndex(p => p.savedAt === currentProfileForExport.savedAt);
    if (idx >= 0){ profiles[idx] = updatedProfile; saveProfiles(profiles); refreshProfileSelect(); }
    renderResults(updatedProfile);
    switchAppTab('panel-overview');
  });
  document.getElementById('rectCopyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(r.timeStr);
    const btn = document.getElementById('rectCopyBtn');
    btn.textContent = '✓ Copied';
    setTimeout(()=>{ btn.innerHTML = '📋 Copy Time'; }, 1500);
  });
}

let rectHms = { h:0, m:0, s:0 };

function padHms(n){ return String(n).padStart(2,'0'); }

function syncHmsHiddenInput(){
  const hidden = document.getElementById('rectCenterTime');
  if (hidden) hidden.value = `${padHms(rectHms.h)}:${padHms(rectHms.m)}:${padHms(rectHms.s)}`;
}

function updateHmsDisplay(){
  const hEl = document.getElementById('rectHmsH');
  const mEl = document.getElementById('rectHmsM');
  const sEl = document.getElementById('rectHmsS');
  if (hEl) hEl.textContent = padHms(rectHms.h);
  if (mEl) mEl.textContent = padHms(rectHms.m);
  if (sEl) sEl.textContent = padHms(rectHms.s);
  syncHmsHiddenInput();
}

function changeHmsUnit(unit, dir){
  if (unit === 'h') rectHms.h = (rectHms.h + dir + 24) % 24;
  else if (unit === 'm') rectHms.m = (rectHms.m + dir + 60) % 60;
  else if (unit === 's') rectHms.s = (rectHms.s + dir + 60) % 60;
  updateHmsDisplay();
}

function wireHmsSteppers(){
  document.querySelectorAll('#rectHmsRow .hms-btn').forEach(btn => {
    const unit = btn.dataset.unit;
    const dir = parseInt(btn.dataset.dir, 10);
    let holdTimer = null, holdInterval = null, repeatStarted = false, activePointerId = null;

    const clearTimers = () => {
      clearTimeout(holdTimer); clearInterval(holdInterval);
      holdTimer = null; holdInterval = null;
    };
    const startHold = () => {
      repeatStarted = false;
      holdTimer = setTimeout(() => {
        repeatStarted = true;
        holdInterval = setInterval(() => changeHmsUnit(unit, dir), 90);
      }, 450);
    };
    const endHold = (fireIfTap) => {
      if (fireIfTap && !repeatStarted) changeHmsUnit(unit, dir);
      clearTimers();
      activePointerId = null;
    };

    // Pointer Events unify mouse + touch + pen into a single reliable path,
    // so a single tap always registers on the very first touch — no ghost
    // clicks, no missed taps, no needing to tap twice.
    if (window.PointerEvent){
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activePointerId = e.pointerId;
        if (btn.setPointerCapture){ try { btn.setPointerCapture(e.pointerId); } catch(err){} }
        startHold();
      });
      btn.addEventListener('pointerup', (e) => {
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        endHold(true);
      });
      btn.addEventListener('pointercancel', () => endHold(false));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    } else {
      // Fallback for older browsers without Pointer Events support
      let touchFired = false;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchFired = true;
        startHold();
      }, {passive:false});
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        endHold(true);
        setTimeout(() => { touchFired = false; }, 400);
      }, {passive:false});
      btn.addEventListener('touchcancel', () => endHold(false));
      btn.addEventListener('mousedown', () => { if (!touchFired) startHold(); });
      btn.addEventListener('mouseup', () => { if (!touchFired) endHold(true); });
      btn.addEventListener('mouseleave', () => { if (!touchFired) endHold(false); });
      btn.addEventListener('click', (e) => { if (touchFired) e.preventDefault(); });
    }
  });
}

function runFullChartCalculation(){
  const resultsEl = document.getElementById('rectFullChartResults');
  if (!currentProfileForExport){
    resultsEl.innerHTML = `<div class="rect-empty">Generate a chart first — Full Chart calculation needs a Place of Birth (lat/lon/timezone) to work from.</div>`;
    return;
  }
  const dateStr = document.getElementById('rectDate').value;
  const timeStr = document.getElementById('rectCenterTime').value;
  if (!dateStr || !timeStr){
    resultsEl.innerHTML = `<div class="rect-empty">Please pick a date and dial in a time first.</div>`;
    return;
  }
  // Recompute EVERYTHING through the exact same pipeline the main intake form
  // uses (renderResults → computeChart), so every tab — Overview, Dasha, Yogas,
  // Ashtakavarga, Shadbala, Planets, Divisions, Lagnas — reflects this dialed
  // time identically to a normal chart generation. Nothing is saved to the
  // stored profile unless you use "Apply" — this is a live, temporary preview.
  const tempProfile = { ...currentProfileForExport, dob: dateStr, tob: timeStr };
  renderResults(tempProfile);
  switchAppTab('panel-overview');
}

function wireRectificationPanel(){
  rectSelectedIdx = null; rectRows = [];
  const scanBtn = document.getElementById('rectScanBtn');
  if (scanBtn) scanBtn.addEventListener('click', runRectificationScan);

  const tobVal = (currentProfileForExport && currentProfileForExport.tob) || "00:00:00";
  const parts = tobVal.split(':').map(Number);
  rectHms = { h: parts[0]||0, m: parts[1]||0, s: parts[2]||0 };
  updateHmsDisplay();
  wireHmsSteppers();

  const fullCalcBtn = document.getElementById('rectFullCalcBtn');
  if (fullCalcBtn) fullCalcBtn.addEventListener('click', runFullChartCalculation);

  const dateInput = document.getElementById('rectDate');
  if (dateInput) dateInput.addEventListener('change', syncHmsHiddenInput);
}

/* ============================================================================
   TRANSIT TIMER TAB
   ============================================================================ */
let ttCountdownInterval = null;
const VARGA_ORDER = Object.keys(VARGAS).sort((a,b) => VARGAS[a].n - VARGAS[b].n);

function wireTransitTimerPanel(){
  if (ttCountdownInterval){ clearInterval(ttCountdownInterval); ttCountdownInterval = null; }
  const vargaSel = document.getElementById('ttVarga');
  if (vargaSel){
    vargaSel.innerHTML = VARGA_ORDER.map(k => `<option value="${k}" ${k==="D9"?"selected":""}>${k} — ${VARGAS[k].name} (${VARGAS[k].full})</option>`).join('');
  }
  const checkBtn = document.getElementById('ttCheckBtn');
  if (checkBtn) checkBtn.addEventListener('click', runTransitTimerCheck);
}

function runTransitTimerCheck(){
  if (ttCountdownInterval){ clearInterval(ttCountdownInterval); ttCountdownInterval = null; }
  const resultsEl = document.getElementById('ttResults');
  if (!currentProfileForExport){
    resultsEl.innerHTML = `<div class="rect-empty">Generate a chart first — the Ascendant needs a Place of Birth (lat/lon) to compute, and planet transits need a location for context.</div>`;
    return;
  }
  const bodyName = document.getElementById('ttBody').value;
  const vargaKey = document.getElementById('ttVarga').value;
  const lat = currentProfileForExport.lat, lon = currentProfileForExport.lon, tz = currentProfileForExport.tz;

  const t = computeDivisionTiming(bodyName, vargaKey, lat, lon);
  renderTransitTimerResult(t, tz);

  ttCountdownInterval = setInterval(() => {
    const el = document.getElementById('ttResults');
    if (!el || !document.getElementById('ttCountdownValue')){ clearInterval(ttCountdownInterval); ttCountdownInterval = null; return; }
    const nowJD = nowJulianDay();
    const remaining = t.jdNext - nowJD;
    const sinceNow = nowJD - t.jdEntered;
    const cdEl = document.getElementById('ttCountdownValue');
    const cdCard = document.getElementById('ttCountdownCard');
    if (remaining <= 0){
      cdEl.textContent = "Crossing now →";
      if (cdCard) cdCard.classList.add('tt-countdown-past');
    } else {
      cdEl.textContent = formatDurationHMS(remaining);
    }
    const sinceEl = document.getElementById('ttSinceValue');
    if (sinceEl) sinceEl.textContent = formatDurationHMS(sinceNow) + " ago";
  }, 1000);
}

function renderTransitTimerResult(t, tz){
  const resultsEl = document.getElementById('ttResults');
  const sign = SIGNS[t.signIdx];
  const vargaSign = SIGNS[t.vargaSignIdx];
  const nak = getNakshatra(t.currentLon);
  const enteredParts = jdToLocalParts(t.jdEntered, tz);
  const nextParts = jdToLocalParts(t.jdNext, tz);
  const bodyLabel = t.bodyName === "Ascendant" ? "🌅 Ascendant (Lagna)" : `${PLANET_GLYPHS[t.bodyName]} ${t.bodyName}`;

  resultsEl.innerHTML = `
    <div class="tt-result-wrap">
      <div class="tt-result-badge">
        <span>${bodyLabel} in ${t.vargaKey} — ${VARGAS[t.vargaKey].name}</span>
        ${t.retrograde ? '<span class="retro-tag">Retrograde</span>' : ''}
        <span>· ${Math.abs(t.speed).toFixed(t.bodyName==="Ascendant"?1:4)}°/day</span>
      </div>
      <div class="tt-result-body">
        <div class="tt-grid" style="margin-bottom:14px;">
          <div class="tt-stat-card">
            <div class="tt-label">D1 Position</div>
            <div class="tt-value">${sign.symbol} ${sign.name} ${fmtDegShort(t.degInSign)}</div>
            <div class="tt-sub">${escapeHtml(nak.name)} · Pada ${nak.pada}</div>
          </div>
          <div class="tt-stat-card">
            <div class="tt-label">${t.vargaKey} Division</div>
            <div class="tt-value">${vargaSign.symbol} ${vargaSign.name}</div>
            <div class="tt-sub">Amsa ${t.divWithinSign} of ${t.n} · width ${t.width.toFixed(4)}°</div>
          </div>
        </div>
        <div class="tt-grid">
          <div class="tt-stat-card">
            <div class="tt-label">Entered This Division</div>
            <div class="tt-value">${enteredParts.timeStr}</div>
            <div class="tt-sub">${enteredParts.dateStr} · <span id="ttSinceValue">${formatDurationHMS(t.sinceDays)} ago</span></div>
          </div>
          <div class="tt-stat-card">
            <div class="tt-label">Moves to Next Division</div>
            <div class="tt-value">${nextParts.timeStr}</div>
            <div class="tt-sub">${nextParts.dateStr}${t.retrograde ? ' (moving backward)' : ''}</div>
          </div>
          <div class="tt-stat-card tt-countdown-card" id="ttCountdownCard">
            <div class="tt-label">Time Remaining</div>
            <div class="tt-value" id="ttCountdownValue">${formatDurationHMS(t.remainingDays)}</div>
            <div class="tt-sub">live countdown</div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ============================================================================
   SANDHI TABLE TAB
   ============================================================================ */
let sandhiCountdownInterval = null;
let sandhiRows = [];

function wireSandhiPanel(){
  if (sandhiCountdownInterval){ clearInterval(sandhiCountdownInterval); sandhiCountdownInterval = null; }
  sandhiRows = [];
  const btn = document.getElementById('sandhiCalcBtn');
  if (btn) btn.addEventListener('click', runSandhiCalculation);
}

function runSandhiCalculation(){
  if (sandhiCountdownInterval){ clearInterval(sandhiCountdownInterval); sandhiCountdownInterval = null; }
  const resultsEl = document.getElementById('sandhiResults');
  if (!currentProfileForExport){
    resultsEl.innerHTML = `<div class="rect-empty">Generate a chart first — the Ascendant needs a Place of Birth (lat/lon) to compute.</div>`;
    return;
  }
  const lat = currentProfileForExport.lat, lon = currentProfileForExport.lon, tz = currentProfileForExport.tz;
  sandhiRows = VARGA_ORDER.map(key => computeDivisionTiming("Ascendant", key, lat, lon));
  renderSandhiTable(tz);

  sandhiCountdownInterval = setInterval(() => {
    if (!document.getElementById('sandhiTableBody')){ clearInterval(sandhiCountdownInterval); sandhiCountdownInterval = null; return; }
    const nowJD = nowJulianDay();
    sandhiRows.forEach(t => {
      const cell = document.getElementById(`sandhi-rem-${t.vargaKey}`);
      if (cell){
        const remaining = t.jdNext - nowJD;
        cell.textContent = remaining <= 0 ? "now →" : formatDurationHMS(remaining);
      }
    });
  }, 1000);
}

function renderSandhiTable(tz){
  const resultsEl = document.getElementById('sandhiResults');
  const d1 = sandhiRows.find(r => r.vargaKey === "D1");
  const d1Sign = SIGNS[d1.signIdx];

  let rows = "";
  sandhiRows.forEach(t => {
    const before = jdToLocalParts(t.jdBefore, tz);
    const current = jdToLocalParts(t.jdEntered, tz);
    const next = jdToLocalParts(t.jdNext, tz);
    rows += `<tr class="${t.vargaKey==='D1' ? 'sandhi-d1-row' : ''}">
      <td>${t.vargaKey} — ${VARGAS[t.vargaKey].name}</td>
      <td>${formatDurationHMS(t.remainingDays + t.sinceDays)}</td>
      <td>${before.timeStr}</td>
      <td>${current.timeStr}</td>
      <td>${next.timeStr}</td>
      <td class="sandhi-remaining" id="sandhi-rem-${t.vargaKey}">${formatDurationHMS(t.remainingDays)}</td>
    </tr>`;
  });

  resultsEl.innerHTML = `
    <div class="sandhi-meta">Ascendant currently in <strong>${d1Sign.symbol} ${d1Sign.name}</strong> · D1 window ≈ <strong>${formatDurationHMS(d1.remainingDays + d1.sinceDays)}</strong> wide for this location and date</div>
    <div class="sandhi-table-wrap">
      <table class="sandhi-table">
        <thead><tr><th>Varga</th><th>Window Width</th><th>Before Started</th><th>Current Started</th><th>Next Starts</th><th>Remaining</th></tr></thead>
        <tbody id="sandhiTableBody">${rows}</tbody>
      </table>
    </div>`;
}

/* ============================================================================
   VARGA TIMELINE TAB — anchored to the BIRTH TIME, not live "now"
   ============================================================================ */
function wireVargaTimelinePanel(){
  const sel = document.getElementById('vtVarga');
  if (sel){
    sel.innerHTML = VARGA_ORDER.map(k => `<option value="${k}" ${k==="D9"?"selected":""}>${k} — ${VARGAS[k].name} (${VARGAS[k].full})</option>`).join('');
  }
  const infoEl = document.getElementById('vtBirthInfo');
  if (infoEl){
    if (!currentProfileForExport){
      infoEl.innerHTML = `<div class="rect-empty">Generate a chart first — this needs the birth date, time, and place.</div>`;
    } else {
      const tz = currentProfileForExport.tz;
      const w = computeAscendantD1Window(currentProfileForExport.lat, currentProfileForExport.lon, getBirthJD(currentProfileForExport));
      const sign = SIGNS[w.d1SignIdx];
      const startParts = jdToLocalParts(w.jdD1Start, tz);
      const endParts = jdToLocalParts(w.jdD1End, tz);
      infoEl.innerHTML = `
        <div class="vt-birth-card">
          <div class="tt-stat-card"><div class="tt-label">Birth Ascendant</div><div class="tt-value">${sign.symbol} ${sign.name}</div></div>
          <div class="tt-stat-card"><div class="tt-label">D1 Window Started</div><div class="tt-value">${startParts.timeStr}</div><div class="tt-sub">${startParts.dateStr}</div></div>
          <div class="tt-stat-card"><div class="tt-label">D1 Window Ended</div><div class="tt-value">${endParts.timeStr}</div><div class="tt-sub">${endParts.dateStr}</div></div>
          <div class="tt-stat-card"><div class="tt-label">Total Width</div><div class="tt-value">${formatDurationHMS(w.jdD1End - w.jdD1Start)}</div></div>
        </div>`;
    }
  }
  const btn = document.getElementById('vtMapBtn');
  if (btn) btn.addEventListener('click', runVargaTimeline);
}

function getBirthJD(profile){
  const [year,month,day] = profile.dob.split("-").map(Number);
  const timeStr = (profile.tob && profile.tob.length===5) ? profile.tob+":00" : profile.tob;
  const [hour,minute,second] = timeStr.split(":").map(Number);
  const localJD = toJulianDay(year,month,day,hour,minute,second||0);
  return localJD - profile.tz/24;
}

function runVargaTimeline(){
  const resultsEl = document.getElementById('vtResults');
  if (!currentProfileForExport){
    resultsEl.innerHTML = `<div class="rect-empty">Generate a chart first — this needs the birth date, time, and place.</div>`;
    return;
  }
  const vargaKey = document.getElementById('vtVarga').value;
  const tz = currentProfileForExport.tz;
  const birthJD = getBirthJD(currentProfileForExport);
  const tl = computeVargaTimelineForD1Window(vargaKey, currentProfileForExport.lat, currentProfileForExport.lon, birthJD);

  let rows = "";
  tl.rows.forEach(r => {
    const s = jdToLocalParts(r.startJD, tz);
    const e = jdToLocalParts(r.endJD, tz);
    const sign = SIGNS[r.vargaSignIdx];
    rows += `<tr class="${r.containsBirth ? 'vt-birth-row' : ''}">
      <td>${r.index} of ${tl.n}</td>
      <td>${s.timeStr}</td>
      <td>${e.timeStr}</td>
      <td>${sign.symbol} ${sign.name}</td>
      <td class="vt-birth-flag">${r.containsBirth ? '← birth moment' : ''}</td>
    </tr>`;
  });

  resultsEl.innerHTML = `
    <div class="sandhi-meta">
      ${vargaKey} — ${VARGAS[vargaKey].name}: ${tl.n} division${tl.n>1?'s':''} across the D1 window
      (${jdToLocalParts(tl.jdD1Start,tz).timeStr} to ${jdToLocalParts(tl.jdD1End,tz).timeStr}),
      each ≈ <strong>${formatDurationHMS((tl.jdD1End-tl.jdD1Start)/tl.n)}</strong> wide
    </div>
    <div class="sandhi-table-wrap">
      <table class="sandhi-table">
        <thead><tr><th>Division</th><th>Start</th><th>End</th><th>Sign</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ============================================================================
   EXPORT / IMPORT ALL PROFILES (backup & restore via copy-paste)
   ============================================================================ */
function openProfileDataModal(mode){
  document.getElementById('mainMenuModal').classList.remove('show');
  const modal = document.getElementById('profileDataModal');
  const title = document.getElementById('profileDataModalTitle');
  const hint = document.getElementById('profileDataModalHint');
  const ta = document.getElementById('profileDataTextarea');
  const primaryBtn = document.getElementById('profileDataPrimaryBtn');
  const secondaryBtn = document.getElementById('profileDataSecondaryBtn');
  const status = document.getElementById('profileDataStatus');
  status.textContent = '';
  status.className = 'profile-data-status';

  if (mode === 'export'){
    const profiles = loadProfiles();
    title.textContent = 'Export All Profiles';
    hint.textContent = `This is a backup of all ${profiles.length} saved profile${profiles.length===1?'':'s'} on this device. Copy it somewhere safe — on another device or browser, open this menu, choose "Import Profiles", paste it in, and they'll all come back.`;
    ta.value = JSON.stringify(profiles, null, 2);
    ta.readOnly = true;
    ta.placeholder = '';
    primaryBtn.innerHTML = '<span>📋</span> Copy to Clipboard';
    primaryBtn.style.display = '';
    primaryBtn.onclick = () => {
      copyTextToClipboard(ta.value, primaryBtn, '<span>📋</span> Copy to Clipboard');
    };
    secondaryBtn.style.display = 'none';
  } else {
    title.textContent = 'Import Profiles';
    hint.textContent = 'Paste profile backup text (from "Export All Profiles" on this or another device) below, then import. Profiles are merged with what you already have — existing profiles with the same name, date, time and place are updated in place; everything else is added.';
    ta.value = '';
    ta.readOnly = false;
    ta.placeholder = 'Paste exported profile JSON here...';
    primaryBtn.style.display = 'none';
    secondaryBtn.style.display = '';
    secondaryBtn.innerHTML = '<span>📥</span> Import These Profiles';
    secondaryBtn.onclick = () => {
      let incoming;
      try {
        incoming = JSON.parse(ta.value);
        if (!Array.isArray(incoming)) throw new Error('not an array');
      } catch (e){
        status.textContent = '⚠ That doesn\'t look like valid exported profile data. Make sure you pasted the full text.';
        status.className = 'profile-data-status error';
        return;
      }
      const validKeys = ['name','dob','tob','tz','place','lat','lon'];
      const valid = incoming.filter(p => p && typeof p === 'object' && validKeys.every(k => k in p));
      if (valid.length === 0){
        status.textContent = '⚠ No valid profiles found in that text.';
        status.className = 'profile-data-status error';
        return;
      }
      const existing = loadProfiles();
      let added = 0, updated = 0;
      valid.forEach(p => {
        if (!p.savedAt) p.savedAt = Date.now();
        const idx = existing.findIndex(e => e.name===p.name && e.dob===p.dob && e.tob===p.tob && e.place===p.place);
        if (idx >= 0){ existing[idx] = p; updated++; } else { existing.push(p); added++; }
      });
      saveProfiles(existing);
      refreshProfileSelect();
      status.textContent = `✓ Imported successfully — ${added} new, ${updated} updated. Total profiles: ${existing.length}.`;
      status.className = 'profile-data-status success';
    };
  }

  modal.classList.add('show');
}
document.getElementById('exportProfilesBtn').addEventListener('click', () => openProfileDataModal('export'));
document.getElementById('importProfilesBtn').addEventListener('click', () => openProfileDataModal('import'));
document.getElementById('profileDataModalClose').addEventListener('click', () => {
  document.getElementById('profileDataModal').classList.remove('show');
});
document.getElementById('profileDataModal').addEventListener('click', (e) => {
  if (e.target.id === 'profileDataModal') document.getElementById('profileDataModal').classList.remove('show');
});

/* ============================================================================
   APP TAB SWITCHING
   ============================================================================ */

/* [panelId, icon, title, description, section, bar-group] */
const HOME_ITEMS=[
 ['panel-reading','📖','Chart Reading','Plain-language reading, life areas & timing','Your Chart','chart'],
 ['panel-overview','◈','Overview','Birth chart & key details','Your Chart','chart'],
 ['panel-planets','☉','Planets','Positions & aspects of every planet','Your Chart','chart'],
 ['panel-bhava','⌂','Bhava Chalit','Sripati house cusps & shifted planets','Your Chart','chart'],
 ['panel-vargas','◫','Divisional Charts','D1 to D60 chart viewer','Your Chart','chart'],
 ['panel-lagnas','✧','Special Lagnas','23 alternate ascendants','Your Chart','chart'],
 ['panel-rectification','🎯','Rectification Studio','Dial, scan & confirm the time','Fix Birth Time','rectify'],
 ['panel-datefinder','🔎','Date Finder','Find the birth date from festival, tithi & day clues','Fix Birth Time','rectify'],
 ['panel-sandhi','⏱','Sandhi Table','Ascendant window across all charts','Fix Birth Time','rectify'],
 ['panel-vargatimeline','🗺️','Varga Timeline','Map the birth window on any chart','Fix Birth Time','rectify'],
 ['panel-transittimer','⏳','Transit Timer','When a planet changes house','Fix Birth Time','rectify'],
 ['panel-lifeevents','🌟','Life-Event Checker','Confirm the time with real events','Fix Birth Time','rectify'],
 ['panel-panchanga','🌙','Panchanga','Tithi, nakshatra, yoga, karana & day timings','Time & Cycles','home'],
 ['panel-vbday','🎂','Vedic Birthday','Tithi, Nakshatra & solar birthday for any year','Time & Cycles','home'],
 ['panel-active','🔥','Life Activation','Houses lit up now · pick any date','Time & Cycles','home'],
 ['panel-dasha','◷','Dasha','120-year life-period timeline','Time & Cycles','home'],
 ['panel-tithi','🪔','Tithi Pravesh','Your yearly lunar-birthday chart','Time & Cycles','home'],
 ['panel-transits','♄','Transits & Sade Sati','Saturn, Jupiter & node ingress dates','Time & Cycles','home'],
 ['panel-transit','⟲','Live Sky','Today\'s planets vs your chart','Time & Cycles','home'],
 ['panel-numerology','🔢','Numerology','Name number & birth-date numbers with meanings','Analysis','home'],
 ['panel-yogas','✦','Yogas','Notable planet combinations','Analysis','home'],
 ['panel-shadbala','⚖','Shadbala','Planet strength','Analysis','home'],
 ['panel-bhavabala','🏠','Bhava Bala','House strength — which life areas are strong','Analysis','home'],
 ['panel-fate','🌡️','Fate Meter','How much is written vs in your control','Analysis','home'],
 ['panel-sahams','⭐','Sahams','36 sensitive points with readings','Analysis','home'],
 ['panel-ashtakavarga','▦','Ashtakavarga','Point-strength system','Analysis','home'],
 ['panel-relationships','⚯','Relationships','Conjunctions & aspects','Analysis','home'],
 ['panel-match','💞','Kundali Matching','Ashtakoota 36-point match & Manglik check','Compatibility','match'],
 ['panel-export','📤','Export & Share','Download a file or copy your full report','Export & Help','export'],
 ['panel-contact','💬','Contact Developer','Bugs, ideas or astrology chat','Export & Help','export']];
const HOME_SEC_COL={'Your Chart':'#D4AF37','Fix Birth Time':'#5EC4B7','Time & Cycles':'#8A6FB8','Analysis':'#6B7FA3','Compatibility':'#D96C9B','Export & Help':'#C95050'};
function buildHomePanel(name){
  const secs=[...new Set(HOME_ITEMS.map(i=>i[4]))], PL=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
  const pr=window.__vgProf||{}, ch=(typeof currentChartForModal!=='undefined')?currentChartForModal:null;
  const fd=d=>{try{return new Date(d+'T00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return d||'';}};
  const pct=(s,e)=>Math.max(0,Math.min(100,(Date.now()-s)/(e-s)*100));
  let h=`<div class="app-panel" id="panel-home"><div class="home-wrap hm">`, top='';
  try{
    const asc=SIGNS[ch.ascendant.sign],mo=ch.planets.Moon,su=ch.planets.Sun,nk=mo.nakshatra,act=findActiveDasha(ch.dashaData.mahadashas,new Date());
    const big=(l,s,sub)=>`<button type="button" class="hm-b" data-go="panel-overview"><small>${l}</small><b>${s.symbol} ${s.name}</b><span>${sub}</span></button>`;
    top+=`<section class="hm-hero"><div class="hm-top"><div class="hm-av">${escapeHtml((name||'✦').trim().charAt(0).toUpperCase()||'✦')}</div><div class="hm-id"><small>Namaste 🙏</small><h2>${escapeHtml(name||'Your chart')}</h2><p>${pr.dob?'🗓 '+fd(pr.dob):''}${pr.tob?' · 🕒 '+pr.tob.slice(0,5):''}${pr.place?' · 📍 '+escapeHtml(String(pr.place).split(',')[0]):''}</p></div></div>
      <div class="hm-big">${big('Rising',asc,asc.sk)}${big('Moon',SIGNS[mo.sign],nk.name+' · pada '+nk.pada)}${big('Sun',SIGNS[su.sign],su.nakshatra?su.nakshatra.name:SIGNS[su.sign].sk)}</div></section>`;
    if(act&&act.antardasha){const m=act.mahadasha,ad=act.antardasha;
      top+=`<button type="button" class="hm-now" data-go="panel-dasha"><div class="hm-now-h"><span>⏳ Running now</span><em>Open timeline ›</em></div><div class="hm-now-t">${PLANET_GLYPHS[m.lord]} ${m.lord} <i>›</i> ${PLANET_GLYPHS[ad.lord]} ${ad.lord}</div>
        <div class="hm-pb"><label>${m.lord} Mahadasha<small>until ${formatDashaDate(m.endDate)}</small></label><i><u style="width:${pct(m.startDate,m.endDate)}%"></u></i></div>
        <div class="hm-pb"><label>${ad.lord} Antardasha<small>until ${formatDashaDate(ad.endDate)}</small></label><i><u style="width:${pct(ad.startDate,ad.endDate)}%"></u></i></div></button>`;}
    top+=`<section><h3 class="hm-h">Your planets</h3><div class="hm-strip">${PL.map(n=>{const p=ch.planets[n],s=SIGNS[p.sign];return `<button type="button" class="hm-pl" data-go="panel-overview"><span>${PLANET_GLYPHS[n]}</span><b>${n}${p.retrograde?' ℞':''}</b><small>${s.symbol} ${s.name}</small><em>${Math.floor(p.degInSign)}° · H${p.house}</em></button>`}).join('')}</div></section>`;
  }catch(e){top=`<section class="hm-hero"><div class="hm-id"><small>Namaste 🙏</small><h2>${escapeHtml(name||'Your chart')}</h2><p>Your chart is ready. Pick what you want to explore.</p></div></section>`;}
  h+=top+`<div class="hm-search"><span>🔎</span><input id="hmQ" type="search" placeholder="Search tools — dasha, yoga, match…" autocomplete="off"></div>`;
  const pref=['panel-reading','panel-active','panel-overview','panel-dasha','panel-vargas','panel-lagnas','panel-yogas','panel-shadbala'];
  const feat=pref.map(id=>HOME_ITEMS.find(i=>i[0]===id)).filter(Boolean).concat(HOME_ITEMS).filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);
  h+=`<section><h3 class="hm-h">Quick start</h3><div class="hm-feat">${feat.map(i=>`<button type="button" class="hm-f" style="--sc:${HOME_SEC_COL[i[4]]||'#D4AF37'}" data-go="${i[0]}"><span>${i[1]}</span><b>${i[2]}</b><small>${i[4]}</small></button>`).join('')}</div></section><div id="hmSecs">`;
  secs.forEach(s=>{const its=HOME_ITEMS.filter(i=>i[4]===s);
    h+=`<section class="hm-sec" style="--sc:${HOME_SEC_COL[s]||'#D4AF37'}"><h3 class="hm-h"><i></i>${s}<em>${its.length}</em></h3><div class="hm-grid">${its.map(i=>`<button type="button" class="hm-c" data-go="${i[0]}"><span class="hm-ci">${i[1]}</span><span class="hm-ct"><b>${i[2]}</b><small>${i[3]}</small></span><span class="hm-ar">›</span></button>`).join('')}</div></section>`;});
  h+=`</div><p class="hm-none" id="hmNone" hidden>No tool matches that search.</p></div></div><div class="panel-back" id="panelBack" style="display:none"><button type="button" data-go="panel-home">← Home</button><span></span></div>`;
  const r=document.getElementById('results');
  r.insertAdjacentHTML('afterbegin',h);
  const bk=document.getElementById('panelBack'); const home=document.getElementById('panel-home');
  home.after(bk);
  r.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>switchAppTab(b.dataset.go)));
  const q=document.getElementById('hmQ'); q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();let any=false;
    home.querySelectorAll('.hm-sec').forEach(s=>{let n=0;s.querySelectorAll('.hm-c').forEach(c=>{const ok=!t||c.textContent.toLowerCase().includes(t);c.hidden=!ok;if(ok)n++;});s.hidden=!n;if(n)any=true;});document.getElementById('hmNone').hidden=any;});
}

document.getElementById('hdrBack').addEventListener('click',()=>switchAppTab('panel-home'));
new MutationObserver(()=>{
  const on=document.getElementById('results').classList.contains('show');
  document.body.classList.toggle('app-mode',on);
  if(!on){document.body.classList.remove('on-sub');const h=document.querySelector('.brand-text h1');if(h&&h.dataset.orig)h.textContent=h.dataset.orig;}
}).observe(document.getElementById('results'),{attributes:true,attributeFilter:['class']});
function switchAppTab(panelId){
  if (panelId==='panel-export'){ openExportModal(); return; }
  if (panelId==='panel-contact'){ document.getElementById('contactModal').classList.add('show'); return; }
  document.querySelectorAll('.app-panel').forEach(p=> p.classList.remove('active'));
  document.querySelectorAll('.app-tab').forEach(t=> t.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
  const grp = (HOME_ITEMS.find(i=>i[0]===panelId)||[])[5] || 'home';
  const barBtn = document.querySelector(`.app-tab[data-group="${panelId==='panel-home'?'home':grp}"]`) || document.querySelector('.app-tab[data-group="home"]');
  if (barBtn) barBtn.classList.add('active');
  const it0 = HOME_ITEMS.find(i=>i[0]===panelId);
  const h1 = document.querySelector('.brand-text h1');
  if (h1){ if(!h1.dataset.orig) h1.dataset.orig=h1.textContent; if(document.body.classList.contains('app-mode')) h1.textContent = it0 ? it0[2] : 'Home'; }
  document.body.classList.toggle('on-sub', panelId!=='panel-home');
  const back = document.getElementById('panelBack');
  if (back){
    back.style.display = panelId==='panel-home' ? 'none' : 'flex';
    const it = HOME_ITEMS.find(i=>i[0]===panelId);
    if (it) back.querySelector('span').textContent = it[2];
  }
  window.scrollTo({ top:0, behavior:'instant' in window ? 'instant' : 'auto' });
}
document.querySelectorAll('.app-tab').forEach(tab=>{
  tab.addEventListener('click', ()=> switchAppTab(tab.dataset.panel));
});

/* ============================================================================
   RECTIFICATION STUDIO — one calm place for every birth-time tool
   Tabs: Time Dial · Second Scan · Sandhi Table · Varga Timeline · Transit Timer · Life Events
   initRectStudio() runs after the old panels are wired; it MOVES the existing nodes
   (IDs + listeners survive) into tab panes. Old panel ids still work via switchAppTab.
   ============================================================================ */
const RS_TABS = [
  ['dates', '🔎', 'Date Finder',    1],
  ['dial',  '🕰️', 'Time Dial',      1],
  ['scan',  '🎯', 'Second Scan',    2],
  ['sandhi','⏱️', 'Sandhi Table',   2],
  ['vt',    '🗺️', 'Varga Timeline', 2],
  ['tt',    '⏳', 'Transit Timer',  2],
  ['life',  '🌟', 'Life Events',    3]
];
const RS_STEPS = [[1,'Set date & time'],[2,'Narrow it down'],[3,'Confirm with life']];
const RS_SUBS = { sandhi:'panel-sandhi', vt:'panel-vargatimeline', tt:'panel-transittimer' };
const RS_ROUTE = { 'panel-datefinder':'dates', 'panel-sandhi':'sandhi', 'panel-vargatimeline':'vt', 'panel-transittimer':'tt', 'panel-lifeevents':'life' };
const RS_CATS = {
  marriage:{label:'💍 Marriage / partnership', p:[7], s:[2,11], k:['Venus']},
  child:   {label:'👶 Child birth',            p:[5], s:[2,9,11], k:['Jupiter']},
  career:  {label:'💼 Job start / promotion',  p:[10], s:[6,11], k:['Sun','Saturn']},
  edu:     {label:'🎓 Higher education',       p:[4,9], s:[5], k:['Jupiter','Mercury']},
  foreign: {label:'✈️ Foreign travel / move',  p:[12], s:[3,9], k:['Rahu']},
  property:{label:'🏠 Property / vehicle',     p:[4], s:[2,11], k:['Mars','Venus']},
  gain:    {label:'💰 Big gain / wealth',      p:[2,11], s:[5,9], k:['Jupiter']},
  father:  {label:'👨 Father: major event',    p:[9], s:[3,8], k:['Sun']},
  mother:  {label:'👩 Mother: major event',    p:[4], s:[8,10], k:['Moon']},
  health:  {label:'🩺 Illness / surgery',      p:[6,8], s:[1,12], k:['Mars','Saturn']}
};
let rsState = { tab:'dial', visited:{dial:1}, conf:null, events:[], hand:{h:0,m:0,s:0} };

function rsEvKey(){
  const p = currentProfileForExport || {};
  return 'vax_rs_events:' + (p.name||'') + '|' + (p.dob||'') + '|' + (p.tob||'');
}
function rsLoadEvents(){
  try { const v = JSON.parse(localStorage.getItem(rsEvKey())||'[]'); return Array.isArray(v) ? v : []; } catch(e){ return []; }
}
function rsSaveEvents(){ try { localStorage.setItem(rsEvKey(), JSON.stringify(rsState.events)); } catch(e){} }
function rsEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function rsToast(msg){
  let t = document.getElementById('rsToast');
  if (!t){ t = document.createElement('div'); t.id = 'rsToast'; t.className = 'rs-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(rsToast._t); rsToast._t = setTimeout(()=> t.classList.remove('show'), 2600);
}

function rsClockSVG(){
  let ring = '', ticks = '';
  for (let i=0;i<12;i++){
    const a = i*30*Math.PI/180;
    ring += `<text x="${(100+90*Math.sin(a)).toFixed(1)}" y="${(100-90*Math.cos(a)+3.5).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor">${SIGNS[i].symbol}</text>`;
    const r1 = i%3===0 ? 58 : 62, r2 = 68;
    ticks += `<line x1="${(100+r1*Math.sin(a)).toFixed(1)}" y1="${(100-r1*Math.cos(a)).toFixed(1)}" x2="${(100+r2*Math.sin(a)).toFixed(1)}" y2="${(100-r2*Math.cos(a)).toFixed(1)}" stroke="currentColor" stroke-width="${i%3===0?2:1}" opacity="${i%3===0?.9:.5}"/>`;
  }
  return `<svg viewBox="0 0 200 200" class="rs-clock" aria-hidden="true">
    <defs><radialGradient id="rsFace" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#2a2410"/><stop offset="1" stop-color="#0a0b10"/></radialGradient></defs>
    <g class="rs-ring" style="color:var(--gold)">${ring}</g>
    <circle cx="100" cy="100" r="76" fill="url(#rsFace)" stroke="var(--gold)" stroke-width="1.2" opacity=".95"/>
    <g style="color:var(--gold-bright)">${ticks}</g>
    <line id="rsHandH" x1="100" y1="100" x2="100" y2="64" stroke="var(--gold-bright)" stroke-width="4" stroke-linecap="round"/>
    <line id="rsHandM" x1="100" y1="100" x2="100" y2="48" stroke="#EAE6DF" stroke-width="3" stroke-linecap="round"/>
    <line id="rsHandS" x1="100" y1="112" x2="100" y2="42" stroke="var(--teal-bright)" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="4.5" fill="var(--gold)"/><circle cx="100" cy="100" r="1.8" fill="#000"/>
  </svg>`;
}
function rsSetHands(){
  const h = rectHms.h, m = rectHms.m, s = rectHms.s;
  const tgt = { h:((h%12)+m/60)*30, m:(m+s/60)*6, s:s*6 };
  const cur = rsState.hand, from = { h:cur.h, m:cur.m, s:cur.s }, t0 = performance.now();
  const sh = (a,b)=> { let d = ((b-a)%360+540)%360-180; return d; };
  const dh = sh(from.h,tgt.h), dm = sh(from.m,tgt.m), ds = sh(from.s,tgt.s);
  const ease = x=> 1-Math.pow(1-x,3);
  cancelAnimationFrame(rsSetHands._r);
  const step = now=>{
    const k = Math.min(1,(now-t0)/380), e = ease(k);
    cur.h = from.h+dh*e; cur.m = from.m+dm*e; cur.s = from.s+ds*e;
    [['rsHandH',cur.h],['rsHandM',cur.m],['rsHandS',cur.s]].forEach(([id,a])=>{
      const el = document.getElementById(id); if (el) el.setAttribute('transform', `rotate(${a.toFixed(2)} 100 100)`);
    });
    if (k<1) rsSetHands._r = requestAnimationFrame(step);
  };
  rsSetHands._r = requestAnimationFrame(step);
}

function rsRefresh(){
  const pill = document.getElementById('rsPill'); if (!pill) return;
  rsSetHands();
  const p = currentProfileForExport, dEl = document.getElementById('rectDate');
  if (!p || !dEl || !dEl.value){ pill.innerHTML = `<span class="rs-pill-dim">Generate a chart first to begin ✨</span>`; return; }
  const ts = `${padHms(rectHms.h)}:${padHms(rectHms.m)}:${padHms(rectHms.s)}`;
  try {
    const r = rectifyPoint(dEl.value, ts, p.lat, p.lon, p.tz);
    const sg = SIGNS[r.asc.sign];
    pill.innerHTML = `<span class="rs-pill-t">${ts}</span><span class="rs-pill-i"><b>${sg.symbol} ${sg.name}</b> rising ${r.asc.degInSign.toFixed(1)}°</span><span class="rs-pill-i">🌙 ${r.moon.nak.name} · pada ${r.moon.nak.pada}</span>`;
  } catch(e){ pill.innerHTML = `<span class="rs-pill-dim">${ts}</span>`; }
}

function rsShow(id, scroll){
  const root = document.getElementById('rsRoot'); if (!root) return;
  rsState.tab = id; rsState.visited[id] = 1;
  root.querySelectorAll('.rs-tab').forEach(b=>{
    const on = b.dataset.rsTab===id; b.classList.toggle('active', on);
    b.classList.toggle('seen', !!rsState.visited[b.dataset.rsTab] && !on);
    if (on){ const bar = b.parentElement; bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth-b.offsetWidth)/2, behavior:'smooth' }); }
  });
  root.querySelectorAll('.rs-pane').forEach(p=> p.classList.toggle('active', p.dataset.rsPane===id));
  const grp = RS_TABS.find(t=>t[0]===id)[3];
  root.querySelectorAll('.rs-step').forEach(s=>{
    const n = +s.dataset.step; s.classList.toggle('active', n===grp); s.classList.toggle('done', n<grp);
  });
  const line = root.querySelector('.rs-rail-fill'); if (line) line.style.width = ((grp-1)/2*100)+'%';
  if (scroll){ const top = root.querySelector('.rs-tabs').getBoundingClientRect().top + window.pageYOffset - 70; window.scrollTo({ top:Math.max(0,top), behavior:'smooth' }); }
  if (id==='life') rsRenderEvents();
  if (id==='dates'){ try { dfPlaceNote(); } catch(e){} }
}

function rsHow(el, title){
  if (!el || el.closest('details')) return;
  const d = document.createElement('details'); d.className = 'rs-how';
  d.innerHTML = `<summary>💡 ${title||'How it works'}</summary>`;
  el.parentNode.insertBefore(d, el); d.appendChild(el);
}

function initRectStudio(){
  const panel = document.getElementById('panel-rectification');
  if (!panel || panel.dataset.rs) return;
  const card = panel.querySelector('.rect-panel-card'); if (!card) return;
  panel.dataset.rs = '1';
  const q = s=> card.querySelector(s);
  const dialCard = q('.rect-time-dial-card'), actRow = q('.rect-action-row'), fullRes = q('#rectFullChartResults'), intro = q('.rect-intro');
  const ctrls = q('.rect-controls'), resWrap = q('#rectResultsWrap'), detail = q('#rectDetail');
  rsState.events = rsLoadEvents(); rsState.visited = { dial:1 }; rsState.conf = null;

  const chips = [
    ['exact','🎯','To the minute','I trust it closely'],
    ['half','🕐','Within ~30 min','Pretty close'],
    ['hours','🌓','Within a few hours','Rough idea'],
    ['unk','❔','Not sure at all','Use life events']
  ];
  panel.innerHTML = `
  <div class="rs" id="rsRoot">
    <div class="rs-hero">
      <div class="rs-aura"></div>
      <div class="rs-clockwrap">${rsClockSVG()}</div>
      <div class="rs-hero-txt">
        <div class="rs-eyebrow">✦ Rectification Studio</div>
        <h2>Find the <em>true</em> moment of birth</h2>
        <p>Every tool in one calm place. Tell us how sure you are and we'll point you to the right one.</p>
        <div class="rs-pill" id="rsPill"></div>
        <div class="rs-ask">How sure are you of the birth time?</div>
        <div class="rs-chips">${chips.map(c=>`<button type="button" class="rs-chip" data-rs-chip="${c[0]}"><span>${c[1]}</span><b>${c[2]}</b><i>${c[3]}</i></button>`).join('')}</div>
        <div class="rs-hint" id="rsHint"></div>
      </div>
    </div>
    <div class="rs-rail">
      <div class="rs-rail-line"><div class="rs-rail-fill"></div></div>
      ${RS_STEPS.map(s=>`<button type="button" class="rs-step" data-step="${s[0]}"><span class="rs-dot">${s[0]}</span><em>${s[1]}</em></button>`).join('')}
    </div>
    <div class="rs-tabs" role="tablist">
      ${RS_TABS.map(t=>`<button type="button" class="rs-tab" role="tab" data-rs-tab="${t[0]}" data-g="${t[3]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}
    </div>
    <div class="rs-panes">
      ${RS_TABS.map(t=>`<section class="rs-pane" data-rs-pane="${t[0]}"></section>`).join('')}
    </div>
  </div>`;
  const pane = id=> panel.querySelector(`.rs-pane[data-rs-pane="${id}"]`);

  // Dial
  const pd = pane('dial');
  pd.innerHTML = `<div class="rs-pane-head"><h3>🕰️ Time Dial</h3><p>Dial an exact moment and see the whole chart for it.</p></div>`;
  if (intro){ rsHow(intro, 'How the dial works'); pd.appendChild(intro.closest('details') || intro); }
  pd.appendChild(dialCard); pd.appendChild(actRow); pd.appendChild(fullRes);
  // Scan
  const ps = pane('scan');
  ps.innerHTML = `<div class="rs-pane-head"><h3>🎯 Second-by-Second Scan</h3><p>Slide through a window of time and watch the Ascendant, D60 and nakshatra shift.</p></div>`;
  ps.appendChild(ctrls); ps.appendChild(resWrap); ps.appendChild(detail);
  // Sub panels (nodes keep their ids so Export still finds them)
  Object.keys(RS_SUBS).forEach(k=>{
    const el = document.getElementById(RS_SUBS[k]); const p = pane(k); if (!el) return;
    el.classList.remove('app-panel'); el.classList.add('rs-sub');
    const intro2 = el.querySelector('.tt-intro'); if (intro2) rsHow(intro2, 'What this does');
    p.appendChild(el);
  });
  // Life
  rsBuildLife(pane('life'));
  try { dfBuild(pane('dates')); } catch(e){ console.error('Date Finder', e); }
  // Next / Back
  RS_TABS.forEach((t,i)=>{
    const nx = RS_TABS[i+1], pv = RS_TABS[i-1];
    const d = document.createElement('div'); d.className = 'rs-next';
    d.innerHTML = (pv?`<button type="button" class="btn btn-ghost" data-rs-go="${pv[0]}">← ${pv[2]}</button>`:'<span></span>') +
      (nx?`<button type="button" class="btn btn-primary" data-rs-go="${nx[0]}">Next: ${nx[2]} ➜</button>`:`<button type="button" class="btn btn-ghost" data-rs-go="dial">↺ Start over</button>`);
    pane(t[0]).appendChild(d);
  });

  const root = document.getElementById('rsRoot');
  root.addEventListener('click', e=>{
    const tb = e.target.closest('[data-rs-tab]'); if (tb){ rsShow(tb.dataset.rsTab); return; }
    const go = e.target.closest('[data-rs-go]'); if (go){ rsShow(go.dataset.rsGo, true); return; }
    const st = e.target.closest('.rs-step'); if (st){ const f = RS_TABS.find(t=>t[3]===+st.dataset.step); rsShow(f[0]); return; }
    const ch = e.target.closest('[data-rs-chip]'); if (ch) rsChip(ch.dataset.rsChip);
  });
  const dEl = document.getElementById('rectDate'); if (dEl) dEl.addEventListener('change', rsRefresh);
  rsShow('dial'); rsRefresh();
}

function rsChip(key){
  const root = document.getElementById('rsRoot'); if (!root) return;
  root.querySelectorAll('.rs-chip').forEach(c=> c.classList.toggle('active', c.dataset.rsChip===key));
  const w = document.getElementById('rectWindow'), st = document.getElementById('rectStep'), hint = document.getElementById('rsHint');
  const set = (el,v)=>{ if (el) el.value = v; };
  const M = {
    exact:{ tab:'dial',  msg:'Lovely. Check the full chart for your time, then do a ±2 minute scan to be sure.', w:'2', s:'1' },
    half: { tab:'scan',  msg:'Scan window set to ±30 min in 10-second steps. Press Run and look for the Ascendant sign changes.', w:'30', s:'10' },
    hours:{ tab:'sandhi',msg:'Start with the Sandhi Table. It shows when the rising sign changes, so you can cut the hours down.' },
    unk:  { tab:'life',  msg:'No problem. Add 3 or more real life events and we will rank the likely rising signs.' }
  }[key];
  if (M.w) set(w, M.w); if (M.s) set(st, M.s);
  if (hint) hint.textContent = '→ ' + M.msg;
  rsState.conf = key;
  rsShow(M.tab, true);
}

/* ============================================================================
   DATE FINDER — find the likely birth DATE from what the family remembers
   (tithi / weekday / festival / eclipse / nakshatra / Moon sign / lunar month /
   Saturn-Jupiter-Rahu sign / Samvatsara / English month / date number).
   Engine = pure functions (df*) + one generator `dfGen` (yields progress, returns results).
   Month names are AMANTA (Diwali = Ashvina Amavasya); "North-India names" option shifts Krishna paksha by one.
   Day = sunrise to next sunrise (Vedic day). Tithi/nakshatra match if active at sunrise OR during that day.
   ============================================================================ */
const DF_SAM = ['Prabhava','Vibhava','Shukla','Pramodoota','Prajotpatti','Angirasa','Srimukha','Bhava','Yuva','Dhatu','Ishvara','Bahudhanya','Pramathi','Vikrama','Vrisha','Chitrabhanu','Subhanu','Tarana','Parthiva','Vyaya','Sarvajit','Sarvadhari','Virodhi','Vikriti','Khara','Nandana','Vijaya','Jaya','Manmatha','Durmukhi','Hevilambi','Vilambi','Vikari','Sharvari','Plava','Shubhakrit','Shobhakrit','Krodhi','Vishvavasu','Parabhava','Plavanga','Kilaka','Saumya','Sadharana','Virodhikrit','Paridhavi','Pramadicha','Ananda','Rakshasa','Nala','Pingala','Kalayukti','Siddharthi','Raudra','Durmati','Dundubhi','Rudhirodgari','Raktakshi','Krodhana','Akshaya'];
const DF_AT = { sr:0, fore:0.15, noon:0.25, eve:0.54, mid:0.75 };          // moment of the day, as a fraction of a day after sunrise
const DF_LIM_SOLAR = 1.55, DF_LIM_LUNAR = 1.0;                  // |Moon latitude| limits (degrees) at new / full moon
/* [id, name, kind, amantaMonth(0=Chaitra), tithi(1-30), moment]  kind L = lunar (tithi in month), S = Sun enters sign, O = Onam (Shravana nakshatra in Simha) */
const DF_FEST = [
 ['ugadi','Ugadi / Gudi Padwa (new year)','L',0,1,'sr'],
 ['ramnavami','Ram Navami','L',0,9,'noon'],
 ['hanuman','Hanuman Jayanti','L',0,15,'sr'],
 ['akshaya','Akshaya Tritiya','L',1,3,'fore'],
 ['buddha','Buddha Purnima','L',1,15,'eve'],
 ['rath','Rath Yatra','L',3,2,'sr'],
 ['guru','Guru Purnima','L',3,15,'sr'],
 ['nagpanchami','Nag Panchami','L',4,5,'sr'],
 ['rakhi','Raksha Bandhan','L',4,15,'noon'],
 ['janmashtami','Krishna Janmashtami','L',4,23,'mid'],
 ['ganesh','Ganesh Chaturthi','L',5,4,'noon'],
 ['anant','Anant Chaturdashi','L',5,14,'sr'],
 ['pitru','Sarva Pitru Amavasya (Mahalaya)','L',5,30,'sr'],
 ['navratri','Navaratri begins','L',6,1,'sr'],
 ['durgashtami','Durga Ashtami','L',6,8,'sr'],
 ['mahanavami','Maha Navami','L',6,9,'sr'],
 ['dussehra','Vijayadashami (Dussehra)','L',6,10,'noon+eve'],
 ['sharad','Sharad Purnima','L',6,15,'eve'],
 ['karwa','Karwa Chauth','L',6,19,'eve'],
 ['dhanteras','Dhanteras','L',6,28,'eve'],
 ['narak','Naraka Chaturdashi (Choti Diwali)','L',6,29,'sr'],
 ['diwali','Diwali (Lakshmi Puja)','L',6,30,'eve'],
 ['govardhan','Govardhan Puja / Bali Pratipada','L',7,1,'sr'],
 ['bhaidooj','Bhai Dooj','L',7,2,'noon'],
 ['chhath','Chhath Puja','L',7,6,'eve'],
 ['devuthani','Dev Uthani Ekadashi','L',7,11,'sr'],
 ['kartikpurnima','Kartik Purnima / Dev Diwali','L',7,15,'eve'],
 ['makar','Makar Sankranti / Pongal','S',9],
 ['vasant','Vasant Panchami','L',10,5,'fore'],
 ['shivratri','Maha Shivaratri','L',10,29,'mid'],
 ['holika','Holika Dahan','L',11,15,'eve'],
 ['holi','Holi (Dhulandi)','L',11,15,'eve',1],
 ['mesha','Mesha Sankranti (Vishu / Baisakhi / Puthandu)','S',0],
 ['onam','Onam (Thiruvonam)','O']
];

/* ---------- engine ---------- */
function dfSunrise(y, m, d, lat, lon, tz){
  const jd0 = toJulianDay(y, m, d, 0, 0, 0) - tz / 24;
  const guess = jd0 + 0.5 - (lon - tz * 15) / 360 - 0.25;
  const f = x => pnSunAlt(x, lat, lon) + 0.8333;
  let t = guess;
  for (let i = 0; i < 6; i++){
    const a = f(t), s = (f(t + 0.01) - a) / 0.01;
    if (!isFinite(s) || Math.abs(s) < 1e-6) break;
    const dt = a / s; t -= dt; if (Math.abs(dt) < 1e-5) break;
  }
  return (isFinite(t) && Math.abs(t - guess) < 0.2) ? t : guess;
}
function dfSunSign(jd){ return getSignIndex(getSiderealLongitudeAt('Sun', jd)); }
/* Moon's ecliptic latitude (Meeus ch.47, main terms; good to ~0.03°) */
function dfMoonLat(jd){
  const T = (jd - J2000) / 36525.0;
  const D = normDeg(297.8501921 + 445267.1114034*T), Mp = normDeg(134.9633964 + 477198.8675055*T), F = normDeg(93.2720950 + 483202.0175233*T), M = normDeg(357.5291092 + 35999.0502909*T);
  const R = DEG, tm = [[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749]];
  let s = 0; tm.forEach(t => { s += t[4] * Math.sin((t[0]*D + t[1]*M + t[2]*Mp + t[3]*F) * R); });
  return s / 1e6;
}
/* every new / full moon (Moon-Sun elongation crosses 0 or 180) from a little before jdA to a little after jdB */
function dfSyz(jdA, jdB){
  const out = []; let t = jdA - 35;
  for (let g = 0; g < 4000 && t < jdB + 35; g++){
    const x = pnBoundary(pnDiff, t, 180, +1, 0.25);
    out.push({ jd: x, full: Math.round(pnDiff(x) / 180) % 2 === 1 });
    t = x + 1;
  }
  return out;
}
/* Amanta lunar months from the new moons: starts at a new moon, named by the Sun's sign then; Adhika if the Sun stays in one sign */
function dfMonths(sy){
  const nm = sy.filter(s => !s.full), mo = [];
  for (let k = 0; k + 1 < nm.length; k++){
    const s1 = dfSunSign(nm[k].jd), s2 = dfSunSign(nm[k + 1].jd);
    mo.push({ start: nm[k].jd, end: nm[k + 1].jd, mi: (s1 + 1) % 12, adhika: s1 === s2 });
  }
  return mo;
}
function dfMonthAt(mo, jd){
  let lo = 0, hi = mo.length - 1;
  if (!mo.length || jd < mo[0].start || jd >= mo[hi].end) return null;
  while (lo < hi){ const m = (lo + hi + 1) >> 1; if (mo[m].start <= jd) lo = m; else hi = m - 1; }
  return mo[lo];
}
/* eclipses (any visible somewhere on Earth): new moon with |Moon lat| < 1.55° = solar, full moon with |lat| < 1.0° = lunar (umbral) */
function dfEclipses(sy){
  const out = [];
  sy.forEach(s => {
    const lat = Math.abs(dfMoonLat(s.jd));
    if (!s.full && lat < DF_LIM_SOLAR) out.push({ jd: s.jd, kind: 'solar', lat });
    else if (s.full && lat < DF_LIM_LUNAR) out.push({ jd: s.jd, kind: 'lunar', lat });
  });
  return out;
}
function dfIn(a, b, x, mod){ const d1 = (x - a + mod) % mod, d2 = (b - a + mod) % mod; return d1 <= d2; }   // is x within the cyclic run a..b ?
function dfNear(arr, i, n, tol){ for (let d = 0; d <= tol; d++){ if (i - d >= 0 && arr[i - d]) return -d; if (i + d < n && arr[i + d]) return d; } return null; }
function dfTithiName(t0){ const pk = t0 < 15 ? 'Shukla' : 'Krishna', k = t0 % 15; return k === 14 ? (t0 < 15 ? 'Purnima' : 'Amavasya') : pk + ' ' + PN_TITHI[k]; }
function dfTithiTargets(q){
  if (q.tithi === '' && q.pak === '') return null;
  if (q.tithi === 'P') return [14];
  if (q.tithi === 'A') return [29];
  const out = [];
  if (q.tithi === ''){ for (let k = 0; k < 15; k++){ if (q.pak === 'S' && k < 15) out.push(k); if (q.pak === 'K') out.push(k + 15); } return out; }
  const x = +q.tithi - 1;
  if (q.pak !== 'K') out.push(x);
  if (q.pak !== 'S') out.push(x + 15);
  return out;
}
/* sign of a slow planet on every day, sampled every 6 days and interpolated (error is far below a day) */
function dfSlow(name, tm, n){
  const out = new Int8Array(n), step = 6; let prev = null;
  for (let i = 0; i < n; i += step){
    const j = Math.min(n - 1, i + step), a = getSiderealLongitudeAt(name, tm[i]), b = getSiderealLongitudeAt(name, tm[j]);
    const dd = ((b - a + 540) % 360) - 180;
    for (let k = i; k <= j && k < n; k++){ const f = j === i ? 0 : (k - i) / (j - i); out[k] = getSignIndex(a + dd * f); }
  }
  return out;
}

function* dfGen(q){
  const lat = q.lat, lon = q.lon, tz = q.tz;
  const base = Date.UTC(q.y0, 0, 1), n = Math.round((Date.UTC(q.y1, 11, 31) - base) / 864e5) + 1, N2 = n + 2;
  const dt = i => { const d = new Date(base + i * 864e5); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()]; };
  const srj = new Float64Array(N2), T = new Int8Array(N2), NK = new Int8Array(N2), MS = new Int8Array(N2), SUN = new Int8Array(N2);
  for (let i = 0; i < N2; i++){
    const [y, m, d] = dt(i), t = dfSunrise(y, m, d, lat, lon, tz); srj[i] = t;
    T[i] = Math.min(29, Math.floor(pnDiff(t) / 12));
    const ml = pnMoon(t); NK[i] = Math.floor(ml / PN_NAK) % 27; MS[i] = getSignIndex(ml); SUN[i] = dfSunSign(t);
    if (i % 200 === 0) yield 0.55 * i / N2;
  }
  const sy = dfSyz(srj[0], srj[N2 - 1]); yield 0.6;
  const months = dfMonths(sy), ecl = dfEclipses(sy);
  const MI = new Int8Array(N2), ADH = new Uint8Array(N2), SAM = new Int8Array(N2);
  for (let i = 0; i < N2; i++){
    const mo = dfMonthAt(months, srj[i]); MI[i] = mo ? mo.mi : 0; ADH[i] = mo && mo.adhika ? 1 : 0;
    const [y, m] = dt(i), Y = (m <= 4 && MI[i] >= 8) ? y - 1 : y; SAM[i] = (((Y - 2024 + 37) % 60) + 60) % 60;
  }
  const SAT = dfSlow('Saturn', srj, N2), JUP = dfSlow('Jupiter', srj, N2), RAH = dfSlow('Rahu', srj, N2); yield 0.8;
  const eclS = new Uint8Array(n), eclL = new Uint8Array(n);
  ecl.forEach(e => { const p = jdToLocalParts(e.jd, tz).dateStr.split('-').map(Number), idx = Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - base) / 864e5); if (idx >= 0 && idx < n) (e.kind === 'solar' ? eclS : eclL)[idx] = 1; });
  const ctx = { q, n, base, srj, T, NK, MS, SUN, MI, ADH, SAM, SAT, JUP, RAH, months, ecl, eclS, eclL, dt };
  ctx.festHits = f => dfFestHits(ctx, f);
  let fh = null;
  if (q.fest){ const f = DF_FEST.find(x => x[0] === q.fest); if (f) fh = dfFestHits(ctx, f); }
  yield 0.9;

  const tg = dfTithiTargets(q), clues = [];
  if (tg) clues.push('tithi'); if (q.wd !== '') clues.push('wd'); if (fh) clues.push('fest');
  if (q.ecl) clues.push('ecl'); if (q.nak !== '') clues.push('nak'); if (q.moon !== '') clues.push('moon'); if (q.masa !== '') clues.push('masa');
  if (q.sun !== '') clues.push('sun'); if (q.sam !== '') clues.push('sam'); if (q.mon !== '') clues.push('mon'); if (q.dom !== '') clues.push('dom');
  if (q.sat !== '') clues.push('sat'); if (q.jup !== '') clues.push('jup'); if (q.rahu !== '') clues.push('rahu');
  const maxMiss = clues.length >= 3 ? 1 : 0, tol = +q.tol || 0, rows = [];
  for (let i = 0; i < n; i++){
    const [y, m, d, wd] = dt(i), chips = []; let miss = 0;
    const chk = (id, ok, txt) => { chips.push({ id, ok, txt }); if (!ok) miss++; };
    if (q.wd !== '') chk('wd', wd === +q.wd, PN_VARA[+q.wd][1]);
    if (q.mon !== '') chk('mon', m === +q.mon, PN_MON[+q.mon - 1]);
    if (q.dom !== '') chk('dom', d === +q.dom, 'Date ' + q.dom);
    if (tg){
      const a = T[i], b = T[i + 1], hit = tg.find(x => dfIn(a, b, x, 30)), ex = tg.indexOf(a) >= 0;
      chk('tithi', hit !== undefined, (hit !== undefined ? dfTithiName(hit) : dfTithiName(tg[0])) + (hit !== undefined ? (ex ? ' · at sunrise' : ' · during the day') : ''));
    }
    if (q.nak !== ''){ const hit = dfIn(NK[i], NK[i + 1], +q.nak, 27); chk('nak', hit, NAKSHATRAS[+q.nak].name + (hit ? (NK[i] === +q.nak ? ' · at sunrise' : ' · during the day') : '')); }
    if (q.moon !== ''){ const hit = dfIn(MS[i], MS[i + 1], +q.moon, 12); chk('moon', hit, 'Moon in ' + SIGNS[+q.moon].name); }
    if (q.masa !== ''){ const mi = (MI[i] + (q.purn && T[i] >= 15 ? 1 : 0)) % 12; chk('masa', mi === +q.masa, PN_MASA[+q.masa] + ' month'); }
    if (q.sun !== '') chk('sun', SUN[i] === +q.sun, 'Sun in ' + SIGNS[+q.sun].name);
    if (q.sam !== '') chk('sam', SAM[i] === +q.sam, DF_SAM[+q.sam] + ' year');
    if (q.sat !== '') chk('sat', SAT[i] === +q.sat, 'Saturn in ' + SIGNS[+q.sat].name);
    if (q.jup !== '') chk('jup', JUP[i] === +q.jup, 'Jupiter in ' + SIGNS[+q.jup].name);
    if (q.rahu !== '') chk('rahu', RAH[i] === +q.rahu, 'Rahu in ' + SIGNS[+q.rahu].name);
    if (fh){ const o = dfNear(fh, i, n, tol), f = DF_FEST.find(x => x[0] === q.fest); chk('fest', o !== null, f[1] + (o === null ? '' : (o === 0 ? ' · same day' : ' · ' + Math.abs(o) + ' day' + (Math.abs(o) > 1 ? 's' : '') + (o < 0 ? ' after' : ' before')))); }
    if (q.ecl){
      const arrs = q.ecl === 'solar' ? [eclS] : q.ecl === 'lunar' ? [eclL] : [eclS, eclL]; let best = null;
      arrs.forEach((a, k) => { const o = dfNear(a, i, n, tol); if (o !== null && (best === null || Math.abs(o) < Math.abs(best.o))) best = { o, kind: q.ecl === 'either' ? (k === 0 ? 'Solar' : 'Lunar') : (q.ecl === 'solar' ? 'Solar' : 'Lunar') }; });
      chk('ecl', best !== null, (best ? best.kind : (q.ecl === 'solar' ? 'Solar' : q.ecl === 'lunar' ? 'Lunar' : 'Solar / lunar')) + ' eclipse' + (best ? (best.o === 0 ? ' · same day' : ' · ' + Math.abs(best.o) + ' day' + (Math.abs(best.o) > 1 ? 's' : '') + (best.o < 0 ? ' after' : ' before')) : ''));
    }
    if (miss <= maxMiss) rows.push({ i, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, wd, chips, miss });
    if (i % 1500 === 0) yield 0.9 + 0.1 * i / n;
  }
  rows.sort((a, b) => a.miss - b.miss || a.i - b.i);
  return { rows, clues, nFull: rows.filter(r => r.miss === 0).length, nAlmost: rows.filter(r => r.miss > 0).length, n, ctx };
}

/* does lunar festival f fall on day i?  (f[5] = moment(s) of the day joined by '+', f[6] = days after the tithi day) */
function dfLunarHit(ctx, f, i){
  const j = i - (f[6] || 0); if (j < 0) return false;
  return f[5].split('+').some(mm => {
    const tf = ctx.srj[j] + DF_AT[mm];
    if (Math.floor(pnDiff(tf) / 12) + 1 !== f[4]) return false;
    const mo = dfMonthAt(ctx.months, tf); return !!(mo && mo.mi === f[3] && !mo.adhika);
  });
}
/* all days on which a festival falls (index array as 0/1) */
function dfFestHits(ctx, f){
  const { n, srj, SUN, NK, months } = ctx, h = new Uint8Array(n);
  if (f[2] === 'L'){
    for (let i = 0; i < n; i++) if (dfLunarHit(ctx, f, i)) h[i] = 1;
  } else if (f[2] === 'S'){
    for (let i = 0; i < n; i++){
      if (SUN[i] === f[3] || SUN[i + 1] !== f[3]) continue;
      let a = srj[i], b = srj[i + 1];
      for (let k = 0; k < 30; k++){ const m = (a + b) / 2; if (dfSunSign(m) === f[3]) b = m; else a = m; }
      const idx = (b >= srj[i] + 0.5) ? i + 1 : i; if (idx < n) h[idx] = 1;      // after sunset -> observed next day
    }
  } else {
    for (let i = 0; i < n; i++) if (SUN[i] === 4 && dfIn(NK[i], NK[i + 1], 21, 27)) h[i] = 1;
  }
  return h;
}
/* everything we know about one result day (for the result card) */
function dfInfo(ctx, i){
  const { q, T, NK, MS, SUN, MI, ADH, SAM, SAT, JUP, RAH, n, srj, dt } = ctx, [y, m, d, wd] = dt(i);
  const mi = (MI[i] + (q.purn && T[i] >= 15 ? 1 : 0)) % 12, fests = [];
  DF_FEST.forEach(f => {
    if (f[2] === 'L'){ if (dfLunarHit(ctx, f, i)) fests.push(f[1]); }
    else if (f[2] === 'O'){ if (SUN[i] === 4 && dfIn(NK[i], NK[i + 1], 21, 27)) fests.push(f[1]); }
    else if (SUN[i] !== f[3] && SUN[i + 1] === f[3]){ let a = srj[i], b = srj[i + 1]; for (let k = 0; k < 30; k++){ const mm = (a + b) / 2; if (dfSunSign(mm) === f[3]) b = mm; else a = mm; } if (((b >= srj[i] + 0.5) ? i + 1 : i) === i) fests.push(f[1]); }
  });
  const ecl = []; [-1, 0, 1].forEach(o => { const j = i + o; if (j < 0 || j >= n) return; const w = o === 0 ? '' : (o < 0 ? ' (day before)' : ' (day after)'); if (ctx.eclS[j]) ecl.push('Solar eclipse' + w); if (ctx.eclL[j]) ecl.push('Lunar eclipse' + w); });
  return { y, m, d, wd, tithi: dfTithiName(T[i]), nak: NAKSHATRAS[NK[i]].name, moonSign: SIGNS[MS[i]], masa: PN_MASA[mi], adhika: !!ADH[i], sam: DF_SAM[SAM[i]], sun: SIGNS[SUN[i]], sat: SIGNS[SAT[i]], jup: SIGNS[JUP[i]], rahu: SIGNS[RAH[i]], fests, ecl };
}

/* ---------- UI ---------- */
const dfState = { res: null, shown: 40, run: 0 };
function dfPlace(){
  try {
    if (typeof selectedLat !== 'undefined' && selectedLat != null && selectedLon != null){
      const tz = parseFloat(document.getElementById('tzInput').value);
      if (isFinite(tz)) return { lat: +selectedLat, lon: +selectedLon, tz, label: (placeInput && placeInput.value) ? placeInput.value : 'the place chosen on the form' };
    }
    const p = currentProfileForExport;
    if (p && isFinite(p.lat) && isFinite(p.lon) && isFinite(p.tz)) return { lat: +p.lat, lon: +p.lon, tz: +p.tz, label: p.place || 'your chart place' };
  } catch(e){}
  return { lat: 22.0, lon: 79.0, tz: 5.5, label: 'central India (default)', dflt: true };
}
function dfEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function dfFmtDate(y, m, d, wd){ return `${PN_VARA[wd][1].slice(0, 3)}, ${d} ${PN_MON[m - 1]} ${y}`; }
function dfFmtT(jd, tz, dateStr){ if (jd == null || !isFinite(jd)) return '—'; const p = jdToLocalParts(jd, tz), t = p.timeStr.slice(0, 5); return p.dateStr === dateStr ? t : `${t} (${p.dateStr.slice(8)} ${PN_MON[+p.dateStr.slice(5, 7) - 1]})`; }

function dfPlaceNote(){
  const el = document.getElementById('dfPlace'); if (!el) return;
  const pl = dfPlace();
  el.innerHTML = `📍 Sunrise is worked out for <b>${dfEsc(pl.label)}</b>${pl.dflt ? ' — pick the birth place on the form for exact sunrise' : ''}.`;
}
function dfBuild(pane){
  const had = document.getElementById('dfRoot'); if (had){ pane.appendChild(had); return; }   // already built (e.g. opened from the form before any chart)
  const p = document.createElement('div'); p.id = 'dfRoot'; pane.appendChild(p);
  const opt = (arr, first) => (first ? `<option value="">${first}</option>` : '') + arr.map((t, i) => `<option value="${i}">${dfEsc(t)}</option>`).join('');
  const signs = SIGNS.map(s => `${s.symbol} ${s.name}`);
  p.innerHTML = `
  <div class="rs-pane-head"><h3>🔎 Date Finder</h3><p>Not sure of the birth date? Add whatever the family remembers: full moon, a festival, the weekday… We check every day and list the ones that fit.</p></div>
  <details class="rs-how"><summary>💡 How it works (and how far to trust it)</summary>
    <p>You give a range of years and any clues. For every day in that range we work out the tithi, weekday, nakshatra, Moon sign, lunar month, festivals, eclipses and where Saturn, Jupiter and Rahu were (Lahiri, same engine as the rest of the app). A day is listed when it fits <b>all</b> your clues. With 3 or more clues we also show days that miss <b>just one</b> (memory is often slightly wrong), clearly marked.
    More clues = fewer dates. <b>Amavasya + Sunday + Diwali</b> within a few years usually gives one or two days.</p>
    <p><b>Good to know:</b> a day runs from sunrise to the next sunrise, so a tithi counts if it is active at sunrise <i>or</i> at some time that day. If the baby was born after midnight but before sunrise, also check the next date. Festival days follow the usual panchang rules; some regions keep a festival one day earlier or later, so use “± 1 day”. Eclipses are those visible somewhere on Earth (not checked for your town). Sunrise uses the place on the birth form (central India if none).</p></details>
  <div class="df-card"><h4>1 · Which years? <small>required</small></h4>
    <div class="df-grid"><label class="df-f">From year<input id="dfY0" type="number" inputmode="numeric" min="1900" max="2050" placeholder="e.g. 1968"></label>
    <label class="df-f">To year<input id="dfY1" type="number" inputmode="numeric" min="1900" max="2050" placeholder="e.g. 1972"></label></div>
    <div class="df-place" id="dfPlace"></div></div>
  <div class="df-card"><h4>2 · What do they remember?</h4>
    <div class="df-pills" id="dfQuick"><span class="df-pl">Quick:</span>
      <button type="button" class="df-pill" data-q="amav">🌑 Amavasya</button><button type="button" class="df-pill" data-q="purn">🌕 Purnima</button><button type="button" class="df-pill" data-q="ekad">Ekadashi</button>
      <button type="button" class="df-pill" data-q="shani">Shani Amavasya</button><button type="button" class="df-pill" data-q="somv">Somvati Amavasya</button><button type="button" class="df-pill" data-q="gurup">Guru Pushya</button><button type="button" class="df-pill" data-q="ravip">Ravi Pushya</button></div>
    <div class="df-grid">
      <label class="df-f">Paksha (moon phase)<select id="dfPak"><option value="">Any</option><option value="S">Shukla · growing moon</option><option value="K">Krishna · fading moon</option></select></label>
      <label class="df-f">Tithi<select id="dfTithi"><option value="">Any</option>${PN_TITHI.map((t, i) => `<option value="${i + 1}">${i + 1} · ${t}</option>`).join('')}<option value="P">🌕 Purnima (full moon)</option><option value="A">🌑 Amavasya (new moon)</option></select></label>
      <label class="df-f">Weekday<select id="dfWd"><option value="">Any</option>${PN_VARA.map((v, i) => `<option value="${i}">${v[1]}</option>`).join('')}</select></label>
      <label class="df-f">Festival<select id="dfFest"><option value="">None</option>${DF_FEST.map(f => `<option value="${f[0]}">${dfEsc(f[1])}</option>`).join('')}</select></label>
      <label class="df-f">How close to the festival / eclipse?<select id="dfTol"><option value="0">Same day</option><option value="1" selected>± 1 day</option><option value="2">± 2 days</option><option value="3">± 3 days</option><option value="7">± 1 week</option><option value="15">± 2 weeks</option></select></label>
    </div>
    <details class="df-more"><summary>More clues (eclipse, nakshatra, Moon sign, month, Saturn, Jupiter…)</summary>
      <div class="df-grid">
        <label class="df-f">Eclipse (grahan)<select id="dfEcl"><option value="">None</option><option value="solar">☀ Solar eclipse</option><option value="lunar">🌙 Lunar eclipse</option><option value="either">Either one</option></select></label>
        <label class="df-f">Nakshatra (birth star)<select id="dfNak">${opt(NAKSHATRAS.map(x => x.name), 'Any')}</select></label>
        <label class="df-f">Moon sign (rashi)<select id="dfMoon">${opt(signs, 'Any')}</select></label>
        <label class="df-f">Hindu lunar month<select id="dfMasa">${opt(PN_MASA, 'Any')}</select></label>
        <label class="df-f">Sun sign (Tamil / Malayalam month)<select id="dfSun">${opt(signs, 'Any')}</select></label>
        <label class="df-f">Year name (Samvatsara)<select id="dfSam">${opt(DF_SAM.map((s, i) => `${i + 1} · ${s}`), 'Any')}</select></label>
        <label class="df-f">Month (English)<select id="dfMon">${opt(PN_MON, 'Any').replace(/value="(\d+)"/g, (m0, v) => `value="${+v + 1}"`)}</select></label>
        <label class="df-f">Date number (1–31)<input id="dfDom" type="number" inputmode="numeric" min="1" max="31" placeholder="e.g. 14"></label>
        <label class="df-f">Saturn was in<select id="dfSat">${opt(signs, 'Any')}</select></label>
        <label class="df-f">Jupiter was in<select id="dfJup">${opt(signs, 'Any')}</select></label>
        <label class="df-f">Rahu was in<select id="dfRahu">${opt(signs, 'Any')}</select></label>
      </div>
      <label class="df-chk"><input type="checkbox" id="dfPurn"> Use North-India month names (Purnimanta: the fading half belongs to the next month)</label>
    </details></div>
  <div class="df-actions"><button type="button" class="btn btn-primary" id="dfRun">🔎 Find possible dates</button><button type="button" class="btn btn-ghost" id="dfClear">Clear</button><span class="df-count" id="dfCount"></span></div>
  <div id="dfOut"></div>`;
  const $ = id => p.querySelector('#' + id), val = id => $(id).value;
  const set = (id, v) => { $(id).value = v; };
  const count = () => {
    const ids = ['dfPak', 'dfTithi', 'dfWd', 'dfFest', 'dfEcl', 'dfNak', 'dfMoon', 'dfMasa', 'dfSun', 'dfSam', 'dfMon', 'dfDom', 'dfSat', 'dfJup', 'dfRahu'];
    let c = 0; ids.forEach(i => { if (val(i) !== '' && !(i === 'dfPak' && val('dfTithi') !== '')) c++; });
    $('dfCount').textContent = c ? `${c} clue${c > 1 ? 's' : ''} set` : 'Add at least one clue';
  };
  const clear = () => { p.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; }); set('dfTol', '1'); p.querySelectorAll('input[type=number]').forEach(i => { if (i.id !== 'dfY0' && i.id !== 'dfY1') i.value = ''; }); $('dfPurn').checked = false; count(); };
  p.addEventListener('input', count); p.addEventListener('change', count);
  dfPlaceNote(); count();
  const dob = (currentProfileForExport && currentProfileForExport.dob) || (document.getElementById('dobInput') || {}).value;
  if (dob && /^\d{4}/.test(dob)){ const y = +dob.slice(0, 4); set('dfY0', y - 1); set('dfY1', y + 1); }
  const Q = {
    amav: () => { clear(); set('dfTithi', 'A'); }, purn: () => { clear(); set('dfTithi', 'P'); }, ekad: () => { clear(); set('dfTithi', '11'); },
    shani: () => { clear(); set('dfTithi', 'A'); set('dfWd', '6'); }, somv: () => { clear(); set('dfTithi', 'A'); set('dfWd', '1'); },
    gurup: () => { clear(); set('dfNak', '7'); set('dfWd', '4'); }, ravip: () => { clear(); set('dfNak', '7'); set('dfWd', '0'); }
  };
  $('dfQuick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b){ Q[b.dataset.q](); count(); } });
  $('dfClear').addEventListener('click', () => { clear(); $('dfOut').innerHTML = ''; dfState.res = null; });
  $('dfRun').addEventListener('click', () => dfRun(p));
  p.addEventListener('click', e => {
    const use = e.target.closest('[data-df-use]'); if (use){ dfUse(use.dataset.dfUse); return; }
    const mo = e.target.closest('[data-df-more]'); if (mo){ dfDetail(p, +mo.dataset.dfMore, mo); return; }
    if (e.target.closest('#dfShowMore')){ dfState.shown += 40; dfRender(p); }
    const al = e.target.closest('#dfAlmostBtn'); if (al){ dfState.showAlmost = !dfState.showAlmost; dfRender(p); }
  });
}
function dfRead(p){
  const val = id => p.querySelector('#' + id).value, pl = dfPlace();
  let y0 = parseInt(val('dfY0'), 10), y1 = parseInt(val('dfY1'), 10);
  if (!isFinite(y0) && !isFinite(y1)){ rsToast('Enter the years first (e.g. 1968 to 1972) 📅'); return null; }
  if (!isFinite(y0)) y0 = y1; if (!isFinite(y1)) y1 = y0;
  if (y0 > y1){ const t = y0; y0 = y1; y1 = t; }
  if (y0 < 1900 || y1 > 2050){ rsToast('Please use years between 1900 and 2050'); return null; }
  if (y1 - y0 > 40){ rsToast('Please keep it within 40 years — add a narrower range'); return null; }
  const q = { y0, y1, lat: pl.lat, lon: pl.lon, tz: pl.tz, pak: val('dfPak'), tithi: val('dfTithi'), wd: val('dfWd'), fest: val('dfFest'), tol: val('dfTol'), ecl: val('dfEcl'), nak: val('dfNak'), moon: val('dfMoon'), masa: val('dfMasa'), sun: val('dfSun'), sam: val('dfSam'), mon: val('dfMon'), dom: val('dfDom'), sat: val('dfSat'), jup: val('dfJup'), rahu: val('dfRahu'), purn: p.querySelector('#dfPurn').checked };
  const any = q.pak || q.tithi || q.wd || q.fest || q.ecl || q.nak || q.moon || q.masa || q.sun || q.sam || q.mon || q.dom || q.sat || q.jup || q.rahu;
  if (!any){ rsToast('Add at least one clue (like Amavasya or a weekday) ✨'); return null; }
  return q;
}
function dfRun(p){
  const q = dfRead(p); if (!q) return;
  const out = p.querySelector('#dfOut'), run = ++dfState.run, g = dfGen(q);
  out.innerHTML = `<div class="df-prog"><div class="df-bar"><i id="dfBar" style="width:2%"></i></div><span>Looking through ${(q.y1 - q.y0 + 1) * 365} days…</span></div>`;
  const step = () => {
    if (run !== dfState.run) return;
    let r; const t0 = performance.now();
    try { do { r = g.next(); } while (!r.done && performance.now() - t0 < 40); }
    catch(e){ console.error('Date Finder', e); out.innerHTML = '<div class="df-empty">Something went wrong while searching. Please try a smaller range.</div>'; return; }
    if (r.done){ dfState.res = r.value; dfState.shown = 40; dfState.showAlmost = r.value.nFull === 0; dfRender(p); return; }
    const bar = p.querySelector('#dfBar'); if (bar) bar.style.width = Math.max(2, Math.round(r.value * 100)) + '%';
    setTimeout(step, 0);
  };
  setTimeout(step, 20);
}
function dfRender(p){
  const R = dfState.res, out = p.querySelector('#dfOut'); if (!R) return;
  const full = R.rows.filter(r => r.miss === 0), almost = R.rows.filter(r => r.miss > 0);
  const card = r => {
    const inf = dfInfo(R.ctx, r.i), miss = r.chips.filter(c => !c.ok).map(c => c.txt);
    return `<div class="df-res${r.miss ? ' near' : ''}"><div class="df-res-top"><div><div class="df-date">${dfFmtDate(inf.y, inf.m, inf.d, inf.wd)}</div>
      <div class="df-sub">${dfEsc(inf.tithi)} · ${dfEsc(inf.nak)} · ${inf.moonSign.symbol} Moon in ${inf.moonSign.name} · ${dfEsc(inf.masa)}${inf.adhika ? ' (Adhika)' : ''}</div></div>
      <div class="df-res-act"><button type="button" class="btn btn-primary" data-df-use="${r.date}">Use this date</button><button type="button" class="btn btn-ghost" data-df-more="${r.i}">Details</button></div></div>
      <div class="df-chips">${r.chips.map(c => `<span class="df-chip ${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '✕'} ${dfEsc(c.txt)}</span>`).join('')}${inf.fests.map(f => `<span class="df-chip fest">🎉 ${dfEsc(f)}</span>`).join('')}${inf.ecl.map(f => `<span class="df-chip fest">🌘 ${dfEsc(f)}</span>`).join('')}</div>
      ${r.miss ? `<div class="df-miss">Close match: does not fit ${dfEsc(miss.join(', '))}</div>` : ''}<div class="df-detail" id="dfD${r.i}" hidden></div></div>`;
  };
  let html = '';
  if (!full.length) html += `<div class="df-empty">No day fits <b>all</b> the clues in these years.${almost.length ? ' Below are days that miss just one clue.' : ' Try a wider range of years, fewer clues, or a bigger “how close” setting.'}</div>`;
  else html += `<div class="df-summary"><b>${full.length}</b> possible date${full.length > 1 ? 's' : ''} found${full.length > 12 ? ' — add more clues to narrow it down' : ''}.</div>${full.slice(0, dfState.shown).map(card).join('')}`;
  if (full.length > dfState.shown) html += `<button type="button" class="btn btn-ghost df-showmore" id="dfShowMore">Show more (${full.length - dfState.shown} left)</button>`;
  if (almost.length && full.length) html += `<button type="button" class="btn btn-ghost df-showmore" id="dfAlmostBtn">${dfState.showAlmost ? 'Hide' : 'Show'} ${almost.length} close match${almost.length > 1 ? 'es' : ''} (miss one clue)</button>`;
  if (almost.length && (dfState.showAlmost || !full.length)) html += `<div class="df-near-h">Close matches · miss one clue</div>${almost.slice(0, dfState.shown).map(card).join('')}`;
  out.innerHTML = html;
}
function dfDetail(p, i, btn){
  const R = dfState.res, box = p.querySelector('#dfD' + i); if (!R || !box) return;
  if (!box.hidden){ box.hidden = true; btn.textContent = 'Details'; return; }
  const ctx = R.ctx, q = ctx.q, inf = dfInfo(ctx, i), dateStr = ctx.dt(i).slice(0, 3).map((x, k) => k ? String(x).padStart(2, '0') : x).join('-');
  let pn = null; try { pn = panchangaAt(ctx.srj[i] + 0.01, q.lat, q.lon, q.tz); } catch(e){}
  const row = (a, b) => `<div class="df-drow"><span>${a}</span><b>${b}</b></div>`;
  let h = '';
  if (pn){
    h += row('Tithi', `${dfEsc(pn.tithi.paksha)} ${dfEsc(pn.tithi.name)} · ${dfFmtT(pn.tithi.start, q.tz, dateStr)} → ${dfFmtT(pn.tithi.end, q.tz, dateStr)}`);
    h += row('Nakshatra', `${dfEsc(pn.nakshatra.name)} (pada ${pn.nakshatra.pada}) · until ${dfFmtT(pn.nakshatra.end, q.tz, dateStr)}`);
    h += row('Yoga · Karana', `${dfEsc(pn.yoga.name)} · ${dfEsc(pn.karana.name)}`);
    h += row('Sunrise · Sunset', `${dfFmtT(pn.sunrise, q.tz, dateStr)} · ${dfFmtT(pn.sunset, q.tz, dateStr)}`);
  }
  h += row('Lunar month · year', `${dfEsc(inf.masa)}${inf.adhika ? ' (Adhika)' : ''} · ${dfEsc(inf.sam)} samvatsara`);
  h += row('Sun · Saturn · Jupiter · Rahu', `${inf.sun.symbol} ${inf.sun.name} · ${inf.sat.symbol} ${inf.sat.name} · ${inf.jup.symbol} ${inf.jup.name} · ${inf.rahu.symbol} ${inf.rahu.name}`);
  h += `<div class="df-tip">Next: press <b>Use this date</b>, then open <b>Time Dial</b> or <b>Sandhi Table</b> to find the time. Tithi and nakshatra end times above show which part of the day fits your clues.</div>`;
  box.innerHTML = h; box.hidden = false; btn.textContent = 'Hide details';
}
/* The same Date Finder also opens as a popup from the birth form, so it can be used before any chart exists. */
function dfModalOpen(){ const m = document.getElementById('dfModal'); return !!(m && m.classList.contains('show')); }
function dfOpenModal(){
  let m = document.getElementById('dfModal');
  if (!m){
    m = document.createElement('div'); m.id = 'dfModal'; m.className = 'df-modal';
    m.innerHTML = '<div class="df-modal-box" role="dialog" aria-modal="true" aria-label="Date Finder"><button type="button" class="df-x" id="dfX" aria-label="Close">✕</button><div id="dfModalBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('#dfX')) dfCloseModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && dfModalOpen()) dfCloseModal(); });
  }
  const body = document.getElementById('dfModalBody'); let root = document.getElementById('dfRoot');
  if (!root){ dfBuild(body); root = document.getElementById('dfRoot'); } else body.appendChild(root);
  const head = root.querySelector('.rs-pane-head'); if (head) head.style.paddingRight = '44px';
  dfPlaceNote(); m.classList.add('show'); document.body.style.overflow = 'hidden';
}
function dfCloseModal(){
  const m = document.getElementById('dfModal'); if (!m) return;
  m.classList.remove('show'); document.body.style.overflow = '';
  const root = document.getElementById('dfRoot'), pane = document.querySelector('.rs-pane[data-rs-pane="dates"]');
  if (root && pane) pane.appendChild(root);
}
function dfUse(dateStr){
  const el = document.getElementById('dobInput'); if (!el) return;
  el.value = dateStr;
  ['input', 'change'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  try { inSyncFriendly(); } catch(e){}
  rsToast('Birth date set to ' + dateStr + '. Now add the place and time ✨');
  const wasModal = dfModalOpen(); if (wasModal) dfCloseModal();
  try { if (!wasModal) switchAppTab('panel-home'); const f = document.getElementById('birthForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e){}
}

/* ---------------------------- Life-Event checker ---------------------------- */
function rsBuildLife(p){
  p.innerHTML = `
  <div class="rs-pane-head"><h3>🌟 Life-Event Checker</h3><p>Real events are the best proof. We test every possible rising sign against your dashas and slow transits.</p></div>
  <details class="rs-how"><summary>💡 How it works (and how far to trust it)</summary>
    <p>For each possible rising sign we ask: <em>at the date of each event, were the running Mahadasha / Antardasha / Pratyantardasha lords linked to the houses that rule that kind of event?</em>
    Houses a planet is linked to = the house it sits in plus the houses it rules. Jupiter and Saturn transits to those houses add a bonus. Scores are relative, a ranking and not a proof.
    Add <b>3 or more</b> dated events (marriage, job, child, move…) for a meaningful result. Treat the answer as a clue to confirm with the other tools.</p></details>
  <div class="rs-ev-form">
    <label>Event<select id="rsEvCat">${Object.keys(RS_CATS).map(k=>`<option value="${k}">${RS_CATS[k].label}</option>`).join('')}</select></label>
    <label>Date<input type="date" id="rsEvDate"></label>
    <label class="grow">Note (optional)<input type="text" id="rsEvNote" maxlength="40" placeholder="e.g. first job"></label>
    <button type="button" class="btn btn-ghost" id="rsEvAdd">＋ Add event</button>
  </div>
  <div id="rsEvList" class="rs-ev-list"></div>
  <div class="rs-ev-opts">
    <label>Search around your working time<select id="rsEvWin">
      <option value="12">Whole day · all 12 signs</option><option value="6">± 6 hours</option><option value="3" selected>± 3 hours</option><option value="1.5">± 90 minutes</option></select></label>
    <button type="button" class="btn btn-primary" id="rsEvRun">✨ Find the best-fitting rising sign</button>
  </div>
  <div id="rsEvOut"></div>`;
  p.querySelector('#rsEvAdd').addEventListener('click', ()=>{
    const d = document.getElementById('rsEvDate').value, c = document.getElementById('rsEvCat').value, n = document.getElementById('rsEvNote').value.trim();
    if (!d){ rsToast('Pick the event date first 📅'); return; }
    const p0 = currentProfileForExport;
    if (p0 && d < p0.dob){ rsToast('That date is before the birth date'); return; }
    rsState.events.push({ c, d, n }); rsState.events.sort((a,b)=> a.d<b.d?-1:1);
    rsSaveEvents(); rsRenderEvents(); document.getElementById('rsEvDate').value=''; document.getElementById('rsEvNote').value='';
    rsToast('Event added ✓');
  });
  p.querySelector('#rsEvList').addEventListener('click', e=>{
    const b = e.target.closest('[data-rs-del]'); if (!b) return;
    rsState.events.splice(+b.dataset.rsDel,1); rsSaveEvents(); rsRenderEvents();
  });
  p.querySelector('#rsEvRun').addEventListener('click', rsRunLife);
  p.addEventListener('click', e=>{
    const b = e.target.closest('[data-rs-use]'); if (!b) return;
    const off = +b.dataset.rsUse, dEl = document.getElementById('rectDate');
    const base = shiftLocalDateTime(dEl.value, document.getElementById('rectCenterTime').value, off);
    dEl.value = base.dateStr;
    const pr = base.timeStr.split(':').map(Number); rectHms = { h:pr[0], m:pr[1], s:pr[2]||0 }; updateHmsDisplay();
    rsToast('Dial set to ' + base.timeStr.slice(0,5) + ' ✓'); rsShow('dial', true);
  });
}
function rsRenderEvents(){
  const el = document.getElementById('rsEvList'); if (!el) return;
  if (!rsState.events.length){ el.innerHTML = `<div class="rs-empty">No events yet. Add your first one above. Marriage, a job, a child, a big move all work well.</div>`; return; }
  el.innerHTML = rsState.events.map((e,i)=>`<span class="rs-evchip"><b>${RS_CATS[e.c]?RS_CATS[e.c].label:rsEsc(e.c)}</b> · ${rsEsc(e.d)}${e.n?` · ${rsEsc(e.n)}`:''}<button type="button" data-rs-del="${i}" aria-label="Remove">✕</button></span>`).join('') +
    (rsState.events.length<3 ? `<div class="rs-empty" style="margin-top:8px">Tip: ${3-rsState.events.length} more event${3-rsState.events.length>1?'s':''} will make the ranking much more reliable.</div>` : '');
}

function rsHouseOf(sign, L){ return ((sign - L + 12) % 12) + 1; }
function rsLinks(P, L, chart){
  // houses planet P is linked to from lagna L: occupied + owned (nodes also act through their sign lord)
  const out = {};
  const add = (h, why)=>{ if (!out[h]) out[h] = why; };
  const pl = chart.planets[P]; if (!pl) return out;
  add(rsHouseOf(pl.sign, L), 'sits in H'+rsHouseOf(pl.sign, L));
  const owner = (P==='Rahu'||P==='Ketu') ? SIGNS[pl.sign].lord : P;
  for (let s=0;s<12;s++) if (SIGNS[s].lord===owner) add(rsHouseOf(s,L), (owner===P?'rules':'via '+owner+' rules')+' H'+rsHouseOf(s,L));
  if (owner!==P && chart.planets[owner]) add(rsHouseOf(chart.planets[owner].sign, L), 'via '+owner+' in H'+rsHouseOf(chart.planets[owner].sign, L));
  return out;
}
function rsScore(P, L, cat, chart){
  const links = rsLinks(P, L, chart); let sc = 0; const hits = [];
  Object.keys(links).forEach(h=>{
    h = +h;
    if (cat.p.indexOf(h)>-1){ sc += 2; hits.push(links[h]+' ★'); }
    else if (cat.s.indexOf(h)>-1){ sc += 1; hits.push(links[h]); }
  });
  if (cat.k.indexOf(P)>-1) sc += 0.5;
  return { sc, hits };
}
function rsEvalLagna(L, chart, evs){
  let total = 0; const detail = [];
  evs.forEach(ev=>{
    const cat = RS_CATS[ev.c]; if (!cat) return;
    let s = 0; const lines = [];
    [['Mahadasha', ev.md, 1],['Antardasha', ev.ad, 1],['Pratyantardasha', ev.pd, .5]].forEach(([nm,P,w])=>{
      if (!P) return; const r = rsScore(P, L, cat, chart); s += r.sc*w;
      lines.push(`${nm} ${P}${r.hits.length?': '+r.hits.join(', '):': no link'}`);
    });
    // slow transits
    let tHit = 0;
    [['Jupiter',[0,4,6,8]],['Saturn',[0,2,6,9]]].forEach(([P,offs])=>{
      const hs = rsHouseOf(ev.tr[P], L); const set = offs.map(o=> ((hs-1+o)%12)+1);
      const pm = set.filter(h=> cat.p.indexOf(h)>-1).length>0, sm = set.filter(h=> cat.s.indexOf(h)>-1).length>0;
      if (pm){ s += 1; tHit++; lines.push(`${P} transit reaches H${cat.p.filter(h=>set.indexOf(h)>-1).join('/H')} ★`); }
      else if (sm){ s += .4; }
    });
    if (tHit===2){ s += 1; lines.push('Double transit ✨'); }
    total += s; detail.push({ ev, s, lines });
  });
  return { total, detail };
}

function rsRunLife(){
  const out = document.getElementById('rsEvOut'); if (!out) return;
  const chart = currentChartForModal, prof = currentProfileForExport;
  if (!chart || !prof){ out.innerHTML = `<div class="rs-empty">Generate a chart first.</div>`; return; }
  if (!rsState.events.length){ rsToast('Add at least one event first'); out.innerHTML = `<div class="rs-empty">Add some dated events above, then press the button again.</div>`; return; }
  const tz = prof.tz || 0;
  const evs = rsState.events.map(e=>{
    const [y,m,d] = e.d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m-1, d, 12) - tz*3600000);
    const jd = dt.getTime()/86400000 + 2440587.5;
    const act = findActiveDasha(chart.dashaData.mahadashas, dt) || {};
    return { c:e.c, d:e.d, n:e.n, md: act.mahadasha&&act.mahadasha.lord, ad: act.antardasha&&act.antardasha.lord, pd: act.pratyantardasha&&act.pratyantardasha.lord,
      tr:{ Jupiter: Math.floor(getSiderealLongitudeAt('Jupiter', jd)/30), Saturn: Math.floor(getSiderealLongitudeAt('Saturn', jd)/30) } };
  });
  // which rising signs occur in the chosen window, and when
  const dEl = document.getElementById('rectDate'), tStr = document.getElementById('rectCenterTime').value;
  const half = parseFloat(document.getElementById('rsEvWin').value)*3600, step = half>14000 ? 240 : 120;
  const segs = []; let cur = null;
  for (let off=-half; off<=half; off+=step){
    const sh = shiftLocalDateTime(dEl.value, tStr, off);
    const sg = rectifyPoint(sh.dateStr, sh.timeStr, prof.lat, prof.lon, tz).asc.sign;
    if (cur && cur.sign===sg) cur.end = off+step; else { cur = { sign:sg, start:off, end:off+step }; segs.push(cur); }
  }
  const bySign = {};
  segs.forEach(s=>{ (bySign[s.sign] = bySign[s.sign] || []).push(s); });
  const ranked = Object.keys(bySign).map(k=>{ const L=+k, r = rsEvalLagna(L, chart, evs); return { L, total:r.total, detail:r.detail, segs:bySign[k] }; })
    .sort((a,b)=> b.total-a.total);
  const best = ranked[0].total || 1;
  const fmt = off=>{
    const sh = shiftLocalDateTime(dEl.value, tStr, off); const day = sh.dateStr===dEl.value ? '' : (sh.dateStr>dEl.value?' +1d':' −1d');
    return sh.timeStr.slice(0,5)+day;
  };
  const close = ranked.length>1 && ranked[1].total >= ranked[0].total*0.9;
  out.innerHTML = `
    <div class="rs-res-head">Ranking of possible rising signs <span>${evs.length} event${evs.length>1?'s':''} tested</span></div>
    ${ranked.map((r,i)=>{
      const pct = Math.round(r.total/best*100), sg = SIGNS[r.L];
      return `<div class="rs-rank ${i===0?'top':''}">
        <div class="rs-rank-row"><span class="rs-rank-n">${i===0?'👑':i+1}</span><b>${sg.symbol} ${sg.name}</b>
          <div class="rs-bar"><i data-w="${pct}"></i></div><em>${pct}%</em></div>
        <div class="rs-rank-segs">${r.segs.map(s=>`<button type="button" class="rs-seg" data-rs-use="${Math.round((s.start+s.end)/2)}" title="Set the dial to the middle of this window">🕰️ ${fmt(s.start)} – ${fmt(s.end)} <u>use ➜</u></button>`).join('')}</div>
        <details class="rs-why"><summary>Why this score?</summary>${r.detail.map(x=>`<div class="rs-why-ev"><b>${RS_CATS[x.ev.c]?RS_CATS[x.ev.c].label:''} · ${rsEsc(x.ev.d)}</b><ul>${x.lines.map(l=>`<li>${rsEsc(l)}</li>`).join('')}</ul></div>`).join('')}</details>
      </div>`;
    }).join('')}
    <div class="rs-note">${close?'⚖️ <b>Close call.</b> The top signs are within 10%. Add more events or check the Sandhi / Varga tools. ':''}Times are in your birth timezone and are approximate to a few minutes. Use <b>"use ➜"</b> to load a window into the Time Dial. This ranking supports your judgement, it does not replace it.</div>`;
  requestAnimationFrame(()=> requestAnimationFrame(()=> out.querySelectorAll('.rs-bar i').forEach(b=> b.style.width = b.dataset.w+'%')));
  rsToast('Done ✨ Top fit: ' + SIGNS[ranked[0].L].name);
}

/* Hooks: keep old panel ids working + keep clock/pill live */
(function rsInstallHooks(){
  if (window.__rsHooks) return; window.__rsHooks = 1;
  const _sw = switchAppTab;
  switchAppTab = function(id){
    if (RS_ROUTE[id] && document.getElementById('rsRoot')){
      _sw('panel-rectification'); rsShow(RS_ROUTE[id]); return;
    }
    _sw(id); if (id==='panel-rectification' && document.getElementById('rsRoot')) rsRefresh();
  };
  const _up = updateHmsDisplay;
  updateHmsDisplay = function(){ _up(); try{ rsRefresh(); }catch(e){} };
})();

/* ============================================================================
   SMART SEARCH — one box to find any tool, any placement in YOUR chart, and the meaning of any term.
   Opens from the 🔍 button, Ctrl/Cmd+K or "/". Enter = go, ↑↓ = move, Esc = close. Falls back to Google / Google AI.
   ============================================================================ */
const SRCH_PLANET = {
  Sun:'Soul, vitality, father, authority, government, confidence, heart and bones.',
  Moon:'Mind, emotions, mother, home, public, comfort, intuition, fluids.',
  Mars:'Energy, courage, siblings, land, property, surgery, competition.',
  Mercury:'Intellect, speech, trade, writing, skin, nerves, friends.',
  Jupiter:'Wisdom, children, teachers, wealth, dharma, faith, growth.',
  Venus:'Love, spouse, comforts, art, vehicles, luxury, fertility.',
  Saturn:'Discipline, delay, karma, service, longevity, structure, sorrow.',
  Rahu:'Obsession, foreign, sudden gains, illusion, technology, ambition.',
  Ketu:'Detachment, moksha, past-life skill, intuition, loss, spirituality.',
  Uranus:'Sudden change, rebellion, invention, freedom (outer planet).',
  Neptune:'Dreams, imagination, illusion, compassion (outer planet).',
  Pluto:'Transformation, power, rebirth, hidden forces (outer planet).'
};
const SRCH_HOUSE = ['Self, body, personality, vitality','Wealth, speech, family, food','Courage, siblings, effort, short travel','Home, mother, comforts, property, peace of mind','Children, intellect, creativity, romance, past merit','Enemies, debts, illness, service, daily work','Marriage, partnerships, business, spouse','Longevity, transformation, inheritance, occult, sudden events','Fortune, dharma, father, teachers, long journeys','Career, status, karma, authority','Gains, income, friends, fulfilled desires','Losses, expenses, foreign lands, sleep, moksha'];
const SRCH_ORD = ['1st first','2nd second','3rd third','4th fourth','5th fifth','6th sixth','7th seventh','8th eighth','9th ninth','10th tenth','11th eleventh','12th twelfth'];
let srchSel = 0, srchRows = [];

function srchBuild(){
  const I = [], ch = (typeof currentChartForModal !== 'undefined') ? currentChartForModal : null;
  const add = (k,ico,t,s,kw,go,q)=> I.push({k,ico,t,s:s||'',kw:(kw||''),go,q:q||t});
  HOME_ITEMS.forEach(i=> add('page',i[1],i[2],i[3],i[4]+' '+i[5]+' open go tool tab '+i[0].replace('panel-','')+(i[5]==='rectify'?' rectify rectification birth time correct fix':''),i[0]));
  if (ch){
    const pr = ch.planets || {};
    PLANET_LIST.forEach(n=>{
      const p = pr[n]; if (!p) return; const sg = SIGNS[p.sign];
      add('planet','🪐',`${n} in ${sg.name}${p.retrograde?' (R)':''}`,`House ${p.house} · ${p.nakshatra?p.nakshatra.name+' pada '+p.nakshatra.pada:''} · ${(p.dignity&&p.dignity.status&&p.dignity.status!=='Neutral')?p.dignity.status+' · ':''}${SRCH_PLANET[n]}`,
        `${n} ${sg.name} ${sg.sk} house ${p.house} h${p.house} ${p.nakshatra?p.nakshatra.name:''} ${p.dignity?p.dignity.status:''} my placement chart`,'panel-planets',`${n} in ${sg.name} in house ${p.house}`);
    });
    if (ch.outer) Object.keys(ch.outer).forEach(n=>{ const p = ch.outer[n]; if (!p) return;
      add('planet','🔭',`${n} in ${SIGNS[p.sign].name}`,`House ${p.house} — ${SRCH_PLANET[n]||''}`,`${n} outer planet ${SIGNS[p.sign].name} house ${p.house}`,'panel-planets',`${n} in ${SIGNS[p.sign].name} in house ${p.house}`); });
    const asc = ch.ascendant.sign;
    add('chart','⬆️',`Ascendant: ${SIGNS[asc].name} ${ch.ascendant.degInSign.toFixed(1)}°`,`Lagna lord ${SIGNS[asc].lord} · ${ch.ascendant.nakshatra?ch.ascendant.nakshatra.name:''}`,`ascendant lagna rising ${SIGNS[asc].name} ${SIGNS[asc].sk}`,'panel-overview',`${SIGNS[asc].name} ascendant lagna`);
    for (let h=1;h<=12;h++){
      const si = (asc+h-1)%12, s = SIGNS[si], lp = pr[s.lord];
      const occ = PLANET_LIST.filter(n=> pr[n] && pr[n].house===h).join(', ');
      add('house','🏠',`House ${h} · ${s.name}`,`${SRCH_HOUSE[h-1]} · Lord ${s.lord}${lp?' in H'+lp.house:''}${occ?' · '+occ:' · empty'}`,`house ${h} h${h} ${SRCH_ORD[h-1]} bhava ${s.name} ${s.lord} ${SRCH_HOUSE[h-1]}`,'panel-overview',`${h}th house ${SRCH_HOUSE[h-1].split(',')[0]} vedic astrology`);
    }
    try {
      const a = findActiveDasha(ch.dashaData.mahadashas, new Date());
      if (a && a.mahadasha) add('dasha','⏳',`Running dasha: ${a.mahadasha.lord} / ${a.antardasha?a.antardasha.lord:'-'}${a.pratyantardasha?' / '+a.pratyantardasha.lord:''}`,`Until ${a.antardasha?a.antardasha.endDate.toDateString():''} · ${SRCH_PLANET[a.mahadasha.lord]||''}`,`dasha mahadasha antardasha running now current period time ${a.mahadasha.lord}`,'panel-dasha',`${a.mahadasha.lord} mahadasha ${a.antardasha?a.antardasha.lord:''} antardasha results`);
    } catch(e){}
    try {
      Object.keys(ch.yogas||{}).forEach(k=>{
        const v = ch.yogas[k], list = Array.isArray(v) ? v : (v && typeof v==='object' ? [v] : []);
        const label = k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
        list.forEach(y=>{ const nm = y.yoga||y.name||y.type||label;
          add('yoga','✨',`${nm} yoga`,`${label}${y.planet?' · '+y.planet:''}${y.house?' · house '+y.house:''}`,`yoga ${nm} ${label} ${y.planet||''}`,'panel-yogas',`${nm} yoga vedic astrology`); });
      });
    } catch(e){}
  }
  if (ch) SRCH_TOPICS.forEach((tp,i)=>{ I.push({k:'topic',ico:tp.ico,t:'Ask AI: '+tp.t+' ›',s:tp.subs.map(x=>x[0]).join(' · '),kw:'ask ai '+tp.t+' '+tp.kw+' about my chart google ai mode',go:null,q:tp.t,tp,ti:i});
    tp.subs.forEach(sb=> I.push({k:'ask',ico:tp.ico,t:tp.t+' › '+sb[0],s:sb[1],kw:'ask ai '+tp.kw+' '+sb[0],go:null,q:tp.t,tp,sub:sb})); });
  SIGNS.forEach((s,i)=> add('term',s.symbol,`${s.name} (${s.sk})`,`${s.element} · ${s.modality} · ruled by ${s.lord}`,`sign rashi ${s.name} ${s.sk} ${s.element} ${s.modality} ${s.lord}`,null,`${s.name} rashi ${s.sk} meaning`));
  NAKSHATRAS.forEach((n,i)=> add('term','🌟',`${n.name} nakshatra`,`#${i+1} · lord ${n.lord} · deity ${n.deity}`,`nakshatra star ${n.name} ${n.lord} ${n.deity}`,null,`${n.name} nakshatra characteristics`));
  Object.keys(SRCH_PLANET).forEach(n=> add('term','📖',`${n} — what it signifies`,SRCH_PLANET[n],`graha planet meaning karaka ${n} ${SRCH_PLANET[n]}`,null,`${n} in vedic astrology significations`));
  return I;
}
function srchRank(q){
  const items = srchBuild(), toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  const W = { page:2, ask:3.2, topic:3.4, planet:3, house:3, chart:3, dasha:3.5, yoga:2.5, term:1 };
  const out = [];
  items.forEach(it=>{
    const hay = (it.t+' '+it.kw+' '+it.s).toLowerCase(), tl = it.t.toLowerCase(); let sc = 0, ok = true;
    for (const t of toks){
      if (hay.indexOf(t) < 0){ ok = false; break; }
      sc += tl.indexOf(t)===0 ? 6 : tl.indexOf(t)>0 ? 4 : (' '+it.kw.toLowerCase()).indexOf(' '+t)>=0 ? 2.5 : 1;
    }
    if (ok) out.push({it, sc: sc + (W[it.k]||1)});
  });
  return out.sort((a,b)=> b.sc-a.sc).slice(0,30).map(x=>x.it);
}
function srchRecent(){ try { const v = JSON.parse(localStorage.getItem('vax_srch_recent')||'[]'); return Array.isArray(v)?v:[]; } catch(e){ return []; } }
function srchRemember(q){ q = q.trim(); if (!q) return; try { const r = [q].concat(srchRecent().filter(x=>x!==q)).slice(0,6); localStorage.setItem('vax_srch_recent', JSON.stringify(r)); } catch(e){} }
function srchGoogle(q, ai){ const u = 'https://www.google.com/search?q='+encodeURIComponent(q+' vedic astrology')+(ai?'&udm=50':''); window.open(u,'_blank','noopener'); }

function srchOpen(prefill){
  let ov = document.getElementById('srchOv');
  if (!ov){
    ov = document.createElement('div'); ov.id = 'srchOv'; ov.className = 'srch-ov';
    ov.innerHTML = `<div class="srch-box" role="dialog" aria-label="Search">
      <div class="srch-handle"></div><div class="srch-top"><span class="srch-mag">🔍</span><input id="srchIn" type="search" autocomplete="off" spellcheck="false" placeholder="Search tools, planets, houses, yogas, meanings…"><button type="button" class="srch-clr" id="srchClr" aria-label="Clear" hidden>✕</button><kbd>Esc</kbd><button type="button" class="srch-x" id="srchX" aria-label="Close">Done</button></div>
      <div class="srch-list" id="srchList"></div>
      <div class="srch-foot"><span>↑↓ move · Enter open · 🌐 Google it</span>
        <button type="button" class="srch-click" id="srchClick" title="When on, click anything in a chart to Google it">🖱️ Click-to-Google <b id="srchClickState">off</b></button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e=>{ if (e.target===ov) srchClose(); });
    const inp = ov.querySelector('#srchIn');
    inp.addEventListener('input', ()=>{ srchRender(inp.value); document.getElementById('srchClr').hidden = !inp.value; });
    ov.querySelector('#srchClr').addEventListener('click', ()=>{ inp.value=''; document.getElementById('srchClr').hidden=true; srchRender(''); inp.focus(); });
    ov.querySelector('#srchX').addEventListener('click', srchClose);
    inp.addEventListener('keydown', e=>{
      if (e.key==='ArrowDown'){ e.preventDefault(); srchMove(1); }
      else if (e.key==='ArrowUp'){ e.preventDefault(); srchMove(-1); }
      else if (e.key==='Enter'){ e.preventDefault(); srchAct(srchSel, e.shiftKey || e.ctrlKey || e.metaKey); }
      else if (e.key==='Escape'){ srchClose(); }
    });
    ov.querySelector('#srchList').addEventListener('click', e=>{
      const g = e.target.closest('[data-g]'); if (g){ const rr = srchRows[+g.dataset.g]; srchRemember(inp.value); if (rr.k==='ask') srchAsk(rr.tp, rr.sub, true); else srchGoogle(rr.q, false); return; }
      const r = e.target.closest('[data-i]'); if (r) srchAct(+r.dataset.i);
      if (e.target.closest('[data-back]')){ srchRender(inp.value); return; }
      const a = e.target.closest('[data-ask]'); if (a){ srchTopicBox(+a.dataset.ask); return; }
      const c = e.target.closest('[data-chip]'); if (c){ inp.value = c.dataset.chip; srchRender(inp.value); inp.focus(); }
    });
    ov.querySelector('#srchClick').addEventListener('click', ()=>{ const t = document.getElementById('qsearchToggle'); if (t) t.click(); srchClickState(); });
  }
  ov.classList.add('show'); document.body.classList.add('srch-lock');
  const inp = ov.querySelector('#srchIn'); inp.value = prefill || ''; document.getElementById('srchClr').hidden = !inp.value; srchRender(inp.value); srchClickState(); setTimeout(()=> inp.focus(), 30);
}
function srchClickState(){ const s = document.getElementById('srchClickState'); if (s) s.textContent = (typeof qsearchActive!=='undefined' && qsearchActive) ? 'ON' : 'off'; const b = document.getElementById('srchClick'); if (b) b.classList.toggle('on', typeof qsearchActive!=='undefined' && qsearchActive); }
function srchClose(){ const ov = document.getElementById('srchOv'); if (ov) ov.classList.remove('show'); document.body.classList.remove('srch-lock'); }
function srchMove(d){
  if (!srchRows.length) return; srchSel = (srchSel + d + srchRows.length) % srchRows.length;
  const list = document.getElementById('srchList');
  list.querySelectorAll('.srch-row').forEach((r,i)=> r.classList.toggle('sel', i===srchSel));
  const el = list.querySelector('.srch-row.sel'); if (el) el.scrollIntoView({ block:'nearest' });
}
function srchAct(i, google){
  const r = srchRows[i]; if (!r) return; const q = document.getElementById('srchIn').value;
  if (r.k==='topic'){ srchTopicBox(r.ti); return; }
  if (r.k==='ask'){ srchRemember(q || r.t); srchAsk(r.tp, r.sub, !!google); return; }
  if (r.k==='google' || r.k==='ai'){ srchRemember(q); srchGoogle(q, r.k==='ai'); return; }
  srchRemember(q || r.t);
  if (google || !r.go){ srchGoogle(r.q, false); if (r.go) {} return; }
  srchClose(); switchAppTab(r.go);
}
function srchRender(q){
  const list = document.getElementById('srchList'); if (!list) return;
  q = (q||'').trim(); let html = '';
  if (!q){
    const hasChart = typeof currentChartForModal !== 'undefined' && currentChartForModal;
    const rec = srchRecent();
    srchRows = srchBuild().filter(x=> x.k==='dasha').concat(HOME_ITEMS.slice(0,0).map(()=>null)).filter(Boolean);
    ['panel-rectification','panel-dasha','panel-transit','panel-vargas','panel-yogas','panel-reading'].forEach(id=>{
      const it = HOME_ITEMS.find(h=>h[0]===id); if (it) srchRows.push({k:'page',ico:it[1],t:it[2],s:it[3],go:id,q:it[2]});
    });
    if (hasChart){ html += srchGroupsHTML(); }
    html += `<div class="srch-h">${hasChart?'Right now & popular':'Popular tools'}</div>`;
    if (rec.length) html = `<div class="srch-h">Recent</div><div class="srch-chips">${rec.map(r=>`<button type="button" data-chip="${rsEsc(r)}">${rsEsc(r)}</button>`).join('')}</div>` + html;
    html += srchRows.map((r,i)=> srchRowHTML(r,i)).join('');
    html += `<div class="srch-tip">Try: <button data-chip="mars">mars</button> <button data-chip="7th house">7th house</button> <button data-chip="dasha">dasha</button> <button data-chip="rectify">rectify</button> <button data-chip="rohini">rohini</button> <button data-chip="gaja">gaja kesari</button></div>`;
  } else {
    srchRows = srchRank(q);
    html += srchRows.length ? '' : `<div class="srch-none">No match inside the app for “${rsEsc(q)}”. Try Google below 👇</div>`;
    html += srchRows.map((r,i)=> srchRowHTML(r,i)).join('');
    const base = srchRows.length;
    srchRows.push({k:'google',ico:'🌐',t:`Google “${q}”`,s:'Search the web with “vedic astrology” added',q}); html += srchRowHTML(srchRows[base], base);
    srchRows.push({k:'ai',ico:'🤖',t:`Ask Google AI about “${q}”`,s:'AI answer with sources',q}); html += srchRowHTML(srchRows[base+1], base+1);
  }
  srchSel = 0; list.innerHTML = html; list.scrollTop = 0;
  const first = list.querySelector('.srch-row'); if (first) first.classList.add('sel');
}

const SRCH_GROUPS = [
  ['🪞','Know yourself',['me','purpose','mind','talent','spiritual','karma','karmapat','thisyear']],
  ['❤️','Love & relationships',['love','lovers','soulmate','chemistry','breakup','partnerfit','spouse','marriagetime','marriedlife','karmarel','children']],
  ['💰','Money & career',['career','job','money','moneyblocks','wealthboost','fame','inherit','losses','property','foreign']],
  ['🏡','Family, health & remedies',['health','longevity','father','mother','siblings','friends','enemies','education','remedies']]
];
function srchGroupsHTML(){
  const seen = {}; let n = 0;
  let out = '<div class="srch-hero"><b>✨ Ask AI about your chart</b><small>Pick a topic, then a question. Opens Google AI with your exact chart data.</small></div>';
  const tile = (tp,i)=> `<button type="button" class="srch-tile" data-ask="${i}" style="--d:${(n++%12)*28}ms"><span>${tp.ico}</span><b>${rsEsc(tp.t)}</b><small>${tp.subs.length} questions</small></button>`;
  SRCH_GROUPS.forEach(g=>{
    const tiles = g[2].map(id=>{ const i = SRCH_TOPICS.findIndex(t=>t.id===id); if (i<0 || seen[i]) return ''; seen[i]=1; return tile(SRCH_TOPICS[i], i); }).join('');
    if (tiles) out += `<div class="srch-grp"><span>${g[0]}</span>${g[1]}</div><div class="srch-tiles">${tiles}</div>`;
  });
  const rest = SRCH_TOPICS.map((tp,i)=> seen[i]?'':tile(tp,i)).join('');
  if (rest.trim()) out += `<div class="srch-grp"><span>🔎</span>More</div><div class="srch-tiles">${rest}</div>`;
  return out;
}
function srchRowHTML(r,i){
  const tag = { page:'Open', planet:'Your chart', house:'Your chart', chart:'Your chart', dasha:'Your chart', yoga:'Your chart', term:'Learn', ask:'Ask AI', topic:'Ask AI ›', google:'Web', ai:'Web' }[r.k] || '';
  return `<div class="srch-row ${i===0?'sel':''}" data-i="${i}" data-k="${r.k}"><span class="srch-ico">${r.ico}</span><div class="srch-txt"><b>${rsEsc(r.t)}</b><small>${rsEsc((r.s||'').slice(0,150))}</small></div><span class="srch-tag">${tag}</span>${r.k!=='google'&&r.k!=='ai'?`<button type="button" class="srch-g" data-g="${i}" title="${r.k==='ask'?'Copy the full brief':'Google this'}">${r.k==='ask'?'📋':'🌐'}</button>`:''}</div>`;
}
document.addEventListener('keydown', e=>{
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName) || (e.target && e.target.isContentEditable);
  if ((e.key==='k' || e.key==='K') && (e.ctrlKey || e.metaKey)){ e.preventDefault(); srchOpen(); }
  else if (e.key==='/' && !typing && document.getElementById('appTabbar') && document.getElementById('appTabbar').classList.contains('show')){ e.preventDefault(); srchOpen(); }
  else if (e.key==='Escape') srchClose();
});
document.addEventListener('click', e=>{
  if (e.target.closest && e.target.closest('#quickSearchBtn')){ e.preventDefault(); e.stopImmediatePropagation(); srchOpen(); }
}, true);

/* ---------- Ask-AI: topic → small box of focused questions → Google AI mode ---------- */
const SRCH_STYLE = 'RULES: (1) Use ONLY the CHART DATA below. It is exact and authoritative: never invent, change or guess any sign, house, degree, aspect or planet; if something is not listed, do not claim it; if your memory disagrees with the data, the data wins. (2) Be PRECISE, not generic: every point must be a specific, checkable behaviour, habit, event, body area, relationship scenario or age window that a person can test against their own life. Forbidden: statements that fit almost anyone (e.g. "you value...", "sometimes you...", "deep down...", "you can be both..."). Prefer concrete contrasts and numbers. (3) BLEND, do not list: combine Lagna + Sun + Moon signs, conjunctions and aspects from the data into one picture, and say how each aspect or conjunction modifies the trait or event (example style: Saturn+Ketu together in a fire sign -> a specific accident/injury or detachment pattern). (4) End every bullet with a tiny tag: 🔎 Because: <exact combination from the data>. (5) FORMAT: bold headline with an emoji verdict; 3-5 sections with emoji + CAPS headline; tight ranked bullets; ✅ strengths, ⚠️ cautions, ⏳ timing; finish with 🎯 Bottom line in one sentence. Plain words, no jargon. Health topics: one-line not-medical-advice note.';
const SRCH_TOPICS = [
 {id:'me',ico:'🪞',t:'This is me — precise self-check',kw:'verify my chart is mine personality blend aspects conjunction accuracy relatable self reflect barnum',h:[1],s:[5,9],k:['Sun','Moon'],ck:'Atmakaraka',v:'D1',ar:['AL'],subs:[
  ['✅ Verify: is this chart mine? (10 checks)','Give 10 very specific, hard-to-fake statements about my PAST and everyday life that I can mark ✔ or ✖: childhood or family situation, a recurring health/injury/body-mark pattern, a relationship scenario that repeats, a school or work turning point with an approximate age window, habits, living situation, parents/siblings facts. Rank from most to least confident. End with: how many ✔ out of 10 would confirm this chart is mine, and which of the 10 depend on the exact birth time (Lagna/house based) versus Sun/Moon-sign based ones that survive a time error.'],
  ['🧬 My personality blend (Lagna + Sun + Moon)','Explain my personality as ONE blend. Three short blocks: Outer me (Lagna sign + planets in/aspecting Lagna), Core me (Sun sign + what conjoins/aspects Sun), Inner me (Moon sign + what conjoins/aspects Moon). Then say precisely where these three clash or reinforce, and how each aspect/conjunction in the data shifts the behaviour. Give 10 relatable but non-generic behaviours I can recognise in myself.'],
  ['🔗 What each aspect & conjunction does to me','Go through EVERY conjunction and EVERY aspect in the data. For each: one line on exactly how it changes my behaviour or life events (be concrete: situations, reactions, accident/health/relationship patterns, ages), plus its 🔎 Because tag. Rank from strongest effect to weakest.'],
  ['🔒 10 private things only I would know','Give 10 specific private habits, thoughts or reactions that I can easily self-reflect on but that are NOT generic: how I react under stress, spending/sleep/food habits, texting or arguing style, what I do when ignored, what I hide, what triggers me. Each must be checkable ✔/✖.'],
  ['👪 Childhood & family snapshot','Give 10 specific, checkable statements about my childhood, parents, siblings, home environment and early school years, with approximate age windows.'],
  ['🔁 Relationship scenarios I keep repeating','Give 8 specific repeating scenarios in my close relationships (who I attract, what goes wrong, how it ends or restarts) that I can recognise, with an age window where the pattern began.'],
  ['⚙️ How I really work & handle money','Give 10 specific, checkable work-style and money habits (how I start tasks, deadlines, bargains, savings, impulse spending, risk) — nothing generic.'],
  ['🩹 Body & health quirks to verify','Give 8 specific body/health tendencies I can verify in my own history (areas, injuries, digestion, sleep, energy dips, skin/hair, accident-prone situations). Traditional astrology only, not medical advice.'],
  ['⏱️ Birth-time sanity check','Using only the data: which 5 claims about me depend on the Lagna/houses (change if my birth time is off), and which 5 depend only on Sun/Moon/planet signs? Suggest 3 life events I should ask family about to confirm the birth time.']]},
 {id:'career',ico:'💼',t:'Career & profession',kw:'job work profession promotion success',h:[10],s:[6,2,11],k:['Sun','Saturn','Mercury','Jupiter'],ck:'Amatyakaraka',v:'D10',ar:['A10','AL'],subs:[
  ['Top 20 careers for me','List 20 specific careers/professions ranked from most to least likely for me (like artist, scientist, doctor, advocate, engineer, teacher). One line each: the job + a 4-6 word reason in plain words.'],
  ['Job or business?','Say clearly: job, business, or both, with one line why. Then list 5 job roles and 5 business types that fit me.'],
  ['Best industries & work style','List my 10 best industries, then my ideal work style (solo or team, desk or field, own boss or not) in 5 short bullets.'],
  ['Next 5 years of career','Give a year-by-year list for the next 5 years: rise / stable / change / risk, one line each, with the best months or quarters to move.'],
  ['Blockers & fixes','List my 5 biggest career blockers and one practical fix for each.'],
  ['Skills to build','List my 8 strongest professional strengths and the 3 skills I should develop most.']]},
 {id:'job',ico:'🧑‍💻',t:'Job vs business',kw:'employment self employed entrepreneur startup',h:[10,7],s:[6,3,11],k:['Mercury','Saturn','Mars'],ck:'Amatyakaraka',v:'D10',ar:['A10'],subs:[
  ['Job or business: decide','Give a direct verdict (job / business / both) with a percentage split and one reason.'],
  ['15 business ideas','List 15 specific business ideas ranked by fit for me, with 4-word reasons.'],
  ['Best time to switch or start','List the 3 best years/windows to change jobs or start a business, and 2 periods to avoid.'],
  ['Solo or partners?','Should I work alone or with partners? Describe the type of partner to trust and the type to avoid.']]},
 {id:'money',ico:'💰',t:'Wealth & finances',kw:'money income savings rich dhana',h:[2,11],s:[5,9,8],k:['Jupiter','Venus'],ck:'',v:'D2',ar:['A2','A11'],subs:[
  ['10 income sources','List my 10 most likely sources of income, ranked, one line each.'],
  ['Money habits','Give 8 specific, checkable money behaviours: what I do right after income, impulse-spend categories, saving style, lending/borrowing habit, risk appetite, with an example each.'],
  ['Wealth years ahead','Year-by-year for the next 5 years: income up/down, best years to invest, buy or save.'],
  ['Where to invest','List 8 asset types that suit my nature ranked, and 4 to avoid (general idea only, not financial advice).'],
  ['Money leaks & fixes','List my 5 biggest money leaks and a fix for each.'],
  ['Best age to build wealth','Give the 3 age windows when I build the most wealth, and what I should do in each.'],
  ['Good & bad money days','List the weekdays and 3 conditions that are good for money decisions for me and which to avoid.']]},
 {id:'moneyblocks',ico:'🚧',t:'Money blocks & delays',kw:'money block stuck poor debt loan loss not saving financial problem scarcity obstacle',h:[2,11,6,8,12],s:[5,9,10],k:['Saturn','Rahu','Ketu','Jupiter'],ck:'',v:'D2',ar:['A2','A11'],subs:[
  ['My top 7 money blocks','List my 7 most likely money blocks, tied to specific placements, each with a checkable real-life sign (no generic lines).'],
  ['Why money leaves me','List 6 specific ways money leaves me (loans, trust, impulse, family, health, fines, scams, lending) ranked, with a fix for each.'],
  ['Debt & loans','Give a direct view on debt and loan risk (low / medium / high), 4 reasons, and the safest way I should borrow or avoid it.'],
  ['Mindset blocks','Give 6 specific beliefs or habits about money that my chart suggests I hold, and a replacement habit for each.'],
  ['Blocked years & when it eases','List the next 3 tight financial periods (with years) and the first window when money flow clearly improves.'],
  ['Unexpected loss risks','List 5 types of sudden financial loss to guard against (theft, fraud, partners, speculation, health) and a precaution for each.']]},
 {id:'wealthboost',ico:'📈',t:'Wealth growth & luck',kw:'rich millionaire business profit investment property lottery speculation windfall gains',h:[2,5,9,11],s:[8,10],k:['Jupiter','Venus','Mercury'],ck:'',v:'D2',ar:['A2','A11'],subs:[
  ['Rich or comfortable?','Give a direct verdict (struggle / comfortable / wealthy / very wealthy) with a percentage and 5 chart reasons.'],
  ['Salary, business or both','Rank salary, business, freelance, investments and family money for me with a percentage and reason.'],
  ['Windfalls & speculation','Say whether sudden gains (inheritance, gifts, stocks, lottery) are likely, with 4 reasons and how careful I should be.'],
  ['Property, gold or stocks','Rank property, gold, stocks, business and savings for my nature, 1 line each (general idea only, not financial advice).'],
  ['My 5 best money years','List the 5 best years ahead for income growth, each with one action to take.'],
  ['Multiple income streams','List 8 income stream ideas that fit my chart, ranked, with the planet behind each.']]},
 {id:'remedies',ico:'🪔',t:'Remedies & what to do',kw:'remedy remedies upay mantra gemstone puja charity fasting donate fix dosha solution',h:[1,6,8,12],s:[9,5],k:['Jupiter','Saturn','Sun','Moon'],ck:'',v:'D1',ar:[],subs:[
  ['My top 5 remedies','Pick the 5 most useful traditional remedies for MY chart, ranked by importance, with the exact planet and reason for each.'],
  ['Weak planets & how to strengthen','List my 3 weakest planets and, for each: a simple mantra, a day to fast or donate, a colour and a daily habit.'],
  ['Gemstones: wear or avoid','Say which gemstones may suit me and which to avoid, with the reason and a caution to consult a trusted astrologer before wearing.'],
  ['Mantras & daily routine','Build a 10-minute daily routine: mantras, timing and simple actions matched to my chart.'],
  ['Charity & seva that helps','List 7 specific charity or service actions (what to give, on which day, to whom) matched to my planets.'],
  ['Habits that matter more than rituals','List 8 practical, non-ritual habits that work as remedies for my chart in everyday life.'],
  ['Money-focused remedies','Give 8 traditional remedies and 4 practical habits specifically to improve money flow in my chart.'],
  ['Love-focused remedies','Give 8 traditional remedies and 4 practical habits specifically for love, marriage and relationships in my chart.'],
  ['Remedies for the running period','Based on my current dasha and antardasha, list 6 targeted remedies and what to avoid until it ends.']]},
 {id:'karmapat',ico:'♾️',t:'Karmic patterns',kw:'karma karmic past life rahu ketu nodes saturn lesson debt repeating pattern destiny dharma',h:[5,8,9,12],s:[1,6,10],k:['Rahu','Ketu','Saturn'],ck:'Atmakaraka',v:'D60',ar:[],subs:[
  ['My Rahu–Ketu life lesson','Using the houses and signs of Rahu and Ketu, explain in 8 plain bullets: what I over-chase now (Rahu), what I already mastered and tend to abandon (Ketu), and the balance to find.'],
  ['Top 8 repeating patterns','List the 8 life patterns that keep repeating for me (people, situations, endings), each tied to a placement and a checkable real-life example.'],
  ['Soul purpose (Atmakaraka)','Based on my Atmakaraka planet and sign, describe my soul\'s core lesson, 6 gifts I carry and 4 traps.'],
  ['Saturn: where life tests me','Using Saturn\'s house, sign and aspects, list 7 areas where I face delay or pressure, what it asks of me, and the reward when I do it.'],
  ['Karmic debts I owe / are owed','Using the 6th, 8th, 12th houses and their lords, list 6 likely karmic debts (family, money, relationships, health, duty) and how to settle each.'],
  ['Retrograde planets & unfinished work','List each retrograde planet in my chart and what unfinished past-life theme it points to, 1 line each.'],
  ['Family & ancestral karma','Using the 4th, 9th, Sun, Moon and Saturn, list 6 ancestral or family patterns I may be carrying and healthy ways to break them.'],
  ['Karmic turning points','List the 5 age windows where my karma shifts strongly (dasha or node transits), with what changes at each.'],
  ['Breaking the cycle','Give 10 practical steps (habits, boundaries, service, remedies) to break my top repeating karmic patterns.']]},
 {id:'karmarel',ico:'🪢',t:'Karmic relationships',kw:'karmic relationship soul contract twin flame toxic cycle attachment rahu ketu 7th 12th',h:[5,7,8,12],s:[4,11],k:['Rahu','Ketu','Venus','Saturn'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['My karmic relationship type','Describe in 7 checkable bullets the type of karmic relationship I attract (teacher, mirror, rescuer, avoidant, controlling...) and why.'],
  ['Signs a bond is karmic','List 8 clear signs a relationship is karmic for me versus healthy, so I can recognise it early.'],
  ['Parents, siblings & friends karma','Using the 4th, 3rd, 9th and 11th, list 6 karmic lessons with parents, siblings, friends and mentors.'],
  ['Teachers & mentors I meet','Say when and what kind of teachers or mentors appear in my life, with 4 age windows.'],
  ['Cutting toxic cycles','Give 8 specific boundaries and habits to stop repeating toxic cycles, tied to my chart.']]},
 {id:'fame',ico:'🌟',t:'Fame, status & recognition',kw:'reputation name public image authority',h:[10,1],s:[11,5],k:['Sun','Moon'],ck:'Atmakaraka',v:'D10',ar:['AL','A10'],subs:[
  ['Will I become well known?','Give a direct verdict with a percentage and the fields where it is most likely.'],
  ['My public image','In 6 bullets: how people see me, and how to sharpen it.'],
  ['10 best fields for recognition','List 10 fields or platforms where I can get recognised, ranked.'],
  ['When recognition peaks','List the 3 best years/windows for visibility and 1 to avoid.']]},
 {id:'spouse',ico:'💍',t:'Spouse & marriage',kw:'wife husband partner relationship spouse details',h:[7],s:[2,11,12],k:['Venus','Jupiter'],ck:'Darakaraka',v:'D9',ar:['UL','A7'],subs:[
  ['Who is my likely spouse','Describe my likely spouse in bullets: personality, looks tendency, 8 most likely professions, family background, age gap tendency and how close our culture will be.'],
  ['Where & how will I meet','List the 10 most likely places or ways I meet my partner, ranked (work, college, friends, family introduction, online, travel, neighbourhood...). One line each.'],
  ['Love or arranged?','Give a direct verdict with a percentage split between love and arranged.'],
  ['Where is my partner from','Rank where my partner is likely from: same city, another city, another state, abroad, other culture. One line each.'],
  ['Marriage quality','List my marriage strengths (5) and challenges (5) in plain words.'],
  ['Making marriage smoother','Give 6 practical habits and traditional remedies for a smoother marriage.']]},
 {id:'marriagetime',ico:'📅',t:'Marriage timing',kw:'when will i marry wedding delay',h:[7,2,11],s:[5,12],k:['Venus','Jupiter'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['Likely marriage years','List the 3 most likely years/age windows for marriage, ranked, one line each.'],
  ['Any delay and why','Is there a delay? Say yes/no, give 3 plain reasons, and the first window when it eases.'],
  ['Best months next 12 months','List the best 3 months in the next 12 for engagement/marriage steps and any to avoid.']]},
 {id:'love',ico:'❤️',t:'Love & romance',kw:'dating affair crush relationship attraction',h:[5,7],s:[11,2],k:['Venus','Moon'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['My romance pattern','Give 8 specific, checkable things about how I behave in love (who initiates, how I act in the first 3 months, what I do when jealous or hurt, what I secretly need). Nothing generic.'],
  ['Types of people I attract','List 8 types of partner I am attracted to or attract.'],
  ['Heartbreak risks & how to avoid','List 5 relationship traps for me and how to avoid each.'],
  ['Best time for new love','List the best 3 windows for new love in the next 3 years.'],
  ['How to attract the right person','Give 8 specific actions, places and habits that help me attract the right partner, plus 3 things to stop doing.']]},
 {id:'lovers',ico:'💞',t:'Lovers & love story',kw:'lover boyfriend girlfriend ex first love crush story attraction partner type',h:[5,7,11],s:[2,8,12],k:['Venus','Moon','Mars'],ck:'Darakaraka',v:'D9',ar:['UL','A7'],subs:[
  ['My love story outline','Outline my love life as 6 chapters (age windows): first attraction, first serious relationship, hardest phase, turning point, settling phase, long-term. One line each, concrete.'],
  ['My first love','Describe, in 7 specific bullets, the kind of person my first real love is likely to be and how it starts and ends.'],
  ['How many serious relationships','Give a direct estimate of how many serious relationships I am likely to have before settling, with the reason in one line each.'],
  ['What I want vs what I attract','Two lists of 6 bullets: what I consciously want in a lover, and what I actually keep attracting. Point out the gap.'],
  ['My love language','Rank my 5 love languages (words, time, touch, gifts, acts) with a checkable example of each.'],
  ['My attachment style','Name my attachment style (secure, anxious, avoidant, mixed) and give 6 checkable behaviours: texting habits, reaction to silence, jealousy, space needs.']]},
 {id:'soulmate',ico:'🔮',t:'Soulmate & karmic love',kw:'soulmate twin flame karmic past life rahu ketu connection destiny',h:[5,7,8,12],s:[11,1],k:['Rahu','Ketu','Venus'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['Karmic love pattern','Using Rahu/Ketu, Venus and the 5th/7th/8th/12th, give 6 specific karmic patterns in my love life (repeating situations, a type of person, a lesson).'],
  ['Past-life love debts','Give 5 plain-language signs of unfinished love karma and how it shows up in my life now.'],
  ['Is this a soulmate or a lesson?','Give 8 checkable signs that separate a soulmate-type bond from a karmic lesson for my chart, so I can judge my current relationship.'],
  ['The one who comes back','Will an ex or old lover return? Give a verdict with a percentage and 4 reasons.'],
  ['Healing karmic ties','Give 6 practical steps and traditional remedies to heal karmic love knots.']]},
 {id:'chemistry',ico:'🔥',t:'Chemistry & intimacy',kw:'romance passion physical attraction desire bedroom chemistry intimacy',h:[7,8,12],s:[5,2],k:['Venus','Mars','Moon'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['My attraction style','Describe in 7 tasteful, specific bullets what draws me to someone, how I flirt, and how fast I open up.'],
  ['Emotional vs physical needs','Give a balanced view of my emotional versus physical needs in a relationship in 6 bullets.'],
  ['What keeps the spark alive','List 8 practical things that keep romance and closeness alive for me.'],
  ['Mismatch risks','List 5 chemistry mismatches to watch for in a partner and how to talk about them kindly.']]},
 {id:'breakup',ico:'💔',t:'Breakups & healing',kw:'breakup heartbreak separation divorce cheating betrayal move on pain',h:[7,8,12],s:[5,6],k:['Saturn','Mars','Rahu'],ck:'Darakaraka',v:'D9',ar:['UL','A7'],subs:[
  ['Why relationships break for me','Give 7 specific, checkable reasons my relationships may strain or end, tied to my chart (no generic lines).'],
  ['Breakup or divorce risk','Give a direct risk level (low / medium / high) for lasting separation and the 4 main factors.'],
  ['Trust & loyalty patterns','List 6 patterns around trust, loyalty and secrecy for me and for my partner type.'],
  ['How I heal','Give 8 specific steps for how I personally heal after heartbreak, and how long it tends to take.'],
  ['Danger periods','List the next 3 periods (with years) where relationships need extra care, and what to do in each.']]},
 {id:'partnerfit',ico:'🧩',t:'Ideal partner & red flags',kw:'ideal partner compatibility match red flags green flags zodiac sign suits me',h:[7,1,5],s:[11,2],k:['Venus','Jupiter'],ck:'Darakaraka',v:'D9',ar:['UL'],subs:[
  ['My ideal partner profile','Describe my ideal partner in 10 bullets: temperament, values, communication style, ambition level, family attitude.'],
  ['Best 5 signs/nakshatras for me','Rank the 5 zodiac signs and 5 nakshatras that match me best, with one line why.'],
  ['Red flags for me','List 8 partner red flags specifically dangerous for me, and 5 green flags to look for.'],
  ['Age gap & distance','Say whether an age gap, long distance or a partner from another city, culture or country suits me, with reasons.'],
  ['Questions to ask before committing','Give 10 sharp questions I should ask a partner before committing, based on my chart weak spots.']]},
 {id:'marriedlife',ico:'🏠',t:'Married life & in-laws',kw:'after marriage husband wife in-laws family home harmony fights',h:[7,4,2],s:[8,12,10],k:['Venus','Moon','Jupiter'],ck:'Darakaraka',v:'D9',ar:['UL','A4'],subs:[
  ['Daily life after marriage','Describe in 8 checkable bullets how my married life looks day to day: who leads, fights, money, home.'],
  ['In-laws & family','Give 6 bullets on my relationship with in-laws and joint-family dynamics.'],
  ['Common fights & solutions','List my 6 most likely arguments and a solution for each.'],
  ['Spouse\'s support & career','How will my spouse help or affect my career and money? 6 bullets.'],
  ['Marriage strong years','List the 3 strongest and 2 testing phases of my marriage by age window.']]},
 {id:'children',ico:'👶',t:'Children & progeny',kw:'kids baby child birth pregnancy fertility',h:[5],s:[2,9,11],k:['Jupiter'],ck:'Putrakaraka',v:'D7',ar:['A5'],subs:[
  ['Children: outlook','Give a direct outlook on having children (easy / some delay / needs care) with a one-line reason.'],
  ['Best years for children','List the 3 most favourable years/windows.'],
  ['My child\'s nature','Describe the kind of child(ren) I am likely to have in 6 bullets and my parenting style.'],
  ['Support & remedies','List 5 practical supports or traditional remedies that help.']]},
 {id:'education',ico:'🎓',t:'Education & learning',kw:'study college exams degree knowledge',h:[4,5],s:[9,2],k:['Mercury','Jupiter'],ck:'Putrakaraka',v:'D24',ar:[],subs:[
  ['15 best subjects/degrees','List 15 subjects or degrees ranked by fit.'],
  ['How I learn best','Give 8 specific, checkable learning habits: best time of day, format, memory style, subjects I struggle with, how I react to exams.'],
  ['Exam & degree timing','List the best years/windows for exams, admissions or a new course.'],
  ['Study abroad chance','Give a direct verdict on studying abroad, best regions, and best timing.']]},
 {id:'health',ico:'🩺',t:'Health & vitality',kw:'disease illness body fitness immunity',h:[1,6],s:[8,12],k:['Sun','Moon','Mars'],ck:'Atmakaraka',v:'D30',ar:['A6'],subs:[
  ['Strong & sensitive areas','List my body areas from strongest to most sensitive, one line each (traditional astrology, not medical advice).'],
  ['Habits that suit me','List 8 daily habits, foods and exercise types that suit me.'],
  ['Care periods','List the periods that need extra care and the periods of strong vitality (balanced, non-fearful).'],
  ['Stress & sleep','Give 5 tips for my stress and sleep pattern.']]},
 {id:'mind',ico:'🧠',t:'Mind & emotional peace',kw:'stress anxiety depression mood happiness',h:[4,1],s:[5,12],k:['Moon','Mercury'],ck:'Atmakaraka',v:'D1',ar:[],subs:[
  ['My stress triggers','List 8 very specific situations that spike my stress (types of people, settings, deadlines, noise, money, health) that I can verify from my own past.'],
  ['Mood pattern','Give 8 specific, checkable mood patterns: times of day/month/year I dip or peak, what triggers a swing, how long it lasts, what I do when low.'],
  ['Habits for peace','List 8 daily practices that bring me peace.'],
  ['Best calming practices','Rank 8 practices (meditation, music, nature, prayer, exercise...) by how well they suit me.']]},
 {id:'longevity',ico:'⏳',t:'Resilience & sudden changes',kw:'life span accidents surgery transformation 8th house',h:[8,1],s:[3,6,12],k:['Saturn'],ck:'Atmakaraka',v:'D30',ar:['A8'],subs:[
  ['Sudden-change areas','List the life areas where sudden change is most likely, ranked, with a calm tone.'],
  ['Sensitive periods','List the next 3 sensitive periods and how to handle each (balanced, no fear).'],
  ['Protective habits','List 6 habits that protect me.']]},
 {id:'father',ico:'👨',t:'Father & mentors',kw:'dad guru teacher blessings',h:[9],s:[10,3],k:['Sun','Jupiter'],ck:'',v:'D12',ar:['A9'],subs:[
  ['Bond with father','Give 8 specific, checkable facts about my relationship with my father: closeness/distance phases with ages, conflict style, how he shaped my career, health or support issues.'],
  ['Father\'s nature & work','Describe my father\'s likely nature and 5 likely professions.'],
  ['Mentors & gurus','Describe the type of mentor/teacher who helps me and when they appear.']]},
 {id:'mother',ico:'👩',t:'Mother & home life',kw:'mom family happiness domestic',h:[4],s:[10,9],k:['Moon'],ck:'Matrikaraka',v:'D12',ar:['A4'],subs:[
  ['Bond with mother','Give 8 specific, checkable facts about my relationship with my mother: closeness/distance phases with ages, conflict style, her health or role at home, what I got or missed from her.'],
  ['Home happiness','Give 8 specific, checkable facts about my home life (moves, property disputes, noise/peace, who dominates, mother\'s role) and 3 fixes.']]},
 {id:'siblings',ico:'🧑‍🤝‍🧑',t:'Siblings & courage',kw:'brother sister effort initiative',h:[3],s:[11,1],k:['Mars'],ck:'Bhratrikaraka',v:'D3',ar:['A3'],subs:[
  ['Siblings','Give 8 specific, checkable facts about my siblings situation (number tendency, birth order feel, age gaps, closeness, rivalry, who helps whom).'],
  ['My courage & effort style','Give 8 specific, checkable ways I take initiative, handle risk, react to dares or competition, and where I hold back.']]},
 {id:'property',ico:'🏠',t:'Property, home & vehicles',kw:'house land real estate car buy flat',h:[4],s:[2,11,12],k:['Mars','Venus','Saturn'],ck:'Matrikaraka',v:'D4',ar:['A4'],subs:[
  ['Will I own property?','Give a direct verdict and the likely age/year range.'],
  ['What suits me','Rank: house, flat, land, farm, commercial, vehicle, with a one-line reason each.'],
  ['Where to buy','Describe the best type of location/direction and city style for me.'],
  ['Best years to buy','List the best 3 years/windows to buy property or a vehicle.']]},
 {id:'foreign',ico:'✈️',t:'Foreign travel & settlement',kw:'abroad visa immigration relocate overseas',h:[12,9],s:[3,7,4],k:['Rahu','Moon'],ck:'',v:'D1',ar:[],subs:[
  ['Will I go abroad?','Give a direct verdict with a percentage and the type: study, work, settle, or travel.'],
  ['10 best countries/regions','List 10 countries or regions ranked by fit for me.'],
  ['Best years to go','List the best 3 years/windows to travel, move or study abroad.']]},
 {id:'enemies',ico:'⚔️',t:'Rivals, debts & disputes',kw:'enemies litigation court competition loans conflict',h:[6],s:[8,12,3],k:['Mars','Saturn'],ck:'Gnatikaraka',v:'D1',ar:['A6'],subs:[
  ['Types of rivals','Describe the kind of rivals/opponents I face in 6 bullets.'],
  ['Debt & legal risk','Give a calm verdict on debt and legal-dispute risk and 5 ways to stay safe.'],
  ['How I win','List 6 strategies that work best for me in conflicts.']]},
 {id:'spiritual',ico:'🕉️',t:'Spirituality & moksha',kw:'meditation dharma purpose inner growth',h:[9,12],s:[5,8],k:['Ketu','Jupiter'],ck:'Atmakaraka',v:'D20',ar:[],subs:[
  ['8 paths that suit me','List 8 spiritual paths/practices (bhakti, meditation, yoga, service, study...) ranked.'],
  ['Traditional mantra / deity leaning','Name the traditional deities or mantras that match my chart (3-5) and a simple daily practice.'],
  ['When spirituality deepens','List the best periods for spiritual growth.']]},
 {id:'karma',ico:'🔮',t:'Karma & past life',kw:'karmic lessons rahu ketu dosha pitru kala sarpa mangal past life debt',h:[5,9,12,8],s:[1],k:['Rahu','Ketu','Saturn'],ck:'Atmakaraka',v:'D60',ar:[],subs:[
  ['My karmic lessons','List my top 6 karmic lessons in this life in plain words, one line each.'],
  ['Past-life gifts','List 8 talents or instincts that feel naturally mine (likely carried from the past).'],
  ['Repeating patterns','List 5 relationship/life patterns that repeat for me and how to break each.'],
  ['Doshas explained simply','Using DOSHA FACTS, say which doshas apply (Mangal, Kala Sarpa, Pitru, Shani), in plain words, with how serious each is and 3 traditional remedies.'],
  ['Soul\'s mission','In 3 short lines, say my soul\'s mission and what to focus on.']]},
 {id:'purpose',ico:'🧭',t:'Personality & life purpose',kw:'nature character soul atmakaraka self',h:[1],s:[5,9],k:['Sun','Moon'],ck:'Atmakaraka',v:'D9',ar:['AL'],subs:[
  ['My top 10 strengths','Give 10 specific strengths shown as concrete behaviours that others have actually noticed in me, with the situation where each shows.'],
  ['5 weaknesses & fixes','List 5 weaknesses as concrete recurring mistakes (with the typical situation where each happens), each with one practical fix.'],
  ['Life purpose','State my life direction in 3 lines using specific themes from the data (no motivational clichés) and name 3 concrete fields or life areas where it plays out.'],
  ['Traditional lucky aids','List my traditional lucky colour, day, number, direction and gem (for fun, traditional).']]},
 {id:'friends',ico:'🤝',t:'Friends, networks & gains',kw:'social circle allies fulfilment desires',h:[11],s:[3,7,5],k:['Jupiter','Mercury'],ck:'',v:'D1',ar:['A11'],subs:[
  ['My friend types','Give 8 specific traits of the friends I attract: age gap, profession types, how friendships start and end, who supports me and who lets me down.'],
  ['Networking strengths','List how I gain from networks and 5 ways to use it.']]},
 {id:'losses',ico:'📉',t:'Expenses, losses & sleep',kw:'spending waste hospital isolation bed',h:[12],s:[2,6,8],k:['Saturn','Ketu'],ck:'',v:'D1',ar:[],subs:[
  ['Where money leaks','List my top 6 spending leaks and a fix each.'],
  ['Sleep & rest','Describe my sleep pattern and 5 tips.'],
  ['Hidden fears','List 5 hidden fears or blocks and how to ease them.']]},
 {id:'talent',ico:'🎨',t:'Talent, creativity & arts',kw:'music art writing skill hobby entertainment',h:[5,3],s:[10,11],k:['Venus','Mercury','Moon'],ck:'Putrakaraka',v:'D9',ar:[],subs:[
  ['15 creative fields','List 15 creative fields ranked by fit for me.'],
  ['Natural talents','List 8 natural talents as concrete things I picked up fast without training, with the age or situation where it showed.'],
  ['Hobbies that suit me','List 8 hobbies that recharge me.']]},
 {id:'inherit',ico:'🏦',t:'Inheritance & hidden wealth',kw:'will insurance partner money legacy',h:[8,2],s:[11,7],k:['Saturn','Jupiter'],ck:'',v:'D1',ar:['A8'],subs:[
  ['Inheritance outlook','Give a direct outlook on inheritance and family wealth.'],
  ['Partner / insurance money','Describe money from partners, insurance or sudden sources in 5 bullets.']]},
 {id:'thisyear',ico:'🗓️',t:'This year & next 12 months',kw:'forecast prediction timing dasha transit now upcoming',h:[1,10,7,2,11],s:[4,5,9],k:['Jupiter','Saturn'],ck:'',v:'D1',ar:[],subs:[
  ['Month-by-month next 12 months','List the next 12 months, one line each: theme + one thing to do.'],
  ['Best 3 & toughest 3 months','Name my best 3 and toughest 3 months in the next 12, with a short reason.'],
  ['Do & avoid this year','Give 6 things to do and 6 things to avoid this year.']]}
];
SRCH_TOPICS.forEach(tp=>{ if (tp.id==='me') return;
  tp.subs.unshift(['🪞 10 precise checks: '+tp.t, 'Give exactly 10 precise, self-verifiable statements about my '+tp.t.toLowerCase()+': specific behaviours, past events, situations, habits or age windows I can check against my own life. Nothing that fits most people. Each bullet: the statement, then 🔎 Because (exact combination), then a ✔/✖ test I can do.']);
});
function srchHouseLine(ch, L, h){
  const pr = ch.planets, si = (L+h-1)%12, s = SIGNS[si], lp = pr[s.lord];
  const occ = PLANET_LIST.filter(n=> pr[n] && pr[n].house===h);
  const asp = PLANET_LIST.filter(n=> pr[n] && pr[n].house!==h && (pr[n].aspectsHouses||[]).indexOf(h)>-1);
  return `H${h} ${s.name}: lord ${s.lord}${lp?` in H${lp.house} ${SIGNS[lp.sign].name}${srchDig(lp)}${lp.retrograde?' Retro':''}`:''}; occ ${occ.length?occ.join(','):'none'}; aspected by ${asp.length?asp.join(','):'none'}`;
}
function srchVargaPos(ch, vk, name){
  try { const v = ch.vargas[vk]; for (const hh of v.houses){ if (hh.planets.some(x=>x.name===name)) return `${name} ${hh.signName} H${hh.houseNum}`; } } catch(e){} return '';
}
function srchDoshas(ch){
  const pr = ch.planets, L = ch.ascendant.sign, out = [];
  const mh = rsHouseOf(pr.Mars.sign, L); out.push(`Mangal dosha (Mars in H${mh}): ${[1,2,4,7,8,12].indexOf(mh)>-1?'present':'absent'}`);
  const r = pr.Rahu.longitude, k = pr.Ketu.longitude, inArc = lon=> ((lon - r + 360) % 360) < ((k - r + 360) % 360);
  const others = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'], a = others.filter(n=>inArc(pr[n].longitude)).length;
  out.push(`Kala Sarpa: ${a===7||a===0?'present (all planets on one side of Rahu-Ketu)':'absent'}`);
  const sa = pr.Sun.house; out.push(`Pitru dosha hint: Sun with ${['Rahu','Ketu','Saturn'].filter(n=>pr[n].house===sa).join('/')||'no node/Saturn'} in H${sa}; 9th house occupants ${PLANET_LIST.filter(n=>pr[n].house===9).join(',')||'none'}`);
  const sh = pr.Saturn.house; out.push(`Saturn in H${sh}${sh===7||sh===1||sh===4||sh===8||sh===12?' (Shani dosha-type placement)':''}`);
  return out.join('; ');
}
function srchDig(p){ const st = p.dignity && p.dignity.status; return st==='Exalted'?' Exalted':st==='Debilitated'?' Debilitated':st==='OwnSign'?' OwnSign':st==='Moolatrikona'?' Moolatrikona':''; }
function srchPlanetLine(ch, n){
  const p = ch.planets[n]; if (!p) return '';
  return `${n} in ${SIGNS[p.sign].name} ${Math.floor(p.degInSign)}° H${p.house}${srchDig(p)}${p.retrograde?' Retro':''}${p.combustion&&p.combustion.combust?' Combust':''}`;
}
function srchAspects(ch){
  const pr = ch.planets, out = [];
  PLANET_LIST.forEach(a=>{
    const p = pr[a]; if (!p) return; const t = [];
    (p.aspectsHouses||[]).forEach(h=>{
      PLANET_LIST.forEach(b=>{ if (b!==a && pr[b] && pr[b].house===h) t.push(b); });
      if (h===1) t.push('Lagna');
    });
    if (t.length) out.push(`${a}(H${p.house}) aspects ${t.join(', ')}`);
  });
  return out;
}
function srchConj(ch){
  const pr = ch.planets, L = ch.ascendant.sign, out = [];
  for (let h=1; h<=12; h++){
    const occ = PLANET_LIST.filter(n=> pr[n] && pr[n].house===h);
    if (occ.length>=2) out.push(`H${h} ${SIGNS[(L+h-1)%12].name}: ${occ.join('+')}`);
  }
  return out;
}
function srchBrief(tp, sub, cap){
  const ch = currentChartForModal; if (!ch) return '';
  const L = ch.ascendant.sign, pr = ch.planets, S = [];  // S = [priority, text]
  const lordP = pr[SIGNS[L].lord];
  S.push([0,'LAGNA: '+SIGNS[L].name+' '+Math.floor(ch.ascendant.degInSign)+'°'+(ch.ascendant.nakshatra?', '+ch.ascendant.nakshatra.name:'')+'; lord '+SIGNS[L].lord+(lordP?' in '+SIGNS[lordP.sign].name+' H'+lordP.house:'')]);
  S.push([0,'PLANETS (exact): '+PLANET_LIST.map(n=>{ const p = pr[n]; return `${n} ${SIGNS[p.sign].name} ${Math.floor(p.degInSign)}° H${p.house}${p.nakshatra?' '+p.nakshatra.name:''}${srchDig(p)}${p.retrograde?' Retro':''}${p.combustion&&p.combustion.combust?' Combust':''}`; }).join('; ')]);
  const cj = srchConj(ch); if (cj.length) S.push([0,'CONJUNCTIONS: '+cj.join('; ')]);
  const as = srchAspects(ch); if (as.length) S.push([0,'ASPECTS (drishti): '+as.join('; ')]);
  S.push([1,'KEY HOUSES: '+tp.h.concat(tp.s.slice(0,2)).map(h=>srchHouseLine(ch,L,h)).join(' | ')]);
  try {
    const act = findActiveDasha(ch.dashaData.mahadashas, new Date());
    if (act && act.mahadasha){
      const ds = [['MD',act.mahadasha],['AD',act.antardasha],['PD',act.pratyantardasha]].filter(x=>x[1]).map(([nm,x])=>{
        const lk = rsLinks(x.lord, L, ch), hit = Object.keys(lk).filter(h=> tp.h.indexOf(+h)>-1 || tp.s.indexOf(+h)>-1).map(h=>lk[h]);
        return `${nm} ${x.lord}${hit.length?' ('+hit.join(', ')+')':''}`; });
      S.push([1,`DASHA NOW: ${ds.join(' / ')}${act.antardasha?` (AD until ${act.antardasha.endDate.toISOString().slice(0,10)})`:''}`]);
    }
  } catch(e){}
  if (tp.id==='karma' || tp.id==='spouse' || tp.id==='marriagetime' || tp.id==='me') { try { S.push([1,'DOSHA FACTS: ' + srchDoshas(ch)]); } catch(e){} }
  if (tp.ck && ch.charaKarakas && ch.charaKarakas[tp.ck]){ const n = ch.charaKarakas[tp.ck].planet; S.push([2,`${tp.ck}: ${srchPlanetLine(ch,n)}${srchVargaPos(ch,'D9',n)?'; D9 '+srchVargaPos(ch,'D9',n):''}`]); }
  if (tp.k.length) S.push([2,'TOPIC KARAKAS: '+tp.k.map(n=>srchPlanetLine(ch,n)).filter(Boolean).join('; ')]);
  if (tp.v && tp.v!=='D1' && ch.vargas[tp.v]){
    const vv = ch.vargas[tp.v], lord = SIGNS[vv.ascendantSign].lord, kp = tp.k.map(n=>srchVargaPos(ch,tp.v,n)).filter(Boolean);
    S.push([3,`${tp.v}: lagna ${SIGNS[vv.ascendantSign].name}, lord ${lord}${srchVargaPos(ch,tp.v,lord)?' ('+srchVargaPos(ch,tp.v,lord).replace(lord+' ','')+')':''}${kp.length?'; '+kp.join(', '):''}`]);
  }
  try {
    const ar = calcAllArudhaPadas(ch, L), a = (tp.ar||[]).filter(k=>ar[k]!==undefined).map(k=>`${k} ${SIGNS[ar[k]].name} H${((ar[k]-L+12)%12)+1}`);
    if (a.length) S.push([3,'ARUDHA: ' + a.join(', ')]);
  } catch(e){}
  try {
    const jd = nowJulianDay(), mo = pr.Moon.sign, T = ['Saturn','Jupiter','Rahu'].map(n=>{ const sg = Math.floor(getSiderealLongitudeAt(n, jd)/30); return `${n} ${SIGNS[sg].name} H${rsHouseOf(sg,L)}(from Moon H${rsHouseOf(sg,mo)})`; });
    S.push([4,`TRANSITS ${new Date().toISOString().slice(0,10)}: ${T.join('; ')}`]);
  } catch(e){}
  const q = sub ? sub[1] : ('Give a precise overview of ' + tp.t.toLowerCase() + ' for me.');
  const head = `Act as an expert Vedic astrologer.\nTOPIC: ${tp.t}${sub?' › '+sub[0]:''}\nQUESTION: ${q}\n${SRCH_STYLE}\nCHART DATA (authoritative):\n`;
  let keep = S.slice();
  const len = ()=> head.length + keep.map(x=>x[1]).join('\n').length;
  while (cap && len() > cap){ const mx = Math.max.apply(null, keep.map(x=>x[0])); if (mx===0) break; const idx = keep.map(x=>x[0]).lastIndexOf(mx); keep.splice(idx,1); }
  return head + keep.map(x=>x[1]).join('\n');
}
function srchAsk(tp, sub, copyOnly){
  const full = srchBrief(tp, sub, 0); if (!full){ rsToast('Generate a chart first'); return; }
  try { if (navigator.clipboard) navigator.clipboard.writeText(full).catch(function(){}); } catch(e){}
  if (copyOnly){ rsToast('Full AI brief copied ✓ — paste it into any AI'); return; }
  const text = srchBrief(tp, sub, 2700);
  window.open('https://www.google.com/search?q=' + encodeURIComponent(text) + '&udm=50', '_blank', 'noopener');
  rsToast('Opening Google AI · full brief also copied 📋');
}
function srchTopicBox(i){
  const tp = SRCH_TOPICS[i], list = document.getElementById('srchList'); if (!tp || !list) return;
  srchRows = tp.subs.map(sb=>({k:'ask',ico:tp.ico,t:sb[0],s:sb[1],tp,sub:sb,q:tp.t}));
  list.innerHTML = `<div class="srch-box2 sticky"><button type="button" class="srch-back" data-back="1">← All topics</button><div class="srch-h2">${tp.ico} ${rsEsc(tp.t)} <span class="srch-sub">pick a question · opens Google AI</span></div></div>` + srchRows.map((r,j)=> srchRowHTML(r,j)).join('') +
    `<div class="srch-row" data-i="${srchRows.length}" data-k="ask"><span class="srch-ico">✨</span><div class="srch-txt"><b>Quick overview</b><small>One short summary of ${rsEsc(tp.t.toLowerCase())}</small></div><span class="srch-tag">Ask AI</span></div>`;
  srchRows.push({k:'ask',ico:'✨',t:'Quick overview',s:'',tp,sub:null,q:tp.t});
  srchSel = 0; const f = list.querySelector('.srch-row'); if (f) f.classList.add('sel'); list.scrollTop = 0;
}

/* ============================================================================
   QUICK SEARCH — click any placement in the chart to Google it
   ============================================================================ */
let qsearchActive = false;
let qsearchEngine = 'google'; // 'google' | 'google-ai'

(function initQuickSearch(){
  const btn = document.getElementById('quickSearchBtn');
  const popover = document.getElementById('quickSearchPopover');
  const toggle = document.getElementById('qsearchToggle');
  const engineGoogleBtn = document.getElementById('qsearchEngineGoogle');
  const engineAiBtn = document.getElementById('qsearchEngineAi');
  const liveBadge = document.getElementById('qsearchLiveBadge');
  const liveBadgeText = document.getElementById('qsearchLiveBadgeText');
  const liveBadgeOff = document.getElementById('qsearchLiveBadgeOff');

  function engineLabel(){ return qsearchEngine === 'google-ai' ? 'Google AI Search' : 'Google Search'; }

  function refreshUI(){
    btn.classList.toggle('qsearch-active', qsearchActive);
    toggle.classList.toggle('on', qsearchActive);
    engineGoogleBtn.classList.toggle('active', qsearchEngine === 'google');
    engineAiBtn.classList.toggle('active', qsearchEngine === 'google-ai');
    document.body.classList.toggle('qsearch-mode-on', qsearchActive);
    liveBadge.classList.toggle('show', qsearchActive);
    liveBadgeText.textContent = `🔍 Quick Search active (${engineLabel()}) — click anything in the chart`;
  }

  // Restore saved preference
  try {
    const saved = JSON.parse(localStorage.getItem('VedicAstrology_quickSearch') || 'null');
    if (saved){ qsearchActive = !!saved.active; qsearchEngine = saved.engine || 'google'; }
  } catch(e){}
  refreshUI();

  function persist(){
    try { localStorage.setItem('VedicAstrology_quickSearch', JSON.stringify({active: qsearchActive, engine: qsearchEngine})); } catch(e){}
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('show');
  });
  document.addEventListener('click', (e) => {
    if (popover.classList.contains('show') && !popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)){
      popover.classList.remove('show');
    }
  });

  toggle.addEventListener('click', () => {
    qsearchActive = !qsearchActive;
    refreshUI(); persist();
  });
  engineGoogleBtn.addEventListener('click', () => { qsearchEngine = 'google'; refreshUI(); persist(); });
  engineAiBtn.addEventListener('click', () => { qsearchEngine = 'google-ai'; refreshUI(); persist(); });
  liveBadgeOff.addEventListener('click', () => { qsearchActive = false; refreshUI(); persist(); });

  // Elements inside the chart that should never trigger a search themselves
  // (their own click behaviour — buttons, inputs, links, tabs, dropdowns — stays intact).
  const IGNORE_SELECTOR = 'button, a, input, select, textarea, label, .app-tab, .btn';
  // Preferred "unit of meaning" to grab text from, most specific first.
  const UNIT_SELECTOR = [
    '.detail-chip', '.planet-clickable', '.big3-value', '.badge', '.karaka-card',
    '.house-card', '.yoga-card', '.varga-house', '.shadbala-card', '.dasha-period-row',
    'td', 'th', 'li', '.rd-value'
  ].join(', ');

  function buildQueryText(target){
    const unit = target.closest(UNIT_SELECTOR);
    const el = unit || target;
    let text = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    if (text.length > 140) text = text.slice(0,140);
    return text;
  }

  function openSearch(query){
    const q = encodeURIComponent(query + ' vedic astrology meaning');
    const url = qsearchEngine === 'google-ai'
      ? `https://www.google.com/search?q=${q}&udm=50`
      : `https://www.google.com/search?q=${q}`;
    window.open(url, '_blank', 'noopener');
  }

  // Capture phase so this runs before any chart element's own click handler.
  document.addEventListener('click', (e) => {
    if (!qsearchActive) return;
    const panel = e.target.closest('.app-panel');
    if (!panel) return; // only intercept clicks on chart content, not header/nav/modals
    if (e.target.closest(IGNORE_SELECTOR)) return; // let real controls keep working
    const text = buildQueryText(e.target);
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openSearch(text);
  }, true);
})();

/* ============================================================================
   RELATIONSHIPS TAB
   ============================================================================ */
let relSelectedPlanets = new Set();
let relSystem = "vedic";

document.addEventListener('click', (e)=>{
  const chip = e.target.closest('[data-rel-planet]');
  if (chip){
    const name = chip.dataset.relPlanet;
    if (relSelectedPlanets.has(name)){ relSelectedPlanets.delete(name); chip.classList.remove('selected'); }
    else { relSelectedPlanets.add(name); chip.classList.add('selected'); }
    return;
  }
  const sysBtn = e.target.closest('[data-rel-system]');
  if (sysBtn){
    relSystem = sysBtn.dataset.relSystem;
    document.querySelectorAll('#relSystemToggle .rel-system-btn').forEach(b=>b.classList.remove('active'));
    sysBtn.classList.add('active');
    return;
  }
  if (e.target.id === 'relFindBtn'){
    runRelationshipScan();
  }
});

function runRelationshipScan(){
  const resultsDiv = document.getElementById('relResults');
  if (!resultsDiv) return;
  const selected = [...relSelectedPlanets];
  if (selected.length < 2){
    resultsDiv.innerHTML = `<div class="rel-empty-state">Select at least two planets above, then click "Find Relationships".</div>`;
    return;
  }
  resultsDiv.innerHTML = `<div class="rel-loading">Scanning planetary motion across time — this searches up to 10 years in each direction…</div>`;

  setTimeout(()=>{
    const nowJD = toJulianDay(new Date().getUTCFullYear(), new Date().getUTCMonth()+1, new Date().getUTCDate(), new Date().getUTCHours(), new Date().getUTCMinutes(), 0);
    let html = "";
    for (let i=0; i<selected.length; i++){
      for (let j=i+1; j<selected.length; j++){
        const a = selected[i], b = selected[j];
        html += buildRelPairCard(a, b, nowJD);
      }
    }
    resultsDiv.innerHTML = html;
  }, 30);
}

function buildRelPairCard(bodyA, bodyB, nowJD){
  const lonA = getSiderealLongitudeAt(bodyA, nowJD);
  const lonB = getSiderealLongitudeAt(bodyB, nowJD);
  const currentSep = angDiffLocal(lonA, lonB);

  let rowsHtml = "";

  if (relSystem === "vedic"){
    const vedicTargets = [
      { name:"Conjunction (same sign)", angle:0 },
      { name:"Opposition (7th aspect)", angle:180 }
    ];
    vedicTargets.forEach(t=>{
      const result = findNearestAspectForPair(bodyA, bodyB, t.angle, nowJD, 3650);
      const isActiveNow = Math.abs(angleErrorForTarget(lonA, lonB, t.angle)) <= 3;
      rowsHtml += buildAspectRow(t.name, result, isActiveNow);
    });
  } else {
    WESTERN_ASPECTS.forEach(asp=>{
      const result = findNearestAspectForPair(bodyA, bodyB, asp.angle, nowJD, 3650);
      const isActiveNow = Math.abs(angleErrorForTarget(lonA, lonB, asp.angle)) <= asp.orb;
      rowsHtml += buildAspectRow(`${asp.symbol} ${asp.name} (${asp.angle}°)`, result, isActiveNow);
    });
  }

  return `
  <div class="rel-pair-card">
    <div class="rel-pair-head">
      <div class="rel-pair-planets">
        <span>${PLANET_GLYPHS[bodyA]} ${bodyA}</span>
        <span class="rel-pair-symbol">⟷</span>
        <span>${PLANET_GLYPHS[bodyB]} ${bodyB}</span>
      </div>
      <div class="rel-pair-current">Currently ${currentSep.toFixed(1)}° apart</div>
    </div>
    ${rowsHtml}
  </div>`;
}

function buildAspectRow(label, result, isActiveNow){
  const prevText = result.previous ? formatRelDate(result.previous.jd) : "Not found in the last 10 years";
  const nextText = result.next ? formatRelDate(result.next.jd) : "Not found in the next 10 years";
  return `
  <div class="rel-aspect-row">
    <div class="rel-aspect-name">${label}${isActiveNow ? '<span class="rel-aspect-active-badge">Active now</span>' : ''}</div>
    <div class="rel-aspect-dates">
      <span class="past">← ${prevText}</span>
      <span class="future">${nextText} →</span>
    </div>
  </div>`;
}

function formatRelDate(jd){
  let j = jd + 0.5;
  const Z = Math.floor(j), F = j-Z;
  let A = Z;
  if (Z>=2299161){ const alpha=Math.floor((Z-1867216.25)/36524.25); A=Z+1+alpha-Math.floor(alpha/4); }
  const B=A+1524, C=Math.floor((B-122.1)/365.25), D=Math.floor(365.25*C), E=Math.floor((B-D)/30.6001);
  const day = B-D-Math.floor(30.6001*E)+F;
  const month = E<14 ? E-1 : E-13;
  const year = month>2 ? C-4716 : C-4715;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${Math.floor(day)} ${months[month-1]} ${year}`;
}

document.getElementById('profileSelect').addEventListener('change', (e) => {
  document.getElementById('mainMenuModal').classList.remove('show'); // Hide menu immediately so UI doesn't freeze

  const idx = e.target.value;
  if (idx !== "") {
    localStorage.setItem('VedicAstrology_lastProfileIdx', idx);
  } else {
    localStorage.removeItem('VedicAstrology_lastProfileIdx');
  }

  if (idx === "") {
    document.getElementById('intakeSection').style.display = '';
    document.getElementById('results').classList.remove('show');
    document.getElementById('appTabbar').classList.remove('show');
    return;
  }

  const profiles = loadProfiles();
  const p = profiles[idx];
  if (!p) return;

  // Load old details safely
  loadProfileIntoForm(p);

  // Show the loading screen to give feedback
  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.classList.add('show');
  document.getElementById('results').classList.remove('show');
  document.getElementById('intakeSection').style.display = 'none';

  // Wait 150ms to allow the browser to paint the closing menu and loading spinner before doing heavy math
  setTimeout(() => {
    try {
      renderResults(p);
    } catch(err) {
      console.error("Error loading profile:", err);
      alert("There was an issue loading this profile. It may be corrupted.");
    }
    loadingOverlay.classList.remove('show');
  }, 150);
});

function loadProfileIntoForm(p){
  document.getElementById('profileName').value = p.name || "";
  document.getElementById('dobInput').value = p.dob || "";
  document.getElementById('tobInput').value = p.tob || "";
  placeInput.value = p.place || "";
  selectedLat = p.lat || null; 
  selectedLon = p.lon || null;
  coordReadout.textContent = (p.lat !== null && p.lon !== null) ? `${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°` : "— not yet selected —";
  const sel = document.getElementById('tzInput');
  [...sel.options].forEach(o=>{ if (parseFloat(o.value)===p.tz) o.selected = true; });
  try{ inSyncFriendly(); inUpdate(); }catch(e){}
}

document.getElementById('newProfileBtn').addEventListener('click', ()=>{
  document.getElementById('birthForm').reset();
  selectedLat=null; selectedLon=null;
  coordReadout.textContent = "— not yet selected —";
  document.getElementById('profileSelect').value = "";
  document.getElementById('results').classList.remove('show');
  document.getElementById('appTabbar').classList.remove('show');
  document.getElementById('intakeSection').style.display = '';
  window.scrollTo({top: 0, behavior: 'smooth'});
  document.getElementById('profileName').focus();
});

let pendingDeleteIdx = null;
document.getElementById('deleteProfileBtn').addEventListener('click', ()=>{
  const sel = document.getElementById('profileSelect');
  if (!sel.value){ return; }
  pendingDeleteIdx = sel.value;
  document.getElementById('modalTitle').textContent = "Delete this profile?";
  document.getElementById('modalBody').textContent = `This will permanently remove "${sel.options[sel.selectedIndex].textContent}" from this browser.`;
  document.getElementById('confirmModal').classList.add('show');
});
document.getElementById('modalCancel').addEventListener('click', ()=>{
  document.getElementById('confirmModal').classList.remove('show');
  pendingDeleteIdx = null;
});
document.getElementById('modalConfirm').addEventListener('click', ()=>{
  if (pendingDeleteIdx !== null){
    const profiles = loadProfiles();
    profiles.splice(pendingDeleteIdx,1);
    saveProfiles(profiles);
    refreshProfileSelect();
    document.getElementById('birthForm').reset();
    document.getElementById('results').classList.remove('show');
    document.getElementById('appTabbar').classList.remove('show');
    document.getElementById('intakeSection').style.display = '';
  }
  document.getElementById('confirmModal').classList.remove('show');
  pendingDeleteIdx = null;
});

/* ============================================================================
   FORM SUBMIT -> COMPUTE -> RENDER
   ============================================================================ */
document.getElementById('birthForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const errorBanner = document.getElementById('errorBanner');
  errorBanner.classList.remove('show');

  const name = document.getElementById('profileName').value.trim();
  const dob = document.getElementById('dobInput').value;
  const tob = document.getElementById('tobInput').value;
  const tz = parseFloat(document.getElementById('tzInput').value);

  if (!name || !dob || !tob){
    const miss = [!name?'your name':'', !dob?'the date you were born':'', !tob?'the time you were born (tap "No idea" if unsure)':''].filter(Boolean).join(', ');
    errorBanner.textContent = "Almost there! Please add: " + miss + ".";
    errorBanner.classList.add('show');
    return;
  }
  if (selectedLat === null || selectedLon === null){
    errorBanner.textContent = "Please tap your city in the list that appears under the box (or use the map pin) so we know where you were born.";
    errorBanner.classList.add('show');
    return;
  }

  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.classList.add('show');
  document.getElementById('results').classList.remove('show');

  setTimeout(()=>{
    const profile = {
      name, dob, tob, tz,
      place: placeInput.value, lat: selectedLat, lon: selectedLon,
      savedAt: Date.now()
    };

    const profiles = loadProfiles();
    const existingIdx = profiles.findIndex(p=> p.name===name && p.dob===dob && p.tob===tob && p.place===profile.place);
    if (existingIdx >= 0) profiles[existingIdx] = profile; else profiles.push(profile);
    saveProfiles(profiles);
    refreshProfileSelect();
    const sel = document.getElementById('profileSelect');
    const newIdx = profiles.findIndex(p=> p.savedAt===profile.savedAt);
    sel.value = newIdx;

    loadingOverlay.classList.remove('show');
    document.getElementById('intakeSection').style.display = 'none';
    
    // Render the chart first so the calculations are finished
    renderResults(profile);

        // Automatic remote report transmission removed for privacy and credential safety.

  }, 400);
});

/* ============================================================================
   RENDERING
   ============================================================================ */
function formatDeg(d){
  const deg = Math.floor(d);
  const minFloat = (d-deg)*60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat-min)*60);
  return `${deg}°${String(min).padStart(2,'0')}'${String(sec).padStart(2,'0')}"`;
}

const DASHA_PLANET_COLORS = {
  Ketu:"#8A6FB8", Venus:"#D4AF37", Sun:"#E0A64A", Moon:"#C9C3AE",
  Mars:"#C95050", Rahu:"#5B8A9E", Jupiter:"#D9A441", Saturn:"#6B7FA3", Mercury:"#5EC4B7"
};

/* ===== Dasha — 120-year timeline with drill-down navigator (v2) ===== */
const DX_LEVELS = ['Mahadasha','Antardasha','Pratyantar','Sookshma','Prana'];
const DX_SHORT = ['Maha','Antar','Pratyantar','Sookshma','Prana'];
const DX_ABBR = {Ketu:'Ke',Venus:'Ve',Sun:'Su',Moon:'Mo',Mars:'Ma',Rahu:'Ra',Jupiter:'Ju',Saturn:'Sa',Mercury:'Me'};
let DX = { dasha:null, birth:null, tz:0, mds:[] };
let DXN = { path: [], at: null };

function dxAge(d){ return (d - DX.birth) / (365.25*86400000); }
function dxAgeTxt(a){ return Math.max(0,a).toFixed(a<10?1:0).replace(/\.0$/,''); }
function dxDur(y){ return y>=1 ? (y%1<0.05||y%1>0.95 ? Math.round(y)+'y' : y.toFixed(1)+'y') : (y*12>=1 ? Math.round(y*12)+'mo' : Math.max(1,Math.round(y*365.25))+'d'); }
function dxLocal(d){ return new Date(d.getTime() + DX.tz * 3600000); }
function dxFmt(d, lvl){
  const L = dxLocal(d), mon = PN_MON[L.getUTCMonth()];
  if (lvl <= 1) return `${mon} ${L.getUTCFullYear()}`;
  const base = `${L.getUTCDate()} ${mon} ${L.getUTCFullYear()}`;
  return lvl >= 3 ? `${base}, ${String(L.getUTCHours()).padStart(2,'0')}:${String(L.getUTCMinutes()).padStart(2,'0')}` : base;
}
function dxFull(d){ const L = dxLocal(d); return `${L.getUTCDate()} ${PN_MON[L.getUTCMonth()]} ${L.getUTCFullYear()}, ${String(L.getUTCHours()).padStart(2,'0')}:${String(L.getUTCMinutes()).padStart(2,'0')}`; }
function dxLeft(ms){ const d = ms/86400000; if (d >= 730) return (d/365.25).toFixed(1)+' years'; if (d >= 60) return Math.round(d/30.44)+' months'; if (d >= 2) return Math.round(d)+' days'; const h = ms/3600000; return h >= 2 ? Math.round(h)+' hours' : Math.max(1,Math.round(ms/60000))+' min'; }
function dxStatus(p, now){ return now>=p.endDate ? 'past' : (now>=p.startDate ? 'now' : 'next'); }
function dxPct(p, now){ return Math.max(0,Math.min(100,(now-p.startDate)/(p.endDate-p.startDate)*100)); }
function dxRef(){ return DXN.at || new Date(); }
function dxPill(st){ return st==='now' ? `<span class="dx-pill now">${DXN.at?'Selected':'Now'}</span>` : (st==='next' ? '<span class="dx-pill">Upcoming</span>' : '<span class="dx-pill past">Past</span>'); }
function dxNames(path, lvl){ return path.map(p => (lvl>=3 ? DX_ABBR[p.lord] : p.lord)).join(' › '); }
function dxList(path){ return path.length === 0 ? DX.mds : calculateSubPeriods(path[path.length-1]); }

/* ---------- Check any date & time: all 5 levels ---------- */
function dxLadderHtml(at){
  const act = findActiveDasha(DX.dasha.mahadashas, at);
  if (!act) return '<div class="pl-empty">That moment is outside this chart’s Vimshottari cycle (before birth or beyond the calculated range).</div>';
  const lv = [act.mahadasha, act.antardasha, act.pratyantardasha, act.sookshmaDasha, act.pranaDasha];
  const path = [];
  const cards = lv.map((p,i) => {
    if (!p) return '';
    path.push(p); const c = DASHA_PLANET_COLORS[p.lord], pct = dxPct(p, at);
    return `<div class="dx-lv" style="--pc:${c}">
      <div class="dx-lv-top"><span class="dx-lv-n">${i+1}</span><small>${DX_LEVELS[i]}</small></div>
      <div class="dx-lv-main"><span class="dx-dot" style="background:${c}">${PLANET_GLYPHS[p.lord]}</span><b>${p.lord}</b></div>
      ${i>0 ? `<div class="dx-lv-path">${dxNames(path, i)}</div>` : ''}
      <div class="dx-lv-dates">${dxFull(p.startDate)}<br>→ ${dxFull(p.endDate)}</div>
      <div class="dx-bar"><i style="width:${pct.toFixed(1)}%;background:${c}"></i></div>
      <div class="dx-lv-foot"><span>${pct.toFixed(0)}% through</span><span>${dxLeft(p.endDate - at)} left</span></div>
    </div>`;
  }).join('');
  DX.chkAct = act;
  return `<div class="dx-lvs">${cards}</div>`;
}
function dxCheckRender(){
  const ds = document.getElementById('dxDate'), ts = document.getElementById('dxTime'), box = document.getElementById('dxChk'); if (!ds || !box || !ds.value) return;
  const [y,m,d] = ds.value.split('-').map(Number), [hh,mm] = (ts.value || '00:00').split(':').map(Number);
  const at = new Date(Date.UTC(y, m-1, d, hh, mm) - DX.tz*3600000);
  DX.chkAt = at; box.innerHTML = dxLadderHtml(at);
}
function dxSetCheck(jd){ const p = jdToLocalParts(jd, DX.tz); document.getElementById('dxDate').value = p.dateStr; document.getElementById('dxTime').value = p.timeStr.slice(0,5); dxCheckRender(); }

/* ---------- Drill-down navigator ---------- */
function dxRowHtml(p, idx, lvl, path, ref){
  const st = dxStatus(p, ref), c = DASHA_PLANET_COLORS[p.lord], drill = lvl < 4;
  return `<div class="dx-row ${st}"><button type="button" class="dx-row-h" ${drill ? `data-dx-in="${idx}"` : 'disabled'}>
      <span class="dx-dot" style="background:${c}">${PLANET_GLYPHS[p.lord]}</span>
      <span class="dx-row-main"><b>${dxNames(path.concat([p]), lvl)}</b><small>${dxFmt(p.startDate,lvl)} → ${dxFmt(p.endDate,lvl)}</small></span>
      <span class="dx-row-side"><span class="dx-age">Age ${dxAgeTxt(dxAge(p.startDate))}–${dxAgeTxt(dxAge(p.endDate))}</span>${dxPill(st)}</span>
      ${drill ? '<span class="dx-chev">›</span>' : '<span class="dx-chev"></span>'}</button>
    ${st==='now' ? `<div class="dx-bar"><i style="width:${dxPct(p,ref).toFixed(1)}%;background:${c}"></i></div>` : ''}</div>`;
}
function dxNavHtml(){
  const ref = dxRef(), path = DXN.path, L = path.length, list = dxList(path);
  const steps = DX_SHORT.map((nm,i) => {
    const sel = path[i], cur = i === L;
    return `<button type="button" class="dx-st ${cur?'cur':''} ${sel?'has':''}" data-dx-lvl="${i}" ${i>L?'disabled':''}><small>${nm}</small><b>${sel ? PLANET_GLYPHS[sel.lord]+' '+DX_ABBR[sel.lord] : (cur ? 'pick ↓' : '·')}</b></button>`;
  }).join('');
  let head;
  if (L === 0){
    head = `<div class="dx-ctx"><div class="dx-ctx-t"><b>All Mahadashas</b><small>The full 120-year cycle · tap one to open its Antardashas</small></div></div>`;
  } else {
    const cur = path[L-1], parent = L === 1 ? DX.mds : calculateSubPeriods(path[L-2]), i = parent.findIndex(x => x.startDate.getTime() === cur.startDate.getTime());
    const prev = parent[i-1], next = parent[i+1], c = DASHA_PLANET_COLORS[cur.lord], st = dxStatus(cur, ref), lvl = L-1;
    head = `<div class="dx-ctx" style="--pc:${c}"><div class="dx-ctx-bar">
        <button type="button" class="dx-nav" data-dx-sib="-1" ${prev?'':'disabled'}>‹ ${prev ? DX_ABBR[prev.lord] : ''}</button>
        <button type="button" class="dx-nav up" data-dx-up>↑ Up</button>
        <button type="button" class="dx-nav" data-dx-sib="1" ${next?'':'disabled'}>${next ? DX_ABBR[next.lord] : ''} ›</button></div>
      <div class="dx-ctx-t"><span class="dx-bigglyph">${PLANET_GLYPHS[cur.lord]}</span><div><b>${dxNames(path, L)} ${DX_LEVELS[lvl]}</b>
        <small>${dxFmt(cur.startDate, Math.max(lvl,2))} → ${dxFmt(cur.endDate, Math.max(lvl,2))} · ${dxPill(st).replace(/<[^>]+>/g,'')}</small></div></div>
      ${st==='now' ? `<div class="dx-bar big"><i style="width:${dxPct(cur,ref).toFixed(1)}%;background:${c}"></i></div>` : ''}</div>`;
  }
  const rows = list.map((p,idx) => dxRowHtml(p, idx, L, path, ref)).join('');
  return `<div class="dx-steps">${steps}</div>${head}
    <div class="dx-lh"><h6>${DX_LEVELS[L]}${L===0?'s':' periods'} <span>${list.length} ${list.length===1?'period':'periods'}</span></h6><button type="button" class="dx-nowbtn" data-dx-now>📍 Go to now</button></div>
    <div class="dx-list">${rows}</div>`;
}
function dxNavRender(scroll){
  const box = document.getElementById('dxNav'); if (!box) return;
  box.innerHTML = dxNavHtml();
  if (scroll){ const n = box.querySelector('.dx-row.now'); (n || box).scrollIntoView({ behavior:'smooth', block: n ? 'center' : 'start' }); }
}
function dxPathAt(at, depth){ // chain of periods containing `at`, up to `depth` levels
  const act = findActiveDasha(DX.dasha.mahadashas, at); if (!act) return [];
  return [act.mahadasha, act.antardasha, act.pratyantardasha, act.sookshmaDasha, act.pranaDasha].filter(Boolean).slice(0, depth);
}

function buildDashaSection(chart, profile){
  const dasha = chart.dashaData, now = new Date();
  DX = { dasha, birth: dasha.mahadashas[0].startDate, tz: profile && profile.tz !== undefined ? profile.tz : 0, mds: [] };
  const cap = DX.birth.getTime() + 120*365.25*86400000;
  const mds = dasha.mahadashas.filter(m => m.startDate.getTime() < cap); DX.mds = mds;
  const active = findActiveDasha(dasha.mahadashas, now), span = cap - DX.birth.getTime();
  const nowFrac = Math.max(0, Math.min(1, (now - DX.birth)/span)), age = dxAge(now);
  DXN = { path: active ? [active.mahadasha] : [], at: null };

  let nowCard;
  if (active){
    const lv = [active.mahadasha, active.antardasha, active.pratyantardasha, active.sookshmaDasha, active.pranaDasha].filter(Boolean);
    const m = active.mahadasha, c = DASHA_PLANET_COLORS[m.lord];
    nowCard = `<div class="dx-now" style="--pc:${c}">
      <div class="dx-now-top"><span class="dx-bigglyph">${PLANET_GLYPHS[m.lord]}</span>
        <div><div class="dx-eyebrow">You are in</div><h4>${m.lord} – ${active.antardasha?active.antardasha.lord:''} period</h4>
        <small>Age ${age.toFixed(1)} · ${yearsUntil(now, m.endDate)} left in ${m.lord} Mahadasha</small></div></div>
      <div class="dx-bar big"><i style="width:${dxPct(m,now).toFixed(1)}%;background:${c}"></i></div>
      <div class="dx-bar-lbl"><span>${dxFmt(m.startDate,1)}</span><span>${dxPct(m,now).toFixed(0)}% through</span><span>${dxFmt(m.endDate,1)}</span></div>
      <div class="dx-ladder">${lv.map((p,i)=>`<div class="dx-step"><span class="dx-step-l">${DX_LEVELS[i]}</span><span class="dx-step-p"><i style="background:${DASHA_PLANET_COLORS[p.lord]}"></i>${PLANET_GLYPHS[p.lord]} ${p.lord}</span><span class="dx-step-e">until ${dxFmt(p.endDate,Math.max(i,2))}</span></div>`).join('')}</div>
    </div>`;
  } else nowCard = `<div class="dx-now"><div class="dx-eyebrow">Today is outside this chart's 120-year range.</div></div>`;

  let segs = '', ticks = '';
  mds.forEach((m,i) => {
    const s = m.startDate.getTime()-DX.birth.getTime(), e = Math.min(m.endDate.getTime(), cap)-DX.birth.getTime(), w = (e-s)/span*100;
    segs += `<button type="button" class="dx-seg ${active && active.mahadasha===m ? 'is-now':''}" data-dx-md="${i}" style="width:${w}%;background:${DASHA_PLANET_COLORS[m.lord]}" title="${m.lord} ${dxAgeTxt(dxAge(m.startDate))}–${dxAgeTxt(Math.min(120,dxAge(m.endDate)))}"><span class="g">${PLANET_GLYPHS[m.lord]}</span>${w>7?`<span class="n">${m.lord}</span>`:''}</button>`;
  });
  for (let a=0;a<=120;a+=10) ticks += `<span style="left:${a/120*100}%">${a}</span>`;
  const strip = `<div class="dx-strip-scroll"><div class="dx-strip-wrap"><div class="dx-strip">${segs}</div><div class="dx-ticks">${ticks}</div>
      ${active?`<div class="dx-today" style="left:${nowFrac*100}%"><span>Today · ${age.toFixed(0)}</span></div>`:''}</div></div>`;

  setTimeout(() => { dxSetCheck(nowJulianDay()); dxNavRender(false); const sc=document.querySelector('.dx-strip-scroll'), t=document.querySelector('.dx-today'); if(sc&&t&&sc.scrollWidth>sc.clientWidth) sc.scrollLeft = t.offsetLeft - sc.clientWidth/2; }, 0);

  return `<div class="dx">
    <div class="dx-intro">Your life runs through nine planetary periods in a fixed 120-year cycle, starting from the Moon's nakshatra. Begins with <b>${dasha.startLord}</b> (${dasha.balanceYears.toFixed(1)} years remaining at birth).</div>
    ${nowCard}
    <div class="dx-sec"><h5>🔎 Check any date &amp; time <span>all 5 levels at that moment</span></h5>
      <div class="dx-chk"><div class="dx-chk-in">
        <label>Date<input type="date" id="dxDate"></label><label>Time<input type="time" id="dxTime"></label>
        <div class="dx-chk-q"><button type="button" data-dx-q="now">Now</button><button type="button" data-dx-q="birth">At birth</button><button type="button" data-dx-q="open" class="gold">Open in navigator →</button></div></div>
        <div id="dxChk"></div></div></div>
    <div class="dx-sec"><h5>① Life timeline <span>0 – 120 years · tap a planet</span></h5>${strip}</div>
    <div class="dx-sec"><h5>② Explore periods <span>drill down level by level</span></h5><div id="dxNav" class="dx-detail"></div></div>
  </div>`;
}

document.addEventListener('click', (e) => {
  if (!DX.dasha) return;
  const md = e.target.closest('[data-dx-md]');
  if (md){ DXN.at = null; DXN.path = [DX.mds[parseInt(md.dataset.dxMd)]]; dxNavRender(false); const n = document.getElementById('dxNav'); if (n) n.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  const into = e.target.closest('[data-dx-in]');
  if (into){ DXN.path = DXN.path.concat([dxList(DXN.path)[parseInt(into.dataset.dxIn)]]); dxNavRender(false); const n = document.getElementById('dxNav'); if (n && n.getBoundingClientRect().top < 0) n.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  const lvl = e.target.closest('[data-dx-lvl]');
  if (lvl && !lvl.disabled){ DXN.path = DXN.path.slice(0, parseInt(lvl.dataset.dxLvl)); dxNavRender(false); return; }
  if (e.target.closest('[data-dx-up]')){ DXN.path = DXN.path.slice(0, -1); dxNavRender(false); return; }
  const sib = e.target.closest('[data-dx-sib]');
  if (sib && !sib.disabled){
    const L = DXN.path.length, parent = L === 1 ? DX.mds : calculateSubPeriods(DXN.path[L-2]), cur = DXN.path[L-1];
    const i = parent.findIndex(x => x.startDate.getTime() === cur.startDate.getTime()), n = parent[i + parseInt(sib.dataset.dxSib)];
    if (n){ DXN.path = DXN.path.slice(0, -1).concat([n]); dxNavRender(false); } return;
  }
  if (e.target.closest('[data-dx-now]')){ DXN.at = null; DXN.path = dxPathAt(new Date(), 2); dxNavRender(true); return; }
  const q = e.target.closest('[data-dx-q]');
  if (q){
    if (q.dataset.dxQ === 'now') dxSetCheck(nowJulianDay());
    else if (q.dataset.dxQ === 'birth') dxSetCheck(DX.birth.getTime()/86400000 + 2440587.5 + 0.0001);
    else if (q.dataset.dxQ === 'open' && DX.chkAt){ DXN.at = DX.chkAt; DXN.path = dxPathAt(DX.chkAt, 4); dxNavRender(true); }
  }
});
document.addEventListener('input', (e) => { if (DX.dasha && (e.target.id === 'dxDate' || e.target.id === 'dxTime')) dxCheckRender(); });

function formatDashaDate(d){
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function formatDashaDatePrecise(d){
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function formatDashaDateTime(d){
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UT`;
}

const dashaPeriodCache = {};
const DASHA_LEVEL_NEXT = { antardasha:"pratyantar", pratyantar:"sookshma", sookshma:"prana", prana:null };
const DASHA_LEVEL_PREFIX = { pratyantar:"pr", sookshma:"sk", prana:"pn" };

function buildDashaLevelChips(parentPeriod, parentKey, level, now){
  const periods = calculateSubPeriods(parentPeriod);
  const nextLevel = DASHA_LEVEL_NEXT[level];
  const useDateTime = (level === "sookshma");
  const fmt = (level === "antardasha") ? formatDashaDate : formatDashaDatePrecise;
  return periods.map((p, idx)=>{
    const isActive = now >= p.startDate && now < p.endDate;
    const childKey = `${parentKey}-${DASHA_LEVEL_PREFIX[nextLevel] || 'x'}${idx}`;
    dashaPeriodCache[childKey] = p;
    const canDrillFurther = DASHA_LEVEL_NEXT[nextLevel] !== undefined && nextLevel !== null;
    return `<span class="dasha-ad-chip ${isActive?'ad-active':''} ${canDrillFurther?'dasha-drill-chip':''}" ${canDrillFurther?`data-drill-key="${childKey}" data-drill-level="${nextLevel}"`:''}>
      ${PLANET_GLYPHS[p.lord]} ${p.lord}: ${fmt(p.startDate)}–${fmt(p.endDate)}${canDrillFurther?' <span class="dasha-drill-hint">▸</span>':''}
    </span>${canDrillFurther?`<div class="dasha-drill-panel" id="drill-${childKey}" style="display:none;"></div>`:''}`;
  }).join('');
}

function buildAntardashaChips(mahadasha, active, now, mdIdx){
  const parentKey = `md${mdIdx}`;
  dashaPeriodCache[parentKey] = mahadasha;
  return buildDashaLevelChips(mahadasha, parentKey, "antardasha", now);
}

function expandDashaLevel(key, level){
  const parentPeriod = dashaPeriodCache[key];
  const panel = document.getElementById('drill-'+key);
  if (!parentPeriod || !panel) return;
  const now = new Date();
  if (panel.dataset.expanded === 'true'){
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
    return;
  }
  const label = level === "pratyantar" ? "Pratyantardasha" : level === "sookshma" ? "Sookshma Dasha" : "Prana Dasha";
  panel.innerHTML = `<div class="dasha-drill-label">${label} (within ${parentPeriod.lord}):</div><div class="dasha-drill-chips">${buildDashaLevelChips(parentPeriod, key, level, now)}</div>`;
  panel.dataset.expanded = 'true';
  panel.style.display = '';
}
function yearsUntil(from, to){
  const years = (to - from) / (365.25*24*60*60*1000);
  if (years < 0) return "0 years";
  if (years < 1) return Math.round(years*12) + " months";
  return years.toFixed(1) + " years";
}

const YOGA_DESCRIPTIONS = {
  Ruchaka: "Mars in own sign or exaltation, angled from Lagna. Classically linked to courage, physical vigor, and leadership.",
  Bhadra: "Mercury in own sign or exaltation, angled from Lagna. Linked to sharp intellect and communication skill.",
  Hamsa: "Jupiter in own sign or exaltation, angled from Lagna. Linked to wisdom, ethics, and respected standing.",
  Malavya: "Venus in own sign or exaltation, angled from Lagna. Linked to refinement, comfort, and artistic sense.",
  Sasa: "Saturn in own sign or exaltation, angled from Lagna. Linked to discipline, endurance, and authority through effort."
};

/* ===== Yogas (redesigned) ===== */
const YG_CATS = {
  maha:{label:'Mahapurusha',icon:'👑',c:'#D4AF37'}, gaja:{label:'Wisdom & Fame',icon:'🐘',c:'#5EC4B7'},
  raja:{label:'Power & Status',icon:'⚜',c:'#E0A64A'}, swap:{label:'Exchange',icon:'⇄',c:'#8A6FB8'},
  rev:{label:'Reversal',icon:'↺',c:'#C95050'}, cancel:{label:'Cancellation',icon:'✚',c:'#5B8A9E'}
};
function buildYogaSection(chart){
  const y = chart.yogas, cards = [];
  y.panchaMahapurusha.forEach(p=> cards.push({cat:'maha', name:`${p.yoga} Yoga`, pl:[p.planet],
    detail:`Formed by <b>${p.planet}</b> placed in <b>${SIGNS[p.sign].name}</b> (House ${p.house}). ${YOGA_DESCRIPTIONS[p.yoga]}`}));
  if (y.gajaKesari) cards.push({cat:'gaja', name:'Gaja Kesari Yoga', pl:['Jupiter','Moon'],
    detail:`Jupiter (House ${y.gajaKesari.jupiterHouse}) sits in a kendra from the Moon (House ${y.gajaKesari.moonHouse}). One of the most cited yogas for reputation, wisdom, and steady success.`});
  y.rajaYogas.forEach(r=> cards.push({cat:'raja', name:'Raja Yoga', pl:[r.kendraLord,r.trikonaLord],
    detail:`The lord of a kendra house (<b>${r.kendraLord}</b>) and the lord of a trikona house (<b>${r.trikonaLord}</b>) are connected by ${r.type}. Classically associated with rising status and authority.`}));
  y.parivartana.forEach(p=> cards.push({cat:'swap', name:'Parivartana Yoga', pl:[p.lordA,p.lordB],
    detail:`House ${p.houseA} and House ${p.houseB} exchange lords: <b>${p.lordA}</b> and <b>${p.lordB}</b> each sit in the other's house. Strengthens both houses through mutual support.`}));
  y.viparitaRaja.forEach(v=> cards.push({cat:'rev', caution:true, name:v.yoga||'Viparita Raja Yoga', pl:[v.lordA,v.lordB],
    detail:`<b>${v.lordA}</b> rules House ${v.houseA} and sits in House ${v.houseB} (${v.type}). A dusthana lord in a dusthana destroys its own troubles — gains and success that rise out of hardship, enemies and setbacks.`}));
  y.neechaBhanga.forEach(n=> cards.push({cat:'cancel', name:'Neecha Bhanga Raja Yoga', pl:[n.planet,n.dispositor],
    detail:`<b>${n.planet}</b>'s debilitation is cancelled: its dispositor <b>${n.dispositor}</b> is ${n.condition}. A weakness in the chart converts toward strength.`}));

  if (!cards.length) return `<div class="yg"><div class="yoga-empty-state">No major classical yogas from this detection set were found in this chart. Covered: Pancha Mahapurusha, Gaja Kesari, Raja, Parivartana, Viparita Raja and Neecha Bhanga — many more exist in the classical texts.</div></div>`;

  const counts = {}; cards.forEach(c=> counts[c.cat]=(counts[c.cat]||0)+1);
  const good = cards.filter(c=>!c.caution).length;
  const chips = `<button type="button" class="yg-chip on" data-yg-f="all">All <b>${cards.length}</b></button>` +
    Object.keys(counts).map(k=>`<button type="button" class="yg-chip" data-yg-f="${k}" style="--cc:${YG_CATS[k].c}">${YG_CATS[k].icon} ${YG_CATS[k].label} <b>${counts[k]}</b></button>`).join('');
  const grid = cards.map(c=>{
    const k = YG_CATS[c.cat], first = c.detail.split(/\.\s/)[0] + '.';
    return `<div class="yoga-card yg-card ${c.caution?'yoga-caution':''}" data-yg-cat="${c.cat}" style="--cc:${k.c}">
      <button type="button" class="yg-head" data-yg-open>
        <span class="yg-ico">${k.icon}</span>
        <span class="yg-title"><b class="yoga-card-name">${c.name}</b><em>${k.label}</em></span>
        <span class="yg-chev">▸</span>
      </button>
      <div class="yg-pl">${[...new Set(c.pl)].map(p=>`<span class="yg-p" style="--pc:${DASHA_PLANET_COLORS[p]||'#888'}">${PLANET_GLYPHS[p]||''} ${p}</span>`).join('')}</div>
      <div class="yg-sum yoga-card-detail">${first}</div>
      <div class="yg-full yoga-card-detail" hidden>${c.detail}</div>
    </div>`;
  }).join('');
  return `<div class="yg">
    <div class="yg-hero">
      <div class="yg-big"><span>${cards.length}</span><small>yogas found</small></div>
      <div class="yg-big"><span style="color:var(--teal-bright)">${good}</span><small>supportive</small></div>
      <div class="yg-big"><span style="color:#E07070">${cards.length-good}</span><small>challenging</small></div>
    </div>
    <div class="yg-intro">Yogas are classical planet-house-sign combinations believed to colour a chart's themes. Filter by type, then tap a card to read what it means. This is a focused, verified set — not every yoga in the texts.</div>
    <div class="yg-chips">${chips}</div>
    <div class="yg-grid">${grid}</div>
  </div>`;
}
document.addEventListener('click', (e)=>{
  const f = e.target.closest('[data-yg-f]');
  if (f){
    const k = f.dataset.ygF;
    document.querySelectorAll('.yg-chip').forEach(c=>c.classList.toggle('on', c===f));
    document.querySelectorAll('.yg-card').forEach(c=>{ c.hidden = !(k==='all' || c.dataset.ygCat===k); });
    return;
  }
  const o = e.target.closest('[data-yg-open]');
  if (o){
    const card = o.closest('.yg-card'), full = card.querySelector('.yg-full'), sum = card.querySelector('.yg-sum');
    const open = full.hidden; full.hidden = !open; sum.hidden = open; card.classList.toggle('open', open);
  }
});

/* ===== Shadbala (redesigned) ===== */
const SB_COMPS = [['sthanaBala','Positional','Sthana',true],['digBala','Directional','Dig',false],['kalaBala','Temporal','Kala',true],['chestaBala','Motional','Chesta',false],['naisargikaBala','Natural','Naisargika',false],['drikBala','Aspectual','Drik',false]];
function buildShadbalaSection(chart){
  const sb = chart.shadbala;
  const list = BALA_PLANETS.map(n=>({n, s:sb.planets[n]})).sort((a,b)=> b.s.percentOfRequired - a.s.percentOfRequired);
  const best = list[0], worst = list[list.length-1];
  const strongCount = list.filter(x=>x.s.isStrong).length;
  const maxPct = Math.max(150, ...list.map(x=>x.s.percentOfRequired));
  const reqPos = 100/maxPct*100;

  const rows = list.map((x,i)=>{
    const {n,s} = x, c = DASHA_PLANET_COLORS[n], w = Math.min(100, s.percentOfRequired/maxPct*100);
    const comps = SB_COMPS.map(([k,lab,_sk,nested])=>({lab, v:(nested?s[k].total:s[k])/60}));
    const mx = Math.max(...comps.map(c2=>Math.abs(c2.v)), 0.01);
    return `<div class="shadbala-card sb-row ${s.isStrong?'strong':'weak'}" style="--pc:${c}">
      <button type="button" class="sb-head" data-sb-open>
        <span class="sb-rank">${i+1}</span>
        <span class="sb-glyph" style="background:${c}">${PLANET_GLYPHS[n]}</span>
        <span class="sb-main">
          <span class="sb-top"><b>${n}</b><span class="sb-num">${s.totalRupas.toFixed(2)} <small>/ ${s.requiredRupas} R</small></span></span>
          <span class="sb-track"><i style="width:${w}%;background:${s.isStrong?c:'#C95050'}"></i><u style="left:${reqPos}%"></u></span>
          <span class="sb-sub"><span class="sb-badge ${s.isStrong?'ok':'low'}">${s.isStrong?'Strong':'Below threshold'}</span><span>${s.percentOfRequired.toFixed(0)}% of required</span></span>
        </span>
        <span class="sb-chev">▸</span>
      </button>
      <div class="sb-body" hidden>
        ${comps.map(c2=>`<div class="sb-comp"><span>${c2.lab}</span><span class="sb-ctrack"><i style="width:${Math.max(3,Math.abs(c2.v)/mx*100)}%;background:${c2.v<0?'#C95050':c}"></i></span><b>${c2.v.toFixed(2)}R</b></div>`).join('')}
        <button type="button" class="sb-more planet-clickable" data-planet-click="${n}">Full ${n} details →</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="sb">
    <div class="sb-hero">
      <div class="sb-h strong"><small>Strongest</small><b>${PLANET_GLYPHS[best.n]} ${best.n}</b><span>${best.s.percentOfRequired.toFixed(0)}%</span></div>
      <div class="sb-h weak"><small>Weakest</small><b>${PLANET_GLYPHS[worst.n]} ${worst.n}</b><span>${worst.s.percentOfRequired.toFixed(0)}%</span></div>
      <div class="sb-h"><small>Above threshold</small><b>${strongCount} of ${list.length}</b><span>planets</span></div>
    </div>
    <div class="sb-intro">Planets ranked by total strength. The white tick on each bar marks the required minimum (100%). Tap a planet to see its six components.</div>
    <div class="sb-list">${rows}</div>
    <details class="sb-note"><summary>Time lords at birth</summary>
      <div class="shadbala-lords-row"><div class="shadbala-lord-chip">Day lord: <b>${sb.dinaLord}</b></div><div class="shadbala-lord-chip">Hour lord: <b>${sb.horaLord}</b></div><div class="shadbala-lord-chip">Year lord (approx.): <b>${sb.varshaLord}</b></div><div class="shadbala-lord-chip">Month lord (approx.): <b>${sb.masaLord}</b></div></div>
    </details>
    <details class="sb-note"><summary>How to read this</summary>
      <p>Strength combines six classical measures: positional dignity, directional placement, timing of birth, motional speed, a natural baseline, and aspects received. 1 Rupa = 60 Virupas. Year-Lord and Month-Lord follow one documented convention since classical sources differ on where the solar year/month begins.</p>
    </details>
  </div>`;
}
document.addEventListener('click', (e)=>{
  const o = e.target.closest('[data-sb-open]');
  if (!o) return;
  const row = o.closest('.sb-row'), body = row.querySelector('.sb-body');
  body.hidden = !body.hidden; row.classList.toggle('open', !body.hidden);
});

function buildAshtakavargaSection(chart){
  window.__avChart=chart;
  const av=chart.ashtakavarga,asc=chart.ascendant.sign,pos={Lagna:asc};BAV_PLANETS.forEach(n=>pos[n]=chart.planets[n].sign);
  const sum=a=>a.reduce((x,y)=>x+y,0),cls=(v,k)=>k==='SAV'?(v>=32?'t3':v>=28?'t2':v>=25?'t1':'t0'):(v>=6?'t3':v>=4?'t2':v>=3?'t1':'t0');
  const occ=s=>PLANET_LIST.filter(n=>chart.planets[n].sign===s).map(n=>PLANET_GLYPHS[n]).join(' ');
  const order=Array.from({length:12},(_,h)=>(asc+h)%12), vals=k=>k==='SAV'?av.sav:av.bavTables[k];
  const sgn=s=>SIGNS[s].symbol+' '+SIGNS[s].name;
  function view(k){
    const v=vals(k),t=sum(v),avg=t/12,mx=k==='SAV'?Math.max(...v):8,hi=order.reduce((m,s)=>v[s]>v[m]?s:m,order[0]),lo=order.reduce((m,s)=>v[s]<v[m]?s:m,order[0]);
    const lim=k==='SAV'?28:Math.ceil(avg),n=order.filter(s=>v[s]>=lim).length,me=k==='SAV'?null:pos[k];
    const tiles=order.map((s,h)=>`<button type="button" class="avx-t ${cls(v[s],k)}" data-k="${k}" data-s="${s}"><em>${h+1}</em><i>${SIGNS[s].symbol}</i><b>${v[s]}</b><small>${SIGNS[s].name}</small><u style="width:${v[s]/mx*100}%"></u><span>${occ(s)||'&nbsp;'}</span></button>`).join('');
    let pr='';
    if(k==='SAV'){pr=`<table class="avx-tb"><tr><th></th>${order.map((s,h)=>`<th>${h+1}</th>`).join('')}<th>Σ</th></tr>${BAV_PLANETS.map(p=>`<tr><th>${PLANET_GLYPHS[p]}</th>${order.map(s=>`<td class="${cls(av.bavTables[p][s],p)}">${av.bavTables[p][s]}</td>`).join('')}<td><b>${sum(av.bavTables[p])}</b></td></tr>`).join('')}<tr class="tot"><th>Σ</th>${order.map(s=>`<td class="${cls(av.sav[s],'SAV')}">${av.sav[s]}</td>`).join('')}<td><b>${t}</b></td></tr></table>`;}
    else{const rows=CONTRIBUTORS.map(c=>{const g=signsFromOffsets(pos[c],CONTRIBUTION_TABLE[k][c]);return `<tr><th>${c==='Lagna'?'Lg':PLANET_GLYPHS[c]}</th>${order.map(s=>`<td class="${g.includes(s)?'on':''}">${g.includes(s)?'●':''}</td>`).join('')}<td><b>${g.length}</b></td></tr>`}).join('');
      pr=`<table class="avx-tb"><tr><th></th>${order.map((s,h)=>`<th>${h+1}</th>`).join('')}<th>Σ</th></tr>${rows}<tr class="tot"><th>Σ</th>${order.map(s=>`<td class="${cls(v[s],k)}">${v[s]}</td>`).join('')}<td><b>${t}</b></td></tr></table>`;}
    return `<div class="avx-panel${k==='SAV'?' on':''}" data-p="${k}"><div class="avx-sum"><div><label>Total</label><b>${t}</b><small>${k==='SAV'?'of 337':'fixed constant'}</small></div><div><label>Average</label><b>${avg.toFixed(1)}</b><small>per sign</small></div><div><label>Strongest</label><b>${v[hi]}</b><small>${sgn(hi)}</small></div><div><label>Weakest</label><b>${v[lo]}</b><small>${sgn(lo)}</small></div><div><label>${k==='SAV'?'Signs ≥ 28':'Signs ≥ '+lim}</label><b>${n}/12</b><small>${k==='SAV'?'above the 28 average':'above average'}</small></div>${me!=null?`<div><label>${k} sits in</label><b>${v[me]}</b><small>${sgn(me)} · ${v[me]>=4?'supported':'weak'}</small></div>`:`<div><label>Lagna sign</label><b>${v[asc]}</b><small>${sgn(asc)}</small></div>`}</div>
      <div class="avx-grid">${tiles}</div><div class="avx-det" id="avd-${k}">👆 Tap any sign to see exactly where its points come from.</div>
      <details class="avx-pr"><summary>${k==='SAV'?'All seven Bhinnashtakavarga tables, side by side':'Prastarashtakavarga — who gives each point'}</summary><div class="avx-sc">${pr}</div></details></div>`;}
  const tabs=['SAV'].concat(BAV_PLANETS).map((k,i)=>`<button type="button" class="avx-tab${i?'':' on'}" data-p="${k}"><span>${k==='SAV'?'Σ':PLANET_GLYPHS[k]}</span>${k==='SAV'?'Sarva':k}<small>${sum(vals(k))}</small></button>`).join('');
  const ok=BAV_PLANETS.every(p=>sum(av.bavTables[p])===({Sun:48,Moon:49,Mars:39,Mercury:54,Jupiter:56,Venus:52,Saturn:39})[p])&&sum(av.sav)===337;
  return `<div class="section-heading" id="sec-ashtakavarga"><h3>Ashtakavarga — Point-Strength System</h3><div class="rule"></div></div>
  <div class="avx"><div class="avx-legend"><span class="t3">Excellent</span><span class="t2">Good</span><span class="t1">Average</span><span class="t0">Weak</span><small>Signs run from your Lagna (house 1). SAV: 32+ excellent · 28+ good · 25–27 average · below 25 weak.</small></div>
  <div class="avx-tabs">${tabs}</div>${['SAV'].concat(BAV_PLANETS).map(view).join('')}
  <div class="avx-check">${ok?'✓':'✗'} Tables verified against BPHS: Sun 48 · Moon 49 · Mars 39 · Mercury 54 · Jupiter 56 · Venus 52 · Saturn 39 = 337</div></div>`;
}
if(!window.__avInit){window.__avInit=1;document.addEventListener('click',e=>{
  const tb=e.target.closest('.avx-tab');if(tb){const r=tb.closest('.avx');r.querySelectorAll('.avx-tab').forEach(x=>x.classList.toggle('on',x===tb));r.querySelectorAll('.avx-panel').forEach(x=>x.classList.toggle('on',x.dataset.p===tb.dataset.p));return;}
  const t=e.target.closest('.avx-t');if(!t)return;const c=window.__avChart,av=c.ashtakavarga,k=t.dataset.k,s=+t.dataset.s,asc=c.ascendant.sign,h=((s-asc+12)%12)+1,S=SIGNS[s],pos={Lagna:asc};BAV_PLANETS.forEach(n=>pos[n]=c.planets[n].sign);
  t.closest('.avx-panel').querySelectorAll('.avx-t').forEach(x=>x.classList.toggle('sel',x===t));let body='';
  if(k==='SAV')body=BAV_PLANETS.map(p=>`<div class="avx-r"><span>${PLANET_GLYPHS[p]} ${p}</span><i><u style="width:${av.bavTables[p][s]/8*100}%"></u></i><b>${av.bavTables[p][s]}</b></div>`).join('');
  else body=`<div class="avx-ch">`+CONTRIBUTORS.map(cn=>{const d=((s-pos[cn]+12)%12)+1,g=CONTRIBUTION_TABLE[k][cn].includes(d);return `<span class="${g?'g':'n'}">${g?'✓':'✕'} ${cn==='Lagna'?'Lagna':PLANET_GLYPHS[cn]+' '+cn}<small>${d}th from it</small></span>`}).join('')+`</div>`;
  const v=k==='SAV'?av.sav[s]:av.bavTables[k][s];
  document.getElementById('avd-'+k).innerHTML=`<div class="avx-dh"><b>${S.symbol} ${S.name}</b><span>House ${h} · ${S.sk} · lord ${S.lord}</span><em>${v} point${v===1?'':'s'}</em></div>${body}`;});}
function buildRelationshipsSection(chart){
  let pickerHtml = `<div class="rel-picker" id="relPicker">`;
  PLANET_LIST.forEach(name=>{
    pickerHtml += `<button type="button" class="rel-picker-chip" data-rel-planet="${name}"><span>${PLANET_GLYPHS[name]}</span>${name}</button>`;
  });
  pickerHtml += `</div>`;

  return `
  <div class="section-heading"><h3>Relationships — Conjunctions &amp; Aspects</h3><div class="rule"></div></div>
  <div class="rel-intro">Select two or more planets, then find when they were last in aspect and when they next will be — searched against real planetary motion, not estimated. Uses this chart's exact planetary positions as of now to search forward and backward in time.</div>
  ${pickerHtml}
  <div class="rel-system-toggle" id="relSystemToggle">
    <button type="button" class="rel-system-btn active" data-rel-system="vedic">Vedic (House Aspects)</button>
    <button type="button" class="rel-system-btn" data-rel-system="western">Western (Degree Aspects)</button>
  </div>
  <div style="margin-bottom:32px;">
    <button type="button" class="btn btn-primary" id="relFindBtn">Find Relationships</button>
  </div>
  <div id="relResults"></div>`;
}

function pad(str, len){ str = String(str); return str + ' '.repeat(Math.max(0,len-str.length)); }
function rule(char, len){ return (char||'-').repeat(len||70); }
function centerLine(str, width){
  width = width || 70;
  const padTotal = Math.max(0, width - str.length);
  const left = Math.floor(padTotal/2);
  return ' '.repeat(left) + str;
}

function buildFullReportText(chart, profile, sections, liveSkyData){
  sections = sections || {}; 
  const want = (key) => sections[key] !== false; 
  const lines = [];
  const W = 78;
  const add = (s='') => lines.push(s);
  const section = (title) => { add(); add(rule('=', W)); add(centerLine(title, W)); add(rule('=', W)); add(); };
  const subsection = (title) => { add(); add(title); add(rule('-', title.length)); };

  add(rule('=', W));
  add(centerLine('Vedic Astrology — FULL VEDIC BIRTH CHART REPORT', W));
  add(rule('=', W));
  add(`Generated: ${new Date().toString()}`);
  add();

  if (want('birthDetails')){
    section('BIRTH DETAILS');
    add(`Name:            ${profile.name}`);
    add(`Date of Birth:   ${profile.dob}`);
    add(`Time of Birth:   ${profile.tob}`);
    add(`Timezone:        ${fmtTz(profile.tz)}`);
    add(`Place of Birth:  ${profile.place}`);
    add(`Coordinates:     ${profile.lat.toFixed(4)}°, ${profile.lon.toFixed(4)}°`);
    add(`Ayanamsa:        Lahiri, ${chart.ayanamsa.toFixed(4)}°`);
    add(`Julian Day (UT): ${chart.julianDay.toFixed(6)}`);
  }

  const ascSign = SIGNS[chart.ascendant.sign];
  const moonSign = SIGNS[chart.planets.Moon.sign];
  const sunSign = SIGNS[chart.planets.Sun.sign];
  const moonNak = chart.planets.Moon.nakshatra;
  if (want('chartSummary')){
    section('CHART SUMMARY');
    add(`Ascendant (Lagna):    ${ascSign.name} (${ascSign.sk}), Lord ${ascSign.lord}, ${formatDeg(chart.ascendant.degInSign)}`);
    add(`Moon Sign (Rashi):    ${moonSign.name} (${moonSign.sk}), Lord ${moonSign.lord}, ${formatDeg(chart.planets.Moon.degInSign)}`);
    add(`Sun Sign:             ${sunSign.name} (${sunSign.sk}), Lord ${sunSign.lord}, ${formatDeg(chart.planets.Sun.degInSign)}`);
    add(`Janma Nakshatra:      ${moonNak.name}, Pada ${moonNak.pada}, Lord ${moonNak.lord}, Deity ${moonNak.deity}`);
    add(`Lagna Nakshatra:      ${chart.ascendant.nakshatra.name}, Pada ${chart.ascendant.nakshatra.pada}`);
  }

  if (want('karakas')){
    section('CHARA KARAKA (JAIMINI SOUL SIGNIFICATORS)');
    KARAKA_NAMES.forEach(k=>{
      const data = chart.charaKarakas[k];
      add(`${pad(k+':',18)} ${pad(data.planet,10)} ${formatDeg(data.degree)}  -  ${KARAKA_SIGNIFICANCE[k]}`);
    });
  }

  if (want('planetTable')){
    section('GRAHA SPHUTA — PLANETARY POSITIONS (D1)');
    PLANET_LIST.forEach(name=>{
      const p = chart.planets[name];
      const sign = SIGNS[p.sign];
      add(`${pad(name,10)} ${sign.name} (${sign.sk}), ${formatDeg(p.degInSign)}  |  House ${p.house}  |  Lord: ${sign.lord}${p.retrograde ? '  |  RETROGRADE' : ''}`);
      add(`${pad('',10)} Nakshatra: ${p.nakshatra.name}, Pada ${p.nakshatra.pada} (Lord ${p.nakshatra.lord})  |  Dignity: ${p.dignity.label}`);
      add(`${pad('',10)} Degrees traveled in sign: ${formatDeg(p.degInSign)}  |  Degrees remaining: ${formatDeg(p.degRemainingInSign)}  |  Speed: ${Math.abs(p.speed).toFixed(4)}°/day ${p.retrograde?'(retrograde)':'(direct)'}`);
      add(`${pad('',10)} Absolute sidereal longitude: ${formatDeg(normDeg(p.longitude))}  |  Aspects houses: ${p.aspectsHouses.map(h=>'H'+h).join(', ')}`);
    });

    subsection('Outer Planets (modern; not used in classical Vedic strength or dasha)');
    OUTER_LIST.forEach(n=>{
      const o = chart.outer[n], sg = SIGNS[o.sign];
      add(`${pad(n,10)} ${sg.name} (${sg.sk}), ${formatDeg(o.degInSign)}  |  House ${o.house}${o.retrograde ? '  |  RETROGRADE' : ''}  |  Nakshatra: ${o.nakshatra.name}, Pada ${o.nakshatra.pada}  |  Absolute sidereal longitude: ${formatDeg(normDeg(o.longitude))}`);
      add(`${pad('',10)} Themes: ${OUTER_INFO[n].themes.slice(0,4).join(', ')}  |  ${outerHouseLine(n, o.house)}`);
      const tg = PLANET_LIST.map(x=>[x, chart.planets[x].longitude]).concat(OUTER_LIST.map(x=>[x, chart.outer[x].longitude])).concat([['Ascendant', chart.ascendant.longitude]]);
      const a = outerAspectsTo(o.longitude, tg, n);
      add(`${pad('',10)} Western aspects: ${a.length ? a.map(r=>`${r.asp.name} ${r.target} (${r.dev.toFixed(1)}° orb)`).join('; ') : 'none within orb'}`);
    });

    subsection('Combustion Status');
    PLANET_LIST.forEach(name=>{
      const p = chart.planets[name];
      if (p.combustion && p.combustion.separation !== undefined){
        add(`${pad(name,10)} ${p.combustion.separation.toFixed(2)}° from Sun  -  ${p.combustion.combust ? 'COMBUST (orb '+p.combustion.orb+'°)' : 'Not combust'}`);
      }
    });
    if (chart.wars && chart.wars.length){
      subsection('Planetary War (Graha Yuddha)');
      chart.wars.forEach(w=> add(`${w.planetA} vs ${w.planetB}: ${w.separation.toFixed(2)}° apart, ${w.winner} wins (simplified longitude-based rule)`));
    }
  }

  if (want('aspects')){
    section('DRISHTI — PLANETARY ASPECTS (D1)');
    PLANET_LIST.forEach(name=>{
      const p = chart.planets[name];
      const aspectedSigns = p.aspectsHouses.map(h=>{
        const signIdx = (chart.ascendant.sign + h - 1) % 12;
        return SIGNS[signIdx].name;
      });
      add(`${pad(name,10)} in House ${p.house}  ->  aspects House(s) ${p.aspectsHouses.map(h=>'H'+h).join(', ')}  (${aspectedSigns.join(', ')})`);
    });
  }

  if (want('yogas')){
    section('YOGAS — NOTABLE PLANETARY COMBINATIONS');
    const y = chart.yogas;
    let yogaCount = 0;
    y.panchaMahapurusha.forEach(p=>{ add(`${p.yoga} Yoga: ${p.planet} in ${SIGNS[p.sign].name} (House ${p.house})`); yogaCount++; });
    if (y.gajaKesari){ add(`Gaja Kesari Yoga: Jupiter (H${y.gajaKesari.jupiterHouse}) in kendra from Moon (H${y.gajaKesari.moonHouse})`); yogaCount++; }
    y.rajaYogas.forEach(r=>{ add(`Raja Yoga: kendra lord ${r.kendraLord} + trikona lord ${r.trikonaLord} (${r.type})`); yogaCount++; });
    y.parivartana.forEach(p=>{ add(`Parivartana Yoga: House ${p.houseA} <-> House ${p.houseB} (${p.lordA} / ${p.lordB} exchange)`); yogaCount++; });
    y.viparitaRaja.forEach(v=>{ add(`${v.yoga}: ${v.type} (${v.lordA})`); yogaCount++; });
    y.neechaBhanga.forEach(n=>{ add(`Neecha Bhanga Raja Yoga: ${n.planet}'s debilitation cancelled (dispositor ${n.dispositor} ${n.condition})`); yogaCount++; });
    if (yogaCount === 0) add('No yogas found from this detection set (Pancha Mahapurusha, Gaja Kesari, Raja Yoga, Parivartana, Viparita Raja Yoga, Neecha Bhanga).');
  }

  if (want('shadbala')){
    section('SHADBALA — SIX-FOLD PLANETARY STRENGTH');
    add('(Note: Varsha/Masa Lord follow one documented convention among several traditions.)');
    add(`Dina Lord (Day): ${chart.shadbala.dinaLord}   Hora Lord (Hour): ${chart.shadbala.horaLord}   Varsha Lord (Year): ${chart.shadbala.varshaLord}   Masa Lord (Month): ${chart.shadbala.masaLord}`);
    add();
    BALA_PLANETS.forEach(name=>{
      const s = chart.shadbala.planets[name];
      add(`${pad(name+':',10)} ${s.totalRupas.toFixed(2)} Rupas / ${s.requiredRupas} required  ->  ${s.isStrong?'STRONG':'BELOW THRESHOLD'} (${s.percentOfRequired.toFixed(0)}%)`);
      add(`${pad('',10)} Sthana ${(s.sthanaBala.total/60).toFixed(2)}R (Uchcha ${(s.sthanaBala.uchcha/60).toFixed(2)} + Saptavargaja ${(s.sthanaBala.saptavargaja/60).toFixed(2)} + OjaYugma ${(s.sthanaBala.ojaYugma/60).toFixed(2)} + Kendradi ${(s.sthanaBala.kendradi/60).toFixed(2)} + Drekkana ${(s.sthanaBala.drekkana/60).toFixed(2)})`);
      add(`${pad('',10)} Dig ${(s.digBala/60).toFixed(2)}R | Kala ${(s.kalaBala.total/60).toFixed(2)}R (Nathonnata ${(s.kalaBala.nathonnata/60).toFixed(2)} + Paksha ${(s.kalaBala.paksha/60).toFixed(2)} + Tribhaga ${(s.kalaBala.tribhaga/60).toFixed(2)} + VMDH ${(s.kalaBala.vmdh/60).toFixed(2)} + Ayana ${(s.kalaBala.ayana/60).toFixed(2)})`);
      add(`${pad('',10)} Chesta ${(s.chestaBala/60).toFixed(2)}R | Naisargika ${(s.naisargikaBala/60).toFixed(2)}R | Drik ${(s.drikBala/60).toFixed(2)}R`);
    });
  }

  if (want('ashtakavarga')){
    section('ASHTAKAVARGA — POINT-STRENGTH SYSTEM');
    const av = chart.ashtakavarga;
    subsection('Sarvashtakavarga (combined, all 7 planets)');
    add(pad('Sign',14) + 'Bindus');
    for (let h=0; h<12; h++){
      const signIdx = (chart.ascendant.sign + h) % 12;
      add(pad(SIGNS[signIdx].name,14) + av.sav[signIdx]);
    }
    add(`TOTAL: ${av.sav.reduce((a,b)=>a+b,0)} (theoretical constant: 337 for every chart)`);
    BALA_PLANETS.forEach(p=>{
      subsection(`${p} Bhinnashtakavarga`);
      add(pad('Sign',14) + 'Bindus');
      for (let h=0; h<12; h++){
        const signIdx = (chart.ascendant.sign + h) % 12;
        add(pad(SIGNS[signIdx].name,14) + av.bavTables[p][signIdx]);
      }
      add(`TOTAL: ${av.bavTables[p].reduce((a,b)=>a+b,0)}`);
    });
  }

  if (want('dasha')){
    section('VIMSHOTTARI DASHA — FULL PERIOD TIMELINE');
    add(`Starting lord at birth: ${chart.dashaData.startLord} (balance ${chart.dashaData.balanceYears.toFixed(2)} years)`);
    const activeNow = findActiveDasha(chart.dashaData.mahadashas, new Date());
    if (activeNow){
      subsection('Currently Active (as of report generation)');
      add(`Mahadasha:       ${activeNow.mahadasha.lord}  (${formatDashaDate(activeNow.mahadasha.startDate)} -> ${formatDashaDate(activeNow.mahadasha.endDate)})`);
      if (activeNow.antardasha) add(`Antardasha:      ${activeNow.antardasha.lord}  (${formatDashaDate(activeNow.antardasha.startDate)} -> ${formatDashaDate(activeNow.antardasha.endDate)})`);
      if (activeNow.pratyantardasha) add(`Pratyantardasha: ${activeNow.pratyantardasha.lord}  (${formatDashaDatePrecise(activeNow.pratyantardasha.startDate)} -> ${formatDashaDatePrecise(activeNow.pratyantardasha.endDate)})`);
      if (activeNow.sookshmaDasha) add(`Sookshma Dasha:  ${activeNow.sookshmaDasha.lord}  (${formatDashaDatePrecise(activeNow.sookshmaDasha.startDate)} -> ${formatDashaDatePrecise(activeNow.sookshmaDasha.endDate)})`);
      if (activeNow.pranaDasha) add(`Prana Dasha:     ${activeNow.pranaDasha.lord}  (${formatDashaDateTime(activeNow.pranaDasha.startDate)} -> ${formatDashaDateTime(activeNow.pranaDasha.endDate)})`);
      add('Note: Pratyantardasha/Sookshma/Prana are shown only for the currently active window, not the full lifespan, since expanding all levels across a lifetime produces tens of thousands of entries.');
    }
    subsection('Full Lifespan — Mahadasha and Antardasha');
    add();
    chart.dashaData.mahadashas.forEach(m=>{
      add(`${pad(m.lord+' Mahadasha:',22)} ${formatDashaDate(m.startDate)} -> ${formatDashaDate(m.endDate)}  (${m.years.toFixed(2)} years)`);
      const ads = calculateAntardashas(m);
      ads.forEach(a=>{
        add(`${pad('',24)} ${pad(a.lord+' Antardasha:',20)} ${formatDashaDate(a.startDate)} -> ${formatDashaDate(a.endDate)}`);
      });
      add();
    });
  }

  if (want('liveSky') && liveSkyData){
    section('GOCHARA — LIVE SKY AT TIME OF EXPORT');
    add(`Observed as of: ${liveSkyData.sky.now.toString()}`);
    add(`Observer location: ${liveSkyData.locationLabel || (liveSkyData.lat.toFixed(4)+'°, '+liveSkyData.lon.toFixed(4)+'°')}`);
    add(`Coordinates: ${liveSkyData.lat.toFixed(4)}°, ${liveSkyData.lon.toFixed(4)}°  |  Timezone: ${fmtTz(liveSkyData.tz)}`);
    add(`Ayanamsa at this moment: Lahiri, ${liveSkyData.sky.ayanamsa.toFixed(4)}°`);
    add();
    PLANET_LIST.forEach(name=>{
      const p = liveSkyData.sky.planets[name];
      const sign = SIGNS[p.sign];
      add(`${pad(name,10)} ${sign.name} (${sign.sk}), ${formatDeg(p.degInSign)}${p.retrograde?'  |  RETROGRADE':''}`);
      add(`${pad('',10)} Nakshatra: ${p.nakshatra.name}, Pada ${p.nakshatra.pada} (Lord ${p.nakshatra.lord})  |  Speed: ${Math.abs(p.speed).toFixed(4)}°/day`);
      if (p.natalHouse !== null){
        add(`${pad('',10)} Falls in natal House ${p.natalHouse}: ${p.natalHouseTheme}`);
      }
    });
  }

  if (want('vargas')){
    section('SHODASA VARGA — ALL DIVISIONAL CHARTS (D1 - D60)');
    Object.keys(VARGAS).forEach(key=>{
      if (sections.vargaKeys && sections.vargaKeys.indexOf(key) === -1) return;
      const meta = VARGAS[key];
      const vdata = chart.vargas[key];
      const ascVSign = SIGNS[vdata.ascendantSign];
      subsection(`${key} — ${meta.name} (${meta.full})`);
      add(`Significance: ${meta.desc}`);
      add(`Ascendant: ${ascVSign.name} (${ascVSign.sk})`);
      add();
      vdata.houses.forEach(h=>{
        const sign = SIGNS[h.sign];
        add(`H${h.houseNum}: ${h.signName} (${h.signSanskrit}), Lord ${h.signLord}, ${sign.element}/${sign.modality}`);
        if (h.isEmpty){
          add(`${pad('',6)} (no planets placed here)`);
        } else {
          h.planets.forEach(p=>{
            add(`${pad('',6)} ${p.name}${p.retrograde?' (R)':''} — Dignity: ${p.dignity.label}`);
          });
        }
      });
      add();
    });
  }

  if (want('rawLongitudes')){
    section('REFERENCE — RAW SIDEREAL LONGITUDES (ABSOLUTE 0-360°)');
    add('Useful for cross-checking against other astrology software.');
    add();
    PLANET_LIST.forEach(name=>{
      const p = chart.planets[name];
      add(`${pad(name,10)} ${normDeg(p.longitude).toFixed(6)}°`);
    });
    add(`${pad('Ascendant',10)} ${normDeg(chart.ascendant.longitude).toFixed(6)}°`);
  }

  add(rule('=', W));
  add(centerLine('END OF REPORT', W));
  add(centerLine('Generated by Vedic Astrology — computed locally, Lahiri Ayanamsa', W));
  add(rule('=', W));

  return lines.join('\n');
}

let exportSelectedVargas = new Set(Object.keys(VARGAS));
let exportLocMode = "search";
let exportLat = null, exportLon = null, exportLocationLabel = null;

function openExportModal(){
  if (!currentChartForModal || !currentProfileForExport){
    alert('Please generate a chart first before exporting a report.');
    return;
  }
  
  const hint = document.getElementById('exportModalHint'); if (hint) hint.style.color = '';

  document.getElementById('exportModal').classList.add('show');
  updateExportCountLabel();
}
function closeExportModal(){
  document.getElementById('exportModal').classList.remove('show');
}

function buildExportVargaChips(){
  const wrap = document.getElementById('exportVargasChips');
  if (wrap.childElementCount) return;
  Object.keys(VARGAS).forEach(key=>{
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'export-varga-chip selected';
    chip.textContent = key;
    chip.dataset.vargaKey = key;
    chip.addEventListener('click', ()=>{
      if (exportSelectedVargas.has(key)){
        exportSelectedVargas.delete(key);
        chip.classList.remove('selected');
      } else {
        exportSelectedVargas.add(key);
        chip.classList.add('selected');
      }
      updateExportCountLabel();
    });
    wrap.appendChild(chip);
  });
}
buildExportVargaChips();

function updateExportCountLabel(){
  const checks = document.querySelectorAll('.export-section-check');
  const checkedCount = [...checks].filter(c=>c.checked).length;
  document.getElementById('exportCountLabel').textContent = `${checkedCount} of ${checks.length} sections`;
  document.getElementById('exportModalHint').textContent = checkedCount === checks.length ? 'All sections included' : `${checkedCount} section${checkedCount===1?'':'s'} selected`;
  document.getElementById('exportDownloadBtn').disabled = checkedCount === 0;
}

document.getElementById('exportReportBtn').addEventListener('click', openExportModal);
document.getElementById('exportModalClose').addEventListener('click', closeExportModal);
document.getElementById('exportModal').addEventListener('click', (e)=>{
  if (e.target.id === 'exportModal') closeExportModal();
});

document.getElementById('exportSelectAll').addEventListener('change', (e)=>{
  const checked = e.target.checked;
  document.querySelectorAll('.export-section-check').forEach(c=>{ c.checked = checked; });
  updateExportCountLabel();
  document.getElementById('exportVargasGroup').classList.toggle('show', document.getElementById('exportVargasCheck').checked);
  document.getElementById('exportLocationPicker').style.display = document.getElementById('exportLiveSkyCheck').checked ? '' : 'none';
});

document.querySelectorAll('.export-section-check').forEach(cb=>{
  cb.addEventListener('change', ()=>{
    updateExportCountLabel();
    const allChecked = [...document.querySelectorAll('.export-section-check')].every(c=>c.checked);
    document.getElementById('exportSelectAll').checked = allChecked;
    if (cb.dataset.section === 'vargas'){
      document.getElementById('exportVargasGroup').classList.toggle('show', cb.checked);
    }
    if (cb.dataset.section === 'liveSky'){
      document.getElementById('exportLocationPicker').style.display = cb.checked ? '' : 'none';
      if (cb.checked && document.getElementById('exportTzInput').options.length === 0){
        populateTzSelect(document.getElementById('exportTzInput'));
        const browserTzOffset = -new Date().getTimezoneOffset()/60;
        const closest = TZ_OPTIONS.reduce((a,b)=> Math.abs(b-browserTzOffset)<Math.abs(a-browserTzOffset)?b:a);
        [...document.getElementById('exportTzInput').options].forEach(o=>{ if (parseFloat(o.value)===closest) o.selected=true; });
      }
    }
  });
});

document.querySelectorAll('.export-loc-mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    exportLocMode = btn.dataset.locMode;
    document.querySelectorAll('.export-loc-mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('exportLocSearchMode').style.display = exportLocMode==='search' ? '' : 'none';
    document.getElementById('exportLocCoordsMode').style.display = exportLocMode==='coords' ? '' : 'none';
    exportLat = null; exportLon = null; exportLocationLabel = null;
    document.getElementById('exportLocationStatus').textContent = '';
  });
});

document.getElementById('exportLatInput').addEventListener('input', (e)=>{
  const v = parseFloat(e.target.value);
  if (!isNaN(v) && v>=-90 && v<=90){ exportLat = v; syncExportCoordsStatus(); }
  else { exportLat = null; }
});
document.getElementById('exportLonInput').addEventListener('input', (e)=>{
  const v = parseFloat(e.target.value);
  if (!isNaN(v) && v>=-180 && v<=180){ exportLon = v; syncExportCoordsStatus(); }
  else { exportLon = null; }
});
function syncExportCoordsStatus(){
  if (exportLat !== null && exportLon !== null){
    exportLocationLabel = `${exportLat.toFixed(4)}°, ${exportLon.toFixed(4)}°`;
    document.getElementById('exportLocationStatus').textContent = `Using manual coordinates: ${exportLocationLabel}`;
  }
}

const exportPlaceInput = document.getElementById('exportPlaceInput');
const exportLocationResultsEl = document.getElementById('exportLocationResults');
let exportSearchDebounce = null;
try{ if (window.parent && window.parent!==window && window.parent.LocPicker) window.parent.LocPicker.attach(document, exportPlaceInput, r=>{
  exportPlaceInput.value = r.display_name; exportLat = parseFloat(r.lat); exportLon = parseFloat(r.lon); exportLocationLabel = r.display_name;
  exportLocationResultsEl.classList.remove('open');
  document.getElementById('exportLocationStatus').textContent = (r.source==='coords' ? 'Using coordinates: ' : 'Selected: ') + r.display_name;
  setTzSelect(document.getElementById('exportTzInput'), estimateTz(exportLat, exportLon, r));
}, {title:'Location for export', get:()=> exportLat!=null ? {lat:exportLat, lon:exportLon} : null}); }catch(e){}
exportPlaceInput.addEventListener('input', ()=>{
  const q = exportPlaceInput.value.trim();
  exportLat = null; exportLon = null; exportLocationLabel = null;
  clearTimeout(exportSearchDebounce);
  if (q.length<3){ exportLocationResultsEl.classList.remove('open'); return; }
  exportSearchDebounce = setTimeout(async ()=>{
        try{
          const appEmail = "contact@yourdomain.com"; // Replace with your actual email
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}&email=${appEmail}`;
          const res = await fetch(url, { headers:{'Accept-Language':'en'} });
          const data = await res.json();
          exportLocationResultsEl.innerHTML = "";
          data.forEach(r=>{
            const div = document.createElement('div');
            div.className = 'location-item';
            const main = r.display_name.split(',')[0];
            div.innerHTML = `<span class="lname">${main}</span><span class="lsub">${r.display_name}</span>`;
            div.addEventListener('click', ()=>{
              exportPlaceInput.value = r.display_name;
              exportLat = parseFloat(r.lat); exportLon = parseFloat(r.lon);
              exportLocationLabel = r.display_name;
              exportLocationResultsEl.classList.remove('open');
              document.getElementById('exportLocationStatus').textContent = `Selected: ${r.display_name}`;
              const tzSel = document.getElementById('exportTzInput');
              setTzSelect(tzSel, estimateTz(exportLat, exportLon, r));
            });
            exportLocationResultsEl.appendChild(div);
          });
          if (data.length) exportLocationResultsEl.classList.add('open');
        }catch(e){ }
      }, 1000); // 1000ms delay to enforce 1 req/sec limit
});
document.addEventListener('click', (e)=>{
  if (!e.target.closest('#exportLocSearchMode .location-wrap')) exportLocationResultsEl.classList.remove('open');
});

function collectExportText(){
  const sections = {};
  document.querySelectorAll('.export-section-check').forEach(c=>{ sections[c.dataset.section] = c.checked; });
  sections.vargaKeys = [...exportSelectedVargas];
  let liveSkyData = null;
  if (sections.liveSky){
    if (exportLat === null || exportLon === null){
      alert('Please select a location or enter coordinates for the Live Sky section, or untick it.');
      return null;
    }
    const tz = parseFloat(document.getElementById('exportTzInput').value || '0');
    const sky = computeLiveSky(exportLat, exportLon, currentChartForModal.ascendant.sign);
    liveSkyData = { sky, lat: exportLat, lon: exportLon, tz, locationLabel: exportLocationLabel };
  }
  return buildFullReportText(currentChartForModal, currentProfileForExport, sections, liveSkyData);
}
function exportFlash(msg, ok){
  const hint = document.getElementById('exportModalHint');
  hint.textContent = msg; hint.style.color = ok ? 'var(--teal-bright)' : '#E07070';
  setTimeout(()=>{ hint.style.color=''; updateExportCountLabel(); }, 2500);
}
document.getElementById('exportDownloadBtn').addEventListener('click', ()=>{
  const text = collectExportText(); if (text === null) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const safeName = (currentProfileForExport.name || 'chart').replace(/[^a-z0-9]/gi, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${safeName}_vedic_chart.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  exportFlash('✓ File downloaded', true);
});
document.getElementById('exportCopyBtn').addEventListener('click', async ()=>{
  const text = collectExportText(); if (text === null) return;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch(e){}
  if (!ok){
    try{
      const ta = document.createElement('textarea'); ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      ok = document.execCommand('copy'); document.body.removeChild(ta);
    }catch(e){}
  }
  exportFlash(ok ? '✓ Copied to clipboard' : 'Could not copy — use Download file instead', ok);
});

/* =============================================================================
   PHASE 1 ENGINES — Panchanga · Transits & Sade Sati · Bhava Chalit (Sripati)
   Pure functions (no DOM). All times are Julian Days in UT; tz is the birth-place UTC offset in hours.
   ============================================================================= */
const PN_TITHI = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi'];
const PN_YOGA = ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
const PN_KARANA_MOV = ['Bava','Balava','Kaulava','Taitila','Gara','Vanija','Vishti'];
const PN_VARA = [['Ravivara','Sunday','Sun'],['Somavara','Monday','Moon'],['Mangalavara','Tuesday','Mars'],['Budhavara','Wednesday','Mercury'],['Guruvara','Thursday','Jupiter'],['Shukravara','Friday','Venus'],['Shanivara','Saturday','Saturn']];
const PN_MASA = ['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashvina','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
const PN_RAHU_PART = [8,2,7,5,6,4,3];   // 1-based eighth of the daytime, indexed Sun..Sat
const PN_YAMA_PART = [5,4,3,2,1,7,6];
const PN_GULI_PART = [7,6,5,4,3,2,1];
const PN_CHALDEAN = ['Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon'];
const PN_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PN_NAK = 360/27;

function pnDiff(jd){ return normDeg(moonLongitude(jd) - sunLongitude(jd)); }                 // Moon-Sun elongation (ayanamsa cancels)
function pnSum(jd){ return normDeg(getSiderealLongitudeAt('Sun', jd) + getSiderealLongitudeAt('Moon', jd)); }
function pnMoon(jd){ return getSiderealLongitudeAt('Moon', jd); }

/* Time at which a monotonic angle fn(jd) next (dir=+1) / last (dir=-1) crosses a multiple of `unit` degrees. */
function pnBoundary(fn, jd, unit, dir, stepDays){
  const v0 = fn(jd), into = v0 % unit, need = dir > 0 ? unit - into : into;
  const delta = t => dir > 0 ? normDeg(fn(t) - v0) : normDeg(v0 - fn(t));
  const step = stepDays || 0.02; let lo = jd, hi = jd;
  for (let i = 1; i <= 600; i++){ hi = jd + dir * step * i; if (delta(hi) >= need) break; lo = hi; }
  let a = lo, b = hi;
  for (let i = 0; i < 50; i++){ const m = (a + b) / 2; if (delta(m) >= need) b = m; else a = m; }
  return (a + b) / 2;
}

/* Altitude of the Sun's centre (degrees) from apparent longitude, obliquity and sidereal time. */
function pnSunAlt(jd, lat, lon){
  const lam = sunLongitude(jd) * DEG, eps = obliquityOfEcliptic(jd) * DEG;
  const sinDec = Math.sin(eps) * Math.sin(lam), dec = Math.asin(sinDec);
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const H = (greenwichSiderealTime(jd) + lon) * DEG - ra;
  return Math.asin(Math.sin(lat * DEG) * sinDec + Math.cos(lat * DEG) * Math.cos(dec) * Math.cos(H)) * RAD;
}
/* Sunrise / sunset (upper limb + refraction, h0 = -0.833°) for a local civil date. Returns {rise,set} (JD UT) or nulls. */
function pnRiseSet(y, m, d, lat, lon, tz){
  const h0 = -0.8333, start = toJulianDay(y, m, d, 0, 0, 0) - tz / 24, N = 96;
  const f = t => pnSunAlt(t, lat, lon) - h0;
  const bis = (a, b) => { for (let i = 0; i < 40; i++){ const mid = (a + b) / 2; if ((f(a) < 0) === (f(mid) < 0)) a = mid; else b = mid; } return (a + b) / 2; };
  let rise = null, set = null, prev = f(start);
  for (let i = 1; i <= N; i++){
    const t = start + i / N, v = f(t);
    if (rise === null && prev < 0 && v >= 0) rise = bis(t - 1 / N, t);
    else if (rise !== null && set === null && prev >= 0 && v < 0) set = bis(t - 1 / N, t);
    prev = v;
  }
  return { rise, set };
}
function pnParts(jd, tz){ const p = jdToLocalParts(jd, tz); const [y, m, d] = p.dateStr.split('-').map(Number); return { y, m, d, dateStr: p.dateStr, timeStr: p.timeStr }; }
function pnAddDay(y, m, d, n){ const t = new Date(Date.UTC(y, m - 1, d + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
function pnWeekday(y, m, d){ return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

function panchangaAt(jd, lat, lon, tz){
  const diff = pnDiff(jd), tn = Math.floor(diff / 12), tIdx = tn % 15;
  const tithi = {
    num: tn + 1, paksha: tn < 15 ? 'Shukla' : 'Krishna',
    name: tIdx === 14 ? (tn < 15 ? 'Purnima' : 'Amavasya') : PN_TITHI[tIdx],
    start: pnBoundary(pnDiff, jd, 12, -1), end: pnBoundary(pnDiff, jd, 12, +1)
  };
  const kn = Math.floor(diff / 6);
  const karana = {
    name: kn === 0 ? 'Kimstughna' : (kn >= 57 ? ['Shakuni','Chatushpada','Naga'][kn - 57] : PN_KARANA_MOV[(kn - 1) % 7]),
    start: pnBoundary(pnDiff, jd, 6, -1), end: pnBoundary(pnDiff, jd, 6, +1)
  };
  karana.vishti = karana.name === 'Vishti';
  const sum = pnSum(jd), yi = Math.floor(sum / PN_NAK);
  const yoga = { num: yi + 1, name: PN_YOGA[yi], start: pnBoundary(pnSum, jd, PN_NAK, -1), end: pnBoundary(pnSum, jd, PN_NAK, +1) };
  const mlon = pnMoon(jd), ni = Math.floor(mlon / PN_NAK);
  const nakshatra = { num: ni + 1, name: NAKSHATRAS[ni].name, lord: NAKSHATRAS[ni].lord, pada: Math.floor((mlon % PN_NAK) / (PN_NAK / 4)) + 1,
    start: pnBoundary(pnMoon, jd, PN_NAK, -1), end: pnBoundary(pnMoon, jd, PN_NAK, +1) };

  // Vedic day runs sunrise → next sunrise
  const lp = pnParts(jd, tz);
  let rsToday = pnRiseSet(lp.y, lp.m, lp.d, lat, lon, tz), vy = lp.y, vm = lp.m, vd = lp.d;
  if (rsToday.rise !== null && jd < rsToday.rise){ [vy, vm, vd] = pnAddDay(lp.y, lp.m, lp.d, -1); }
  const rs = pnRiseSet(vy, vm, vd, lat, lon, tz);
  const [ny, nm, nd] = pnAddDay(vy, vm, vd, 1), rsNext = pnRiseSet(ny, nm, nd, lat, lon, tz);
  const wd = pnWeekday(vy, vm, vd), vara = { idx: wd, sk: PN_VARA[wd][0], name: PN_VARA[wd][1], lord: PN_VARA[wd][2], date: `${vy}-${String(vm).padStart(2,'0')}-${String(vd).padStart(2,'0')}` };

  const out = { jd, tz, tithi, karana, yoga, nakshatra, vara, sunrise: rs.rise, sunset: rs.set, nextSunrise: rsNext.rise,
    moonSign: getSignIndex(mlon), sunSign: getSignIndex(getSiderealLongitudeAt('Sun', jd)), elongation: diff };
  if (rs.rise !== null && rs.set !== null){
    const dl = rs.set - rs.rise, part = dl / 8, seg = n => [rs.rise + (n - 1) * part, rs.rise + n * part];
    out.dayLength = dl; out.nightLength = rsNext.rise !== null ? rsNext.rise - rs.set : null;
    out.rahu = seg(PN_RAHU_PART[wd]); out.yama = seg(PN_YAMA_PART[wd]); out.gulika = seg(PN_GULI_PART[wd]);
    out.abhijit = [rs.rise + 7 * dl / 15, rs.rise + 8 * dl / 15];
    out.brahma = [rs.rise - 96 / 1440, rs.rise - 48 / 1440];
    let h = null;
    if (jd >= rs.rise && jd < rs.set) h = Math.floor((jd - rs.rise) / (dl / 12));
    else if (jd >= rs.set && out.nightLength) h = 12 + Math.min(11, Math.floor((jd - rs.set) / (out.nightLength / 12)));
    if (h !== null) out.hora = PN_CHALDEAN[(PN_CHALDEAN.indexOf(vara.lord) + h) % 7];
  }
  // Lunar month (Amanta): named from the Sun's sidereal sign at the preceding new moon; Adhika if the Sun stays in one sign
  const nmPrev = pnBoundary(pnDiff, jd, 360, -1, 0.25), nmNext = pnBoundary(pnDiff, jd, 360, +1, 0.25);
  const s1 = getSignIndex(getSiderealLongitudeAt('Sun', nmPrev)), s2 = getSignIndex(getSiderealLongitudeAt('Sun', nmNext));
  const mi = (s1 + 1) % 12, gm = lp.m;
  out.masa = { name: PN_MASA[mi], adhika: s1 === s2, newMoonPrev: nmPrev, newMoonNext: nmNext, shaka: (gm <= 4 && mi >= 8) ? lp.y - 79 : lp.y - 78 };
  const tl = sunLongitude(jd); out.ayana = (tl >= 270 || tl < 90) ? 'Uttarayana' : 'Dakshinayana';
  return out;
}

/* ---------- Transits: sign-stay timeline for a slow body, Sade Sati & Dhaiya ---------- */
function trStays(name, startJD, endJD, stepDays){
  const sg = jd => getSignIndex(getSiderealLongitudeAt(name, jd));
  const stays = []; let cur = sg(startJD), curStart = null;
  for (let t = startJD + stepDays; t <= endJD; t += stepDays){
    const s = sg(t);
    if (s !== cur){
      let a = t - stepDays, b = t;
      for (let i = 0; i < 40; i++){ const m = (a + b) / 2; if (sg(m) === cur) a = m; else b = m; }
      const x = (a + b) / 2; stays.push({ sign: cur, start: curStart, end: x }); cur = s; curStart = x;
    }
  }
  stays.push({ sign: cur, start: curStart, end: null });
  return stays;
}
/* group Saturn stays whose position relative to the natal Moon is in relSet into cycles (gap < 3 years) */
function trCycles(stays, moonSign, relSet){
  const items = stays.map(s => ({ ...s, rel: (s.sign - moonSign + 12) % 12 })).filter(s => relSet.includes(s.rel));
  const cycles = []; let cur = null; const GAP = 3 * 365.25;
  items.forEach(s => {
    if (cur && s.start !== null && cur.end !== null && s.start - cur.end < GAP) cur.items.push(s);
    else { cur = { items: [s] }; cycles.push(cur); }
    cur.end = s.end;
  });
  return cycles.map(c => {
    const phases = relSet.map(r => {
      const xs = c.items.filter(i => i.rel === r); if (!xs.length) return null;
      return { rel: r, sign: xs[0].sign, start: xs[0].start, end: xs[xs.length - 1].end };
    }).filter(Boolean);
    return { start: c.items[0].start, end: c.items[c.items.length - 1].end, phases };
  });
}
function computeTransits(chart, profile){
  const t0 = chart.julianDay - 3 * 365.25, t1 = chart.julianDay + 100 * 365.25;
  const moonSign = chart.planets.Moon.sign, asc = chart.ascendant.sign;
  const stays = { Saturn: trStays('Saturn', t0, t1, 5), Jupiter: trStays('Jupiter', t0, t1, 5), Rahu: trStays('Rahu', t0, t1, 30), Ketu: trStays('Ketu', t0, t1, 30) };
  return { stays, moonSign, asc,
    sadeSati: trCycles(stays.Saturn, moonSign, [11, 0, 1]).filter(c => c.end === null || c.end > chart.julianDay),
    kantaka: trCycles(stays.Saturn, moonSign, [3]).filter(c => c.end === null || c.end > chart.julianDay),
    ashtama: trCycles(stays.Saturn, moonSign, [7]).filter(c => c.end === null || c.end > chart.julianDay) };
}

/* ---------- Bhava Chalit (Sripati) ---------- */
function computeBhavaChalit(chart, lat, lon){
  const jd = chart.julianDay, ayan = chart.ayanamsa;
  const lst = normDeg(greenwichSiderealTime(jd) + lon), eps = obliquityOfEcliptic(jd) * DEG;
  const mc = normDeg(Math.atan2(Math.sin(lst * DEG), Math.cos(lst * DEG) * Math.cos(eps)) * RAD - ayan);
  const asc = normDeg(ascendantLongitude(jd, lat, lon) - ayan), ic = normDeg(mc + 180);
  const d = normDeg(asc - mc), d2 = normDeg(ic - asc), mad = new Array(13);
  mad[1] = asc; mad[4] = ic; mad[7] = normDeg(asc + 180); mad[10] = mc;
  mad[11] = normDeg(mc + d / 3); mad[12] = normDeg(mc + 2 * d / 3);
  mad[2] = normDeg(asc + d2 / 3); mad[3] = normDeg(asc + 2 * d2 / 3);
  mad[5] = normDeg(mad[11] + 180); mad[6] = normDeg(mad[12] + 180); mad[8] = normDeg(mad[2] + 180); mad[9] = normDeg(mad[3] + 180);
  const begin = new Array(14);
  for (let i = 1; i <= 12; i++){ const p = i === 1 ? 12 : i - 1; begin[i] = normDeg(mad[p] + normDeg(mad[i] - mad[p]) / 2); }
  begin[13] = begin[1];
  const houses = [];
  for (let i = 1; i <= 12; i++) houses.push({ n: i, madhya: mad[i], begin: begin[i], end: begin[i + 1], planets: [] });
  const place = {};
  PLANET_LIST.forEach(name => {
    const lonP = chart.planets[name].longitude !== undefined ? chart.planets[name].longitude : null;
    const L = lonP === null ? null : normDeg(lonP);
    let h = null;
    for (let i = 1; i <= 12; i++){ if (normDeg(L - begin[i]) < normDeg(begin[i + 1] - begin[i]) || (i === 12 && normDeg(L - begin[12]) < normDeg(begin[1] - begin[12]))){ h = i; break; } }
    place[name] = { lon: L, whole: chart.planets[name].house, chalit: h, shifted: h !== chart.planets[name].house, fromMadhya: angDiffSigned(L, mad[h]) };
    houses[h - 1].planets.push(name);
  });
  return { asc, mc, ic, desc: mad[7], houses, place };
}

/* =============================================================================
   PHASE 1 UI — Panchanga · Transits & Sade Sati · Bhava Chalit
   ============================================================================= */
function nvDate(jd, tz, withTime){
  const p = jdToLocalParts(jd, tz), [y, m, d] = p.dateStr.split('-').map(Number);
  return `${d} ${PN_MON[m - 1]} ${y}` + (withTime ? ` · ${p.timeStr.slice(0, 5)}` : '');
}
function nvTime(jd, tz, refDate){
  if (jd === null || jd === undefined) return '—';
  const p = jdToLocalParts(jd, tz); let s = p.timeStr.slice(0, 5);
  if (refDate && p.dateStr !== refDate) s += p.dateStr > refDate ? ' (+1d)' : ' (−1d)';
  return s;
}
function nvSpan(jd){ const d = Math.abs(jd), mo = d / 30.44, y = d / 365.25;
  if (y >= 1.5) return y.toFixed(1) + ' years'; if (mo >= 1.5) return Math.round(mo) + ' months'; return Math.max(1, Math.round(d)) + ' days'; }
function nvDeg(lon){ const s = getSignIndex(lon), d = getDegInSign(lon); return `${SIGNS[s].symbol} ${SIGNS[s].name} ${formatDeg(d)}`; }
function nvDur(days){ const m = Math.round(days * 1440); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }

/* ---------------------------------- PANCHANGA ---------------------------------- */
let PN_CTX = null;
function buildPanchangaPanel(chart, profile){
  PN_CTX = { lat: profile.lat, lon: profile.lon, tz: profile.tz, birthDate: profile.dob, birthTime: profile.tob.slice(0, 5), place: (profile.place || '').split(',')[0], birthJD: chart.julianDay };
  setTimeout(() => pnRender(), 0);
  return `<div class="pn">
    <div class="pn-bar">
      <div class="pn-fields">
        <label>Date<input type="date" id="pnDate" value="${profile.dob}"></label>
        <label>Time<input type="time" id="pnTime" value="${profile.tob.slice(0, 5)}"></label>
      </div>
      <div class="pn-quick"><button type="button" class="on" data-pn-set="birth">At birth</button><button type="button" data-pn-set="now">Now</button></div>
    </div>
    <div id="pnBody"></div>
  </div>`;
}
function pnRender(){
  const body = document.getElementById('pnBody'); if (!body || !PN_CTX) return;
  const c = PN_CTX, ds = document.getElementById('pnDate').value, ts = document.getElementById('pnTime').value || '00:00';
  if (!ds) return;
  const [y, m, d] = ds.split('-').map(Number), [hh, mm] = ts.split(':').map(Number);
  const jd = toJulianDay(y, m, d, hh, mm, 0) - c.tz / 24;
  let P; try { P = panchangaAt(jd, c.lat, c.lon, c.tz); } catch(e){ body.innerHTML = '<div class="meta-err">Could not compute Panchanga for this moment.</div>'; console.error(e); return; }
  const ref = P.vara.date;
  const pct = (a, b) => Math.max(0, Math.min(100, (jd - a) / (b - a) * 100));
  const limb = (label, name, sub, a, b, col, extra) => `<div class="pn-limb" style="--pc:${col}">
      <small>${label}</small><b>${name}</b><span class="pn-sub">${sub}</span>
      <div class="pn-bar2"><i style="width:${pct(a, b).toFixed(1)}%"></i></div>
      <span class="pn-end">Ends ${nvTime(b, c.tz, ref)}${extra || ''}</span></div>`;
  const nk = NAKSHATRAS[P.nakshatra.num - 1];
  const limbs = [
    limb('Tithi', `${P.tithi.paksha} ${P.tithi.name}`, `${P.tithi.num} of 30 · ${P.tithi.paksha === 'Shukla' ? 'waxing' : 'waning'} Moon`, P.tithi.start, P.tithi.end, '#D4AF37'),
    `<div class="pn-limb" style="--pc:#8A6FB8"><small>Vara</small><b>${P.vara.name}</b><span class="pn-sub">${P.vara.sk} · ruled by ${P.vara.lord}</span>
      <div class="pn-bar2"><i style="width:${P.nextSunrise && P.sunrise ? pct(P.sunrise, P.nextSunrise).toFixed(1) : 0}%"></i></div><span class="pn-end">Until sunrise ${nvTime(P.nextSunrise, c.tz, ref)}</span></div>`,
    limb('Nakshatra', P.nakshatra.name, `Pada ${P.nakshatra.pada} · lord ${nk.lord}`, P.nakshatra.start, P.nakshatra.end, '#5EC4B7'),
    limb('Yoga', P.yoga.name, `${P.yoga.num} of 27`, P.yoga.start, P.yoga.end, '#E0A64A'),
    limb('Karana', P.karana.name, P.karana.vishti ? 'Vishti (Bhadra) — see note' : 'Half of a tithi', P.karana.start, P.karana.end, P.karana.vishti ? '#C95050' : '#6B7FA3')
  ].join('');

  const facts = [
    ['Sunrise', nvTime(P.sunrise, c.tz, ref)], ['Sunset', nvTime(P.sunset, c.tz, ref)],
    ['Day length', P.dayLength ? nvDur(P.dayLength) : '—'], ['Hora now', P.hora ? `${PLANET_GLYPHS[P.hora]} ${P.hora}` : '—'],
    ['Moon sign', `${SIGNS[P.moonSign].symbol} ${SIGNS[P.moonSign].name}`], ['Sun sign', `${SIGNS[P.sunSign].symbol} ${SIGNS[P.sunSign].name}`]
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');

  const calChips = `<span>🌙 ${P.masa.adhika ? 'Adhika ' : ''}${P.masa.name} <em>(Amanta)</em></span><span>📅 Shaka ${P.masa.shaka}</span><span>☀ ${P.ayana}</span><span>🌑 New moon ${nvDate(P.masa.newMoonPrev, c.tz)}</span><span>🌑 Next ${nvDate(P.masa.newMoonNext, c.tz)}</span>`;

  let day = '';
  if (P.rahu){
    const dl = P.sunset - P.sunrise, pos = t => ((t - P.sunrise) / dl * 100);
    const segs = [['Abhijit', P.abhijit, '#5EC4B7', 'Auspicious'], ['Rahu Kalam', P.rahu, '#C95050', 'Avoid new starts'], ['Yamaganda', P.yama, '#E0A64A', 'Inauspicious'], ['Gulika Kalam', P.gulika, '#8A6FB8', 'Inauspicious']];
    const marks = segs.map(([n, r, col]) => `<i title="${n}" style="left:${pos(r[0]).toFixed(2)}%;width:${((r[1] - r[0]) / dl * 100).toFixed(2)}%;background:${col}"></i>`).join('');
    const now = jd >= P.sunrise && jd <= P.sunset ? `<u style="left:${pos(jd).toFixed(2)}%"></u>` : '';
    const rows = segs.map(([n, r, col, tag]) => `<div class="pn-prow" style="--pc:${col}"><span class="pn-dot"></span><b>${n}</b><span>${nvTime(r[0], c.tz, ref)} – ${nvTime(r[1], c.tz, ref)}</span><em>${tag}</em></div>`).join('') +
      `<div class="pn-prow" style="--pc:#6B7FA3"><span class="pn-dot"></span><b>Brahma Muhurta</b><span>${nvTime(P.brahma[0], c.tz, ref)} – ${nvTime(P.brahma[1], c.tz, ref)}</span><em>Before sunrise</em></div>`;
    day = `<div class="pn-sec"><h5>Day timeline <span>sunrise → sunset · ${P.vara.name}</span></h5>
      <div class="pn-track">${marks}${now}</div>
      <div class="pn-tl"><span>${nvTime(P.sunrise, c.tz, ref)}</span><span>Midday</span><span>${nvTime(P.sunset, c.tz, ref)}</span></div>
      <div class="pn-plist">${rows}</div></div>`;
  } else day = `<div class="pn-sec"><div class="pl-empty">The Sun does not rise and set normally at this latitude and date, so day-based timings are unavailable.</div></div>`;

  body.innerHTML = `<div class="pn-for">Computed for <b>${nvDate(jd, c.tz, true)}</b> · ${escapeHtml(c.place)} · ${fmtTz(c.tz)}</div>
    <div class="pn-limbs">${limbs}</div>
    <div class="pn-facts">${facts}</div>
    <div class="pn-chips">${calChips}</div>
    ${day}
    <div class="pn-note">Vedic day runs sunrise to sunrise, so births before sunrise take the previous weekday. Sunrise uses the upper limb with standard refraction (−0.833°). Lunar month is the Amanta (new-moon to new-moon) system; Purnimanta calendars name the Krishna fortnight one month later. Vishti karana is traditionally avoided for new beginnings.</div>`;
}
document.addEventListener('input', (e) => { if (e.target.id === 'pnDate' || e.target.id === 'pnTime') { document.querySelectorAll('[data-pn-set]').forEach(b => b.classList.remove('on')); pnRender(); } });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pn-set]'); if (!b || !PN_CTX) return;
  document.querySelectorAll('[data-pn-set]').forEach(x => x.classList.toggle('on', x === b));
  if (b.dataset.pnSet === 'birth'){ document.getElementById('pnDate').value = PN_CTX.birthDate; document.getElementById('pnTime').value = PN_CTX.birthTime; }
  else { const p = jdToLocalParts(nowJulianDay(), PN_CTX.tz); document.getElementById('pnDate').value = p.dateStr; document.getElementById('pnTime').value = p.timeStr.slice(0, 5); }
  pnRender();
});

/* ------------------------------ TRANSITS & SADE SATI ------------------------------ */
const TR_COL = { 11: '#E0A64A', 0: '#C95050', 1: '#8A6FB8', 3: '#6B7FA3', 7: '#5B8A9E' };
const TR_PHASE = { 11: 'Rising', 0: 'Peak', 1: 'Setting' };
function trStatus(s, e, now){ if (e !== null && e <= now) return 'past'; if (s !== null && s > now) return 'next'; return 'now'; }
function trPill(st){ return st === 'now' ? '<span class="dx-pill now">Now</span>' : (st === 'next' ? '<span class="dx-pill">Upcoming</span>' : '<span class="dx-pill past">Past</span>'); }
let TR_DATA = null;
function buildTransitsPanel(chart, profile){
  const T = computeTransits(chart, profile), tz = profile.tz, now = nowJulianDay(), birth = chart.julianDay;
  TR_DATA = { T, tz, now, birth };
  const age = jd => (jd - birth) / 365.25, dt = jd => jd === null ? 'before birth' : nvDate(jd, tz);
  const curSign = n => { const s = T.stays[n].find(x => trStatus(x.start, x.end, now) === 'now'); return s ? s.sign : getSignIndex(getSiderealLongitudeAt(n, now)); };
  const rel = s => (s - T.moonSign + 12) % 12, hM = s => rel(s) + 1, hL = s => (s - T.asc + 12) % 12 + 1;
  const satS = curSign('Saturn'), jupS = curSign('Jupiter');

  // active cycle status
  const act = T.sadeSati.find(c => trStatus(c.start, c.end, now) === 'now');
  const nextC = T.sadeSati.find(c => c.start !== null && c.start > now);
  let ssHero;
  if (act){
    const ph = rel(satS) === 11 ? 'Rising' : rel(satS) === 0 ? 'Peak' : rel(satS) === 1 ? 'Setting' : 'between phases';
    ssHero = `<div class="tr-card on" style="--pc:#C95050"><small>Sade Sati</small><b>Active · ${ph} phase</b><span>Saturn in ${SIGNS[satS].name} · ends ${dt(act.end)}</span></div>`;
  } else {
    ssHero = `<div class="tr-card" style="--pc:#5EC4B7"><small>Sade Sati</small><b>Not active</b><span>${nextC ? 'Next begins ' + dt(nextC.start) + ' (in ' + nvSpan(nextC.start - now) + ')' : 'No further cycle in the next 100 years'}</span></div>`;
  }
  const actK = T.kantaka.find(c => trStatus(c.start, c.end, now) === 'now'), actA = T.ashtama.find(c => trStatus(c.start, c.end, now) === 'now');
  const nK = T.kantaka.find(c => c.start !== null && c.start > now), nA = T.ashtama.find(c => c.start !== null && c.start > now);
  const dh = (title, a, n, col) => a ? `<div class="tr-card on" style="--pc:${col}"><small>${title}</small><b>Active</b><span>Ends ${dt(a.end)}</span></div>`
    : `<div class="tr-card" style="--pc:${col}"><small>${title}</small><b>Not active</b><span>${n ? 'Next ' + dt(n.start) : '—'}</span></div>`;
  const pos = (n, s) => `<div class="tr-card" style="--pc:${DASHA_PLANET_COLORS[n]}"><small>${n} now</small><b>${PLANET_GLYPHS[n]} ${SIGNS[s].symbol} ${SIGNS[s].name}</b><span>House ${hL(s)} from Lagna · ${hM(s)} from Moon</span></div>`;

  // cycles
  const cyc = T.sadeSati.map((c, i) => {
    const st = trStatus(c.start, c.end, now), s0 = c.start === null ? birth - 3 * 365.25 : c.start, e0 = c.end === null ? birth + 100 * 365.25 : c.end, tot = e0 - s0;
    const segs = c.phases.map(p => { const a = p.start === null ? s0 : p.start, b = p.end === null ? e0 : p.end; return `<div class="tr-seg" style="flex:${Math.max(0.01, b - a)};background:${TR_COL[p.rel]}"><span>${TR_PHASE[p.rel]}</span></div>`; }).join('');
    const nowMark = st === 'now' ? `<u style="left:${Math.max(0, Math.min(100, (now - s0) / tot * 100)).toFixed(1)}%"></u>` : '';
    const rows = c.phases.map(p => `<div class="tr-ph" style="--pc:${TR_COL[p.rel]}"><i></i><b>${TR_PHASE[p.rel]}</b><span>${SIGNS[p.sign].symbol} ${SIGNS[p.sign].name} · ${dt(p.start)} → ${p.end === null ? 'beyond 100 yrs' : dt(p.end)}</span></div>`).join('');
    const ages = `${c.start === null ? 'began before birth' : 'Age ' + Math.max(0, age(c.start)).toFixed(0)}${c.end === null ? '' : ' – ' + age(c.end).toFixed(0)}`;
    return `<div class="tr-cyc ${st}"><div class="tr-cyc-h"><b>Cycle ${i + 1}</b><span>${ages}</span>${trPill(st)}</div>
      <div class="tr-cbar">${segs}${nowMark}</div><div class="tr-phs">${rows}</div></div>`;
  }).join('') || '<div class="pl-empty">No Sade Sati cycle found in this period.</div>';

  const dhRows = (arr, label, col) => arr.map(c => { const st = trStatus(c.start, c.end, now); return `<div class="dx-row ${st}"><div class="dx-row-h" style="cursor:default"><span class="dx-dot" style="background:${col}">♄</span><span class="dx-row-main"><b>${label}</b><small>${dt(c.start)} → ${c.end === null ? '—' : dt(c.end)}</small></span><span class="dx-row-side"><span class="dx-age">Age ${c.start === null ? '0' : Math.max(0, age(c.start)).toFixed(0)}–${c.end === null ? '—' : age(c.end).toFixed(0)}</span>${trPill(st)}</span></div></div>`; }).join('');

  // ingress tables
  const tabs = ['Saturn', 'Jupiter', 'Rahu', 'Ketu'];
  const lists = tabs.map((n, ti) => {
    const arr = T.stays[n].filter(s => s.end === null || s.end > birth);
    const idxNow = arr.findIndex(s => trStatus(s.start, s.end, now) === 'now');
    const rows = arr.map((s, i) => {
      const st = trStatus(s.start, s.end, now), prev = arr[i - 1];
      const retro = (n === 'Saturn' || n === 'Jupiter') && prev && prev.sign === (s.sign + 1) % 12;
      const hidden = idxNow >= 0 && (i < idxNow - 2 || i > idxNow + 7) ? ' tr-more' : '';
      return `<div class="dx-row ${st}${hidden}"><div class="dx-row-h" style="cursor:default"><span class="dx-dot" style="background:${DASHA_PLANET_COLORS[n]}">${SIGNS[s.sign].symbol}</span>
        <span class="dx-row-main"><b>${SIGNS[s.sign].name}${retro ? ' <em class="tr-retro">↺ retrograde return</em>' : ''}</b><small>${dt(s.start)} → ${s.end === null ? '—' : dt(s.end)}</small></span>
        <span class="dx-row-side"><span class="dx-age">H${hL(s.sign)} Lagna · H${hM(s.sign)} Moon</span>${trPill(st)}</span></div></div>`;
    }).join('');
    const hiddenN = (rows.match(/tr-more/g) || []).length;
    return `<div class="tr-list" data-tr-body="${n}" ${ti ? 'hidden' : ''}>${rows}${hiddenN ? `<button type="button" class="tr-showall" data-tr-all>Show full timeline (${hiddenN} more)</button>` : ''}</div>`;
  }).join('');

  return `<div class="tr">
    <div class="tr-intro">Saturn and Jupiter transit signs relative to your <b>Moon</b> (${SIGNS[T.moonSign].name}) and <b>Lagna</b> (${SIGNS[T.asc].name}). Sade Sati is Saturn in the 12th, 1st and 2nd sign from the Moon.</div>
    <div class="tr-hero">${ssHero}${dh('Kantaka Shani (4th)', actK, nK, TR_COL[3])}${dh('Ashtama Shani (8th)', actA, nA, TR_COL[7])}${pos('Saturn', satS)}${pos('Jupiter', jupS)}</div>
    <div class="tr-sec"><h5>Sade Sati cycles <span>7½ years each</span></h5><div class="tr-cycles">${cyc}</div></div>
    <div class="tr-sec"><h5>Dhaiya <span>Saturn 4th &amp; 8th from Moon</span></h5><div class="dx-list">${dhRows(T.kantaka, 'Kantaka Shani · 4th from Moon', TR_COL[3])}${dhRows(T.ashtama, 'Ashtama Shani · 8th from Moon', TR_COL[7])}</div></div>
    <div class="tr-sec"><h5>Ingress timeline <span>when each planet changes sign</span></h5>
      <div class="pl-chips tr-tabs">${tabs.map((n, i) => `<button type="button" class="pl-chip ${i ? '' : 'on'}" data-tr-tab="${n}">${PLANET_GLYPHS[n]} ${n}</button>`).join('')}</div>${lists}</div>
    <div class="pn-note">Ingress dates come from the app's compact built-in ephemeris and can differ from published almanacs by a few days for Saturn and Jupiter (Rahu/Ketu use the mean node). Sade Sati dates merge brief retrograde re-entries into one phase. Window: 3 years before birth to 100 years after.</div>
  </div>`;
}
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tr-tab]');
  if (tab){ document.querySelectorAll('[data-tr-tab]').forEach(b => b.classList.toggle('on', b === tab)); document.querySelectorAll('[data-tr-body]').forEach(l => l.hidden = l.dataset.trBody !== tab.dataset.trTab); return; }
  const all = e.target.closest('[data-tr-all]');
  if (all){ all.parentElement.querySelectorAll('.tr-more').forEach(r => r.classList.remove('tr-more')); all.remove(); }
});

/* --------------------------------- BHAVA CHALIT --------------------------------- */
function buildBhavaPanel(chart, profile){
  const B = computeBhavaChalit(chart, profile.lat, profile.lon);
  const moved = PLANET_LIST.filter(n => B.place[n].shifted);
  const cards = B.houses.map(h => {
    const ws = (chart.ascendant.sign + h.n - 1) % 12;
    const chips = h.planets.map(n => { const p = B.place[n]; const c = DASHA_PLANET_COLORS[n];
      return `<span class="bh-p ${p.shifted ? 'moved' : ''}" style="--pc:${c}" data-planet-click="${n}">${PLANET_GLYPHS[n]} ${n}${p.shifted ? `<em>from H${p.whole}</em>` : ''}</span>`; }).join('') || '<span class="bh-empty">empty</span>';
    return `<div class="bh-card ${h.planets.length ? 'has' : ''}">
      <div class="bh-top"><span class="bh-n">${h.n}</span><span class="bh-sign">${SIGNS[ws].symbol} ${SIGNS[ws].name}<small>whole-sign house</small></span></div>
      <div class="bh-mid"><small>Madhya (centre)</small><b>${nvDeg(h.madhya)}</b></div>
      <div class="bh-span"><small>Spans</small><span>${nvDeg(h.begin)}</span><span>→ ${nvDeg(h.end)}</span></div>
      <div class="bh-pl">${chips}</div></div>`;
  }).join('');
  const shiftRows = moved.map(n => { const p = B.place[n], c = DASHA_PLANET_COLORS[n];
    return `<div class="dx-row"><div class="dx-row-h" style="cursor:default"><span class="dx-dot" style="background:${c}">${PLANET_GLYPHS[n]}</span><span class="dx-row-main"><b>${n}: House ${p.whole} → House ${p.chalit}</b><small>${nvDeg(p.lon)} · ${Math.abs(p.fromMadhya).toFixed(1)}° ${p.fromMadhya < 0 ? 'before' : 'past'} the house centre</small></span></div></div>`; }).join('');
  return `<div class="bh">
    <div class="tr-intro">Whole-sign houses give each planet the house of its sign. <b>Bhava Chalit</b> (Sripati) instead centres each house on its madhya and ends it halfway to the next, so a planet near a sign edge can shift to the neighbouring house.</div>
    <div class="tr-hero">
      <div class="tr-card" style="--pc:#D4AF37"><small>Lagna · Bhava 1 centre</small><b>${nvDeg(B.asc)}</b></div>
      <div class="tr-card" style="--pc:#5EC4B7"><small>Midheaven · Bhava 10 centre</small><b>${nvDeg(B.mc)}</b></div>
      <div class="tr-card ${moved.length ? 'on' : ''}" style="--pc:#E0A64A"><small>Planets changing house</small><b>${moved.length} of ${PLANET_LIST.length}</b><span>${moved.length ? moved.join(', ') : 'Chalit matches whole-sign'}</span></div>
    </div>
    ${moved.length ? `<div class="tr-sec"><h5>Shifted planets <span>whole-sign → Bhava Chalit</span></h5><div class="dx-list">${shiftRows}</div></div>` : ''}
    <div class="tr-sec"><h5>The 12 bhavas <span>tap a planet for details</span></h5><div class="bh-grid">${cards}</div></div>
    <div class="pn-note">Sripati method: the Lagna and Midheaven are the centres of houses 1 and 10; the arcs between them are divided into equal thirds to place the other centres; each house ends at the midpoint between neighbouring centres. Positions are sidereal (Lahiri).</div>
  </div>`;
}

/* =============================================================================
   KUNDALI MATCHING — Ashtakoota (36 gunas) + Manglik + bonus checks
   Groom = Person 1 (Vara), Bride = Person 2 (Kanya). Asymmetric tables use these roles.
   ============================================================================= */
const KM_VARNA = ['Kshatriya','Vaishya','Shudra','Brahmin','Kshatriya','Vaishya','Shudra','Brahmin','Kshatriya','Vaishya','Shudra','Brahmin'];
const KM_VARNA_RANK = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };
const KM_VASHYA_SIGN = ['Chatushpada','Chatushpada','Manava','Jalachara','Vanachara','Manava','Manava','Keeta','*','*','Manava','Jalachara'];
const KM_VASHYA_ORDER = ['Chatushpada','Manava','Jalachara','Vanachara','Keeta'];
const KM_VASHYA = [[2,1,1,0.5,1],[1,2,0.5,0,1],[1,0.5,2,1,1],[0,0,0,2,0],[1,1,1,0,2]];   // [groom][bride]
const KM_GANA = ['Deva','Manushya','Rakshasa','Manushya','Deva','Manushya','Deva','Deva','Rakshasa','Rakshasa','Manushya','Manushya','Deva','Rakshasa','Deva','Rakshasa','Deva','Rakshasa','Rakshasa','Manushya','Manushya','Deva','Rakshasa','Rakshasa','Manushya','Manushya','Deva'];
const KM_GANA_SCORE = { Deva: { Deva: 6, Manushya: 6, Rakshasa: 1 }, Manushya: { Deva: 5, Manushya: 6, Rakshasa: 0 }, Rakshasa: { Deva: 0, Manushya: 0, Rakshasa: 6 } };
const KM_NADI_NAMES = ['Aadi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)'];
const KM_NADI = [0,1,2,2,1,0];                        // by nakshatra index % 6
const KM_YONI_ORDER = ['Horse','Elephant','Sheep','Serpent','Dog','Cat','Rat','Cow','Buffalo','Tiger','Deer','Monkey','Lion','Mongoose'];
const KM_YONI_NAK = ['Horse','Elephant','Sheep','Serpent','Serpent','Dog','Cat','Sheep','Cat','Rat','Rat','Cow','Buffalo','Tiger','Buffalo','Tiger','Deer','Deer','Dog','Monkey','Mongoose','Monkey','Lion','Horse','Lion','Cow','Elephant'];
const KM_YONI = [
 [4,2,2,3,2,2,2,1,0,1,3,3,1,2],[2,4,3,3,2,2,2,2,3,1,2,3,0,2],[2,3,4,2,1,2,1,3,3,1,2,0,1,2],[3,3,2,4,2,1,1,1,1,2,2,2,1,0],
 [2,2,1,2,4,2,1,2,2,1,0,2,1,1],[2,2,2,1,2,4,0,2,2,1,3,3,1,2],[2,2,1,1,1,0,4,2,2,2,2,2,1,3],[1,2,3,1,2,2,2,4,3,0,3,2,1,2],
 [0,3,3,1,2,2,2,3,4,1,2,2,1,2],[1,1,1,2,1,1,2,0,1,4,1,1,2,2],[3,2,2,2,0,3,2,3,2,1,4,2,2,2],[3,3,0,2,2,3,2,2,2,1,2,4,3,2],
 [1,0,1,1,1,1,1,1,1,2,2,3,4,2],[2,2,2,0,1,2,3,2,2,2,2,2,2,4]];
const KM_FRIEND = {
  Sun: { F: ['Moon','Mars','Jupiter'], E: ['Venus','Saturn'] }, Moon: { F: ['Sun','Mercury'], E: [] },
  Mars: { F: ['Sun','Moon','Jupiter'], E: ['Mercury'] }, Mercury: { F: ['Sun','Venus'], E: ['Moon'] },
  Jupiter: { F: ['Sun','Moon','Mars'], E: ['Mercury','Venus'] }, Venus: { F: ['Mercury','Saturn'], E: ['Sun','Moon'] },
  Saturn: { F: ['Mercury','Venus'], E: ['Sun','Moon','Mars'] }
};
const KM_RAJJU_NAMES = ['Pada (feet)','Kati (waist)','Nabhi (navel)','Kantha (neck)','Siro (head)'];
const KM_RAJJU = [0,1,2,3,4,3,2,1,0,0,1,2,3,4,3,2,1,0,0,1,2,3,4,3,2,1,0];   // zig-zag by nakshatra index

function kmRel(a, b){ return KM_FRIEND[a].F.includes(b) ? 'F' : (KM_FRIEND[a].E.includes(b) ? 'E' : 'N'); }
function kmPerson(profile){
  const chart = computeChart(profile.dob, profile.tob.length === 5 ? profile.tob + ':00' : profile.tob, profile.lat, profile.lon, profile.tz);
  const moon = chart.planets.Moon;
  return { profile, chart, moonSign: moon.sign, nak: Math.floor(normDeg(moon.longitude) / (360 / 27)), pada: moon.nakshatra.pada, deg: moon.degInSign, lagna: chart.ascendant.sign };
}
function kmManglik(P){
  const c = P.chart, mars = c.planets.Mars, jup = c.planets.Jupiter;
  const hL = mars.house, hM = (mars.sign - P.moonSign + 12) % 12 + 1, strong = [1, 4, 7, 8, 12];
  const inL = strong.includes(hL), inM = strong.includes(hM), mild = (hL === 2 || hM === 2) && !inL && !inM;
  const cancel = [];
  if ([0, 7, 9].includes(mars.sign)) cancel.push('Mars is in its own or exalted sign');
  if (jup.sign === mars.sign) cancel.push('Jupiter is with Mars');
  else if (jup.aspectsHouses && jup.aspectsHouses.includes(mars.house)) cancel.push('Jupiter aspects Mars');
  const level = (inL && inM) ? 'High' : (inL || inM) ? 'Moderate' : mild ? 'Mild' : 'None';
  return { hL, hM, level, present: level !== 'None', cancel, cancelled: cancel.length > 0 && level !== 'None' };
}
function kmMatch(G, B){
  const k = [];
  // 1 Varna
  const vg = KM_VARNA[G.moonSign], vb = KM_VARNA[B.moonSign];
  k.push({ key: 'Varna', max: 1, score: KM_VARNA_RANK[vg] >= KM_VARNA_RANK[vb] ? 1 : 0, a: vg, b: vb });
  // 2 Vashya
  const vsh = (s, d) => s === 8 ? (d < 15 ? 'Manava' : 'Chatushpada') : s === 9 ? (d < 15 ? 'Chatushpada' : 'Jalachara') : KM_VASHYA_SIGN[s];
  const wg = vsh(G.moonSign, G.deg), wb = vsh(B.moonSign, B.deg);
  k.push({ key: 'Vashya', max: 2, score: KM_VASHYA[KM_VASHYA_ORDER.indexOf(wg)][KM_VASHYA_ORDER.indexOf(wb)], a: wg, b: wb });
  // 3 Tara (counted both ways, remainder of 9; 3, 5, 7 are unfavourable)
  const rem = n => n % 9 === 0 ? 9 : n % 9;
  const t1 = rem((G.nak - B.nak + 27) % 27 + 1), t2 = rem((B.nak - G.nak + 27) % 27 + 1), bad = [3, 5, 7];
  const TN = ['Janma','Sampat','Vipat','Kshema','Pratyak','Sadhana','Naidhana','Mitra','Parama Mitra'];
  k.push({ key: 'Tara', max: 3, score: 3 - 1.5 * ([t1, t2].filter(x => bad.includes(x)).length), a: TN[t1 - 1], b: TN[t2 - 1], note: 'from bride → groom / groom → bride' });
  // 4 Yoni
  const yg = KM_YONI_NAK[G.nak], yb = KM_YONI_NAK[B.nak];
  k.push({ key: 'Yoni', max: 4, score: KM_YONI[KM_YONI_ORDER.indexOf(yg)][KM_YONI_ORDER.indexOf(yb)], a: yg, b: yb });
  // 5 Graha Maitri
  const lg = SIGNS[G.moonSign].lord, lb = SIGNS[B.moonSign].lord;
  let gm; if (lg === lb) gm = 5; else { const r = [kmRel(lg, lb), kmRel(lb, lg)].sort().join('');
    gm = { FF: 5, FN: 4, NN: 3, EF: 1, EN: 0.5, EE: 0 }[r]; }
  k.push({ key: 'Graha Maitri', max: 5, score: gm, a: lg, b: lb });
  // 6 Gana
  const gg = KM_GANA[G.nak], gb = KM_GANA[B.nak];
  k.push({ key: 'Gana', max: 6, score: KM_GANA_SCORE[gg][gb], a: gg, b: gb });
  // 7 Bhakoot
  const d1 = (B.moonSign - G.moonSign + 12) % 12 + 1, d2 = (G.moonSign - B.moonSign + 12) % 12 + 1;
  const badB = [[2, 12], [12, 2], [5, 9], [9, 5], [6, 8], [8, 6]].some(p => p[0] === d1 && p[1] === d2);
  k.push({ key: 'Bhakoot', max: 7, score: badB ? 0 : 7, a: SIGNS[G.moonSign].name, b: SIGNS[B.moonSign].name, note: `${d1}/${d2} relationship` });
  // 8 Nadi
  const ng = KM_NADI[G.nak % 6], nb = KM_NADI[B.nak % 6];
  k.push({ key: 'Nadi', max: 8, score: ng !== nb ? 8 : 0, a: KM_NADI_NAMES[ng], b: KM_NADI_NAMES[nb] });

  const total = k.reduce((s, x) => s + x.score, 0);
  const verdict = total >= 33 ? ['Excellent match', '#5EC4B7'] : total >= 25 ? ['Very good match', '#8FB36B'] : total >= 18 ? ['Acceptable match', '#E0A64A'] : ['Low match', '#C95050'];
  // doshas
  const lordsOk = lg === lb || (kmRel(lg, lb) === 'F' && kmRel(lb, lg) === 'F');
  const sameNadi = ng === nb;
  const nadiCancel = []; if (sameNadi){ if (G.moonSign === B.moonSign && G.nak !== B.nak) nadiCancel.push('same Moon sign but different nakshatra'); if (G.nak === B.nak && G.pada !== B.pada) nadiCancel.push('same nakshatra but different pada'); }
  const mg = kmManglik(G), mb = kmManglik(B);
  const rg = KM_RAJJU[G.nak], rb = KM_RAJJU[B.nak], cnt = (G.nak - B.nak + 27) % 27 + 1;
  return { k, total, verdict, G, B,
    dosha: { nadi: { present: sameNadi, cancel: nadiCancel }, bhakoot: { present: badB, cancel: badB && lordsOk ? ['Moon-sign lords are the same or mutual friends'] : [] },
             gana: { present: k[5].score <= 1, a: gg, b: gb }, manglik: { g: mg, b: mb } },
    bonus: { rajju: { ok: rg !== rb, a: KM_RAJJU_NAMES[rg], b: KM_RAJJU_NAMES[rb] }, mahendra: { ok: [4, 7, 10, 13, 16, 19, 22, 25].includes(cnt), count: cnt } } };
}

/* ---------------------------------- MATCHING UI ---------------------------------- */
const KM_INFO = {
  'Varna': 'Ego & spiritual outlook', 'Vashya': 'Mutual attraction & influence', 'Tara': 'Health & luck through the nakshatras',
  'Yoni': 'Physical & instinctive fit', 'Graha Maitri': 'Mental wavelength & friendship', 'Gana': 'Temperament & nature',
  'Bhakoot': 'Emotional bond & family harmony', 'Nadi': 'Health & constitution'
};
const KM_COL = { 1: '#5B7FD6', 2: '#D96C9B' };
let MT = null;
const mtKey = p => `${p.name}|${p.dob}|${p.tob}`;
const mtBlank = tz => ({ name: '', dob: '', tob: '', place: '', lat: null, lon: null, tz, save: false });
function mtSaved(){
  let list = []; try { list = loadProfiles(); } catch(e){}
  const cur = currentProfileForExport;
  if (cur && !list.some(p => mtKey(p) === mtKey(cur))) list = [cur].concat(list);
  return list;
}
function buildMatchPanel(chart, profile){
  MT = { 1: { mode: 'saved', profile, draft: mtBlank(profile.tz) }, 2: { mode: 'saved', profile: null, draft: mtBlank(profile.tz) }, list: mtSaved(), results: {}, timers: {}, last: null };
  setTimeout(() => { mtRenderCard(1); mtRenderCard(2); mtUpdateGo(); }, 0);
  return `<div class="mt">
    <div class="mt-hero">
      <div class="mt-hearts" aria-hidden="true">💞</div>
      <h3>Kundali Matching</h3>
      <p>Compare two birth charts with the traditional <b>Ashtakoota</b> system — 8 factors worth 36 points — plus a Manglik check.</p>
      <ol class="mt-steps"><li><b>1</b>Choose two people</li><li><b>2</b>Tap check</li><li><b>3</b>See the score</li></ol>
    </div>
    <div class="mt-people"><div id="mtCard1" class="mt-card" style="--pc:${KM_COL[1]}"></div>
      <button type="button" class="mt-swap" data-mt-swap title="Swap roles" aria-label="Swap groom and bride roles">⇄</button>
      <div id="mtCard2" class="mt-card" style="--pc:${KM_COL[2]}"></div></div>
    <button type="button" class="mt-go" id="mtGo" data-mt-go disabled>Choose both people to continue</button>
    <div id="mtResult"></div>
  </div>`;
}
function mtResolve(i){
  const S = MT[i];
  if (S.mode === 'saved') return S.profile;
  const d = S.draft;
  if (!d.dob || !d.tob || d.lat === null || d.lon === null || isNaN(d.lat) || isNaN(d.lon) || isNaN(d.tz)) return null;
  return { name: d.name.trim() || `Person ${i}`, dob: d.dob, tob: d.tob.slice(0, 5), place: d.place || `${(+d.lat).toFixed(2)}, ${(+d.lon).toFixed(2)}`, lat: +d.lat, lon: +d.lon, tz: +d.tz };
}
function mtAvatar(name, col){ return `<span class="mt-av" style="background:${col}">${escapeHtml((name || '?').trim().charAt(0).toUpperCase())}</span>`; }
const MT_COLS = ['#D4AF37', '#5EC4B7', '#8A6FB8', '#E0A64A', '#6B7FA3', '#C95050', '#5B8A9E'];
function mtColor(name){ return MT_COLS[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % MT_COLS.length]; }
function mtSummary(p){
  try { const P = kmPerson(p); return `<div class="mt-sum"><span>${SIGNS[P.moonSign].symbol} ${SIGNS[P.moonSign].name} Moon</span><span>★ ${NAKSHATRAS[P.nak].name} · pada ${P.pada}</span><span>↑ ${SIGNS[P.lagna].name} Lagna</span></div>`; }
  catch(e){ return '<div class="mt-sum"><span>Could not read this chart</span></div>'; }
}
function mtRenderCard(i){
  const el = document.getElementById('mtCard' + i); if (!el) return; const S = MT[i];
  const role = i === 1 ? ['Person 1', 'Groom side · Vara'] : ['Person 2', 'Bride side · Kanya'];
  const head = `<div class="mt-ch"><span class="mt-role">${role[0]}</span><small>${role[1]}</small></div>
    <div class="mt-seg"><button type="button" class="${S.mode === 'saved' ? 'on' : ''}" data-mt-mode="${i}:saved">Saved profile</button><button type="button" class="${S.mode === 'new' ? 'on' : ''}" data-mt-mode="${i}:new">New person</button></div>`;
  let body;
  if (S.mode === 'saved'){
    body = MT.list.length ? `<div class="mt-chips">${MT.list.map((p, idx) => `<button type="button" class="mt-chip ${S.profile && mtKey(S.profile) === mtKey(p) ? 'on' : ''}" data-mt-pick="${i}:${idx}">${mtAvatar(p.name, mtColor(p.name))}<span><b>${escapeHtml(p.name || 'Unnamed')}</b><small>${formatDateHuman(p.dob)} · ${p.tob.slice(0, 5)}</small></span></button>`).join('')}</div>`
      : `<div class="mt-empty">No saved profiles yet — switch to “New person”.</div>`;
    body += S.profile ? mtSummary(S.profile) : `<div class="mt-hint">Tap a profile above</div>`;
  } else {
    const d = S.draft;
    body = `<div class="mt-form">
      <label>Name <small>(optional)</small><input type="text" data-mt-f="name" value="${escapeHtml(d.name)}" placeholder="e.g. Ananya"></label>
      <div class="mt-row"><label>Date of birth<input type="date" data-mt-f="dob" value="${d.dob}"></label><label>Time of birth<input type="time" data-mt-f="tob" step="1" value="${d.tob}"></label></div>
      <label class="mt-place">Place of birth<input type="text" data-mt-place="${i}" value="${escapeHtml(d.place)}" placeholder="Search a city…" autocomplete="off"><div class="mt-res" id="mtRes${i}"></div></label>
      <div class="lp-tools"><button type="button" data-mt-loc="${i}:map">🗺️ Pick on map</button><button type="button" data-mt-loc="${i}:coords">⌖ Enter coordinates</button></div>
      <div class="mt-coord ${d.lat !== null ? 'ok' : ''}" id="mtCoord${i}">${d.lat !== null ? `✓ ${(+d.lat).toFixed(3)}°, ${(+d.lon).toFixed(3)}°` : 'Location not selected yet'}</div>
      <label>Timezone<select data-mt-f="tz">${TZ_OPTIONS.map(v => `<option value="${v}" ${+d.tz === v ? 'selected' : ''}>${fmtTz(v)}</option>`).join('')}</select></label>
      <details><summary>Enter coordinates manually</summary><div class="mt-row"><label>Latitude<input type="number" step="any" data-mt-f="lat" value="${d.lat === null ? '' : d.lat}"></label><label>Longitude<input type="number" step="any" data-mt-f="lon" value="${d.lon === null ? '' : d.lon}"></label></div></details>
      <label class="mt-save"><input type="checkbox" data-mt-f="save" ${d.save ? 'checked' : ''}> Save to my profiles</label>
    </div>`;
  }
  el.innerHTML = head + body;
}
function mtUpdateGo(){
  const b = document.getElementById('mtGo'); if (!b) return;
  const ok = !!(mtResolve(1) && mtResolve(2));
  b.disabled = !ok; b.textContent = ok ? '✨ Check compatibility' : 'Choose both people to continue';
}
async function mtSearch(i, q){
  const box = document.getElementById('mtRes' + i); if (!box) return;
  if (q.trim().length < 3){ box.innerHTML = ''; return; }
  box.innerHTML = '<div class="mt-r-msg">Searching…</div>';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}&email=contact@yourdomain.com`);
    const arr = await r.json(); MT.results[i] = arr;
    box.innerHTML = arr.length ? arr.map((x, n) => `<button type="button" data-mt-rpick="${i}:${n}">${escapeHtml(x.display_name)}</button>`).join('') : '<div class="mt-r-msg">No places found — try another spelling.</div>';
  } catch(e){ box.innerHTML = '<div class="mt-r-msg">Search unavailable — use “Enter coordinates manually”.</div>'; }
}
function mtRun(){
  const p1 = mtResolve(1), p2 = mtResolve(2); if (!p1 || !p2) return;
  let G, B; try { G = kmPerson(p1); B = kmPerson(p2); } catch(e){ console.error(e); APP.toast('Could not read one of the charts — check the birth details.', 'error'); return; }
  [1, 2].forEach(i => { const S = MT[i]; if (S.mode === 'new' && S.draft.save){ try { const ps = loadProfiles(); const pr = mtResolve(i); if (!ps.some(x => mtKey(x) === mtKey(pr))){ saveProfiles(ps.concat([{ ...pr, savedAt: Date.now() }])); refreshProfileSelect(); } S.draft.save = false; } catch(e){} } });
  MT.list = mtSaved(); MT.last = kmMatch(G, B);
  if (mtKey(p1) === mtKey(p2)) APP.toast('Both people are the same profile — pick someone else for a real match.', 'info', 4500);
  document.getElementById('mtResult').innerHTML = mtResultHtml(MT.last);
  const r = document.getElementById('mtResult'); if (r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function mtResultHtml(R){
  const nm = R.G.profile.name || 'Person 1', nf = R.B.profile.name || 'Person 2', pct = R.total / 36, C = 2 * Math.PI * 52;
  const col = R.verdict[1];
  const person = (P, c) => `<div class="mt-pp" style="--pc:${c}">${mtAvatar(P.profile.name, c)}<span><b>${escapeHtml(P.profile.name || '')}</b><small>${SIGNS[P.moonSign].symbol} ${SIGNS[P.moonSign].name} · ${NAKSHATRAS[P.nak].name} ${P.pada}</small></span></div>`;
  const cards = R.k.map(x => {
    const cls = x.score === x.max ? 'full' : (x.score === 0 ? 'zero' : 'part');
    return `<div class="mt-k ${cls}"><div class="mt-kh"><b>${x.key}</b><span>${x.score % 1 ? x.score.toFixed(1) : x.score}<small>/${x.max}</small></span></div>
      <small class="mt-kd">${KM_INFO[x.key]}</small>
      <div class="mt-kbar"><i style="width:${x.score / x.max * 100}%"></i></div>
      <div class="mt-kv"><span style="--pc:${KM_COL[1]}">${escapeHtml(x.a)}</span><span style="--pc:${KM_COL[2]}">${escapeHtml(x.b)}</span></div>${x.note ? `<small class="mt-kn">${x.note}</small>` : ''}</div>`;
  }).join('');
  const D = R.dosha, mg = D.manglik.g, mb = D.manglik.b;
  const card = (ok, title, text) => `<div class="mt-d ${ok ? 'ok' : 'warn'}"><span class="mt-di">${ok ? '✓' : '!'}</span><div><b>${title}</b><p>${text}</p></div></div>`;
  const mline = (name, m, c) => `<div class="mt-ml" style="--pc:${c}"><b>${escapeHtml(name)}</b><span class="mt-lvl ${m.level === 'None' ? 'none' : ''}">${m.level === 'None' ? 'No dosha' : m.level}</span><small>Mars in house ${m.hL} from Lagna · ${m.hM} from Moon${m.cancel.length ? ' · ' + m.cancel.join('; ') : ''}</small></div>`;
  const mVerdict = !mg.present && !mb.present ? 'Neither chart has Manglik dosha.' : (mg.present && mb.present ? 'Both charts carry Manglik dosha — traditionally this balances out.' : `Only ${escapeHtml(mg.present ? nm : nf)} has Manglik dosha${(mg.present ? mg : mb).cancelled ? ', with a cancellation condition present' : ''} — check this with care.`);
  const dos = `<div class="mt-d ${(mg.present !== mb.present) && !(mg.present ? mg : mb).cancelled ? 'warn' : 'ok'} wide"><span class="mt-di">${(mg.present !== mb.present) && !(mg.present ? mg : mb).cancelled ? '!' : '✓'}</span><div><b>Manglik (Kuja) dosha</b>${mline(nm, mg, KM_COL[1])}${mline(nf, mb, KM_COL[2])}<p>${mVerdict}</p></div></div>`
    + card(!D.nadi.present, 'Nadi', D.nadi.present ? `Both share the same Nadi (${R.k[7].a}).${D.nadi.cancel.length ? ' Possible cancellation: ' + D.nadi.cancel.join(' / ') + '.' : ''}` : `Different Nadis (${R.k[7].a} · ${R.k[7].b}) — full 8 points.`)
    + card(!D.bhakoot.present, 'Bhakoot', D.bhakoot.present ? `${R.k[6].note} between the Moon signs.${D.bhakoot.cancel.length ? ' Possible cancellation: ' + D.bhakoot.cancel[0] + '.' : ''}` : `${R.k[6].note} — no Bhakoot dosha.`)
    + card(!D.gana.present, 'Gana', D.gana.present ? `Temperament mismatch: ${D.gana.a} with ${D.gana.b}.` : `${D.gana.a} with ${D.gana.b} — compatible.`);
  const B = R.bonus;
  const bonus = card(B.rajju.ok, 'Rajju', B.rajju.ok ? `Different Rajju (${B.rajju.a} · ${B.rajju.b}).` : `Same Rajju (${B.rajju.a}) — traditionally unfavourable.`)
    + card(B.mahendra.ok, 'Mahendra', B.mahendra.ok ? `Bride's nakshatra counts ${B.mahendra.count} to the groom's — favourable.` : `Count ${B.mahendra.count} — not in the favourable set (4, 7, 10, 13, 16, 19, 22, 25).`);
  return `<div class="mt-res-wrap">
    <div class="mt-score" style="--vc:${col}">
      <div class="mt-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" stroke-dasharray="${(pct * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
        <div class="mt-rt"><b>${R.total % 1 ? R.total.toFixed(1) : R.total}</b><small>out of 36</small></div></div>
      <div class="mt-vd"><h4>${R.verdict[0]}</h4><span>${Math.round(pct * 100)}% compatibility</span>
        <div class="mt-pair">${person(R.G, KM_COL[1])}<span class="mt-amp">&amp;</span>${person(R.B, KM_COL[2])}</div></div>
    </div>
    <div class="mt-sec"><h5>Ashtakoota <span>8 factors · 36 points</span></h5><div class="mt-kgrid">${cards}</div></div>
    <div class="mt-sec"><h5>Dosha check <span>things worth a closer look</span></h5><div class="mt-dgrid">${dos}</div></div>
    <div class="mt-sec"><h5>Bonus checks <span>commonly used in South Indian matching</span></h5><div class="mt-dgrid">${bonus}</div></div>
    <div class="mt-actions"><button type="button" class="export-download-btn export-ghost" data-mt-copy>📋 Copy summary</button></div>
    <div class="pn-note">Guideline: 33–36 excellent, 25–32 very good, 18–24 acceptable, below 18 low. Scores use the Moon sign and nakshatra of each chart (Lahiri). Person 1 is treated as the groom side and Person 2 as the bride side for the factors that are direction-dependent (Varna, Vashya, Tara, Yoni, Gana, Bhakoot) — use ⇄ to swap. Traditions differ on some tables and cancellation rules; this follows the commonly published standard.</div>
  </div>`;
}
function mtCopyText(R){
  const nm = R.G.profile.name || 'Person 1', nf = R.B.profile.name || 'Person 2';
  return [`Kundali Matching — ${nm} & ${nf}`, `Total: ${R.total} / 36 (${R.verdict[0]})`, '', ...R.k.map(x => `${x.key}: ${x.score}/${x.max}  (${x.a} | ${x.b})`), '',
    `Manglik: ${nm} ${R.dosha.manglik.g.level}, ${nf} ${R.dosha.manglik.b.level}`, `Nadi dosha: ${R.dosha.nadi.present ? 'yes' : 'no'}  Bhakoot dosha: ${R.dosha.bhakoot.present ? 'yes' : 'no'}  Gana mismatch: ${R.dosha.gana.present ? 'yes' : 'no'}`,
    `Rajju: ${R.bonus.rajju.ok ? 'ok' : 'same'}  Mahendra: ${R.bonus.mahendra.ok ? 'ok' : 'no'}`].join('\n');
}
document.addEventListener('click', (e) => {
  if (!MT) return;
  const mode = e.target.closest('[data-mt-mode]');
  if (mode){ const [i, m] = mode.dataset.mtMode.split(':'); MT[i].mode = m; mtRenderCard(+i); mtUpdateGo(); return; }
  const pick = e.target.closest('[data-mt-pick]');
  if (pick){ const [i, idx] = pick.dataset.mtPick.split(':'); MT[i].profile = MT.list[+idx]; mtRenderCard(+i); mtUpdateGo(); return; }
  const ml = e.target.closest('[data-mt-loc]');
  if (ml){
    const [i, mode] = ml.dataset.mtLoc.split(':'), d = MT[i].draft, LPk = (window.parent && window.parent!==window) ? window.parent.LocPicker : null;
    if (!LPk){ APP.toast('Map picker is available in the full app', 'info'); return; }
    LPk.open({mode, lat:d.lat, lon:d.lon, name:d.place, title:'Place of birth', onPick: r => { d.lat = parseFloat(r.lat); d.lon = parseFloat(r.lon); d.place = r.display_name; d.tz = estimateTz(d.lat, d.lon, r); mtRenderCard(+i); mtUpdateGo(); }});
    return;
  }
  const rp = e.target.closest('[data-mt-rpick]');
  if (rp){
    const [i, n] = rp.dataset.mtRpick.split(':'), x = MT.results[i][+n], d = MT[i].draft;
    d.lat = parseFloat(x.lat); d.lon = parseFloat(x.lon); d.place = x.display_name; d.tz = estimateTz(d.lat, d.lon, x);
    mtRenderCard(+i); mtUpdateGo(); return;
  }
  if (e.target.closest('[data-mt-swap]')){ const t = MT[1]; MT[1] = MT[2]; MT[2] = t; mtRenderCard(1); mtRenderCard(2); mtUpdateGo(); if (MT.last) mtRun(); return; }
  if (e.target.closest('[data-mt-go]')){ mtRun(); return; }
  if (e.target.closest('[data-mt-copy]') && MT.last){ APP.copy(mtCopyText(MT.last)).then(ok => APP.toast(ok ? 'Summary copied ✓' : 'Could not copy', ok ? 'success' : 'error')); }
});
function mtOnField(e){
  if (!MT) return;
  const t = e.target, card = t.closest && t.closest('.mt-card'); if (!card) return;
  const i = +card.id.replace('mtCard', ''), d = MT[i].draft;
  if (t.dataset.mtPlace !== undefined){
    d.place = t.value; d.lat = null; d.lon = null; mtUpdateGo();
    const c = document.getElementById('mtCoord' + i); if (c){ c.textContent = 'Location not selected yet'; c.classList.remove('ok'); }
    clearTimeout(MT.timers[i]); MT.timers[i] = setTimeout(() => mtSearch(i, t.value), 450); return;
  }
  const f = t.dataset.mtF; if (!f) return;
  if (f === 'save') d.save = t.checked;
  else if (f === 'lat' || f === 'lon'){ d[f] = t.value === '' ? null : parseFloat(t.value); const c = document.getElementById('mtCoord' + i); if (c){ const ok = d.lat !== null && d.lon !== null; c.textContent = ok ? `✓ ${(+d.lat).toFixed(3)}°, ${(+d.lon).toFixed(3)}°` : 'Location not selected yet'; c.classList.toggle('ok', ok); } }
  else if (f === 'tz') d.tz = parseFloat(t.value);
  else d[f] = t.value;
  mtUpdateGo();
}
document.addEventListener('input', mtOnField); document.addEventListener('change', mtOnField);

/* =============================================================================
   VEDIC BIRTHDAY ENGINE — Tithi birthday · Nakshatra birthday · Solar return
   ============================================================================= */
function vbJD(y, m, d, tz){ return toJulianDay(y, m, d, 0, 0, 0) - tz / 24; }
function vbNatal(chart, profile){
  const jd = chart.julianDay, P = panchangaAt(jd, profile.lat, profile.lon, profile.tz), lp = pnParts(jd, profile.tz);
  return { jd, P, masaIdx: PN_MASA.indexOf(P.masa.name), adhika: P.masa.adhika, tn: P.tithi.num, nak: P.nakshatra.num - 1, pada: P.nakshatra.pada,
    sunSid: getSiderealLongitudeAt('Sun', jd), by: lp.y, bm: lp.m, bd: lp.d, lat: profile.lat, lon: profile.lon, tz: profile.tz };
}
/* the day a span [a,b) is observed: the first local date whose sunrise falls inside it (Hindu rule); else the date at the span's middle (kshaya) */
function vbDayFor(a, b, N){
  const s = pnParts(a, N.tz), e = pnParts(b, N.tz);
  let [y, m, d] = pnAddDay(s.y, s.m, s.d, -1);
  for (let i = 0; i < 6; i++){
    const rs = pnRiseSet(y, m, d, N.lat, N.lon, N.tz);
    if (rs.rise !== null && rs.rise >= a && rs.rise < b) return { y, m, d, jd: rs.rise, sunrise: true };
    [y, m, d] = pnAddDay(y, m, d, 1);
    if (y > e.y || (y === e.y && m > e.m) || (y === e.y && m === e.m && d > e.d + 1)) break;
  }
  const mid = pnParts((a + b) / 2, N.tz); return { y: mid.y, m: mid.m, d: mid.d, jd: (a + b) / 2, sunrise: false };
}
function vbMoons(y, tz){
  const start = vbJD(y, 1, 1, tz) - 45, end = vbJD(y, 12, 31, tz) + 45;
  let nm = pnBoundary(pnDiff, start, 360, -1, 0.25); const out = [nm];
  while (nm < end){ nm = pnBoundary(pnDiff, nm + 1, 360, +1, 0.25); out.push(nm); }
  return out;
}
function vbMonths(nms){
  return nms.slice(0, -1).map((a, k) => { const b = nms[k + 1], s1 = getSignIndex(getSiderealLongitudeAt('Sun', a)), s2 = getSignIndex(getSiderealLongitudeAt('Sun', b));
    return { a, b, idx: (s1 + 1) % 12, adhika: s1 === s2 }; });
}
function vbTithi(N, y, months){
  const out = [];
  months.forEach(M => {
    if (M.idx !== N.masaIdx || M.adhika) return;
    const u = t => { let v = pnDiff(t); if (t < M.a + 0.3 && v > 300) v -= 360; if (t > M.b - 0.3 && v < 60) v += 360; return v; };
    const at = deg => { let lo = M.a, hi = M.b; for (let i = 0; i < 45; i++){ const m = (lo + hi) / 2; if (u(m) >= deg) hi = m; else lo = m; } return (lo + hi) / 2; };
    const start = N.tn === 1 ? M.a : at((N.tn - 1) * 12), end = N.tn === 30 ? M.b : at(N.tn * 12);
    const day = vbDayFor(start, end, N);
    if (day.y === y) out.push({ start, end, day, month: M });
  });
  return out;
}
function vbNak(N, y, months){
  const out = [], endJD = vbJD(y, 12, 31, N.tz) + 2;
  let cur = pnBoundary(pnMoon, vbJD(y, 1, 1, N.tz) - 2, PN_NAK, -1);
  while (cur < endJD){
    const nxt = pnBoundary(pnMoon, cur + 0.01, PN_NAK, +1);
    if (Math.floor(pnMoon((cur + nxt) / 2) / PN_NAK) === N.nak){
      const day = vbDayFor(cur, nxt, N);
      if (day.y === y){ const M = months.find(m => cur >= m.a && cur < m.b);
        out.push({ start: cur, end: nxt, day, birthMonth: !!M && M.idx === N.masaIdx && !M.adhika, masa: M ? PN_MASA[M.idx] + (M.adhika ? ' (Adhika)' : '') : '' }); }
    }
    cur = nxt;
  }
  return out;
}
function vbSolar(N, y){
  const sunAt = t => getSiderealLongitudeAt('Sun', t), target = N.sunSid;
  const find = c => { let lo = c - 3, hi = c + 3; const f = t => { const d = normDeg(sunAt(t) - target); return d > 180 ? d - 360 : d; };
    for (let i = 0; i < 50; i++){ const m = (lo + hi) / 2; if (f(m) >= 0) hi = m; else lo = m; } return (lo + hi) / 2; };
  for (const n of [y - N.by, y - N.by + 1, y - N.by - 1]){
    const jd = find(N.jd + n * 365.25636), p = pnParts(jd, N.tz);
    if (p.y === y){
      const asc = getSignIndex(normDeg(ascendantLongitude(jd, N.lat, N.lon) - lahiriAyanamsa(jd)));
      return { jd, day: { y: p.y, m: p.m, d: p.d }, time: p.timeStr.slice(0, 5), age: y - N.by, lagna: asc, moon: getSignIndex(getSiderealLongitudeAt('Moon', jd)) };
    }
  }
  return null;
}
function vbYear(N, y){
  const months = vbMonths(vbMoons(y, N.tz));
  return { y, tithi: vbTithi(N, y, months), nak: vbNak(N, y, months), solar: vbSolar(N, y) };
}

/* ---------------------------------- VEDIC BIRTHDAY UI ---------------------------------- */
let VB = null;
const VB_COL = { tithi: '#D4AF37', nak: '#5EC4B7', solar: '#8A6FB8' };
const VB_MIN = 1900, VB_MAX = 2100;
const vbWd = d => PN_VARA[pnWeekday(d.y, d.m, d.d)][1];
const vbLong = d => `${vbWd(d).slice(0, 3)}, ${d.d} ${PN_MON[d.m - 1]} ${d.y}`;
const vbShort = d => `${d.d} ${PN_MON[d.m - 1]}`;
const vbDays = d => Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(VB.today.y, VB.today.m - 1, VB.today.d)) / 86400000);
function vbRel(d){ const n = vbDays(d); return n === 0 ? 'Today 🎉' : n > 0 ? `in ${n === 1 ? '1 day' : n < 60 ? n + ' days' : n < 500 ? Math.round(n / 30.44) + ' months' : (n / 365.25).toFixed(1) + ' years'}` : `${-n === 1 ? '1 day' : -n < 60 ? -n + ' days' : -n < 500 ? Math.round(-n / 30.44) + ' months' : (-n / 365.25).toFixed(1) + ' years'} ago`; }
function vbGreg(d, y){ const n = Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(y, VB.N.bm - 1, VB.N.bd)) / 86400000);
  return n === 0 ? 'Same day as your Gregorian birthday' : `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} ${n > 0 ? 'after' : 'before'} your Gregorian birthday (${VB.N.bd} ${PN_MON[VB.N.bm - 1]})`; }

function buildVedicBirthdayPanel(chart, profile){
  const N = vbNatal(chart, profile), now = new Date();
  VB = { N, cache: {}, profile, y: now.getFullYear(), today: { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() } };
  VB.y = Math.min(VB_MAX, Math.max(VB_MIN, VB.y));
  const P = N.P;
  setTimeout(() => vbRender(), 0);
  return `<div class="vb">
    <div class="vb-hero">
      <div class="vb-cake" aria-hidden="true">🎂</div>
      <h3>Your Vedic Birthday</h3>
      <p>In the Hindu calendar your birthday is not a fixed date — it follows the Moon and Sun. Pick any year to see when your birth <b>Tithi</b>, <b>Nakshatra</b> and <b>Sun position</b> return.</p>
      <div class="vb-born">
        <span>🌙 ${PN_MASA[N.masaIdx]}${N.adhika ? ' (Adhika)' : ''} · ${P.tithi.paksha} ${P.tithi.name}</span>
        <span>★ ${NAKSHATRAS[N.nak].name} · pada ${N.pada}</span>
        <span>☀ Sun ${nvDeg(N.sunSid)}</span>
        <span>📅 Born ${vbLong({ y: N.by, m: N.bm, d: N.bd })}</span>
      </div>
    </div>
    <div class="vb-year">
      <button type="button" data-vb-step="-1" aria-label="Previous year">‹</button>
      <label><span>Year</span><input type="number" id="vbYear" min="${VB_MIN}" max="${VB_MAX}" value="${VB.y}" inputmode="numeric"></label>
      <button type="button" data-vb-step="1" aria-label="Next year">›</button>
      <button type="button" class="vb-now" data-vb-this>This year</button>
    </div>
    <div id="vbBody"></div>
  </div>`;
}
function vbGet(y){ if (!VB.cache[y]) VB.cache[y] = vbYear(VB.N, y); return VB.cache[y]; }
function vbRender(){
  const body = document.getElementById('vbBody'); if (!body || !VB) return;
  const y = VB.y; body.innerHTML = '<div class="vb-loading"><i></i> Calculating the sky for ' + y + '…</div>';
  setTimeout(() => {
    let Y; try { Y = vbGet(y); } catch(e){ console.error(e); body.innerHTML = '<div class="meta-err">Could not compute this year.</div>'; return; }
    VB.last = Y; body.innerHTML = vbBodyHtml(Y);
    vbNextUp();
  }, 20);
}
function vbDateBlock(label, day, sub, extra, y){
  const rel = vbRel(day), today = vbDays(day) === 0;
  return `<div class="vb-d ${today ? 'today' : ''}"><div class="vb-dl">${label}</div><b>${vbLong(day)}</b><span class="vb-rel">${rel}</span>
    <small>${sub}</small>${extra || ''}<em>${vbGreg(day, y)}</em></div>`;
}
function vbBodyHtml(Y){
  const N = VB.N, y = Y.y, tz = N.tz;
  const tCards = Y.tithi.length ? Y.tithi.map((t, i) => vbDateBlock(Y.tithi.length > 1 ? `Occurrence ${i + 1}` : 'Observed on', t.day,
    `${PN_MASA[N.masaIdx]} ${N.P.tithi.paksha} ${N.P.tithi.name}`,
    `<div class="vb-t">Tithi runs ${nvDate(t.start, tz, true)} → ${nvDate(t.end, tz, true)}</div>${t.day.sunrise ? '' : '<div class="vb-warn">⚠ This tithi begins and ends between two sunrises (kshaya). Many families observe it on this date regardless.</div>'}`, y)).join('') : '<div class="pl-empty">This tithi does not fall in this calendar year.</div>';
  const nb = Y.nak.filter(x => x.birthMonth);
  const nCards = nb.length ? nb.map((t, i) => vbDateBlock(nb.length > 1 ? `Occurrence ${i + 1}` : 'Observed on', t.day, `${NAKSHATRAS[N.nak].name} · in ${t.masa}`,
    `<div class="vb-t">Moon in ${NAKSHATRAS[N.nak].name}: ${nvDate(t.start, tz, true)} → ${nvDate(t.end, tz, true)}</div>`, y)).join('') : '<div class="pl-empty">No birth-month Nakshatra day found in this calendar year.</div>';
  const sr = Y.solar;
  const sCard = sr ? `<div class="vb-d ${vbDays(sr.day) === 0 ? 'today' : ''}"><div class="vb-dl">Exact moment</div><b>${vbLong(sr.day)}</b><span class="vb-rel">${vbRel(sr.day)}</span>
      <small>${sr.time} local time at the birth place · turning ${sr.age}</small>
      <div class="vb-t">Sun returns to ${nvDeg(N.sunSid)} (sidereal) · Varsha Lagna ${SIGNS[sr.lagna].symbol} ${SIGNS[sr.lagna].name} · Moon in ${SIGNS[sr.moon].symbol} ${SIGNS[sr.moon].name}</div><em>${vbGreg(sr.day, y)}</em></div>` : '<div class="pl-empty">Not available for this year.</div>';

  // year bar
  const dim = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365, doy = d => (Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(y, 0, 1)) / 86400000;
  const pos = d => (doy(d) / dim * 100).toFixed(2);
  const mons = PN_MON.map(m => `<span>${m[0]}</span>`).join('');
  const lane = (lbl, col, items) => `<div class="vb-lane"><b style="color:${col}">${lbl}</b><div class="vb-ltrack">${items.map(d => `<i style="left:${pos(d)}%;background:${col}" title="${vbShort(d)}"></i>`).join('')}</div></div>`;
  const greg = `<div class="vb-gl"><u style="left:${pos({ y, m: N.bm, d: N.bd })}%"></u></div>`;
  const tn = Y.today || null;
  const bar = `<div class="vb-bar"><div class="vb-months">${mons}</div><div class="vb-lanes">${greg}
    ${lane('Tithi', VB_COL.tithi, Y.tithi.map(t => t.day))}${lane('Nakshatra', VB_COL.nak, nb.map(t => t.day))}${lane('Solar', VB_COL.solar, sr ? [sr.day] : [])}</div>
    <div class="vb-legend"><span><u></u> Gregorian birthday</span></div></div>`;

  const nakAll = Y.nak.map(x => `<div class="vb-nr ${x.birthMonth ? 'on' : ''}"><b>${vbLong(x.day)}</b><span>${x.masa}</span>${x.birthMonth ? '<em>birth month</em>' : ''}</div>`).join('');

  const P = N.P, main = Y.tithi;
  const hero = main.length ? `<div class="vb-main">
      <div class="vb-main-k">🎂 Your Vedic Birthday in ${y}</div>
      ${main.map(t => `<div class="vb-main-d ${vbDays(t.day) === 0 ? 'today' : ''}"><b>${vbLong(t.day)}</b><span class="vb-rel">${vbRel(t.day)}</span></div>`).join('')}
      <div class="vb-main-why"><span>🌙</span><p><b>${PN_MASA[N.masaIdx]} ${P.tithi.paksha} ${P.tithi.name}</b> — the day your birth Tithi comes back in your birth lunar month. This is the traditional Hindu birthday; your Gregorian date does not apply.</p></div>
      <div class="vb-main-g">${vbGreg(main[0].day, y)}</div>
      <div id="vbHeroNext"></div>
    </div>` : `<div class="vb-main"><div class="vb-main-k">🎂 Your Vedic Birthday in ${y}</div><div class="vb-main-why"><span>🌙</span><p>Your birth Tithi in ${PN_MASA[N.masaIdx]} does not fall inside calendar year ${y} — try the previous or next year.</p></div></div>`;
  return `${hero}
    <div id="vbNext"></div>
    <div class="vb-sec"><h5>${y} at a glance</h5>${bar}</div>
    <div class="vb-sec"><h5>All the ways to mark your day <span>the first is your main Vedic birthday</span></h5></div>
    <div class="vb-cards">
      <div class="vb-card main" style="--pc:${VB_COL.tithi}"><div class="vb-badge">★ Your Vedic birthday</div><div class="vb-ch"><span>🌙</span><div><b>Tithi Birthday</b><small>Janma Tithi · the traditional Hindu birthday</small></div></div>${tCards}</div>
      <div class="vb-card" style="--pc:${VB_COL.nak}"><div class="vb-badge soft">Also observed</div><div class="vb-ch"><span>★</span><div><b>Nakshatra Birthday</b><small>Moon returns to your birth star, in your birth month</small></div></div>${nCards}</div>
      <div class="vb-card" style="--pc:${VB_COL.solar}"><div class="vb-badge soft">Also observed</div><div class="vb-ch"><span>☀</span><div><b>Solar Return</b><small>Surya Varsha · Sun back at its birth degree</small></div></div>${sCard}</div>
    </div>
    <details class="sb-note vb-det"><summary>All ${Y.nak.length} Janma Nakshatra days in ${y}</summary><p>Your Moon passes through ${NAKSHATRAS[N.nak].name} about every 27 days. Many families also mark the star day each month.</p><div class="vb-nlist">${nakAll}</div></details>
    <div class="vb-actions"><button type="button" class="export-download-btn export-ghost" data-vb-decade>📆 Show next 10 years</button><button type="button" class="export-download-btn export-ghost" data-vb-copy>📋 Copy ${y} dates</button></div>
    <div id="vbDecade"></div>
    <div class="pn-note">Tithi and Nakshatra birthdays are observed on the day the Tithi or star is present at sunrise at your birth place; the lunar month is Amanta, and Adhika (leap) months are skipped. The Solar Return uses the sidereal Sun (Lahiri) in the birth-place time zone, so it can fall a day away from your Gregorian birthday. Reliable for 1900–2100.</div>`;
}
function vbNextUp(){
  const box = document.getElementById('vbNext'); if (!box || !VB) return;
  setTimeout(() => {
    let ev = [];
    [VB.today.y, VB.today.y + 1].forEach(y => { try { const Y = vbGet(y);
      Y.tithi.forEach(t => ev.push(['Tithi birthday', VB_COL.tithi, '🌙', t.day])); Y.nak.filter(x => x.birthMonth).forEach(t => ev.push(['Nakshatra birthday', VB_COL.nak, '★', t.day]));
      if (Y.solar) ev.push(['Solar return', VB_COL.solar, '☀', Y.solar.day]); } catch(e){} });
    ev = ev.filter(e => vbDays(e[3]) >= 0).sort((a, b) => vbDays(a[3]) - vbDays(b[3]));
    const hn = document.getElementById('vbHeroNext');
    if (hn && VB.last && VB.last.y === VB.today.y){
      const cur = VB.last.tithi.filter(t => vbDays(t.day) >= 0)[0];
      let nx = cur ? null : (vbGet(VB.today.y + 1).tithi[0] || null);
      if (nx) hn.innerHTML = `<div class="vb-main-next">Next Vedic birthday: <b>${vbLong(nx.day)}</b> <em>${vbRel(nx.day)}</em></div>`;
    }
    const el = document.getElementById('vbNext'); if (!el) return;
    el.innerHTML = ev.length ? `<div class="vb-next"><small>Coming up next</small><div>${ev.slice(0, 3).map(e => `<span style="--pc:${e[1]}">${e[2]} <b>${e[0]}</b> ${vbLong(e[3])} <em>${vbRel(e[3])}</em></span>`).join('')}</div></div>` : '';
  }, 30);
}
function vbSetYear(y){
  y = parseInt(y); if (isNaN(y)) return;
  if (y < VB_MIN || y > VB_MAX){ APP.toast(`Please choose a year between ${VB_MIN} and ${VB_MAX}.`, 'error'); y = Math.min(VB_MAX, Math.max(VB_MIN, y)); }
  VB.y = y; const inp = document.getElementById('vbYear'); if (inp) inp.value = y; vbRender();
}
async function vbDecade(){
  const box = document.getElementById('vbDecade'); if (!box) return;
  const y0 = VB.y, rows = [];
  for (let i = 0; i < 10 && y0 + i <= VB_MAX; i++){
    box.innerHTML = `<div class="vb-loading"><i></i> Calculating ${y0 + i}…</div>`; await new Promise(r => setTimeout(r, 15));
    const Y = vbGet(y0 + i), nb = Y.nak.filter(x => x.birthMonth);
    rows.push(`<div class="vb-row"><b>${Y.y}</b><span style="--pc:${VB_COL.tithi}">${Y.tithi.map(t => vbShort(t.day)).join(' · ') || '—'}</span><span style="--pc:${VB_COL.nak}">${nb.map(t => vbShort(t.day)).join(' · ') || '—'}</span><span style="--pc:${VB_COL.solar}">${Y.solar ? vbShort(Y.solar.day) + ' ' + Y.solar.time : '—'}</span></div>`);
  }
  box.innerHTML = `<div class="vb-table"><div class="vb-row head"><b>Year</b><span>🌙 Tithi</span><span>★ Nakshatra</span><span>☀ Solar return</span></div>${rows.join('')}</div>`;
}
document.addEventListener('click', (e) => {
  if (!VB) return;
  const st = e.target.closest('[data-vb-step]'); if (st){ vbSetYear(VB.y + parseInt(st.dataset.vbStep)); return; }
  if (e.target.closest('[data-vb-this]')){ vbSetYear(VB.today.y); return; }
  if (e.target.closest('[data-vb-decade]')){ vbDecade(); return; }
  if (e.target.closest('[data-vb-copy]') && VB.last){
    const Y = VB.last, N = VB.N, nb = Y.nak.filter(x => x.birthMonth);
    const txt = [`Vedic birthday dates for ${Y.y}`, `Born under: ${PN_MASA[N.masaIdx]} ${N.P.tithi.paksha} ${N.P.tithi.name}, ${NAKSHATRAS[N.nak].name}`,
      `Tithi birthday: ${Y.tithi.map(t => vbLong(t.day)).join(' / ') || '—'}`, `Nakshatra birthday: ${nb.map(t => vbLong(t.day)).join(' / ') || '—'}`,
      `Solar return: ${Y.solar ? vbLong(Y.solar.day) + ' ' + Y.solar.time : '—'}`].join('\n');
    APP.copy(txt).then(ok => APP.toast(ok ? 'Dates copied ✓' : 'Could not copy', ok ? 'success' : 'error'));
  }
});
document.addEventListener('change', (e) => { if (VB && e.target.id === 'vbYear') vbSetYear(e.target.value); });
document.addEventListener('keydown', (e) => { if (VB && e.target.id === 'vbYear' && e.key === 'Enter') vbSetYear(e.target.value); });

/* =============================================================================
   NUMEROLOGY — Name number (Chaldean / Pythagorean) + Date-of-birth numbers + Lo Shu grid
   ============================================================================= */
const NM_CHALDEAN = {A:1,I:1,J:1,Q:1,Y:1,B:2,K:2,R:2,C:3,G:3,L:3,S:3,D:4,M:4,T:4,E:5,H:5,N:5,X:5,U:6,V:6,W:6,O:7,Z:7,F:8,P:8};
const NM_PYTH = {A:1,J:1,S:1,B:2,K:2,T:2,C:3,L:3,U:3,D:4,M:4,V:4,E:5,N:5,W:5,F:6,O:6,X:6,G:7,P:7,Y:7,H:8,Q:8,Z:8,I:9,R:9};
const NM_PCOL = { Sun:'#E0A64A', Moon:'#C9C3AE', Jupiter:'#E0C34A', Rahu:'#6B7FA3', Mercury:'#5EC4B7', Venus:'#D96C9B', Ketu:'#8A6FB8', Saturn:'#5B7FD6', Mars:'#C95050' };
const NM_INFO = {
 1:{t:'The Pioneer',k:'Leadership · Independence · Willpower',p:'Sun',col:'Gold, orange',gem:'Ruby',d:'A natural starter with a strong will and a need to lead and stand on your own feet. You do best when you are free to decide and take the first step.',s:['Self-reliant','Decisive','Original thinker'],w:['Pride or stubbornness','Impatience with a slower pace','Reluctance to ask for help'],soul:'Wants independence, achievement and to be recognised for it.',out:'Comes across as confident, direct and in charge.'},
 2:{t:'The Peacemaker',k:'Cooperation · Sensitivity · Intuition',p:'Moon',col:'White, cream, silver',gem:'Pearl',d:'Gentle and tuned in to other people’s feelings. You thrive in partnerships and bring calm and harmony wherever you go.',s:['Empathetic','Tactful','Supportive team player'],w:['Over-sensitivity','Indecision','Absorbing other people’s moods'],soul:'Wants love, peace and a trusted partner.',out:'Comes across as kind, approachable and diplomatic.'},
 3:{t:'The Communicator',k:'Creativity · Expression · Optimism',p:'Jupiter',col:'Yellow',gem:'Yellow sapphire',d:'Expressive, social and naturally optimistic, with a gift for words, ideas and the arts. You lift the mood of a room.',s:['Creative','Sociable','Optimistic'],w:['Scattered energy','Exaggeration or too much talk','Avoiding depth'],soul:'Wants to express, enjoy life and be heard.',out:'Comes across as charming, witty and lively.'},
 4:{t:'The Builder',k:'Discipline · Structure · Hard work',p:'Rahu',col:'Blue, grey, earthy tones',gem:'Hessonite (gomed)',d:'Methodical and dependable, you build things that last through steady effort. There is often an unconventional streak beneath the practical surface.',s:['Organised','Dependable','Determined'],w:['Rigidity','Stubbornness','Worry about security and sudden upsets'],soul:'Wants stability, order and visible results.',out:'Comes across as serious, reliable and grounded.'},
 5:{t:'The Adventurer',k:'Freedom · Change · Curiosity',p:'Mercury',col:'Green',gem:'Emerald',d:'A quick, curious mind that loves variety, movement and new experiences. You adapt fast and communicate well.',s:['Versatile','Quick learner','Persuasive'],w:['Restlessness','Inconsistency','Impulsiveness'],soul:'Wants freedom, adventure and mental stimulation.',out:'Comes across as energetic, clever and magnetic.'},
 6:{t:'The Nurturer',k:'Love · Responsibility · Harmony',p:'Venus',col:'White, pink',gem:'Diamond / white sapphire',d:'Caring, family-minded and drawn to beauty. You create comfort and balance and carry responsibility for the people you love.',s:['Loving','Responsible','Artistic'],w:['Over-giving','Perfectionism','Controlling “for others’ good”'],soul:'Wants a harmonious home and to care for others.',out:'Comes across as warm, dependable and gracious.'},
 7:{t:'The Seeker',k:'Analysis · Spirituality · Introspection',p:'Ketu',col:'Smoky grey, soft violet',gem:'Cat’s eye',d:'Thoughtful and private, drawn to deep questions, study and the inner life. You need quiet time to recharge and to find the truth for yourself.',s:['Analytical','Intuitive','Independent thinker'],w:['Aloofness','Isolating yourself','Skepticism or moodiness'],soul:'Wants understanding, solitude and inner truth.',out:'Comes across as reserved, wise and a little mysterious.'},
 8:{t:'The Achiever',k:'Power · Discipline · Material success',p:'Saturn',col:'Dark blue, black',gem:'Blue sapphire',d:'Serious and persistent, you build authority slowly through effort. You understand money, responsibility and the long game.',s:['Resilient','Strategic','Patient'],w:['Workaholic tendencies','Appearing cold or rigid','Fear of loss'],soul:'Wants achievement, security and respect.',out:'Comes across as capable, authoritative and driven.'},
 9:{t:'The Humanitarian',k:'Compassion · Courage · Completion',p:'Mars',col:'Red',gem:'Red coral',d:'A generous, energetic idealist who wants to make a difference. You fight for causes and are often at your best when serving something bigger.',s:['Compassionate','Courageous','Generous'],w:['Anger or impatience','Over-sacrificing','Difficulty letting go'],soul:'Wants to serve, to inspire and to finish what matters.',out:'Comes across as passionate, warm and larger than life.'},
 11:{t:'The Master Intuitive',k:'Inspiration · Intuition · Illumination',p:'Moon',col:'Silver, white',gem:'Pearl',d:'A master number that carries the 2’s sensitivity at a higher pitch — strong intuition, inspiration and the ability to uplift others.',s:['Visionary','Inspiring','Highly intuitive'],w:['Nervous tension','Self-doubt','Unrealistic expectations'],soul:'Wants to inspire and to follow a higher calling.',out:'Comes across as luminous, sensitive and idealistic.',base:2},
 22:{t:'The Master Builder',k:'Vision · Practicality · Large-scale results',p:'Rahu',col:'Blue, grey',gem:'Hessonite (gomed)',d:'A master number that joins the 4’s practicality to a big vision — the potential to turn large ideas into lasting structures.',s:['Practical visionary','Organised on a grand scale','Determined'],w:['Pressure and perfectionism','Overwhelm','Stubbornness'],soul:'Wants to build something that outlasts them.',out:'Comes across as capable, steady and quietly powerful.',base:4},
 33:{t:'The Master Teacher',k:'Compassion · Service · Guidance',p:'Venus',col:'Pink, white',gem:'Diamond / white sapphire',d:'A master number that lifts the 6’s love and care into service of many — healing, teaching and guiding others.',s:['Selfless','Nurturing','Inspiring teacher'],w:['Carrying everyone’s burdens','Self-neglect','Idealism'],soul:'Wants to heal, teach and uplift.',out:'Comes across as gentle, wise and deeply caring.',base:6}
};
const NM_YEAR = {1:'New beginnings — start, decide, take the lead.',2:'Patience and partnership — cooperate and let things grow.',3:'Creativity and social expansion — express yourself.',4:'Foundations and hard work — organise, build, be practical.',5:'Change and freedom — travel, variety, unexpected turns.',6:'Home, love and responsibility — family and relationships.',7:'Reflection and learning — slow down, study, look within.',8:'Achievement and money — career, power, results.',9:'Completion and release — finish, let go, forgive.'};
const NM_LOSHU = [[4,9,2],[3,5,7],[8,1,6]];
const NM_MISS = {1:'self-expression and assertiveness',2:'sensitivity and cooperation',3:'creative communication',4:'discipline and structure',5:'balance and adaptability',6:'care and domestic harmony',7:'reflection and faith',8:'drive and handling money',9:'idealism and follow-through'};
const NM_LINES = [['Mental plane',[4,9,2]],['Emotional plane',[3,5,7]],['Practical plane',[8,1,6]],['Thought',[4,3,8]],['Will',[9,5,1]],['Action',[2,7,6]],['Determination',[4,5,6]],['Compassion',[2,5,8]]];

function nmReduce(n, masters){ const steps = [n]; while (n > 9){ if (masters && (n === 11 || n === 22 || n === 33)) break; n = String(n).split('').reduce((a, c) => a + (+c), 0); steps.push(n); } return { n, steps }; }
function nmStepsTxt(r){ return r.steps.map((v, i) => i === 0 ? `${v}` : `${r.steps[i-1]}`.split('').join('+') + ` = ${v}`).slice(1).join(' → ') || `${r.steps[0]}`; }
function nmName(name, sys){
  const map = sys === 'chaldean' ? NM_CHALDEAN : NM_PYTH, masters = sys !== 'chaldean';
  const words = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  if (!words.length) return null;
  let tot = 0, vow = 0, con = 0;
  const wl = words.map(w => {
    const hasV = /[AEIOU]/.test(w);
    const letters = [...w].map(ch => ({ ch, v: map[ch], vowel: 'AEIOU'.includes(ch) || (ch === 'Y' && !hasV) }));
    const sum = letters.reduce((a, l) => a + l.v, 0);
    letters.forEach(l => { tot += l.v; if (l.vowel) vow += l.v; else con += l.v; });
    return { w, letters, sum };
  });
  return { words: wl, total: tot, vowels: vow, cons: con, name: nmReduce(tot, masters), soul: vow ? nmReduce(vow, masters) : null, pers: con ? nmReduce(con, masters) : null };
}
function nmDob(ds, sys, year){
  const [y, m, d] = ds.split('-').map(Number); if (!y || !m || !d) return null;
  const masters = sys !== 'chaldean', ds2 = n => String(n).split('').reduce((a, c) => a + (+c), 0);
  const day = nmReduce(d, masters), mulank = nmReduce(d, false);
  const rd = nmReduce(d, masters).n, rm = nmReduce(m, masters).n, ry = nmReduce(ds2(y), masters).n;
  const life = masters ? nmReduce(rd + rm + ry, true) : nmReduce(ds2(d) + ds2(m) + ds2(y), false);
  const attitude = nmReduce(d + m, false), py = nmReduce(nmReduce(d, false).n + nmReduce(m, false).n + nmReduce(ds2(year), false).n, false);
  const digits = (`${String(d).padStart(2, '0')}${String(m).padStart(2, '0')}${y}`).split('').map(Number).filter(x => x > 0).concat([mulank.n, nmReduce(ds2(d) + ds2(m) + ds2(y), false).n]);
  const counts = {}; for (let i = 1; i <= 9; i++) counts[i] = digits.filter(x => x === i).length;
  return { y, m, d, day, mulank, life, attitude, py, counts, lifeParts: [rd, rm, ry] };
}

/* ---------------------------------- NUMEROLOGY UI ---------------------------------- */
let NM = null;
function buildNumerologyPanel(chart, profile){
  NM = { sys: 'chaldean', mode: 'name', name: '', name2: '', dob: profile.dob, year: new Date().getFullYear(), pick: 'life', profName: profile.name || '' };
  setTimeout(nmRender, 0);
  return `<div class="nm">
    <div class="nm-top">
      <div class="nm-seg nm-modes"><button type="button" class="on" data-nm-mode="name">✍ Name only</button><button type="button" data-nm-mode="dob">📅 Birth date + name</button></div>
      <div class="nm-seg nm-sys" title="Numbering system"><button type="button" class="on" data-nm-sys="chaldean">Chaldean</button><button type="button" data-nm-sys="pythagorean">Pythagorean</button></div>
    </div>
    <div class="nm-sysnote" id="nmSysNote"></div>
    <div class="nm-inputs">
      <div id="nmInName" class="nm-in"><label>Full name <small>(English letters)</small><input type="text" id="nmName" placeholder="e.g. Ananya Sharma" autocomplete="off"></label>
        <button type="button" class="nm-use" data-nm-use="name">Use “${escapeHtml((profile.name || '').split(' ')[0] || 'my name')}”</button></div>
      <div id="nmInDob" class="nm-in" hidden>
        <div class="nm-row"><label>Date of birth<input type="date" id="nmDob" value="${profile.dob}"></label>
        <label>Name <small>(optional)</small><input type="text" id="nmName2" placeholder="Add a name for more" autocomplete="off"></label></div>
        <button type="button" class="nm-use" data-nm-use="name2">Use “${escapeHtml((profile.name || '').split(' ')[0] || 'my name')}”</button></div>
    </div>
    <div id="nmBody"></div>
  </div>`;
}
function nmMeaningCard(n, label, opts){
  const info = NM_INFO[n]; if (!info) return '';
  const pc = NM_PCOL[info.p], base = info.base ? ` · reduces to ${info.base}` : '';
  return `<div class="nm-mean" style="--pc:${pc}">
    <div class="nm-mean-h"><span class="nm-bign">${n}</span><div><small>${label}</small><h4>${info.t}</h4><span>${info.k}</span></div></div>
    <p>${info.d}</p>
    <div class="nm-two"><div class="nm-good"><b>Strengths</b>${info.s.map(x => `<span>${x}</span>`).join('')}</div><div class="nm-warn"><b>Watch-outs</b>${info.w.map(x => `<span>${x}</span>`).join('')}</div></div>
    <div class="nm-facts"><div><small>Ruling planet</small><b>${info.p}</b></div><div><small>Colours</small><b>${info.col}</b></div><div><small>Gemstone</small><b>${info.gem}</b></div></div>
    ${opts && opts.inner ? `<div class="nm-ino"><div><b>Inner motivation</b><span>${info.soul}</span></div><div><b>Outer impression</b><span>${info.out}</span></div></div>` : ''}
    <small class="nm-base">${base ? 'Master number' + base : ''}</small></div>`;
}
function nmTrio(R){
  const one = (lbl, sub, r, comp) => r ? `<div class="nm-t" style="--pc:${NM_PCOL[NM_INFO[r.n].p]}"><small>${lbl}</small><b>${r.n}</b><span>${NM_INFO[r.n].t}</span><em>${comp > 9 ? comp + ' → ' + r.n + ' · ' : ''}${sub}</em></div>` : `<div class="nm-t"><small>${lbl}</small><b>—</b><span>no letters</span></div>`;
  return `<div class="nm-trio">${one('Expression · all letters', 'how you act', R.name, R.total)}${one('Soul urge · vowels', 'what you want', R.soul, R.vowels)}${one('Personality · consonants', 'how you appear', R.pers, R.cons)}</div>`;
}
function nmNameHtml(){
  const R = nmName(NM.name, NM.sys);
  if (!NM.name.trim()) return `<div class="nm-empty">✍ Type a name above to see its numbers, the final number and what it means.</div>`;
  if (!R) return `<div class="nm-empty">Please write the name using English (Latin) letters, for example “Ananya”.</div>`;
  const n = R.name.n, info = NM_INFO[n], pc = NM_PCOL[info.p], chal = NM.sys === 'chaldean';
  const words = R.words.map(w => `<div class="nm-word"><div class="nm-wl"><b>${w.w}</b><span>= ${w.sum}</span></div><div class="nm-tiles">${w.letters.map(l => `<span class="${l.vowel ? 'v' : 'c'}"><i>${l.ch}</i><b>${l.v}</b></span>`).join('')}</div></div>`).join('');
  const letterEq = R.words.map(w => w.letters.map(l => l.v).join('+')).join(' + ');
  const comp = R.total > 9 ? `Compound number <b>${R.total}</b>${chal ? ' (traditional “compound” before the final number)' : ''}` : 'Single-digit total';
  return `<div class="nm-hero" style="--pc:${pc}">
      <div class="nm-ring"><b>${n}</b></div>
      <div class="nm-hero-t"><small>Your ${chal ? 'Chaldean' : 'Pythagorean'} name number</small><h4>${info.t}</h4><span>${info.k}</span>
        <div class="nm-chips"><span>${comp}</span><span>Ruled by ${info.p}</span></div></div>
    </div>
    <div class="nm-sec"><h5>① Number of every letter <span>teal = vowel · gold = consonant</span></h5>${words}</div>
    <div class="nm-sec"><h5>② Adding it up</h5>
      <div class="nm-calc"><div class="nm-step"><small>All letters</small><code>${letterEq}</code><b>= ${R.total}</b></div>
      <div class="nm-step"><small>Reduce to the end number</small><code>${R.total > 9 ? nmStepsTxt(R.name) : 'already a single digit'}</code><b>→ ${n}</b></div></div></div>
    <div class="nm-sec"><h5>③ What the end number ${n} means</h5>${nmMeaningCard(n, 'Name number', { inner: true })}</div>
    <div class="nm-sec"><h5>④ Three views of your name</h5>${nmTrio(R)}</div>
    <div class="nm-actions"><button type="button" class="export-download-btn export-ghost" data-nm-copy>📋 Copy result</button></div>
    <div class="pn-note">${chal ? 'Chaldean numbers run 1–8 (9 is held sacred and never assigned to a letter). The compound total is shown first, then reduced to the final single digit.' : 'Pythagorean numbers run 1–9. Master numbers 11, 22 and 33 are kept unreduced.'} Y counts as a consonant unless the word has no other vowel. Numerology is a traditional symbolic system, not a scientific one.</div>`;
}
function nmDobHtml(){
  const D = nmDob(NM.dob, NM.sys, NM.year);
  if (!D) return `<div class="nm-empty">📅 Choose a date of birth to see your numbers.</div>`;
  const chal = NM.sys === 'chaldean', N = NM.name2.trim() ? nmName(NM.name2, NM.sys) : null;
  const cards = [
    { key: 'life', lbl: chal ? 'Bhagyank · Destiny' : 'Life Path', r: D.life, note: chal ? 'all digits of birth date' : 'day + month + year' },
    { key: 'day', lbl: chal ? 'Mulank · Psychic' : 'Birthday number', r: chal ? D.mulank : D.day, note: `born on the ${D.d}${[11,12,13].includes(D.d % 100) ? 'th' : ['th','st','nd','rd'][D.d % 10 > 3 ? 0 : D.d % 10]}` },
    { key: 'att', lbl: 'Attitude', r: D.attitude, note: 'day + month' }
  ];
  if (N) cards.push({ key: 'name', lbl: 'Name number', r: N.name, note: NM.name2.trim().split(/\s+/)[0] });
  if (!cards.some(c => c.key === NM.pick)) NM.pick = 'life';
  const tiles = cards.map(c => `<button type="button" class="nm-card ${NM.pick === c.key ? 'on' : ''}" style="--pc:${NM_PCOL[NM_INFO[c.r.n].p]}" data-nm-pick="${c.key}"><small>${c.lbl}</small><b>${c.r.n}</b><span>${NM_INFO[c.r.n].t}</span><em>${c.note}</em></button>`).join('');
  const sel = cards.find(c => c.key === NM.pick);
  const dayTxt = D.d > 9 ? `${String(D.d).split('').join('+')} = ${D.mulank.steps[1]}${D.mulank.steps.length > 2 ? ' → ' + D.mulank.n : ''}` : `${D.d}`;
  const lifeCalc = chal ? `${[...String(D.d), ...String(D.m), ...String(D.y)].join('+')} = ${[...String(D.d), ...String(D.m), ...String(D.y)].reduce((a, c) => a + (+c), 0)}${D.life.steps.length > 1 ? ' → ' + nmStepsTxt(D.life) : ''}`
    : `${D.lifeParts.join(' + ')} = ${D.lifeParts.reduce((a, b) => a + b, 0)}${D.life.steps.length > 1 ? ' → ' + nmStepsTxt(D.life) : ''}`;
  const py = D.py.n, years = [NM.year - 1, NM.year, NM.year + 1];
  const grid = NM_LOSHU.map(r => `<div class="nm-gr">${r.map(v => `<div class="nm-gc ${D.counts[v] ? 'has' : 'miss'}"><small>${v}</small><b>${D.counts[v] ? String(v).repeat(D.counts[v]) : '·'}</b></div>`).join('')}</div>`).join('');
  const missing = [1,2,3,4,5,6,7,8,9].filter(v => !D.counts[v]), lines = NM_LINES.filter(l => l[1].every(v => D.counts[v]));
  const info = NM_INFO[sel.r.n];
  return `<div class="nm-cards">${tiles}</div>
    ${nmMeaningCard(sel.r.n, sel.lbl, { inner: sel.key === 'name' })}
    ${N ? `<div class="nm-sec"><h5>Name · ${escapeHtml(NM.name2.trim())}</h5>${nmTrio(N)}</div>` : '<div class="nm-hint">💡 Add a name above to unlock the Name, Soul-urge and Personality numbers.</div>'}
    <div class="nm-sec"><h5>How these were worked out</h5><div class="nm-calc">
      <div class="nm-step"><small>${chal ? 'Mulank (day of birth)' : 'Birthday number'}</small><code>${dayTxt}</code><b>→ ${(chal ? D.mulank : D.day).n}</b></div>
      <div class="nm-step"><small>${chal ? 'Bhagyank (full date)' : 'Life Path'}</small><code>${lifeCalc}</code><b>→ ${D.life.n}</b></div>
      <div class="nm-step"><small>Attitude</small><code>${D.d} + ${D.m} = ${D.d + D.m}${D.attitude.steps.length > 1 ? ' → ' + nmStepsTxt(D.attitude) : ''}</code><b>→ ${D.attitude.n}</b></div></div></div>
    <div class="nm-sec"><h5>Personal year <span>a 9-year cycle</span></h5>
      <div class="nm-py"><div class="nm-pyn" style="--pc:${NM_PCOL[NM_INFO[py].p]}"><small>${NM.year}</small><b>${py}</b></div><div><b>${NM_YEAR[py]}</b><span>${D.d} + ${D.m} + ${NM.year} → ${py}</span>
        <div class="nm-yr"><button type="button" data-nm-year="-1">‹ ${NM.year - 1}</button><button type="button" data-nm-year="0">This year</button><button type="button" data-nm-year="1">${NM.year + 1} ›</button></div></div></div></div>
    <div class="nm-sec"><h5>Lo Shu grid <span>digits of your birth date + Mulank + Bhagyank</span></h5>
      <div class="nm-lo"><div class="nm-grid">${grid}</div><div class="nm-lo-s">
        <div><b>Present</b><p>${[1,2,3,4,5,6,7,8,9].filter(v => D.counts[v]).map(v => `<span class="ok">${v}${D.counts[v] > 1 ? '×' + D.counts[v] : ''}</span>`).join('') || '—'}</p></div>
        <div><b>Missing</b><p>${missing.length ? missing.map(v => `<span class="no" title="${NM_MISS[v]}">${v}</span>`).join('') : '<em>none — all nine present</em>'}</p>${missing.length ? `<small>Missing numbers point to areas to consciously develop: ${missing.slice(0, 3).map(v => v + ' (' + NM_MISS[v] + ')').join('; ')}${missing.length > 3 ? '…' : ''}.</small>` : ''}</div>
        <div><b>Complete lines</b><p>${lines.length ? lines.map(l => `<span class="ln">${l[0]} ${l[1].join('-')}</span>`).join('') : '<em>no full line</em>'}</p></div></div></div></div>
    <div class="nm-actions"><button type="button" class="export-download-btn export-ghost" data-nm-copy>📋 Copy result</button></div>
    <div class="pn-note">${chal ? 'Indian method: Mulank is the day of birth reduced to 1–9, Bhagyank is every digit of the birth date added and reduced to 1–9.' : 'Western method: Life Path adds the reduced day, month and year; master numbers 11, 22 and 33 are kept.'} Numerology is a traditional symbolic system, not a scientific one.</div>`;
}
function nmRender(){
  const b = document.getElementById('nmBody'); if (!b || !NM) return;
  document.getElementById('nmInName').hidden = NM.mode !== 'name'; document.getElementById('nmInDob').hidden = NM.mode !== 'dob';
  document.getElementById('nmSysNote').textContent = NM.sys === 'chaldean' ? 'Chaldean — the traditional system used in Indian numerology (numbers 1–8 on letters).' : 'Pythagorean — the Western system (numbers 1–9, master numbers 11/22/33 kept).';
  b.innerHTML = NM.mode === 'name' ? nmNameHtml() : nmDobHtml();
}
function nmCopyText(){
  if (NM.mode === 'name'){ const R = nmName(NM.name, NM.sys); if (!R) return ''; const n = R.name.n;
    return `Name numerology (${NM.sys}) — ${NM.name.trim()}\nTotal: ${R.total} → end number ${n} (${NM_INFO[n].t})\nSoul urge: ${R.soul ? R.soul.n : '—'}  Personality: ${R.pers ? R.pers.n : '—'}\n${NM_INFO[n].d}`; }
  const D = nmDob(NM.dob, NM.sys, NM.year); if (!D) return '';
  return `Numerology (${NM.sys}) — born ${NM.dob}\n${NM.sys === 'chaldean' ? 'Mulank' : 'Birthday'}: ${(NM.sys === 'chaldean' ? D.mulank : D.day).n}  ${NM.sys === 'chaldean' ? 'Bhagyank' : 'Life Path'}: ${D.life.n} (${NM_INFO[D.life.n].t})\nAttitude: ${D.attitude.n}  Personal year ${NM.year}: ${D.py.n}`;
}
document.addEventListener('click', (e) => {
  if (!NM) return;
  const mode = e.target.closest('[data-nm-mode]'); if (mode){ NM.mode = mode.dataset.nmMode; document.querySelectorAll('[data-nm-mode]').forEach(b => b.classList.toggle('on', b === mode)); nmRender(); return; }
  const sys = e.target.closest('[data-nm-sys]'); if (sys){ NM.sys = sys.dataset.nmSys; document.querySelectorAll('[data-nm-sys]').forEach(b => b.classList.toggle('on', b === sys)); nmRender(); return; }
  const use = e.target.closest('[data-nm-use]'); if (use){ const k = use.dataset.nmUse; NM[k] = NM.profName; document.getElementById(k === 'name' ? 'nmName' : 'nmName2').value = NM.profName; nmRender(); return; }
  const pick = e.target.closest('[data-nm-pick]'); if (pick){ NM.pick = pick.dataset.nmPick; nmRender(); return; }
  const yr = e.target.closest('[data-nm-year]'); if (yr){ const v = parseInt(yr.dataset.nmYear); NM.year = v === 0 ? new Date().getFullYear() : NM.year + v; nmRender(); return; }
  if (e.target.closest('[data-nm-copy]')){ const t = nmCopyText(); if (t) APP.copy(t).then(ok => APP.toast(ok ? 'Result copied ✓' : 'Could not copy', ok ? 'success' : 'error')); }
});
document.addEventListener('input', (e) => {
  if (!NM) return;
  if (e.target.id === 'nmName'){ NM.name = e.target.value; nmRender(); }
  else if (e.target.id === 'nmName2'){ NM.name2 = e.target.value; nmRender(); }
  else if (e.target.id === 'nmDob'){ NM.dob = e.target.value; nmRender(); }
});

/* ===== My Chart / Overview (redesigned) ===== */
const OV_EL_COLORS = {fire:'#E0744A',earth:'#8FB36B',air:'#6FB7D9',water:'#5B7FD6'};
let ovStyle = 'north';
function ovChartSvg(chart){
  try { return buildInteractiveVargaSvg(chart.vargas.D1, VARGAS.D1, ovStyle, null); }
  catch(e){ return '<div class="ov-empty">Chart could not be drawn.</div>'; }
}
function buildOverviewPanel(chart, profile){
  const asc = SIGNS[chart.ascendant.sign], moon = SIGNS[chart.planets.Moon.sign], sun = SIGNS[chart.planets.Sun.sign];
  const moonNak = chart.planets.Moon.nakshatra;
  const initial = escapeHtml((profile.name||'?').trim().charAt(0).toUpperCase());

  // element balance (7 planets + lagna)
  const els = {fire:0,earth:0,air:0,water:0};
  ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].forEach(n=>{ const e=(SIGNS[chart.planets[n].sign].element||'').toLowerCase(); if(e in els) els[e]++; });
  { const e=(asc.element||'').toLowerCase(); if(e in els) els[e]++; }
  const totEl = Object.values(els).reduce((a,b)=>a+b,0)||1;
  const domEl = Object.keys(els).sort((a,b)=>els[b]-els[a])[0];
  const elBar = Object.keys(els).map(k=>`<i style="width:${els[k]/totEl*100}%;background:${OV_EL_COLORS[k]}" title="${k}: ${els[k]}"></i>`).join('');
  const elLeg = Object.keys(els).map(k=>`<span><i style="background:${OV_EL_COLORS[k]}"></i>${k[0].toUpperCase()+k.slice(1)} ${els[k]}</span>`).join('');

  // planet rows
  const rows = [['Lagna',chart.ascendant,true]].concat(PLANET_LIST.map(n=>[n,chart.planets[n],false])).map(([n,p,isAsc])=>{
    const sg = SIGNS[p.sign], col = isAsc ? '#D4AF37' : (DASHA_PLANET_COLORS[n]||'#888');
    const nak = p.nakshatra ? p.nakshatra.name : '';
    const dig = (!isAsc && p.dignity && p.dignity.label) ? p.dignity.label : '';
    return `<div class="ov-prow" ${isAsc?'':`data-planet-click="${n}"`} style="--pc:${col}">
      <span class="ov-pdot" style="background:${col}">${isAsc?'↑':PLANET_GLYPHS[n]}</span>
      <span class="ov-pname"><b>${n}${p.retrograde?' <em>℞</em>':''}</b><small>${nak}</small></span>
      <span class="ov-psign">${sg.symbol} ${sg.name}<small>${formatDeg(p.degInSign)}</small></span>
      <span class="ov-phouse">${isAsc?'H1':'H'+p.house}${dig?`<small>${dig}</small>`:''}</span>
    </div>`;
  }).join('');

  const karakas = KARAKA_NAMES.map(name=>{
    const k = chart.charaKarakas[name], prim = name==='Atmakaraka'||name==='Darakaraka', c = DASHA_PLANET_COLORS[k.planet];
    return `<div class="karaka-card ov-kcard ${prim?'karaka-primary':''}" style="--pc:${c}">
      <div class="ov-ktop"><span class="ov-pdot" style="background:${c}">${PLANET_GLYPHS[k.planet]}</span>
      <span><b class="karaka-card-planet-name planet-clickable" data-planet-click="${k.planet}">${k.planet}</b><small>${name}</small></span></div>
      <div class="ov-kdesc">${KARAKA_SIGNIFICANCE[name]}</div><div class="ov-kdeg">${formatDeg(k.degree)} traversed</div></div>`;
  }).join('');

  const big = (label, sg, deg, planet) => `<div class="ov-big">
      <small>${label}</small><div class="ov-sym">${sg.symbol}</div>
      <b ${planet?`class="planet-clickable" data-planet-click="${planet}"`:''}>${sg.name}</b>
      <span>${sg.sk} · Lord ${sg.lord}</span><em>${formatDeg(deg)}</em></div>`;

  return `<div class="ov">
    <div class="ov-hero">
      <div class="ov-av">${initial}</div>
      <div class="ov-id"><h3>${escapeHtml(profile.name)}</h3>
        <div class="ov-chips"><span>📅 ${formatDateHuman(profile.dob)}</span><span>🕒 ${profile.tob}</span><span>📍 ${escapeHtml(profile.place.split(',')[0])}</span><span>🌐 ${fmtTz(profile.tz)}</span></div>
      </div>
    </div>

    <div class="ov-big3">${big('Lagna · Ascendant',asc,chart.ascendant.degInSign,null)}${big('Rashi · Moon sign',moon,chart.planets.Moon.degInSign,'Moon')}${big('Surya · Sun sign',sun,chart.planets.Sun.degInSign,'Sun')}</div>

    <div class="ov-sec"><h5>Birth chart (D1)</h5>
      <div class="ov-chartgrid">
        <div class="ov-chartcard">
          <div class="ov-toggle"><button type="button" class="on" data-ov-style="north">North Indian</button><button type="button" data-ov-style="south">South Indian</button></div>
          <div id="ovChartSvg" class="ov-svg">${ovChartSvg(chart)}</div>
        </div>
        <div class="ov-plist"><div class="ov-plist-h"><span style="width:30px"></span><span>Planet</span><span>Sign</span><span>House</span></div>${rows}</div>
      </div>
    </div>

    <div class="ov-sec"><h5>Moon's nakshatra</h5>
      <div class="ov-nak">
        <div class="ov-nak-main"><span class="ov-sym sm">☽</span><div><b>${moonNak.name}</b><small>Pada ${moonNak.pada} · Janma Nakshatra</small></div></div>
        <div class="ov-nak-grid">
          <div><small>Nakshatra lord</small><b>${moonNak.lord}</b></div>
          <div><small>Ruling deity</small><b>${moonNak.deity}</b></div>
          <div><small>Lagna nakshatra</small><b>${chart.ascendant.nakshatra.name} · ${chart.ascendant.nakshatra.pada}</b></div>
          <div><small>Moon element</small><b>${moon.element} · ${moon.modality}</b></div>
        </div>
      </div>
    </div>

    <div class="ov-sec"><h5>Element balance <span>Mostly ${domEl}</span></h5>
      <div class="ov-elbar">${elBar}</div><div class="ov-ellegend">${elLeg}</div>
    </div>

    <div class="ov-sec"><h5>Chara Karakas <span>Jaimini soul significators · ranked by degree</span></h5>
      <div class="ov-kscroll">${karakas}</div>
    </div>

    <details class="ov-tech"><summary>Calculation details</summary>
      <div class="ov-techgrid"><div><small>Ayanamsa</small><b>Lahiri ${chart.ayanamsa.toFixed(4)}°</b></div><div><small>House system</small><b>Whole Sign</b></div>
      <div><small>Coordinates</small><b>${profile.lat.toFixed(2)}°, ${profile.lon.toFixed(2)}°</b></div><div><small>Julian Day (UT)</small><b>${chart.julianDay.toFixed(4)}</b></div></div>
    </details>
  </div>`;
}
document.addEventListener('click',(e)=>{
  const b = e.target.closest('[data-ov-style]'); if(!b || !currentChartForModal) return;
  ovStyle = b.dataset.ovStyle;
  document.querySelectorAll('[data-ov-style]').forEach(x=>x.classList.toggle('on', x===b));
  document.getElementById('ovChartSvg').innerHTML = ovChartSvg(currentChartForModal);
});

function renderResults(profile){
  window.__vgProf = profile;
  const chart = computeChart(profile.dob, profile.tob, profile.lat, profile.lon, profile.tz);
  currentChartForModal = chart;
  currentProfileForExport = profile;
  const results = document.getElementById('results');

  const ascSign = SIGNS[chart.ascendant.sign];
  const moonSign = SIGNS[chart.planets.Moon.sign];
  const sunSign = SIGNS[chart.planets.Sun.sign];
  const moonNak = chart.planets.Moon.nakshatra;

  let html = "";

  html += `<div class="app-panel active" id="panel-overview">`;
  html += buildOverviewPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-dasha">`;
  html += buildDashaSection(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-yogas">`;
  html += buildYogaSection(chart);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-transit">`;
  html += `
  <div class="section-heading"><h3>Gochara — Live Transit Comparison</h3><div class="rule"></div></div>
  <div class="transit-live-card" id="transitLiveCard">
    <div class="transit-live-intro">
      Compare real-time planetary positions against this natal chart. Enter where you are right now (it doesn't need to match the birth place) to see which natal house each transiting planet currently occupies.
    </div>
    <form id="transitLocationForm" class="transit-location-form">
      <div class="field location-wrap" style="flex:1;">
        <label for="transitPlaceInput">Current Location</label>
        <input type="text" id="transitPlaceInput" placeholder="Start typing a city…" autocomplete="off">
        <div class="location-results" id="transitLocationResults"></div>
      </div>
      <div class="field" style="max-width:200px;">
        <label for="transitTzInput">Timezone (UTC)</label>
        <select id="transitTzInput"></select>
      </div>
      <button type="submit" class="btn btn-primary" style="align-self:flex-end;">Check Live Transits</button>
    </form>
    <div id="transitLiveResults"></div>
  </div>`;
  html += `</div>`;

  html += `<div class="app-panel" id="panel-rectification">`;
  html += `
  <div class="section-heading"><h3>Birth Time Rectification</h3><div class="rule"></div><span class="section-sub">Dial in any time and calculate the complete chart</span></div>
  <div class="rect-panel-card">
    <p class="rect-intro">
      Dial the exact date and time with the Hour · Minute · Second controls below, then hit
      <strong>Calculate Full Chart</strong> to recompute the <strong>entire chart</strong> — every
      tab (Overview, Dasha, Yogas, Ashtakavarga, Shadbala, Planets, Divisions D1–D60, Lagnas) —
      exactly like generating a fresh chart, for that exact instant. You'll be taken straight to
      Overview to see it. Nothing is saved to your stored profile unless you choose to apply it —
      come back to Rectify any time to dial a different second and recalculate again.
    </p>

    <div class="rect-time-dial-card">
      <div class="rect-field" style="max-width:220px; margin-bottom:16px;">
        <label for="rectDate">Date</label>
        <input type="date" id="rectDate" value="${profile.dob}">
      </div>
      <div class="hms-stepper-row" id="rectHmsRow">
        <div class="hms-unit">
          <div class="hms-unit-controls">
            <button type="button" class="hms-btn" data-unit="h" data-dir="-1">◀</button>
            <div class="hms-value" id="rectHmsH">00</div>
            <button type="button" class="hms-btn" data-unit="h" data-dir="1">▶</button>
          </div>
          <span class="hms-unit-label">Hour</span>
        </div>
        <div class="hms-sep">:</div>
        <div class="hms-unit">
          <div class="hms-unit-controls">
            <button type="button" class="hms-btn" data-unit="m" data-dir="-1">◀</button>
            <div class="hms-value" id="rectHmsM">00</div>
            <button type="button" class="hms-btn" data-unit="m" data-dir="1">▶</button>
          </div>
          <span class="hms-unit-label">Minute</span>
        </div>
        <div class="hms-sep">:</div>
        <div class="hms-unit">
          <div class="hms-unit-controls">
            <button type="button" class="hms-btn" data-unit="s" data-dir="-1">◀</button>
            <div class="hms-value" id="rectHmsS">00</div>
            <button type="button" class="hms-btn" data-unit="s" data-dir="1">▶</button>
          </div>
          <span class="hms-unit-label">Second</span>
        </div>
      </div>
      <div class="hms-hint">Tap to step by one · press and hold to fly through faster</div>
      <input type="hidden" id="rectCenterTime" value="${profile.tob && profile.tob.length===5 ? profile.tob+':00' : profile.tob}">
    </div>

    <div class="rect-action-row">
      <button type="button" class="btn btn-primary rect-fullcalc-btn" id="rectFullCalcBtn">🔬 Calculate Full Chart at This Exact Time</button>
    </div>
    <div id="rectFullChartResults"></div>

    <div class="section-heading" style="margin-top:36px;"><h3 style="font-size:19px;">Second-by-Second Ascendant Scan</h3><div class="rule"></div><span class="section-sub">Narrow down a window, watch D60 &amp; Nakshatra shift</span></div>
    <div class="rect-controls">
      <div class="rect-field">
        <label for="rectWindow">Scan Window (± minutes, centered on the dial above)</label>
        <select id="rectWindow">
          <option value="1">1 min</option>
          <option value="2" selected>2 min</option>
          <option value="5">5 min</option>
          <option value="10">10 min</option>
          <option value="20">20 min</option>
          <option value="30">30 min</option>
        </select>
      </div>
      <div class="rect-field">
        <label for="rectStep">Step Precision</label>
        <select id="rectStep">
          <option value="1" selected>1 second</option>
          <option value="2">2 seconds</option>
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="30">30 seconds</option>
        </select>
      </div>
      <button type="button" class="btn btn-ghost rect-scan-btn" id="rectScanBtn">🎯 Run Second-by-Second Scan</button>
    </div>

    <div id="rectResultsWrap"></div>
    <div class="rect-detail" id="rectDetail"></div>
  </div>`;
  html += `</div>`;

  html += `<div class="app-panel" id="panel-transittimer">`;
  html += `
  <div class="section-heading"><h3>Transit Timer</h3><div class="rule"></div><span class="section-sub">When any planet — or the Ascendant — changes house in any D-chart</span></div>
  <div class="tt-panel-card">
    <p class="tt-intro">
      Pick a body and a divisional chart (D1–D60). This finds, using the body's real evaluated
      motion (not a flat average), exactly <strong>when it entered</strong> its current division,
      <strong>when it will move</strong> into the next one, and the live countdown between now
      and then. Retrograde bodies are handled correctly — the countdown reflects them moving
      backward into the previous division, not forward.
    </p>

    <div class="tt-controls">
      <div class="tt-field">
        <label for="ttBody">Body</label>
        <select id="ttBody">
          <option value="Ascendant">🌅 Ascendant (Lagna)</option>
          <option value="Sun">☉ Sun</option>
          <option value="Moon">☽ Moon</option>
          <option value="Mars">♂ Mars</option>
          <option value="Mercury">☿ Mercury</option>
          <option value="Jupiter">♃ Jupiter</option>
          <option value="Venus">♀ Venus</option>
          <option value="Saturn">♄ Saturn</option>
          <option value="Rahu">☊ Rahu</option>
          <option value="Ketu">☋ Ketu</option>
        </select>
      </div>
      <div class="tt-field">
        <label for="ttVarga">Divisional Chart</label>
        <select id="ttVarga"></select>
      </div>
      <button type="button" class="btn btn-primary tt-check-btn" id="ttCheckBtn">⏳ Check Transit Timing</button>
    </div>

    <div id="ttResults"></div>
  </div>`;
  html += `</div>`;

  html += `<div class="app-panel" id="panel-sandhi">`;
  html += `
  <div class="section-heading"><h3>Sandhi Table</h3><div class="rule"></div><span class="section-sub">The Ascendant's D1 window, sliced across every varga</span></div>
  <div class="tt-panel-card">
    <p class="tt-intro">
      The D1 Ascendant sign holds for roughly <strong>2 hours</strong> — its real entry and exit
      moment, computed precisely for the loaded profile's birth location. That same window is what
      every divisional chart slices up: D9 into 9 pieces (~13 min each), D60 into 60 (~2 min each),
      and so on. For each chart below: when the <strong>previous</strong> division started, when the
      <strong>current</strong> one started, when the <strong>next</strong> one begins, and time left.
      This is the classic rectification "sandhi" technique — match a known life event to the exact
      slice that was live at that moment.
    </p>
    <div class="rect-action-row">
      <button type="button" class="btn btn-primary rect-fullcalc-btn" id="sandhiCalcBtn">⏱ Calculate Sandhi Table Now</button>
    </div>
    <div id="sandhiResults"></div>
  </div>`;
  html += `</div>`;

  html += `<div class="app-panel" id="panel-vargatimeline">`;
  html += `
  <div class="section-heading"><h3>Varga Timeline</h3><div class="rule"></div><span class="section-sub">Map the birth's D1 Ascendant window across any chart</span></div>
  <div class="tt-panel-card">
    <p class="tt-intro">
      Anchored to the <strong>birth time</strong> from the loaded profile — not live "now". First
      finds exactly when the birth's D1 Ascendant sign started and ended (e.g. Leo rising from
      1:00 to 3:00). Pick a divisional chart and it maps out <strong>every single division</strong>
      inside that entire window in order — for D9, all 9 slices from D1-start to D1-end, each with
      its own start time, end time, and resulting sign — and marks exactly which slice the birth
      moment itself falls into.
    </p>
    <div id="vtBirthInfo"></div>
    <div class="tt-controls" style="margin-top:20px;">
      <div class="tt-field">
        <label for="vtVarga">Divisional Chart</label>
        <select id="vtVarga"></select>
      </div>
      <div class="tt-field"></div>
      <button type="button" class="btn btn-primary tt-check-btn" id="vtMapBtn">🗺️ Map Out Timeline</button>
    </div>
    <div id="vtResults"></div>
  </div>`;
  html += `</div>`;


  html += `<div class="app-panel" id="panel-planets">`;
  html += buildPlanetsPanel(chart);

  if (chart.wars.length){
    html += `<div class="war-note">⚔ Planetary War (Graha Yuddha) detected: ${chart.wars.map(w=>`${w.planetA} vs ${w.planetB} (${w.separation.toFixed(2)}° apart, ${w.winner} wins)`).join('; ')}. Winner determination uses the simplified longitude-based rule; classical texts also weigh ecliptic latitude.</div>`;
  }
  html += `</div>`;

  html += `<div class="app-panel" id="panel-reading">${window.buildReadingPanel(chart)}</div>`;
  html += `<div class="app-panel" id="panel-fate">${window.buildFatePanel(chart, profile)}</div>`;
  html += `<div class="app-panel" id="panel-sahams">${window.buildSahamPanel(chart)}</div>`;
  html += `<div class="app-panel" id="panel-tithi">${window.buildTithiPraveshPanel(chart, profile)}</div>`;
  html += `<div class="app-panel" id="panel-bhavabala">${window.buildBhavaBalaPanel(chart, profile)}</div>`;
  html += `<div class="app-panel" id="panel-active">${window.buildActivationPanel(chart)}</div>`;
  html += `<div class="app-panel" id="panel-ashtakavarga">`;
  html += buildAshtakavargaSection(chart);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-shadbala">`;
  html += buildShadbalaSection(chart);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-relationships">`;
  html += buildRelationshipsSection(chart);
  html += `</div>`;

  const activeDashaNow = findActiveDasha(chart.dashaData.mahadashas, new Date());
  const currentDashaLabel = activeDashaNow
    ? `${activeDashaNow.mahadasha.lord} / ${activeDashaNow.antardasha ? activeDashaNow.antardasha.lord : '—'}`
    : 'Active';

  html += `<div class="app-panel" id="panel-match">`;
  html += buildMatchPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-vbday">`;
  html += buildVedicBirthdayPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-numerology">`;
  html += buildNumerologyPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-bhava">`;
  html += buildBhavaPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-panchanga">`;
  html += buildPanchangaPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-transits">`;
  html += buildTransitsPanel(chart, profile);
  html += `</div>`;

  html += `<div class="app-panel" id="panel-vargas">`;
  html += `
  <div class="section-heading"><h3>Shodasa Varga — Divisional Charts (D1–D60)</h3><div class="rule"></div><span class="section-sub">Interactive chart viewer</span></div>
  
  <div class="varga-toolbar">
    <div class="varga-control-group">
      <span class="varga-control-label">Select Chart:</span>
      <select id="vargaSelect" class="varga-select">`;
  Object.keys(VARGAS).forEach(key => {
    const meta = VARGAS[key];
    html += `<option value="${key}">${key} — ${meta.name} (${meta.full})</option>`;
  });
  html += `  </select>
    </div>

    <div class="varga-control-group">
      <span class="varga-control-label">Outer planets:</span>
      <label class="outer-chk"><input type="checkbox" class="outer-chk-input" ${window.__showOuter!==false?'checked':''}> <span>♅ Uranus · ♆ Neptune · ♇ Pluto</span></label>
    </div>

    <div class="varga-control-group">
      <span class="varga-control-label">Chart Style:</span>
      <div class="varga-style-toggle" id="vargaStyleToggle">
        <button type="button" class="varga-style-btn active" data-style="north"><span>◇</span> North Indian</button>
        <button type="button" class="varga-style-btn" data-style="west"><span>◯</span> Western Wheel</button>
        <button type="button" class="varga-style-btn" data-style="south"><span>▦</span> South Indian</button>
      </div>
    </div>

    <div class="varga-control-group">
      <label class="varga-aspect-toggle-label" for="vargaAspectToggle">
        <input type="checkbox" id="vargaAspectToggle" class="varga-aspect-checkbox">
        <span class="varga-aspect-toggle-track"><span class="varga-aspect-toggle-thumb"></span></span>
        <span class="varga-control-label" style="text-transform:none; font-weight:600;">✦ Show Planetary Aspects (Drishti)</span>
      </label>
    </div>

    <div class="varga-quick-chips">
      <span style="font-size:11px; text-transform:uppercase; color:var(--text-subtle); align-self:center; margin-right:4px;">Quick Jump:</span>`;
  ["D1","D9","D10","D2","D3","D7","D12","D60"].forEach(key => {
    html += `<button type="button" class="varga-chip ${key==='D1'?'active':''}" data-varga-quick="${key}">${key}</button>`;
  });
  html += `</div>
  </div>

  <div class="varga-single-display" id="vargaDisplayContainer">
    <!-- Populated by updateVargaDisplay() -->
  </div>`;
  html += `</div>`; 

  html += `<div class="app-panel" id="panel-lagnas">`;
  html += `
  <div class="section-heading lagna-section-heading">
    <div>
      <h3>Special Lagnas — Alternate Ascendants</h3><div class="rule"></div><span class="section-sub">23 classical lagna points, viewable as full divisional charts</span>
    </div>
    <button type="button" class="chart-dl-btn-single aspect-copy-btn" id="copyAllLagnasBtn"><span>📋</span> Copy All Lagnas</button>
  </div>

  <div class="varga-toolbar">
    <div class="varga-control-group">
      <span class="varga-control-label">Select Lagna:</span>
      <select id="lagnaSelect" class="varga-select">`;
  const lagnaGroupLabels = { core: "Core Ascendants", arudha: "Arudha Padas", karaka: "Karaka-Based", kala: "Time-Based (Kala)" };
  ["core","arudha","karaka","kala"].forEach(group => {
    html += `<optgroup label="${lagnaGroupLabels[group]}">`;
    SPECIAL_LAGNAS_ORDER.filter(k => SPECIAL_LAGNAS_META[k].group === group).forEach(k => {
      const m = SPECIAL_LAGNAS_META[k];
      html += `<option value="${k}">${m.name} (${m.sanskrit})</option>`;
    });
    html += `</optgroup>`;
  });
  html += `  </select>
    </div>

    <div class="varga-control-group">
      <span class="varga-control-label">Divisional Chart:</span>
      <select id="lagnaVargaSelect" class="varga-select">`;
  Object.keys(VARGAS).forEach(key => {
    const meta = VARGAS[key];
    html += `<option value="${key}">${key} — ${meta.name} (${meta.full})</option>`;
  });
  html += `  </select>
    </div>

    <div class="varga-control-group">
      <span class="varga-control-label">Outer planets:</span>
      <label class="outer-chk"><input type="checkbox" class="outer-chk-input" ${window.__showOuter!==false?'checked':''}> <span>♅ Uranus · ♆ Neptune · ♇ Pluto</span></label>
    </div>

    <div class="varga-control-group">
      <span class="varga-control-label">Chart Style:</span>
      <div class="varga-style-toggle" id="lagnaStyleToggle">
        <button type="button" class="varga-style-btn active" data-style="north"><span>◇</span> North Indian</button>
        <button type="button" class="varga-style-btn" data-style="west"><span>◯</span> Western Wheel</button>
        <button type="button" class="varga-style-btn" data-style="south"><span>▦</span> South Indian</button>
      </div>
    </div>

    <div class="varga-control-group">
      <label class="varga-aspect-toggle-label" for="lagnaAspectToggle">
        <input type="checkbox" id="lagnaAspectToggle" class="varga-aspect-checkbox">
        <span class="varga-aspect-toggle-track"><span class="varga-aspect-toggle-thumb"></span></span>
        <span class="varga-control-label" style="text-transform:none; font-weight:600;">✦ Show Planetary Aspects (Drishti)</span>
      </label>
    </div>

    <div class="varga-quick-chips">
      <span style="font-size:11px; text-transform:uppercase; color:var(--text-subtle); align-self:center; margin-right:4px;">Quick Jump:</span>`;
  ["UL_LAGNA","AL","KL","UL","HL","GL","BL","BB","INDU","SL","PAKA"].forEach(key => {
    html += `<button type="button" class="varga-chip ${key==='UL_LAGNA'?'active':''}" data-lagna-quick="${key}">${SPECIAL_LAGNAS_META[key].sanskrit.split(' ')[0].split('/')[0]}</button>`;
  });
  html += `</div>
  </div>

  <div class="lagna-summary-strip" id="lagnaSummaryStrip"></div>

  <div class="varga-single-display" id="lagnaDisplayContainer">
    <!-- Populated by updateLagnaDisplay() -->
  </div>`;
  html += `</div>`;

  results.innerHTML = html;
  results.classList.add('show');
  document.getElementById('appTabbar').classList.add('show');
  document.body.classList.add('app-mode');
  buildHomePanel(typeof profile!=='undefined' && profile ? profile.name : '');
  switchAppTab('panel-home');
  wireRectificationPanel();
  wireTransitTimerPanel();
  wireSandhiPanel();
  wireVargaTimelinePanel();
  try{ initRectStudio(); }catch(e){ console.error('Rect Studio', e); }

  let currentSelectedVarga = 'D1';
  let currentChartStyle = 'north';
  let showAspects = false;

  function updateVargaDisplay() {
    const key = currentSelectedVarga;
    const meta = VARGAS[key];
    const vdata = chart.vargas[key];
    const ascVSign = SIGNS[vdata.ascendantSign];
    const aspectRows = showAspects ? computeVargaAspects(chart, vdata) : null;

    let singleHtml = `<div class="varga-card">
      <div class="varga-card-head">
        <div>
          <div class="varga-card-title">
            <span class="varga-code">${key}</span>
            <span class="varga-name">${meta.name}</span>
          </div>
          <div class="varga-sanskrit">${meta.full}</div>
          <div class="varga-desc">${meta.desc}</div>
        </div>
        <div class="varga-asc-tag">Lagna (Ascendant)<br><strong>${ascVSign.symbol} ${ascVSign.name} (${ascVSign.sk})</strong></div>
      </div>
      <div class="varga-body-full">
        <div class="varga-chart-container">
          <div id="vargaSvgWrapper" style="width:100%; display:flex; justify-content:center;">
            ${buildInteractiveVargaSvg(vdata, meta, currentChartStyle, aspectRows)}
          </div>
          <div style="font-size:11px; color:var(--gold-dim); margin-top:10px; font-family:var(--font-display); letter-spacing:0.05em; text-align:center;">
            ${currentChartStyle === 'north' ? 'North Indian Diamond Chart (Fixed Houses)' : currentChartStyle === 'west' ? 'Western Wheel Chart (360° Circular)' : 'South Indian Square Chart (Fixed Signs)'}${showAspects ? ' · Aspect Lines Shown' : ''}
          </div>
          <div class="chart-download-actions">
            <button type="button" class="chart-dl-btn-single" id="downloadChartBtn" title="Download High-Resolution Chart Image">
              <span>📥</span> Download Chart
            </button>
          </div>
        </div>
        <div class="varga-house-table-wrap">
          <table class="varga-house-table">
            <thead><tr><th>House</th><th>Sign</th><th>Lord</th><th>Occupants</th></tr></thead>
            <tbody>`;
    vdata.houses.forEach(h => {
      const occupantsHtml = h.isEmpty
        ? `<span class="house-empty-tag">Empty</span>`
        : h.planets.map(p => {
            const digClass = p.dignity.status==="Exalted"||p.dignity.status==="OwnSign"||p.dignity.status==="Moolatrikona" ? "dig-good" : p.dignity.status==="Debilitated" ? "dig-bad" : "";
            return `<span class="occupant-chip"><span class="planet-glyph">${PLANET_GLYPHS[p.name]}</span>${p.name}${p.retrograde?'<sup class="retro-tag-sm">R</sup>':''}${key==="D1"?` <span class="${digClass} tiny">${p.dignity.status!=="Neutral"&&p.dignity.status!=="Friend"&&p.dignity.status!=="Enemy"?p.dignity.status:''}</span>`:''}</span>`;
          }).join(' ');
      singleHtml += `<tr class="${h.isEmpty?'house-row-empty':''}">
        <td class="house-num-cell">H${h.houseNum}</td>
        <td>${h.signSymbol} ${h.signName} <span class="sign-sk">(${h.signSanskrit})</span></td>
        <td>${h.signLord}</td>
        <td>${occupantsHtml}</td>
      </tr>`;
    });
    singleHtml += `</tbody></table></div>
      </div>
      <div class="varga-footer">
        <span>Harmonic Division: <strong>1/${meta.n} (${meta.n} parts)</strong></span>
        <span><strong>${vdata.houses.filter(h=>!h.isEmpty).length}</strong> of 12 houses occupied</span>
      </div>
      ${aspectRows ? buildAspectsTableHtml(aspectRows, 'varga') : ''}
    </div>`;

    document.getElementById('vargaDisplayContainer').innerHTML = singleHtml;

    // Attach Single Chart Download Listener
    const dlBtn = document.getElementById('downloadChartBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        downloadActiveChartImage('png', key, currentChartStyle, profile.name);
      });
    }

    // Attach Aspect Table Copy Listener
    const copyBtn = document.getElementById('vargaCopyAspectTableBtn');
    if (copyBtn && aspectRows) {
      copyBtn.addEventListener('click', () => {
        copyTextToClipboard(aspectRowsToPlainText(aspectRows, key), copyBtn, '<span>📋</span> Copy Table');
      });
    }
  }

  // Initial render of selected chart
  updateVargaDisplay();

  const vargaAspectToggleEl = document.getElementById('vargaAspectToggle');
  if (vargaAspectToggleEl) {
    vargaAspectToggleEl.checked = showAspects;
    vargaAspectToggleEl.addEventListener('change', (e) => {
      showAspects = e.target.checked;
      updateVargaDisplay();
    });
  }

  const vargaSelEl = document.getElementById('vargaSelect');
  if (vargaSelEl) {
    vargaSelEl.addEventListener('change', (e) => {
      currentSelectedVarga = e.target.value;
      document.querySelectorAll('#panel-vargas .varga-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.vargaQuick === currentSelectedVarga);
      });
      updateVargaDisplay();
    });
  }

  document.querySelectorAll('#panel-vargas .varga-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentSelectedVarga = chip.dataset.vargaQuick;
      if (vargaSelEl) vargaSelEl.value = currentSelectedVarga;
      document.querySelectorAll('#panel-vargas .varga-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateVargaDisplay();
    });
  });

  document.querySelectorAll('#vargaStyleToggle .varga-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentChartStyle = btn.dataset.style;
      document.querySelectorAll('#vargaStyleToggle .varga-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateVargaDisplay();
    });
  });

  /* ============================================================================
     SPECIAL LAGNAS TAB LOGIC
     ============================================================================ */
  const specialLagnaSigns = computeAllSpecialLagnaSigns(chart);
  let currentSelectedLagna = 'UL_LAGNA';
  let currentLagnaVarga = 'D1';
  let currentLagnaStyle = 'north';
  let showLagnaAspects = false;

  function buildLagnaSummaryHtml(lagnaKey){
    const meta = SPECIAL_LAGNAS_META[lagnaKey];
    const signIdx = specialLagnaSigns[lagnaKey];
    const sign = SIGNS[signIdx];
    return `<div class="lagna-summary-card">
      <div class="lagna-summary-head">
        <div class="lagna-summary-title">${meta.name} <span class="lagna-summary-sk">(${meta.sanskrit})</span></div>
        <div class="lagna-summary-sign">${sign.symbol} ${sign.name} <span class="sign-sk">(${sign.sk})</span></div>
      </div>
      <div class="lagna-summary-desc">${meta.desc}</div>
    </div>`;
  }

  function updateLagnaDisplay(){
    const lagnaKey = currentSelectedLagna;
    const vargaKey = currentLagnaVarga;
    const meta = VARGAS[vargaKey];
    const lagnaMeta = SPECIAL_LAGNAS_META[lagnaKey];
    const lagnaSignIdx = specialLagnaSigns[lagnaKey];
    const vdata = buildVargaFromLagna(chart, lagnaSignIdx, vargaKey);
    const ascVSign = SIGNS[vdata.ascendantSign];
    const aspectRows = showLagnaAspects ? computeVargaAspects(chart, vdata) : null;

    document.getElementById('lagnaSummaryStrip').innerHTML = buildLagnaSummaryHtml(lagnaKey);

    let singleHtml = `<div class="varga-card">
      <div class="varga-card-head">
        <div>
          <div class="varga-card-title">
            <span class="varga-code">${vargaKey}</span>
            <span class="varga-name">${meta.name}</span>
          </div>
          <div class="varga-sanskrit">${meta.full} — cast from ${lagnaMeta.name}</div>
          <div class="varga-desc">${meta.desc}</div>
        </div>
        <div class="varga-asc-tag">${lagnaMeta.name}<br><strong>${ascVSign.symbol} ${ascVSign.name} (${ascVSign.sk})</strong></div>
      </div>
      <div class="varga-body-full">
        <div class="varga-chart-container">
          <div id="lagnaSvgWrapper" style="width:100%; display:flex; justify-content:center;">
            ${buildInteractiveVargaSvg(vdata, meta, currentLagnaStyle, aspectRows)}
          </div>
          <div style="font-size:11px; color:var(--gold-dim); margin-top:10px; font-family:var(--font-display); letter-spacing:0.05em; text-align:center;">
            ${currentLagnaStyle === 'north' ? 'North Indian Diamond Chart (Fixed Houses)' : currentLagnaStyle === 'west' ? 'Western Wheel Chart (360° Circular)' : 'South Indian Square Chart (Fixed Signs)'}${showLagnaAspects ? ' · Aspect Lines Shown' : ''}
          </div>
          <div class="chart-download-actions">
            <button type="button" class="chart-dl-btn-single" id="downloadLagnaChartBtn" title="Download High-Resolution Chart Image">
              <span>📥</span> Download Chart
            </button>
            <button type="button" class="chart-dl-btn-single chart-dl-btn-secondary" id="copyLagnaChartBtn" title="Copy this lagna's chart data as text">
              <span>📋</span> Copy Current Chart
            </button>
          </div>
        </div>
        <div class="varga-house-table-wrap">
          <table class="varga-house-table">
            <thead><tr><th>House</th><th>Sign</th><th>Lord</th><th>Occupants</th></tr></thead>
            <tbody>`;
    vdata.houses.forEach(h => {
      const occupantsHtml = h.isEmpty
        ? `<span class="house-empty-tag">Empty</span>`
        : h.planets.map(p => {
            const digClass = p.dignity.status==="Exalted"||p.dignity.status==="OwnSign"||p.dignity.status==="Moolatrikona" ? "dig-good" : p.dignity.status==="Debilitated" ? "dig-bad" : "";
            return `<span class="occupant-chip"><span class="planet-glyph">${PLANET_GLYPHS[p.name]}</span>${p.name}${p.retrograde?'<sup class="retro-tag-sm">R</sup>':''}${vargaKey==="D1"?` <span class="${digClass} tiny">${p.dignity.status!=="Neutral"&&p.dignity.status!=="Friend"&&p.dignity.status!=="Enemy"?p.dignity.status:''}</span>`:''}</span>`;
          }).join(' ');
      singleHtml += `<tr class="${h.isEmpty?'house-row-empty':''}">
        <td class="house-num-cell">H${h.houseNum}</td>
        <td>${h.signSymbol} ${h.signName} <span class="sign-sk">(${h.signSanskrit})</span></td>
        <td>${h.signLord}</td>
        <td>${occupantsHtml}</td>
      </tr>`;
    });
    singleHtml += `</tbody></table></div>
      </div>
      <div class="varga-footer">
        <span>Harmonic Division: <strong>1/${meta.n} (${meta.n} parts)</strong></span>
        <span><strong>${vdata.houses.filter(h=>!h.isEmpty).length}</strong> of 12 houses occupied</span>
      </div>
      ${aspectRows ? buildAspectsTableHtml(aspectRows, 'lagna') : ''}
    </div>`;

    document.getElementById('lagnaDisplayContainer').innerHTML = singleHtml;

    const dlBtn = document.getElementById('downloadLagnaChartBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        downloadActiveChartImageFromWrapper('lagnaSvgWrapper', 'png', `${lagnaKey}_${vargaKey}`, currentLagnaStyle, profile.name);
      });
    }

    const copyChartBtn = document.getElementById('copyLagnaChartBtn');
    if (copyChartBtn) {
      copyChartBtn.addEventListener('click', () => {
        const text = lagnaChartToPlainText(chart, lagnaKey, vargaKey, vdata, aspectRows);
        copyTextToClipboard(text, copyChartBtn, '<span>📋</span> Copy Current Chart');
      });
    }

    const copyBtn = document.getElementById('lagnaCopyAspectTableBtn');
    if (copyBtn && aspectRows) {
      copyBtn.addEventListener('click', () => {
        copyTextToClipboard(aspectRowsToPlainText(aspectRows, `${lagnaKey} · ${vargaKey}`), copyBtn, '<span>📋</span> Copy Table');
      });
    }
  }

  updateLagnaDisplay();

  const copyAllLagnasBtn = document.getElementById('copyAllLagnasBtn');
  if (copyAllLagnasBtn) {
    copyAllLagnasBtn.addEventListener('click', () => {
      const text = allLagnasToPlainText(chart, specialLagnaSigns, currentLagnaVarga);
      copyTextToClipboard(text, copyAllLagnasBtn, '<span>📋</span> Copy All Lagnas');
    });
  }

  const lagnaSelEl = document.getElementById('lagnaSelect');
  if (lagnaSelEl) {
    lagnaSelEl.addEventListener('change', (e) => {
      currentSelectedLagna = e.target.value;
      document.querySelectorAll('#panel-lagnas .varga-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.lagnaQuick === currentSelectedLagna);
      });
      updateLagnaDisplay();
    });
  }

  const lagnaVargaSelEl = document.getElementById('lagnaVargaSelect');
  if (lagnaVargaSelEl) {
    lagnaVargaSelEl.addEventListener('change', (e) => {
      currentLagnaVarga = e.target.value;
      updateLagnaDisplay();
    });
  }

  document.querySelectorAll('#panel-lagnas .varga-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentSelectedLagna = chip.dataset.lagnaQuick;
      if (lagnaSelEl) lagnaSelEl.value = currentSelectedLagna;
      document.querySelectorAll('#panel-lagnas .varga-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateLagnaDisplay();
    });
  });

  document.querySelectorAll('#lagnaStyleToggle .varga-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLagnaStyle = btn.dataset.style;
      document.querySelectorAll('#lagnaStyleToggle .varga-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateLagnaDisplay();
    });
  });

  const lagnaAspectToggleEl = document.getElementById('lagnaAspectToggle');
  if (lagnaAspectToggleEl) {
    lagnaAspectToggleEl.checked = showLagnaAspects;
    lagnaAspectToggleEl.addEventListener('change', (e) => {
      showLagnaAspects = e.target.checked;
      updateLagnaDisplay();
    });
  }

  setupTransitLiveForm(chart, profile);

  document.querySelectorAll('.dasha-antardasha-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const row = document.getElementById('dasha-ad-'+btn.dataset.dashaIdx);
      const isOpen = row.style.display !== 'none';
      row.style.display = isOpen ? 'none' : '';
      btn.textContent = isOpen ? 'Sub-periods' : 'Hide sub-periods';
    });
  });

  if (!window.__dashaDrillListenerAttached){
    window.__dashaDrillListenerAttached = true;
    document.addEventListener('click', (e)=>{
      const chip = e.target.closest('.dasha-drill-chip');
      if (!chip) return;
      expandDashaLevel(chip.dataset.drillKey, chip.dataset.drillLevel);
    });
  }

  document.querySelectorAll('.dasha-segment').forEach((seg, idx)=>{
    seg.addEventListener('click', ()=>{
      const row = document.getElementById('dasha-ad-'+idx);
      if (!row) return;
      row.style.display = '';
      const toggleBtn = document.querySelector(`.dasha-antardasha-toggle[data-dasha-idx="${idx}"]`);
      if (toggleBtn) toggleBtn.textContent = 'Hide sub-periods';
      row.scrollIntoView({behavior:'smooth', block:'center'});
    });
  });

  document.querySelectorAll('.ashtaka-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.ashtaka-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.ashtaka-panel').forEach(p=> p.style.display='none');
      tab.classList.add('active');
      document.getElementById('av-panel-'+tab.dataset.avTarget).style.display = '';
    });
  });

  window.scrollTo({top: 0, behavior: 'instant'});
}

function setupTransitLiveForm(natalChart, profile){
  populateTzSelect(document.getElementById('transitTzInput'));
  const browserTzOffset = -new Date().getTimezoneOffset()/60;
  const tzSel = document.getElementById('transitTzInput');
  let closest = TZ_OPTIONS.reduce((a,b)=> Math.abs(b-browserTzOffset)<Math.abs(a-browserTzOffset)?b:a);
  [...tzSel.options].forEach(o=>{ if (parseFloat(o.value)===closest) o.selected = true; });

  let transitLat=null, transitLon=null;
  const transitPlaceInput = document.getElementById('transitPlaceInput');
  const transitLocationResults = document.getElementById('transitLocationResults');
  let transitDebounce = null;
  try{ if (window.parent && window.parent!==window && window.parent.LocPicker) window.parent.LocPicker.attach(document, transitPlaceInput, r=>{
    transitPlaceInput.value = r.display_name; transitLat = parseFloat(r.lat); transitLon = parseFloat(r.lon);
    transitLocationResults.classList.remove('open'); setTzSelect(tzSel, estimateTz(transitLat, transitLon, r));
  }, {title:'Where are you now?', get:()=> transitLat!=null ? {lat:transitLat, lon:transitLon} : null}); }catch(e){}

  transitPlaceInput.addEventListener('input', ()=>{
    const q = transitPlaceInput.value.trim();
    transitLat=null; transitLon=null;
    clearTimeout(transitDebounce);
    if (q.length<3){ transitLocationResults.classList.remove('open'); return; }
    transitDebounce = setTimeout(async ()=>{
      try{
        const appEmail = "contact@yourdomain.com"; // Replace with your actual email
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}&email=${appEmail}`;
        const res = await fetch(url, { headers:{'Accept-Language':'en'} });
        const data = await res.json();
        transitLocationResults.innerHTML = "";
        data.forEach(r=>{
          const div = document.createElement('div');
          div.className = 'location-item';
          const main = r.display_name.split(',')[0];
          div.innerHTML = `<span class="lname">${main}</span><span class="lsub">${r.display_name}</span>`;
          div.addEventListener('click', ()=>{
            transitPlaceInput.value = r.display_name;
            transitLat = parseFloat(r.lat); transitLon = parseFloat(r.lon);
            transitLocationResults.classList.remove('open');
            setTzSelect(tzSel, estimateTz(transitLat, transitLon, r));
          });
          transitLocationResults.appendChild(div);
        });
        if (data.length) transitLocationResults.classList.add('open');
      }catch(e){ }
    }, 1000); // 1000ms delay to enforce 1 req/sec limit
  });
  if (!window.__transitDropdownListenerAttached){
    window.__transitDropdownListenerAttached = true;
    document.addEventListener('click', (e)=>{
      const el = document.getElementById('transitLocationResults');
      if (el && !e.target.closest('#transitLocationForm .location-wrap')) el.classList.remove('open');
    });
  }

  document.getElementById('transitLocationForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    if (transitLat===null || transitLon===null){
      alert("Please select your current location from the suggestions list.");
      return;
    }
    const tz = parseFloat(tzSel.value);
    renderLiveTransitComparison(natalChart, profile, transitLat, transitLon, tz);
  });
}

const HOUSE_THEMES = ["Self, body, personality","Wealth, family, speech","Courage, siblings, effort","Home, mother, comfort","Children, intellect, creativity","Health, service, obstacles","Partnership, marriage","Transformation, longevity","Fortune, dharma, father","Career, status, action","Gains, aspirations, community","Loss, expenditure, liberation"];

function computeLiveSky(lat, lon, natalAscSign){
  const now = new Date();
  const jd = toJulianDay(now.getUTCFullYear(), now.getUTCMonth()+1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0);
  const ayanamsa = lahiriAyanamsa(jd);

  const tropical = {
    Sun: sunLongitude(jd), Moon: moonLongitude(jd),
    Mercury: planetGeocentricLongitude("mercury",jd), Venus: planetGeocentricLongitude("venus",jd),
    Mars: planetGeocentricLongitude("mars",jd), Jupiter: planetGeocentricLongitude("jupiter",jd),
    Saturn: planetGeocentricLongitude("saturn",jd)
  };
  const rahuTropical = rahuLongitude(jd);
  const transitSidereal = {};
  for (const p in tropical) transitSidereal[p] = normDeg(tropical[p]-ayanamsa);
  transitSidereal.Rahu = normDeg(rahuTropical-ayanamsa);
  transitSidereal.Ketu = normDeg(transitSidereal.Rahu+180);
  const transitRetro = {
    Mercury:isRetrograde("mercury",jd), Venus:isRetrograde("venus",jd), Mars:isRetrograde("mars",jd),
    Jupiter:isRetrograde("jupiter",jd), Saturn:isRetrograde("saturn",jd),
    Sun:false, Moon:false, Rahu:true, Ketu:true
  };

  const planets = {};
  PLANET_LIST.forEach(name=>{
    const lonT = transitSidereal[name];
    const signIdx = getSignIndex(lonT);
    const degInSign = getDegInSign(lonT);
    const nak = getNakshatra(lonT);
    const speed = getPlanetSpeed(name, jd);
    let natalHouse = null;
    if (natalAscSign !== null && natalAscSign !== undefined){
      natalHouse = ((signIdx - natalAscSign + 12) % 12) + 1;
    }
    planets[name] = {
      name, sign: signIdx, degInSign, degRemainingInSign: 30-degInSign,
      nakshatra: nak, retrograde: transitRetro[name], speed,
      natalHouse, natalHouseTheme: natalHouse!==null ? HOUSE_THEMES[natalHouse-1] : null
    };
  });

  return { jd, ayanamsa, now, lat, lon, planets };
}

function renderLiveTransitComparison(natalChart, profile, lat, lon, tz){
  const natalAscSign = natalChart.ascendant.sign;
  const sky = computeLiveSky(lat, lon, natalAscSign);

  let html = `<div class="transit-live-meta">Sky as of <span class="mono">${sky.now.toUTCString()}</span> · Observed from your entered location (${lat.toFixed(2)}°, ${lon.toFixed(2)}°) · Local UTC offset ${fmtTz(tz)}</div>
  <div class="planet-table-wrap" style="margin-top:14px;">
    <table class="planet-table">
      <thead><tr><th>Planet</th><th>Transit Sign</th><th>Degree</th><th>Nakshatra</th><th>Speed</th><th>Falls in Natal House</th><th>Natal House Theme</th></tr></thead>
      <tbody>`;

  PLANET_LIST.forEach(name=>{
    const p = sky.planets[name];
    const sign = SIGNS[p.sign];
    html += `<tr>
      <td class="planet-name-cell"><span class="planet-glyph">${PLANET_GLYPHS[name]}</span>${name}${p.retrograde?'<span class="retro-tag">Retro</span>':''}</td>
      <td>${sign.symbol} ${sign.name}</td>
      <td class="mono">${formatDeg(p.degInSign)}</td>
      <td>${p.nakshatra.name} (Pada ${p.nakshatra.pada})</td>
      <td class="mono">${Math.abs(p.speed).toFixed(2)}°/day</td>
      <td><span class="dig-good">House ${p.natalHouse}</span></td>
      <td>${p.natalHouseTheme}</td>
    </tr>`;
  });
  html += `</tbody></table></div>
  <div class="transit-note">This compares today's real sky against the whole-sign houses of the natal chart above — a simplified but classically valid approach to gochara (transit) analysis. Retrograde status is reflected. Refresh the check periodically since positions shift daily (Moon) or over months/years (outer planets).</div>`;

  document.getElementById('transitLiveResults').innerHTML = html;
  window.lastLiveSkyResult = { sky, lat, lon, tz }; 
}

function populateTzSelect(sel){
  sel.innerHTML = "";
  TZ_OPTIONS.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = fmtTz(v);
    if (v===5.5) opt.selected = true;
    sel.appendChild(opt);
  });
}

function buildInteractiveVargaSvg(vdata, meta, style, aspectData){
  if (style === "north") {
    return buildNorthIndianSvg(vdata, aspectData);
  } else if (style === "west") {
    return buildWesternWheelSvg(vdata, aspectData);
  } else {
    return buildSouthIndianSvg(vdata, aspectData);
  }
}

/* ============================================================================
   PLANETARY ASPECTS (DRISHTI) FOR ANY DIVISIONAL CHART
   ============================================================================
   For a given varga chart, works out — for every planet — which house/sign it
   sits in, which planets/houses/signs it aspects (drishti), and contextual
   info (nakshatra, pada, degree) sourced from the real (D1) sidereal
   longitude, since nakshatra is always reckoned from the true longitude
   regardless of which divisional chart is being viewed.
*/
function computeVargaAspects(chart, vdata){
  const ascSign = vdata.ascendantSign;
  const houseOfSign = {}; // signIdx -> house number in this varga
  for (let h=1; h<=12; h++){
    houseOfSign[(ascSign + h - 1) % 12] = h;
  }

  // Build planet -> {sign, house} for this varga
  const placement = {};
  PLANET_LIST.forEach(name => {
    const sign = vdata.planetVargaSign[name];
    placement[name] = { sign, house: houseOfSign[sign] };
  });

  const results = [];
  PLANET_LIST.forEach(fromName => {
    const from = placement[fromName];
    const aspectedHouseNums = getAspectedHouses(fromName, from.house); // houses (1-12) this planet aspects
    const aspectedSignIdxs = aspectedHouseNums.map(h => (ascSign + h - 1) % 12);

    const aspectOffsetLabel = (houseNum) => {
      const diff = ((houseNum - from.house + 12) % 12) + 1; // 1..12, e.g. 7 = opposition
      if (diff === 7) return "7th aspect (opposition)";
      if (SPECIAL_ASPECTS[fromName] && SPECIAL_ASPECTS[fromName].includes(diff)) return `${diff}th aspect (special)`;
      return `${diff}th aspect`;
    };

    const targets = [];
    aspectedHouseNums.forEach(houseNum => {
      const signIdx = (ascSign + houseNum - 1) % 12;
      const sign = SIGNS[signIdx];
      const occupants = PLANET_LIST.filter(p => p !== fromName && placement[p].sign === signIdx);
      occupants.forEach(toName => {
        targets.push({
          toPlanet: toName,
          toHouse: houseNum,
          toSign: sign.name,
          toSignSanskrit: sign.sk,
          label: aspectOffsetLabel(houseNum)
        });
      });
      if (occupants.length === 0) {
        targets.push({
          toPlanet: null,
          toHouse: houseNum,
          toSign: sign.name,
          toSignSanskrit: sign.sk,
          label: aspectOffsetLabel(houseNum)
        });
      }
    });

    const realPlanet = chart.planets[fromName];
    const fromSign = SIGNS[from.sign];

    results.push({
      planet: fromName,
      glyph: PLANET_GLYPHS[fromName],
      fromHouse: from.house,
      fromSign: fromSign.name,
      fromSignSanskrit: fromSign.sk,
      nakshatra: realPlanet.nakshatra.name,
      nakshatraLord: realPlanet.nakshatra.lord,
      pada: realPlanet.nakshatra.pada,
      degree: formatDeg(realPlanet.degInSign),
      retrograde: realPlanet.retrograde,
      aspectedHouses: aspectedHouseNums,
      aspectedSigns: aspectedSignIdxs.map(i => SIGNS[i].name),
      targets
    });
  });

  return results;
}

function buildAspectsTableHtml(aspectRows, idPrefix){
  const prefix = idPrefix || 'varga';
  let rows = '';
  aspectRows.forEach(r => {
    const planetTargets = r.targets.filter(t => t.toPlanet);
    const targetHtml = planetTargets.length
      ? planetTargets.map(t => `<span class="occupant-chip aspect-target-chip"><span class="planet-glyph">${PLANET_GLYPHS[t.toPlanet]}</span>${t.toPlanet} <span class="tiny">(H${t.toHouse} ${t.toSign})</span></span>`).join(' ')
      : `<span class="house-empty-tag">No planets aspected</span>`;
    const housesHtml = r.aspectedHouses.map(h => `H${h}`).join(', ');

    rows += `<tr>
      <td class="planet-name-cell"><span class="planet-glyph">${r.glyph}</span>${r.planet}${r.retrograde ? '<sup class="retro-tag-sm">R</sup>' : ''}</td>
      <td>H${r.fromHouse} — ${r.fromSign} <span class="sign-sk">(${r.fromSignSanskrit})</span></td>
      <td>${r.nakshatra} <span class="sign-sk">(Pada ${r.pada})</span><br><span class="tiny">Lord: ${r.nakshatraLord} · ${r.degree}</span></td>
      <td class="mono">${housesHtml}</td>
      <td>${targetHtml}</td>
    </tr>`;
  });

  return `<div class="varga-aspect-table-wrap" id="${prefix}AspectTableWrap">
    <div class="aspect-table-head">
      <span class="section-sub" style="margin:0;">Full Aspects (Drishti) Table</span>
      <button type="button" class="chart-dl-btn-single aspect-copy-btn" id="${prefix}CopyAspectTableBtn"><span>📋</span> Copy Table</button>
    </div>
    <div class="aspect-table-scroll">
      <table class="varga-house-table aspect-table">
        <thead><tr><th>Planet</th><th>Position</th><th>Nakshatra</th><th>Aspects Houses</th><th>Aspects Planets</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function aspectRowsToPlainText(aspectRows, vargaKey){
  let out = `PLANETARY ASPECTS (DRISHTI) — ${vargaKey}\n`;
  out += '='.repeat(60) + '\n\n';
  aspectRows.forEach(r => {
    out += `${r.planet}${r.retrograde ? ' (R)' : ''} — House ${r.fromHouse}, ${r.fromSign} (${r.fromSignSanskrit})\n`;
    out += `  Nakshatra: ${r.nakshatra}, Pada ${r.pada}, Lord ${r.nakshatraLord}, ${r.degree}\n`;
    out += `  Aspects Houses: ${r.aspectedHouses.map(h=>'H'+h).join(', ')}\n`;
    const planetTargets = r.targets.filter(t => t.toPlanet);
    if (planetTargets.length){
      out += `  Aspects Planets:\n`;
      planetTargets.forEach(t => {
        out += `    -> ${t.toPlanet} in House ${t.toHouse} (${t.toSign}) — ${t.label}\n`;
      });
    } else {
      out += `  Aspects Planets: none\n`;
    }
    out += '\n';
  });
  return out;
}

// 1. NORTH INDIAN DIAMOND CHART (Kendra-centric diamond layout)
const PCOL={Uranus:'#7DE3E0',Neptune:'#5B7CFA',Pluto:'#C9A38A',Sun:'#F4A340',Moon:'#E6EBF5',Mars:'#E2625F',Mercury:'#6FCF97',Jupiter:'#F9D976',Venus:'#F4A9D3',Saturn:'#8EA2D6',Rahu:'#B393E0',Ketu:'#C4A484'};
const ELC={Fire:'#F26B4F',Earth:'#79B868',Air:'#E7C95A',Water:'#5BA7E0'};
const HTc=h=>[1,4,7,10].includes(h)?'#D4AF37':[5,9].includes(h)?'#5EC4B7':[6,8,12].includes(h)?'#E25555':'#8C93A8';
const HAl=h=>h===1?.26:[4,7,10].includes(h)?.13:[5,9].includes(h)?.11:[6,8,12].includes(h)?.10:.04;
const dRing=s=>/Exalt/i.test(s)?'#F9D976':/Own|Moola/i.test(s)?'#5EC4B7':/Debil/i.test(s)?'#E25555':/Enemy/i.test(s)?'#C26B45':/Friend/i.test(s)?'#7FC8A9':'#6B7390';
document.addEventListener('change',e=>{
  if(!e.target.classList||!e.target.classList.contains('outer-chk-input'))return;
  window.__showOuter=e.target.checked;
  document.querySelectorAll('.outer-chk-input').forEach(c=>c.checked=window.__showOuter);
  document.querySelectorAll('.varga-style-toggle .varga-style-btn.active').forEach(b=>b.click());
});
function chOuter(v){return (window.__showOuter!==false&&v&&v.outerSign)?OUTER_LIST:[];}
function chMeta(v){const inf={},c=window.__vgC;v.houses.forEach(h=>h.planets.forEach(p=>{inf[p.name]={st:(p.dignity||{}).status||'',rx:!!p.retrograde};}));
  chOuter(v).forEach(n=>{inf[n]={st:'',rx:!!(v.outerRx&&v.outerRx[n]),vg:false};});
  PLANET_LIST.forEach(n=>{inf[n]=inf[n]||{st:'',rx:false};inf[n].vg=!!(c&&c.planets&&c.planets[n]&&v!==c.vargas.D1&&v.planetVargaSign[n]===c.planets[n].sign);});return inf;}
function chBadge(n,x,y,r,i,lab){const c=PCOL[n],f=(r*1.3).toFixed(1);
  return `<g><title>${n}${i.rx?' (retrograde)':''}${i.st?' · '+i.st:''}${i.vg?' · Vargottama':''}</title><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity=".17" stroke="${dRing(i.st)}" stroke-width="1.5"/><text x="${x}" y="${y+.5}" text-anchor="middle" dominant-baseline="central" font-size="${f}" fill="${c}" font-family="sans-serif" font-weight="700">${PLANET_GLYPHS[n]||OUTER_GLYPHS[n]}</text>${i.rx?`<text x="${x+r*.95}" y="${y-r*.6}" font-size="${(r*.85).toFixed(1)}" fill="#FF8A8A" font-weight="800" font-family="sans-serif" text-anchor="middle">R</text>`:''}${i.vg?`<text x="${x-r*.95}" y="${y-r*.5}" font-size="${(r*.95).toFixed(1)}" fill="#F9D976" text-anchor="middle">★</text>`:''}${lab?`<text x="${x}" y="${y+r+6}" font-size="5.6" fill="${c}" fill-opacity=".85" font-family="sans-serif" text-anchor="middle">${n.slice(0,2)}</text>`:''}</g>`;}
function chPlanets(list,inf,cx,cy,maxCols){const n=list.length;if(!n)return '';const r=n<=2?9:n<=4?8:6.5,cols=n<=2?n:(n>4&&maxCols?maxCols:2),gap=2*r+(n<=4?8:3),rows=Math.ceil(n/cols);
  return list.map((p,i)=>{const ro=Math.floor(i/cols),k=Math.min(cols,n-ro*cols),j=i%cols;return chBadge(p,+(cx+(j-(k-1)/2)*gap).toFixed(1),+(cy+(ro-(rows-1)/2)*gap).toFixed(1),r,inf[p],n<=4);}).join('');}
function chDefs(id){return `<defs><radialGradient id="${id}b" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1c2242"/><stop offset=".6" stop-color="#0d1020"/><stop offset="1" stop-color="#05060b"/></radialGradient><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9D976"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#8C7323"/></linearGradient></defs><rect x="1.5" y="1.5" width="297" height="297" rx="16" fill="url(#${id}b)" stroke="url(#${id}g)" stroke-width="1.2"/>`+[[22,40],[270,26],[40,270],[262,262],[120,16],[285,150],[180,285],[14,150]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3?.6:.9}" fill="#fff" opacity=".3"/>`).join('');}
function chSignDot(x,y,si,r){const el=SIGNS[si].element,c=ELC[el];return `<g><title>${SIGNS[si].name} · ${el}</title><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1"/><text x="${x}" y="${y+.5}" text-anchor="middle" dominant-baseline="central" font-size="${r*1.1}" fill="${c}" font-family="sans-serif" font-weight="700">${si+1}</text></g>`;}
function chAspects(rows,pos){let s='<g class="aspect-lines-layer">';rows.forEach(r=>{const f=pos(r.fromHouse);[...new Set(r.targets.filter(t=>t.toPlanet).map(t=>t.toHouse))].forEach(h=>{const t=pos(h);s+=`<line x1="${f[0]}" y1="${f[1]}" x2="${t[0]}" y2="${t[1]}" class="aspect-line aspect-line-${r.planet.toLowerCase()}"><title>${r.planet} aspects H${h}</title></line>`;});});return s+'</g>';}

function buildNorthIndianSvg(v,asp){
  const asc=v.ascendantSign,inf=chMeta(v),hp={};for(let h=1;h<=12;h++)hp[h]=[];PLANET_LIST.forEach(n=>hp[((v.planetVargaSign[n]-asc+12)%12)+1].push(n));chOuter(v).forEach(n=>hp[((v.outerSign[n]-asc+12)%12)+1].push(n));
  const A=[10,10],B=[290,10],C=[290,290],D=[10,290],T=[150,10],R=[290,150],Bo=[150,290],L=[10,150],O=[150,150],Q1=[80,80],Q2=[220,80],Q3=[220,220],Q4=[80,220];
  const poly={1:[T,Q2,O,Q1],2:[A,T,Q1],3:[A,Q1,L],4:[L,Q1,O,Q4],5:[L,Q4,D],6:[D,Q4,Bo],7:[Bo,Q4,O,Q3],8:[Bo,Q3,C],9:[C,Q3,R],10:[R,Q3,O,Q2],11:[R,Q2,B],12:[B,Q2,T]};
  const an={1:[150,76],2:[78,46],3:[46,78],4:[74,150],5:[46,222],6:[78,254],7:[150,224],8:[222,254],9:[254,222],10:[226,150],11:[254,78],12:[222,46]};
  const sd={1:[150,28],2:[104,20],3:[20,104],4:[28,150],5:[20,196],6:[104,280],7:[150,272],8:[196,280],9:[280,196],10:[272,150],11:[280,104],12:[196,20]};
  let s=`<svg class="varga-chart-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${chDefs('n')}`;
  for(let h=1;h<=12;h++)s+=`<polygon points="${poly[h].map(p=>p.join(',')).join(' ')}" fill="${HTc(h)}" fill-opacity="${HAl(h)}" stroke="url(#ng)" stroke-width="${h===1?1.8:1.2}" stroke-linejoin="round"/>`;
  s+=`<circle cx="150" cy="150" r="13" fill="none" stroke="#D4AF37" stroke-opacity=".3"/><circle cx="150" cy="150" r="3" fill="url(#ng)"/>`;
  if(asp)s+=chAspects(asp,h=>an[h]);
  for(let h=1;h<=12;h++){s+=chSignDot(sd[h][0],sd[h][1],(asc+h-1)%12,7.5)+chPlanets(hp[h],inf,an[h][0],an[h][1]+(h===1?4:0),3);}
  s+=`<rect x="137" y="40" width="26" height="11" rx="5.5" fill="#D4AF37"/><text x="150" y="45.8" font-size="7" fill="#1a1405" font-weight="800" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">ASC</text></svg>`;
  return s;}

function buildWesternWheelSvg(v,asp){
  const asc=v.ascendantSign,inf=chMeta(v),hp={},cx=150,cy=150,R0=136,R1=112,R2=92,R3=30;for(let h=1;h<=12;h++)hp[h]=[];PLANET_LIST.forEach(n=>hp[((v.planetVargaSign[n]-asc+12)%12)+1].push(n));chOuter(v).forEach(n=>hp[((v.outerSign[n]-asc+12)%12)+1].push(n));
  const pt=(r,a)=>[+(cx+r*Math.cos(a*Math.PI/180)).toFixed(1),+(cy+r*Math.sin(a*Math.PI/180)).toFixed(1)];
  const sec=(r1,r2,a1,a2)=>{const p1=pt(r2,a1),p2=pt(r2,a2),p3=pt(r1,a2),p4=pt(r1,a1);return `M${p1} A${r2} ${r2} 0 0 1 ${p2} L${p3} A${r1} ${r1} 0 0 0 ${p4}Z`;};
  const mid=h=>180-30*(h-1)-15;
  let s=`<svg class="varga-chart-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${chDefs('w')}`;
  for(let h=1;h<=12;h++){const a2=180-30*(h-1),a1=a2-30,si=(asc+h-1)%12,el=SIGNS[si].element,ec=ELC[el];
    s+=`<path d="${sec(R1,R0,a1,a2)}" fill="${ec}" fill-opacity=".2" stroke="url(#wg)" stroke-width=".9"><title>${SIGNS[si].name} · ${el}</title></path>`
     +`<path d="${sec(R2,R1,a1,a2)}" fill="${HTc(h)}" fill-opacity="${HAl(h)+.06}" stroke="url(#wg)" stroke-width=".7"/>`
     +`<path d="${sec(R3,R2,a1,a2)}" fill="${HTc(h)}" fill-opacity="${HAl(h)*.45}" stroke="url(#wg)" stroke-opacity=".5" stroke-width=".6"/>`;
    const sp=pt((R0+R1)/2,mid(h)),hp2=pt((R1+R2)/2,mid(h));
    s+=`<text x="${sp[0]}" y="${sp[1]}" text-anchor="middle" dominant-baseline="central" font-size="8.5" font-weight="700" fill="${ec}" font-family="sans-serif">${SIGNS[si].name.slice(0,3)}</text><text x="${hp2[0]}" y="${hp2[1]}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="${HTc(h)}" font-family="sans-serif">${h}</text>`;}
  if(asp)s+=chAspects(asp,h=>pt(R3+7,mid(h)));
  s+=`<circle cx="${cx}" cy="${cy}" r="${R3}" fill="url(#wb)" stroke="url(#wg)" stroke-width="1.4"/><text x="${cx}" y="${cy-6}" text-anchor="middle" font-size="6" letter-spacing="1" fill="#D4AF37" font-family="sans-serif" font-weight="700">LAGNA</text><text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="9.5" fill="#F4F1E8" font-weight="700" font-family="sans-serif">${SIGNS[asc].name.slice(0,3)}</text>`;
  for(let h=1;h<=12;h++){const L2=hp[h],n=L2.length;if(!n)continue;const pr=n>6?3:2,rb=n<=2?8:n<=4?7.5:6.5;
    L2.forEach((p,i)=>{const row=Math.floor(i/pr),k=Math.min(pr,n-row*pr),j=i%pr,r=R2-15-row*19,sp=Math.min(24,(2*rb+3)/r*57.3),q=pt(r,mid(h)+(j-(k-1)/2)*sp);s+=chBadge(p,q[0],q[1],rb,inf[p],false);});}
  const e1=pt(R0+3,180),e2=pt(R3,180);
  s+=`<line x1="${e1[0]}" y1="${e1[1]}" x2="${e2[0]}" y2="${e2[1]}" stroke="#FF8A8A" stroke-width="2" stroke-linecap="round"/><rect x="2" y="136" width="9" height="28" rx="3" fill="#FF8A8A"/><text transform="translate(8,150) rotate(-90)" font-size="6.5" fill="#1a0a0a" font-weight="800" font-family="sans-serif" text-anchor="middle">ASC</text></svg>`;
  return s;}

function buildSouthIndianSvg(v,asp){
  const asc=v.ascendantSign,inf=chMeta(v),cell=[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1],[0,0]],hp={};for(let i=0;i<12;i++)hp[i]=[];PLANET_LIST.forEach(n=>hp[v.planetVargaSign[n]].push(n));chOuter(v).forEach(n=>hp[v.outerSign[n]].push(n));
  const xy=si=>[10+cell[si][0]*70,10+cell[si][1]*70],ctr=h=>{const p=xy((asc+h-1)%12);return [p[0]+35,p[1]+35];};
  let s=`<svg class="varga-chart-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${chDefs('s')}`;
  s+=`<g opacity=".9"><circle cx="150" cy="150" r="58" fill="none" stroke="#D4AF37" stroke-opacity=".22"/><circle cx="150" cy="150" r="40" fill="none" stroke="#5EC4B7" stroke-opacity=".25" stroke-dasharray="3 4"/><circle cx="150" cy="150" r="3" fill="url(#sg)"/></g>`;
  for(let si=0;si<12;si++){const [x,y]=xy(si),h=((si-asc+12)%12)+1,el=SIGNS[si].element,ec=ELC[el];
    s+=`<rect x="${x}" y="${y}" width="70" height="70" fill="${ec}" fill-opacity="${si===asc?.2:.09}" stroke="url(#sg)" stroke-width="${si===asc?2:1.1}"><title>${SIGNS[si].name} · ${el}</title></rect>`
     +`<text x="${si===asc?x+31:x+5}" y="${y+10}" font-size="7.5" font-weight="700" fill="${ec}" font-family="sans-serif">${SIGNS[si].name.slice(0,3)}</text>`
     +`<circle cx="${x+60}" cy="${y+10}" r="6.5" fill="${HTc(h)}" fill-opacity=".2" stroke="${HTc(h)}" stroke-width=".9"/><text x="${x+60}" y="${y+10.5}" font-size="7.5" font-weight="700" fill="${HTc(h)}" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${h}</text>`;
    if(si===asc)s+=`<path d="M${x} ${y} L${x+26} ${y} L${x} ${y+26}Z" fill="#D4AF37" fill-opacity=".85"/><text x="${x+4.5}" y="${y+10}" font-size="6.5" font-weight="800" fill="#1a1405" font-family="sans-serif">ASC</text>`;}
  if(asp)s+=chAspects(asp,h=>ctr(h));
  for(let si=0;si<12;si++){const [x,y]=xy(si);s+=chPlanets(hp[si],inf,x+35,y+41,3);}
  s+=`<text x="150" y="146" text-anchor="middle" font-size="7" letter-spacing="1.5" fill="#D4AF37" font-family="sans-serif" font-weight="700">LAGNA</text><text x="150" y="160" text-anchor="middle" font-size="11" font-weight="700" fill="#F4F1E8" font-family="sans-serif">${SIGNS[asc].name}</text></svg>`;
  return s;}

// Generic clipboard copy helper with button feedback + legacy fallback.
function copyTextToClipboard(text, btnEl, idleLabel){
  const idle = idleLabel || '<span>📋</span> Copy';
  const finish = (ok) => {
    if (!btnEl) return;
    btnEl.innerHTML = ok ? '<span>✓</span> Copied' : '<span>⚠</span> Copy Failed';
    setTimeout(() => { btnEl.innerHTML = idle; }, 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => finish(true)).catch(() => {
      legacyCopyFallback(text, finish);
    });
  } else {
    legacyCopyFallback(text, finish);
  }
}
function legacyCopyFallback(text, finish){
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    finish(ok);
  } catch (e) { finish(false); }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function formatDateHuman(dob){
  const [y,m,d] = dob.split('-').map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${d} ${months[m-1]} ${y}`;
}

function downloadActiveChartImage(format, vargaKey, styleName, personName) {
  downloadActiveChartImageFromWrapper('vargaSvgWrapper', format, vargaKey, styleName, personName);
}

function downloadActiveChartImageFromWrapper(wrapperId, format, vargaKey, styleName, personName) {
  const svgEl = document.querySelector(`#${wrapperId} svg`);
  if (!svgEl) return;

  const safeName = (personName || 'Chart').replace(/[^a-z0-9]/gi, '_');
  const filename = `${safeName}_${vargaKey}_${styleName}_chart.${format}`;

  // Clone SVG and inline critical CSS styles for clean standalone rendering
  const clonedSvg = svgEl.cloneNode(true);
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .chart-bg-outer { fill: #07090F; }
    .chart-line-main { stroke: #D4AF37; stroke-width: 1.6px; }
    .chart-line-sub { stroke: rgba(212,175,55,0.4); stroke-width: 1px; }
    .chart-line-wheel { stroke: rgba(66, 135, 126, 0.4); stroke-width: 1px; }
    .chart-txt-house { fill: rgba(255,255,255,0.4); font-size: 9px; font-family: sans-serif; }
    .chart-txt-sign { fill: #8C7323; font-size: 10px; font-weight: 600; font-family: sans-serif; }
    .chart-txt-asc { fill: #D95F5F; font-size: 10px; font-weight: 700; font-family: sans-serif; }
    .chart-txt-planet { fill: #F9D976; font-size: 11px; font-weight: 600; font-family: sans-serif; }
    .chart-wheel-spoke { stroke: rgba(212,175,55,0.3); stroke-width: 1px; }
    .aspect-line { stroke: rgba(94, 196, 183, 0.55); stroke-width: 1.1px; stroke-dasharray: 3 3; }
    .aspect-line-mars { stroke: rgba(217, 95, 95, 0.6); }
    .aspect-line-jupiter { stroke: rgba(249, 217, 118, 0.6); }
    .aspect-line-saturn { stroke: rgba(107, 127, 163, 0.6); }
  `;
  clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);

  if (format === 'svg') {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else if (format === 'png') {
    // Render to high-resolution 1200x1200 canvas
    const canvas = document.createElement('canvas');
    const scale = 4; // 4x supersampling for ultra-crisp resolution
    canvas.width = 300 * scale;
    canvas.height = 300 * scale;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw background
      ctx.fillStyle = '#07090F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  }
}


/* ---- Profile cards (menu) ---- */
function renderProfileCards(){
  const box=document.getElementById('profileCards'); if(!box) return;
  const profiles=loadProfiles(), cur=document.getElementById('profileSelect').value;
  document.getElementById('profCount').textContent = profiles.length ? `(${profiles.length})` : '';
  if(!profiles.length){ box.innerHTML='<div class="prof-empty">No saved profiles yet.<br>Create your first chart with “Create New Profile” below.</div>'; return; }
  const cols=['#D4AF37','#5EC4B7','#8A6FB8','#E0A64A','#6B7FA3','#C95050','#5B8A9E'];
  box.innerHTML=profiles.map((p,i)=>{
    const col=cols[[...(p.name||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)%cols.length];
    const place=(p.place||'').split(',')[0];
    return `<div class="prof-card ${String(i)===cur?'active':''}" data-prof="${i}">
      <span class="prof-av" style="background:${col}">${escapeHtml((p.name||'?').trim().charAt(0).toUpperCase())}</span>
      <span class="prof-info"><b>${escapeHtml(p.name||'Unnamed')}${String(i)===cur?'<span class="prof-badge">Active</span>':''}</b>
      <small>${formatDateHuman(p.dob)} · ${p.tob||''}${place?' · '+escapeHtml(place):''}</small></span>
      <button type="button" class="prof-share" data-prof-share="${i}" title="Share chart link / QR" aria-label="Share chart">📤</button>
      <button type="button" class="prof-edit" data-prof-edit="${i}" title="Edit birth date &amp; time" aria-label="Edit birth date and time">✏️</button>
      <button type="button" class="prof-del" data-prof-del="${i}" title="Delete profile" aria-label="Delete profile">🗑️</button>
    </div>`;
  }).join('');
}
document.getElementById('profileCards').addEventListener('click',(e)=>{
  const sel=document.getElementById('profileSelect');
  const del=e.target.closest('[data-prof-del]');
  const ed=e.target.closest('[data-prof-edit]');
  if(ed){ e.stopPropagation(); openProfEdit(+ed.dataset.profEdit); return; }
  if(del){ e.stopPropagation(); sel.value=del.dataset.profDel; document.getElementById('deleteProfileBtn').click(); return; }
  const card=e.target.closest('[data-prof]');
  if(card){ sel.value=card.dataset.prof; sel.dispatchEvent(new Event('change')); }
});
(function(){ const orig=refreshProfileSelect; refreshProfileSelect=function(){ orig.apply(this,arguments); renderProfileCards(); }; })();

/* ---- Edit a saved profile's name / birth date / birth time (menu -> profile card -> ✏️) ---- */
function openProfEdit(idx){
  const list=loadProfiles(), p=list[idx]; if(!p) return;
  let m=document.getElementById('profEditModal');
  if(!m){
    m=document.createElement('div'); m.className='modal-overlay'; m.id='profEditModal';
    m.innerHTML='<div class="modal-box pe-box"><h4>✏️ Edit birth details</h4>'
      +'<label class="pe-l">Name<input type="text" id="peName" maxlength="60"></label>'
      +'<label class="pe-l">Date of birth<input type="date" id="peDob"></label>'
      +'<label class="pe-l">Time of birth<input type="time" id="peTob" step="60"></label>'
      +'<p class="pe-note">Place stays the same. To change the place, create a new profile. The chart is recalculated when you save.</p>'
      +'<div class="pe-err" id="peErr" hidden></div>'
      +'<div class="modal-actions"><button type="button" class="btn btn-ghost btn-sm" id="peCancel">Cancel</button><button type="button" class="btn btn-primary btn-sm" id="peSave">Save &amp; recalculate</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); });
    m.querySelector('#peCancel').addEventListener('click',()=>m.classList.remove('show'));
    m.querySelector('#peSave').addEventListener('click',()=>{
      const i=+m.dataset.idx, L=loadProfiles(), q=L[i]; if(!q) return;
      const nm=m.querySelector('#peName').value.trim(), d=m.querySelector('#peDob').value, t=m.querySelector('#peTob').value, er=m.querySelector('#peErr');
      if(!nm||!d||!t){ er.textContent='Please fill in the name, date and time.'; er.hidden=false; return; }
      q.name=nm; q.dob=d; q.tob=t; L[i]=q; saveProfiles(L); m.classList.remove('show');
      refreshProfileSelect();
      const sel=document.getElementById('profileSelect'); sel.value=String(i); sel.dispatchEvent(new Event('change'));
    });
  }
  m.dataset.idx=idx;
  m.querySelector('#peName').value=p.name||''; m.querySelector('#peDob').value=p.dob||''; m.querySelector('#peTob').value=(p.tob||'').slice(0,5);
  m.querySelector('#peErr').hidden=true;
  m.classList.add('show');
}
document.getElementById('openMenuBtn').addEventListener('click', renderProfileCards);
/* ---- META: error boundaries around every panel builder ---- */
const SAFE_BUILDERS = {
  buildOverviewPanel:'My Chart', buildPlanetsPanel:'Planets', buildDashaSection:'Dasha', buildYogaSection:'Yogas',
  buildShadbalaSection:'Shadbala', buildNumerologyPanel:'Numerology', buildVedicBirthdayPanel:'Vedic Birthday', buildMatchPanel:'Matching', buildPanchangaPanel:'Panchanga', buildTransitsPanel:'Transits', buildBhavaPanel:'Bhava Chalit', buildAshtakavargaSection:'Ashtakavarga', buildRelationshipsSection:'Relations'
};
Object.keys(SAFE_BUILDERS).forEach(name => {
  const orig = window[name]; if (typeof orig !== 'function') return;
  window[name] = function(){
    try { return orig.apply(this, arguments); }
    catch(err){
      console.error('[' + name + ']', err); APP.report(SAFE_BUILDERS[name], err);
      return `<div class="meta-err"><b>⚠ ${SAFE_BUILDERS[name]} couldn't be built.</b><p>The rest of your chart is fine. Try recalculating; if it keeps happening, use Menu → Contact Developer.</p><details><summary>Technical detail</summary><code>${escapeHtml(String(err && err.message || err))}</code></details></div>`;
    }
  };
});

/* ---- META: back-button routing (phone Back returns to Home instead of leaving the app) ---- */
(function(){
  const base = window.switchAppTab; let replaying = false;
  window.switchAppTab = function(id){
    base(id);
    if (replaying || id === 'panel-export' || id === 'panel-contact') return;
    const h = '#' + id.replace('panel-', '');
    if (location.hash !== h){ try { history.pushState({ p: id }, '', h); } catch(e){} }
  };
  window.addEventListener('popstate', (e) => {
    const id = e.state && e.state.p;
    if (id && document.getElementById(id)){ replaying = true; base(id); replaying = false; }
  });
})();

/* ---- META: keyboard, scroll-lock and accessibility for all modals ---- */
(function(){
  const modals = [...document.querySelectorAll('[id$="Modal"]')];
  const sync = () => document.body.classList.toggle('modal-open', modals.some(m => m.classList.contains('show')));
  modals.forEach(m => {
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    new MutationObserver(sync).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = modals.filter(m => m.classList.contains('show'));
    if (open.length) open[open.length - 1].classList.remove('show');
  });
  document.querySelectorAll('.pd-modal-close,.export-modal-close,[id$="ModalClose"],#mainMenuClose').forEach(b => b.setAttribute('aria-label', 'Close'));
  const labels = { openMenuBtn: 'Open menu', hdrBack: 'Back to Home' };
  Object.keys(labels).forEach(id => { const el = document.getElementById(id); if (el) el.setAttribute('aria-label', labels[id]); });
  const menuBox = document.querySelector('#mainMenuModal > *');
  if (menuBox) menuBox.insertAdjacentHTML('beforeend', `<div class="menu-version">${APP.name} · v${APP.version}</div>`);
})();

populateTz();
refreshProfileSelect();
/* ---- Friendly input page: dropdown date/time, quick time guesses, tidy place step, example ---- */
const IN_MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function inBuildFriendly(){
  const dob = document.getElementById('dobInput'), tob = document.getElementById('tobInput');
  if (!dob || !tob || document.getElementById('inDay')) return;
  dob.required = false; tob.required = false;
  const grid = dob.closest('.form-grid'); grid.style.display = 'none';
  const yr = new Date().getFullYear();
  const opt = (a)=> a.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('');
  const days = opt(Array.from({length:31},(_,i)=>[i+1,i+1])), mons = opt(IN_MON.map((m,i)=>[i+1,m]));
  const yrs = opt(Array.from({length:yr-1899},(_,i)=>[yr-i,yr-i]));
  const hrs = opt(Array.from({length:12},(_,i)=>[i+1,i+1])), mins = opt(Array.from({length:60},(_,i)=>[i,String(i).padStart(2,'0')]));
  const box = document.createElement('div'); box.className = 'in-friendly';
  box.innerHTML = `
    <div class="in-q">🎂 Date you were born</div>
    <div class="in-row3"><select id="inDay" aria-label="Day"><option value="">Day</option>${days}</select><select id="inMon" aria-label="Month"><option value="">Month</option>${mons}</select><select id="inYear" aria-label="Year"><option value="">Year</option>${yrs}</select></div>
    <div class="in-bad" id="inBadDate" hidden>That date does not exist. Please check the day and month.</div>
    <div class="in-q">⏰ Time you were born</div>
    <div class="in-row3 t"><select id="inHr" aria-label="Hour"><option value="">Hour</option>${hrs}</select><select id="inMin" aria-label="Minute"><option value="">Minute</option>${mins}</select><div class="in-ampm" id="inAp"><button type="button" data-ap="AM">AM</button><button type="button" data-ap="PM">PM</button></div></div>
    <div class="in-q2">Don't know the exact time? Tap the closest:</div>
    <div class="in-chips" id="inChips"><button type="button" data-t="08:00">🌅 Morning</button><button type="button" data-t="13:00">☀️ Afternoon</button><button type="button" data-t="18:00">🌇 Evening</button><button type="button" data-t="22:00">🌙 Night</button><button type="button" data-t="12:00">🤷 No idea</button></div>
    <div class="in-guess" id="inGuess" hidden></div>`;
  grid.parentNode.insertBefore(box, grid);
  const tip = document.querySelector('.in-step[data-step="2"] .in-tip span');
  if (tip) tip.innerHTML = 'Birth time is on your <b>birth certificate</b>, or ask your parents. A close guess is fine. You can fix it later in <b>Rectify</b>.';
  const $ = id => document.getElementById(id);
  const fire = el => el.dispatchEvent(new Event('input', {bubbles:true}));
  function pushDate(){
    const d = +$('inDay').value, m = +$('inMon').value, y = +$('inYear').value;
    ['inDay','inMon','inYear'].forEach(i=> $(i).classList.toggle('ok', !!$(i).value));
    if (!(d && m && y)) { if (dob.value){ dob.value = ''; fire(dob); } return; }
    const ok = new Date(Date.UTC(y, m-1, d)).getUTCMonth() === m-1; $('inBadDate').hidden = ok;
    dob.value = ok ? `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : ''; fire(dob);
  }
  function pushTime(){
    const h = +$('inHr').value, mi = $('inMin').value, ap = ($('inAp').querySelector('.on')||{}).dataset;
    if (h && mi === ''){ $('inMin').value = '0'; }
    ['inHr','inMin'].forEach(i=> $(i).classList.toggle('ok', !!$(i).value));
    const m2 = $('inMin').value;
    if (!(h && m2 !== '' && ap)) { if (tob.value){ tob.value = ''; fire(tob); } return; }
    const h24 = (h % 12) + (ap.ap === 'PM' ? 12 : 0);
    tob.value = `${String(h24).padStart(2,'0')}:${String(+m2).padStart(2,'0')}`; fire(tob);
  }
  // the native 'input' event bubbles to the form and re-syncs the controls from the OLD hidden values (undoing the pick) -> stop it
  ['inDay','inMon','inYear','inHr','inMin'].forEach(i=> $(i).addEventListener('input', e=>e.stopPropagation()));
  ['inDay','inMon','inYear'].forEach(i=> $(i).addEventListener('change', pushDate));
  ['inHr','inMin'].forEach(i=> $(i).addEventListener('change', ()=>{ $('inGuess').hidden = true; $('inChips').querySelectorAll('.on').forEach(b=>b.classList.remove('on')); pushTime(); }));
  $('inAp').addEventListener('click', e=>{ const b = e.target.closest('[data-ap]'); if (!b) return; $('inAp').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); $('inGuess').hidden = true; pushTime(); });
  $('inChips').addEventListener('click', e=>{
    const b = e.target.closest('[data-t]'); if (!b) return;
    const [H,M] = b.dataset.t.split(':').map(Number); inSetTime(H, M);
    $('inChips').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
    const g = $('inGuess'); g.hidden = false;
    g.innerHTML = `We will use about <b>${$('inHr').value}:${String($('inMin').value).padStart(2,'0')} ${H>=12?'PM':'AM'}</b>. Your Sun and Moon sign will still be right. Open <b>Rectify</b> later to find your exact time.`;
  });
  window.inSetTime = function(H, M){
    $('inHr').value = (H % 12) || 12; $('inMin').value = M; $('inAp').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.ap === (H>=12?'PM':'AM'))); pushTime();
  };
  document.getElementById('birthForm').addEventListener('reset', ()=> setTimeout(()=>{ ['inDay','inMon','inYear','inHr','inMin'].forEach(i=>{ $(i).value=''; $(i).classList.remove('ok'); }); $('inAp').querySelectorAll('button').forEach(x=>x.classList.remove('on')); $('inGuess').hidden=true; $('inChips').querySelectorAll('.on').forEach(x=>x.classList.remove('on')); },0));
  window.inSyncFriendly = function(){
    const dv = (dob.value||'').split('-').map(Number), tv = (tob.value||'').split(':').map(Number);
    if (dv.length>=3 && dv[0]){ $('inYear').value = dv[0]; $('inMon').value = dv[1]; $('inDay').value = dv[2]; }
    if (tv.length>=2 && !isNaN(tv[0]) && tob.value){ const H = tv[0], M = tv[1]; $('inHr').value = (H%12)||12; $('inMin').value = M; $('inAp').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.ap === (H>=12?'PM':'AM'))); }
    ['inDay','inMon','inYear','inHr','inMin'].forEach(i=> $(i).classList.toggle('ok', !!$(i).value));
  };
  // place step: tuck timezone + coordinates away, show a friendly confirmation
  const tz = document.getElementById('tzInput'), co = document.getElementById('coordReadout');
  const f1 = tz.closest('.field'), f2 = co.closest('.field'), pw = document.querySelector('#placeInput').closest('.field');
  const det = document.createElement('details'); det.className = 'in-adv';
  det.innerHTML = '<summary>⚙️ Timezone &amp; coordinates (filled in for you, usually no need to touch)</summary><div class="form-grid"></div>';
  det.querySelector('.form-grid').append(f1, f2); pw.parentNode.appendChild(det);
  const found = document.createElement('div'); found.className = 'in-found'; found.id = 'inFound'; found.hidden = true; pw.appendChild(found);
  const lab = pw.querySelector('label'); if (lab) lab.textContent = 'City or town where you were born';
  const pin = document.getElementById('placeInput'); pin.placeholder = 'Type your city, e.g. Pune, India';
  const nameLab = document.querySelector('label[for="profileName"]'); if (nameLab) nameLab.textContent = 'Your name or nickname';
  // example button
  const sub = document.querySelector('.in-card .submit-row');
  const ex = document.createElement('button'); ex.type = 'button'; ex.className = 'in-ex'; ex.id = 'inEx'; ex.textContent = '👀 Just looking? Try an example first'; sub.appendChild(ex);
  ex.addEventListener('click', ()=>{
    document.getElementById('profileName').value = 'Example Person'; dob.value = '1990-05-15'; fire(dob); inSyncFriendly(); inSetTime(10, 30);
    selectLocation({display_name:'Mumbai, Maharashtra, India', lat:'19.0760', lon:'72.8777', address:{country_code:'in'}});
    fire(document.getElementById('profileName')); inUpdate();
  });
  const fd = document.createElement('button'); fd.type = 'button'; fd.className = 'in-ex'; fd.id = 'inFindDate'; fd.textContent = '🔎 Don\u2019t know the birth date? Find it from clues (full moon, festival\u2026)'; sub.appendChild(fd);
  fd.addEventListener('click', ()=>{ try { dfOpenModal(); } catch(e){ console.error('Date Finder', e); } });
}
function inFoundUpdate(){
  const f = document.getElementById('inFound'); if (!f) return;
  const ok = typeof selectedLat==='number' && !isNaN(selectedLat), tz = document.getElementById('tzInput');
  if (!ok){ f.hidden = true; return; }
  const place = (document.getElementById('placeInput').value||'').split(',').slice(0,2).join(',');
  const t = tz && tz.selectedOptions && tz.selectedOptions[0] ? tz.selectedOptions[0].textContent.split(' ')[0] : '';
  f.hidden = false; f.textContent = '✅ Found: ' + place + (t ? ' · time zone set automatically (' + t + ')' : '');
}

/* ---- Intake: progress + welcome-back chips ---- */
function inUpdate(){
  const v = id => (document.getElementById(id).value||'').trim();
  const d1 = v('profileName').length>0, d2 = !!(v('dobInput') && v('tobInput')), d3 = (typeof selectedLat==='number' && !isNaN(selectedLat));
  [d1,d2,d3].forEach((d,i)=> document.querySelector(`.in-step[data-step="${i+1}"]`).classList.toggle('done', d));
  const n=[d1,d2,d3].filter(Boolean).length, hints=["First, tell us your name","Now, when were you born?","Last one: where were you born?"];
  document.getElementById('inBarFill').style.width = (n/3*100)+'%';
  try{ inSyncFriendly(); inFoundUpdate(); }catch(e){}
  document.querySelectorAll('.in-step').forEach(x=> x.classList.remove('current')); const cur = document.querySelector(`.in-step[data-step="${Math.min(3, [d1,d2,d3].findIndex(x=>!x)+1 || 3)}"]`); if (cur && n<3) cur.classList.add('current');
  document.getElementById('inStepLbl').textContent = n===3 ? 'All set ✓' : `Step ${n+1} of 3`;
  document.getElementById('inStepHint').textContent = n===3 ? 'Tap “Show my chart” below' : (!d1?hints[0]:!d2?hints[1]:hints[2]);
}
function renderIntakeSaved(){
  const box=document.getElementById('inSaved'); if(!box) return;
  const ps=loadProfiles();
  if(!ps.length){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML='<span>Welcome back — open a saved chart:</span>'+ps.map((p,i)=>`<button type="button" data-in-prof="${i}">${escapeHtml(p.name||'Unnamed')}</button>`).join('');
}
document.getElementById('inSaved').addEventListener('click',(e)=>{
  const b=e.target.closest('[data-in-prof]'); if(!b) return;
  const sel=document.getElementById('profileSelect'); sel.value=b.dataset.inProf; sel.dispatchEvent(new Event('change'));
});
(function(){
  const form=document.getElementById('birthForm');
  form.addEventListener('input',inUpdate); form.addEventListener('change',inUpdate);
  form.addEventListener('reset',()=>setTimeout(inUpdate,0));
  new MutationObserver(inUpdate).observe(document.getElementById('coordReadout'),{childList:true,characterData:true,subtree:true});
  const o=refreshProfileSelect; refreshProfileSelect=function(){ o.apply(this,arguments); renderIntakeSaved(); };
  try{ inBuildFriendly(); }catch(e){ console.error('intake', e); }
  renderIntakeSaved(); inUpdate();
})();


// Automatically track new profile saves and form clears
document.getElementById('birthForm').addEventListener('submit', () => {
  setTimeout(() => {
    const sel = document.getElementById('profileSelect');
    if (sel.value !== "") localStorage.setItem('VedicAstrology_lastProfileIdx', sel.value);
  }, 500); // Trigger just after the chart renders
});
document.getElementById('newProfileBtn').addEventListener('click', () => {
  localStorage.removeItem('VedicAstrology_lastProfileIdx');
});
document.getElementById('modalConfirm').addEventListener('click', () => {
  localStorage.removeItem('VedicAstrology_lastProfileIdx');
});

// Auto-load last active profile on page load
(function autoLoadLastProfile() {
  const profiles = loadProfiles();
  if (profiles && profiles.length > 0) {
    let lastIdx = localStorage.getItem('VedicAstrology_lastProfileIdx');
    // Default to the most recently added profile if none is stored or index is invalid
    if (lastIdx === null || lastIdx >= profiles.length || lastIdx < 0 || lastIdx === "") {
      lastIdx = profiles.length - 1;
    }
    const sel = document.getElementById('profileSelect');
    sel.value = lastIdx;
    if (sel.value !== "") {
      sel.dispatchEvent(new Event('change')); // Trigger chart rendering
    }
  }
})();
