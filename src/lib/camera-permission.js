// Camera + QR permission helper — Android 13+ safety
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Camera } from '@capacitor/camera';

function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

// Kiểm tra quyền camera cho QR scan
export async function checkCameraPermission() {
  try {
    const perm = await BarcodeScanner.checkPermission({ force: true });
    return {
      granted: !!perm.granted,
      denied: !perm.granted,
      permanentlyDenied: !perm.granted
    };
  } catch (_) {
    return { granted: false, denied: true, permanentlyDenied: true };
  }
}

// Kiểm tra + yêu cầu quyền camera cho Camera plugin (chụp ảnh)
export async function requestPhotoPermission() {
  try {
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

// Hướng dẫn vào Settings khi quyền bị từ chối
export function showPermissionGuide(type) {
  const label = type === 'qr' ? 'quét QR' : 'chụp ảnh';
  const toast = window.showToast || console.warn;
  const msg = isAndroid()
    ? `⚠ Vào Cài đặt → Ứng dụng → EcoSynTech → Quyền → Bật camera để ${label}.`
    : `⚠ Vào Cài đặt → Quyền riêng tư → Camera → Bật cho EcoSynTech để ${label}.`;
  toast(msg, 'err', 8000);
}
