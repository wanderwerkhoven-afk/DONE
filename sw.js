// ============================================================================
// DONE. — OFFLINE-FIRST PWA + PUSH
// App shell is pre-cached; same-origin artwork is cached as it is used.
// API requests and state transfers are NEVER cached. User state stays in localStorage.
// ============================================================================
const SHELL_CACHE="done-shell-v7";
const HERO_CACHE="done-heroes-v3";
const ASSET_CACHE="done-assets-v2";
const CACHE_PREFIX="done-";
const APP_SHELL=[
  "./",
  "./index.html",
  "./style.css",
  "./world.css",
  "./world.js",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./install/install.css",
  "./install/install.js"
];
// All hero variants are required offline, including time-of-day and task states.
const HERO_IMAGES=[
  "hero-home.png",
  "hero-home-morning.png",
  "hero-home-daytime.png",
  "hero-home-sundown.png",
  "hero-home-evening.png",
  "hero-home-night.png",
  "hero-new-task.png",
  "hero-task-completed.png"
].map(name=>`./assets/images/home/${name}`);
const heroPathnames=new Set(HERO_IMAGES.map(path=>new URL(path,self.registration.scope).pathname));
const INSTALL_PAGES=["illustration","simple"].flatMap(type=>
  Array.from({length:16},(_,i)=>`./install/${type}-${String(i+1).padStart(2,"0")}.html`)
);

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    // Core files must all succeed before activating, preventing a broken offline shell.
    await cache.addAll(APP_SHELL);
    // Complete the full hero download before activating the new worker.
    // If storage/network fails, retain the previous working service worker.
    const heroCache=await caches.open(HERO_CACHE);
    await heroCache.addAll(HERO_IMAGES);
    // Install variants aren't critical to startup; cache them opportunistically.
    await Promise.allSettled(INSTALL_PAGES.map(page=>cache.add(page)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&
      key!==SHELL_CACHE&&key!==ASSET_CACHE&&key!==HERO_CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

const shellPathnames=new Set(APP_SHELL.map(path=>new URL(path,self.registration.scope).pathname));
const isCacheableResponse=response=>response&&response.ok&&response.type!=="opaque";
const cacheAsset=async(request,response)=>{
  if(!isCacheableResponse(response))return;
  const copy=response.clone();
  const cache=await caches.open(ASSET_CACHE);
  await cache.put(request,copy);
};
const cachedShell=async request=>{
  const cache=await caches.open(SHELL_CACHE);
  return cache.match(request,{ignoreSearch:true});
};

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  // External requests, including the push backend, must stay on the network.
  if(url.origin!==self.location.origin)return;
  const scope=new URL(self.registration.scope);
  if(!url.pathname.startsWith(scope.pathname))return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(isCacheableResponse(response)&&!url.searchParams.has("transfer")){
          const cache=await caches.open(SHELL_CACHE);
          await cache.put(request,response.clone());
        }
        return response;
      }catch{
        return (await cachedShell(request))||
          (await cachedShell(new URL("./index.html",scope)))||
          Response.error();
      }
    })());
    return;
  }

  if(heroPathnames.has(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(HERO_CACHE);
      const cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(isCacheableResponse(response))await cache.put(request,response.clone());
        return response;
      }catch{return Response.error();}
    })());
    return;
  }

  if(shellPathnames.has(url.pathname)){
    event.respondWith((async()=>{
      const cached=await cachedShell(request);
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(isCacheableResponse(response)){
          const cache=await caches.open(SHELL_CACHE);
          await cache.put(request,response.clone());
        }
        return response;
      }catch{return Response.error();}
    })());
    return;
  }

  // Cache artwork and icons after first use, so navigation/reloads work offline.
  if(url.pathname.includes("/assets/")||url.pathname.includes("/install/")){
    event.respondWith((async()=>{
      const cached=await caches.match(request,{ignoreSearch:true});
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(isCacheableResponse(response))event.waitUntil(cacheAsset(request,response));
        return response;
      }catch{return Response.error();}
    })());
  }
});

self.addEventListener("push",event=>{
  let payload={
    title:"DONE.",
    body:"Je hebt nog open taken staan voor vandaag!",
    tag:"done-open-tasks-reminder",
    url:"./"
  };

  try{
    if(event.data)payload={...payload,...event.data.json()};
  }catch{
    try{
      payload.body=event.data?.text()||payload.body;
    }catch{}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title||"DONE.",{
      body:payload.body||"Je hebt nog open taken staan voor vandaag!",
      tag:payload.tag||"done-open-tasks-reminder",
      renotify:false,
      data:{url:payload.url||"./"}
    })
  );
});

// ============================================================================
// NOTIFICATION CLICK
// Focus bestaande DONE.-window; open anders een nieuw appvenster.
// ============================================================================
self.addEventListener("notificationclick",event=>{
  event.notification.close();

  const targetUrl=new URL(
    event.notification.data?.url||"./",
    self.location.origin
  ).href;

  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({
      type:"window",
      includeUncontrolled:true
    });

    for(const client of windows){
      if("focus" in client){
        await client.focus();
        if("navigate" in client&&client.url!==targetUrl){
          await client.navigate(targetUrl);
        }
        return;
      }
    }

    if(self.clients.openWindow){
      await self.clients.openWindow(targetUrl);
    }
  })());
});
