import {createCatchSession} from './session.js';
const session=createCatchSession();
self.onmessage=({data})=>{
 const reply=session.handle(data);
 self.postMessage(reply,reply.pixels?[reply.pixels.buffer]:[]);
};
