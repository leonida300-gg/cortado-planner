/* ============================================================
   Cortado - synthetic network data for the prototype
   Deterministic (seeded). Nothing here is real Wakuli data:
   bar names come from the public store locator, everything
   else (volumes, SKUs, stock, waste) is simulated.
   ============================================================ */
const DAY = 86400000;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(20261029);
function gauss(){let u=0,v=0;while(u===0)u=rnd();while(v===0)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function clamp(x,a,b){return x<a?a:x>b?b:x;}

/* ---- calendar ---- */
const TODAY = Date.UTC(2026,9,29);               // Thu 29 Oct 2026, order day
const WEEKS_HIST = 78;                           // complete weeks of history
const H = WEEKS_HIST*7 + 3;                      // + Mon-Wed of the current week
const START = TODAY - H*DAY;                     // Mon 28 Apr 2025
const HORIZON = 70;                              // forecast days
function dateOf(d){return new Date(START + d*DAY);}
function dow(d){return d % 7;}                   // 0 = Mon ... 6 = Sun (START is a Monday)
function doy(d){const t=dateOf(d);const y=Date.UTC(t.getUTCFullYear(),0,1);return Math.floor((t.getTime()-y)/DAY);}
function ymd(d){return dateOf(d).toISOString().slice(0,10);}
function dayIndex(iso){return Math.round((Date.parse(iso+'T00:00:00Z')-START)/DAY);}
const DOW_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d){const t=dateOf(d);return `${DOW_NAMES[dow(d)]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;}
function fmtShort(d){const t=dateOf(d);return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;}

/* Menu seasons (four menu changes a year) */
const MENU_SEASONS=[
  {key:'spring',name:'Spring menu',from:[2,2],to:[4,31]},
  {key:'summer',name:'Summer menu',from:[5,1],to:[8,27]},
  {key:'autumn',name:'Autumn menu',from:[8,28],to:[10,29]},
  {key:'winter',name:'Winter menu',from:[11,30],to:[2,1]},
];
function menuSeason(d){
  const t=dateOf(d), m=t.getUTCMonth(), day=t.getUTCDate();
  const v=m*100+day;
  if(v>=302&&v<=431)return 'spring';
  if(v>=501&&v<=827)return 'summer';
  if(v>=828&&v<=1029)return 'autumn';
  return 'winter';
}
function seasonStartDay(d){ // day index where the current menu season started
  let x=d; while(x>0 && menuSeason(x-1)===menuSeason(d)) x--; return x;
}
function seasonEndDay(d){ let x=d; while(menuSeason(x+1)===menuSeason(d)) x++; return x; }

/* ---- stores (bar names from the public locator; attributes simulated) ---- */
const CLUSTERS={
  centre:{name:'City centre',profile:[0.88,0.88,0.94,1.0,1.1,1.36,1.3]},
  neighbourhood:{name:'Neighbourhood',profile:[0.84,0.84,0.9,0.95,1.05,1.42,1.36]},
  office:{name:'Office & commuter',profile:[1.22,1.26,1.26,1.2,1.1,0.54,0.42]},
  student:{name:'Student',profile:[1.1,1.15,1.15,1.1,1.0,0.8,0.7]},
};
const STORE_DEFS=[
  ['Amstelveenseweg','neighbourhood',1.05,-1],
  ['Dijkmeerlaan','neighbourhood',0.7,H-63],
  ['Fahrenheitstraat','neighbourhood',0.9,-1],
  ['Haarlemmerplein','centre',1.35,-1,{satMarket:true}],
  ['Haarlemmerstraat','centre',1.2,-1],
  ['Jan Pieter Heijestraat','neighbourhood',1.1,-1],
  ['Kerkstraat','centre',1.3,-1],
  ['Koningstraat','centre',0.95,-1],
  ['Linnaeusstraat','neighbourhood',1.0,-1,{satMarket:true}],
  ['Lusthofstraat','neighbourhood',0.85,-1],
  ['Meent','centre',1.25,-1],
  ['Nobelstraat','student',1.15,-1],
  ['Piet Heinstraat','neighbourhood',0.9,-1],
  ['Stoeldraaierstraat','student',1.0,-1],
  ['Theresiastraat','office',0.95,-1],
  ['Tweede Jacob van Campenstraat','neighbourhood',1.15,-1],
  ['Twijnstraat','student',1.05,-1],
  ['Van Woustraat','neighbourhood',1.2,-1],
  ['Varkensmarkt','centre',0.9,-1],
  ['Vijzelgracht','office',1.4,-1],
  ['Visstraat','centre',0.8,H-140],
  ['Vos in Tuinstraat','centre',1.0,-1],
  ['Wagenaarstraat','neighbourhood',0.75,H-27],
  ['Ziekerstraat','centre',1.1,H-210],
  ['Stationsplein (planned)','office',1.2,H+18,{planned:true}],
];
const STORES=STORE_DEFS.map((s,i)=>({id:i,name:'Wakuli '+s[0],short:s[0],cluster:s[1],index:s[2],opened:s[3],flags:s[4]||{},
  profile:CLUSTERS[s[1]].profile}));

/* ---- SKUs ---- */
/* [id, name, category, unit, pack, shelfDays, baseDaily@index1, price, cost, opts] */
const SKU_DEFS=[
  ['BN-HOUSE','Original House Blend 250g','Retail beans','bag',6,42,4.5,9.3,3.9,{season:[0.18,355],trend:0.10,cv:0.35}],
  ['BN-POWER','Power House Blend 250g','Retail beans','bag',6,42,2.8,9.9,4.0,{season:[0.18,355],trend:0.05,cv:0.4}],
  ['BN-SOESP','Single Origin Espresso 250g','Retail beans','bag',6,42,2.2,10.7,4.4,{season:[0.15,355],cv:0.45}],
  ['BN-SOFIL','Single Origin Filter 250g','Retail beans','bag',6,42,2.0,10.7,4.4,{season:[0.15,355],trend:0.25,cv:0.45}],
  ['BN-DECAF','Single Origin Decaf 250g','Retail beans','bag',6,42,0.9,10.7,4.6,{cv:0.6}],
  ['BN-DISCO','Discover Monthly 250g','Retail beans','bag',6,42,1.8,10.9,4.6,{season:[0.15,355],cv:0.5,rotate:true}],
  ['BN-MICRO','Seasonal Microlot 250g','Retail beans','bag',6,42,0.5,16.7,7.5,{cv:0.8,season:[0.2,355]}],
  ['BN-DRIP','Microlot Drip Bag 5-pack','Retail beans','pack',10,120,0.6,7.5,3.1,{cv:0.7}],
  ['BC-ESP','Espresso beans 1kg (bar)','Bar coffee','kg',5,42,3.6,0,14,{weather:-0.004,trend:0.08,cv:0.15}],
  ['BC-FIL','Filter beans 1kg (bar)','Bar coffee','kg',5,42,1.4,0,14,{weather:-0.006,trend:0.15,cv:0.2}],
  ['BC-DEC','Decaf beans 1kg (bar)','Bar coffee','kg',5,42,0.5,0,15,{cv:0.3}],
  ['DA-MILK','Whole milk 1L','Dairy & alternatives','L',12,7,14,0,1.1,{weather:-0.004,cv:0.18}],
  ['DA-OAT','Oat milk 1L','Dairy & alternatives','L',6,180,11,0,1.6,{trend:0.22,cv:0.18}],
  ['DA-LFREE','Lactose-free milk 1L','Dairy & alternatives','L',6,7,1.5,0,1.4,{cv:0.4}],
  ['SY-VAN','Vanilla syrup 1L','Syrups & specials','btl',6,365,0.55,0,6.5,{cv:0.4}],
  ['SY-CAR','Caramel syrup 1L','Syrups & specials','btl',6,365,0.45,0,6.5,{cv:0.4}],
  ['SY-PUMP','Pumpkin spice syrup 1L','Syrups & specials','btl',6,365,0.7,0,7.0,{cv:0.4,window:['autumn']}],
  ['SY-MAPLE','Maple syrup 1L','Syrups & specials','btl',6,365,0.4,0,8.0,{cv:0.45,window:['autumn','winter']}],
  ['SY-SPEC','Speculaas syrup 1L','Syrups & specials','btl',6,365,0.6,0,7.0,{cv:0.4,window:['winter'],launch:'2026-11-30',analog:'SY-PUMP',analogRatio:0.85}],
  ['SP-CHAI','Chai concentrate 1L','Syrups & specials','btl',6,120,0.8,0,5.5,{weather:-0.01,cv:0.35}],
  ['SP-MATCHA','Matcha 100g','Syrups & specials','tin',6,365,0.3,0,9.0,{trend:0.4,cv:0.5}],
  ['CD-NITRO','Nitro Cold Brew can 200ml','Cold drinks','can',24,180,5,3.6,1.3,{weather:0.05,season:[0.5,200],cv:0.4,end:'2026-10-31'}],
  ['CD-SPRITZ','Grapefruit Cold Brew Spritz can','Cold drinks','can',24,180,3,3.9,1.4,{weather:0.06,season:[0.6,200],cv:0.45}],
  ['CD-KEG','Cold brew keg 5L','Cold drinks','keg',1,21,0.5,0,22,{weather:0.07,season:[0.7,200],cv:0.5}],
  ['CD-WATER','Sparkling water 330ml','Cold drinks','btl',24,365,6,2.5,0.5,{weather:0.03,season:[0.3,200],cv:0.3}],
  ['CD-OJ','Orange juice 250ml','Cold drinks','btl',12,10,4,3.5,1.2,{weather:0.02,cv:0.35}],
  ['FF-CROIS','Butter croissant','Fresh food','pc',12,1,22,3.2,0.9,{weekend:1.3,cv:0.22}],
  ['FF-PAC','Pain au chocolat','Fresh food','pc',12,1,16,3.5,1.0,{weekend:1.3,cv:0.22}],
  ['FF-CINN','Cinnamon bun','Fresh food','pc',8,1,12,3.9,1.1,{weekend:1.4,cv:0.25}],
  ['FF-BANANA','Banana bread slice','Fresh food','pc',10,3,10,3.5,0.9,{cv:0.24}],
  ['FF-COOKIE','Chocolate chip cookie','Fresh food','pc',12,5,9,2.8,0.7,{cv:0.35}],
  ['FF-GRAN','Granola yoghurt pot','Fresh food','pc',6,3,6,4.5,1.6,{weekend:0.7,cv:0.4}],
  ['PK-CUP8','Takeaway cup 8oz','Packaging','pc',500,9999,60,0,0.09,{cv:0.1}],
  ['PK-CUP12','Takeaway cup 12oz','Packaging','pc',500,9999,45,0,0.11,{weather:0.01,cv:0.1}],
  ['PK-LID','Lid 80mm','Packaging','pc',1000,9999,105,0,0.03,{cv:0.1}],
  ['PK-NAP','Napkins (pack of 250)','Packaging','pack',8,9999,0.9,0,2.1,{cv:0.3}],
  ['PK-FILT','Filter papers (box of 100)','Packaging','box',6,9999,0.35,0,5.5,{cv:0.4}],
  ['PK-BAG','Takeaway paper bag','Packaging','pc',250,9999,30,0,0.06,{cv:0.15}],
  ['MR-TIN','Wakuli coffee tin','Merch','pc',6,9999,0.15,10,3.5,{season:[0.5,355],cv:1.2,intermittent:true}],
  ['MR-CUP','Acme x Wakuli cup','Merch','pc',6,9999,0.2,11,4.0,{season:[0.4,355],cv:1.2,intermittent:true}],
  ['MR-GIFT','Giftcard (physical)','Merch','pc',10,9999,0.25,10,0.5,{season:[0.9,355],cv:1.2,intermittent:true}],
];
const CATEGORIES=['Retail beans','Bar coffee','Dairy & alternatives','Syrups & specials','Cold drinks','Fresh food','Packaging','Merch'];
const CAT_META={
  'Retail beans':{type:'CPG',group:'ambient',service:0.97},
  'Bar coffee':{type:'ingredient',group:'ambient',service:0.98},
  'Dairy & alternatives':{type:'ingredient',group:'chilled',service:0.96},
  'Syrups & specials':{type:'ingredient',group:'ambient',service:0.95},
  'Cold drinks':{type:'CPG',group:'chilled',service:0.93},
  'Fresh food':{type:'fresh',group:'daily',service:0.90},
  'Packaging':{type:'non-CPG',group:'ambient',service:0.99},
  'Merch':{type:'non-CPG',group:'ambient',service:0.90},
};
const SKUS=SKU_DEFS.map((s,i)=>{const o=s[9]||{};return {idx:i,id:s[0],name:s[1],cat:s[2],unit:s[3],pack:s[4],shelf:s[5],base:s[6],price:s[7],cost:s[8],
  rev: s[7]>0 ? s[7] : s[8]*4,   // revenue proxy: ingredients drive drink revenue (4x cost)
  season:o.season||null,trend:o.trend||0,cv:o.cv||0.3,weather:o.weather||0,weekend:o.weekend||1,window:o.window||null,
  launch:o.launch?dayIndex(o.launch):null,end:o.end?dayIndex(o.end):null,analog:o.analog||null,analogRatio:o.analogRatio||1,
  rotate:!!o.rotate,intermittent:!!o.intermittent,
  group: s[5]<=1 ? 'daily' : CAT_META[s[2]].group,
  type: CAT_META[s[2]].type, service: CAT_META[s[2]].service};});
const SKU_BY_ID=Object.fromEntries(SKUS.map(s=>[s.id,s]));

/* Delivery schedule from the Amsterdam hub (day-of-week lists, 0 = Mon). Orders close the day before delivery. */
const DELIVERY={ambient:[0,3],chilled:[0,2,4],daily:[0,1,2,3,4,5,6]};
function isDeliveryDay(group,d){return DELIVERY[group].includes(dow(d));}
function nextDelivery(group,fromDay){let d=fromDay;while(!isDeliveryDay(group,d))d++;return d;}

/* ---- weather: daily mean temperature, NL-like climatology with AR(1) noise ---- */
const TEMP=new Float32Array(H+HORIZON);
{let e=0;for(let d=0;d<H+HORIZON;d++){e=0.72*e+2.4*gauss();TEMP[d]=10.6+8.4*Math.cos(2*Math.PI*(doy(d)-200)/365)+e;}}
function climTemp(d){return 10.6+8.4*Math.cos(2*Math.PI*(doy(d)-200)/365);}
/* Weather forecast feed (mock): the next 10 days are "known", beyond that climatology */
function tempForecast(d){return d<H+10?TEMP[d]:climTemp(d);}

/* ---- events & promotions (known in advance, so the forecast can use them) ---- */
/* scope: 'network' | 'cluster:<key>' | 'store:<id>' ; cats: array or null (all) ; mult */
function yearly(name,m,d1,d2,scope,cats,mult,kind){const out=[];for(const y of [2025,2026]){out.push({name,from:Date.UTC(y,m,d1),to:Date.UTC(y,m,d2),scope,cats,mult,kind:kind||'event'});}return out;}
const EVENT_DEFS=[
  ...yearly("King's Day",3,27,27,'cluster:centre',['Bar coffee','Dairy & alternatives','Cold drinks','Fresh food','Packaging','Syrups & specials'],1.5),
  ...yearly("King's Day",3,27,27,'cluster:office',null,0.3),
  ...yearly("King's Day",3,27,27,'network',['Retail beans','Merch'],0.6),
  ...yearly('Summer holidays',6,18,8,'cluster:office',null,0.8),
  ...yearly('Summer holidays',6,18,8,'cluster:student',null,0.72),
  ...yearly('Summer holidays',6,18,8,'cluster:centre',null,1.08),
  {name:'Pride weekend',from:Date.UTC(2025,7,2),to:Date.UTC(2025,7,3),scope:'cluster:centre',cats:null,mult:1.3},
  {name:'Pride weekend',from:Date.UTC(2026,7,1),to:Date.UTC(2026,7,2),scope:'cluster:centre',cats:null,mult:1.3},
  {name:'Marathon Sunday',from:Date.UTC(2025,9,19),to:Date.UTC(2025,9,19),scope:'cluster:centre',cats:null,mult:1.25},
  {name:'Marathon Sunday',from:Date.UTC(2026,9,18),to:Date.UTC(2026,9,18),scope:'cluster:centre',cats:null,mult:1.25},
  {name:'Black Friday weekend',from:Date.UTC(2025,10,28),to:Date.UTC(2025,11,1),scope:'network',cats:['Retail beans'],mult:1.6,kind:'promo'},
  {name:'Black Friday weekend',from:Date.UTC(2025,10,28),to:Date.UTC(2025,11,1),scope:'network',cats:['Merch'],mult:1.5,kind:'promo'},
  {name:'Black Friday weekend',from:Date.UTC(2026,10,27),to:Date.UTC(2026,10,30),scope:'network',cats:['Retail beans'],mult:1.6,kind:'promo'},
  {name:'Black Friday weekend',from:Date.UTC(2026,10,27),to:Date.UTC(2026,10,30),scope:'network',cats:['Merch'],mult:1.5,kind:'promo'},
  ...yearly('Sinterklaas gifting',11,1,5,'network',['Retail beans','Merch'],1.25),
  ...yearly('Christmas week',11,21,27,'network',['Bar coffee','Dairy & alternatives','Fresh food','Packaging','Syrups & specials','Cold drinks'],0.75),
  ...yearly('Christmas week',11,21,24,'network',['Retail beans','Merch'],1.35),
  ...yearly('Christmas days (reduced hours)',11,25,26,'network',null,0.3),
  ...yearly('New Year',0,1,1,'network',null,0.4),
  ...yearly('Exam weeks',0,12,23,'cluster:student',null,1.15),
  ...yearly('Exam weeks',5,8,19,'cluster:student',null,1.15),
  {name:'Introduction week',from:Date.UTC(2025,7,18),to:Date.UTC(2025,7,22),scope:'cluster:student',cats:null,mult:1.3},
  {name:'Introduction week',from:Date.UTC(2026,7,17),to:Date.UTC(2026,7,21),scope:'cluster:student',cats:null,mult:1.3},
  {name:'Rotterdam Marathon',from:Date.UTC(2026,3,12),to:Date.UTC(2026,3,12),scope:'store:10',cats:null,mult:1.3},
  {name:'Oat milk at no extra charge',from:Date.UTC(2026,2,9),to:Date.UTC(2026,2,15),scope:'network',cats:['Dairy & alternatives'],mult:1.25,kind:'promo',skus:['DA-OAT'],skuMult:1.45},
  {name:'2 bags for 17 promo',from:Date.UTC(2026,8,14),to:Date.UTC(2026,8,27),scope:'network',cats:['Retail beans'],mult:1.35,kind:'promo'},
  {name:'Museum Night',from:Date.UTC(2026,10,7),to:Date.UTC(2026,10,7),scope:'cluster:centre',cats:null,mult:1.15},
  {name:'Sinterklaas arrival',from:Date.UTC(2026,10,14),to:Date.UTC(2026,10,14),scope:'cluster:centre',cats:null,mult:1.1},
  {name:'Filter Friday launch promo',from:Date.UTC(2026,10,13),to:Date.UTC(2026,10,15),scope:'network',cats:['Retail beans'],mult:1.0,kind:'promo',skus:['BN-SOFIL'],skuMult:1.5},
];
const EVENTS=EVENT_DEFS.map((e,i)=>({...e,id:i,fromDay:Math.round((e.from-START)/DAY),toDay:Math.round((e.to-START)/DAY)}));
function eventApplies(e,store,sku){
  if(e.scope!=='network'){const [k,v]=e.scope.split(':');if(k==='cluster'&&store.cluster!==v)return false;if(k==='store'&&String(store.id)!==v)return false;}
  if(e.skus){return e.skus.includes(sku.id)?true:(e.cats?e.cats.includes(sku.cat)&&e.mult!==1:false);}
  if(e.cats&&!e.cats.includes(sku.cat))return false;
  return true;
}
function eventMult(e,sku){return (e.skus&&e.skus.includes(sku.id))?e.skuMult:e.mult;}
/* multiplier of all known events on day d for (store, sku), plus list of names */
function knownFactors(store,sku,d){
  let m=1;const names=[];
  for(const e of EVENTS){if(d>=e.fromDay&&d<=e.toDay&&eventApplies(e,store,sku)){m*=eventMult(e,sku);names.push(e.name);}}
  if(store.flags.satMarket&&dow(d)===5){m*=1.15;names.push('Saturday market');}
  return {m,names};
}

/* ---- lifecycle: is the SKU on the menu on day d, and any launch / phase-out ramp ---- */
function lifecycleMult(sku,d){
  if(sku.launch!=null&&d<sku.launch)return 0;
  if(sku.end!=null&&d>sku.end)return 0;
  let m=1;
  if(sku.window){
    const s=menuSeason(d);
    if(!sku.window.includes(s))return 0;
    const ss=seasonStartDay(d), se=seasonEndDay(d);
    if(d-ss<7)m*=0.55+0.45*((d-ss)/7);           // ramp-up in the first week of the menu
    if(se-d<7&&!sku.window.includes(menuSeason(se+1)))m*=0.8; // tail in the last week before phase-out
  }
  if(sku.launch!=null){const k=d-sku.launch;if(k<21)m*=0.6+0.4*(k/21);}
  if(sku.rotate){const t=dateOf(d).getUTCDate();if(t<=7)m*=1.35;else if(t>=26)m*=0.75;}
  return m;
}
function seasonMult(sku,d){return sku.season?1+sku.season[0]*Math.cos(2*Math.PI*(doy(d)-sku.season[1])/365):1;}
function trendMult(sku,d){return Math.pow(1+sku.trend,(d-H)/365);}
function weatherMult(sku,temp){return sku.weather?clamp(1+sku.weather*(temp-15),0.5,2.2):1;}
function storeRamp(store,d){if(store.opened<0)return 1;const k=d-store.opened;if(k<0)return 0;return k<28?0.65+0.35*(k/28):1;}

/* unexplained week-to-week variation (what makes forecasting hard): a store-level and a SKU-level weekly shock */
const SHOCK_S=[],SHOCK_K=[];const NWK=Math.ceil((H+HORIZON)/7)+1;
for(let s=0;s<STORE_DEFS.length;s++){const a=new Float32Array(NWK);let e=0;for(let w=0;w<NWK;w++){e=0.5*e+0.07*gauss();a[w]=Math.exp(e);}SHOCK_S.push(a);}
for(let k=0;k<SKU_DEFS.length;k++){const a=new Float32Array(NWK);let e=0;for(let w=0;w<NWK;w++){e=0.4*e+0.06*gauss();a[w]=Math.exp(e);}SHOCK_K.push(a);}
/* ordering habits differ per bar: some lead baristas over-order, some under-order */
const STORE_BIAS=STORE_DEFS.map(()=>clamp(1+0.14*gauss(),0.8,1.3));

/* expected demand (no noise) for a day: the generating process. The forecast engine never sees this. */
function trueDemand(store,sku,d,temp){
  const lc=lifecycleMult(sku,d); if(lc===0)return 0;
  let mu=sku.base*store.index*store.profile[dow(d)]*lc*seasonMult(sku,d)*trendMult(sku,d)*weatherMult(sku,temp)*storeRamp(store,d);
  if(sku.weekend!==1&&dow(d)>=5)mu*=sku.weekend;
  mu*=knownFactors(store,sku,d).m;
  return mu;
}

/* ---- simulate the current (manual) ordering process to get sales, stock, waste, OOS ---- */
const NS=STORES.length, NK=SKUS.length;
const SER=[]; // SER[s][k] = {sales, demand, stock, waste, oos, received, lots, onOrder}
function sampleDemand(mu,sku){
  if(mu<=0)return 0;
  if(sku.intermittent){ // lumpy: Bernoulli x size
    const p=Math.min(0.9,mu/1.2); return rnd()<p?Math.max(1,Math.round(1.2*(1+0.8*Math.abs(gauss())))):0;
  }
  const x=mu*Math.max(0,1+sku.cv*gauss());
  return Math.round(x+ (rnd()<(x-Math.floor(x))?0.5:0)); // stochastic rounding-ish
}
function simulate(){
  for(let s=0;s<NS;s++){
    SER[s]=[];const store=STORES[s];
    for(let k=0;k<NK;k++){
      const sku=SKUS[k];
      const sales=new Float32Array(H).fill(NaN), demand=new Float32Array(H).fill(NaN), stock=new Float32Array(H).fill(NaN),
            waste=new Float32Array(H).fill(0), oos=new Uint8Array(H), received=new Float32Array(H).fill(0);
      let lots=[]; let onOrder=[]; // lots: {qty, exp}, onOrder: {qty, arrive}
      const onHand=()=>lots.reduce((a,l)=>a+l.qty,0);
      const open=store.opened<0?0:store.opened;
      for(let d=open;d<H;d++){
        // receive (a lot expires at the close of its last selling day)
        for(let i=onOrder.length-1;i>=0;i--){if(onOrder[i].arrive<=d){lots.push({qty:onOrder[i].qty,exp:d+sku.shelf-1});received[d]+=onOrder[i].qty;onOrder.splice(i,1);}}
        // manual ordering (the as-is process), the day before a delivery day
        if(isDeliveryDay(sku.group,d+1)&&(sku.launch==null||d+1>=sku.launch)&&(sku.end==null||d+1<=sku.end)&&(!sku.window||sku.window.includes(menuSeason(d+1)))){
          let nxt=nextDelivery(sku.group,d+2); const R=nxt-(d+1); // days the delivery must cover
          // the lead barista's estimate: last week's sales, anchored on a gut feel of what the bar normally sells
          const gut=sku.base*store.index*0.9*storeRamp(store,d+1);
          let est;
          let sum=0,n=0,mx=0,anyOos=false,activeDays=0;
          for(let j=1;j<=7;j++){const v=sales[d-j];if(v===v&&lifecycleMult(sku,d-j)>0){activeDays++;sum+=oos[d-j]?Math.max(v,mx)*1.15:v;n++;mx=Math.max(mx,v);if(oos[d-j])anyOos=true;}}
          if(activeDays<4||d-open<7){est=gut;}
          else{est=0.75*(sum/n)+0.25*gut;if(anyOos)est*=1.15;
            if(sku.shelf<=1){const ld=sales[d+1-7];const gutNext=sku.base*store.index*store.profile[dow(d+1)]*(sku.weekend!==1&&dow(d+1)>=5?sku.weekend:1)*0.95*storeRamp(store,d+1);
              est=ld===ld?0.6*ld*(oos[d+1-7]?1.3:1)+0.4*gutNext:gutNext;}}
          const fresh=sku.shelf<=3;
          let target=est*(fresh?R:R+1)*(fresh?1.15:1.2)*(fresh?Math.sqrt(STORE_BIAS[s]):STORE_BIAS[s])*clamp(1+(fresh?0.1:0.2)*gauss(),0.5,1.8);
          if(rnd()<0.04)target=0;                                            // forgot to order
          const validNext=lots.filter(l=>l.exp>=d+1).reduce((a,l)=>a+l.qty,0);   // stock that will still be sellable tomorrow
          let q=Math.max(0,target-validNext-onOrder.reduce((a,o)=>a+o.qty,0));
          q=Math.ceil(q/sku.pack)*sku.pack;
          if(q>0)onOrder.push({qty:q,arrive:d+1});
        }
        // demand & sales
        const w7=Math.floor(d/7);
        const mu=trueDemand(store,sku,d,TEMP[d])*SHOCK_S[s][w7]*SHOCK_K[k][w7]; const dem=sampleDemand(mu,sku);
        let rem=dem; lots.sort((a,b)=>a.exp-b.exp);
        for(const l of lots){const t=Math.min(l.qty,rem);l.qty-=t;rem-=t;if(rem===0)break;}
        lots=lots.filter(l=>l.qty>0);
        const sold=dem-rem;
        // expire at close
        let w=0; lots=lots.filter(l=>{if(l.exp<=d){w+=l.qty;return false;}return true;});
        sales[d]=sold;demand[d]=dem;stock[d]=onHand();waste[d]=w;oos[d]=rem>0?1:0;
      }
      SER[s][k]={sales,demand,stock,waste,oos,received,lots,onOrder};
    }
  }
}
simulate();

/* ---- helpers ---- */
function weekOf(d){return Math.floor(d/7);}
function weekStart(w){return w*7;}
function weeklySum(arr,w){let s=0,n=0;for(let d=w*7;d<Math.min(w*7+7,arr.length);d++){if(!isNaN(arr[d])){s+=arr[d];n++;}}return n?s:NaN;}
function sumRange(arr,a,b){let s=0;for(let d=a;d<b;d++){const v=arr[d];if(v===v)s+=v;}return s;}
function isoWeek(d){const t=dateOf(d);const x=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()));const dayNum=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-dayNum);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y0)/DAY)+1)/7);}
