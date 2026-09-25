import { buildPushPayload } from "@block65/webcrypto-web-push";

// ============================================================================
// RESPONSE / CORS HELPERS
// ============================================================================
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,
  headers:{"content-type":"application/json; charset=utf-8",...extra}
});

const corsHeaders=env=>({
  "access-control-allow-origin":env.APP_ORIGIN||"*",
  "access-control-allow-methods":"GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers":"content-type, authorization"
});

const fail=(message,status,env)=>json({ok:false,error:message},status,corsHeaders(env));

// ============================================================================
// VALIDATION
// ============================================================================
const TIME_RE=/^([01]\d|2[0-3]):[0-5]\d$/;
const CLIENT_ID_RE=/^[A-Za-z0-9_-]{12,160}$/;
const TRANSFER_TTL_MS=15*60*1000;
const TRANSFER_TOKEN_RE=/^[A-Za-z0-9_-]{32,128}$/;
const APP_ICON_RE=/^(illustration|simple)-(0[1-9]|1[0-6])$/;


const normalizeTime=value=>TIME_RE.test(String(value||""))?String(value):"17:00";

const normalizeTimezone=value=>{
  const zone=typeof value==="string"&&value?value:"Europe/Amsterdam";
  try{
    new Intl.DateTimeFormat("en",{timeZone:zone}).format(new Date());
    return zone;
  }catch{
    return "Europe/Amsterdam";
  }
};

const validClientId=value=>typeof value==="string"&&CLIENT_ID_RE.test(value);

// ============================================================================
// LOCAL TIME
// Converts current UTC time into each subscription's stored IANA timezone.
// ============================================================================
const localParts=(date,timeZone)=>{
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23"
  }).formatToParts(date);

  const get=type=>parts.find(part=>part.type===type)?.value||"";

  return {
    date:`${get("year")}-${get("month")}-${get("day")}`,
    time:`${get("hour")}:${get("minute")}`
  };
};

// ============================================================================
// WEB PUSH / VAPID
// ============================================================================
const requireVapid=env=>{
  if(!env.VAPID_PUBLIC_KEY)throw new Error("VAPID_PUBLIC_KEY ontbreekt");
  if(!env.VAPID_PRIVATE_KEY)throw new Error("VAPID_PRIVATE_KEY ontbreekt");
  if(!env.VAPID_SUBJECT)throw new Error("VAPID_SUBJECT ontbreekt");
};

const toSubscription=row=>({
  endpoint:row.endpoint,
  expirationTime:null,
  keys:{p256dh:row.p256dh,auth:row.auth}
});

const readProviderError=async response=>{
  const providerStatus=response.status;
  const apnsId=response.headers.get("apns-id")||null;
  let providerReason=null;
  let providerBody="";
  try{
    providerBody=(await response.clone().text()).slice(0,500);
    if(providerBody){
      try{
        const parsed=JSON.parse(providerBody);
        providerReason=parsed?.reason||parsed?.error||null;
      }catch{}
    }
  }catch{}
  return {providerStatus,providerReason,providerBody,apnsId};
};

const sendPush=async(row,env,{test=false}={})=>{
  requireVapid(env);

  const vapid={
    subject:env.VAPID_SUBJECT,
    publicKey:env.VAPID_PUBLIC_KEY,
    privateKey:env.VAPID_PRIVATE_KEY
  };

  const message={
    data:{
      title:"DONE.",
      body:test
        ?"Test geslaagd — pushnotificaties voor DONE. werken."
        :"Je hebt nog open taken staan voor vandaag!",
      tag:test?"done-test-push":"done-open-tasks-reminder",
      url:"./"
    },
    options:{
      ttl:test?300:3600,
      urgency:test?"high":"normal"
    }
  };

  const init=await buildPushPayload(message,toSubscription(row),vapid);
  return fetch(row.endpoint,init);
};

