const FIRST_KEY='alembic-v2-catch-records-v1';

function key(level){return level.id==='split-cistern-v1'?FIRST_KEY:`alembic-waterworks-record-${level.id}`;}

function valid(level,record){
 return record?.level===level.id&&Number.isInteger(record.cells)&&record.cells>=0&&
  record.cells<=level.budget.stone+level.budget.sand&&Number.isInteger(record.ticks)&&
  record.ticks>=level.holdTicks&&record.ticks<=level.deadline;
}

function best(a,b){return {...a,cells:Math.min(a.cells,b.cells),ticks:Math.min(a.ticks,b.ticks)};}

export function createRecords(storage=()=>globalThis.localStorage){
 const session=new Map();
 function get(level){
  const local=session.get(level.id);
  try{
   const saved=JSON.parse(storage().getItem(key(level)));
   if(valid(level,saved))return local?best(saved,local):saved;
  }catch{}
  return local??null;
 }
 function save(level,status){
  if(status.phase!=='won'||status.level!==level.id)return;
  const entry={level:level.id,cells:status.spent.stone+status.spent.sand,ticks:status.tick};
  if(!valid(level,entry))return;
  const old=get(level),record=old?best(old,entry):entry;
  session.set(level.id,record);
  try{storage().setItem(key(level),JSON.stringify(record));}catch{}
 }
 return {get,save};
}
