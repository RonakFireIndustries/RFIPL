import apiClient from './client';

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

// ------------------------------------------------------------
// Units and conversions
// ------------------------------------------------------------

export function getInventoryUnits(token, params = {}) {
  return apiClient('GET', `/inventory-units${toQuery(params)}`, null, token);
}

export function getInventoryUnit(id, token) {
  return apiClient('GET', `/inventory-units/${id}`, null, token);
}

export function createInventoryUnit(data, token) {
  return apiClient('POST', '/inventory-units', data, token);
}

export function updateInventoryUnit(id, data, token) {
  return apiClient('PUT', `/inventory-units/${id}`, data, token);
}

export function deleteInventoryUnit(id, token) {
  return apiClient('DELETE', `/inventory-units/${id}`, null, token);
}

export function getUnitConversions(unitId, token) {
  return apiClient('GET', `/inventory-units/${unitId}/conversions`, null, token);
}

export function createUnitConversion(unitId, data, token) {
  return apiClient('POST', `/inventory-units/${unitId}/conversions`, data, token);
}

export function deleteUnitConversion(unitId, conversionId, token) {
  return apiClient('DELETE', `/inventory-units/${unitId}/conversions/${conversionId}`, null, token);
}

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

export function getInventoryCategories(token, params = {}) {
  return apiClient('GET', `/inventory-categories${toQuery(params)}`, null, token);
}

export function getInventoryCategory(id, token) {
  return apiClient('GET', `/inventory-categories/${id}`, null, token);
}

export function createInventoryCategory(data, token) {
  return apiClient('POST', '/inventory-categories', data, token);
}

export function updateInventoryCategory(id, data, token) {
  return apiClient('PUT', `/inventory-categories/${id}`, data, token);
}

export function deleteInventoryCategory(id, token) {
  return apiClient('DELETE', `/inventory-categories/${id}`, null, token);
}

// ------------------------------------------------------------
// Suppliers
// ------------------------------------------------------------

export function getSuppliers(token, params = {}) {
  return apiClient('GET', `/suppliers${toQuery(params)}`, null, token);
}

export function getSupplier(id, token) {
  return apiClient('GET', `/suppliers/${id}`, null, token);
}

export function createSupplier(data, token) {
  return apiClient('POST', '/suppliers', data, token);
}

export function updateSupplier(id, data, token) {
  return apiClient('PUT', `/suppliers/${id}`, data, token);
}

export function deleteSupplier(id, token) {
  return apiClient('DELETE', `/suppliers/${id}`, null, token);
}

// ------------------------------------------------------------
// Raw materials and material-supplier links
// ------------------------------------------------------------

export function getRawMaterials(token, params = {}) {
  return apiClient('GET', `/raw-materials${toQuery(params)}`, null, token);
}

export function getRawMaterial(id, token) {
  return apiClient('GET', `/raw-materials/${id}`, null, token);
}

export function createRawMaterial(data, token) {
  return apiClient('POST', '/raw-materials', data, token);
}

export function updateRawMaterial(id, data, token) {
  return apiClient('PUT', `/raw-materials/${id}`, data, token);
}

export function deleteRawMaterial(id, token) {
  return apiClient('DELETE', `/raw-materials/${id}`, null, token);
}

export function getRawMaterialSuppliers(id, token) {
  return apiClient('GET', `/raw-materials/${id}/suppliers`, null, token);
}

export function linkRawMaterialSupplier(id, data, token) {
  return apiClient('POST', `/raw-materials/${id}/suppliers`, data, token);
}

export function updateRawMaterialSupplier(id, linkId, data, token) {
  return apiClient('PUT', `/raw-materials/${id}/suppliers/${linkId}`, data, token);
}

export function unlinkRawMaterialSupplier(id, linkId, token) {
  return apiClient('DELETE', `/raw-materials/${id}/suppliers/${linkId}`, null, token);
}

// ------------------------------------------------------------
// Batches
// ------------------------------------------------------------

export function getRawMaterialBatches(token, params = {}) {
  return apiClient('GET', `/raw-material-stock/batches${toQuery(params)}`, null, token);
}

