(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    genType: () => $('input[name="genType"]:checked'),
    model: $('#model'),
    temperature: $('#temperature'),
    apiKey: $('#apiKey'),
    apiEndpoint: $('#apiEndpoint'),
    keywords: $('#keywords'),
    features: $('#features'),
    compTitle: $('#compTitle'),
    compBullets: $('#compBullets'),
    generateBtn: $('#generateBtn'),
    clearBtn: $('#clearBtn'),
    saveConfig: $('#saveConfig'),
    outputTitleWrap: $('#outputTitleWrap'),
    outputTitle: $('#outputTitle'),
    titleLen: $('#titleLen'),
    copyTitle: $('#copyTitle'),
    outputBulletsWrap: $('#outputBulletsWrap'),
    outputBullets: $('#outputBullets'),
    copyBullets: $('#copyBullets'),
    status: $('#status')
  };

  const LS_KEY = 'amazon-listing-tool:v1';
  function getConfig(){
    try{
      const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return {
        model: s.model || 'gpt-4o-mini',
        temperature: (s.temperature ?? 0.7),
        provider: s.provider || 'openai',
        useCustom: !!s.useCustom,
        customEndpoint: s.customEndpoint || '',
        customApiKey: s.customApiKey || ''
      };
    }catch{
      return { model:'gpt-4o-mini', temperature:0.7, provider:'openai', useCustom:false, customEndpoint:'', customApiKey:'' };
    }
  }
  function loadState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(els.apiKey) els.apiKey.value = s.apiKey || '';
      if(els.apiEndpoint) els.apiEndpoint.value = s.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
      if(els.model) els.model.value = s.model || 'gpt-4o-mini';
      if(els.temperature) els.temperature.value = s.temperature ?? 0.7;
      if(els.keywords) els.keywords.value = s.keywords || '';
      if(els.features) els.features.value = s.features || '';
      if(els.compTitle) els.compTitle.value = s.compTitle || '';
      if(els.compBullets) els.compBullets.value = s.compBullets || '';
      if(s.genType){
        const r = $(`input[name="genType"][value="${s.genType}"]`);
        if(r) r.checked = true;
      }
    }catch{}
  }
  function saveState(){
    if(!els.saveConfig.checked) return;
    const existing = (()=>{ try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')}catch{return{}} })();
    // Start from existing, only overwrite fields that are present on this page
    const s = { ...existing };
    if(els.apiKey) s.apiKey = els.apiKey.value.trim();
    if(els.apiEndpoint) s.apiEndpoint = els.apiEndpoint.value.trim();
    if(els.model) s.model = els.model.value.trim();
    if(els.temperature) s.temperature = Number(els.temperature.value);
    if(els.keywords) s.keywords = els.keywords.value;
    if(els.features) s.features = els.features.value;
    if(els.compTitle) s.compTitle = els.compTitle.value;
    if(els.compBullets) s.compBullets = els.compBullets.value;
    if(els.genType()) s.genType = els.genType().value;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }

  function setStatus(msg, kind){
    els.status.textContent = msg || '';
    els.status.style.color = kind === 'error' ? '#ff6b6b' : kind === 'warn' ? '#ffca58' : '#9aa3b2';
  }

  function updateTitleLen(){
    const len = (els.outputTitle.value || '').length;
    els.titleLen.textContent = String(len);
  }

  function buildPrompt(kind){
    const keywords = els.keywords.value.trim();
    const features = els.features.value.trim();
    const compTitle = els.compTitle.value.trim();
    const compBullets = els.compBullets.value.trim();

    const baseRole = 'You are a professional Amazon listing expert. Generate optimized title and/or 5 bullets based on the inputs:';
    const titleReq = [
      '1. <= 200 English characters, aim as close to 200 as possible',
      '2. Put the most important/relevant keywords toward the front',
      '3. No word repetition > 2 times (excluding prepositions)',
      '4. Include scenarios, attributes, benefits and features; keep fluent'
    ].join('\n');
    const bulletReq = [
      '1. Return exactly 5 bullet points.',
      '2. Emphasize key benefits, specs and differentiators',
      '3. Each bullet starts with an ALL-CAPS heading, followed by ":".',
      '4. No square brackets anywhere.',
      '5. No period at the end of each bullet.',
      '6. End the response with no additional commentary.'
    ].join('\n');

    const common = `\n[Keywords]\n${keywords}\n\n[Product Notes]\n${features}\n\n[Competitor Titles]\n${compTitle}\n\n[Competitor Bullets]\n${compBullets}`;

    if(kind === 'title'){
      return `${baseRole}\n[Title Requirements]:\n${titleReq}\n${common}\n\nOutput the English title only.`;
    }
    if(kind === 'bullets'){
      return `${baseRole}\n[Bullet Requirements]\n${bulletReq}\n${common}\n\nOutput the 5-bullet list only.`;
    }
    return `${baseRole}\n[Title Requirements]:\n${titleReq}\n\n[Bullet Requirements]\n${bulletReq}\n${common}\n\nOutput the English title in one line, then the 5-bullet list.`;
  }

  async function callAI(messages){
    const { model, temperature, provider, useCustom, customEndpoint, customApiKey } = getConfig();
    const payload = { model, temperature, messages, provider, useCustom, customEndpoint, customApiKey };
    const headers = { 'Content-Type':'application/json' };
    const res = await fetch('/api/chat', { method:'POST', headers, body: JSON.stringify(payload) });
    if(!res.ok){
      const t = await res.text();
      throw new Error(`API error: ${res.status} ${t}`);
    }
    const data = await res.json();
    const content = data?.content ?? '';
    return String(content).trim();
  }

  function sanitizeBullets(text){
    let t = text.replace(/[\[\]]/g, '');
    const lines = t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const norm = [];
    for(const line of lines){
      let s = line;
      s = s.replace(/^[-*\d\.\)\s]+/, '');
      s = s.replace(/\.$/, '');
      norm.push(s);
      if(norm.length === 5) break;
    }
    return norm.join('\n');
  }

  async function generate(){
    saveState();
    const type = els.genType().value;
    const disable = (v)=>{ els.generateBtn.disabled = v; };
    try{
      setStatus('Generating, please wait…');
      disable(true);
      els.outputTitleWrap.classList.add('hidden');
      els.outputBulletsWrap.classList.add('hidden');

      if(type === 'title' || type === 'both'){
        const prompt = buildPrompt('title');
        const title = await callAI([
          { role:'system', content:'You write Amazon listing copy professionally.' },
          { role:'user', content: prompt }
        ]);
        els.outputTitle.value = title.replace(/\n/g,' ').trim().slice(0, 200);
        els.outputTitleWrap.classList.remove('hidden');
        updateTitleLen();
      }

      if(type === 'bullets' || type === 'both'){
        const prompt = buildPrompt('bullets');
        const bullets = await callAI([
          { role:'system', content:'You write Amazon listing bullet points professionally.' },
          { role:'user', content: prompt }
        ]);
        els.outputBullets.value = sanitizeBullets(bullets);
        els.outputBulletsWrap.classList.remove('hidden');
      }

      setStatus('Done');
    }catch(err){
      console.error(err);
      setStatus(err.message || 'Generation failed', 'error');
    }finally{
      disable(false);
    }
  }

  function wire(){
    loadState();
    const y = document.getElementById('year');
    if(y) y.textContent = String(new Date().getFullYear());

    els.generateBtn.addEventListener('click', generate);
    els.clearBtn.addEventListener('click', () => {
      els.keywords.value = '';
      els.features.value = '';
      els.compTitle.value = '';
      els.compBullets.value = '';
      els.outputTitle.value = '';
      els.outputBullets.value = '';
      updateTitleLen();
      setStatus('Cleared');
      saveState();
    });
    els.copyTitle.addEventListener('click', async () => {
      await navigator.clipboard.writeText(els.outputTitle.value || '');
      setStatus('Title copied');
    });
    els.copyBullets.addEventListener('click', async () => {
      await navigator.clipboard.writeText(els.outputBullets.value || '');
      setStatus('Bullets copied');
    });
    els.outputTitle.addEventListener('input', updateTitleLen);
    $$('input, textarea').forEach(el=>{
      el.addEventListener('change', ()=>{
        if(el === els.outputTitle) return;
        if(el === els.outputBullets) return;
        saveState();
      });
    });
  }

  wire();
})();
