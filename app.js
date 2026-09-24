const state={level:8,xp:340,maxXp:600,streak:6,coins:1240,tasks:[{title:"Verslag afmaken",meta:"Grote taak",xp:50,icon:"🧠"},{title:"Mail beantwoorden",meta:"Kleine taak",xp:10,icon:"✉️"},{title:"Was ophangen",meta:"",xp:10,icon:"🧹",done:true},{title:"20 min sporten",meta:"Normale taak",xp:25,icon:"🏋️"}]};function render(){document.querySelector("#app").innerHTML=`<div class="phone"><section class="hero hero-image"><div class="brand"><div class="logo">DONE.</div><div class="tag">Small steps. A bigger you.</div></div><div class="level"><span class="fire">🔥</span><b>Lv. ${state.level}</b><div class="xpbar"><i></i></div><small>${state.xp} / ${state.maxXp} XP</small></div></section><main class="content"><div class="greet"><h1>Goedemiddag! 👋</h1><p>Wat gaan we vandaag afmaken?</p></div><div class="progressrow"><div class="progress"><i></i></div><div class="fraction">4 / 7<br>57%</div></div><div class="stats"><div class="stat"><span class="streak-fire" aria-hidden="true">🔥</span><div><strong>${state.streak}</strong><small>dag streak</small></div></div><div class="stat"><button class="coin-sprite" type="button" aria-label="Munt draaien" onclick="spinCoin(this)"></button><div><strong>${state.coins.toLocaleString("nl-NL")}</strong><small>coins</small></div></div></div><div class="tasks">${state.tasks.map((t,i)=>`<button class="task ${t.done?"done":""}" onclick="toggleTask(${i})"><span class="check">${t.done?"✓":""}</span><span class="taskicon">${t.icon}</span><span><div class="tasktitle">${t.title}</div>${t.meta?`<div class="taskmeta">${t.meta}</div>`:""}</span><span class="reward">+${t.xp} XP</span></button>`).join("")}</div></main><button class="add" aria-label="Taak toevoegen" onclick="openNewTask()">+</button><nav class="nav"><button class="active"><span class="ni">▣</span>Vandaag</button><button><span class="ni">◉</span>Wereld</button><button><span class="ni">♜</span>Achievements</button><button><span class="ni">●</span>Profiel</button></nav></div>`}window.toggleTask=i=>{state.tasks[i].done=!state.tasks[i].done;render()};window.spinCoin=el=>{
  if(el.dataset.spinning==="1")return;
  el.dataset.spinning="1";
  const frames=16, rotations=5, totalFrames=frames*rotations;
  const duration=1500;
  let last=-1;
  el.classList.remove("coin-hop");
  void el.offsetWidth;
  el.classList.add("coin-hop");
  const started=performance.now();
  const animate=now=>{
    const t=Math.min((now-started)/duration,1);
    // cosine ease-in-out: acceleration peaks at 2.5 rotations, then mirrors into deceleration
    const progress=(1-Math.cos(Math.PI*t))/2;
    const step=Math.min(Math.floor(progress*totalFrames),totalFrames-1);
    if(step!==last){
      el.style.backgroundPosition=(-((step%frames)*64))+"px 0";
      last=step;
    }
    if(t<1){requestAnimationFrame(animate);return;}
    el.style.backgroundPosition="0 0";
    el.classList.remove("coin-hop");
    el.dataset.spinning="0";
  };
  requestAnimationFrame(animate);
};

window.openNewTask=()=>{document.querySelector("#app").innerHTML=`<div class="phone new-task-screen"><header class="new-task-header"><button class="back-btn" onclick="render()" aria-label="Terug">←</button><h1>Nieuwe taak</h1></header><section class="new-task-hero"><div class="quote-bubble">Elke grote reis<br>begint met een kleine stap.</div></section><main class="new-task-form"><label for="taskName">Wat wil je doen?</label><input id="taskName" class="task-input" placeholder="Bijv. Verslag afmaken..." maxlength="80"><fieldset><legend>Hoe groot is deze taak?</legend><div class="size-grid"><button class="size-card" data-size="small" onclick="selectTaskSize(this)"><span class="size-icon">🌱</span><strong>Klein</strong><b>+10 XP</b></button><button class="size-card selected" data-size="normal" onclick="selectTaskSize(this)"><span class="size-icon">🔥</span><strong>Normaal</strong><b>+25 XP</b></button><button class="size-card" data-size="large" onclick="selectTaskSize(this)"><span class="size-icon">⛰️</span><strong>Groot</strong><b>+50 XP</b></button></div></fieldset><button class="submit-task" onclick="saveNewTask()">Taak toevoegen</button></main></div>`};
window.selectTaskSize=el=>{document.querySelectorAll(".size-card").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")};
window.saveNewTask=()=>{const input=document.querySelector("#taskName"),size=document.querySelector(".size-card.selected")?.dataset.size||"normal";if(!input.value.trim()){input.focus();return}const values={small:["Kleine taak",10,"🌱"],normal:["Normale taak",25,"🔥"],large:["Grote taak",50,"⛰️"]}[size];state.tasks.unshift({title:input.value.trim(),meta:values[0],xp:values[1],icon:values[2]});render()};

render();