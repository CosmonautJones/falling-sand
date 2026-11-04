const rect=(x0,y0,x1,y1)=>Object.freeze({x0,y0,x1,y1});
const cistern=(label,quota,x0,y0,x1,y1)=>Object.freeze({label,quota,...rect(x0,y0,x1,y1)});

function level({id,title,description,hint,seed=0x504f5552,budget,build,receivers,stone,cutouts,sourceX=170,holdTicks=60,deadline=900}) {
 const source=rect(sourceX,35,sourceX+79,59);
 const receiver=receivers[0];
 return Object.freeze({id,title,description,hint,seed,sourceCells:2000,sourceLabel:Object.freeze({x:sourceX+11,y:26}),
  quota:receiver.quota,holdTicks,deadline,budget:Object.freeze(budget),build,receiver,receivers:Object.freeze(receivers),
  stone:Object.freeze([...stone,rect(sourceX-4,28,sourceX-1,83),rect(sourceX+80,28,sourceX+83,83),rect(sourceX-4,80,sourceX+83,83)]),
  cutouts:Object.freeze(cutouts),source,valve:rect(sourceX+32,80,sourceX+47,83)});
}

const splitShelf=[rect(98,90,101,249),rect(346,90,349,249),rect(98,246,349,249),rect(228,150,235,249),rect(100,130,347,133)];
const splitOutlets=[rect(142,130,157,133),rect(278,130,293,133)];

export const LEVELS=Object.freeze([
 level({id:'split-cistern-v1',title:'Catch the Pour',
  description:'One reservoir. Two ways down. Build a route to the blue cistern.',
  hint:'Watch which outlet feeds the blue cistern. A thin stone cap can close the other one.',
  budget:{stone:160,sand:240},build:rect(104,90,343,179),
  receivers:[cistern('Blue cistern',1320,236,190,345,245)],stone:splitShelf,cutouts:splitOutlets}),
 level({id:'leakworks-v1',title:'The Leakworks',
  description:'Two leaks drain the feed shelf into a sump. Patch them before the charge runs through.',
  hint:'Draw a thin stone line through each narrow opening. Leave the wide opening over the blue cistern clear.',
  budget:{stone:21,sand:30},build:rect(116,90,334,158),
  receivers:[cistern('Blue cistern',1400,258,190,335,245)],sourceX:164,
  stone:[rect(110,90,114,249),rect(336,90,340,249),rect(110,246,340,249),rect(251,151,257,249),rect(113,128,337,132)],
  cutouts:[rect(193,128,200,132),rect(219,128,228,132),rect(292,128,311,132)]}),
 level({id:'twin-cisterns-v1',title:'Twin Cisterns',
  description:'Share one charge between two cisterns. Both must hold their quota at the same time.',
  hint:'Watch the first pour. Narrow the faster outlet without closing it, then compare the two readings.',
  budget:{stone:44,sand:50},build:rect(104,90,343,179),
  receivers:[cistern('West cistern',900,102,190,227,245),cistern('East cistern',880,236,190,345,245)],
  stone:splitShelf,cutouts:splitOutlets}),
]);

export function getLevel(id) {
 return LEVELS.find(entry=>entry.id===id)??LEVELS[0];
}
