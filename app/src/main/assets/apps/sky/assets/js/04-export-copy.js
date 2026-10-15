/* =============================================================================
   VEDIC ASTRO SUITE — EXPORT + COPY ADD-ON  (v1.0)
   One self-contained file. Works in BOTH apps, auto-detects which one it is in:
     • Birth Chart app  (has buildFullReportText)  -> srcB
     • 3D Sky app       (has generateExportData)   -> srcA

   HOW TO MERGE (give this to the other chat):
     In the main HTML there are two embedded apps: the text/plain blocks with
     id="srcA" (3D Sky) and id="srcB" (Birth Chart). Near the END of each one,
     right before its closing body tag, add a new inline script element whose
     content is this whole file. Because it sits inside a text/plain wrapper,
     its closing script tag must be written with a backslash before the slash
     (exactly like every other inner script in the file already is).
     Do NOT paste this file anywhere else, and do not edit it - it wraps the
     existing functions at runtime, so the original code stays untouched.

   WHAT IT ADDS
     1. Copy button on EVERY page, EVERY section heading, EVERY table and card
        (reads what is on screen, so any panel/chart added later is covered too).
     2. Floating ⧉ button (bottom-right): copy this page / full report / raw JSON.
     3. Birth Chart export window: ~25 new sections (every panel in the app:
        Reading, Bhava Chalit, Lagnas, Panchanga, Sahams, Fate, Numerology,
        Bhava Bala, Tithi Pravesh, Transits, Relationships ...), a House-by-House
        summary, full Raw JSON, and an optional "instructions for AI" header.
        Extra buttons: Copy JSON / Download .json.
     4. 3D Sky export dropdown: un-capped transits & conjunctions (the old one
        stopped at 75 rows), detailed sky, every tab, and "Everything".
   ============================================================================= */
