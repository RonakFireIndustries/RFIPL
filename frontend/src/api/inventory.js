import apiClient from './client';

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v !== undefined && v !== null));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
}

// ---- Inventory Units ----
export function getInventoryUnits(token, params) {
  return apiClient('GET', `/inventory-units${qs(params)}`, null, token);
}
export function getInventoryUnit(id, token) {
  return apiClient('GET', `/inventory-units/${id}`, null, token);
}
export function createUnitConversion(id, body, token) {
  return apiClient('POST', `/inventory-units/${id}/conversions`, body, token);
}
export function deleteUnitConversion(id, conversionId, token) {
  return apiClient('DELETE', `/inventory-units/${id}/conversions/${conversionId}`, null, token);
}
export function createInventoryUnit(body, token) {
  return apiClient('POST', '/inventory-units', body, token);
}
export function updateInventoryUnit(id, body, token) {
  return apiClient('PUT', `/inventory-units/${id}`, body, token);
}
export function deleteInventoryUnit(id, token) {
  return apiClient('DELETE', `/inventory-units/${id}`, null, token);
}

// ---- Inventory Categories ----
export function getInventoryCategories(token, params) {
  return apiClient('GET', `/inventory-categories${qs(params)}`, null, token);
}
export function createInventoryCategory(body, token) {
  return apiClient('POST', '/inventory-categories', body, token);
}
export function updateInventoryCategory(id, body, token) {
  return apiClient('PUT', `/inventory-categories/${id}`, body, token);
}
export function deleteInventoryCategory(id, token) {
  return apiClient('DELETE', `/inventory-categories/${id}`, null, token);
}

// ---- Stock Locations ----
export function getStockLocations(token, params) {
  return apiClient('GET', `/stock-locations${qs(params)}`, null, token);
}
export function createStockLocation(body, token) {
  return apiClient('POST', '/stock-locations', body, token);
}
export function updateStockLocation(id, body, token) {
  return apiClient('PUT', `/stock-locations/${id}`, body, token);
}
export function deleteStockLocation(id, token) {
  return apiClient('DELETE', `/stock-locations/${id}`, null, token);
}

// ---- Suppliers ----
export function getSuppliers(token, params) {
  return apiClient('GET', `/suppliers${qs(params)}`, null, token);
}
export function createSupplier(body, token) {
  return apiClient('POST', '/suppliers', body, token);
}
export function updateSupplier(id, body, token) {
  return apiClient('PUT', `/suppliers/${id}`, body, token);
}
export function deleteSupplier(id, token) {
  return apiClient('DELETE', `/suppliers/${id}`, null, token);
}

// ---- Raw Materials ----
export function getRawMaterials(token, params) {
  return apiClient('GET', `/raw-materials${qs(params)}`, null, token);
}
export function getRawMaterial(id, token) {
  return apiClient('GET', `/raw-materials/${id}`, null, token);
}
export function createRawMaterial(body, token) {
  return apiClient('POST', '/raw-materials', body, token);
}
export function updateRawMaterial(id, body, token) {
  return apiClient('PUT', `/raw-materials/${id}`, body, token);
}
export function deleteRawMaterial(id, token) {
  return apiClient('DELETE', `/raw-materials/${id}`, null, token);
}
export function getMaterialSuppliers(id, token) {
  return apiClient('GET', `/raw-materials/${id}/suppliers`, null, token);
}
export function addMaterialSupplier(id, body, token) {
  return apiClient('POST', `/raw-materials/${id}/suppliers`, body, token);
}
export function updateMaterialSupplier(id, linkId, body, token) {
  return apiClient('PUT', `/raw-materials/${id}/suppliers/${linkId}`, body, token);
}
export function removeMaterialSupplier(id, linkId, token) {
  return apiClient('DELETE', `/raw-materials/${id}/suppliers/${linkId}`, null, token);
}

// ---- Finished Products ----
export function getFinishedProducts(token, params) {
  return apiClient('GET', `/finished-products${qs(params)}`, null, token);
}
export function createFinishedProduct(body, token) {
  return apiClient('POST', '/finished-products', body, token);
}
export function updateFinishedProduct(id, body, token) {
  return apiClient('PUT', `/finished-products/${id}`, body, token);
}
export function deleteFinishedProduct(id, token) {
  return apiClient('DELETE', `/finished-products/${id}`, null, token);
}

// ---- Bills of Materials ----
export function getBoms(token, params) {
  return apiClient('GET', `/bills-of-materials${qs(params)}`, null, token);
}
export function getBom(id, token) {
  return apiClient('GET', `/bills-of-materials/${id}`, null, token);
}
export function createBom(body, token) {
  return apiClient('POST', '/bills-of-materials', body, token);
}
export function updateBom(id, body, token) {
  return apiClient('PUT', `/bills-of-materials/${id}`, body, token);
}
export function deleteBom(id, token) {
  return apiClient('DELETE', `/bills-of-materials/${id}`, null, token);
}

