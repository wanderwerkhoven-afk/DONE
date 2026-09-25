// ============================================================================
// DONE. — PUSH SERVICE WORKER
// Alleen Web Push + notification click handling. Geen asset/offline caching.
// ============================================================================

self.addEventListener("install",()=>{
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});

// ============================================================================
// PUSH EVENT
// Toont payload uit de backend met veilige fallbackwaarden.
// ============================================================================
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
