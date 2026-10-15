/* ============================================================================
   ASTRONOMICAL ENGINE — sidereal (Lahiri), validated against India Independence
   chart and published sidereal Saturn/Jupiter transit dates.
   ============================================================================ */
const DEG = Math.PI/180, RAD = 180/Math.PI, J2000 = 2451545.0;
function normDeg(d){ d = d%360; return d<0 ? d+360 : d; }
function angDiff(a,b){ let d = normDeg(a-b); if (d>180) d -= 360; return d; }

function toJulianDay(year,month,day,hour,minute,second){
  let Y=year, M=month;
  if (M<=2){ Y-=1; M+=12; }
  const A = Math.floor(Y/100);
  const B = 2-A+Math.floor(A/4);
  const dayFrac = day + (hour+minute/60+second/3600)/24;
  return Math.floor(365.25*(Y+4716)) + Math.floor(30.6001*(M+1)) + dayFrac + B - 1524.5;
}
function jdToDate(jd){
  jd += 0.5;
  const Z = Math.floor(jd), F = jd-Z;
  let A = Z;
  if (Z>=2299161){ const alpha=Math.floor((Z-1867216.25)/36524.25); A=Z+1+alpha-Math.floor(alpha/4); }
  const B=A+1524, C=Math.floor((B-122.1)/365.25), D=Math.floor(365.25*C), E=Math.floor((B-D)/30.6001);
  const day = B-D-Math.floor(30.6001*E)+F;
  const month = E<14 ? E-1 : E-13;
  const year = month>2 ? C-4716 : C-4715;
  const dayInt = Math.floor(day);
  const hourFrac = (day-dayInt)*24;
  const hour = Math.floor(hourFrac);
  const min = Math.round((hourFrac-hour)*60);
  return new Date(Date.UTC(year, month-1, dayInt, hour, min>=60?0:min));
}

function lahiriAyanamsa(jd){
  const ayan1900 = 22+27/60+54.33/3600;
  const precessionRate = 50.2564/3600;
  const years = (jd-2415020.0)/365.25;
  let ayan = ayan1900 + precessionRate*years;
  ayan += 0.000139*Math.sin((jd-2415020.0)/365.25*0.98565*DEG);
  return ayan;
}

function sunLongitude(jd){
  const T=(jd-J2000)/36525.0;
  const L0=normDeg(280.46646+36000.76983*T+0.0003032*T*T);
  const M=normDeg(357.52911+35999.05029*T-0.0001537*T*T);
  const Mrad=M*DEG;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mrad)+(0.019993-0.000101*T)*Math.sin(2*Mrad)+0.000289*Math.sin(3*Mrad);
  const trueLong=L0+C;
  const omega=125.04-1934.136*T;
  return normDeg(trueLong-0.00569-0.00478*Math.sin(omega*DEG));
}

function moonLongitude(jd){
  const T=(jd-J2000)/36525.0;
  const Lp=normDeg(218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841-T*T*T*T/65194000);
  const D=normDeg(297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868-T*T*T*T/113065000);
  const M=normDeg(357.5291092+35999.0502909*T-0.0001536*T*T+T*T*T/24490000);
  const Mp=normDeg(134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699-T*T*T*T/14712000);
  const F=normDeg(93.2720950+483202.0175233*T-0.0036539*T*T-T*T*T/3526000+T*T*T*T/863310000);
  const Dr=D*DEG,Mr=M*DEG,Mpr=Mp*DEG,Fr=F*DEG;
  let sumL=0;
  const terms=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
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
    [0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]];
  for (const [d,m,mp,f,coef] of terms) sumL += coef*Math.sin(d*Dr+m*Mr+mp*Mpr+f*Fr);
  return normDeg(Lp+sumL/1000000);
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

function solveKepler(M,e){
  let E=M;
  for (let i=0;i<50;i++){
    const dE=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
    E-=dE;
    if (Math.abs(dE)<1e-10) break;
  }
  return E;
}
function heliocentricPos(elements,T){
  const a=elements.a,e=elements.e,i=elements.i*DEG;
  const L=normDeg(elements.L+elements.Lrate*T)*DEG;
  const peri=normDeg(elements.peri+elements.periRate*T)*DEG;
  const node=normDeg(elements.node+elements.nodeRate*T)*DEG;
  const M=L-peri;
  const E=solveKepler(normDeg(M*RAD)*DEG,e);
  const xv=a*(Math.cos(E)-e), yv=a*(Math.sqrt(1-e*e)*Math.sin(E));
  const v=Math.atan2(yv,xv), r=Math.sqrt(xv*xv+yv*yv);
  const omega=peri-node;
  const xh=r*(Math.cos(node)*Math.cos(v+omega)-Math.sin(node)*Math.sin(v+omega)*Math.cos(i));
  const yh=r*(Math.sin(node)*Math.cos(v+omega)+Math.cos(node)*Math.sin(v+omega)*Math.cos(i));
  const zh=r*(Math.sin(v+omega)*Math.sin(i));
  return {x:xh,y:yh,z:zh,r};
}
function planetHeliocentric(name,jd){ return heliocentricPos(PLANET_ELEMENTS[name], (jd-J2000)/36525.0); }
function earthHeliocentric(jd){ return heliocentricPos(EARTH_ELEMENTS, (jd-J2000)/36525.0); }
function planetGeocentricLongitude(name,jd){
  const earth=earthHeliocentric(jd), planet=planetHeliocentric(name,jd);
  // The orbital elements are referred to the fixed J2000 equinox, but the ayanamsa is subtracted from TROPICAL-OF-DATE
  // longitudes (as for Sun/Moon/Rahu). Add the general precession since J2000 so all bodies share one frame.
  const Tc=(jd-J2000)/36525.0;
  return normDeg(Math.atan2(planet.y-earth.y, planet.x-earth.x)*RAD + 1.3969713*Tc + 0.0003086*Tc*Tc);
}
function isRetrograde(name,jd){
  if (name==="Rahu"||name==="Ketu") return true;
  if (name==="Sun"||name==="Moon") return false;
  const key = name.toLowerCase();
  const l1=planetGeocentricLongitude(key,jd-0.5), l2=planetGeocentricLongitude(key,jd+0.5);
  let diff=l2-l1; if (diff>180) diff-=360; if (diff<-180) diff+=360;
  return diff<0;
}
function rahuLongitude(jd){
  const T=(jd-J2000)/36525.0;
  return normDeg(125.0445479-1934.1362891*T+0.0020754*T*T+T*T*T/467441-T*T*T*T/60616000);
}

const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const PLANET_GLYPHS = {Sun:"☉",Moon:"☽",Mars:"♂",Mercury:"☿",Jupiter:"♃",Venus:"♀",Saturn:"♄",Rahu:"☊",Ketu:"☋"};
const OUTER_LIST = ["Uranus","Neptune","Pluto"];
const OUTER_SK = {Uranus:"Prajapati",Neptune:"Varuna",Pluto:"Yama"};
const OUTER_ORBIT_R = {Uranus:10.6,Neptune:10.95,Pluto:11.3};
const PLANET_COLORS = {Sun:"#FFD84A",Moon:"#D8DEE8",Mars:"#FF6B4A",Mercury:"#8FB3C9",Jupiter:"#E8B95C",Venus:"#F5E6C8",Saturn:"#8A9BB0",Rahu:"#7B6EC9",Ketu:"#C97B9E"};
Object.assign(PLANET_GLYPHS,{Uranus:"♅",Neptune:"♆",Pluto:"♇"});
Object.assign(PLANET_COLORS,{Uranus:"#7DE3E0",Neptune:"#5B7CFA",Pluto:"#C9A38A"});
const ALL_BODIES = PLANET_LIST.concat(OUTER_LIST); // outer planets are shown/plotted but are not part of Vedic aspect/yoga logic

function siderealLongitude(name,jd){
  const ayan=lahiriAyanamsa(jd);
  let tropical;
  switch(name){
    case "Sun": tropical=sunLongitude(jd); break;
    case "Moon": tropical=moonLongitude(jd); break;
    case "Mercury": tropical=planetGeocentricLongitude("mercury",jd); break;
    case "Venus": tropical=planetGeocentricLongitude("venus",jd); break;
    case "Mars": tropical=planetGeocentricLongitude("mars",jd); break;
    case "Jupiter": tropical=planetGeocentricLongitude("jupiter",jd); break;
    case "Saturn": tropical=planetGeocentricLongitude("saturn",jd); break;
    case "Uranus": case "Neptune": case "Pluto": tropical=planetGeocentricLongitude(name.toLowerCase(),jd); break;
    case "Rahu": return normDeg(rahuLongitude(jd)-ayan);
    case "Ketu": return normDeg(rahuLongitude(jd)-ayan+180);
  }
  return normDeg(tropical-ayan);
}

const SIGNS = [
  {name:"Aries",sk:"Mesha",lord:"Mars",symbol:"♈"},{name:"Taurus",sk:"Vrishabha",lord:"Venus",symbol:"♉"},
  {name:"Gemini",sk:"Mithuna",lord:"Mercury",symbol:"♊"},{name:"Cancer",sk:"Karka",lord:"Moon",symbol:"♋"},
  {name:"Leo",sk:"Simha",lord:"Sun",symbol:"♌"},{name:"Virgo",sk:"Kanya",lord:"Mercury",symbol:"♍"},
  {name:"Libra",sk:"Tula",lord:"Venus",symbol:"♎"},{name:"Scorpio",sk:"Vrishchika",lord:"Mars",symbol:"♏"},
  {name:"Sagittarius",sk:"Dhanu",lord:"Jupiter",symbol:"♐"},{name:"Capricorn",sk:"Makara",lord:"Saturn",symbol:"♑"},
  {name:"Aquarius",sk:"Kumbha",lord:"Saturn",symbol:"♒"},{name:"Pisces",sk:"Meena",lord:"Jupiter",symbol:"♓"}
];
const NAKSHATRAS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
  "Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula",
  "Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];

function getSignIndex(lon){ return Math.floor(normDeg(lon)/30); }
function getNakshatraIndex(lon){ return Math.floor(normDeg(lon)/(360/27)); }
function getDegInSign(lon){ return normDeg(lon)%30; }
function formatDeg(d){
  const deg=Math.floor(d), min=Math.floor((d-deg)*60);
  return `${deg}°${String(min).padStart(2,'0')}'`;
}

const AVG_DAILY_MOTION = {Sun:0.9856,Moon:13.176,Mars:0.524,Mercury:1.383,Jupiter:0.0831,Venus:1.2,Saturn:0.0334,Rahu:-0.0529,Ketu:-0.0529};

/* ============================================================================
   ASCENDANT (LAGNA) + HOUSES + GRAHA DRISHTI (VEDIC ASPECTS)
   ============================================================================ */
function siderealAscendant(jd, lat, lon){
  const T = (jd-J2000)/36525.0;
  let gmst = 280.46061837 + 360.98564736629*(jd-J2000) + 0.000387933*T*T - (T*T*T)/38710000.0;
  gmst = normDeg(gmst);
  const lst = normDeg(gmst + lon);
  const ramc = lst*DEG;
  const eps = (23.4392911 - 0.0130042*T)*DEG;
  const phi = lat*DEG;
  const y = -Math.cos(ramc);
  const x = Math.sin(ramc)*Math.cos(eps) + Math.tan(phi)*Math.sin(eps);
  // atan2(-cos, sin·cosε + tanφ·sinε) is the ascendant minus 180°, for EVERY sidereal time (the old code added the 180°
  // only when cos(RAMC) > 0, which put the ascendant exactly opposite for ~half of each day).
  let ascTropical = normDeg(Math.atan2(y,x)*RAD + 180);
  const ayan = lahiriAyanamsa(jd);
  return normDeg(ascTropical - ayan);
}

function getHouseOfLongitude(lon, lagnaSignIdx){
  const signIdx = getSignIndex(lon);
  return ((signIdx - lagnaSignIdx + 12) % 12) + 1;
}

const ASPECT_OFFSETS = {
  Sun: [7], Moon: [7], Mercury: [7], Venus: [7],
  Mars: [4,7,8],
  Jupiter: [5,7,9],
  Saturn: [3,7,10],
  Rahu: [5,7,9],
  Ketu: [5,7,9]
};
function computeAspects(sidereal){
  const results = [];
  PLANET_LIST.forEach(from=>{
    const fromSign = getSignIndex(sidereal[from]);
    const offsets = ASPECT_OFFSETS[from] || [7];
    offsets.forEach(off=>{
      const targetSign = (fromSign + (off-1)) % 12;
      PLANET_LIST.forEach(to=>{
        if (to===from) return;
        if (getSignIndex(sidereal[to]) === targetSign){
          results.push({ from, to, houseOffset: off, sign: targetSign });
        }
      });
    });
  });
  return results;
}

/* ----------------------------------------------------------------------------
   SIGN-LEVEL ASPECTS (Rashi Drishti) — every planet aspects certain *signs*
   by its graha-drishti offsets, whether or not another planet currently sits
   there. This is the "exactly which area (sign) each planet is aspecting
   right now" view: one row per planet → every sign it currently throws its
   gaze onto, independent of occupancy.
   ---------------------------------------------------------------------------- */
function computeSignAspects(sidereal){
  const results = [];
  PLANET_LIST.forEach(from=>{
    const fromSign = getSignIndex(sidereal[from]);
    const offsets = ASPECT_OFFSETS[from] || [7];
    offsets.forEach(off=>{
      const targetSign = (fromSign + (off-1)) % 12;
      const occupants = PLANET_LIST.filter(p => p!==from && getSignIndex(sidereal[p])===targetSign);
      results.push({ from, fromSign, houseOffset: off, targetSign, occupants });
    });
  });
  return results;
}

/* ----------------------------------------------------------------------------
   ASPECT EXPLORER — resolve "what does X aspect" / "what aspects X" for
   either a planet or a bare sign, in both directions.
   mode: 'planet' | 'sign'
   ---------------------------------------------------------------------------- */
function explorePlanetAspects(sidereal, planetName){
  const fromSign = getSignIndex(sidereal[planetName]);
  const offsets = ASPECT_OFFSETS[planetName] || [7];
  // Signs & planets this planet aspects (outgoing)
  const throwsTo = offsets.map(off=>{
    const targetSign = (fromSign + (off-1)) % 12;
    const occupants = PLANET_LIST.filter(p => p!==planetName && getSignIndex(sidereal[p])===targetSign);
    return { houseOffset: off, sign: targetSign, occupants };
  });
  // Planets that aspect this planet's sign (incoming)
  const receivesFrom = [];
  PLANET_LIST.forEach(other=>{
    if (other===planetName) return;
    const otherSign = getSignIndex(sidereal[other]);
    const otherOffsets = ASPECT_OFFSETS[other] || [7];
    otherOffsets.forEach(off=>{
      const targetSign = (otherSign + (off-1)) % 12;
      if (targetSign===fromSign){
        receivesFrom.push({ from: other, houseOffset: off });
      }
    });
  });
  return { planetName, fromSign, throwsTo, receivesFrom };
}

function exploreSignAspects(sidereal, signIdx){
  // Planets that aspect this sign (incoming), from wherever they sit
  const aspectedBy = [];
  PLANET_LIST.forEach(p=>{
    const pSign = getSignIndex(sidereal[p]);
    const offsets = ASPECT_OFFSETS[p] || [7];
    offsets.forEach(off=>{
      const targetSign = (pSign + (off-1)) % 12;
      if (targetSign===signIdx){
        aspectedBy.push({ from: p, fromSign: pSign, houseOffset: off });
      }
    });
  });
  // Planets currently occupying this sign, and what they in turn aspect out
  const occupants = PLANET_LIST.filter(p=> getSignIndex(sidereal[p])===signIdx);
  const occupantsThrow = occupants.map(p=>{
    const offsets = ASPECT_OFFSETS[p] || [7];
    const targets = offsets.map(off=> ({ houseOffset: off, sign: (signIdx + (off-1)) % 12 }));
    return { planet: p, targets };
  });
  return { signIdx, aspectedBy, occupants, occupantsThrow };
}
function computeNatalAscendant(profile){
  const natalJD = toJulianDay(...profile.dob.split('-').map(Number), ...profile.tob.split(':').map(Number), 0) - profile.tz/24;
  return { jd: natalJD, lagnaLon: siderealAscendant(natalJD, profile.lat, profile.lon) };
}

/* ============================================================================
   PLANET DETAIL HELPERS — degree-in-sign, nakshatra pada, instantaneous speed,
   and sign ingress/egress (exact crossing time) via binary search.
   ============================================================================ */
function degreeInSign(lon){
  const d = normDeg(lon) % 30;
  const deg = Math.floor(d);
  const minFloat = (d-deg)*60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat-min)*60);
  return { deg, min, sec, raw:d };
}
function getPadaIndex(lon){
  const nakSpan = 360/27; // 13.3333...
  const posInNak = normDeg(lon) % nakSpan;
  return Math.min(3, Math.floor(posInNak / (nakSpan/4))); // 0-3 -> pada 1-4
}
// Instantaneous speed in degrees/day (signed; negative = retrograde), central difference.
function planetSpeed(name, jd){
  const l1 = siderealLongitude(name, jd-0.25);
  const l2 = siderealLongitude(name, jd+0.25);
  let diff = l2-l1;
  if (diff>180) diff-=360; if (diff<-180) diff+=360;
  return diff*2; // per day
}
function speedCategory(name, jd){
  const s = Math.abs(planetSpeed(name,jd));
  if (name==="Rahu"||name==="Ketu") return "Steady (mean node)";
  if (s > 1.0) return "Fast";
  if (s > 0.3) return "Moderate";
  if (s > 0.02) return "Slow";
  return "Near-stationary";
}
// Find the JD (within +-searchDays of centerJD) at which `name` crosses the given
// absolute ecliptic longitude boundary (0-360, sidereal). Uses bisection on the
// signed angular distance to the boundary, assuming a single monotonic crossing
// in the search window (true for direct motion; for retrograde loops we search
// a narrower window seeded from the nearest crossing guess).
function findLongitudeCrossing(name, boundaryLon, guessJD, searchDays){
  function angDist(jd){
    let d = normDeg(siderealLongitude(name,jd) - boundaryLon);
    if (d>180) d-=360;
    return d; // negative = before boundary, positive = past it (in the body's direction of travel)
  }
  let lo = guessJD - searchDays, hi = guessJD + searchDays;
  let dLo = angDist(lo), dHi = angDist(hi);
  // opposite signs with large |d| is the ±180° wrap, not a crossing of the boundary
  if (Math.sign(dLo)===Math.sign(dHi) || Math.abs(dLo)>=90 || Math.abs(dHi)>=90){
    // Scan in reasonably fine steps to bracket the true crossing, since retrograde
    // loops can cross the same boundary more than once within the window.
    const steps = 200;
    const stepSize = (2*searchDays)/steps;
    let prevJD = lo, prevD = dLo;
    let found = false;
    for (let i=1;i<=steps;i++){
      const jd = lo + i*stepSize;
      const d = angDist(jd);
      if (Math.sign(d)!==Math.sign(prevD) && Math.abs(d)<90 && Math.abs(prevD)<90){ lo=prevJD; hi=jd; dLo=prevD; dHi=d; found=true; break; }
      prevJD=jd; prevD=d;
    }
    if (!found) return null;
  }
  for (let i=0;i<60;i++){
    const mid = (lo+hi)/2;
    const dMid = angDist(mid);
    if (Math.sign(dMid)===Math.sign(dLo)){ lo=mid; dLo=dMid; } else { hi=mid; dHi=dMid; }
    if (Math.abs(hi-lo) < 0.0001) break; // ~8.6 sec precision
  }
  return (lo+hi)/2;
}
// Returns { enterJD, exitJD, daysIn, daysLeft } for the sign that `name` occupies at jd.
// Rahu/Ketu move continuously retrograde (westward through the zodiac), so "enter" is
// the higher-longitude boundary and "exit" is the lower-longitude boundary, chronologically.
// enterJD/exitJD may be null if not found within the search window — caller handles gracefully.
/* Edges of the CURRENT continuous stay of `name` inside whatever zone idxFn() says it is in (sign or nakshatra):
   walk outward from jd until the zone changes, then bisect to the exact moment. Works through retrograde loops
   (the old boundary-crossing search could lock onto a crossing 180° away or from an earlier lap). */
function stayEdges(name, jd, idxFn, maxDays){
  const step = name==="Moon" ? 0.05 : (name==="Jupiter" ? 0.5 : (name==="Saturn" ? 1 : ((name==="Rahu"||name==="Ketu") ? 2 : 0.25)));
  const z0 = idxFn(siderealLongitude(name, jd));
  maxDays = maxDays || 16000;
  function edge(dir){
    let prev = jd;
    for (let d=step; d<=maxDays; d+=step){
      const cur = jd + dir*d;
      if (idxFn(siderealLongitude(name, cur)) !== z0){
        let inside = prev, outside = cur;
        for (let i=0;i<50 && Math.abs(outside-inside)>1e-7;i++){
          const mid = (inside+outside)/2;
          if (idxFn(siderealLongitude(name, mid)) === z0) inside = mid; else outside = mid;
        }
        return (inside+outside)/2;
      }
      prev = cur;
    }
    return null;
  }
  return { enterJD: edge(-1), exitJD: edge(1) };
}
// Returns { enterJD, exitJD, daysIn, daysLeft } for the sign that `name` occupies at jd (null = not found in range).
function getSignOccupancy(name, jd){
  const signIdx = getSignIndex(siderealLongitude(name, jd));
  const e = stayEdges(name, jd, getSignIndex);
  return { enterJD:e.enterJD, exitJD:e.exitJD,
           daysIn: e.enterJD!=null ? (jd-e.enterJD) : null,
           daysLeft: e.exitJD!=null ? (e.exitJD-jd) : null, signIdx };
}

function findIngresses(name,startJD,endJD){
  const events=[];
  const stepDays = name==="Moon" ? 0.5 : (Math.abs(AVG_DAILY_MOTION[name])>0.3 ? 1 : 2);
  let prevJD=startJD, prevSign=getSignIndex(siderealLongitude(name,prevJD));
  let jd=startJD+stepDays;
  while (jd<=endJD){
    const sign=getSignIndex(siderealLongitude(name,jd));
    if (sign!==prevSign){
      let lo=prevJD, hi=jd;
      for (let iter=0; iter<40; iter++){
        const mid=(lo+hi)/2;
        if (getSignIndex(siderealLongitude(name,mid))===prevSign) lo=mid; else hi=mid;
      }
      events.push({ jd:hi, fromSign:prevSign, toSign:getSignIndex(siderealLongitude(name,hi+0.001)) });
    }
    prevSign=sign; prevJD=jd; jd+=stepDays;
  }
  return events;
}

function findConjunctions(bodyA,bodyB,startJD,endJD,orb){
  orb = orb || 1.0;
  const events=[];
  const stepDays=1;
  let jd=startJD;
  let prevDiff=angDiff(siderealLongitude(bodyA,jd), siderealLongitude(bodyB,jd));
  jd+=stepDays;
  while (jd<=endJD){
    const diff=angDiff(siderealLongitude(bodyA,jd), siderealLongitude(bodyB,jd));
    // |diff|<90 on both sides: angDiff also flips sign when the bodies are 180° apart (opposition) - not a conjunction.
    if (((prevDiff>0&&diff<=0)||(prevDiff<0&&diff>=0)) && Math.abs(prevDiff)<90 && Math.abs(diff)<90){
      let lo=jd-stepDays, hi=jd;
      for (let iter=0; iter<40; iter++){
        const mid=(lo+hi)/2;
        const dmid=angDiff(siderealLongitude(bodyA,mid), siderealLongitude(bodyB,mid));
        if ((dmid>0)===(prevDiff>0)) lo=mid; else hi=mid;
      }
      const lon=siderealLongitude(bodyA,hi);
      events.push({ jd:hi, sign:getSignIndex(lon), longitude:lon });
    }
    prevDiff=diff; jd+=stepDays;
  }
  return events;
}

/* ---- Full position snapshot at a given JD (for 3D rendering + sky table) ---- */
function snapshotPositions(jd){
  const ayan = lahiriAyanamsa(jd);
  const helio = {};
  ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"].forEach(k=> helio[k]=planetHeliocentric(k,jd));
  const earth = earthHeliocentric(jd);
  const sidereal = {};
  ALL_BODIES.forEach(name=> sidereal[name] = siderealLongitude(name,jd));
  const retro = {};
  ALL_BODIES.forEach(name=> retro[name] = isRetrograde(name,jd));
  return { jd, ayanamsa: ayan, helio, earth, sidereal, retro };
}

/* ============================================================================
   3D SCENE — dual mode: Heliocentric solar system / Geocentric zodiac wheel
   ============================================================================ */
let scene, camera, renderer, clock3d;
const mode = "geo"; // Zodiac Wheel only
let orbitAngleTheta = 0.55, orbitAnglePhi = 1.15, orbitDist = 26;
let isDragging=false, lastPointer={x:0,y:0};
let pointerDownPos = null;
let autoRotate = true;
let needsRender = true;
const isMobile = window.innerWidth < 720 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
function markDirty(){ needsRender = true; }

/* ---- Camera mode: "orbit" (default, orbits scene origin) | "focus" (orbits a chosen planet)
   | "free" (fully free-fly, pilot the camera anywhere) ---- */
let camMode = "orbit";
let focusedPlanetKey = null; // e.g. "geo_Mars"
let freeCamPos = new THREE.Vector3(0, 8, 34);
let freeCamYaw = -1.57, freeCamPitch = -0.2; // radians
let freeMoveState = { fwd:0, right:0, up:0 };
let freeLookDrag = false, freeLookLast = {x:0,y:0};
const FREE_MOVE_SPEED = 18; // scene units / second
let lastFreeTickTime = null;

const bodyMeshes = {}; // name -> mesh
const clickRaycaster = new THREE.Raycaster();
clickRaycaster.params.Points = { threshold: 0.4 };

// Reverse-lookup: scene mesh -> canonical planet name (works for both helio_* and geo_* keys)
function meshKeyToPlanetName(key){
  if (!key) return null;
  const stripped = key.replace(/^(geo_|sol_)/, '');
  const capitalized = stripped.charAt(0).toUpperCase()+stripped.slice(1);
  if (ALL_BODIES.includes(capitalized)) return capitalized;
  return null;
}
const nakshatraLineGroup = new THREE.Group();

function clearNakshatraHighlight(){
  while(nakshatraLineGroup.children.length) nakshatraLineGroup.remove(nakshatraLineGroup.children[0]);
  if(labelNodes["nakshatra_highlight"] && labelNodes["nakshatra_highlight"].el) {
    labelNodes["nakshatra_highlight"].el.style.display = 'none';
  }
  markDirty();
}

