import test from 'node:test';
import assert from 'node:assert/strict';
import {Complex as C,PRBS,TalbotInverter as T,idealRamp} from './numerics.mjs';
test('principal complex square root and arithmetic',()=>{assert.ok(new C(-4).sqrt().sub(new C(0,2)).abs()<1e-12);const z=new C(3,-4);assert.ok(z.div(z).sub(1).abs()<1e-12);assert.ok(z.sqrt().mul(z.sqrt()).sub(z).abs()<1e-12)});
test('PRBS maximal periods and balanced populations',()=>{for(const n of [7,15]){const period=2**n-1,bits=PRBS.generate(n,period*2);assert.deepEqual(bits.slice(0,period),bits.slice(period));assert.equal(bits.slice(0,period).reduce((a,b)=>a+b),2**(n-1));const words=new Set();for(let i=0;i<period;i++)words.add(Array.from(bits.slice(i,i+n)).join(''));assert.equal(words.size,period)}});
test('Talbot known transforms across time scales',()=>{for(const t of [1e-12,1e-9,.1,1,5]){assert.ok(Math.abs(T.invert(s=>new C(1).div(s),t)-1)<1e-6);assert.ok(Math.abs(T.invert(s=>new C(1).div(s.mul(s)),t)/t-1)<1e-6)}assert.ok(Math.abs(T.invert(s=>new C(1).div(s.add(2)),1)-Math.exp(-2))<1e-6)});
test('causal delay and ideal reflection amplitudes',()=>{assert.equal(T.delayed(s=>new C(1).div(s),.5,1),0);assert.equal(idealRamp(2e-9,{zs:50,zl:50}),.5);assert.equal(idealRamp(2e-9,{zs:50,zl:Infinity}),1);assert.equal(idealRamp(2e-9,{zs:50,zl:0}),0);assert.ok(Math.abs(idealRamp(100e-9,{zs:25,zl:100})-.8)<1e-10)});
