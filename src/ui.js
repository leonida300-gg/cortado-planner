/* ============================================================
   Cortado - views
   ============================================================ */
function h(tag,attrs,...kids){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v==null)continue;if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='value')e.value=v;else if(k==='checked')e.checked=!!v;else e.setAttribute(k,v);}for(const c of kids.flat(2)){if(c==null||c===false)continue;e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c);}return e;}
const VIEWS=[['overview','Overview'],['forecast','Forecast'],['replenish','Replenish'],['launches','Launches & menu'],['bars','Bars'],['accuracy','Accuracy']];
const state={view:'overview',store:3,cat:'',sku:0,daily:false,group:'all',respectShelf:true,edits:{},barSel:null,ovCat:''};
const NOTES={key:'cortado.notes.v1',data:{}};try{NOTES.data=JSON.parse(localStorage.getItem(NOTES.key)||'{}')||{};}catch(e){}
function saveNotes(){try{localStorage.setItem(NOTES.key,JSON.stringify(NOTES.data));}catch(e){}}
const openStores=()=>STORES.filter(s=>s.opened<H);
const catColor=(i)=>['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--sky)','var(--grey-series)','var(--ink-2)'][i%8];
function weekLabel(w){return fmtShort(w*7);}
function pill(text,kind){return h('span',{class:'pill '+(kind||'neutral')},text);}
function kpiTile(label,value,delta,sub,target){const d=delta?h('div',{class:'d '+(delta.good?'good':delta.bad?'bad':'')},delta.text):null;return h('div',{class:'kpi'},h('div',{class:'l'},label),h('div',{class:'v'},value),d,sub?h('div',{class:'d'},sub):null,target?h('span',{class:'tgt'},target):null);}
function deltaPP(cur,prev,lowerIsBetter){if(cur!==cur||prev!==prev)return null;const d=(cur-prev)*100;const txt=(d>0?'+':'')+d.toFixed(1)+' pp vs previous 4 wk';return {text:txt,good:lowerIsBetter?d<-0.2:d>0.2,bad:lowerIsBetter?d>0.2:d<-0.2};}
function select(opts,value,onchange,attrs){const s=h('select',Object.assign({onchange:(e)=>onchange(e.target.value)},attrs||{}));for(const [v,l] of opts){const o=h('option',{value:v},l);if(String(v)===String(value))o.selected=true;s.appendChild(o);}return s;}
function sectionCard(title,hint,...body){return h('div',{class:'card'},h('div',{class:'card-h'},h('h3',null,title),hint?h('span',{class:'hint'},hint):null),...body);}

/* aggregate helpers */
function sumStores(fn){let t=0;for(const st of openStores())t+=fn(st.id);return t;}
function networkWeekly(cat,storeId){ // returns {weeks:[{w,act,lag1,fc,lo,hi}]}
  const stores=storeId!=null&&storeId!=='all'?[STORES[+storeId]]:openStores();const ks=SKUS.filter(k=>!cat||k.cat===cat).map(k=>k.idx);
  const out=[];
  for(let w=weekOf(WEEK0)-14;w<=weekOf(WEEK0)+9;w++){let act=NaN,lag=NaN,fc=NaN,v=0;
    if(w<weekOf(WEEK0)){act=0;let anyLag=false;lag=0;for(const st of stores)for(const k of ks){const y=FC.ys[st.id][k];for(let d=w*7;d<w*7+7;d++){if(y[d]===y[d])act+=y[d];}const p=FC.series[st.id][k].lag1.find(x=>x.week===w);if(p){lag+=p.fc;anyLag=true;}}if(!anyLag)lag=NaN;}
    else{fc=0;for(const st of stores)for(const k of ks){fc+=weekActualPlusFc(st.id,k,w);const r=FC.series[st.id][k];for(let d=Math.max(H,w*7);d<w*7+7;d++){const j=d-H;if(j<HORIZON){const sd=(r.hi[j]-r.daily[j])/1.28;v+=sd*sd;}}}}
    out.push({w,act,lag,fc,lo:fc===fc?Math.max(0,fc-1.28*Math.sqrt(v)):NaN,hi:fc===fc?fc+1.28*Math.sqrt(v):NaN});}
  return out;
}
function eventMarkers(fromDay,toDay){const seen=new Set();const m=[];for(const e of EVENTS){if(e.fromDay>=fromDay&&e.fromDay<=toDay&&!seen.has(e.name)){seen.add(e.name);m.push({x:e.fromDay/7,label:e.name,kind:e.kind==='promo'?'promo':''});}}
  for(const sku of SKUS){if(sku.launch!=null&&sku.launch>=fromDay&&sku.launch<=toDay)m.push({x:sku.launch/7,label:'Launch: '+sku.name.split(' ')[0],kind:'launch'});if(sku.end!=null&&sku.end>=fromDay&&sku.end<=toDay)m.push({x:sku.end/7,label:'Phase-out: '+sku.name.split(' ')[0],kind:'launch'});}
  const se=seasonEndDay(H)+1;if(se>=fromDay&&se<=toDay)m.push({x:se/7,label:MENU_SEASONS.find(x=>x.key===menuSeason(se)).name,kind:'launch'});
  for(const st of STORES){if(st.opened>=fromDay&&st.opened<=toDay)m.push({x:st.opened/7,label:'Opens: '+st.short,kind:'launch'});}
  return m;}

