// ============================================================================
// APP STATE & LOCAL STORAGE
// Centrale state, level/XP-berekening en persistente opslag in localStorage.
// ============================================================================
const STORAGE_KEY="done-state-v1";
const REMINDER_CLIENT_ID_KEY="done-reminder-client-id";
const DEFAULT_REMINDER_TIME="17:00";
// ============================================================================
// SHARED NAVIGATION ICONS
// SVG-iconen die door de onderste navigatie op meerdere schermen worden gebruikt.
// ============================================================================
const navIcon=name=>({today:`<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="icon-fill" x="5" y="7" width="22" height="20" rx="6"/><path class="icon-cut" d="M10 5v5M22 5v5M9 14h14"/><path class="icon-detail" d="M11 18.5c1.3 2.5 3 3.7 5 3.7s3.7-1.2 5-3.7"/></svg>`,world:`<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="16" cy="16" r="11"/><path class="icon-cut" d="M7.2 13.2c3.2-.2 5.2.6 6.2 2.4.8 1.4.2 2.6-.3 3.8-.6 1.4-.4 2.7.9 4M17.5 5.4c-.4 2.4.5 4 2.7 4.8 2.2.8 3.4 2.3 3.5 4.4.1 1.5 1 2.4 2.5 2.7M16.5 11.3c1.1 1.1 1.2 2.1.3 3-.9.9-2 1-3.2.2"/></svg>`,achievements:`<svg viewBox="0 0 32 32" aria-hidden="true"><path class="icon-fill" d="M10 6h12v7c0 4-2.4 6.5-6 6.5S10 17 10 13z"/><path class="icon-fill" d="M10 9H5v2.5c0 4 2.4 6 6.3 6M22 9h5v2.5c0 4-2.4 6-6.3 6M14 19h4v5h4v3H10v-3h4z"/><circle class="icon-cut" cx="16" cy="12" r="2.2"/></svg>`,profile:`<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="16" cy="10" r="6"/><path class="icon-fill" d="M6 27c.6-6.2 3.9-9.3 10-9.3S25.4 20.8 26 27z"/></svg>`})[name];
const defaultState={level:1,xp:0,maxXp:100,streak:0,coins:0,profileAvatar:1,reminderEnabled:false,reminderTime:DEFAULT_REMINDER_TIME,reminderLastSent:null,tasks:[{title:"Verslag afmaken",meta:"Grote taak",xp:50,icon:"🧠"},{title:"Mail beantwoorden",meta:"Kleine taak",xp:10,icon:"✉️"},{title:"Was ophangen",meta:"",xp:10,icon:"🧹",done:true},{title:"20 min sporten",meta:"Normale taak",xp:25,icon:"🏋️"}]};
const xpForLevel=level=>100+(Math.max(1,level)-1)*50;
const savedState=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(e){return null}})();
const state={...defaultState,...(savedState||{})};
state.reminderTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(state.reminderTime||""))
  ?String(state.reminderTime)
  :DEFAULT_REMINDER_TIME;
state.tasks=Array.isArray(state.tasks)?state.tasks:defaultState.tasks;
state.level=Math.max(1,Number(state.level)||1);
state.xp=Math.max(0,Number(state.xp)||0);
state.maxXp=xpForLevel(state.level);
while(state.xp>=state.maxXp){state.xp-=state.maxXp;state.level++;state.maxXp=xpForLevel(state.level)}
const localDateKey=d=>{const x=d?new Date(d):new Date();return [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),String(x.getDate()).padStart(2,"0")].join("-")};
const coinReward=xp=>xp>=50?10:xp>=25?5:2;
state.taskHistory=Array.isArray(state.taskHistory)?state.taskHistory:[];
state.achievementState=state.achievementState&&typeof state.achievementState==="object"&&!Array.isArray(state.achievementState)
  ?state.achievementState
  :{};
state.tasks=state.tasks.map(t=>({...t,createdAt:t.createdAt||new Date().toISOString(),rewardClaimed:Boolean(t.rewardClaimed),completedAt:t.done?(t.completedAt||new Date().toISOString()):t.completedAt}));

