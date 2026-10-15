/* ===== Cloud account: sign in + sync saved profiles (Supabase REST, no library) ===== */
(function(){
  const SB_URL='https://pbnfpbugxcndmrgpuved.supabase.co', SB_KEY='sb_publishable_dpTL2lYOd1qirgYXR2P-9Q_WK18oZIV', SK='vax_sb_session';
  const $=id=>document.getElementById(id);
  let sess=null, syncing=false, status='', member=null, isAdm=false;
  try{ sess=JSON.parse(localStorage.getItem(SK)||'null'); }catch(e){}
  const saveSess=s=>{ sess=s; try{ s?localStorage.setItem(SK,JSON.stringify(s)):localStorage.removeItem(SK); }catch(e){} };
  function normSess(j){ if(!j||!j.access_token) return null; return {access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),email:(j.user&&j.user.email)||(sess&&sess.email)||'',uid:(j.user&&j.user.id)||(sess&&sess.uid)||''}; }
  async function raw(path,opt){ opt=opt||{}; const h=Object.assign({apikey:SB_KEY,'Content-Type':'application/json'},opt.headers||{}); const r=await fetch(SB_URL+path,Object.assign({},opt,{headers:h})); let j=null; try{ j=await r.json(); }catch(e){} if(!r.ok){ const m=(j&&(j.msg||j.message||j.error_description||j.error))||('Error '+r.status); const er=new Error(m); er.code=j&&(j.error_code||j.code); er.status=r.status; throw er; } return j; }
  async function token(){
    if(!sess) return null;
    if(sess.expires_at*1000-Date.now()<60000){
      try{ const j=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:sess.refresh_token})}); saveSess(normSess(j)); }
      catch(e){ if(e.status===400||e.status===401){ saveSess(null); renderAcct(); } throw e; }
    }
    return sess&&sess.access_token;
  }
  async function rest(path,opt){ const t=await token(); if(!t) throw new Error('Not signed in'); opt=opt||{}; opt.headers=Object.assign({Authorization:'Bearer '+t},opt.headers||{}); return raw('/rest/v1/'+path,opt); }
  // ---- profile mapping ----
  const cid=p=>[p.name,p.dob,p.tob,(+p.lat).toFixed(3),(+p.lon).toFixed(3)].join('|');
  const toRow=p=>({client_id:cid(p),name:String(p.name||'').slice(0,80),dob:p.dob,tob:p.tob,tz:+p.tz,place:p.place||'',lat:+p.lat,lon:+p.lon,saved_at:new Date(p.savedAt||Date.now()).toISOString()});
  const fromRow=r=>({name:r.name,dob:r.dob,tob:String(r.tob).slice(0,5),tz:+r.tz,place:r.place||'',lat:r.lat,lon:r.lon,savedAt:Date.parse(r.saved_at)||Date.now()});
  const valid=p=>p&&p.name&&p.dob&&p.tob&&isFinite(p.lat)&&isFinite(p.lon)&&isFinite(p.tz);
  const rawSave=list=>localStorage.setItem(STORAGE_KEY,JSON.stringify(list));
  async function upsert(list){ const rows=list.filter(valid).map(toRow); if(!rows.length) return; await rest('chart_profiles?on_conflict=user_id,client_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)}); }
  async function remove(list){ for(const p of list){ if(!valid(p)) continue; await rest('chart_profiles?client_id=eq.'+encodeURIComponent(cid(p)),{method:'DELETE'}); } }
  async function fullSync(){
    if(!sess||syncing) return; syncing=true; setStatus('Syncing…');
    try{
      const cloud=await rest('chart_profiles?select=*&order=saved_at.asc'), local=loadProfiles(), map={};
      cloud.map(fromRow).forEach(p=>map[cid(p)]=p);
      const localOnly=[]; local.forEach(p=>{ if(!valid(p)) return; const k=cid(p); if(!map[k]){ map[k]=p; localOnly.push(p); } });
      const merged=Object.keys(map).map(k=>map[k]).sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));
      rawSave(merged); refreshProfileSelect();
      if(localOnly.length) await upsert(localOnly);
      setStatus('Synced ✓ '+merged.length+' profile'+(merged.length===1?'':'s'));
    }catch(e){ setStatus('⚠️ Could not sync: '+(e.message||e)+'. Will retry next time.'); }
    syncing=false;
    loadMember();
  }
  // push changes whenever profiles are saved/edited/deleted
  const origSave=saveProfiles;
  saveProfiles=function(list){
    let prev=[]; try{ prev=loadProfiles(); }catch(e){}
    origSave(list);
    if(!sess||syncing) return;
    const pk={},nk={}; prev.forEach(p=>pk[cid(p)]=p); list.forEach(p=>nk[cid(p)]=p);
    const gone=prev.filter(p=>!nk[cid(p)]), add=list.filter(p=>!pk[cid(p)]||JSON.stringify(pk[cid(p)])!==JSON.stringify(p));
    (async()=>{ try{ if(gone.length) await remove(gone); if(add.length) await upsert(add); setStatus('Synced ✓'); }catch(e){ setStatus('⚠️ Offline: will sync next time'); } })();
  };
  async function loadMember(){ try{ const r=await rest('member_access?select=status,plan,expires_at'); member=r&&r[0]||null; }catch(e){} try{ isAdm=(await rest('rpc/is_admin',{method:'POST',body:'{}'}))===true; }catch(e){ isAdm=false; } renderAcct(); }
  // ---- auth actions ----
  async function signIn(email,pw){ const j=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:pw})}); saveSess(normSess(j)); }
  async function signUp(email,pw){ const j=await raw('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:pw})}); if(j&&j.access_token){ saveSess(normSess(j)); return true; } return false; }
  async function recover(email){ await raw('/auth/v1/recover',{method:'POST',body:JSON.stringify({email})}); }
  async function signOut(){ try{ const t=sess&&sess.access_token; if(t) await raw('/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer '+t}}); }catch(e){} saveSess(null); member=null; isAdm=false; status=''; renderAcct(); }
  const friendly=e=>{ const m=String(e.message||e); if(/invalid login/i.test(m)) return 'Wrong email or password.'; if(/already/i.test(m)) return 'This email already has an account. Try signing in.'; if(/password/i.test(m)&&/6|short|weak/i.test(m)) return 'Password must be at least 6 characters.'; if(/rate|too many|seconds/i.test(m)) return 'Too many tries. Please wait a minute and try again.'; if(/Failed to fetch|NetworkError|load failed/i.test(m)) return 'No internet connection. Please try again.'; if(/confirm/i.test(m)) return 'Please confirm your email first (check your inbox).'; return m; };
  // ---- UI ----
  function setStatus(s){ status=s; renderAcct(); }
  function renderAcct(){
    document.querySelectorAll('.cl-acct').forEach(el=>{
      if(sess){
        const plan=member?(member.status==='active'?'⭐ Member':member.status==='blocked'?'⛔ Blocked':'🎁 Free trial'):'';
        el.innerHTML='<div class="cl-row"><span class="cl-ic">☁️</span><div class="cl-tx"><b>'+escapeHtml(sess.email||'Signed in')+'</b><small>'+escapeHtml(status||'Your profiles are saved to your account')+(plan?' · '+plan:'')+'</small></div>'+(isAdm?'<button type="button" class="cl-btn" data-cl="admin">🛠 Admin</button>':'')+'<button type="button" class="cl-btn ghost" data-cl="out">Sign out</button></div>';
      } else {
        el.innerHTML='<div class="cl-row"><span class="cl-ic">☁️</span><div class="cl-tx"><b>Save your charts to the cloud</b><small>Sign in to keep profiles on every device</small></div><button type="button" class="cl-btn" data-cl="in">Sign in</button></div>';
      }
    });
  }
  let modal=null, mode='in';
  function ensureModal(){
    if(modal) return modal;
    modal=document.createElement('div'); modal.className='modal-overlay'; modal.id='clModal';
    modal.innerHTML='<div class="modal-box cl-box"><button type="button" class="sh-x" data-cl="close" aria-label="Close">✕</button><div class="cl-hero">☁️</div><h4 id="clTitle">Welcome back</h4><p class="sh-sub" id="clSub">Sign in to sync your saved charts.</p>'
      +'<div class="cl-tabs"><button type="button" data-cl="tab-in" class="on">Sign in</button><button type="button" data-cl="tab-up">Create account</button></div>'
      +'<form id="clForm" novalidate><label class="pe-l">Email<input type="email" id="clEmail" autocomplete="email" inputmode="email" placeholder="you@example.com"></label>'
      +'<label class="pe-l">Password<input type="password" id="clPw" autocomplete="current-password" placeholder="At least 6 characters"></label>'
      +'<div class="cl-msg" id="clMsg" hidden></div><button type="submit" class="btn btn-primary" id="clGo">Sign in</button></form>'
      +'<button type="button" class="cl-link" data-cl="forgot">Forgot password?</button><p class="cl-priv">🔒 Your charts are private to your account. We never share them.</p></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) close(); const a=e.target.closest('[data-cl]'); if(!a) return; const k=a.dataset.cl; if(k==='close') close(); else if(k==='tab-in') setMode('in'); else if(k==='tab-up') setMode('up'); else if(k==='forgot') doForgot(); });
    $('clForm').addEventListener('submit',e=>{ e.preventDefault(); submit(); });
    return modal;
  }
  function msg(t,ok){ const m=$('clMsg'); m.textContent=t; m.hidden=!t; m.className='cl-msg'+(ok?' ok':''); }
  function setMode(m){ mode=m; ensureModal(); modal.querySelectorAll('.cl-tabs button').forEach(b=>b.classList.toggle('on',(b.dataset.cl==='tab-in')===(m==='in'))); $('clTitle').textContent=m==='in'?'Welcome back':'Create your account'; $('clSub').textContent=m==='in'?'Sign in to sync your saved charts.':'Free to start. Your charts follow you to every device.'; $('clGo').textContent=m==='in'?'Sign in':'Create account'; $('clPw').autocomplete=m==='in'?'current-password':'new-password'; modal.querySelector('[data-cl=forgot]').style.display=m==='in'?'':'none'; msg(''); }
  function open(m){ ensureModal(); setMode(m||'in'); modal.classList.add('show'); setTimeout(()=>$('clEmail').focus(),60); }
  function close(){ if(modal) modal.classList.remove('show'); }
  async function submit(){
    const em=$('clEmail').value.trim(), pw=$('clPw').value; if(!/^\S+@\S+\.\S+$/.test(em)){ msg('Please enter a valid email.'); return; } if(pw.length<6){ msg('Password must be at least 6 characters.'); return; }
    const go=$('clGo'), old=go.textContent; go.disabled=true; go.textContent='Please wait…'; msg('');
    try{
      if(mode==='up'){ const ok=await signUp(em,pw); if(!ok){ msg('Account created! Check your email to confirm, then sign in.',true); go.disabled=false; go.textContent=old; return; } }
      else await signIn(em,pw);
      close(); renderAcct(); fullSync();
    }catch(e){ msg(friendly(e)); }
    go.disabled=false; go.textContent=old;
  }
  async function doForgot(){ const em=$('clEmail').value.trim(); if(!/^\S+@\S+\.\S+$/.test(em)){ msg('Type your email above first, then tap Forgot password.'); return; } try{ await recover(em); msg('Reset link sent. Check your email.',true); }catch(e){ msg(friendly(e)); } }
  document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('.cl-acct [data-cl]'); if(!a) return; const k=a.dataset.cl; if(k==='in') open('in'); else if(k==='out') signOut(); else if(k==='admin') openAdmin(); });

  // ---- admin panel (visible only to admins; the server re-checks every call) ----
  let adm=null, admRows=[], admQ='';
  const eff=m=>m.status==='active'&&m.expires_at&&new Date(m.expires_at)<new Date()?'expired':m.status;
  const fmt=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'No expiry';
  function admRender(){
    const q=admQ.toLowerCase(), rows=admRows.filter(m=>!q||String(m.email||'').toLowerCase().includes(q));
    const c={active:0,trial:0,expired:0,blocked:0}; admRows.forEach(m=>c[eff(m)]=(c[eff(m)]||0)+1);
    $('admStats').innerHTML=[['⭐','Active',c.active],['🎁','Trial',c.trial],['⌛','Expired',c.expired],['⛔','Blocked',c.blocked]].map(x=>'<div><b>'+x[2]+'</b><small>'+x[0]+' '+x[1]+'</small></div>').join('');
    $('admList').innerHTML=rows.length?rows.map(m=>{ const e=eff(m); return '<div class="adm-card" data-u="'+m.user_id+'"><div class="adm-top"><div><b>'+escapeHtml(m.email||'(no email)')+'</b><small>Joined '+fmt(m.created_at)+' · '+m.profile_count+' chart'+(m.profile_count==1?'':'s')+'</small></div><span class="adm-chip '+e+'">'+e+'</span></div>'
      +'<div class="adm-exp">'+(m.status==='active'?'Access until: <b>'+fmt(m.expires_at)+'</b>':'')+(m.plan?' · plan: '+escapeHtml(m.plan):'')+'</div>'
      +'<div class="adm-btns"><button data-a="30">+30 days</button><button data-a="90">+90 days</button><button data-a="365">+1 year</button><button data-a="0">Lifetime</button><button data-a="trial" class="ghost">Set trial</button><button data-a="blocked" class="danger">Block</button></div></div>'; }).join(''):'<p class="sh-sub">No members found.</p>';
  }
  async function admLoad(){ $('admList').innerHTML='<p class="sh-sub">Loading…</p>'; try{ admRows=await rest('rpc/admin_list_members',{method:'POST',body:'{}'}); admRender(); }catch(e){ $('admList').innerHTML='<div class="cl-msg">'+escapeHtml(friendly(e))+'</div>'; } }
  function openAdmin(){
    if(!adm){
      adm=document.createElement('div'); adm.className='modal-overlay'; adm.id='admModal';
      adm.innerHTML='<div class="modal-box adm-box"><button type="button" class="sh-x" id="admX" aria-label="Close">✕</button><h4>🛠 Admin · members</h4><div class="adm-stats" id="admStats"></div><input type="search" id="admSearch" placeholder="Search by email…"><div id="admList"></div><button type="button" class="cl-btn ghost" id="admRefresh">↻ Refresh</button></div>';
      document.body.appendChild(adm);
      adm.addEventListener('click',e=>{ if(e.target===adm||e.target.id==='admX'){ adm.classList.remove('show'); return; } if(e.target.id==='admRefresh'){ admLoad(); return; }
        const b=e.target.closest('[data-a]'); if(!b) return; const card=b.closest('.adm-card'), u=card.dataset.u, a=b.dataset.a, m=admRows.find(x=>x.user_id===u);
        let st='active', days=0, plan=null; if(a==='trial'){ st='trial'; } else if(a==='blocked'){ st='blocked'; } else { days=+a; plan=days===0?'lifetime':days>=365?'yearly':'monthly'; }
        if(st==='blocked' && !confirm('Block '+(m&&m.email)+'?')) return;
        b.disabled=true; rest('rpc/admin_set_access',{method:'POST',body:JSON.stringify({p_user:u,p_status:st,p_plan:plan,p_days:days,p_note:null})}).then(admLoad).catch(er=>{ alert(friendly(er)); b.disabled=false; });
      });
      adm.querySelector('#admSearch').addEventListener('input',e=>{ admQ=e.target.value; admRender(); });
    }
    adm.classList.add('show'); admLoad();
  }
  window.vaxCloudOpen=open;
  // mount account cards: top of the menu profile list + intake page
  function mount(){
    const pc=$('profileCards'); if(pc&&!document.querySelector('#profileCards')?.previousElementSibling?.classList?.contains('cl-acct')){ const d=document.createElement('div'); d.className='cl-acct'; pc.parentNode.insertBefore(d,pc); }
    const ins=document.getElementById('inShare'); if(ins&&!document.querySelector('.cl-acct.intake')){ const d=document.createElement('div'); d.className='cl-acct intake'; ins.parentNode.insertBefore(d,ins); }
    renderAcct();
  }
  mount();
  if(sess){ fullSync(); }
})();
