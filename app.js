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
const defaultState={level:1,xp:0,maxXp:100,streak:0,coins:0,profileAvatar:1,appIconCategory:"illustration-art",appIcon:"illustration-01",rewardScreensEnabled:true,reminderEnabled:false,reminderTime:DEFAULT_REMINDER_TIME,reminderLastSent:null,tasks:[{title:"Verslag afmaken",meta:"Grote taak",xp:50,icon:"🧠"},{title:"Mail beantwoorden",meta:"Kleine taak",xp:10,icon:"✉️"},{title:"Was ophangen",meta:"",xp:10,icon:"🧹",done:true},{title:"20 min sporten",meta:"Normale taak",xp:25,icon:"🏋️"}]};
const xpForLevel=level=>100+(Math.max(1,level)-1)*50;
const savedState=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(e){return null}})();
const state={...defaultState,...(savedState||{})};
const APP_ICON_COUNT=16;
const appIconId=n=>`illustration-${String(n).padStart(2,"0")}`;
const appIconPath=id=>`assets/images/app-icons/illustration-art/${id}.png`;
const normalizedAppIcon=()=>{
  const match=String(state.appIcon||"").match(/^illustration-(\d{2})$/);
  const n=match?Number(match[1]):1;
  return n>=1&&n<=APP_ICON_COUNT?appIconId(n):appIconId(1);
};
state.appIconCategory="illustration-art";
state.appIcon=normalizedAppIcon();
const applySelectedAppIcon=()=>{
  const path=appIconPath(state.appIcon);
  document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>{link.href=path});
};
state.rewardScreensEnabled=state.rewardScreensEnabled!==false;
state.reminderTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(state.reminderTime||""))
  ?String(state.reminderTime)
  :DEFAULT_REMINDER_TIME;
state.tasks=Array.isArray(state.tasks)?state.tasks:defaultState.tasks;
state.level=Math.max(1,Number(state.level)||1);
state.xp=Math.max(0,Number(state.xp)||0);
state.maxXp=xpForLevel(state.level);
while(state.xp>=state.maxXp){state.xp-=state.maxXp;state.level++;state.maxXp=xpForLevel(state.level)}
applySelectedAppIcon();
const localDateKey=d=>{const x=d?new Date(d):new Date();return [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),String(x.getDate()).padStart(2,"0")].join("-")};
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const coinReward=xp=>xp>=50?10:xp>=25?5:2;
const HOME_HERO_BY_PERIOD={
  morning:"assets/images/home/hero-home-morning.png",
  daytime:"assets/images/home/hero-home-daytime.png",
  sundown:"assets/images/home/hero-home-sundown.png",
  evening:"assets/images/home/hero-home-evening.png",
  night:"assets/images/home/hero-home-night.png"
};
const homeHeroPeriod=date=>{
  const hour=(date||new Date()).getHours();
  if(hour>=6&&hour<10)return "morning";
  if(hour>=10&&hour<19)return "daytime";
  if(hour>=19&&hour<21)return "sundown";
  if(hour>=21&&hour<23)return "evening";
  return "night";
};
const homeHeroUrl=date=>HOME_HERO_BY_PERIOD[homeHeroPeriod(date)];
const homeGreeting=date=>{const period=homeHeroPeriod(date);return period==="morning"?"Goedemorgen! 👋":period==="daytime"?"Goedemiddag! 👋":"Goedenavond! 👋"};
let homeHeroTimer=null;
const applyHomeHeroForCurrentTime=()=>{
  const hero=document.querySelector(".hero.hero-image");
  if(!hero)return;
  const period=homeHeroPeriod();
  if(hero.dataset.heroPeriod===period)return;
  hero.dataset.heroPeriod=period;
  hero.style.setProperty("--home-hero-image",`url("${HOME_HERO_BY_PERIOD[period]}")`);
};
const scheduleHomeHeroRefresh=()=>{
  if(homeHeroTimer){clearTimeout(homeHeroTimer);homeHeroTimer=null}
  const hero=document.querySelector(".hero.hero-image");
  if(!hero)return;
  applyHomeHeroForCurrentTime();
  const now=new Date();
  const next=new Date(now);
  const hour=now.getHours();
  const nextHour=hour<6?6:hour<10?10:hour<19?19:hour<21?21:hour<23?23:30;
  if(nextHour===30){
    next.setDate(next.getDate()+1);
    next.setHours(6,0,1,0);
  }else{
    next.setHours(nextHour,0,1,0);
  }
  homeHeroTimer=setTimeout(()=>{
    applyHomeHeroForCurrentTime();
    scheduleHomeHeroRefresh();
  },Math.min(next-now,2147483647));
};

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
const equalBytes=(a,b)=>{
  const left=a instanceof Uint8Array?a:new Uint8Array(a||[]);
  const right=b instanceof Uint8Array?b:new Uint8Array(b||[]);
  return left.length===right.length&&left.every((value,index)=>value===right[index]);
};

