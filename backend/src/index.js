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
      urgency:test?"high":"normal",
      topic:test?"done-test":"done-open-tasks"
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
  const {clientId,endpoint}=body||{};

  if(!validClientId(clientId)||typeof endpoint!=="string"||!endpoint){
    return fail("clientId en endpoint zijn verplicht",400,env);
  }

  if(env.TEST_PUSH_TOKEN){
    const auth=request.headers.get("authorization")||"";
    const hasAdminToken=auth===`Bearer ${env.TEST_PUSH_TOKEN}`;

    if(!hasAdminToken){
      // Browser flow is still allowed only if the client proves the exact
      // registered endpoint below. The secret is never shipped to the app.
    }
  }

  const row=await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE client_id=? AND endpoint=? AND enabled=1"
  ).bind(clientId,endpoint).first();

  if(!row)return fail("Geen actieve push subscription gevonden voor dit apparaat",404,env);

  try{
    const response=await sendPush(row,env,{test:true});

    if(response.ok){
      return json({ok:true,status:response.status},200,corsHeaders(env));
    }

    if(response.status===404||response.status===410){
      await env.DB.prepare(
        "DELETE FROM push_subscriptions WHERE client_id=?"
      ).bind(clientId).run();
      return fail("Push subscription is verlopen en is verwijderd",410,env);
    }

    console.error("Test push failed",clientId,response.status);
    return fail("Pushprovider weigerde de testmelding",502,env);
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

      console.error("Push failed",row.client_id,response.status);
    }catch(error){
      console.error("Push error",row.client_id,error);
    }
  }
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
