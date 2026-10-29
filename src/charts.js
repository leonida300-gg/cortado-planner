/* ============================================================
   Cortado - small SVG chart kit (no dependencies)
   Line with band + crosshair tooltip, bars, heatmap table,
   sparkline, scatter. Colors come from CSS tokens.
   ============================================================ */
const SVG_NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs){const e=document.createElementNS(SVG_NS,tag);for(const k in attrs){if(attrs[k]!=null)e.setAttribute(k,attrs[k]);}return e;}
function niceTicks(min,max,n=5){if(max<=min)max=min+1;const span=max-min;const raw=span/n;const mag=Math.pow(10,Math.floor(Math.log10(raw)));const norm=raw/mag;const step=(norm<1.5?1:norm<3?2:norm<7?5:10)*mag;const t=[];const start=Math.ceil(min/step)*step;for(let v=start;v<=max+1e-9;v+=step)t.push(+v.toFixed(10));return {ticks:t,step};}
function compact(v){const a=Math.abs(v);if(a>=1e6)return (v/1e6).toFixed(1)+'M';if(a>=1e4)return Math.round(v/1e3)+'K';if(a>=1e3)return (v/1e3).toFixed(1)+'K';if(a>=100)return Math.round(v).toString();if(a>=10)return (Math.round(v*10)/10).toString();return (Math.round(v*100)/100).toString();}
function tipEl(container){let t=container.querySelector('.tip');if(!t){t=document.createElement('div');t.className='tip';t.hidden=true;container.appendChild(t);}return t;}
function clearEl(el){while(el.firstChild)el.removeChild(el.firstChild);}

