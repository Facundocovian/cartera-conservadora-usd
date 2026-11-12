const ONS = ['PLC5O','TTCDO','YMCXO'];
const FUNDS = ['short','latam','income'];
function dayIdx(d){ return Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(DATA.start+'T00:00:00Z'))/86400000); }
function navAt(k,d){ const a=DATA.nav[k]; let i=dayIdx(d); if(i<0)i=0; if(i>=a.length)i=a.length-1; return a[i]/1e5; }
function norm(o){ const keys=Object.keys(o); let s=0; keys.forEach(k=>{ o[k]=Math.max(0,Number(o[k])||0); s+=o[k]; }); const r={}; keys.forEach(k=>r[k]= s>0? o[k]/s : 0); return {frac:r,sum:s}; }

function simulate(p){
  const A=Math.max(0,Number(p.amount)||0);
  const W=norm({...p.w}).frac, S=norm({...p.split}).frac;
  const fundW=W.short+W.latam+W.income;
  const CPMIN=1000; const C=Math.max(0,Number(p.comm)||0)/100; let commTotal=0; const units0={}; let cash0=0;
  FUNDS.forEach(k=>{ const n0=navAt(k,DATA.start); units0[k]=Math.floor(A*W[k]/n0/CPMIN+1e-9)*CPMIN; cash0+=A*W[k]-units0[k]*n0; });
  const pos={};
  ONS.forEach(tk=>{
    const o=DATA.on[tk], budget=A*W.on*S[tk], p0=o.price[DATA.start];
    const nom=Math.floor(budget/(p0*(1+C)*o.lot)+1e-9)*o.lot, gross=nom*p0, comm=gross*C;
    pos[tk]={nom,budget,p0,cost:gross+comm,comm,minCost:p0*o.lot*(1+C)};
    cash0+=budget-gross-comm; commTotal+=comm;
  });
  const events=[];
  ONS.forEach(tk=>DATA.on[tk].coupons.forEach(c=>events.push({tk,pay:c.pay,ex:c.ex,cash:pos[tk].nom*c.perVN})));
  events.sort((a,b)=>a.pay<b.pay?-1:a.pay>b.pay?1:0);

  function at(t){
    const uR={short:0,latam:0,income:0}, pf={short:0,latam:0,income:0}; let paid=0, recv=0, idleCash=0;
    events.forEach(e=>{
      if(e.pay<=t){
        paid+=e.cash;
        if(fundW>0) FUNDS.forEach(k=>{ pf[k]+=e.cash*(W[k]/fundW); const n=navAt(k,e.pay), u=Math.floor(pf[k]/n/CPMIN+1e-9)*CPMIN; uR[k]+=u; pf[k]-=u*n; }); else idleCash+=e.cash;
      } else if(e.ex<=t){ recv+=e.cash; }
    });
    FUNDS.forEach(k=>{ idleCash+=pf[k]; });
    let fundsOwn=0, fundsReinv=0;
    FUNDS.forEach(k=>{ const n=navAt(k,t); fundsOwn+=units0[k]*n; fundsReinv+=uR[k]*n; });
    let onVal=0; ONS.forEach(tk=>{ onVal+=pos[tk].nom*DATA.on[tk].price[t]; });
    const total=fundsOwn+fundsReinv+onVal+cash0+idleCash+recv;
    return {date:t,total,fundsOwn,fundsReinv,onVal,cash:cash0+idleCash,recv,paid,uR};
  }
  const series=DATA.dates.map(at);
  const last=series[series.length-1], t=last.date;
  const rows=[];
  FUNDS.forEach(k=>{ const inv=A*W[k], val=units0[k]*navAt(k,t); const cost=units0[k]*navAt(k,DATA.start); rows.push({key:k,kind:'fund',inv:cost,budget:inv,units:units0[k],val,res:cost>0?val/cost-1:null,minCost:CPMIN*navAt(k,DATA.start)}); });
  ONS.forEach(tk=>{
    const q=pos[tk], price=DATA.on[tk].price[t], val=q.nom*price;
    const cps=events.filter(e=>e.tk===tk&&e.pay<=t).reduce((s,e)=>s+e.cash,0);
    const rec=events.filter(e=>e.tk===tk&&e.pay>t&&e.ex<=t).reduce((s,e)=>s+e.cash,0);
    rows.push({key:tk,kind:'on',inv:q.cost,budget:q.budget,nom:q.nom,p0:q.p0,price,val,coupons:cps,recv:rec,minCost:q.minCost,comm:q.comm,res:q.cost>0?(val+cps+rec)/q.cost-1:null});
  });
  const reinvInv=last.paid;
  rows.push({key:'reinv',kind:'reinv',inv:reinvInv,val:last.fundsReinv+last.recv,res:null});
  rows.push({key:'cash',kind:'cash',inv:cash0,val:last.cash,res:null});
  return {A,W,S,fundW,series,last,rows,events,commTotal};
}
function ret(series,a,b){ return series[b].total/series[a].total-1; }
if(typeof module!=='undefined') module.exports={simulate,ret,navAt};
