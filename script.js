'use strict';const STORAGE_KEY='yt_playlists_v2';const SETTINGS_KEY='yt_settings_v2';const YT_API_URL='https://www.googleapis.com/youtube/v3';const WATCHED_THRESHOLD=0.8;const DRAWER_BREAKPOINT=1100;const DESC_MAX_LENGTH=150;const PLAYLIST_COLORS={red:'#ff0033',blue:'#3b82f6',emerald:'#00a86b',purple:'#7c3aed',amber:'#f4b400',pink:'#db2777'};const SMART_VIEWS={all:{badge:'Global View',title:'All Videos',desc:'Overview of all saved YouTube videos across your workspace.',accent:PLAYLIST_COLORS.red,match:()=>!0},favorites:{badge:'Favorites',title:'Favorite Videos',desc:'Your quick-access collection of starred videos.',accent:PLAYLIST_COLORS.amber,match:(v)=>v.favorite},unwatched:{badge:'Queue',title:'Unwatched',desc:'Videos queued up for viewing.',accent:PLAYLIST_COLORS.emerald,match:(v)=>!v.watched},watched:{badge:'Watched',title:'Watched',desc:'Videos you have watched.',accent:PLAYLIST_COLORS.emerald,match:(v)=>v.watched}};const state={playlists:[],apiKey:'',activeView:'all',filterStatus:'all',searchQuery:'',sortOrder:'title',viewMode:'grid'};const player={instance:null,queue:[],index:0,shuffle:!1,loop:!1,played:new Set(),timer:null};let pendingConfirm=null;const $=(id)=>document.getElementById(id);const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));const ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};const escapeHtml=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>ESCAPES[ch]);const generateId=(prefix='id')=>`${prefix}_${Math.random().toString(36).slice(2, 11)}`;function extractVideoId(input){const text=(input||'').trim();const match=text.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?/\s]{11})/);if(match)
return match[1];return/^[a-zA-Z0-9_-]{11}$/.test(text)?text:null}
function extractPlaylistId(input){const text=(input||'').trim();const match=text.match(/[?&]list=([^"&?/\s]+)/);if(match)
return match[1];return/^(?:PL|UU|LL|FL|OL|RD)[a-zA-Z0-9_-]{10,}$/.test(text)?text:null}
const getVideoThumbnail=(video)=>video?.thumbnail||(video?.youtubeId?`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`:'');const pickThumbnail=(thumbnails)=>thumbnails?.high?.url||thumbnails?.medium?.url||'';function showToast(message,type='info'){const container=$('toast-container');const icons={info:'fa-info-circle',success:'fa-circle-check',error:'fa-triangle-exclamation'};const toast=document.createElement('div');toast.className=`toast toast--${type in icons ? type : 'info'}`;toast.innerHTML=`<i class="fa-solid ${icons[type] || icons.info} toast__icon"></i><span></span>`;toast.lastElementChild.textContent=message;container.appendChild(toast);setTimeout(()=>toast.classList.add('is-visible'),10);setTimeout(()=>{toast.classList.remove('is-visible');setTimeout(()=>toast.remove(),300)},3200)}
function setBusy(button,busy,busyHtml){if(busy){button.dataset.idleHtml=button.innerHTML;button.innerHTML=busyHtml}else if(button.dataset.idleHtml){button.innerHTML=button.dataset.idleHtml}
button.disabled=busy}
function formatClock(totalSeconds){const h=Math.floor(totalSeconds/3600);const m=Math.floor((totalSeconds%3600)/60);const s=totalSeconds%60;const pad=(n)=>String(n).padStart(2,'0');return h?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`}
function parseIsoDuration(value){const match=(value||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);if(!match)
return'';const[,h=0,m=0,s=0]=match;return formatClock(Number(h)*3600+Number(m)*60+Number(s))}
function parseDurationSeconds(value){if(typeof value==='number')
return Number.isFinite(value)?Math.max(0,Math.round(value)):0;const text=String(value??'').trim();if(/^\d+(?::\d{1,2}){1,2}$/.test(text)){return text.split(':').map(Number).reduce((total,part)=>total*60+part,0)}
const unit=(pattern)=>Number(text.match(pattern)?.[1]||0);return Math.round(unit(/(\d+(?:\.\d+)?)\s*h/i)*3600+unit(/(\d+(?:\.\d+)?)\s*m/i)*60+unit(/(\d+(?:\.\d+)?)\s*s/i))}
function formatTotalDuration(videos){const seconds=videos.reduce((total,video)=>total+parseDurationSeconds(video.duration),0);const hours=Math.floor(seconds/3600);const minutes=Math.floor((seconds%3600)/60);if(hours>0)
return `${hours}h ${minutes}m`;if(minutes>0)
return `${minutes}m`;return seconds>0?`${seconds}s`:'0m'}
function createVideo(youtubeId,meta={},overrides={}){return{id:generateId('vid'),youtubeId,title:meta.title||`YouTube Video (${youtubeId})`,channel:meta.channel||'YouTube',duration:meta.duration||'',thumbnail:meta.thumbnail||'',publishedAt:meta.publishedAt||'',category:'',tags:[],watched:!1,favorite:!1,addedAt:Date.now(),...overrides}}
function createPlaylist({title,description='',category='General',color='red',thumbnail='',videos=[],sourceYtId=''}){return{id:generateId('pl'),title,description,category,color,thumbnail,sourceYtId,createdAt:Date.now(),videos}}
const cloneVideos=(videos)=>videos.map((v)=>({...v,id:generateId('vid'),addedAt:Date.now()}));function normalizeVideo(v){return{id:v.id||generateId('vid'),youtubeId:v.youtubeId||'',title:v.title||'YouTube Video',channel:v.channel||'YouTube',duration:v.duration||'',thumbnail:v.thumbnail||'',publishedAt:v.publishedAt||'',category:String(v.category||'').trim(),tags:Array.isArray(v.tags)?v.tags:[],watched:Boolean(v.watched),favorite:Boolean(v.favorite),addedAt:v.addedAt||Date.now()}}
function normalizePlaylists(data){if(!Array.isArray(data))
return[];return data.map((pl)=>({id:pl.id||generateId('pl'),title:pl.title||'Untitled Playlist',description:pl.description||'',category:pl.category||'General',color:pl.color||'red',thumbnail:pl.thumbnail||'',sourceYtId:pl.sourceYtId||'',createdAt:pl.createdAt||Date.now(),videos:(Array.isArray(pl.videos)?pl.videos:[]).map(normalizeVideo).filter((v)=>v.youtubeId)}))}
const findPlaylist=(id)=>state.playlists.find((p)=>p.id===id);const normalizeTitle=(title)=>String(title||'').trim().replace(/\s+/g,' ').toLowerCase();const isPlaylistTitleTaken=(title,ignoreId='')=>state.playlists.some((p)=>p.id!==ignoreId&&normalizeTitle(p.title)===normalizeTitle(title));function makeUniqueTitle(base){const clean=String(base||'').trim()||'Untitled Playlist';if(!isPlaylistTitleTaken(clean))
return clean;let n=2;while(isPlaylistTitleTaken(`${clean} (${n})`))
n++;return `${clean} (${n})`}
const findVideo=(playlistId,videoId)=>findPlaylist(playlistId)?.videos.find((v)=>v.id===videoId);function getAllVideos(){return state.playlists.flatMap((pl)=>pl.videos.map((v)=>({...v,playlistTitle:pl.title,playlistId:pl.id})))}
function getViewVideos(){const smart=SMART_VIEWS[state.activeView];const all=getAllVideos();return smart?all.filter(smart.match):all.filter((v)=>v.playlistId===state.activeView)}
function getFilteredAndSortedVideos(){let list=getViewVideos();if(state.filterStatus==='watched')
list=list.filter((v)=>v.watched);if(state.filterStatus==='unwatched')
list=list.filter((v)=>!v.watched);if(state.filterStatus==='favorites')
list=list.filter((v)=>v.favorite);const query=state.searchQuery.trim().toLowerCase();if(query){list=list.filter((v)=>[v.title,v.channel,v.category,...(v.tags||[])].some((text)=>(text||'').toLowerCase().includes(query)))}
const sorters={newest:(a,b)=>(b.addedAt||0)-(a.addedAt||0),oldest:(a,b)=>(a.addedAt||0)-(b.addedAt||0),title:(a,b)=>(a.title||'').localeCompare(b.title||''),favorites:(a,b)=>Number(b.favorite)-Number(a.favorite)};return list.sort(sorters[state.sortOrder]||sorters.newest)}
const UI_PREFS_KEY='yt_ui_prefs';function loadUiPrefs(){try{const raw=localStorage.getItem(UI_PREFS_KEY);if(!raw)
return;const prefs=JSON.parse(raw);if(['newest','oldest','title','favorites'].includes(prefs.sortOrder))
state.sortOrder=prefs.sortOrder;if(['grid','list'].includes(prefs.viewMode))
state.viewMode=prefs.viewMode}catch(error){console.error('Error loading UI preferences',error)}}
function saveUiPrefs(){try{localStorage.setItem(UI_PREFS_KEY,JSON.stringify({sortOrder:state.sortOrder,viewMode:state.viewMode}))}catch(error){console.error('Error saving UI preferences',error)}}
function syncUiControls(){const sel=$('sort-select');if(sel)
sel.value=state.sortOrder;[['grid','view-mode-grid'],['list','view-mode-list']].forEach(([m,id])=>{const b=$(id);if(!b)
return;b.classList.toggle('is-active',m===state.viewMode);b.setAttribute('aria-pressed',String(m===state.viewMode))})}
function loadData(){loadUiPrefs();try{const storedPlaylists=localStorage.getItem(STORAGE_KEY);if(storedPlaylists)
state.playlists=normalizePlaylists(JSON.parse(storedPlaylists));const storedSettings=localStorage.getItem(SETTINGS_KEY);if(storedSettings)
state.apiKey=JSON.parse(storedSettings).apiKey||''}catch(error){console.error('Error loading data from localStorage',error)}
updateApiStatusBadge()}
function saveData(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.playlists));localStorage.setItem(SETTINGS_KEY,JSON.stringify({apiKey:state.apiKey}))}catch(error){console.error('Error saving data to storage',error);showToast('Storage quota exceeded or error','error')}
updateStorageSize()}
function commit(){saveData();renderApp()}
function updateStorageSize(){const raw=localStorage.getItem(STORAGE_KEY)||'';$('storage-size-display').textContent=`${((raw.length * 2) / 1024).toFixed(1)} KB`}
function updateApiStatusBadge(){const hasKey=state.apiKey.trim()!=='';$('api-status-dot').classList.toggle('is-active',hasKey);$('api-status-text').textContent=hasKey?'YouTube API Key Active':'noEmbed Auto Mode'}
async function youtubeApi(endpoint,params,apiKey=state.apiKey.trim()){const query=new URLSearchParams({...params,key:apiKey});const res=await fetch(`${YT_API_URL}/${endpoint}?${query}`);const data=await res.json().catch(()=>({}));if(!res.ok)
throw new Error(data?.error?.message||`YouTube API request failed (${res.status})`);return data}
async function fetchNoembedMetadata(ytId){try{const res=await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);if(res.ok){const data=await res.json();if(data?.title)
return{title:data.title,channel:data.author_name||'YouTube Channel'}}}catch(error){console.warn('oEmbed fetch fallback error:',error)}
return{}}
async function fetchVideoMetadata(ytId){if(state.apiKey.trim()){try{const data=await youtubeApi('videos',{part:'snippet,contentDetails',id:ytId});const item=data.items?.[0];if(item){return{title:item.snippet?.title,channel:item.snippet?.channelTitle,duration:parseIsoDuration(item.contentDetails?.duration),publishedAt:item.snippet?.publishedAt,thumbnail:pickThumbnail(item.snippet?.thumbnails)}}}catch(error){console.warn('YouTube Data API video metadata error:',error)}}
const[meta,duration]=await Promise.all([fetchNoembedMetadata(ytId),fetchDurationViaPlayer(ytId)]);return{...meta,duration}}
async function fetchYouTubePlaylist(playlistId){const playlistData=await youtubeApi('playlists',{part:'snippet',id:playlistId});const playlist=playlistData.items?.[0];if(!playlist)
throw new Error('Playlist not found or not accessible with this API key.');const items=[];let pageToken='';do{const data=await youtubeApi('playlistItems',{part:'snippet,contentDetails',maxResults:'50',playlistId,...(pageToken&&{pageToken})});items.push(...(data.items||[]));pageToken=data.nextPageToken||''}while(pageToken);const videoIdOf=(item)=>item.contentDetails?.videoId||item.snippet?.resourceId?.videoId;const ids=[...new Set(items.map(videoIdOf).filter(Boolean))];const details=new Map();for(let i=0;i<ids.length;i+=50){const data=await youtubeApi('videos',{part:'snippet,contentDetails',id:ids.slice(i,i+50).join(',')});(data.items||[]).forEach((item)=>details.set(item.id,item))}
let skipped=0;const videos=items.flatMap((item,index)=>{const ytId=videoIdOf(item);if(!ytId){skipped++;return[]}
const detail=details.get(ytId);const placeholder=/^(private|deleted) video$/i.test((item.snippet?.title||'').trim());if(!detail||placeholder){skipped++;return[]}
return[createVideo(ytId,{title:detail?.snippet?.title||item.snippet?.title,channel:detail?.snippet?.channelTitle||item.snippet?.videoOwnerChannelTitle||item.snippet?.channelTitle,duration:parseIsoDuration(detail?.contentDetails?.duration),thumbnail:pickThumbnail(detail?.snippet?.thumbnails)||pickThumbnail(item.snippet?.thumbnails),publishedAt:detail?.snippet?.publishedAt||item.snippet?.publishedAt},{tags:['imported'],addedAt:Date.now()+index})]});return{title:playlist.snippet?.title||'Imported YouTube Playlist',description:playlist.snippet?.description||'Imported directly via YouTube Data API v3',thumbnail:pickThumbnail(playlist.snippet?.thumbnails),videos,skipped}}
const DURATION_CONCURRENCY=3;const DURATION_TIMEOUT_MS=12000;const UNRESOLVED_KEY='yt_playlist_unresolved';const UNRESOLVED_TTL_MS=7*24*60*60*1000;const unresolvedDurations=(()=>{const entries=new Map();try{const stored=JSON.parse(localStorage.getItem(UNRESOLVED_KEY)||'{}');Object.entries(stored).forEach(([id,time])=>{if(Date.now()-Number(time)<UNRESOLVED_TTL_MS)
entries.set(id,Number(time));})}catch{}
const persist=()=>{try{localStorage.setItem(UNRESOLVED_KEY,JSON.stringify(Object.fromEntries(entries)))}catch{}};return{has:(id)=>entries.has(id),add:(id)=>{entries.set(id,Date.now());persist()},clear:()=>{entries.clear();persist()}}})();let durationBackfillRunning=!1;let durationBackfillQueued=!1;let durationRefreshTimer=null;function whenYouTubeApiReady(timeoutMs=15000){return new Promise((resolve)=>{const started=Date.now();const check=()=>{if(window.YT?.Player)
return resolve(!0);if(Date.now()-started>timeoutMs)
return resolve(!1);setTimeout(check,200)};check()})}
function fetchDurationViaPlayer(ytId){return new Promise(async(resolve)=>{if(!(await whenYouTubeApiReady()))
return resolve('');const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none;overflow:hidden';const slot=document.createElement('div');host.appendChild(slot);document.body.appendChild(host);let finished=!1;let poll=null;let instance=null;const finish=(seconds)=>{if(finished)
return;finished=!0;clearInterval(poll);clearTimeout(timeout);try{instance?.destroy()}catch{}
host.remove();resolve(seconds>0?formatClock(Math.round(seconds)):'')};const timeout=setTimeout(()=>finish(0),DURATION_TIMEOUT_MS);try{instance=new YT.Player(slot,{width:'200',height:'200',videoId:ytId,playerVars:{controls:0,disablekb:1,fs:0,rel:0,playsinline:1},events:{onReady:(e)=>{let ticks=0;poll=setInterval(()=>{const seconds=Number(e.target.getDuration?.())||0;if(seconds>0)
return finish(seconds);if(++ticks===6){try{e.target.mute();e.target.playVideo()}catch{}}},250)},onError:()=>finish(0)}})}catch{finish(0)}})}
async function fetchDurationsViaApi(ids){const found=new Map();for(let i=0;i<ids.length;i+=50){const data=await youtubeApi('videos',{part:'contentDetails',id:ids.slice(i,i+50).join(',')});(data.items||[]).forEach((item)=>{const duration=parseIsoDuration(item.contentDetails?.duration);if(duration)
found.set(item.id,duration);})}
return found}
async function mapLimit(items,limit,worker){const results=new Array(items.length);let next=0;const runners=Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await worker(items[index],index)}});await Promise.all(runners);return results}
async function resolveDurations(ytIds,onResolved){let pending=[...new Set(ytIds)];if(state.apiKey.trim()&&pending.length){try{const found=await fetchDurationsViaApi(pending);found.forEach((duration,id)=>onResolved(id,duration));pending=pending.filter((id)=>!found.has(id))}catch(error){console.warn('Duration lookup via API failed, falling back to player:',error)}}
await mapLimit(pending,DURATION_CONCURRENCY,async(id)=>{const duration=await fetchDurationViaPlayer(id);if(duration)
onResolved(id,duration);})}
function applyDuration(ytId,duration){let changed=!1;state.playlists.forEach((pl)=>pl.videos.forEach((v)=>{if(v.youtubeId===ytId&&!v.duration){v.duration=duration;changed=!0}}));return changed}
function scheduleDurationRefresh(){clearTimeout(durationRefreshTimer);durationRefreshTimer=setTimeout(()=>{saveData();renderStats();renderMainHeader();renderVideoGrid()},250)}
async function backfillMissingDurations(){if(durationBackfillRunning){durationBackfillQueued=!0;return}
durationBackfillRunning=!0;try{do{durationBackfillQueued=!1;const ids=[...new Set(getAllVideos().filter((v)=>v.youtubeId&&!v.duration&&!unresolvedDurations.has(v.youtubeId)).map((v)=>v.youtubeId))];if(!ids.length)
break;await resolveDurations(ids,(id,duration)=>{if(applyDuration(id,duration))
scheduleDurationRefresh();});const resolved=new Set(getAllVideos().filter((v)=>v.duration).map((v)=>v.youtubeId));ids.forEach((id)=>{if(!resolved.has(id))
unresolvedDurations.add(id);})}while(durationBackfillQueued);}finally{durationBackfillRunning=!1}}
function renderApp(){if(!SMART_VIEWS[state.activeView]&&!findPlaylist(state.activeView))
state.activeView='all';renderSidebar();renderStats();renderMainHeader();renderVideoGrid()}
function renderStats(){const all=getAllVideos();const watched=all.filter((v)=>v.watched).length;const counts={all:all.length,favorites:all.filter((v)=>v.favorite).length,watched,unwatched:all.length-watched};$('stat-playlists-count').textContent=state.playlists.length.toLocaleString();$('stat-videos-count').textContent=counts.all.toLocaleString();$('stat-duration-count').textContent=formatTotalDuration(all);Object.entries(counts).forEach(([view,count])=>{$(`badge-${view}-count`).textContent=count.toLocaleString()})}
function renderSidebar(){$('sidebar-playlists-list').innerHTML=state.playlists.map((pl)=>`
      <button type="button" class="playlist-nav__item${pl.id === state.activeView ? ' is-active' : ''}" data-playlist-id="${escapeHtml(pl.id)}">
         <span class="playlist-nav__label">
            <i class="fa-solid fa-folder"></i>
            <span class="truncate">${escapeHtml(pl.title)}</span>
         </span>
         <span class="count">${pl.videos.length}</span>
      </button>`).join('');$$('.nav-item[data-view]').forEach((item)=>{item.classList.toggle('is-active',item.dataset.view===state.activeView)})}
function renderMainHeader(){const smart=SMART_VIEWS[state.activeView];const playlist=smart?null:findPlaylist(state.activeView);const videos=getViewVideos();const info=smart||{badge:playlist.category||'Playlist',title:playlist.title,desc:playlist.description?(playlist.description.length>DESC_MAX_LENGTH?`${playlist.description.slice(0, DESC_MAX_LENGTH)}…`:playlist.description):'No description provided.',accent:PLAYLIST_COLORS[playlist.color]||PLAYLIST_COLORS.red};$('playlist-category-badge').textContent=info.badge;$('playlist-video-count-badge').textContent=`${videos.length} videos`;$('playlist-duration-badge').lastElementChild.textContent=formatTotalDuration(videos);$('playlist-title-display').textContent=info.title;$('playlist-desc-display').textContent=info.desc;$('playlist-header-accent').style.setProperty('--accent',info.accent);$('btn-edit-playlist').hidden=!playlist;$('btn-delete-playlist').hidden=!playlist;$('playlist-banner-thumb').innerHTML=videos.length?`<img src="${escapeHtml(getVideoThumbnail(videos[0]))}" alt=""><div class="thumb-shade"></div>`:'<i class="fa-solid fa-layer-group"></i>'}
function videoCardHtml(video){const title=escapeHtml(video.title);const ids=`data-video-id="${escapeHtml(video.id)}" data-playlist-id="${escapeHtml(video.playlistId)}"`;return `
      <article class="video-card" ${ids}>
         <div>
            <div class="video-card__media">
               <button type="button" class="video-card__thumb" data-action="play" aria-label="Play ${title}">
                  <img src="${escapeHtml(getVideoThumbnail(video))}" alt="" loading="lazy">
                  <span class="video-card__overlay"><span class="play-badge"><i class="fa-solid fa-play"></i></span></span>
               </button>
               ${video.watched ? '<span class="video-card__watched"><i class="fa-solid fa-check"></i> Watched</span>' : ''}
               <span class="video-card__duration">${escapeHtml(video.duration || '--:--')}</span>
               <button type="button" class="video-card__fav" data-action="favorite" aria-label="${video.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                  <i class="fa-${video.favorite ? 'solid ic-amber' : 'regular'} fa-star"></i>
               </button>
            </div>
            <div class="video-card__body">
               <h3 class="video-card__title"><button type="button" data-action="play">${title}</button></h3>
               <p class="video-card__channel">${escapeHtml(video.channel || 'YouTube Channel')}</p>
               ${video.category ? `<span class="video-card__category" title="Category"><i class="fa-solid fa-tag"></i>${escapeHtml(video.category)}</span>` : ''}
            </div>
         </div>
         <div class="video-card__footer">
            <span class="video-card__playlist" title="${escapeHtml(video.playlistTitle)}">
               <i class="fa-solid fa-folder"></i>${escapeHtml(video.playlistTitle || 'Playlist')}
            </span>
            <div class="video-card__actions">
               <button type="button" class="action-btn" data-action="edit" title="Edit video" aria-label="Edit video"><i class="fa-solid fa-pen"></i></button>
               <button type="button" class="action-btn action-btn--watched" data-action="watched" title="${video.watched ? 'Mark unwatched' : 'Mark watched'}" aria-label="${video.watched ? 'Mark unwatched' : 'Mark watched'}"><i class="fa-solid fa-circle-check${video.watched ? ' ic-emerald' : ''}"></i></button>
               <button type="button" class="action-btn" data-action="move" title="Move or copy" aria-label="Move or copy"><i class="fa-solid fa-arrows-split-up-and-left"></i></button>
               <button type="button" class="action-btn action-btn--danger" data-action="delete" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
         </div>
      </article>`}
function videoRowHtml(video){const title=escapeHtml(video.title);const ids=`data-video-id="${escapeHtml(video.id)}" data-playlist-id="${escapeHtml(video.playlistId)}"`;return `
      <article class="video-row" ${ids}>
         <div class="video-row__info">
            <button type="button" class="video-row__thumb" data-action="play" aria-label="Play ${title}">
               <img src="${escapeHtml(getVideoThumbnail(video))}" alt="" loading="lazy">
               <span class="video-card__overlay"><i class="fa-solid fa-play"></i></span>
            </button>
            <div class="video-row__text">
               <h4><button type="button" data-action="play">${title}</button></h4>
               <p>${escapeHtml(video.channel || 'YouTube Channel')} &bull; ${escapeHtml(video.playlistTitle || 'Playlist')}${video.duration ? `&bull;${escapeHtml(video.duration)}` : ''}${video.category ? `&bull;<span class="video-row__category"><i class="fa-solid fa-tag"></i>${escapeHtml(video.category)}</span>` : ''}</p>
            </div>
         </div>
         <div class="video-card__actions">
            <button type="button" class="action-btn action-btn--fav" data-action="favorite" aria-label="${video.favorite ? 'Remove from favorites' : 'Add to favorites'}"><i class="fa-${video.favorite ? 'solid ic-amber' : 'regular'} fa-star"></i></button>
            <button type="button" class="action-btn action-btn--watched" data-action="watched" aria-label="${video.watched ? 'Mark unwatched' : 'Mark watched'}"><i class="fa-solid fa-circle-check${video.watched ? ' ic-emerald' : ''}"></i></button>
            <button type="button" class="action-btn" data-action="move" aria-label="Move or copy"><i class="fa-solid fa-arrows-split-up-and-left"></i></button>
            <button type="button" class="action-btn action-btn--danger" data-action="delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
         </div>
      </article>`}
function renderVideoGrid(){const container=$('video-grid');const videos=getFilteredAndSortedVideos();const isList=state.viewMode==='list';container.hidden=videos.length===0;$('empty-state').hidden=videos.length>0;container.classList.toggle('video-grid--list',isList);container.innerHTML=videos.map(isList?videoRowHtml:videoCardHtml).join('')}
function toggleVideoFlag(playlistId,videoId,flag){const video=findVideo(playlistId,videoId);if(!video)
return;video[flag]=!video[flag];commit();const messages={watched:['Marked as unwatched','Marked as watched'],favorite:['Removed from favorites','Added to favorites']};showToast(messages[flag][Number(video[flag])],'success')}
function deleteVideo(playlistId,videoId){const playlist=findPlaylist(playlistId);const video=findVideo(playlistId,videoId);if(!video)
return;askConfirm('Remove Video?',`Remove "${video.title}" from this playlist?`,()=>{playlist.videos=playlist.videos.filter((v)=>v.id!==videoId);commit();showToast('Video removed','success')})}
function deletePlaylist(playlistId){const playlist=findPlaylist(playlistId);if(!playlist)
return;askConfirm(`Delete "${playlist.title}"?`,`This will permanently remove the playlist and its ${playlist.videos.length} videos.`,()=>{state.playlists=state.playlists.filter((p)=>p.id!==playlistId);if(state.activeView===playlistId)
state.activeView='all';commit();showToast('Playlist deleted','success')})}
function mergePlaylists({sourceIds,targetType,newTitle,existingId,dedupe,deleteSources}){const copyFromIds=targetType==='existing'?sourceIds.filter((id)=>id!==existingId):sourceIds;let combined=copyFromIds.flatMap((id)=>findPlaylist(id)?.videos||[]);if(dedupe){const seen=new Set();combined=combined.filter((v)=>!seen.has(v.youtubeId)&&seen.add(v.youtubeId))}
let target;if(targetType==='new'){target=createPlaylist({title:makeUniqueTitle(newTitle||'Merged Playlist'),description:`Merged from ${sourceIds.length} playlists.`,category:'Merged',color:'purple',videos:cloneVideos(combined)});state.playlists.push(target)}else{target=findPlaylist(existingId);if(target){const existing=new Set(target.videos.map((v)=>v.youtubeId));const additions=cloneVideos(combined).filter((v)=>!dedupe||!existing.has(v.youtubeId));target.videos=target.videos.concat(additions)}}
if(deleteSources){state.playlists=state.playlists.filter((p)=>!sourceIds.includes(p.id)||p.id===target?.id)}
state.activeView=target?.id||'all';commit();showToast('Playlists merged successfully!','success')}
window.onYouTubeIframeAPIReady=()=>{if($('modal-player').classList.contains('is-open')&&player.queue.length)
loadCurrentQueueVideo();};const getCurrentQueueVideo=()=>player.queue[player.index]||null;function openPlayer(queue,index){if(!queue.length)
return;player.queue=[...queue];player.index=index;player.played=new Set();openModal('modal-player');document.body.classList.add('player-modal-open');loadCurrentQueueVideo()}
function playAllQueue(){const videos=getFilteredAndSortedVideos();if(!videos.length)
return showToast('No videos available in current view','error');openPlayer(videos,0)}
function playSingleVideo(videoId,playlistId){const videos=getFilteredAndSortedVideos();const index=videos.findIndex((v)=>v.id===videoId);if(index!==-1)
return openPlayer(videos,index);const video=findVideo(playlistId,videoId);if(video)
openPlayer([{...video,playlistId}],0)}
function loadCurrentQueueVideo(){const video=getCurrentQueueVideo();if(!video)
return;stopWatchMonitor();player.played.add(player.index);$('player-video-title').textContent=video.title;$('player-queue-subtitle').textContent=`Playing item ${player.index + 1} of ${player.queue.length}`;renderQueueList();if(typeof player.instance?.loadVideoById==='function'){player.instance.loadVideoById(video.youtubeId)}else if(window.YT?.Player){player.instance=new YT.Player('yt-player-container',{videoId:video.youtubeId,playerVars:{autoplay:1,controls:1,rel:0,playsinline:1},events:{onReady:startWatchMonitor,onStateChange:onPlayerStateChange}})}}
function onPlayerStateChange(event){const{PLAYING,ENDED}=window.YT.PlayerState;if(event.data===PLAYING){startWatchMonitor()}else if(event.data===ENDED){markCurrentVideoWatched();stopWatchMonitor();nextQueueVideo()}else{stopWatchMonitor()}}
function markCurrentVideoWatched(){const current=getCurrentQueueVideo();if(!current||current.watched)
return;current.watched=!0;const stored=findVideo(current.playlistId,current.id);if(stored&&!stored.watched){stored.watched=!0;commit();showToast('Video marked as watched','success')}}
function startWatchMonitor(){stopWatchMonitor();if(typeof player.instance?.getCurrentTime!=='function')
return;player.timer=window.setInterval(()=>{const current=getCurrentQueueVideo();if(!current||current.watched)
return stopWatchMonitor();try{const duration=Number(player.instance.getDuration())||0;const position=Number(player.instance.getCurrentTime())||0;if(duration>0&&position/duration>=WATCHED_THRESHOLD){markCurrentVideoWatched();stopWatchMonitor()}}catch{}},2000)}
function stopWatchMonitor(){window.clearInterval(player.timer);player.timer=null}
function nextQueueVideo(){const count=player.queue.length;if(player.shuffle){const indexes=player.queue.map((_,i)=>i);let remaining=indexes.filter((i)=>!player.played.has(i));if(!remaining.length){if(!player.loop)
return showToast('Queue completed','info');player.played=new Set();remaining=indexes.filter((i)=>count===1||i!==player.index)}
player.index=remaining[Math.floor(Math.random()*remaining.length)]}else if(player.index<count-1){player.index++}else if(player.loop){player.index=0}else{return showToast('Queue completed','info')}
loadCurrentQueueVideo()}
function prevQueueVideo(){player.index=player.index>0?player.index-1:player.queue.length-1;loadCurrentQueueVideo()}
function renderQueueList(){$('player-queue-count').textContent=`${player.queue.length} items`;$('player-queue-list').innerHTML=player.queue.map((video,index)=>{const isCurrent=index===player.index;return `
         <div class="queue-item${isCurrent ? ' is-current' : ''}" data-index="${index}">
            <span class="queue-item__index">${isCurrent ? '<i class="fa-solid fa-volume-high animate-pulse"></i>' : index + 1}</span>
            <img src="${escapeHtml(getVideoThumbnail(video))}" alt="" loading="lazy">
            <div class="queue-item__text">
               <p class="queue-item__title">${escapeHtml(video.title)}</p>
               <p class="queue-item__channel">${escapeHtml(video.channel || 'YouTube')}</p>
            </div>
         </div>`}).join('')}
function closePlayerModal(){stopWatchMonitor();if(typeof player.instance?.stopVideo==='function')
player.instance.stopVideo();closeModal('modal-player');document.body.classList.remove('player-modal-open')}
function toggleQueueOption(key,buttonId,label){player[key]=!player[key];if(key==='shuffle'&&player.shuffle)
player.played=new Set([player.index]);$(buttonId).classList.toggle('active',player[key]);showToast(`${label} ${player[key] ? 'ON' : 'OFF'}`,'info')}
const openModal=(id)=>$(id).classList.add('is-open');const closeModal=(id)=>$(id).classList.remove('is-open');function askConfirm(title,message,onConfirm){$('confirmTitle').textContent=title;$('confirmMessage').textContent=message;pendingConfirm=onConfirm;openModal('modalConfirm')}
function fillPlaylistOptions(select,selectedId='',currentMarkerId=''){select.replaceChildren(...state.playlists.map((p)=>{const label=p.title+(p.id===currentMarkerId?' (Current)':'');return new Option(label,p.id,!1,p.id===selectedId)}))}
function refreshCategoryOptions(){const categories=new Set(['General','Imported','Merged']);state.playlists.forEach((pl)=>{if(pl.category)
categories.add(pl.category);pl.videos.forEach((v)=>v.category&&categories.add(v.category))});$('category-options').replaceChildren(...[...categories].sort((a,b)=>a.localeCompare(b)).map((c)=>new Option(c,c)))}
function openPlaylistModal(isEdit=!1){const playlist=isEdit?findPlaylist(state.activeView):null;if(isEdit&&!playlist)
return;$('modal-playlist-title').textContent=isEdit?'Edit Playlist':'Create New Playlist';$('form-playlist').reset();refreshCategoryOptions();$('input-playlist-id').value=playlist?.id||'';$('input-playlist-category').value=playlist?(playlist.category||'General'):'General';if(playlist){$('input-playlist-title').value=playlist.title;$('input-playlist-desc').value=playlist.description||'';$('input-playlist-color').value=playlist.color||'red'}
openModal('modal-playlist')}
function openAddVideoModal(){if(!state.playlists.length)
return showToast('Please create a playlist first','error');$('modal-video-title-text').textContent='Add Video';$('form-video').reset();refreshCategoryOptions();$('input-video-category').value='';$('input-video-edit-id').value='';$('input-video-original-playlist-id').value='';fillPlaylistOptions($('input-video-target-playlist'),state.activeView);openModal('modal-video')}
function openEditVideoModal(playlistId,videoId){const video=findVideo(playlistId,videoId);if(!video)
return;$('modal-video-title-text').textContent='Edit Video Details';refreshCategoryOptions();$('input-video-category').value=video.category||'';$('input-video-edit-id').value=video.id;$('input-video-original-playlist-id').value=playlistId;$('input-video-url').value=`https://www.youtube.com/watch?v=${video.youtubeId}`;$('input-video-custom-title').value=video.title;fillPlaylistOptions($('input-video-target-playlist'),playlistId);openModal('modal-video')}
function openMoveCopyModal(playlistId,videoId){$('move-video-id').value=videoId;$('move-source-playlist-id').value=playlistId;fillPlaylistOptions($('move-target-playlist-id'),'',playlistId);openModal('modal-move-copy')}
function openMergeModal(){const sources=$('merge-source-list');fillPlaylistOptions($('input-merge-existing-id'));if(state.playlists.length<2){sources.innerHTML='<p class="merge-list__empty">You need at least 2 playlists to merge.</p>'}else{sources.innerHTML=state.playlists.map((p)=>`
         <label class="merge-list__item">
            <span><input type="checkbox" value="${escapeHtml(p.id)}" class="merge-source-checkbox"> ${escapeHtml(p.title)}</span>
            <span>${p.videos.length} videos</span>
         </label>`).join('')}
openModal('modal-merge')}
function setImportTab(tab){$$('.tab').forEach((btn)=>btn.classList.toggle('is-active',btn.dataset.tab===tab));$('form-import-playlist').hidden=tab!=='playlist';$('form-import-bulk').hidden=tab!=='bulk'}
function openImportModal(tab='playlist'){fillPlaylistOptions($('select-import-existing-playlist'),state.activeView);fillPlaylistOptions($('select-bulk-target-playlist'),state.activeView);$('form-import-playlist').reset();$('form-import-bulk').reset();$('dest-existing-select-wrap').hidden=!0;setImportTab(tab);openModal('modal-import')}
function openSettingsModal(){$('input-api-key').value=state.apiKey;updateStorageSize();openModal('modal-settings')}
const isDrawerViewport=()=>window.innerWidth<DRAWER_BREAKPOINT;function setSidebarOpen(open){const isOpen=open&&isDrawerViewport();$('sidebar').classList.toggle('is-open',isOpen);$('sidebar-backdrop').hidden=!isOpen;document.body.classList.toggle('sidebar-open',isOpen);$('sidebar').setAttribute('aria-hidden',String(isDrawerViewport()&&!isOpen));$('sidebar-toggle').setAttribute('aria-expanded',String(isOpen))}
function selectView(view){state.activeView=view;renderApp();setSidebarOpen(!1)}
async function handlePlaylistImport(event){event.preventDefault();const playlistId=extractPlaylistId($('input-playlist-url').value);if(!playlistId)
return showToast('Could not parse YouTube Playlist ID','error');const destType=document.querySelector('input[name="playlist-dest-type"]:checked').value;const existing=findPlaylist($('select-import-existing-playlist').value);if(destType==='existing'&&!existing)
return showToast('Create a playlist first','error');if(destType==='new'&&state.playlists.some((p)=>p.sourceYtId===playlistId)){return showToast('This playlist is already imported','error')}const submitBtn=$('btn-submit-playlist-import');setBusy(submitBtn,!0,'<i class="fa-solid fa-spinner fa-spin"></i> Fetching...');try{if(!state.apiKey.trim()){return showToast('API key is not configured!','error')}else{const result=await fetchYouTubePlaylist(playlistId);let imported=result.videos;if(destType==='new'){const created=createPlaylist({title:makeUniqueTitle(result.title),description:result.description,category:'Imported',sourceYtId:playlistId,thumbnail:result.thumbnail||result.videos[0]?.thumbnail,videos:result.videos});state.playlists.push(created);state.activeView=created.id}else{const known=new Set(existing.videos.map((v)=>v.youtubeId));imported=result.videos.filter((v)=>!known.has(v.youtubeId));if(!imported.length){return showToast('Videos are already added. Try to add another playlist','info')}existing.videos=existing.videos.concat(imported);state.activeView=existing.id}
const skippedNote=result.skipped?` (${result.skipped} private/deleted skipped)`:'';showToast(`Successfully imported ${imported.length} videos${skippedNote}!`,'success')}
commit();closeModal('modal-import');backfillMissingDurations()}catch(error){console.error(error);showToast(error?.message||'Import error: Verify your API key, quota, or playlist link.','error')}finally{setBusy(submitBtn,!1)}}
async function handleBulkImport(event){event.preventDefault();const playlist=findPlaylist($('select-bulk-target-playlist').value);if(!playlist){return showToast('Create playlist first','error')}
const lines=$('input-bulk-urls').value.split('\n').map((l)=>l.trim()).filter(Boolean);const ytIds=[...new Set(lines.map(extractVideoId).filter(Boolean))];if(!ytIds.length){return showToast('No valid YouTube links found','error')}const known=new Set(playlist.videos.map((v)=>v.youtubeId));const newIds=ytIds.filter((id)=>!known.has(id));if(!newIds.length){return showToast('Videos are already added. Try to add another videos','info')}const submitBtn=$('btn-submit-bulk-import');setBusy(submitBtn,!0,'<i class="fa-solid fa-spinner fa-spin"></i> Processing...');try{const metas=await mapLimit(newIds,DURATION_CONCURRENCY,fetchVideoMetadata);newIds.forEach((ytId,index)=>{playlist.videos.unshift(createVideo(ytId,metas[index],{tags:['bulk-imported']}))})}finally{setBusy(submitBtn,!1)}
commit();closeModal('modal-import');const dupes=ytIds.length-newIds.length;showToast(`Added ${newIds.length} videos with metadata${dupes?` (${dupes} already in playlist skipped)`:''}!`,'success');backfillMissingDurations()}
function handlePlaylistForm(event){event.preventDefault();const id=$('input-playlist-id').value;const fields={title:$('input-playlist-title').value.trim(),description:$('input-playlist-desc').value.trim(),category:$('input-playlist-category').value.trim()||'General',color:$('input-playlist-color').value};if(isPlaylistTitleTaken(fields.title,id)){return showToast('This playlist is already created','error')}
if(id){Object.assign(findPlaylist(id)||{},fields);showToast('Playlist updated','success')}else{const created=createPlaylist(fields);state.playlists.push(created);state.activeView=created.id;showToast('New playlist created!','success')}
commit();closeModal('modal-playlist')}
async function handleVideoForm(event){event.preventDefault();const editId=$('input-video-edit-id').value;const originalPlaylistId=$('input-video-original-playlist-id').value;const customTitle=$('input-video-custom-title').value.trim();const category=$('input-video-category').value.trim();const ytId=extractVideoId($('input-video-url').value);const target=findPlaylist($('input-video-target-playlist').value);if(!ytId)
return showToast('Invalid YouTube URL or Video ID','error');if(!target)
return;if(target.videos.some((v)=>v.youtubeId===ytId&&v.id!==editId)){return showToast('This video is already in the playlist','error')}const submitBtn=event.currentTarget.querySelector('[type="submit"]');setBusy(submitBtn,!0,'<i class="fa-solid fa-spinner fa-spin"></i> Saving...');try{if(editId&&originalPlaylistId){const source=findPlaylist(originalPlaylistId);const video=source?.videos.find((v)=>v.id===editId);if(video){const linkChanged=video.youtubeId!==ytId;const oldTitle=video.title;const meta=linkChanged?await fetchVideoMetadata(ytId):null;if(source!==target){source.videos=source.videos.filter((v)=>v.id!==editId);target.videos.unshift(video)}
if(linkChanged){Object.assign(video,{youtubeId:ytId,title:meta.title||`YouTube Video (${ytId})`,channel:meta.channel||'YouTube',duration:meta.duration||'',thumbnail:meta.thumbnail||'',publishedAt:meta.publishedAt||'',watched:!1});if(customTitle&&customTitle!==oldTitle)
video.title=customTitle}else if(customTitle){video.title=customTitle}
video.category=category}
showToast('Video updated','success')}else{const meta=await fetchVideoMetadata(ytId);target.videos.unshift(createVideo(ytId,{...meta,title:customTitle||meta.title},{category}));showToast('Video added successfully!','success')}}finally{setBusy(submitBtn,!1)}
commit();closeModal('modal-video');backfillMissingDurations()}
function handleMergeForm(event){event.preventDefault();const sourceIds=$$('.merge-source-checkbox:checked').map((cb)=>cb.value);if(sourceIds.length<2)
return showToast('Please select at least 2 playlists to merge','error');const targetType=document.querySelector('input[name="merge-target-type"]:checked').value;const newTitle=$('input-merge-new-title').value.trim();if(targetType==='new'&&newTitle&&isPlaylistTitleTaken(newTitle)){return showToast('This playlist is already created','error')}
mergePlaylists({sourceIds,targetType,newTitle,existingId:$('input-merge-existing-id').value,dedupe:$('input-merge-dedupe').checked,deleteSources:$('input-merge-delete-sources').checked});closeModal('modal-merge')}
function handleMoveCopyForm(event){event.preventDefault();const source=findPlaylist($('move-source-playlist-id').value);const target=findPlaylist($('move-target-playlist-id').value);const index=source?.videos.findIndex((v)=>v.id===$('move-video-id').value)??-1;if(target&&index!==-1){const video=source.videos[index];if(document.querySelector('input[name="move-action-type"]:checked').value==='move'){source.videos.splice(index,1);target.videos.unshift(video);showToast('Video moved','success')}else{target.videos.unshift(...cloneVideos([video]));showToast('Video copied','success')}
commit()}
exportJson
closeModal('modal-move-copy')}
function exportJson(){const videos=getFilteredAndSortedVideos();if(videos.length>0){const blob=new Blob([JSON.stringify(state.playlists,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`YT_playlist_backup_${new Date().toISOString().slice(0, 10)}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(link.href);showToast('JSON backup exported successfuly','success')}else{showToast(`You don't have any playlist or video to export!`,'error')}}
let pendingJsonImport=null;function importJson(event){const input=event.target;const file=input.files[0];if(!file)
return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data))
return showToast('Invalid backup file format','error');const incoming=normalizePlaylists(data);if(!incoming.length)
return showToast('No playlists found in this file','error');openJsonImportModal(incoming,file.name)}catch{showToast('Failed to parse JSON file','error')}};reader.readAsText(file);input.value=''}
function openJsonImportModal(incoming,fileName){pendingJsonImport=incoming;const videoCount=incoming.reduce((total,pl)=>total+pl.videos.length,0);$('json-import-summary').textContent=`"${fileName}" contains ${incoming.length} playlist(s) with ${videoCount} video(s). You currently have ${state.playlists.length} playlist(s).`;updateJsonImportHint();openModal('modal-import-json')}
function updateJsonImportHint(){const hints={new:'Keeps everything you have. Playlists that already exist only get their missing videos; duplicate playlists and videos are skipped.',replace:`Warning: deletes all ${state.playlists.length} current playlist(s) and replaces them with the file contents.`};const mode=document.querySelector('input[name="json-import-mode"]:checked')?.value;$('json-import-hint').textContent=hints[mode];$('json-import-hint').classList.toggle('is-danger',mode==='replace')}
function dedupeVideos(videos){const seen=new Set();return videos.filter((v)=>{if(!v.youtubeId||seen.has(v.youtubeId))return!1;seen.add(v.youtubeId);return!0})}
function applyJsonImport(incoming,mode){if(mode==='replace'){state.playlists=incoming.map((pl)=>({...pl,videos:dedupeVideos(pl.videos)}));state.activeView='all';commit();backfillMissingDurations();return showToast('Backup restored successfully!','success')}
let addedPlaylists=0,addedVideos=0,skippedVideos=0;incoming.forEach((pl)=>{const videos=dedupeVideos(pl.videos);skippedVideos+=pl.videos.length-videos.length;const match=state.playlists.find((p)=>p.id===pl.id)||(pl.sourceYtId&&state.playlists.find((p)=>p.sourceYtId===pl.sourceYtId))||state.playlists.find((p)=>normalizeTitle(p.title)===normalizeTitle(pl.title));if(match){const known=new Set(match.videos.map((v)=>v.youtubeId));const fresh=videos.filter((v)=>!known.has(v.youtubeId));skippedVideos+=videos.length-fresh.length;fresh.forEach((v)=>match.videos.push({...v,id:generateId('vid')}));addedVideos+=fresh.length}else{state.playlists.push({...pl,id:generateId('pl'),videos:videos.map((v)=>({...v,id:generateId('vid')}))});addedPlaylists++;addedVideos+=videos.length}});
if(!addedPlaylists&&!addedVideos){return showToast('Nothing new to import. Everything in this file is already in your workspace','info')}
state.activeView='all';commit();backfillMissingDurations();showToast(`Imported ${addedPlaylists} new playlist(s) and ${addedVideos} new video(s)${skippedVideos?` (${skippedVideos} duplicates skipped)`:''}`,'success')}
function openExportTextModal(){const videos=getFilteredAndSortedVideos();if(!videos.length)
return showToast('No videos in current view to export','error');$('export-text-area').value=videos.map((v)=>`https://www.youtube.com/watch?v=${v.youtubeId}`).join('\n');openModal('modal-export-text')}
async function copyExportText(){const textarea=$('export-text-area');textarea.select();try{await navigator.clipboard.writeText(textarea.value)}catch{document.execCommand('copy')}
showToast('URLs copied to clipboard!','success')}
function bindShell(){$('sidebar-toggle').addEventListener('click',()=>setSidebarOpen(!$('sidebar').classList.contains('is-open')));$('sidebar-backdrop').addEventListener('click',()=>setSidebarOpen(!1));let wasDrawer=isDrawerViewport();window.addEventListener('resize',()=>{if(wasDrawer!==isDrawerViewport()){wasDrawer=isDrawerViewport();setSidebarOpen(!1)}});setSidebarOpen(!1);$('nav-brand').addEventListener('click',()=>selectView('all'));$$('.nav-item[data-view]').forEach((item)=>item.addEventListener('click',()=>{const nav_data=item.getAttribute('data-view');$$('.filter-pill').forEach(pill=>{const filter_data=pill.getAttribute('data-filter');pill.classList.remove('is-active');if(nav_data===filter_data){pill.classList.add('is-active');state.filterStatus=pill.dataset.filter;renderVideoGrid()}})
state.filterStatus=item.dataset.view;selectView(item.dataset.view)}));$('sidebar-playlists-list').addEventListener('click',(e)=>{const item=e.target.closest('[data-playlist-id]');if(item)
selectView(item.dataset.playlistId);});const search=$('global-search');search.addEventListener('input',()=>{state.searchQuery=search.value;$('clear-search').hidden=!search.value;setSidebarOpen(!1)
renderVideoGrid()});$('clear-search').addEventListener('click',()=>{search.value='';state.searchQuery='';$('clear-search').hidden=!0;renderVideoGrid()});const dropdown=$('data-dropdown');const dataButton=$('btn-data-menu');const setDropdown=(open)=>{dropdown.hidden=!open;dataButton.setAttribute('aria-expanded',String(open))};dataButton.addEventListener('click',(e)=>{e.stopPropagation();setDropdown(dropdown.hidden)});document.addEventListener('click',()=>setDropdown(!1));$('btn-export-json').addEventListener('click',exportJson);$('file-import-json').addEventListener('change',importJson);$('btn-export-text').addEventListener('click',openExportTextModal);$('btn-copy-export-text').addEventListener('click',copyExportText);$('btn-settings').addEventListener('click',openSettingsModal);$('btn-status-key-settings').addEventListener('click',openSettingsModal);$('btn-import-modal-open').addEventListener('click',()=>openImportModal());$('btn-empty-import').addEventListener('click',()=>openImportModal());$('btn-open-bulk-modal').addEventListener('click',()=>openImportModal('bulk'));$('btn-open-merge-modal').addEventListener('click',openMergeModal);['btn-new-playlist','btn-sidebar-add-playlist'].forEach((id)=>$(id).addEventListener('click',()=>openPlaylistModal(!1)))}
function bindWorkspace(){$('btn-play-all').addEventListener('click',playAllQueue);$('btn-add-video').addEventListener('click',openAddVideoModal);$('btn-empty-add-video').addEventListener('click',openAddVideoModal);$('btn-edit-playlist').addEventListener('click',()=>openPlaylistModal(!0));$('btn-delete-playlist').addEventListener('click',()=>{if(findPlaylist(state.activeView))
deletePlaylist(state.activeView);});$$('.filter-pill').forEach((pill)=>pill.addEventListener('click',()=>{$$('.filter-pill').forEach((p)=>p.classList.toggle('is-active',p===pill));state.filterStatus=pill.dataset.filter;selectView(pill.dataset.filter)
renderVideoGrid()}));$('sort-select').addEventListener('change',(e)=>{state.sortOrder=e.target.value;saveUiPrefs();renderVideoGrid()});[['grid','view-mode-grid'],['list','view-mode-list']].forEach(([mode,id])=>{$(id).addEventListener('click',()=>{state.viewMode=mode;saveUiPrefs();[['grid','view-mode-grid'],['list','view-mode-list']].forEach(([m,btnId])=>{$(btnId).classList.toggle('is-active',m===mode);$(btnId).setAttribute('aria-pressed',String(m===mode))});renderVideoGrid()})});$('video-grid').addEventListener('click',(e)=>{const button=e.target.closest('[data-action]');const card=button?.closest('[data-video-id]');if(!card)
return;const{videoId,playlistId}=card.dataset;switch(button.dataset.action){case 'play':playSingleVideo(videoId,playlistId);break;case 'favorite':toggleVideoFlag(playlistId,videoId,'favorite');break;case 'watched':toggleVideoFlag(playlistId,videoId,'watched');break;case 'edit':openEditVideoModal(playlistId,videoId);break;case 'move':openMoveCopyModal(playlistId,videoId);break;case 'delete':deleteVideo(playlistId,videoId);break}})}
function bindModals(){document.addEventListener('click',(e)=>{const closer=e.target.closest('[data-close-modal]');if(closer){const modal=closer.closest('.modal');modal?.classList.remove('is-open');if(modal?.id==='modalConfirm')
pendingConfirm=null;if(modal?.id==='modal-import-json')
pendingJsonImport=null}});$('confirmActionButton').addEventListener('click',()=>{const action=pendingConfirm;pendingConfirm=null;closeModal('modalConfirm');action?.()});$$('.tab').forEach((tab)=>tab.addEventListener('click',()=>setImportTab(tab.dataset.tab)));$$('input[name="playlist-dest-type"]').forEach((radio)=>radio.addEventListener('change',(e)=>{$('dest-existing-select-wrap').hidden=e.target.value!=='existing'}));$$('input[name="merge-target-type"]').forEach((radio)=>radio.addEventListener('change',(e)=>{const isExisting=e.target.value==='existing';$('merge-new-container').hidden=isExisting;$('merge-existing-container').hidden=!isExisting}));$$('input[name="json-import-mode"]').forEach((radio)=>radio.addEventListener('change',updateJsonImportHint));$('form-import-json').addEventListener('submit',(e)=>{e.preventDefault();const incoming=pendingJsonImport;const mode=document.querySelector('input[name="json-import-mode"]:checked').value;closeModal('modal-import-json');pendingJsonImport=null;if(!incoming)
return;if(mode==='replace'){askConfirm('Replace all playlists?',`This permanently deletes your ${state.playlists.length} current playlist(s). Export a JSON backup first if unsure.`,()=>applyJsonImport(incoming,'replace'))}else{applyJsonImport(incoming,mode)}});$('form-import-playlist').addEventListener('submit',handlePlaylistImport);$('form-import-bulk').addEventListener('submit',handleBulkImport);$('form-playlist').addEventListener('submit',handlePlaylistForm);$('form-video').addEventListener('submit',handleVideoForm);$('form-merge').addEventListener('submit',handleMergeForm);$('form-move-copy').addEventListener('submit',handleMoveCopyForm);$('form-settings').addEventListener('submit',(e)=>{e.preventDefault();state.apiKey=$('input-api-key').value.trim();saveData();updateApiStatusBadge();unresolvedDurations.clear();backfillMissingDurations();closeModal('modal-settings');showToast('Settings saved','success')})}
function bindPlayer(){$('btn-close-player').addEventListener('click',closePlayerModal);$('modal-player').addEventListener('click',(e)=>{if(e.target===e.currentTarget)
closePlayerModal();});$('player-btn-prev').addEventListener('click',prevQueueVideo);$('player-btn-next').addEventListener('click',nextQueueVideo);$('player-btn-shuffle').addEventListener('click',()=>toggleQueueOption('shuffle','player-btn-shuffle','Shuffle'));$('player-btn-loop').addEventListener('click',()=>toggleQueueOption('loop','player-btn-loop','Queue Repeat'));$('player-queue-list').addEventListener('click',(e)=>{const item=e.target.closest('[data-index]');if(!item)
return;player.index=Number(item.dataset.index);loadCurrentQueueVideo()})}
function bindGlobalKeys(){document.addEventListener('keydown',(e)=>{if(e.key!=='Escape')
return;if($('modalConfirm').classList.contains('is-open')){pendingConfirm=null;return closeModal('modalConfirm')}
if($('modal-player').classList.contains('is-open'))
return closePlayerModal();const openModals=$$('.modal.is-open');if(openModals.length){const top=openModals[openModals.length-1];if(top.id==='modal-import-json')
pendingJsonImport=null;return top.classList.remove('is-open')}
if(!$('data-dropdown').hidden){$('data-dropdown').hidden=!0;return $('btn-data-menu').setAttribute('aria-expanded','false')}
setSidebarOpen(!1)})}
function bindScrollToTop(){const button=$('scroll-top');const update=()=>{const root=document.documentElement;const max=root.scrollHeight-root.clientHeight;const progress=max>0?Math.round((window.scrollY*100)/max):0;button.classList.toggle('is-visible',window.scrollY>800);button.style.background=`conic-gradient(#2b4eff ${progress}%, #edeef3 0%)`};window.addEventListener('scroll',update,{passive:!0});button.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));update()}
window.addEventListener('DOMContentLoaded',()=>{loadData();bindShell();bindWorkspace();syncUiControls();bindModals();bindPlayer();bindGlobalKeys();bindScrollToTop();renderApp();backfillMissingDurations()})
