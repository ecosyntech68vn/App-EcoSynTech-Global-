// Feature F — Biometric login wrapper (vân tay/Face ID), fallback PIN
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const biometric = {
  async available() {
    try {
      const r = await BiometricAuth.checkBiometry();
      return !!r.isAvailable;
    } catch (_) { return false; }
  },
  async authenticate(reason = 'Mở khoá EcoSynTech Farm OS') {
    try {
      const r = await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Huỷ',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Dùng PIN',
        androidTitle: 'EcoSynTech',
        androidSubtitle: reason
      });
      return !!(r && r.isAuthenticated !== false);
    } catch (e) {
      return false;
    }
  }
};