const normalizePendingLevelUp=event=>{
  if(!event||typeof event!=="object")return null;
  const previousLevel=Math.max(1,Number(event.previousLevel)||0);
  const newLevel=Math.max(1,Number(event.newLevel)||0);
  const levelsGained=Math.max(0,Number(event.levelsGained)||(newLevel-previousLevel));
  if(newLevel<=previousLevel||levelsGained<=0)return null;

  return {
    ...event,
    previousLevel,
    newLevel,
    levelsGained,
    previousXp:Math.max(0,Number(event.previousXp)||0),
    previousMaxXp:Math.max(1,Number(event.previousMaxXp)||xpForLevel(previousLevel)),
    newXp:Math.max(0,Number(event.newXp)||0),
    newMaxXp:Math.max(1,Number(event.newMaxXp)||xpForLevel(newLevel)),
    xpAwarded:Math.max(0,Number(event.xpAwarded)||0),
    coinsAwarded:Math.max(0,Number(event.coinsAwarded)||0)
  };
};
state.pendingLevelUp=normalizePendingLevelUp(state.pendingLevelUp);
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
// Permission, reminder-state en backend-sync.
// De lokale timer is alleen fallback wanneer geen pushbackend is geconfigureerd.
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

// ============================================================================
// PUSH SERVICE WORKER & SUBSCRIPTION
// Registreert de push-only service worker en maakt alleen bij ingeschakelde
// reminders een Web Push subscription aan met de publieke VAPID key.
// ============================================================================
const registerDoneServiceWorker=async()=>{
  if(!("serviceWorker" in navigator))return null;
  try{
    return await navigator.serviceWorker.register("./sw.js");
  }catch(error){
    console.warn("Service worker registratie mislukt",error);
    return null;
  }
};

const getActivePushSubscription=async()=>{
  if(!("serviceWorker" in navigator)||!("PushManager" in window))return null;
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration)return null;
  return registration.pushManager.getSubscription();
};

const base64UrlToUint8Array=value=>{
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
};

const getOrCreatePushSubscription=async()=>{
  if(!("serviceWorker" in navigator)||!("PushManager" in window))return null;
  if(!("Notification" in window)||Notification.permission!=="granted")return null;

  let registration=await navigator.serviceWorker.getRegistration();
  if(!registration)registration=await registerDoneServiceWorker();
  if(!registration)return null;

  await navigator.serviceWorker.ready;

  const existing=await registration.pushManager.getSubscription();
  if(existing)return existing;

  const backendUrl=getReminderBackendUrl();
  if(!backendUrl)throw new Error("De push-backend is nog niet gekoppeld.");

  const response=await fetch(`${backendUrl}/vapid-public-key`,{
    headers:{Accept:"application/json"}
  });
  if(!response.ok)throw new Error("Publieke VAPID-key ophalen mislukt.");

  const payload=await response.json();
  if(!payload?.publicKey)throw new Error("Publieke VAPID-key ontbreekt.");

  return registration.pushManager.subscribe({
    userVisibleOnly:true,
    applicationServerKey:base64UrlToUint8Array(payload.publicKey)
  });
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

    const subscription=await getOrCreatePushSubscription();
    if(!subscription)return false;

    const response=await fetch(`${backendUrl}/subscription`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId,
        subscription:subscription.toJSON(),
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Amsterdam",
        reminderTime:state.reminderTime,
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

  // Wanneer de pushbackend is gekoppeld, is de Cloudflare-cron de enige
  // dagelijkse scheduler. Dit voorkomt dubbele meldingen als de app open staat.
  if(getReminderBackendUrl())return;

  const [hour,minute]=state.reminderTime.split(":").map(Number);
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
    alert(`Sta notificaties toe om de dagelijkse herinnering om ${state.reminderTime} te gebruiken.`);
    return;
  }

  state.reminderEnabled=true;
  saveState();

  try{
    await getOrCreatePushSubscription();
  }catch(error){
    state.reminderEnabled=false;
    saveState();
    el.checked=false;
    alert(error?.message||"Pushnotificaties konden niet worden geactiveerd.");
    return;
  }

  scheduleTaskReminder();
  await syncReminderBackendState(true);
};

window.updateReminderTime=async el=>{
  const value=/^([01]\d|2[0-3]):[0-5]\d$/.test(el.value)?el.value:DEFAULT_REMINDER_TIME;
  state.reminderTime=value;
  saveState();
  scheduleTaskReminder();

  const detail=document.querySelector("[data-reminder-time-label]");
  if(detail)detail.textContent=`${state.reminderTime} · alleen bij open taken`;

  await syncReminderBackendState(true);
};

// ============================================================================
// NOTIFICATION TEST
// Controleert permission + actieve push subscription en laat de backend
// één test-push versturen. Eén in-flight request voorkomt dubbele pushes.
// ============================================================================
let notificationTestInFlight=false;

