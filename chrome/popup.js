const $=id=>document.getElementById(id);
let note={title:'',images:[],videos:[]},selected=new Set(),job=null,loading=false;
let videoPreviews=[];
const pausePreviews=()=>videoPreviews.forEach(preview=>preview.pause());
window.addEventListener('blur',pausePreviews);window.addEventListener('pagehide',pausePreviews);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePreviews();});
const items=()=>[...note.images.map((x,i)=>({...x,kind:'image',key:'image-'+i})),...note.videos.map((x,i)=>({...x,kind:'video',key:'video-'+i}))];
const status=text=>{$('status').textContent=text;$('status').hidden=!text;};
const busy=()=>loading || ['running','waiting'].includes(job?.state);
async function request(message) {const r=await chrome.runtime.sendMessage(message);if (r?.error) throw new Error(r.error);return r;}
function update() {
  const total=items().length;
  $('count').textContent=`已选 ${selected.size} / ${total} 项`;
  $('all').checked=total>0 && selected.size===total;$('all').indeterminate=selected.size>0 && selected.size<total;
  $('saveAll').disabled=busy() || !selected.size;$('scan').disabled=busy();$('organize').disabled=busy();$('createReport').disabled=busy();
  $('all').disabled=busy();document.querySelectorAll('.media-check').forEach(c=>c.disabled=busy());
  if (job) {
    $('job').hidden=false;
    $('progress').textContent=['running','waiting'].includes(job.state)?`${job.current} · 已保存 ${job.done}/${job.total}${job.failed?`，失败 ${job.failed}`:''}`:`保存完成 · 成功 ${job.done}，失败 ${job.failed}`;
    $('errorDetails').hidden=!job.errors?.length;$('errors').replaceChildren();
    for(const error of job.errors || []) {const li=document.createElement('li');li.textContent=error;$('errors').append(li);}
  }
}
function checkbox(key,labelText) {
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.className='media-check';check.dataset.key=key;check.checked=selected.has(key);check.setAttribute('aria-label',labelText);
  check.onchange=()=>{check.checked?selected.add(key):selected.delete(key);update();};label.append(check);return label;
}
function render() {
  videoPreviews.forEach(preview=>preview.destroy());videoPreviews=[];
  $('grid').replaceChildren();$('videos').replaceChildren();$('title').textContent=note.title;
  note.images.forEach((item,i)=>{
    const tile=document.createElement('div');tile.className='tile';
    const img=document.createElement('img');img.src=item.url;img.alt=`笔记图片 ${i+1}`;img.referrerPolicy='no-referrer';
    const meta=document.createElement('div');meta.className='meta';meta.textContent=`${String(i+1).padStart(2,'0')} · JPG`;
    img.onerror=()=>{meta.textContent=`${i+1} · 预览失败，保存时重试读取`;};tile.append(img,checkbox('image-'+i,`选择图片 ${i+1}`),meta);$('grid').append(tile);
  });
  note.videos.forEach((item,i)=>{
    const tile=document.createElement('div');tile.className='tile video-tile';
    const frame=document.createElement('div');frame.className='preview-frame';frame.tabIndex=0;frame.setAttribute('role','button');frame.setAttribute('aria-label',`预览视频 ${i+1}，悬停播放，移出暂停；回车或空格切换播放`);
    const video=document.createElement('video');video.setAttribute('aria-label',`笔记视频 ${i+1}`);
    const indicator=document.createElement('span');indicator.className='play-indicator';indicator.setAttribute('aria-hidden','true');indicator.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="m9 5 11 7-11 7z"/></svg>';
    const meta=document.createElement('div');meta.className='meta';meta.textContent=`${String(i+1).padStart(2,'0')} · MP4`;
    frame.append(video,indicator);tile.append(frame,checkbox('video-'+i,`选择视频 ${i+1}`),meta);$('videos').append(tile);
    videoPreviews.push(bindVideoPreview(frame,video,[item.url,...(item.alternatives || [])],state=>{
      meta.textContent=state==='error'?`${i+1} · 预览不可用，可尝试保存`:`${String(i+1).padStart(2,'0')} · MP4`;
    }));
  });
  $('imageHeading').textContent=`图片 · ${note.images.length} 张`;$('videoHeading').textContent=`视频 · ${note.videos.length} 个`;
  $('imageHeading').hidden=!note.images.length;$('videoHeading').hidden=!note.videos.length;
  $('results').hidden=!items().length;$('empty').hidden=!!items().length;update();
}
async function scan() {
  loading=true;update();status('正在读取当前笔记的图片与视频…');note={title:'',images:[],videos:[]};selected.clear();render();
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https:\/\/(?:www\.)?xiaohongshu\.com\//i.test(tab.url || '')) throw new Error('请先在当前标签页打开小红书笔记详情。');
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:extractNote});
    const data=result?.result;
    if (!data || !(data.images?.length || data.videos?.length)) throw new Error('未找到可保存的素材。请打开笔记详情，等待图片加载或播放视频后重试。');
    note={...data,images:data.images || [],videos:data.videos || []};selected=new Set(items().map(x=>x.key));render();status('');return true;
  } catch(e) {status(e.message || '提取失败，请刷新笔记后重试。');return false;}
  finally {loading=false;update();}
}
async function save(list) {
  if(busy() || !list.length)return;
  const createNoteFolder=$('organize').checked,createReport=$('createReport').checked;loading=true;update();let folderKey;
  try {
    if(!window.showDirectoryPicker)throw new Error('请使用支持系统文件夹选择器的桌面 Chrome');
    // Must be the first awaited call in this click handler: native picker needs user activation.
    const directory=await window.showDirectoryPicker({id:'shitu-save',mode:'readwrite'});
    folderKey=crypto.randomUUID();await FolderStore.access(folderKey,directory);
    status('已选择文件夹，正在开始批量保存…');
    const r=await request({type:'start',title:note.title,createNoteFolder,createReport,sourceUrl:note.sourceUrl || '',folderKey,items:list.map(({url,kind,alternatives})=>({url,kind,alternatives:kind==='video'?alternatives:undefined}))});job=r.job;
    status(`正在保存到「${directory.name}」，可关闭弹窗继续浏览。`);
  }catch(e){if(folderKey)await FolderStore.access(folderKey,null,true).catch(()=>{});status(e.name==='AbortError'?'已取消选择文件夹，未保存文件。':e.message);}
  finally{loading=false;update();}
}
$('saveAll').onclick=()=>save(items().filter(x=>selected.has(x.key)));
$('scan').onclick=()=>scan();
$('all').onchange=()=>{selected=$('all').checked?new Set(items().map(x=>x.key)):new Set();document.querySelectorAll('.media-check').forEach(c=>c.checked=selected.has(c.dataset.key));update();};
const savePreferences=()=>{chrome.storage.local.set({createNoteFolder:$('organize').checked,createReport:$('createReport').checked}).catch(()=>{});};
$('organize').onchange=savePreferences;$('createReport').onchange=savePreferences;
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session' && changes.job){job=changes.job.newValue;update();}});
(async()=>{try{const preference=await chrome.storage.local.get(['createNoteFolder','createReport']);$('organize').checked=preference.createNoteFolder!==false;$('createReport').checked=(preference.createReport ?? preference.createNoteFolder)!==false;job=(await request({type:'job-status'})).job;update();if(!busy())await scan();}catch(e){status(e.message);}})();
