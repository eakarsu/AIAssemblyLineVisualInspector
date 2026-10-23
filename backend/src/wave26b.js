'use strict';
function csvCell(v){ if(v===null||v===undefined) return ''; const s=typeof v==='object'?JSON.stringify(v):String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function toCsv(rows, cols){ const c=cols||(rows[0]?Object.keys(rows[0]):[]); if(!c.length) return ''; return [c.join(','), ...rows.map(r=>c.map(k=>csvCell(r[k])).join(','))].join('\n'); }
function providerConfigured(env){ env=env||process.env; return Boolean((env.OPENROUTER_API_KEY&&env.OPENROUTER_API_KEY!=='your_openrouter_api_key_here'&&env.OPENROUTER_API_KEY!=='your_openrouter_key_here')||env.OPENAI_API_KEY); }
const num=v=>{ const n=Number(v); return Number.isFinite(n)?n:0; };
function formatValue(v){ if(v===false) return 'false'; if(v===0) return '0'; if(v===''||v===null||v===undefined) return '(empty)'; if(typeof v==='object') return JSON.stringify(v); return String(v); }

function defectSummary(rows){ rows=rows||[]; const by={}; rows.forEach(r=>{by[r.status||'unknown']=(by[r.status||'unknown']||0)+1;}); const defects=rows.reduce((s,r)=>s+num(r.defect_count),0);
 return {feature:'defect-summary',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Inspections reviewed',value:rows.length},{label:'By status',value:by},{label:'Pass count',value:by['pass']||0},{label:'Fail count',value:by['fail']||0},{label:'Total defects',value:defects},{label:'Has failures',value:(by['fail']||0)>0}]}; }
function confidenceOverview(rows){ rows=rows||[]; const vals=rows.map(r=>num(r.confidence_score)); const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100:0; const low=rows.filter(r=>num(r.confidence_score)<50).length;
 return {feature:'confidence-overview',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Inspections reviewed',value:rows.length},{label:'Average confidence',value:avg},{label:'Low-confidence count (<50)',value:low},{label:'Zero-confidence count',value:rows.filter(r=>num(r.confidence_score)===0).length}]}; }
function inspectionRisk(rows){ rows=rows||[]; const fails=rows.filter(r=>r.status==='fail').length; const ratio=rows.length?Math.round(fails/rows.length*100):0;
 return {feature:'inspection-risk',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Inspections reviewed',value:rows.length},{label:'Fail count',value:fails},{label:'Fail rate %',value:ratio},{label:'Needs attention',value:fails>0}]}; }
module.exports={toCsv,providerConfigured,formatValue,defectSummary,confidenceOverview,inspectionRisk,FEATURES:{'defect-summary':defectSummary,'confidence-overview':confidenceOverview,'inspection-risk':inspectionRisk}};
