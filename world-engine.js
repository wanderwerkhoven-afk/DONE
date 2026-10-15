// DONE World prototype: bounded, draggable canvas with object placement.
// Keeps existing coin economy and inventory; layout is stored separately.
(()=>{
 const SIZE=64, MAP=1500, KEY="done-world-layout-v1";
 const slots={house:[640,650],tree:[790,630],bench:[750,780],bridge:[960,670]};
 const defaults={house:"🏠",tree:"🌳",bench:"🪑",bridge:"🌉"};
 let layout={};try{layout=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{}
 let canvas,ctx,stage,mode=null,zoom=1,pan={x:0,y:0},pointers=new Map(),lastDist=0,drag=false,frame=0;
 const persist=()=>localStorage.setItem(KEY,JSON.stringify(layout));
 const owned=()=>Array.isArray(state.worldInventory)?state.worldInventory:[];
 const position=id=>layout[id]||{x:slots[id]?.[0]||700,y:slots[id]?.[1]||700};
 const bounds=()=>{if(!canvas)return;const w=canvas.width/devicePixelRatio,h=canvas.height/devicePixelRatio;pan.x=Math.max(w-MAP*zoom-80,Math.min(80,pan.x));pan.y=Math.max(h-MAP*zoom-80,Math.min(80,pan.y))};
 const toMap=(x,y)=>({x:(x-pan.x)/zoom,y:(y-pan.y)/zoom});
 const paint=()=>{
  if(!ctx)return;const w=canvas.width/devicePixelRatio,h=canvas.height/devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#174a77";ctx.fillRect(0,0,w,h);
  ctx.translate(pan.x,pan.y);ctx.scale(zoom,zoom);
  ctx.fillStyle="#317b91";ctx.beginPath();ctx.ellipse(740,740,650,610,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#c8bd85";ctx.beginPath();ctx.ellipse(740,710,600,570,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#7ebd83";ctx.beginPath();ctx.ellipse(740,690,576,548,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#9acb87";ctx.beginPath();ctx.ellipse(740,690,430,405,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#517e62";ctx.beginPath();ctx.ellipse(1170,670,190,220,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=1;
  for(let n=0;n<=MAP;n+=SIZE){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,MAP);ctx.stroke();ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(MAP,n);ctx.stroke()}
  ctx.font="bold 30px system-ui";ctx.textAlign="center";ctx.fillStyle="#1c4e45";ctx.fillText("STARTDORP",620,420);
  ctx.font="bold 20px system-ui";ctx.fillText(owned().includes("bridge")?"NIEUW GEBIED":"OVERKANT",1190,460);
  ctx.font="54px system-ui";
  for(const id of owned()){const p=position(id);ctx.fillText(defaults[id]||"🏡",p.x,p.y);if(mode===id){ctx.strokeStyle="#f7df7b";ctx.lineWidth=4;ctx.strokeRect(p.x-36,p.y-58,72,72)}}
  if(mode&&!owned().includes(mode)){const p=position(mode);ctx.globalAlpha=.6;ctx.fillText(defaults[mode]||"🏡",p.x,p.y);ctx.globalAlpha=1}
 };
 const resize=()=>{if(!canvas)return;const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx=canvas.getContext("2d");paint()};
 const refresh=()=>{if(!stage?.isConnected)return;paint();stage.querySelector(".world-map-help").textContent=mode?"Sleep naar een plek en bevestig de bouw":"Sleep om rond te kijken · knijp om te zoomen"};
 const mount=()=>{
  stage=document.querySelector(".world-stage");if(!stage)return;
  stage.innerHTML='<canvas class="world-map-canvas" aria-label="Interactieve wereldkaart"></canvas><div class="world-map-help">Sleep om rond te kijken · knijp om te zoomen</div><div class="world-map-actions"><button type="button" data-zoom="in" aria-label="Inzoomen">+</button><button type="button" data-zoom="out" aria-label="Uitzoomen">−</button></div><div class="world-placement-actions" hidden><button type="button" data-place="cancel">Annuleren</button><button type="button" data-place="confirm">Plaatsen</button></div>';
  canvas=stage.querySelector("canvas");ctx=canvas.getContext("2d");mode=null;zoom=.58;pan={x:0,y:0};
  resize();const r=canvas.getBoundingClientRect();pan={x:r.width/2-740*zoom,y:r.height/2-700*zoom};bounds();paint();
  const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
  canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));drag=false});
  canvas.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;const p=local(e),old=pointers.get(e.pointerId);pointers.set(e.pointerId,p);if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(lastDist){const z=Math.max(.35,Math.min(1.8,zoom*dist/lastDist));const mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},m=toMap(mid.x,mid.y);zoom=z;pan={x:mid.x-m.x*zoom,y:mid.y-m.y*zoom}}lastDist=dist}else{lastDist=0;if(mode){const m=toMap(p.x,p.y);layout[mode]={x:Math.max(180,Math.min(1300,Math.round(m.x/SIZE)*SIZE)),y:Math.max(180,Math.min(1300,Math.round(m.y/SIZE)*SIZE))}}else{pan.x+=p.x-old.x;pan.y+=p.y-old.y} }drag=true;bounds();refresh()});
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastDist=0};
  canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
  stage.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>{const z=Math.max(.35,Math.min(1.8,zoom*(b.dataset.zoom==="in"?1.2:1/1.2))),m=toMap(canvas.clientWidth/2,canvas.clientHeight/2);zoom=z;pan={x:canvas.clientWidth/2-m.x*zoom,y:canvas.clientHeight/2-m.y*zoom};bounds();refresh()});
  stage.querySelector('[data-place="cancel"]').onclick=()=>{mode=null;stage.querySelector(".world-placement-actions").hidden=true;refresh()};
  stage.querySelector('[data-place="confirm"]').onclick=()=>{const id=mode,item=WORLD_ITEMS.find(x=>x.id===id);if(!item)return;const p=position(id);if(Math.hypot(p.x-740,p.y-690)>540){alert("Plaats dit object binnen je beschikbare gebied.");return}if(owned().some(other=>other!==id&&Math.hypot(position(other).x-p.x,position(other).y-p.y)<75)){alert("Deze plek is al bezet.");return}if(!owned().includes(id)){if(state.coins<item.price){alert("Niet genoeg coins.");return}state.coins-=item.price;state.worldInventory.push(id);state.worldItems=state.worldInventory.length;syncAchievementUnlocks();saveState()}persist();openWorld()};
  window.addEventListener("resize",resize,{once:true});
 };
 const original=window.openWorld;window.openWorld=(opts={})=>{original(opts);mount()};
 window.buyWorldItem=(id)=>{if(!WORLD_ITEMS.some(x=>x.id===id))return;mode=id;const actions=stage?.querySelector(".world-placement-actions");if(actions)actions.hidden=false;refresh()};
})();