// ---- Raw Material Stock ----
export function getRawBatches(token, params) {
  return apiClient('GET', `/raw-material-stock/batches${qs(params)}`, null, token);
}
export function createRawBatch(body, token) {
  return apiClient('POST', '/raw-material-stock/batches', body, token);
}
export function updateRawBatch(id, body, token) {
  return apiClient('PUT', `/raw-material-stock/batches/${id}`, body, token);
}
export function getRawStockRows(token, params) {
  return apiClient('GET', `/raw-material-stock${qs(params)}`, null, token);
}
export function upsertRawStock(body, token) {
  return apiClient('POST', '/raw-material-stock/stock', body, token);
}
export function updateRawStockRow(id, body, token) {
  return apiClient('PUT', `/raw-material-stock/stock/${id}`, body, token);
}
export function getRawLedger(token, params) {
  return apiClient('GET', `/raw-material-stock/ledger${qs(params)}`, null, token);
}
export function getRawStockSummary(token) {
  return apiClient('GET', '/raw-material-stock/summary', null, token);
}
export function getRawLowStock(token) {
  return apiClient('GET', '/raw-material-stock/low-stock', null, token);
}

// ---- Finished Product Stock ----
export function getFinishedBatches(token, params) {
  return apiClient('GET', `/finished-product-stock/batches${qs(params)}`, null, token);
}
export function createFinishedBatch(body, token) {
  return apiClient('POST', '/finished-product-stock/batches', body, token);
}
export function updateFinishedBatch(id, body, token) {
  return apiClient('PUT', `/finished-product-stock/batches/${id}`, body, token);
}
export function getFinishedStockRows(token, params) {
  return apiClient('GET', `/finished-product-stock${qs(params)}`, null, token);
}
export function upsertFinishedStock(body, token) {
  return apiClient('POST', '/finished-product-stock/stock', body, token);
}
export function updateFinishedStockRow(id, body, token) {
  return apiClient('PUT', `/finished-product-stock/stock/${id}`, body, token);
}
export function getFinishedLedger(token, params) {
  return apiClient('GET', `/finished-product-stock/ledger${qs(params)}`, null, token);
}
export function getFinishedStockSummary(token) {
  return apiClient('GET', '/finished-product-stock/summary', null, token);
}
export function getFinishedLowStock(token) {
  return apiClient('GET', '/finished-product-stock/low-stock', null, token);
}

// ---- Purchase Requests ----
export function getPurchaseRequests(token, params) {
  return apiClient('GET', `/purchase-requests${qs(params)}`, null, token);
}
export function getPurchaseRequest(id, token) {
  return apiClient('GET', `/purchase-requests/${id}`, null, token);
}
export function createPurchaseRequest(body, token) {
  return apiClient('POST', '/purchase-requests', body, token);
}
export function updatePurchaseRequest(id, body, token) {
  return apiClient('PUT', `/purchase-requests/${id}`, body, token);
}
export function submitPurchaseRequest(id, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/submit`, {}, token);
}
export function approvePurchaseRequest(id, body, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/approve`, body, token);
}
export function rejectPurchaseRequest(id, body, token) {
  return apiClient('PATCH', `/purchase-requests/${id}/reject`, body, token);
}
export function deletePurchaseRequest(id, token) {
  return apiClient('DELETE', `/purchase-requests/${id}`, null, token);
}

