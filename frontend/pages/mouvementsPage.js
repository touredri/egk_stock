import { api } from '../services/api.js';
import { openConfirm, openModal, showToast, paginationTemplate, bindPagination } from '../components/ui.js';

const state = { q: '', page: 1, limit: 10, type_mvt: '', date_from: '', date_to: '', id_prod: '' };

function getHashAction() {
  const query = location.hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  return params.get('action') || '';
}

function applyHashSearchState() {
  const query = location.hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  const q = params.get('q');
  if (q !== null && q !== state.q) {
    state.q = q;
    state.page = 1;
  }
}

function clearHashQuery(baseHash) {
  const url = new URL(window.location.href);
  url.hash = baseHash;
  history.replaceState(null, '', url);
}

function rowTemplate(productOptions, { forcedType = '', initial = null } = {}) {
  const selectedType = initial?.type_mvt || forcedType;
  const selectedEntree = selectedType === 'ENTREE' ? 'selected' : '';
  const selectedSortie = selectedType === 'SORTIE' ? 'selected' : '';
  const selectedProd = initial?.id_prod;
  const initialQty = initial?.qte_op || '';
  const initialLabel = initial?.lib_op || '';

  return `
    <div class="form-grid">
      <label class="field">Produit
        <select name="id_prod" required>
          ${productOptions.replace(
            `value="${selectedProd}"`,
            `value="${selectedProd}" selected`
          )}
        </select>
      </label>
      <label class="field">Type
        <select name="type_mvt" required>
          <option value="ENTREE" ${selectedEntree}>ENTREE</option>
          <option value="SORTIE" ${selectedSortie}>SORTIE</option>
        </select>
      </label>
      <label class="field">Quantité
        <input type="number" name="qte_op" min="1" required value="${initialQty}" />
      </label>
      <label class="field">Libellé opération
        <input name="lib_op" placeholder="Ex: Réapprovisionnement dépôt" value="${initialLabel}" />
      </label>
    </div>
    <div class="stock-preview" id="stock-preview" style="margin-top:0.7rem;"></div>
  `;
}

function openMovementModal(container, products, options = {}) {
  const { forcedType = '', initial = null } = options;
  const productOptions = products
    .map((p) => `<option value="${p.id_prod}">${p.libelle} (stock ${p.stock_actuel})</option>`)
    .join('');

  const productById = new Map(products.map((p) => [String(p.id_prod), p]));

  openModal({
    title: initial ? `Modifier mouvement #${initial.num_op}` : 'Créer mouvement',
    submitText: initial ? 'Mettre à jour' : 'Créer',
    body: rowTemplate(productOptions, { forcedType, initial }),
    onOpen: (wrapper) => {
      const typeInput = wrapper.querySelector('[name="type_mvt"]');
      const productInput = wrapper.querySelector('[name="id_prod"]');
      const qtyInput = wrapper.querySelector('[name="qte_op"]');
      const preview = wrapper.querySelector('#stock-preview');
      const submit = wrapper.querySelector('button[type="submit"]');

      const refreshPreview = () => {
        const product = productById.get(productInput?.value || '');
        const type = typeInput?.value || 'ENTREE';
        const qty = Math.max(0, Number(qtyInput?.value) || 0);
        if (!product || !preview || !submit) return;

        const currentRaw = Number(product.stock_actuel) || 0;
        const previousEffect =
          initial && Number(initial.id_prod) === Number(product.id_prod)
            ? (initial.type_mvt === 'ENTREE' ? Number(initial.qte_op) : -Number(initial.qte_op))
            : 0;
        const current = initial ? currentRaw - previousEffect : currentRaw;
        const next = type === 'ENTREE' ? current + qty : current - qty;
        const wouldGoBelowMin = type === 'SORTIE' && qty > 0 && next < Number(product.stock_min);
        const wouldGoNegative = type === 'SORTIE' && qty > current;
        const shouldBlock = wouldGoBelowMin || wouldGoNegative;

        if (type !== 'SORTIE') {
          preview.innerHTML = `<p style="margin:0; color:var(--muted);">Prévisualisation stock après entrée: <strong>${next}</strong> (actuel simulé: ${current})</p>`;
          submit.disabled = false;
          return;
        }

        let msg = `Prévisualisation sortie: actuel <strong>${current}</strong> → après opération <strong>${next}</strong> (min: ${product.stock_min})`;
        if (wouldGoNegative) {
          msg += `<br/><span style="color:var(--danger);">Refus probable: quantité supérieure au stock disponible.</span>`;
        } else if (wouldGoBelowMin) {
          msg += `<br/><span style="color:var(--danger);">Refus probable: le stock passerait sous le minimum autorisé.</span>`;
        } else if (qty > 0 && next <= Number(product.stock_min) + 2) {
          msg += `<br/><span style="color:var(--warning);">Attention: niveau proche du stock minimum.</span>`;
        }

        preview.innerHTML = `<p style="margin:0;">${msg}</p>`;
        submit.disabled = shouldBlock;
      };

      typeInput?.addEventListener('change', refreshPreview);
      productInput?.addEventListener('change', refreshPreview);
      qtyInput?.addEventListener('input', refreshPreview);
      refreshPreview();
    },
    onSubmit: async (formData, close) => {
      const payload = {
        id_prod: Number(formData.get('id_prod')),
        type_mvt: formData.get('type_mvt'),
        qte_op: Number(formData.get('qte_op')),
        lib_op: formData.get('lib_op')
      };

      if (initial) {
        await api.updateMouvement(initial.num_op, initial.id_prod, payload);
      } else {
        await api.createMouvement(payload);
      }

      close();
      showToast(initial ? 'Mouvement mis à jour' : 'Mouvement enregistré');
      renderMouvements(container);
    }
  });
}