// ============================================================================
// SUBSCRIPTION UPSERT
// Stores one current push subscription per random client installation ID.
// ============================================================================
const saveSubscription=async(request,env)=>{
  const body=await request.json().catch(()=>null);
  const {clientId,subscription,timezone,reminderTime,hasOpenTasks,enabled}=body||{};

  if(!validClientId(clientId)){
    return fail("Ongeldige clientId",400,env);
  }

  if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth){
    return fail("Ongeldige push subscription",400,env);
  }

  const zone=normalizeTimezone(timezone);
  const time=normalizeTime(reminderTime);
  const now=new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO push_subscriptions
      (client_id,endpoint,p256dh,auth,timezone,reminder_time,has_open_tasks,enabled,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(client_id) DO UPDATE SET
      endpoint=excluded.endpoint,
      p256dh=excluded.p256dh,
      auth=excluded.auth,
      timezone=excluded.timezone,
      reminder_time=excluded.reminder_time,
      has_open_tasks=excluded.has_open_tasks,
      enabled=excluded.enabled,
      updated_at=excluded.updated_at
  `).bind(
    clientId,
    String(subscription.endpoint),
    String(subscription.keys.p256dh),
    String(subscription.keys.auth),
    zone,
    time,
    hasOpenTasks?1:0,
    enabled===false?0:1,
    now
  ).run();

  return json({
    ok:true,
    reminderTime:time,
    timezone:zone,
    enabled:enabled!==false
  },200,corsHeaders(env));
};

// ============================================================================
// SUBSCRIPTION DELETE
// Called when the user disables daily reminders.
// ============================================================================
const deleteSubscription=async(url,env)=>{
  const clientId=url.searchParams.get("clientId");
  if(!validClientId(clientId))return fail("Ongeldige of ontbrekende clientId",400,env);

  await env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE client_id=?"
  ).bind(clientId).run();

  return json({ok:true},200,corsHeaders(env));
};

// ============================================================================
// SECURE TEST PUSH
// Browser requests must prove possession of both random clientId and the
// active subscription endpoint. An optional TEST_PUSH_TOKEN can additionally
// protect administrative/manual calls without exposing that token to clients.
// ============================================================================
const testPush=async(request,env)=>{
  const body=await request.json().catch(()=>null);
  const {clientId,endpoint,subscription}=body||{};

  if(!validClientId(clientId)){
    return fail("Ongeldige of ontbrekende clientId",400,env);
  }

  const auth=request.headers.get("authorization")||"";
  const isAdmin=Boolean(env.TEST_PUSH_TOKEN)&&auth===`Bearer ${env.TEST_PUSH_TOKEN}`;

  // Browser testcalls may send the current PushSubscription directly. This
  // validates the actual browser -> Worker -> push provider -> device chain
  // without requiring daily reminders to be enabled or D1 to be in sync.
  let row=null;
  let ephemeral=false;

  if(
    subscription?.endpoint&&
    subscription?.keys?.p256dh&&
    subscription?.keys?.auth
  ){
    row={
      client_id:clientId,
      endpoint:String(subscription.endpoint),
      p256dh:String(subscription.keys.p256dh),
      auth:String(subscription.keys.auth)
    };
    ephemeral=true;
  }else if(isAdmin){
    row=await env.DB.prepare(
      "SELECT * FROM push_subscriptions WHERE client_id=? AND enabled=1"
    ).bind(clientId).first();
  }else if(typeof endpoint==="string"&&endpoint){
    row=await env.DB.prepare(
      "SELECT * FROM push_subscriptions WHERE client_id=? AND endpoint=? AND enabled=1"
    ).bind(clientId,endpoint).first();
  }else{
    return fail("Push subscription ontbreekt",400,env);
  }

  if(!row)return fail("Geen actieve push subscription gevonden voor dit apparaat",404,env);

  try{
    const response=await sendPush(row,env,{test:true});

    if(response.ok){
      return json({ok:true,status:response.status},200,corsHeaders(env));
    }

    if(response.status===404||response.status===410){
      if(!ephemeral){
        await env.DB.prepare(
          "DELETE FROM push_subscriptions WHERE client_id=?"
        ).bind(clientId).run();
      }
      return fail("Push subscription is verlopen",410,env);
    }

    const details=await readProviderError(response);
    console.error("Test push failed",clientId,details);
    return json({
      ok:false,
      error:"Pushprovider weigerde de testmelding",
      ...details
    },502,corsHeaders(env));
  }catch(error){
    console.error("Test push error",clientId,error);
    return fail("Push kon niet worden verstuurd",500,env);
  }
};

// ============================================================================
// SCHEDULED REMINDER PROCESSOR
// Runs every minute. Sends only when:
// - reminder is enabled
// - client reports open tasks
// - local HH:MM equals reminder_time
// - no reminder has been sent on that client's local date
// ============================================================================
const runReminderCron=async env=>{
  requireVapid(env);

  const now=new Date();
  const {results=[]}=await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE enabled=1 AND has_open_tasks=1"
  ).all();

  for(const row of results){
    let local;
    try{
      local=localParts(now,normalizeTimezone(row.timezone));
    }catch(error){
      console.error("Timezone error",row.client_id,error);
      continue;
    }

    if(local.time!==normalizeTime(row.reminder_time))continue;
    if(row.last_sent_local_date===local.date)continue;

    try{
      const response=await sendPush(row,env);

      if(response.ok){
        await env.DB.prepare(
          "UPDATE push_subscriptions SET last_sent_local_date=?, updated_at=? WHERE client_id=?"
        ).bind(local.date,new Date().toISOString(),row.client_id).run();
        continue;
      }

      if(response.status===404||response.status===410){
        await env.DB.prepare(
          "DELETE FROM push_subscriptions WHERE client_id=?"
        ).bind(row.client_id).run();
        continue;
      }

      console.error("Push failed",row.client_id,await readProviderError(response));
    }catch(error){
      console.error("Push error",row.client_id,error);
    }
  }
};

// ============================================================================
// TEMPORARY STATE TRANSFER
// Moves local DONE. state between PWA installations without putting the JSON
// itself in the URL. The browser receives only a high-entropy short-lived token.
// ============================================================================
const createTransferToken=()=>{
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g,"-")
    .replace(/\//g,"_")
    .replace(/=+$/,"");
};

const cleanupExpiredTransfers=async env=>{
  await env.DB.prepare(
    "DELETE FROM state_transfers WHERE expires_at<=?"
  ).bind(new Date().toISOString()).run();
};

const createStateTransfer=async(request,env)=>{
  const body=await request.json().catch(()=>null);
  const {state,icon}=body||{};

  if(!APP_ICON_RE.test(String(icon||""))){
    return fail("Ongeldig app-icoon",400,env);
  }
  if(!state||typeof state!=="object"||Array.isArray(state)){
    return fail("Ongeldige DONE. state",400,env);
  }

  const payload=JSON.stringify(state);
  if(payload.length>500000){
    return fail("DONE. back-up is te groot voor tijdelijke overdracht",413,env);
  }

  await cleanupExpiredTransfers(env);

  const now=new Date();
  const token=createTransferToken();
  const expiresAt=new Date(now.getTime()+TRANSFER_TTL_MS);

  await env.DB.prepare(`
    INSERT INTO state_transfers
      (token,icon_id,payload_json,created_at,expires_at)
    VALUES (?,?,?,?,?)
  `).bind(
    token,
    String(icon),
    payload,
    now.toISOString(),
    expiresAt.toISOString()
  ).run();

  return json({
    ok:true,
    token,
    icon:String(icon),
    expiresAt:expiresAt.toISOString()
  },200,{
    ...corsHeaders(env),
    "cache-control":"no-store"
  });
};

const readStateTransfer=async(url,env)=>{
  const token=String(url.searchParams.get("token")||"");
  if(!TRANSFER_TOKEN_RE.test(token))return fail("Ongeldige transfertoken",400,env);

  await cleanupExpiredTransfers(env);

  const row=await env.DB.prepare(
    "SELECT token,icon_id,payload_json,expires_at FROM state_transfers WHERE token=?"
  ).bind(token).first();

  if(!row)return fail("Transfer niet gevonden of verlopen",404,env);

  let state;
  try{state=JSON.parse(row.payload_json)}catch{
    return fail("Transferdata is ongeldig",500,env);
  }

  return json({
    ok:true,
    token:row.token,
    icon:row.icon_id,
    expiresAt:row.expires_at,
    state
  },200,{
    ...corsHeaders(env),
    "cache-control":"no-store"
  });
};

const completeStateTransfer=async(request,env)=>{
  const body=await request.json().catch(()=>null);
  const token=String(body?.token||"");
  if(!TRANSFER_TOKEN_RE.test(token))return fail("Ongeldige transfertoken",400,env);

  await env.DB.prepare(
    "DELETE FROM state_transfers WHERE token=?"
  ).bind(token).run();

  return json({ok:true},200,corsHeaders(env));
};

const installManifest=(url,env)=>{
  const icon=String(url.searchParams.get("icon")||"");
  const transfer=String(url.searchParams.get("transfer")||"");
  const rootRaw=String(url.searchParams.get("root")||"");

  if(!APP_ICON_RE.test(icon))return fail("Ongeldig app-icoon",400,env);
  if(!TRANSFER_TOKEN_RE.test(transfer))return fail("Ongeldige transfertoken",400,env);

  let root;
  try{root=new URL(rootRaw)}catch{return fail("Ongeldige app-root",400,env)}
  if(root.protocol!=="https:")return fail("App-root moet HTTPS zijn",400,env);

  const configuredOrigin=String(env.APP_ORIGIN||"").trim();
  if(configuredOrigin&&configuredOrigin!=="*"){
    try{
      if(root.origin!==new URL(configuredOrigin).origin){
        return fail("App-root origin niet toegestaan",403,env);
      }
    }catch{
      return fail("APP_ORIGIN is ongeldig geconfigureerd",500,env);
    }
  }

  const normalizedRoot=new URL(root.href);
  if(!normalizedRoot.pathname.endsWith("/"))normalizedRoot.pathname+="/";

  const category=icon.startsWith("simple-")?"simple":"illustration-art";
  const iconUrl=new URL(`assets/images/app-icons/${category}/${icon}.png`,normalizedRoot);
  const startUrl=new URL(normalizedRoot.href);
  startUrl.searchParams.set("appIcon",icon);
  startUrl.searchParams.set("transfer",transfer);

  const manifest={
    name:"DONE.",
    short_name:"DONE.",
    start_url:startUrl.href,
    scope:normalizedRoot.href,
    display:"standalone",
    background_color:"#06152f",
    theme_color:"#071936",
    description:"Small steps. A bigger you.",
    icons:[{src:iconUrl.href,type:"image/png",purpose:"any"}]
  };

  return new Response(JSON.stringify(manifest),{
    status:200,
    headers:{
      "content-type":"application/manifest+json; charset=utf-8",
      "access-control-allow-origin":"*",
      "cache-control":"no-store, max-age=0"
    }
  });
};

// ============================================================================
// SAFARI BRIDGE
// Cross-origin trampoline for iOS standalone PWAs. Opening this Worker URL
// leaves the PWA container; Safari then follows the redirect to the selected
// icon-specific install page.
// ============================================================================
const openSafariBridge=(url,env)=>{
  const raw=url.searchParams.get("target");
  if(!raw)return fail("Ontbrekende target",400,env);

  let target;
  try{target=new URL(raw)}catch{return fail("Ongeldige target",400,env)}

  if(target.protocol!=="https:"){
    return fail("Alleen HTTPS targets zijn toegestaan",400,env);
  }

  if(!/\/install\/illustration-(0[1-9]|1[0-6])\.html$/.test(target.pathname)){
    return fail("Ongeldige installatieroute",400,env);
  }

  const configuredOrigin=String(env.APP_ORIGIN||"").trim();
  if(configuredOrigin&&configuredOrigin!=="*"){
    try{
      if(target.origin!==new URL(configuredOrigin).origin){
        return fail("Target origin niet toegestaan",403,env);
      }
    }catch{
      return fail("APP_ORIGIN is ongeldig geconfigureerd",500,env);
    }
  }

  return new Response(null,{
    status:302,
    headers:{
      location:target.href,
      "cache-control":"no-store, max-age=0",
      "referrer-policy":"no-referrer"
    }
  });
};

// ============================================================================
// HTTP ROUTER
// ============================================================================
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const cors=corsHeaders(env);

    if(request.method==="OPTIONS"){
      return new Response(null,{status:204,headers:cors});
    }

    if(url.pathname==="/health"&&request.method==="GET"){
      return json({
        ok:true,
        database:Boolean(env.DB),
        vapidPublicKey:Boolean(env.VAPID_PUBLIC_KEY),
        vapidPrivateKey:Boolean(env.VAPID_PRIVATE_KEY)
      },200,cors);
    }

    if(url.pathname==="/vapid-public-key"&&request.method==="GET"){
      if(!env.VAPID_PUBLIC_KEY)return fail("VAPID public key ontbreekt",503,env);
      return json({publicKey:env.VAPID_PUBLIC_KEY},200,cors);
    }

    if(url.pathname==="/open-safari"&&request.method==="GET"){
      return openSafariBridge(url,env);
    }

    if(url.pathname==="/transfer"&&request.method==="POST"){
      return createStateTransfer(request,env);
    }

    if(url.pathname==="/transfer"&&request.method==="GET"){
      return readStateTransfer(url,env);
    }

    if(url.pathname==="/transfer/complete"&&request.method==="POST"){
      return completeStateTransfer(request,env);
    }

    if(url.pathname==="/install-manifest"&&request.method==="GET"){
      return installManifest(url,env);
    }

    if(url.pathname==="/subscription"&&request.method==="POST"){
      return saveSubscription(request,env);
    }

    if(url.pathname==="/subscription"&&request.method==="DELETE"){
      return deleteSubscription(url,env);
    }

    if(url.pathname==="/test-push"&&request.method==="POST"){
      return testPush(request,env);
    }

    return fail("Not found",404,env);
  },

  async scheduled(_event,env,ctx){
    ctx.waitUntil(
      runReminderCron(env).catch(error=>console.error("Reminder cron failed",error))
    );
  }
};