(function(){
  if (window.__VAX_LOADED) return; window.__VAX_LOADED = true;
  var IS_B = typeof buildFullReportText === 'function';
  var IS_A = !IS_B && typeof generateExportData === 'function';
  if (!IS_A && !IS_B) return;

  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- styles ---------- */
  var st = document.createElement('style');
  st.textContent =
  '.vax-btn{font:600 11px/1 system-ui,-apple-system,sans-serif;color:#D4AF37;background:rgba(212,175,55,.10);border:1px solid rgba(212,175,55,.45);border-radius:999px;padding:6px 11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-left:8px;white-space:nowrap;min-height:26px}' +
  '.vax-btn:active{transform:scale(.95)}.vax-btn.ok{color:#4ADE80;border-color:#4ADE80;background:rgba(74,222,128,.12)}' +
  '.vax-bar{display:flex;justify-content:flex-end;margin:2px 0 6px}.vax-bar .vax-btn{margin:0}' +
  '.vax-corner{position:absolute;top:6px;right:6px;margin:0;z-index:3;opacity:.9}' +
  '#vaxFab{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + var(--vax-b,92px));z-index:90;font-family:system-ui,sans-serif}' +
  '#vaxFab .vax-fb{width:46px;height:46px;border-radius:50%;border:1px solid rgba(212,175,55,.6);background:rgba(11,17,32,.88);color:#D4AF37;font-size:20px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
  '#vaxFab .vax-menu{position:absolute;right:0;bottom:54px;min-width:220px;padding:6px;border-radius:14px;background:#0e1527;border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.6);display:none}' +
  '#vaxFab.open .vax-menu{display:block}' +
  '#vaxFab .vax-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#e8edf7;font:600 13px/1.2 system-ui,sans-serif;padding:11px 12px;border-radius:9px;cursor:pointer}' +
  '#vaxFab .vax-menu button:active{background:rgba(255,255,255,.1)}' +
  '#vaxToast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);transform:translateX(-50%);z-index:300;background:#0e1527;color:#e8edf7;border:1px solid rgba(74,222,128,.6);border-radius:999px;padding:9px 16px;font:600 12.5px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s;max-width:88vw;text-align:center}' +
  '#vaxToast.show{opacity:1}#vaxToast.err{border-color:#ff6b6b}';
  document.head.appendChild(st);

  /* ---------- copy + toast ---------- */
  var tt;
  function toast(msg, err){
    var t = $('#vaxToast'); if (!t){ t = document.createElement('div'); t.id = 'vaxToast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = (err ? 'err ' : '') + 'show'; clearTimeout(tt);
    tt = setTimeout(function(){ t.className = err ? 'err' : ''; }, 2200);
  }
  function fallbackCopy(txt){
    return new Promise(function(res, rej){
      try{
        var ta = document.createElement('textarea'); ta.value = txt;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta);
        ta.focus(); ta.select(); var ok = document.execCommand('copy'); ta.remove();
        ok ? res() : rej(new Error('blocked'));
      }catch(e){ rej(e); }
    });
  }
  function copyText(txt){
    if (navigator.clipboard && window.isSecureContext)
      return navigator.clipboard.writeText(txt).catch(function(){ return fallbackCopy(txt); });
    return fallbackCopy(txt);
  }
  function doCopy(txt, label){
    return copyText(txt).then(function(){ toast('✓ Copied ' + (label || '') + ' (' + txt.length.toLocaleString() + ' chars)'); return true; },
      function(){ toast('Copy blocked by browser — use Download instead', true); return false; });
  }

  /* ---------- DOM -> clean text (works on hidden panels too) ---------- */
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|BUTTON|CANVAS|TEMPLATE|OPTION|IFRAME|SELECT)$/;
  var BLOCK = /^(DIV|P|SECTION|ARTICLE|UL|OL|LI|TR|H[1-6]|HEADER|FOOTER|TABLE|FORM|LABEL|DETAILS|SUMMARY|PRE|BLOCKQUOTE|DL|DT|DD|FIGURE|FIGCAPTION|ASIDE|NAV)$/;
  function walk(n, o){
    if (n.nodeType === 3){ o.push(n.nodeValue.replace(/\s+/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    var t = n.tagName.toUpperCase(), c = n.classList;
    if (SKIP.test(t) || c.contains('vax-btn') || c.contains('vax-bar') || c.contains('vax-skip') || n.hasAttribute('hidden')) return;
    if (t === 'BR'){ o.push('\n'); return; }
    if (t === 'SVG'){
      var tx = $$('text', n).map(function(e){ return e.textContent.trim(); }).filter(Boolean);
      if (tx.length) o.push('\n[Chart graphic: ' + tx.join(' ') + ']\n'); return;
    }
    if (t === 'INPUT'){ if (/text|number|date|time|search/.test(n.type) && n.value) o.push(' [' + n.value + '] '); return; }
    if (t === 'TEXTAREA'){ if (n.value) o.push('\n' + n.value + '\n'); return; }
    if (t === 'TABLE'){
      o.push('\n');
      $$('tr', n).forEach(function(tr){
        var cells = Array.prototype.slice.call(tr.children).map(function(td){
          var b = []; walk(td, b); return b.join('').replace(/\s+/g, ' ').trim();
        });
        if (cells.join('')) o.push(cells.join(' | ') + '\n');
      });
      return;
    }
    if (/^H[1-6]$/.test(t)){ o.push('\n\n## '); Array.prototype.forEach.call(n.childNodes, function(k){ walk(k, o); }); o.push('\n'); return; }
    var blk = BLOCK.test(t);
    o.push(blk ? (t === 'LI' ? '\n- ' : '\n') : ' ');   // inline elements get a space so label/value pairs don't glue together
    Array.prototype.forEach.call(n.childNodes, function(k){ walk(k, o); });
    o.push(blk ? '\n' : ' ');
  }
  function domToText(el){
    if (!el) return '';
    var o = []; walk(el, o);
    return o.join('').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function siblingsText(h, headSel){
    var o = [domToText(h)], n = h.nextElementSibling, any = false;
    while (n && !(n.matches && n.matches(headSel))){ var t = domToText(n); if (t){ o.push(t); any = true; } n = n.nextElementSibling; }
    return any ? o.join('\n') : '';
  }

  /* ---------- context line so an AI knows whose data this is ---------- */
  function ctxLine(){
    try{
      if (IS_B && typeof currentProfileForExport !== 'undefined' && currentProfileForExport){
        var p = currentProfileForExport;
        return 'Chart: ' + p.name + ' | DOB ' + p.dob + ' ' + p.tob + ' | ' + p.place + ' (' + Number(p.lat).toFixed(4) + ', ' + Number(p.lon).toFixed(4) + ') | Sidereal / Lahiri';
      }
    }catch(e){}
    return 'Source: Vedic Astro Suite | Sidereal / Lahiri | exported ' + new Date().toString();
  }
  function withHead(title, body){ return '# ' + title + '\n' + ctxLine() + '\n\n' + body; }

  /* ---------- injected copy buttons ---------- */
  function mk(label, getter, cls, what){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'vax-btn ' + (cls || ''); b.textContent = '⧉ ' + label;
    b.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      var txt = ''; try{ txt = getter(); }catch(err){ txt = ''; }
      if (!txt){ toast('Nothing to copy here yet', true); return; }
      doCopy(txt, what || '').then(function(ok){
        if (!ok) return; var old = b.textContent; b.textContent = '✓ Copied'; b.classList.add('ok');
        setTimeout(function(){ b.textContent = old; b.classList.remove('ok'); }, 1400);
      });
    });
    return b;
  }
  var LIVE = '#skyTable,#transitFeed,#conjunctionFeed,#aspectList,#signAspectList,#houseTable'; // re-rendered every frame in 3D Sky
  var PANEL_SEL = IS_B ? '.app-panel' : '.panel-section';
  var HEAD_SEL = IS_B ? '.section-heading' : '.panel-heading';
  var CARD_SEL = '.pl-card,.vb-card,.mt-card,.tr-card,.rel-pair-card,.varga-card,.ov-chartcard,.tt-panel-card,.lagna-summary-card,.transit-live-card,.rect-panel-card';
  function titleOf(panel){
    if (IS_B && typeof HOME_ITEMS !== 'undefined'){ var r = HOME_ITEMS.filter(function(i){ return i[0] === panel.id; })[0]; if (r) return r[2]; }
    var h = $(HEAD_SEL, panel) || $('h3', panel); return h ? h.textContent.trim() : (panel.id || 'Page');
  }
  function inject(){
    $$(PANEL_SEL).forEach(function(p){
      if (/^(panel-home|panel-export|panel-contact|tab-export)$/.test(p.id)) return;
      if (!p.querySelector(':scope > .vax-bar')){
        var bar = document.createElement('div'); bar.className = 'vax-bar vax-skip';
        bar.appendChild(mk('Copy this page', function(){ return withHead(titleOf(p), domToText(p)); }, '', titleOf(p)));
        p.insertBefore(bar, p.firstChild);
      }
    });
    $$(HEAD_SEL).forEach(function(h){
      if (h.querySelector(':scope > .vax-btn') || h.closest(LIVE)) return;
      if (!siblingsText(h, HEAD_SEL)) return;
      h.appendChild(mk('Copy', function(){ return withHead(h.textContent.replace(/⧉.*$/, '').trim(), siblingsText(h, HEAD_SEL)); }, '', 'section'));
    });
    $$('table').forEach(function(t){
      if (t.closest(LIVE) || t.closest('.vax-skip') || t.rows.length < 3) return;
      var prev = t.previousElementSibling; if (prev && prev.classList.contains('vax-bar')) return;
      var bar = document.createElement('div'); bar.className = 'vax-bar vax-skip';
      bar.appendChild(mk('Copy table', function(){ return domToText(t); }, '', 'table'));
      t.parentNode.insertBefore(bar, t);
    });
    $$(CARD_SEL).forEach(function(c){
      if (c.closest(LIVE) || c.querySelector(':scope > .vax-corner') || c.offsetHeight < 70 || c.textContent.length < 60) return;
      if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
      c.appendChild(mk('Copy', function(){ return domToText(c); }, 'vax-corner', 'card'));
    });
  }
  var injT; function schedule(){ clearTimeout(injT); injT = setTimeout(function(){ try{ inject(); }catch(e){} }, 350); }
  new MutationObserver(function(ms){
    for (var i = 0; i < ms.length; i++){
      var a = ms[i].addedNodes;
      for (var j = 0; j < a.length; j++){
        var n = a[j]; if (n.nodeType === 1 && !(n.classList.contains('vax-bar') || n.classList.contains('vax-btn') || n.id === 'vaxToast' || n.id === 'vaxFab')){ schedule(); return; }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  ['click', 'popstate', 'hashchange', 'resize'].forEach(function(ev){ window.addEventListener(ev, schedule, true); }); // panels are shown/hidden by class, so re-scan when the user navigates

  /* ===========================================================================
     BIRTH CHART APP (B)
     =========================================================================== */
  var XP = []; // [key, title, description, defaultChecked, panelId|null]
  function safeJSON(o){
    var stack = [];
    return JSON.stringify(o, function(k, v){
      if (typeof v === 'function') return undefined;
      if (typeof v === 'number') return isFinite(v) ? Math.round(v * 1e5) / 1e5 : null;
      if (v instanceof Date) return v.toISOString();
      if (v && typeof v === 'object'){
        while (stack.length && stack[stack.length - 1] !== this) stack.pop();
        if (stack.indexOf(v) > -1) return '[circular]';
        stack.push(v);
      }
      return v;
    });
  }
  function housesText(chart){
    var asc = chart.ascendant.sign, L = [], occ = {}, asp = {}, rules = {};
    PLANET_LIST.forEach(function(n){
      var p = chart.planets[n];
      (occ[p.house] = occ[p.house] || []).push(n + (p.retrograde ? ' (R)' : ''));
      (p.aspectsHouses || []).forEach(function(h){ (asp[h] = asp[h] || []).push(n); });
    });
    for (var i = 1; i <= 12; i++){
      var si = (asc + i - 1) % 12, s = SIGNS[si], lp = chart.planets[s.lord];
      (rules[s.lord] = rules[s.lord] || []).push('H' + i);
      L.push('H' + i + ' ' + s.name + ' (' + s.sk + ')  | Lord ' + s.lord + (lp ? ' sits in H' + lp.house + ' ' + SIGNS[lp.sign].name : '') +
        '  | Occupants: ' + (occ[i] ? occ[i].join(', ') : 'empty') + '  | Aspected by: ' + (asp[i] ? asp[i].join(', ') : 'none'));
    }
    L.push('', 'House rulership: ' + Object.keys(rules).map(function(k){ return k + ' rules ' + rules[k].join('+'); }).join(' ; '));
    return L.join('\n');
  }
  var AI_PROMPT = 'INSTRUCTIONS FOR THE AI READING THIS:\n' +
    'Below is a complete Vedic (Jyotish) birth-chart export from the Vedic Astro Suite: sidereal zodiac, Lahiri ayanamsa, whole-sign houses, Vimshottari dasha. ' +
    'Treat every number as computed, authoritative data - do not recalculate positions. Please: (1) summarise the chart (lagna, Moon sign, nakshatra, strongest and weakest planets); ' +
    '(2) analyse houses, yogas, Shadbala, Ashtakavarga and the divisional charts; (3) explain the running Mahadasha/Antardasha and the upcoming transits; ' +
    '(4) give practical, balanced guidance and flag any uncertainty. Ask me if you need more detail.';
  function buildXP(chart, profile, S){
    var out = [];
    if (S.xp_houses === true){ out.push('=' .repeat(78) + '\n' + 'HOUSE-BY-HOUSE SUMMARY (D1, whole-sign)\n' + '='.repeat(78) + '\n\n' + housesText(chart)); }
    XP.forEach(function(x){
      if (!x[4] || S[x[0]] !== true) return;
      var el = document.getElementById(x[4]), t = domToText(el);
      if (t.length < 30) return;
      out.push('='.repeat(78) + '\n' + x[1].toUpperCase() + '  (as shown in the app)\n' + '='.repeat(78) + '\n\n' + t);
    });
    if (S.xp_json === true){ out.push('='.repeat(78) + '\nRAW DATA (JSON) - every computed value for this chart\n' + '='.repeat(78) + '\n\n' + safeJSON({ profile: profile, chart: chart })); }
    return out.length ? '\n\n' + out.join('\n\n\n') + '\n\n' : '';
  }
  function installB(){
    var COVERED = { 'panel-overview': 1, 'panel-planets': 1, 'panel-yogas': 1, 'panel-shadbala': 1, 'panel-ashtakavarga': 1, 'panel-dasha': 1, 'panel-transit': 1 };
    var SKIPP = { 'panel-export': 1, 'panel-contact': 1, 'panel-rectification': 1, 'panel-vargatimeline': 1, 'panel-transittimer': 1 };
    XP.push(['xp_aiPrompt', 'Instructions for AI (top of file)', 'Short prompt so any AI knows how to read and analyse this export', true, null]);
    XP.push(['xp_houses', 'House-by-House Summary', 'Each house: sign, lord and where it sits, occupants, aspects received, rulerships', true, null]);
    HOME_ITEMS.forEach(function(i){
      if (SKIPP[i[0]]) return;
      XP.push(['xp_' + i[0], i[2] + ' (full page)', i[3] + (COVERED[i[0]] ? ' - already in the report as data; tick to add the readings too' : ''), !COVERED[i[0]], i[0]]);
    });
    XP.push(['xp_json', 'Raw Data (JSON)', 'Entire computed chart object - best for AI or other software', true, null]);

    var prev = window.buildFullReportText;
    window.buildFullReportText = function(chart, profile, sections){
      var t = prev.apply(this, arguments), S = sections || {}, extra = '';
      try{ extra = buildXP(chart, profile, S); }catch(e){ extra = '\n\n[Extra sections failed: ' + e.message + ']\n\n'; }
      if (extra){
        var e1 = t.lastIndexOf('END OF REPORT'), cut = e1 > -1 ? t.lastIndexOf('='.repeat(78), e1) : -1;
        t = cut > -1 ? t.slice(0, cut) + extra.trim() + '\n\n' + t.slice(cut) : t + extra;
      }
      if (S.xp_aiPrompt === true) t = AI_PROMPT + '\n\n' + t;
      return t;
    };

    var body = $('#exportModal .export-modal-body');
    if (body && !$('#vaxExtra')){
      var w = document.createElement('div'); w.id = 'vaxExtra';
      w.innerHTML = '<div class="export-check-label" style="margin:20px 0 4px;color:var(--gold-bright)">More data — everything in the app</div>' +
        XP.map(function(x){
          return '<label class="export-check-item"><input type="checkbox" class="export-section-check" data-section="' + x[0] + '"' + (x[3] ? ' checked' : '') + '>' +
            '<div><div class="export-check-label">' + x[1] + '</div><div class="export-check-desc">' + x[2] + '</div></div></label>';
        }).join('');
      var anchor = $('.export-location-section', body); body.insertBefore(w, anchor || null);
      $$('input', w).forEach(function(cb){
        cb.addEventListener('change', function(){
          if (typeof updateExportCountLabel === 'function') updateExportCountLabel();
          $('#exportSelectAll').checked = $$('.export-section-check').every(function(c){ return c.checked; });
        });
      });
      if (typeof updateExportCountLabel === 'function') updateExportCountLabel();
      var acts = $('#exportModal .export-actions');
      if (acts){
        var b1 = document.createElement('button'); b1.id = 'vaxJsonCopy'; b1.type = 'button'; b1.className = 'export-download-btn export-ghost'; b1.textContent = '{ } Copy JSON';
        var b2 = document.createElement('button'); b2.id = 'vaxJsonDl'; b2.type = 'button'; b2.className = 'export-download-btn export-ghost'; b2.textContent = '⬇ .json';
        b1.onclick = function(){ var j = rawJSON(); if (j) doCopy(j, 'JSON'); };
        b2.onclick = function(){
          var j = rawJSON(); if (!j) return;
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' }));
          a.download = ((currentProfileForExport.name || 'chart').replace(/[^a-z0-9]/gi, '_')) + '_vedic_chart.json';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
        };
        acts.insertBefore(b2, acts.firstChild); acts.insertBefore(b1, acts.firstChild);
      }
    }
    try{ designModal(); }catch(e){ console.error('[VAX] modal design', e); }
  }
  /* ===========================================================================
     EXPORT WINDOW REDESIGN (Birth Chart app) - restyles + regroups the existing
     modal. All original ids/handlers are kept, so nothing in the app breaks.
     =========================================================================== */
  var VX_CSS = `
#exportModal.export-modal-overlay{background:radial-gradient(90% 60% at 50% 110%,rgba(66,135,126,.22),transparent 70%),rgba(3,6,13,.74);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);padding:20px}
#exportModal.show{animation:xwFade .3s ease both}
#exportModal .export-modal-box{max-width:660px;max-height:90vh;border-radius:28px;background:linear-gradient(180deg,#151b2e 0%,#0c111f 100%);border:1px solid rgba(255,255,255,.09);box-shadow:0 34px 90px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.07);overflow:hidden}
#exportModal.show .export-modal-box{animation:xwSheet .55s cubic-bezier(.2,.9,.25,1) both}
#exportModal .export-modal-close{top:16px;right:16px;width:36px;height:36px;z-index:8;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);transition:.25s}
#exportModal .export-modal-close:hover{transform:rotate(90deg);background:rgba(255,255,255,.14)}
#exportModal .export-modal-header{padding:22px 24px 14px;border:0;background:linear-gradient(135deg,rgba(212,175,55,.14),rgba(66,135,126,.09) 55%,transparent)}
.xw-grab{display:none;width:42px;height:4px;border-radius:4px;background:rgba(255,255,255,.22);margin:-8px auto 14px}
.xw-head{display:flex;gap:14px;align-items:center;padding-right:44px}
.xw-logo{flex:0 0 auto;width:50px;height:50px;border-radius:16px;display:grid;place-items:center;font-size:25px;font-weight:700;background:linear-gradient(135deg,#f6dc85,#b98a1e);color:#1a1405;box-shadow:0 8px 26px rgba(212,175,55,.38)}
#exportModal .export-modal-title{font-size:23px;margin:0 0 6px;letter-spacing:.02em}
.xw-sub{display:flex;flex-wrap:wrap;gap:6px}
.xw-sub span{font:500 11.5px/1 system-ui,sans-serif;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.07);color:#c3cde0;border:1px solid rgba(255,255,255,.06)}
.xw-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 20px 12px}
.xw-stat{padding:10px 12px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
.xw-stat b{display:block;font:700 19px/1.1 var(--font-display,serif);color:#fff;font-variant-numeric:tabular-nums;transition:opacity .2s}
.xw-stat b.calc{opacity:.35}.xw-stat span{display:block;margin-top:4px;font:600 10px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted,#8a97b3)}
.xw-bar2{height:3px;margin:0 20px 2px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;flex-shrink:0}
.xw-bar2 i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#42877E,#D4AF37);transition:width .6s cubic-bezier(.2,.9,.3,1)}
#exportModal .export-modal-body{padding:0 18px 10px;scroll-behavior:smooth;overscroll-behavior:contain}
.xw-tools{position:sticky;top:0;z-index:6;padding:12px 2px 10px;background:linear-gradient(#0f1525 78%,rgba(15,21,37,0))}
.xw-presets{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.xw-presets::-webkit-scrollbar{display:none}
.xw-chip{flex:0 0 auto;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.045);color:#e8edf7;font:600 12.5px/1 system-ui,sans-serif;cursor:pointer;transition:.22s;white-space:nowrap}
.xw-chip:hover{border-color:rgba(212,175,55,.6)}.xw-chip:active{transform:scale(.94)}
.xw-chip.on{background:linear-gradient(135deg,rgba(212,175,55,.28),rgba(66,135,126,.22));border-color:#D4AF37;color:#fff;box-shadow:0 0 0 3px rgba(212,175,55,.12)}
.xw-search{position:relative;margin-top:10px}.xw-search::before{content:"⌕";position:absolute;left:14px;top:50%;transform:translateY(-52%);font-size:18px;color:#8a97b3}
.xw-search input{width:100%;padding:12px 14px 12px 40px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font:500 14px system-ui,sans-serif;transition:.25s}
.xw-search input:focus{outline:none;border-color:#D4AF37;box-shadow:0 0 0 4px rgba(212,175,55,.14);background:rgba(255,255,255,.07)}
#exportModal .export-select-all-row,#exportModal .export-modal-footer .export-count-label{display:none}
.xw-group{margin:10px 0;border-radius:20px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065);overflow:hidden;animation:xwIn .55s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(var(--i,0)*70ms)}
.xw-gh{display:flex;align-items:center;gap:12px;padding:13px 14px;cursor:pointer;user-select:none;-webkit-user-select:none}
.xw-gi{flex:0 0 auto;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font-size:18px;background:rgba(212,175,55,.13)}
.xw-gt{flex:1;min-width:0}.xw-gt b{display:block;font:600 14.5px/1.2 system-ui,sans-serif;color:#fff}.xw-gt small{display:block;margin-top:3px;font:500 12px/1 system-ui,sans-serif;color:var(--text-muted,#8a97b3)}
.xw-gall{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#D4AF37;font:700 11.5px/1 system-ui,sans-serif;cursor:pointer;transition:.2s}.xw-gall:active{transform:scale(.93)}
.xw-chev{width:18px;height:18px;flex:0 0 auto;color:#8a97b3;transition:transform .35s cubic-bezier(.2,.9,.3,1)}.xw-group:not(.open) .xw-chev{transform:rotate(-90deg)}
.xw-gbw{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.2,.9,.3,1)}.xw-group.open .xw-gbw{grid-template-rows:1fr}
.xw-gb{overflow:hidden;min-height:0;padding:0 10px}.xw-group.open .xw-gb{padding-bottom:10px}
#exportModal .export-check-item{display:flex;align-items:center;gap:12px;padding:11px 12px;margin:6px 0 0;border-radius:15px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:background .25s,border-color .25s,transform .15s}
#exportModal .export-check-item:active{transform:scale(.985)}
#exportModal .export-check-item.on{background:linear-gradient(135deg,rgba(212,175,55,.15),rgba(66,135,126,.11));border-color:rgba(212,175,55,.5)}
#exportModal .export-check-item .xw-ic{order:0;flex:0 0 auto;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;background:rgba(255,255,255,.06);transition:.25s}
#exportModal .export-check-item.on .xw-ic{background:rgba(212,175,55,.2)}
#exportModal .export-check-item>div{order:1;flex:1;min-width:0}
#exportModal .export-check-label{font:600 14px/1.25 system-ui,sans-serif;color:#fff}
#exportModal .export-check-desc{margin-top:3px;font:400 12px/1.4 system-ui,sans-serif;color:var(--text-muted,#8a97b3);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#exportModal .export-check-item input[type=checkbox]{order:2;flex:0 0 auto;margin:0;width:44px;height:26px;border-radius:26px;border:0;background:rgba(255,255,255,.14);position:relative;transition:background .3s;-webkit-appearance:none;appearance:none}
#exportModal .export-check-item input[type=checkbox]::after,#exportModal .export-check-item input[type=checkbox]:checked::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border:0;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transform:translateX(0);transition:transform .35s cubic-bezier(.3,1.5,.5,1)}
#exportModal .export-check-item input[type=checkbox]:checked{background:linear-gradient(135deg,#42877E,#D4AF37);border:0}
#exportModal .export-check-item input[type=checkbox]:checked::after{transform:translateX(18px)}
#exportModal .export-vargas-group{margin:6px 0 0;border-radius:15px}
#exportModal .export-varga-chip{border-radius:999px;transition:.2s}
#exportModal .export-location-section{margin:0;padding:0;border:0}
#exportModal #exportLocationPicker{margin:8px 2px 0!important}
#exportModal .export-dev{margin:14px 0 6px;padding:12px 14px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}
#exportModal .export-modal-footer{display:block;padding:14px 18px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(12,17,31,.7),#0c111f)}
#exportModal .export-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}
.xw-bi{font-size:17px;line-height:1}
.xw-prim{grid-column:1/-1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;border-radius:17px;border:0;cursor:pointer;background:linear-gradient(135deg,#f6dc85,#d4af37 55%,#b98a1e);color:#1a1405;font:700 15.5px/1 var(--font-display,serif);letter-spacing:.02em;box-shadow:0 12px 30px rgba(212,175,55,.35);transition:transform .15s,box-shadow .25s,background .4s}
.xw-prim::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.6) 50%,transparent 70%);transform:translateX(-130%);animation:xwShine 4.5s ease-in-out infinite;pointer-events:none}
.xw-prim:active{transform:scale(.975)}.xw-prim.xw-done{background:linear-gradient(135deg,#7bf0b4,#2fb67a);box-shadow:0 12px 30px rgba(74,222,128,.35)}
.xw-sec{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 6px;border-radius:15px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#e8edf7;font:600 11.5px/1.1 system-ui,sans-serif;cursor:pointer;transition:.2s}
.xw-sec:hover{border-color:rgba(212,175,55,.6);background:rgba(212,175,55,.08)}.xw-sec:active{transform:scale(.95)}
.xw-prim:disabled,.xw-sec:disabled{opacity:.4;pointer-events:none}
@keyframes xwFade{from{opacity:0}to{opacity:1}}
@keyframes xwSheet{from{opacity:0;transform:translateY(46px) scale(.97)}to{opacity:1;transform:none}}
@keyframes xwIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes xwShine{0%,60%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
@media (max-width:640px){
 #exportModal.export-modal-overlay{padding:0;align-items:flex-end}
 #exportModal .export-modal-box{max-width:100%;max-height:94vh;border-radius:28px 28px 0 0;border-bottom:0}
 #exportModal.show .export-modal-box{animation-name:xwSheetM}.xw-grab{display:block}
 #exportModal .export-modal-header{padding:14px 20px 12px}
}
@keyframes xwSheetM{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){#exportModal *,#exportModal{animation:none!important;transition:none!important}}`;

  function designModal(){
    var modal = $('#exportModal'); if (!modal || modal.dataset.vx) return; modal.dataset.vx = '1';
    var s = document.createElement('style'); s.textContent = VX_CSS; document.head.appendChild(s);
    var box = $('.export-modal-box', modal), head = $('.export-modal-header', modal), body = $('.export-modal-body', modal), dev = $('.export-dev', modal);
    var closeB = $('#exportModalClose');
    head.innerHTML = '<div class="xw-grab"></div><div class="xw-head"><div class="xw-logo">⇪</div><div style="min-width:0"><div class="export-modal-title">Export &amp; Share</div><div class="xw-sub" id="xwSub"></div></div></div>';
    if (closeB) head.appendChild(closeB);
    var stats = document.createElement('div'); stats.className = 'xw-stats';
    stats.innerHTML = '<div class="xw-stat"><b id="xwN">0</b><span>Sections</span></div><div class="xw-stat"><b id="xwChars" class="calc">–</b><span>Characters</span></div><div class="xw-stat"><b id="xwTok" class="calc">–</b><span>≈ AI tokens</span></div>';
    var prog = document.createElement('div'); prog.className = 'xw-bar2'; prog.innerHTML = '<i id="xwBar"></i>';
    head.after(stats); stats.after(prog);

    var ICON = { birthDetails: '🪪', chartSummary: '✨', karakas: '👑', planetTable: '🪐', aspects: '🔭', yogas: '🧿', shadbala: '💪', ashtakavarga: '🔢', dasha: '⏳', vargas: '🗂️', rawLongitudes: '📐', liveSky: '🌍', xp_aiPrompt: '🤖', xp_houses: '🏠', xp_json: '{ }' };
    if (typeof HOME_ITEMS !== 'undefined') HOME_ITEMS.forEach(function(i){ ICON['xp_' + i[0]] = i[1]; });
    var GROUPS = [
      ['Foundation', '🪐', ['birthDetails', 'chartSummary', 'karakas', 'planetTable', 'aspects', 'xp_houses', 'rawLongitudes', 'xp_panel-overview', 'xp_panel-planets', 'xp_panel-lagnas', 'xp_panel-bhava']],
      ['Strength & Yogas', '⚖️', ['yogas', 'shadbala', 'ashtakavarga', 'xp_panel-yogas', 'xp_panel-shadbala', 'xp_panel-bhavabala', 'xp_panel-ashtakavarga']],
      ['Time & Cycles', '⏳', ['dasha', 'xp_panel-dasha', 'xp_panel-panchanga', 'xp_panel-vbday', 'xp_panel-active', 'xp_panel-tithi', 'xp_panel-transits', 'xp_panel-transit', 'liveSky']],
      ['Divisional Charts', '🗂️', ['vargas', 'xp_panel-vargas', 'xp_panel-sandhi']],
      ['Readings & Insights', '📖', ['xp_panel-reading', 'xp_panel-fate', 'xp_panel-sahams', 'xp_panel-numerology', 'xp_panel-relationships', 'xp_panel-match']],
      ['Data & AI', '🤖', ['xp_aiPrompt', 'xp_json']]];
    var byKey = {}, used = {};
    $$('.export-section-check', modal).forEach(function(c){
      byKey[c.dataset.section] = c.closest('label');
      var lab = c.closest('label'), ic = document.createElement('span'); ic.className = 'xw-ic'; ic.textContent = ICON[c.dataset.section] || '•'; lab.insertBefore(ic, lab.firstChild);
    });
    var xwExtra = $('#vaxExtra'), tools = document.createElement('div'); tools.className = 'xw-tools';
    var PRESETS = [
      ['✨ Everything', function(){ return true; }],
      ['🤖 AI-ready', ['birthDetails', 'chartSummary', 'karakas', 'planetTable', 'aspects', 'yogas', 'shadbala', 'ashtakavarga', 'dasha', 'vargas', 'xp_houses', 'xp_aiPrompt']],
      ['⚡ Essentials', ['birthDetails', 'chartSummary', 'planetTable', 'xp_houses', 'yogas', 'dasha']],
      ['📖 Readings', ['chartSummary', 'xp_panel-reading', 'xp_panel-fate', 'xp_panel-sahams', 'xp_panel-numerology', 'xp_panel-relationships']],
      ['⌫ Clear', []]];
    tools.innerHTML = '<div class="xw-presets"></div><div class="xw-search"><input id="xwSearch" type="search" placeholder="Search sections…" autocomplete="off"></div>';
    body.insertBefore(tools, body.firstChild);
    var presetEl = $('.xw-presets', tools);
    PRESETS.forEach(function(p){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'xw-chip'; b.textContent = p[0]; b._set = p[1];
      b.addEventListener('click', function(){
        $$('.export-section-check', modal).forEach(function(c){
          var want = typeof p[1] === 'function' ? true : p[1].indexOf(c.dataset.section) > -1;
          if (c.checked !== want){ c.checked = want; c.dispatchEvent(new Event('change', { bubbles: true })); }
        });
      });
      presetEl.appendChild(b);
    });

    var CHEV = '<svg class="xw-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    var groupEls = [], anchor = tools.nextSibling;
    function mkGroup(name, icon, keys, idx){
      keys = keys.filter(function(k){ return byKey[k] && !used[k]; }); if (!keys.length) return;
      var g = document.createElement('section'); g.className = 'xw-group' + (idx < 2 ? ' open' : ''); g.style.setProperty('--i', idx);
      g.innerHTML = '<div class="xw-gh"><div class="xw-gi">' + icon + '</div><div class="xw-gt"><b>' + name + '</b><small></small></div><button type="button" class="xw-gall">All</button>' + CHEV + '</div><div class="xw-gbw"><div class="xw-gb"></div></div>';
      var gb = $('.xw-gb', g);
      keys.forEach(function(k){
        used[k] = 1;
        if (k === 'liveSky'){ gb.appendChild(byKey[k].closest('.export-location-section')); return; }
        gb.appendChild(byKey[k]); if (k === 'vargas' && $('#exportVargasGroup')) gb.appendChild($('#exportVargasGroup'));
      });
      $('.xw-gh', g).addEventListener('click', function(e){ if (e.target.closest('.xw-gall')) return; g.classList.toggle('open'); });
      $('.xw-gall', g).addEventListener('click', function(){
        var cbs = $$('.export-section-check', g), all = cbs.every(function(c){ return c.checked; });
        cbs.forEach(function(c){ if (c.checked === all){ c.checked = !all; c.dispatchEvent(new Event('change', { bubbles: true })); } });
      });
      body.insertBefore(g, anchor); groupEls.push(g);
    }
    GROUPS.forEach(function(g, i){ mkGroup(g[0], g[1], g[2], i); });
    var rest = Object.keys(byKey).filter(function(k){ return !used[k]; }); if (rest.length) mkGroup('More', '➕', rest, groupEls.length);
    if (xwExtra) xwExtra.remove();
    body.appendChild(dev);

    var copyB = $('#exportCopyBtn'), dlB = $('#exportDownloadBtn'), jc = $('#vaxJsonCopy'), jd = $('#vaxJsonDl'), acts = $('.export-actions', modal);
    function btn(el, cls, ico, txt){ if (!el) return; el.className = cls; el.innerHTML = '<span class="xw-bi">' + ico + '</span><span>' + txt + '</span>'; acts.appendChild(el); }
    btn(copyB, 'xw-prim', '📋', 'Copy for AI'); btn(dlB, 'xw-sec', '⬇', 'Download .txt'); btn(jc, 'xw-sec', '{ }', 'Copy JSON'); btn(jd, 'xw-sec', '🗎', '.json file');

    /* live counters + size estimate */
    var estT, shown = {};
    function tween(id, to, fmt){
      var el = document.getElementById(id), from = shown[id] || 0, t0 = performance.now(); shown[id] = to;
      (function f(t){ var k = Math.min(1, (t - t0) / 500), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); })(t0);
    }
    var K = function(n){ return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n); };
    function estimate(){
      $('#xwChars').classList.add('calc'); $('#xwTok').classList.add('calc'); clearTimeout(estT);
      estT = setTimeout(function(){
        var n = 0;
        try{
          var S = {}; $$('.export-section-check', modal).forEach(function(c){ S[c.dataset.section] = c.checked; });
          S.vargaKeys = Array.from(exportSelectedVargas); S.liveSky = false;
          if (Object.keys(S).some(function(k){ return S[k] === true; })) n = buildFullReportText(currentChartForModal, currentProfileForExport, S, null).length;
        }catch(e){}
        tween('xwChars', n, K); tween('xwTok', Math.round(n / 4), K);
        $('#xwChars').classList.remove('calc'); $('#xwTok').classList.remove('calc');
      }, 380);
    }
    function refresh(){
      var all = $$('.export-section-check', modal), on = all.filter(function(c){ return c.checked; }).length;
      all.forEach(function(c){ c.closest('label').classList.toggle('on', c.checked); });
      groupEls.forEach(function(g){
        var cs = $$('.export-section-check', g), n = cs.filter(function(c){ return c.checked; }).length;
        $('small', g).textContent = n + ' of ' + cs.length + ' selected'; $('.xw-gall', g).textContent = n === cs.length ? 'None' : 'All';
      });
      tween('xwN', on, String); $('#xwBar').style.width = (all.length ? on / all.length * 100 : 0) + '%';
      var cur = all.filter(function(c){ return c.checked; }).map(function(c){ return c.dataset.section; });
      $$('.xw-chip', tools).forEach(function(b){
        var want = typeof b._set === 'function' ? all.map(function(c){ return c.dataset.section; }) : b._set;
        b.classList.toggle('on', want.length === cur.length && want.every(function(k){ return cur.indexOf(k) > -1; }));
      });
      [copyB, dlB, jc, jd].forEach(function(b){ if (b) b.disabled = !on && b !== jc && b !== jd; });
      estimate();
    }
    modal.addEventListener('change', function(e){ if (e.target.classList.contains('export-section-check')) refresh(); });

    /* search */
    $('#xwSearch').addEventListener('input', function(){
      var q = this.value.trim().toLowerCase();
      groupEls.forEach(function(g){
        var any = false;
        $$('.export-check-item', g).forEach(function(l){ var m = !q || l.textContent.toLowerCase().indexOf(q) > -1; l.style.display = m ? '' : 'none'; if (m) any = true; });
        g.style.display = any ? '' : 'none'; if (q && any) g.classList.add('open');
      });
    });

    /* header identity + refresh each time it opens */
    new MutationObserver(function(){
      if (!modal.classList.contains('show')) return;
      var p = typeof currentProfileForExport !== 'undefined' ? currentProfileForExport : null;
      if (p) $('#xwSub').innerHTML = [p.name, p.dob + ' · ' + String(p.tob || '').slice(0, 5), p.place].filter(Boolean).map(function(x){ return '<span>' + String(x).replace(/</g, '&lt;') + '</span>'; }).join('');
      body.scrollTop = 0; refresh();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });

    /* feedback on the main button (the app reports results through the hidden hint) */
    var hint = $('#exportModalHint'), bt;
    if (hint) new MutationObserver(function(){
      var t = hint.textContent || '';
      if (/Copied/.test(t) && copyB){
        copyB.classList.add('xw-done'); copyB.lastChild.textContent = 'Copied!'; copyB.firstChild.textContent = '✓';
        clearTimeout(bt); bt = setTimeout(function(){ copyB.classList.remove('xw-done'); copyB.lastChild.textContent = 'Copy for AI'; copyB.firstChild.textContent = '📋'; }, 1900);
      } else if (/downloaded/.test(t)) toast('✓ File downloaded');
      else if (/Could not/.test(t)) toast('Copy blocked - use Download instead', true);
    }).observe(hint, { childList: true, characterData: true, subtree: true });

    /* Esc closes, swipe the header down to close on phones */
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && modal.classList.contains('show') && typeof closeExportModal === 'function') closeExportModal(); });
    var y0 = null, dy = 0;
    head.addEventListener('touchstart', function(e){ y0 = e.touches[0].clientY; dy = 0; box.style.transition = 'none'; }, { passive: true });
    head.addEventListener('touchmove', function(e){ if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); box.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    head.addEventListener('touchend', function(){
      if (y0 === null) return; box.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1)';
      if (dy > 110 && typeof closeExportModal === 'function'){ closeExportModal(); }
      box.style.transform = ''; y0 = null; setTimeout(function(){ box.style.transition = ''; }, 320);
    });
    refresh();
  }

  function haveChart(){ return typeof currentChartForModal !== 'undefined' && currentChartForModal && typeof currentProfileForExport !== 'undefined' && currentProfileForExport; }
  function rawJSON(){
    if (!haveChart()){ toast('Generate a chart first', true); return ''; }
    return safeJSON({ profile: currentProfileForExport, chart: currentChartForModal });
  }
  function fullReport(){
    if (!haveChart()){ toast('Generate a chart first', true); return ''; }
    var S = { vargaKeys: Object.keys(VARGAS) };
    ['birthDetails', 'chartSummary', 'karakas', 'planetTable', 'aspects', 'yogas', 'shadbala', 'ashtakavarga', 'dasha', 'vargas', 'rawLongitudes'].forEach(function(k){ S[k] = true; });
    XP.forEach(function(x){ S[x[0]] = true; });
    return buildFullReportText(currentChartForModal, currentProfileForExport, S, null);
  }

  /* ===========================================================================
     3D SKY APP (A)
     =========================================================================== */
  var TABS = [['sky', 'Sky Positions tab'], ['transits', 'Transits tab'], ['conjunctions', 'Meetings tab'], ['degree', 'Degree Finder tab'],
              ['natal', 'Natal tab'], ['returns', 'Returns tab'], ['retro', 'Retrograde Planner tab'], ['chart', 'Chart & Houses tab'], ['view', 'View settings tab']];
  function aSkyFull(){
    var snap = snapshotPositions(currentJD), ctx = getChartContext(), ls = getSignIndex(ctx.lagnaLon), t = '--- DETAILED SKY ---\nDate: ' + formatFullDate(snap.jd) + '\nChart basis: ' + ctx.label + '\n\n';
    PLANET_LIST.forEach(function(n){
      var lon = snap.sidereal[n], si = getSignIndex(lon), d = degreeInSign(lon), nk = NAKSHATRAS[getNakshatraIndex(lon)], dg = '', rx = '';
      try{ var r = dignityOf(n, si); dg = typeof r === 'string' ? r : (r && (r.label || r.status || r.name)) || ''; }catch(e){}
      try{ rx = isRetrograde(n, currentJD) ? 'RETROGRADE' : 'direct'; }catch(e){}
      t += n + ': ' + SIGNS[si].name + ' ' + d.deg + '°' + d.min + "'" + d.sec + '" | abs ' + lon.toFixed(6) + '° | ' + nk + ' pada ' + (getPadaIndex(lon) + 1) +
        ' | house ' + (((si - ls + 12) % 12) + 1) + ' from lagna' + (dg ? ' | ' + dg : '') + (rx ? ' | ' + rx : '') + ' | speed ' + planetSpeed(n, currentJD).toFixed(4) + '°/d\n';
    });
    return t + '\n';
  }
  function aTransitsAll(){
    var r = getTransitResults(currentJD), t = '--- ALL TRANSITS / SIGN INGRESSES (' + r.length + ' events, no filter, no limit) ---\n\n';
    r.forEach(function(e){ t += formatHudDate(e.jd) + ': ' + e.planet + ' enters ' + SIGNS[e.toSign].name + ' (from ' + SIGNS[e.fromSign].name + ')\n'; });
    return t + '\n';
  }
  function aConjAll(){
    var r = getConjResults(currentJD), t = '--- ALL CONJUNCTIONS incl. Moon (' + r.length + ' events, no limit) ---\n\n';
    r.forEach(function(e){ t += formatHudDate(e.jd) + ': ' + e.planetA + ' & ' + e.planetB + ' in ' + SIGNS[e.sign].name + '\n'; });
    return t + '\n';
  }
  function aTab(id, label){
    var el = document.getElementById('tab-' + id), tx = domToText(el);
    return tx.length > 25 ? '--- ' + label.toUpperCase() + ' (as shown) ---\n' + tx + '\n\n' : '';
  }
  function aText(type){
    var t = '';
    try{
      if (type === 'vax_skyfull') t = aSkyFull();
      else if (type === 'vax_transits_all') t = aTransitsAll();
      else if (type === 'vax_conj_all') t = aConjAll();
      else if (type === 'vax_everything'){
        t = prevGen('all') + '\n\n' + aSkyFull() + aTransitsAll() + aConjAll();
        TABS.forEach(function(x){ if (x[0] !== 'sky' && x[0] !== 'transits' && x[0] !== 'conjunctions') t += aTab(x[0], x[1]); });
      } else if (type.indexOf('vax_tab_') === 0){
        var id = type.slice(8), f = TABS.filter(function(x){ return x[0] === id; })[0]; t = aTab(id, f ? f[1] : id);
        if (!t) t = 'Nothing to export on this tab yet - open it and run it first.';
      }
    }catch(e){ t = 'Export failed: ' + e.message; }
    return t.trim();
  }
  var prevGen = null;
  function installA(){
    prevGen = window.generateExportData;
    window.generateExportData = function(type){ return String(type).indexOf('vax_') === 0 ? aText(type) : prevGen(type); };
    var sel = $('#exportSelect');
    if (sel && !$('#vaxOpts')){
      var g = document.createElement('optgroup'); g.id = 'vaxOpts'; g.label = 'More data (new)';
      var opts = [['vax_everything', 'EVERYTHING (all of the above + all tabs)'], ['vax_skyfull', 'Detailed Sky (dignity, retro, houses, abs. degrees)'],
        ['vax_transits_all', 'ALL Transits - no limit, all planets'], ['vax_conj_all', 'ALL Conjunctions incl. Moon - no limit']]
        .concat(TABS.map(function(x){ return ['vax_tab_' + x[0], x[1] + ' (as shown)']; }));
      opts.forEach(function(o){ var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; g.appendChild(op); });
      sel.appendChild(g);
    }
  }

  /* ---------- floating copy button ---------- */
  function activePanel(){ return $((IS_B ? '.app-panel.active' : '.panel-section.active')); }
  function installFab(){
    if ($('#vaxFab')) return;
    var w = document.createElement('div'); w.id = 'vaxFab'; w.className = 'vax-skip';
    w.innerHTML = '<div class="vax-menu"></div><button type="button" class="vax-fb" aria-label="Copy data">⧉</button>';
    var menu = $('.vax-menu', w);
    var items = IS_B ? [
      ['Copy this page', function(){ var p = activePanel(); return p && p.id !== 'panel-home' ? withHead(titleOf(p), domToText(p)) : fullReport(); }],
      ['Copy FULL report (everything)', fullReport],
      ['Copy raw JSON', rawJSON],
      ['Open export options…', function(){ if (typeof openExportModal === 'function') openExportModal(); return ''; }]
    ] : [
      ['Copy this tab', function(){ var p = activePanel(); return p ? withHead(titleOf(p), domToText(p)) : ''; }],
      ['Copy EVERYTHING', function(){ return window.generateExportData('vax_everything'); }],
      ['Copy detailed sky', function(){ return aSkyFull(); }]
    ];
    items.forEach(function(it){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = it[0];
      b.addEventListener('click', function(){ w.classList.remove('open'); var tx = it[1](); if (tx) doCopy(tx, ''); });
      menu.appendChild(b);
    });
    $('.vax-fb', w).addEventListener('click', function(e){ e.stopPropagation(); w.classList.toggle('open'); });
    document.addEventListener('click', function(){ w.classList.remove('open'); });
    document.body.appendChild(w);
  }

  function boot(){
    try{ IS_B ? installB() : installA(); }catch(e){ console.error('[VAX]', e); }
    try{ installFab(); inject(); }catch(e){ console.error('[VAX]', e); }
  }
  window.VAX = { domToText: domToText, copyText: copyText, fullReport: IS_B ? fullReport : null, rawJSON: IS_B ? rawJSON : null, aText: IS_A ? aText : null };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
