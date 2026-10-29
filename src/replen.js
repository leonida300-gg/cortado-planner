/* ============================================================
   Cortado - replenishment proposals, KPIs, exceptions, launches
   ============================================================ */
const SERVICE_Z=(p)=>zOf(p);
const LEAD=1; // hub lead time (order today, delivered on the next delivery day from tomorrow)

/* stock position now = close of yesterday (day H-1) */
function onHandNow(s,k){const v=SER[s][k].stock[H-1];return v===v?v:0;}
function onOrderNow(s,k){return SER[s][k].onOrder.reduce((a,o)=>a+o.qty,0);}

/* newsvendor critical ratio for short shelf life: margin / (margin + cost of an unsold unit) */
function criticalRatio(sku){const price=sku.rev,cost=sku.cost;const under=Math.max(0.2,price-cost),over=cost;return under/(under+over);}

function proposal(s,k,opts={}){
  const store=STORES[s],sku=SKUS[k];const r=FC.series[s][k];
  const T=H;const D1=nextDelivery(sku.group,T+1);const D2=nextDelivery(sku.group,D1+1);
  const onHand=onHandNow(s,k),onOrder=onOrderNow(s,k);
  const active=(sku.launch==null||D1>=sku.launch)&&(sku.end==null||D1<=sku.end)&&(!sku.window||sku.window.includes(menuSeason(D1)));
  const bridge=fcSum(s,k,T,D1);                     // demand before the delivery lands
  const cycle=fcSum(s,k,D1,D2);                      // demand the delivery must cover
  // position when the delivery arrives: units still within shelf life at D1, after demand until then eats the expiring units first (FEFO)
  let usable=0,expiring=0;
  for(const l of SER[s][k].lots){if(l.exp>=D1)usable+=l.qty;else expiring+=l.qty;}
  for(const o of SER[s][k].onOrder){if(o.arrive<D1){if(o.arrive+sku.shelf-1>=D1)usable+=o.qty;else expiring+=o.qty;}}
  const stockAtD1=Math.max(0,usable-Math.max(0,bridge-expiring));
  const fresh=sku.shelf<=3;
  const service=fresh?criticalRatio(sku):sku.service;
  const z=SERVICE_Z(service);
  const protect=D2-T;
  const sdCycle=r.sdDaily*Math.sqrt(Math.max(1,D2-D1));
  const ss=fresh?z*sdCycle:z*r.sdDaily*Math.sqrt(protect);
  const need=cycle+ss;
  const flags=[];
  if(!active){
    if(sku.end!=null&&D1>sku.end)flags.push('phased out');else if(sku.launch!=null&&D1<sku.launch)flags.push('not launched yet');else flags.push('off menu');
    const left=Math.max(0,onHand+onOrder-fcSum(s,k,T,T+HORIZON));
    if(left>0&&sku.shelf<9999)flags.push('run-down stock');
    return {s,k,sku,store,D1,D2,onHand,onOrder,bridge:0,cycle:0,stockAtD1:onHand+onOrder,ss:0,service,z,q:0,raw:0,flags,capped:false,runOut:null,oosProb:0,expLost:0,expWaste:left,minLevel:0,value:0,status:left>0?'warning':'ok',active,sellable:0};
  }
  let raw=Math.max(0,need-Math.max(0,stockAtD1));
  // perishables round to the nearest pack (a pack too many is waste); ambient rounds up
  let q;
  if(sku.shelf<=10&&raw>0){ // short shelf life: pack-aware newsvendor, the pack multiple with the lowest expected cost of lost sales plus waste
    const lo=Math.floor(raw/sku.pack)*sku.pack,hi=lo+sku.pack;const under=Math.max(0.2,sku.rev-sku.cost),over=sku.cost;
    const cost=(Q)=>{const zq=sdCycle>0?(Math.max(0,stockAtD1)+Q-cycle)/sdCycle:(Q>=cycle?4:-4);return under*sdCycle*normLoss(zq)+over*sdCycle*normLoss(-zq);};
    q=cost(hi)<cost(lo)?hi:lo;
  }else q=Math.ceil(raw/sku.pack)*sku.pack;
  // shelf-life cap: never deliver more than sells before it expires (demand within the shelf life, plus the same safety margin)
  const sellable=fcSum(s,k,D1,Math.min(D1+sku.shelf,D1+HORIZON))-Math.max(0,stockAtD1)+ss;
  let capped=false;
  if(sku.shelf<9999&&q>0&&opts.respectShelf!==false&&q>sellable+0.5*sku.pack){
    q=Math.max(0,Math.floor((sellable+0.5*sku.pack)/sku.pack)*sku.pack);capped=true;flags.push('shelf-life cap');
  }
  // projected stock-out before the delivery lands
  let runOut=null,shortBefore=0;let pos=onHand;for(let d=T;d<D1;d++){for(const o of SER[s][k].onOrder){if(o.arrive===d)pos+=o.qty;}pos-=fcDay(s,k,d);if(pos<-0.5&&runOut==null)runOut=d;}
  shortBefore=Math.max(0,-pos);
  if(runOut!=null&&sku.group!=='daily')flags.push('stock-out before delivery');  // daily bakery items are expected to sell out some days
  const expiringUnsold=Math.max(0,expiring-bridge);
  if(expiringUnsold>=Math.max(1,0.25*sku.pack)&&sku.shelf<9999)flags.push('expiring stock');
  // position after the delivery vs the cycle: risk measures
  const posAfter=Math.max(0,stockAtD1)+q;
  const zz=sdCycle>0?(posAfter-cycle)/sdCycle:(posAfter>=cycle?4:-4);
  const oosProb=1-Phi(zz);
  const expLost=sdCycle*normLoss(zz);
  // expected waste: perishable units still on hand when they expire
  let expWaste=0;
  if(sku.shelf<9999){
    if(sku.shelf<=D2-D1)expWaste=sdCycle*normLoss(-zz);                             // sells within one cycle or not at all
    else expWaste=Math.max(0,posAfter-fcSum(s,k,D1,Math.min(D1+sku.shelf,D1+HORIZON)));  // what will not sell within the shelf life
  }
  const target=need; // the service-level (or newsvendor) target position
  if(sku.shelf<9999&&posAfter>target+0.5*sku.pack&&expWaste>0.1*Math.max(1,cycle))flags.push('waste risk');
  if(q===0&&stockAtD1>cycle*3&&sku.shelf<9999&&sku.shelf<60)flags.push('overstock');
  const minLevel=cycle+ss;   // level the bar should hold at each delivery (the "minimum level" per bar)
  const value=q*sku.cost;
  const status=flags.includes('stock-out before delivery')?'critical':(flags.includes('waste risk')||flags.includes('overstock')||capped)?'warning':'ok';
  return {s,k,sku,store,D1,D2,onHand,onOrder,bridge,cycle,stockAtD1,ss,service,z,q,raw,flags,capped,runOut,shortBefore,expiringUnsold,oosProb,expLost,expWaste,minLevel,value,status,active,sellable};
}
function storeProposals(s,opts){const out=[];for(let k=0;k<NK;k++)out.push(proposal(s,k,opts));return out;}

