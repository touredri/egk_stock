const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const message = payload?.error?.message || 'Erreur réseau';
    throw new Error(message);
  }

  return payload;
}

export const api = {
  getDashboard: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/dashboard/kpis${query ? `?${query}` : ''}`);
  },
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit${query ? `?${query}` : ''}`);
  },
  getBackups: () => request('/system/backups'),
  createBackup: () => request('/system/backups', { method: 'POST' }),
  restoreBackup: (file_name) =>
    request('/system/backups/restore', { method: 'POST', body: JSON.stringify({ file_name }) }),
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products${query ? `?${query}` : ''}`);
  },
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getClients: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/clients${query ? `?${query}` : ''}`);
  },
  createClient: (body) => request('/clients', { method: 'POST', body: JSON.stringify(body) }),
  updateClient: (id, body) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  getMouvements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/mouvements${query ? `?${query}` : ''}`);
  },
  createMouvement: (body) => request('/mouvements', { method: 'POST', body: JSON.stringify(body) }),
  updateMouvement: (numOp, idProd, body) =>
    request(`/mouvements/${numOp}/${idProd}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMouvement: (numOp, idProd) => request(`/mouvements/${numOp}/${idProd}`, { method: 'DELETE' }),

  getCommandes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/commandes${query ? `?${query}` : ''}`);
  },
  getCommande: (id) => request(`/commandes/${id}`),
  getCommandeHistory: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/commandes/${id}/history${query ? `?${query}` : ''}`);
  },
  createCommande: (body) => request('/commandes', { method: 'POST', body: JSON.stringify(body) }),
  updateCommande: (id, body) => request(`/commandes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCommande: (id) => request(`/commandes/${id}`, { method: 'DELETE' }),
  validateCommande: (id) => request(`/commandes/${id}/validate`, { method: 'PUT' }),
  updateCommandeStatus: (id, statut_com) =>
    request(`/commandes/${id}/status`, { method: 'PUT', body: JSON.stringify({ statut_com }) }),

  getStockSheet: (idProd) => request(`/stocksheet/${idProd}`)
};