function showNakshatraHighlight(nakIdx){
  if(!nakshatraLineGroup.parent && typeof scene !== 'undefined') scene.add(nakshatraLineGroup);
  clearNakshatraHighlight();
  
  const outerRingRadius = 13.5;
  const nakCenterAng = (nakIdx + 0.5) * (360 / 27) * DEG;
  
  // Starting point for the ray on the inner boundary of the Nakshatra track
  const ringPt = new THREE.Vector3(Math.cos(nakCenterAng) * (outerRingRadius - 0.3), 0, -Math.sin(nakCenterAng) * (outerRingRadius - 0.3));
  
  // Float label high above disk plane and outside the outer perimeter
  const labelPt = new THREE.Vector3(
    Math.cos(nakCenterAng) * (outerRingRadius + 1.8),
    1.2, // Lift vertically off the floor plane
    -Math.sin(nakCenterAng) * (outerRingRadius + 1.8)
  );

  // Get Lord & dynamic color
  const lord = NAKSHATRA_LORDS[nakIdx];
  const lordColorHex = PLANET_COLORS[lord] || "#00F0D5";
  const lordColorNum = parseInt(lordColorHex.replace('#', ''), 16);

  // 1. ADD GLOWING ARC TO THE SELECTED NAKSHATRA SEGMENT
  const a0 = (nakIdx * (360 / 27)) * DEG;
  const a1 = ((nakIdx + 1) * (360 / 27)) * DEG;

  // Intense core illumination
  const glowGeo = new THREE.RingGeometry(outerRingRadius - 0.32, outerRingRadius + 0.32, 16, 1, -a1, a1 - a0);
  const glowMat = new THREE.MeshBasicMaterial({
    color: lordColorNum,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.rotation.x = Math.PI / 2;
  glowMesh.position.y = 0.03; 
  nakshatraLineGroup.add(glowMesh);

  // Soft radiant halo bloom
  const haloGeo = new THREE.RingGeometry(outerRingRadius - 0.55, outerRingRadius + 0.55, 16, 1, -a1, a1 - a0);
  const haloMat = new THREE.MeshBasicMaterial({
    color: lordColorNum,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.rotation.x = Math.PI / 2;
  haloMesh.position.y = 0.02;
  nakshatraLineGroup.add(haloMesh);

  // 2. CREATE / UPDATE FLOATING LABEL
  if(!labelNodes["nakshatra_highlight"]){
    const el = document.createElement('div');
    el.className = 'planet-label';
    el.style.fontWeight = '700';
    el.style.fontSize = '12px';
    el.style.background = 'rgba(10, 15, 26, 0.9)';
    el.style.padding = '6px 12px';
    el.style.borderRadius = '8px';
    el.style.backdropFilter = 'blur(8px)';
    el.style.zIndex = '50';
    el.style.whiteSpace = 'nowrap';
    document.getElementById('planetLabels').appendChild(el);
    labelNodes["nakshatra_highlight"] = { el, isSign: false };
  }
  
  const el = labelNodes["nakshatra_highlight"].el;
  
  if(!bodyMeshes["nakshatra_highlight"]){
    const anchor = new THREE.Object3D();
    scene.add(anchor);
    bodyMeshes["nakshatra_highlight"] = anchor;
  }
  bodyMeshes["nakshatra_highlight"].position.copy(labelPt);
  
  // 3. SHOOT BEAM TO OCCUPYING PLANETS AT EXACT DEGREE & CALCULATE TRANSIT TIMINGS
  const snap = snapshotPositions(currentJD);
  const planetOrbitRadius = { Sun:4, Moon:2.6, Mercury:5, Venus:6, Mars:7, Jupiter:8, Saturn:9.2, Rahu:10.2, Ketu:10.2, Uranus:10.6, Neptune:10.95, Pluto:11.3 };
  let found = false;
  let occupantsHtml = '';

  PLANET_LIST.forEach(name=>{
    const lon = snap.sidereal[name];
    if(getNakshatraIndex(lon) === nakIdx){
      found = true;
      const r = planetOrbitRadius[name];
      
      // Calculate origin point on the outer ring matching the planet's EXACT degree
      const exactRingPt = new THREE.Vector3(
        Math.cos(lon * DEG) * (outerRingRadius - 0.3), 
        0, 
        -Math.sin(lon * DEG) * (outerRingRadius - 0.3)
      );
      
      // Destination point at the planet's exact orbital position
      const pPt = new THREE.Vector3(
        r * Math.cos(lon * DEG), 
        0, 
        -r * Math.sin(lon * DEG)
      );
      
      const geo = new THREE.BufferGeometry().setFromPoints([exactRingPt, pPt]);
      const mat = new THREE.LineBasicMaterial({ color: lordColorNum, transparent: true, opacity: 0.95, linewidth: 2 });
      nakshatraLineGroup.add(new THREE.Line(geo, mat));

      // Calculate exact Nakshatra entry/exit times (edges of the current continuous stay)
      const nakEdges = stayEdges(name, currentJD, getNakshatraIndex);
      let enterJD = nakEdges.enterJD, exitJD = nakEdges.exitJD;

      const enterStr = enterJD ? formatFullDate(enterJD) : 'Beyond range';
      const exitStr = exitJD ? formatFullDate(exitJD) : 'Beyond range';
      
      // Build the interior mini-timeline for this planet
      occupantsHtml += `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid ${lordColorHex}44; font-size: 10.5px; font-family: var(--font-mono); color: var(--text);">
          <div style="margin-bottom:4px;"><span style="color:${PLANET_COLORS[name]}; font-size:12px; font-family:var(--font-ui);">${PLANET_GLYPHS[name]}</span> <b style="font-family:var(--font-ui); font-size:11px;">${name}</b></div>
          <div style="color:var(--text-dim); margin-bottom: 2px;">In : <span style="color:var(--cyan);">${enterStr}</span></div>
          <div style="color:var(--text-dim);">Out: <span style="color:var(--cyan);">${exitStr}</span></div>
        </div>
      `;
    }
  });

  // Apply Name + Embedded Planet Timelines
  el.innerHTML = `✦ ${NAKSHATRAS[nakIdx]} <span style="font-size:10px; opacity:0.8;">(${lord})</span>` + occupantsHtml;
  el.style.color = lordColorHex;
  el.style.border = `1.5px solid ${lordColorHex}`;
  el.style.boxShadow = `0 0 16px ${lordColorHex}44, inset 0 0 8px ${lordColorHex}22`;
  el.style.textShadow = `0 0 10px ${lordColorHex}`;

  if(!found){
     // Draw a small inward tick from the center of the Nakshatra if unoccupied
     const stubPt = new THREE.Vector3(Math.cos(nakCenterAng) * 12.2, 0, -Math.sin(nakCenterAng) * 12.2);
     const geo = new THREE.BufferGeometry().setFromPoints([ringPt, stubPt]);
     const mat = new THREE.LineBasicMaterial({ color: lordColorNum, transparent: true, opacity: 0.5 });
     nakshatraLineGroup.add(new THREE.Line(geo, mat));
  }
  
  labelNodes["nakshatra_highlight"].el.style.display = '';
  markDirty();
}

function handleCanvasClick(e){
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX-rect.left)/rect.width)*2-1,
    -((e.clientY-rect.top)/rect.height)*2+1
  );
  clickRaycaster.setFromCamera(ndc, camera);
  clickRaycaster.params.Line = { threshold: 0.8 }; // Larger threshold makes tapping lines easier on mobile

  const candidateMeshes = Object.entries(bodyMeshes)
    .filter(([key,m])=> !key.startsWith('signlabel_') && !key.startsWith('nakshatra_') && !key.startsWith('ghost_') && m.visible!==false && !(m.parent && m.parent.visible===false))
    .map(([key,mesh])=>({key,mesh}));
  
  const hits = clickRaycaster.intersectObjects(candidateMeshes.map(c=>c.mesh), false);
  if (hits.length) {
    const hitMesh = hits[0].object;
    const found = candidateMeshes.find(c=>c.mesh===hitMesh);
    if (found) {
      const planetName = meshKeyToPlanetName(found.key);
      if (planetName) openPlanetDetail(planetName, currentJD);
    }
    return;
  }

  // If we missed planets, check if we hit the Zodiac Ring to trigger Nakshatra highlights
  if (mode === "geo") {
    const ringHits = clickRaycaster.intersectObjects(zodiacRingGroup.children, false);
    if (ringHits.length) {
      const pt = ringHits[0].point;
      let ang = normDeg(Math.atan2(-pt.z, pt.x) * RAD);
      showNakshatraHighlight(Math.floor(ang / (360/27)));
    } else {
      clearNakshatraHighlight();
    }
  } else {
    clearNakshatraHighlight();
  }
}
const orbitLines = {}; // name -> line
const zodiacRingGroup = new THREE.Group();


function initScene(){
  scene = new THREE.Scene();
  const canvas = document.getElementById('canvas3d');
  const vp = document.querySelector('.viewport');
  camera = new THREE.PerspectiveCamera(50, vp.clientWidth/vp.clientHeight, 0.1, 2000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha:true, powerPreference:"default" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.75));
  renderer.setSize(vp.clientWidth, vp.clientHeight);

  // Gorgeous Multi-layered Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = isMobile ? 800 : 3500;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  
  const colorPalette = [new THREE.Color(0xffffff), new THREE.Color(0x99ccff), new THREE.Color(0xffcc99), new THREE.Color(0x5599ff)];
  
  for (let i = 0; i < starCount; i++) {
    const r = 300 + Math.random() * 800;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.cos(phi);
    starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    
    // Varying star colors for depth and realism
    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    starColors[i*3] = col.r;
    starColors[i*3+1] = col.g;
    starColors[i*3+2] = col.b;
  }
  
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  
  // Custom glowing star material
  const starMat = new THREE.PointsMaterial({ 
    size: isMobile ? 1.5 : 2.0, 
    vertexColors: true, 
    sizeAttenuation: true, 
    transparent: true, 
    opacity: 0.9,
    map: (function(){
        const cvs = document.createElement('canvas'); cvs.width = 16; cvs.height = 16;
        const ctx = cvs.getContext('2d');
        const grad = ctx.createRadialGradient(8,8,0, 8,8,8);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,16,16);
        return new THREE.CanvasTexture(cvs);
    })(),
    depthWrite: false, 
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // Cinematic Lighting Setup
  // Hemisphere light gives a subtle dark space ambience to the unlit sides of planets
  scene.add(new THREE.HemisphereLight(0x0a1220, 0x050810, 3.0)); 
  
  // The Sun's actual light source (intense, warm)
  const sunLight = new THREE.PointLight(0xFFFFFF, 3.5, 0, 0.1); 
  scene.add(sunLight); window._wheelSunLight = sunLight;
  
  // Subtle blue rim light for 3D volume
  const rimLight = new THREE.DirectionalLight(0x4F9BE0, 0.8);
  rimLight.position.set(-100, 50, -50);
  scene.add(rimLight);

  scene.add(zodiacRingGroup);
  scene.add(aspectLineGroup);

  buildZodiacRingGroup();
  enhanceZodiac();
  drawBorders();
  zodiacRingGroup.visible = true;
  aspectLineGroup.visible = false;

  canvas.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    isDragging=true; lastPointer={x:e.clientX,y:e.clientY}; autoRotate=false;
    pointerDownPos = {x:e.clientX,y:e.clientY};
    markDirty();
  });
  window.addEventListener('pointerup', (e)=>{
    isDragging=false;
    if (pointerDownPos){
      const moved = Math.hypot(e.clientX-pointerDownPos.x, e.clientY-pointerDownPos.y);
      if (moved < 6) handleCanvasClick(e); // treat as a tap/click, not a drag
    }
    pointerDownPos = null;
  });
  window.addEventListener('pointercancel', ()=> isDragging=false);
  window.addEventListener('pointermove', (e)=>{
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX-lastPointer.x, dy = e.clientY-lastPointer.y;
    if (camMode==="free"){
      freeCamYaw += dx*0.005;
      freeCamPitch = Math.max(-1.5, Math.min(1.5, freeCamPitch - dy*0.005));
    } else {
      orbitAngleTheta -= dx*0.006;
      orbitAnglePhi = Math.max(0.15, Math.min(Math.PI-0.15, orbitAnglePhi - dy*0.006));
    }
    lastPointer = {x:e.clientX,y:e.clientY};
    markDirty();
  }, {passive:false});

  // Pinch-to-zoom (two-finger touch)
  let pinchStartDist = null, pinchStartOrbit = null;
  canvas.addEventListener('touchstart', (e)=>{
    if (e.touches.length===2){
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx,dy);
      pinchStartOrbit = orbitDist;
    }
  }, {passive:true});
  canvas.addEventListener('touchmove', (e)=>{
    if (e.touches.length===2 && pinchStartDist){
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx,dy);
      const scale = pinchStartDist/dist;
      orbitDist = clampZoom(pinchStartOrbit*scale);
      markDirty();
    }
  }, {passive:false});
  canvas.addEventListener('touchend', (e)=>{ if (e.touches.length<2) pinchStartDist=null; }, {passive:true});
  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    if (camMode==="free"){
      const forward = new THREE.Vector3(Math.cos(freeCamPitch)*Math.cos(freeCamYaw), Math.sin(freeCamPitch), Math.cos(freeCamPitch)*Math.sin(freeCamYaw));
      freeCamPos.addScaledVector(forward, -e.deltaY*0.03);
    } else {
      orbitDist = clampZoom(SOL.view==="solar" ? orbitDist*(1 + e.deltaY*0.0012) : orbitDist + e.deltaY*0.02);
    }
    markDirty();
  }, {passive:false});

  // Keyboard controls for free-fly (desktop): WASD/arrows to move, Q/E for down/up
  window.addEventListener('keydown', (e)=>{
    if (camMode!=="free") return;
    switch(e.code){
      case 'KeyW': case 'ArrowUp': freeMoveState.fwd = 1; break;
      case 'KeyS': case 'ArrowDown': freeMoveState.fwd = -1; break;
      case 'KeyA': case 'ArrowLeft': freeMoveState.right = -1; break;
      case 'KeyD': case 'ArrowRight': freeMoveState.right = 1; break;
      case 'KeyE': freeMoveState.up = 1; break;
      case 'KeyQ': freeMoveState.up = -1; break;
    }
  });
  window.addEventListener('keyup', (e)=>{
    switch(e.code){
      case 'KeyW': case 'ArrowUp': case 'KeyS': case 'ArrowDown': freeMoveState.fwd = 0; break;
      case 'KeyA': case 'ArrowLeft': case 'KeyD': case 'ArrowRight': freeMoveState.right = 0; break;
      case 'KeyE': case 'KeyQ': freeMoveState.up = 0; break;
    }
  });

  setupFreeFlyJoystick();

  window.addEventListener('resize', onResize);
  onResize();
}

/* ---- Mobile joystick for Free Fly movement + on-screen up/down buttons ---- */
function setupFreeFlyJoystick(){
  const stickBase = document.getElementById('ffStickBase');
  const stickNub = document.getElementById('ffStickNub');
  let stickActive = false, stickCenter = {x:0,y:0};
  const maxRadius = 36;

  function stickPointerDown(e){
    stickActive = true;
    const rect = stickBase.getBoundingClientRect();
    stickCenter = { x: rect.left+rect.width/2, y: rect.top+rect.height/2 };
    e.preventDefault();
  }
  function stickPointerMove(e){
    if (!stickActive) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    let dx = touch.clientX - stickCenter.x, dy = touch.clientY - stickCenter.y;
    const dist = Math.min(maxRadius, Math.hypot(dx,dy));
    const ang = Math.atan2(dy,dx);
    dx = Math.cos(ang)*dist; dy = Math.sin(ang)*dist;
    stickNub.style.transform = `translate(${dx}px, ${dy}px)`;
    freeMoveState.fwd = -dy/maxRadius;
    freeMoveState.right = dx/maxRadius;
  }
  function stickPointerUp(e){
    stickActive = false;
    stickNub.style.transform = `translate(0px,0px)`;
    freeMoveState.fwd = 0; freeMoveState.right = 0;
  }
  stickBase.addEventListener('touchstart', stickPointerDown, {passive:false});
  stickBase.addEventListener('touchmove', stickPointerMove, {passive:false});
  stickBase.addEventListener('touchend', stickPointerUp, {passive:false});
  stickBase.addEventListener('mousedown', stickPointerDown);
  window.addEventListener('mousemove', stickPointerMove);
  window.addEventListener('mouseup', stickPointerUp);

  const upBtn = document.getElementById('ffUpBtn'), downBtn = document.getElementById('ffDownBtn');
  const bindHold = (btn, val)=>{
    const start = (e)=>{ e.preventDefault(); freeMoveState.up = val; };
    const end = (e)=>{ freeMoveState.up = 0; };
    btn.addEventListener('touchstart', start, {passive:false});
    btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  };
  bindHold(upBtn, 1);
  bindHold(downBtn, -1);
}

function onResize(){
  const vp = document.querySelector('.viewport');
  camera.aspect = vp.clientWidth/vp.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(vp.clientWidth, vp.clientHeight);
  markDirty();
}

/* ---- PROCEDURAL TEXTURE GENERATORS ---- */
function generatePlanetTexture(name, hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Base fill
  ctx.fillStyle = '#' + hexColor.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, w, h);

  // Generic surface noise (simulates craters and rock textures)
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = Math.random() * 2.5;
    ctx.fillStyle = Math.random() > 0.5 ? '#000000' : '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  
  ctx.globalAlpha = 1.0;

  // Planet-specific features
  if (name === 'Jupiter' || name === 'Saturn') {
    const bands = name === 'Jupiter' ? 20 : 12;
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * h;
      const bh = (1 / bands) * h * (0.3 + Math.random() * 0.7);
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,60,0,0.18)';
      ctx.fillRect(0, y, w, bh);
    }
    if (name === 'Jupiter') {
      // Great Red Spot
      ctx.fillStyle = 'rgba(180, 60, 20, 0.5)';
      ctx.beginPath(); ctx.ellipse(w * 0.6, h * 0.65, 35, 15, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (name === 'Earth') {
    // Green Continents
    ctx.fillStyle = '#2b6a3a'; 
    for (let i = 0; i < 40; i++) {
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 15 + Math.random() * 30, 0, Math.PI * 2); ctx.fill();
    }
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 0, Math.PI * 2); ctx.fill();
    }
  } else if (name === 'Mars') {
    // Rusty patches
    ctx.fillStyle = 'rgba(80, 20, 0, 0.35)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 0, Math.PI * 2); ctx.fill();
    }
    // Ice caps
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(0, 0, w, 20);
    ctx.fillRect(0, h - 20, w, 20);
  } else if (name === 'Sun') {
    // Solar flares/plasma
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 40);
      grad.addColorStop(0, 'rgba(255, 230, 120, 0.8)');
      grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
    }
  } else if (name === 'Venus') {
    // Thick atmosphere layers
    ctx.fillStyle = 'rgba(255, 240, 200, 0.4)';
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(0, Math.random() * h, w, 20 + Math.random() * 30);
    }
  } else if (name === 'Moon' || name === 'Mercury') {
    // Extreme craters
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 5 + Math.random() * 15;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function generateRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, 'rgba(232, 185, 92, 0.1)');
  grad.addColorStop(0.2, 'rgba(232, 185, 92, 0.8)');
  grad.addColorStop(0.5, 'rgba(232, 185, 92, 0.3)');
  grad.addColorStop(0.8, 'rgba(232, 185, 92, 0.9)');
  grad.addColorStop(1, 'rgba(232, 185, 92, 0.0)');
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, 1);
  return new THREE.CanvasTexture(canvas);
}

function makeSphere(radius, colorHex, emissiveHex, name){
  const geo = new THREE.SphereGeometry(radius, 64, 64); // Ultra-high poly sphere
  const isSun = name === 'Sun';
  
  // Upgrade to Physical Material for hyper-realistic lighting & clearcoat reflections
  const matOpts = { 
    color: colorHex, 
    roughness: (name === 'Earth' || name === 'Venus') ? 0.3 : 0.8, 
    metalness: (name === 'Earth' || name === 'Venus') ? 0.1 : 0.3,
    clearcoat: name === 'Earth' ? 0.4 : 0.0,
    clearcoatRoughness: 0.2
  };

  if (emissiveHex) {
    matOpts.emissive = emissiveHex;
    matOpts.emissiveIntensity = 0.6;
  }

  if (name) {
    matOpts.map = generatePlanetTexture(name, colorHex);
    
    // Auto-generate realistic bump maps from the procedural texture to give mountains/craters depth
    if (['Moon', 'Mercury', 'Mars'].includes(name)) {
      matOpts.bumpMap = matOpts.map;
      matOpts.bumpScale = name === 'Mars' ? 0.06 : 0.09;
    }
    
    if (isSun) {
      matOpts.emissiveMap = matOpts.map;
      matOpts.emissive = colorHex;
      matOpts.emissiveIntensity = 2.5; // Brighter sun core
      matOpts.roughness = 1.0;
    }
  }

  const mat = new THREE.MeshPhysicalMaterial(matOpts);
  const mesh = new THREE.Mesh(geo, mat);

  // Saturn's Rings
  if (name === 'Saturn') {
     const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 2.4, 64);
     
     // Correct UV mapping so linear gradient wraps in a circle
     const pos = ringGeo.attributes.position;
     const v3 = new THREE.Vector3();
     for (let i = 0; i < pos.count; i++){
        v3.fromBufferAttribute(pos, i);
        const r = v3.length();
        const uvX = (r - radius * 1.4) / (radius * 2.4 - radius * 1.4);
        ringGeo.attributes.uv.setXY(i, uvX, 0.5);
     }
     
     const ringMat = new THREE.MeshStandardMaterial({
        color: 0xffeebb, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
        map: generateRingTexture(), roughness: 0.8
     });
     const ring = new THREE.Mesh(ringGeo, ringMat);
     ring.rotation.x = Math.PI / 2 + 0.15; // Realistic tilt
     mesh.add(ring);
  }

  // Cinematic Atmospheric Glows (Multi-layered Additive Blending)
  if (name === 'Earth') {
     const atmosGeo = new THREE.SphereGeometry(radius * 1.04, 32, 32);
     const atmosMat = new THREE.MeshBasicMaterial({ color: 0x66B0FF, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(atmosGeo, atmosMat));
     
     const outerAtmosGeo = new THREE.SphereGeometry(radius * 1.15, 32, 32);
     const outerAtmosMat = new THREE.MeshBasicMaterial({ color: 0x2266FF, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(outerAtmosGeo, outerAtmosMat));
  } else if (name === 'Venus') {
     const atmosGeo = new THREE.SphereGeometry(radius * 1.05, 32, 32);
     const atmosMat = new THREE.MeshBasicMaterial({ color: 0xFFD280, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(atmosGeo, atmosMat));
  } else if (isSun) {
     const glowGeo = new THREE.SphereGeometry(radius * 1.3, 48, 48);
     const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFEA8C, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(glowGeo, glowMat));
     
     const coronaGeo = new THREE.SphereGeometry(radius * 1.9, 32, 32);
     const coronaMat = new THREE.MeshBasicMaterial({ color: 0xFF7700, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(coronaGeo, coronaMat));
     
     const haloGeo = new THREE.SphereGeometry(radius * 3.0, 32, 32);
     const haloMat = new THREE.MeshBasicMaterial({ color: 0x882200, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(haloGeo, haloMat));
  } else if (name === 'Rahu' || name === 'Ketu') {
     matOpts.transparent = true; matOpts.opacity = 0.85; mat.needsUpdate = true;
     const glowGeo = new THREE.SphereGeometry(radius * 1.3, 32, 32);
     const glowMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending });
     mesh.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return mesh;
}

function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

const SIGN_COLORS = [0xD64545,0x4F9A5F,0xE0C34A,0x8FB8D8,0xE8892F,0x7A9A5A,0xE07FAE,0x9B2D47,0x8458C9,0x5E6E86,0x3FA7E0,0x2FB9A8];
const signHex = i => '#' + SIGN_COLORS[i].toString(16).padStart(6,'0');
function buildZodiacRingGroup(){
  const ringRadius = 12;
  // 12 sign sectors.
  // NOTE on coordinate convention: every planet marker, aspect line, and the
  // sign-label anchors below place world position as
  //   (cos(lon)*r, 0, -sin(lon)*r)
  // RingGeometry is authored in its own local XY plane (theta measured the
  // normal/counter-clockwise way) and then rotated flat with rotation.x =
  // Math.PI/2, which maps local angle theta -> world (cos(theta)*r, 0,
  // sin(theta)*r) — the OPPOSITE z-sign from planets. Left as-is, the sign
  // wedges/labels render mirrored across the Aries–Libra axis relative to
  // where the actual planet markers sit. To match, we negate the angle
  // (thetaStart = -a1, sweeping by +(a1-a0)) so local theta = -ang.
  for (let i=0;i<12;i++){
    const a0 = (i*30)*DEG, a1=((i+1)*30)*DEG;
    const shape = new THREE.RingGeometry(ringRadius-0.6, ringRadius+0.6, 32, 1, -a1, a1-a0);
    const mat = new THREE.MeshBasicMaterial({ color: SIGN_COLORS[i], side:THREE.DoubleSide, transparent:true, opacity:0.92 });
    const mesh = new THREE.Mesh(shape, mat);
    mesh.rotation.x = Math.PI/2;
    zodiacRingGroup.add(mesh);
  }
  // Divider lines every 30deg (uses the SAME -sin(z) convention as planet
  // markers / aspect lines / sign-label anchors below, so the wedge grid
  // lines up exactly with where planets actually render — previously this
  // used +sin(z) while everything else used -sin(z), causing the whole
  // sign grid & nakshatra ticks to render mirrored relative to the planets)
  for (let i=0;i<12;i++){
    const ang = (i*30)*DEG;
    const pts = [ new THREE.Vector3(Math.cos(ang)*(ringRadius-0.6),0,-Math.sin(ang)*(ringRadius-0.6)),
                  new THREE.Vector3(Math.cos(ang)*(ringRadius+0.6),0,-Math.sin(ang)*(ringRadius+0.6)) ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x5A7A9B}));
    zodiacRingGroup.add(line);
  }
  // Nakshatra boundary ticks & New Outer Nakshatra Circle
  const outerRingRadius = 13.5;
  for (let i=0;i<27;i++){
    const ang = (i*(360/27))*DEG;
    // Inner ticks on main zodiac ring
    const pts = [ new THREE.Vector3(Math.cos(ang)*(ringRadius-0.25),0,-Math.sin(ang)*(ringRadius-0.25)),
                  new THREE.Vector3(Math.cos(ang)*(ringRadius+0.25),0,-Math.sin(ang)*(ringRadius+0.25)) ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x2A3A55, transparent:true, opacity:0.6}));
    zodiacRingGroup.add(line);
    
    // Outer Nakshatra ring ticks
    const ptsOuter = [ new THREE.Vector3(Math.cos(ang)*(outerRingRadius-0.3),0,-Math.sin(ang)*(outerRingRadius-0.3)),
                       new THREE.Vector3(Math.cos(ang)*(outerRingRadius+0.3),0,-Math.sin(ang)*(outerRingRadius+0.3)) ];
    const geoOuter = new THREE.BufferGeometry().setFromPoints(ptsOuter);
    const lineOuter = new THREE.Line(geoOuter, new THREE.LineBasicMaterial({color:0x3A4A65, transparent:true, opacity:0.4}));
    zodiacRingGroup.add(lineOuter);
  }
  
  // 27 Colored Nakshatra arcs filled with their ruling Lord's color
  for (let i = 0; i < 27; i++) {
    const lord = NAKSHATRA_LORDS[i];
    const lordColorHex = parseInt((PLANET_COLORS[lord] || "#00F0D5").replace('#', ''), 16);
    
    // Calculate precise start and end angles, inverted for 3D orientation (-a1, a1-a0)
    const a0 = (i * (360 / 27)) * DEG;
    const a1 = ((i + 1) * (360 / 27)) * DEG;
    
    // Create a thick, colored wedge for each Nakshatra
    const arcGeo = new THREE.RingGeometry(outerRingRadius - 0.3, outerRingRadius + 0.3, 12, 1, -a1, a1 - a0);
    const arcMat = new THREE.MeshBasicMaterial({ 
      color: lordColorHex, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.42 // Subtle transparency so it looks glowing but not overwhelming
    });
    
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.rotation.x = Math.PI / 2;
    zodiacRingGroup.add(arcMesh);
  }
  
  // Thin boundary line to contain the colored arcs neatly on the outside
  const outerTrackGeo = new THREE.RingGeometry(outerRingRadius + 0.3, outerRingRadius + 0.34, 128);
  const outerTrackMat = new THREE.MeshBasicMaterial({ color: 0x3A4A65, side:THREE.DoubleSide, transparent:true, opacity:0.5 });
  const outerTrackMesh = new THREE.Mesh(outerTrackGeo, outerTrackMat);
  outerTrackMesh.rotation.x = Math.PI/2;
  zodiacRingGroup.add(outerTrackMesh);
  
  // Earth at center
  const earth = makeSphere(0.5, 0x4F9BE0, 0, 'Earth');
  zodiacRingGroup.add(earth);
  bodyMeshes["geo_earth"] = earth;

  // Planet markers
  const planetOrbitRadius = { Sun:4, Moon:2.6, Mercury:5, Venus:6, Mars:7, Jupiter:8, Saturn:9.2, Rahu:10.2, Ketu:10.2, Uranus:10.6, Neptune:10.95, Pluto:11.3 };
  ALL_BODIES.forEach(name=>{
    const mesh = makeSphere(name==="Sun"?0.5: name==="Moon"?0.4: OUTER_LIST.includes(name)?0.26:0.32, parseInt(PLANET_COLORS[name].replace('#',''),16), name==="Sun"?0xFFB347:0, name);
    zodiacRingGroup.add(mesh);
    bodyMeshes["geo_"+name] = mesh;
  });

  // Invisible anchor points for HTML sign-name labels
  for (let i=0;i<12;i++){
    const midAng = ((i*30)+15)*DEG;
    const anchor = new THREE.Object3D();
    anchor.position.set(Math.cos(midAng)*(ringRadius+1.5), 0, -Math.sin(midAng)*(ringRadius+1.5));
    zodiacRingGroup.add(anchor);
    bodyMeshes["signlabel_"+i] = anchor;
  }
}

/* ============================================================================
   VISUAL ENHANCEMENT: atmospheres, coronas, Saturn rings, orbit tracks, elemental zodiac
   ============================================================================ */
