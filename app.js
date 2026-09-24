const STORAGE_KEY="done-state-v1";
const defaultState={level:1,xp:0,maxXp:100,streak:0,coins:0,profileAvatar:1,tasks:[{title:"Verslag afmaken",meta:"Grote taak",xp:50,icon:"🧠"},{title:"Mail beantwoorden",meta:"Kleine taak",xp:10,icon:"✉️"},{title:"Was ophangen",meta:"",xp:10,icon:"🧹",done:true},{title:"20 min sporten",meta:"Normale taak",xp:25,icon:"🏋️"}]};
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
archiveOldCompletedTasks();
saveState();
function render(){archiveOldCompletedTasks();saveState();const today=localDateKey(),visibleTasks=state.tasks.filter(t=>!t.done||!t.completedAt||localDateKey(t.completedAt)===today),done=visibleTasks.filter(t=>t.done).length,total=visibleTasks.length,taskPct=total?Math.round(done/total*100):0,xpPct=state.maxXp?Math.min(100,Math.round(state.xp/state.maxXp*100)):0;document.querySelector("#app").innerHTML=`<div class="phone"><section class="hero hero-image"><div class="brand"><div class="logo">DONE.</div><div class="tag">Small steps. A bigger you.</div></div><div class="level"><span class="fire">🔥</span><b>Lv. ${state.level}</b><div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${state.maxXp}" aria-valuenow="${state.xp}"><i style="width:${xpPct}%"></i></div><small>${state.xp} / ${state.maxXp} XP</small></div></section><main class="content"><div class="greet"><h1>Goedemiddag! 👋</h1><p>Wat gaan we vandaag afmaken?</p></div><div class="progressrow"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${taskPct}%"></i></div><div class="fraction">${done} / ${total}<br>${taskPct}%</div></div><div class="stats"><div class="stat"><span class="streak-fire" aria-hidden="true">🔥</span><div><strong>${state.streak}</strong><small>dag streak</small></div></div><div class="stat"><button class="coin-sprite" type="button" aria-label="Munt draaien" onclick="spinCoin(this)"></button><div><strong>${state.coins.toLocaleString("nl-NL")}</strong><small>coins</small></div></div></div><div class="tasks">${visibleTasks.map(t=>{const i=state.tasks.indexOf(t);return `<button class="task ${t.done?"done":""}" onclick="toggleTask(${i})"><span class="check">${t.done?"✓":""}</span><span class="taskicon">${t.icon}</span><span><div class="tasktitle">${t.title}</div>${t.meta?`<div class="taskmeta">${t.meta}</div>`:""}</span><span class="reward">+${t.xp} XP</span></button>`}).join("")}</div><button class="task-log-link" onclick="openTaskLog()">Takenlogboek <span>›</span></button></main><button class="add" aria-label="Taak toevoegen" onclick="openNewTask()">+</button><nav class="nav"><button class="active"><span class="ni">▣</span>Vandaag</button><button><span class="ni">◉</span>Wereld</button><button><span class="ni">♜</span>Achievements</button><button onclick="openProfile()"><span class="ni">●</span>Profiel</button></nav></div>`}

const addXp=amount=>{state.xp+=amount;let levelsGained=0;while(state.xp>=state.maxXp){state.xp-=state.maxXp;state.level++;levelsGained++;state.maxXp=xpForLevel(state.level)}saveState();return levelsGained};
const updateStreak=()=>{
  const today=localDateKey(),last=state.lastActiveDate;
  if(last===today)return;
  const y=new Date();y.setDate(y.getDate()-1);
  state.streak=last===localDateKey(y)?Math.max(1,Number(state.streak)||0)+1:1;
  state.lastActiveDate=today;
};
window.toggleTask=i=>{
  const t=state.tasks[i];
  if(!t.done){
    t.done=true;t.completedAt=new Date().toISOString();
    let levelsGained=0,coins=0;
    if(!t.rewardClaimed){
      t.rewardClaimed=true;levelsGained=addXp(t.xp);coins=coinReward(t.xp);state.coins=(Number(state.coins)||0)+coins;updateStreak();
    }
    saveState();openTaskCompleted(t,{coins,levelsGained});return;
  }
  t.done=false;t.completedAt=null;saveState();render();
};

window.spinCoin=el=>{if(el.dataset.spinning==="1")return;el.dataset.spinning="1";const frames=16,rotations=5,totalFrames=frames*rotations,duration=1500;let last=-1;el.classList.remove("coin-hop");void el.offsetWidth;el.classList.add("coin-hop");const started=performance.now();const animate=now=>{const t=Math.min((now-started)/duration,1),progress=(1-Math.cos(Math.PI*t))/2,step=Math.min(Math.floor(progress*totalFrames),totalFrames-1);if(step!==last){el.style.backgroundPosition=(-((step%frames)*64))+"px 0";last=step}if(t<1){requestAnimationFrame(animate);return}el.style.backgroundPosition="0 0";el.classList.remove("coin-hop");el.dataset.spinning="0"};requestAnimationFrame(animate)};

