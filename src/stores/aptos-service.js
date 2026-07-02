// Aptos Blockchain Service — Real RPC integration
// Dùng @aptos-labs/ts-sdk để kết nối Aptos testnet/mainnet
// Fallback về local hash khi offline

import { get, set } from 'idb-keyval';
import { secureStore } from './secure.js';

const CONFIG_KEY = 'aptos:config';
const PK_SECURE_KEY = 'aptos_private_key';

let _sdk = null;
let _client = null;
let _account = null;

async function getSdk() {
  if (!_sdk) {
    try {
      const mod = await import(/* @vite-ignore */ '@aptos-labs' + '/ts-sdk');
      _sdk = mod;
    } catch {
      return null;
    }
  }
  return _sdk;
}

export const aptosConfig = {
  async load() {
    const cfg = await get(CONFIG_KEY);
    const pk = await secureStore.get(PK_SECURE_KEY);
    return {
      network: cfg?.network || 'testnet',
      fullnodeUrl: cfg?.fullnodeUrl || 'https://api.testnet.aptoslabs.com/v1',
      faucetUrl: cfg?.faucetUrl || 'https://faucet.testnet.aptoslabs.com',
      moduleAddress: cfg?.moduleAddress || '',
      privateKey: pk || '',
      enabled: cfg?.enabled || false
    };
  },

  async save(cfg) {
    const { privateKey, ...safe } = cfg || {};
    await set(CONFIG_KEY, safe);
    if (privateKey) await secureStore.set(PK_SECURE_KEY, privateKey);
    else await secureStore.remove(PK_SECURE_KEY);
  },

  async isConfigured() {
    const cfg = await this.load();
    return !!(cfg.enabled && cfg.moduleAddress && cfg.privateKey);
  }
};

