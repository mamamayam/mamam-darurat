/**
 * fixture.mjs — contoh file backup mamam-global (app A) yang realistis, untuk tes.
 * Bentuk field mengikuti kode A (lihat PaymentModal.jsx, MenuListTab.jsx, VariantListTab.jsx, dst.).
 * Termasuk sengaja beberapa data "kotor" yang memang ada di app lama.
 */
export function makeBackup() {
  const iso = (s) => new Date(s).toISOString();
  return {
    categories: ['Ayam Geprek', 'Minuman', 'Snack'],
    menus: [
      { id: 'm1', name: 'Ayam Geprek', price: 18000, hpp: 9000, category: 'Ayam Geprek', variantGroupIds: ['vg1', 'vg2'] },
      { id: 'm2', name: 'Ayam Bakar', price: 22000, hpp: 11000, category: 'Ayam Geprek', variantGroupIds: ['vg1'] },
      { id: 'm3', name: 'Es Teh', price: 6000, hpp: 1500, category: 'Minuman', variantGroupIds: [] },
      { id: 'm4', name: 'Kentang Goreng', price: 12000, hpp: 0, category: 'Snack', variantGroupIds: ['vg-hilang'] },
      { id: 'm5', name: 'Menu Tanpa Kategori', price: 5000, hpp: 2000, category: '', variantGroupIds: [] },
      { id: 'm6', name: '', price: 1000, category: 'Snack', variantGroupIds: [] },
      { id: 'm7', name: 'Harga Rusak', price: 'abc', category: 'Snack', variantGroupIds: [] },
    ],
    variantGroups: [
      { id: 'vg1', name: 'Level Pedas', category: 'Rasa', isRequired: true, maxSelection: 1,
        options: [{ id: 'o11', name: 'Level 1', extraPrice: 0 }, { id: 'o12', name: 'Level 3', extraPrice: 0 }] },
      { id: 'vg2', name: 'Topping', category: 'Tambahan', isRequired: false, maxSelection: 2,
        options: [{ id: 'o21', name: 'Extra Keju', extraPrice: 3000 }, { id: 'o22', name: 'Telur Dadar', extraPrice: 4000 }] },
    ],
    customers: [
      { id: 'CUST-1', name: 'Budi', phone: '081298765432', points: 12 },
      { id: 'CUST-2', name: 'Sari', phone: '', points: 3 },
      { id: 'CUST-3', name: 'Sudah Dihapus', phone: '0811', points: 0, deletedAt: iso('2026-09-01T00:00:00Z') },
    ],
    vouchers: [
      { id: 'VCH-1', code: 'hemat10', discountType: 'percent', discountValue: 10, minPurchase: 30000, quota: 50 },
      { id: 'VCH-2', code: 'POTONG5K', discountType: 'fixed', discountValue: 5000, minPurchase: 0, quota: 10 },
      { id: 'VCH-3', code: 'LAMA', discountType: 'fixed', discountValue: 1000, quota: 1, deletedAt: iso('2026-08-01T00:00:00Z') },
      { id: 'VCH-4', code: 'ANEH', discountType: 'bogo', discountValue: 1, quota: 1 },
    ],
    employees: [
      { id: 'EMP-1', name: 'Siti Aminah', phone: '081234567890', address: 'Bandung', hourlyRate: 8000, fullTimeBonus: 50000, overtimeRate30: 5000, startDate: '2025-03-01', status: 'aktif', resignDate: '', role: 'kasir' },
      { id: 'EMP-2', name: 'Joko', phone: '', address: '', hourlyRate: 7000, fullTimeBonus: '', overtimeRate30: 0, startDate: '2025-05-01', status: 'resign', resignDate: '2026-06-30', role: 'kurir' },
    ],
    expenseCategories: ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain'],
    expenses: [
      { id: 'EXP-1790990000000', amount: 125000, category: 'Belanja', note: 'Ayam 10kg', date: iso('2026-10-02T17:00:00Z'), paymentMethod: 'Tunai', employeeId: null, employeeName: null, cashHolder: { type: 'kasir' } },
      { id: 'EXP-1790990100000', amount: 100000, category: 'Kasbon Karyawan', note: '', date: iso('2026-10-02T17:00:00Z'), paymentMethod: 'Tunai', employeeId: 'EMP-1', employeeName: 'Siti Aminah', cashHolder: { type: 'kasir' } },
      { id: 'EXP-1790990200000', amount: 30000, category: 'biaya', note: 'Gas', date: iso('2026-10-02T17:00:00Z'), paymentMethod: 'Tunai', cashHolder: { type: 'kurir', employeeId: 'EMP-2', employeeName: 'Joko' } },
      { id: 'EXP-1790990300000', amount: 45000, category: 'Lain-lain', note: 'Transfer listrik', date: iso('2026-10-02T17:00:00Z'), paymentMethod: 'Non-Tunai' },
      { id: 'EXP-LAMA', amount: 9000, category: 'Belanja', description: 'format lama', date: iso('2026-09-30T17:00:00Z') },
      { id: 'EXP-DEL', amount: 1000, category: 'Belanja', date: iso('2026-09-30T17:00:00Z'), deletedAt: iso('2026-10-01T00:00:00Z') },
      { id: 'EXP-NOL', amount: 0, category: 'Belanja', date: iso('2026-09-30T17:00:00Z') },
    ],
    incomeCategories: ['Modal Tambahan'],
    incomes: [
      { id: 'INC-1790990400000', amount: 500000, category: 'Modal Tambahan', note: 'Tambah modal', date: iso('2026-10-02T17:00:00Z') },
    ],
    salesHistory: [
      { id: 'ORD-AAAA0001', date: iso('2026-10-03T05:41:22.118Z'), customerName: 'Budi', customerId: 'CUST-1', orderType: 'Takeaway',
        items: [
          { menuId: 'm1', cartItemId: 'm1-o12-o21', name: 'Ayam Geprek', price: 21000, hpp: 9000, qty: 2, note: 'tanpa timun', variantName: 'Level 3, Extra Keju',
            variantSelectedOptions: { vg1: ['o12'], vg2: ['o21'] }, category: 'Ayam Geprek' },
          { menuId: 'm3', cartItemId: 'm3', name: 'Es Teh', price: 6000, hpp: 1500, qty: 1, note: '', variantName: '', variantSelectedOptions: {}, category: 'Minuman' },
        ],
        subtotal: 48000, discount: 0, pointDiscount: 0, manualDiscountAmount: 0, taxAmount: 0, serviceAmount: 0, deliveryFee: 0,
        total: 48000, originalTotal: 48000, roundingAdjustment: 0, paymentMethod: 'Tunai', ojolName: null, orderNumber: null, splitDetails: [], hppTotal: 19500, courierId: null },
      { id: 'ORD-AAAA0002', date: iso('2026-10-03T06:10:00.000Z'), customerName: 'Tanpa Nama', customerId: null, orderType: 'Delivery',
        items: [{ menuId: 'm2', cartItemId: 'm2', name: 'Ayam Bakar', price: 22000, hpp: 11000, qty: 1, note: '', variantName: 'Level 1', variantSelectedOptions: { vg1: ['o11'], vg2: [] } }],
        subtotal: 22000, discount: 2000, pointDiscount: 1000, manualDiscountAmount: 0, taxAmount: 0, serviceAmount: 0, deliveryFee: 5000,
        total: 24000, originalTotal: 24000, roundingAdjustment: 0, paymentMethod: 'Tunai', splitDetails: [], hppTotal: 11000,
        courierId: 'EMP-2', cashHolder: { type: 'kurir', employeeId: 'EMP-2', employeeName: 'Joko' } },
      { id: 'ORD-AAAA0003', date: iso('2026-10-03T07:00:00.000Z'), customerName: 'Sari', customerId: 'CUST-2', orderType: 'Dine-in',
        items: [{ menuId: 'm-sudah-dihapus', cartItemId: 'x', name: 'Menu Lama', price: 15000, hpp: 7000, qty: 2, note: '', variantName: '', variantSelectedOptions: {} }],
        subtotal: 30000, discount: 0, pointDiscount: 0, manualDiscountAmount: 0, taxAmount: 0, serviceAmount: 0, deliveryFee: 0,
        total: 30000, originalTotal: 30000, roundingAdjustment: 0, paymentMethod: 'Split Payment',
        splitDetails: [{ method: 'Tunai', amount: 10000 }, { method: 'QRIS', amount: 20000 }], hppTotal: 14000 },
      { id: 'ORD-AAAA0004', date: iso('2026-10-03T08:00:00.000Z'), customerName: 'Ojol', customerId: null, orderType: 'Ojol',
        items: [{ menuId: 'm1', cartItemId: 'm1', name: 'Ayam Geprek', price: 18000, hpp: 9000, qty: 1, note: '', variantName: '', variantSelectedOptions: {} }],
        subtotal: 18000, discount: 0, pointDiscount: 0, manualDiscountAmount: 0, taxAmount: 0, serviceAmount: 0, deliveryFee: 0,
        total: 17500, originalTotal: 18000, roundingAdjustment: -500, paymentMethod: 'Ojol', ojolName: 'Gofood', orderNumber: 'GF-123', splitDetails: [], hppTotal: 9000 },
      { id: 'ORD-VOID0005', date: iso('2026-10-03T09:00:00.000Z'), customerName: 'Batal', customerId: null, orderType: 'Takeaway', items: [], subtotal: 9000, total: 9000,
        paymentMethod: 'Tunai', deletedAt: iso('2026-10-03T09:05:00Z') },
      { id: 'ORD-AAAA0001', date: iso('2026-10-03T05:41:22.118Z'), total: 1, orderType: 'Takeaway', paymentMethod: 'Tunai', items: [] },
      { id: 'ORD-BADDATE', date: 'bukan tanggal', total: 1000, orderType: 'Takeaway', paymentMethod: 'Tunai', items: [] },
    ],
    shiftHistory: [
      { id: 'DOMPET-5D02E3F1', startTime: iso('2026-10-02T01:00:00Z'), endTime: iso('2026-10-02T14:30:00Z'), initialCash: 200000,
        openedByEmployeeId: 'EMP-1', openedByEmployeeName: 'Siti Aminah',
        stats: { initialCash: 200000, cashSales: 850000, cashIncomes: 0, cashExpenses: 125000, cashExpensesKasir: 125000, cashExpensesKurir: 0, cashHilang: 0, totalCashBisnis: 925000, expectedCash: 925000 },
        actualCash: 920000, difference: -5000, courierBalancesSnapshot: [{ employeeId: 'EMP-2', employeeName: 'Joko', balance: 24000 }] },
      { id: 'DOMPET-BAD', startTime: iso('2026-10-02T14:00:00Z'), endTime: iso('2026-10-02T13:00:00Z'), initialCash: 0, stats: {} },
    ],
    currentShift: { id: 'DOMPET-9C41B7AA', startTime: iso('2026-10-03T01:02:11Z'), initialCash: 200000, openedByEmployeeId: 'EMP-1', openedByEmployeeName: 'Siti Aminah' },
    storeSettings: { storeName: 'Mamam Ayam' },
    theme: 'light',
  };
}