/* ---------------- Overview ---------------- */
function viewOverview(root){
  const k=kpis(),p=kpis({},WEEK0-56,WEEK0-28);
  root.appendChild(h('div',{class:'kpis'},
    kpiTile('Forecast accuracy',fmtPct(1-k.wape,0),deltaPP(k.wape,p.wape,true),'1 minus WAPE, 1 week ahead, bar x SKU, last 4 wk','target 88%+'),
    kpiTile('Forecast bias',fmtSigned(k.bias),null,k.bias>0.01?'forecasting above sales':k.bias<-0.01?'forecasting below sales':'no systematic bias','keep within ±2%'),
    kpiTile('Availability',fmtPct(k.availability,1),deltaPP(k.oosPct,p.oosPct,true),'bar-SKU-days in stock, excl. fresh bakery','target 97%+'),
    kpiTile('Lost sales',fmtEur(k.lostV),null,`${fmtNum(k.lost)} units short across the network, 4 wk`,'from stock-out days'),
    kpiTile('Waste',fmtPct(k.wastePct),deltaPP(k.wastePct,p.wastePct,true),`${fmtEur(k.wasteV)} at cost, perishables, 4 wk`,'target under 5%'),
    kpiTile('Fresh sell-out rate',fmtPct(k.freshSellout,0),deltaPP(k.freshSellout,p.freshSellout,true),`bakery days sold out; waste ${fmtPct(k.freshWaste,0)}`,'healthy band 25 to 35%'),
  ));
  // weekly chart
  const chartCard=h('div',{class:'card'});const ctrl=select([['','All categories'],...CATEGORIES.map(c=>[c,c])],state.ovCat,(v)=>{state.ovCat=v;render();});
  chartCard.appendChild(h('div',{class:'card-h'},h('h3',null,'Network demand, weekly units'),h('div',{class:'row'},h('span',{class:'hint'},'14 weeks sold, 10 weeks ahead'),ctrl)));
  const chartEl=h('div');chartCard.appendChild(chartEl);
  const wk=networkWeekly(state.ovCat,'all');
  const act=wk.filter(x=>x.act===x.act).map(x=>({x:x.w,y:x.act})),lag=wk.filter(x=>x.lag===x.lag).map(x=>({x:x.w,y:x.lag}));
  const fc=wk.filter(x=>x.fc===x.fc).map(x=>({x:x.w,y:x.fc}));const last=act[act.length-1];if(last)fc.unshift({x:last.x,y:last.y});
  const band=wk.filter(x=>x.fc===x.fc).map(x=>({x:x.w,lo:x.lo,hi:x.hi}));if(last)band.unshift({x:last.x,lo:last.y,hi:last.y});
  const markers=eventMarkers(H,H+HORIZON).slice(0,6);
  const draw=()=>lineChart(chartEl,{height:250,shadeFrom:weekOf(WEEK0),xFmt:(x)=>'Week of '+weekLabel(x),xTicks:wk.filter((x,i)=>i%3===0).map(x=>({x:x.w,label:weekLabel(x.w)})),markers,
    series:[{name:'Sold (stock-out corrected)',color:'var(--s1)',pts:act,endDot:true},{name:'Forecast made 1 week ahead',color:'var(--grey-series)',pts:lag,dashed:true},{name:'Forecast',color:'var(--s1)',pts:fc,dashed:true,band}]});
  requestAnimationFrame(draw);
  // category movement
  const mv=h('div',{class:'card'});mv.appendChild(h('div',{class:'card-h'},h('h3',null,'Next 4 weeks vs last 4 weeks'),h('span',{class:'hint'},'forecast units by category')));
  const list=h('div',{class:'mini-bars'});
  const rowsMv=CATEGORIES.map(c=>{let past=0,next=0;for(const st of openStores())for(const sku of SKUS){if(sku.cat!==c)continue;past+=sumRange(FC.ys[st.id][sku.idx],WEEK0-28,WEEK0);next+=fcSum(st.id,sku.idx,H,H+28);}return {c,chg:past>0?next/past-1:NaN,past,next};});
  const mx=Math.max(...rowsMv.map(r=>Math.abs(r.chg)).filter(v=>v===v),0.1);
  for(const r of rowsMv){const bar=h('div',{class:'bar-dv'});const w=Math.min(100,Math.abs(r.chg)/mx*100);const i=h('i',{style:`width:${(w/2).toFixed(1)}%;margin-left:${r.chg<0?(50-w/2).toFixed(1):50}%;background:${r.chg<0?'var(--s2)':'var(--s1)'}`});bar.appendChild(i);list.appendChild(h('div',{class:r.chg>0?'best':''},h('span',{style:'text-align:left'},r.c),bar,h('span',null,fmtSigned(r.chg,0))));}
  mv.appendChild(list);mv.appendChild(h('p',{class:'small muted',style:'margin-top:10px'},'Cold drinks fall with the temperature, retail beans rise into Black Friday and Sinterklaas, syrups turn over with the winter menu. All of it is in the proposals already.'));
  root.appendChild(h('div',{class:'grid g2'},chartCard,mv));
  // exceptions
  const ex=exceptions(14);
  const tbl=h('table',{class:'data'},h('thead',null,h('tr',null,h('th',null,'Bar'),h('th',null,'SKU'),h('th',null,'Issue'),h('th',{class:'num'},'Impact'),h('th',null,'Detail'),h('th',null,''))),
    h('tbody',null,ex.map(e=>h('tr',{class:e.sev===3?'crit':e.sev===2?'warn':''},h('td',null,STORES[e.s].short),h('td',{class:'sku'},h('b',null,SKUS[e.k].name),h('span',null,SKUS[e.k].cat)),h('td',null,pill(e.type,e.sev===3?'crit':e.sev===2?'warn':'info')),h('td',{class:'num'},fmtEur(e.impact)),h('td',{class:'small'},e.detail),
      h('td',null,h('button',{class:'btn sm',onclick:()=>e.action==='replenish'?nav('replenish',{store:e.s}):nav('forecast',{store:e.s,sku:e.k,cat:SKUS[e.k].cat})},e.action==='replenish'?'Open order':'Open forecast'))))));
  root.appendChild(sectionCard('Needs a planner today',`${ex.length} shown, sorted by severity and value at risk`,h('div',{class:'scroll'},tbl)));
  // upcoming
  const items=lifecycleItems().filter(i=>i.day>=H).slice(0,6);
  root.appendChild(sectionCard('Coming up','launches, phase-outs, promotions and openings already built into the forecast',h('div',{class:'timeline'},items.map(i=>h('div',{class:'tl'},h('div',{class:'when'},fmtShort(i.day),h('small',null,DOW_NAMES[dow(i.day)]+', in '+(i.day-H)+' days')),h('div',null,h('div',{class:'row'},pill(i.kind,i.kind==='launch'||i.kind==='new-bar'?'good':i.kind==='phase-out'?'warn':'info'),h('span',{class:'ttl'},i.title)),h('p',{class:'small muted'},i.note))))),h('div',{style:'margin-top:10px'},h('button',{class:'btn sm',onclick:()=>nav('launches')},'All launches and menu changes'))));
}