/* line chart. series: [{name,color,pts:[{x,y}],band:[{x,lo,hi}]?,dashed?}] ; x numeric */
function lineChart(container,o){
  clearEl(container);container.classList.add('chart');
  const W=Math.max(280,container.clientWidth||600),Hh=o.height||240,m={t:14,r:16,b:28,l:44};
  const svg=svgEl('svg',{width:W,height:Hh,viewBox:`0 0 ${W} ${Hh}`,role:'img','aria-label':o.label||'chart'});
  let xs=[],ys=[];
  for(const s of o.series){for(const p of s.pts){if(p.y!=null&&p.y===p.y){xs.push(p.x);ys.push(p.y);}}if(s.band)for(const b of s.band){xs.push(b.x);ys.push(b.hi);ys.push(b.lo);}}
  if(!xs.length){container.appendChild(svg);return;}
  const xmin=o.xmin!=null?o.xmin:Math.min(...xs),xmax=o.xmax!=null?o.xmax:Math.max(...xs);
  const ymax0=Math.max(...ys,0);const {ticks,step}=niceTicks(0,ymax0*1.08,4);const ymax=Math.max(ticks[ticks.length-1],ymax0*1.05)||1;
  const X=x=>m.l+(x-xmin)/((xmax-xmin)||1)*(W-m.l-m.r),Y=y=>m.t+(1-y/ymax)*(Hh-m.t-m.b);
  // future shading
  if(o.shadeFrom!=null&&o.shadeFrom<=xmax){svg.appendChild(svgEl('rect',{x:X(Math.max(xmin,o.shadeFrom)),y:m.t,width:Math.max(0,X(xmax)-X(Math.max(xmin,o.shadeFrom))),height:Hh-m.t-m.b,class:'future'}));}
  // grid + y labels
  for(const t of ticks){const y=Y(t);svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:y,y2:y,class:'grid'}));const tx=svgEl('text',{x:m.l-6,y:y+4,class:'ax','text-anchor':'end'});tx.textContent=(o.yFmt||compact)(t);svg.appendChild(tx);}
  svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:Y(0),y2:Y(0),class:'axis'}));
  // x ticks
  const xt=o.xTicks||[];for(const t of xt){if(t.x<xmin||t.x>xmax)continue;const tx=svgEl('text',{x:X(t.x),y:Hh-8,class:'ax','text-anchor':'middle'});tx.textContent=t.label;svg.appendChild(tx);}
  // markers (events)
  let mi=0;for(const mk of (o.markers||[])){if(mk.x<xmin||mk.x>xmax)continue;svg.appendChild(svgEl('line',{x1:X(mk.x),x2:X(mk.x),y1:m.t,y2:Hh-m.b,class:'marker '+(mk.kind||'')}));if(mk.label&&W>=560){const tx=svgEl('text',{x:X(mk.x)+3,y:m.t+9+(mi%3)*11,class:'mk'});tx.textContent=mk.label.length>22?mk.label.slice(0,21)+'…':mk.label;svg.appendChild(tx);mi++;}}
  // series
  for(const s of o.series){
    if(s.band&&s.band.length){let d='';const b=s.band.filter(p=>p.lo===p.lo);for(let i=0;i<b.length;i++)d+=(i?'L':'M')+X(b[i].x).toFixed(1)+' '+Y(b[i].hi).toFixed(1);for(let i=b.length-1;i>=0;i--)d+='L'+X(b[i].x).toFixed(1)+' '+Y(b[i].lo).toFixed(1);svg.appendChild(svgEl('path',{d:d+'Z',class:'band',style:`fill:${s.color}`}));}
    let d='',pen=false;for(const p of s.pts){if(p.y==null||p.y!==p.y){pen=false;continue;}d+=(pen?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.y).toFixed(1);pen=true;}
    svg.appendChild(svgEl('path',{d,class:'ln'+(s.dashed?' dashed':''),style:`stroke:${s.color}`}));
    if(s.endDot){const last=[...s.pts].reverse().find(p=>p.y!=null&&p.y===p.y);if(last)svg.appendChild(svgEl('circle',{cx:X(last.x),cy:Y(last.y),r:4,class:'dot',style:`fill:${s.color}`}));}
    if(s.dots){for(const p of s.pts){if(p.y==null||p.y!==p.y)continue;svg.appendChild(svgEl('circle',{cx:X(p.x),cy:Y(p.y),r:3.5,class:'dot',style:`fill:${s.color}`}));}}
  }
  // hover
  const cross=svgEl('line',{x1:0,x2:0,y1:m.t,y2:Hh-m.b,class:'cross'});cross.style.display='none';svg.appendChild(cross);
  const hit=svgEl('rect',{x:m.l,y:m.t,width:W-m.l-m.r,height:Hh-m.t-m.b,fill:'transparent'});svg.appendChild(hit);
  const tip=tipEl(container);
  const allX=[...new Set(xs)].sort((a,b)=>a-b);
  const show=(ev)=>{const r=svg.getBoundingClientRect();const px=ev.clientX-r.left;const xv=xmin+(px-m.l)/(W-m.l-m.r)*(xmax-xmin);let best=allX[0];for(const x of allX){if(Math.abs(x-xv)<Math.abs(best-xv))best=x;}
    cross.setAttribute('x1',X(best));cross.setAttribute('x2',X(best));cross.style.display='';
    clearEl(tip);const h=document.createElement('div');h.className='tip-h';h.textContent=(o.xFmt||String)(best);tip.appendChild(h);
    for(const s of o.series){const p=s.pts.find(q=>q.x===best);if(!p||p.y==null||p.y!==p.y)continue;const row=document.createElement('div');row.className='tip-r';const key=document.createElement('i');key.style.background=s.color;row.appendChild(key);const v=document.createElement('b');v.textContent=(o.yFmt||compact)(p.y);row.appendChild(v);const n=document.createElement('span');n.textContent=s.name;row.appendChild(n);tip.appendChild(row);
      if(s.band){const b=s.band.find(q=>q.x===best);if(b){const r2=document.createElement('div');r2.className='tip-s';r2.textContent=`range ${(o.yFmt||compact)(b.lo)} to ${(o.yFmt||compact)(b.hi)}`;tip.appendChild(r2);}}}
    tip.hidden=false;const tw=tip.offsetWidth;let left=X(best)+12;if(left+tw>W-4)left=X(best)-tw-12;tip.style.left=left+'px';tip.style.top=(m.t+4)+'px';};
  hit.addEventListener('pointermove',show);hit.addEventListener('pointerleave',()=>{tip.hidden=true;cross.style.display='none';});
  container.appendChild(svg);
  if(o.legend!==false&&o.series.length>1){const lg=document.createElement('div');lg.className='legend';for(const s of o.series){const it=document.createElement('span');const k=document.createElement('i');k.style.background=s.color;if(s.dashed)k.classList.add('dashed');it.appendChild(k);it.appendChild(document.createTextNode(s.name));lg.appendChild(it);}container.appendChild(lg);}
}

