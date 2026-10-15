/* DONE World — floating islands MVP. Standalone layer on existing app state. */
(()=>{
const TYPES=[
{id:"house",name:"Huisje",price:100,emoji:"🏠",size:2},
{id:"tree",name:"Boom",price:50,emoji:"🌳",size:1},
{id:"bench",name:"Bankje",price:75,emoji:"🪑",size:1},
{id:"bridge",name:"Brug",price:120,emoji:"🌉",size:0},
{id:"flowers",name:"Bloemen",price:25,emoji:"🌷",size:1},
{id:"statue",name:"Standbeeld",price:180,emoji:"🗿",size:1},
{id:"fountain",name:"Fontein",price:250,emoji:"⛲",size:2},
{id:"cottage",name:"Huis met tuin",price:300,emoji:"🏡",size:2}
];
const KEY="done-world-map-v1",SIZE=12,TILE_W=66,TILE_H=34;
const islands=[{id:"home",name:"Startdorp",cx:0,cy:0,r:5.2},{id:"forest",name:"Boseiland",cx:13,cy:0,r:4.1},{id:"garden",name:"Tuineiland",cx:0,cy:13,r:4.1}];
let world,cam={x:0,y:0,zoom:1},selected=null,placing=null,drag=null,scene=null,stage=null,stageBox=null;
const defaultWorld=()=>({version:1,unlocked:["home"],objects:[]});
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));return v&&Array.isArray(v.objects)&&Array.isArray(v.unlocked)?v:defaultWorld()}catch{return defaultWorld()}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(world))}catch{}}
function iso(x,y){return{x:(x-y)*TILE_W/2,y:(x+y)*TILE_H/2}}
function tileAt(px,py){return{x:Math.round((px/(TILE_W/2)+py/(TILE_H/2))/2),y:Math.round((py/(TILE_H/2)-px/(TILE_W/2))/2)}}
function inside(x,y,island){return Math.hypot(x-island.cx,y-island.cy)<=island.r}
function islandFor(x,y){return islands.find(i=>inside(x,y,i))}
function occupied(x,y,size,ignore){for(let dx=0;dx<size;dx++)for(let dy=0;dy<size;dy++){const tx=x+dx,ty=y+dy;if(!islandFor(tx,ty)||!world.unlocked.includes(islandFor(tx,ty).id))return true;if(world.objects.some(o=>o!==ignore&&o.type!=="bridge"&&tx>=o.x&&tx<o.x+o.size&&ty>=o.y&&ty<o.y+o.size))return true}return false}
function html(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tilePolygon(x,y,cls){const p=iso(x,y);return `<polygon class="${cls}" points="${p.x},${p.y-TILE_H/2} ${p.x+TILE_W/2},${p.y} ${p.x},${p.y+TILE_H/2} ${p.x-TILE_W/2},${p.y}"/>`}
function renderMap(){
const tiles=[];for(const island of islands){for(let x=island.cx-6;x<=island.cx+6;x++)for(let y=island.cy-6;y<=island.cy+6;y++)if(inside(x,y,island)){const unlocked=world.unlocked.includes(island.id);tiles.push(tilePolygon(x,y,unlocked?"dw-tile":"dw-tile dw-locked"))}}
const bridges=[{id:"forest",x:6.5,y:0},{id:"garden",x:0,y:6.5}].map(b=>{const p=iso(b.x,b.y);return `<g class="dw-bridge ${world.unlocked.includes(b.id)?"is-built":"is-locked"}" data-bridge="${b.id}" transform="translate(${p.x} ${p.y})"><rect x="-70" y="-13" width="140" height="26" rx="7"/><text text-anchor="middle" y="5" font-size="17">${world.unlocked.includes(b.id)?"🌉":"🔒"}</text></g>`}).join("");
const items=world.objects.map(o=>{const p=iso(o.x+(o.size-1)/2,o.y+(o.size-1)/2);const t=TYPES.find(t=>t.id===o.type);return `<g class="dw-object" data-object="${o.id}" transform="translate(${p.x} ${p.y-15})"><ellipse rx="${o.size===2?37:24}" ry="12" cy="10" fill="#193e32" opacity=".35"/><text text-anchor="middle" y="4" font-size="${o.size===2?48:37}">${t?.emoji||"🌱"}</text></g>`}).join("");
const labels=islands.map(i=>{const p=iso(i.cx,i.cy);return `<text x="${p.x}" y="${p.y-125}" class="dw-island-label">${i.name}${world.unlocked.includes(i.id)?"":" · vergrendeld"}</text>`}).join("");
scene.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-780 -520 1700 1400" aria-label="Isometrische wereldkaart"><defs><filter id="dwShadow"><feGaussianBlur stdDeviation="8"/></filter></defs><g class="dw-terrain">${tiles.join("")}</g>${bridges}${items}${labels}</svg>`;
applyCamera();
}
function applyCamera(){if(scene)scene.style.transform=`translate(${cam.x}px,${cam.y}px) scale(${cam.zoom})`}
function showMessage(message){const el=document.querySelector(".dw-hint");if(el)el.textContent=message}
function shop(){const el=document.querySelector(".dw-shop-list");if(!el)return;el.innerHTML=TYPES.filter(t=>t.id!=="bridge").map(t=>`<button class="dw-shop-item" data-buy="${t.id}"><span>${t.emoji}</span><strong>${t.name}</strong><small>${t.price} coins</small></button>`).join("");document.querySelector(".dw-coins").textContent=Number(state.coins||0).toLocaleString("nl-NL")}
function startBuild(type){const t=TYPES.find(v=>v.id===type);if(!t)return;if(Number(state.coins)<t.price){showMessage("Niet genoeg coins. Rond taken af om meer te verdienen.");return}placing=type;selected=null;showMessage(`Tik op een vrije plek om ${t.name.toLowerCase()} te bouwen (${t.price} coins).`);document.querySelector(".dw-cancel").hidden=false}
function buyAt(x,y){const t=TYPES.find(v=>v.id===placing);if(!t)return;if(occupied(x,y,t.size)){showMessage("Hier kun je niet bouwen. Kies een vrij vakje in een ontgrendeld gebied.");return}if(Number(state.coins)<t.price){showMessage("Niet genoeg coins.");return}state.coins-=t.price;world.objects.push({id:"w"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:t.id,x,y,size:t.size,createdAt:Date.now()});persist();saveState();placing=null;document.querySelector(".dw-cancel").hidden=true;renderMap();shop();showMessage(`${t.name} gebouwd! Houd een object ingedrukt om het te verplaatsen.`)}
function unlock(id){if(world.unlocked.includes(id))return;const price=200;if(Number(state.coins)<price){showMessage("Een brug naar dit eiland kost 200 coins.");return}state.coins-=price;world.unlocked.push(id);persist();saveState();renderMap();shop();showMessage("Brug gebouwd! Je kunt nu op het nieuwe eiland bouwen.")}
function screenPoint(e){const rect=stage.getBoundingClientRect();return{x:e.clientX-rect.left-rect.width/2,y:e.clientY-rect.top-rect.height/2}}
function toTile(e){const p=screenPoint(e);return tileAt((p.x-cam.x)/cam.zoom,(p.y-cam.y)/cam.zoom)}
function mount(){
world=load();cam={x:0,y:0,zoom:.72};document.querySelector("#app").innerHTML=`<div class="phone dw-screen"><header class="dw-header"><div><h1>Mijn wereld</h1><p>Bouw jouw eigen zwevende eilanden</p></div><div class="dw-wallet">🪙 <b class="dw-coins">0</b></div></header><main class="dw-main"><div class="dw-stage" role="application" aria-label="Wereldkaart, sleep om te bewegen en knijp om te zoomen"><div class="dw-scene"></div><div class="dw-hint" aria-live="polite">Sleep om de wereld te verkennen. Bouw je eerste object!</div><div class="dw-controls"><button class="dw-zoom-out" aria-label="Uitzoomen">−</button><button class="dw-zoom-in" aria-label="Inzoomen">+</button></div></div><section class="dw-shop"><div class="dw-shop-title"><strong>Bouwplaats</strong><button class="dw-cancel" hidden>Annuleren</button></div><div class="dw-shop-list"></div><p class="dw-bridge-note">Tik op een vergrendelde brug om een nieuw eiland te openen (200 coins).</p></section></main><nav class="nav world-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button class="active"><span class="ni">${navIcon("world")}</span>Wereld</button><button onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav></div>`;
stage=document.querySelector(".dw-stage");scene=document.querySelector(".dw-scene");shop();renderMap();
document.querySelector(".dw-shop-list").addEventListener("click",e=>{const b=e.target.closest("[data-buy]");if(b)startBuild(b.dataset.buy)});
document.querySelector(".dw-cancel").addEventListener("click",()=>{placing=null;document.querySelector(".dw-cancel").hidden=true;showMessage("Bouwen geannuleerd.")});
document.querySelector(".dw-zoom-in").addEventListener("click",()=>{cam.zoom=Math.min(1.65,cam.zoom+.15);applyCamera()});
document.querySelector(".dw-zoom-out").addEventListener("click",()=>{cam.zoom=Math.max(.42,cam.zoom-.15);applyCamera()});
const pointers=new Map();let initialDist=0,initialZoom=1,down=null,moved=false;
stage.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){down={x:e.clientX,y:e.clientY,time:Date.now(),target:e.target};moved=false}else if(pointers.size===2){const p=[...pointers.values()];initialDist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);initialZoom=cam.zoom}});
stage.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()];cam.zoom=Math.max(.42,Math.min(1.65,initialZoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/Math.max(1,initialDist)));moved=true}else if(pointers.size===1){cam.x=Math.max(-850,Math.min(850,cam.x+e.clientX-prev.x));cam.y=Math.max(-650,Math.min(650,cam.y+e.clientY-prev.y));if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)moved=true}applyCamera()});
stage.addEventListener("pointerup",e=>{const tap=!moved&&pointers.size===1;const held=down&&Date.now()-down.time>550;pointers.delete(e.pointerId);if(!tap)return;const bridge=e.target.closest("[data-bridge]");const obj=e.target.closest("[data-object]");if(bridge){unlock(bridge.dataset.bridge);return}const t=toTile(e);if(placing){buyAt(t.x,t.y);return}if(obj){const o=world.objects.find(o=>o.id===obj.dataset.object);if(o){if(held){selected=o;showMessage("Tik op een vrije plek om dit object te verplaatsen.")}else showMessage(TYPES.find(t=>t.id===o.type)?.name+" — houd ingedrukt om te verplaatsen.")}return}if(selected){if(!occupied(t.x,t.y,selected.size,selected)){selected.x=t.x;selected.y=t.y;persist();renderMap();showMessage("Object verplaatst.")}else showMessage("Deze plek is niet vrij.");selected=null}});
stage.addEventListener("pointercancel",e=>pointers.delete(e.pointerId));
stage.addEventListener("wheel",e=>{e.preventDefault();cam.zoom=Math.max(.42,Math.min(1.65,cam.zoom+(e.deltaY<0?.08:-.08)));applyCamera()},{passive:false});
}
window.openWorld=mount;
})();