/* ---------------- Forecast ---------------- */
function viewForecast(root){
  const skuOpts=SKUS.filter(k=>!state.cat||k.cat===state.cat);if(!skuOpts.find(k=>k.idx===state.sku))state.sku=skuOpts[0].idx;
  const sku=SKUS[state.sku];const all=state.store==='all';const stores=all?openStores():[STORES[+state.store]];
  const filters=h('div',{class:'card flat filters'},
    h('label',null,'Bar',select([['all','All bars'],...STORES.map(s=>[s.id,s.short+(s.opened>=H?' (planned)':'')])],state.store,(v)=>{state.store=v==='all'?'all':+v;render();})),
    h('label',null,'Category',select([['','All'],...CATEGORIES.map(c=>[c,c])],state.cat,(v)=>{state.cat=v;render();})),
    h('label',null,'SKU',select(skuOpts.map(k=>[k.idx,k.name]),state.sku,(v)=>{state.sku=+v;render();})),
    h('div',{class:'seg'},h('button',{'aria-pressed':String(!state.daily),onclick:()=>{state.daily=false;render();}},'Weekly'),h('button',{'aria-pressed':String(state.daily),onclick:()=>{state.daily=true;render();}},'Daily')));
  root.appendChild(filters);
  const chartCard=h('div',{class:'card'});const chartEl=h('div');const tableEl=h('div',{style:'margin-top:10px'});tableEl.hidden=true;
  const store0=stores[0];const r0=FC.series[store0.id][sku.idx];
  chartCard.appendChild(h('div',{class:'card-h'},h('h3',null,`${sku.name} · ${all?'all bars':store0.name}`),h('div',{class:'row'},h('span',{class:'hint'},state.daily?'last 28 days and 21 days ahead':'16 weeks sold and 10 weeks ahead'),h('button',{class:'btn sm ghost',onclick:(e)=>{tableEl.hidden=!tableEl.hidden;e.target.textContent=tableEl.hidden?'Show table':'Hide table';}},'Show table'))));
  chartCard.appendChild(chartEl);chartCard.appendChild(tableEl);
  if(!state.daily){
    const rows=[];for(let w=weekOf(WEEK0)-16;w<=weekOf(WEEK0)+9;w++){let act=NaN,lag=NaN,fc=NaN,v=0,raw=NaN;
      if(w<weekOf(WEEK0)){act=0;raw=0;let any=false;lag=0;for(const st of stores){const y=FC.ys[st.id][sku.idx],sl=SER[st.id][sku.idx].sales;for(let d=w*7;d<w*7+7;d++){if(y[d]===y[d]){act+=y[d];raw+=sl[d];}}const p=FC.series[st.id][sku.idx].lag1.find(x=>x.week===w);if(p){lag+=p.fc;any=true;}}if(!any)lag=NaN;}
      else{fc=0;for(const st of stores){fc+=weekActualPlusFc(st.id,sku.idx,w);const r=FC.series[st.id][sku.idx];for(let d=Math.max(H,w*7);d<w*7+7;d++){const j=d-H;if(j<HORIZON){const sd=(r.hi[j]-r.daily[j])/1.28;v+=sd*sd;}}}}
      rows.push({w,act,raw,lag,fc,lo:fc===fc?Math.max(0,fc-1.28*Math.sqrt(v)):NaN,hi:fc===fc?fc+1.28*Math.sqrt(v):NaN});}
    const act=rows.filter(x=>x.act===x.act).map(x=>({x:x.w,y:x.act})),rawp=rows.filter(x=>x.raw===x.raw).map(x=>({x:x.w,y:x.raw})),lag=rows.filter(x=>x.lag===x.lag).map(x=>({x:x.w,y:x.lag}));
    const fc=rows.filter(x=>x.fc===x.fc).map(x=>({x:x.w,y:x.fc}));const last=act[act.length-1];if(last)fc.unshift({x:last.x,y:last.y});
    const band=rows.filter(x=>x.fc===x.fc).map(x=>({x:x.w,lo:x.lo,hi:x.hi}));if(last)band.unshift({x:last.x,lo:last.y,hi:last.y});
    const markers=eventMarkers(WEEK0-16*7,H+HORIZON).filter(m=>{const d=Math.round(m.x*7);const st=stores[0];return all?true:(knownFactors(st,sku,d).m!==1||/Launch|Phase|menu|Opens/.test(m.label));}).slice(0,10);
    requestAnimationFrame(()=>lineChart(chartEl,{height:270,shadeFrom:weekOf(WEEK0),xFmt:(x)=>'Week of '+weekLabel(x),xTicks:rows.filter((x,i)=>i%3===0).map(x=>({x:x.w,label:weekLabel(x.w)})),markers,yFmt:(v)=>compact(v),
      series:[{name:'Sold (stock-out corrected)',color:'var(--s1)',pts:act,endDot:true},{name:'Sold (as recorded)',color:'var(--sky)',pts:rawp},{name:'Forecast made 1 week ahead',color:'var(--grey-series)',pts:lag,dashed:true},{name:'Forecast with 80% range',color:'var(--s1)',pts:fc,dashed:true,band}]}));
    dataTable(tableEl,['Week of','Sold (corrected)','Sold (recorded)','1-wk-ahead forecast','Forecast','Low','High'],rows.map(x=>[weekLabel(x.w),fmtNum(x.act),fmtNum(x.raw),fmtNum(x.lag),fmtNum(x.fc),fmtNum(x.lo),fmtNum(x.hi)]),{compact:true});
  }else{
    const pts=[],rawp=[],fc=[],band=[],oosM=[];for(let d=H-28;d<H+21;d++){let a=NaN,raw=NaN,f=NaN,v=0,anyOos=false;
      if(d<H){a=0;raw=0;for(const st of stores){const y=FC.ys[st.id][sku.idx];if(y[d]===y[d]){a+=y[d];raw+=SER[st.id][sku.idx].sales[d];if(SER[st.id][sku.idx].oos[d])anyOos=true;}}}
      else{f=0;for(const st of stores){f+=fcDay(st.id,sku.idx,d);const r=FC.series[st.id][sku.idx];const sd=(r.hi[d-H]-r.daily[d-H])/1.28;v+=sd*sd;}}
      if(a===a){pts.push({x:d,y:a});rawp.push({x:d,y:raw});if(anyOos&&!all)oosM.push({x:d,label:'',kind:''});}if(f===f){fc.push({x:d,y:f});band.push({x:d,lo:Math.max(0,f-1.28*Math.sqrt(v)),hi:f+1.28*Math.sqrt(v)});}}
    const last=pts[pts.length-1];if(last){fc.unshift({x:last.x,y:last.y});band.unshift({x:last.x,lo:last.y,hi:last.y});}
    requestAnimationFrame(()=>lineChart(chartEl,{height:270,shadeFrom:H,xFmt:(x)=>fmtDate(x),xTicks:pts.concat(fc).filter(p=>dow(p.x)===0).map(p=>({x:p.x,label:fmtShort(p.x)})),markers:oosM.slice(0,20),yFmt:(v)=>compact(v),
      series:[{name:'Sold (stock-out corrected)',color:'var(--s1)',pts,endDot:true},{name:'Sold (as recorded)',color:'var(--sky)',pts:rawp},{name:'Forecast with 80% range',color:'var(--s1)',pts:fc,dashed:true,band}]}));
    chartCard.appendChild(h('p',{class:'small muted',style:'margin-top:6px'},'Dotted vertical lines mark days the bar sold out: recorded sales understate demand there, so the model trains on the corrected line.'));
    dataTable(tableEl,['Day','Sold (corrected)','Sold (recorded)','Forecast','Low','High'],pts.map(p=>[fmtDate(p.x),fmtNum(p.y),fmtNum(rawp.find(q=>q.x===p.x).y),'','','']).concat(fc.slice(1).map(p=>{const b=band.find(q=>q.x===p.x);return [fmtDate(p.x),'','',fmtNum(p.y),fmtNum(b.lo),fmtNum(b.hi)];})),{compact:true});
  }
  // model panel
  const panel=h('div',{class:'stack'});
  if(all){const counts={};for(const st of stores){const m=FC.series[st.id][sku.idx].method;counts[m]=(counts[m]||0)+1;}
    const mb=h('div',{class:'mini-bars'});const mxc=Math.max(...Object.values(counts));for(const [m,c] of Object.entries(counts).sort((a,b)=>b[1]-a[1])){mb.appendChild(h('div',{class:c===mxc?'best':''},h('span',{style:'text-align:left'},METHOD_NAMES[m]),h('i',{style:`width:${(c/mxc*100).toFixed(0)}%`}),h('span',null,c+' bars')));}
    panel.appendChild(sectionCard('Model per bar','each bar x SKU picks the method that backtests best',mb,h('p',{class:'small muted',style:'margin-top:8px'},'Select one bar to see its backtest, drivers and to set an override.')));
  }else{
    const r=r0;const w=r.wape;const names=Object.keys(w).filter(m=>w[m]===w[m]).sort((a,b)=>w[a]-w[b]);
    const mb=h('div',{class:'mini-bars'});const mxw=Math.max(...names.map(m=>w[m]),0.01);
    for(const m of names){mb.appendChild(h('div',{class:m===r.method?'best':''},h('span',{style:'text-align:left'},METHOD_NAMES[m]),h('i',{style:`width:${(w[m]/mxw*100).toFixed(0)}%`}),h('span',null,fmtPct(w[m],0))));}
    const body=[h('p',{class:'small'},h('b',null,'In use: '+METHOD_NAMES[r.method]+'. '),r.method==='ANALOG'?(r.isNew?'The bar has not opened yet, so the forecast is the cluster average scaled by the bar\'s size index, ramping up over 4 weeks.':r.isLaunch?`No history yet: sister SKU ${SKU_BY_ID[sku.analog]?SKU_BY_ID[sku.analog].name:''} x ${Math.round(sku.analogRatio*100)}%, ramping over 3 weeks.`:'Not enough history for a statistical fit; cluster analog in use.'):`Backtest WAPE on two 4-week folds (origins ${fmtShort(FOLDS[0])} and ${fmtShort(FOLDS[1])}); lower is better.`)];
    if(names.length)body.push(mb);
    if(r.analogShare>0&&r.analogShare<1)body.push(h('p',{class:'small muted'},`${Math.round(r.analogShare*100)}% of the forecast still comes from the cluster analog (${r.weeksHist.toFixed(0)} weeks of history); the weight shifts to the bar's own data as it accumulates.`));
    panel.appendChild(sectionCard('Model','',...body));
    // drivers
    const prof=r.prof;const pmax=Math.max(...prof);const dowb=h('div',{class:'dowbar'},prof.map((v,i)=>h('div',{style:`height:${(v/pmax*100).toFixed(0)}%`},h('span',null,DOW_NAMES[i]))));
    const ahead=[];const seen=new Set();for(let d=H;d<H+HORIZON;d++){const kf=knownFactors(store0,sku,d);for(const n of kf.names){if(!seen.has(n)){seen.add(n);const e=EVENTS.find(x=>x.name===n&&d>=x.fromDay&&d<=x.toDay);ahead.push({name:n,day:d,mult:e?eventMult(e,sku):1.15});}}}
    const lc=[];if(sku.window)lc.push(`On the menu in ${sku.window.join(' and ')} only (menu changes ${fmtShort(seasonEndDay(H)+1)}).`);if(sku.launch!=null)lc.push(`Launches ${fmtDate(sku.launch)}.`);if(sku.end!=null)lc.push(`Last selling day ${fmtDate(sku.end)}; ordering stopped.`);if(sku.rotate)lc.push('Rotates monthly: +35% in the first week of each origin, -25% in the last.');
    const wxNext=r.weatherSlope?(()=>{let s=0;for(let d=H;d<H+10;d++)s+=tempForecast(d)-climTemp(d);return s/10;})():0;
    panel.appendChild(sectionCard('Drivers','what the model found in this series',
      h('dl',{class:'kv'},h('dt',null,'Level'),h('dd',null,`${fmtNum(r.level)} ${sku.unit}/day`),h('dt',null,'Trend'),h('dd',null,r.method==='ANALOG'?'–':`${fmtSigned(r.trendWk)} per week`),h('dt',null,'History'),h('dd',null,`${r.weeksHist.toFixed(0)} weeks`),h('dt',null,'Noise'),h('dd',null,`sd ${fmtNum(r.sdDaily)} ${sku.unit}/day`),
        h('dt',null,'Weather'),h('dd',null,r.weatherSlope?`${fmtSigned(r.weatherSlope)} per °C vs normal; next 10 days ${wxNext>=0?'+':''}${wxNext.toFixed(1)} °C`:'no measurable effect')),
      h('div',{class:'eyebrow',style:'margin-top:10px'},'Weekday shape'),dowb,
      h('div',{class:'eyebrow'},'Events ahead'),ahead.length?h('ul',{class:'small',style:'margin:4px 0 0;padding-left:18px'},ahead.map(a=>h('li',null,`${a.name} from ${fmtShort(a.day)}: x${a.mult.toFixed(2)}`))):h('p',{class:'small muted'},'none in the next 10 weeks'),
      lc.length?h('div',{class:'note',style:'margin-top:8px'},lc.join(' ')):null));
  }
  // override
  const ovTargets=all?stores.map(s=>s.id):[store0.id];const cur=getOverride(ovTargets[0],sku.idx);
  const mult=h('input',{type:'number',step:'5',min:'10',max:'300',value:cur?Math.round(cur.mult*100):100,style:'width:80px',id:'ov-mult'});
  const until=select([['',  'whole horizon'],...[2,4,6,8].map(n=>[H+n*7-1,'next '+n+' weeks'])],cur&&cur.untilDay!=null?cur.untilDay:'',()=>{},{id:'ov-until'});
  const note=h('textarea',{rows:2,placeholder:'Why? e.g. "store manager expects road works from 9 Nov" or "Marketing confirmed the Filter Friday push"',id:'ov-note'});if(cur)note.value=cur.note||'';
  const apply=()=>{const m=Math.max(0.1,(+mult.value||100)/100);const u=until.value===''?null:+until.value;for(const sid of ovTargets)setOverride(sid,sku.idx,{mult:m,untilDay:u,note:note.value.trim(),at:ymd(H),author:'Planner'});render();};
  const clear=()=>{for(const sid of ovTargets)setOverride(sid,sku.idx,null);render();};
  const allOv=Object.entries(OVR.data).map(([key,o])=>{const [s,k]=key.split('|').map(Number);return {s,k,o};});
  panel.appendChild(sectionCard('Planner override',all?'applies to every bar for this SKU':'this bar and SKU only',
    cur?h('div',{class:'note'},`Active: x${cur.mult.toFixed(2)} ${cur.untilDay!=null?'until '+fmtDate(cur.untilDay):'for the whole horizon'}${cur.note?' · '+cur.note:''}`):h('p',{class:'small muted'},'The statistical forecast is in use. Use an override when you know something the data does not: store feedback, a local event, a marketing push, a supply issue.'),
    h('div',{class:'row',style:'margin-top:8px'},h('label',{class:'small'},'Forecast at ',mult,' %'),h('label',{class:'small'},'for ',until)),note,
    h('div',{class:'row',style:'margin-top:8px'},h('button',{class:'btn primary',onclick:apply},cur?'Update override':'Apply override'),cur?h('button',{class:'btn ghost',onclick:clear},'Remove'):null),
    allOv.length?h('div',{style:'margin-top:12px'},h('div',{class:'eyebrow'},'All active overrides'),h('div',{class:'ovr-list',style:'margin-top:6px'},allOv.slice(0,12).map(x=>h('div',null,h('b',null,STORES[x.s].short),h('span',null,SKUS[x.k].name),pill('x'+x.o.mult.toFixed(2),'info'),h('span',{class:'muted small'},x.o.note||''),h('button',{class:'btn sm ghost',onclick:()=>{setOverride(x.s,x.k,null);render();}},'remove'))))):null));
  root.appendChild(h('div',{class:'grid g2'},chartCard,panel));
}