/* bar chart: labels[], series:[{name,color,values[]}], stacked, horizontal */
function barChart(container,o){
  clearEl(container);container.classList.add('chart');
  const horiz=!!o.horizontal;const n=o.labels.length;
  const W=Math.max(280,container.clientWidth||600);const rowH=o.rowH||26;const Hh=horiz?Math.max(80,n*rowH+30):(o.height||220);
  const m=horiz?{t:8,r:40,b:22,l:o.labelW||150}:{t:12,r:12,b:28,l:44};
  const svg=svgEl('svg',{width:W,height:Hh,viewBox:`0 0 ${W} ${Hh}`,role:'img','aria-label':o.label||'bar chart'});
  const totals=o.labels.map((_,i)=>o.stacked?o.series.reduce((a,s)=>a+(s.values[i]||0),0):Math.max(...o.series.map(s=>s.values[i]||0)));
  const vmax0=Math.max(...totals,0);const {ticks}=niceTicks(0,vmax0*1.08,4);const vmax=Math.max(ticks[ticks.length-1],vmax0*1.05)||1;
  const tip=tipEl(container);
  const fmt=o.fmt||compact;
  if(horiz){
    const L=x=>m.l+x/vmax*(W-m.l-m.r);
    for(const t of ticks){svg.appendChild(svgEl('line',{x1:L(t),x2:L(t),y1:m.t,y2:Hh-m.b,class:'grid'}));const tx=svgEl('text',{x:L(t),y:Hh-8,class:'ax','text-anchor':'middle'});tx.textContent=fmt(t);svg.appendChild(tx);}
    o.labels.forEach((lab,i)=>{const y=m.t+i*rowH;const tx=svgEl('text',{x:m.l-8,y:y+rowH/2+4,class:'lbl','text-anchor':'end'});tx.textContent=lab.length>24?lab.slice(0,23)+'…':lab;svg.appendChild(tx);
      let acc=0;const bh=Math.min(18,rowH-8);
      o.series.forEach((s,si)=>{const v=s.values[i]||0;if(v<=0)return;const x0=o.stacked?L(acc):m.l,x1=L(o.stacked?acc+v:v);const yy=o.stacked?y+(rowH-bh)/2:y+4+si*(bh/o.series.length);const hh=o.stacked?bh:bh/o.series.length-1;
        const r=svgEl('rect',{x:x0+(o.stacked&&acc>0?2:0),y:yy,width:Math.max(0,x1-x0-(o.stacked&&acc>0?2:0)),height:hh,class:'bar',style:`fill:${s.color}`});
        r.addEventListener('pointerenter',(ev)=>{clearEl(tip);const h=document.createElement('div');h.className='tip-h';h.textContent=lab;tip.appendChild(h);const row=document.createElement('div');row.className='tip-r';const b=document.createElement('b');b.textContent=fmt(v);row.appendChild(b);const sp=document.createElement('span');sp.textContent=s.name;row.appendChild(sp);tip.appendChild(row);tip.hidden=false;tip.style.left=Math.min(x1+8,W-140)+'px';tip.style.top=(y-4)+'px';});
        r.addEventListener('pointerleave',()=>{tip.hidden=true;});svg.appendChild(r);acc+=v;});
      if(o.valueLabels){const tv=svgEl('text',{x:L(totals[i])+5,y:y+rowH/2+4,class:'val'});tv.textContent=fmt(totals[i]);svg.appendChild(tv);}});
  }else{
    const slot=(W-m.l-m.r)/n;const bw=Math.min(24,slot*0.6);const Y=v=>m.t+(1-v/vmax)*(Hh-m.t-m.b);
    for(const t of ticks){svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:Y(t),y2:Y(t),class:'grid'}));const tx=svgEl('text',{x:m.l-6,y:Y(t)+4,class:'ax','text-anchor':'end'});tx.textContent=fmt(t);svg.appendChild(tx);}
    svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:Y(0),y2:Y(0),class:'axis'}));
    o.labels.forEach((lab,i)=>{const cx=m.l+slot*(i+0.5);const tx=svgEl('text',{x:cx,y:Hh-8,class:'ax','text-anchor':'middle'});tx.textContent=lab;svg.appendChild(tx);
      let acc=0;const k=o.series.length;const gw=o.stacked?bw:bw/k;
      o.series.forEach((s,si)=>{const v=s.values[i]||0;if(v<=0)return;const x=o.stacked?cx-bw/2:cx-bw/2+si*gw;const y0=o.stacked?Y(acc):Y(0),y1=Y(o.stacked?acc+v:v);
        const r=svgEl('rect',{x,y:y1,width:o.stacked?bw:gw-1,height:Math.max(0,y0-y1-(o.stacked&&acc>0?2:0)),class:'bar',style:`fill:${s.color}`});
        r.addEventListener('pointerenter',()=>{clearEl(tip);const h=document.createElement('div');h.className='tip-h';h.textContent=lab;tip.appendChild(h);const row=document.createElement('div');row.className='tip-r';const b=document.createElement('b');b.textContent=fmt(v);row.appendChild(b);const sp=document.createElement('span');sp.textContent=s.name;row.appendChild(sp);tip.appendChild(row);tip.hidden=false;tip.style.left=Math.min(cx+10,W-150)+'px';tip.style.top=(y1-6)+'px';});
        r.addEventListener('pointerleave',()=>{tip.hidden=true;});svg.appendChild(r);acc+=v;});
      if(o.valueLabels){const tv=svgEl('text',{x:cx,y:Y(totals[i])-5,class:'val','text-anchor':'middle'});tv.textContent=fmt(totals[i]);svg.appendChild(tv);}});
  }
  container.appendChild(svg);
  if(o.series.length>1&&o.legend!==false){const lg=document.createElement('div');lg.className='legend';for(const s of o.series){const it=document.createElement('span');const k=document.createElement('i');k.style.background=s.color;k.classList.add('sq');it.appendChild(k);it.appendChild(document.createTextNode(s.name));lg.appendChild(it);}container.appendChild(lg);}
}