export async function renderMouvements(container) {
  applyHashSearchState();
  const [result, products] = await Promise.all([
    api.getMouvements(state),
    api.getProducts({ page: 1, limit: 300 })
  ]);

  container.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <input id="search-mouvements" placeholder="Rechercher mouvement..." value="${state.q}" style="max-width:300px;" />
        <select id="filter-mvt-type" style="max-width:160px;">
          <option value="">Tous types</option>
          <option value="ENTREE" ${state.type_mvt === 'ENTREE' ? 'selected' : ''}>ENTREE</option>
          <option value="SORTIE" ${state.type_mvt === 'SORTIE' ? 'selected' : ''}>SORTIE</option>
        </select>
        <select id="filter-mvt-product" style="max-width:260px;">
          <option value="">Tous produits</option>
          ${products.data
            .map(
              (p) =>
                `<option value="${p.id_prod}" ${String(state.id_prod) === String(p.id_prod) ? 'selected' : ''}>${p.libelle}</option>`
            )
            .join('')}
        </select>
        <input id="filter-mvt-from" type="date" value="${state.date_from}" style="max-width:170px;" />
        <input id="filter-mvt-to" type="date" value="${state.date_to}" style="max-width:170px;" />
        <button id="add-mouvement" class="btn btn-primary">+ Nouveau mouvement</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Op</th><th>Date</th><th>Produit</th><th>Type</th><th>Qte</th><th>Libellé</th><th>Actions</th></tr></thead>
          <tbody>
            ${result.data
              .map(
                (m) => `
              <tr>
                <td>${m.num_op}</td>
                <td>${new Date(m.date_op).toLocaleString('fr-FR')}</td>
                <td>${m.libelle}</td>
                <td>${m.type_mvt}</td>
                <td>${m.qte_op}</td>
                <td>${m.lib_op}</td>
                <td class="actions">
                <button class="btn btn-light" data-edit-mvt="${m.num_op}-${m.id_prod}" title="Modifier le mouvement" aria-label="Modifier le mouvement"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
                <button class="btn btn-danger" data-delete-mvt="${m.num_op}-${m.id_prod}" title="Supprimer le mouvement" aria-label="Supprimer le mouvement"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
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

  container.querySelector('#search-mouvements').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 1;
    renderMouvements(container);
  });

  container.querySelector('#filter-mvt-type')?.addEventListener('change', (event) => {
    state.type_mvt = event.target.value;
    state.page = 1;
    renderMouvements(container);
  });

  container.querySelector('#filter-mvt-product')?.addEventListener('change', (event) => {
    state.id_prod = event.target.value;
    state.page = 1;
    renderMouvements(container);
  });

  container.querySelector('#filter-mvt-from')?.addEventListener('change', (event) => {
    state.date_from = event.target.value;
    state.page = 1;
    renderMouvements(container);
  });

  container.querySelector('#filter-mvt-to')?.addEventListener('change', (event) => {
    state.date_to = event.target.value;
    state.page = 1;
    renderMouvements(container);
  });

  bindPagination(container, result.pagination, (page) => {
    state.page = page;
    renderMouvements(container);
  });

  container.querySelector('#add-mouvement').addEventListener('click', () => {
    openMovementModal(container, products.data);
  });

  result.data.forEach((movement) => {
    const key = `${movement.num_op}-${movement.id_prod}`;

    container.querySelector(`[data-edit-mvt="${key}"]`)?.addEventListener('click', () => {
      openMovementModal(container, products.data, { initial: movement });
    });

    container.querySelector(`[data-delete-mvt="${key}"]`)?.addEventListener('click', () => {
      openConfirm({
        title: `Supprimer mouvement #${movement.num_op}`,
        message: `Confirmer la suppression du mouvement ${movement.type_mvt} (${movement.libelle}) ?`,
        onConfirm: async () => {
          await api.deleteMouvement(movement.num_op, movement.id_prod);
          showToast('Mouvement supprimé');
          renderMouvements(container);
        }
      });
    });
  });

  const action = getHashAction();
  if (action === 'entree' || action === 'sortie') {
    clearHashQuery('#/mouvements');
    openMovementModal(container, products.data, { forcedType: action === 'entree' ? 'ENTREE' : 'SORTIE' });
  }
}