/* ---------------- Replenish ---------------- */
function viewReplenish(root){
  if(state.store==='all')state.store=3;const st=STORES[+state.store];
  if(st.opened>=H){root.appendChild(h('div',{class:'card'},h('p',null,`${st.name} opens ${fmtDate(st.opened)}. Its opening order is on the Launches page.`),h('button',{class:'btn sm',style:'margin-top:8px',onclick:()=>nav('launches')},'Go to launches')));}
  const props=storeProposals(st.id,{respectShelf:state.respectShelf});
  const groups={all:'All deliveries',daily:'Fresh bakery, '+fmtDate(nextDelivery('daily',H+1)),chilled:'Chilled, '+fmtDate(nextDelivery('chilled',H+1)),ambient:'Ambient, '+fmtDate(nextDelivery('ambient',H+1))};
  const edits=state.edits[st.id]||(state.edits[st.id]={});
  const rows=props.filter(p=>state.group==='all'||p.sku.group===state.group);
  const qtyOf=(p)=>edits[p.k]!=null?edits[p.k]:p.q;
  let lines=0,units=0,value=0,crit=0,warn=0;for(const p of rows){const q=qtyOf(p);if(q>0){lines++;units+=q;value+=q*p.sku.cost;}if(p.status==='critical')crit++;if(p.status==='warning')warn++;}
  const filters=h('div',{class:'card flat filters'},
    h('label',null,'Bar',select(STORES.map(s=>[s.id,s.short+(s.opened>=H?' (planned)':'')]),st.id,(v)=>{state.store=+v;render();})),
    h('label',null,'Delivery',select(Object.entries(groups),state.group,(v)=>{state.group=v;render();})),
    h('label',{class:'toggle'},h('input',{type:'checkbox',checked:state.respectShelf,onchange:(e)=>{state.respectShelf=e.target.checked;render();}}),'Cap orders at shelf life'),
    h('span',{class:'muted small'},`Order cut-off today 12:00 · ${lines} lines · ${fmtNum(units)} units · ${fmtEur(value)} at cost`),
    h('div',{class:'row',style:'margin-left:auto'},crit?pill(crit+' critical','crit'):null,warn?pill(warn+' to check','warn'):null,
      h('button',{class:'btn sm ghost',onclick:()=>{state.edits[st.id]={};render();}},'Reset edits'),
      h('button',{class:'btn sm primary',onclick:(e)=>{const csv=['bar,sku,name,delivery_group,delivery_date,qty,unit,pack,on_hand,arriving,cycle_demand,min_level,flags'];for(const p of rows){const q=qtyOf(p);if(q>0)csv.push([st.name,p.sku.id,'"'+p.sku.name+'"',p.sku.group,ymd(p.D1),q,p.sku.unit,p.sku.pack,p.onHand,p.onOrder,p.cycle.toFixed(1),p.minLevel.toFixed(1),'"'+p.flags.join('; ')+'"'].join(','));}
        const txt=csv.join('\n');const done=()=>{e.target.textContent='Copied';setTimeout(()=>e.target.textContent='Copy order as CSV',1500);};
        if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>{const ta=h('textarea',{value:txt});document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(x){}ta.remove();done();});}}},'Copy order as CSV')));
  root.appendChild(filters);
  const thead=h('thead',null,h('tr',null,h('th',null,'SKU'),h('th',null,'Delivery'),h('th',{class:'num'},'On hand'),h('th',{class:'num'},'Arriving'),h('th',{class:'num'},'Until delivery'),h('th',{class:'num'},'Cycle demand'),h('th',{class:'num'},'Safety'),h('th',{class:'num'},'Min level'),h('th',{class:'num'},'Proposed'),h('th',{class:'num'},'Order'),h('th',{class:'num'},'Sell-out risk'),h('th',{class:'num'},'Exp. waste'),h('th',null,'Flags')));
  const tbody=h('tbody');
  for(const p of rows){
    const inp=h('input',{class:'qty'+(edits[p.k]!=null?' changed':''),type:'number',min:'0',step:String(p.sku.pack),value:qtyOf(p),id:'q-'+st.id+'-'+p.k,onchange:(e)=>{edits[p.k]=Math.max(0,+e.target.value||0);render();}});
    const tr=h('tr',{class:(p.status==='critical'?'crit':p.status==='warning'?'warn':'')+' click'},
      h('td',{class:'sku'},h('b',null,p.sku.name),h('span',null,`${p.sku.cat} · pack ${p.sku.pack} ${p.sku.unit}${p.sku.shelf<9999?' · '+p.sku.shelf+'d shelf life':''}`)),
      h('td',{class:'small nw'},fmtShort(p.D1)+' to '+fmtShort(p.D2-1)),h('td',{class:'num'},fmtNum(p.onHand)),h('td',{class:'num'},p.onOrder?fmtNum(p.onOrder):'–'),h('td',{class:'num'},p.active?fmtNum(p.bridge):'–'),h('td',{class:'num'},p.active?fmtNum(p.cycle):'–'),h('td',{class:'num'},p.active?fmtNum(p.ss):'–'),h('td',{class:'num'},p.active?fmtNum(p.minLevel):'–'),h('td',{class:'num'},h('b',null,p.q)),h('td',{class:'num'},inp),
      h('td',{class:'num'},p.active?fmtPct(p.oosProb,0):'–'),h('td',{class:'num'},p.sku.shelf<9999?fmtNum(p.expWaste):'–'),h('td',null,h('div',{class:'pills'},p.flags.map(f=>pill(f,f==='stock-out before delivery'?'crit':f==='waste risk'||f==='overstock'||f==='run-down stock'||f==='expiring stock'?'warn':f==='shelf-life cap'?'info':'neutral')))));
    tr.addEventListener('click',(ev)=>{if(ev.target.tagName==='INPUT')return;const next=tr.nextSibling;if(next&&next.classList.contains('detail')){next.remove();return;}
      const det=h('tr',{class:'detail'});const td=h('td',{colspan:'13'});
      const proj=[];let pos=p.onHand;for(let d=H;d<H+14;d++){for(const o of SER[st.id][p.k].onOrder){if(o.arrive===d)pos+=o.qty;}if(d===p.D1)pos+=qtyOf(p);pos-=fcDay(st.id,p.k,d);proj.push(Math.max(0,pos));}
      const expl=p.active?`${p.shortBefore>0?'Short about '+fmtNum(p.shortBefore)+' '+p.sku.unit+' before the delivery: ask the hub for a top-up or transfer from a nearby bar. ':''}${p.expiringUnsold>0?fmtNum(p.expiringUnsold)+' '+p.sku.unit+' on hand expire before the delivery and are not counted. ':''}Demand from today until the delivery lands on ${fmtDate(p.D1)}: ${fmtNum(p.bridge)} ${p.sku.unit}. The delivery must cover ${fmtDate(p.D1)} to ${fmtDate(p.D2-1)}: ${fmtNum(p.cycle)} ${p.sku.unit}, plus safety stock ${fmtNum(p.ss)} for a ${Math.round(p.service*100)}% ${p.sku.shelf<=3?'critical ratio (margin vs cost of a wasted unit)':'service level'}. Position at delivery ${fmtNum(p.stockAtD1)}, so order ${fmtNum(p.raw)} rounded to packs of ${p.sku.pack} = ${p.q}.${p.capped?' Capped at what sells within the shelf life.':''}`:'Not ordered: '+p.flags.join(', ')+'.';
      td.appendChild(h('div',{class:'row'},h('div',{style:'flex:1;min-width:240px'},h('p',{class:'small'},expl)),h('div',null,h('div',{class:'eyebrow'},'Projected stock, 14 days'),sparkline(proj,160,36))));
      det.appendChild(td);tr.after(det);});
    tbody.appendChild(tr);
  }
  root.appendChild(h('div',{class:'card'},h('div',{class:'card-h'},h('h3',null,`${st.name} · order proposal`),h('span',{class:'hint'},'click a line for the calculation and a stock projection')),h('div',{class:'scroll'},h('table',{class:'data'},thead,tbody))));
  root.appendChild(h('div',{class:'note'},'Min level is the stock a bar should hold when a delivery lands (cycle demand plus safety stock). It changes every week with the forecast, which is what makes a fixed minimum per SKU go stale.'));
}