function _atmo(hex, power, k){
  return new THREE.ShaderMaterial({
    uniforms:{ c:{ value:new THREE.Color(hex) } },
    vertexShader:'varying vec3 n; varying vec3 v; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader:'uniform vec3 c; varying vec3 n; varying vec3 v; void main(){ float f=pow(1.0-abs(dot(n,v)),'+power.toFixed(1)+'); gl_FragColor=vec4(c*f*'+k.toFixed(2)+',f); }',
    blending:THREE.AdditiveBlending, transparent:true, depthWrite:false });
}
function enhanceZodiac(){
  const ORBIT = { Sun:4, Moon:2.6, Mercury:5, Venus:6, Mars:7, Jupiter:8, Saturn:9.2, Rahu:10.2, Ketu:10.2, Uranus:10.6, Neptune:10.95, Pluto:11.3 };
  const ATMO = { Earth:[0x4F9BE0,2.2,1.6], Venus:[0xFFD9A0,2.4,1.3], Mars:[0xFF7B4A,3.2,0.9], Jupiter:[0xFFC999,2.6,1.1], Saturn:[0xF0DCA0,2.6,1.1], Mercury:[0xBBBBBB,3.5,0.6], Moon:[0xCFD8FF,3.2,0.8], Rahu:[0x7B6EC9,1.6,2.0], Ketu:[0xC97B9E,1.6,2.0], Uranus:[0x7DE3E0,2.2,1.0], Neptune:[0x5B7CFA,2.4,1.1] };
  const addGlow = (mesh, hex, scale, op)=>{ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:_glowTex(), color:hex, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false })); sp.scale.set(scale,scale,1); mesh.add(sp); };
  const bodies = { geo_earth:'Earth' }; ALL_BODIES.forEach(n=> bodies['geo_'+n] = n);
  for (const key in bodies){
    const mesh = bodyMeshes[key], name = bodies[key]; if (!mesh) continue;
    const r = mesh.geometry.parameters.radius;
    if (name === 'Sun'){
      addGlow(mesh, 0xFFB347, r*4.5, 0.55);
    } else {
      const a = ATMO[name]; if (a) mesh.add(new THREE.Mesh(new THREE.SphereGeometry(r*1.16, 48, 48), _atmo(a[0], a[1]+0.6, a[2]*0.45)));
      addGlow(mesh, a ? a[0] : 0xFFFFFF, r*3, 0.1);
    }
    if (name === 'Saturn'){
      mesh.userData.noSpin = true;
      const c = document.createElement('canvas'); c.width = 512; c.height = 4; const x = c.getContext('2d');
      const g = x.createLinearGradient(0,0,512,0);
      [[0,'rgba(0,0,0,0)'],[0.08,'rgba(190,170,130,0.55)'],[0.3,'rgba(235,215,165,0.9)'],[0.45,'rgba(120,100,70,0.25)'],[0.52,'rgba(240,222,175,0.95)'],[0.8,'rgba(210,190,145,0.75)'],[0.93,'rgba(170,150,110,0.35)'],[1,'rgba(0,0,0,0)']].forEach(([p,col])=> g.addColorStop(p,col));
      x.fillStyle = g; x.fillRect(0,0,512,4);
      const rg = new THREE.RingGeometry(r*1.45, r*2.45, 96, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
      for (let i=0;i<pos.count;i++){ const d = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (d - r*1.45)/(r), 0.5); }
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, side:THREE.DoubleSide, depthWrite:false }));
      ring.rotation.x = -Math.PI/2 + 0.42; mesh.add(ring);
    }
  }
  // soft orbit tracks
  [...new Set(Object.values(ORBIT))].forEach(rad=>{
    const m = new THREE.Mesh(new THREE.RingGeometry(rad-0.012, rad+0.012, 180), new THREE.MeshBasicMaterial({ color:0x8FB4FF, transparent:true, opacity:0.05, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false }));
    m.rotation.x = Math.PI/2; zodiacRingGroup.add(m);
  });
  // zodiac: nebula disc, elemental wedges, glowing rims and gems
  const dc = document.createElement('canvas'); dc.width = dc.height = 256; const dx = dc.getContext('2d');
  const dg = dx.createRadialGradient(128,128,0,128,128,128);
  dg.addColorStop(0,'rgba(123,110,246,0.1)'); dg.addColorStop(0.7,'rgba(0,240,213,0.03)'); dg.addColorStop(1,'rgba(0,0,0,0)');
  dx.fillStyle = dg; dx.fillRect(0,0,256,256);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(dc), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI/2; disc.position.y = -0.08;
  const EL = [0xFF6B4A, 0x6BD08A, 0x5FE0F0, 0x4F7BE0];
  for (let i=0;i<12;i++){
    const a0 = i*30*DEG, a1 = (i+1)*30*DEG;
    [].forEach(([ri,ro,op])=>{
      const w = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 28, 1, -a1, a1-a0), new THREE.MeshBasicMaterial({ color:EL[i%4], transparent:true, opacity:op, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false }));
      w.rotation.x = Math.PI/2; zodiacRingGroup.add(w);
    });
    const gem = new THREE.Sprite(new THREE.SpriteMaterial({ map:_glowTex(), color:0xF4C45C, transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }));
    gem.scale.set(0.45,0.45,1); gem.position.set(Math.cos(a0)*12, 0, -Math.sin(a0)*12); zodiacRingGroup.add(gem);
  }
  [11.45, 12.55].forEach(rad=>{
    const m = new THREE.Mesh(new THREE.RingGeometry(rad-0.035, rad+0.035, 180), new THREE.MeshBasicMaterial({ color:0xFFE6A8, transparent:true, opacity:0.9, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false }));
    m.rotation.x = Math.PI/2; zodiacRingGroup.add(m);
  });
}

function _strip(deg, r0, r1, w, color, op, kind){
  const t = deg*DEG, c = Math.cos(t), sn = Math.sin(t), px = sn*w/2, pz = c*w/2;
  const a = [c*r0, -sn*r0], b = [c*r1, -sn*r1];
  const v = new Float32Array([a[0]-px,0,a[1]-pz, a[0]+px,0,a[1]+pz, b[0]-px,0,b[1]-pz, b[0]+px,0,b[1]+pz]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v,3)); g.setIndex([0,1,2,1,3,2]);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false }));
  m.userData.kind = kind; m.position.y = 0.01; zodiacRingGroup.add(m); return m;
}
function drawBorders(){
  // Zodiac: solid bright dividers across the sign band + soft guide lines all the way down to Earth
  for (let i=0;i<12;i++){
    _strip(i*30, 11.45, 12.55, 0.075, 0xFFE6A8, 0.95, 'sign');
    _strip(i*30, 0.8, 4.5, 0.03, 0xF4C45C, 0.07, 'sign');
    _strip(i*30, 4.5, 8.5, 0.03, 0xF4C45C, 0.12, 'sign');
    _strip(i*30, 8.5, 11.45, 0.03, 0xF4C45C, 0.2, 'sign');
  }
  // Nakshatras: bright boundary between each of the 27 arcs + crisp band edges
  for (let i=0;i<27;i++) _strip(i*(360/27), 13.15, 13.85, 0.06, 0xFFFFFF, 0.9, 'nak');
  [13.18, 13.82].forEach(rad=>{
    const m = new THREE.Mesh(new THREE.RingGeometry(rad-0.025, rad+0.025, 200), new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:0.75, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = Math.PI/2; m.userData.kind = 'nak'; zodiacRingGroup.add(m);
  });
}

function updateSceneForJD(jd){
  const snap = snapshotPositions(jd);

  // Geocentric zodiac wheel positions
  const planetOrbitRadius = { Sun:4, Moon:2.6, Mercury:5, Venus:6, Mars:7, Jupiter:8, Saturn:9.2, Rahu:10.2, Ketu:10.2, Uranus:10.6, Neptune:10.95, Pluto:11.3 };
  ALL_BODIES.forEach(name=>{
    const lon = snap.sidereal[name];
    const r = planetOrbitRadius[name];
    bodyMeshes["geo_"+name].position.set(r*Math.cos(lon*DEG), 0, -r*Math.sin(lon*DEG));
  });

  rebuildAspectLines(snap.sidereal, planetOrbitRadius);
  
  // Clear any active nakshatra click-highlight when time changes so the lines don't detach
  if (typeof clearNakshatraHighlight === 'function') {
    clearNakshatraHighlight();
  }

  updateOverlays(snap);
  solUpdate(jd);
  markDirty();
  return snap;
}

/* Draw a thin line between any two planets currently in graha-drishti aspect,
   at the actual 3D position of their markers on the zodiac wheel, so the person
   can visually see "which planet is influencing which planets". */
function rebuildAspectLines(sidereal, planetOrbitRadius){
  const now = performance.now();
  if (isPlaying && now - _aspLast < 120 && aspectLineGroup.children.length) return;
  _aspLast = now;
  while (aspectLineGroup.children.length){
    const c = aspectLineGroup.children[0]; aspectLineGroup.remove(c);
    c.traverse(o=>{ if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
  }
  const aspects = computeAspects(sidereal);
  const seen = new Set();
  const col = n => new THREE.Color(PLANET_COLORS[n] || '#00F0D5');
  aspects.forEach(a=>{
    const pk = [a.from,a.to].sort().join('-')+'-'+a.houseOffset;
    if (seen.has(pk)) return; seen.add(pk);
    const rF = planetOrbitRadius[a.from], rT = planetOrbitRadius[a.to];
    const p1 = new THREE.Vector3(rF*Math.cos(sidereal[a.from]*DEG), 0, -rF*Math.sin(sidereal[a.from]*DEG));
    const p2 = new THREE.Vector3(rT*Math.cos(sidereal[a.to]*DEG), 0, -rT*Math.sin(sidereal[a.to]*DEG));
    const dist = p1.distanceTo(p2);
    const mid = p1.clone().add(p2).multiplyScalar(0.5); mid.y += Math.min(2.5, Math.max(0.5, dist*0.16));
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const full = a.houseOffset === 7;
    const tube = new THREE.TubeGeometry(curve, 28, full ? 0.034 : 0.022, 6, false);
    const cA = col(a.from), cB = col(a.to), n = tube.attributes.position.count, arr = new Float32Array(n*3);
    for (let i=0;i<n;i++){ const t = Math.floor(i/7)/28, c = cA.clone().lerp(cB, t).multiplyScalar(1.15); arr[i*3]=c.r; arr[i*3+1]=c.g; arr[i*3+2]=c.b; }
    tube.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false })));
    const hex = col(a.to).getHex();
    const cone = new THREE.Mesh(_coneGeo, _sharedMat('cone'+hex, ()=> new THREE.MeshBasicMaterial({ color:hex, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false })));
    cone.position.copy(curve.getPoint(0.95));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), curve.getTangent(0.95).normalize());
    g.add(cone);
    const glow = new THREE.Sprite(_sharedMat('glow'+hex, ()=> new THREE.SpriteMaterial({ map:_glowTex(), color:hex, transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false }), true));
    glow.scale.set(0.6,0.6,1); glow.position.copy(p2); g.add(glow);
    aspectLineGroup.add(g);
  });
  aspectLineGroup.visible = lineToggleState.aspectLines;
}
let _aspLast = 0;
const _coneGeo = new THREE.ConeGeometry(0.09, 0.26, 12); _coneGeo.userData.shared = true;
const _matCache = {};
function _sharedMat(k, make){ if (!_matCache[k]){ _matCache[k] = make(); _matCache[k].userData.shared = true; } return _matCache[k]; }
let _glowT = null;
function _glowTex(){
  if (_glowT) return _glowT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.25,'rgba(255,255,255,0.45)'); g.addColorStop(0.6,'rgba(255,255,255,0.1)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0,0,128,128); return (_glowT = new THREE.CanvasTexture(c));
}

function getFocusTargetPos(){
  if (!focusedPlanetKey) return null;
  const mesh = bodyMeshes[focusedPlanetKey];
  return mesh ? mesh.position : null;
}

function renderLoop(ts){
  requestAnimationFrame(renderLoop);
  const dt = lastFreeTickTime ? Math.min(0.1,(ts-lastFreeTickTime)/1000) : 0;
  lastFreeTickTime = ts;
  

  if (camMode==="free"){
    // Always re-render in free mode since movement can happen every frame
    const speed = FREE_MOVE_SPEED * dt;
    if (speed>0 && (freeMoveState.fwd||freeMoveState.right||freeMoveState.up)){
      const forward = new THREE.Vector3(Math.cos(freeCamPitch)*Math.cos(freeCamYaw), Math.sin(freeCamPitch), Math.cos(freeCamPitch)*Math.sin(freeCamYaw));
      const rightVec = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
      freeCamPos.addScaledVector(forward, freeMoveState.fwd*speed);
      freeCamPos.addScaledVector(rightVec, freeMoveState.right*speed);
      freeCamPos.y += freeMoveState.up*speed;
      markDirty();
    }
    camera.position.copy(freeCamPos);
    const lookDir = new THREE.Vector3(Math.cos(freeCamPitch)*Math.cos(freeCamYaw), Math.sin(freeCamPitch), Math.cos(freeCamPitch)*Math.sin(freeCamYaw));
    camera.lookAt(freeCamPos.clone().add(lookDir));
    renderer.render(scene, camera);
    updatePlanetLabels();
    return;
  }

  if (autoRotate){ orbitAngleTheta += 0.0006; markDirty(); }
  if (!needsRender) return;
  needsRender = false;

  if (SOL.view==='solar'){
    if (camMode==='focus'){
      if (SOL.lastFocus!==focusedPlanetKey){ SOL.lastFocus = focusedPlanetKey; orbitDist = solFocusDist(); }
      orbitDist = clampZoom(orbitDist);
    } else { SOL.lastFocus = null; orbitDist = clampZoom(orbitDist); }
    const nn = camMode==='focus' ? Math.max(0.00005, orbitDist*0.04) : 0.1;
    if (Math.abs(nn-SOL.lastNear) > 1e-9){ SOL.lastNear = nn; camera.near = Math.min(0.1, nn); camera.updateProjectionMatrix(); }
  }
  if (camMode==="focus"){
    const target = getFocusTargetPos() || new THREE.Vector3(0,0,0);
    const x = target.x + orbitDist*Math.sin(orbitAnglePhi)*Math.cos(orbitAngleTheta);
    const y = target.y + orbitDist*Math.cos(orbitAnglePhi);
    const z = target.z + orbitDist*Math.sin(orbitAnglePhi)*Math.sin(orbitAngleTheta);
    camera.position.set(x,y,z);
    camera.lookAt(target);
  } else {
    const x = orbitDist*Math.sin(orbitAnglePhi)*Math.cos(orbitAngleTheta);
    const y = orbitDist*Math.cos(orbitAnglePhi);
    const z = orbitDist*Math.sin(orbitAnglePhi)*Math.sin(orbitAngleTheta);
    camera.position.set(x,y,z);
    camera.lookAt(0,0,0);
  }
  renderer.render(scene, camera);
  updatePlanetLabels();
}

function setViewMode(){
  zodiacRingGroup.visible = true;
  orbitDist = 26;
  populateFocusPlanetSelect();
  updateLineToggleVisibility();
  updateLegend();
  rebuildLabelNodes();
  markDirty();
}

/* ============================================================================
   SOLAR SYSTEM VIEW — heliocentric, planets at their real positions for the
   chosen date. Two scale modes:
     "easy"  distances compressed (sqrt) + sizes exaggerated, everything visible
     "real"  true distances (1 AU = 10 units) and true relative sizes
   Orbital elements: JPL/Standish Keplerian elements (best for 1800-2050).
   ============================================================================ */
const SOL_AU_KM = 149597870.7, SOL_SUN_KM = 695700, SOL_UNITS_PER_AU = 10, SOL_LIGHT_MIN_PER_AU = 8.3167;
const SOL_BODIES = ["Mercury","Venus","Earth","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
const SOL_DATA = {
  Mercury:{R:2439.7, P:0.2408, c:0x8FB3C9, g:"☿"}, Venus:{R:6051.8, P:0.6152, c:0xF5E6C8, g:"♀"},
  Earth:{R:6371.0, P:1.0000, c:0x4F9BE0, g:"⊕"}, Mars:{R:3389.5, P:1.8808, c:0xFF6B4A, g:"♂"},
  Jupiter:{R:69911, P:11.862, c:0xE8B95C, g:"♃"}, Saturn:{R:58232, P:29.457, c:0xD9C58E, g:"♄"},
  Uranus:{R:25362, P:84.011, c:0x7DE3E0, g:"♅"}, Neptune:{R:24622, P:164.79, c:0x5B7CFA, g:"♆"},
  Pluto:{R:1188.3, P:247.94, c:0xC9A38A, g:"♇"}
};
const SOL = { view:'wheel', scale:'easy', built:false, group:null, bodies:{}, orbits:{}, sun:null, light:null, lastFocus:null, lastNear:0.1 };

function solHelio(name, jd){ return name==="Earth" ? earthHeliocentric(jd) : planetHeliocentric(name.toLowerCase(), jd); }
function solMapPos(h){ // ecliptic (x,y,z AU) -> scene coords for current scale mode
  const r = Math.sqrt(h.x*h.x + h.y*h.y + h.z*h.z) || 1e-9;
  const k = SOL.scale==='real' ? SOL_UNITS_PER_AU : (5.2*Math.sqrt(r)/r);
  return new THREE.Vector3(h.x*k, h.z*k, -h.y*k);
}
function solRadius(name){ // sphere radius in scene units
  if (SOL.scale==='real') return (name==="Sun" ? SOL_SUN_KM : SOL_DATA[name].R) / SOL_AU_KM * SOL_UNITS_PER_AU;
  if (name==="Sun") return 1.7;
  return Math.max(0.12, 0.34*Math.pow(SOL_DATA[name].R/6371, 0.5));
}
function solBuild(){
  if (SOL.built) return; SOL.built = true;
  const g = SOL.group = new THREE.Group(); g.visible = false; scene.add(g);
  // Sun
  const sun = makeSphere(1, 0xFFD84A, 0xFFB347, 'Sun'); g.add(sun); SOL.sun = sun; bodyMeshes['sol_Sun'] = sun;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map:_glowTex(), color:0xFFB347, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false }));
  g.add(glow); SOL.sunGlow = glow; SOL.dots = {};
  SOL.light = new THREE.PointLight(0xFFF2D6, 1.4, 0, 0); g.add(SOL.light);
  SOL_BODIES.forEach(n=>{
    const m = makeSphere(1, SOL_DATA[n].c, 0, n); g.add(m); SOL.bodies[n] = m; bodyMeshes['sol_'+n] = m;
    // fixed-screen-size dot so tiny true-scale planets stay findable
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map:_glowTex(), color:SOL_DATA[n].c, transparent:true, opacity:0.95, depthWrite:false, sizeAttenuation:false }));
    dot.scale.set(0.022,0.022,1); dot.visible = false; g.add(dot); SOL.dots[n] = dot;
    if (n==='Saturn'){
      m.userData.noSpin = true;
      const c = document.createElement('canvas'); c.width = 512; c.height = 4; const x = c.getContext('2d');
      const gr = x.createLinearGradient(0,0,512,0);
      [[0,'rgba(0,0,0,0)'],[0.08,'rgba(190,170,130,0.55)'],[0.3,'rgba(235,215,165,0.9)'],[0.45,'rgba(120,100,70,0.25)'],[0.52,'rgba(240,222,175,0.95)'],[0.8,'rgba(210,190,145,0.75)'],[0.93,'rgba(170,150,110,0.35)'],[1,'rgba(0,0,0,0)']].forEach(([p,col])=> gr.addColorStop(p,col));
      x.fillStyle = gr; x.fillRect(0,0,512,4);
      const rg = new THREE.RingGeometry(1.45, 2.45, 96, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
      for (let i=0;i<pos.count;i++){ const d = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (d-1.45)/1, 0.5); }
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, side:THREE.DoubleSide, depthWrite:false }));
      ring.rotation.x = -Math.PI/2 + 0.42; m.add(ring);
    }
  });
  solMakeLabels();
  solRebuildOrbits(); solApplyScale(); solUpdate(currentJD);
}
function solMakeLabels(){
  const container = document.getElementById('planetLabels');
  ["Sun"].concat(SOL_BODIES).forEach(n=>{
    const el = document.createElement('div'); el.className = 'planet-label';
    const col = '#'+(n==="Sun"?0xFFD84A:SOL_DATA[n].c).toString(16).padStart(6,'0');
    el.innerHTML = `<span class="dot" style="background:${col}"></span>${n}`; el.style.display = 'none';
    container.appendChild(el); labelNodes['sol_'+n] = { el, label:n };
  });
}
function solRebuildOrbits(){
  for (const k in SOL.orbits){ SOL.group.remove(SOL.orbits[k]); SOL.orbits[k].geometry.dispose(); }
  SOL.orbits = {};
  SOL_BODIES.forEach(n=>{
    const key = n.toLowerCase(), el = n==="Earth" ? EARTH_ELEMENTS : PLANET_ELEMENTS[key];
    const T0 = (currentJD-J2000)/36525.0, N = 360, pts = [];
    // sweep the mean longitude through one full revolution at the current epoch's elements
    for (let i=0;i<=N;i++){
      const e2 = Object.assign({}, el, { L: el.L + el.Lrate*T0 + i*360/N, Lrate:0, peri: el.peri + el.periRate*T0, periRate:0, node: el.node + el.nodeRate*T0, nodeRate:0 });
      pts.push(solMapPos(heliocentricPos(e2, 0)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:SOL_DATA[n].c, transparent:true, opacity:0.38 }));
    SOL.group.add(line); SOL.orbits[n] = line;
  });
}
function solApplyScale(){
  if (!SOL.built) return;
  const real = SOL.scale==='real';
  SOL.sun.scale.setScalar(solRadius("Sun"));
  SOL.sunGlow.material.sizeAttenuation = !real; SOL.sunGlow.material.needsUpdate = true;
  if (real) SOL.sunGlow.scale.set(0.11,0.11,1); else SOL.sunGlow.scale.set(6,6,1);
  SOL_BODIES.forEach(n=>{
    const m = SOL.bodies[n]; m.scale.setScalar(solRadius(n));
    SOL.dots[n].visible = real; // real mode: planets are sub-pixel, so mark them with a dot
  });
  solRebuildOrbits(); solUpdate(currentJD);
  document.querySelectorAll('#solScale button').forEach(b=> b.classList.toggle('active', b.dataset.s===SOL.scale));
  markDirty();
}
function solUpdate(jd){
  if (!SOL.built) return;
  SOL_BODIES.forEach(n=>{ const p = solMapPos(solHelio(n, jd)); SOL.bodies[n].position.copy(p); SOL.dots[n].position.copy(p); });
  if (SOL.view==='solar') solRenderTable(jd);
}
function solZoomRange(){
  if (SOL.view!=='solar') return [6,120];
  if (camMode==='focus' && focusedPlanetKey){
    const n = focusedPlanetKey.replace(/^(geo_|sol_)/,''); const r = n==='Sun' ? solRadius('Sun') : (SOL.bodies[n] ? solRadius(n) : 1);
    return [Math.max(r*1.8, 0.0006), SOL.scale==='real' ? 900 : 120];
  }
  return SOL.scale==='real' ? [3, 950] : [4, 120];
}
function clampZoom(v){ const z = solZoomRange(); return Math.max(z[0], Math.min(z[1], v)); }
function solFocusDist(){
  const n = focusedPlanetKey ? focusedPlanetKey.replace(/^(geo_|sol_)/,'') : null;
  if (!n || !SOL.bodies[n]) return SOL.scale==='real' ? 60 : 30;
  return solRadius(n) * (SOL.scale==='real' ? 6 : 7);
}
function solPreset(which){
  if (SOL.view!=='solar') setSceneView('solar');
  setCamMode('orbit'); autoRotate = false; orbitAnglePhi = 1.0;
  const real = SOL.scale==='real';
  orbitDist = which==='inner' ? (real ? 30 : 22) : which==='outer' ? (real ? 700 : 85) : (real ? 950 : 90);
  markDirty();
}
function setSceneView(v){
  if (v==='solar') solBuild();
  SOL.view = v; const solar = v==='solar';
  zodiacRingGroup.visible = !solar; aspectLineGroup.visible = !solar;
  if (SOL.group) SOL.group.visible = solar;
  if (window._wheelSunLight) window._wheelSunLight.intensity = solar ? 0.25 : 3.5;
  document.querySelectorAll('#viewSwitch button').forEach(b=> b.classList.toggle('active', b.dataset.v===v));
  document.getElementById('solScale').style.display = solar ? 'flex' : 'none';
  document.getElementById('solPresets').style.display = solar ? 'flex' : 'none';
  if (solar){ if (camMode==='focus') setCamMode('orbit'); orbitDist = SOL.scale==='real' ? 120 : 62; solUpdate(currentJD); }
  else { orbitDist = 26; }
  if (!solar){ camera.near = 0.1; camera.updateProjectionMatrix(); }
  populateFocusPlanetSelect(); updateLegend(); markDirty();
  if (typeof syncPickBtn === 'function') syncPickBtn();
}
function solRenderTable(jd){
  const wrap = document.getElementById('solTable'); if (!wrap) return;
  const earth = earthHeliocentric(jd);
  let html = '';
  SOL_BODIES.forEach(n=>{
    const h = solHelio(n, jd), r = Math.hypot(h.x,h.y,h.z);
    const d = n==="Earth" ? 0 : Math.hypot(h.x-earth.x, h.y-earth.y, h.z-earth.z);
    const lon = normDeg(Math.atan2(h.y,h.x)*RAD), D = SOL_DATA[n], col = '#'+D.c.toString(16).padStart(6,'0');
    html += `<div class="sol-row" data-n="${n}" style="--pc:${col}">
      <div class="sol-g" style="color:${col}">${D.g}</div>
      <div class="sol-main"><b>${n}</b><span>${(D.R*2).toLocaleString('en-US',{maximumFractionDigits:0})} km wide · ${(D.R/6371).toFixed(n==="Pluto"||n==="Mercury"||n==="Mars"?3:2)}× Earth</span></div>
      <div class="sol-nums"><span>${r.toFixed(3)} AU from Sun</span><span>${n==="Earth" ? 'home' : d.toFixed(3)+' AU · '+(d*SOL_LIGHT_MIN_PER_AU).toFixed(1)+' light-min from Earth'}</span><span>year ${D.P<2 ? (D.P*365.25).toFixed(0)+' d' : D.P.toFixed(1)+' y'} · helio. ${lon.toFixed(1)}°</span></div>
    </div>`;
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.sol-row').forEach(r=> r.addEventListener('click', ()=>{
    setCamMode('focus'); focusedPlanetKey = 'sol_'+r.dataset.n; autoRotate = false;
    const sel = document.getElementById('focusPlanetSelect'); if (sel) sel.value = focusedPlanetKey;
    SOL.lastFocus = null; updateLegend(); markDirty(); if (typeof syncPickBtn==='function') syncPickBtn();
  }));
}
function solBuildSizeStrip(){
  // true relative sizes (Sun omitted: it would be ~10x Jupiter), drawn as one SVG row
  const wrap = document.getElementById('solSizes'); if (!wrap) return;
  const list = SOL_BODIES.slice().sort((a,b)=> SOL_DATA[b].R - SOL_DATA[a].R);
  const scale = 38 / SOL_DATA.Jupiter.R; let x = 8, svg = '', svgI = 0;
  list.forEach(n=>{
    const r = Math.max(1.2, SOL_DATA[n].R*scale), col = '#'+SOL_DATA[n].c.toString(16).padStart(6,'0');
    x += r; const lo = (r<6 && (svgI++ % 2)) ? 9 : 0; svg += `<circle cx="${x.toFixed(1)}" cy="46" r="${r.toFixed(2)}" fill="${col}" fill-opacity=".85"><title>${n}: ${(SOL_DATA[n].R*2).toLocaleString('en-US',{maximumFractionDigits:0})} km</title></circle><text x="${x.toFixed(1)}" y="${(46+Math.max(r,6)+9+lo).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#8FA3B8" font-family="sans-serif">${n.slice(0,3)}</text>`;
    x += r + 5;
  });
  wrap.innerHTML = `<svg viewBox="0 0 ${Math.ceil(x+6)} 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">${svg}</svg>`;
}
document.querySelectorAll('#viewSwitch button').forEach(b=> b.addEventListener('click', ()=> setSceneView(b.dataset.v)));
document.querySelectorAll('#solScale button').forEach(b=> b.addEventListener('click', ()=>{ SOL.scale = b.dataset.s; solApplyScale(); orbitDist = clampZoom(SOL.scale==='real' ? 120 : 62); markDirty(); }));
document.querySelectorAll('#solPresets button').forEach(b=> b.addEventListener('click', ()=> solPreset(b.dataset.p)));

