/* ============================================================
   Cortado - forecasting engine
   Per store x SKU: clean history (stock-out correction), strip the
   known factors (events, promos, lifecycle), fit candidate models,
   backtest them, pick the best, then re-apply the known factors
   and the weather anomaly for the horizon.
   ============================================================ */

/* ---- normal distribution helpers ---- */
function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;}
function Phi(z){return 0.5*(1+erf(z/Math.SQRT2));}
function phi(z){return Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);}
function normLoss(z){return phi(z)-z*(1-Phi(z));}          // E[max(0, X - z)] for standard normal
function zOf(p){ // inverse normal CDF (Acklam)
  p=Math.min(0.9999,Math.max(0.0001,p));
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const pl=0.02425,ph=1-pl;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p<=ph){q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
  q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}
function median(a){const b=a.slice().sort((x,y)=>x-y);const n=b.length;return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):NaN;}
function mean(a){let s=0,n=0;for(const v of a){if(v===v){s+=v;n++;}}return n?s/n:NaN;}

const METHOD_NAMES={MA4:'Moving average (4 wk)',HW:'Exp. smoothing (Holt-Winters, weekly)',SEAS:'Holt-Winters x annual index',LY:'Last year x growth',CROSTON:'Croston (intermittent)',BLEND:'Blend of top 2',ANALOG:'Analog (cluster / sister SKU)'};
const HW_GRID=[];for(const a of [0.1,0.25,0.4])for(const b of [0,0.02])for(const g of [0.05,0.2])HW_GRID.push([a,b,g]);
const WEEK0=H-3;            // Monday of the current week (first incomplete week)
const FOLDS=[WEEK0-56,WEEK0-28];

/* known factors for every day (events, promos, lifecycle). The model fits the series with these divided out. */
function knownSeries(store,sku){
  const f=new Float32Array(H+HORIZON);
  for(let d=0;d<H+HORIZON;d++){const lc=lifecycleMult(sku,d);f[d]=lc===0?0:lc*knownFactors(store,sku,d).m;}
  return f;
}
/* stock-out corrected history: on days the bar was out of stock, lift the observation to the recent same-weekday level */
function correctedHistory(ser,f,open){
  const y=new Float32Array(H).fill(NaN);
  for(let d=open;d<H;d++){
    if(f[d]===0){continue;}
    let v=ser.sales[d];
    if(ser.oos[d]){ // sold out: the day's true demand was at least what sold; lift it to the upper range of recent same-weekday demand
      const clean=[],all=[];for(let j=1;j<=4;j++){const p=d-7*j;if(p>=open&&y[p]===y[p]&&f[p]>0){const u=y[p]/f[p]*f[d];all.push(u);if(!ser.oos[p])clean.push(u);}}
      if(clean.length>=2)v=Math.max(v,median(clean));
      else if(all.length){all.sort((a,b)=>b-a);v=Math.max(v,all.length>=2?all[1]*1.05:all[0]);}
    }
    y[d]=v;
  }
  return y;
}