const setNotificationTestButtonState=(button,stateName,message)=>{
  if(!button)return;
  button.classList.remove("loading","sent","error");
  if(stateName)button.classList.add(stateName);

  const title=button.querySelector("[data-test-title]");
  const detail=button.querySelector("[data-test-detail]");

  if(stateName==="loading"){
    if(title)title.textContent="Test versturen…";
    if(detail)detail.textContent="Pushverbinding controleren";
  }else if(stateName==="sent"){
    if(title)title.textContent="Test verstuurd";
    if(detail)detail.textContent=message||"Controleer je notificaties";
  }else if(stateName==="error"){
    if(title)title.textContent="Test niet verstuurd";
    if(detail)detail.textContent=message||"Controleer je notificatie-instellingen";
  }else{
    if(title)title.textContent="Test notificatie";
    if(detail)detail.textContent="Stuur nu een proefmelding naar dit apparaat";
  }
};

window.testDoneNotification=async button=>{
  if(notificationTestInFlight)return;
  notificationTestInFlight=true;
  setNotificationTestButtonState(button,"loading");

  try{
    if(!("Notification" in window)){
      throw new Error("Notificaties worden op dit apparaat niet ondersteund.");
    }

    let permission=Notification.permission;
    if(permission==="default")permission=await Notification.requestPermission();
    if(permission!=="granted"){
      throw new Error("Sta notificaties toe in iOS om een test te versturen.");
    }

    const subscription=await getActivePushSubscription();
    if(!subscription){
      throw new Error("Er is nog geen actieve push-subscription op dit apparaat.");
    }

    const backendUrl=getReminderBackendUrl();
    if(!backendUrl){
      throw new Error("De push-backend is nog niet gekoppeld.");
    }

    // Zorg dat de backend eerst de actuele subscription/reminderstatus kent.
    await syncReminderBackendState(true);

    const response=await fetch(`${backendUrl}/test-push`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId:getReminderClientId(),
        endpoint:subscription.endpoint
      })
    });

    let payload={};
    try{payload=await response.json()}catch(e){}

    if(!response.ok||payload.ok===false){
      throw new Error(payload.error||"De backend kon de test-push niet versturen.");
    }

    setNotificationTestButtonState(button,"sent","Controleer je notificaties");
    setTimeout(()=>{
      if(button?.isConnected)setNotificationTestButtonState(button,null);
    },2200);
  }catch(error){
    console.warn("Testnotificatie mislukt",error);
    setNotificationTestButtonState(button,"error",error?.message||"Testnotificatie mislukt");
    setTimeout(()=>{
      if(button?.isConnected)setNotificationTestButtonState(button,null);
    },3200);
  }finally{
    notificationTestInFlight=false;
  }
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
const addXp=amount=>{
  state.xp+=Math.max(0,Number(amount)||0);
  let levelsGained=0;

  while(state.xp>=state.maxXp){
    state.xp-=state.maxXp;
    state.level++;
    levelsGained++;
    state.maxXp=xpForLevel(state.level);
  }

  return levelsGained;
};