/* ---------------- Launches & menu ---------------- */
function viewLaunches(root){
  const cur=menuSeason(H);
  root.appendChild(h('div',{class:'card'},h('div',{class:'card-h'},h('h3',null,'Menu calendar'),h('span',{class:'hint'},'four menu changes a year; seasonal SKUs are forecast inside their window only')),
    h('div',{class:'row'},MENU_SEASONS.map(s=>{const from=`${s.from[1]} ${MONTHS[s.from[0]]}`,to=`${s.to[1]} ${MONTHS[s.to[0]]}`;return h('div',{class:'kpi',style:'flex:1;min-width:150px'+(s.key===cur?';border-color:var(--accent)':'')},h('div',{class:'l'},s.name),h('div',{class:'d'},`${from} to ${to}`),s.key===cur?pill('now','info'):null);}))));
  const items=lifecycleItems();
  const tl=h('div',{class:'timeline'});
  for(const i of items){
    let details=null;
    if(i.kind==='phase-out'&&i.rows){details=h('details',null,h('summary',null,`Per bar: ${fmtNum(i.leftover)} ${i.sku.unit} expected left over (${fmtEur(i.leftV)} at cost)`),h('div',{class:'scroll',style:'margin-top:6px'},h('table',{class:'data compact'},h('thead',null,h('tr',null,h('th',null,'Bar'),h('th',{class:'num'},'On hand + arriving'),h('th',{class:'num'},'Demand to end'),h('th',{class:'num'},'Left over'),i.rows[0].stopDay!=null?h('th',null,'Last order'):null)),h('tbody',null,i.rows.filter(r=>r.onHand>0||r.dem>0).sort((a,b)=>b.left-a.left).map(r=>h('tr',{class:r.left>0.5?'warn':''},h('td',null,STORES[r.s].short),h('td',{class:'num'},fmtNum(r.onHand)),h('td',{class:'num'},fmtNum(r.dem)),h('td',{class:'num'},fmtNum(r.left)),r.stopDay!=null?h('td',null,fmtShort(r.stopDay)):null))))));}
    if((i.kind==='launch'||i.kind==='rotation')&&i.rows){details=h('details',null,h('summary',null,`Initial allocation per bar: ${fmtNum(i.total)} ${i.sku.unit} in total`),h('div',{class:'scroll',style:'margin-top:6px'},h('table',{class:'data compact'},h('thead',null,h('tr',null,h('th',null,'Bar'),h('th',{class:'num'},'Forecast, first cycle'),h('th',{class:'num'},'Allocation (packs)'))),h('tbody',null,i.rows.sort((a,b)=>b.q-a.q).map(r=>h('tr',null,h('td',null,STORES[r.s].short),h('td',{class:'num'},fmtNum(r.q)),h('td',{class:'num'},r.pack)))))));}
    if(i.kind==='new-bar'&&i.rows){details=h('details',null,h('summary',null,`Opening order: ${i.rows.length} SKUs, ${fmtEur(i.total)} at cost`),h('div',{class:'scroll',style:'margin-top:6px'},h('table',{class:'data compact'},h('thead',null,h('tr',null,h('th',null,'SKU'),h('th',{class:'num'},'Forecast, first cycle'),h('th',{class:'num'},'Opening order'),h('th',{class:'num'},'Value'))),h('tbody',null,i.rows.sort((a,b)=>b.value-a.value).map(r=>h('tr',null,h('td',null,SKUS[r.k].name),h('td',{class:'num'},fmtNum(r.q)),h('td',{class:'num'},r.pack+' '+SKUS[r.k].unit),h('td',{class:'num'},fmtEur(r.value))))))));}
    tl.appendChild(h('div',{class:'tl'},h('div',{class:'when'},fmtShort(i.day),h('small',null,DOW_NAMES[dow(i.day)]+(i.day>=H?', in '+(i.day-H)+' days':', '+(H-i.day)+' days ago'))),h('div',null,h('div',{class:'row'},pill(i.kind,i.kind==='launch'||i.kind==='new-bar'?'good':i.kind==='phase-out'?'warn':i.kind==='promo'?'info':'neutral'),h('span',{class:'ttl'},i.title)),h('p',{class:'small muted',style:'margin-top:4px'},i.note),details)));
  }
  root.appendChild(sectionCard('Launches, phase-outs, promotions, openings','everything the forecast already knows about the next 10 weeks',tl));
}

