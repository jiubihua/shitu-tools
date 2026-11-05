async function load(url,kind) {
  if (!Media.allowed(url)) throw new Error('素材地址不受支持');
  const limit=kind==='image'?50*1024*1024:500*1024*1024;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),180000);
  try {
    const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if (!response.ok) throw new Error(`素材读取失败（${response.status}），请刷新笔记后重试`);
    if (!Media.allowed(response.url)) throw new Error('素材跳转到了不受支持的地址');
    if (Number(response.headers.get('content-length'))>limit) throw new Error('素材过大，超出本地处理限制');
    const reader=response.body.getReader(),parts=[];let size=0;
    while (true) {const {done,value}=await reader.read();if (done) break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('素材过大，超出本地处理限制');}parts.push(value);}
    return new Blob(parts,{type:response.headers.get('content-type') || ''});
  } finally {clearTimeout(timeout);}
}
