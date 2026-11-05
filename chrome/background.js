importScripts('media.js');
let starting=false,creating;
const getJob=async()=> (await chrome.storage.session.get('job')).job || null;
async function ensureWorker(){
  if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]})).length)return;
  if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'选择一次文件夹后，在后台将图片转 JPG 并直接写入独立文件。'}).finally(()=>creating=null);
  await creating;
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || m.target==='offscreen')return;
  const popup=sender.url===chrome.runtime.getURL('popup.html'),worker=sender.url===chrome.runtime.getURL('offscreen.html');
  (async()=>{
    if(popup && m.type==='job-status')return {job:await getJob()};
    if(worker && m.type==='progress'){
      const job=await getJob();if(job?.id===m.id)await chrome.storage.session.set({job:{...job,...m.patch}});return {ok:true};
    }
    if(!popup || m.type!=='start')throw new Error('不支持的请求');
    if(starting)throw new Error('保存任务正在启动');starting=true;
    try{
      const old=await getJob();if(old?.state==='running')throw new Error('上一批素材仍在保存，请等待完成');
      if(!Array.isArray(m.items)||!m.items.length||m.items.length>110||m.items.some(x=>!Media.allowed(x.url)||!['image','video'].includes(x.kind)||(x.alternatives && (!Array.isArray(x.alternatives)||x.alternatives.length>20||x.alternatives.some(u=>!Media.allowed(u)))))||!/^[a-f0-9-]{36}$/.test(m.folderKey))throw new Error('素材或文件夹参数无效，请重试');
      await ensureWorker();
      const job={id:crypto.randomUUID(),title:String(m.title||'小红书笔记').slice(0,120),createNoteFolder:m.createNoteFolder!==false,createReport:m.createReport!==false,sourceUrl:typeof m.sourceUrl==='string' && /^https:\/\/(?:www\.)?xiaohongshu\.com\//i.test(m.sourceUrl)?m.sourceUrl.slice(0,8192):'',total:m.items.length,done:0,failed:0,errors:[],state:'running',current:'准备保存'};
      await chrome.storage.session.set({job});
      try{const r=await chrome.runtime.sendMessage({target:'offscreen',type:'run',job,items:m.items,folderKey:m.folderKey});if(!r?.accepted)throw new Error('保存器未能启动');}
      catch(e){await chrome.storage.session.set({job:{...job,state:'finished',failed:job.total,errors:[e.message]}});throw e;}
      return {job};
    }finally{starting=false;}
  })().then(respond).catch(e=>respond({error:e.message||'保存失败'}));return true;
});
