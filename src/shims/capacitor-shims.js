// Browser shims for vite dev. Real Capacitor plugins replace these in APK.

// V3.1 — SecureStorage shim (dev only; APK dùng Android Keystore thật)
const SS_PREFIX = 'shim_secure_';
export const SecureStoragePlugin = {
  async keys(){ return { value: Object.keys(localStorage).filter(k => k.startsWith(SS_PREFIX)).map(k => k.slice(SS_PREFIX.length)) } },
  async get(o){ const v = localStorage.getItem(SS_PREFIX + o.key); if (v === null) throw new Error('Item with given key does not exist'); return { value: v } },
  async set(o){ localStorage.setItem(SS_PREFIX + o.key, o.value); return { value: true } },
  async remove(o){ localStorage.removeItem(SS_PREFIX + o.key); return { value: true } }
};

export const Preferences = {
  async get(o){ try{return {value:localStorage.getItem(o.key)} } catch(_){return {value:null}} },
  async set(o){ localStorage.setItem(o.key, o.value) },
  async remove(o){ localStorage.removeItem(o.key) }
};

export const Network = {
  async getStatus(){return {connected: navigator.onLine, connectionType:'unknown'}},
  addListener(_, cb){
    window.addEventListener('online', ()=>cb({connected:true}));
    window.addEventListener('offline', ()=>cb({connected:false}));
    return {remove(){}};
  }
};

export const App = { addListener(){return {remove(){}}} };

export const Camera = {
  async getPhoto(){return {webPath:'', path:''}},
  async checkPermissions(){return {camera:'granted'}},
  async requestPermissions(){return {camera:'granted'}}
};
export const CameraResultType = { Uri:'uri', Base64:'base64', DataUrl:'dataUrl' };
export const CameraSource = { Camera:'CAMERA', Photos:'PHOTOS' };

export const Filesystem = {
  async writeFile(){return {uri:''}},
  async readFile(){return {data:''}},
  async readdir(){return {files:[]}}
};
export const Directory = { Data:'DATA', Cache:'CACHE', Documents:'DOCUMENTS' };

export const Geolocation = {
  async getCurrentPosition(){return {coords:{latitude:10.8231,longitude:106.6297,accuracy:10},timestamp:Date.now()}},
  async watchPosition(){return 'watch_0'},
  async clearWatch(){},
  async checkPermissions(){return {location:'granted'}},
  async requestPermissions(){return {location:'granted'}}
};

export const LocalNotifications = {
  async schedule(o){ console.log('[shim] notify', o); return {notifications: o.notifications || []} },
  async cancel(){},
  async getPending(){return {notifications:[]}},
  async requestPermissions(){return {display:'granted'}},
  async checkPermissions(){return {display:'granted'}},
  addListener(){return {remove(){}}}
};

export const BarcodeScanner = {
  async checkPermission(){return {granted:true}},
  async startScan(){return {hasContent:true, content:'demo:device:esp32_001'}},
  async stopScan(){},
  async hideBackground(){},
  async showBackground(){}
};

export const BiometricAuth = {
  async checkBiometry(){return {isAvailable:true, biometryType:'fingerprint'}},
  async authenticate(){return {isAuthenticated:true}}
};

export const BackgroundRunner = {
  async dispatchEvent(o){ console.log('[shim] bg event', o); return {success:true} }
};
