/* ===== Share chart by link / QR (no server: birth data lives in the URL hash) ===== */
(function(){
  const $=id=>document.getElementById(id);
  const FALLBACK_BASE='https://digitalboy69.github.io/Projects-and-apps/';
  const b64e=s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const b64d=s=>decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));
  function baseUrl(){ try{ const l=window.parent.location; if(/^https?:$/.test(l.protocol)) return l.href.split('#')[0]; }catch(e){} return FALLBACK_BASE; }
  function pack(p){ return b64e(JSON.stringify([1,(p.name||'').slice(0,40),p.dob,p.tob,+(+p.lat).toFixed(4),+(+p.lon).toFixed(4),+p.tz,(p.place||'').split(',').slice(0,2).join(',').slice(0,50)])); }
  function unpack(s){
    try{
      const a=JSON.parse(b64d(s.trim()));
      if(!Array.isArray(a)||a[0]!==1) return null;
      const p={name:String(a[1]||'Shared chart').slice(0,40),dob:String(a[2]),tob:String(a[3]),lat:+a[4],lon:+a[5],tz:+a[6],place:String(a[7]||'')};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.dob)||!/^\d{2}:\d{2}(:\d{2})?$/.test(p.tob)||!isFinite(p.lat)||!isFinite(p.lon)||!isFinite(p.tz)||Math.abs(p.lat)>90||Math.abs(p.lon)>180) return null;
      return p;
    }catch(e){ return null; }
  }
  function linkFor(p){ return baseUrl()+'#c='+pack(p); }
  function fromText(t){ const m=/[#&?]c=([A-Za-z0-9_-]+)/.exec(t||'') || /^([A-Za-z0-9_-]{20,})$/.exec((t||'').trim()); return m?unpack(m[1]):null; }
  function formProfile(){
    const lat=typeof selectedLat==='number'?selectedLat:NaN, lon=typeof selectedLon==='number'?selectedLon:NaN;
    const p={name:$('profileName').value.trim(),dob:$('dobInput').value,tob:$('tobInput').value,lat:lat,lon:lon,tz:parseFloat($('tzInput').value),place:$('placeInput').value};
    return (p.name&&p.dob&&p.tob&&isFinite(lat)&&isFinite(lon)&&isFinite(p.tz))?p:null;
  }
  function openShared(p){
    closeModal();
    loadProfileIntoForm(p);
    $('birthForm').requestSubmit ? $('birthForm').requestSubmit() : $('birthForm').dispatchEvent(new Event('submit',{cancelable:true}));
  }
  function qrCanvas(text,px){
    const q=qrcode(0,'M'); q.addData(text); q.make();
    const n=q.getModuleCount(), quiet=3, sc=Math.max(3,Math.floor(px/(n+quiet*2))), size=(n+quiet*2)*sc;
    const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,size,size); x.fillStyle='#0b1020';
    for(let r=0;r<n;r++)for(let k=0;k<n;k++) if(q.isDark(r,k)) x.fillRect((k+quiet)*sc,(r+quiet)*sc,sc,sc);
    return c;
  }
  let modal=null, stream=null, raf=0;
  function closeModal(){ stopCam(); if(modal) modal.classList.remove('show'); }
  function stopCam(){ cancelAnimationFrame(raf); if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } }
  function ensureModal(){
    if(modal) return modal;
    modal=document.createElement('div'); modal.className='modal-overlay'; modal.id='shareModal';
    modal.innerHTML='<div class="modal-box sh-box"><button type="button" class="sh-x" aria-label="Close">✕</button><div id="shBody"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal||e.target.closest('.sh-x')) closeModal(); });
    return modal;
  }
  function toast(el,msg){ const o=el.textContent; el.textContent=msg; setTimeout(()=>el.textContent=o,1600); }
  function showShare(p){
    ensureModal(); stopCam();
    const url=linkFor(p), cv=qrCanvas(url,300); cv.className='sh-qr';
    const body=$('shBody');
    body.innerHTML='<div class="sh-badge">📤 Ready to share</div><h4>'+escapeHtml(p.name)+'\u2019s chart</h4><div class="sh-qrwrap"><div class="sh-frame"></div></div><p class="sh-sub">Ask your friend to scan this with their phone camera</p>'
      +'<div class="sh-steps"><span><i>1</i>Show QR</span><span><i>2</i>Friend scans</span><span><i>3</i>Chart opens ✨</span></div>'
      +'<div class="sh-row"><button type="button" class="btn btn-primary btn-sm" id="shCopy">🔗 Copy link</button><button type="button" class="btn btn-ghost btn-sm" id="shDl">⬇️ Save QR image</button>'+(navigator.share?'<button type="button" class="btn btn-ghost btn-sm" id="shNative">📲 Send…</button>':'')+'</div>'
      +'<div class="sh-warn">🔒 This link has the birth details inside. Share only with people you trust.</div>';
    body.querySelector('.sh-frame').appendChild(cv);
    $('shCopy').onclick=function(){ const b=this; (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast(b,'✅ Copied'),()=>{ window.prompt('Copy this link:',url); }); };
    $('shDl').onclick=()=>{ const a=document.createElement('a'); a.download=(p.name||'chart').replace(/[^\w-]+/g,'_')+'-chart-qr.png'; a.href=cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); };
    if($('shNative')) $('shNative').onclick=()=>navigator.share({title:p.name+'’s birth chart',url:url}).catch(()=>{});
    modal.classList.add('show');
  }
  function decodeImageData(d){ const r=window.jsQR&&jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'}); return r&&r.data; }
  function decodeFile(file,cb){
    const img=new Image(), u=URL.createObjectURL(file);
    img.onload=()=>{ const sc=Math.min(1,1400/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
      const x=c.getContext('2d'); x.drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); cb(decodeImageData(x.getImageData(0,0,c.width,c.height))); };
    img.onerror=()=>{ URL.revokeObjectURL(u); cb(null); }; img.src=u;
  }
  function handleText(t,msgEl){
    const p=fromText(t);
    if(p) openShared(p); else if(msgEl){ msgEl.textContent='😕 That doesn’t look like a chart link or QR from this app.'; msgEl.hidden=false; }
  }
  function showScan(){
    ensureModal(); stopCam();
    $('shBody').innerHTML='<div class="sh-badge">📥 Open a chart</div><h4>Got a chart from a friend?</h4><p class="sh-sub">Pick any one way below</p>'
      +'<div class="sh-vid" id="shVidBox" hidden><video id="shVid" playsinline muted></video><div class="sh-scanbox"><i></i></div><div class="sh-vhint">Point at the QR code</div></div>'
      +'<div class="sh-opts"><button type="button" class="sh-opt" id="shCam"><span>📷</span><b>Scan with camera</b><small>Point your camera at their QR</small></button>'
      +'<label class="sh-opt sh-up"><span>🖼️</span><b>Upload QR picture</b><small>Photo or screenshot of the QR</small><input type="file" id="shFile" accept="image/*" hidden></label>'
      +'<div class="sh-opt sh-pst"><span>🔗</span><b>Paste the link</b><div class="sh-paste"><input type="text" id="shPaste" placeholder="Paste link here"><button type="button" class="btn btn-primary btn-sm" id="shGo">Open</button></div></div></div>'
      +'<div class="sh-msg" id="shMsg" hidden></div>';
    const msg=$('shMsg');
    $('shFile').onchange=function(){ const f=this.files[0]; if(!f) return; msg.hidden=true; decodeFile(f,t=>{ if(t) handleText(t,msg); else { msg.textContent='😕 Could not find a QR code in that image. Try a clearer, closer picture.'; msg.hidden=false; } }); this.value=''; };
    $('shGo').onclick=()=>handleText($('shPaste').value,msg);
    $('shPaste').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); handleText($('shPaste').value,msg); } });
    $('shCam').onclick=async()=>{
      msg.hidden=true;
      try{
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        const v=$('shVid'); v.srcObject=stream; $('shVidBox').hidden=false; await v.play();
        const c=document.createElement('canvas'), x=c.getContext('2d',{willReadFrequently:true});
        (function tick(){
          if(!stream) return;
          if(v.videoWidth){ c.width=v.videoWidth; c.height=v.videoHeight; x.drawImage(v,0,0); const t=decodeImageData(x.getImageData(0,0,c.width,c.height)); if(t&&fromText(t)){ stopCam(); handleText(t,msg); return; } }
          raf=requestAnimationFrame(tick);
        })();
      }catch(e){ stopCam(); msg.textContent='📷 Camera is not available here. Use “Upload QR image” instead (take a photo or screenshot of the QR).'; msg.hidden=false; }
    };
    modal.classList.add('show');
  }
  window.vaxShareProfile=function(p){ if(p) showShare(p); };
  window.vaxScanOpen=showScan;
  // ---- main input section UI ----
  function build(){
    const form=$('birthForm'); if(!form||$('inShare')) return;
    const box=document.createElement('div'); box.className='in-share'; box.id='inShare';
    box.innerHTML='<div class="in-share-h"><span class="in-share-ic">📲</span><div><b>Share or open a chart</b><small>Send a chart to anyone, or open one you received. No sign-up.</small></div></div><div class="in-share-b"><button type="button" class="in-sh-btn" id="inShareBtn"><span class="in-sh-ic">🔗</span><b>Share my chart</b><small>Get a link + QR code</small></button><button type="button" class="in-sh-btn alt" id="inScanBtn"><span class="in-sh-ic">📷</span><b>Open a chart</b><small>Scan QR, upload or paste</small></button></div><div class="in-share-n" id="inShareN" hidden></div>';
    form.parentNode.insertBefore(box,form.nextSibling);
    $('inScanBtn').onclick=showScan;
    $('inShareBtn').onclick=()=>{ const p=formProfile(), n=$('inShareN'); if(!p){ n.textContent='Fill in your name, birth date, time and place first (steps above), then tap Share.'; n.hidden=false; return; } n.hidden=true; showShare(p); };
  }
  // saved-profile cards get a share button via delegation (button is added in renderProfileCards)
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-prof-share]'); if(!b) return; e.stopPropagation(); const p=loadProfiles()[+b.dataset.profShare]; if(p) showShare(p); },true);
  build();
  // ---- open from URL hash (#c=...) ----
  function fromHash(){
    let h=''; try{ h=window.parent.__vaxHash||''; }catch(e){}
    if(!/c=/.test(h)){ try{ h=window.parent.location.hash; }catch(e){} }
    if(!/c=/.test(h)){ try{ h=location.hash; }catch(e){} }
    const p=/c=/.test(h)?fromText(h):null; if(!p) return;
    try{ window.parent.history.replaceState(null,'',window.parent.location.href.split('#')[0]); }catch(e){}
    setTimeout(()=>openShared(p),300);
  }
  fromHash();
})();