function updateLegend(){
  const legend = document.getElementById('viewportLegend');
  if (camMode==="free"){
    legend.innerHTML = `<div>FREE FLY · MOVE ANYWHERE IN THE SCENE</div><div>DRAG TO LOOK · WASD/ARROWS + Q/E OR JOYSTICK TO MOVE</div>`;
    return;
  }
  if (camMode==="focus" && focusedPlanetKey){
    const label = focusedPlanetKey.replace(/^(geo_|sol_)/,'');
    legend.innerHTML = `<div>FOCUSED ON ${label.toUpperCase()}</div><div>DRAG TO ORBIT THE PLANET · PINCH OR SCROLL TO ZOOM</div>`;
    return;
  }
  if (SOL.view==='solar'){
    legend.innerHTML = SOL.scale==='real'
      ? `<div>SUN-CENTERED · TRUE SCALE (1 AU = 10 UNITS)</div><div>REAL DISTANCES &amp; SIZES · DOTS MARK TINY PLANETS · DRAG TO ORBIT</div>`
      : `<div>SUN-CENTERED · EASY FIT (DISTANCES COMPRESSED)</div><div>REAL POSITIONS · SIZES EXAGGERATED · DRAG TO ORBIT</div>`;
    return;
  }
  legend.innerHTML = `<div>EARTH-CENTERED · SIDEREAL LONGITUDE (LAHIRI)</div><div>RING = 12 RASHI · DRAG TO ORBIT</div>`;
}

/* ============================================================================
   CAMERA MODE CONTROL (Orbit / Focus Planet / Free Fly)
   ============================================================================ */
function setCamMode(newCamMode){
  camMode = newCamMode;
  document.querySelectorAll('.cam-mode-btn').forEach(b=> b.classList.toggle('active', b.dataset.cammode===newCamMode));
  document.getElementById('focusPlanetFieldWrap').style.display = newCamMode==="focus" ? '' : 'none';
  document.getElementById('freeFlyHint').style.display = newCamMode==="free" ? '' : 'none';
  document.getElementById('ffMoveStick').classList.toggle('show', newCamMode==="free" && isMobile);
  document.getElementById('ffVertControls').classList.toggle('show', newCamMode==="free" && isMobile);
  if (newCamMode==="free"){
    // seed free camera position from wherever the orbit camera currently is
    freeCamPos.copy(camera.position);
    const dir = new THREE.Vector3(0,0,0).sub(camera.position).normalize();
    freeCamYaw = Math.atan2(dir.z, dir.x);
    freeCamPitch = Math.asin(Math.max(-1,Math.min(1,dir.y)));
    autoRotate = false;
  } else {
    autoRotate = false; // respect user's manual control once they've engaged with view; keep off by default post-load
  }
  updateLegend();
  markDirty();
}

function populateFocusPlanetSelect(){
  const sel = document.getElementById('focusPlanetSelect');
  sel.innerHTML = "";
  const geoOptions = ALL_BODIES.map(n=>[n,"geo_"+n]);
  const options = SOL.view==='solar' ? ["Sun"].concat(SOL_BODIES).map(n=>[n,"sol_"+n]) : geoOptions;
  options.forEach(([label,key])=>{
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = label;
    sel.appendChild(opt);
  });
  if (options.length){
    focusedPlanetKey = options[0][1];
    sel.value = focusedPlanetKey;
  }
}

document.querySelectorAll('.cam-mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> setCamMode(btn.dataset.cammode));
});
document.getElementById('focusPlanetSelect').addEventListener('change', (e)=>{
  focusedPlanetKey = e.target.value;
  updateLegend();
  markDirty();
});

/* ============================================================================
   LINE VISIBILITY TOGGLES
   Each toggle controls a group of scene objects so the person can declutter
   the view and focus on whichever relationships matter to them.
   ============================================================================ */
let lineToggleState = {
  zodiacSignLines: true,
  nakshatraTicks: true,
  aspectLines: true,
  houseLines: true
};

// Aspect lines (drawn fresh whenever positions/aspect-toggle changes) live in their own group
const aspectLineGroup = new THREE.Group();
function applyLineToggles(){
  // Zodiac ring: sign-divider lines vs nakshatra ticks are both THREE.Line children;
  // sign dividers are thicker/brighter (color 0x5A7A9B), nakshatra ticks dimmer (0x2A3A55)
  zodiacRingGroup.children.forEach(child=>{
    if (child.type!=="Line") return;
    const isNak = child.material.color.getHex()===0x2A3A55;
    child.visible = isNak ? lineToggleState.nakshatraTicks : lineToggleState.zodiacSignLines;
  });
  zodiacRingGroup.children.forEach(c=>{ const k = c.userData && c.userData.kind; if (k==='sign') c.visible = lineToggleState.zodiacSignLines; else if (k==='nak') c.visible = lineToggleState.nakshatraTicks; });
  aspectLineGroup.visible = lineToggleState.aspectLines;
  markDirty();
}

const LINE_TOGGLE_DEFS = [
  { key:'zodiacSignLines', label:'Sign Boundaries', sub:'12 rashi divider lines', modes:['geo'] },
  { key:'nakshatraTicks', label:'Nakshatra Ticks', sub:'27 nakshatra boundary marks', modes:['geo'] },
  { key:'aspectLines', label:'Aspect Lines', sub:'Graha drishti lines between planets', modes:['geo'] },
];

function renderLineToggleList(){
  const wrap = document.getElementById('lineToggleList');
  wrap.innerHTML = "";
  LINE_TOGGLE_DEFS.forEach(def=>{
    const row = document.createElement('div');
    row.className = 'line-toggle-row';
    row.dataset.modes = def.modes.join(',');
    row.innerHTML = `
      <div>
        <div class="lt-label">${def.label}</div>
        <div class="lt-sub">${def.sub}</div>
      </div>
      <label class="switch">
        <input type="checkbox" data-ltkey="${def.key}" ${lineToggleState[def.key] ? 'checked':''}>
        <span class="slider"></span>
      </label>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('input[data-ltkey]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      lineToggleState[inp.dataset.ltkey] = inp.checked;
      applyLineToggles();
    });
  });
  updateLineToggleVisibility();
}

function updateLineToggleVisibility(){
  document.querySelectorAll('.line-toggle-row').forEach(row=>{
    const modes = (row.dataset.modes || 'geo').split(',');
    row.style.display = modes.includes(mode) ? '' : 'none';
  });
}

/* ----------------------------------------------------------------------
   PLANET LABELS — persistent DOM nodes, positioned via CSS transform only.
   This avoids the innerHTML-rebuild-every-frame pattern that caused lag:
   we create each label div ONCE, then every frame just move it.
   ---------------------------------------------------------------------- */
const labelNodes = {}; // key -> {el, dotEl}
function rebuildLabelNodes(){
  const container = document.getElementById('planetLabels');
  container.innerHTML = "";
  for (const k in labelNodes) delete labelNodes[k];
  const activeSet = ALL_BODIES.map(n=>[n,"geo_"+n]);
  activeSet.forEach(([label,key])=>{
    const el = document.createElement('div');
    el.className = 'planet-label';
    const color = label==="Sun" ? "#FFD84A" : label==="Earth" ? "#4F9BE0" : (PLANET_COLORS[label]||"#8FA3B8");
    el.innerHTML = `<span class="dot" style="background:${color}"></span>${label}`;
    el.style.display = 'none';
    container.appendChild(el);
    labelNodes[key] = { el, label };
  });

  // Sign-name labels around the zodiac ring (geo mode only)
  if (mode==="geo"){
    for (let i=0;i<12;i++){
      const el = document.createElement('div');
      el.className = 'sign-label el-' + ['fire','earth','air','water'][i%4];
      el.style.setProperty('--ec', signHex(i));
      el.innerHTML = `<span class="sign-glyph">${SIGNS[i].symbol}</span><span class="sign-name-text">${SIGNS[i].name}</span>`;
      el.style.display = 'none';
      container.appendChild(el);
      labelNodes["signlabel_"+i] = { el, label: SIGNS[i].name, isSign:true };
    }
  }
  if (SOL.built) solMakeLabels();
}

let _vw = 0, _vh = 0;
new ResizeObserver(e=>{ _vw = e[0].contentRect.width; _vh = e[0].contentRect.height; }).observe(document.querySelector('.viewport'));
function updatePlanetLabels(){
  const w = _vw || document.querySelector('.viewport').clientWidth, h = _vh || document.querySelector('.viewport').clientHeight;
  for (const key in labelNodes){
    const { el, label, isSign } = labelNodes[key];
    let mesh = bodyMeshes[key];
    if (!mesh || mesh.visible===false || (mesh.parent && mesh.parent.visible===false)){ el.style.display='none'; continue; }
    const pos = mesh.position.clone();
    pos.project(camera);
    if (pos.z > 1){ el.style.display='none'; continue; }
    const sx = (pos.x*0.5+0.5)*w;
    const sy = (-pos.y*0.5+0.5)*h;
    if (sx<-60||sx>w+60||sy<-60||sy>h+60){ el.style.display='none'; continue; }
    el.style.display = '';
    el.style.transform = isSign
      ? `translate(${sx}px, ${sy}px) translate(-50%,-50%)`
      : `translate(${sx}px, ${sy}px) translate(-50%,-140%)`;
  }
}

/* ============================================================================
   APP STATE
   ============================================================================ */
let currentJD = toJulianDay(new Date().getUTCFullYear(), new Date().getUTCMonth()+1, new Date().getUTCDate(), new Date().getUTCHours(), new Date().getUTCMinutes(), 0);
let isPlaying = false;
let playSpeedDaysPerSec = 7;
let lastFrameTime = null;
let timelineWindowStart, timelineWindowEnd; // JD bounds shown on scrubber
let activeNatalProfile = null; // {name,dob,tob,lat,lon,tz}
function isValidProfile(p){ return !!p && typeof p.dob==='string' && p.dob.includes('-') && typeof p.tob==='string' && p.tob.includes(':') && isFinite(p.tz) && isFinite(p.lat) && isFinite(p.lon); }
let transitFilterSet = new Set(["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]);

function initTimelineWindow(){
  timelineWindowStart = currentJD - 30;
  timelineWindowEnd = currentJD + 365;
}

/* ---- Date formatting ---- */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatHudDate(jd){
  const d = jdToDate(jd);
  // Replaced UTC getters with local browser timezone getters
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatHudTime(jd){
  const d = jdToDate(jd);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; 
}
function formatFullDate(jd){
  const d = jdToDate(jd);
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ============================================================================
   RENDER: HUD + Sky table
   ============================================================================ */
/* ---- where you are now (used for the live Rising sign) ---- */
let liveLocMem = null;
const hudEsc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function getLiveLoc(){
  if (liveLocMem) return liveLocMem;
  try { const v = JSON.parse(localStorage.getItem('vax_live_loc') || 'null'); if (v && isFinite(v.lat) && isFinite(v.lon)) return (liveLocMem = { lat:+v.lat, lon:+v.lon, label:String(v.label || 'your place') }); } catch(e){}
  const off = -new Date().getTimezoneOffset() / 60;          // hours east of Greenwich -> rough longitude until the person sets a place
  return { lat: 22, lon: off * 15, label: 'time-zone estimate', approx: true };
}
function askLiveLoc(){
  const apply = (lat, lon, label)=>{
    liveLocMem = { lat, lon, label };
    try { localStorage.setItem('vax_live_loc', JSON.stringify(liveLocMem)); } catch(e){}
    const snap = A.snap || snapshotPositions(currentJD); renderHUD(snap); updateOverlays(snap); markDirty();
  };
  const LP = (window.parent && window.parent !== window) ? window.parent.LocPicker : null;
  if (LP){ const c = getLiveLoc(); LP.open({ title:'Where are you now?', lat:c.lat, lon:c.lon, onPick: r => apply(parseFloat(r.lat), parseFloat(r.lon), String(r.display_name || 'your place').split(',')[0]) }); }
  else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => apply(p.coords.latitude, p.coords.longitude, 'your location'), ()=>{});
}

/* ---- Rising-sign timeline (long-press chip popup + "Rising" tab) ---- */
var riseTLc = null, risingKey = '', risingOpenedAt = 0;
function _ascSign(jd, L){ return getSignIndex(siderealAscendant(jd, L.lat, L.lon)); }
function _ascEdge(jd, L, dir){          // moment the rising sign (as at jd) changes, searching forward (+1) or backward (-1)
  const s = _ascSign(jd, L), step = dir / 1440;
  let a = jd, b = jd, n = 0;
  do { a = b; b += step; n++; } while (_ascSign(b, L) === s && n < 2000);
  if (n >= 2000) return null;
  for (let i = 0; i < 30; i++){ const m = (a + b) / 2; if (_ascSign(m, L) === s) a = m; else b = m; }
  return (a + b) / 2;
}
function riseTimeline(jd, L){           // [{i, start, end}] current sign first, then the next 11 signs
  const c = riseTLc;
  if (c && c.lat === L.lat && c.lon === L.lon && jd >= c.rows[0].start && jd < c.rows[0].end) return c.rows;
  const st = _ascEdge(jd, L, -1), en = _ascEdge(jd, L, 1);
  if (st == null || en == null) return null;
  const rows = [{ i:_ascSign(jd, L), start:st, end:en }];
  let prev = en;
  for (let k = 1; k < 12; k++){
    const probe = prev + 2 / 86400, e = _ascEdge(probe, L, 1);
    if (e == null) break;
    rows.push({ i:_ascSign(probe, L), start:prev, end:e });
    prev = e;
  }
  riseTLc = { lat:L.lat, lon:L.lon, rows };
  return rows;
}
function _rsT(jd){ const d = jdToDate(jd + 0.5/1440); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function _rsD(jd){ const d = jdToDate(jd + 0.5/1440); return String(d.getDate()).padStart(2,'0') + ' ' + MONTHS[d.getMonth()]; }
function _rsDur(days){ const m = Math.max(0, Math.round(days * 1440)), h = Math.floor(m / 60); return (h ? h + 'h ' : '') + String(m % 60) + 'm'; }
function risingHTML(snap, L){
  const rows = riseTimeline(snap.jd, L);
  if (!rows) return '<div class="rs-note">Near the poles the rising sign hardly changes, so timings can\'t be shown for this place.</div>';
  const cur = rows[0], sg = SIGNS[cur.i], lon = siderealAscendant(snap.jd, L.lat, L.lon);
  const total = cur.end - cur.start, done = snap.jd - cur.start, left = cur.end - snap.jd;
  const pct = Math.max(0, Math.min(100, done / total * 100));
  const nowDay = _rsD(snap.jd), maxD = Math.max(...rows.map(r => r.end - r.start));
  const dTag = jd => _rsD(jd) === nowDay ? '' : ' · ' + _rsD(jd);
  let h = `<div class="rs-hero"><div class="rs-eyebrow">Rising now · ${hudEsc(formatHudDate(snap.jd))} ${formatHudTime(snap.jd)}</div>
    <div class="rs-sym">${sg.symbol}</div><div class="rs-name">${sg.name} Lagna</div>
    <div class="rs-place">📍 ${L.approx ? 'time-zone estimate (set your place for exact times)' : hudEsc(L.label)} · ${degreeInSign(lon).deg}° of 30° risen</div></div>
    <div class="rs-times"><div class="rs-t"><small>Started</small><b>${_rsT(cur.start)}</b><i>${_rsD(cur.start)}</i></div><div class="rs-arrow">→</div>
    <div class="rs-t"><small>Ends</small><b>${_rsT(cur.end)}</b><i>${_rsD(cur.end)}</i></div></div>
    <div class="rs-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
    <div class="rs-pct"><span><b>${Math.round(pct)}%</b> completed</span><span>${_rsDur(done)} done · ${_rsDur(left)} left</span></div>
    <div class="rs-h">All 12 signs · next full cycle</div><div class="rs-list">`;
  rows.forEach((r, k) => {
    const g = SIGNS[r.i], d = r.end - r.start;
    h += `<div class="rs-row${k === 0 ? ' now' : ''}"><div class="sy">${g.symbol}</div>
      <div><div class="nm">${g.name}${k === 0 ? '<em>NOW</em>' : ''}</div><div class="tm">${_rsT(r.start)} → ${_rsT(r.end)}${dTag(r.end)}</div></div>
      <div class="du">${_rsDur(d)}</div><div class="db" style="width:${(d / maxD * 100).toFixed(0)}%"></div></div>`;
  });
  h += `</div><div class="rs-note">Times use your device clock. Each sign rises for roughly 1½–2½ hours here; the length changes with your place and the season.</div>
    <button class="rs-btn" data-rs-place="1">📍 Change place</button>`;
  return h;
}
function renderRising(force){
  const popEl = document.getElementById('risingOverlay'), tabEl = document.getElementById('tab-rising');
  if (!popEl || !tabEl) return;
  const popOn = popEl.classList.contains('show'), tabOn = tabEl.classList.contains('active');
  if (!popOn && !tabOn) return;
  const snap = A.snap || snapshotPositions(currentJD), L = getLiveLoc();
  const key = Math.floor(snap.jd * 1440) + '|' + L.lat + '|' + L.lon;
  if (!force && key === risingKey) return;
  risingKey = key;
  const html = risingHTML(snap, L);
  if (popOn) document.getElementById('risingBody').innerHTML = html;
  if (tabOn) document.getElementById('risingTabBody').innerHTML = html;
}
function openRising(){ risingOpenedAt = Date.now(); document.getElementById('risingOverlay').classList.add('show'); renderRising(true); }
function closeRising(){ document.getElementById('risingOverlay').classList.remove('show'); }
function renderHUD(snap){
  document.getElementById('hudDate').textContent = formatHudDate(snap.jd);
  document.getElementById('hudTime').textContent = formatHudTime(snap.jd);
  document.getElementById('hudSub').textContent = `JD ${snap.jd.toFixed(3)} · Ayanamsa ${snap.ayanamsa.toFixed(3)}°`;
  const moonLon = snap.sidereal.Moon;
  const moonSign = SIGNS[getSignIndex(moonLon)];
  const moonNak = NAKSHATRAS[getNakshatraIndex(moonLon)];
  document.getElementById('hudMoon').textContent = `☽ ${moonSign.symbol} ${moonSign.name} · ${moonNak} Nakshatra`;
  const ascEl = document.getElementById('hudAsc');
  if (ascEl){
    const L = getLiveLoc(), aLon = siderealAscendant(snap.jd, L.lat, L.lon), aSign = SIGNS[getSignIndex(aLon)];
    ascEl.innerHTML = `↑ Rising ${aSign.symbol} ${aSign.name} ${degreeInSign(aLon).deg}°<span class="asc-nak"> · ${L.approx ? 'tap to set your place' : hudEsc(L.label)}</span> <span class="asc-pin">📍</span>`;
  }
  renderRising(false);
}

const skyRowNodes = {}; // planet name -> {glyph, name, sign, deg}
function buildSkyTableRows(){
  const wrap = document.getElementById('skyTable');
  wrap.innerHTML = "";
  ALL_BODIES.forEach(name=>{
    const row = document.createElement('div');
    row.className = 'sky-row';
    row.style.setProperty('--pc', PLANET_COLORS[name]);
    row.style.cursor = 'pointer';
    row.addEventListener('click', ()=>{
      openPlanetDetail(name);
    });
    row.innerHTML = `
      <div class="sky-glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</div>
      <div class="sky-info">
        <div class="sky-name"><span class="sky-name-text">${name}</span><span class="retro-badge" style="display:none">R</span></div>
        <div class="sky-sign"></div>
      </div>
      <div class="sky-deg"></div>`;
    wrap.appendChild(row);
    skyRowNodes[name] = {
      retro: row.querySelector('.retro-badge'),
      sign: row.querySelector('.sky-sign'),
      deg: row.querySelector('.sky-deg')
    };
  });
}

function renderSkyTable(snap){
  ALL_BODIES.forEach(name=>{
    const nodes = skyRowNodes[name];
    if (!nodes) return;
    const lon = snap.sidereal[name];
    const sign = SIGNS[getSignIndex(lon)];
    const nakIdx = getNakshatraIndex(lon);
    const nak = NAKSHATRAS[nakIdx];
    const pada = Math.floor((normDeg(lon) % (360/27)) / ((360/27)/4)) + 1;
    const deg = getDegInSign(lon);
    const nakLord = NAKSHATRA_LORDS[nakIdx];
    nodes.sign.textContent = `${sign.symbol} ${sign.name} (${sign.sk}) · ${nak} Pada ${pada} (Lord: ${nakLord})` + (OUTER_LIST.includes(name) ? ` · ${OUTER_SK[name]} (outer planet)` : '');
    nodes.deg.textContent = formatDeg(deg);
    const showRetro = snap.retro[name] && name!=="Rahu" && name!=="Ketu";
    nodes.retro.style.display = showRetro ? '' : 'none';
  });
}

/* ============================================================================
   TRANSIT + CONJUNCTION SCANNING (cached, recomputed when jump/profile changes)
   ============================================================================ */
let cachedTransitScanFromJD = null;
let cachedTransitResults = null;
let cachedConjScanFromJD = null;
let cachedConjResults = null;

const NATAL_RELEVANT_PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const CONJ_PAIRS = [];
for (let i=0;i<PLANET_LIST.length;i++){
  for (let j=i+1;j<PLANET_LIST.length;j++){
    // Skip Rahu-Ketu pair (always exactly opposite, never conjunct) and Sun-Moon w/ nodes redundancy is fine to include
    if ((PLANET_LIST[i]==="Rahu"&&PLANET_LIST[j]==="Ketu")) continue;
    CONJ_PAIRS.push([PLANET_LIST[i], PLANET_LIST[j]]);
  }
}

function scanTransits(fromJD){
  const endJD = fromJD + 730; // 2 years ahead
  const results = [];
  PLANET_LIST.forEach(name=>{
    const events = findIngresses(name, fromJD, endJD);
    events.forEach((e,idx)=>{
      const durationDays = idx+1<events.length ? events[idx+1].jd - e.jd : null;
      results.push({ type:"ingress", planet:name, jd:e.jd, toSign:e.toSign, fromSign:e.fromSign, durationDays });
    });
  });
  results.sort((a,b)=> a.jd-b.jd);
  return results;
}

function scanConjunctions(fromJD){
  const endJD = fromJD + 730;
  const results = [];
  CONJ_PAIRS.forEach(([a,b])=>{
    // Use wider orb + longer step for slow-moving outer pairs to reduce compute; findConjunctions already bisects precisely
    const events = findConjunctions(a,b,fromJD,endJD,1.0);
    events.forEach(e=> results.push({ type:"conjunction", planetA:a, planetB:b, jd:e.jd, sign:e.sign, longitude:e.longitude }));
  });
  results.sort((a,b)=> a.jd-b.jd);
  return results;
}

function getTransitResults(fromJD){
  if (cachedTransitScanFromJD===null || Math.abs(fromJD-cachedTransitScanFromJD)>1){
    cachedTransitScanFromJD = fromJD;
    cachedTransitResults = scanTransits(fromJD);
  }
  return cachedTransitResults;
}
function getConjResults(fromJD){
  if (cachedConjScanFromJD===null || Math.abs(fromJD-cachedConjScanFromJD)>1){
    cachedConjScanFromJD = fromJD;
    cachedConjResults = scanConjunctions(fromJD);
  }
  return cachedConjResults;
}

function planetSpeedTag(name){
  const speed = Math.abs(AVG_DAILY_MOTION[name]);
  if (speed > 5) return "fast";
  if (speed > 0.3) return "medium";
  return "slow";
}

function renderTransitFeed(){
  const feed = document.getElementById('transitFeed');
  const note = document.getElementById('transitScanNote');
  const results = getTransitResults(currentJD).filter(e=> transitFilterSet.has(e.planet));
  note.textContent = `Scanning ${formatHudDate(currentJD)} → ${formatHudDate(currentJD+730)} (2-year horizon)`;
  if (!results.length){
    feed.innerHTML = `<div class="empty-feed">No ingresses found for the selected planets in this window.</div>`;
    return;
  }
  let html = "";
  results.slice(0,60).forEach(e=>{
    const toSign = SIGNS[e.toSign];
    const fromSign = SIGNS[e.fromSign];
    html += `<div class="transit-card" data-jd="${e.jd}">
      <div class="transit-card-top">
        <div class="transit-card-title">${PLANET_GLYPHS[e.planet]} ${e.planet} → ${toSign.symbol} ${toSign.name}</div>
        <div class="transit-card-date">${formatHudDate(e.jd)}</div>
      </div>
      <div class="transit-card-desc">Leaves ${fromSign.name}, enters ${toSign.name} (${toSign.sk}), ruled by ${toSign.lord}.${e.durationDays ? ` Stays roughly ${Math.round(e.durationDays)} days.`:''}</div>
      <div class="transit-card-tag">${planetSpeedTag(e.planet)} mover</div>
    </div>`;
  });
  feed.innerHTML = html;
  feed.querySelectorAll('.transit-card').forEach(card=>{
    card.addEventListener('click', ()=> jumpToJD(parseFloat(card.dataset.jd)));
  });
}

let conjSignificanceMode = "major";
function renderConjunctionFeed(){
  const feed = document.getElementById('conjunctionFeed');
  const note = document.getElementById('conjScanNote');
  let results = getConjResults(currentJD);
  if (conjSignificanceMode === "major"){
    results = results.filter(e=> e.planetA!=="Moon" && e.planetB!=="Moon");
  }
  note.textContent = `Scanning ${formatHudDate(currentJD)} → ${formatHudDate(currentJD+730)} (2-year horizon) · orb 1°`;
  if (!results.length){
    feed.innerHTML = `<div class="empty-feed">No conjunctions found within orb in this window.</div>`;
    return;
  }
  let html = "";
  results.slice(0,60).forEach(e=>{
    const sign = SIGNS[e.sign];
    html += `<div class="transit-card conjunction" data-jd="${e.jd}">
      <div class="transit-card-top">
        <div class="transit-card-title">${PLANET_GLYPHS[e.planetA]} ${e.planetA} ⚯ ${PLANET_GLYPHS[e.planetB]} ${e.planetB}</div>
        <div class="transit-card-date">${formatHudDate(e.jd)}</div>
      </div>
      <div class="transit-card-desc">Exact conjunction in ${sign.symbol} ${sign.name} at ${formatDeg(getDegInSign(e.longitude))}.</div>
      <div class="transit-card-tag">conjunction</div>
    </div>`;
  });
  feed.innerHTML = html;
  feed.querySelectorAll('.transit-card').forEach(card=>{
    card.addEventListener('click', ()=> jumpToJD(parseFloat(card.dataset.jd)));
  });
}

document.getElementById('conjSignificanceFilter').querySelectorAll('.filter-chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#conjSignificanceFilter .filter-chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    conjSignificanceMode = chip.dataset.sig;
    renderConjunctionFeed();
  });
});

function renderTransitFilters(){
  const wrap = document.getElementById('transitFilters');
  let html = "";
  PLANET_LIST.forEach(name=>{
    html += `<button class="filter-chip ${transitFilterSet.has(name)?'active':''}" data-planet="${name}">${name}</button>`;
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const p = chip.dataset.planet;
      if (transitFilterSet.has(p)) transitFilterSet.delete(p); else transitFilterSet.add(p);
      chip.classList.toggle('active');
      renderTransitFeed();
    });
  });
}

/* ============================================================================
   NATAL PROFILE
   ============================================================================ */
const NATAL_STORAGE_KEY = 'ephemeris_natal_profiles_v1';
function loadNatalProfiles(){ try{ return JSON.parse(localStorage.getItem(NATAL_STORAGE_KEY)||"[]"); }catch(e){ return []; } }
function saveNatalProfiles(list){ localStorage.setItem(NATAL_STORAGE_KEY, JSON.stringify(list)); }

function refreshProfileSelect(){
  const profiles = loadNatalProfiles();
  const sel = document.getElementById('profileSelect');
  const cur = sel.value;
  sel.innerHTML = '<option value="">No natal chart</option>';
  profiles.forEach((p,i)=>{
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function renderNatalTab(){
  const wrap = document.getElementById('natalCardWrap');
  if (!isValidProfile(activeNatalProfile)){
    activeNatalProfile = null;
    wrap.innerHTML = `<div class="natal-card-empty">No active profile.<br>Enter birth details below to see personalized transit hits against your natal planets.</div>`;
    return;
  }
  const p = activeNatalProfile;
  const natalJD = toJulianDay(...p.dob.split('-').map(Number), ...p.tob.split(':').map(Number), 0) - p.tz/24;
  const natalSnap = snapshotPositions(natalJD);
  let planetsHtml = "";
  PLANET_LIST.forEach(name=>{
    const lon = natalSnap.sidereal[name];
    const sign = SIGNS[getSignIndex(lon)];
    planetsHtml += `<div class="sky-row" style="cursor:pointer;" onclick="openPlanetDetail('${name}', ${natalJD})"><div class="sky-glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</div>
      <div class="sky-info"><div class="sky-name">${name}</div><div class="sky-sign">${sign.symbol} ${sign.name}</div></div>
      <div class="sky-deg">${formatDeg(getDegInSign(lon))}</div></div>`;
  });
  wrap.innerHTML = `<div class="natal-card">
    <div class="natal-name">${escapeHtml(p.name)}</div>
    <div class="natal-meta">${p.dob} · ${p.tob} · ${p.place ? p.place.split(',')[0] : ''}</div>
  </div>
  <div class="panel-heading">Natal Positions</div>
  ${planetsHtml}`;
  renderChartTab();
}

function escapeHtml(str){ const d=document.createElement('div'); d.textContent=str; return d.innerHTML; }

/* ============================================================================
   CHART TAB — Rasi wheel (houses labeled with sign), house table, graha drishti
   Uses the active natal profile if one exists; otherwise falls back to "now"
   (current transiting positions) with a Lagna computed for the user's live
   location if available, or Aries rising as a neutral default.
   ============================================================================ */
let aspectFocusPlanet = "ALL";

function getChartContext(liveSnap){
  if (isValidProfile(activeNatalProfile)){
    const p = activeNatalProfile;
    const { jd, lagnaLon } = computeNatalAscendant(p);
    const snap = snapshotPositions(jd);
    return { sidereal: snap.sidereal, retro: snap.retro, lagnaLon, label: `${p.name}'s Natal Chart`, isNatal:true, jd };
  }
  const snap = liveSnap || snapshotPositions(currentJD);
  // Without a saved birth location we can't compute a true live ascendant, so
  // we default Lagna to Aries (0°) and clearly label this as sign-only view.
  return { sidereal: snap.sidereal, retro: snap.retro, lagnaLon: 0, label: "Current Sky (no natal profile — Aries set as reference Lagna)", isNatal:false, jd: snap.jd };
}

let chartTabContextJD = currentJD; // exposed globally so inline onclick handlers on the wheel/house table can reach it
let selectedWheelSign = null; // sign index currently highlighted via the sign dropdown

function renderChartTab(liveSnap){
  const ctx = getChartContext(liveSnap);
  chartTabContextJD = ctx.jd;
  const lagnaSignIdx = getSignIndex(ctx.lagnaLon);
  renderChartWheel(ctx, lagnaSignIdx);
  renderHouseTable(ctx, lagnaSignIdx);
  renderAspectFocusFilter();
  renderAspectList(ctx);
  renderSignAspectList(ctx);
  renderSignSelector(ctx, lagnaSignIdx);
  renderExplorer(ctx);
}

/* ---- North-Indian style diamond wheel, drawn as SVG (crisp at any size, no WebGL needed for this 2D summary view) ---- */
const NI_HOUSE_POLYGONS = [
  // 12 house cells for a standard North Indian diamond, house 1 = center-top diamond, going clockwise
  [50,2, 75,25, 50,48, 25,25],   // 1
  [50,2, 98,2, 75,25],            // 2
  [98,2, 98,50, 75,25, 75,25],    // placeholder overwritten below
];
// Building exact North-Indian coordinates cell-by-cell is intricate; instead we
// use the simpler, equally standard South-Indian FIXED-SIGN grid: signs stay in
// fixed cells and the Lagna marker moves — easier to read at a glance and just
// as authentic a chart style.
const SI_GRID = [
  // row,col for signs 0..11 (Aries..Pisces) in a 4x4 grid with the 2x2 center empty
  {sign:0, r:0, c:1}, {sign:1, r:0, c:2}, {sign:2, r:0, c:3}, {sign:3, r:1, c:3},
  {sign:4, r:2, c:3}, {sign:5, r:3, c:3}, {sign:6, r:3, c:2}, {sign:7, r:3, c:1},
  {sign:8, r:3, c:0}, {sign:9, r:2, c:0}, {sign:10, r:1, c:0}, {sign:11, r:0, c:0}
];
function renderChartWheel(ctx, lagnaSignIdx){
  const wrap = document.getElementById('chartWheelWrap');
  const cell = 88, pad = 4;
  const size = cell*4;
  let svg = `<div class="chart-wheel"><svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;

  // planets grouped by sign
  const planetsBySign = {};
  PLANET_LIST.forEach(name=>{
    const s = getSignIndex(ctx.sidereal[name]);
    (planetsBySign[s] = planetsBySign[s]||[]).push(name);
  });

  SI_GRID.forEach(cellDef=>{
    const x = cellDef.c*cell, y = cellDef.r*cell;
    const houseNum = getHouseOfLongitude(cellDef.sign*30+1, lagnaSignIdx);
    const isLagna = cellDef.sign===lagnaSignIdx;
    const isSelected = cellDef.sign===selectedWheelSign;
    const sign = SIGNS[cellDef.sign];
    svg += `<rect class="cw-house-bg${isLagna?' lagna':''}${isSelected?' selected':''}" style="cursor:pointer;" x="${x+pad}" y="${y+pad}" width="${cell-2*pad}" height="${cell-2*pad}" rx="6" onclick="selectWheelSign(${cellDef.sign})"></rect>`;
    svg += `<text class="cw-house-num" x="${x+10}" y="${y+16}" style="pointer-events:none;">H${houseNum}</text>`;
    svg += `<text class="cw-sign-name" x="${x+cell-10}" y="${y+16}" text-anchor="end" style="pointer-events:none;">${sign.symbol}</text>`;
    const planetsHere = planetsBySign[cellDef.sign] || [];
    planetsHere.forEach((name,i)=>{
      const px = x + 14 + (i%3)*24;
      const py = y + 38 + Math.floor(i/3)*20;
      svg += `<text class="cw-planet" x="${px}" y="${py}" fill="${PLANET_COLORS[name]}" onclick="event.stopPropagation(); openPlanetDetail('${name}', chartTabContextJD)">${PLANET_GLYPHS[name]}</text>`;
    });
    if (isLagna){
      svg += `<text class="cw-planet" x="${x+cell-24}" y="${y+cell-10}" fill="#00D9C0" font-size="8" style="pointer-events:none;">ASC</text>`;
    }
  });
  svg += `</svg></div>`;
  wrap.innerHTML = svg + `<div class="scan-range-note" style="margin-top:12px;">${escapeHtml(ctx.label)} · South-Indian fixed-sign layout · Whole-sign houses</div>`;
}

function renderHouseTable(ctx, lagnaSignIdx){
  const wrap = document.getElementById('houseTable');
  const planetsBySign = {};
  PLANET_LIST.forEach(name=>{
    const s = getSignIndex(ctx.sidereal[name]);
    (planetsBySign[s] = planetsBySign[s]||[]).push(name);
  });
  let html = "";
  for (let h=1; h<=12; h++){
    const signIdx = (lagnaSignIdx + h - 1) % 12;
    const sign = SIGNS[signIdx];
    const planetsHere = planetsBySign[signIdx] || [];
    const isLagna = h===1;
    html += `<div class="house-row">
      <div class="house-num-badge${isLagna?' lagna':''}">${h}</div>
      <div>
        <div class="house-sign-line">${sign.symbol} ${sign.name} <span style="color:var(--text-faint); font-weight:400;">(${sign.sk}, lord ${sign.lord})</span>${isLagna?'<span class="lagna-tag">LAGNA</span>':''}</div>
        <div class="house-planets-line">${planetsHere.length ? planetsHere.map(n=>`<span style="cursor:pointer;" onclick="openPlanetDetail('${n}', chartTabContextJD)">${PLANET_GLYPHS[n]} ${n}</span>`).join(' · ') : '<span class="hp-empty">No planets here</span>'}</div>
      </div>
    </div>`;
  }
  wrap.innerHTML = html;
}

/* ============================================================================
   SIGN SELECTOR — pick any sign from a dropdown (or tap a wheel cell) to see
   it highlighted, plus every planet in it with exact degree, when it entered,
   when it exits, and days in/remaining.
   ============================================================================ */
let signSelectorBuilt = false;
function renderSignSelector(ctx, lagnaSignIdx){
  const dropdown = document.getElementById('signSelectDropdown');
  if (!signSelectorBuilt){
    signSelectorBuilt = true;
    SIGNS.forEach((sign,i)=>{
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${sign.symbol} ${sign.name} (${sign.sk})`;
      dropdown.appendChild(opt);
    });
    dropdown.addEventListener('change', ()=>{
      const val = dropdown.value;
      selectedWheelSign = val==="" ? null : parseInt(val,10);
      renderChartTab(); // re-render wheel with highlight
      if (selectedWheelSign!=null) openSignDetail(selectedWheelSign);
    });
  }
  dropdown.value = selectedWheelSign==null ? "" : String(selectedWheelSign);
}

