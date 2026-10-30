import {Complex as C,TalbotInverter,PRBS,idealRamp} from './numerics.mjs';
export const TLineGeometry={
 extract(p){const w=p.w*1e-3,h=p.h*1e-3,t=p.t*1e-6,er=p.er;let z0,ee;
 if(p.topology==='strip'){const b=2*h+t,T=t/b,W=w/b,we=W<.35?W-(.35-W)**2/(1+12*T):W,cf=2/Math.PI*Math.log(1/(1-T)+1)-T/Math.PI*Math.log(1/(1-T)**2-1);z0=30*Math.PI/Math.sqrt(er)*(1-T)/(we+cf);ee=er}
 else{const u=w/h,v=t/h,du=v/Math.PI*Math.log(1+4*Math.E*Math.tanh(Math.sqrt(6.517*u))**2/v),ur=u+du/2*(1+1/Math.cosh(Math.sqrt(er-1)));const a=1+Math.log((ur**4+(ur/52)**2)/(ur**4+.432))/49+Math.log(1+(ur/18.1)**3)/18.7,b=.564*((er-.9)/(er+3))**.053;ee=(er+1)/2+(er-1)/2*(1+10/ur)**(-a*b);const f=6+(2*Math.PI-6)*Math.exp(-((30.666/ur)**.7528));z0=59.9584916*Math.log(f/ur+Math.sqrt(1+4/ur**2))/Math.sqrt(ee)}
 if(!(z0>0&&Number.isFinite(z0)))throw Error('Geometria fora da faixa de validade');const velocity=299792458/Math.sqrt(ee),cap=1/(velocity*z0);return {z0,ee,velocity,C:cap,L:z0*z0*cap,w,h,t,delay:p.length*1e-3/velocity}}
};
// Debye single-pole: C(s)=Cinf+deltaC/(1+s*tau). Calibrated at 1 GHz:
// Re C(jwref)=C, Re Y / Im Y=tan(delta). Cinf>0 guarantees passivity.
// Unlike constant loss tangent this is causal, but tan(delta) varies with f.
export const RLGCExtractor={extract(p){const g=TLineGeometry.extract(p),sigma=p.sigma*1e6,mu=4e-7*Math.PI;
 const Rdc=p.ideal?0:1/(sigma*g.w*g.t),Rskin=p.ideal?0:Math.sqrt(Math.PI*mu/sigma)/g.w;
 return {...g,sigma,Rdc,Rskin,k:Rskin/Math.sqrt(Math.PI),Cinf:g.C*(1-(p.ideal?0:p.loss)),deltaC:p.ideal?0:2*g.C*p.loss,tau:1/(2*Math.PI*1e9)}},
 at(g,f){return {R:g.Rdc+g.Rskin*Math.sqrt(f),G:(2*Math.PI*f)**2*g.tau*g.deltaC/(1+(2*Math.PI*f*g.tau)**2),Greference:Math.PI*f*g.deltaC,delta:f>0?1/Math.sqrt(Math.PI*f*4e-7*Math.PI*g.sigma):Infinity}}
};
export class LaplaceChannel{
 constructor(p){this.p=p;this.g=RLGCExtractor.extract(p);this.length=p.length*.001;this.flight=Math.sqrt(this.g.L*this.g.Cinf)}
 at(s){if(s.abs()===0)s=new C(1e-12);const g=this.g,zOverS=new C(g.L).add(new C(g.Rdc).div(s)).add(s.sqrt().mul(g.k).div(s)),cap=new C(g.Cinf).add(new C(g.deltaC).div(s.mul(g.tau).add(1))),gamma=zOverS.mul(cap).sqrt().mul(s),z0=zOverS.div(cap).sqrt(),gs=new C(this.p.zs).sub(z0).div(z0.add(this.p.zs));let gl;
 const term=this.p.term;if(term==='open')gl=new C(1);else if(term==='short')gl=new C(-1);else{const adm=term==='matched'?new C(1/this.g.z0):term==='resistive'?new C(1/this.p.zl):s.mul(this.p.cin*1e-12).add(term==='rc'?1/this.p.zl:0);gl=new C(1).sub(z0.mul(adm)).div(new C(1).add(z0.mul(adm)))}return {gamma,z0,gs,gl,launch:z0.div(z0.add(this.p.zs))}}
 transfer(s){if(s.abs()===0){if(['open','capacitive'].includes(this.p.term))return new C(1);if(this.p.term==='short')return new C(0);const load=this.p.term==='matched'?this.g.z0:this.p.zl;return new C(load/(load+this.p.zs+this.g.Rdc*this.length))}const a=this.at(s),e=a.gamma.mul(-this.length).exp();return a.launch.mul(a.gl.add(1)).mul(e).div(new C(1).sub(a.gs.mul(a.gl).mul(e).mul(e)))}
 // Invert each delayed travelling path independently. This prevents the
 // exponentially growing pure delays on the left Talbot contour.
 ramp(t,x=this.length,M=20){if(t<=0)return 0;const tr=this.p.rise*1e-12;let value=0;for(let n=0;n<80;n++){
 const distances=[2*n*this.length+x,2*(n+1)*this.length-x];if(distances[0]*this.flight>=t)break;
 for(let reflected=0;reflected<2;reflected++){const distance=distances[reflected],u=t-distance*this.flight;if(u<=0)continue;
 const F=s=>{const a=this.at(s);let gain=a.launch;for(let j=0;j<n;j++)gain=gain.mul(a.gs).mul(a.gl);if(reflected)gain=gain.mul(a.gl);return gain.mul(a.gamma.sub(s.mul(this.flight)).mul(-distance).exp()).div(s.mul(s))};
 value+=(TalbotInverter.invert(F,u,M)-(u>tr?TalbotInverter.invert(F,u-tr,M):0))/tr;
 }}if(!Number.isFinite(value)||Math.abs(value)>1e5)throw Error('Instabilidade numérica: reduza termos ou reveja a geometria');return value*this.p.amplitude}
}
export const EyeEngine={
 synthesize(response,dt,p,delay){const spp=32,ui=1/(p.rate*1e9),bits=p.pattern==='clock'?Uint8Array.from({length:1152},(_,i)=>i%2):p.pattern==='isolated'?Uint8Array.from({length:1152},(_,i)=>i===128?1:0):PRBS.generate(p.pattern==='prbs15'?15:7,1152),out=new Float64Array(bits.length*spp);
 const sample=t=>{const u=t/dt,i=Math.floor(u);return i<0?0:i>=response.length-1?response.at(-1):response[i]+(response[i+1]-response[i])*(u-i)};
 const kernel=Float64Array.from({length:Math.ceil(response.length*dt/ui*spp)},(_,i)=>sample(i*ui/spp)-sample(i*ui/spp-ui));
 for(let b=0;b<bits.length;b++)if(bits[b])for(let j=0;j<kernel.length&&b*spp+j<out.length;j++)out[b*spp+j]+=kernel[j];
 const traces=[],offset=Math.round(delay/ui*spp);for(let b=128;b<1150;b++){const start=b*spp+offset;if(start+64<out.length)traces.push(out.slice(start,start+65))}
 const low=[],high=[];for(let b=128;b<1150;b++){const i=b*spp+offset+16;if(i<out.length)(bits[b]?high:low).push(out[i])}
 const quantile=(a,q)=>{if(a.length<16)return null;const s=a.slice().sort((a,b)=>a-b);return s[Math.floor(q*(s.length-1))]},lo=quantile(low,.99),hi=quantile(high,.01),mid=lo!==null&&hi!==null?(lo+hi)/2:null;
 const rises=[],falls=[];if(mid!==null)for(let b=129;b<1150;b++){if(bits[b]===bits[b-1])continue;const center=b*spp+offset;let nearest=null;for(let k=-16;k<16;k++){const i=center+k;if(i<0||i+1>=out.length)continue;const a=out[i]-mid,c=out[i+1]-mid;if((bits[b]?a<=0&&c>0:a>=0&&c<0)){const phase=(k-a/(c-a))/spp*ui;if(nearest===null||Math.abs(phase)<Math.abs(nearest))nearest=phase}}if(nearest!==null)(bits[b]?rises:falls).push(nearest)}
 const crossings=rises.concat(falls),jitter=crossings.length>1?Math.max(...crossings)-Math.min(...crossings):null,mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 return {traces,spp,ui,bits:traces.length,low:lo,high:hi,height:lo===null||hi===null?null:hi-lo,jitter,width:jitter===null?null:Math.max(0,ui-jitter),dcd:rises.length&&falls.length?Math.abs(mean(rises)-mean(falls)):null,crossings:crossings.length}}
};
export const BounceDiagram={events(p,g,count=12){const gl=p.term==='open'||p.term==='capacitive'?1:p.term==='short'?-1:((p.term==='matched'?g.z0:p.zl)-g.z0)/((p.term==='matched'?g.z0:p.zl)+g.z0),gs=(p.zs-g.z0)/(p.zs+g.z0);let wave=p.amplitude*g.z0/(p.zs+g.z0),source=wave,load=0;const events=[];for(let i=0;i<count;i++){const toLoad=i%2===0;if(toLoad)load+=wave*(1+gl);else source+=wave*(1+gs);events.push({from:toLoad?0:1,to:toLoad?1:0,t0:i*g.delay,t1:(i+1)*g.delay,wave,source,load});wave*=toLoad?gl:gs}return {events,gl,gs}}};
export function validate(){let error=0;const p={topology:'micro',w:.38,h:.2,t:35,er:4.4,sigma:58,loss:0,length:100,zs:25,zl:100,term:'resistive',rise:100,amplitude:1,ideal:true};const channel=new LaplaceChannel(p);for(let i=1;i<=80;i++){const t=i*channel.g.delay/8,got=channel.ramp(t,channel.length,24),want=idealRamp(t,{z0:channel.g.z0,zs:p.zs,zl:p.zl,delay:channel.g.delay,rise:1e-10});error=Math.max(error,Math.abs(got-want))}return {error,pass:error<1e-5,samples:80,z0:channel.g.z0}}
export function simulate(p){const start=performance.now(),ch=new LaplaceChannel(p),g=ch.g,ui=1/(p.rate*1e9),duration=Math.max(24*ui,12*g.delay,8*p.zs*p.cin*1e-12),N=1024,dt=duration/N;
 const response=new Float64Array(N+1),position=new Float64Array(N+1);for(let i=0;i<=N;i++){response[i]=ch.ramp(i*dt,ch.length,p.terms);position[i]=p.x===100?response[i]:ch.ramp(i*dt,ch.length*p.x/100,p.terms)}
 const freq=[];for(let i=0;i<800;i++){const f=1e6*(2e10/1e6)**(i/799),a=ch.at(new C(0,2*Math.PI*f)),H=ch.transfer(new C(0,2*Math.PI*f));freq.push({f,db:20*Math.log10(Math.max(1e-15,H.abs())),alpha:8.685889638*a.gamma.re,beta:a.gamma.im})}
 const fn=p.rate*1e9/2,at=ch.at(new C(0,2*Math.PI*fn)),H=ch.transfer(new C(0,2*Math.PI*fn)),eye=EyeEngine.synthesize(response,dt,p,g.delay),vmax=Math.max(...response),vmin=Math.min(...response),steady=response.at(-1);
 const crossing=level=>{for(let i=1;i<=N;i++)if(response[i-1]<level&&response[i]>=level)return ((i-1)+(level-response[i-1])/(response[i]-response[i-1]))*dt;return null},t10=steady>0?crossing(.1*steady):null,t90=steady>0?crossing(.9*steady):null;
 return {p,g,dt,response,position,freq,eye,nyquist:{f:fn,db:20*Math.log10(Math.max(1e-15,H.abs())),gamma:[at.gamma.re,at.gamma.im],gl:[at.gl.re,at.gl.im]},bounce:BounceDiagram.events(p,g),metrics:{vmax,vmin,steady,overshoot:Math.max(0,vmax-steady),undershoot:Math.max(0,-vmin),rise:t10!==null&&t90!==null?t90-t10:null},tail:Math.abs(response.at(-1)-response[N-32]),ms:performance.now()-start}}