window.openNewTask=()=>{document.querySelector("#app").innerHTML=`<div class="phone new-task-screen"><header class="new-task-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><h1>Nieuwe taak</h1></header><section class="new-task-hero"><div class="quote-bubble">Elke grote reis<br>begint met een kleine stap.</div></section><main class="new-task-form"><label for="taskName">Wat wil je doen?</label><input id="taskName" class="task-input" placeholder="Bijv. Verslag afmaken..." maxlength="80"><fieldset><legend>Hoe groot is deze taak?</legend><div class="size-grid"><button class="size-card" data-size="small" onclick="selectTaskSize(this)"><span class="size-icon">🌱</span><strong>Klein</strong><b>+10 XP</b></button><button class="size-card selected" data-size="normal" onclick="selectTaskSize(this)"><span class="size-icon">🔥</span><strong>Normaal</strong><b>+25 XP</b></button><button class="size-card" data-size="large" onclick="selectTaskSize(this)"><span class="size-icon">⛰️</span><strong>Groot</strong><b>+50 XP</b></button></div></fieldset><button class="submit-task" onclick="saveNewTask()">Taak toevoegen</button></main></div>`};
window.selectTaskSize=el=>{document.querySelectorAll(".size-card").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")};
window.saveNewTask=()=>{const input=document.querySelector("#taskName"),size=document.querySelector(".size-card.selected")?.dataset.size||"normal";if(!input.value.trim()){input.focus();return}const values={small:["Kleine taak",10,"🌱"],normal:["Normale taak",25,"🔥"],large:["Grote taak",50,"⛰️"]}[size];state.tasks.unshift({id:`task-${Date.now()}`,title:input.value.trim(),meta:values[0],xp:values[1],icon:values[2],done:false,rewardClaimed:false,createdAt:new Date().toISOString()});saveState();render()};

window.openTaskCompleted=(t,reward={coins:0,levelsGained:0})=>{document.querySelector("#app").innerHTML=`<div class="phone completed-screen"><section class="completed-scene"><div class="completed-copy"><h1 class="arched-title" aria-label="Taak voltooid!"><span style="--n:0">T</span><span style="--n:1">a</span><span style="--n:2">a</span><span style="--n:3">k</span><span class="gap" style="--n:4">&nbsp;</span><span style="--n:5">v</span><span style="--n:6">o</span><span style="--n:7">l</span><span style="--n:8">t</span><span style="--n:9">o</span><span style="--n:10">o</span><span style="--n:11">i</span><span style="--n:12">d</span><span style="--n:13">!</span></h1><p>Goed bezig!</p></div><div class="celebration-rays"></div><div class="completion-check"><span>✓</span></div><div class="xp-pop">+${t.xp} XP${reward.coins?`<small>+${reward.coins} coins</small>`:""}${reward.levelsGained?`<em>Level ${state.level}!</em>`:""}</div><div class="completion-quote">“Consistentie bouwt<br>een betere jij.”</div><div class="landing-glow" aria-hidden="true"></div><div class="completion-character" aria-hidden="true"></div><div class="confetti" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i class="${i<16?"pop-left":"pop-right"}" style="--i:${i%16}"></i>`).join("")}</div></section><button class="completed-btn" onclick="render()">Nice! ✨</button></div>`;requestAnimationFrame(()=>document.querySelector(".completed-screen")?.classList.add("play"))};

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
      </section>
    </main>
    <nav class="nav profile-nav"><button onclick="render()"><span class="ni">▣</span>Vandaag</button><button><span class="ni">◉</span>Wereld</button><button><span class="ni">♜</span>Achievements</button><button class="active"><span class="ni">●</span>Profiel</button></nav>
  </div>`;
};

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

window.saveProfileSetting=el=>{state[el.dataset.setting]=el.checked;saveState()};

window.openTaskLog=()=>{
  archiveOldCompletedTasks();saveState();
  const all=[...state.taskHistory,...state.tasks.filter(t=>t.done&&t.completedAt)].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  const groups=all.reduce((acc,t)=>{const k=localDateKey(t.completedAt);(acc[k]??=[]).push(t);return acc},{});
  const fmt=k=>new Date(k+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  document.querySelector("#app").innerHTML=`<div class="phone task-log-screen"><header class="task-log-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><div><h1>Takenlogboek</h1><p>Alles wat je hebt afgemaakt.</p></div></header><main class="task-log-content">${all.length?Object.entries(groups).map(([date,tasks])=>`<section class="task-log-day"><h2>${fmt(date)}</h2>${tasks.map(t=>`<article class="task-log-item"><span class="task-log-check">✓</span><div><strong>${t.title}</strong><small>${new Date(t.completedAt).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})} · +${t.xp} XP · +${coinReward(t.xp)} coins</small></div></article>`).join("")}</section>`).join(""):`<div class="task-log-empty"><span>✓</span><h2>Nog geen voltooide taken</h2><p>Je afgeronde taken verschijnen hier automatisch.</p></div>`}</main></div>`;
};

render();