/* ---- candidate models on the baseline (factor-free) daily series ---- */
function fitMA4(b,to){ // level from last 28 days, weekday shape from last 8 weeks
  let s=0,n=0;for(let d=to-28;d<to;d++){if(d>=0&&b[d]===b[d])({s,n}={s:s+b[d],n:n+1});}
  const level=n?s/n:0;
  const dowS=[0,0,0,0,0,0,0],dowN=[0,0,0,0,0,0,0];
  for(let d=to-56;d<to;d++){if(d>=0&&b[d]===b[d]){dowS[dow(d)]+=b[d];dowN[dow(d)]++;}}
  const avg=mean(dowS.map((v,i)=>dowN[i]?v/dowN[i]:NaN))||1;
  const prof=dowS.map((v,i)=>dowN[i]&&avg>0?(v/dowN[i])/avg:1);
  return {level,prof,fc:(d)=>level*prof[dow(d)]};
}
function fitHW(b,to,alpha,beta,gamma,phi=0.95){
  // initialise on the first 4 available weeks
  let first=-1;for(let d=0;d<to;d++){if(b[d]===b[d]){first=d;break;}}
  if(first<0)return null;
  const init=[],ds=[0,0,0,0,0,0,0],dn=[0,0,0,0,0,0,0];
  for(let d=first;d<Math.min(to,first+28);d++){if(b[d]===b[d]){init.push(b[d]);ds[dow(d)]+=b[d];dn[dow(d)]++;}}
  if(init.length<7)return null;
  let L=mean(init),T=0;const S=ds.map((v,i)=>dn[i]?v/dn[i]-L:0);
  let sse=0,n=0;const start=Math.min(to,first+28);
  for(let d=start;d<to;d++){
    const v=b[d];if(v!==v)continue;
    const i=dow(d);const fcst=L+phi*T+S[i];const e=v-fcst;
    if(d>=to-56){sse+=e*e;n++;}
    const Ln=alpha*(v-S[i])+(1-alpha)*(L+phi*T);
    T=beta*(Ln-L)+(1-beta)*phi*T;
    S[i]=gamma*(v-Ln)+(1-gamma)*S[i];
    L=Ln;
  }
  const sd=n>3?Math.sqrt(sse/n):NaN;
  return {L,T,S,sd,sse,n,params:[alpha,beta,gamma],fc:(d,k)=>{let tp=0,p=phi;for(let j=1;j<=k;j++){tp+=p;p*=phi;}return Math.max(0,L+tp*T+S[dow(d)]);}};
}
function bestHW(b,to){
  let best=null;for(const [a,be,g] of HW_GRID){const m=fitHW(b,to,a,be,g);if(m&&(best===null||m.sse<best.sse))best=m;}
  return best;
}
function fitCroston(b,to,alpha=0.1){
  let z=NaN,p=NaN,q=0;
  for(let d=Math.max(0,to-364);d<to;d++){const v=b[d];if(v!==v)continue;q++;if(v>0){if(z!==z){z=v;p=q;}else{z=alpha*v+(1-alpha)*z;p=alpha*q+(1-alpha)*p;}q=0;}}
  const rate=(z===z&&p>0)?z/p:0;
  return {rate,fc:()=>rate};
}
function fitLY(b,to){
  let s=0,sl=0,n=0;for(let d=to-28;d<to;d++){if(d-364>=0&&b[d]===b[d]&&b[d-364]===b[d-364]){s+=b[d];sl+=b[d-364];n++;}}
  if(n<14||sl<=0)return null;
  const g=Math.min(2,Math.max(0.5,s/sl));
  const prof=fitMA4(b,to).prof;
  return {growth:g,fc:(d)=>{ // same week last year, as a weekly average spread over the current weekday shape
    const p=d-364,w0=p-dow(p);let sum=0,m=0;for(let x=w0;x<w0+7;x++){if(x>=0&&x<b.length&&b[x]===b[x]){sum+=b[x];m++;}}
    return m>=4?(sum/m)*prof[dow(d)]*g:NaN;}};
}

/* ---- annual index per category (network level, evergreen SKUs, weekly, smoothed) ---- */
const CAT_WEEKLY={};
function buildCategoryIndex(bases){
  for(const cat of CATEGORIES){
    const W=new Float32Array(WEEKS_HIST).fill(0);
    for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=0)continue;
      for(let k=0;k<NK;k++){const sku=SKUS[k];if(sku.cat!==cat||sku.window||sku.launch!=null||sku.end!=null)continue;
        const b=bases[s][k];for(let w=0;w<WEEKS_HIST;w++){for(let d=w*7;d<w*7+7;d++){if(b[d]===b[d])W[w]+=b[d];}}}}
    const Sm=new Float32Array(WEEKS_HIST);for(let w=0;w<WEEKS_HIST;w++){let s=0,n=0;for(let j=-1;j<=1;j++){const x=w+j;if(x>=0&&x<WEEKS_HIST){s+=W[x];n++;}}Sm[w]=n?s/n:0;}
    CAT_WEEKLY[cat]=Sm;
  }
}
/* ratio of the same week last year to last year's equivalent of the origin week */
function annualRatio(cat,originDay,d){
  const Sm=CAT_WEEKLY[cat];if(!Sm)return 1;
  const wo=weekOf(originDay)-52,wd=weekOf(d)-52;
  if(wo<0||wd<0||wd>=WEEKS_HIST||!Sm[wo])return 1;
  return Math.min(2.5,Math.max(0.4,Sm[wd]/Sm[wo]));
}

