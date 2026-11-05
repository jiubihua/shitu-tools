let active=false;
const send=async m=>{const r=await chrome.runtime.sendMessage(m);if(r?.error)throw new Error(r.error);return r;};
async function run(job,items,folderKey){
  let done=0,failed=0,noteDirectory,records=[],reportError='';const errors=[],counts={image:0,video:0};
  const updateReport=async finished=>{
    if(job.createReport===false)return;
    try{await Report.write(noteDirectory,Report.text(job,records,done,failed,errors,finished));reportError='';}
    catch(e){reportError=`来源与图片清单.txt 写入失败：${e.message}`;}
  };
  const progress=patch=>send({type:'progress',id:job.id,patch});
  try{
    const directory=await FolderStore.access(folderKey);await FolderStore.access(folderKey,null,true);
    if(!directory || await directory.queryPermission({mode:'readwrite'})!=='granted')throw new Error('文件夹写入授权不可用，请点击保存并重新选择文件夹');
    noteDirectory=job.createNoteFolder===false?directory:await directory.getDirectoryHandle(Media.folder(job.title),{create:true});
    if(job.createReport!==false){records=await Report.inventory(noteDirectory);await updateReport(false);}
    for(const item of items){
      const index=++counts[item.kind],label=`${item.kind==='image'?'图片':'视频'} ${index}`;
      await progress({current:`正在保存${label}`,done,failed,folder:job.createNoteFolder===false?directory.name:`${directory.name}/${noteDirectory.name}`});
      try{const record=await writeMedia(noteDirectory,item,index);records.push(record);done++;}
      catch(e){failed++;errors.push(`${label}：${e.name==='AbortError'?'读取超时':e.message}`);}
      await updateReport(false);
      await progress({done,failed,errors:reportError?[...errors,reportError]:errors});
    }
  }catch(e){failed=items.length-done;errors.push(e.message);}
  finally{if(noteDirectory)await updateReport(true);active=false;await progress({state:'finished',current:'保存结束',done,failed,errors:reportError?[...errors,reportError]:errors}).catch(()=>{});}
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || m.target!=='offscreen' || m.type!=='run')return;
  if(active){respond({accepted:false});return;}
  active=true;respond({accepted:true});void run(m.job,m.items,m.folderKey);
});
