const Report={
  async inventory(directory){
    const records=[];
    for await(const handle of directory.values()){
      if(handle.kind!=='file' || !/\.(jpe?g|mp4)$/i.test(handle.name))continue;
      const file=await handle.getFile(),kind=/\.mp4$/i.test(handle.name)?'video':'image';let width=0,height=0;
      if(kind==='image')try{const bitmap=await createImageBitmap(file);width=bitmap.width;height=bitmap.height;bitmap.close();}catch{}
      records.push({name:handle.name,kind,size:file.size,width,height});
    }
    return records.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
  },
  text(job,records,done,failed,errors,finished){
    const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const images=records.filter(x=>x.kind==='image'),videos=records.filter(x=>x.kind==='video');
    const clean=value=>String(value || '').replace(/[\r\n]+/g,' ');
    const lines=[`标题：${clean(job.title)}`,`来源：${clean(job.sourceUrl) || '未读取到来源链接'}`,`保存日期：${date}`,`图片：${images.length} 张，本次素材按原帖顺序编号；重复保存自动追加序号。`,`视频：${videos.length} 个。`,'图片统一转换为 JPG，保持原尺寸，编码质量参数95；色度采样由浏览器决定，未另存原始文件。',`本次保存：成功 ${done} 项，失败 ${failed} 项，${finished?'已结束':'进行中'}。`,'清单统计此笔记文件夹内的 JPG 图片和 MP4 视频（包含之前已保存的文件）。',''];
    for(const item of records)lines.push(`${item.name}  ${item.kind==='image'?(item.width && item.height?`${item.width}×${item.height}`:'尺寸未读取'):'视频 MP4'}  ${item.size} 字节`);
    if(errors.length)lines.push('','未保存 / 异常：',...errors.map(clean));
    return lines.join('\r\n')+'\r\n';
  },
  async write(directory,text){
    const handle=await directory.getFileHandle('来源与图片清单.txt',{create:true});let stream;
    try{stream=await handle.createWritable();await stream.write(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}));await stream.close();}
    catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}
  }
};