const awardTaskReward=task=>{
  const previousLevel=state.level;
  const previousXp=state.xp;
  const previousMaxXp=state.maxXp;
  const xpAwarded=Math.max(0,Number(task.xp)||0);
  const levelsGained=addXp(xpAwarded);
  const coinsAwarded=coinReward(xpAwarded);

  state.coins=(Number(state.coins)||0)+coinsAwarded;
  updateStreak();

  const reward={
    previousLevel,
    previousXp,
    previousMaxXp,
    newLevel:state.level,
    newXp:state.xp,
    newMaxXp:state.maxXp,
    levelsGained,
    xpAwarded,
    coinsAwarded
  };

  if(levelsGained>0){
    state.pendingLevelUp=normalizePendingLevelUp({
      id:`level-up-${Date.now()}`,
      ...reward,
      createdAt:new Date().toISOString()
    });
  }

  return reward;
};
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
  if(!t)return;

  if(!t.done){
    t.done=true;
    t.completedAt=new Date().toISOString();

    let reward={
      levelsGained:0,
      xpAwarded:0,
      coinsAwarded:0,
      previousLevel:state.level,
      previousXp:state.xp,
      previousMaxXp:state.maxXp,
      newLevel:state.level,
      newXp:state.xp,
      newMaxXp:state.maxXp
    };

    if(!t.rewardClaimed){
      t.rewardClaimed=true;
      reward=awardTaskReward(t);
    }

    syncAchievementUnlocks();
    saveState();
    queueReminderBackendSync();
    openTaskCompleted(t,reward);
    return;
  }

  t.done=false;
  t.completedAt=null;
  saveState();
  queueReminderBackendSync();
  render();
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
window.openTaskCompleted=(t,reward={levelsGained:0,xpAwarded:0,coinsAwarded:0})=>{
  window.scrollTo(0,0);
  const appRoot=document.querySelector("#app");
  if(appRoot)appRoot.scrollTop=0;

  const isLevelUp=Boolean(state.pendingLevelUp)&&Number(reward.levelsGained)>0;
  const nextAction=isLevelUp?"openLevelUp()":"render()";
  const buttonLabel=isLevelUp?"LEVEL UP!":"Nice! ✨";
  const xpAwarded=Object.prototype.hasOwnProperty.call(reward,"xpAwarded")
    ?Math.max(0,Number(reward.xpAwarded)||0)
    :Math.max(0,Number(t.xp)||0);
  const coinsAwarded=Math.max(0,Number(reward.coinsAwarded)||0);

  document.querySelector("#app").innerHTML=`<div class="phone completed-screen">
    <section class="completed-scene">
      <div class="completed-copy"><h1 class="arched-title" aria-label="Taak voltooid!"><span style="--n:0">T</span><span style="--n:1">a</span><span style="--n:2">a</span><span style="--n:3">k</span><span class="gap" style="--n:4">&nbsp;</span><span style="--n:5">v</span><span style="--n:6">o</span><span style="--n:7">l</span><span style="--n:8">t</span><span style="--n:9">o</span><span style="--n:10">o</span><span style="--n:11">i</span><span style="--n:12">d</span><span style="--n:13">!</span></h1><p>Goed bezig!</p></div>
      <div class="celebration-rays"></div>
      <div class="completion-check"><span>✓</span></div>
      <div class="xp-pop">+${xpAwarded} XP${coinsAwarded?`<small>+${coinsAwarded} coins</small>`:""}</div>
      <div class="completion-quote">“Consistentie bouwt<br>een betere jij.”</div>
      <div class="landing-glow" aria-hidden="true"></div>
      <div class="completion-character" aria-hidden="true"></div>
      <div class="confetti" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i class="${i<16?"pop-left":"pop-right"}" style="--i:${i%16}"></i>`).join("")}</div>
    </section>
    <button class="completed-btn" onclick="${nextAction}">${buttonLabel}</button>
  </div>`;

  requestAnimationFrame(()=>{
    window.scrollTo(0,0);
    const root=document.querySelector("#app");
    if(root)root.scrollTop=0;
    const screen=document.querySelector(".completed-screen");
    if(screen){
      screen.scrollTop=0;
      screen.classList.add("play");
    }
  });
};


// ============================================================================
// LEVEL UP SCREEN
// Tweede reward-stap wanneer een taak één of meerdere levels oplevert.
// ============================================================================
window.openLevelUp=()=>{
  const event=normalizePendingLevelUp(state.pendingLevelUp);
  if(!event){
    state.pendingLevelUp=null;
    saveState();
    render();
    return;
  }
  state.pendingLevelUp=event;
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
        <label class="profile-reminder-setting"><span>🔔 <b>Dagelijkse herinnering</b><small data-reminder-time-label>${state.reminderTime} · alleen bij open taken</small></span><input type="checkbox" onchange="toggleDailyReminder(this)" ${state.reminderEnabled?"checked":""}><i></i></label>
        <label class="profile-reminder-time"><span>🕒 <b>Tijdstip</b></span><input class="profile-time-input" type="time" value="${state.reminderTime}" step="60" onchange="updateReminderTime(this)" aria-label="Tijdstip dagelijkse herinnering"></label>
      </section>
      <button class="profile-test-notification" type="button" onclick="testDoneNotification(this)" aria-label="Stuur testnotificatie">
        <span class="profile-test-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span>
        <span class="profile-test-copy"><b data-test-title>Test notificatie</b><small data-test-detail>Stuur nu een proefmelding naar dit apparaat</small></span>
        <span class="profile-test-arrow" aria-hidden="true">›</span>
      </button>
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
// ACHIEVEMENTS: CATALOG & PERSISTENCE
// Eén catalogus voedt filters, kaarten, detail-sheet, showcase en unlock-state.
// Definitieve badge-art kan later via badgeKey naar assets/images/achievements/.
// ============================================================================
const ACHIEVEMENT_DEFINITIONS=[
  {id:"tasks-1",title:"Eerste stap",subtitle:"Voltooi je eerste taak",category:"tasks",icon:"star",badgeKey:"first-step",stat:"completedTasks",goal:1},
  {id:"tasks-10",title:"Op stoom",subtitle:"Voltooi 10 taken",category:"tasks",icon:"badge",badgeKey:"tasks-10",stat:"completedTasks",goal:10,requires:"tasks-1"},
  {id:"tasks-25",title:"Doener",subtitle:"Voltooi 25 taken",category:"tasks",icon:"badge",badgeKey:"tasks-25",stat:"completedTasks",goal:25,requires:"tasks-10"},
  {id:"tasks-50",title:"Taakheld",subtitle:"Voltooi 50 taken",category:"tasks",icon:"badge",badgeKey:"tasks-50",stat:"completedTasks",goal:50,requires:"tasks-25"},
  {id:"tasks-100",title:"Niet te stoppen",subtitle:"Voltooi 100 taken",category:"tasks",icon:"badge",badgeKey:"tasks-100",stat:"completedTasks",goal:100,requires:"tasks-50"},
  {id:"early-bird-5",title:"Vroege vogel",subtitle:"Rond op 5 dagen vóór 10:00 een taak af",category:"tasks",icon:"clock",badgeKey:"early-bird",stat:"earlyBirdDays",goal:5},

  {id:"streak-3",title:"Vonkje",subtitle:"Houd een streak van 3 dagen",category:"streak",icon:"flame",badgeKey:"streak-3",stat:"streak",goal:3},
  {id:"streak-7",title:"Productieve week",subtitle:"Houd een streak van 7 dagen",category:"streak",icon:"week",badgeKey:"streak-7",stat:"streak",goal:7,requires:"streak-3"},
  {id:"streak-14",title:"Ritme gevonden",subtitle:"Houd een streak van 14 dagen",category:"streak",icon:"flame",badgeKey:"streak-14",stat:"streak",goal:14,requires:"streak-7"},
  {id:"streak-30",title:"Maandmeester",subtitle:"Houd een streak van 30 dagen",category:"streak",icon:"flame",badgeKey:"streak-30",stat:"streak",goal:30,requires:"streak-14"},

  {id:"level-2",title:"Op weg",subtitle:"Bereik level 2",category:"growth",icon:"level",badgeKey:"level-2",stat:"level",goal:2},
  {id:"level-5",title:"Groeispurt",subtitle:"Bereik level 5",category:"growth",icon:"level",badgeKey:"level-5",stat:"level",goal:5,requires:"level-2"},
  {id:"level-10",title:"Ervaren avonturier",subtitle:"Bereik level 10",category:"growth",icon:"level",badgeKey:"level-10",stat:"level",goal:10,requires:"level-5"},
  {id:"focus-1",title:"Focus gestart",subtitle:"Registreer je eerste focusdag",category:"growth",icon:"focus",badgeKey:"focus-1",stat:"focusDays",goal:1},
  {id:"focus-10",title:"Focusritme",subtitle:"Bereik 10 focusdagen",category:"growth",icon:"focus",badgeKey:"focus-10",stat:"focusDays",goal:10,requires:"focus-1"},
  {id:"coins-100",title:"Spaarpot",subtitle:"Verzamel 100 coins",category:"growth",icon:"coin",badgeKey:"coins-100",stat:"coins",goal:100},

  {id:"world-1",title:"Eerste vondst",subtitle:"Ontgrendel je eerste werelditem",category:"world",icon:"world",badgeKey:"world-1",stat:"worldItems",goal:1},
  {id:"world-5",title:"Wereldmaker",subtitle:"Ontgrendel 5 werelditems",category:"world",icon:"world",badgeKey:"world-5",stat:"worldItems",goal:5,requires:"world-1"},
  {id:"world-10",title:"Wereldbouwer",subtitle:"Ontgrendel 10 werelditems",category:"world",icon:"world",badgeKey:"world-10",stat:"worldItems",goal:10,requires:"world-5"},
  {id:"world-20",title:"Eigen universum",subtitle:"Ontgrendel 20 werelditems",category:"world",icon:"world",badgeKey:"world-20",stat:"worldItems",goal:20,requires:"world-10"}
];

const achievementStats=()=>({
  completedTasks:state.taskHistory.length+state.tasks.filter(t=>t.done).length,
  streak:Math.max(0,Number(state.streak)||0),
  level:Math.max(1,Number(state.level)||1),
  worldItems:Math.max(0,Number(state.worldItems)||0),
  earlyBirdDays:Math.max(0,Number(state.earlyBirdDays)||0),
  focusDays:Math.max(0,Number(state.focusDays)||0),
  coins:Math.max(0,Number(state.coins)||0)
});

const achievementSnapshot=()=>{
  const stats=achievementStats();
  const unlockedIds=new Set();

  // Persisted unlocks stay unlocked, even when a live stat (such as streak)
  // later falls below its original threshold.
  ACHIEVEMENT_DEFINITIONS.forEach(def=>{
    if(state.achievementState[def.id]?.unlockedAt||Number(stats[def.stat])>=def.goal){
      unlockedIds.add(def.id);
    }
  });

  return ACHIEVEMENT_DEFINITIONS.map(def=>{
    const rawValue=Math.max(0,Number(stats[def.stat])||0);
    const value=Math.min(rawValue,def.goal);
    const unlocked=unlockedIds.has(def.id);
    const locked=Boolean(def.requires&&!unlockedIds.has(def.requires)&&!unlocked);
    const meta=state.achievementState[def.id]||{};
    return {
      ...def,
      value,
      unlocked,
      locked,
      status:unlocked?"unlocked":locked?"locked":"progress",
      unlockedAt:meta.unlockedAt||null,
      isNew:Boolean(unlocked&&meta.unlockedAt&&!meta.seen),
      pct:def.goal?Math.min(100,Math.round(value/def.goal*100)):100
    };
  });
};

const syncAchievementUnlocks=()=>{
  const stats=achievementStats();
  let changed=false;

  ACHIEVEMENT_DEFINITIONS.forEach(def=>{
    if(Number(stats[def.stat])<def.goal)return;
    const current=state.achievementState[def.id]||{};
    if(current.unlockedAt)return;

    state.achievementState[def.id]={
      ...current,
      unlockedAt:new Date().toISOString(),
      seen:false
    };
    changed=true;
  });

  return changed;
};

// ============================================================================
// ACHIEVEMENTS: BADGES & CARDS
// Vector placeholders blijven bewust behouden totdat definitieve badge-art
// wordt gegenereerd. badgeKey houdt de mapping naar toekomstige assets stabiel.
// ============================================================================
const achievementIcon=(type,locked=false,badgeKey="")=>{
  if(locked)return `<span class="achievement-medal locked-medal" data-badge-key="${badgeKey}"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 22v-5a9 9 0 0 1 18 0v5"/><rect x="10" y="21" width="28" height="23" rx="8"/><path d="M24 29v7"/></svg></span>`;

  const icons={
    star:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="15"/><path d="m24 13 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z"/></svg>',
    week:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8 7 18l4 5-2 11 9 2 6 8 6-8 9-2-2-11 4-5-5-10-12 3z"/><path d="m24 16 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z"/></svg>',
    badge:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18l2 5 5 3-2 19-14 8-14-8-2-19 5-3z"/><path d="m17 24 5 5 10-11"/></svg>',
    clock:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18l2 5 5 3-2 19-14 8-14-8-2-19 5-3z"/><circle cx="24" cy="24" r="8"/><path d="M24 19v6l4 2"/></svg>',
    flame:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M26 5c2 8-5 10-2 17 1-5 6-6 8-11 7 8 8 15 5 22-3 7-9 10-14 10S10 39 9 30c-1-8 4-14 11-21-1 7 1 10 6 12-3-7 2-10 0-16z"/></svg>',
    level:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 38 13v17L24 43 10 30V13z"/><path d="m16 27 8-12 8 12M19 25h10"/></svg>',
    focus:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><path d="M24 3v8M24 37v8M3 24h8M37 24h8"/></svg>',
    coin:'<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="24" rx="17" ry="19"/><path d="M24 12v24M31 17c-2-2-5-3-8-2-4 1-5 5-2 7l7 3c4 2 3 7-1 8-4 1-8-1-10-3"/></svg>',
    world:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18"/><path d="M6 24h36M24 6c7 6 10 12 10 18S31 36 24 42M24 6c-7 6-10 12-10 18s3 12 10 18"/></svg>'
  };

  return `<span class="achievement-medal medal-gold medal-${type}" data-badge-key="${badgeKey}">${icons[type]||icons.star}</span>`;
};

