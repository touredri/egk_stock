import { api } from '../services/api.js';
import { openConfirm, openModal, showToast, paginationTemplate, bindPagination, stockBadge, formatMoney } from '../components/ui.js';

const state = { q: '', page: 1, limit: 10, stock_status: '' };

function applyHashSearchState() {
  const query = location.hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  const q = params.get('q');
  if (q !== null && q !== state.q) {
    state.q = q;
    state.page = 1;
  }
}

function esc(value) {
  return String(value ?? '').replaceAll('"', '&quot;');
}

function productFormBody(product = {}) {
  return `
    <div class="form-grid">
      <label class="field">Libellé
        <input name="libelle" required value="${esc(product.libelle)}" />
      </label>
      <label class="field">Prix unitaire
        <input name="pu" type="number" min="1" required value="${esc(product.pu)}" />
      </label>
      <label class="field">Stock min
        <input name="stock_min" type="number" min="0" required value="${esc(product.stock_min)}" />
      </label>
      <label class="field">Stock max
        <input name="stock_max" type="number" min="0" required value="${esc(product.stock_max)}" />
      </label>
    </div>
  `;
}

export async function renderProducts(container) {
  applyHashSearchState();
  const result = await api.getProducts(state);

  container.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <input id="search-products" placeholder="Rechercher un produit..." value="${state.q}" style="max-width:300px;" />
        <select id="filter-products-status" style="max-width:220px;">
          <option value="">Tous les statuts</option>
          <option value="LOW" ${state.stock_status === 'LOW' ? 'selected' : ''}>Stock bas</option>
          <option value="OK" ${state.stock_status === 'OK' ? 'selected' : ''}>Stock normal</option>
          <option value="HIGH" ${state.stock_status === 'HIGH' ? 'selected' : ''}>Surstock</option>
        </select>
        <button id="add-product" class="btn btn-primary">+ Ajouter produit</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Libellé</th>
              <th>PU</th>
              <th>Stock</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${result.data
              .map(
                (p) => `
              <tr>
                <td>${p.id_prod}</td>
                <td>${p.libelle}</td>
                <td>${formatMoney(p.pu)}</td>
                <td>${p.stock_actuel} (min ${p.stock_min} / max ${p.stock_max})</td>
                <td>${stockBadge(p.stock_status)}</td>
                <td class="actions">
                  <button class="btn btn-light" data-edit="${p.id_prod}" title="Modifier le produit" aria-label="Modifier le produit"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
                  <button class="btn btn-danger" data-delete="${p.id_prod}" title="Supprimer le produit" aria-label="Supprimer le produit"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
                  <button class="btn btn-light" data-sheet="${p.id_prod}">Fiche</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      ${paginationTemplate(result.pagination)}
    </section>
  `;

  const searchInput = container.querySelector('#search-products');
  searchInput.addEventListener('input', () => {
    state.q = searchInput.value;
    state.page = 1;
    renderProducts(container);
  });

  container.querySelector('#filter-products-status')?.addEventListener('change', (event) => {
    state.stock_status = event.target.value;
    state.page = 1;
    renderProducts(container);
  });

  bindPagination(container, result.pagination, (page) => {
    state.page = page;
    renderProducts(container);
  });

  container.querySelector('#add-product').addEventListener('click', () => {
    openModal({
      title: 'Ajouter produit',
      body: productFormBody(),
      onSubmit: async (formData, close) => {
        await api.createProduct({
          libelle: formData.get('libelle'),
          pu: Number(formData.get('pu')),
          stock_min: Number(formData.get('stock_min')),
          stock_max: Number(formData.get('stock_max'))
        });
        close();
        showToast('Produit ajouté');
        renderProducts(container);
      }
    });
  });

  result.data.forEach((product) => {
    container.querySelector(`[data-edit="${product.id_prod}"]`)?.addEventListener('click', () => {
      openModal({
        title: `Modifier #${product.id_prod}`,
        body: productFormBody(product),
        onSubmit: async (formData, close) => {
          await api.updateProduct(product.id_prod, {
            libelle: formData.get('libelle'),
            pu: Number(formData.get('pu')),
            stock_min: Number(formData.get('stock_min')),
            stock_max: Number(formData.get('stock_max'))
          });
          close();
          showToast('Produit mis à jour');
          renderProducts(container);
        }
      });
    });

    container.querySelector(`[data-delete="${product.id_prod}"]`)?.addEventListener('click', () => {
      openConfirm({
        message: `Supprimer le produit ${product.libelle} ?`,
        onConfirm: async () => {
          await api.deleteProduct(product.id_prod);
          showToast('Produit supprimé');
          renderProducts(container);
        }
      });
    });

    container.querySelector(`[data-sheet="${product.id_prod}"]`)?.addEventListener('click', () => {
      location.hash = `#/stocksheet?id=${product.id_prod}`;
    });
  });
}
