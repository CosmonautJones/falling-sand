import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatch, LEVEL} from '../public/v2/catch/contract.js';
import {getLevel, LEVELS} from '../public/v2/catch/levels.js';
import {createCatchSession} from '../public/v2/catch/session.js';

const line=(x,y,x1)=>({material:'stone',radius:0,points:[{x,y},{x:x1,y}]});
const finish=game=>{
 game.release();
 while(game.status().phase==='run')game.advance(8);
 return game.status();
};

test('chapter ids are distinct and missing ids fall back to the original puzzle',()=>{
 assert.deepEqual(LEVELS.map(level=>level.id),['split-cistern-v1','leakworks-v1','twin-cisterns-v1']);
 assert.equal(getLevel(),LEVEL);
 assert.equal(getLevel('unknown'),LEVEL);
 const session=createCatchSession('twin-cisterns-v1');
 const {ok,status}=session.handle({id:1,type:'init'});
 assert.equal(ok,true);
 assert.equal(status.level,'twin-cisterns-v1');
 assert.equal(status.phase,'build');
 assert.deepEqual(status.receivers.map(r=>r.retained),[0,0]);
});

test('Leakworks requires intervention, and both seams can be patched on budget',()=>{
 const game=createCatch('leakworks-v1');
 const initial=game.checkpoint();
 assert.equal(finish(game).phase,'lost');
 game.retry();
 assert.deepEqual(game.checkpoint(),initial);
 assert.equal(game.place(line(193,128,200)).spent,8);
 assert.equal(game.place(line(219,128,228)).spent,10);
 const won=finish(game);
 assert.equal(won.phase,'won');
 assert.equal(won.budget.stone,3);
 assert.ok(won.retained>=won.quota);
 game.retry();
 assert.deepEqual(game.checkpoint(),initial);
});

test('Twin Cisterns tracks both quotas and cannot win until both are held together',()=>{
 const game=createCatch('twin-cisterns-v1');
 const lost=finish(game);
 assert.equal(lost.phase,'lost');
 assert.equal(lost.tick,lost.deadline);
 assert.ok(lost.receivers[0].retained<lost.receivers[0].quota);
 assert.ok(lost.receivers[1].retained>=lost.receivers[1].quota);
 assert.equal(lost.hold,0);

 game.retry();
 assert.equal(game.place(line(278,129,280)).spent,3);
 game.release();
 let previous=game.status();
 let current=previous;
 while(current.phase==='run'){
  previous=current;
  game.advance();
  current=game.status();
  const bothMet=current.receivers.every(r=>r.retained>=r.quota);
  assert.equal(current.hold,bothMet?previous.hold+1:0);
 }
 assert.equal(current.phase,'won');
 assert.equal(previous.hold,current.holdTicks-1);
 assert.equal(current.hold,current.holdTicks);
 assert.equal(current.retained,current.receivers[0].retained);
 assert.ok(current.receivers.every(r=>r.retained>=r.quota));
});