const achievementStatusLabel=a=>a.unlocked?"Ontgrendeld":a.locked?"Vergrendeld":"Bezig";

const achievementRow=a=>`<button class="achievement-card achievement-${a.status} ${a.isNew?"achievement-new":""}" type="button" data-achievement-id="${a.id}" data-category="${a.category}" onclick="openAchievementDetail('${a.id}')" aria-label="${a.title}, ${achievementStatusLabel(a)}">
  ${achievementIcon(a.icon,a.locked,a.badgeKey)}
  <span class="achievement-copy">
    <span class="achievement-title-line"><strong>${a.title}</strong>${a.isNew?'<em class="achievement-new-badge">Nieuw</em>':""}</span>
    <small>${a.subtitle}</small>
    <span class="achievement-progress-copy">${a.unlocked?"Doel behaald":a.locked?"Voltooi eerst de vorige mijlpaal":`${a.value} / ${a.goal} · ${a.pct}%`}</span>
    <span class="achievement-progress" role="progressbar" aria-label="Voortgang ${a.title}" aria-valuemin="0" aria-valuemax="${a.goal}" aria-valuenow="${a.unlocked?a.goal:a.value}"><i style="width:${a.unlocked?100:a.pct}%"></i></span>
  </span>
  <span class="achievement-card-status">
    ${a.unlocked?'<span class="achievement-check">✓</span>':`<b class="achievement-count">${a.value} / ${a.goal}</b>`}
    <small>${achievementStatusLabel(a)}</small>
  </span>
</button>`;