/* ---- evaluation ---- */
function wapeWeekly(fcArr,yArr,from,len){ // weekly sums over len days starting at from (len multiple of 7)
  let num=0,den=0;for(let w=0;w<len/7;w++){let f=0,y=0,ok=false;for(let d=from+w*7;d<from+w*7+7;d++){if(yArr[d]===yArr[d]){y+=yArr[d];f+=fcArr[d-from];ok=true;}}if(ok){num+=Math.abs(f-y);den+=y;}}
  return den>0?num/den:NaN;
}

/* ---- main ---- */
const FC={series:[],analog:{},catIndexReady:false};
function methodForecast(name,models,b,sku,origin,d,k){
  switch(name){
    case 'MA4':return models.ma.fc(d);
    case 'HW':return models.hw?models.hw.fc(d,k):models.ma.fc(d);
    case 'SEAS':return (models.hw?models.hw.fc(d,k):models.ma.fc(d))*annualRatio(sku.cat,origin,d);
    case 'LY':{const v=models.ly?models.ly.fc(d):NaN;return v===v?v:models.ma.fc(d);}
    case 'CROSTON':return models.cr.fc();
  }
  return models.ma.fc(d);
}
function fitAll(b,to){return {ma:fitMA4(b,to),hw:bestHW(b,to),ly:fitLY(b,to),cr:fitCroston(b,to)};}

function runForecasts(){
  const bases=[],ys=[],fs=[];
  for(let s=0;s<NS;s++){bases[s]=[];ys[s]=[];fs[s]=[];const store=STORES[s];
    for(let k=0;k<NK;k++){const sku=SKUS[k];const f=knownSeries(store,sku);fs[s][k]=f;
      if(store.opened>=H){bases[s][k]=new Float32Array(H).fill(NaN);ys[s][k]=bases[s][k];continue;}
      const open=store.opened<0?0:store.opened;const y=correctedHistory(SER[s][k],f,open);ys[s][k]=y;
      const b=new Float32Array(H);for(let d=0;d<H;d++)b[d]=(y[d]===y[d]&&f[d]>0)?y[d]/f[d]:NaN;bases[s][k]=b;}}
  buildCategoryIndex(bases);
  /* analog levels: per cluster and SKU, baseline daily units per index point, mature stores only */
  for(const c of Object.keys(CLUSTERS)){FC.analog[c]=new Float32Array(NK);}
  FC.analog.network=new Float32Array(NK);
  for(let k=0;k<NK;k++){const per={};let allS=0,allN=0;
    for(let s=0;s<NS;s++){const st=STORES[s];if(st.opened>=0&&H-st.opened<182)continue;let sum=0,n=0;for(let d=H-28;d<H;d++){const v=bases[s][k][d];if(v===v){sum+=v;n++;}}
      if(n>=10){const lvl=sum/n/st.index;(per[st.cluster]=per[st.cluster]||[]).push(lvl);allS+=lvl;allN++;}}
    FC.analog.network[k]=allN?allS/allN:0;
    for(const c of Object.keys(CLUSTERS)){FC.analog[c][k]=per[c]&&per[c].length?mean(per[c]):FC.analog.network[k];}}
  /* per series */
  for(let s=0;s<NS;s++){FC.series[s]=[];const store=STORES[s];
    for(let k=0;k<NK;k++){FC.series[s][k]=forecastSeries(s,k,bases[s][k],ys[s][k],fs[s][k]);}}
  FC.bases=bases;FC.ys=ys;FC.fs=fs;
}

function analogDaily(store,sku,k,d){ // baseline daily units for a new bar (or sister SKU for a launch)
  let lvl;
  if(sku.launch!=null&&sku.analog){const a=SKU_BY_ID[sku.analog];lvl=FC.analog[store.cluster][a.idx]*sku.analogRatio;}
  else lvl=FC.analog[store.cluster][k];
  return lvl*store.index*store.profile[dow(d)]*(sku.weekend!==1&&dow(d)>=5?sku.weekend:1)*storeRamp(store,d);
}

