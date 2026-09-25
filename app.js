// ============================================================================
// APP STATE & LOCAL STORAGE
// Centrale state, level/XP-berekening en persistente opslag in localStorage.
// ============================================================================
const STORAGE_KEY="done-state-v1";
const REMINDER_CLIENT_ID_KEY="done-reminder-client-id";
// ============================================================================
// SHARED NAVIGATION ICONS
// SVG-iconen die door de onderste navigatie op meerdere schermen worden gebruikt.
// ============================================================================
const navIcon=name=>({today:`<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="icon-fill" x="5" y="7" width="22" height="20" rx="6"/><path class="icon-cut" d="M10 5v5M22 5v5M9 14h14"/><path class="icon-detail" d="M11 18.5c1.3 2.5 3 3.7 5 3.7s3.7-1.2 5-3.7"/></svg>`,world:`<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="16" cy="16" r="11"/><path class="icon-cut" d="M7.2 13.2c3.2-.2 5.2.6 6.2 2.4.8 1.4.2 2.6-.3 3.8-.6 1.4-.4 2.7.9 4M17.5 5.4c-.4 2.4.5 4 2.7 4.8 2.2.8 3.4 2.3 3.5 4.4.1 1.5 1 2.4 2.5 2.7M16.5 11.3c1.1 1.1 1.2 2.1.3 3-.9.9-2 1-3.2.2"/></svg>`,achievements:`<svg viewBox="0 0 32 32" aria-hidden="true"><path class="icon-fill" d="M10 6h12v7c0 4-2.4 6.5-6 6.5S10 17 10 13z"/><path class="icon-fill" d="M10 9H5v2.5c0 4 2.4 6 6.3 6M22 9h5v2.5c0 4-2.4 6-6.3 6M14 19h4v5h4v3H10v-3h4z"/><circle class="icon-cut" cx="16" cy="12" r="2.2"/></svg>`,profile:`<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="16" cy="10" r="6"/><path class="icon-fill" d="M6 27c.6-6.2 3.9-9.3 10-9.3S25.4 20.8 26 27z"/></svg>`})[name];
const defaultState={level:1,xp:0,maxXp:100,streak:0,coins:0,profileAvatar:1,reminderEnabled:false,reminderTime:"17:00",reminderLastSent:null,tasks:[{title:"Verslag afmaken",meta:"Grote taak",xp:50,icon:"🧠"},{title:"Mail beantwoorden",meta:"Kleine taak",xp:10,icon:"✉️"},{title:"Was ophangen",meta:"",xp:10,icon:"🧹",done:true},{title:"20 min sporten",meta:"Normale taak",xp:25,icon:"🏋️"}]};
const xpForLevel=level=>100+(Math.max(1,level)-1)*50;
const savedState=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(e){return null}})();
const state={...defaultState,...(savedState||{})};
state.tasks=Array.isArray(state.tasks)?state.tasks:defaultState.tasks;
state.level=Math.max(1,Number(state.level)||1);
state.xp=Math.max(0,Number(state.xp)||0);
state.maxXp=xpForLevel(state.level);
while(state.xp>=state.maxXp){state.xp-=state.maxXp;state.level++;state.maxXp=xpForLevel(state.level)}
const localDateKey=d=>{const x=d?new Date(d):new Date();return [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),String(x.getDate()).padStart(2,"0")].join("-")};
const coinReward=xp=>xp>=50?10:xp>=25?5:2;
state.taskHistory=Array.isArray(state.taskHistory)?state.taskHistory:[];
state.tasks=state.tasks.map(t=>({...t,createdAt:t.createdAt||new Date().toISOString(),rewardClaimed:Boolean(t.rewardClaimed),completedAt:t.done?(t.completedAt||new Date().toISOString()):t.completedAt}));
// ============================================================================
// TASK HISTORY / DAILY ARCHIVING
// Verplaatst afgeronde taken van eerdere dagen naar het permanente takenlogboek.
// ============================================================================
const archiveOldCompletedTasks=()=>{
  const today=localDateKey(),keep=[];
  state.tasks.forEach(t=>{
    if(t.done&&t.completedAt&&localDateKey(t.completedAt)!==today){
      if(!state.taskHistory.some(h=>h.id===t.id&&h.completedAt===t.completedAt))state.taskHistory.unshift({...t});
    }else keep.push(t);
  });
  state.tasks=keep;
};
const saveState=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){}};

// ============================================================================
// DAILY REMINDERS
// Losse reminderlaag: permission, lokale planning en optionele push/backend-sync.
// Deze code wijzigt geen layout en registreert zelf geen service worker.
// ============================================================================
let reminderTimer=null;
let reminderBackendSyncTimer=null;

const hasOpenTasksToday=()=>{
  const today=localDateKey();
  return state.tasks.some(t=>!t.done&&(!t.completedAt||localDateKey(t.completedAt)===today));
};

const getReminderClientId=()=>{
  let id=localStorage.getItem(REMINDER_CLIENT_ID_KEY);
  if(id)return id;
  if(crypto.randomUUID)id=crypto.randomUUID();
  else{
    const bytes=new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id=`done-${[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("")}`;
  }
  localStorage.setItem(REMINDER_CLIENT_ID_KEY,id);
  return id;
};

const getReminderBackendUrl=()=>String(window.DONE_CONFIG?.backendUrl||"").replace(/\/$/,"");