// Called from wheel cell onclick — selects the sign, highlights it, and opens the detail popup
function selectWheelSign(signIdx){
  selectedWheelSign = signIdx;
  const dropdown = document.getElementById('signSelectDropdown');
  if (dropdown) dropdown.value = String(signIdx);
  renderChartTab();
  openSignDetail(signIdx);
}

function openSignDetailLegacy(signIdx){
  const jd = chartTabContextJD;
  const snap = snapshotPositions(jd);
  const sign = SIGNS[signIdx];

  const planetsInSign = PLANET_LIST.filter(name=> getSignIndex(snap.sidereal[name])===signIdx);
  const cardsHtml = planetsInSign.length ? planetsInSign.map(name=>{
    const lon = snap.sidereal[name];
    const dms = degreeInSign(lon);
    const occ = getSignOccupancy(name, jd);
    const enterStr = occ.enterJD!=null ? formatFullDate(occ.enterJD) : "Beyond calculable range";
    const exitStr = occ.exitJD!=null ? formatFullDate(occ.exitJD) : "Beyond calculable range";
    const daysInStr = occ.daysIn!=null ? formatDurationDays(occ.daysIn) : "—";
    const daysLeftStr = occ.daysLeft!=null ? formatDurationDays(occ.daysLeft) : "—";
    return `<div class="sd-planet-card" onclick="closeSignDetail(); openPlanetDetail('${name}', ${jd})">
      <div class="sd-planet-top">
        <span class="sd-planet-glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</span>
        <span class="sd-planet-name">${name}</span>
        <span class="sd-planet-deg">${dms.deg}° ${dms.min}' ${dms.sec}"</span>
      </div>
      <div class="sd-planet-timeline">
        <div class="sd-tl-item"><div class="sd-tl-label">Days In Sign</div><div class="sd-tl-value accent">${daysInStr}</div></div>
        <div class="sd-tl-item"><div class="sd-tl-label">Days Remaining</div><div class="sd-tl-value accent">${daysLeftStr}</div></div>
        <div class="sd-tl-item" style="grid-column:1/-1;"><div class="sd-tl-label">Entered Sign</div><div class="sd-tl-value">${enterStr}</div></div>
        <div class="sd-tl-item" style="grid-column:1/-1;"><div class="sd-tl-label">Exits Sign</div><div class="sd-tl-value">${exitStr}</div></div>
      </div>
    </div>`;
  }).join('') : `<div class="pd-empty-note">No planets are currently in ${sign.name}.</div>`;

  const html = `
    <div class="sd-hero">
      <div class="sd-hero-symbol">${sign.symbol}</div>
      <div class="sd-hero-name">${sign.name} <span style="color:var(--text-faint); font-weight:400; font-size:14px;">(${sign.sk})</span></div>
      <div class="sd-hero-sub">Ruled by ${sign.lord} · ${formatFullDate(jd)}</div>
      <div class="pd-hero-badges" style="margin-top:12px;">
        <span class="pd-badge">${planetsInSign.length} planet${planetsInSign.length===1?'':'s'} currently here</span>
      </div>
    </div>
    <div class="pd-section">
      <div class="pd-section-title">Planets In ${sign.name}</div>
      ${cardsHtml}
    </div>
  `;
  document.getElementById('signDetailContent').innerHTML = html;
  document.getElementById('signDetailOverlay').classList.add('show');
}

/* ============================================================================
   RICH SIGN DETAIL
   ============================================================================ */
const SD = [
 ['Ram','Pioneering · Bold · Impulsive','Head'],['Bull','Steady · Sensual · Loyal','Face, neck'],['Twins','Curious · Witty · Versatile','Arms, shoulders'],
 ['Crab','Nurturing · Intuitive · Protective','Chest'],['Lion','Regal · Generous · Proud','Heart, upper abdomen'],['Maiden','Analytical · Practical · Precise','Intestines'],
 ['Scales','Harmonious · Diplomatic · Aesthetic','Kidneys, lower back'],['Scorpion','Intense · Secretive · Transformative','Reproductive organs'],['Archer','Optimistic · Philosophical · Free','Thighs'],
 ['Sea-goat','Disciplined · Ambitious · Patient','Knees'],['Water-bearer','Visionary · Independent · Humanitarian','Calves, ankles'],['Fish','Dreamy · Compassionate · Spiritual','Feet']];
function openSignDetail(si){
  const jd = chartTabContextJD, snap = snapshotPositions(jd), sg = SIGNS[si], inf = SD[si], col = signHex(si);
  const el = ['Fire','Earth','Air','Water'][si%4], mod = ['Movable (Chara)','Fixed (Sthira)','Dual (Dwiswabhava)'][si%3], dir = ['East','South','West','North'][si%4];
  const card = (k,v,sb)=> `<div class="pdx-card pdx-in"><div class="k">${k}</div><div class="v">${v}</div>${sb?`<div class="s">${sb}</div>`:''}</div>`;
  const here = PLANET_LIST.filter(n=> getSignIndex(snap.sidereal[n]) === si);
  const planets = here.length ? here.map((n,i)=>{
    const o = getSignOccupancy(n, jd), tot = (o.daysIn!=null && o.daysLeft!=null) ? o.daysIn + o.daysLeft : null, pr = tot ? Math.round(o.daysIn/tot*100) : Math.round(degreeInSign(snap.sidereal[n]).raw/30*100), dm = degreeInSign(snap.sidereal[n]);
    return `<div class="pdx-card pdx-in" style="--i:${i};--pc:${PLANET_COLORS[n]};margin-bottom:10px;cursor:pointer" onclick="closeSignDetail(); openPlanetDetail('${n}', ${jd})">
      <div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px;color:${PLANET_COLORS[n]}">${PLANET_GLYPHS[n]}</span><b style="font-size:15px">${n}</b><span class="pdx-badge" style="margin-left:6px;padding:3px 9px">${dignityOf(n, si)}</span><span style="margin-left:auto;font-family:var(--font-mono);font-size:12px">${dm.deg}°${dm.min}'</span></div>
      <div class="pdx-seg"><i style="--w:${pr}%"></i></div><div class="s" style="margin-top:6px">${pr}% through · ${o.daysLeft!=null?formatDurationDays(o.daysLeft)+' left':''}</div></div>`;
  }).join('') : `<div class="pd-empty-note">No planets are in ${sg.name} right now.</div>`;
  const n0 = Math.floor(si*30/(360/27)), n1 = Math.floor((si*30+29.999)/(360/27));
  let naks = ''; for (let k=n0; k<=n1; k++) naks += `<div class="pdx-row pdx-in" style="--i:${k-n0}"><span>${NAKSHATRAS[k%27]}</span><b>Lord ${NAKSHATRA_LORDS[k%27]}</b></div>`;
  let house = '';
  if (isValidProfile(activeNatalProfile)){ const L = getSignIndex(computeNatalAscendant(activeNatalProfile).lagnaLon); house = card('House from Lagna', 'House ' + (((si - L + 12) % 12) + 1), activeNatalProfile.name); }
  const html = `<div class="pdx-root" style="--pc:${col};--pca:${col}66">
    <div class="pdx-hero"><div class="pdx-orb"><span style="font-size:52px">${sg.symbol}</span></div>
      <div class="pdx-name">${sg.name}</div><div class="pdx-sk">${sg.sk} · ${inf[0]}</div>
      <div class="pdx-badges" style="margin-top:12px"><span class="pdx-badge">${el}</span><span class="pdx-badge">${mod}</span><span class="pdx-badge">Ruled by ${sg.lord}</span></div></div>
    <div class="pdx-pane on" style="padding-top:6px">
      <div class="pdx-about pdx-in">${inf[1].split(' · ').join(', ')}. ${sg.name} is the ${si+1}${['st','nd','rd'][si]||'th'} sign of the zodiac and is ruled by ${sg.lord}.</div>
      <div class="pdx-h">Quick facts</div>
      <div class="pdx-grid">${card('Element', el)}${card('Quality', mod)}${card('Ruler', sg.lord)}${card('Gender', si%2===0?'Masculine (odd)':'Feminine (even)')}${card('Direction', dir)}${card('Body part', inf[2])}${house}${card('Degrees', (si*30)+'° – '+(si*30+30)+'°', 'Sidereal')}</div>
      <div class="pdx-h">Nature</div><div class="pdx-chips pdx-in">${inf[1].split(' · ').map(x=>`<span class="pdx-chip">${x}</span>`).join('')}</div>
      <div class="pdx-h">Nakshatras in this sign</div>${naks}
      <div class="pdx-h">Planets here now</div>${planets}
    </div></div>`;
  const box = document.getElementById('signDetailContent'); box.innerHTML = html;
  document.getElementById('signDetailOverlay').classList.add('show');
  const m = box.closest('.pdmodal'); if (m) m.scrollTop = 0;
  requestAnimationFrame(()=> requestAnimationFrame(()=> box.querySelector('.pdx-root').classList.add('go')));
}

function closeSignDetail(){
  document.getElementById('signDetailOverlay').classList.remove('show');
}
document.getElementById('signDetailClose').addEventListener('click', closeSignDetail);
document.getElementById('signDetailOverlay').addEventListener('click', (e)=>{
  if (e.target.id==='signDetailOverlay') closeSignDetail();
});

function renderAspectFocusFilter(){
  const wrap = document.getElementById('aspectFocusFilter');
  if (wrap.dataset.built) return; // build once, it's static list of planets
  wrap.dataset.built = "1";
  let html = `<button class="filter-chip active" data-focus="ALL">All Planets</button>`;
  PLANET_LIST.forEach(name=>{
    html += `<button class="filter-chip" data-focus="${name}">${name}</button>`;
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      wrap.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      aspectFocusPlanet = chip.dataset.focus;
      renderAspectList(getChartContext());
    });
  });
}

function renderAspectList(ctx){
  const wrap = document.getElementById('aspectList');
  let aspects = computeAspects(ctx.sidereal);
  if (aspectFocusPlanet!=="ALL"){
    aspects = aspects.filter(a=> a.from===aspectFocusPlanet || a.to===aspectFocusPlanet);
  }
  if (!aspects.length){
    wrap.innerHTML = `<div class="empty-aspects">No graha drishti aspects found${aspectFocusPlanet!=="ALL" ? ` involving ${aspectFocusPlanet}` : ''} at this time.</div>`;
    return;
  }
  const houseLabel = {4:'4th (square)', 5:'5th (trine)', 7:'7th (opposition)', 8:'8th', 9:'9th (trine)', 3:'3rd', 10:'10th'};
  let html = "";
  aspects.forEach(a=>{
    html += `<div class="aspect-row">
      <div class="aspect-glyphs">
        <span style="color:${PLANET_COLORS[a.from]}; cursor:pointer;" onclick="openPlanetDetail('${a.from}', chartTabContextJD)">${PLANET_GLYPHS[a.from]}</span>
        <span class="aspect-arrow">→</span>
        <span style="color:${PLANET_COLORS[a.to]}; cursor:pointer;" onclick="openPlanetDetail('${a.to}', chartTabContextJD)">${PLANET_GLYPHS[a.to]}</span>
      </div>
      <div class="aspect-desc"><b>${a.from}</b> aspects <b>${a.to}</b> in ${SIGNS[a.sign].name}</div>
      <div class="aspect-house-tag">${houseLabel[a.houseOffset]||a.houseOffset+'th'}</div>
    </div>`;
  });
  wrap.innerHTML = html;
}

/* ============================================================================
   SIGN ASPECTS (Rashi Drishti) — one block per planet, listing every sign it
   is currently casting its graha-drishti gaze onto, whether occupied or not.
   This answers "exactly which area (sign) is each planet aspecting right now".
   ============================================================================ */
function renderSignAspectList(ctx){
  const wrap = document.getElementById('signAspectList');
  const houseLabel = {3:'3rd', 4:'4th (square)', 5:'5th (trine)', 7:'7th (opposition)', 8:'8th', 9:'9th (trine)', 10:'10th'};
  const rows = computeSignAspects(ctx.sidereal);
  const byPlanet = {};
  rows.forEach(r=> (byPlanet[r.from] = byPlanet[r.from]||[]).push(r));

  let html = "";
  PLANET_LIST.forEach(name=>{
    const fromSign = getSignIndex(ctx.sidereal[name]);
    const targets = byPlanet[name] || [];
    const targetsHtml = targets.map(t=>{
      const sign = SIGNS[t.targetSign];
      const occHtml = t.occupants.length
        ? t.occupants.map(p=>`<b onclick="openPlanetDetail('${p}', chartTabContextJD)">${PLANET_GLYPHS[p]} ${p}</b>`).join(', ')
        : `<span class="sa-empty-target">no planets currently there</span>`;
      return `<div class="sa-target-row">
        <span class="sa-house-tag">${houseLabel[t.houseOffset]||t.houseOffset+'th'}</span>
        <span class="sa-sign-name" style="cursor:pointer;" onclick="selectWheelSign(${t.targetSign})">${sign.symbol} ${sign.name}</span>
        <span class="sa-occupants">${occHtml}</span>
      </div>`;
    }).join('');
    html += `<div class="sa-planet-block">
      <div class="sa-planet-head" onclick="openPlanetDetail('${name}', chartTabContextJD)">
        <span class="glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</span>
        <span class="name">${name}</span>
        <span class="in-sign">in ${SIGNS[fromSign].symbol} ${SIGNS[fromSign].name}</span>
      </div>
      ${targetsHtml}
    </div>`;
  });
  wrap.innerHTML = html;
}

document.getElementById('copySignAspectsBtn').addEventListener('click', () => {
  const ctx = getChartContext(); // Gets current context (Live Sky or Natal)
  const houseLabel = {3:'3rd', 4:'4th (square)', 5:'5th (trine)', 7:'7th (opposition)', 8:'8th', 9:'9th (trine)', 10:'10th'};
  const rows = computeSignAspects(ctx.sidereal);
  const byPlanet = {};
  rows.forEach(r => (byPlanet[r.from] = byPlanet[r.from] || []).push(r));

  let textContent = `Sign Aspects (Rashi Drishti) - ${ctx.label}\n`;
  textContent += `======================================================\n\n`;

  PLANET_LIST.forEach(name => {
    const fromSign = SIGNS[getSignIndex(ctx.sidereal[name])];
    const targets = byPlanet[name] || [];
    
    textContent += `${name} (in ${fromSign.name}):\n`;
    
    if (targets.length === 0) {
      textContent += `  No outgoing aspects.\n`;
    } else {
      targets.forEach(t => {
        const targetSign = SIGNS[t.targetSign];
        const aspectName = houseLabel[t.houseOffset] || t.houseOffset + 'th';
        const occStr = t.occupants.length ? t.occupants.join(', ') : 'empty';
        textContent += `  - ${aspectName} aspect -> ${targetSign.name} (Occupants: ${occStr})\n`;
      });
    }
    textContent += "\n";
  });

  const copyHelper = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      return new Promise((resolve, reject) => {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed"; ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy') ? resolve() : reject(new Error('Fallback copy failed'));
          document.body.removeChild(ta);
        } catch(e) { reject(e); }
      });
    }
  };

  copyHelper(textContent.trim()).then(() => {
    const btn = document.getElementById('copySignAspectsBtn');
    const origText = btn.textContent;
    btn.textContent = "Copied to Clipboard! ✓";
    btn.style.color = "var(--cyan)";
    btn.style.borderColor = "var(--cyan)";
    setTimeout(() => {
      btn.textContent = origText;
      btn.style.color = "";
      btn.style.borderColor = "";
    }, 2000);
  }).catch(err => {
    alert("Failed to copy text: " + err);
  });
});

/* ============================================================================
   ASPECT EXPLORER — pick a planet or a sign and see exactly what it aspects
   (outgoing) and, symmetrically, exactly what aspects it (incoming).
   ============================================================================ */
let explorerMode = "planet"; // 'planet' | 'sign'
let explorerTarget = null;   // planet name (string) or sign index (number)
let explorerBuilt = false;

function renderExplorer(ctx){
  if (!explorerBuilt){
    explorerBuilt = true;
    document.querySelectorAll('#explorerModeToggle .cam-mode-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#explorerModeToggle .cam-mode-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        explorerMode = btn.dataset.mode;
        explorerTarget = null;
        populateExplorerTargetSelect();
        renderExplorerResult(getChartContext());
      });
    });
    document.getElementById('explorerTargetSelect').addEventListener('change', (e)=>{
      const v = e.target.value;
      explorerTarget = explorerMode==="sign" ? (v===""?null:parseInt(v,10)) : (v===""?null:v);
      renderExplorerResult(getChartContext());
    });
    populateExplorerTargetSelect();
  }
  renderExplorerResult(ctx);
}

function populateExplorerTargetSelect(){
  const sel = document.getElementById('explorerTargetSelect');
  const label = document.getElementById('explorerTargetLabel');
  sel.innerHTML = `<option value="">Select a ${explorerMode}…</option>`;
  if (explorerMode==="planet"){
    label.textContent = "Select a planet";
    PLANET_LIST.forEach(name=>{
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${PLANET_GLYPHS[name]} ${name}`;
      sel.appendChild(opt);
    });
  } else {
    label.textContent = "Select a sign";
    SIGNS.forEach((sign,i)=>{
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${sign.symbol} ${sign.name} (${sign.sk})`;
      sel.appendChild(opt);
    });
  }
  sel.value = "";
}

function renderExplorerResult(ctx){
  const wrap = document.getElementById('explorerResult');
  if (explorerTarget==null){
    wrap.innerHTML = `<div class="empty-aspects">Pick a ${explorerMode} above to see exactly which ${explorerMode==='planet'?'signs it aspects, and what aspects it back':'planets aspect it, and what its occupants aspect out'}.</div>`;
    return;
  }
  const houseLabel = {3:'3rd', 4:'4th (square)', 5:'5th (trine)', 7:'7th (opposition)', 8:'8th', 9:'9th (trine)', 10:'10th'};

  if (explorerMode==="planet"){
    const name = explorerTarget;
    const r = explorePlanetAspects(ctx.sidereal, name);
    const fromSign = SIGNS[r.fromSign];
    let html = `<div class="expl-hero">
      <span class="glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</span>
      <div>
        <div class="title">${name}</div>
        <div class="sub">Currently in ${fromSign.symbol} ${fromSign.name} (${fromSign.sk})</div>
      </div>
    </div>`;

    html += `<div class="expl-section-title">${name} aspects these signs</div>`;
    html += r.throwsTo.map(t=>{
      const sign = SIGNS[t.sign];
      const occHtml = t.occupants.length
        ? t.occupants.map(p=>`<b onclick="openPlanetDetail('${p}', chartTabContextJD)">${PLANET_GLYPHS[p]} ${p}</b>`).join(', ')
        : `<span style="color:var(--text-faint); font-style:italic;">empty right now</span>`;
      return `<div class="expl-row">
        <span class="glyph">${sign.symbol}</span>
        <span class="desc"><b onclick="selectWheelSign(${t.sign})">${sign.name}</b> — ${occHtml}</span>
        <span class="tag">${houseLabel[t.houseOffset]||t.houseOffset+'th'}</span>
      </div>`;
    }).join('') || `<div class="empty-aspects">No outgoing aspects.</div>`;

    html += `<div class="expl-section-title">${name} is aspected by</div>`;
    html += r.receivesFrom.length ? r.receivesFrom.map(inc=>{
      return `<div class="expl-row">
        <span class="glyph" style="color:${PLANET_COLORS[inc.from]}">${PLANET_GLYPHS[inc.from]}</span>
        <span class="desc"><b onclick="openPlanetDetail('${inc.from}', chartTabContextJD)">${inc.from}</b> aspects ${name}'s sign</span>
        <span class="tag">${houseLabel[inc.houseOffset]||inc.houseOffset+'th'}</span>
      </div>`;
    }).join('') : `<div class="empty-aspects">No planet currently aspects ${name}.</div>`;

    wrap.innerHTML = html;
    return;
  }

  // explorerMode === "sign"
  const signIdx = explorerTarget;
  const sign = SIGNS[signIdx];
  const r = exploreSignAspects(ctx.sidereal, signIdx);
  let html = `<div class="expl-hero">
    <span class="glyph">${sign.symbol}</span>
    <div>
      <div class="title">${sign.name} <span style="color:var(--text-faint); font-weight:400;">(${sign.sk})</span></div>
      <div class="sub">Ruled by ${sign.lord}${r.occupants.length? ' · '+r.occupants.length+' planet'+(r.occupants.length===1?'':'s')+' here':''}</div>
    </div>
  </div>`;

  html += `<div class="expl-section-title">${sign.name} is aspected by</div>`;
  html += r.aspectedBy.length ? r.aspectedBy.map(a=>{
    const fs = SIGNS[a.fromSign];
    return `<div class="expl-row">
      <span class="glyph" style="color:${PLANET_COLORS[a.from]}">${PLANET_GLYPHS[a.from]}</span>
      <span class="desc"><b onclick="openPlanetDetail('${a.from}', chartTabContextJD)">${a.from}</b> from ${fs.symbol} ${fs.name}</span>
      <span class="tag">${houseLabel[a.houseOffset]||a.houseOffset+'th'}</span>
    </div>`;
  }).join('') : `<div class="empty-aspects">No planet currently aspects ${sign.name}.</div>`;

  html += `<div class="expl-section-title">Planets in ${sign.name} aspect out to</div>`;
  if (!r.occupants.length){
    html += `<div class="empty-aspects">No planets are currently in ${sign.name}.</div>`;
  } else {
    html += r.occupantsThrow.map(o=>{
      const rows = o.targets.map(t=>{
        const ts = SIGNS[t.sign];
        return `<div class="expl-row">
          <span class="glyph" style="color:${PLANET_COLORS[o.planet]}">${PLANET_GLYPHS[o.planet]}</span>
          <span class="desc"><b onclick="openPlanetDetail('${o.planet}', chartTabContextJD)">${o.planet}</b> aspects <b onclick="selectWheelSign(${t.sign})">${ts.symbol} ${ts.name}</b></span>
          <span class="tag">${houseLabel[t.houseOffset]||t.houseOffset+'th'}</span>
        </div>`;
      }).join('');
      return rows;
    }).join('');
  }

  wrap.innerHTML = html;
}