/* ---------------- Bars ---------------- */
function viewBars(root){
  const sel=state.barSel!=null?state.barSel:3;
  const rowsData=STORES.map(st=>{const k=st.opened<H?storeKpis(st.id):null;let units=0;const spark=[];for(let w=weekOf(WEEK0)-12;w<weekOf(WEEK0);w++){let u=0;for(let kk=0;kk<NK;kk++){const y=FC.ys[st.id][kk];for(let d=w*7;d<w*7+7;d++){if(y[d]===y[d])u+=y[d];}}spark.push(u);}for(let w=weekOf(WEEK0)-4;w<weekOf(WEEK0);w++)units+=spark[spark.length-(weekOf(WEEK0)-w)];
    return {st,k,units:units/4,spark};});
  const tbl=h('table',{class:'data'},h('thead',null,h('tr',null,h('th',null,'Bar'),h('th',null,'Cluster'),h('th',{class:'num'},'History'),h('th',{class:'num'},'Units / wk'),h('th',{class:'num'},'Accuracy'),h('th',{class:'num'},'Availability'),h('th',{class:'num'},'Waste'),h('th',null,'12 weeks'),h('th',null,''))),
    h('tbody',null,rowsData.map(r=>h('tr',{class:'click'+(r.st.id===sel?' sel':''),onclick:()=>{state.barSel=r.st.id;render();}},h('td',null,h('b',null,r.st.short)),h('td',null,CLUSTERS[r.st.cluster].name),h('td',{class:'num'},r.st.opened>=H?'opens '+fmtShort(r.st.opened):r.st.opened<0?'78+ wk':Math.floor((H-r.st.opened)/7)+' wk'),h('td',{class:'num'},r.k?fmtNum(r.units):'–'),h('td',{class:'num'},r.k?fmtPct(1-r.k.wape,0):'–'),h('td',{class:'num'},r.k?fmtPct(r.k.availability,1):'–'),h('td',{class:'num'},r.k?fmtPct(r.k.wastePct):'–'),h('td',null,r.k?sparkline(r.spark,110,24):''),
      h('td',null,r.k&&r.k.wape>0.14?pill('check forecast','warn'):r.st.opened>=H?pill('planned','info'):(H-r.st.opened)<56&&r.st.opened>=0?pill('new bar','info'):null)))));
  const st=STORES[sel];const detail=h('div',{class:'stack'});
  if(st.opened>=H){
    const kcat={};for(const sku of SKUS){const q=fcSum(st.id,sku.idx,st.opened,st.opened+28);kcat[sku.cat]=(kcat[sku.cat]||0)+q;}
    detail.appendChild(sectionCard(st.name,'planned bar: forecast from the cluster analog',
      h('p',{class:'small'},`Opens ${fmtDate(st.opened)}. Until the bar has 8 weeks of its own sales, its forecast is the ${CLUSTERS[st.cluster].name.toLowerCase()} cluster average per SKU, scaled by a size index of ${st.index.toFixed(2)} (1.00 = an average bar), ramping from 65% to 100% over the first 4 weeks.`),
      h('dl',{class:'kv',style:'margin-top:8px'},h('dt',null,'Cluster'),h('dd',null,CLUSTERS[st.cluster].name),h('dt',null,'Size index'),h('dd',null,st.index.toFixed(2)),h('dt',null,'Weekday shape'),h('dd',null,st.profile.map(v=>v.toFixed(2)).join(' · '))),
      h('div',{class:'eyebrow',style:'margin-top:10px'},'First 4 weeks, forecast units by category'),h('div',{class:'mini-bars'},Object.entries(kcat).sort((a,b)=>b[1]-a[1]).map(([c,v],i,arr)=>h('div',null,h('span',{style:'text-align:left'},c),h('i',{style:`width:${(v/arr[0][1]*100).toFixed(0)}%;background:var(--accent)`}),h('span',null,fmtNum(v))))),
      h('div',{style:'margin-top:10px'},h('button',{class:'btn sm',onclick:()=>nav('launches')},'See the opening order'))));
  }else{
    const k=storeKpis(st.id);
    detail.appendChild(h('div',{class:'kpis',style:'grid-template-columns:repeat(3,minmax(0,1fr))'},kpiTile('Accuracy',fmtPct(1-k.wape,0),null,'1 week ahead, 4 wk'),kpiTile('Availability',fmtPct(k.availability,1),null,'excl. fresh bakery'),kpiTile('Waste',fmtPct(k.wastePct),null,fmtEur(k.wasteV)+' at cost, 4 wk')));
    // weekday shape (actual, last 8 weeks, all SKUs by revenue proxy)
    const ds=[0,0,0,0,0,0,0];for(let d=WEEK0-56;d<WEEK0;d++){let t=0;for(let kk=0;kk<NK;kk++){const y=FC.ys[st.id][kk][d];if(y===y)t+=y*SKUS[kk].rev;}ds[dow(d)]+=t;}const dmax=Math.max(...ds);
    const catW=CATEGORIES.map(c=>storeCatWape(st.id,c));
    const mix=CATEGORIES.map(c=>{let t=0;for(const sku of SKUS){if(sku.cat!==c)continue;t+=sumRange(FC.ys[st.id][sku.idx],WEEK0-28,WEEK0)*sku.rev;}return t;});const mixMax=Math.max(...mix);
    const notesTa=h('textarea',{rows:3,placeholder:'Store feedback, e.g. "lead barista: new office opened next door, mornings up since October"'});notesTa.value=NOTES.data[st.id]||'';
    detail.appendChild(h('div',{class:'grid g2d'},
      sectionCard('Weekday shape','sales value, last 8 weeks',h('div',{class:'dowbar'},ds.map((v,i)=>h('div',{style:`height:${(v/dmax*100).toFixed(0)}%`},h('span',null,DOW_NAMES[i])))),h('p',{class:'small muted'},`${CLUSTERS[st.cluster].name} cluster. ${st.flags.satMarket?'Saturday market next door: +15% built into Saturdays.':''}`)),
      sectionCard('Accuracy by category','1 week ahead, last 4 weeks',h('div',{class:'mini-bars'},CATEGORIES.map((c,i)=>h('div',{class:catW[i]===catW[i]&&catW[i]<0.15?'best':''},h('span',{style:'text-align:left'},c),h('i',{style:`width:${catW[i]===catW[i]?Math.min(100,catW[i]/0.6*100).toFixed(0):0}%`}),h('span',null,catW[i]===catW[i]?fmtPct(1-catW[i],0):'–')))))));
    detail.appendChild(h('div',{class:'grid g2d'},
      sectionCard('Sales mix','value by category, last 4 weeks',h('div',{class:'mini-bars'},CATEGORIES.map((c,i)=>h('div',null,h('span',{style:'text-align:left'},c),h('i',{style:`width:${(mix[i]/mixMax*100).toFixed(0)}%;background:var(--accent)`}),h('span',null,fmtEur(mix[i])))))),
      sectionCard('Store feedback','what the numbers cannot see; saved in this browser',notesTa,h('div',{class:'row',style:'margin-top:8px'},h('button',{class:'btn sm primary',onclick:(e)=>{NOTES.data[st.id]=notesTa.value;saveNotes();e.target.textContent='Saved';setTimeout(()=>e.target.textContent='Save note',1200);}},'Save note'),h('button',{class:'btn sm',onclick:()=>nav('replenish',{store:st.id})},'Open order proposal'),h('button',{class:'btn sm',onclick:()=>nav('forecast',{store:st.id})},'Open forecasts')))));
  }
  root.appendChild(h('div',{class:'grid g2b'},sectionCard('Bars','click a bar for its profile',h('div',{class:'scroll'},tbl)),detail));
}

