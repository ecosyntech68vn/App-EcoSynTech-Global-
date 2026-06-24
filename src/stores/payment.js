import { orderStore } from './order.js';

const GATEWAY_CONFIG_KEY = 'payment:gateway_config';

const GATEWAYS = {
  momo: {
    name: 'MoMo',
    nameEn: 'MoMo',
    icon: '📱',
    partnerCode: 'MOMO',
    async createPayment(order) {
      return {
        success: true,
        gateway: 'momo',
        payUrl: `momo://app?partnerCode=MOMO&orderId=${order.code}&amount=${order.totalAmount}`,
        qrContent: `momo://payment?orderId=${order.code}&amount=${order.totalAmount}`,
        transactionId: 'MOMO_' + Date.now(),
        note: 'Quét QR bằng ứng dụng MoMo để thanh toán'
      };
    }
  },
  zalopay: {
    name: 'ZaloPay',
    nameEn: 'ZaloPay',
    icon: '💳',
    partnerCode: 'ZALOPAY',
    async createPayment(order) {
      return {
        success: true,
        gateway: 'zalopay',
        payUrl: `zalopay://app?orderId=${order.code}&amount=${order.totalAmount}`,
        qrContent: `zalopay://payment?orderId=${order.code}&amount=${order.totalAmount}`,
        transactionId: 'ZLP_' + Date.now(),
        note: 'Quét QR bằng ứng dụng ZaloPay để thanh toán'
      };
    }
  },
  bank_transfer: {
    name: 'Chuyển khoản',
    nameEn: 'Bank Transfer',
    icon: '🏦',
    partnerCode: '',
    async createPayment(order) {
      return {
        success: true,
        gateway: 'bank_transfer',
        payUrl: '',
        qrContent: order.paymentQR || '',
        transactionId: '',
        note: 'Chuyển khoản theo thông tin tài khoản bên dưới'
      };
    }
  },
  cod: {
    name: 'Tiền mặt (COD)',
    nameEn: 'Cash (COD)',
    icon: '💵',
    partnerCode: '',
    async createPayment(order) {
      return {
        success: true,
        gateway: 'cod',
        payUrl: '',
        qrContent: '',
        transactionId: '',
        note: 'Thanh toán khi nhận hàng'
      };
    }
  }
};

export const paymentGatewayStore = {
  getGatewayList() {
    return Object.entries(GATEWAYS).map(([id, g]) => ({ id, ...g }));
  },

  getGateway(id) {
    return GATEWAYS[id];
  },

  async processPayment(orderId, gatewayId) {
    const order = await orderStore.get(orderId);
    if (!order) throw new Error('Không tìm thấy đơn hàng');

    const gateway = GATEWAYS[gatewayId];
    if (!gateway) throw new Error('Cổng thanh toán không hợp lệ');

    try {
      const result = await gateway.createPayment(order);
      return result;
    } catch (e) {
      return {
        success: false,
        gateway: gatewayId,
        error: e.message,
        note: 'Không thể tạo yêu cầu thanh toán'
      };
    }
  },

  async verifyPayment(gatewayId, transactionId) {
    return { verified: true, gateway: gatewayId, transactionId };
  }
};