/* heatmap as an HTML table: rows[], cols[], values[r][c] (NaN allowed), fmt, lo/hi for the ramp, invert (higher is worse) */
function heatmap(container,o){
  clearEl(container);
  const wrap=document.createElement('div');wrap.className='scroll';const t=document.createElement('table');t.className='heat';
  const thead=document.createElement('thead');const hr=document.createElement('tr');hr.appendChild(document.createElement('th'));for(const c of o.cols){const th=document.createElement('th');th.textContent=c;hr.appendChild(th);}thead.appendChild(hr);t.appendChild(thead);
  const tb=document.createElement('tbody');
  const vals=o.values.flat().filter(v=>v===v);const lo=o.lo!=null?o.lo:Math.min(...vals),hi=o.hi!=null?o.hi:Math.max(...vals);
  o.rows.forEach((r,i)=>{const tr=document.createElement('tr');const th=document.createElement('th');th.textContent=r;tr.appendChild(th);
    o.cols.forEach((c,j)=>{const v=o.values[i][j];const td=document.createElement('td');if(v!==v){td.textContent='–';td.className='na';}else{const p=Math.max(0,Math.min(1,(v-lo)/((hi-lo)||1)));td.style.setProperty('--p',p.toFixed(3));td.textContent=(o.fmt||compact)(v);td.className='cell'+(p>0.6?' deep':'');}
      if(o.onClick){td.classList.add('click');td.addEventListener('click',()=>o.onClick(i,j));}tr.appendChild(td);});tb.appendChild(tr);});
  t.appendChild(tb);wrap.appendChild(t);container.appendChild(wrap);
}

/* sparkline */
function sparkline(values,w=96,h=26,color='var(--accent)'){
  const v=values.filter(x=>x===x);if(!v.length)return document.createElement('span');
  const svg=svgEl('svg',{width:w,height:h,viewBox:`0 0 ${w} ${h}`,class:'spark'});const mx=Math.max(...v),mn=Math.min(...v);
  const X=i=>2+i/(v.length-1||1)*(w-4),Y=x=>h-3-(x-mn)/((mx-mn)||1)*(h-6);
  let d='';v.forEach((x,i)=>{d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(x).toFixed(1);});
  svg.appendChild(svgEl('path',{d:d+`L${X(v.length-1).toFixed(1)} ${h}L${X(0)} ${h}Z`,class:'spark-fill',style:`fill:${color}`}));
  svg.appendChild(svgEl('path',{d,class:'spark-ln',style:`stroke:${color}`}));
  svg.appendChild(svgEl('circle',{cx:X(v.length-1),cy:Y(v[v.length-1]),r:2.5,style:`fill:${color}`}));
  return svg;
}