export function getRawMaterialBatch(id, token) {
  return apiClient('GET', `/raw-material-stock/batches/${id}`, null, token);
}

export function createRawMaterialBatch(data, token) {
  return apiClient('POST', '/raw-material-stock/batches', data, token);
}

export function updateRawMaterialBatch(id, data, token) {
  return apiClient('PUT', `/raw-material-stock/batches/${id}`, data, token);
}

// ------------------------------------------------------------
// Stock, ledger and reports
// ------------------------------------------------------------

export function getRawMaterialStock(token, params = {}) {
  return apiClient('GET', `/raw-material-stock${toQuery(params)}`, null, token);
}

export function adjustRawMaterialStock(data, token) {
  return apiClient('POST', '/raw-material-stock/stock', data, token);
}

export function setRawMaterialStock(id, data, token) {
  return apiClient('PUT', `/raw-material-stock/stock/${id}`, data, token);
}

export function getRawMaterialLedger(token, params = {}) {
  return apiClient('GET', `/raw-material-stock/ledger${toQuery(params)}`, null, token);
}

export function createRawMaterialLedgerEntry(data, token) {
  return apiClient('POST', '/raw-material-stock/ledger', data, token);
}

export function getRawMaterialStockSummary(token) {
  return apiClient('GET', '/raw-material-stock/summary', null, token);
}

export function getLowStockItems(token) {
  return apiClient('GET', '/raw-material-stock/low-stock', null, token);
}

// ------------------------------------------------------------
// Purchasing and quality control
// ------------------------------------------------------------

export function getPurchaseRequests(token, params = {}) {
  return apiClient('GET', `/purchase-requests${toQuery(params)}`, null, token);
}

export function getPurchaseRequest(id, token) {
  return apiClient('GET', `/purchase-requests/${id}`, null, token);
}

export function createPurchaseRequest(data, token) {
  return apiClient('POST', '/purchase-requests', data, token);
}

export function submitPurchaseRequest(id, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/submit`, {}, token);
}

export function approvePurchaseRequest(id, data = {}, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/approve`, data, token);
}

export function rejectPurchaseRequest(id, data = {}, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/reject`, data, token);
}

export function deletePurchaseRequest(id, token) {
  return apiClient('DELETE', `/purchase-requests/${id}`, null, token);
}

export function getPurchaseOrders(token, params = {}) {
  return apiClient('GET', `/purchase-orders${toQuery(params)}`, null, token);
}

export function getPurchaseOrder(id, token) {
  return apiClient('GET', `/purchase-orders/${id}`, null, token);
}

export function createPurchaseOrder(data, token) {
  return apiClient('POST', '/purchase-orders', data, token);
}

export function submitPurchaseOrder(id, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/submit`, {}, token);
}

export function approvePurchaseOrder(id, data = {}, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/approve`, data, token);
}

export function rejectPurchaseOrder(id, data = {}, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/reject`, data, token);
}

