const fetchProducts = jest.fn().mockResolvedValue([]);
const restorePurchases = jest.fn().mockResolvedValue([]);

module.exports = {
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  requestPurchase: jest.fn().mockResolvedValue(undefined),
  validateReceiptIOS: jest.fn().mockResolvedValue({
    isValid: false,
    receiptData: null,
  }),
  useIAP: jest.fn(() => ({
    connected: false,
    subscriptions: [],
    fetchProducts,
    restorePurchases,
  })),
};