function forecastSeries(s,k,b,y,f){
  const store=STORES[s],sku=SKUS[k];
  const nObs=(()=>{let n=0;for(let d=0;d<H;d++)if(b[d]===b[d])n++;return n;})();
  const weeksHist=store.opened<0?WEEKS_HIST:(H-store.opened)/7;
  const res={s,k,method:'ANALOG',wape:{},daily:new Float32Array(HORIZON),lo:new Float32Array(HORIZON),hi:new Float32Array(HORIZON),base:new Float32Array(HORIZON),
             sdDaily:0,level:0,trendWk:0,prof:[1,1,1,1,1,1,1],weatherSlope:0,weeksHist,nObs,lag1:[],analogShare:0,params:null,isNew:store.opened>=H,isLaunch:sku.launch!=null&&sku.launch>=H};
  const analogOnly=nObs<21||res.isNew||res.isLaunch;
  let models=null,chosen='ANALOG',top2=['MA4','MA4'];
  if(!analogOnly){
    /* backtest */
    const cand=['MA4','HW','SEAS','LY','CROSTON'];const score={};
    const intermittent=sku.intermittent||(()=>{let z=0,n=0;for(let d=H-91;d<H;d++){if(b[d]===b[d]){n++;if(b[d]===0)z++;}}return n>30&&z/n>0.55;})();
    for(const o of FOLDS){if(o<=0)continue;let nb=0;for(let d=0;d<o;d++)if(b[d]===b[d])nb++;if(nb<28)continue;
      const m=fitAll(b,o);
      for(const c of cand){if(c==='CROSTON'&&!intermittent)continue;if(c==='LY'&&!m.ly)continue;
        const fcArr=new Float32Array(28);for(let j=0;j<28;j++){const d=o+j;fcArr[j]=Math.max(0,methodForecast(c,m,b,sku,o,d,j+1))*f[d];}
        const w=wapeWeekly(fcArr,y,o,28);if(w===w){(score[c]=score[c]||[]).push(w);}}}
    const avg={};for(const c of Object.keys(score))avg[c]=mean(score[c]);
    res.wape=avg;
    const ranked=Object.keys(avg).filter(c=>avg[c]===avg[c]).sort((a,c)=>avg[a]-avg[c]);
    if(ranked.length){chosen=ranked[0];top2=[ranked[0],ranked[1]||ranked[0]];
      if(ranked.length>1){ // evaluate the blend of the top two as well
        let bl=[];for(const o of FOLDS){if(o<=0)continue;const m=fitAll(b,o);const fcArr=new Float32Array(28);let ok=true;
          for(let j=0;j<28;j++){const d=o+j;fcArr[j]=0.5*(Math.max(0,methodForecast(top2[0],m,b,sku,o,d,j+1))+Math.max(0,methodForecast(top2[1],m,b,sku,o,d,j+1)))*f[d];}
          const w=wapeWeekly(fcArr,y,o,28);if(w===w)bl.push(w);}
        if(bl.length){avg.BLEND=mean(bl);if(avg.BLEND<avg[chosen]-0.005)chosen='BLEND';}}
    }else chosen='MA4';
    models=fitAll(b,H);
    res.params=models.hw?models.hw.params:null;
    res.level=models.ma.level;res.prof=models.ma.prof;
    res.trendWk=models.hw&&models.ma.level>0?models.hw.T*7/models.ma.level:0;
    /* weather sensitivity: regress relative residual on the temperature anomaly (last 26 weeks) */
    {let sxy=0,sxx=0,n=0;for(let d=H-182;d<H;d++){if(d<28||b[d]!==b[d])continue;let s28=0,n28=0;for(let j=1;j<=28;j++){if(b[d-j]===b[d-j]){s28+=b[d-j];n28++;}}
        if(n28<14||s28<=0)continue;const r=b[d]/(s28/n28)-1;const a=TEMP[d]-climTemp(d);sxy+=a*r;sxx+=a*a;n++;}
      let slope=n>=60&&sxx>0?sxy/sxx:0;if(Math.abs(slope)*Math.sqrt(sxx/Math.max(1,n))<0.012)slope=0;res.weatherSlope=Math.min(0.1,Math.max(-0.05,slope));}
    /* one-week-ahead rolling accuracy, last 12 weeks, chosen method with final-fit structure */
    for(let w=12;w>=1;w--){const o=WEEK0-7*w;if(o<28)continue;let nb=0;for(let d=0;d<o;d++)if(b[d]===b[d])nb++;if(nb<14)continue;const m=fitAll(b,o);
      const ownW=store.opened<0?1:Math.min(1,Math.max(0,((o-store.opened)/7-3)/8));
      let fcw=0,yw=0,ok=false;for(let j=0;j<7;j++){const d=o+j;if(y[d]===y[d]){ok=true;yw+=y[d];let base=Math.max(0,blendForecast(chosen,top2,m,b,sku,o,d,j+1));if(ownW<1)base=ownW*base+(1-ownW)*analogDaily(store,sku,k,d);fcw+=base*f[d];}}
      if(ok)res.lag1.push({week:weekOf(o),fc:fcw,act:yw});}
    res.sdDaily=models.hw&&models.hw.sd===models.hw.sd?models.hw.sd:Math.max(0.3,0.5*models.ma.level);
    res.method=chosen;
    const own=Math.min(1,Math.max(0,(weeksHist-3)/8));res.analogShare=1-own;
    for(let j=0;j<HORIZON;j++){const d=H+j;
      let base=Math.max(0,blendForecast(chosen,top2,models,b,sku,H,d,j+1));
      if(own<1)base=own*base+(1-own)*analogDaily(store,sku,k,d);
      const wx=1+res.weatherSlope*(tempForecast(d)-climTemp(d));
      res.base[j]=base;res.daily[j]=base*f[d]*Math.max(0.5,wx);}
  }else{
    res.method='ANALOG';res.analogShare=1;
    for(let j=0;j<HORIZON;j++){const d=H+j;const base=analogDaily(store,sku,k,d);res.base[j]=base;res.daily[j]=base*f[d];}
    const a=FC.analog[store.cluster][k];res.level=a*store.index;res.prof=store.profile.slice();res.sdDaily=Math.max(0.5,0.6*res.level);
  }
  for(let j=0;j<HORIZON;j++){const v=res.daily[j];const sd=res.sdDaily*(res.daily[j]>0?Math.max(0.6,Math.sqrt(v/Math.max(res.level,0.1))):0);res.lo[j]=Math.max(0,v-1.28*sd);res.hi[j]=v+1.28*sd;}
  return res;
}
function blendForecast(chosen,top2,m,b,sku,o,d,k){
  if(chosen==='BLEND')return 0.5*(methodForecast(top2[0],m,b,sku,o,d,k)+methodForecast(top2[1],m,b,sku,o,d,k));
  return methodForecast(chosen,m,b,sku,o,d,k);
}