/* ============================================================================
   PLANET DETAIL POPUP
   Click any planet (sky table, natal list, chart wheel, house table, aspect
   list, or directly in the 3D viewport) to see everything about it at that
   moment: sign, exact degree/min/sec, nakshatra + pada, house (if a natal
   Lagna is available), retrograde state, speed, and its current aspects.
   ============================================================================ */
function buildDegreeGaugeSVG(degInSign, colorHex){
  // A small radial gauge (0-30deg arc) showing how far through the sign the planet has travelled.
  const size = 58, r = 24, cx = size/2, cy = size/2;
  const pct = Math.max(0, Math.min(1, degInSign/30));
  const circumference = 2*Math.PI*r;
  const dash = circumference*pct;
  return `<svg class="pd-gauge" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1B2636" stroke-width="5"></circle>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorHex}" stroke-width="5"
      stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}" stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})"></circle>
    <text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="#E8EDF4">${Math.round(pct*100)}%</text>
  </svg>`;
}

function openPlanetDetailLegacy(name, jd){
  if (jd==null) jd = currentJD;
  const snap = snapshotPositions(jd);
  const lon = snap.sidereal[name];
  const signIdx = getSignIndex(lon);
  const sign = SIGNS[signIdx];
  const dms = degreeInSign(lon);
  const nakIdx = getNakshatraIndex(lon);
  const nak = NAKSHATRAS[nakIdx];
  const pada = getPadaIndex(lon)+1;
  const isRetro = snap.retro[name] && name!=="Rahu" && name!=="Ketu";
  const isNodeAlways = (name==="Rahu"||name==="Ketu");
  const speed = planetSpeed(name, jd);
  const speedCat = speedCategory(name, jd);
  const occ = getSignOccupancy(name, jd);

  // House: only meaningful when we have a Lagna reference (active natal profile).
  let houseLine = "";
  if (activeNatalProfile){
    const { lagnaLon } = computeNatalAscendant(activeNatalProfile);
    const lagnaSignIdx = getSignIndex(lagnaLon);
    const house = getHouseOfLongitude(lon, lagnaSignIdx);
    houseLine = `<div class="pd-stat"><div class="pd-stat-label">House (from ${activeNatalProfile.name}'s Lagna)</div><div class="pd-stat-value accent">${house}${house===1?' · Lagna':''}</div></div>`;
  }

  // Aspects involving this planet, computed at the same jd
  const allAspects = computeAspects(snap.sidereal).filter(a=> a.from===name || a.to===name);
  const houseLabel = {3:'3rd',4:'4th',5:'5th',7:'7th',8:'8th',9:'9th',10:'10th'};
  const aspectChips = allAspects.map(a=>{
    const isFrom = a.from===name;
    const other = isFrom ? a.to : a.from;
    const verb = isFrom ? 'aspects' : 'aspected by';
    return `<div class="pd-aspect-chip" onclick="openPlanetDetail('${other}', ${jd})">
      <span style="color:${PLANET_COLORS[other]}">${PLANET_GLYPHS[other]}</span>
      <span>${verb} <b style="color:var(--text)">${other}</b> (${houseLabel[a.houseOffset]||a.houseOffset+'th'})</span>
    </div>`;
  }).join('');

  const enterStr = occ.enterJD!=null ? `${formatFullDate(occ.enterJD)}` : "Beyond calculable range";
  const exitStr = occ.exitJD!=null ? `${formatFullDate(occ.exitJD)}` : "Beyond calculable range";
  const daysInStr = occ.daysIn!=null ? formatDurationDays(occ.daysIn) : "—";
  const daysLeftStr = occ.daysLeft!=null ? formatDurationDays(occ.daysLeft) : "—";

  const html = `
    <div class="pd-hero">
      <div class="pd-hero-glyph" style="color:${PLANET_COLORS[name]}">${PLANET_GLYPHS[name]}</div>
      <div class="pd-hero-name">${name}</div>
      <div class="pd-hero-sub">${formatFullDate(jd)}</div>
      <div class="pd-hero-badges">
        <span class="pd-badge">${sign.symbol} ${sign.name}</span>
        <span class="pd-badge">${nak} · Pada ${pada}</span>
        ${isNodeAlways ? `<span class="pd-badge retro">Always Retrograde</span>` : isRetro ? `<span class="pd-badge retro">Retrograde</span>` : `<span class="pd-badge direct">Direct</span>`}
      </div>
    </div>

    <div class="pd-section">
      <div class="pd-section-title">Position</div>
      <div class="pd-gauge-row">
        ${buildDegreeGaugeSVG(dms.raw, PLANET_COLORS[name])}
        <div class="pd-gauge-label">
          <div class="pd-gauge-deg">${dms.deg}° ${dms.min}' ${dms.sec}"</div>
          <div class="pd-gauge-sign">into ${sign.symbol} ${sign.name} (${sign.sk})</div>
        </div>
      </div>
    </div>

    <div class="pd-section">
      <div class="pd-section-title">Details</div>
      <div class="pd-grid">
        <div class="pd-stat">
          <div class="pd-stat-label">Ecliptic Longitude</div>
          <div class="pd-stat-value">${lon.toFixed(3)}°</div>
          <div class="pd-stat-sub">Sidereal (Lahiri)</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">Speed</div>
          <div class="pd-stat-value ${Math.abs(speed)<0.02?'accent':''}">${speed>=0?'+':''}${speed.toFixed(4)}°/day</div>
          <div class="pd-stat-sub">${speedCat}</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">Nakshatra Lord</div>
          <div class="pd-stat-value">${NAKSHATRA_LORDS[nakIdx]}</div>
          <div class="pd-stat-sub">${nak}, Pada ${pada} of 4</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">Sign Lord</div>
          <div class="pd-stat-value">${sign.lord}</div>
          <div class="pd-stat-sub">${sign.sk} rashi</div>
        </div>
        ${houseLine}
      </div>
    </div>

    <div class="pd-section">
      <div class="pd-section-title">Time In This Sign</div>
      <div class="pd-grid">
        <div class="pd-stat">
          <div class="pd-stat-label">Days In Sign</div>
          <div class="pd-stat-value accent">${daysInStr}</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">Days Remaining</div>
          <div class="pd-stat-value accent">${daysLeftStr}</div>
        </div>
      </div>
      <div class="pd-grid" style="margin-top:10px;">
        <div class="pd-stat">
          <div class="pd-stat-label">Entered Sign</div>
          <div class="pd-stat-value" style="font-size:11.5px;">${enterStr}</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">Exits Sign</div>
          <div class="pd-stat-value" style="font-size:11.5px;">${exitStr}</div>
        </div>
      </div>
    </div>

    <div class="pd-section">
      <div class="pd-section-title">Aspects (Graha Drishti)</div>
      ${aspectChips ? `<div class="pd-aspect-chip-row">${aspectChips}</div>` : `<div class="pd-empty-note">No planets currently in aspect with ${name}.</div>`}
    </div>
  `;
  document.getElementById('planetDetailContent').innerHTML = html;
  document.getElementById('planetDetailOverlay').classList.add('show');
}

/* ============================================================================
   RICH PLANET DETAIL
   ============================================================================ */
const PD = {
 Sun:{sk:'Surya',ic:'☀️',dei:'Shiva / Agni',gem:'Ruby (Manikya)',met:'Gold, Copper',day:'Sunday',col:'Red, Orange',dir:'East',el:'Fire',nat:'Malefic (mild)',gen:'Male',gun:'Sattva',tas:'Pungent',sea:'Summer (Grishma)',num:'1',man:'Om Hraam Hreem Hraum Sah Suryaya Namah',yrs:6,
  body:['Heart','Bones','Head','Right eye','Vitality'],sig:['Soul','Father','Authority','Government','Ego','Leadership','Health'],own:'Leo',ex:'Aries 10°',db:'Libra 10°',mt:'Leo 0–20°',fr:['Moon','Mars','Jupiter'],ne:['Mercury'],en:['Venus','Saturn'],
  about:'The king of the chart and the giver of light. Surya shows your core identity, willpower, confidence and how you shine in the world. A strong Sun gives dignity and leadership; an afflicted Sun can bring ego clashes or low vitality.',
  facts:[['📏','Diameter','1,391,400 km'],['⚖️','Mass','333,000 × Earth'],['🌡️','Surface','≈ 5,500 °C'],['⭐','Type','G2V yellow dwarf'],['⏳','Age','4.6 billion years'],['🌍','Zodiac cycle','≈ 365.25 days']]},
 Moon:{sk:'Chandra',ic:'🌙',dei:'Parvati / Varuna',gem:'Pearl (Moti)',met:'Silver',day:'Monday',col:'White, Cream',dir:'North-West',el:'Water',nat:'Benefic (waxing)',gen:'Female',gun:'Sattva',tas:'Salty',sea:'Rainy (Varsha)',num:'2',man:'Om Shram Shreem Shraum Sah Chandraya Namah',yrs:10,
  body:['Mind','Blood','Chest','Left eye','Fluids'],sig:['Mother','Emotions','Mind','Public','Comfort','Memory','Nourishment'],own:'Cancer',ex:'Taurus 3°',db:'Scorpio 3°',mt:'Taurus 4–20°',fr:['Sun','Mercury'],ne:['Mars','Jupiter','Venus','Saturn'],en:[],
  about:'The fastest planet and the mirror of your mind. Chandra rules emotions, instincts, mother, home and public mood. Your Moon sign and nakshatra set the Vimshottari Dasha, so it is the most personal point in the chart.',
  facts:[['📏','Diameter','3,474 km'],['🛰️','Distance','384,400 km'],['🔄','Sidereal month','27.32 days'],['🌗','Phase cycle','29.53 days'],['⬇️','Gravity','1.62 m/s²'],['🌡️','Surface','−173 to 127 °C']]},
 Mars:{sk:'Mangala',ic:'🔥',dei:'Kartikeya (Skanda)',gem:'Red Coral (Moonga)',met:'Copper',day:'Tuesday',col:'Red',dir:'South',el:'Fire',nat:'Malefic',gen:'Male',gun:'Tamas',tas:'Bitter',sea:'Summer',num:'9',man:'Om Kraam Kreem Kraum Sah Bhaumaya Namah',yrs:7,
  body:['Blood','Muscles','Marrow','Head','Energy'],sig:['Courage','Siblings','Land','Property','Action','Surgery','Competition'],own:'Aries, Scorpio',ex:'Capricorn 28°',db:'Cancer 28°',mt:'Aries 0–12°',fr:['Sun','Moon','Jupiter'],ne:['Venus','Saturn'],en:['Mercury'],
  about:'The commander of the zodiac. Mangala brings drive, bravery, stamina and the will to fight for what you want. Well placed it gives success in sports, engineering and defence; afflicted it gives anger, accidents or conflict.',
  facts:[['📏','Diameter','6,779 km'],['☀️','Distance from Sun','1.52 AU'],['🔄','Orbit','687 days'],['⏱️','Day length','24 h 37 m'],['🌑','Moons','2 (Phobos, Deimos)'],['🌡️','Average temp','≈ −63 °C']]},
 Mercury:{sk:'Budha',ic:'📚',dei:'Vishnu',gem:'Emerald (Panna)',met:'Bronze, Brass',day:'Wednesday',col:'Green',dir:'North',el:'Earth',nat:'Neutral (follows company)',gen:'Neutral',gun:'Rajas',tas:'Mixed',sea:'Autumn (Sharad)',num:'5',man:'Om Braam Breem Braum Sah Budhaya Namah',yrs:17,
  body:['Nervous system','Skin','Tongue','Lungs','Hands'],sig:['Intellect','Speech','Trade','Writing','Analysis','Humour','Youth'],own:'Gemini, Virgo',ex:'Virgo 15°',db:'Pisces 15°',mt:'Virgo 16–20°',fr:['Sun','Venus'],ne:['Mars','Jupiter','Saturn'],en:['Moon'],
  about:'The prince of the planets. Budha rules thinking, communication, business, learning and wit. It takes the colour of whichever planet it sits with, so its company matters as much as its sign.',
  facts:[['📏','Diameter','4,879 km'],['☀️','Distance from Sun','0.39 AU'],['🔄','Orbit','88 days'],['⏱️','Solar day','176 Earth days'],['🌑','Moons','0'],['🌡️','Surface','−180 to 430 °C']]},
 Jupiter:{sk:'Guru / Brihaspati',ic:'🕉️',dei:'Indra / Brahma',gem:'Yellow Sapphire (Pukhraj)',met:'Gold',day:'Thursday',col:'Yellow',dir:'North-East',el:'Ether (Akasha)',nat:'Great benefic',gen:'Male',gun:'Sattva',tas:'Sweet',sea:'Winter (Hemanta)',num:'3',man:'Om Graam Greem Graum Sah Gurave Namah',yrs:16,
  body:['Liver','Fat','Thighs','Arteries','Ears'],sig:['Wisdom','Teachers','Children','Wealth','Dharma','Fortune','Expansion'],own:'Sagittarius, Pisces',ex:'Cancer 5°',db:'Capricorn 5°',mt:'Sagittarius 0–10°',fr:['Sun','Moon','Mars'],ne:['Saturn'],en:['Mercury','Venus'],
  about:'The teacher of the gods and the planet of grace. Guru expands whatever it touches: knowledge, faith, children, money and good fortune. It protects the houses it aspects and is the main benefic of the chart.',
  facts:[['📏','Diameter','139,820 km'],['☀️','Distance from Sun','5.20 AU'],['🔄','Orbit','11.86 years'],['⏱️','Day length','9 h 56 m'],['🌑','Moons','90+'],['⚖️','Mass','318 × Earth']]},
 Venus:{sk:'Shukra',ic:'💎',dei:'Lakshmi',gem:'Diamond (Heera)',met:'Silver, Platinum',day:'Friday',col:'White, Pink',dir:'South-East',el:'Water',nat:'Benefic',gen:'Female',gun:'Rajas',tas:'Sour',sea:'Spring (Vasanta)',num:'6',man:'Om Draam Dreem Draum Sah Shukraya Namah',yrs:20,
  body:['Reproductive organs','Face','Kidneys','Skin','Throat'],sig:['Love','Marriage','Beauty','Arts','Luxury','Vehicles','Pleasure'],own:'Taurus, Libra',ex:'Pisces 27°',db:'Virgo 27°',mt:'Libra 0–15°',fr:['Mercury','Saturn'],ne:['Mars','Jupiter'],en:['Sun','Moon'],
  about:'The guru of the demons and the giver of comforts. Shukra governs romance, partnerships, art, music, beauty and wealth. It shows how you love and what you find pleasing.',
  facts:[['📏','Diameter','12,104 km'],['☀️','Distance from Sun','0.72 AU'],['🔄','Orbit','224.7 days'],['⏱️','Rotation','243 days (backwards)'],['🌑','Moons','0'],['🌡️','Surface','≈ 465 °C']]},
 Saturn:{sk:'Shani',ic:'⏳',dei:'Yama / Brahma',gem:'Blue Sapphire (Neelam)',met:'Iron',day:'Saturday',col:'Black, Dark blue',dir:'West',el:'Air',nat:'Malefic (teacher)',gen:'Neutral',gun:'Tamas',tas:'Astringent',sea:'Late winter (Shishira)',num:'8',man:'Om Praam Preem Praum Sah Shanaye Namah',yrs:19,
  body:['Bones','Teeth','Knees','Nerves','Legs'],sig:['Karma','Discipline','Delay','Longevity','Hard work','Justice','Service'],own:'Capricorn, Aquarius',ex:'Libra 20°',db:'Aries 20°',mt:'Aquarius 0–20°',fr:['Mercury','Venus'],ne:['Jupiter'],en:['Sun','Moon','Mars'],
  about:'The judge and the great teacher. Shani rewards patience and effort and tests whatever is unfinished. Its delays are slow but lasting, and a well placed Saturn gives discipline, status and endurance.',
  facts:[['📏','Diameter','116,460 km'],['☀️','Distance from Sun','9.54 AU'],['🔄','Orbit','29.46 years'],['⏱️','Day length','10 h 33 m'],['🌑','Moons','140+'],['💍','Famous for','Bright ring system']]},
 Rahu:{sk:'Rahu',ic:'🐉',dei:'Durga / Naga',gem:'Hessonite (Gomed)',met:'Lead, Mixed',day:'Saturday',col:'Smoky, Dark',dir:'South-West',el:'Air',nat:'Malefic (shadow)',gen:'Neutral',gun:'Tamas',tas:'Pungent',sea:'Varies',num:'4',man:'Om Bhraam Bhreem Bhraum Sah Rahave Namah',yrs:18,
  body:['Skin','Nervous system','Poison','Feet'],sig:['Obsession','Foreign lands','Technology','Illusion','Ambition','Sudden events','Unconventional'],own:'Aquarius (co-lord)',ex:'Taurus',db:'Scorpio',mt:'Gemini / Virgo (varies)',fr:['Mercury','Venus','Saturn'],ne:['Jupiter'],en:['Sun','Moon','Mars'],
  about:'A shadow planet: the north node of the Moon. Rahu magnifies desire and ambition and pulls you toward new experiences, often unusual or foreign. It is always retrograde and brings sudden gains and tests.',
  facts:[['🌐','Nature','Lunar north node'],['🔄','Full cycle','18.6 years'],['♈','Time per sign','≈ 1.5 years'],['↩️','Motion','Always retrograde'],['🌒','Eclipses','Near Sun/Moon']]},
 Ketu:{sk:'Ketu',ic:'🪔',dei:'Ganesha',gem:"Cat's Eye (Lehsunia)",met:'Mixed',day:'Tuesday',col:'Multi-colour',dir:'South-West',el:'Fire',nat:'Malefic (spiritual)',gen:'Neutral',gun:'Tamas',tas:'Mixed',sea:'Varies',num:'7',man:'Om Sraam Sreem Sraum Sah Ketave Namah',yrs:7,
  body:['Nerves','Spine','Abdomen','Stomach'],sig:['Moksha','Detachment','Spirituality','Past karma','Intuition','Isolation','Research'],own:'Scorpio (co-lord)',ex:'Scorpio',db:'Taurus',mt:'Sagittarius (varies)',fr:['Mars','Venus','Saturn'],ne:['Mercury','Jupiter'],en:['Sun','Moon'],
  about:'The south node and the planet of release. Ketu points to past-life skill, detachment and spiritual insight. It makes the house it sits in feel empty yet deeply intuitive.',
  facts:[['🌐','Nature','Lunar south node'],['🔄','Full cycle','18.6 years'],['♈','Time per sign','≈ 1.5 years'],['↩️','Motion','Always retrograde'],['🌒','Eclipses','Opposite Rahu']]}
};
const MEAN_SPEED = { Sun:0.9856, Moon:13.176, Mars:0.524, Mercury:1.383, Jupiter:0.0831, Venus:1.2, Saturn:0.0335, Rahu:0.053, Ketu:0.053 };
const LADDER = ['Exalted','Own sign','Friendly','Neutral','Enemy','Debilitated'];
function dignityOf(n, si){
  if (CONDEX[n] === si) return 'Exalted'; if ((CONDEX[n]+6)%12 === si) return 'Debilitated';
  const sl = SIGNS[si].lord; if (sl === n) return 'Own sign';
  if (PD[n].fr.includes(sl)) return 'Friendly'; if (PD[n].en.includes(sl)) return 'Enemy'; return 'Neutral';
}
function pdxTab(btn, id){
  const root = btn.closest('.pdx-root');
  root.querySelectorAll('.pdx-tab').forEach(t=> t.classList.toggle('on', t === btn));
  root.querySelectorAll('.pdx-pane').forEach(p=> p.classList.toggle('on', p.dataset.pane === id));
  const m = btn.closest('.pdmodal'); if (m) m.scrollTo({ top: 0, behavior: 'smooth' });
}
function openPlanetDetail(name, jd){
  if (jd == null) jd = currentJD;
  if (OUTER_LIST.includes(name)) return openOuterPlanetDetail(name, jd);
  const snap = snapshotPositions(jd), lon = snap.sidereal[name], si = getSignIndex(lon), sign = SIGNS[si], dms = degreeInSign(lon);
  const nakIdx = getNakshatraIndex(lon), nak = NAKSHATRAS[nakIdx], pada = getPadaIndex(lon)+1, d = PD[name], col = PLANET_COLORS[name];
  const isNode = name === 'Rahu' || name === 'Ketu', isRetro = isNode || snap.retro[name];
  const speed = planetSpeed(name, jd), occ = getSignOccupancy(name, jd), dig = dignityOf(name, si);
  const nSign = (([0,9,6,3][si%4]) + Math.floor(dms.raw/(30/9))) % 12, varg = nSign === si;
  const sunD = Math.abs(angDiff(lon, snap.sidereal.Sun)), comb = COMBUST[name] && sunD < COMBUST[name];
  const pchip = n=> `<button type="button" class="pdx-pchip" style="--c:${PLANET_COLORS[n]}" onclick="openPlanetDetail('${n}',${jd})">${PLANET_GLYPHS[n]} ${n}</button>`;
  const chips = a=> a.length ? a.map(x=>`<span class="pdx-chip">${x}</span>`).join('') : '<span class="pdx-chip">None</span>';
  const card = (k,v,sb,w)=> `<div class="pdx-card pdx-in ${w?'wide':''}"><div class="k">${k}</div><div class="v">${v}</div>${sb?`<div class="s">${sb}</div>`:''}</div>`;
  let house = '';
  if (isValidProfile(activeNatalProfile)){ const L = computeNatalAscendant(activeNatalProfile).lagnaLon; const h = getHouseOfLongitude(lon, getSignIndex(L)); house = card('House from Lagna', `${h}${h===1?' · Lagna':''}`, activeNatalProfile.name); }
  const ratio = Math.abs(speed) / MEAN_SPEED[name], spPct = Math.min(100, ratio*50);
  const total = (occ.daysIn!=null && occ.daysLeft!=null) ? occ.daysIn + occ.daysLeft : null, prog = total ? Math.round(occ.daysIn/total*100) : Math.round(dms.raw/30*100);
  // upcoming sign changes
  let ing = '', j = occ.exitJD, cnt = 0;
  while (j != null && cnt < 4){ const nj = j + 0.5, ns = getSignIndex(snapshotPositions(nj).sidereal[name]); ing += `<div class="pdx-row pdx-in" style="--i:${cnt}"><span>${SIGNS[ns].symbol} ${SIGNS[ns].name}</span><b>${formatFullDate(j)}</b></div>`; j = getSignOccupancy(name, nj).exitJD; cnt++; }
  // aspects
  const asp = computeAspects(snap.sidereal).filter(a=> a.from===name || a.to===name), ord = {3:'3rd',4:'4th',5:'5th',7:'7th',8:'8th',9:'9th',10:'10th'};
  const aspHtml = asp.map((a,i)=>{ const f = a.from===name, o = f ? a.to : a.from;
    return `<div class="pdx-row pdx-in" style="--i:${i};cursor:pointer" onclick="openPlanetDetail('${o}',${jd})"><span style="color:${PLANET_COLORS[o]};font-size:18px">${PLANET_GLYPHS[o]}</span><span>${f?'aspects':'aspected by'} <b style="color:var(--text);margin:0;font-family:inherit;font-size:13px">${o}</b></span><b>${ord[a.houseOffset]||a.houseOffset+'th'} drishti</b></div>`; }).join('');
  const conj = PLANET_LIST.filter(n=> n!==name && getSignIndex(snap.sidereal[n]) === si);
  const html = `<div class="pdx-root" style="--pc:${col};--pca:${col}55">
    <div class="pdx-hero">
      <div class="pdx-orb"><span>${PLANET_GLYPHS[name]}</span></div>
      <div class="pdx-name">${name}</div><div class="pdx-sk">${d.sk}</div>
      <div class="pdx-date">${formatFullDate(jd)}</div>
      <div class="pdx-badges"><span class="pdx-badge">${sign.symbol} ${sign.name}</span><span class="pdx-badge">${nak} · Pada ${pada}</span>
        <span class="pdx-badge ${isRetro?'bad':'good'}">${isRetro?'℞ Retrograde':'Direct'}</span><span class="pdx-badge ${dig==='Exalted'||dig==='Own sign'?'good':dig==='Debilitated'||dig==='Enemy'?'bad':''}">${dig}</span>${comb?'<span class="pdx-badge bad">☀ Combust</span>':''}${varg?'<span class="pdx-badge good">Vargottama</span>':''}</div>
    </div>
    <div class="pdx-tabs"><button class="pdx-tab on" onclick="pdxTab(this,'ov')">Overview</button><button class="pdx-tab" onclick="pdxTab(this,'st')">Strength</button><button class="pdx-tab" onclick="pdxTab(this,'ka')">Karakas</button><button class="pdx-tab" onclick="pdxTab(this,'ti')">Timeline</button><button class="pdx-tab" onclick="pdxTab(this,'as')">Aspects</button><button class="pdx-tab" onclick="pdxTab(this,'fa')">Facts</button></div>
    <div class="pdx-pane on" data-pane="ov">
      <div class="pdx-about pdx-in">${d.about}</div>
      <div class="pdx-h">Position</div>
      <div class="pd-gauge-row pdx-in" style="--i:1">${buildDegreeGaugeSVG(dms.raw, col)}<div class="pd-gauge-label"><div class="pd-gauge-deg">${dms.deg}° ${dms.min}' ${dms.sec}"</div><div class="pd-gauge-sign">into ${sign.symbol} ${sign.name} (${sign.sk})</div></div></div>
      <div class="pdx-grid" style="margin-top:12px">
        ${card('Sidereal longitude', lon.toFixed(3)+'°', 'Lahiri ayanamsa')}${card('Nakshatra', nak, 'Lord '+NAKSHATRA_LORDS[nakIdx]+' · Pada '+pada+' of 4')}
        ${card('Sign lord', sign.lord, sign.sk+' rashi')}${card('Navamsa (D9)', SIGNS[nSign].symbol+' '+SIGNS[nSign].name, varg?'Vargottama: same sign in D1 and D9':'Soul and marriage strength')}${house}
        ${card('Daily motion', (speed>=0?'+':'')+speed.toFixed(4)+'°/day', speedCategory(name, jd))}
        ${conj.length ? `<div class="pdx-card wide pdx-in"><div class="k">Sharing the sign with</div><div class="pdx-chips" style="margin-top:8px">${conj.map(pchip).join('')}</div></div>` : ''}
      </div>
      <div class="pdx-h">Speed vs. average</div>
      <div class="pdx-card pdx-in"><div class="v">${ratio.toFixed(2)}× its average pace</div><div class="pdx-bar"><i style="--w:${spPct}%"></i></div><div class="s" style="margin-top:6px">${ratio<0.15?'Nearly stationary (station point)':ratio<0.8?'Slower than usual':ratio<1.2?'Normal speed':'Faster than usual'}</div></div>
    </div>
    <div class="pdx-pane" data-pane="st">
      <div class="pdx-h">Dignity in ${sign.name}</div>
      <div class="pdx-ladder">${LADDER.map(l=>`<div class="pdx-step ${l===dig?'cur':''}">${l}</div>`).join('')}</div>
      <div class="pdx-grid" style="margin-top:12px">
        ${card('Sign lord relation', sign.lord===name?'Rules this sign':sign.lord+' is '+(d.fr.includes(sign.lord)?'a friend':d.en.includes(sign.lord)?'an enemy':'neutral'))}
        ${card('Vargottama', varg?'Yes':'No', 'D1 sign = D9 sign')}
        ${card('Combustion', COMBUST[name] ? (comb?'Combust':'Not combust') : 'Not applicable', COMBUST[name] ? sunD.toFixed(1)+'° from Sun (limit '+COMBUST[name]+'°)' : '')}
        ${card('Motion (Cheshta)', isRetro?'Retrograde':'Direct', isRetro?'Retrograde planets act with extra intensity':'')}
      </div>
      <div class="pdx-h">Key degrees</div>
      <div class="pdx-grid">${card('Exaltation', d.ex)}${card('Debilitation', d.db)}${card('Own sign', d.own)}${card('Moolatrikona', d.mt)}</div>
      <div class="pdx-h">Natural relationships</div>
      <div class="pdx-card"><div class="k">Friends</div><div class="pdx-chips" style="margin:8px 0 12px">${d.fr.length?d.fr.map(pchip).join(''):chips([])}</div><div class="k">Neutral</div><div class="pdx-chips" style="margin:8px 0 12px">${d.ne.length?d.ne.map(pchip).join(''):chips([])}</div><div class="k">Enemies</div><div class="pdx-chips" style="margin-top:8px">${d.en.length?d.en.map(pchip).join(''):chips([])}</div></div>
    </div>
    <div class="pdx-pane" data-pane="ka">
      <div class="pdx-grid">
        ${card('Deity', d.dei)}${card('Gemstone', d.gem)}${card('Metal', d.met)}${card('Day', d.day)}${card('Colour', d.col)}${card('Direction', d.dir)}
        ${card('Element', d.el)}${card('Nature', d.nat)}${card('Gender', d.gen)}${card('Guna', d.gun)}${card('Taste', d.tas)}${card('Season', d.sea)}
        ${card('Lucky number', d.num)}${card('Dasha years', d.yrs+' years', 'Vimshottari Dasha')}${card('Bija mantra', d.man, '', true)}
      </div>
      <div class="pdx-h">Signifies</div><div class="pdx-chips pdx-in">${chips(d.sig)}</div>
      <div class="pdx-h">Body parts</div><div class="pdx-chips pdx-in">${chips(d.body)}</div>
    </div>
    <div class="pdx-pane" data-pane="ti">
      <div class="pdx-h">Time in ${sign.name}</div>
      <div class="pdx-card pdx-in"><div class="v">${prog}% through this sign</div><div class="pdx-bar"><i style="--w:${prog}%"></i></div>
        <div class="s" style="margin-top:8px">${occ.daysIn!=null?formatDurationDays(occ.daysIn)+' in · ':''}${occ.daysLeft!=null?formatDurationDays(occ.daysLeft)+' left':''}</div></div>
      <div class="pdx-grid" style="margin-top:10px">${card('Entered', occ.enterJD!=null?formatFullDate(occ.enterJD):'Beyond range')}${card('Leaves', occ.exitJD!=null?formatFullDate(occ.exitJD):'Beyond range')}</div>
      <div class="pdx-h">Next sign changes</div>${ing || '<div class="pd-empty-note">Beyond the calculable range.</div>'}
    </div>
    <div class="pdx-pane" data-pane="as">
      <div class="pdx-h">Graha Drishti</div>${aspHtml || `<div class="pd-empty-note">No planets currently in aspect with ${name}.</div>`}
    </div>
    <div class="pdx-pane" data-pane="fa">
      <div class="pdx-h">${isNode?'About the node':'Astronomy facts'}</div>
      <div class="pdx-grid">${d.facts.map(f=>card(f[0]+' '+f[1], f[2])).join('')}</div>
    </div>
  </div>`;
  const box = document.getElementById('planetDetailContent'); box.innerHTML = html;
  document.getElementById('planetDetailOverlay').classList.add('show');
  const m = box.closest('.pdmodal'); if (m) m.scrollTop = 0;
  requestAnimationFrame(()=> requestAnimationFrame(()=> box.querySelector('.pdx-root').classList.add('go')));
}

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

