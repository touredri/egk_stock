import { api } from '../services/api.js';
import { openConfirm, openModal, showToast, paginationTemplate, bindPagination } from '../components/ui.js';

const state = { q: '', page: 1, limit: 10 };

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

function clientFormBody(client = {}) {
  return `
    <div class="form-grid">
      <label class="field">Nom
        <input name="nom" required value="${esc(client.nom)}" />
      </label>
      <label class="field">Prénom
        <input name="prenom" required value="${esc(client.prenom)}" />
      </label>
      <label class="field">Ville
        <input name="ville" required value="${esc(client.ville)}" />
      </label>
      <label class="field">Téléphone
        <input name="telephone" required value="${esc(client.telephone)}" />
      </label>
    </div>
  `;
}

export async function renderClients(container) {
  applyHashSearchState();
  const result = await api.getClients(state);

  container.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <input id="search-clients" placeholder="Rechercher un client..." value="${state.q}" style="max-width:300px;" />
        <button id="add-client" class="btn btn-primary">+ Ajouter client</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th>Prénom</th><th>Ville</th><th>Téléphone</th><th>Actions</th></tr></thead>
          <tbody>
            ${result.data
              .map(
                (c) => `
              <tr>
                <td>${c.id_client}</td>
                <td>${c.nom}</td>
                <td>${c.prenom}</td>
                <td>${c.ville}</td>
                <td>${c.telephone}</td>
                <td class="actions">
                  <button class="btn btn-light" data-edit="${c.id_client}" title="Modifier le client" aria-label="Modifier le client"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
                  <button class="btn btn-danger" data-delete="${c.id_client}" title="Supprimer le client" aria-label="Supprimer le client"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
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

  container.querySelector('#search-clients').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 1;
    renderClients(container);
  });

  bindPagination(container, result.pagination, (page) => {
    state.page = page;
    renderClients(container);
  });

  container.querySelector('#add-client').addEventListener('click', () => {
    openModal({
      title: 'Ajouter client',
      body: clientFormBody(),
      onSubmit: async (formData, close) => {
        await api.createClient({
          nom: formData.get('nom'),
          prenom: formData.get('prenom'),
          ville: formData.get('ville'),
          telephone: formData.get('telephone')
        });
        close();
        showToast('Client ajouté');
        renderClients(container);
      }
    });
  });

  result.data.forEach((client) => {
    container.querySelector(`[data-edit="${client.id_client}"]`)?.addEventListener('click', () => {
      openModal({
        title: `Modifier client #${client.id_client}`,
        body: clientFormBody(client),
        onSubmit: async (formData, close) => {
          await api.updateClient(client.id_client, {
            nom: formData.get('nom'),
            prenom: formData.get('prenom'),
            ville: formData.get('ville'),
            telephone: formData.get('telephone')
          });
          close();
          showToast('Client mis à jour');
          renderClients(container);
        }
      });
    });

    container.querySelector(`[data-delete="${client.id_client}"]`)?.addEventListener('click', () => {
      openConfirm({
        message: `Supprimer le client ${client.nom} ${client.prenom} ?`,
        onConfirm: async () => {
          await api.deleteClient(client.id_client);
          showToast('Client supprimé');
          renderClients(container);
        }
      });
    });
  });
}
