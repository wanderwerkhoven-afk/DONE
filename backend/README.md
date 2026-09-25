# DONE. Push backend

Cloudflare Worker + D1 backend voor dagelijkse DONE.-pushnotificaties.

## Architectuur

De frontend bewaart de gebruikerstaakdata lokaal. De backend ontvangt **geen taaknamen of taakinhoud**. Per app-installatie bewaart D1 alleen:

- willekeurige `client_id`;
- Web Push endpoint;
- `p256dh` en `auth` subscription keys;
- IANA timezone;
- reminder-tijd (`HH:MM`);
- boolean of er open taken zijn;
- reminder enabled/disabled;
- lokale datum waarop de laatste reminder is verzonden.

## Endpoints

`GET /health`  
Controleert Worker-configuratie.

`GET /vapid-public-key`  
Geeft de publieke VAPID-key terug voor `PushManager.subscribe()`.

`POST /subscription`  
Maakt of update de subscription voor één `clientId`.

Voorbeeld body:

```json
{
  "clientId": "done-random-installation-id",
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "timezone": "Europe/Amsterdam",
  "reminderTime": "17:00",
  "hasOpenTasks": true,
  "enabled": true
}
```

`DELETE /subscription?clientId=...`  
Verwijdert de subscription zodra reminders worden uitgezet.

`POST /test-push`  
Stuurt één test-push naar het huidige apparaat. Browsercalls moeten zowel de willekeurige `clientId` als het exacte actuele subscription-endpoint meesturen. Zo kan een andere installatie niet alleen op basis van een bekende client-ID een push triggeren.

Een optioneel `TEST_PUSH_TOKEN` Worker secret kan daarnaast worden gebruikt voor beheerflows. Dit secret hoort **nooit** in frontendcode.

## Reminder cron

De Worker draait iedere minuut. Voor iedere ingeschakelde subscription met open taken:

1. berekent de Worker de lokale tijd met de opgeslagen IANA-timezone;
2. vergelijkt die met `reminder_time`;
3. controleert `last_sent_local_date`;
4. verstuurt alleen wanneer de tijd exact overeenkomt en die dag nog niets is gestuurd;
5. verwijdert verlopen subscriptions bij pushstatus 404/410.

Daarmee kan iedere gebruiker een eigen reminder-tijd en timezone hebben.

## Installeren

```bash
cd backend
npm install
```

## D1

De bestaande binding is:

- binding: `DB`
- database: `done-push`

Schema uitvoeren:

```bash
npm run db:migrate
```

## VAPID

`VAPID_PUBLIC_KEY` en `VAPID_SUBJECT` zijn niet geheim en staan in `wrangler.jsonc`.

De private VAPID-key mag **niet** in Git:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

Voer vervolgens de bestaande private key in.

Optioneel, voor een extra beheersecret rond testcalls:

```bash
npx wrangler secret put TEST_PUSH_TOKEN
```

Ook dit secret hoort uitsluitend in Cloudflare.

## CORS

`APP_ORIGIN` staat tijdens ontwikkeling op `*`. Voor productie is het beter deze naar de exacte DONE.-origin te zetten.

## Lokaal testen

```bash
npm run dev
```

Wrangler gebruikt `--test-scheduled`, zodat scheduled handlers lokaal getest kunnen worden.

## Deploy

```bash
npm run deploy
```

Daarna:

```text
GET /health
GET /vapid-public-key
```

De frontend gebruikt alleen de publieke Worker-URL. Secrets worden nooit aan de browser geleverd.
