(function(){
  const stage = document.getElementById('stage'), load = document.getElementById('load'), txt = document.getElementById('loadTxt');
  const NAME = { A:'3D Sky', B:'Birth Chart', N:'Notepad' }, frames = {};
  const FILES = { A:'apps/sky/index.html', B:'apps/birth-chart/index.html', N:'apps/notebook/index.html' };
  /* welcome greeting (first start only) */
  const T0 = performance.now(); let firstDone = false;
  (function(){
    const hr = new Date().getHours(), g = hr < 5 ? 'Shubh Ratri' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : hr < 21 ? 'Good evening' : 'Shubh Ratri';
    document.getElementById('welHi').textContent = 'Namaste, ' + g.toLowerCase();
    const z = document.getElementById('zring'), G = '\u2648\u2649\u264A\u264B\u264C\u264D\u264E\u264F\u2650\u2651\u2652\u2653';
    for (let i = 0; i < 12; i++){ const e = document.createElement('s'); e.textContent = G[i] + '\uFE0E'; e.style.transform = 'rotate(' + i*30 + 'deg) translateY(-86px) rotate(' + (-i*30) + 'deg)'; e.style.animationDelay = (0.2 + i*0.07) + 's'; z.appendChild(e); }
    const L = ['Welcome to your sky', 'Charts, planets and time, in one place', 'Preparing the heavens\u2026', 'Aligning the planets\u2026'], sub = document.getElementById('welSub'); let k = 0;
    const t = setInterval(()=>{ if (firstDone){ clearInterval(t); return; } sub.style.opacity = 0; setTimeout(()=>{ k = (k+1) % L.length; sub.textContent = L[k]; sub.style.opacity = 1; }, 380); }, 1700);
  })();
  function mount(k){
    if (frames[k]) return frames[k];
    load.classList.remove('hide'); txt.textContent = 'LOADING ' + NAME[k].toUpperCase() + '…';
    const f = document.createElement('iframe'); f.title = NAME[k]; f.setAttribute('allow', 'fullscreen; camera');
    f.addEventListener('load', ()=>{
      try{ f.contentWindow.dispatchEvent(new Event('resize')); }catch(e){}
      /* one loader only: stay until the inner app has finished its own start-up (max 9s) */
      let n = 0; const done = ()=>{ if (cur !== k) return; const wait0 = firstDone ? 0 : Math.max(0, 2400 - (performance.now() - T0)); setTimeout(()=>{ if (cur === k){ load.classList.add('hide'); firstDone = true; setTimeout(()=>load.classList.add('compact'), 800); } }, wait0); };
      (function wait(){ let ready = true; try{ const m = f.contentDocument.getElementById('loadingMask'); ready = !m || m.classList.contains('hide'); }catch(e){}
        if (ready || ++n > 90) settle(); else setTimeout(wait, 100); })();
      /* keep the loader up until the heavy scene is rendering smoothly (10 quick frames in a row, max 6s) */
      function settle(){
        if (k !== 'A'){ done(); return; }
        txt.textContent = 'WARMING UP THE SKY\u2026';
        let good = 0, last = 0; const t0 = performance.now(); let w; try{ w = f.contentWindow; }catch(e){ done(); return; }
        (function f1(ts){
          if (cur !== k){ done(); return; }
          if (last){ good = (ts - last) < 45 ? good + 1 : 0; } last = ts;
          if (good >= 10 || performance.now() - t0 > 6000) done(); else w.requestAnimationFrame(f1);
        })(0);
      }
    });
    f.src = FILES[k]; stage.appendChild(f); frames[k] = f; return f;
  }
  const sw = document.getElementById('sw'), swBtn = document.getElementById('swBtn'), swBack = document.getElementById('swBack'), swIco = document.getElementById('swIco');
  const ICON = { A:'🌌', B:'🧭', N:'📝' };
  let cur = 'B', devF = null;
  function setMenu(open){
    if (open) place();
    sw.classList.toggle('open', open); swBack.classList.toggle('show', open);
    swBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function show(k){
    cur = k; closeDev();
    const f = mount(k);
    for (const j in frames) frames[j].classList.toggle('on', j === k);
    sw.querySelectorAll('.sw-item[data-act="A"],.sw-item[data-act="B"],.sw-item[data-act="N"]').forEach(b=>{ const on = b.dataset.act === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    swIco.textContent = ICON[k];
    try{ f.contentWindow.dispatchEvent(new Event('resize')); }catch(e){}
    try{ history.replaceState(null, '', k === 'A' ? '#sky' : k === 'N' ? '#notes' : '#chart'); }catch(e){}
  }
  /* Developer card: its own overlay on top of whatever view is open — never switches views */
  function openDev(){
    if (!devF){ devF = document.createElement('iframe'); devF.id = 'devFrame'; devF.title = 'Developer'; devF.src = 'apps/developer/index.html'; document.body.appendChild(devF); }
    devF.classList.add('on');
  }
  function closeDev(){ if (devF) devF.classList.remove('on'); }
  window.addEventListener('message', e=>{ if (e.data === 'vedic-dev-close') closeDev(); else if (e.data === 'vedic-open-chart') show('B'); });

  /* ---- floating, draggable switcher ---- */
  const SZ = 40, M = 10;
  let pos = { x:null, y:null };
  try{ const s = JSON.parse(localStorage.getItem('vedicSwPos') || 'null'); if (s && typeof s.x === 'number') pos = s; }catch(e){}
  function clamp(){
    const W = innerWidth, H = innerHeight;
    if (pos.x == null){ pos.x = W - SZ - M; pos.y = Math.round(H * 0.4); }
    pos.x = Math.min(Math.max(pos.x, M), W - SZ - M);
    pos.y = Math.min(Math.max(pos.y, M + 40), H - SZ - M - 20);
  }
  function place(){
    clamp();
    sw.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    sw.dataset.x = (pos.x + SZ/2 > innerWidth/2) ? 'r' : 'l';
    sw.dataset.y = (pos.y + SZ/2 > innerHeight/2) ? 'b' : 't';
  }
  function save(){ try{ localStorage.setItem('vedicSwPos', JSON.stringify(pos)); }catch(e){} }
  let drag = null, moved = false;
  swBtn.addEventListener('pointerdown', e=>{
    drag = { sx:e.clientX, sy:e.clientY, ox:pos.x, oy:pos.y, id:e.pointerId }; moved = false;
    try{ swBtn.setPointerCapture(e.pointerId); }catch(_){}
  });
  swBtn.addEventListener('pointermove', e=>{
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!moved && Math.hypot(dx, dy) < 7) return;
    if (!moved){ moved = true; sw.classList.add('drag'); setMenu(false); }
    pos.x = drag.ox + dx; pos.y = drag.oy + dy; place();
  });
  function endDrag(){
    if (!drag) return;
    drag = null; sw.classList.remove('drag');
    if (moved){ pos.x = (pos.x + SZ/2 > innerWidth/2) ? innerWidth - SZ - M : M; place(); save(); }   // snap to nearest side
  }
  swBtn.addEventListener('pointerup', endDrag); swBtn.addEventListener('pointercancel', endDrag);
  swBtn.addEventListener('click', ()=>{ if (moved){ moved = false; return; } setMenu(!sw.classList.contains('open')); });
  addEventListener('resize', place);

  swBack.addEventListener('click', ()=> setMenu(false));
  document.addEventListener('keydown', e=>{ if (e.key === 'Escape' && sw.classList.contains('open')){ setMenu(false); swBtn.focus(); } });
  sw.querySelectorAll('.sw-item').forEach(b=> b.addEventListener('click', ()=>{
    const a = b.dataset.act; setMenu(false);
    if (a === 'dev') openDev(); else show(a);
  }));
  place();
  show(location.hash === '#sky' ? 'A' : location.hash === '#notes' ? 'N' : 'B');
  if (location.hash === '#developer') openDev();
})();
