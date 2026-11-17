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
const SPELLS = {1:"Cleanse",3:"Exhaust",4:"Flash",6:"Ghost",7:"Heal",11:"Smite",12:"Teleport",13:"Clarity",14:"Ignite",21:"Barrier",32:"Snowball"};
const ORIGINS = ["https://htmlpreview.github.io"];
const DEFAULT_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
class ApiError extends Error {
  constructor(status,message,retryAfter) {super(message);this.status=status;this.retryAfter=retryAfter;}
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
function sortedIds(list) {return Array.isArray(list)?list.filter(x=>typeof x==="string"&&/^[A-Z0-9]+_\d+$/.test(x)).slice(0,20):[];}
async function riot(url,env,ctx,ttl=0) {
  const request=new Request(url,{headers:{"X-Riot-Token":env.RIOT_API_KEY,"Accept":"application/json"}});
  let cached=null;
  if(ttl && typeof caches!=="undefined" && caches.default) {
    const cacheKey=new Request(url.replace("api.riotgames.com/","api.riotgames.com/"),{method:"GET"});
    cached=await caches.default.match(cacheKey);
    if(cached) return cached.json();
  }
  const res=await fetch(request);
  if(!res.ok) {
    const retryAfter=res.headers.get("Retry-After");
    let message=res.status===429?"Riot rate limit reached. Try again later.":res.status===403?"Riot API key expired, invalid, or not permitted.":res.status===404?"Riot account or match not found.":"Riot API request failed.";
    throw new ApiError(res.status===403?503:res.status,message,retryAfter);
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
  const queue=QUEUES[info.queueId];
  if(!queue)return null;
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
  const names={solo:"Ranked Solo/Duo",flex:"Ranked Flex",draft:"Normal Draft",aram:"ARAM"};
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
  const regionalBase="https://"+region+".api.riotgames.com";
  const platformBase="https://"+platform+".api.riotgames.com";
  const user=await riot(regionalBase+"/riot/account/v1/accounts/by-riot-id/"+encodeURIComponent(name)+"/"+encodeURIComponent(tag),env,ctx,300);
  if(!user||typeof user.puuid!=="string")throw new ApiError(502,"Riot account response missing player ID.");
  const puuid=user.puuid;
  const [rankResult,idsResult,summonerResult]=await Promise.allSettled([
    riot(platformBase+"/lol/league/v4/entries/by-puuid/"+encodeURIComponent(puuid),env,ctx,120),
    riot(regionalBase+"/lol/match/v5/matches/by-puuid/"+encodeURIComponent(puuid)+"/ids?start=0&count=20",env,ctx,120),
    riot(platformBase+"/lol/summoner/v4/summoners/by-puuid/"+encodeURIComponent(puuid),env,ctx,3600)
  ]);
  // Do not present partial data as a successful all-updated snapshot.
  if(rankResult.status!=="fulfilled")throw rankResult.reason;
  if(idsResult.status!=="fulfilled")throw idsResult.reason;
  const ids=sortedIds(idsResult.value);
  const items=[];
  // Sequential small batches keep a development key from being overwhelmed.
  for(let i=0;i<ids.length;i+=3) {
    const slice=ids.slice(i,i+3);
    const results=await Promise.allSettled(slice.map(id=>riot(regionalBase+"/lol/match/v5/matches/"+encodeURIComponent(id),env,ctx,86400)));
    for(const result of results) {
      if(result.status==="fulfilled") {
        const parsed=toMatch(result.value,puuid,region);
        if(parsed)items.push(parsed);
      } else if(result.reason instanceof ApiError && result.reason.status===429) {
        throw result.reason;
      } else if(result.reason instanceof ApiError && result.reason.status===503) {
        throw result.reason;
      }
    }
  }
  items.sort((a,b)=>b.gameEndTimestamp-a.gameEndTimestamp);
  const ranks=Array.isArray(rankResult.value)?rankResult.value:[];
  return {
    source:"riot-api",live:true,generatedAt:new Date().toISOString(),
    region,platform,account:{gameName:user.gameName||name,tagLine:user.tagLine||tag,puuid,
      profileIconId:summonerResult.status==="fulfilled"?summonerResult.value.profileIconId:null},
    ranks:ranks.filter(x=>x&&typeof x.queueType==="string").map(x=>({
      queueType:x.queueType,tier:x.tier||"UNRANKED",rank:x.rank||"",leaguePoints:safeNumber(x.leaguePoints),
      wins:safeNumber(x.wins),losses:safeNumber(x.losses)
    })),
    matches:items,
    warnings:["No per-match LP history, session LP change, or all-time peak is available from Match-V5.",
      "Only the latest 20 available matches were requested; older match history is not complete."]
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
      return responseJson({error:msg},status,{
        ...headers,...(error instanceof ApiError&&error.retryAfter?{"Retry-After":error.retryAfter}: {})
      });
    }
  }
};
