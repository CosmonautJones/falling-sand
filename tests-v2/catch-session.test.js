import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatchSession} from '../public/v2/catch/session.js';

test('worker contract initializes an empty-scene challenge, renders and rejects invalid batches',()=>{
 const s=createCatchSession(),initial=s.handle({id:1,type:'init'});
 assert.equal(initial.ok,true);assert.equal(initial.status.phase,'build');assert.equal(initial.pixels.length,480*270*4);
 assert.equal(initial.pixels[3],255);
 assert.equal(s.handle({id:2,type:'advance',ticks:9}).ok,false);
 assert.equal(s.handle({id:2,type:'release'}).ok,false);
 assert.equal(s.handle({id:3,type:'init'}).status.tick,0);
});
test('worker FIFO places before release, locks late edits, and fresh session is exact retry',()=>{
 const a=createCatchSession();a.handle({id:1,type:'init'});
 const place=a.handle({id:2,type:'place',stroke:{material:'stone',radius:0,points:[{x:180,y:110}]}});
 assert.equal(place.result.spent,1);assert.equal(a.handle({id:3,type:'release'}).status.phase,'run');
 assert.equal(a.handle({id:4,type:'place',stroke:{material:'stone',radius:0,points:[{x:181,y:110}]}}).result.ok,false);
 assert.equal(a.handle({id:5,type:'advance',ticks:8}).status.tick,8);
 const b=createCatchSession(),c=createCatchSession();assert.deepEqual(b.handle({id:1,type:'init'}),c.handle({id:1,type:'init'}));
});