const categoryLabel=category=>({all:"Alle",tasks:"Taken",streak:"Streak",growth:"Groei",world:"Wereld"})[category]||category;

// ============================================================================
// ACHIEVEMENTS: FILTERING & DETAIL
// ============================================================================
window.filterAchievements=(category,button)=>{
  document.querySelectorAll(".achievement-filter").forEach(b=>b.classList.toggle("active",b===button));
  document.querySelectorAll(".achievement-card").forEach(card=>{
    card.hidden=category!=="all"&&card.dataset.category!==category;
  });
};

window.openAchievementDetail=id=>{
  const achievement=achievementSnapshot().find(item=>item.id===id);
  if(!achievement)return;

  if(achievement.unlocked&&achievement.isNew){
    state.achievementState[id]={...state.achievementState[id],seen:true};
    saveState();

    document.querySelector(`.achievement-card[data-achievement-id="${id}"]`)?.classList.remove("achievement-new");
    document.querySelector(`.achievement-card[data-achievement-id="${id}"] .achievement-new-badge`)?.remove();
    document.querySelector(`.achievement-showcase-item[data-achievement-id="${id}"]`)?.classList.remove("new");
  }

  document.querySelector(".achievement-detail")?.remove();

  const remaining=Math.max(0,achievement.goal-achievement.value);
  const unlockedDate=achievement.unlockedAt
    ?new Date(achievement.unlockedAt).toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric"})
    :"";

  const detail=document.createElement("div");
  detail.className="achievement-detail";
  detail.innerHTML=`<button class="achievement-detail-backdrop" type="button" onclick="closeAchievementDetail()" aria-label="Sluit achievementdetails"></button>
    <section class="achievement-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="achievementDetailTitle">
      <div class="achievement-detail-handle" aria-hidden="true"></div>
      <button class="achievement-detail-close" type="button" onclick="closeAchievementDetail()" aria-label="Sluiten">×</button>
      <div class="achievement-detail-medal">${achievementIcon(achievement.icon,achievement.locked,achievement.badgeKey)}</div>
      <span class="achievement-detail-category">${categoryLabel(achievement.category)}</span>
      <h2 id="achievementDetailTitle">${achievement.title}</h2>
      <p>${achievement.subtitle}</p>
      <div class="achievement-detail-progress">
        <div><span>${achievementStatusLabel(achievement)}</span><b>${achievement.unlocked?achievement.goal:achievement.value} / ${achievement.goal}</b></div>
        <div class="achievement-progress" role="progressbar" aria-label="Voortgang ${achievement.title}" aria-valuemin="0" aria-valuemax="${achievement.goal}" aria-valuenow="${achievement.unlocked?achievement.goal:achievement.value}"><i style="width:${achievement.unlocked?100:achievement.pct}%"></i></div>
      </div>
      <div class="achievement-detail-note">${achievement.unlocked
        ?`Ontgrendeld op <strong>${unlockedDate||"eerder"}</strong>`
        :achievement.locked
          ?"Deze mijlpaal wordt actief zodra de vorige in de reeks is behaald."
          :remaining===1
            ?"Nog <strong>1</strong> te gaan."
            :`Nog <strong>${remaining}</strong> te gaan.`}</div>
    </section>`;

  document.querySelector(".achievements-screen")?.appendChild(detail);
  requestAnimationFrame(()=>detail.classList.add("show"));
};