// ---- Purchase Orders ----
export function getPurchaseOrders(token, params) {
  return apiClient('GET', `/purchase-orders${qs(params)}`, null, token);
}
export function getPurchaseOrder(id, token) {
  return apiClient('GET', `/purchase-orders/${id}`, null, token);
}
export function createPurchaseOrder(body, token) {
  return apiClient('POST', '/purchase-orders', body, token);
}
export function updatePurchaseOrder(id, body, token) {
  return apiClient('PUT', `/purchase-orders/${id}`, body, token);
}
export function submitPurchaseOrder(id, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/submit`, {}, token);
}
export function approvePurchaseOrder(id, body, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/approve`, body, token);
}
export function rejectPurchaseOrder(id, body, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/reject`, body, token);
}
export function cancelPurchaseOrder(id, token) {
  return apiClient('PATCH', `/purchase-orders/${id}/cancel`, {}, token);
}
export function deletePurchaseOrder(id, token) {
  return apiClient('DELETE', `/purchase-orders/${id}`, null, token);
}
export function addPurchaseOrderItem(orderId, body, token) {
  return apiClient('POST', `/purchase-orders/${orderId}/items`, body, token);
}
export function updatePurchaseOrderItem(orderId, itemId, body, token) {
  return apiClient('PUT', `/purchase-orders/${orderId}/items/${itemId}`, body, token);
}
export function deletePurchaseOrderItem(orderId, itemId, token) {
  return apiClient('DELETE', `/purchase-orders/${orderId}/items/${itemId}`, null, token);
}

// ---- Goods Receipts ----
export function getGoodsReceipts(token, params) {
  return apiClient('GET', `/goods-receipts${qs(params)}`, null, token);
}
export function getGoodsReceipt(id, token) {
  return apiClient('GET', `/goods-receipts/${id}`, null, token);
}
export function createGoodsReceipt(body, token) {
  return apiClient('POST', '/goods-receipts', body, token);
}
export function cancelGoodsReceipt(id, token) {
  return apiClient('PATCH', `/goods-receipts/${id}/cancel`, {}, token);
}

// ---- Quality Inspections ----
export function getQualityInspections(token, params) {
  return apiClient('GET', `/quality-inspections${qs(params)}`, null, token);
}
export function createQualityInspection(body, token) {
  return apiClient('POST', '/quality-inspections', body, token);
}

// ---- Production Orders ----
export function getProductionOrders(token, params) {
  return apiClient('GET', `/production-orders${qs(params)}`, null, token);
}
export function getProductionOrder(id, token) {
  return apiClient('GET', `/production-orders/${id}`, null, token);
}
export function createProductionOrder(body, token) {
  return apiClient('POST', '/production-orders', body, token);
}
export function updateProductionOrder(id, body, token) {
  return apiClient('PUT', `/production-orders/${id}`, body, token);
}
export function startProductionOrder(id, token) {
  return apiClient('PATCH', `/production-orders/${id}/start`, {}, token);
}
export function completeProductionOrder(id, token) {
  return apiClient('PATCH', `/production-orders/${id}/complete`, {}, token);
}
export function cancelProductionOrder(id, token) {
  return apiClient('PATCH', `/production-orders/${id}/cancel`, {}, token);
}
export function addProductionConsumption(id, body, token) {
  return apiClient('POST', `/production-orders/${id}/consumptions`, body, token);
}
export function addProductionWastage(id, body, token) {
  return apiClient('POST', `/production-orders/${id}/wastage`, body, token);
}
export function addProductionOutput(id, body, token) {
  return apiClient('POST', `/production-orders/${id}/outputs`, body, token);
}

// ---- Stock Transfers ----
export function getStockTransfers(token, params) {
  return apiClient('GET', `/stock-transfers${qs(params)}`, null, token);
}
export function getStockTransfer(id, token) {
  return apiClient('GET', `/stock-transfers/${id}`, null, token);
}
export function createStockTransfer(body, token) {
  return apiClient('POST', '/stock-transfers', body, token);
}
export function cancelStockTransfer(id, token) {
  return apiClient('PATCH', `/stock-transfers/${id}/cancel`, {}, token);
}

// ---- Stock Adjustments ----
export function getStockAdjustments(token, params) {
  return apiClient('GET', `/stock-adjustments${qs(params)}`, null, token);
}
export function getStockAdjustment(id, token) {
  return apiClient('GET', `/stock-adjustments/${id}`, null, token);
}
export function createStockAdjustment(body, token) {
  return apiClient('POST', '/stock-adjustments', body, token);
}
export function approveStockAdjustment(id, body, token) {
  return apiClient('PATCH', `/stock-adjustments/${id}/approve`, body, token);
}
export function rejectStockAdjustment(id, body, token) {
  return apiClient('PATCH', `/stock-adjustments/${id}/reject`, body, token);
}
export function applyStockAdjustment(id, token) {
  return apiClient('PATCH', `/stock-adjustments/${id}/apply`, {}, token);
}

// ---- Damage / Loss Reports ----
export function getDamageLossReports(token, params) {
  return apiClient('GET', `/damage-loss-reports${qs(params)}`, null, token);
}
export function getDamageLossReport(id, token) {
  return apiClient('GET', `/damage-loss-reports/${id}`, null, token);
}
export function createDamageLossReport(body, token) {
  return apiClient('POST', '/damage-loss-reports', body, token);
}
export function approveDamageLossReport(id, body, token) {
  return apiClient('PATCH', `/damage-loss-reports/${id}/approve`, body, token);
}
export function rejectDamageLossReport(id, body, token) {
  return apiClient('PATCH', `/damage-loss-reports/${id}/reject`, body, token);
}
export function applyDamageLossReport(id, token) {
  return apiClient('PATCH', `/damage-loss-reports/${id}/apply`, {}, token);
}

// ---- Notification Rules ----
export function getNotificationRules(token, params) {
  return apiClient('GET', `/inventory-notification-rules${qs(params)}`, null, token);
}
export function updateNotificationRule(id, body, token) {
  return apiClient('PUT', `/inventory-notification-rules/${id}`, body, token);
}

// ---- Machines ----
export function getMachines(token, params) {
  return apiClient('GET', `/machines${qs(params)}`, null, token);
}
export function getMachine(id, token) {
  return apiClient('GET', `/machines/${id}`, null, token);
}
export function createMachine(body, token) {
  return apiClient('POST', '/machines', body, token);
}
export function updateMachine(id, body, token) {
  return apiClient('PUT', `/machines/${id}`, body, token);
}
export function deleteMachine(id, token) {
  return apiClient('DELETE', `/machines/${id}`, null, token);
}
export function updateMachineStatus(id, status, token) {
  return apiClient('PATCH', `/machines/${id}/status`, { status }, token);
}
export function getMachineBreakdowns(id, token) {
  return apiClient('GET', `/machines/${id}/breakdowns`, null, token);
}
export function createMachineBreakdown(id, body, token) {
  return apiClient('POST', `/machines/${id}/breakdowns`, body, token);
}
export function resolveMachineBreakdown(breakdownId, body, token) {
  return apiClient('PATCH', `/machines/breakdowns/${breakdownId}/resolve`, body, token);
}
export function deleteMachineBreakdown(breakdownId, token) {
  return apiClient('DELETE', `/machines/breakdowns/${breakdownId}`, null, token);
}

// ---- Tools ----
export function getTools(token, params) {
  return apiClient('GET', `/tools${qs(params)}`, null, token);
}
export function getTool(id, token) {
  return apiClient('GET', `/tools/${id}`, null, token);
}
export function createTool(body, token) {
  return apiClient('POST', '/tools', body, token);
}
export function updateTool(id, body, token) {
  return apiClient('PUT', `/tools/${id}`, body, token);
}
export function deleteTool(id, token) {
  return apiClient('DELETE', `/tools/${id}`, null, token);
}
export function getToolStock(id, token) {
  return apiClient('GET', `/tools/${id}/stock`, null, token);
}
export function addToolStock(body, token) {
  return apiClient('POST', '/tools/stock', body, token);
}
export function updateToolStock(id, body, token) {
  return apiClient('PUT', `/tools/stock/${id}`, body, token);
}

// ---- Tool Assignments ----
export function getToolAssignments(token, params) {
  return apiClient('GET', `/tool-assignments${qs(params)}`, null, token);
}
export function getToolAssignment(id, token) {
  return apiClient('GET', `/tool-assignments/${id}`, null, token);
}
export function createToolAssignment(body, token) {
  return apiClient('POST', '/tool-assignments', body, token);
}
export function getToolReturns(id, token) {
  return apiClient('GET', `/tool-assignments/${id}/returns`, null, token);
}
export function createToolReturn(id, body, token) {
  return apiClient('POST', `/tool-assignments/${id}/returns`, body, token);
}
export function updateToolAssignmentStatus(id, status, token) {
  return apiClient('PATCH', `/tool-assignments/${id}/status`, { status }, token);
}

// ---- Customers ----
export function getCustomers(token, params) {
  return apiClient('GET', `/customers${qs(params)}`, null, token);
}

// ---- Sales Orders ----
export function getSalesOrders(token, params) {
  return apiClient('GET', `/sales-orders${qs(params)}`, null, token);
}
export function getSalesOrder(id, token) {
  return apiClient('GET', `/sales-orders/${id}`, null, token);
}
export function createSalesOrder(body, token) {
  return apiClient('POST', '/sales-orders', body, token);
}
export function updateSalesOrder(id, body, token) {
  return apiClient('PUT', `/sales-orders/${id}`, body, token);
}
export function submitSalesOrder(id, token) {
  return apiClient('PATCH', `/sales-orders/${id}/submit`, {}, token);
}
export function approveSalesOrder(id, body, token) {
  return apiClient('PATCH', `/sales-orders/${id}/approve`, body, token);
}
export function rejectSalesOrder(id, body, token) {
  return apiClient('PATCH', `/sales-orders/${id}/reject`, body, token);
}
export function cancelSalesOrder(id, token) {
  return apiClient('PATCH', `/sales-orders/${id}/cancel`, {}, token);
}
export function deleteSalesOrder(id, token) {
  return apiClient('DELETE', `/sales-orders/${id}`, null, token);
}
export function addSalesOrderItem(orderId, body, token) {
  return apiClient('POST', `/sales-orders/${orderId}/items`, body, token);
}
export function updateSalesOrderItem(orderId, itemId, body, token) {
  return apiClient('PUT', `/sales-orders/${orderId}/items/${itemId}`, body, token);
}
export function deleteSalesOrderItem(orderId, itemId, token) {
  return apiClient('DELETE', `/sales-orders/${orderId}/items/${itemId}`, null, token);
}