const getActivePushSubscription=async()=>{
  if(!("serviceWorker" in navigator)||!("PushManager" in window))return null;
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration)return null;
  return registration.pushManager.getSubscription();
};

const syncReminderBackendState=async(force=false)=>{
  const backendUrl=getReminderBackendUrl();
  if(!backendUrl)return false;

  try{
    const clientId=getReminderClientId();

    if(!state.reminderEnabled){
      await fetch(`${backendUrl}/subscription?clientId=${encodeURIComponent(clientId)}`,{method:"DELETE"});
      return true;
    }

    if(!("Notification" in window)||Notification.permission!=="granted")return false;

    const subscription=await getActivePushSubscription();
    if(!subscription)return false;

    const response=await fetch(`${backendUrl}/subscription`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId,
        subscription:subscription.toJSON(),
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Amsterdam",
        reminderTime:state.reminderTime||"17:00",
        hasOpenTasks:hasOpenTasksToday(),
        enabled:true
      })
    });

    if(!response.ok)throw new Error("Reminder backend synchronisatie mislukt");
    return true;
  }catch(error){
    if(force)console.warn("Reminder sync mislukt",error);
    return false;
  }
};

const queueReminderBackendSync=()=>{
  if(!getReminderBackendUrl())return;
  clearTimeout(reminderBackendSyncTimer);
  reminderBackendSyncTimer=setTimeout(()=>syncReminderBackendState(),350);
};

const showTaskReminder=async()=>{
  if(!state.reminderEnabled||!("Notification" in window)||Notification.permission!=="granted")return false;

  const today=localDateKey();
  if(state.reminderLastSent===today||!hasOpenTasksToday())return false;

  const openCount=state.tasks.filter(t=>!t.done&&(!t.completedAt||localDateKey(t.completedAt)===today)).length;
  const body=openCount===1
    ?"Je hebt nog 1 open taak voor vandaag."
    :`Je hebt nog ${openCount} open taken voor vandaag.`;

  try{
    const registration=("serviceWorker" in navigator)?await navigator.serviceWorker.getRegistration():null;
    if(registration){
      await registration.showNotification("DONE.",{
        body,
        tag:"done-open-tasks-reminder",
        data:{url:"./"}
      });
    }else{
      new Notification("DONE.",{body,tag:"done-open-tasks-reminder"});
    }

    state.reminderLastSent=today;
    saveState();
    return true;
  }catch(error){
    console.warn("Dagelijkse herinnering kon niet worden getoond",error);
    return false;
  }
};

const scheduleTaskReminder=()=>{
  if(reminderTimer){
    clearTimeout(reminderTimer);
    reminderTimer=null;
  }

  if(!state.reminderEnabled||!("Notification" in window)||Notification.permission!=="granted")return;

  const [rawHour,rawMinute]=String(state.reminderTime||"17:00").split(":").map(Number);
  const hour=Number.isFinite(rawHour)?rawHour:17;
  const minute=Number.isFinite(rawMinute)?rawMinute:0;
  const now=new Date();
  const next=new Date(now);
  next.setHours(hour,minute,0,0);

  if(next<=now)next.setDate(next.getDate()+1);

  reminderTimer=setTimeout(async()=>{
    await showTaskReminder();
    scheduleTaskReminder();
  },Math.min(next-now,2147483647));
};

window.toggleDailyReminder=async el=>{
  if(!el.checked){
    state.reminderEnabled=false;
    saveState();
    scheduleTaskReminder();
    await syncReminderBackendState(true);
    return;
  }

  if(!("Notification" in window)){
    el.checked=false;
    state.reminderEnabled=false;
    saveState();
    alert("Notificaties worden op dit apparaat niet ondersteund.");
    return;
  }

  let permission=Notification.permission;
  if(permission!=="granted")permission=await Notification.requestPermission();

  if(permission!=="granted"){
    el.checked=false;
    state.reminderEnabled=false;
    saveState();
    alert(`Sta notificaties toe om de dagelijkse herinnering om ${state.reminderTime||"17:00"} te gebruiken.`);
    return;
  }

  state.reminderEnabled=true;
  if(!state.reminderTime)state.reminderTime="17:00";
  saveState();
  scheduleTaskReminder();
  await syncReminderBackendState(true);
};

