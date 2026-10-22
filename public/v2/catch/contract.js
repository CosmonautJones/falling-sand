import {createWorld, AIR, STONE, SAND, WATER, W, H, N} from '../engine/world.js';

// Authored fixture v1. No ambient sources, weather, free paint or sandbox storage.
export const LEVEL = Object.freeze({
 id:'split-cistern-v1', seed:0x504f5552, sourceCells:2000, quota:1320, holdTicks:60, deadline:900,
 budget:Object.freeze({stone:160,sand:240}),
 build:Object.freeze({x0:104,y0:90,x1:343,y1:179}),
 receiver:Object.freeze({x0:236,y0:190,x1:345,y1:245}),
});
const materials={stone:STONE,sand:SAND};
export function evaluateHold(previous,retained) {
 const hold=retained>=LEVEL.quota?previous.hold+1:0;
 return {hold,won:hold>=LEVEL.holdTicks};
}
function footprint(stroke) {
 if(!stroke || !Object.hasOwn(materials,stroke.material) || !Number.isInteger(stroke.radius) || stroke.radius<0 || stroke.radius>4 ||
  !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length>512 ||
  stroke.points.some(p=>!p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < -4 || p.x>=W+4 || p.y < -4 || p.y>=H+4))
  throw new Error('Choose stone or sand, a 1–9 cell brush, and a bounded stroke.');
 const cells=new Set(),r=stroke.radius;
 const stamp=(cx,cy)=>{for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)
  if(x>=0&&x<W&&y>=0&&y<H&&(x-cx)**2+(y-cy)**2<=r*r)cells.add(y*W+x);};
 stamp(stroke.points[0].x,stroke.points[0].y);
 for(let i=1;i<stroke.points.length;i++){
  let {x,y}=stroke.points[i-1];const end=stroke.points[i],dx=Math.abs(end.x-x),dy=-Math.abs(end.y-y),sx=x<end.x?1:-1,sy=y<end.y?1:-1;
  let err=dx+dy;while(x!==end.x||y!==end.y){const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}stamp(x,y);}
 }
 return [...cells];
}

export function createCatch() {
 let world,view,phase,tick,retained,goal,budget,history; const emis=new Uint8Array(N*4),fx=new Uint8Array(N*4);
 const box=(x0,y0,x1,y1,m)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)view.setc(x,y,m,0);};
 function retry() {
  world=createWorld({seed:LEVEL.seed,scene:'empty',weather:false,ambientEmbers:false});view=world.inspect();
  box(98,90,101,249,STONE);box(346,90,349,249,STONE);box(98,246,349,249,STONE);box(228,150,235,249,STONE);
  box(100,130,347,133,STONE);box(142,130,157,133,AIR);box(278,130,293,133,AIR);
  box(166,28,169,83,STONE);box(250,28,253,83,STONE);box(166,80,253,83,STONE);box(170,35,249,59,WATER);
  phase='build';tick=0;retained=0;goal={hold:0,won:false};budget={...LEVEL.budget};history=[];
  return status();
 }
 function status() {

  return {level:LEVEL.id,phase,tick,retained,quota:LEVEL.quota,hold:goal.hold,holdTicks:LEVEL.holdTicks,deadline:LEVEL.deadline,
   budget:{...budget},spent:{stone:LEVEL.budget.stone-budget.stone,sand:LEVEL.budget.sand-budget.sand},
   sourceCells:LEVEL.sourceCells,canUndo:phase==='build'&&history.length>0};
 }
 function preview(stroke) {
  const all=footprint(stroke),b=LEVEL.build;
  const cells=all.filter(i=>{const x=i%W,y=Math.floor(i/W);return x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1&&view.cells[i]===AIR;});
  return {cells,cost:cells.length,affordable:phase==='build'&&cells.length<=budget[stroke.material]};
 }
 function place(stroke) {
  const p=preview(stroke);
  if(phase!=='build')return {ok:false,spent:0,reason:'Construction is locked during the pour. Retry to build again.'};
  if(!p.affordable)return {ok:false,spent:0,reason:'Not enough '+stroke.material+'. Shorten the stroke or undo.'};
  if(!p.cost)return {ok:true,spent:0,reason:'No empty cells in the build area.'};
  for(const i of p.cells)view.setc(i%W,Math.floor(i/W),materials[stroke.material],0);
  budget[stroke.material]-=p.cost;history.push({material:stroke.material,cells:p.cells});
  return {ok:true,spent:p.cost,reason:p.cost+' '+stroke.material+' placed.'};
 }
 function undo() {
  if(phase!=='build'||!history.length)return {ok:false,reason:'Undo is available after building, before release.'};
  const last=history.pop();for(const i of last.cells)view.setc(i%W,Math.floor(i/W),AIR,0);
  budget[last.material]+=last.cells.length;return {ok:true,reason:last.cells.length+' '+last.material+' returned.'};
 }
 function release() {
  if(phase!=='build')return {ok:false,reason:'This pour is already released.'};
  box(202,80,217,83,AIR);phase='run';history=[];return {ok:true,reason:'Valve open. Construction is locked.'};
 }
 function advance(count=1) {
  if(!Number.isInteger(count)||count<0||count>900)throw new Error('Advance must be 0–900 fixed ticks.');
  for(let n=0;n<count&&phase==='run';n++){
   world.advanceTicks(1);tick++;retained=0;const b=LEVEL.receiver;
   for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)if(view.cells[y*W+x]===WATER)retained++;
   goal=evaluateHold(goal,retained);
   if(goal.won)phase='won';else if(tick>=LEVEL.deadline)phase='lost';
  }
 }
 function checkpoint() {return {world:world.captureState(),phase,tick,retained,goal:{...goal},budget:{...budget},history:structuredClone(history)};}
 function render(color=new Uint8Array(N*4)) {
  world.render(color,emis,fx,tick);
  // The simulation stores material id in alpha; the challenge uses ordinary canvas pixels.
  for(let i=3;i<color.length;i+=4)color[i]=255;return color;
 }
 retry();return {status,preview,place,undo,release,advance,retry,checkpoint,render};
}
