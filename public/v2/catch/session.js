import {createCatch} from './contract.js';

// FIFO worker requests; no wall clock, timers, browser storage or sandbox adapter.
export function createCatchSession() {
 const game=createCatch();let lastId=0;
 return {handle(request) {
  const id=request?.id;
  try {
   if(!Number.isSafeInteger(id)||id<=lastId)throw new Error('Stale challenge request.');
   lastId=id;let result;
   switch(request.type) {
    case 'init':result={reason:'Build a route, then release the finite reservoir.'};break;
    case 'preview':result=game.preview(request.stroke);break;
    case 'place':result=game.place(request.stroke);break;
    case 'undo':result=game.undo();break;
    case 'release':result=game.release();break;
    case 'advance':
     if(!Number.isInteger(request.ticks)||request.ticks<0||request.ticks>8)throw new Error('Invalid fixed-tick batch.');
     game.advance(request.ticks);break;
    default:throw new Error('Unknown challenge command.');
   }
   return {id,ok:true,status:game.status(),result,...(request.type==='preview'?{}:{pixels:game.render()})};
  }catch(error){return {id,ok:false,error:error.message,status:game.status()};}
 }};
}
