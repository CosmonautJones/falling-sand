import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS} from '../public/v2/catch/levels.js';
import {createRecords} from '../public/v2/catch/records.js';

const [first, second]=LEVELS;
const result=(level,cells,tick,phase='won')=>({level:level.id,phase,tick,spent:{stone:cells,sand:0}});

test('legacy Catch records count and best cost and time are independent by chapter',()=>{
 const data=new Map([['alembic-v2-catch-records-v1',JSON.stringify({level:first.id,cells:16,ticks:466})]]);
 const storage=()=>({getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)});
 const records=createRecords(storage);
 assert.equal(records.get(first).cells,16);
 records.save(first,result(first,78,301));
 records.save(second,result(second,18,481));
 assert.deepEqual(createRecords(storage).get(first),{level:first.id,cells:16,ticks:301});
 assert.deepEqual(createRecords(storage).get(second),{level:second.id,cells:18,ticks:481});
});

test('blocked storage keeps session clears and rejects loss or mismatched results',()=>{
 const records=createRecords(()=>{throw new Error('Blocked');});
 records.save(first,result(first,0,900,'lost'));
 records.save(first,result(second,18,481));
 assert.equal(records.get(first),null);
 records.save(first,result(first,16,466));
 assert.equal(records.get(first).ticks,466);
 assert.equal(records.get(second),null);
});
