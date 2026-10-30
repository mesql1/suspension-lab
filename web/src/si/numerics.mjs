// Numerical foundations for SI-Wave. SI units throughout.
export class Complex {
  constructor(re=0,im=0){this.re=re;this.im=im}
  static of(z){return z instanceof Complex?z:new Complex(z)}
  add(z){z=Complex.of(z);return new Complex(this.re+z.re,this.im+z.im)}
  sub(z){z=Complex.of(z);return new Complex(this.re-z.re,this.im-z.im)}
  mul(z){z=Complex.of(z);return new Complex(this.re*z.re-this.im*z.im,this.re*z.im+this.im*z.re)}
  div(z){z=Complex.of(z);if(!z.abs())throw new RangeError('Divisão complexa por zero');const scale=Math.max(Math.abs(z.re),Math.abs(z.im)),a=z.re/scale,b=z.im/scale,d=a*a+b*b;return new Complex((this.re/scale*a+this.im/scale*b)/d,(this.im/scale*a-this.re/scale*b)/d)}
  abs(){return Math.hypot(this.re,this.im)}
  arg(){return Math.atan2(this.im,this.re)}
  exp(){const r=Math.exp(this.re);return new Complex(r*Math.cos(this.im),r*Math.sin(this.im))}
  sqrt(){const r=this.abs();return new Complex(Math.sqrt(Math.max(0,(r+this.re)/2)),(this.im<0?-1:1)*Math.sqrt(Math.max(0,(r-this.re)/2)))}
}
export const PRBS={
  generate(order=7,count=1024){if(![7,15].includes(order))throw new RangeError('PRBS: ordem 7 ou 15');let state=(1<<order)-1;const out=new Uint8Array(count),mask=(1<<order)-1;for(let i=0;i<count;i++){out[i]=(state>>(order-1))&1;const feedback=((state>>(order-1))^(state>>(order-2)))&1;state=((state<<1)|feedback)&mask}return out}
};
// Fixed Talbot, r=2M/5 (Abate–Valkó). Float64: increasing M indefinitely
// loses precision through cancellation. Delays MUST be removed analytically
// before inversion; exp(-s*delay) diverges on the left-hand contour.
export const TalbotInverter={
  invert(F,t,M=24){if(t<=0)return 0;if(!Number.isInteger(M)||M<8||M>32)throw new RangeError('Talbot: 8–32 termos');const r=2*M/5;let sum=F(new Complex(r/t)).re*Math.exp(r)/2;for(let k=1;k<M;k++){const theta=k*Math.PI/M,cot=1/Math.tan(theta),delta=new Complex(r*theta*cot,r*theta),weight=new Complex(1,theta*(1+cot*cot)-cot);sum+=delta.exp().mul(weight).mul(F(delta.div(t))).re}const answer=2*sum/(5*t);if(!Number.isFinite(answer))throw new RangeError('Inversão não convergiu');return answer},
  delayed(F,t,delay,M=24){return t<=delay?0:this.invert(F,t-delay,M)}
};
// Ideal resistive line: independent reference for subsequent channel tests.
export function idealRamp(t,{z0=50,zs=25,zl=100,delay=1e-9,rise=1e-10,amplitude=1}={}){
 const gl=zl===Infinity?1:(zl-z0)/(zl+z0),gs=(zs-z0)/(zs+z0),a=amplitude*z0/(zs+z0)*(1+gl);let total=0,weight=1;
 for(let n=0;n<10000;n++){const u=t-(2*n+1)*delay;if(u<=0)break;total+=a*weight*Math.min(1,u/rise);weight*=gs*gl;if(Math.abs(weight)<1e-14)break}return total;
}