/* ---------------- Accuracy ---------------- */
function viewAccuracy(root){
  const tr=kpiTrend(12);const xt=tr.filter((x,i)=>i%2===0).map(x=>({x:x.week,label:weekLabel(x.week)}));
  const c1=h('div'),c2=h('div');
  const biasTxt=tr.slice(-4).map(x=>fmtSigned(x.bias)).join(' · ');
  const card1=sectionCard('Forecast accuracy, weekly','1 week ahead, bar x SKU, whole network',c1,h('p',{class:'small muted',style:'margin-top:6px'},'Bias, last 4 weeks: '+biasTxt+' (forecast minus sold, over sold).'));
  const card2=sectionCard('Waste and stock-outs, weekly','perishable waste share and out-of-stock days (excl. fresh bakery)',c2);
  requestAnimationFrame(()=>{lineChart(c1,{height:220,xFmt:(x)=>'Week of '+weekLabel(x),xTicks:xt,yFmt:(v)=>Math.round(v*100)+'%',series:[{name:'Accuracy (1 minus WAPE)',color:'var(--s1)',pts:tr.map(x=>({x:x.week,y:1-x.wape})),endDot:true}]});
    lineChart(c2,{height:220,xFmt:(x)=>'Week of '+weekLabel(x),xTicks:xt,yFmt:(v)=>(v*100).toFixed(1)+'%',series:[{name:'Waste share',color:'var(--s2)',pts:tr.map(x=>({x:x.week,y:x.wastePct})),endDot:true},{name:'Out-of-stock days',color:'var(--s5)',pts:tr.map(x=>({x:x.week,y:x.oosPct})),endDot:true}]});});
  root.appendChild(h('div',{class:'grid g2e'},card1,card2));
  // heatmap
  const stores=openStores();const hm=h('div');
  heatmap(hm,{rows:stores.map(s=>s.short),cols:CATEGORIES.map(c=>c.replace(' & alternatives','').replace(' & specials','')),values:stores.map(s=>CATEGORIES.map(c=>storeCatWape(s.id,c))),fmt:(v)=>Math.round(v*100)+'%',lo:0.05,hi:0.45,onClick:(i,j)=>nav('forecast',{store:stores[i].id,cat:CATEGORIES[j]})});
  const sc=h('div');
  const pts=stores.map(s=>{const k=storeKpis(s.id);return {x:k.wastePct,y:k.oosPct,label:s.short,color:'var(--s1)'};});const net=kpis();
  requestAnimationFrame(()=>scatter(sc,{height:300,points:pts,xFmt:(v)=>(v*100).toFixed(0)+'%',yFmt:(v)=>(v*100).toFixed(0)+'%',xLabel:'waste share (perishables)',yLabel:'out-of-stock days',refX:net.wastePct,refY:net.oosPct,onClick:(p)=>{const s=stores.find(x=>x.short===p.label);if(s)nav('bars',{barSel:s.id});}}));
  root.appendChild(h('div',{class:'grid g2'},sectionCard('Error by bar and category','WAPE, 1 week ahead, last 4 weeks; darker is worse; click a cell to open the forecasts',hm),sectionCard('Waste against stock-outs, per bar','last 4 weeks; the lines are the network averages',sc,h('p',{class:'small muted',style:'margin-top:6px'},'Bottom-left is where a bar wants to be. Top-left bars under-order (lead baristas playing safe on waste), bottom-right bars over-order.'))));
  // methods
  const counts={};let total=0;for(const s of stores)for(let k=0;k<NK;k++){const m=FC.series[s.id][k].method;counts[m]=(counts[m]||0)+1;total++;}
  const mb=h('div',{class:'mini-bars'});const mxc=Math.max(...Object.values(counts));for(const [m,c] of Object.entries(counts).sort((a,b)=>b[1]-a[1]))mb.appendChild(h('div',{class:c===mxc?'best':''},h('span',{style:'text-align:left'},METHOD_NAMES[m]),h('i',{style:`width:${(c/mxc*100).toFixed(0)}%`}),h('span',null,Math.round(c/total*100)+'%')));
  root.appendChild(h('div',{class:'grid g2e'},sectionCard('Which model wins where',`${total} bar x SKU series, chosen by backtest`,mb,h('p',{class:'small muted',style:'margin-top:8px'},'Simple methods win on stable items; the annual index wins on seasonal cold drinks and gifting beans; the last-year method wins on items with a strong calendar shape. The blend protects against a single model drifting.')),
    sectionCard('How the numbers are defined','',h('dl',{class:'kv'},h('dt',null,'Accuracy'),h('dd',null,'1 minus WAPE: sum of absolute errors over sum of sales, weekly, per bar and SKU, forecast made one week ahead with the chosen model.'),h('dt',null,'Bias'),h('dd',null,'Sum of (forecast minus sold) over sum of sold. Positive means the forecast runs high.'),h('dt',null,'Availability'),h('dd',null,'Share of bar-SKU-days without lost sales, fresh bakery excluded because those items are meant to sell out some days.'),h('dt',null,'Waste'),h('dd',null,'Expired units over expired plus sold, perishables only.'),h('dt',null,'Fresh sell-out'),h('dd',null,'Share of bakery days that sold out. Around 30% is the cost-optimal rate at a 70% critical ratio.')))));
}