/* ---- Rich popup for Uranus / Neptune / Pluto (same look as the other planets) ---- */
function focusBody(name){
  if (SOL.view==='solar'){ solBuild(); }
  setCamMode('focus'); focusedPlanetKey = (SOL.view==='solar' ? 'sol_' : 'geo_') + name; autoRotate = false; SOL.lastFocus = null;
  const sel = document.getElementById('focusPlanetSelect'); if (sel) sel.value = focusedPlanetKey;
  updateLegend(); markDirty(); if (typeof syncPickBtn==='function') syncPickBtn();
}
function openOuterPlanetDetail(name, jd){
  if (jd == null) jd = currentJD;
  const I = OUTER_INFO[name], snap = snapshotPositions(jd), lon = snap.sidereal[name], si = getSignIndex(lon), sign = SIGNS[si], dms = degreeInSign(lon);
  const nakIdx = getNakshatraIndex(lon), nak = NAKSHATRAS[nakIdx], pada = getPadaIndex(lon)+1, col = PLANET_COLORS[name];
  const isRetro = !!snap.retro[name], speed = planetSpeed(name, jd);
  const card = (k,v,sb,w)=> `<div class="pdx-card pdx-in ${w?'wide':''}"><div class="k">${k}</div><div class="v">${v}</div>${sb?`<div class="s">${sb}</div>`:''}</div>`;
  const chips = a=> a.map(x=>`<span class="pdx-chip">${x}</span>`).join('');
  const pchip = n=> `<button type="button" class="pdx-pchip" style="--c:${PLANET_COLORS[n]||'#8FA3B8'}" onclick="openPlanetDetail('${n}',${jd})">${PLANET_GLYPHS[n]||'⌖'} ${n}</button>`;
  // house from Lagna (if a natal profile is active)
  let house = '', houseLine = '';
  if (isValidProfile(activeNatalProfile)){ const L = computeNatalAscendant(activeNatalProfile).lagnaLon; const h = getHouseOfLongitude(lon, getSignIndex(L));
    house = card('House from Lagna', `${h}${h===1?' · Lagna':''}`, activeNatalProfile.name); houseLine = `<div class="pdx-card wide pdx-in"><div class="k">What this means for ${activeNatalProfile.name}</div><div class="s" style="font-size:13px;line-height:1.6;color:var(--text)">${outerHouseLine(name, h)}</div></div>`; }
  const conj = PLANET_LIST.filter(n=> getSignIndex(snap.sidereal[n]) === si);
  // sign occupancy (slow planets: guard against long searches)
  let occ = {enterJD:null, exitJD:null, daysIn:null, daysLeft:null};
  try { occ = getSignOccupancy(name, jd); } catch(e){}
  const total = (occ.daysIn!=null && occ.daysLeft!=null) ? occ.daysIn + occ.daysLeft : null, prog = total ? Math.round(occ.daysIn/total*100) : Math.round(dms.raw/30*100);
  let ing = '', j = occ.exitJD, cnt = 0;
  try { while (j != null && cnt < 3){ const nj = j + 1, ns = getSignIndex(snapshotPositions(nj).sidereal[name]); ing += `<div class="pdx-row pdx-in" style="--i:${cnt}"><span>${SIGNS[ns].symbol} ${SIGNS[ns].name}</span><b>${formatFullDate(j)}</b></div>`; j = getSignOccupancy(name, nj).exitJD; cnt++; } } catch(e){}
  // Western aspects to the other planets now (transiting)
  const nowTargets = ALL_BODIES.map(n=>[n, snap.sidereal[n]]);
  const asp = outerAspectsTo(lon, nowTargets, name);
  const aspRow = (a,i,sub)=> { const t = a.target, tc = PLANET_COLORS[t]||'#8FA3B8', tg = PLANET_GLYPHS[t]||'⌖';
    return `<div class="pdx-row pdx-in" style="--i:${i};cursor:${PLANET_COLORS[t]?'pointer':'default'}" ${PLANET_COLORS[t]&&t!=='Ascendant'?`onclick="openPlanetDetail('${t}',${jd})"`:''}><span style="color:${tc};font-size:18px">${tg}</span><span>${a.asp.symbol} ${a.asp.name} <b style="color:var(--text);margin:0;font-family:inherit;font-size:13px">${t}</b><br><small style="color:var(--text-faint)">${name} ${a.asp.verb} ${t}${sub||''}</small></span><b>${a.dev.toFixed(1)}° orb</b></div>`; };
  const aspHtml = asp.map((a,i)=> aspRow(a,i)).join('');
  // aspects from transiting outer planet to the natal chart
  let natalHtml = '';
  if (isValidProfile(activeNatalProfile)){
    try {
      const nc = computeNatalAscendant(activeNatalProfile), ns = snapshotPositions(nc.jd).sidereal;
      const tg = PLANET_LIST.map(n=>[n, ns[n]]).concat(OUTER_LIST.map(n=>[n, ns[n]])).concat([['Ascendant', nc.lagnaLon]]);
      const na = outerAspectsTo(lon, tg, null);
      natalHtml = `<div class="pdx-h">To ${activeNatalProfile.name}'s birth chart</div>` + (na.length ? na.map((a,i)=> aspRow(a,i,' (natal)')).join('') : '<div class="pd-empty-note">No close aspects to the natal chart right now.</div>');
    } catch(e){}
  }
  const ratio = Math.abs(speed), spTxt = ratio < 0.003 ? 'Nearly stationary (changing direction)' : ratio < 0.02 ? 'Slow, typical for an outer planet' : 'Moving steadily';
  const html = `<div class="pdx-root" style="--pc:${col};--pca:${col}55">
    <div class="pdx-hero">
      <div class="pdx-orb"><span>${PLANET_GLYPHS[name]}</span></div>
      <div class="pdx-name">${name}</div><div class="pdx-sk">${I.sk} · ${I.role}</div>
      <div class="pdx-date">${formatFullDate(jd)}</div>
      <div class="pdx-badges"><span class="pdx-badge">${sign.symbol} ${sign.name}</span><span class="pdx-badge">${nak} · Pada ${pada}</span>
        <span class="pdx-badge ${isRetro?'bad':'good'}">${isRetro?'℞ Retrograde':'Direct'}</span><span class="pdx-badge">Outer planet</span></div>
    </div>
    <div class="pdx-tabs"><button class="pdx-tab on" onclick="pdxTab(this,'ov')">Overview</button><button class="pdx-tab" onclick="pdxTab(this,'me')">Meaning</button><button class="pdx-tab" onclick="pdxTab(this,'ti')">Timeline</button><button class="pdx-tab" onclick="pdxTab(this,'as')">Aspects</button><button class="pdx-tab" onclick="pdxTab(this,'fa')">Facts</button></div>
    <div class="pdx-pane on" data-pane="ov">
      <div class="pdx-about pdx-in">${I.about}</div>
      <div class="pdx-h">Position</div>
      <div class="pd-gauge-row pdx-in" style="--i:1">${buildDegreeGaugeSVG(dms.raw, col)}<div class="pd-gauge-label"><div class="pd-gauge-deg">${dms.deg}° ${dms.min}' ${dms.sec}"</div><div class="pd-gauge-sign">into ${sign.symbol} ${sign.name} (${sign.sk})</div></div></div>
      <div class="pdx-grid" style="margin-top:12px">
        ${card('Sidereal longitude', lon.toFixed(3)+'°', 'Lahiri ayanamsa')}${card('Nakshatra', nak, 'Lord '+NAKSHATRA_LORDS[nakIdx]+' · Pada '+pada+' of 4')}
        ${card('Sign lord', sign.lord, sign.sk+' rashi')}${house}
        ${card('Daily motion', (speed>=0?'+':'')+speed.toFixed(4)+'°/day', spTxt)}
        ${houseLine}
        ${conj.length ? `<div class="pdx-card wide pdx-in"><div class="k">Sharing the sign with</div><div class="pdx-chips" style="margin-top:8px">${conj.map(pchip).join('')}</div></div>` : ''}
      </div>
      <button type="button" class="btn-block" style="margin-top:14px" onclick="closePlanetDetail();focusBody('${name}')">🎥 Fly the camera to ${name}</button>
    </div>
    <div class="pdx-pane" data-pane="me">
      <div class="pdx-h">Key themes</div><div class="pdx-chips pdx-in">${chips(I.themes)}</div>
      <div class="pdx-h">Body &amp; areas</div><div class="pdx-chips pdx-in">${chips(I.body)}</div>
      <div class="pdx-grid" style="margin-top:12px">${card('Modern ruler of', I.rules)}${card('Cycle', I.cycle)}${card('Sanskrit name (modern use)', I.sk)}${card('Role', I.role)}</div>
      <div class="pdx-card wide pdx-in" style="margin-top:12px"><div class="k">A note on Vedic use</div><div class="s" style="font-size:12.5px;line-height:1.6">${OUTER_VEDIC_NOTE}</div></div>
    </div>
    <div class="pdx-pane" data-pane="ti">
      <div class="pdx-h">Time in ${sign.name}</div>
      <div class="pdx-card pdx-in"><div class="v">${prog}% through this sign</div><div class="pdx-bar"><i style="--w:${prog}%"></i></div>
        <div class="s" style="margin-top:8px">${occ.daysIn!=null?formatDurationDays(occ.daysIn)+' in · ':''}${occ.daysLeft!=null?formatDurationDays(occ.daysLeft)+' left':'Typical stay: '+I.perSign}</div></div>
      <div class="pdx-grid" style="margin-top:10px">${card('Entered', occ.enterJD!=null?formatFullDate(occ.enterJD):'Before the search range')}${card('Leaves', occ.exitJD!=null?formatFullDate(occ.exitJD):'After the search range')}</div>
      <div class="pdx-h">Next sign changes</div>${ing || '<div class="pd-empty-note">Beyond the calculable range (it moves very slowly).</div>'}
    </div>
    <div class="pdx-pane" data-pane="as">
      <div class="pdx-h">Aspects to the sky now (Western orbs)</div>${aspHtml || `<div class="pd-empty-note">No close aspects to other planets right now.</div>`}
      ${natalHtml}
      <div class="s" style="margin-top:12px;font-size:11.5px;color:var(--text-faint)">Orbs: conjunction 8°, opposition 8°, trine 7°, square 7°, sextile 4° (+1° for Sun, Moon and Ascendant).</div>
    </div>
    <div class="pdx-pane" data-pane="fa">
      <div class="pdx-h">Astronomy facts</div>
      <div class="pdx-grid">${I.facts.map(f=>card(f[0]+' '+f[1], f[2])).join('')}</div>
    </div>
  </div>`;
  const box = document.getElementById('planetDetailContent'); box.innerHTML = html;
  document.getElementById('planetDetailOverlay').classList.add('show');
  const m = box.closest('.pdmodal'); if (m) m.scrollTop = 0;
  requestAnimationFrame(()=> requestAnimationFrame(()=> box.querySelector('.pdx-root').classList.add('go')));
}

function closePlanetDetail(){
  document.getElementById('planetDetailOverlay').classList.remove('show');
}
document.getElementById('planetDetailClose').addEventListener('click', closePlanetDetail);

/* ---- Aspect Explorer shortcut popup (top right of the 3D screen) ----
   Same explorer as the side panel: the block is moved into the popup while it
   is open and moved back when it closes, so both always behave the same. */
function openAspExp(){
  const block = document.getElementById('explorerBlock');
  document.getElementById('aspExpBody').appendChild(block);
  try { renderExplorer(getChartContext()); } catch(e){}
  document.getElementById('aspExpOverlay').classList.add('show');
}
function closeAspExp(){
  document.getElementById('aspExpOverlay').classList.remove('show');
  document.getElementById('explorerHome').appendChild(document.getElementById('explorerBlock'));
}
document.getElementById('aspExpBtn').addEventListener('click', openAspExp);
(function setupRisingPress(){
  const el = document.getElementById('hudAsc'); let t = null, fired = false, sx = 0, sy = 0;
  const clear = ()=>{ if (t){ clearTimeout(t); t = null; } el.classList.remove('pressing'); };
  el.addEventListener('pointerdown', (e)=>{
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fired = false; sx = e.clientX; sy = e.clientY; el.classList.add('pressing');
    t = setTimeout(()=>{ t = null; fired = true; el.classList.remove('pressing'); try { navigator.vibrate && navigator.vibrate(18); } catch(_){} openRising(); }, 550);
  });
  el.addEventListener('pointermove', (e)=>{ if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clear(); });
  ['pointerup','pointercancel','pointerleave'].forEach(n => el.addEventListener(n, clear));
  el.addEventListener('click', (e)=>{ if (fired){ fired = false; e.preventDefault(); e.stopImmediatePropagation(); return; } askLiveLoc(); });
  el.addEventListener('contextmenu', (e)=> e.preventDefault());
  el.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if (e.shiftKey) openRising(); else askLiveLoc(); } });
})();
document.getElementById('risingClose').addEventListener('click', closeRising);
document.getElementById('risingOverlay').addEventListener('click', (e)=>{ if (e.target.id === 'risingOverlay' && Date.now() - risingOpenedAt > 450) closeRising(); });
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeRising(); });
document.addEventListener('click', (e)=>{ if (e.target.closest && e.target.closest('[data-rs-place]')) askLiveLoc(); });
document.getElementById('aspExpClose').addEventListener('click', closeAspExp);
document.getElementById('aspExpOverlay').addEventListener('click', (e)=>{
  if (e.target.id==='aspExpOverlay') closeAspExp();
});
document.addEventListener('keydown', (e)=>{
  if (e.key==='Escape' && document.getElementById('aspExpOverlay').classList.contains('show')) closeAspExp();
});
document.getElementById('planetDetailOverlay').addEventListener('click', (e)=>{
  if (e.target.id==='planetDetailOverlay') closePlanetDetail();
});

const NAKSHATRA_LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];

function formatDurationDays(days){
  const d = Math.abs(days);
  if (d < 1) return `${Math.round(d*24)} hours`;
  if (d < 60) return `${d.toFixed(1)} days`;
  if (d < 400) return `${(d/30.44).toFixed(1)} months`;
  return `${(d/365.25).toFixed(2)} years`;
}

/* ============================================================================
   TIMELINE SCRUBBER
   ============================================================================ */
function renderTimeline(){
  const track = document.getElementById('tlTrack');
  const fill = document.getElementById('tlFill');
  const playhead = document.getElementById('tlPlayhead');

  const span = timelineWindowEnd - timelineWindowStart;
  const frac = Math.max(0, Math.min(1, (currentJD-timelineWindowStart)/span));
  playhead.style.left = (frac*100)+"%";
  fill.style.width = (frac*100)+"%";

  // Clear old ticks
  track.querySelectorAll('.tl-tick, .tl-tick-label').forEach(el=>el.remove());

  // Ingress ticks (Saturn, Jupiter, Mars for visibility; too many for Moon/Mercury)
  const transitResults = getTransitResults(Math.max(timelineWindowStart, currentJD-30));
  transitResults.filter(e=> ["Saturn","Jupiter","Mars","Rahu","Ketu"].includes(e.planet)).forEach(e=>{
    if (e.jd<timelineWindowStart || e.jd>timelineWindowEnd) return;
    const f = (e.jd-timelineWindowStart)/span;
    const tick = document.createElement('div');
    tick.className = 'tl-tick';
    tick.style.left = (f*100)+"%";
    tick.title = `${e.planet} enters ${SIGNS[e.toSign].name} — ${formatHudDate(e.jd)}`;
    track.appendChild(tick);
  });

  // Conjunction ticks
  const conjResults = getConjResults(Math.max(timelineWindowStart, currentJD-30));
  conjResults.forEach(e=>{
    if (e.jd<timelineWindowStart || e.jd>timelineWindowEnd) return;
    const f = (e.jd-timelineWindowStart)/span;
    const tick = document.createElement('div');
    tick.className = 'tl-tick conjunction';
    tick.style.left = (f*100)+"%";
    tick.title = `${e.planetA} ⚯ ${e.planetB} — ${formatHudDate(e.jd)}`;
    track.appendChild(tick);
  });
}

document.getElementById('tlTrack').addEventListener('click', (e)=>{
  const rect = e.currentTarget.getBoundingClientRect();
  const frac = (e.clientX-rect.left)/rect.width;
  const jd = timelineWindowStart + frac*(timelineWindowEnd-timelineWindowStart);
  jumpToJD(jd);
});

function jumpToJD(jd){
  currentJD = jd;
  if (jd < timelineWindowStart || jd > timelineWindowEnd){
    timelineWindowStart = jd-30;
    timelineWindowEnd = jd+365;
  }
  refreshAll();
}

/* ============================================================================
   MAIN REFRESH LOOP
   ============================================================================ */
function refreshAll(){
  const snap = updateSceneForJD(currentJD);
  renderHUD(snap);
  renderSkyTable(snap);
  renderTransitFeed();
  renderConjunctionFeed();
  renderTimeline();
  if (!activeNatalProfile) renderChartTab(snap);
}

/* Animation play/pause driving currentJD forward */
let lastUIThrottle = 0;
function animationTick(ts){
  if (isPlaying){
    if (lastFrameTime===null) lastFrameTime = ts;
    const dt = (ts-lastFrameTime)/1000;
    lastFrameTime = ts;
    currentJD += dt*playSpeedDaysPerSec;
    if (currentJD > timelineWindowEnd){ timelineWindowStart=currentJD-30; timelineWindowEnd=currentJD+365; }
    const snap = updateSceneForJD(currentJD);
    // Throttle DOM-heavy UI updates to ~12fps during playback — the 3D motion stays smooth
    // (driven by renderLoop separately) while text/table updates, which nobody can read at 60fps
    // anyway, stop competing for main-thread time every single frame.
    if (ts - lastUIThrottle > 80){
      lastUIThrottle = ts;
      renderHUD(snap);
      renderSkyTable(snap);
      renderTimelineLight();
    }
  } else {
    lastFrameTime = null;
  }
  requestAnimationFrame(animationTick);
}
// Lightweight timeline update during playback (avoid full feed re-scan every frame)
let lastFullRefresh = 0;
function renderTimelineLight(){
  const span = timelineWindowEnd - timelineWindowStart;
  const frac = Math.max(0, Math.min(1, (currentJD-timelineWindowStart)/span));
  document.getElementById('tlPlayhead').style.left = (frac*100)+"%";
  document.getElementById('tlFill').style.width = (frac*100)+"%";
  const now = performance.now();
  if (now-lastFullRefresh > 2500){
    lastFullRefresh = now;
    const sp = document.getElementById('sidepanel');
    const open = !window.matchMedia('(max-width: 820px)').matches || sp.classList.contains('expanded');
    const act = (document.querySelector('.panel-tab.active')||{dataset:{}}).dataset.tab;
    if (open && act==='transits') renderTransitFeed();
    if (open && act==='conjunctions') renderConjunctionFeed();
    const key = Math.round(timelineWindowStart)+'|'+Math.round(timelineWindowEnd);
    if (key!==lastTlKey || now-lastTlAt>10000){ lastTlKey = key; lastTlAt = now; renderTimeline(); }
  }
}
let lastTlKey = '', lastTlAt = 0;

/* ============================================================================
   UI WIRING
   ============================================================================ */

document.querySelectorAll('.panel-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.panel-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(s=>s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab==="transits"){ renderTransitFilters(); renderTransitFeed(); }
    if (tab.dataset.tab==="conjunctions") renderConjunctionFeed();
    if (tab.dataset.tab==="rising") renderRising(true);
    if (tab.dataset.tab==="chart") renderChartTab();
    if (tab.dataset.tab==="view") updateLineToggleVisibility();
    document.getElementById('sidepanel').classList.add('expanded');
    try { tab.scrollIntoView({ inline:'center', block:'nearest', behavior:'smooth' }); } catch(e){}
  });
});

/* ---- Mobile bottom-sheet: tap handle to toggle, drag to resize ---- */
(function setupBottomSheet(){
  const sheet = document.getElementById('sidepanel');
  const handle = document.getElementById('sheetHandle');
  let dragStartY = null, dragStartExpanded = false;

  handle.addEventListener('click', ()=>{
    sheet.classList.toggle('expanded');
  });

  handle.addEventListener('pointerdown', (e)=>{
    dragStartY = e.clientY;
    dragStartExpanded = sheet.classList.contains('expanded');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e)=>{
    if (dragStartY===null) return;
    const dy = e.clientY - dragStartY;
    // Dragging up (negative dy) while collapsed -> expand; dragging down while expanded -> collapse
    if (dy < -30 && !dragStartExpanded) sheet.classList.add('expanded');
    if (dy > 30 && dragStartExpanded) sheet.classList.remove('expanded');
  });
  handle.addEventListener('pointerup', ()=>{ dragStartY = null; });
  handle.addEventListener('pointercancel', ()=>{ dragStartY = null; });

  // Tap the 3D scene while the sheet is open -> collapse it (mobile only)
  const mq = window.matchMedia('(max-width: 820px), (max-height: 500px) and (pointer: coarse)');
  document.getElementById('canvas3d').addEventListener('pointerdown', ()=>{
    if (mq.matches) sheet.classList.remove('expanded');
  });

  // Timeline: collapsible "jump to date" row on mobile
  const dock = document.getElementById('timelineDock');
  const jt = document.getElementById('tlJumpToggle');
  jt.addEventListener('click', ()=>{
    const open = dock.classList.toggle('show-jump');
    jt.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();


document.getElementById('tlPlayPause').addEventListener('click', (e)=>{
  isPlaying = !isPlaying;
  e.currentTarget.textContent = isPlaying ? "❚❚" : "▶";
  autoRotate = false;
});
document.getElementById('tlStepBack').addEventListener('click', ()=>{ jumpToJD(currentJD-1); });
document.getElementById('tlStepFwd').addEventListener('click', ()=>{ jumpToJD(currentJD+1); });
document.querySelectorAll('.speed-chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('.speed-chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    playSpeedDaysPerSec = parseFloat(chip.dataset.speed);
  });
});

document.getElementById('jumpBtn').addEventListener('click', ()=>{
  const val = document.getElementById('jumpDateInput').value;
  if (!val) return;
  const d = new Date(val);
  // Must convert local input time back to UTC for the astronomy engine to read correctly
  const jd = toJulianDay(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0);
  jumpToJD(jd);
});
document.getElementById('nowBtn').addEventListener('click', ()=>{
  const now = new Date();
  const jd = toJulianDay(now.getUTCFullYear(), now.getUTCMonth()+1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0);
  jumpToJD(jd);
});

document.getElementById('resetViewBtn').addEventListener('click', ()=>{
  orbitAngleTheta=0.55; orbitAnglePhi=1.15; orbitDist = SOL.view==='solar' ? (SOL.scale==='real'?120:62) : 26; autoRotate=true; markDirty();
});

/* ---- Natal form + location autocomplete (mini) ---- */
const TZ_OPTIONS = [-12,-11,-10,-9.5,-9,-8,-7,-6,-5,-4.5,-4,-3.5,-3,-2,-1,0,1,2,3,3.5,4,4.5,5,5.5,5.75,6,6.5,7,8,8.75,9,9.5,10,10.5,11,12,12.75,13,14];
function fmtTz(v){ const sign=v>=0?"+":"-"; const abs=Math.abs(v); const h=Math.floor(abs); const m=Math.round((abs-h)*60); return `UTC${sign}${h}${m?":"+String(m).padStart(2,'0'):':00'}`; }
function populateNatalTz(){
  const sel = document.getElementById('natalTz');
  sel.innerHTML = "";
  TZ_OPTIONS.forEach(v=>{ const opt=document.createElement('option'); opt.value=v; opt.textContent=fmtTz(v); if (v===5.5) opt.selected=true; sel.appendChild(opt); });
}
let natalSelectedLat=null, natalSelectedLon=null;
const natalPlaceInput = document.getElementById('natalPlace');
const natalLocationResults = document.getElementById('natalLocationResults');
let natalSearchDebounce=null;
natalPlaceInput.addEventListener('input', ()=>{
  const q = natalPlaceInput.value.trim();
  natalSelectedLat=null; natalSelectedLon=null;
  clearTimeout(natalSearchDebounce);
  if (q.length<3){ natalLocationResults.classList.remove('open'); return; }
  natalSearchDebounce = setTimeout(async ()=>{
    try{
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, { headers:{'Accept-Language':'en'} });
      const data = await res.json();
      natalLocationResults.innerHTML = "";
      data.forEach(r=>{
        const div = document.createElement('div');
        div.className = 'location-item-mini';
        div.textContent = r.display_name;
        div.addEventListener('click', ()=>{
          natalPlaceInput.value = r.display_name;
          natalSelectedLat = parseFloat(r.lat); natalSelectedLon = parseFloat(r.lon);
          natalLocationResults.classList.remove('open');
          let est = Math.round((natalSelectedLon/15)*4)/4;
          let closest = TZ_OPTIONS.reduce((a,b)=> Math.abs(b-est)<Math.abs(a-est)?b:a);
          [...document.getElementById('natalTz').options].forEach(o=>{ if (parseFloat(o.value)===closest) o.selected=true; });
        });
        natalLocationResults.appendChild(div);
      });
      if (data.length) natalLocationResults.classList.add('open');
    }catch(e){ /* silent - user can still submit if coordinates already chosen */ }
  }, 400);
});
document.addEventListener('click',(e)=>{ if (!e.target.closest('.location-wrap-mini')) natalLocationResults.classList.remove('open'); });
try{ if (window.parent && window.parent!==window && window.parent.LocPicker) window.parent.LocPicker.attach(document, natalPlaceInput, r=>{
  natalPlaceInput.value = r.display_name; natalSelectedLat = parseFloat(r.lat); natalSelectedLon = parseFloat(r.lon);
  natalLocationResults.classList.remove('open');
  const est = Math.round((natalSelectedLon/15)*4)/4, closest = TZ_OPTIONS.reduce((a,b)=> Math.abs(b-est)<Math.abs(a-est)?b:a);
  [...document.getElementById('natalTz').options].forEach(o=>{ o.selected = (parseFloat(o.value)===closest); });
}, {title:'Place of birth', get:()=> natalSelectedLat!=null ? {lat:natalSelectedLat, lon:natalSelectedLon} : null}); }catch(e){}

