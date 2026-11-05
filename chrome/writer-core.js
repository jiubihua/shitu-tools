async function uniqueFile(directory,base,extension) {
  for(let i=0;i<10000;i++) {
    const name=`${base}${i?` (${i})`:''}.${extension}`;
    try {await directory.getFileHandle(name);}
    catch(e){if(e.name==='NotFoundError')return {name,handle:await directory.getFileHandle(name,{create:true})};throw e;}
  }
  throw new Error('同名文件过多，请换一个目录');
}
async function writeMedia(directory,item,index) {
  const dimensions={};let blob,lastError;
  const urls=[item.url,...(item.kind==='video' && Array.isArray(item.alternatives)?item.alternatives:[])];
  for(const url of urls){
    try{const original=await load(url,item.kind);blob=item.kind==='image'?await Media.jpg(original,dimensions):await Media.mp4(original);break;}
    catch(e){lastError=e;}
  }
  if(!blob)throw lastError || new Error('素材读取失败');
  const sub=directory;
  const {name,handle}=await uniqueFile(sub,String(index).padStart(2,'0'),item.kind==='image'?'jpg':'mp4');
  let stream;
  try {stream=await handle.createWritable();await stream.write(blob);await stream.close();}
  catch(e){if(stream)await stream.abort().catch(()=>{});await sub.removeEntry(name).catch(()=>{});throw e;}
  return {name,kind:item.kind,size:blob.size,width:dimensions.width || 0,height:dimensions.height || 0};
}