/* ---- overrides (planner adjustments), kept in this browser only ---- */
const OVR={key:'cortado.overrides.v1',data:{}};
try{OVR.data=JSON.parse(localStorage.getItem(OVR.key)||'{}')||{};}catch(e){OVR.data={};}
function saveOverrides(){try{localStorage.setItem(OVR.key,JSON.stringify(OVR.data));}catch(e){}}
function getOverride(s,k){return OVR.data[s+'|'+k]||null;}
function setOverride(s,k,o){if(o)OVR.data[s+'|'+k]=o;else delete OVR.data[s+'|'+k];saveOverrides();}
/* final daily forecast for day index d (>= H) with override applied */
function fcDay(s,k,d){const r=FC.series[s][k];const j=d-H;if(j<0||j>=HORIZON)return 0;let v=r.daily[j];const o=getOverride(s,k);if(o){if(o.untilDay==null||d<=o.untilDay)v*=o.mult;}return v;}
function fcSum(s,k,a,b){let t=0;for(let d=a;d<b;d++)t+=fcDay(s,k,d);return t;}
function fcWeek(s,k,w){return fcSum(s,k,Math.max(H,w*7),w*7+7);}
/* expected sales for a complete or partial week: actuals to date plus forecast for the rest */
function weekActualPlusFc(s,k,w){let t=0;const y=FC.ys[s][k];for(let d=w*7;d<w*7+7;d++){if(d<H){if(y[d]===y[d])t+=y[d];}else t+=fcDay(s,k,d);}return t;}