export const aptosService = {
  // ──── KẾT NỐI ────

  async connect() {
    const cfg = await aptosConfig.load();
    if (!cfg.enabled || !cfg.privateKey || !cfg.moduleAddress) {
      return { connected: false, reason: 'APTOS_NOT_CONFIGURED' };
    }

    const sdk = await getSdk();
    if (!sdk) {
      return { connected: false, reason: 'SDK_NOT_LOADED' };
    }

    try {
      const { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } = sdk;

      const network = cfg.network === 'mainnet' ? Network.MAINNET : Network.TESTNET;
      const aptosConfigObj = new AptosConfig({ network });
      _client = new Aptos(aptosConfigObj);

      const privateKeyObj = new Ed25519PrivateKey(cfg.privateKey);
      _account = Account.fromPrivateKey({ privateKey: privateKeyObj });

      const info = await _client.account.getAccountInfo({ accountAddress: _account.accountAddress });
      _sdk = sdk;

      return {
        connected: true,
        address: _account.accountAddress.toString(),
        sequenceNumber: info.sequence_number,
        moduleAddress: cfg.moduleAddress
      };
    } catch (e) {
      return { connected: false, reason: e.message };
    }
  },

  async disconnect() {
    _client = null;
    _account = null;
    _sdk = null;
  },

  isConnected() {
    return !!(_client && _account);
  },

  getAccountAddress() {
    return _account?.accountAddress?.toString() || '';
  },

  // ──── GHI DỮ LIỆU LÊN APTOS (THẬT) ────

  async createBatch(batchId, gtin, productName, farmId, crop, quantity, unit) {
    if (!this.isConnected()) {
      const r = await this.connect();
      if (!r.connected) return { success: false, error: r.reason };
    }

    const cfg = await aptosConfig.load();
    const sdk = await getSdk();

    try {
      const tx = await _client.transaction.build.simple({
        sender: _account.accountAddress,
        data: {
          function: `${cfg.moduleAddress}::trace::create_batch`,
          functionArguments: [batchId, gtin, productName, farmId, crop, quantity, unit]
        }
      });

      const pendingTx = await _client.signAndSubmitTransaction({ signer: _account, transaction: tx });
      const result = await _client.waitForTransaction({ transactionHash: pendingTx.hash });

      return {
        success: result.success,
        hash: result.hash,
        version: result.version,
        gasUsed: result.gas_used,
        vmStatus: result.vm_status
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async recordEvent(batchId, eventType, dataHash, previousHash, metadata) {
    if (!this.isConnected()) return { success: false, error: 'NOT_CONNECTED' };

    const cfg = await aptosConfig.load();
    const sdk = await getSdk();

    try {
      const tx = await _client.transaction.build.simple({
        sender: _account.accountAddress,
        data: {
          function: `${cfg.moduleAddress}::trace::record_event`,
          functionArguments: [batchId, eventType, dataHash, previousHash, metadata]
        }
      });

      const pendingTx = await _client.signAndSubmitTransaction({ signer: _account, transaction: tx });
      const result = await _client.waitForTransaction({ transactionHash: pendingTx.hash });

      return {
        success: result.success,
        hash: result.hash,
        version: result.version,
        gasUsed: result.gas_used,
        vmStatus: result.vm_status
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async recordExport(batchId, buyer, destination, quantity, dataHash, previousHash) {
    if (!this.isConnected()) return { success: false, error: 'NOT_CONNECTED' };

    const cfg = await aptosConfig.load();

    try {
      const tx = await _client.transaction.build.simple({
        sender: _account.accountAddress,
        data: {
          function: `${cfg.moduleAddress}::trace::record_export`,
          functionArguments: [batchId, buyer, destination, quantity, dataHash, previousHash]
        }
      });

      const pendingTx = await _client.signAndSubmitTransaction({ signer: _account, transaction: tx });
      const result = await _client.waitForTransaction({ transactionHash: pendingTx.hash });

      return {
        success: result.success,
        hash: result.hash,
        version: result.version,
        gasUsed: result.gas_used,
        vmStatus: result.vm_status
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async recordCertification(batchId, certType, certBody, validUntil, dataHash) {
    if (!this.isConnected()) return { success: false, error: 'NOT_CONNECTED' };

    const cfg = await aptosConfig.load();

    try {
      const tx = await _client.transaction.build.simple({
        sender: _account.accountAddress,
        data: {
          function: `${cfg.moduleAddress}::trace::record_certification`,
          functionArguments: [batchId, certType, certBody, validUntil, dataHash]
        }
      });

      const pendingTx = await _client.signAndSubmitTransaction({ signer: _account, transaction: tx });
      const result = await _client.waitForTransaction({ transactionHash: pendingTx.hash });

      return {
        success: result.success,
        hash: result.hash,
        version: result.version,
        vmStatus: result.vm_status
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ──── TRUY VẤN ────

  async verifyHash(batchId, dataHash) {
    if (!this.isConnected()) return { verified: false, error: 'NOT_CONNECTED' };

    const cfg = await aptosConfig.load();

    try {
      const result = await _client.view({
        payload: {
          function: `${cfg.moduleAddress}::trace::verify_hash`,
          functionArguments: [_account.accountAddress.toString(), batchId, dataHash]
        }
      });

      return { verified: result[0] === true };
    } catch (e) {
      return { verified: false, error: e.message };
    }
  },

  async getEventCount(batchId) {
    if (!this.isConnected()) return 0;

    const cfg = await aptosConfig.load();

    try {
      const result = await _client.view({
        payload: {
          function: `${cfg.moduleAddress}::trace::get_event_count`,
          functionArguments: [_account.accountAddress.toString(), batchId]
        }
      });
      return Number(result[0]) || 0;
    } catch {
      return 0;
    }
  },

  async isModuleInitialized() {
    if (!this.isConnected()) return false;

    const cfg = await aptosConfig.load();

    try {
      const result = await _client.view({
        payload: {
          function: `${cfg.moduleAddress}::trace::is_initialized`,
          functionArguments: [_account.accountAddress.toString()]
        }
      });
      return result[0] === true;
    } catch {
      return false;
    }
  },

  async getAccountBalance() {
    if (!this.isConnected()) {
      const r = await this.connect();
      if (!r.connected) return '0';
    }

    try {
      const coins = await _client.account.getAccountCoinAmount({
        accountAddress: _account.accountAddress
      });
      return (Number(coins) / 100000000).toFixed(4);
    } catch {
      return '0';
    }
  },

  // ──── FUND TESTNET ────

  async fundTestnet() {
    const sdk = await getSdk();
    if (!sdk) return { success: false, error: 'SDK_NOT_LOADED' };

    try {
      const cfg = await aptosConfig.load();
      if (cfg.network !== 'testnet') return { success: false, error: 'NOT_TESTNET' };

      await _client.fundAccount({
        accountAddress: _account.accountAddress,
        amount: 100000000 // 1 APT
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};

if (typeof window !== 'undefined') {
  window.aptosService = aptosService;
}
