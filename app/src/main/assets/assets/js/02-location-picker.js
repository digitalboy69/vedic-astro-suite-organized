/* ===== LocPicker — shared location popup (map + search + manual coordinates) =====
   Lives in the top window; apps call parent.LocPicker.attach(...) / .open(...).
   Map engine is built in (no external library); tiles come from OpenStreetMap / CARTO / Esri at run time. */
(function(){
'use strict';
if(window.LocPicker)return;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOM='https://nominatim.openstreetmap.org/';
/* ---------- parsing ---------- */
function chk(a,b){if(!isFinite(a)||!isFinite(b))return null;if(Math.abs(a)<=90&&Math.abs(b)<=180)return{lat:a,lon:b};if(Math.abs(b)<=90&&Math.abs(a)<=180)return{lat:b,lon:a,swapped:true};return null;}
function parse(t){t=String(t||'').trim();if(!t)return null;let u=t;try{u=decodeURIComponent(t);}catch(e){}
  let m=u.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)||u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||u.match(/[?&](?:q|ll|query|destination|center|daddr|saddr)=\s*(-?\d+(?:\.\d+)?)\s*[,+ ]\s*(-?\d+(?:\.\d+)?)/);
  if(m)return chk(+m[1],+m[2]);
  const sg=h=>/[SW]/i.test(h||'')?-1:1;
  /* degrees-minutes-seconds with ° sign */
  const R=/([NSEW])?\s*(-?\d+(?:\.\d+)?)\s*[°º]\s*(?:(\d+(?:\.\d+)?)\s*['′’]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″”]|''|′′|’’)\s*)?([NSEW])?/gi,D=[];let x;
  while((x=R.exec(u))){const h=x[1]||x[5]||'',v=Math.abs(+x[2])+(x[3]?+x[3]/60:0)+(x[4]?+x[4]/3600:0);D.push({h:h.toUpperCase(),v:(x[2][0]==='-'?-1:1)*sg(h)*v});}
  if(D.length>=2)return pair(D[0],D[1]);
  /* decimal degrees with hemisphere letters */
  const H=/(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])\b/gi,E=[];while((x=H.exec(u)))E.push({h:x[2].toUpperCase(),v:sg(x[2])*Math.abs(+x[1])});
  if(E.length>=2)return pair(E[0],E[1]);
  const P=/^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[°]?\s*[,;/\s]\s*(-?\d+(?:\.\d+)?)\s*[°]?\s*\)?\s*$/.exec(u);if(P)return chk(+P[1],+P[2]);
  const Q=u.match(/(-?\d{1,3}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/);if(Q)return chk(+Q[1],+Q[2]);
  return null;
  function pair(a,b){let la=a,lo=b;if(/[EW]/.test(a.h)||/[NS]/.test(b.h)){la=b;lo=a;}return chk(la.v,lo.v)&&Math.abs(la.v)<=90&&Math.abs(lo.v)<=180?{lat:la.v,lon:lo.v}:null;}}
function fmt(lat,lon){const f=(v,p,n)=>Math.abs(v).toFixed(4)+'° '+(v>=0?p:n);return f(lat,'N','S')+', '+f(lon,'E','W');}
function gmaps(lat,lon){return 'https://www.google.com/maps/search/?api=1&query='+lat.toFixed(6)+','+lon.toFixed(6);}
/* ---------- tile map engine ---------- */
const LAYERS={street:{n:'Street',u:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',a:'© OpenStreetMap contributors',max:19},dark:{n:'Dark',u:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',s:'abcd',a:'© OpenStreetMap · © CARTO',max:19},sat:{n:'Satellite',u:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',a:'Tiles © Esri',max:18}};
function Map2(el,o){const M=this;M.el=el;M.lat=o.lat;M.lon=o.lon;M.z=o.z;M.layer=o.layer||'street';M.onClick=o.onClick||function(){};M.onMove=o.onMove||function(){};M.tiles={};M.mk=null;M.raf=0;M.anim=null;
  el.classList.add('lpm');const mk=(c,h)=>{const d=document.createElement('div');d.className=c;if(h)d.innerHTML=h;return d;};
  M.tl=mk('lpm-t');M.pin=mk('lpm-m','<i></i><u></u>');M.pin.hidden=true;M.at=mk('lpm-a');el.insertBefore(M.tl,el.firstChild);el.appendChild(M.pin);el.appendChild(M.at);M.ptr={};let drag=null,pinch=null,moved=false,mdrag=false;
  const rect=()=>el.getBoundingClientRect();
  el.addEventListener('pointerdown',e=>{if(e.target.closest('.lpm-c,.lpm-sb,.lpm-hint'))return;M.stop();M.ptr[e.pointerId]={x:e.clientX,y:e.clientY};try{el.setPointerCapture(e.pointerId);}catch(_){}
    const ids=Object.keys(M.ptr);if(e.target.closest('.lpm-m')&&ids.length===1){mdrag=true;moved=false;return;}
    if(ids.length===1){drag={x:e.clientX,y:e.clientY};moved=false;}else if(ids.length===2){const a=M.ptr[ids[0]],b=M.ptr[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:M.z};drag=null;moved=true;}});
  el.addEventListener('pointermove',e=>{const p=M.ptr[e.pointerId];if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(mdrag){const r=rect(),ll=M.unproject(e.clientX-r.left,e.clientY-r.top);moved=true;M.setMarker(ll.lat,ll.lon,true);return;}
    const ids=Object.keys(M.ptr);if(pinch&&ids.length===2){const a=M.ptr[ids[0]],b=M.ptr[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),r=rect(),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;M.zoomAt(clamp(pinch.z+Math.log2(d/pinch.d),2,M.max()),cx,cy);return;}
    if(drag){if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>5)moved=true;if(moved){M.panBy(-dx,-dy);}}});
  const up=e=>{const had=M.ptr[e.pointerId];delete M.ptr[e.pointerId];if(!had)return;if(mdrag){mdrag=false;if(moved)M.onClick(M.mlat,M.mlon,true);return;}
    if(Object.keys(M.ptr).length<2)pinch=null;if(drag&&!moved&&Object.keys(M.ptr).length===0){const r=rect(),ll=M.unproject(e.clientX-r.left,e.clientY-r.top);M.setMarker(ll.lat,ll.lon);M.onClick(ll.lat,ll.lon,false);}if(Object.keys(M.ptr).length===0)drag=null;};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',e=>{delete M.ptr[e.pointerId];drag=null;pinch=null;mdrag=false;});
  el.addEventListener('wheel',e=>{e.preventDefault();M.stop();const r=rect();M.zoomAt(clamp(M.z-e.deltaY*0.0022,2,M.max()),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  el.addEventListener('dblclick',e=>{if(e.target.closest('.lpm-c,.lpm-sb'))return;const r=rect();M.zoomAt(clamp(M.z+1,2,M.max()),e.clientX-r.left,e.clientY-r.top,true);});
  if(window.ResizeObserver)new ResizeObserver(()=>M.render()).observe(el);M.setLayer(M.layer);M.render();}
Map2.prototype={
  max(){return LAYERS[this.layer].max;},size(){return{w:this.el.clientWidth||600,h:this.el.clientHeight||400};},
  px(lat,lon,z){const s=256*Math.pow(2,z),la=clamp(lat,-85.0511,85.0511)*Math.PI/180;return{x:(lon+180)/360*s,y:(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*s};},
  unpx(x,y,z){const s=256*Math.pow(2,z),n=Math.PI-2*Math.PI*y/s;return{lat:180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))),lon:x/s*360-180};},
  project(lat,lon){const c=this.px(this.lat,this.lon,this.z),p=this.px(lat,lon,this.z),sz=this.size();return{x:p.x-c.x+sz.w/2,y:p.y-c.y+sz.h/2};},
  unproject(x,y){const c=this.px(this.lat,this.lon,this.z),sz=this.size();const r=this.unpx(c.x+x-sz.w/2,c.y+y-sz.h/2,this.z);r.lon=((r.lon+540)%360)-180;return r;},
  panBy(dx,dy){const c=this.px(this.lat,this.lon,this.z),r=this.unpx(c.x+dx,c.y+dy,this.z);this.lat=clamp(r.lat,-84,84);this.lon=((r.lon+540)%360)-180;this.sched();},
  zoomAt(z,cx,cy,smooth){const before=this.unproject(cx,cy);const apply=zz=>{this.z=zz;const sz=this.size(),p=this.px(before.lat,before.lon,zz),c=this.unpx(p.x-(cx-sz.w/2),p.y-(cy-sz.h/2),zz);this.lat=clamp(c.lat,-84,84);this.lon=((c.lon+540)%360)-180;};
    if(smooth){const z0=this.z,t0=performance.now();this.stop();const step=t=>{const k=clamp((t-t0)/220,0,1),e=1-Math.pow(1-k,3);apply(z0+(z-z0)*e);this.render();if(k<1)this.anim=requestAnimationFrame(step);else this.anim=null;};this.anim=requestAnimationFrame(step);}else{apply(z);this.sched();}},
  stop(){if(this.anim){cancelAnimationFrame(this.anim);this.anim=null;}},
  flyTo(lat,lon,z){this.stop();const a={lat:this.lat,lon:this.lon,z:this.z},t0=performance.now(),dur=650;z=clamp(z==null?this.z:z,2,this.max());const step=t=>{const k=clamp((t-t0)/dur,0,1),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;let dl=lon-a.lon;if(dl>180)dl-=360;if(dl<-180)dl+=360;this.lat=a.lat+(lat-a.lat)*e;this.lon=((a.lon+dl*e+540)%360)-180;this.z=a.z+(z-a.z)*e;this.render();if(k<1)this.anim=requestAnimationFrame(step);else this.anim=null;};this.anim=requestAnimationFrame(step);},
  setView(lat,lon,z){this.stop();this.lat=lat;this.lon=lon;if(z!=null)this.z=clamp(z,2,this.max());this.render();},
  setLayer(k){this.layer=k;Object.keys(this.tiles).forEach(id=>{this.tiles[id].remove();});this.tiles={};this.at.textContent=LAYERS[k].a;this.z=Math.min(this.z,LAYERS[k].max);this.el.dataset.layer=k;this.sched();},
  setMarker(lat,lon,dragging){this.mlat=lat;this.mlon=lon;this.pin.hidden=false;this.pin.classList.toggle('drag',!!dragging);this.place();},
  clearMarker(){this.mlat=null;this.pin.hidden=true;},
  place(){if(this.mlat==null)return;const p=this.project(this.mlat,this.mlon);this.pin.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px)';},
  sched(){if(!this.raf)this.raf=requestAnimationFrame(()=>{this.raf=0;this.render();});},
  render(){const sz=this.size(),Z=Math.round(this.z),zt=clamp(Z,2,this.max()),sc=Math.pow(2,this.z-zt),ts=256*sc,c=this.px(this.lat,this.lon,zt),n=Math.pow(2,zt);
    const x0=c.x-sz.w/2/sc,y0=c.y-sz.h/2/sc,tx0=Math.floor(x0/256),ty0=Math.floor(y0/256),tx1=Math.floor((c.x+sz.w/2/sc)/256),ty1=Math.floor((c.y+sz.h/2/sc)/256),keep={},L=LAYERS[this.layer];
    for(let ty=Math.max(0,ty0);ty<=Math.min(n-1,ty1);ty++)for(let tx=tx0;tx<=tx1;tx++){const wx=((tx%n)+n)%n,id=zt+'/'+tx+'/'+ty;keep[id]=1;let im=this.tiles[id];
      if(!im){im=new Image();im.className='lpm-i';im.alt='';im.draggable=false;im.decoding='async';im.onload=()=>im.classList.add('on');im.onerror=()=>im.classList.add('bad');
        im.src=L.u.replace('{s}',(L.s||'a')[(wx+ty)%(L.s||'a').length]).replace('{z}',zt).replace('{x}',wx).replace('{y}',ty);this.tiles[id]=im;this.tl.appendChild(im);}
      im.style.width=im.style.height=(ts+.5)+'px';im.style.transform='translate('+((tx*256-x0)*sc).toFixed(1)+'px,'+((ty*256-y0)*sc).toFixed(1)+'px)';}
    Object.keys(this.tiles).forEach(id=>{if(!keep[id]){this.tiles[id].remove();delete this.tiles[id];}});
    this.place();this.onMove(this);}};
/* ---------- popup UI ---------- */
const CSS=`
.lp{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,5,12,.66);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8edf7}
.lp.on{display:flex;animation:lpf .18s ease both}@keyframes lpf{from{opacity:0}to{opacity:1}}
.lp *{box-sizing:border-box}.lp button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.lp-card{width:min(980px,100%);height:min(700px,100%);display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,#121a2e,#0b1120);border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.65);animation:lpp .26s cubic-bezier(.2,.9,.3,1.12) both}
@keyframes lpp{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
.lp-h{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.lp-t{flex:1;min-width:0}.lp-t b{display:block;font:700 17px/1.2 Georgia,serif}.lp-t small{display:block;margin-top:2px;font-size:12px;color:#8996b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lp-seg{display:flex;padding:3px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.lp-seg button{padding:7px 14px;border-radius:9px;font-size:13px;font-weight:650;color:#a9b6d0;transition:all .16s}
.lp-seg button.on{background:linear-gradient(135deg,#00F0D5,#7B6EF6);color:#04141a;box-shadow:0 4px 14px rgba(0,240,213,.25)}
.lp .lp-x{width:34px;height:34px;border-radius:10px;font-size:15px;color:#a9b6d0}.lp-x:hover{background:rgba(255,255,255,.1);color:#fff}
.lp-body{position:relative;flex:1;min-height:0}.lp-pane{position:absolute;inset:0;display:none;flex-direction:column}.lp-pane.on{display:flex;animation:lpf .2s ease both}
.lp-map{position:relative;flex:1;min-height:0}
.lpm{position:relative;overflow:hidden;background:#0c1322;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}.lpm:active{cursor:grabbing}
.lpm[data-layer="street"]{background:#e8e4d8}.lpm[data-layer="sat"]{background:#0a1a2a}
.lpm-t{position:absolute;inset:0;pointer-events:none}.lpm-i{position:absolute;left:0;top:0;opacity:0;max-width:none;transition:opacity .25s;will-change:transform}.lpm-i.on{opacity:1}.lpm-i.bad{display:none}
.lpm-a{position:absolute;right:6px;bottom:4px;z-index:3;font-size:10px;color:#222;background:rgba(255,255,255,.72);padding:1px 6px;border-radius:6px;pointer-events:none}
.lpm-m{position:absolute;left:0;top:0;z-index:4;width:0;height:0;cursor:grab}.lpm-m[hidden]{display:none}
.lpm-m i{position:absolute;left:-17px;top:-44px;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#FF5B8A,#FF9F43);border:3px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,.5);animation:lpd .35s cubic-bezier(.2,1.4,.4,1) both}
.lpm-m i::after{content:"";position:absolute;left:8px;top:8px;width:12px;height:12px;border-radius:50%;background:#fff}
.lpm-m u{position:absolute;left:-9px;top:-5px;width:18px;height:10px;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(2px);animation:lpr 1.8s ease-out infinite}.lpm-m.drag i{transform:rotate(-45deg) translate(6px,-6px) scale(1.1)}
@keyframes lpd{from{opacity:0;transform:rotate(-45deg) translate(-26px,26px)}to{opacity:1;transform:rotate(-45deg)}}@keyframes lpr{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}
.lpm-sb{position:absolute;left:12px;right:12px;top:12px;z-index:6;max-width:520px}
.lpm-si{display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;height:48px;border-radius:15px;background:rgba(14,20,38,.94);border:1px solid rgba(255,255,255,.16);box-shadow:0 10px 30px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:border-color .15s,box-shadow .15s}
.lpm-si:focus-within{border-color:#00F0D5;box-shadow:0 0 0 3px rgba(0,240,213,.2),0 10px 30px rgba(0,0,0,.45)}
.lpm-si input{flex:1;min-width:0;height:100%;background:none;border:0;outline:none;color:#fff;font-size:15px}.lpm-si input::placeholder{color:#7f8db0}
.lpm-si button{width:36px;height:36px;border-radius:11px;color:#a9b6d0;font-size:16px;flex:none}.lpm-si button:hover{background:rgba(255,255,255,.1);color:#fff}
.lpm-r{margin-top:8px;border-radius:15px;overflow:hidden;background:rgba(14,20,38,.97);border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px rgba(0,0,0,.5);max-height:min(46vh,320px);overflow-y:auto}.lpm-r:empty{display:none}
.lpm-r button{display:block;width:100%;text-align:left;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);transition:background .12s}.lpm-r button:last-child{border:0}.lpm-r button:hover,.lpm-r button.on{background:rgba(0,240,213,.1)}
.lpm-r b{display:block;font-size:14px;font-weight:650}.lpm-r small{display:block;margin-top:1px;font-size:12px;color:#8996b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lpm-r .msg{padding:12px 14px;font-size:13px;color:#8996b3}
.lpm-c{position:absolute;right:12px;top:72px;z-index:5;display:flex;flex-direction:column;gap:8px}
.lpm-c button{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:19px;background:rgba(14,20,38,.94);border:1px solid rgba(255,255,255,.16);box-shadow:0 6px 18px rgba(0,0,0,.4);color:#e8edf7;transition:transform .12s,border-color .15s}.lpm-c button:hover{border-color:#00F0D5}.lpm-c button:active{transform:scale(.92)}
.lpm-c .ly{font-size:11px;font-weight:700;letter-spacing:.02em;height:auto;padding:7px 4px;line-height:1.2}
.lpm-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:5;padding:8px 16px;border-radius:16px;font-size:12.5px;background:rgba(14,20,38,.92);border:1px solid rgba(255,255,255,.16);color:#c3cde0;pointer-events:none;width:max-content;max-width:calc(100% - 90px);text-align:center;line-height:1.35;transition:opacity .4s}.lpm-hint.off{opacity:0}
.lp-sheet{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 18px;border-top:1px solid rgba(255,255,255,.1);background:rgba(8,12,24,.7)}
.lp-pl{flex:1;min-width:200px}.lp-pl b{display:block;font-size:15px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.lp-pl small{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:3px;font-size:12.5px;color:#8996b3}.lp-pl a{color:#7fb7ff;text-decoration:none}.lp-pl a:hover{text-decoration:underline}
.lp-pl.empty b{color:#7f8db0;font-weight:500}
.lp .lp-go{padding:12px 22px;border-radius:13px;font-weight:700;font-size:14.5px;color:#04141a;background:linear-gradient(135deg,#00F0D5,#7B6EF6);box-shadow:0 8px 22px rgba(0,240,213,.28);transition:transform .12s,filter .15s}.lp .lp-go:hover{filter:brightness(1.08)}.lp .lp-go:active{transform:scale(.97)}.lp .lp-go[disabled]{opacity:.35;pointer-events:none;box-shadow:none}
.lp-sp{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:#00F0D5;border-radius:50%;animation:lps .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes lps{to{transform:rotate(360deg)}}
.lp-co{flex:1;min-height:0;padding:20px 22px;overflow:auto;display:flex;flex-direction:column;gap:16px;max-width:620px;width:100%;margin:0 auto}
.lp-co h4{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8996b3;margin-bottom:6px;font-weight:700}
.lp-fl{display:block}.lp-fl span{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8996b3;margin-bottom:5px}
.lp-fl input,.lp-fl textarea{width:100%;padding:12px 14px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);outline:none;color:#fff;font:inherit;font-size:15px;transition:border-color .15s,box-shadow .15s}.lp-fl textarea{min-height:64px;resize:vertical;font-size:14px}
.lp-fl input:focus,.lp-fl textarea:focus{border-color:#00F0D5;box-shadow:0 0 0 3px rgba(0,240,213,.18)}.lp-fl input.bad{border-color:#FF6B6B}
.lp-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lp-ok{padding:11px 14px;border-radius:13px;font-size:13.5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#a9b6d0;line-height:1.5}.lp-ok.good{border-color:rgba(74,222,128,.5);background:rgba(74,222,128,.08);color:#c7f5d8}.lp-ok.warn{border-color:rgba(255,180,84,.5);background:rgba(255,180,84,.08);color:#ffe2b8}
.lp-ex{display:flex;gap:6px;flex-wrap:wrap}.lp-ex button{padding:4px 11px;border-radius:99px;border:1px solid rgba(255,255,255,.16);font-size:12px;color:#a9b6d0}.lp-ex button:hover{border-color:#00F0D5;color:#fff}
.lp-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px}.lp-sec{padding:12px 18px;border-top:1px solid rgba(255,255,255,.1);background:rgba(8,12,24,.7);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.lp .lp-bt{padding:11px 18px;border-radius:12px;font-weight:650;font-size:14px;border:1px solid rgba(255,255,255,.16);color:#e8edf7}.lp .lp-bt:hover{background:rgba(255,255,255,.08)}
.lp-toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:9;padding:9px 16px;border-radius:12px;background:#1b2440;border:1px solid rgba(255,255,255,.2);font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);animation:lpf .2s ease both}
@media(max-width:700px){.lp{padding:0}.lp-card{width:100%;height:100%;border-radius:0}.lp-t small{display:none}.lp-seg button{padding:7px 10px}.lpm-sb{left:8px;right:8px;top:8px}.lpm-c{right:8px;top:66px}.lp-go{flex:1}.lp-g2{gap:8px}}
@media(prefers-reduced-motion:reduce){.lp *{animation:none!important;transition:none!important}}
`;
const TCSS=`.lp-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.lp-tools button{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:99px;border:1px solid rgba(120,140,190,.4);background:rgba(120,140,190,.12);color:inherit;font:600 12.5px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;transition:transform .12s,border-color .15s,background .15s}.lp-tools button:hover{border-color:#00C9B1;background:rgba(0,201,177,.14);transform:translateY(-1px)}.lp-tools button:active{transform:scale(.97)}.lp-tools small{opacity:.65;font-weight:500}`;
let root=null,S=null,map=null,revT=0,revCtl=null,srT=0,srCtl=null;
function build(){if(root)return;const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);root=document.createElement('div');root.className='lp';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Choose a location');
 root.innerHTML=`<div class="lp-card"><div class="lp-h"><div class="lp-t"><b id="lpTitle">Choose a location</b><small>Search, tap the map to drop a pin, or type coordinates</small></div><div class="lp-seg"><button data-t="map" class="on">🗺️ Map</button><button data-t="co">⌖ Coordinates</button></div><button class="lp-x" aria-label="Close">✕</button></div>
 <div class="lp-body">
  <div class="lp-pane on" data-p="map"><div class="lp-map" id="lpMapBox"><div class="lpm-sb"><div class="lpm-si"><span style="font-size:16px">🔎</span><input id="lpQ" placeholder="Search a city, village or address…" autocomplete="off" spellcheck="false"><button id="lpClr" title="Clear" hidden>✕</button></div><div class="lpm-r" id="lpR"></div></div>
   <div class="lpm-c"><button id="lpZi" title="Zoom in">＋</button><button id="lpZo" title="Zoom out">－</button><button id="lpLoc" title="Use my current location">◎</button><button id="lpLy" class="ly" title="Change map style">Street</button></div><div class="lpm-hint" id="lpHint">👆 Tap the map to drop a pin · drag to move · pinch or scroll to zoom</div></div>
   <div class="lp-sheet"><div class="lp-pl empty" id="lpPl"><b>No place chosen yet</b><small>Search above or tap anywhere on the map</small></div><button class="lp-go" id="lpUse" disabled>Use this location</button></div></div>
  <div class="lp-pane" data-p="co"><div class="lp-co">
   <label class="lp-fl"><span>Paste coordinates or a Google Maps link</span><textarea id="lpPaste" placeholder="e.g.  18.5204, 73.8567     or     18°31'13&quot;N 73°51'24&quot;E     or a google.com/maps link" spellcheck="false"></textarea></label>
   <div class="lp-ex"><button data-ex="18.5204, 73.8567">18.5204, 73.8567</button><button data-ex="28°36'50&quot;N 77°12'32&quot;E">28°36'50"N 77°12'32"E</button><button data-ex="-33.8688, 151.2093">−33.8688, 151.2093</button></div>
   <div class="lp-g2"><label class="lp-fl"><span>Latitude (−90 to 90)</span><input id="lpLat" inputmode="decimal" placeholder="e.g. 18.5204"></label><label class="lp-fl"><span>Longitude (−180 to 180)</span><input id="lpLon" inputmode="decimal" placeholder="e.g. 73.8567"></label></div>
   <label class="lp-fl"><span>Place name <i style="text-transform:none;letter-spacing:0">(optional — we look it up if you leave it blank)</i></span><input id="lpName" placeholder="e.g. Pune, India" maxlength="120"></label>
   <div class="lp-ok" id="lpMsg">Latitude is north (+) or south (−) of the equator. Longitude is east (+) or west (−) of Greenwich. India is about 8–35 °N, 68–97 °E.</div>
   <div class="lp-row"><button class="lp-bt" id="lpShow">🗺️ Show on map</button><a class="lp-bt" id="lpG" target="_blank" rel="noopener" style="text-decoration:none;display:none">↗ Open in Google Maps</a></div></div>
   <div class="lp-sec"><button class="lp-bt" data-close>Cancel</button><button class="lp-go" id="lpUse2" disabled>Use these coordinates</button></div></div>
 </div></div>`;document.body.appendChild(root);wire();}
function $(s){return root.querySelector(s);}
function toast(m){const t=document.createElement('div');t.className='lp-toast';t.textContent=m;$('.lp-body').appendChild(t);setTimeout(()=>t.remove(),2600);}
function tab(t){root.querySelectorAll('.lp-seg button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));root.querySelectorAll('.lp-pane').forEach(p=>p.classList.toggle('on',p.dataset.p===t));S.tab=t;if(t==='map'){setTimeout(()=>{map&&map.render();},30);}else{setTimeout(()=>$('#lpPaste').focus(),50);}}
function setPlace(lat,lon,name,addr,fly){S.sel={lat,lon,name:name||'',addr:addr||null};map.setMarker(lat,lon);if(fly)map.flyTo(lat,lon,fly);showSel();}
function showSel(){const s=S.sel,el=$('#lpPl'),b=$('#lpUse');if(!s){el.className='lp-pl empty';el.innerHTML='<b>No place chosen yet</b><small>Search above or tap anywhere on the map</small>';b.disabled=true;return;}
  el.className='lp-pl';el.innerHTML=`<b>${s.loading?'<span class="lp-sp"></span>Finding place name…':esc(s.name||'Dropped pin')}</b><small><span>📍 ${fmt(s.lat,s.lon)}</span><a href="${gmaps(s.lat,s.lon)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></small>`;b.disabled=false;}
function reverse(lat,lon){clearTimeout(revT);if(revCtl)revCtl.abort();const s=S.sel;s.loading=true;s.name='';showSel();revT=setTimeout(async()=>{revCtl=new AbortController();const to=setTimeout(()=>revCtl.abort(),7000);try{const r=await fetch(`${NOM}reverse?format=jsonv2&addressdetails=1&zoom=14&lat=${lat}&lon=${lon}`,{signal:revCtl.signal,headers:{'Accept-Language':'en'}});const j=await r.json();if(S.sel&&S.sel.lat===lat&&S.sel.lon===lon){S.sel.loading=false;if(j&&j.display_name){S.sel.name=j.display_name;S.sel.addr=j.address||null;}else S.sel.name='';showSel();}}catch(e){if(S.sel&&S.sel.lat===lat&&S.sel.lon===lon){S.sel.loading=false;S.sel.name='';showSel();}}finally{clearTimeout(to);}},380);}
function doSearch(q,now){clearTimeout(srT);const R=$('#lpR');if(srCtl)srCtl.abort();if(q.trim().length<2){R.innerHTML='';return;}
  const direct=parse(q);if(direct){R.innerHTML=`<button data-co="1"><b>⌖ Use coordinates ${fmt(direct.lat,direct.lon)}</b><small>Looks like coordinates — tap to drop a pin here</small></button>`;R._d=direct;return;}
  R.innerHTML='<div class="msg"><span class="lp-sp"></span>Searching…</div>';srT=setTimeout(async()=>{srCtl=new AbortController();const to=setTimeout(()=>srCtl.abort(),8000);try{const r=await fetch(`${NOM}search?format=jsonv2&addressdetails=1&limit=7&q=${encodeURIComponent(q)}`,{signal:srCtl.signal,headers:{'Accept-Language':'en'}});const a=await r.json();S.results=a;
    R.innerHTML=a.length?a.map((x,i)=>{const p=x.display_name.split(',');return `<button data-i="${i}"><b>${esc(p[0])}</b><small>${esc(p.slice(1).join(',').trim()||x.display_name)}</small></button>`;}).join(''):'<div class="msg">No places found. Try a nearby bigger town, or use the Coordinates tab.</div>';}
   catch(e){if(e.name!=='AbortError')R.innerHTML='<div class="msg">Search is unavailable right now (no internet?). You can still tap the map or use the Coordinates tab.</div>';}finally{clearTimeout(to);}},now?0:550);}
function useSel(){const s=S.sel;if(!s)return;done({display_name:s.name||fmt(s.lat,s.lon),lat:String(s.lat),lon:String(s.lon),address:s.addr||{},source:'map'});}
function done(r){const cb=S.cb;close();try{cb&&cb(r);}catch(e){console.error(e);}}
function close(){if(!root)return;root.classList.remove('on');if(map){map.stop();}document.body.style.overflow=S&&S.ov||'';}
/* coordinates tab */
function coSync(from){const la=$('#lpLat'),lo=$('#lpLon'),msg=$('#lpMsg'),b=$('#lpUse2'),g=$('#lpG');let ok=null;
  if(from==='paste'){const p=parse($('#lpPaste').value);if(p){la.value=+p.lat.toFixed(6);lo.value=+p.lon.toFixed(6);ok=p;if(p.swapped){msg.className='lp-ok warn';msg.textContent='Those looked like longitude, latitude — we swapped them for you. Please check the preview.';}}else if($('#lpPaste').value.trim()){msg.className='lp-ok warn';msg.textContent=/goo\.gl|maps\.app/i.test($('#lpPaste').value)?'Short Google links cannot be read. Open the link, then copy the full address from the browser bar — or copy the numbers shown at the bottom of Google Maps.':'Could not find coordinates in that text. Try “18.5204, 73.8567”.';}}
  const a=parseFloat(la.value),c=parseFloat(lo.value);la.classList.toggle('bad',la.value!==''&&!(Math.abs(a)<=90));lo.classList.toggle('bad',lo.value!==''&&!(Math.abs(c)<=180));
  if(Math.abs(a)<=90&&Math.abs(c)<=180&&la.value!==''&&lo.value!==''){ok={lat:a,lon:c};b.disabled=false;g.style.display='';g.href=gmaps(a,c);if(!(from==='paste'&&msg.classList.contains('warn'))){msg.className='lp-ok good';msg.innerHTML='✓ '+fmt(a,c)+' &nbsp;—&nbsp; '+(a>=0?'northern':'southern')+' hemisphere, '+(c>=0?'east':'west')+' of Greenwich.';}}
  else{b.disabled=true;g.style.display='none';if(from!=='paste'||!$('#lpPaste').value.trim()){msg.className='lp-ok';msg.textContent=(la.value!==''&&!(Math.abs(a)<=90))?'Latitude must be between −90 and 90.':(lo.value!==''&&!(Math.abs(c)<=180))?'Longitude must be between −180 and 180.':'Latitude is north (+) or south (−) of the equator. Longitude is east (+) or west (−) of Greenwich. India is about 8–35 °N, 68–97 °E.';}}return ok;}
async function useCoords(){const la=parseFloat($('#lpLat').value),lo=parseFloat($('#lpLon').value);if(!(Math.abs(la)<=90&&Math.abs(lo)<=180))return;let name=$('#lpName').value.trim(),addr=null;const b=$('#lpUse2');b.disabled=true;b.innerHTML='<span class="lp-sp"></span>Checking…';
  try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),4500);const r=await fetch(`${NOM}reverse?format=jsonv2&addressdetails=1&zoom=10&lat=${la}&lon=${lo}`,{signal:ctl.signal,headers:{'Accept-Language':'en'}});clearTimeout(to);const j=await r.json();if(j){addr=j.address||null;if(!name&&j.display_name)name=j.display_name;}}catch(e){}
  b.innerHTML='Use these coordinates';done({display_name:name||fmt(la,lo),lat:String(la),lon:String(lo),address:addr||{},source:'coords'});}
function wire(){
  root.addEventListener('mousedown',e=>{if(e.target===root)close();});
  $('.lp-x').onclick=close;root.querySelector('[data-close]').onclick=close;
  root.querySelectorAll('.lp-seg button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
  document.addEventListener('keydown',e=>{if(!root.classList.contains('on'))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if($('#lpR').innerHTML&&document.activeElement===$('#lpQ')){$('#lpR').innerHTML='';}else close();}},true);
  const q=$('#lpQ');q.addEventListener('input',()=>{$('#lpClr').hidden=!q.value;doSearch(q.value);});
  q.addEventListener('keydown',e=>{const R=$('#lpR'),bs=[...R.querySelectorAll('button')];if(e.key==='Enter'){e.preventDefault();if(bs.length){const on=R.querySelector('button.on')||bs[0];on.click();}else doSearch(q.value,true);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!bs.length)return;let i=bs.findIndex(b=>b.classList.contains('on'));bs.forEach(b=>b.classList.remove('on'));i=(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;bs[i].classList.add('on');bs[i].scrollIntoView({block:'nearest'});}});
  $('#lpClr').onclick=()=>{q.value='';$('#lpClr').hidden=true;$('#lpR').innerHTML='';q.focus();};
  $('#lpR').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.co){const d=$('#lpR')._d;setPlace(d.lat,d.lon,'',null,12);reverse(d.lat,d.lon);}else{const x=S.results[+b.dataset.i],la=parseFloat(x.lat),lo=parseFloat(x.lon);setPlace(la,lo,x.display_name,x.address,x.type==='house'?16:12);S.sel.loading=false;showSel();}$('#lpR').innerHTML='';q.value=(b.querySelector('b')||{}).textContent||q.value;q.blur();$('#lpHint').classList.add('off');});
  $('#lpZi').onclick=()=>{const s=map.size();map.zoomAt(clamp(map.z+1,2,map.max()),s.w/2,s.h/2,true);};$('#lpZo').onclick=()=>{const s=map.size();map.zoomAt(clamp(map.z-1,2,map.max()),s.w/2,s.h/2,true);};
  $('#lpLy').onclick=()=>{const k=Object.keys(LAYERS),n=k[(k.indexOf(map.layer)+1)%k.length];map.setLayer(n);$('#lpLy').textContent=LAYERS[n].n;try{localStorage.setItem('lpLayer',n);}catch(_){}};
  $('#lpLoc').onclick=()=>{if(!navigator.geolocation)return toast('Your browser cannot share location');toast('Finding your location…');navigator.geolocation.getCurrentPosition(p=>{setPlace(p.coords.latitude,p.coords.longitude,'',null,14);reverse(p.coords.latitude,p.coords.longitude);},()=>toast('Location permission was blocked — search instead'),{timeout:9000,maximumAge:60000});};
  $('#lpUse').onclick=useSel;$('#lpUse2').onclick=useCoords;
  $('#lpPaste').addEventListener('input',()=>coSync('paste'));$('#lpLat').addEventListener('input',()=>coSync('f'));$('#lpLon').addEventListener('input',()=>coSync('f'));
  root.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{$('#lpPaste').value=b.dataset.ex;coSync('paste');});
  $('#lpShow').onclick=()=>{const p=coSync('f');if(!p)return toast('Enter valid coordinates first');tab('map');setPlace(p.lat,p.lon,$('#lpName').value.trim(),null,11);if(!$('#lpName').value.trim())reverse(p.lat,p.lon);else{S.sel.loading=false;showSel();}};
  root.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest&&e.target.closest('.lp-co')&&e.target.tagName!=='TEXTAREA'){e.preventDefault();$('#lpUse2').click();}});}