export function cancelPurchaseOrder(id, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/cancel`, {}, token);
}

export function deletePurchaseOrder(id, token) {
  return apiClient('DELETE', `/purchase-orders/${id}`, null, token);
}

export function getGoodsReceipts(token, params = {}) {
  return apiClient('GET', `/goods-receipts${toQuery(params)}`, null, token);
}

export function getGoodsReceipt(id, token) {
  return apiClient('GET', `/goods-receipts/${id}`, null, token);
}

export function createGoodsReceipt(data, token) {
  return apiClient('POST', '/goods-receipts', data, token);
}

export function cancelGoodsReceipt(id, token) {
  return apiClient('PATCH', `/goods-receipts/${id}/cancel`, {}, token);
}

export function getQualityInspections(token, params = {}) {
  return apiClient('GET', `/quality-inspections${toQuery(params)}`, null, token);
}

export function getQualityInspection(id, token) {
  return apiClient('GET', `/quality-inspections/${id}`, null, token);
}

export function createQualityInspection(data, token) {
  return apiClient('POST', '/quality-inspections', data, token);
}

// ------------------------------------------------------------
// Finished goods and production
// ------------------------------------------------------------

export function getFinishedProducts(token, params = {}) {
  return apiClient('GET', `/finished-products${toQuery(params)}`, null, token);
}

export function getFinishedProduct(id, token) {
  return apiClient('GET', `/finished-products/${id}`, null, token);
}

export function createFinishedProduct(data, token) {
  return apiClient('POST', '/finished-products', data, token);
}

export function updateFinishedProduct(id, data, token) {
  return apiClient('PUT', `/finished-products/${id}`, data, token);
}

export function deleteFinishedProduct(id, token) {
  return apiClient('DELETE', `/finished-products/${id}`, null, token);
}

export function getBillsOfMaterials(token, params = {}) {
  return apiClient('GET', `/bills-of-materials${toQuery(params)}`, null, token);
}

export function getActiveBom(finishedProductId, token) {
  return apiClient('GET', `/bills-of-materials/active/${finishedProductId}`, null, token);
}

export function getBillOfMaterials(id, token) {
  return apiClient('GET', `/bills-of-materials/${id}`, null, token);
}

export function createBom(data, token) {
  return apiClient('POST', '/bills-of-materials', data, token);
}

export function updateBom(id, data, token) {
  return apiClient('PUT', `/bills-of-materials/${id}`, data, token);
}

export function deleteBom(id, token) {
  return apiClient('DELETE', `/bills-of-materials/${id}`, null, token);
}

export function getProductionOrders(token, params = {}) {
  return apiClient('GET', `/production-orders${toQuery(params)}`, null, token);
}

export function getProductionOrder(id, token) {
  return apiClient('GET', `/production-orders/${id}`, null, token);
}

export function createProductionOrder(data, token) {
  return apiClient('POST', '/production-orders', data, token);
}

export function updateProductionOrder(id, data, token) {
  return apiClient('PUT', `/production-orders/${id}`, data, token);
}

export function planProductionOrder(id, data = {}, token) {
  return apiClient('PATCH', `/production-orders/${id}/plan`, data, token);
}

export function startProductionOrder(id, token) {
  return apiClient('PATCH', `/production-orders/${id}/start`, {}, token);
}

export function cancelProductionOrder(id, token) {
  return apiClient('PATCH', `/production-orders/${id}/cancel`, {}, token);
}

export function completeProductionOrder(id, data = {}, token) {
  return apiClient('POST', `/production-orders/${id}/complete`, data, token);
}

export function deleteProductionOrder(id, token) {
  return apiClient('DELETE', `/production-orders/${id}`, null, token);
}

export function getProductionConsumptions(token, params = {}) {
  return apiClient('GET', `/production-consumption${toQuery(params)}`, null, token);
}

export function createProductionConsumption(data, token) {
  return apiClient('POST', '/production-consumption', data, token);
}

export function getProductionWastage(token, params = {}) {
  return apiClient('GET', `/production-wastage${toQuery(params)}`, null, token);
}

export function createProductionWastage(data, token) {
  return apiClient('POST', '/production-wastage', data, token);
}

export function updateProductionWastage(id, data, token) {
  return apiClient('PUT', `/production-wastage/${id}`, data, token);
}

export function deleteProductionWastage(id, token) {
  return apiClient('DELETE', `/production-wastage/${id}`, null, token);
}

export function getProductionOutputs(token, params = {}) {
  return apiClient('GET', `/production-outputs${toQuery(params)}`, null, token);
}

export function getFinishedStock(token, params = {}) {
  return apiClient('GET', `/finished-stock${toQuery(params)}`, null, token);
}

export function getFinishedStockSummary(token) {
  return apiClient('GET', '/finished-stock/summary', null, token);
}

export function getFinishedBatches(token, params = {}) {
  return apiClient('GET', `/finished-stock/batches${toQuery(params)}`, null, token);
}

export function getFinishedLedger(token, params = {}) {
  return apiClient('GET', `/finished-stock/ledger${toQuery(params)}`, null, token);
}

export function adjustFinishedStock(data, token) {
  return apiClient('POST', '/finished-stock/stock', data, token);
}

export function setFinishedStock(id, data, token) {
  return apiClient('PUT', `/finished-stock/stock/${id}`, data, token);
}