window.updateReminderTime=el=>{
  const value=/^([01]\d|2[0-3]):[0-5]\d$/.test(el.value)?el.value:"17:00";
  state.reminderTime=value;
  state.reminderLastSent=null;
  saveState();
  scheduleTaskReminder();
  queueReminderBackendSync();

  const detail=document.querySelector("[data-reminder-time-label]");
  if(detail)detail.textContent=`${value} · alleen bij open taken`;
};
archiveOldCompletedTasks();
saveState();
// ============================================================================
// HOME SCREEN
// Bouwt het hoofdscherm: hero, voortgang, stats, takenlijst, FAB en bottom-nav.
// ============================================================================
function render(){cancelTaskLongPress?.();activeTaskEditIndex=null;archiveOldCompletedTasks();saveState();const today=localDateKey(),visibleTasks=state.tasks.filter(t=>!t.done||!t.completedAt||localDateKey(t.completedAt)===today),done=visibleTasks.filter(t=>t.done).length,total=visibleTasks.length,taskPct=total?Math.round(done/total*100):0,xpPct=state.maxXp?Math.min(100,Math.round(state.xp/state.maxXp*100)):0;document.querySelector("#app").innerHTML=`<div class="phone"><section class="hero hero-image"><div class="brand"><div class="logo">DONE.</div><div class="tag">Small steps. A bigger you.</div></div><div class="level"><span class="fire">🔥</span><b>Lv. ${state.level}</b><div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${state.maxXp}" aria-valuenow="${state.xp}"><i style="width:${xpPct}%"></i></div><small>${state.xp} / ${state.maxXp} XP</small></div></section><main class="content"><div class="greet"><h1>Goedemiddag! 👋</h1><p>Wat gaan we vandaag afmaken?</p></div><div class="progressrow"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${taskPct}%"></i></div><div class="fraction">${done} / ${total}<br>${taskPct}%</div></div><div class="stats"><div class="stat"><span class="streak-fire" aria-hidden="true">🔥</span><div><strong>${state.streak}</strong><small>dag streak</small></div></div><div class="stat"><button class="coin-sprite" type="button" aria-label="Munt draaien" onclick="spinCoin(this)"></button><div><strong>${state.coins.toLocaleString("nl-NL")}</strong><small>coins</small></div></div></div><div class="tasks">${visibleTasks.length?visibleTasks.map(t=>{const i=state.tasks.indexOf(t);return `<div class="task-wrap" data-task-index="${i}"><button class="task ${t.done?"done":""}" onclick="handleTaskClick(event,${i})" onpointerdown="startTaskLongPress(event,${i},this)" onpointerup="endTaskLongPress(event)" onpointercancel="cancelTaskLongPress()" onpointerleave="cancelTaskLongPress()" onpointermove="trackTaskLongPress(event)" oncontextmenu="return false"><span class="check">${t.done?"✓":""}</span><span class="taskicon">${t.icon}</span><span><div class="tasktitle">${t.title}</div>${t.meta?`<div class="taskmeta">${t.meta}</div>`:""}</span><span class="reward">+${t.xp} XP</span></button><button class="task-delete-btn" type="button" aria-label="Verwijder taak ${t.title.replace(/"/g,"&quot;")}" onclick="deleteTask(event,${i})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button></div>`}).join(""):`<section class="tasks-empty-state" aria-label="Geen taken"><div class="tasks-empty-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25"/><path d="m21 33 7 7 15-17"/></svg></div><h2>Alles afgevinkt</h2><p>Je hebt voor vandaag geen openstaande taken.</p><button type="button" onclick="openNewTask()">Nieuwe taak toevoegen</button></section>`}</div><button class="task-log-link" onclick="openTaskLog()">Takenlogboek <span>›</span></button></main><button class="add" aria-label="Taak toevoegen" onclick="openNewTask()">+</button><nav class="nav"><button class="active"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav></div>`}

// ============================================================================
// PROGRESSION: XP, LEVELS & STREAK
// Verwerkt XP, levelgrenzen en de dagelijkse streak.
// ============================================================================
const addXp=amount=>{state.xp+=amount;let levelsGained=0;while(state.xp>=state.maxXp){state.xp-=state.maxXp;state.level++;levelsGained++;state.maxXp=xpForLevel(state.level)}saveState();return levelsGained};
const updateStreak=()=>{
  const today=localDateKey(),last=state.lastActiveDate;
  if(last===today)return;
  const y=new Date();y.setDate(y.getDate()-1);
  state.streak=last===localDateKey(y)?Math.max(1,Number(state.streak)||0)+1:1;
  state.lastActiveDate=today;
};
// ============================================================================
// TASK INTERACTION: LONG PRESS / DELETE MODE
// Lang indrukken activeert de verwijdermodus zonder normale task-click te triggeren.
// ============================================================================
let taskLongPressTimer=null;
let taskLongPressStartPoint=null;
let taskLongPressTriggered=false;
let activeTaskEditIndex=null;

const clearTaskEditMode=()=>{
  document.querySelectorAll(".task-wrap.task-editing").forEach(el=>el.classList.remove("task-editing"));
  activeTaskEditIndex=null;
};

window.startTaskLongPress=(event,index,button)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  cancelTaskLongPress();
  taskLongPressTriggered=false;
  taskLongPressStartPoint={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  taskLongPressTimer=setTimeout(()=>{
    taskLongPressTimer=null;
    taskLongPressTriggered=true;
    clearTaskEditMode();
    activeTaskEditIndex=index;
    button.closest(".task-wrap")?.classList.add("task-editing");
    if(navigator.vibrate)navigator.vibrate(35);
  },1200);
};

window.trackTaskLongPress=event=>{
  if(!taskLongPressTimer||!taskLongPressStartPoint)return;
  const dx=event.clientX-taskLongPressStartPoint.x;
  const dy=event.clientY-taskLongPressStartPoint.y;
  if(Math.hypot(dx,dy)>12)cancelTaskLongPress();
};

window.cancelTaskLongPress=()=>{
  if(taskLongPressTimer){clearTimeout(taskLongPressTimer);taskLongPressTimer=null}
  taskLongPressStartPoint=null;
};

window.endTaskLongPress=()=>{
  cancelTaskLongPress();
};