const getOrCreatePushSubscription=async()=>{
  if(!("serviceWorker" in navigator)||!("PushManager" in window))return null;
  if(!("Notification" in window)||Notification.permission!=="granted")return null;

  let registration=await navigator.serviceWorker.getRegistration();
  if(!registration)registration=await registerDoneServiceWorker();
  if(!registration)return null;

  await navigator.serviceWorker.ready;

  const backendUrl=getReminderBackendUrl();
  if(!backendUrl)throw new Error("De push-backend is nog niet gekoppeld.");

  const response=await fetch(`${backendUrl}/vapid-public-key`,{
    headers:{Accept:"application/json"},
    cache:"no-store"
  });
  if(!response.ok)throw new Error("Publieke VAPID-key ophalen mislukt.");

  const payload=await response.json();
  if(!payload?.publicKey)throw new Error("Publieke VAPID-key ontbreekt.");

  const applicationServerKey=base64UrlToUint8Array(payload.publicKey);
  let subscription=await registration.pushManager.getSubscription();

  // Push subscriptions are cryptographically bound to the VAPID public key
  // used at subscribe time. Recreate stale subscriptions automatically.
  if(subscription){
    const currentKey=subscription.options?.applicationServerKey;
    if(!currentKey||!equalBytes(currentKey,applicationServerKey)){
      await subscription.unsubscribe().catch(()=>false);
      subscription=null;
    }
  }

  if(subscription)return subscription;

  return registration.pushManager.subscribe({
    userVisibleOnly:true,
    applicationServerKey
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
  const synced=await syncReminderBackendState(true);
  if(!synced&&getReminderBackendUrl()){
    state.reminderEnabled=false;
    saveState();
    el.checked=false;
    scheduleTaskReminder();
    alert("De pushverbinding kon niet met de backend worden opgeslagen. Probeer het opnieuw.");
  }
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

    const backendUrl=getReminderBackendUrl();
    if(!backendUrl){
      throw new Error("De push-backend is nog niet gekoppeld.");
    }

    // Test de echte Web Push-keten rechtstreeks met de actuele browser-
    // subscription. De test is daardoor niet afhankelijk van de dagelijkse
    // reminder-toggle of een reeds gesynchroniseerde D1-record.
    const subscription=await getOrCreatePushSubscription();
    if(!subscription){
      throw new Error("Push-subscription kon niet worden aangemaakt.");
    }

    const response=await fetch(`${backendUrl}/test-push`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId:getReminderClientId(),
        endpoint:subscription.endpoint,
        subscription:subscription.toJSON()
      })
    });

    let payload={};
    try{payload=await response.json()}catch(e){}

    if(!response.ok||payload.ok===false){
      throw new Error(payload.providerReason?`${payload.error||"Pushprovider weigerde de testmelding"} (${payload.providerReason})`:payload.error||"De backend kon de test-push niet versturen.");
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
function render(){cancelTaskLongPress?.();activeTaskEditIndex=null;archiveOldCompletedTasks();saveState();const today=localDateKey(),visibleTasks=state.tasks.filter(t=>!t.done||!t.completedAt||localDateKey(t.completedAt)===today),done=visibleTasks.filter(t=>t.done).length,total=visibleTasks.length,taskPct=total?Math.round(done/total*100):0,xpPct=state.maxXp?Math.min(100,Math.round(state.xp/state.maxXp*100)):0;document.querySelector("#app").innerHTML=`<div class="phone"><section class="hero hero-image" data-hero-period="${homeHeroPeriod()}" style="--home-hero-image:url('${homeHeroUrl()}')"><div class="brand"><div class="logo">DONE.</div><div class="tag">Small steps. A bigger you.</div></div><div class="level"><span class="fire">🔥</span><b>Lv. ${state.level}</b><div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${state.maxXp}" aria-valuenow="${state.xp}"><i style="width:${xpPct}%"></i></div><small>${state.xp} / ${state.maxXp} XP</small></div></section><main class="content"><div class="greet"><h1>${homeGreeting()}</h1><p>Wat gaan we vandaag afmaken?</p></div><div class="progressrow"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${taskPct}%"></i></div><div class="fraction">${done} / ${total}<br>${taskPct}%</div></div><div class="stats"><div class="stat"><span class="streak-fire" aria-hidden="true">🔥</span><div><strong>${state.streak}</strong><small>dag streak</small></div></div><div class="stat"><button class="coin-sprite" type="button" aria-label="Munt draaien" onclick="spinCoin(this)"></button><div><strong>${state.coins.toLocaleString("nl-NL")}</strong><small>coins</small></div></div></div><div class="tasks">${visibleTasks.length?visibleTasks.map(t=>{const i=state.tasks.indexOf(t);return `<div class="task-wrap" data-task-index="${i}"><button class="task ${t.done?"done":""}" onclick="handleTaskClick(event,${i})" onpointerdown="startTaskLongPress(event,${i},this)" onpointerup="endTaskLongPress(event)" onpointercancel="cancelTaskLongPress()" onpointerleave="cancelTaskLongPress()" onpointermove="trackTaskLongPress(event)" oncontextmenu="return false"><span class="check">${t.done?"✓":""}</span><span class="taskicon">${t.icon}</span><span><div class="tasktitle">${escapeHtml(t.title)}</div>${t.meta?`<div class="taskmeta">${escapeHtml(t.meta)}</div>`:""}</span><span class="reward">+${t.xp} XP</span></button><button class="task-delete-btn" type="button" aria-label="Verwijder taak ${escapeHtml(t.title)}" onclick="deleteTask(event,${i})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button></div>`}).join(""):`<section class="tasks-empty-state" aria-label="Geen taken"><div class="tasks-empty-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25"/><path d="m21 33 7 7 15-17"/></svg></div><h2>Alles afgevinkt</h2><p>Je hebt voor vandaag geen openstaande taken.</p><button type="button" onclick="openNewTask()">Nieuwe taak toevoegen</button></section>`}</div><button class="task-log-link" onclick="openTaskLog()">Takenlogboek <span>›</span></button></main><button class="add" aria-label="Taak toevoegen" onclick="openNewTask()">+</button><nav class="nav"><button class="active"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements${achievementNavAlert()}</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav></div>`;scheduleHomeHeroRefresh()}

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
    if(state.haptics!==false&&navigator.vibrate)navigator.vibrate(35);
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
  queueReminderBackendSync();
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
    if(!state.rewardScreensEnabled){
      if(reward.levelsGained>0){
        state.lastSeenLevel=Math.max(Number(state.lastSeenLevel)||1,Number(reward.newLevel)||state.level);
        state.pendingLevelUp=null;
      }
      saveState();
      queueReminderBackendSync();
      render();
      return;
    }

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
      <button class="profile-app-icon-tile" type="button" onclick="openAppIconPicker()" aria-label="Kies app-icoon">
        <img src="${appIconPath(state.appIcon)}" alt="">
        <span><b>App-icoon</b><small>Illustration Art · kies jouw DONE.-stijl</small></span>
        <i aria-hidden="true">›</i>
      </button>
      <section class="profile-settings">
        <label><span>🔊 <b>Geluid</b></span><input type="checkbox" data-setting="sound" onchange="saveProfileSetting(this)" ${state.sound!==false?"checked":""}><i></i></label>
        <label><span>⚙️ <b>Haptische feedback</b></span><input type="checkbox" data-setting="haptics" onchange="saveProfileSetting(this)" ${state.haptics!==false?"checked":""}><i></i></label>
        <label><span>🌙 <b>Donkere modus</b></span><input type="checkbox" data-setting="darkMode" onchange="saveProfileSetting(this)" ${state.darkMode!==false?"checked":""}><i></i></label>
        <label class="profile-reward-setting"><span>✨ <b>Beloningsschermen</b><small>Taak voltooid + Level Up</small></span><input type="checkbox" onchange="toggleRewardScreens(this)" ${state.rewardScreensEnabled?"checked":""}><i></i></label>
        <label class="profile-reminder-setting"><span>🔔 <b>Dagelijkse herinnering</b><small data-reminder-time-label>${state.reminderTime} · alleen bij open taken</small></span><input type="checkbox" onchange="toggleDailyReminder(this)" ${state.reminderEnabled?"checked":""}><i></i></label>
        <label class="profile-reminder-time"><span>🕒 <b>Tijdstip</b></span><input class="profile-time-input" type="time" value="${state.reminderTime}" step="60" onchange="updateReminderTime(this)" aria-label="Tijdstip dagelijkse herinnering"></label>
      </section>
      <button class="profile-test-notification" type="button" onclick="testDoneNotification(this)" aria-label="Stuur testnotificatie">
        <span class="profile-test-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span>
        <span class="profile-test-copy"><b data-test-title>Test notificatie</b><small data-test-detail>Stuur nu een proefmelding naar dit apparaat</small></span>
        <span class="profile-test-arrow" aria-hidden="true">›</span>
      </button>
      <button class="profile-data-tile" type="button" onclick="openDataPopup()" aria-label="Back-up en gegevensbeheer">
        <span class="profile-data-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></svg></span>
        <span class="profile-data-copy"><b>Gegevens</b><small>Back-up, herstellen en resetten</small></span>
        <span class="profile-data-arrow" aria-hidden="true">›</span>
      </button>
      <button class="profile-reset-progress" type="button" onclick="resetProgress()" aria-label="Reset level en XP">
        <span class="profile-reset-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8V4m0 0h4M4 4l3.1 3.1A7 7 0 1 1 5 13"/></svg></span>
        <span><b>Refresh voortgang</b><small>Zet level en XP terug naar het begin</small></span>
      </button>
    </main>
    <nav class="nav profile-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements${achievementNavAlert()}</button><button class="active"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav>
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
// PROFILE APP ICON PICKER
// Zelfde interactiepatroon als de avatar-selector, met 16 Illustration Art-iconen.
// ============================================================================
window.openAppIconPicker=()=>{
  document.querySelector(".app-icon-picker")?.remove();
  const selected=state.appIcon||appIconId(1);
  const picker=document.createElement("div");
  picker.className="app-icon-picker";
  picker.innerHTML=`<div class="app-icon-picker-backdrop" onclick="closeAppIconPicker()"></div>
    <section class="app-icon-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="appIconPickerTitle">
      <div class="app-icon-picker-head">
        <div><h2 id="appIconPickerTitle">Kies je app-icoon</h2><p>Illustration Art</p></div>
        <button type="button" onclick="closeAppIconPicker()" aria-label="Sluiten">×</button>
      </div>
      <div class="app-icon-grid">
        ${Array.from({length:APP_ICON_COUNT},(_,i)=>{
          const id=appIconId(i+1);
          return `<button class="app-icon-option ${selected===id?"selected":""}" type="button" onclick="selectAppIcon('${id}')" aria-label="App-icoon ${i+1}">
            <img src="${appIconPath(id)}" alt="">
            <span>✓</span>
          </button>`;
        }).join("")}
      </div>
      <p class="app-icon-picker-note">De keuze verandert direct in DONE. Een al geïnstalleerd iPhone-homescreen-icoon kan iOS pas bij een nieuwe installatie verversen.</p>
    </section>`;
  document.querySelector(".profile-screen")?.appendChild(picker);
  requestAnimationFrame(()=>picker.classList.add("show"));
};

window.closeAppIconPicker=()=>{
  const picker=document.querySelector(".app-icon-picker");
  if(!picker)return;
  picker.classList.remove("show");
  setTimeout(()=>picker.remove(),180);
};

window.selectAppIcon=id=>{
  if(!/^illustration-(0[1-9]|1[0-6])$/.test(String(id)))return;
  const changed=id!==state.appIcon;
  state.appIconCategory="illustration-art";
  state.appIcon=id;
  saveState();
  applySelectedAppIcon();
  closeAppIconPicker();
  if(!changed){setTimeout(()=>openProfile(),120);return}
  setTimeout(()=>openAppIconInstallWizard(id),130);
};

const appIconInstallUrl=id=>{
  const base=new URL(".",window.location.href);
  return new URL(`install/${id}.html`,base).href;
};

window.openAppIconInstallWizard=id=>{
  document.querySelector(".app-icon-install")?.remove();
  const icon=/^illustration-(0[1-9]|1[0-6])$/.test(String(id))?id:state.appIcon;
  const wizard=document.createElement("div");
  wizard.className="app-icon-install";
  wizard.dataset.backupReady="false";
  wizard.innerHTML=`<button class="app-icon-install-backdrop" type="button" onclick="closeAppIconInstallWizard()" aria-label="Sluiten"></button>
    <section class="app-icon-install-modal" role="dialog" aria-modal="true" aria-labelledby="iconInstallTitle">
      <button class="app-icon-install-close" type="button" onclick="closeAppIconInstallWizard()" aria-label="Sluiten">×</button>
      <div class="app-icon-install-preview"><img src="${appIconPath(icon)}" alt=""></div>
      <header>
        <span>Nieuw app-icoon gekozen</span>
        <h2 id="iconInstallTitle">Zet dit icoon op je iPhone</h2>
        <p>iOS kan een bestaand PWA-icoon niet live vervangen. Deze korte stappen zorgen dat je data behouden blijft en Safari exact dit icoon gebruikt.</p>
      </header>

      <div class="app-icon-install-steps">
        <article class="app-icon-install-step is-active" data-install-step="1">
          <b>1</b>
          <div><h3>Maak eerst een back-up</h3><p>Dit bewaart je taken, XP, coins, achievements en instellingen.</p>
            <button class="icon-install-backup" type="button" onclick="backupForIconInstall(this)">Back-up maken</button>
            <small class="icon-install-backup-status">Verplicht voordat je verdergaat</small>
          </div>
        </article>

        <article class="app-icon-install-step" data-install-step="2">
          <b>2</b>
          <div><h3>Verwijder de oude homescreen-versie</h3><p>Houd DONE. op je beginscherm ingedrukt en kies de optie om de webapp van je beginscherm te verwijderen.</p></div>
        </article>

        <article class="app-icon-install-step" data-install-step="3">
          <b>3</b>
          <div><h3>Open de gekozen versie in Safari</h3><p>De installpagina heeft dit icoon al vast in de favicon, Apple touch icon én het PWA-manifest staan.</p>
            <button class="icon-install-open" type="button" onclick="openChosenIconInstallPage('${icon}')" disabled>Open DONE. in Safari</button>
          </div>
        </article>

        <article class="app-icon-install-step" data-install-step="4">
          <b>4</b>
          <div><h3>Zet opnieuw op beginscherm</h3><p>Tik in Safari op <strong>Delen</strong> → <strong>Zet op beginscherm</strong>. Daarna start DONE. weer normaal vanaf de hoofdpagina.</p></div>
        </article>

        <article class="app-icon-install-step" data-install-step="5">
          <b>5</b>
          <div><h3>Zet je gegevens terug</h3><p>Open daarna Profiel → Gegevens → Back-up herstellen en kies het zojuist opgeslagen DONE.-bestand.</p></div>
        </article>
      </div>
      <p class="app-icon-install-footnote">Je gekozen icoon blijft ook in je back-up opgeslagen.</p>
    </section>`;
  document.querySelector(".profile-screen")?.appendChild(wizard);
  requestAnimationFrame(()=>wizard.classList.add("show"));
};

window.closeAppIconInstallWizard=()=>{
  const wizard=document.querySelector(".app-icon-install");
  if(!wizard)return;
  wizard.classList.remove("show");
  setTimeout(()=>{wizard.remove();openProfile()},180);
};

window.backupForIconInstall=async button=>{
  if(button?.disabled)return;
  button.disabled=true;
  button.textContent="Back-up maken…";
  const ok=await exportDoneBackup();
  const wizard=document.querySelector(".app-icon-install");
  if(ok&&wizard){
    wizard.dataset.backupReady="true";
    button.textContent="✓ Back-up gemaakt";
    button.classList.add("done");
    const status=wizard.querySelector(".icon-install-backup-status");
    if(status)status.textContent="Veilig opgeslagen";
    wizard.querySelector('[data-install-step="1"]')?.classList.add("is-done");
    wizard.querySelector('[data-install-step="2"]')?.classList.add("is-active");
    wizard.querySelector('[data-install-step="3"]')?.classList.add("is-active");
    const open=wizard.querySelector(".icon-install-open");
    if(open)open.disabled=false;
  }else{
    button.disabled=false;
    button.textContent="Back-up maken";
  }
};

const appIconSafariBridgeUrl=id=>{
  const backendUrl=getReminderBackendUrl();
  const target=appIconInstallUrl(id);
  return backendUrl?`${backendUrl}/open-safari?target=${encodeURIComponent(target)}`:target;
};

window.openChosenIconInstallPage=id=>{
  const wizard=document.querySelector(".app-icon-install");
  if(!wizard||wizard.dataset.backupReady!=="true")return;
  const url=appIconSafariBridgeUrl(id);

  // A same-origin URL stays inside an installed iOS PWA. The bridge lives on
  // our Worker origin, so iOS hands the navigation to Safari first; the Worker
  // then redirects Safari back to the icon-specific install page.
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.target="_blank";
  anchor.rel="noopener external";
  anchor.style.display="none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

// ============================================================================
// PROFILE DATA / BACKUP
// Eén profieltegel opent een popup voor export, import en volledige reset.
// ============================================================================
const BACKUP_VERSION=1;

window.openDataPopup=()=>{
  document.querySelector(".data-popup")?.remove();
  const popup=document.createElement("div");
  popup.className="data-popup";
  popup.innerHTML=`<button class="data-popup-backdrop" type="button" onclick="closeDataPopup()" aria-label="Sluiten"></button>
    <section class="data-popup-modal" role="dialog" aria-modal="true" aria-labelledby="dataPopupTitle">
      <button class="data-popup-close" type="button" onclick="closeDataPopup()" aria-label="Sluiten">×</button>
      <div class="data-popup-emblem" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5"/><path d="M5 17v2h14v-2"/></svg>
      </div>
      <header class="data-popup-head">
        <h2 id="dataPopupTitle">Jouw DONE. gegevens</h2>
        <p>Bewaar je voortgang voordat je de app opnieuw installeert of van apparaat wisselt.</p>
      </header>
      <div class="data-popup-actions">
        <button type="button" onclick="exportDoneBackup()">
          <span class="data-action-icon"><svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></svg></span>
          <span><b>Back-up maken</b><small>Bewaar al je taken, XP en instellingen</small></span>
          <i>›</i>
        </button>
        <button type="button" onclick="chooseDoneBackup()">
          <span class="data-action-icon"><svg viewBox="0 0 24 24"><path d="M12 20V10m0 0 4 4m-4-4-4 4"/><path d="M5 5h14"/></svg></span>
          <span><b>Back-up herstellen</b><small>Zet een eerder opgeslagen DONE.-bestand terug</small></span>
          <i>›</i>
        </button>
      </div>
      <div class="data-popup-danger">
        <button type="button" onclick="resetAllDoneData()">
          <span class="data-action-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5m4-5v5"/></svg></span>
          <span><b>Alle gegevens wissen</b><small>Verwijder taken, XP, achievements en instellingen</small></span>
        </button>
      </div>
      <input class="data-backup-input" type="file" accept="application/json,.json" onchange="restoreDoneBackup(this)" aria-hidden="true" tabindex="-1">
      <p class="data-popup-status" role="status" aria-live="polite"></p>
    </section>`;
  document.querySelector(".profile-screen")?.appendChild(popup);
  requestAnimationFrame(()=>popup.classList.add("show"));
};

window.closeDataPopup=()=>{
  const popup=document.querySelector(".data-popup");
  if(!popup)return;
  popup.classList.remove("show");
  setTimeout(()=>popup.remove(),180);
};

const setDataPopupStatus=(message,type="")=>{
  const el=document.querySelector(".data-popup-status");
  if(!el)return;
  el.textContent=message||"";
  el.dataset.type=type;
};

window.exportDoneBackup=async()=>{
  const backup={
    app:"DONE.",
    format:"done-backup",
    version:BACKUP_VERSION,
    exportedAt:new Date().toISOString(),
    state:JSON.parse(JSON.stringify(state))
  };
  const content=JSON.stringify(backup,null,2);
  const date=localDateKey();
  const fileName=`DONE-backup-${date}.json`;
  const file=new File([content],fileName,{type:"application/json"});

  try{
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      await navigator.share({files:[file],title:"DONE. back-up"});
      setDataPopupStatus("Back-up klaar om te bewaren.","success");
      return true;
    }
  }catch(error){
    if(error?.name==="AbortError")return false;
  }

  const url=URL.createObjectURL(file);
  const link=document.createElement("a");
  link.href=url;
  link.download=fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  setDataPopupStatus("Back-up gedownload.","success");
  return true;
};

window.chooseDoneBackup=()=>{
  const input=document.querySelector(".data-backup-input");
  if(!input)return;
  input.value="";
  input.click();
};

window.restoreDoneBackup=async input=>{
  const file=input?.files?.[0];
  if(!file)return;

  try{
    const raw=await file.text();
    const parsed=JSON.parse(raw);
    if(
      !parsed||
      parsed.format!=="done-backup"||
      !parsed.state||
      typeof parsed.state!=="object"||
      Array.isArray(parsed.state)
    )throw new Error("Dit is geen geldige DONE.-back-up.");

    const restored={...defaultState,...parsed.state};
    if(!Array.isArray(restored.tasks)||!Array.isArray(restored.taskHistory)){
      throw new Error("De back-up bevat ongeldige taakgegevens.");
    }

    const confirmed=window.confirm("Back-up herstellen? Je huidige DONE.-gegevens worden vervangen door deze back-up.");
    if(!confirmed)return;

    localStorage.setItem(STORAGE_KEY,JSON.stringify(restored));
    setDataPopupStatus("Back-up hersteld. DONE. wordt opnieuw geladen…","success");
    setTimeout(()=>window.location.reload(),450);
  }catch(error){
    setDataPopupStatus(error?.message||"Back-up kon niet worden hersteld.","error");
  }
};

window.resetAllDoneData=async()=>{
  const confirmed=window.confirm("Alle DONE.-gegevens wissen? Dit verwijdert je taken, XP, coins, achievements, geschiedenis en instellingen. Dit kan niet ongedaan worden gemaakt.");
  if(!confirmed)return;

  try{
    state.reminderEnabled=false;
    await syncReminderBackendState(true);
    const subscription=await getActivePushSubscription();
    await subscription?.unsubscribe().catch(()=>false);
  }catch(error){
    console.warn("Pushgegevens konden niet volledig worden opgeruimd",error);
  }

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REMINDER_CLIENT_ID_KEY);
  setDataPopupStatus("Alle gegevens zijn gewist. DONE. wordt opnieuw geladen…","success");
  setTimeout(()=>window.location.reload(),450);
};

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
window.toggleRewardScreens=el=>{
  state.rewardScreensEnabled=Boolean(el.checked);
  if(!state.rewardScreensEnabled&&state.pendingLevelUp){
    state.lastSeenLevel=Math.max(Number(state.lastSeenLevel)||1,Number(state.pendingLevelUp.newLevel)||state.level);
    state.pendingLevelUp=null;
  }
  saveState();
};

// ============================================================================
// TASK LOG
// Groepeert afgeronde taken per datum en toont het historische overzicht.
// ============================================================================
window.openTaskLog=()=>{
  archiveOldCompletedTasks();saveState();
  const all=[...state.taskHistory,...state.tasks.filter(t=>t.done&&t.completedAt)].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  const groups=all.reduce((acc,t)=>{const k=localDateKey(t.completedAt);(acc[k]??=[]).push(t);return acc},{});
  const fmt=k=>new Date(k+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  document.querySelector("#app").innerHTML=`<div class="phone task-log-screen"><header class="task-log-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><div><h1>Takenlogboek</h1><p>Alles wat je hebt afgemaakt.</p></div></header><main class="task-log-content">${all.length?Object.entries(groups).map(([date,tasks])=>`<section class="task-log-day"><h2>${fmt(date)}</h2>${tasks.map(t=>`<article class="task-log-item"><span class="task-log-check">✓</span><div><strong>${escapeHtml(t.title)}</strong><small>${new Date(t.completedAt).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})} · +${t.xp} XP · +${coinReward(t.xp)} coins</small></div></article>`).join("")}</section>`).join(""):`<div class="task-log-empty"><span>✓</span><h2>Nog geen voltooide taken</h2><p>Je afgeronde taken verschijnen hier automatisch.</p></div>`}</main></div>`;
};


// ============================================================================
// ACHIEVEMENTS: CATALOG & PERSISTENCE
// Eén catalogus voedt filters, kaarten, detail-sheet, showcase en unlock-state.
// Definitieve badge-art kan later via badgeKey naar assets/images/achievements/.
// ============================================================================
const ACHIEVEMENT_DEFINITIONS=[
  {id:"tasks-1",rarity:"common",title:"Eerste stap",subtitle:"Voltooi je eerste taak",category:"tasks",icon:"star",badgeKey:"sprout",stat:"completedTasks",goal:1},
  {id:"tasks-10",rarity:"common",title:"Op stoom",subtitle:"Voltooi 10 taken",category:"tasks",icon:"badge",badgeKey:"number-ten",stat:"completedTasks",goal:10,requires:"tasks-1"},
  {id:"tasks-25",rarity:"rare",title:"Doener",subtitle:"Voltooi 25 taken",category:"tasks",icon:"badge",badgeKey:"check",stat:"completedTasks",goal:25,requires:"tasks-10"},
  {id:"tasks-50",rarity:"epic",title:"Taakheld",subtitle:"Voltooi 50 taken",category:"tasks",icon:"badge",badgeKey:"trophy",stat:"completedTasks",goal:50,requires:"tasks-25"},
  {id:"tasks-100",rarity:"legendary",title:"Niet te stoppen",subtitle:"Voltooi 100 taken",category:"tasks",icon:"badge",badgeKey:"crown",stat:"completedTasks",goal:100,requires:"tasks-50"},
  {id:"early-bird-5",rarity:"rare",title:"Vroege vogel",subtitle:"Rond op 5 dagen vóór 10:00 een taak af",category:"tasks",icon:"clock",badgeKey:"bird",stat:"earlyBirdDays",goal:5},

  {id:"streak-3",rarity:"common",title:"Vonkje",subtitle:"Houd een streak van 3 dagen",category:"streak",icon:"flame",badgeKey:"flame",stat:"streak",goal:3},
  {id:"streak-7",rarity:"rare",title:"Productieve week",subtitle:"Houd een streak van 7 dagen",category:"streak",icon:"week",badgeKey:"calendar",stat:"streak",goal:7,requires:"streak-3"},
  {id:"streak-14",rarity:"epic",title:"Ritme gevonden",subtitle:"Houd een streak van 14 dagen",category:"streak",icon:"flame",badgeKey:"lightning",stat:"streak",goal:14,requires:"streak-7"},
  {id:"streak-30",rarity:"legendary",title:"Maandmeester",subtitle:"Houd een streak van 30 dagen",category:"streak",icon:"flame",badgeKey:"diamond",stat:"streak",goal:30,requires:"streak-14"},

  {id:"level-2",rarity:"common",title:"Op weg",subtitle:"Bereik level 2",category:"growth",icon:"level",badgeKey:"star",stat:"level",goal:2},
  {id:"level-5",rarity:"rare",title:"Groeispurt",subtitle:"Bereik level 5",category:"growth",icon:"level",badgeKey:"ribbon-medal",stat:"level",goal:5,requires:"level-2"},
  {id:"level-10",rarity:"legendary",title:"Ervaren avonturier",subtitle:"Bereik level 10",category:"growth",icon:"level",badgeKey:"mountaintop",stat:"level",goal:10,requires:"level-5"},
  {id:"focus-1",rarity:"common",title:"Focus gestart",subtitle:"Registreer je eerste focusdag",category:"growth",icon:"focus",badgeKey:"clock",stat:"focusDays",goal:1},
  {id:"focus-10",rarity:"epic",title:"Focusritme",subtitle:"Bereik 10 focusdagen",category:"growth",icon:"focus",badgeKey:"moon",stat:"focusDays",goal:10,requires:"focus-1"},
  {id:"coins-100",rarity:"rare",title:"Spaarpot",subtitle:"Verzamel 100 coins",category:"growth",icon:"coin",badgeKey:"treasure-chest",stat:"coins",goal:100},

  {id:"world-1",rarity:"common",title:"Eerste vondst",subtitle:"Ontgrendel je eerste werelditem",category:"world",icon:"world",badgeKey:"globe",stat:"worldItems",goal:1},
  {id:"world-5",rarity:"rare",title:"Wereldmaker",subtitle:"Ontgrendel 5 werelditems",category:"world",icon:"world",badgeKey:"compass",stat:"worldItems",goal:5,requires:"world-1"},
  {id:"world-10",rarity:"epic",title:"Wereldbouwer",subtitle:"Ontgrendel 10 werelditems",category:"world",icon:"world",badgeKey:"castle",stat:"worldItems",goal:10,requires:"world-5"},
  {id:"world-20",rarity:"legendary",title:"Eigen universum",subtitle:"Ontgrendel 20 werelditems",category:"world",icon:"world",badgeKey:"crown",stat:"worldItems",goal:20,requires:"world-10"}
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

const unseenAchievementCount=()=>achievementSnapshot().filter(item=>item.isNew).length;
const achievementNavAlert=()=>{
  const count=unseenAchievementCount();
  return count?`<span class="nav-alert" aria-label="${count} nieuwe achievements">${count}</span>`:"";
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
const ACHIEVEMENT_ASSET_PATH="assets/images/achievements";
const achievementAsset=badgeKey=>`${ACHIEVEMENT_ASSET_PATH}/achievement-${badgeKey}.png`;

const achievementIcon=(type,locked=false,badgeKey="star")=>{
  const key=locked?"lock":badgeKey;
  return `<span class="achievement-medal ${locked?"locked-medal":"illustrated-medal"}" data-badge-key="${key}">
    <img src="${achievementAsset(key)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
  </span>`;
};

const achievementStatusLabel=a=>a.unlocked?"Ontgrendeld":a.locked?"Niet gevonden":"In progress";
const achievementRarityLabel=rarity=>({common:"Common",rare:"Rare",epic:"Epic",legendary:"Legendary"})[rarity]||"Common";
const achievementMaterialLabel=rarity=>({common:"Bronze",rare:"Silver",epic:"Gold",legendary:"Holographic"})[rarity]||"Bronze";

const achievementRow=(a,index=0)=>`<button class="achievement-card achievement-${a.status} rarity-${a.rarity||"common"} ${a.isNew?"achievement-new":""}" type="button" style="--achievement-delay:${Math.min(index,8)*45}ms;--achievement-progress:${a.unlocked?100:a.pct}%" data-achievement-id="${a.id}" data-category="${a.category}" onclick="openAchievementDetail('${a.id}')" aria-label="${a.title}, ${achievementStatusLabel(a)}">
  <span class="achievement-card-rarity">${achievementRarityLabel(a.rarity)}</span>
  <span class="achievement-card-art">
    <span class="achievement-card-glow" aria-hidden="true"></span>
    ${achievementIcon(a.icon,a.locked,a.badgeKey)}
    ${a.locked?'<span class="achievement-chain" aria-hidden="true"><i></i><i></i></span>':""}
    ${a.isNew?'<em class="achievement-new-sticker">Nieuw!</em>':""}
  </span>
  <span class="achievement-card-name">${a.title}</span>
  <span class="achievement-card-footer">
    ${a.unlocked
      ?'<span class="achievement-found">Gevonden <b>✓</b></span>'
      :a.locked
        ?'<span class="achievement-not-found"><b aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M12 15v2"/></svg></b> Niet gevonden</span>'
        :`<span class="achievement-card-progress-text">${a.value}/${a.goal}</span><span class="achievement-card-progress" role="progressbar" aria-label="Voortgang ${a.title}" aria-valuemin="0" aria-valuemax="${a.goal}" aria-valuenow="${a.value}"><i></i></span>`}
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

    const remainingNew=unseenAchievementCount();
    document.querySelectorAll(".nav-alert").forEach(alert=>{
      if(!remainingNew){alert.remove();return}
      alert.textContent=String(remainingNew);
      alert.setAttribute("aria-label",`${remainingNew} nieuwe achievements`);
    });

    const totalBadge=document.querySelector(".achievements-new-total");
    if(totalBadge){
      if(remainingNew)totalBadge.textContent=`${remainingNew} nieuw`;
      else totalBadge.remove();
    }
  }

  document.querySelector(".achievement-detail")?.remove();

  const remaining=Math.max(0,achievement.goal-achievement.value);
  const unlockedDate=achievement.unlockedAt
    ?new Date(achievement.unlockedAt).toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric"})
    :"";

  const detail=document.createElement("div");
  detail.className="achievement-detail";
  detail.innerHTML=`<button class="achievement-detail-backdrop" type="button" onclick="closeAchievementDetail()" aria-label="Sluit achievementdetails"></button>
    <section class="achievement-detail-modal material-${achievement.rarity||"common"} ${achievement.locked?"is-locked":achievement.unlocked?"is-unlocked":"is-progress"}" role="dialog" aria-modal="true" aria-labelledby="achievementDetailTitle">
      <div class="achievement-detail-frame" aria-hidden="true"></div>
      <button class="achievement-detail-close" type="button" onclick="closeAchievementDetail()" aria-label="Sluiten"><span></span><span></span></button>

      <header class="achievement-detail-banner">
        <small>${achievementMaterialLabel(achievement.rarity)} badge</small>
        <h2 id="achievementDetailTitle">${achievement.title}</h2>
      </header>

      <div class="achievement-detail-scroll">
        <div class="achievement-detail-medal-stage">
          <span class="achievement-detail-halo" aria-hidden="true"></span>
          <div class="achievement-detail-medal">${achievementIcon(achievement.icon,achievement.locked,achievement.badgeKey)}</div>
          ${achievement.locked?'<span class="achievement-detail-lockplate" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M12 15v2"/></svg></span>':""}
        </div>

        <div class="achievement-detail-tags">
          <span class="achievement-detail-category">${categoryLabel(achievement.category)}</span>
          <span class="achievement-detail-material">${achievementMaterialLabel(achievement.rarity)}</span>
          <span class="achievement-detail-status">${achievementStatusLabel(achievement)}</span>
        </div>

        <section class="achievement-detail-description">
          <span class="achievement-detail-panel-label">Achievement</span>
          <p>${achievement.subtitle}</p>
        </section>

        <section class="achievement-detail-progress-hud">
          <div class="achievement-detail-progress-head">
            <div>
              <span class="achievement-detail-panel-label">Voortgang</span>
              <strong>${achievement.unlocked?"Completed":achievement.locked?"Locked":"In progress"}</strong>
            </div>
            <b>${achievement.unlocked?achievement.goal:achievement.value} / ${achievement.goal}</b>
          </div>
          <div class="achievement-progress" style="--achievement-progress:${achievement.unlocked?100:achievement.pct}%" role="progressbar" aria-label="Voortgang ${achievement.title}" aria-valuemin="0" aria-valuemax="${achievement.goal}" aria-valuenow="${achievement.unlocked?achievement.goal:achievement.value}"><i></i></div>
          <div class="achievement-detail-progress-meta">
            ${achievement.unlocked
              ?'<span class="achievement-complete-mark"><b>✓</b> Doel volledig behaald</span>'
              :achievement.locked
                ?'<span>Voltooi eerst de vorige mijlpaal</span>'
                :`<span>${achievement.pct}% voltooid</span><span>Nog ${remaining} te gaan</span>`}
          </div>
        </section>

        <section class="achievement-detail-meta-panel">
          <div>
            <span class="achievement-detail-panel-label">${achievement.unlocked?"Ontgrendeld":"Volgende stap"}</span>
            <p>${achievement.unlocked
              ?`<strong>${unlockedDate||"eerder"}</strong>`
              :achievement.locked
                ?"Vorige mijlpaal behalen"
                :remaining===1
                  ?"Nog 1 actie nodig"
                  :`Nog ${remaining} acties nodig`}</p>
          </div>
          <div class="achievement-detail-tier-preview" data-tier-ready="true">
            <span class="achievement-detail-panel-label">Badgeklasse</span>
            <p><strong>${achievementMaterialLabel(achievement.rarity)}</strong><span>Huidige materiaalrang</span></p>
          </div>
        </section>
      </div>
    </section>`;

  document.querySelector(".achievements-screen")?.appendChild(detail);
  requestAnimationFrame(()=>detail.classList.add("show"));
};

window.closeAchievementDetail=()=>{
  const detail=document.querySelector(".achievement-detail");
  if(!detail)return;
  detail.classList.remove("show");
  setTimeout(()=>detail.remove(),220);
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

  const showcaseUnlocked=recent.map((item,index)=>`<button class="achievement-showcase-item unlocked ${item.isNew?"new":""}" type="button" style="--showcase-delay:${index*70}ms" data-achievement-id="${item.id}" onclick="openAchievementDetail('${item.id}')" aria-label="Bekijk ${item.title}">
    <span class="achievement-showcase-medal">${achievementIcon(item.icon,false,item.badgeKey)}</span>
    <span>${item.title}</span>
  </button>`);

  const showcaseLocked=achievements
    .filter(item=>!item.unlocked)
    .slice(0,Math.max(0,4-showcaseUnlocked.length))
    .map((item,index)=>`<div class="achievement-showcase-item locked" style="--showcase-delay:${(showcaseUnlocked.length+index)*70}ms" aria-label="Nog te ontgrendelen">
      <span class="achievement-showcase-medal">${achievementIcon(item.icon,true,item.badgeKey)}</span>
      <span>Nog te verdienen</span>
    </div>`);

  const showcase=[...showcaseUnlocked,...showcaseLocked].join("");

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

      <section class="achievement-overview" style="--overall-progress:${overallPct}%" aria-label="Totale achievementvoortgang">
        <div class="achievement-overview-emblem" aria-hidden="true"><img src="${achievementAsset("trophy")}" alt=""></div>
        <div class="achievement-overview-main">
          <span class="achievement-overview-eyebrow">Collectievoortgang</span>
          <div class="achievement-overview-top"><div><strong>${unlockedCount}<span>/${total}</span></strong><small>ontgrendeld</small></div><b>${overallPct}%</b></div>
          <div class="achievement-overall-progress" role="progressbar" aria-label="Totale achievementvoortgang" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${unlockedCount}"><i></i><span></span></div>
        </div>
      </section>

      <section class="achievement-showcase" aria-label="Recente trofeeën">
        <div class="achievement-section-head"><h2>Trofeeënkast</h2><small>Jouw laatste buit</small></div>
        <div class="achievement-showcase-row">${showcase}</div>
      </section>

      <div class="achievement-section-head achievement-challenges-head"><h2>Badge collectie</h2><small>${unlockedCount} van ${total} gevonden</small></div>
      <div class="achievement-filters" aria-label="Filter achievements">${filterButtons}</div>
      <section class="achievement-list">${achievements.map(achievementRow).join("")}</section>
    </main>
    <nav class="nav achievements-nav"><button onclick="render()"><span class="ni">${navIcon("today")}</span>Vandaag</button><button><span class="ni">${navIcon("world")}</span>Wereld</button><button class="active" onclick="openAchievements()"><span class="ni">${navIcon("achievements")}</span>Achievements${achievementNavAlert()}</button><button onclick="openProfile()"><span class="ni">${navIcon("profile")}</span>Profiel</button></nav>
  </div>`;

  requestAnimationFrame(()=>{
    window.scrollTo(0,0);
    const content=document.querySelector(".achievements-content");
    if(content)content.scrollTop=0;
    document.querySelector(".achievements-screen")?.classList.add("play");
  });
};

syncAchievementUnlocks();
saveState();

registerDoneServiceWorker().then(()=>{
  if(state.reminderEnabled&&"Notification" in window&&Notification.permission==="granted"){
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
  applyHomeHeroForCurrentTime();
  scheduleHomeHeroRefresh();
});

if(!state.rewardScreensEnabled&&state.pendingLevelUp){
  state.lastSeenLevel=Math.max(Number(state.lastSeenLevel)||1,Number(state.pendingLevelUp.newLevel)||state.level);
  state.pendingLevelUp=null;
  saveState();
}
state.rewardScreensEnabled&&state.pendingLevelUp?openLevelUp():render();
