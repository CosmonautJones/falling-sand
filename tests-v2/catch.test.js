import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatch, LEVEL, evaluateHold} from '../public/v2/catch/contract.js';

const stroke=(x,y,x1=x,y1=y,radius=0,material='stone')=>({points:[{x,y},{x:x1,y:y1}],radius,material});
const wall=()=>({points:Array.from({length:26},(_,i)=>[{x:i%2?197:195,y:104+i},{x:i%2?195:197,y:104+i}]).flat(),radius:0,material:'stone'});
const finish=(game,batch=8)=>{while(game.status().phase==='run')game.advance(batch);return game.status();};

test('Catch starts with one finite 2000-cell charge and independent state',()=>{
 const a=createCatch(),b=createCatch();assert.deepEqual(a.checkpoint(),b.checkpoint());
 assert.equal(a.status().sourceCells,2000);assert.equal(a.status().phase,'build');
 assert.equal(a.place(stroke(180,110)).spent,1);assert.equal(b.status().budget.stone,LEVEL.budget.stone);
});
test('overlap, protected areas and out-of-bounds placement are strict no-ops',()=>{
 const g=createCatch();g.place(stroke(180,110));const before=g.checkpoint();
 for(const s of [stroke(180,110),stroke(210,45),stroke(280,225),stroke(-1,-1),stroke(110,131)])assert.equal(g.place(s).spent,0);
 assert.deepEqual(g.checkpoint(),before);
});
test('atomic over-budget rejection and previews preserve world and RNG',()=>{
 const g=createCatch(),s=stroke(110,100,340,100);const before=g.checkpoint();
 const preview=g.preview(s);assert.equal(preview.cost,231);assert.equal(preview.affordable,false);
 assert.deepEqual(g.checkpoint(),before);assert.equal(g.place(s).ok,false);assert.deepEqual(g.checkpoint(),before);
});
test('invalid tools, unbounded input and late construction are rejected',()=>{
 const g=createCatch();for(const s of [stroke(180,110,180,110,0,'water'),stroke(180,110,180,110,99),{points:[]}])assert.throws(()=>g.place(s));
 g.release();const before=g.checkpoint();assert.equal(g.place(stroke(180,110)).ok,false);assert.equal(g.undo().ok,false);
 assert.deepEqual(g.checkpoint(),before);assert.equal(g.release().ok,false);
});
test('undo refunds exactly the accepted cells and restores the build checkpoint',()=>{
 const g=createCatch(),before=g.checkpoint();const s=stroke(180,110,190,110,1);
 const preview=g.preview(s),result=g.place(s);assert.equal(result.spent,preview.cost);
 assert.equal(g.status().budget.stone,LEVEL.budget.stone-result.spent);
 assert.equal(g.undo().ok,true);assert.deepEqual(g.checkpoint(),before);
});
test('quota needs 60 consecutive ticks and a dip resets the streak',()=>{
 let goal={hold:0,won:false};for(let i=0;i<59;i++)goal=evaluateHold(goal,LEVEL.quota);
 assert.equal(goal.won,false);assert.equal(goal.hold,59);
 assert.equal(evaluateHold(goal,LEVEL.quota).won,true);
 goal=evaluateHold(goal,LEVEL.quota-1);assert.equal(goal.hold,0);
});
test('no construction fails honestly at the deadline',()=>{
 const g=createCatch();g.release();const s=finish(g);
 assert.equal(s.phase,'lost');assert.equal(s.tick,LEVEL.deadline);assert.ok(s.retained<LEVEL.quota);assert.equal(g.checkpoint().world.cells.filter(m=>m===2).length,2000);
});
test('two distinct finite constructions win; committed batching preserves full state',()=>{
 const a=createCatch();assert.equal(a.place(stroke(142,129,157,129)).spent,16);a.release();
 const sa=finish(a);assert.equal(sa.phase,'won');assert.ok(sa.hold>=LEVEL.holdTicks);
 const b=createCatch();b.place(wall());b.release();assert.equal(finish(b).phase,'won');
 const c=createCatch();c.place(wall());c.release();finish(c,1);assert.deepEqual(c.checkpoint(),b.checkpoint());
 assert.notEqual(a.status().spent.stone,b.status().spent.stone);
});
test('retry after failure or success restores every world and controller field',()=>{
 const g=createCatch(),initial=g.checkpoint();g.place(wall());g.release();finish(g);g.retry();
 assert.deepEqual(g.checkpoint(),initial);g.release();finish(g);g.retry();assert.deepEqual(g.checkpoint(),initial);
});