window.handleTaskClick=(event,index)=>{
  if(taskLongPressTriggered){
    taskLongPressTriggered=false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if(activeTaskEditIndex!==null){
    if(activeTaskEditIndex===index)return;
    clearTaskEditMode();
    return;
  }
  toggleTask(index);
};

window.deleteTask=(event,index)=>{
  event.preventDefault();
  event.stopPropagation();
  cancelTaskLongPress();
  const task=state.tasks[index];
  if(!task)return;
  if(!window.confirm(`Taak “${task.title}” verwijderen?`))return;
  state.tasks.splice(index,1);
  clearTaskEditMode();
  saveState();
  render();
};

// ============================================================================
// TASK COMPLETION & REWARDS
// Vinkt taken af, kent XP/coins toe en start eventueel de Level Up-flow.
// ============================================================================
window.toggleTask=i=>{
  const t=state.tasks[i];
  if(!t.done){
    t.done=true;t.completedAt=new Date().toISOString();
    let levelsGained=0,coins=0;
    const previousLevel=state.level;
    if(!t.rewardClaimed){
      t.rewardClaimed=true;levelsGained=addXp(t.xp);coins=coinReward(t.xp);state.coins=(Number(state.coins)||0)+coins;updateStreak();
      if(levelsGained>0){
        state.pendingLevelUp={
          id:`level-up-${Date.now()}`,
          previousLevel,
          newLevel:state.level,
          levelsGained,
          xpAwarded:t.xp,
          coinsAwarded:coins,
          createdAt:new Date().toISOString()
        };
      }
    }
    saveState();queueReminderBackendSync();openTaskCompleted(t,{coins,levelsGained});return;
  }
  t.done=false;t.completedAt=null;saveState();queueReminderBackendSync();render();
};

// ============================================================================
// COIN INTERACTION
// Visuele muntanimatie op het Home-scherm.
// ============================================================================
window.spinCoin=el=>{if(el.dataset.spinning==="1")return;el.dataset.spinning="1";const frames=16,rotations=5,totalFrames=frames*rotations,duration=1500;let last=-1;el.classList.remove("coin-hop");void el.offsetWidth;el.classList.add("coin-hop");const started=performance.now();const animate=now=>{const t=Math.min((now-started)/duration,1),progress=(1-Math.cos(Math.PI*t))/2,step=Math.min(Math.floor(progress*totalFrames),totalFrames-1);if(step!==last){el.style.backgroundPosition=(-((step%frames)*64))+"px 0";last=step}if(t<1){requestAnimationFrame(animate);return}el.style.backgroundPosition="0 0";el.classList.remove("coin-hop");el.dataset.spinning="0"};requestAnimationFrame(animate)};

// ============================================================================
// NEW TASK SCREEN
// Openen, taakgrootte kiezen en nieuwe taak opslaan.
// ============================================================================
window.openNewTask=()=>{document.querySelector("#app").innerHTML=`<div class="phone new-task-screen"><header class="new-task-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><h1>Nieuwe taak</h1></header><section class="new-task-hero"><div class="quote-bubble">Elke grote reis<br>begint met een kleine stap.</div></section><main class="new-task-form"><label for="taskName">Wat wil je doen?</label><input id="taskName" class="task-input" placeholder="Bijv. Verslag afmaken..." maxlength="80"><fieldset><legend>Hoe groot is deze taak?</legend><div class="size-grid"><button class="size-card" data-size="small" onclick="selectTaskSize(this)"><span class="size-icon">🌱</span><strong>Klein</strong><b>+10 XP</b></button><button class="size-card selected" data-size="normal" onclick="selectTaskSize(this)"><span class="size-icon">🔥</span><strong>Normaal</strong><b>+25 XP</b></button><button class="size-card" data-size="large" onclick="selectTaskSize(this)"><span class="size-icon">⛰️</span><strong>Groot</strong><b>+50 XP</b></button></div></fieldset><button class="submit-task" onclick="saveNewTask()">Taak toevoegen</button></main></div>`};
window.selectTaskSize=el=>{document.querySelectorAll(".size-card").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")};
window.saveNewTask=()=>{const input=document.querySelector("#taskName"),size=document.querySelector(".size-card.selected")?.dataset.size||"normal";if(!input.value.trim()){input.focus();return}const values={small:["Kleine taak",10,"🌱"],normal:["Normale taak",25,"🔥"],large:["Grote taak",50,"⛰️"]}[size];state.tasks.unshift({id:`task-${Date.now()}`,title:input.value.trim(),meta:values[0],xp:values[1],icon:values[2],done:false,rewardClaimed:false,createdAt:new Date().toISOString()});saveState();queueReminderBackendSync();render()};

// ============================================================================
// TASK COMPLETED SCREEN
// Volledig reward-scherm na het afronden van een taak.
// ============================================================================
window.openTaskCompleted=(t,reward={coins:0,levelsGained:0})=>{window.scrollTo(0,0);document.querySelector("#app").scrollTop=0;const nextAction=reward.levelsGained>0?"openLevelUp()":"render()";document.querySelector("#app").innerHTML=`<div class="phone completed-screen"><section class="completed-scene"><div class="completed-copy"><h1 class="arched-title" aria-label="Taak voltooid!"><span style="--n:0">T</span><span style="--n:1">a</span><span style="--n:2">a</span><span style="--n:3">k</span><span class="gap" style="--n:4">&nbsp;</span><span style="--n:5">v</span><span style="--n:6">o</span><span style="--n:7">l</span><span style="--n:8">t</span><span style="--n:9">o</span><span style="--n:10">o</span><span style="--n:11">i</span><span style="--n:12">d</span><span style="--n:13">!</span></h1><p>Goed bezig!</p></div><div class="celebration-rays"></div><div class="completion-check"><span>✓</span></div><div class="xp-pop">+${t.xp} XP${reward.coins?`<small>+${reward.coins} coins</small>`:""}${reward.levelsGained?`<em>Level ${state.level}!</em>`:""}</div><div class="completion-quote">“Consistentie bouwt<br>een betere jij.”</div><div class="landing-glow" aria-hidden="true"></div><div class="completion-character" aria-hidden="true"></div><div class="confetti" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i class="${i<16?"pop-left":"pop-right"}" style="--i:${i%16}"></i>`).join("")}</div></section><button class="completed-btn" onclick="${nextAction}">Nice! ✨</button></div>`;requestAnimationFrame(()=>{window.scrollTo(0,0);const app=document.querySelector("#app");if(app)app.scrollTop=0;const screen=document.querySelector(".completed-screen");if(screen){screen.scrollTop=0;screen.classList.add("play")}})};


// ============================================================================
// LEVEL UP SCREEN
// Tweede reward-stap wanneer een taak één of meerdere levels oplevert.
// ============================================================================
window.openLevelUp=()=>{
  const event=state.pendingLevelUp;
  if(!event){render();return}
  window.scrollTo(0,0);
  const appRoot=document.querySelector("#app");
  if(appRoot)appRoot.scrollTop=0;
  const levelJump=Number(event.levelsGained)||Math.max(1,(Number(event.newLevel)||state.level)-(Number(event.previousLevel)||state.level-1));
  const xpAwarded=Math.max(0,Number(event.xpAwarded)||0);
  const coinsAwarded=Math.max(0,Number(event.coinsAwarded)||0);
  const extraLine=levelJump>1?`<span class="level-up-jump">+${levelJump} levels in één keer</span>`:"";
  document.querySelector("#app").innerHTML=`<div class="phone level-up-screen">
    <div class="level-up-art" aria-hidden="true"></div>
    <div class="level-up-shade" aria-hidden="true"></div>
    <main class="level-up-content">
      <header class="level-up-header">
        <h1>LEVEL UP!</h1>
        <div class="level-ribbon"><img src="assets/images/level-up/level-up-ribbon.png" alt="" aria-hidden="true"><svg class="level-ribbon-text" viewBox="0 0 330 100" aria-hidden="true"><defs><path id="levelRibbonCurve" d="M 48 58 Q 165 28 282 58"/></defs><text><textPath href="#levelRibbonCurve" startOffset="50%" text-anchor="middle">Je bent nu level ${event.newLevel}!</textPath></text></svg></div>
        ${extraLine}
      </header>
      <div class="level-up-spacer" aria-hidden="true"></div>
      <section class="level-reward-card" aria-label="Beloningen">
        <div class="level-reward-row"><span class="reward-symbol reward-star" aria-hidden="true">★</span><strong>+${xpAwarded} XP</strong></div>
        <div class="level-reward-row"><span class="reward-symbol reward-coin" aria-hidden="true"><i></i></span><strong>+${coinsAwarded} coins</strong></div>
        <div class="level-reward-row"><span class="reward-symbol reward-map" aria-hidden="true"><svg viewBox="0 0 44 44"><path d="m5 9 10-4 14 5 10-4v29l-10 4-14-5-10 4z"/><path d="M15 5v29M29 10v29"/><path d="m9 26 5-5 5 4 5-8 9 5"/></svg></span><strong>Nieuw level<br>ontgrendeld!</strong></div>
      </section>
      <button class="level-up-continue" type="button" onclick="continueLevelUp()">Doorgaan</button>
    </main>
    <div class="level-up-sparkles" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--i:${i}"></i>`).join("")}</div>
  </div>`;
  requestAnimationFrame(()=>{window.scrollTo(0,0);const root=document.querySelector("#app");if(root)root.scrollTop=0;document.querySelector(".level-up-screen")?.classList.add("play")});
};
window.continueLevelUp=()=>{if(state.pendingLevelUp){state.lastSeenLevel=Math.max(Number(state.lastSeenLevel)||1,Number(state.pendingLevelUp.newLevel)||state.level);state.pendingLevelUp=null;saveState()}render()};

// ============================================================================
// PROFILE / SETTINGS
// Profieloverzicht, statistieken en gebruikersinstellingen.
// ============================================================================
window.openSettings=()=>openProfile();
window.openProfile=()=>{
  const completed=state.taskHistory.length+state.tasks.filter(t=>t.done).length;
  const xpPct=Math.min(100,Math.round(state.xp/state.maxXp*100));
  const focusDays=Number(state.focusDays)||0;
  const worldItems=Number(state.worldItems)||0;
  document.querySelector("#app").innerHTML=`<div class="phone profile-screen">
    <main class="profile-content">
      <header class="profile-heading"><h1>Profiel</h1><p>Jouw reis in cijfers.</p></header>
      <section class="profile-level">
        <button class="profile-avatar" type="button" onclick="openAvatarPicker()" aria-label="Kies profielafbeelding"><img src="assets/images/profile/Profile_${state.profileAvatar||1}.png" alt=""></button>
        <div class="profile-level-info"><h2>Level ${state.level}</h2><div class="profile-xpbar"><i style="width:${xpPct}%"></i></div><strong>${state.xp} / ${state.maxXp} XP</strong></div>
      </section>
      <section class="profile-primary-stats">
        <div class="profile-stat"><span class="profile-stat-icon">🔥</span><div><b>${state.streak}</b><small>dagen streak</small></div></div>
        <div class="profile-stat"><span class="profile-stat-icon">🪙</span><div><b>${state.coins.toLocaleString("nl-NL")}</b><small>coins</small></div></div>
      </section>
      <section class="profile-mini-stats">
        <div><b>${completed}</b><small>taken voltooid</small></div>
        <div><b>${focusDays}</b><small>focus dagen</small></div>
        <div><b>${worldItems}</b><small>wereld items</small></div>
      </section>
      <blockquote class="profile-quote"><span>🌿</span><p>“Discipline is gewoon<br>zelfliefde in actie.”</p></blockquote>
      <section class="profile-settings">
        <label><span>🔊 <b>Geluid</b></span><input type="checkbox" data-setting="sound" onchange="saveProfileSetting(this)" ${state.sound!==false?"checked":""}><i></i></label>
        <label><span>⚙️ <b>Haptische feedback</b></span><input type="checkbox" data-setting="haptics" onchange="saveProfileSetting(this)" ${state.haptics!==false?"checked":""}><i></i></label>
        <label><span>🌙 <b>Donkere modus</b></span><input type="checkbox" data-setting="darkMode" onchange="saveProfileSetting(this)" ${state.darkMode!==false?"checked":""}><i></i></label>
        <label class="profile-reminder-setting"><span>🔔 <b>Dagelijkse herinnering</b><small data-reminder-time-label>${state.reminderTime||"17:00"} · alleen bij open taken</small></span><input type="checkbox" onchange="toggleDailyReminder(this)" ${state.reminderEnabled?"checked":""}><i></i></label>
        <label class="profile-reminder-time"><span>🕒 <b>Tijdstip</b></span><input class="profile-time-input" type="time" value="${state.reminderTime||"17:00"}" step="60" onchange="updateReminderTime(this)" aria-label="Tijdstip dagelijkse herinnering"></label>
      </section>
      <button class="profile-reset-progress" type="button" onclick="resetProgress()" aria-label="Reset level en XP">
        <span class="profile-reset-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8V4m0 0h4M4 4l3.1 3.1A7 7 0 1 1 5 13"/></svg></span>
        <span><b>Refresh voortgang</b><small>Zet level en XP terug naar het begin</small></span>
      </button>
    </main>
    <nav class="nav profile-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements</button><button class="active"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav>
  </div>`;
};

// ============================================================================
// PROFILE AVATAR PICKER
// Popup voor het selecteren en bewaren van een profielafbeelding.
// ============================================================================
window.openAvatarPicker=()=>{
  document.querySelector(".avatar-picker")?.remove();
  const selected=Number(state.profileAvatar)||1;
  const picker=document.createElement("div");
  picker.className="avatar-picker";
  picker.innerHTML=`<div class="avatar-picker-backdrop" onclick="closeAvatarPicker()"></div><section class="avatar-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="avatarPickerTitle"><div class="avatar-picker-head"><div><h2 id="avatarPickerTitle">Kies je avatar</h2><p>Welke avonturier ben jij?</p></div><button type="button" onclick="closeAvatarPicker()" aria-label="Sluiten">×</button></div><div class="avatar-grid">${Array.from({length:12},(_,i)=>{const n=i+1;return `<button class="avatar-option ${selected===n?"selected":""}" type="button" onclick="selectProfileAvatar(${n})" aria-label="Profielafbeelding ${n}"><img src="assets/images/profile/Profile_${n}.png" alt=""><span>✓</span></button>`}).join("")}</div></section>`;
  document.querySelector(".profile-screen")?.appendChild(picker);
  requestAnimationFrame(()=>picker.classList.add("show"));
};
window.closeAvatarPicker=()=>{const picker=document.querySelector(".avatar-picker");if(!picker)return;picker.classList.remove("show");setTimeout(()=>picker.remove(),180)};
window.selectProfileAvatar=n=>{state.profileAvatar=n;saveState();closeAvatarPicker();setTimeout(()=>openProfile(),120)};

