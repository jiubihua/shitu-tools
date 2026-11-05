// ==UserScript==
// @name         Eagle 小红书网页适配（无界面）
// @namespace    shitu-eagle-xhs-adapter
// @version      1.6.2
// @description  在笔记左上角悬停渐显 Eagle 收藏面板，支持选择或新建 Eagle 文件夹，提交图片与视频直链。
// @match        https://www.xiaohongshu.com/*
// @match        https://xiaohongshu.com/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      xhscdn.com
// @connect      xhscdn.net
// @connect      xiaohongshu.com
// @updateURL    https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.meta.js
// @downloadURL  https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.user.js
// @homepageURL  https://github.com/jiubihua/shitu-tools
// @run-at       document-idle
// @noframes
// ==/UserScript==
(function(){
'use strict';
function extractNote(rootOverride) {
  const unwrap = value => value?._value ?? value?.value ?? value;
  const safeURL = value => {
    try {
      if (typeof value !== 'string') return null;
      const url = new URL(value.startsWith('//') ? 'https:' + value : value);
      if (url.protocol === 'http:') url.protocol = 'https:';
      return url.protocol === 'https:' && /(^|\.)(xhscdn\.(?:com|net)|xiaohongshu\.com)$/.test(url.hostname) ? url.href : null;
    } catch { return null; }
  };
  const routeId = location.pathname.match(/\/(?:explore|discovery\/item)\/([a-f\d]{24})/i)?.[1];
  const root = rootOverride || document.querySelector('#noteContainer, .note-detail-mask .note-container, .note-detail-mask, .note-container');
  const images = [], videos = [], seen = new Set(), videoSeen = new Set();
  const videoCandidates = [];
  const addVideo = value => {
    const url = safeURL(value);
    if (!url || /\.m3u8(?:[?#]|$)/i.test(url) || videoSeen.has(url)) return;
    videoSeen.add(url); videoCandidates.push(url);
  };
  const add = (value, width, height) => {
    const url = safeURL(value);
    if (!url) return;
    // CDN transformations can differ between slides and thumbnails. Keep the first, best source.
    const key = new URL(url).pathname.split('!')[0];
    if (seen.has(key)) return;
    seen.add(key); images.push({url, width: Number(width) || 0, height: Number(height) || 0});
  };
  let title = '', source = '页面图片', sourceUrl = routeId ? location.href : '';
  try {
    const state = unwrap(unsafeWindow.__INITIAL_STATE__);
    const detail = unwrap(state?.note);
    const map = unwrap(detail?.noteDetailMap);
    const currentId = routeId || unwrap(detail?.currentNoteId) || unwrap(detail?.firstNoteId);
    if (!sourceUrl && /^[a-f\d]{24}$/i.test(currentId || '')) sourceUrl = `https://www.xiaohongshu.com/explore/${currentId}`;
    let record = currentId && unwrap(typeof map?.get==='function' ? map.get(currentId) : map?.[currentId]);
    let note = unwrap(record?.note || record?.noteCard || record?.note_card);
    if(!note){
      const mobile=unwrap(unwrap(state?.noteData)?.data)?.noteData;
      if(mobile && (!currentId || (mobile.noteId || mobile.note_id || mobile.id)===currentId))note=unwrap(mobile);
    }
    if (note) {
      title = note.title || '';
      const parse = value => {
        value=unwrap(value);
        if(typeof value==='string' && /^[\s]*[\[{]/.test(value))try{return JSON.parse(value);}catch{}
        return value;
      };
      const visited=new Set();
      const collect=(value,depth=0)=>{
        value=parse(value);if(!value || typeof value!=='object' || depth>10 || visited.has(value))return;
        visited.add(value);
        if(Array.isArray(value)){
          const entries=value.slice().sort((a,b)=>(Number(b?.videoBitrate || b?.video_bitrate || b?.width)||0)-(Number(a?.videoBitrate || a?.video_bitrate || a?.width)||0));
          for(const entry of entries)collect(entry,depth+1);return;
        }
        for(const key of ['masterUrl','master_url','playUrl','play_url','url','src','masterUrls','backupUrls','backup_urls']){
          const urls=Array.isArray(value[key])?value[key]:[value[key]];
          for(const url of urls)if(typeof url==='string')addVideo(url);
        }
        const origin=value.originVideoKey || value.origin_video_key;
        if(typeof origin==='string' && origin){
          if(/^(https?:)?\/\//i.test(origin))addVideo(origin);
          else if(/^[a-zA-Z0-9_./-]+$/.test(origin) && !origin.split('/').includes('..'))addVideo('https://sns-video-bd.xhscdn.com/'+origin.replace(/^\//,''));
        }
        // H.264 renditions first; stay inside the current note's video data.
        for(const key of ['media','mediaV2','media_v2','stream','h264','h265','av1',...Object.keys(value).filter(k=>!['media','mediaV2','media_v2','stream','h264','h265','av1','image','cover','firstFrame','first_frame'].includes(k))]){
          if(/(?:screencast_stream)$/i.test(key) && typeof value[key]==='string')addVideo(value[key]);
          if(value[key] && (typeof value[key]==='object' || /media_?v?2|opaque/i.test(key)))collect(value[key],depth+1);
        }
      };
      for(const video of [note.video,note.videoInfo,note.video_info,note.videoInfoV2,note.video_info_v2])collect(video);

    }
    if (note && Array.isArray(note.imageList)) {
      for (const item of note.imageList) {
        const info = item.infoList || [];
        const best = info.find(x => x.imageScene === 'WB_DFT') || info.find(x => x.imageScene === 'CRD_WM_JPG') || info[0];
        add(item.urlDefault || best?.url || item.urlPre || item.url, item.width, item.height);
      }
      title = note.title || ''; source = '笔记数据';
    }
  } catch { /* A changed page state can still use the visible slides. */ }
  if (!images.length && root) {
    const slides = root.querySelectorAll('.swiper-slide img, .note-slider img, .media-container img, img.note-image');
    for (const img of slides) {
      add(img.getAttribute('data-src') || img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
    }
    title = root.querySelector('#detail-title, .title')?.textContent?.trim() || '';
  }
  if (!videos.length && root) {
    for (const video of root.querySelectorAll('video')) {
      for (const url of [video.currentSrc,video.src,video.querySelector('source')?.src]) {
        addVideo(url);if (videos.length) break;
      }
    }
  }
  if(videoCandidates.length)videos.push({url:videoCandidates[0],alternatives:videoCandidates.slice(1,20)});
  return {title: String(title || document.title.replace(/\s*[-–|]\s*小红书.*$/, '') || '小红书笔记').slice(0,120), images: images.slice(0,100), videos: videos.slice(0,10), source, sourceUrl};
}

function allowedMedia(value) {
  try{const u=new URL(value);return u.protocol==='https:' && /(^|\.)(xhscdn\.(?:com|net)|xiaohongshu\.com)$/.test(u.hostname);}catch{return false;}
}
function mediaIdentity(value) {try{return new URL(value).pathname.split('!')[0];}catch{return '';}}
function normalizedNote(value) {
  const normalize=(list,max)=>Array.isArray(list)?list.filter(x=>x && allowedMedia(x.url)).slice(0,max).map(x=>({...x,alternatives:[...new Set((Array.isArray(x.alternatives)?x.alternatives:[]).filter(allowedMedia))].filter(u=>u!==x.url).slice(0,20)})):[];
  return {title:String(value?.title || '小红书笔记').slice(0,120),sourceUrl:value?.sourceUrl || '',images:normalize(value?.images,100),videos:normalize(value?.videos,10)};
}


function createSilentAdapter() {
  const tagged=new Map(),dragged=new Map();let identity='';
  function enableDrag(node){
    if(dragged.has(node))return;
    const record={old:node.getAttribute('draggable'),styles:new Map()};
    for(const [key,value] of [['-webkit-user-drag','element'],['user-select','auto']]){record.styles.set(key,{old:node.style.getPropertyValue(key),priority:node.style.getPropertyPriority(key),value});node.style.setProperty(key,value,'important');}
    node.setAttribute('draggable','true');dragged.set(node,record);
  }
  function restoreDrag(node,r){
    if(node.getAttribute('draggable')==='true'){if(r.old===null)node.removeAttribute('draggable');else node.setAttribute('draggable',r.old);}
    for(const [key,v] of r.styles)if(node.style.getPropertyValue(key)===v.value && node.style.getPropertyPriority(key)==='important'){if(v.old)node.style.setProperty(key,v.old,v.priority);else node.style.removeProperty(key);}
  }
  function restore(node,record){if(node.getAttribute('eagle-src')===record.value){if(record.old===null)node.removeAttribute('eagle-src');else node.setAttribute('eagle-src',record.old);}}
  function clear(){for(const [node,r] of tagged)restore(node,r);tagged.clear();for(const [node,r] of dragged)restoreDrag(node,r);dragged.clear();}
  function apply(note,detail,nextIdentity){
    if(nextIdentity!==identity){clear();identity=nextIdentity;}
    const wanted=new Map();
    if(detail){
      const lookup=new Map(note.images.map(x=>[mediaIdentity(x.url),x.url]));
      const imgs=Array.from(detail.querySelectorAll('img'));
      for(const img of imgs){const url=lookup.get(mediaIdentity(img.currentSrc || img.src));if(url)wanted.set(img,url);}
      const media=note.videos[0];
      if(media)for(const video of detail.querySelectorAll('video')){
        const native=video.currentSrc || video.src;
        const videoURL=allowedMedia(native) && /(?:\.mp4(?:[?#]|$)|\/stream\/)/i.test(native)?native:media.url;
        wanted.set(video,videoURL);
        // Only an existing, exact poster image is adapted; do not create proxy images or replace the player URL.
        if(video.poster)for(const img of imgs)if(mediaIdentity(img.currentSrc || img.src)===mediaIdentity(video.poster))wanted.set(img,videoURL);
      }
    }
    for(const [node,r] of tagged)if(!wanted.has(node)){restore(node,r);tagged.delete(node);}
    for(const [node,r] of dragged)if(!wanted.has(node)){restoreDrag(node,r);dragged.delete(node);}
    for(const [node,url] of wanted){
      if(!allowedMedia(url))continue;
      if(String(node.tagName).toLowerCase()==='img')enableDrag(node);
      let record=tagged.get(node);
      if(!record){record={old:node.getAttribute('eagle-src'),value:url};tagged.set(node,record);}
      else {if(node.getAttribute('eagle-src')!==record.value)record.old=node.getAttribute('eagle-src');record.value=url;}
      if(node.getAttribute('eagle-src')!==url)node.setAttribute('eagle-src',url);
    }
    return {images:note.images.length,videos:note.videos.length,adapted:wanted.size};
  }
  return {apply,clear};
}

function makeImportItems(note,kind,items) {
  const unique=new Map();
  for(const item of items){
    if(!allowedMedia(item.url) || /\.m3u8(?:[?#]|$)/i.test(item.url))continue;
    const index=(kind==='video'?note.videos:note.images).findIndex(x=>x.url===item.url)+1;
    unique.set(item.url,{url:item.url,name:`${note.title}_${kind==='video'?'视频':'图片'}_${String(index || unique.size+1).padStart(2,'0')}`,website:note.sourceUrl,headers:{referer:'https://www.xiaohongshu.com/'}});
  }
  return [...unique.values()];
}
function sendToEagle(items,request=GM_xmlhttpRequest,folderId='') {
  return new Promise((resolve,reject)=>{
    request({method:'POST',url:'http://localhost:41595/api/item/addFromURLs',headers:{'Content-Type':'application/json'},data:JSON.stringify({items,...(folderId?{folderId}:{})}),timeout:180000,anonymous:true,
      onload:r=>{try{const result=JSON.parse(r.responseText);if(r.status<200 || r.status>=300 || result.status!=='success')throw new Error('Eagle 未接受本次收藏，请检查资源库后重试。');resolve(items.length);}catch(e){reject(new Error(e instanceof SyntaxError?'Eagle 返回了无法识别的结果，请检查资源库。':e.message));}},
      onerror:()=>reject(new Error('连接失败，请先打开 Eagle 并载入资源库；若刚才已提交，请先检查是否入库。')),
      ontimeout:()=>reject(new Error('提交超时，结果未确认。请先在 Eagle 检查，避免重复收藏。')),
      onabort:()=>reject(new Error('提交中断，请先检查 Eagle 的收藏结果。'))
    });
  });
}
function eagleRequest(path,data,request=GM_xmlhttpRequest){
  const allowed=['/api/folder/list','/api/folder/create'];
  if(!allowed.includes(path))return Promise.reject(new Error('不支持的 Eagle 接口。'));
  return new Promise((resolve,reject)=>request({method:data===undefined?'GET':'POST',url:'http://localhost:41595'+path,headers:{'Content-Type':'application/json'},...(data===undefined?{}:{data:JSON.stringify(data)}),timeout:15000,anonymous:true,
    onload:r=>{try{const body=JSON.parse(r.responseText);if(r.status<200 || r.status>=300 || body.status!=='success')throw new Error('Eagle 未完成操作，请确认资源库已打开。');resolve(body.data);}catch(e){reject(new Error(e instanceof SyntaxError?'无法读取 Eagle 的返回结果。':e.message));}},
    onerror:()=>reject(new Error('无法连接 Eagle，请打开软件及资源库后重试。')),
    ontimeout:()=>reject(new Error(data?'创建结果未确认，请刷新列表查看，避免重复创建。':'读取文件夹超时，请重试。')),
    onabort:()=>reject(new Error('操作已中断，请刷新列表查看结果。'))
  }));
}
function flattenFolders(tree){
  if(!Array.isArray(tree))throw new Error('文件夹列表格式异常，请重试。');
  const result=[],seen=new Set();
  function walk(nodes,parents=[],depth=0){
    if(depth>30)return;
    for(const n of nodes){
      if(!n || typeof n.id!=='string' || !n.id || seen.has(n.id))continue;
      seen.add(n.id);const name=String(n.name || '未命名文件夹');const path=[...parents,name];
      result.push({id:n.id,name,path:path.join(' / '),depth});
      if(Array.isArray(n.children))walk(n.children,path,depth+1);
    }
  }
  walk(tree);return result;
}
async function validDestination(id,request=GM_xmlhttpRequest){
  const folders=flattenFolders(await eagleRequest('/api/folder/list',undefined,request));
  if(id && !folders.some(f=>f.id===id))throw new Error('该文件夹已被删除，或 Eagle 已切换资源库，请重新选择。');
  return folders;
}

function imageDataURL(buffer){
  const bytes=new Uint8Array(buffer);if(!bytes.length || bytes.length>8*1024*1024)throw new Error('图片体积不适合预取');
  const starts=(...values)=>values.every((v,i)=>bytes[i]===v);
  let mime='';
  if(starts(255,216,255))mime='image/jpeg';
  else if(starts(137,80,78,71,13,10,26,10))mime='image/png';
  else if(starts(71,73,70,56))mime='image/gif';
  else if(starts(82,73,70,70) && bytes[8]===87 && bytes[9]===69 && bytes[10]===66 && bytes[11]===80)mime='image/webp';
  else throw new Error('图片格式不适合预取');
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return 'data:'+mime+';base64,'+btoa(binary);
}
function prefetchImage(item,request=GM_xmlhttpRequest){
  return new Promise(resolve=>{
    if(!allowedMedia(item.url)){resolve(item);return;}
    let handle,settled=false;
    const finish=value=>{if(settled)return;settled=true;resolve(value);};
    try{handle=request({method:'GET',url:item.url,responseType:'arraybuffer',timeout:12000,anonymous:true,
      onprogress:e=>{if(e.loaded>8*1024*1024 || e.total>8*1024*1024){finish(item);handle?.abort?.();}},
      onload:r=>{try{if(r.status<200 || r.status>=300 || (r.finalUrl && !allowedMedia(r.finalUrl)))throw new Error();const {headers,...rest}=item;finish({...rest,url:imageDataURL(r.response)});}catch{finish(item);}},
      onerror:()=>finish(item),ontimeout:()=>finish(item),onabort:()=>finish(item)
    });}catch{finish(item);}
  });
}
async function importImageGroups(items,folderId,{request=GM_xmlhttpRequest,onProgress=()=>{},validate=()=>validDestination(folderId,request)}={}){
  let submitted=0,prefetched=0,fallback=0;
  // A maximum of 3 images are in memory; only one import request is active.
  for(let i=0;i<items.length;i+=3){
    onProgress({stage:'prepare',submitted,total:items.length});
    const prepared=await Promise.all(items.slice(i,i+3).map(item=>prefetchImage(item,request)));
    prefetched+=prepared.filter(x=>x.url.startsWith('data:')).length;fallback+=prepared.filter(x=>!x.url.startsWith('data:')).length;
    try{
      await validate();onProgress({stage:'submit',submitted,total:items.length});
      await sendToEagle(prepared,request,folderId);submitted+=prepared.length;
      onProgress({stage:'accepted',submitted,total:items.length});
    }catch(e){const err=new Error(`已确认提交 ${submitted}/${items.length} 张。${e.message} 请先检查 Eagle，避免重复收藏。`);err.submitted=submitted;throw err;}
  }
  return {submitted,prefetched,fallback};
}

function insideRect(x,y,rect,padding=0){return x>=rect.left-padding && x<=rect.right+padding && y>=rect.top-padding && y<=rect.bottom+padding;}
function upperLeftHit(x,y,rect,width,height){
  const visible={left:Math.max(0,rect.left),right:Math.min(width,rect.right),top:Math.max(0,rect.top),bottom:Math.min(height,rect.bottom)};
  if(visible.right<=visible.left || visible.bottom<=visible.top)return false;
  return insideRect(x,y,{left:visible.left,right:Math.min(visible.right,visible.left+240),top:visible.top,bottom:Math.min(visible.bottom,visible.top+110)});
}

const HOST='eagle-xhs-collect';
if(document.getElementById(HOST))return;
const host=document.createElement('div');host.id=HOST;host.hidden=true;
host.style.cssText='position:fixed;z-index:2147483000;display:none;pointer-events:none';
const shadow=host.attachShadow({mode:'open'});
const css=document.createElement('style');css.textContent=`
:host{font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#fff;color-scheme:dark;--panel:rgba(38,38,38,.84);--bar:rgba(32,34,32,.82)}
*{box-sizing:border-box} [hidden]{display:none!important}
.wrap{position:relative;opacity:0;visibility:hidden;transform:translateY(-5px);pointer-events:none;transition:opacity 180ms ease-out,transform 180ms ease-out,visibility 0s linear 180ms}:host([data-reveal="true"]) .wrap{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto;transition-delay:0s}@media(prefers-reduced-motion:reduce){.wrap{transition:none;transform:none}} .bar{display:flex;background:var(--bar);border-radius:22px;box-shadow:0 4px 16px #0005;overflow:hidden}
button{appearance:none;border:0;font:inherit;color:inherit;cursor:pointer;background:transparent;white-space:nowrap;touch-action:manipulation}
button:hover{background:#ffffff14}button:disabled{cursor:wait;color:#bcbcbc}button:focus-visible{outline:2px solid #fff;outline-offset:-4px}
.main{height:36px;padding:0 9px 0 13px;display:flex;gap:7px;align-items:center;font-weight:600}.toggle{height:36px;width:30px;display:grid;place-items:center;border-left:1px solid #ffffff19}
svg{width:16px;height:16px;flex-shrink:0}.toggle svg{width:12px;height:12px}
.bar,.menu,.picker,.status{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.menu{position:absolute;left:0;top:44px;min-width:232px;overflow:auto;padding:5px;background:var(--panel);border-radius:10px;box-shadow:0 6px 22px #0006;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-6px) scale(.98);transform-origin:top left;transition:opacity 160ms ease-out,transform 160ms ease-out,visibility 0s linear 160ms}.menu[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);transition-delay:0s}.toggle svg{transition:transform 160ms ease-out}.toggle[aria-expanded="true"] svg{transform:rotate(180deg)}@media(prefers-reduced-motion:reduce){.menu,.toggle svg{transition:none}.menu{transform:none}}
.menu button{width:100%;display:flex;justify-content:space-between;gap:20px;align-items:center;text-align:left;padding:9px 11px;border-radius:6px}
.count{color:#c7c7c7;font-size:12px;font-variant-numeric:tabular-nums}.status{position:absolute;left:0;top:44px;width:max-content;max-width:min(290px,calc(100vw - 32px));padding:9px 12px;border-radius:8px;background:var(--panel);box-shadow:0 4px 16px #0005;white-space:normal;overflow-wrap:anywhere;user-select:text}
`;
const wrap=document.createElement('div');wrap.className='wrap';
wrap.innerHTML=`<div class="menu" id="collect-menu" hidden role="group" aria-label="选择收藏范围"><button type="button" data-action="images">收藏全部图片<span class="count"></span></button><button type="button" data-action="videos">收藏视频<span class="count"></span></button></div><div class="status" hidden role="status" aria-live="polite"></div><div class="bar"><button type="button" class="main" title="收藏当前显示的图片或视频到 Eagle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v5M6 3v18h6M15 3v5h4M15 17h7m-3.5-3.5L22 17l-3.5 3.5"/></svg><span>收藏到 Eagle</span></button><button type="button" class="toggle" aria-label="更多收藏选项" aria-expanded="false" aria-controls="collect-menu"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button></div>`;
const folderCSS=document.createElement('style');folderCSS.textContent=`
.menu .destination{display:flex;justify-content:flex-start;gap:9px;width:100%;max-width:286px;border-radius:0;border-top:1px solid #ffffff20;margin-top:5px;padding-top:12px}.destination-copy{min-width:0}.destination-copy span,.destination-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.destination-copy small{font-size:11px;font-weight:400;color:#ddd;margin-top:3px}.destination-copy small:empty{display:none}
.picker{position:absolute;left:0;top:44px;width:min(304px,calc(100vw - 24px));max-height:calc(100vh - 120px);overflow:auto;background:var(--panel);border-radius:14px;box-shadow:0 6px 22px #0006;padding:14px;color:#fff;scrollbar-width:thin;scrollbar-color:#666 #252525}
.picker header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.picker h2{font-size:14px;margin:0;font-weight:600}.picker .close{width:28px;height:28px;display:grid;place-items:center;border-radius:6px;color:#ddd}.picker .close svg{width:14px;height:14px}
.picker input,.picker select{width:100%;background:#ffffff0f;border:1px solid #ffffff29;border-radius:6px;padding:8px 9px;color:#fff;font:inherit;outline-offset:2px;caret-color:#fff}.picker input::placeholder{color:#bbb;opacity:1}.picker input:focus-visible,.picker select:focus-visible{outline:2px solid #eee}
.picker .folders{margin:10px -5px;max-height:210px;overflow:auto;scrollbar-width:thin;scrollbar-color:#666 #252525}.picker .folder{display:flex;align-items:center;gap:8px;min-height:36px;width:100%;text-align:left;padding:7px 9px;border-radius:6px}.picker .folder span{white-space:normal;overflow-wrap:anywhere}.picker .folder[aria-pressed=true]{background:#ffffff1a}.picker .folder span{flex:1}.picker .folder .selected-mark{flex:0 0 14px;width:14px;height:14px;display:flex}.picker .folder svg{width:17px;height:17px}
.picker .hint:empty{display:none}.picker .reload{margin-bottom:8px;padding:6px 9px;border-radius:6px;background:#ffffff14}.picker .hint{font-size:12px;line-height:1.6;color:#ddd;margin:8px 0;white-space:normal;overflow-wrap:anywhere}.picker .create-open{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border-top:1px solid #ffffff20;padding:10px 4px}.picker .create-form{padding:4px 0}.picker label{display:block;font-size:12px;color:#ddd;margin:6px 0 4px}.picker .row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}.picker .row button{padding:7px 12px;border-radius:6px;background:#3d3d3d}.picker > .row{margin-top:16px}.picker > .row .confirm{width:100%;min-height:36px}.picker .row .confirm{background:#f0f0f0;color:#202020;font-weight:600}.picker button:disabled{opacity:.55;cursor:default}.picker ::selection{background:#ddd;color:#111}
`;
const folderIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5h6l2 2h10v13H3Z"/></svg>';
const destination=document.createElement('button');destination.type='button';destination.className='destination';destination.innerHTML=folderIcon+'<span class="destination-copy"><span>选择文件夹</span><small></small></span>';wrap.querySelector('.menu').append(destination);
const picker=document.createElement('section');picker.className='picker';picker.hidden=true;picker.setAttribute('aria-label','选择 Eagle 文件夹');
picker.innerHTML=`<header><h2>存入 Eagle</h2><button type="button" class="close" aria-label="关闭文件夹选择"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg></button></header><input class="search" type="search" placeholder="搜索文件夹" aria-label="搜索 Eagle 文件夹"><div class="folders" role="group" aria-label="Eagle 文件夹列表"></div><p class="hint" role="status" aria-live="polite"></p><button type="button" class="reload" hidden>重试</button><button type="button" class="create-open">${folderIcon}新建文件夹</button><form class="create-form" hidden><label for="folder-name">文件夹名称</label><input id="folder-name" maxlength="120" required autocomplete="off"><label for="folder-parent">建立位置</label><select id="folder-parent" aria-label="新文件夹的父文件夹"></select><div class="row"><button type="button" class="create-cancel">取消新建</button><button type="submit">创建并选中</button></div></form><div class="row"><button type="button" class="confirm">存入此文件夹</button></div>`;
wrap.prepend(picker);shadow.append(folderCSS);
shadow.append(css,wrap);document.body.append(host);
const main=shadow.querySelector('.main'),label=main.querySelector('span'),toggle=shadow.querySelector('.toggle'),menu=shadow.querySelector('.menu'),status=shadow.querySelector('.status');
const buttons=[main,toggle,...menu.querySelectorAll('button')];
let menuOpen=false;menu.hidden=false;menu.dataset.open='false';menu.inert=true;menu.setAttribute('aria-hidden','true');
let busy=false,stopped=false,timer,hideTimer,detail=null,anchor=null,note=null,route='',resultRoute='',raf=0;
const adapter=createSilentAdapter();
function setMenu(open){if(open)closePicker();menuOpen=Boolean(open);menu.dataset.open=String(menuOpen);menu.inert=!menuOpen;menu.setAttribute('aria-hidden',String(!menuOpen));toggle.setAttribute('aria-expanded',String(menuOpen));if(menuOpen)status.hidden=true;}
function message(text){clearTimeout(hideTimer);status.textContent=text;status.hidden=false;hideTimer=setTimeout(()=>{status.hidden=true;},10000);}
function rectArea(el){const r=el.getBoundingClientRect();return Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));}
function currentImage(){
  if(note.images.length===1)return note.images[0];
  const lookup=new Map(note.images.map(x=>[mediaIdentity(x.url),x]));
  let best=null,bestArea=0;
  for(const el of anchor.querySelectorAll('img,.swiper-slide,.note-image')){
    if(getComputedStyle(el).visibility==='hidden' || getComputedStyle(el).display==='none')continue;
    const source=el.currentSrc || el.src || getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    const item=lookup.get(mediaIdentity(source));if(!item)continue;
    const r=el.getBoundingClientRect(),aRect=anchor.getBoundingClientRect();
    const a=Math.max(0,Math.min(r.right,aRect.right,innerWidth)-Math.max(r.left,aRect.left,0))*Math.max(0,Math.min(r.bottom,aRect.bottom,innerHeight)-Math.max(r.top,aRect.top,0));
    if(a>bestArea){bestArea=a;best=item;}
  }
  return best;
}
function position(){
  raf=0;if(!anchor || host.hidden)return;
  const r=anchor.getBoundingClientRect();
  if(r.width<80 || r.bottom<80 || r.top>innerHeight){host.style.display='none';return;}
  host.style.display='block';
  host.style.left=Math.max(12,Math.min(r.left+12,innerWidth-Math.min(322,innerWidth)))+'px';
  // Anchor at the visible top-left; panels open downward, clear of the video timeline.
  const top=Math.max(12,Math.min(r.top+12,innerHeight-160));host.style.top=top+'px';
  const available=Math.max(100,innerHeight-top-56)+'px';picker.style.maxHeight=available;menu.style.maxHeight=available;
  updateHover();
}
function queuePosition(){if(!raf)raf=requestAnimationFrame(position);}
function read(){
  const roots=[...document.querySelectorAll('#noteContainer,.note-detail-mask .note-container,.note-container')].filter(x=>rectArea(x)>0);
  const found=roots.find(x=>x.closest('.note-detail-mask')) || roots[0];
  if(!found)return null;
  const area=[...found.querySelectorAll('.media-container,.note-slider,.slider-container,.swiper,video')].filter(x=>rectArea(x)>0).sort((a,b)=>rectArea(b)-rectArea(a))[0];
  if(!area)return null;
  return {detail:found,anchor:area,note:normalizedNote(extractNote(found))};
}
function refresh(){
  if(stopped)return;
  try{
    const state=read();
    if(!state || (!state.note.images.length && !state.note.videos.length)){host.hidden=true;host.style.display='none';adapter.clear();return;}
    detail=state.detail;anchor=state.anchor;note=state.note;
    const next=note.sourceUrl || location.href;
    if(route!==next){route=next;host.dataset.reveal='false';closePicker();setMenu(false);status.hidden=true;resultRoute='';}
    if(!busy)label.textContent=resultRoute===route?'已提交到 Eagle':'收藏到 Eagle';
    const imageButton=menu.querySelector('[data-action=images]');imageButton.hidden=!note.images.length;imageButton.querySelector('.count').textContent=`${note.images.length} 张`;
    const videoButton=menu.querySelector('[data-action=videos]');videoButton.hidden=!note.videos.length;videoButton.querySelector('.count').textContent=`${note.videos.length} 个`;
    adapter.apply(note,detail,route);host.hidden=false;position();
  }catch{host.hidden=true;host.style.display='none';adapter.clear();}
}
async function collect(action){
  if(busy)return;
  refresh();if(host.hidden)return;
  setMenu(false);status.hidden=true;
  const snapshot={...note,images:[...note.images],videos:[...note.videos]},taskRoute=route;
  const kind=action==='videos' || (action==='current' && snapshot.videos.length)?'video':'image';
  let selected=action==='current'?(kind==='video'?snapshot.videos.slice(0,1):[currentImage()].filter(Boolean)):(kind==='video'?snapshot.videos:snapshot.images);
  if(!selected.length){message('无法确定当前素材，请展开菜单选择收藏全部图片。');return;}
  const items=makeImportItems(snapshot,kind,selected);
  if(!items.length){message('未找到可收藏的直链，请播放视频或刷新笔记后再试。');return;}
  openPicker({items,kind,taskRoute});
}
let folders=[],chosenId='',folderLoading=false,folderEpoch=0,pending=null;
const search=picker.querySelector('.search'),folderList=picker.querySelector('.folders'),folderHint=picker.querySelector('.hint'),confirmFolder=picker.querySelector('.confirm'),createForm=picker.querySelector('form'),parentSelect=picker.querySelector('select'),nameInput=picker.querySelector('#folder-name');
function pickerLock(locked){folderLoading=locked;picker.querySelectorAll('button,input,select').forEach(b=>b.disabled=locked);}
function closePicker(){if(folderLoading || busy)return;editingNode=null;composing=false;picker.hidden=true;pending=null;folderEpoch++;}
function renderFolders(){
  folderList.replaceChildren();const query=search.value.trim().toLocaleLowerCase();
  const rows=[{id:'',name:'资源库（不指定文件夹）',path:'资源库（不指定文件夹）',depth:0},...folders];
  let visible=0;
  for(const folder of rows){
    if(query && !folder.path.toLocaleLowerCase().includes(query))continue;
    visible++;const b=document.createElement('button');b.type='button';b.className='folder';b.setAttribute('aria-pressed',String(folder.id===chosenId));b.title=folder.path;
    b.innerHTML=folderIcon;const text=document.createElement('span');text.textContent=folder.path;b.append(text);if(folder.id===chosenId){const mark=document.createElement('span');mark.className='selected-mark';mark.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';b.append(mark);}
    b.addEventListener('click',()=>{chosenId=folder.id;renderFolders();folderList.querySelector('[aria-pressed="true"]')?.focus();folderHint.textContent='';});folderList.append(b);
  }
  if(!visible){const p=document.createElement('p');p.className='hint';p.textContent='没有匹配的文件夹';folderList.append(p);}
}
async function loadFolders(){
  const epoch=++folderEpoch;picker.querySelector('.reload').hidden=true;pickerLock(true);folderHint.textContent='正在读取 Eagle 文件夹…';
  try{
    const fresh=flattenFolders(await eagleRequest('/api/folder/list'));
    if(epoch!==folderEpoch)return;
    folders=fresh;
    if(chosenId && !folders.some(f=>f.id===chosenId)){chosenId='';folderHint.textContent='上次文件夹不可用，请重新选择。';}else folderHint.textContent=folders.length?'':'资源库暂无文件夹，可以新建。';
    renderFolders();confirmFolder.disabled=false;
  }catch(e){if(epoch===folderEpoch){folderHint.textContent=e.message;folderList.replaceChildren();picker.querySelector('.reload').hidden=false;}}
  finally{if(epoch===folderEpoch){pickerLock(false);confirmFolder.disabled=!folderList.childElementCount;}}
}
function openPicker(task){
  if(busy || folderLoading)return;pending=task;setMenu(false);status.hidden=true;picker.hidden=false;createForm.hidden=true;search.value='';confirmFolder.textContent=task?'存入此文件夹':'使用此文件夹';loadFolders().then(()=>{if(!picker.hidden)search.focus();});
}
destination.addEventListener('click',()=>openPicker(null));
search.addEventListener('input',renderFolders);
picker.querySelector('.reload').addEventListener('click',loadFolders);
picker.querySelector('.close').addEventListener('click',()=>{closePicker();toggle.focus();});
picker.querySelector('.create-open').addEventListener('click',()=>{
  createForm.hidden=!createForm.hidden;if(createForm.hidden)return;
  parentSelect.replaceChildren();for(const f of [{id:'',path:'资源库根目录'},...folders]){const opt=document.createElement('option');opt.value=f.id;opt.textContent=f.path;parentSelect.append(opt);}parentSelect.value=chosenId;nameInput.value='';nameInput.focus();
});
picker.querySelector('.create-cancel').addEventListener('click',()=>{createForm.hidden=true;});
createForm.addEventListener('submit',async e=>{
  e.preventDefault();if(folderLoading || busy)return;
  const name=nameInput.value.trim(),parent=parentSelect.value;
  if(!name){folderHint.textContent='请输入文件夹名称。';nameInput.focus();return;}
  pickerLock(true);folderHint.textContent='正在创建文件夹…';
  try{
    await validDestination(parent);
    const created=await eagleRequest('/api/folder/create',{folderName:name,...(parent?{parent}:{})});
    if(typeof created?.id!=='string' || !created.id)throw new Error('创建结果未确认，请刷新文件夹列表查看。');
    chosenId=created.id;createForm.hidden=true;pickerLock(false);await loadFolders();
    if(folders.some(f=>f.id===created.id))folderHint.textContent='已创建并选中：'+name;
  }catch(e){folderHint.textContent=e.message;}
  finally{pickerLock(false);confirmFolder.disabled=!folderList.childElementCount;}
});
confirmFolder.addEventListener('click',async()=>{
  if(folderLoading || busy)return;
  const task=pending,targetId=chosenId,targetName=folders.find(f=>f.id===targetId)?.path || '资源库';
  pickerLock(true);folderHint.textContent='正在确认存放位置…';
  try{
    await validDestination(targetId);
    if(!task){destination.querySelector('small').textContent='上次使用：'+targetName;destination.title=targetName;pickerLock(false);closePicker();return;}
    refresh();
    if(host.hidden || route!==task.taskRoute)throw new Error('笔记已切换，请重新选择要收藏的素材。');
    busy=true;buttons.forEach(b=>b.disabled=true);label.textContent='正在提交…';
    if(task.kind==='image'){
      await importImageGroups(task.items,targetId,{onProgress:p=>{label.textContent=p.stage==='prepare'?`准备图片 ${p.submitted}/${p.total}`:`提交图片 ${p.submitted}/${p.total}`;folderHint.textContent=p.stage==='prepare'?`正在准备 ${p.submitted}/${p.total}`:`正在交给 Eagle，已提交 ${p.submitted}/${p.total}`;},validate:async()=>{refresh();if(host.hidden || route!==task.taskRoute)throw new Error('笔记已切换，已停止后续提交。');await validDestination(targetId);}});
    }else await sendToEagle(task.items,GM_xmlhttpRequest,targetId);
    if(route===task.taskRoute){resultRoute=route;label.textContent='已提交到 Eagle';message(`已提交 ${task.items.length} ${task.kind==='video'?'个视频':'张图片'}至「${targetName}」，请在 Eagle 查看结果。`);}
    picker.hidden=true;pending=null;destination.querySelector('small').textContent='上次使用：'+targetName;destination.title=targetName;
  }catch(e){folderHint.textContent=e.message;label.textContent='收藏到 Eagle';}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);pickerLock(false);}
});
main.addEventListener('click',()=>collect('current'));
toggle.addEventListener('click',()=>{if(folderLoading || busy)return;refresh();setMenu(!menuOpen);if(menuOpen)menu.querySelector('button:not([hidden])')?.focus();});
for(const b of menu.querySelectorAll('button[data-action]'))b.addEventListener('click',()=>collect(b.dataset.action));
// Only stop clicks inside our own button surface, leaving the page and Eagle's gestures alone.
for(const event of ['click','pointerdown','mousedown','dblclick'])host.addEventListener(event,e=>e.stopPropagation());
document.addEventListener('pointerdown',e=>{if(!e.composedPath().includes(host)){editingNode=null;composing=false;setMenu(false);closePicker();updateHover();}},true);
shadow.addEventListener('keydown',e=>{if(e.key==='Escape' && !e.isComposing && !composing && e.keyCode!==229){editingNode=null;closePicker();setMenu(false);status.hidden=true;toggle.focus();e.stopPropagation();}});
function schedule(){clearTimeout(timer);timer=setTimeout(refresh,180);}
const observer=new MutationObserver(records=>{if(records.some(r=>!host.contains(r.target)))schedule();});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset','poster','class']});
let pointer={x:-1,y:-1},leaveTimer,fadeCleanup,keyboardMode=false,editingNode=null,composing=false;
const touchOnly=window.matchMedia('(hover: none)').matches;
function revealSurface(){
  clearTimeout(leaveTimer);leaveTimer=undefined;clearTimeout(fadeCleanup);
  if(host.dataset.reveal==='true')return;
  host.dataset.reveal='true';
}
function concealSurface(){
  if(!picker.hidden || editingFocused()){revealSurface();return;}
  clearTimeout(leaveTimer);leaveTimer=undefined;host.dataset.reveal='false';
  fadeCleanup=setTimeout(()=>{if(host.dataset.reveal!=='true'){setMenu(false);closePicker();status.hidden=true;}},180);
}
function updateHover(){
  if(host.hidden || !anchor)return;
  if(touchOnly){revealSurface();return;}
  const inCorner=upperLeftHit(pointer.x,pointer.y,anchor.getBoundingClientRect(),innerWidth,innerHeight);
  const onSurface=host.dataset.reveal==='true' && [wrap,...(menuOpen?[menu]:[]),...[picker,status].filter(x=>!x.hidden)].some(el=>insideRect(pointer.x,pointer.y,el.getBoundingClientRect(),8));
  const keyboardFocus=(keyboardMode && !!shadow.activeElement) || editingFocused();
  if(inCorner || onSurface || keyboardFocus || !picker.hidden)revealSurface();
  else if(host.dataset.reveal==='true' && !leaveTimer){leaveTimer=setTimeout(()=>{leaveTimer=undefined;concealSurface();},100);}
}
function trackPointer(e){keyboardMode=false;pointer={x:e.clientX,y:e.clientY};updateHover();}
function trackKeys(e){if(e.key==='Tab'){keyboardMode=true;updateHover();}}
function editingFocused(){return !picker.hidden && editingNode!==null && (shadow.activeElement===editingNode || composing) && !editingNode.disabled;}
function beginEditing(e){
  const target=e.composedPath()[0];
  if(picker.hidden || !picker.contains(target) || !target.matches('input:not([type=checkbox]),textarea'))return;
  editingNode=target;revealSurface();
}
shadow.addEventListener('beforeinput',beginEditing);
shadow.addEventListener('input',beginEditing);
shadow.addEventListener('compositionstart',e=>{composing=true;beginEditing(e);});
shadow.addEventListener('compositionend',()=>{composing=false;updateHover();});
shadow.addEventListener('keydown',e=>{if(e.key!=='Escape' && e.key!=='Tab')beginEditing(e);},true);
shadow.addEventListener('focusout',()=>{queueMicrotask(()=>{if(!editingFocused()){editingNode=null;composing=false;updateHover();}});});
function leavePage(){pointer={x:-1,y:-1};keyboardMode=false;concealSurface();}
document.addEventListener('pointermove',trackPointer,{passive:true});
document.addEventListener('keydown',trackKeys,true);
document.documentElement.addEventListener('pointerleave',leavePage);
window.addEventListener('blur',leavePage);
window.addEventListener('scroll',queuePosition,true);window.addEventListener('resize',queuePosition);
const poll=setInterval(refresh,1000);
window.addEventListener('pagehide',()=>{stopped=true;observer.disconnect();clearInterval(poll);clearTimeout(timer);clearTimeout(hideTimer);cancelAnimationFrame(raf);adapter.clear();clearTimeout(leaveTimer);leaveTimer=undefined;clearTimeout(fadeCleanup);document.removeEventListener('pointermove',trackPointer);document.removeEventListener('keydown',trackKeys,true);document.documentElement.removeEventListener('pointerleave',leavePage);window.removeEventListener('blur',leavePage);host.remove();window.removeEventListener('scroll',queuePosition,true);window.removeEventListener('resize',queuePosition);},{once:true});
refresh();

})();