/* ---------------- shell ---------------- */
function render(){
  const main=document.getElementById('view');while(main.firstChild)main.removeChild(main.firstChild);
  for(const b of document.querySelectorAll('.tabs button')){if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  ({overview:viewOverview,forecast:viewForecast,replenish:viewReplenish,launches:viewLaunches,bars:viewBars,accuracy:viewAccuracy})[state.view](main);
  window.scrollTo({top:0});
}
function nav(view,extra){Object.assign(state,extra||{});state.view=view;try{history.replaceState(null,'','#'+view);}catch(e){}render();}
function boot(){
  const tabs=document.querySelector('.tabs .wrap');for(const [v,l] of VIEWS){tabs.appendChild(h('button',{'data-view':v,onclick:()=>nav(v)},l));}
  const hash=(location.hash||'').replace('#','');if(VIEWS.find(v=>v[0]===hash))state.view=hash;
  document.getElementById('ctx-today').textContent=fmtDate(H)+' 2026';
  document.getElementById('ctx-deliv').textContent=`${fmtDate(nextDelivery('daily',H+1))} fresh & chilled · ${fmtDate(nextDelivery('ambient',H+1))} ambient`;
  const main=document.getElementById('view');main.appendChild(h('div',{class:'loading'},'Simulating 18 months of sales for 24 bars and fitting 1,000 forecasts…'));
  setTimeout(()=>{runForecasts();render();},30);
  let rt=null;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(render,200);});
}
document.addEventListener('DOMContentLoaded',boot);