// ============================================================================
// PROFILE ACTIONS
// Resetbare voortgang en eenvoudige profielinstellingen.
// ============================================================================
window.resetProgress=()=>{
  const confirmed=window.confirm("Weet je zeker dat je je level en XP wilt resetten? Je taken blijven behouden.");
  if(!confirmed)return;
  state.level=1;
  state.xp=0;
  state.maxXp=xpForLevel(1);
  state.pendingLevelUp=null;
  state.lastSeenLevel=1;
  saveState();
  openProfile();
};

window.saveProfileSetting=el=>{state[el.dataset.setting]=el.checked;saveState()};

// ============================================================================
// TASK LOG
// Groepeert afgeronde taken per datum en toont het historische overzicht.
// ============================================================================
window.openTaskLog=()=>{
  archiveOldCompletedTasks();saveState();
  const all=[...state.taskHistory,...state.tasks.filter(t=>t.done&&t.completedAt)].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  const groups=all.reduce((acc,t)=>{const k=localDateKey(t.completedAt);(acc[k]??=[]).push(t);return acc},{});
  const fmt=k=>new Date(k+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  document.querySelector("#app").innerHTML=`<div class="phone task-log-screen"><header class="task-log-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><div><h1>Takenlogboek</h1><p>Alles wat je hebt afgemaakt.</p></div></header><main class="task-log-content">${all.length?Object.entries(groups).map(([date,tasks])=>`<section class="task-log-day"><h2>${fmt(date)}</h2>${tasks.map(t=>`<article class="task-log-item"><span class="task-log-check">✓</span><div><strong>${t.title}</strong><small>${new Date(t.completedAt).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})} · +${t.xp} XP · +${coinReward(t.xp)} coins</small></div></article>`).join("")}</section>`).join(""):`<div class="task-log-empty"><span>✓</span><h2>Nog geen voltooide taken</h2><p>Je afgeronde taken verschijnen hier automatisch.</p></div>`}</main></div>`;
};


// ============================================================================
// ACHIEVEMENTS: SHARED HELPERS
// Iconen, voortgang en opbouw van individuele achievement-kaarten.
// ============================================================================
const achievementIcon=(type,locked=false)=>{
  if(locked)return '<span class="achievement-medal locked-medal"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 22v-5a9 9 0 0 1 18 0v5"/><rect x="10" y="21" width="28" height="23" rx="8"/><path d="M24 29v7"/></svg></span>';
  const icons={
    star:'<span class="achievement-medal medal-gold"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="15"/><path d="m24 13 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z"/></svg></span>',
    week:'<span class="achievement-medal medal-week"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8 7 18l4 5-2 11 9 2 6 8 6-8 9-2-2-11 4-5-5-10-12 3z"/><path d="m24 16 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z"/></svg></span>',
    badge:'<span class="achievement-medal medal-badge"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18l2 5 5 3-2 19-14 8-14-8-2-19 5-3z"/><path d="m17 24 5 5 10-11"/></svg></span>',
    clock:'<span class="achievement-medal medal-badge"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18l2 5 5 3-2 19-14 8-14-8-2-19 5-3z"/><circle cx="24" cy="24" r="8"/><path d="M24 19v6l4 2"/></svg></span>'
  };
  return icons[type]||icons.star;
};
const achievementCheck=()=>'<span class="achievement-check">✓</span>';
const achievementRow=a=>{
  const pct=a.goal?Math.min(100,Math.round(a.value/a.goal*100)):100;
  return `<article class="achievement-card ${a.locked?"achievement-locked":""}" data-category="${a.category}">
    ${achievementIcon(a.icon,a.locked)}
    <div class="achievement-copy"><strong>${a.title}</strong><small>${a.subtitle}</small>${a.goal?`<div class="achievement-progress"><i style="width:${pct}%"></i></div>`:""}</div>
    ${a.complete?achievementCheck():a.goal?`<b class="achievement-count">${a.value} / ${a.goal}</b>`:""}
  </article>`;
};
window.filterAchievements=(category,button)=>{
  document.querySelectorAll(".achievement-filter").forEach(b=>b.classList.toggle("active",b===button));
  document.querySelectorAll(".achievement-card").forEach(card=>{card.hidden=category!=="all"&&card.dataset.category!==category});
};
// ============================================================================
// ACHIEVEMENTS SCREEN
// Definieert achievements, status/voortgang en rendert de achievement-pagina.
// ============================================================================
window.openAchievements=()=>{
  archiveOldCompletedTasks();saveState();
  const completed=state.taskHistory.length+state.tasks.filter(t=>t.done).length;
  const achievements=[
    {title:"Eerste stap",subtitle:"Voltooi je eerste taak",category:"tasks",icon:"star",complete:completed>=1},
    {title:"Streak 3",subtitle:"3 dagen op rij taken afronden",category:"streak",icon:"star",complete:state.streak>=3},
    {title:"Productieve week",subtitle:"7 dagen op rij",category:"streak",icon:"week",value:Math.min(state.streak,7),goal:7},
    {title:"Taakheld",subtitle:"50 taken voltooien",category:"tasks",icon:"badge",value:Math.min(completed,50),goal:50},
    {title:"Vroege vogel",subtitle:"5 dagen op rij vóór 10:00\\neen taak afronden",category:"tasks",icon:"clock",value:Math.min(Number(state.earlyBirdDays)||0,5),goal:5},
    {title:"Wereldbouwer",subtitle:"Ontgrendel 10 items in je wereld",category:"world",icon:"star",value:Math.min(Number(state.worldItems)||0,10),goal:10,locked:(Number(state.worldItems)||0)===0}
  ];
  const css=`<style id="achievement-page-style">
  .achievements-screen{height:100dvh;overflow:hidden;padding-bottom:0;background:linear-gradient(180deg,#062a4b 0%,#031a31 100%);color:#fff}
  .achievements-content{height:calc(100dvh - 78px);overflow-y:auto;padding:calc(env(safe-area-inset-top) + 29px) 8px 28px;scrollbar-width:none}.achievements-content::-webkit-scrollbar{display:none}
  .achievements-heading{padding:0 11px}.achievements-heading h1{margin:0;font-size:31px;line-height:1.05;font-weight:1000;letter-spacing:-1.1px;text-shadow:0 3px 0 rgba(0,0,0,.35)}.achievements-heading p{margin:7px 0 25px;color:#d9e2ee;font-size:15px;font-weight:760}
  .achievement-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:0 0 21px;padding:0 0}.achievement-filter{height:48px;border:1px solid rgba(106,143,184,.12);border-radius:25px;background:#0b2b4c;color:#c8d5e6;font-weight:850;font-size:13px;box-shadow:inset 0 1px rgba(255,255,255,.035),0 5px 14px rgba(0,0,0,.10)}.achievement-filter.active{color:#fff;background:linear-gradient(135deg,#4437f0,#8b61ff);border-color:#8a7cff;box-shadow:0 0 12px rgba(113,83,255,.32),inset 0 1px rgba(255,255,255,.28)}
  .achievement-list{display:flex;flex-direction:column;gap:9px}.achievement-card{position:relative;min-height:76px;border-radius:18px;background:linear-gradient(100deg,#0b2c4a,#092640);box-shadow:inset 0 1px rgba(255,255,255,.035),0 6px 15px rgba(0,0,0,.09);display:grid;grid-template-columns:65px 1fr auto;align-items:center;padding:9px 15px 9px 8px;gap:6px}.achievement-card[hidden]{display:none}
  .achievement-copy{min-width:0;padding-right:2px}.achievement-copy strong,.achievement-copy small{display:block}.achievement-copy strong{font-size:16px;line-height:1.12;font-weight:950;letter-spacing:-.15px}.achievement-copy small{white-space:pre-line;margin-top:3px;color:#b8c7da;font-size:11px;font-weight:650;line-height:1.25}
  .achievement-medal{width:56px;height:56px;display:grid;place-items:center;filter:drop-shadow(0 4px 4px rgba(0,0,0,.24))}.achievement-medal svg{width:54px;height:54px;overflow:visible}.medal-gold svg circle:first-child{fill:#f7a900;stroke:#ffdf55;stroke-width:2}.medal-gold svg circle:nth-child(2){fill:#f8bb22;stroke:#ffe372;stroke-width:2}.medal-gold svg path{fill:#fff1b0;stroke:#fff5c8;stroke-width:1}
  .medal-week svg>path:first-child{fill:#ed6072;stroke:#ff9b7d;stroke-width:2}.medal-week svg>path:last-child{fill:#ffd12f;stroke:#ffe66d;stroke-width:1.5}.medal-badge svg>path:first-child{fill:#f6b91f;stroke:#ffdc52;stroke-width:2}.medal-badge svg>path:last-child,.medal-badge svg circle{fill:none;stroke:#fff7d1;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
  .locked-medal{width:54px;height:54px;border-radius:50%;background:#173957;box-shadow:inset 0 0 0 2px #244b70;filter:none}.locked-medal svg{width:34px;height:34px;fill:#617fa6;stroke:#9bb0cc;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
  .achievement-check{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#79e6b7;color:#0b5742;border:2px solid #b6f5da;font-size:19px;font-weight:1000;box-shadow:0 0 8px rgba(104,234,184,.22)}.achievement-count{align-self:start;margin-top:7px;min-width:49px;text-align:right;font-size:14px}
  .achievement-progress{height:7px;margin-top:9px;border-radius:6px;background:#06192c;border:1px solid #1a456d;overflow:hidden}.achievement-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7445ff,#b96aff);box-shadow:0 0 6px rgba(158,85,255,.48)}
  .achievement-locked .achievement-copy strong,.achievement-locked .achievement-copy small,.achievement-locked .achievement-count{color:#9baec4}.achievements-nav{background:#061b31!important;border-top:1px solid rgba(255,255,255,.055)!important}.achievements-nav button{color:#91a8c4!important}.achievements-nav button.active{color:#ffd273!important;text-shadow:0 0 10px rgba(255,185,65,.45)}
  @media(max-height:760px){.achievements-content{padding-top:calc(env(safe-area-inset-top) + 18px)}.achievements-heading p{margin-bottom:16px}.achievement-filters{margin-bottom:15px}.achievement-card{min-height:70px}.achievement-list{gap:8px}}
  </style>`;
  document.querySelector("#app").innerHTML=css+`<div class="phone achievements-screen">
    <main class="achievements-content">
      <header class="achievements-heading"><h1>Achievements</h1><p>Kleine overwinningen. Grote impact.</p></header>
      <div class="achievement-filters">
        <button class="achievement-filter active" onclick="filterAchievements('all',this)">Alle</button>
        <button class="achievement-filter" onclick="filterAchievements('streak',this)">Streak</button>
        <button class="achievement-filter" onclick="filterAchievements('tasks',this)">Taken</button>
        <button class="achievement-filter" onclick="filterAchievements('world',this)">Wereld</button>
      </div>
      <section class="achievement-list">${achievements.map(achievementRow).join("")}</section>
    </main>
    <nav class="nav achievements-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button class="active" onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav>
  </div>`;
  requestAnimationFrame(()=>{window.scrollTo(0,0);const c=document.querySelector(".achievements-content");if(c)c.scrollTop=0});
};

scheduleTaskReminder();
queueReminderBackendSync();
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  scheduleTaskReminder();
  queueReminderBackendSync();
});

state.pendingLevelUp?openLevelUp():render();