window.closeAchievementDetail=()=>{
  const detail=document.querySelector(".achievement-detail");
  if(!detail)return;
  detail.classList.remove("show");
  setTimeout(()=>detail.remove(),180);
};

// ============================================================================
// ACHIEVEMENTS SCREEN
// Totaalprogressie, recente trofeeën, filters met counts en 20 mijlpalen.
// ============================================================================
window.openAchievements=()=>{
  archiveOldCompletedTasks();
  syncAchievementUnlocks();
  saveState();

  const achievements=achievementSnapshot();
  const unlocked=achievements.filter(a=>a.unlocked);
  const total=achievements.length;
  const unlockedCount=unlocked.length;
  const overallPct=total?Math.round(unlockedCount/total*100):0;
  const unseenCount=unlocked.filter(a=>a.isNew).length;

  const counts=achievements.reduce((acc,item)=>{
    acc[item.category]=(acc[item.category]||0)+1;
    return acc;
  },{});

  const recent=[...unlocked]
    .sort((a,b)=>new Date(b.unlockedAt||0)-new Date(a.unlockedAt||0))
    .slice(0,4);

  const showcase=recent.length
    ?recent.map(item=>`<button class="achievement-showcase-item ${item.isNew?"new":""}" type="button" data-achievement-id="${item.id}" onclick="openAchievementDetail('${item.id}')" aria-label="Bekijk ${item.title}">
        ${achievementIcon(item.icon,false,item.badgeKey)}
        <span>${item.title}</span>
      </button>`).join("")
    :`<div class="achievement-showcase-empty"><span class="achievement-empty-trophy" aria-hidden="true">${achievementIcon("star",true,"empty")}</span><div><strong>Je trofeeënkast wacht op je</strong><small>Voltooi je eerste achievement om hier een badge te tonen.</small></div></div>`;

  const filters=["all","tasks","streak","growth","world"];
  const filterButtons=filters.map(category=>{
    const count=category==="all"?total:(counts[category]||0);
    return `<button class="achievement-filter ${category==="all"?"active":""}" type="button" onclick="filterAchievements('${category}',this)">${categoryLabel(category)} <b>${count}</b></button>`;
  }).join("");

  document.querySelector("#app").innerHTML=`<div class="phone achievements-screen">
    <main class="achievements-content">
      <header class="achievements-heading">
        <div>
          <h1>Achievements</h1>
          <p>Kleine overwinningen. Grote impact.</p>
        </div>
        ${unseenCount?`<span class="achievements-new-total">${unseenCount} nieuw</span>`:""}
      </header>

      <section class="achievement-overview" aria-label="Totale achievementvoortgang">
        <div class="achievement-overview-top"><div><strong>${unlockedCount} / ${total}</strong><small>ontgrendeld</small></div><b>${overallPct}%</b></div>
        <div class="achievement-overall-progress" role="progressbar" aria-label="Totale achievementvoortgang" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${unlockedCount}"><i style="width:${overallPct}%"></i></div>
      </section>

      <section class="achievement-showcase" aria-label="Recente trofeeën">
        <div class="achievement-section-head"><h2>Trofeeënkast</h2><small>Recent ontgrendeld</small></div>
        <div class="achievement-showcase-row">${showcase}</div>
      </section>

      <div class="achievement-filters" aria-label="Filter achievements">${filterButtons}</div>
      <section class="achievement-list">${achievements.map(achievementRow).join("")}</section>
    </main>
    <nav class="nav achievements-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button class="active" onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav>
  </div>`;

  requestAnimationFrame(()=>{
    window.scrollTo(0,0);
    const content=document.querySelector(".achievements-content");
    if(content)content.scrollTop=0;
  });
};

syncAchievementUnlocks();
saveState();

registerDoneServiceWorker().then(()=>{
  if(state.reminderEnabled&&Notification.permission==="granted"){
    getOrCreatePushSubscription()
      .then(()=>syncReminderBackendState())
      .catch(error=>console.warn("Push subscription herstellen mislukt",error));
  }
});

scheduleTaskReminder();
queueReminderBackendSync();
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  scheduleTaskReminder();
  queueReminderBackendSync();
});

state.pendingLevelUp?openLevelUp():render();
