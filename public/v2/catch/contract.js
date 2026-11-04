import {createWorld, AIR, STONE, SAND, WATER, W, H, N} from '../engine/world.js';
import {getLevel, LEVELS} from './levels.js';

export const LEVEL=LEVELS[0];
const materials={stone:STONE,sand:SAND};
export function evaluateHold(previous,retained) {
 return evaluateReceivers(previous,[retained],LEVEL);
}
function evaluateReceivers(previous,counts,level) {
 const hold=level.receivers.every((receiver,i)=>counts[i]>=receiver.quota)?previous.hold+1:0;
 return {hold,won:hold>=level.holdTicks};
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

export function createCatch(levelId) {
 const level=getLevel(levelId);
 let world,view,phase,tick,counts,goal,budget,history; const emis=new Uint8Array(N*4),fx=new Uint8Array(N*4);
 const box=({x0,y0,x1,y1},m)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)view.setc(x,y,m,0);};
 function retry() {
  world=createWorld({seed:level.seed,scene:'empty',weather:false,ambientEmbers:false});view=world.inspect();
  for(const wall of level.stone)box(wall,STONE);
  for(const hole of level.cutouts)box(hole,AIR);
  box(level.source,WATER);
  phase='build';tick=0;counts=level.receivers.map(()=>0);goal={hold:0,won:false};budget={...level.budget};history=[];
  return status();
 }
 function status() {

  return {level:level.id,phase,tick,retained:counts[0],quota:level.quota,hold:goal.hold,holdTicks:level.holdTicks,deadline:level.deadline,
   receivers:level.receivers.map((receiver,i)=>({...receiver,retained:counts[i]})),
   budget:{...budget},spent:{stone:level.budget.stone-budget.stone,sand:level.budget.sand-budget.sand},
   sourceCells:level.sourceCells,canUndo:phase==='build'&&history.length>0};
 }
 function preview(stroke) {
  const all=footprint(stroke),b=level.build;
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
  box(level.valve,AIR);phase='run';history=[];return {ok:true,reason:'Valve open. Construction is locked.'};
 }
 function advance(count=1) {
  if(!Number.isInteger(count)||count<0||count>900)throw new Error('Advance must be 0–900 fixed ticks.');
  for(let n=0;n<count&&phase==='run';n++){
   world.advanceTicks(1);tick++;
   for(let i=0;i<level.receivers.length;i++){
    const b=level.receivers[i];let retained=0;
    for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)if(view.cells[y*W+x]===WATER)retained++;
    counts[i]=retained;
   }
   goal=evaluateReceivers(goal,counts,level);
   if(goal.won)phase='won';else if(tick>=level.deadline)phase='lost';
  }
 }
 function checkpoint() {return {world:world.captureState(),phase,tick,retained:counts[0],counts:[...counts],goal:{...goal},budget:{...budget},history:structuredClone(history)};}
 function render(color=new Uint8Array(N*4)) {
  world.render(color,emis,fx,tick);
  // The simulation stores material id in alpha; the challenge uses ordinary canvas pixels.
  for(let i=3;i<color.length;i+=4)color[i]=255;return color;
 }
 retry();return {status,preview,place,undo,release,advance,retry,checkpoint,render};
}
