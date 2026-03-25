const modalRoot = () => document.getElementById('modal-root');
const toastRoot = () => document.getElementById('toast-root');

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastRoot().appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

export function openModal({ title, body, submitText = 'Enregistrer', onSubmit, onOpen }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-overlay';
  wrapper.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="btn btn-light" data-close>✕</button>
      </div>
      <form class="modal-body" id="app-modal-form">
        ${body}
        <div class="modal-actions">
          <button type="button" class="btn btn-light" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">${submitText}</button>
        </div>
      </form>
    </div>
  `;

  const close = () => wrapper.remove();
  wrapper.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  wrapper.addEventListener('click', (event) => {
    if (event.target === wrapper) close();
  });

  wrapper.querySelector('#app-modal-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      await onSubmit(formData, close, wrapper);
    } catch (error) {
      showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
  });

  modalRoot().appendChild(wrapper);
  if (typeof onOpen === 'function') onOpen(wrapper);
  return close;
}

export function openConfirm({ title = 'Confirmation', message, onConfirm }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-overlay';
  wrapper.innerHTML = `
    <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header"><h3>${title}</h3></div>
      <div class="modal-body"><p>${message}</p></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-light" data-cancel>Annuler</button>
        <button type="button" class="btn btn-danger" data-confirm>Confirmer</button>
      </div>
    </div>
  `;

  const close = () => wrapper.remove();
  wrapper.querySelector('[data-cancel]').addEventListener('click', close);
  wrapper.querySelector('[data-confirm]').addEventListener('click', async () => {
    try {
      await onConfirm();
      close();
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
    }
  });

  wrapper.addEventListener('click', (event) => {
    if (event.target === wrapper) close();
  });

  modalRoot().appendChild(wrapper);
}

export function paginationTemplate(pagination) {
  if (!pagination || pagination.totalPages <= 1) return '';

  return `
    <div class="pagination" data-pagination>
      <button class="btn btn-light" data-page="prev" ${pagination.page <= 1 ? 'disabled' : ''}>Précédent</button>
      <span>Page ${pagination.page}/${pagination.totalPages}</span>
      <button class="btn btn-light" data-page="next" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Suivant</button>
    </div>
  `;
}

export function bindPagination(container, pagination, onChange) {
  if (!pagination || pagination.totalPages <= 1) return;
  const root = container.querySelector('[data-pagination]');
  if (!root) return;

  root.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
    if (pagination.page > 1) onChange(pagination.page - 1);
  });

  root.querySelector('[data-page="next"]')?.addEventListener('click', () => {
    if (pagination.page < pagination.totalPages) onChange(pagination.page + 1);
  });
}

export function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function stockBadge(status) {
  if (status === 'LOW') return '<span class="badge badge-low">Bas</span>';
  if (status === 'HIGH') return '<span class="badge badge-high">Haut</span>';
  return '<span class="badge badge-ok">OK</span>';
}
