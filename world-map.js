/* DONE World terrain contract v2 — logical map, independent of artwork.
   All coordinates are integer isometric grid cells. */
(function(){
"use strict";
const areas=[
{id:"home",name:"Dorp",cx:0,cy:0,r:10,biome:"grass",levels:1,unlock:null},
{id:"forest",name:"Bos",cx:24,cy:0,r:10,biome:"forest",levels:2,unlock:{type:"bridge",from:"home",cost:200}},
{id:"garden",name:"Vallei",cx:0,cy:24,r:10,biome:"valley",levels:2,unlock:{type:"bridge",from:"home",cost:200}},
{id:"mountain",name:"Bergen",cx:24,cy:24,r:10,biome:"mountain",levels:4,unlock:{type:"bridge",from:"garden",cost:350}}
];
const crossings=[
{id:"home-forest",from:"home",to:"forest",x:12,y:0,cost:200},
{id:"home-garden",from:"home",to:"garden",x:0,y:12,cost:200},
{id:"garden-mountain",from:"garden",to:"mountain",x:12,y:24,cost:350}
];
const stairs=[
{id:"forest-upper",area:"forest",x:27,y:-3,fromLevel:0,toLevel:1,cost:120},
{id:"valley-upper",area:"garden",x:-4,y:28,fromLevel:0,toLevel:1,cost:120},
{id:"mountain-l1",area:"mountain",x:21,y:22,fromLevel:0,toLevel:1,cost:160},
{id:"mountain-l2",area:"mountain",x:25,y:24,fromLevel:1,toLevel:2,cost:220},
{id:"mountain-l3",area:"mountain",x:27,y:26,fromLevel:2,toLevel:3,cost:300}
];
function areaAt(x,y){return areas.find(a=>Math.hypot(x-a.cx,y-a.cy)<=a.r)||null}
function terrainAt(x,y){
const a=areaAt(x,y);if(!a)return {kind:"void",level:-1,buildable:false,area:null};
const dx=x-a.cx,dy=y-a.cy,d=Math.hypot(dx,dy);
let level=0,kind="grass";
if(d>a.r-1.25)return {kind:"cliff",level:0,buildable:false,area:a.id};
if(a.id==="forest"){
  if(dx>2&&dy<0&&dx+dy>2){level=1;kind="highland"}
  // The river runs downhill from the raised forest plateau.
  if(Math.abs(dy-(dx*.28+1.1))<.72)kind="water";
}else if(a.id==="garden"){
  if(dx< -3&&dy>1){level=1;kind="highland"}
  if(Math.abs(dx+dy*.45+1.5)<.8)kind="water";
}else if(a.id==="mountain"){
  const h=(dx+dy)/2;
  level=h>4?3:h>1?2:h> -2?1:0;
  kind=level>=3?"snow":level>=1?"rocky":"grass";
}
return {kind,level,buildable:kind!=="water",area:a.id};
}
window.DoneWorldMap=Object.freeze({version:2,areas,crossings,stairs,areaAt,terrainAt});
})();