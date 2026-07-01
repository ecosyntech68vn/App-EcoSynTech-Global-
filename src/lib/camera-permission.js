import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

export async function checkCameraPermission() {
  try {
    // Step 1: check without force first
    const check = await BarcodeScanner.checkPermission({ force: false });
    if (check.granted) {
      return { granted: true, denied: false, permanentlyDenied: false };
    }
    // Step 2: denied → request with force
    if (!check.granted) {
      const request = await BarcodeScanner.checkPermission({ force: true });
      if (request.granted) {
        return { granted: true, denied: false, permanentlyDenied: false };
      }
      // Still denied after request → permanently denied
      return { granted: false, denied: true, permanentlyDenied: true };
    }
    return { granted: false, denied: true, permanentlyDenied: true };
  } catch (_) {
    return { granted: false, denied: true, permanentlyDenied: true };
  }
}

export async function requestPhotoPermission() {
  try {
    const { Camera } = await import('@capacitor/camera');
    const perm = await Camera.requestPermissions();
    const cam = perm.camera;
    return {
      granted: cam === 'granted' || cam === 'limited',
      denied: cam === 'denied',
      permanentlyDenied: cam === 'denied'
    };
  } catch (_) {
    return { granted: false, denied: true, permanentlyDenied: true };
  }
}

export function showPermissionGuide(type) {
  const label = type === 'qr' ? 'quét QR' : 'chụp ảnh';
  const toast = window.showToast || console.warn;
  const msg = isAndroid()
    ? `⚠ Vào Cài đặt → Ứng dụng → EcoSynTech → Quyền → Bật camera để ${label}.`
    : `⚠ Vào Cài đặt → Quyền riêng tư → Camera → Bật cho EcoSynTech để ${label}.`;
  showPermissionBanner(msg);
}

// Hiển thị banner hướng dẫn thay vì chỉ toast (dễ bị miss)
function showPermissionBanner(msg) {
  const existing = document.getElementById('perm-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'perm-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#FFF3E0;padding:16px;border-top:3px solid #FF8F00;z-index:9999;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,0.15);';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:24px;">🔒</span>
      <div style="flex:1;">${msg}</div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:0;font-size:22px;cursor:pointer;color:#888;">✕</button>
    </div>`;
  document.body.appendChild(banner);
  // Tự ẩn sau 15s
  setTimeout(() => { try { banner.remove(); } catch(_) {} }, 15000);
  const toast = window.showToast || function(){};
  toast(msg, 'err', 8000);
}
