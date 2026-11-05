import {createCatchSession} from './session.js';
const session=createCatchSession(new URL(self.location.href).searchParams.get('level'));
self.onmessage=({data})=>{
 const reply=session.handle(data);
 self.postMessage(reply,reply.pixels?[reply.pixels.buffer]:[]);
};