function open(o){o=o||{};build();S={cb:o.onPick,tab:o.mode==='coords'?'co':'map',sel:null,results:[],ov:document.body.style.overflow};document.body.style.overflow='hidden';root.classList.add('on');$('#lpTitle').textContent=o.title||'Choose a location';
  $('#lpQ').value='';$('#lpClr').hidden=true;$('#lpR').innerHTML='';$('#lpPaste').value='';$('#lpLat').value=o.lat!=null?+(+o.lat).toFixed(6):'';$('#lpLon').value=o.lon!=null?+(+o.lon).toFixed(6):'';$('#lpName').value='';$('#lpHint').classList.remove('off');
  let ly='street';try{ly=localStorage.getItem('lpLayer')||'street';}catch(_){}if(!LAYERS[ly])ly='street';
  const has=o.lat!=null&&o.lon!=null&&isFinite(o.lat)&&isFinite(o.lon);
  if(!map){map=new Map2($('#lpMapBox'),{lat:has?+o.lat:20.5,lon:has?+o.lon:78.9,z:has?11:4,layer:ly,onClick:(la,lo)=>{S.sel={lat:la,lon:lo,name:'',addr:null};$('#lpHint').classList.add('off');reverse(la,lo);}});}
  else{map.clearMarker();map.setLayer(ly);map.setView(has?+o.lat:20.5,has?+o.lon:78.9,has?11:4);}
  $('#lpLy').textContent=LAYERS[map.layer].n;
  if(has){S.sel={lat:+o.lat,lon:+o.lon,name:o.name||'',addr:null};map.setMarker(+o.lat,+o.lon);showSel();if(!o.name)reverse(+o.lat,+o.lon);else{S.sel.loading=false;showSel();}}else{showSel();}
  coSync('f');tab(S.tab);if(S.tab==='map'&&!has)setTimeout(()=>{try{$('#lpQ').focus();}catch(_){}},120);setTimeout(()=>map.render(),60);}
/* ---------- buttons next to a place field in any app ---------- */
function attach(doc,input,apply,opts){opts=opts||{};if(!doc||!input||input.dataset.lp)return;input.dataset.lp='1';
  if(!doc.getElementById('lp-tools-css')){const s=doc.createElement('style');s.id='lp-tools-css';s.textContent=TCSS;(doc.head||doc.documentElement).appendChild(s);}
  const w=doc.createElement('div');w.className='lp-tools';w.innerHTML='<button type="button" data-m="map" title="Search and pick the place on a map">🗺️ Pick on map</button><button type="button" data-m="coords" title="Type latitude and longitude yourself">⌖ Enter coordinates</button>';
  const host=opts.after||(input.closest&&(input.closest('.location-wrap,.location-wrap-mini,label,.field')))||input.parentNode;(host===input?input.parentNode:host).appendChild(w);
  w.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();const c=opts.get?opts.get():null;open({mode:b.dataset.m,lat:c&&c.lat,lon:c&&c.lon,name:input.value,title:opts.title,onPick:apply});});return w;}
window.LocPicker={open,attach,parse,fmt,close};
})();
