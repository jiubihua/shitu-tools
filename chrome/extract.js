function extractNote() {
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
  const root = document.querySelector('#noteContainer, .note-detail-mask .note-container, .note-detail-mask, .note-container');
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
    const state = unwrap(window.__INITIAL_STATE__);
    const detail = unwrap(state?.note);
    const map = unwrap(detail?.noteDetailMap);
    const currentId = routeId || unwrap(detail?.currentNoteId) || unwrap(detail?.firstNoteId);
    if (!sourceUrl && /^[a-f\d]{24}$/i.test(currentId || '')) sourceUrl = `https://www.xiaohongshu.com/explore/${currentId}`;
    let record = currentId && unwrap(map instanceof Map ? map.get(currentId) : map?.[currentId]);
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