/* ---- KPIs over the last 4 complete weeks ---- */
function kpis(filter={},a=WEEK0-28,b=WEEK0){
  let wasteU=0,wasteV=0,soldPerish=0,oosDays=0,days=0,lost=0,lostV=0,rev=0,freshDays=0,freshOut=0,freshWasteU=0,freshSold=0;
  let lag1Num=0,lag1Den=0,lag1Bias=0;
  for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=H)continue;if(filter.store!=null&&filter.store!==s)continue;
    for(let k=0;k<NK;k++){const sku=SKUS[k];if(filter.cat&&sku.cat!==filter.cat)continue;const ser=SER[s][k];const r=FC.series[s][k];const fresh=sku.group==='daily';
      for(let d=a;d<b;d++){const v=ser.sales[d];if(v!==v)continue;rev+=v*sku.rev;
        if(sku.shelf<9999){wasteU+=ser.waste[d];wasteV+=ser.waste[d]*sku.cost;soldPerish+=v;}
        if(fresh){freshDays++;freshWasteU+=ser.waste[d];freshSold+=v;if(ser.oos[d])freshOut++;}else{days++;if(ser.oos[d])oosDays++;}
        if(ser.oos[d]){const l=Math.max(0,ser.demand[d]-v);lost+=l;lostV+=l*sku.rev;}}
      for(const p of r.lag1){if(p.week*7>=a&&p.week*7<b){lag1Num+=Math.abs(p.fc-p.act);lag1Den+=p.act;lag1Bias+=p.fc-p.act;}}}}
  return {wape:lag1Den?lag1Num/lag1Den:NaN,bias:lag1Den?lag1Bias/lag1Den:NaN,wastePct:soldPerish+wasteU?wasteU/(soldPerish+wasteU):NaN,wasteV,
    oosPct:days?oosDays/days:NaN,lostV,lost,rev,availability:days?1-oosDays/days:NaN,
    freshSellout:freshDays?freshOut/freshDays:NaN,freshWaste:freshSold+freshWasteU?freshWasteU/(freshSold+freshWasteU):NaN};
}
function kpiTrend(weeks=12){ // weekly network series for the trend charts
  const out=[];for(let w=weekOf(WEEK0)-weeks;w<weekOf(WEEK0);w++){const a=w*7,b=a+7;let num=0,den=0,bias=0,wasteU=0,sold=0,oos=0,days=0;
    for(let s=0;s<NS;s++){if(STORES[s].opened>=H)continue;for(let k=0;k<NK;k++){const sku=SKUS[k];const ser=SER[s][k];const r=FC.series[s][k];
      for(let d=a;d<b;d++){const v=ser.sales[d];if(v!==v)continue;days++;if(sku.shelf<9999){wasteU+=ser.waste[d];sold+=v;}if(ser.oos[d])oos++;}
      const p=r.lag1.find(x=>x.week===w);if(p){num+=Math.abs(p.fc-p.act);den+=p.act;bias+=p.fc-p.act;}}}
    out.push({week:w,wape:den?num/den:NaN,bias:den?bias/den:NaN,wastePct:sold+wasteU?wasteU/(sold+wasteU):NaN,oosPct:days?oos/days:NaN});}
  return out;
}
function storeKpis(s){return kpis({store:s});}
function catKpis(cat){return kpis({cat});}
function storeCatWape(s,cat){const a=WEEK0-28,b=WEEK0;let num=0,den=0;for(let k=0;k<NK;k++){if(SKUS[k].cat!==cat)continue;for(const p of FC.series[s][k].lag1){if(p.week*7>=a&&p.week*7<b){num+=Math.abs(p.fc-p.act);den+=p.act;}}}return den?num/den:NaN;}

