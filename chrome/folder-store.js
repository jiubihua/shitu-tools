const FolderStore={
  async open(){return new Promise((resolve,reject)=>{const r=indexedDB.open('shitu-selected-folders',1);r.onupgradeneeded=()=>r.result.createObjectStore('folders');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});},
  async access(key,value,remove=false){const db=await this.open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('folders',value||remove?'readwrite':'readonly'),s=tx.objectStore('folders');let result;const r=remove?s.delete(key):value?s.put(value,key):s.get(key);r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('文件夹记录保存失败'));});}finally{db.close();}}
};
