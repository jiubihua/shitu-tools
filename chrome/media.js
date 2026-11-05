const Media = {
  allowed(value) {
    try { const u=new URL(value);return u.protocol==='https:' && /(^|\.)(xhscdn\.(?:com|net)|xiaohongshu\.com)$/.test(u.hostname); } catch {return false;}
  },
  folder(value) {return String(value || '小红书笔记').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/^[. ]+|[. ]+$/g,'').slice(0,70) || '小红书笔记';},
  async jpg(blob,metadata) {
    const bitmap=await createImageBitmap(blob);
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width*bitmap.height>80000000) throw new Error('图片尺寸过大，无法转为 JPG');
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');if (!ctx) throw new Error('图片转换器无法启动');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
      if(metadata){metadata.width=bitmap.width;metadata.height=bitmap.height;}
      const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.95));
      canvas.width=canvas.height=1;
      if (!result || result.type!=='image/jpeg') throw new Error('图片无法转换为 JPG');
      return result;
    } finally {bitmap.close();}
  },
  async mp4(blob) {
    const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());
    if (header.length<12 || String.fromCharCode(...header.slice(4,8))!=='ftyp') throw new Error('该视频不是可直接保存的 MP4，暂不支持分段流');
    return new Blob([blob],{type:'video/mp4'});
  }
};