/* ---- exceptions: what needs a planner's eye this week ---- */
function exceptions(limit=40){
  const out=[];
  for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=H)continue;
    for(let k=0;k<NK;k++){const sku=SKUS[k];const p=proposal(s,k);const r=FC.series[s][k];
      if(p.flags.includes('stock-out before delivery')){out.push({s,k,type:'Stock-out before delivery',sev:3,impact:p.shortBefore*sku.rev,detail:`${fmtNum(p.onHand)} ${sku.unit} on hand${p.onOrder?' + '+fmtNum(p.onOrder)+' arriving':''}, ${fmtNum(p.bridge)} needed before ${fmtDate(p.D1)}: short ${fmtNum(p.shortBefore)}`,action:'replenish'});}
      else if(p.flags.includes('expiring stock')){out.push({s,k,type:'Expiring stock',sev:2,impact:p.expiringUnsold*sku.cost,detail:`${fmtNum(p.expiringUnsold)} ${sku.unit} expire before ${fmtDate(p.D1)} with no demand to absorb them`,action:'replenish'});}
      else if(p.flags.includes('waste risk')&&p.active){out.push({s,k,type:'Waste risk',sev:2,impact:p.expWaste*sku.cost,detail:`${fmtNum(p.expWaste)} ${sku.unit} expected to expire before they sell`,action:'replenish'});}
      else if(p.flags.includes('overstock')){out.push({s,k,type:'Overstock',sev:1,impact:(p.stockAtD1-p.cycle)*sku.cost,detail:`${fmtNum(p.onHand)} ${sku.unit} on hand, ${(p.onHand/Math.max(0.1,p.cycle/(p.D2-p.D1))).toFixed(0)} days of cover`,action:'replenish'});}
      // forecast deviation last week
      const lw=r.lag1[r.lag1.length-1];if(lw&&lw.act>=10&&Math.abs(lw.fc-lw.act)/lw.act>0.45){out.push({s,k,type:lw.fc>lw.act?'Sales below forecast':'Sales above forecast',sev:1,impact:Math.abs(lw.fc-lw.act)*sku.rev,detail:`last week ${fmtNum(lw.act)} sold vs ${fmtNum(lw.fc)} forecast`,action:'forecast'});}
    }}
  out.sort((a,b)=>b.sev-a.sev||b.impact-a.impact);
  return out.slice(0,limit);
}

