function copyDevNumber(btn){
  const n = '+918919748693', done = ()=>{ const t = btn.textContent; btn.textContent = '✓ Copied!'; btn.classList.add('ok'); setTimeout(()=>{ btn.textContent = t; btn.classList.remove('ok'); }, 1600); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(n).then(done, done);
  else { const a = document.createElement('textarea'); a.value = n; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); }catch(e){} a.remove(); done(); }
}