document.getElementById('natalForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('natalName').value.trim();
  const dob = document.getElementById('natalDob').value;
  const tob = document.getElementById('natalTob').value;
  const tz = parseFloat(document.getElementById('natalTz').value);
  if (!name || !dob || !tob || natalSelectedLat===null){
    alert("Please fill all fields and select a place from the location suggestions.");
    return;
  }
  const profile = { name, dob, tob, tz, lat:natalSelectedLat, lon:natalSelectedLon, place:natalPlaceInput.value, savedAt:Date.now() };
  const profiles = loadNatalProfiles();
  profiles.push(profile);
  saveNatalProfiles(profiles);
  refreshProfileSelect();
  document.getElementById('profileSelect').value = profiles.length-1;
  activeNatalProfile = profile;
  renderNatalTab();
});
document.getElementById('clearNatalBtn').addEventListener('click', ()=>{
  activeNatalProfile = null;
  document.getElementById('profileSelect').value = "";
  renderNatalTab();
});
document.getElementById('profileSelect').addEventListener('change', (e)=>{
  const idx = e.target.value;
  if (idx===""){ activeNatalProfile=null; renderNatalTab(); return; }
  const profiles = loadNatalProfiles();
  activeNatalProfile = isValidProfile(profiles[idx]) ? profiles[idx] : null;
  if (!activeNatalProfile) alert('This saved profile is incomplete. Please re-enter its birth details.');
  renderNatalTab();
});
document.getElementById('newProfileMiniBtn').addEventListener('click', ()=>{
  document.querySelectorAll('.panel-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel-section').forEach(s=>s.classList.remove('active'));
  document.querySelector('[data-tab="natal"]').classList.add('active');
  document.getElementById('tab-natal').classList.add('active');
  document.getElementById('natalForm').reset();
  natalSelectedLat=null; natalSelectedLon=null;
});

/* ============================================================================
   DATA EXPORT WIRING
   ============================================================================ */
function generateExportData(type) {
  const ctx = getChartContext();
  const snap = snapshotPositions(currentJD);
  let text = "";

  function getSkyText() {
    let t = "--- CURRENT SKY POSITIONS ---\nDate: " + formatFullDate(snap.jd) + "\n\n";
    PLANET_LIST.forEach(name => {
      const lon = snap.sidereal[name];
      const sign = SIGNS[getSignIndex(lon)];
      const dms = degreeInSign(lon);
      const nakIdx = getNakshatraIndex(lon);
      const nak = NAKSHATRAS[nakIdx];
      const pada = getPadaIndex(lon) + 1;
      const speed = planetSpeed(name, currentJD).toFixed(4);
      t += `${name}: ${dms.deg}°${dms.min}'${dms.sec}" ${sign.name} | ${nak} Pada ${pada} | Speed: ${speed}°/d\n`;
    });
    return t + "\n";
  }

  function getTransitsText() {
    let t = "--- UPCOMING TRANSITS (2 Years) ---\n\n";
    const transits = getTransitResults(currentJD).filter(e => transitFilterSet.has(e.planet));
    if (!transits.length) return t + "No transits found in this window.\n\n";
    transits.slice(0, 75).forEach(e => {
      t += `${formatHudDate(e.jd)}: ${e.planet} enters ${SIGNS[e.toSign].name} (from ${SIGNS[e.fromSign].name})\n`;
    });
    return t + "\n";
  }

  function getConjunctionsText() {
    let t = "--- UPCOMING CONJUNCTIONS (2 Years) ---\n\n";
    let conjs = getConjResults(currentJD);
    if (conjSignificanceMode === "major") conjs = conjs.filter(e => e.planetA !== "Moon" && e.planetB !== "Moon");
    if (!conjs.length) return t + "No conjunctions found in this window.\n\n";
    conjs.slice(0, 75).forEach(e => {
      t += `${formatHudDate(e.jd)}: ${e.planetA} & ${e.planetB} in ${SIGNS[e.sign].name}\n`;
    });
    return t + "\n";
  }

  function getAspectsText() {
    let t = "--- PLANETARY ASPECTS (Graha Drishti) ---\n\n";
    const aspects = computeAspects(ctx.sidereal);
    if (!aspects.length) return t + "No aspects found.\n\n";
    aspects.forEach(a => {
      t += `${a.from} aspects ${a.to} in ${SIGNS[a.sign].name} (${a.houseOffset}th house aspect)\n`;
    });
    return t + "\n";
  }

  function getSignAspectsText() {
    let t = "--- SIGN ASPECTS (Rashi Drishti) ---\n\n";
    const rows = computeSignAspects(ctx.sidereal);
    const byPlanet = {};
    rows.forEach(r => (byPlanet[r.from] = byPlanet[r.from] || []).push(r));
    PLANET_LIST.forEach(name => {
      const targets = byPlanet[name] || [];
      t += `${name}:\n`;
      if (!targets.length) t += `  No outgoing aspects.\n`;
      targets.forEach(tgt => {
        const occStr = tgt.occupants.length ? tgt.occupants.join(', ') : 'empty';
        t += `  -> aspects ${SIGNS[tgt.targetSign].name} (${tgt.houseOffset}th aspect, occupants: ${occStr})\n`;
      });
    });
    return t + "\n";
  }

  if (type === 'sky' || type === 'all') text += getSkyText();
  if (type === 'transits' || type === 'all') text += getTransitsText();
  if (type === 'conjunctions' || type === 'all') text += getConjunctionsText();
  if (type === 'aspects' || type === 'all') text += getAspectsText();
  if (type === 'sign_aspects' || type === 'all') text += getSignAspectsText();

  return text.trim();
}

document.getElementById('copyDataBtn').addEventListener('click', () => {
  const type = document.getElementById('exportSelect').value;
  const text = generateExportData(type);
  
  const copyHelper = (txt) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(txt);
    } else {
      return new Promise((resolve, reject) => {
        try {
          const ta = document.createElement("textarea");
          ta.value = txt;
          ta.style.position = "fixed"; ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy') ? resolve() : reject(new Error('Fallback copy failed'));
          document.body.removeChild(ta);
        } catch(e) { reject(e); }
      });
    }
  };

  copyHelper(text).then(() => {
    const btn = document.getElementById('copyDataBtn');
    const origText = btn.textContent;
    const status = document.getElementById('exportStatus');
    
    btn.textContent = "Copied! ✓";
    btn.style.filter = "brightness(1.2)";
    status.style.display = 'block';
    
    setTimeout(() => {
      btn.textContent = origText;
      btn.style.filter = "";
      status.style.display = 'none';
    }, 3000);
  }).catch(err => {
    alert("Copy failed: " + err);
  });
});



/* ---- Smoothness: skip DOM writes that would not change anything ---- */
(function(){
  const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', { configurable:true, get(){ return d.get.call(this); },
    set(v){ const f = this.firstChild; if (f && f === this.lastChild && f.nodeType === 3 && f.nodeValue === String(v)) return; d.set.call(this, v); } });
  const hd = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  ['transitFeed','conjunctionFeed','aspectList','signAspectList','houseTable','skyTable'].forEach(id=>{
    const el = document.getElementById(id); if (!el) return; let last = null;
    Object.defineProperty(el, 'innerHTML', { configurable:true, get(){ return hd.get.call(this); },
      set(v){ if (v === last && this.firstChild) return; last = v; hd.set.call(this, v); } });
  });
})();

/* ============================================================================
   STRUCTURE: numbered accordions + help
   ============================================================================ */
(function setupStructure(){
  const HINT = {
    "Natal Profile":"The chart that is currently active", "Enter Birth Details":"Name, date, time and place of birth",
    "Rasi Chart (D1)":"Your birth wheel. Tap a planet for details", "Houses & Placements":"Which sign and planets sit in each house",
    "Planetary Aspects (Graha Drishti)":"Which planets are looking at each other", "Sign Aspects (Rashi Drishti)":"Every sign each planet is gazing at",
    "Aspect Explorer":"Pick a planet or sign to see its aspects", "Camera Mode":"How you move around the wheel", "Line Visibility":"Show or hide guide lines"
  };
  const OPEN_ALL = { 'tab-natal':true, 'tab-view':true };
  ['tab-chart','tab-natal','tab-view'].forEach(id=>{
    const sec = document.getElementById(id);
    [...sec.querySelectorAll(':scope > .panel-heading')].forEach((h,i)=>{
      const acc = document.createElement('div'); acc.className = 'acc' + ((i===0 || OPEN_ALL[id]) ? ' open' : '');
      const body = document.createElement('div'); body.className = 'acc-body';
      let n = h.nextSibling; const moved = [];
      while (n && !(n.nodeType===1 && n.classList.contains('panel-heading'))){ moved.push(n); n = n.nextSibling; }
      moved.forEach(x=> body.appendChild(x));
      const t = h.textContent.trim();
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'acc-head';
      btn.innerHTML = `<span class="acc-num">${i+1}</span><span><div class="acc-title">${t.replace(/&/g,'&amp;')}</div><div class="acc-hint">${HINT[t]||''}</div></span><span class="acc-chev">⌄</span>`;
      btn.addEventListener('click', ()=> acc.classList.toggle('open'));
      acc.append(btn, body); h.replaceWith(acc);
    });
  });
  const hm = document.getElementById('helpModal');
  document.getElementById('helpBtn').addEventListener('click', ()=> hm.classList.add('show'));
  document.getElementById('helpClose').addEventListener('click', ()=> hm.classList.remove('show'));
  hm.addEventListener('click', e=>{ if (e.target===hm) hm.classList.remove('show'); });
  document.getElementById('newProfileMiniBtn').addEventListener('click', ()=>{
    document.getElementById('sidepanel').classList.add('expanded');
    document.querySelectorAll('#tab-natal .acc').forEach(a=> a.classList.add('open'));
  });
})();


/* ============================================================================
   3D ASTRO LAYERS: natal ghosts + transit arcs, live Lagna, houses, conditions,
   Sade Sati, Rahu-Ketu axis, Moon phase, camera presets, image export
   ============================================================================ */
const A = { ready:false, snap:null, natal:null, np:null, lagnaLon:null, lastArc:0, T:{} };
const CONDEX = { Sun:0, Moon:1, Mars:9, Mercury:5, Jupiter:3, Venus:11, Saturn:6, Rahu:1, Ketu:7 };
const COMBUST = { Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
const ORB_R = { Sun:4, Moon:2.6, Mercury:5, Venus:6, Mars:7, Jupiter:8, Saturn:9.2, Rahu:10.2, Ketu:10.2, Uranus:10.6, Neptune:10.95, Pluto:11.3 };
const _pt = (lon, r)=> new THREE.Vector3(r*Math.cos(lon*DEG), 0, -r*Math.sin(lon*DEG));
const _on = id => document.getElementById(id).checked;

function initAstroLayers(){
  const G = zodiacRingGroup, T = A.T, box = document.getElementById('planetLabels');
  const hexOf = n => new THREE.Color(PLANET_COLORS[n]).getHex();
  const mkLabel = (key, html, cls)=>{
    const obj = new THREE.Object3D(); G.add(obj); bodyMeshes[key] = obj;
    const el = document.createElement('div'); el.className = 'planet-label ' + cls; el.innerHTML = html; el.style.display = 'none'; el.style.opacity = '0';
    box.appendChild(el); labelNodes[key] = { el, label:key }; return { obj, el };
  };
  const flat = (geo, color, op, extra)=> new THREE.Mesh(geo, new THREE.MeshBasicMaterial(Object.assign({ color, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false }, extra||{})));
  // natal ghosts
  T.ghosts = {};
  PLANET_LIST.forEach(n=>{
    const g = mkLabel('ghost_'+n, `<span class="dot" style="background:transparent;border:1.5px solid ${PLANET_COLORS[n]}"></span>${n.slice(0,2)}·N`, 'ghost');
    const r = flat(new THREE.RingGeometry(0.2, 0.27, 28), hexOf(n), 0.95); r.rotation.x = Math.PI/2; g.obj.add(r); g.ring = r; T.ghosts[n] = g;
  });
  T.arcs = new THREE.Group(); G.add(T.arcs);
  // lagna pointer
  T.lagna = new THREE.Group(); G.add(T.lagna);
  const lg = new THREE.PlaneGeometry(14, 0.09); lg.rotateX(-Math.PI/2); lg.translate(7.8, 0.02, 0);
  T.asc = flat(lg, 0xFFFFFF, 0.95); T.dsc = flat(lg, 0xFFFFFF, 0.25); T.dsc.rotation.y = Math.PI; T.lagna.add(T.asc, T.dsc);
  T.ascLbl = mkLabel('ghost_asc', 'ASC', 'asc');
  // current rising sign: gold START / END lines from Earth to the zodiac ring, a soft wedge between them, and a label
  T.riseG = new THREE.Group(); G.add(T.riseG);
  const rg = new THREE.PlaneGeometry(11.7, 0.08); rg.rotateX(-Math.PI/2); rg.translate(6.75, 0.035, 0);
  T.riseA = flat(rg, 0xD4A24A, 0.95); T.riseB = flat(rg.clone(), 0xD4A24A, 0.95); T.riseB.rotation.y = 30*DEG;
  const rw = flat(new THREE.RingGeometry(11.45, 12.55, 32, 1, -30*DEG, 30*DEG), 0xD4A24A, 0.5); rw.rotation.x = Math.PI/2; rw.position.y = 0.03;
  const rf = flat(new THREE.CircleGeometry(12.5, 32, -30*DEG, 30*DEG), 0xD4A24A, 0.07); rf.rotation.x = Math.PI/2; rf.position.y = 0.005;
  T.riseG.add(rf, rw, T.riseA, T.riseB);
  T.riseLbl = mkLabel('ghost_rise', 'Rising', 'asc');
  // houses + Lagna sign highlight
  T.houseLbl = []; for (let h=0; h<12; h++) T.houseLbl.push(mkLabel('ghost_h'+h, String(h+1), 'house'));
  T.wedgeG = new THREE.Group(); const w = flat(new THREE.RingGeometry(11.45, 12.55, 32, 1, -30*DEG, 30*DEG), 0xFFFFFF, 0.3); w.rotation.x = Math.PI/2; w.position.y = 0.02; T.wedgeG.add(w); G.add(T.wedgeG);
  // sade sati zone
  T.sadeG = new THREE.Group(); T.sade = flat(new THREE.RingGeometry(14.05, 14.45, 48, 1, -90*DEG, 90*DEG), 0x9B8CFF, 0.4); T.sade.rotation.x = Math.PI/2; T.sadeG.add(T.sade); G.add(T.sadeG);
  T.sadeLbl = mkLabel('ghost_sade', 'Sade Sati ●', 'sade');
  // rahu-ketu axis
  const ag = new THREE.PlaneGeometry(20.4, 0.05); ag.rotateX(-Math.PI/2); ag.translate(0, 0.015, 0);
  T.axis = flat(ag, 0x9B8CFF, 0.3); G.add(T.axis); T.axisLbl = mkLabel('ghost_axis', '☊ Eclipse season', 'sade');
  // moon phase shell
  const moon = bodyMeshes.geo_Moon, mr = moon.geometry.parameters.radius;
  T.moonU = { sd:{ value:new THREE.Vector3(1,0,0) } };
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(mr*1.02, 40, 40), new THREE.ShaderMaterial({ uniforms:T.moonU, transparent:true, depthWrite:false,
    vertexShader:'varying vec3 vN; void main(){ vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform vec3 sd; varying vec3 vN; void main(){ float l=dot(normalize(vN),sd); gl_FragColor=vec4(0.0,0.0,0.03,(1.0-smoothstep(-0.08,0.12,l))*0.88); }' })));
  // controls
  document.querySelectorAll('#tab-view .switch input[id^="L_"]').forEach(i=> i.addEventListener('change', ()=>{ updateOverlays(A.snap); markDirty(); }));
  document.querySelectorAll('.pbtn').forEach(b=> b.addEventListener('click', ()=>{ orbitAnglePhi = { top:0.06, tilt:1.15, side:1.45 }[b.dataset.preset]; setCamMode('orbit'); autoRotate = false; markDirty(); }));
  document.getElementById('lagnaViewBtn').addEventListener('click', ()=>{
    if (A.lagnaLon === null){ alert('Save a natal profile first (Natal tab) so the Lagna can be calculated.'); return; }
    const L = A.lagnaLon*DEG; setCamMode('orbit'); orbitAngleTheta = Math.atan2(-Math.cos(L), -Math.sin(L)); autoRotate = false; markDirty();
  });
  document.getElementById('saveImgBtn').addEventListener('click', ()=>{
    renderer.render(scene, camera); const src = renderer.domElement, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.fillStyle = '#050912'; x.fillRect(0,0,c.width,c.height); x.drawImage(src,0,0);
    const a = document.createElement('a'); a.download = 'ephemeris-wheel.png'; a.href = c.toDataURL('image/png'); a.click();
  });
  const _rn = renderNatalTab; renderNatalTab = function(){ _rn.apply(this, arguments); updateOverlays(A.snap); markDirty(); };
  A.ready = true; updateOverlays(snapshotPositions(currentJD));
}

function updateOverlays(snap){ try { _updateOverlays(snap); } catch(e){ console.warn('overlay update skipped:', e); } }
function _updateOverlays(snap){
  if (!A.ready || !snap) return; A.snap = snap;
  const sid = snap.sidereal, T = A.T, p = isValidProfile(activeNatalProfile) ? activeNatalProfile : null, has = !!p;
  const vis = (lbl, b)=>{ lbl.el.style.opacity = b ? '' : '0'; };
  // conditions on live planet labels
  PLANET_LIST.forEach(n=>{
    const ln = labelNodes['geo_'+n]; if (!ln) return;
    let sp = ln.el.querySelector('.cond'); if (!sp){ sp = document.createElement('span'); sp.className = 'cond'; ln.el.appendChild(sp); }
    let t = ''; const si = getSignIndex(sid[n]);
    if (CONDEX[n] === si) t += ' <b style="color:#6EE7B7">▲</b>'; else if ((CONDEX[n]+6)%12 === si) t += ' <b style="color:#FF6B4A">▼</b>'; else if (SIGNS[si].lord === n) t += ' <b style="color:#F4C45C">★</b>';
    if (COMBUST[n] && Math.abs(angDiff(sid[n], sid.Sun)) < COMBUST[n]) t += ' <b style="color:#FFA94D">☀</b>';
    if (snap.retro[n] && n !== 'Rahu' && n !== 'Ketu') t += ' <b style="color:#FF8A66">℞</b>';
    if (!_on('L_cond')) t = '';
    if (sp._k !== t){ sp._k = t; sp.innerHTML = t; }
  });
  // moon phase
  const mm = bodyMeshes.geo_Moon.position, sm = bodyMeshes.geo_Sun.position;
  T.moonU.sd.value.copy(sm).sub(mm).normalize();
  // rahu-ketu axis + eclipse season
  T.axis.rotation.y = sid.Rahu*DEG; T.axis.visible = _on('L_axis');
  const nodeD = Math.min(Math.abs(angDiff(sid.Sun, sid.Rahu)), Math.abs(angDiff(sid.Sun, sid.Ketu)));
  const ecl = nodeD < 15; T.axis.material.color.set(ecl ? 0xFF6B4A : 0x9B8CFF); T.axis.material.opacity = ecl ? 0.7 : 0.3;
  T.axisLbl.obj.position.copy(_pt(sid.Rahu, 10.9)); vis(T.axisLbl, ecl && _on('L_axis'));
  // natal-dependent layers
  if (has && A.np !== p){ A.np = p; A.natal = snapshotPositions(computeNatalAscendant(p).jd).sidereal; }
  if (!has){ A.np = null; A.natal = null; A.lagnaLon = null; }
  // current rising sign at the viewer's place: start / end lines of the sign
  const liveL = getLiveLoc(), lonR = siderealAscendant(snap.jd, liveL.lat, liveL.lon), rsI = getSignIndex(lonR), riseOn = _on('L_rise');
  A.lagnaLon = lonR; T.riseG.visible = riseOn; T.riseG.rotation.y = rsI*30*DEG;
  T.riseLbl.obj.position.copy(_pt(rsI*30 + 15, 14.4)); T.riseLbl.el.innerHTML = `↑ Rising ${SIGNS[rsI].symbol} ${SIGNS[rsI].name}`; vis(T.riseLbl, riseOn);
  const showN = has && _on('L_natal');
  PLANET_LIST.forEach(n=>{ const g = T.ghosts[n]; if (showN) g.obj.position.copy(_pt(A.natal[n], ORB_R[n])); vis(g, showN); g.ring.visible = showN; });
  const now = performance.now();
  if (!showN){ if (T.arcs.children.length) clearArcs(); }
  else if (now - A.lastArc > 150 || !T.arcs.children.length){
    A.lastArc = now; clearArcs();
    PLANET_LIST.forEach(from=>{
      const offs = ASPECT_OFFSETS[from] || [7], fs = getSignIndex(sid[from]);
      PLANET_LIST.forEach(to=>{
        const off = ((getSignIndex(A.natal[to]) - fs + 12) % 12) + 1; if (off === 1 || !offs.includes(off)) return;
        const p1 = _pt(sid[from], ORB_R[from]), p2 = _pt(A.natal[to], ORB_R[to]), mid = p1.clone().add(p2).multiplyScalar(0.5); mid.y += 0.7;
        T.arcs.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p1, mid, p2), 20, 0.016, 5, false),
          new THREE.MeshBasicMaterial({ color:hexOf(from), transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false })));
      });
    });
  }
  if (has){
    const lon = lonR; const ls = rsI;
    T.lagna.rotation.y = lon*DEG; T.lagna.visible = _on('L_lagna');
    T.ascLbl.obj.position.copy(_pt(lon, 15.3)); T.ascLbl.el.innerHTML = `ASC ${SIGNS[ls].symbol} ${degreeInSign(lon).deg}°`; vis(T.ascLbl, _on('L_lagna'));
    const hs = _on('L_houses'); T.wedgeG.visible = hs; T.wedgeG.rotation.y = ls*30*DEG;
    T.houseLbl.forEach((h,i)=>{ h.obj.position.copy(_pt(((ls+i)%12)*30+15, 10.95)); vis(h, hs); });
    const ms = getSignIndex(A.natal.Moon), d = (getSignIndex(sid.Saturn) - ms + 12) % 12, active = d === 11 || d === 0 || d === 1, ss = _on('L_sade');
    T.sadeG.visible = ss; T.sadeG.rotation.y = ((ms+11)%12)*30*DEG; T.sade.material.color.set(active ? 0xFF6B4A : 0x9B8CFF); T.sade.material.opacity = active ? 0.9 : 0.35;
    T.sadeLbl.obj.position.copy(_pt(ms*30+15, 15.3)); vis(T.sadeLbl, active && ss);
  } else {
    T.lagna.visible = T.wedgeG.visible = T.sadeG.visible = false; vis(T.ascLbl, false); vis(T.sadeLbl, false); T.houseLbl.forEach(h=> vis(h, false));
  }
}
function clearArcs(){ const g = A.T.arcs; while (g.children.length){ const c = g.children[0]; g.remove(c); c.geometry.dispose(); c.material.dispose(); } }


/* ============================================================================
   QUICK PLANET PICKER
   ============================================================================ */
function initPlanetPicker(){
  const btn = document.getElementById('planetPickBtn'), ov = document.getElementById('pickOverlay'), box = document.getElementById('pickContent');
  const close = ()=> ov.classList.remove('show');
  window.syncPickBtn = function(){
    if (camMode === 'focus' && focusedPlanetKey){
      const n = focusedPlanetKey.replace(/^(geo_|sol_)/, ''); btn.textContent = PLANET_GLYPHS[n] || (SOL_DATA[n] && SOL_DATA[n].g) || '☉'; btn.style.setProperty('--pc', PLANET_COLORS[n] || '#FFD84A'); btn.classList.add('following'); btn.title = 'Following ' + n + ' (tap to change)';
    } else { btn.textContent = '🪐'; btn.classList.remove('following'); btn.title = 'Select a planet'; }
  };
  function pick(n){
    setCamMode('focus'); focusedPlanetKey = (SOL.view==='solar' ? 'sol_' : 'geo_') + n;
    const sel = document.getElementById('focusPlanetSelect'); if (sel) sel.value = focusedPlanetKey;
    autoRotate = false; updateLegend(); markDirty(); syncPickBtn(); close();
  }
  function wheel(){ setCamMode('orbit'); orbitDist = SOL.view==='solar' ? (SOL.scale==='real'?120:62) : 26; markDirty(); syncPickBtn(); close(); }
  function render(){
    const snap = snapshotPositions(currentJD);
    const solar = SOL.view==='solar', names = solar ? ["Sun"].concat(SOL_BODIES) : ALL_BODIES;
    const tile = (n,i)=>{
      const sel = camMode==='focus' && focusedPlanetKey===(solar?'sol_':'geo_')+n;
      if (solar){
        const col = n==='Sun' ? '#FFD84A' : '#'+SOL_DATA[n].c.toString(16).padStart(6,'0'), g = n==='Sun' ? '☉' : SOL_DATA[n].g;
        const h = n==='Sun' ? {x:0,y:0,z:0} : solHelio(n, currentJD), r = Math.hypot(h.x,h.y,h.z);
        return `<div class="pk-tile ${sel?'sel':''}" style="--pc:${col};--i:${i}" data-p="${n}"><div class="pk-orb">${g}</div><div class="pk-name">${n}</div><div class="pk-sk">from Sun</div><div class="pk-pos">${n==='Sun' ? '—' : r.toFixed(2)+' AU'}</div></div>`;
      }
      const lon = snap.sidereal[n], sg = SIGNS[getSignIndex(lon)], dm = degreeInSign(lon), rx = (n==='Rahu'||n==='Ketu'||snap.retro[n]) ? ' ℞' : '';
      const outer = OUTER_LIST.includes(n), sk = outer ? OUTER_SK[n] : PD[n].sk.split(' ')[0];
      return `<div class="pk-tile ${sel?'sel':''}" style="--pc:${PLANET_COLORS[n]};--i:${i}" data-p="${n}"><button class="pk-info" data-i="${n}" aria-label="Details">i</button>
        <div class="pk-orb">${PLANET_GLYPHS[n]}</div><div class="pk-name">${n}</div><div class="pk-sk">${sk}</div><div class="pk-pos">${sg.symbol} ${dm.deg}°${rx}</div></div>`;
    };
    box.innerHTML = `<div class="pk-title">Select a planet</div><div class="pk-sub">Tap a planet to fly the camera to it.${solar?'':' Tap ⓘ for its full details.'}</div>
      <div class="pk-grid">${names.map(tile).join('')}</div>
      <button class="pk-all" id="pkAll">${solar?'☉ Whole solar system':'◎ Whole wheel view'}</button>`;
    box.querySelectorAll('.pk-tile').forEach(t=> t.addEventListener('click', e=>{
      if (e.target.closest('.pk-info')){ close(); openPlanetDetail(e.target.closest('.pk-info').dataset.i); return; }
      pick(t.dataset.p); }));
    document.getElementById('pkAll').addEventListener('click', wheel);
  }
  btn.addEventListener('click', ()=>{ render(); ov.classList.add('show'); });
  document.getElementById('pickClose').addEventListener('click', close);
  ov.addEventListener('click', e=>{ if (e.target === ov) close(); });
  const _scm = setCamMode; setCamMode = function(m){ _scm(m); syncPickBtn(); };
  document.getElementById('focusPlanetSelect').addEventListener('change', syncPickBtn);
}
/* ============================================================================
   INIT
   ============================================================================ */
function init(){
  initTimelineWindow();
  populateNatalTz();
  refreshProfileSelect();
  initScene();
  buildSkyTableRows();
  solBuildSizeStrip();
  setViewMode();
  renderLineToggleList();
  applyLineToggles();
  renderChartTab();
  refreshAll();
  renderTransitFilters();
  requestAnimationFrame(renderLoop);
  requestAnimationFrame(animationTick);
  document.getElementById('loadingMask').classList.add('hide');
}
init();
initAstroLayers();
initPlanetPicker();
