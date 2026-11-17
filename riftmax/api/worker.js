/**
 * Riftmax Riot API proxy (Cloudflare Worker).
 * Deploy with a freshly regenerated Riot key stored as RIOT_API_KEY secret.
 * The secret is NEVER returned to clients or committed to the repository.
 *
 * Trial integration: the UI reads current ranked standings and recent matches.
 * Match-V5 does NOT contain per-match LP deltas or all-time peak ranks.
 */
const PLATFORM_REGION = {
  na1:"americas",br1:"americas",la1:"americas",la2:"americas",
  euw1:"europe",eun1:"europe",tr1:"europe",ru:"europe",
  kr:"asia",jp1:"asia",
  oc1:"sea",ph2:"sea",sg2:"sea",th2:"sea",tw2:"sea",vn2:"sea"
};
const QUEUES = {420:"solo",440:"flex",400:"draft",450:"aram"};
const PAGE_SIZE=15;
// 2026 Season 3 started July 29 at noon local server time on the NA platform.
// Other platforms can override this in wrangler.toml when their server-local
// start time differs. The API is inclusive at startTime.
const DEFAULT_SEASON_START="2026-07-29T19:00:00Z";
const DEFAULT_SEASON_LABEL="2026 Season 3";
const TIER_ORDER=["IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"];
function rankingScore(x) {
  const tier=TIER_ORDER.indexOf(String(x.tier||"").toUpperCase());
  if(tier<0) return -1;
  const div=({IV:0,III:1,II:2,I:3})[String(x.rank||"").toUpperCase()]??0;
  return tier*100000+div*10000+Math.max(0,Number(x.leaguePoints)||0);
}
function seasonConfig(env) {
  const raw=env.SEASON_START||DEFAULT_SEASON_START;
  const ms=Date.parse(raw);
  if(!Number.isFinite(ms))throw new ApiError(503,"Invalid Worker SEASON_START configuration.",null,"season-config");
  const seconds=Math.floor(ms/1000);
  if(seconds>Math.floor(Date.now()/1000)+86400)throw new ApiError(503,"Configured season start is in the future.",null,"season-config");
  return {startTime:seconds,startISO:new Date(ms).toISOString(),label:env.SEASON_LABEL||DEFAULT_SEASON_LABEL};
}
async function trackedRankHistory(env,platform,puuid,ranks,start) {
  if(!env.RANK_DB)return {enabled:false,peaks:{},startedAt:null};
  const peaks={};
  try {
    for(const r of ranks.filter(x=>["RANKED_SOLO_5x5","RANKED_FLEX_SR"].includes(x.queueType))) {
      const score=rankingScore(r);
      if(score<0)continue;
      const params=[platform,puuid,r.queueType];
      const last=await env.RANK_DB.prepare("SELECT tier, division, lp FROM rank_snapshots WHERE platform=? AND puuid=? AND queue=? ORDER BY observed_at DESC, id DESC LIMIT 1").bind(...params).first();
      if(!last||last.tier!==r.tier||last.division!==r.rank||last.lp!==r.leaguePoints) {
        await env.RANK_DB.prepare("INSERT INTO rank_snapshots (platform,puuid,queue,tier,division,lp,score,observed_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(...params,r.tier,r.rank,r.leaguePoints,score,new Date().toISOString()).run();
      }
      const peak=await env.RANK_DB.prepare("SELECT tier, division, lp, observed_at FROM rank_snapshots WHERE platform=? AND puuid=? AND queue=? ORDER BY score DESC, observed_at ASC LIMIT 1").bind(...params).first();
      const earliest=await env.RANK_DB.prepare("SELECT MIN(observed_at) AS started FROM rank_snapshots WHERE platform=? AND puuid=? AND queue=?").bind(...params).first();
      if(peak)peaks[r.queueType]={tier:peak.tier,rank:peak.division,leaguePoints:peak.lp,
        observedAt:peak.observed_at,trackingSince:earliest?.started||start};
    }
    return {enabled:true,peaks,startedAt:start};
  } catch (_) {
    // Don't invent history when D1 has not been migrated or is temporarily unavailable.
    return {enabled:false,peaks:{},startedAt:null,warning:"Rank snapshots unavailable; check the D1 binding and schema."};
  }
}
const SPELLS = {1:"Cleanse",3:"Exhaust",4:"Flash",6:"Ghost",7:"Heal",11:"Smite",12:"Teleport",13:"Clarity",14:"Ignite",21:"Barrier",32:"Snowball"};
const ORIGINS = ["https://htmlpreview.github.io"];
const DEFAULT_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
class ApiError extends Error {
  constructor(status,message,retryAfter,stage,riotStatus) {
    super(message);this.name="ApiError";this.status=status;this.retryAfter=retryAfter;
    this.stage=stage||"riot";this.riotStatus=riotStatus||null;
  }
}
function cors(origin,env) {
  const allowed = (env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
  const ok=origin && [...ORIGINS,...allowed].includes(origin);
  return ok ? {"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"600"} : {};
}
function responseJson(obj,status=200,headers={}) {
  return new Response(JSON.stringify(obj),{status,headers:{...DEFAULT_HEADERS,...headers}});
}
function onlyText(v,max) {return typeof v==="string"&&v.length>0&&v.length<=max&&/^[\p{L}\p{N} _.\-]+$/u.test(v);}
function safeNumber(n,defaultValue=0){return Number.isFinite(Number(n)) ? Number(n) : defaultValue;}
function sortedIds(list) {return Array.isArray(list)?list.filter(x=>typeof x==="string"&&/^[A-Z0-9]+_\d+$/.test(x)).slice(0,PAGE_SIZE):[];}
async function riot(url,env,ctx,ttl=0,stage="riot") {
  const request=new Request(url,{headers:{"X-Riot-Token":env.RIOT_API_KEY,"Accept":"application/json"}});
  let cached=null;
  if(ttl && typeof caches!=="undefined" && caches.default) {
    const cacheKey=new Request(url.replace("api.riotgames.com/","api.riotgames.com/"),{method:"GET"});
    cached=await caches.default.match(cacheKey);
    if(cached) return cached.json();
  }
  let res;
  try {res=await fetch(request);}
  catch (_) {throw new ApiError(502,"Could not connect to Riot servers.",null,stage);}
  if(!res.ok) {
    const retryAfter=res.headers.get("Retry-After");
    let message;
    switch(res.status) {
      case 400: message="Riot rejected this request as malformed (HTTP 400)."; break;
      case 401: message="Riot rejected the API key (HTTP 401). Verify the Cloudflare secret matches your active Riot key."; break;
      case 403: message="Riot denied access (HTTP 403). The key may be expired, revoked or missing permission."; break;
      case 404: message="Riot returned no matching account or resource (HTTP 404). Check Riot ID, tag and platform."; break;
      case 429: message="Riot rate limit reached (HTTP 429). Observe the Retry-After interval."; break;
      default: message="Riot returned HTTP "+res.status+".";
    }
    // No raw upstream body, upstream URL, account secrets, or request headers are exposed.
    const status=res.status===401||res.status===403?503:res.status>=500?502:res.status;
    throw new ApiError(status,message,retryAfter,stage,res.status);
  }
  const payload=await res.json();
  if(ttl && ctx && typeof caches!=="undefined" && caches.default) {
    const clone=new Response(JSON.stringify(payload),{headers:{"Cache-Control":"public, max-age="+ttl,"Content-Type":"application/json"}});
    ctx.waitUntil(caches.default.put(new Request(url,{method:"GET"}),clone));
  }
  return payload;
}
function toMatch(raw,puuid,region) {
  const info=raw&&raw.info;
  if(!info||!Array.isArray(info.participants))return null;
  const queue=QUEUES[info.queueId]||"other";
  const player=info.participants.find(p=>p.puuid===puuid);
  if(!player)return null;
  const seconds=safeNumber(info.gameDuration);
  const endMs=safeNumber(info.gameEndTimestamp)||safeNumber(info.gameStartTimestamp)+seconds*1000;
  const minutesAgo=Math.max(0,(Date.now()-endMs)/60000);
  const remake=seconds>0&&seconds<300;
  const players=info.participants;
  const team=players.filter(p=>p.teamId===player.teamId);
  const enemy=players.filter(p=>p.teamId!==player.teamId);
  const scoreboard=(arr)=>arr.map(p=>[p.championName||"Unknown",safeNumber(p.kills)+"/"+safeNumber(p.deaths)+"/"+safeNumber(p.assists)]);
  const durationMinutes=Math.max(1,seconds/60);
  const cs=safeNumber(player.totalMinionsKilled)+safeNumber(player.neutralMinionsKilled);
  const result=remake?"remake":player.win?"win":"loss";
  const names={solo:"Ranked Solo/Duo",flex:"Ranked Flex",draft:"Normal Draft",aram:"ARAM",other:"Other · queue "+info.queueId};
  const spellIds=[player.summoner1Id,player.summoner2Id];
  return {
    id:raw.metadata&&raw.metadata.matchId,champion:player.championName||"Unknown",
    result,kda:[player.kills,player.deaths,player.assists].join(" / "),lp:null,lpDelta:null,
    mode:names[queue],modeKey:queue,ago:minutesAgo<60?Math.round(minutesAgo)+"m ago":minutesAgo<1440?Math.round(minutesAgo/60)+"h ago":Math.round(minutesAgo/1440)+"d ago",
    minutesAgo,duration:Math.floor(seconds/60)+"m "+String(seconds%60).padStart(2,"0")+"s",durationMinutes,
    kills:safeNumber(player.kills),deaths:safeNumber(player.deaths),assists:safeNumber(player.assists),
    cs,damage:safeNumber(player.totalDamageDealtToChampions),vision:safeNumber(player.visionScore),
    gold:safeNumber(player.goldEarned),
    opponentDamage:enemy.reduce((sum,p)=>sum+safeNumber(p.totalDamageDealtToChampions),0),
    items:[0,1,2,3,4,5,6].map(i=>safeNumber(player["item"+i])).filter(Boolean),
    spells:spellIds.map(id=>SPELLS[id]||"Unknown"),
    ally:scoreboard(team),enemy:scoreboard(enemy),
    gameEndTimestamp:endMs,queueId:info.queueId,position:player.teamPosition||player.individualPosition||null,
    // Explicitly unknown until a separate verified ranked snapshot tracker exists.
    verifiedLpChange:false
  };
}
async function profile(url,env,ctx) {
  const platform=(url.searchParams.get("platform")||"na1").toLowerCase();
  const region=PLATFORM_REGION[platform];
  if(!region)throw new ApiError(400,"Unsupported platform.");
  const name=(url.searchParams.get("gameName")||"").trim();
  const tag=(url.searchParams.get("tagLine")||"").trim();
  if(!onlyText(name,20)||!onlyText(tag,10))throw new ApiError(400,"Enter a valid Riot ID and tag.");
  const offsetValue=Number(url.searchParams.get("start")||0);
  if(!Number.isSafeInteger(offsetValue)||offsetValue<0||offsetValue>25000)
    throw new ApiError(400,"Invalid match history offset.",null,"pagination");
  const season=seasonConfig(env);
  const regionalBase="https://"+region+".api.riotgames.com";
  const platformBase="https://"+platform+".api.riotgames.com";
  const user=await riot(regionalBase+"/riot/account/v1/accounts/by-riot-id/"+encodeURIComponent(name)+"/"+encodeURIComponent(tag),env,ctx,300,"account-lookup");
  if(!user||typeof user.puuid!=="string")throw new ApiError(502,"Riot account response missing player ID.");
  const puuid=user.puuid;
  const [rankResult,idsResult,summonerResult]=await Promise.allSettled([
    riot(platformBase+"/lol/league/v4/entries/by-puuid/"+encodeURIComponent(puuid),env,ctx,120,"ranked-entries"),
    riot(regionalBase+"/lol/match/v5/matches/by-puuid/"+encodeURIComponent(puuid)+"/ids?start="+offsetValue+"&count="+PAGE_SIZE+"&startTime="+season.startTime,env,ctx,120,"match-ids"),
    riot(platformBase+"/lol/summoner/v4/summoners/by-puuid/"+encodeURIComponent(puuid),env,ctx,3600,"summoner-profile")
  ]);
  // Do not present partial data as a successful all-updated snapshot.
  if(rankResult.status!=="fulfilled")throw rankResult.reason;
  if(idsResult.status!=="fulfilled")throw idsResult.reason;
  const ids=sortedIds(idsResult.value);
  const items=[];
  // Sequential small batches keep a development key from being overwhelmed.
  for(let i=0;i<ids.length;i+=3) {
    const slice=ids.slice(i,i+3);
    const results=await Promise.allSettled(slice.map(id=>riot(regionalBase+"/lol/match/v5/matches/"+encodeURIComponent(id),env,ctx,86400,"match-details")));
    for(const result of results) {
      if(result.status==="fulfilled") {
        const parsed=toMatch(result.value,puuid,region);
        if(parsed)items.push(parsed);
      } else {
        // Never mark the season as complete while silently dropping match details.
        throw result.reason;
      }
    }
  }
  items.sort((a,b)=>b.gameEndTimestamp-a.gameEndTimestamp);
  const ranks=Array.isArray(rankResult.value)?rankResult.value:[];
  const history=offsetValue===0
    ?await trackedRankHistory(env,platform,puuid,ranks,new Date().toISOString())
    :{enabled:Boolean(env.RANK_DB),peaks:{},startedAt:null};
  return {
    source:"riot-api",live:true,generatedAt:new Date().toISOString(),
    region,platform,account:{gameName:user.gameName||name,tagLine:user.tagLine||tag,puuid,
      profileIconId:summonerResult.status==="fulfilled"?summonerResult.value.profileIconId:null},
    ranks:ranks.filter(x=>x&&typeof x.queueType==="string").map(x=>({
      queueType:x.queueType,tier:x.tier||"UNRANKED",rank:x.rank||"",leaguePoints:safeNumber(x.leaguePoints),
      wins:safeNumber(x.wins),losses:safeNumber(x.losses)
    })),
    matches:items,
    pagination:{start:offsetValue,count:ids.length,nextStart:offsetValue+ids.length,hasMore:ids.length===PAGE_SIZE},
    season:{label:season.label,startsAt:season.startISO},
    rankHistory:history,
    warnings:["Season history requires pagination until hasMore=false; respect Riot rate limits.",
      "Per-match LP changes and all-time historical peak cannot be reconstructed from Riot Match-V5.",
      ...(history.warning?[history.warning]:[])]
  };
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url),origin=request.headers.get("Origin");
    const headers=cors(origin,env);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="GET")return responseJson({error:"Method not allowed."},405,headers);
    if(url.pathname==="/api/health")return responseJson({ok:true,configured:Boolean(env.RIOT_API_KEY),service:"riftmax-riot-worker"},200,headers);
    if(url.pathname!=="/api/profile")return responseJson({error:"Not found."},404,headers);
    if(origin && !headers["Access-Control-Allow-Origin"])return responseJson({error:"Origin not allowed."},403,headers);
    if(!env.RIOT_API_KEY)return responseJson({error:"Missing RIOT_API_KEY Worker secret."},503,headers);
    try {
      const data=await profile(url,env,ctx);
      return responseJson(data,200,headers);
    } catch(error) {
      const status=error instanceof ApiError?error.status:502;
      const msg=error instanceof ApiError?error.message:"Riot request failed. Check Worker logs.";
      return responseJson({error:msg,stage:error instanceof ApiError?error.stage:"unknown",
        riotStatus:error instanceof ApiError?error.riotStatus:null,
        retryAfter:error instanceof ApiError?error.retryAfter:null},status,{
        ...headers,...(error instanceof ApiError&&error.retryAfter?{"Retry-After":error.retryAfter}: {})
      });
    }
  }
};
