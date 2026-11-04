import {LEVELS, getLevel} from './levels.js';
import {createRecords} from './records.js';

const $=id=>document.getElementById(id),canvas=$('vessel'),ctx=canvas.getContext('2d');
const imageCanvas=document.createElement('canvas');imageCanvas.width=480;imageCanvas.height=270;
const imageContext=imageCanvas.getContext('2d'),crop={x:88,y:18,w:272,h:237};
const records=createRecords();
const format=new Intl.NumberFormat(document.documentElement.lang);
const chapterLinks=LEVELS.map((entry,index)=>{
 const link=document.createElement('a');
 const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
 const name=document.createElement('strong');name.textContent=entry.title;
 const result=document.createElement('small');
 link.className='chapter';link.dataset.level=entry.id;link.append(number,name,result);
 $('chapter-nav').append(link);return {entry,link,result};
});
let level,chapter;
let worker,epoch=0,seq=0,pending=new Map(),status=null,pixels=null,material='stone',radius=0;
let paused=false,fatal=false,advancePending=false,lastTime=0,acc=0,gesture=null,preview=null,previewSerial=0,previewTimer=0;
let cursor,keyboardCursor=false,keyboardAnchor=null,storedForPour=false;
function message(text){$('message').textContent=text;}
function unlocked(index){return LEVELS.slice(0,index).every(entry=>records.get(entry));}
function chapterURL(entry){
 const url=new URL(location.href);
 if(url.protocol==='file:')url.hash=entry===LEVELS[0]?'':entry.id;
 else if(entry===LEVELS[0])url.searchParams.delete('level');else url.searchParams.set('level',entry.id);
 return url;
}
function renderChapters(){
 for(const [index,{entry,link,result}] of chapterLinks.entries()){
  const complete=!!records.get(entry),open=unlocked(index);
  link.dataset.complete=String(complete);
  if(index===chapter)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');
  if(open){link.href=chapterURL(entry);link.removeAttribute('aria-disabled');}
  else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
  result.textContent=complete?'Cleared':open?'Open':'Locked';
 }
}
function openChapter(entry,{writeHistory=false,focus=false}={}){
 const index=LEVELS.indexOf(entry);
 if(index<0||!unlocked(index))return;
 level=entry;chapter=index;
 if(writeHistory)history.pushState(null,'',chapterURL(entry));
 $('chapter-title').textContent=entry.title;
 $('chapter-description').textContent=entry.description;
 $('chapter-kicker').textContent=`Chapter ${index+1} of ${LEVELS.length}`;
 $('hint').textContent=entry.hint;$('hint').closest('details').open=false;
 document.title=`${entry.title} · Alembic Waterworks`;
 $('primary-label').textContent=entry.receivers[0].label;
 $('secondary-goal').hidden=entry.receivers.length<2;
 if(entry.receivers[1])$('secondary-label').textContent=entry.receivers[1].label;
 $('objective').textContent=entry.receivers.length===1
  ?`Keep ${format.format(entry.quota)} water in the cistern for ${(entry.holdTicks/60).toFixed(1)}s.`
  :`Meet both cistern quotas at the same time and hold them for ${(entry.holdTicks/60).toFixed(1)}s.`;
 renderChapters();start();
 if(focus)$('chapter-title').focus();
}
function openLocation(){
 const url=new URL(location.href),requested=url.protocol==='file:'?url.hash.slice(1):url.searchParams.get('level');
 const entry=getLevel(requested);
 if(requested&&(entry.id!==requested||!unlocked(LEVELS.indexOf(entry)))){
  const available=LEVELS.findLast((_,index)=>unlocked(index));
  history.replaceState(null,'',chapterURL(available));openChapter(available);return;
 }
 openChapter(entry);
}
function request(type,extra={}) {
 if(fatal||!worker)return Promise.reject(new Error('The worker stopped. Retry to start this vessel again.'));
 const id=++seq;
 return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,...extra});});
}
function fail(text) {
 fatal=true;paused=true;advancePending=false;gesture=null;preview=null;draw();updateControls();
 message(text+' Retry starts this exact vessel again.');
 for(const item of pending.values())item.reject(new Error(text));pending.clear();
}
function start() {
 const thisEpoch=++epoch;worker?.terminate();for(const item of pending.values())item.reject(new Error('Vessel retried.'));pending.clear();
 status=null;pixels=null;fatal=false;paused=false;advancePending=false;gesture=null;preview=null;storedForPour=false;seq=0;acc=0;lastTime=0;previewSerial++;clearTimeout(previewTimer);
 keyboardAnchor=null;keyboardCursor=false;
 setCursor({x:Math.floor((level.build.x0+level.build.x1)/2),y:level.build.y0+20});
 $('next-chapter').hidden=true;$('campaign-complete').hidden=true;
 $('phase').textContent='Preparing the vessel…';$('clock').textContent='';
 $('preview').textContent='Drag a line. Only new cells cost material.';
 document.body.dataset.phase='loading';
 updateControls();showRecords();draw();message('Preparing the vessel…');
 try {
  const url=new URL('./worker.js',import.meta.url);url.searchParams.set('level',level.id);
  worker=new Worker(url,{type:'module'});
  worker.onerror=e=>{if(thisEpoch!==epoch)return;e.preventDefault();fail('The simulation stopped.');};
  worker.onmessageerror=()=>{if(thisEpoch===epoch)fail('The simulation reply could not be read.');};
  worker.onmessage=({data})=>{
   if(thisEpoch!==epoch)return;
   const waiting=pending.get(data.id);if(!waiting)return;pending.delete(data.id);
   if(!data.ok){waiting.reject(new Error(data.error));return;}
   status=data.status;if(data.pixels){pixels=data.pixels;draw();}renderStatus();waiting.resolve(data);
  };
  request('init').then(()=>message('Build in the dotted area, then release the water.')).catch(e=>{if(thisEpoch===epoch&&!fatal)fail(e.message);});
 }catch{fail('This browser could not start the simulation worker.');}
}
function updateControls(){
 const build=!!status&&status.phase==='build'&&!fatal,run=!!status&&status.phase==='run'&&!fatal;
 $('release').disabled=!build||!!gesture;$('undo').disabled=!build||!status?.canUndo||!!gesture;
 $('pause').disabled=!run;$('step').disabled=!run||!paused;$('pause').textContent=paused?'Resume':'Pause';
 for(const el of document.querySelectorAll('[data-material],[data-radius]'))el.disabled=!build;
}
function renderStatus(){
 const s=status;if(!s)return;
 document.body.dataset.phase=s.phase;
 $('phase').textContent=({build:'Build your route',run:paused?'Pour paused':'Water released',won:'Chapter cleared',lost:'Try another route'})[s.phase];
 $('clock').textContent=s.phase==='build'?`${s.deadline/60}s to catch the water`:((s.deadline-s.tick)/60).toFixed(1)+'s left';
 $('stone').textContent=s.budget.stone;$('sand').textContent=s.budget.sand;
 s.receivers.forEach((receiver,index)=>{
  const suffix=index===0?'':'-second',meter=$('caught'+suffix);
  meter.max=receiver.quota;meter.value=receiver.retained;
  $('caught-count'+suffix).textContent=`${format.format(receiver.retained)} / ${format.format(receiver.quota)}`;
 });
 $('hold').max=s.holdTicks;$('hold').value=s.hold;$('hold-count').textContent=`${s.hold} / ${s.holdTicks} ticks`;updateControls();
 if(s.phase==='won'&&!storedForPour){
  storedForPour=true;records.save(level,s);showRecords();renderChapters();
  const next=LEVELS[chapter+1],complete=LEVELS.every(entry=>records.get(entry));
  if(next){const link=$('next-chapter');link.href=chapterURL(next);link.dataset.level=next.id;link.textContent=`Continue to ${next.title} →`;link.hidden=false;}
  $('campaign-complete').hidden=!complete||!!next;
  message(next?'Quota held. The next chapter is open.':'Quota held. You restored the Waterworks.');
 }else if(s.phase==='lost')message('Time ran out before the quota held. Retry or open the hint below the vessel.');
}
function showRecords(){const r=records.get(level);$('records').textContent=r?`Fewest cells: ${r.cells} · Fastest catch: ${(r.ticks/60).toFixed(2)}s`:'Your best cost and best time are tracked separately.';}
function draw(){
 ctx.imageSmoothingEnabled=false;
 if(pixels){imageContext.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer,pixels.byteOffset,pixels.byteLength),480,270),0,0);ctx.drawImage(imageCanvas,crop.x,crop.y,crop.w,crop.h,0,0,544,474);}
 else{ctx.fillStyle='#0e0e14';ctx.fillRect(0,0,544,474);}
 ctx.save();ctx.scale(2,2);ctx.translate(-crop.x,-crop.y);
 const b=level.build;
 ctx.lineWidth=.7;ctx.strokeStyle='#d6b060';ctx.setLineDash([3,3]);ctx.strokeRect(b.x0-.5,b.y0-.5,b.x1-b.x0+1,b.y1-b.y0+1);ctx.setLineDash([]);
 ctx.font='6px Georgia';ctx.lineWidth=1;
 for(const r of level.receivers){
  ctx.strokeStyle='#93c8fb';ctx.strokeRect(r.x0-.5,r.y0-.5,r.x1-r.x0+1,r.y1-r.y0+1);
  ctx.fillStyle='#adcae8';ctx.fillText(r.label,r.x0+7,r.y0-5);
 }
 ctx.fillStyle='#d3b479';ctx.fillText('Build here',b.x0+4,b.y1-4);
 ctx.fillStyle='#c8d8e9';ctx.fillText(`${format.format(level.sourceCells)} water`,level.sourceLabel.x,level.sourceLabel.y);
 if(preview&&status?.phase==='build'){ctx.fillStyle=preview.affordable?'#dfcb8aaa':'#f08f8faa';for(const i of preview.cells)ctx.fillRect(i%480,Math.floor(i/480),1,1);}
 if(keyboardCursor&&status?.phase==='build'){ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(cursor.x-4,cursor.y);ctx.lineTo(cursor.x+4,cursor.y);ctx.moveTo(cursor.x,cursor.y-4);ctx.lineTo(cursor.x,cursor.y+4);ctx.stroke();}
 if(keyboardAnchor&&status?.phase==='build'){ctx.strokeStyle='#fff';ctx.strokeRect(keyboardAnchor.x-2,keyboardAnchor.y-2,4,4);}
 ctx.restore();
}
function point(event){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(479,Math.floor(crop.x+(event.clientX-r.left)/r.width*crop.w))),y:Math.max(0,Math.min(269,Math.floor(crop.y+(event.clientY-r.top)/r.height*crop.h)))};}
function setCursor(p){cursor=p;$('cursor').textContent='Cursor '+p.x+', '+p.y;}
function stroke(){return {material,radius,points:gesture?[gesture.from,gesture.to]:keyboardAnchor?[keyboardAnchor,cursor]:[cursor]};}
function askPreview(){
 const token=++previewSerial,entryEpoch=epoch,s=stroke();clearTimeout(previewTimer);
 previewTimer=setTimeout(()=>request('preview',{stroke:s}).then(reply=>{
  if(token!==previewSerial||entryEpoch!==epoch||status?.phase!=='build')return;
  preview=reply.result;$('preview').textContent=preview.cost+' new '+s.material+' cells'+(preview.affordable?'':' — over budget; nothing will be placed');draw();
 }).catch(()=>{}),35);
}
async function commit(s){
 const entryEpoch=epoch;previewSerial++;clearTimeout(previewTimer);preview=null;draw();
 try{const reply=await request('place',{stroke:s});if(entryEpoch===epoch)message(reply.result.reason);}catch(e){if(entryEpoch===epoch&&!fatal)message(e.message);}
}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!status||status.phase!=='build'||fatal||gesture)return;
 e.preventDefault();keyboardCursor=false;keyboardAnchor=null;setCursor(point(e));gesture={id:e.pointerId,from:cursor,to:cursor};
 canvas.setPointerCapture(e.pointerId);askPreview();updateControls();
});
canvas.addEventListener('pointermove',e=>{
 if(status?.phase!=='build')return;if(!gesture&&keyboardCursor)return;setCursor(point(e));if(gesture?.id===e.pointerId){gesture.to=cursor;askPreview();}
 else if(!gesture)askPreview();
});
canvas.addEventListener('pointerup',e=>{
 if(gesture?.id!==e.pointerId)return;gesture.to=point(e);const s=stroke();gesture=null;canvas.releasePointerCapture(e.pointerId);updateControls();commit(s);
});
function cancelGesture(){gesture=null;keyboardAnchor=null;preview=null;previewSerial++;clearTimeout(previewTimer);draw();updateControls();}
canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
canvas.addEventListener('keydown',e=>{
 if(status?.phase!=='build')return;
 const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(delta){e.preventDefault();keyboardCursor=true;const n=e.shiftKey?10:1,b=level.build;setCursor({x:Math.max(b.x0,Math.min(b.x1,cursor.x+delta[0]*n)),y:Math.max(b.y0,Math.min(b.y1,cursor.y+delta[1]*n))});askPreview();draw();}
 else if(e.key==='Enter'){e.preventDefault();if(!e.repeat){keyboardCursor=true;keyboardAnchor=cursor;askPreview();draw();message('Line start marked. Move the cursor, then press Space to build.');}}
 else if(e.key===' '){e.preventDefault();if(!e.repeat){const line=stroke();keyboardAnchor=null;commit(line);}}
 else if(e.key==='Escape')cancelGesture();
});
for(const el of document.querySelectorAll('[data-material]'))el.addEventListener('click',()=>{material=el.dataset.material;for(const b of document.querySelectorAll('[data-material]'))b.setAttribute('aria-pressed',String(b===el));askPreview();});
for(const el of document.querySelectorAll('[data-radius]'))el.addEventListener('click',()=>{radius=Number(el.dataset.radius);for(const b of document.querySelectorAll('[data-radius]'))b.setAttribute('aria-pressed',String(b===el));askPreview();});
async function command(type){const e=epoch;try{const reply=await request(type);if(e===epoch&&reply.result?.reason)message(reply.result.reason);}catch(error){if(e===epoch&&!fatal)message(error.message);}}
$('release').addEventListener('click',()=>{previewSerial++;preview=null;clearTimeout(previewTimer);acc=0;lastTime=0;command('release');});
$('undo').addEventListener('click',()=>command('undo'));
$('pause').addEventListener('click',()=>{paused=!paused;acc=0;lastTime=0;renderStatus();});
$('step').addEventListener('click',()=>{if(paused&&!advancePending)advance(1);});
$('retry').addEventListener('click',start);
function followChapter(event){
 const link=event.target.closest('a[data-level]');
 if(!link||!link.hasAttribute('href')||event.button!==0||event.ctrlKey||event.shiftKey||event.altKey||event.metaKey)return;
 event.preventDefault();const entry=getLevel(link.dataset.level);
 if(entry!==level)openChapter(entry,{writeHistory:true,focus:true});
}
$('chapter-nav').addEventListener('click',followChapter);
$('next-chapter').addEventListener('click',followChapter);
window.addEventListener('popstate',openLocation);
document.addEventListener('visibilitychange',()=>{
 acc=0;lastTime=0;if(document.hidden&&status?.phase==='run'){paused=true;renderStatus();message('The pour paused while this tab was hidden. Resume when ready.');}
 if(document.hidden)cancelGesture();
});
function advance(ticks){
 const e=epoch;advancePending=true;
 request('advance',{ticks}).catch(error=>{if(e===epoch&&!fatal)fail(error.message);}).finally(()=>{if(e===epoch)advancePending=false;});
}
function frame(now){
 const dt=lastTime?Math.min(100,Math.max(0,now-lastTime)):0;lastTime=now;
 if(status?.phase==='run'&&!paused&&!fatal&&!document.hidden){
  acc=Math.min(250,acc+dt);if(!advancePending){const n=Math.min(8,Math.floor(acc/(1000/60)));if(n){acc-=n*(1000/60);advance(n);}}
 }else acc=0;
 requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>worker?.terminate());
window.addEventListener('pageshow',event=>{if(event.persisted)fail('This vessel was suspended when you left.');});
openLocation();requestAnimationFrame(frame);
