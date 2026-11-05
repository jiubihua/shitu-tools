// Native media loading avoids downloading an entire video into popup memory.
function bindVideoPreview(frame, video, sources, onState=()=>{}) {
  const urls=[...new Set(sources.filter(Boolean))];
  let index=0,wanted=false,disposed=false;
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload='metadata';
  const state=value=>{frame.dataset.state=value;onState(value);};
  const pause=()=>{wanted=false;video.pause();if(!disposed && frame.dataset.state!=='error')state('paused');};
  async function play(){
    if(disposed)return;wanted=true;state('loading');
    try{await video.play();if(!wanted || disposed)video.pause();else state('playing');}
    catch(e){if(wanted && !disposed && e.name!=='AbortError')state('error');}
  }
  const failed=()=>{
    if(disposed)return;
    if(++index<urls.length){video.src=urls[index];video.load();if(wanted)play();}
    else{video.pause();state('error');}
  };
  const key=e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();wanted?pause():play();}};
  frame.addEventListener('pointerenter',play);frame.addEventListener('pointerleave',pause);
  frame.addEventListener('focus',play);frame.addEventListener('blur',pause);frame.addEventListener('keydown',key);
  video.addEventListener('error',failed);
  video.addEventListener('playing',()=>{if(!wanted || disposed)video.pause();else state('playing');});
  video.addEventListener('waiting',()=>{if(wanted)state('loading');});
  if(urls.length)video.src=urls[0];else state('error');
  return {pause,destroy(){disposed=true;pause();frame.removeEventListener('pointerenter',play);frame.removeEventListener('pointerleave',pause);frame.removeEventListener('focus',play);frame.removeEventListener('blur',pause);frame.removeEventListener('keydown',key);video.removeEventListener('error',failed);video.removeAttribute('src');video.load();}};
}