/* scatter: points [{x,y,label,color?}], xFmt,yFmt, refX, refY, xLabel, yLabel */
function scatter(container,o){
  clearEl(container);container.classList.add('chart');
  const W=Math.max(280,container.clientWidth||600),Hh=o.height||260,m={t:14,r:16,b:36,l:48};
  const svg=svgEl('svg',{width:W,height:Hh,viewBox:`0 0 ${W} ${Hh}`,role:'img','aria-label':o.label||'scatter'});
  const pts=o.points.filter(p=>p.x===p.x&&p.y===p.y);if(!pts.length){container.appendChild(svg);return;}
  const xmax=Math.max(...pts.map(p=>p.x),o.refX||0)*1.15||1,ymax=Math.max(...pts.map(p=>p.y),o.refY||0)*1.15||1;
  const X=x=>m.l+x/xmax*(W-m.l-m.r),Y=y=>m.t+(1-y/ymax)*(Hh-m.t-m.b);
  const xt=niceTicks(0,xmax,4).ticks,yt=niceTicks(0,ymax,4).ticks;
  for(const t of yt){svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:Y(t),y2:Y(t),class:'grid'}));const tx=svgEl('text',{x:m.l-6,y:Y(t)+4,class:'ax','text-anchor':'end'});tx.textContent=(o.yFmt||compact)(t);svg.appendChild(tx);}
  for(const t of xt){const tx=svgEl('text',{x:X(t),y:Hh-m.b+14,class:'ax','text-anchor':'middle'});tx.textContent=(o.xFmt||compact)(t);svg.appendChild(tx);}
  if(o.refX!=null)svg.appendChild(svgEl('line',{x1:X(o.refX),x2:X(o.refX),y1:m.t,y2:Hh-m.b,class:'marker'}));
  if(o.refY!=null)svg.appendChild(svgEl('line',{x1:m.l,x2:W-m.r,y1:Y(o.refY),y2:Y(o.refY),class:'marker'}));
  const xl=svgEl('text',{x:(m.l+W-m.r)/2,y:Hh-4,class:'ax','text-anchor':'middle'});xl.textContent=o.xLabel||'';svg.appendChild(xl);
  const yl=svgEl('text',{x:12,y:(m.t+Hh-m.b)/2,class:'ax','text-anchor':'middle',transform:`rotate(-90 12 ${(m.t+Hh-m.b)/2})`});yl.textContent=o.yLabel||'';svg.appendChild(yl);
  const tip=tipEl(container);
  for(const p of pts){const c=svgEl('circle',{cx:X(p.x),cy:Y(p.y),r:p.r||5,class:'dot'+(p.dim?' dim':''),style:`fill:${p.color||'var(--accent)'}`});
    const hitc=svgEl('circle',{cx:X(p.x),cy:Y(p.y),r:12,fill:'transparent'});
    hitc.addEventListener('pointerenter',()=>{clearEl(tip);const h=document.createElement('div');h.className='tip-h';h.textContent=p.label;tip.appendChild(h);const r=document.createElement('div');r.className='tip-s';r.textContent=`${o.xLabel||'x'} ${(o.xFmt||compact)(p.x)} · ${o.yLabel||'y'} ${(o.yFmt||compact)(p.y)}`;tip.appendChild(r);tip.hidden=false;tip.style.left=Math.min(X(p.x)+12,W-170)+'px';tip.style.top=(Y(p.y)-10)+'px';});
    hitc.addEventListener('pointerleave',()=>{tip.hidden=true;});if(o.onClick)hitc.addEventListener('click',()=>o.onClick(p));
    svg.appendChild(c);svg.appendChild(hitc);
    if(p.labelAlways){const t=svgEl('text',{x:X(p.x)+8,y:Y(p.y)+4,class:'lbl'});t.textContent=p.label;svg.appendChild(t);}}
  container.appendChild(svg);
}

/* data table twin for a chart: headers[], rows[][] */
function dataTable(container,headers,rows,opts={}){
  clearEl(container);const wrap=document.createElement('div');wrap.className='scroll';const t=document.createElement('table');t.className='data'+(opts.compact?' compact':'');
  const thead=document.createElement('thead');const tr=document.createElement('tr');headers.forEach((h,i)=>{const th=document.createElement('th');th.textContent=h;if(i>0)th.className='num';tr.appendChild(th);});thead.appendChild(tr);t.appendChild(thead);
  const tb=document.createElement('tbody');rows.forEach(r=>{const tr=document.createElement('tr');r.forEach((c,i)=>{const td=document.createElement('td');td.textContent=c;if(i>0)td.className='num';tr.appendChild(td);});tb.appendChild(tr);});t.appendChild(tb);wrap.appendChild(t);container.appendChild(wrap);
}