/* ---- launches, phase-outs, menu changes, new bars ---- */
function lifecycleItems(){
  const items=[];
  const addAlloc=(k,fromDay,toDay,label)=>{const rows=[];for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=toDay)continue;const q=fcSum(s,k,fromDay,toDay);rows.push({s,q,pack:Math.ceil(q/SKUS[k].pack)*SKUS[k].pack});}return rows;};
  // phase-outs: SKUs with an end date in the horizon, or a window closing with the next menu change
  const seasonEnd=seasonEndDay(H);const nextSeason=menuSeason(seasonEnd+1);
  for(const sku of SKUS){
    if(sku.end!=null&&sku.end>=H-7&&sku.end<H+HORIZON){
      const rows=[];let leftover=0,leftV=0;for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=H)continue;const oh=onHandNow(s,sku.idx)+onOrderNow(s,sku.idx);const dem=fcSum(s,sku.idx,H,sku.end+1);const left=Math.max(0,oh-dem);leftover+=left;leftV+=left*sku.cost;rows.push({s,onHand:oh,dem,left});}
      items.push({kind:'phase-out',sku,day:sku.end,title:`${sku.name}: last selling day ${fmtDate(sku.end)}`,rows,leftover,leftV,note:'Ordering stopped. Stock left after the end date is waste or a transfer candidate.'});}
    if(sku.window&&sku.window.includes(menuSeason(H))&&!sku.window.includes(nextSeason)){
      const rows=[];let leftover=0,leftV=0;for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=H)continue;const oh=onHandNow(s,sku.idx)+onOrderNow(s,sku.idx);const dem=fcSum(s,sku.idx,H,seasonEnd+1);const rate=dem/Math.max(1,seasonEnd+1-H);const stopDay=rate>0?Math.max(H,Math.round(seasonEnd+1-oh/rate)):H;rows.push({s,onHand:oh,dem,left:Math.max(0,oh-dem),stopDay});leftover+=Math.max(0,oh-dem);leftV+=Math.max(0,oh-dem)*sku.cost;}
      items.push({kind:'phase-out',sku,day:seasonEnd,title:`${sku.name}: leaves the menu after ${fmtDate(seasonEnd)} (${MENU_SEASONS.find(x=>x.key===nextSeason).name})`,rows,leftover,leftV,note:'Run-down plan: the proposal only orders what sells before the menu change; per bar, the last order date is shown.'});}
    if(sku.launch!=null&&sku.launch>=H&&sku.launch<H+HORIZON){
      const rows=addAlloc(sku.idx,sku.launch,nextDelivery(sku.group,sku.launch+1)+ (sku.group==='ambient'?3:2));let total=0;rows.forEach(r=>total+=r.pack);
      items.push({kind:'launch',sku,day:sku.launch,title:`${sku.name}: launches ${fmtDate(sku.launch)} (${MENU_SEASONS.find(x=>x.key===nextSeason).name})`,rows,total,
        note:`No history: forecast from sister SKU ${SKU_BY_ID[sku.analog].name} x ${Math.round(sku.analogRatio*100)}%, ramping over 3 weeks. Initial allocation covers the first delivery cycle per bar.`});}
    if(sku.window&&!sku.window.includes(menuSeason(H))&&sku.window.includes(nextSeason)&&sku.launch==null){
      const start=seasonEnd+1;const rows=addAlloc(sku.idx,start,nextDelivery(sku.group,start+1)+3);let total=0;rows.forEach(r=>total+=r.pack);
      items.push({kind:'launch',sku,day:start,title:`${sku.name}: back on the menu from ${fmtDate(start)}`,rows,total,note:'Returning seasonal item: forecast from last year\'s run, scaled by this year\'s growth.'});}
    if(sku.rotate){const t=dateOf(H);const nextFirst=Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,1);const d=Math.round((nextFirst-START)/DAY);
      const rows=addAlloc(sku.idx,d,d+7);let total=0;rows.forEach(r=>total+=r.pack);
      items.push({kind:'rotation',sku,day:d,title:`${sku.name}: new origin from ${fmtDate(d)}`,rows,total,note:'Monthly rotation: first-week uplift (+35%) and a last-week dip (-25%) are built into the forecast, so the previous origin runs down before the switch.'});}
  }
  // menu change
  items.push({kind:'menu',day:seasonEnd+1,title:`${MENU_SEASONS.find(x=>x.key===nextSeason).name} starts ${fmtDate(seasonEnd+1)}`,note:'Four menu changes a year. Items leaving and entering are listed as phase-outs and launches here; the forecast and the proposals already use the dates.'});
  // new bars
  for(const st of STORES){if(st.opened>=H&&st.opened<H+HORIZON){const rows=[];let total=0;for(let k=0;k<NK;k++){const sku=SKUS[k];const q=fcSum(st.id,k,st.opened,nextDelivery(sku.group,st.opened+1)+3);if(q>0){const pk=Math.ceil(q/sku.pack)*sku.pack;rows.push({k,q,pack:pk,value:pk*sku.cost});total+=pk*sku.cost;}}
    items.push({kind:'new-bar',store:st,day:st.opened,title:`${st.name}: opens ${fmtDate(st.opened)}`,rows,total,note:`No history: the opening order uses the ${CLUSTERS[st.cluster].name.toLowerCase()} cluster average per SKU x size index ${st.index.toFixed(2)}, ramping to full volume over 4 weeks.`});}}
  // promotions ahead
  const seen=new Set();
  for(const e of EVENTS){if(e.fromDay>=H&&e.fromDay<H+HORIZON&&!seen.has(e.name+e.fromDay)){seen.add(e.name+e.fromDay);
    items.push({kind:e.kind==='promo'?'promo':'event',day:e.fromDay,title:`${e.name}: ${fmtDate(e.fromDay)}${e.toDay!==e.fromDay?' to '+fmtDate(e.toDay):''}`,event:e,note:`${e.scope==='network'?'Whole network':e.scope.replace('cluster:','Cluster: ').replace('store:','Bar ')}, ${e.cats?e.cats.join(', '):'all categories'}, x${(e.skus?e.skuMult:e.mult).toFixed(2)} ${e.skus?'on '+e.skus.join(', '):''}. Already in the forecast and the proposals.`});}}
  items.sort((a,b)=>a.day-b.day);
  return items;
}

/* formatting */
function fmtNum(v,dp){if(v==null||v!==v)return '–';if(dp!=null)return v.toFixed(dp);const a=Math.abs(v);if(a>=1000)return Math.round(v).toLocaleString('en-NL');if(a>=100)return v.toFixed(0);if(a>=10)return v.toFixed(1).replace(/\.0$/,'');return v.toFixed(1).replace(/\.0$/,'');}
function fmtEur(v){if(v==null||v!==v)return '–';const a=Math.abs(v);if(a>=1e6)return '€'+(v/1e6).toFixed(2)+'M';if(a>=1e4)return '€'+(v/1e3).toFixed(1)+'K';return '€'+Math.round(v).toLocaleString('en-NL');}
function fmtPct(v,dp=1){if(v==null||v!==v)return '–';return (v*100).toFixed(dp)+'%';}
function fmtSigned(v,dp=1){if(v==null||v!==v)return '–';return (v>0?'+':'')+(v*100).toFixed(dp)+'%';}
