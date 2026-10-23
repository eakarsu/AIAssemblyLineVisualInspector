(function (global) {
  function formatValue(v){ if(v===false) return 'false'; if(v===0) return '0'; if(v===''||v===null||v===undefined) return '(empty)'; if(typeof v==='object') return JSON.stringify(v); return String(v); }
  function renderWave26bAIResult(result, el){ if(!result||!el) return; el.innerHTML=''; var p=document.createElement('p'); p.textContent=(result.aiGenerated?'AI generated':'Deterministic fallback (no provider configured)')+' \u2014 '+(result.source||''); el.appendChild(p); (result.sections||[]).forEach(function(s){ var d=document.createElement('div'); var b=document.createElement('strong'); b.textContent=s.label; var val=document.createElement('div'); val.textContent=formatValue(s.value); d.appendChild(b); d.appendChild(val); el.appendChild(d); }); }
  global.Wave26bAIResult = { formatValue: formatValue, render: renderWave26bAIResult };
})(typeof window !== 'undefined' ? window : globalThis);
