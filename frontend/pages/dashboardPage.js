import { api } from '../services/api.js';
import { openConfirm, openModal, showToast } from '../components/ui.js';
import { downloadCsv } from '../components/csvExport.js';
import { bindPagination, paginationTemplate } from '../components/ui.js';

const dashboardState = {
  delay_days: 2,
  audit_q: '',
  audit_action: '',
  audit_entity_type: '',
  audit_date_from: '',
  audit_date_to: '',
  audit_page: 1,
  audit_limit: 8
};

function asDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR');
}

function urgentActions(data) {
  const rows = [];

  (data.todayItems?.commandesBrouillon || []).slice(0, 4).forEach((c) => {
    rows.push({
      level: 'normal',
      title: `Commande brouillon #${c.num_com}`,
      detail: `${c.nom} ${c.prenom} — créée le ${asDate(c.date_com)}`,
      hash: `#/commandes?q=${encodeURIComponent(c.num_com)}`
    });
  });

  (data.delayedDeliveries?.items || []).slice(0, 4).forEach((c) => {
    rows.push({
      level: 'high',
      title: `Retard livraison #${c.num_com}`,
      detail: `${c.nom} ${c.prenom} — validée le ${asDate(c.date_validation || c.date_com)}`,
      hash: `#/commandes?q=${encodeURIComponent(c.num_com)}`
    });
  });

  (data.todayItems?.stocksCritiques || []).slice(0, 4).forEach((p) => {
    rows.push({
      level: 'high',
      title: `Stock critique produit #${p.id_prod}`,
      detail: `${p.libelle} — stock ${p.stock_actuel} (min ${p.stock_min})`,
      hash: `#/products?q=${encodeURIComponent(p.id_prod)}`
    });
  });

  return rows.slice(0, 8);
}

function deliveryQueueRows(data) {
  return (data.todayItems?.commandesALivrer || []).slice(0, 8);
}

function auditTarget(auditRow) {
  if (!auditRow.entity_id) return null;
  if (auditRow.entity_type === 'Commande') {
    return { label: `Ouvrir commande #${auditRow.entity_id}`, hash: `#/commandes?q=${encodeURIComponent(auditRow.entity_id)}` };
  }
  if (auditRow.entity_type === 'Product') {
    return { label: `Ouvrir produit #${auditRow.entity_id}`, hash: `#/products?q=${encodeURIComponent(auditRow.entity_id)}` };
  }
  if (auditRow.entity_type === 'Client') {
    return { label: `Ouvrir client #${auditRow.entity_id}`, hash: `#/clients?q=${encodeURIComponent(auditRow.entity_id)}` };
  }
  if (auditRow.entity_type === 'Mouvement') {
    return { label: `Ouvrir opération #${auditRow.entity_id}`, hash: `#/mouvements?q=${encodeURIComponent(auditRow.entity_id)}` };
  }
  return null;
}

function openAuditDrawer(auditRow) {
  const existing = document.querySelector('[data-audit-drawer]');
  if (existing) existing.remove();

  const target = auditTarget(auditRow);

  const wrapper = document.createElement('div');
  wrapper.className = 'drawer-overlay';
  wrapper.setAttribute('data-audit-drawer', '1');
  wrapper.innerHTML = `
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Détail audit">
      <div class="modal-header">
        <h3>Détail audit #${auditRow.id_audit}</h3>
        <button type="button" class="btn btn-light" data-close-drawer>✕</button>
      </div>
      <div class="card" style="margin-bottom:0.8rem;">
        <p><strong>Date:</strong> ${asDate(auditRow.date_audit)}</p>
        <p><strong>Action:</strong> ${auditRow.action}</p>
        <p><strong>Entité:</strong> ${auditRow.entity_type}${auditRow.entity_id ? ` #${auditRow.entity_id}` : ''}</p>
        <p><strong>Détail:</strong> ${auditRow.detail || '-'}</p>
      </div>
      <div class="actions">
        ${target ? `<button class="btn btn-primary" data-go-target>${target.label}</button>` : ''}
        <button class="btn btn-light" data-go-commandes>Voir commandes</button>
        <button class="btn btn-light" data-go-produits>Voir produits</button>
        <button class="btn btn-light" data-go-mouvements>Voir mouvements</button>
      </div>
    </aside>
  `;
  wrapper.querySelector('[data-go-target]')?.addEventListener('click', () => {
    if (!target) return;
    close();
    location.hash = target.hash;
  });


  const close = () => wrapper.remove();
  wrapper.querySelector('[data-close-drawer]')?.addEventListener('click', close);
  wrapper.addEventListener('click', (event) => {
    if (event.target === wrapper) close();
  });

  wrapper.querySelector('[data-go-commandes]')?.addEventListener('click', () => {
    close();
    location.hash = '#/commandes';
  });
  wrapper.querySelector('[data-go-produits]')?.addEventListener('click', () => {
    close();
    location.hash = '#/products';
  });
  wrapper.querySelector('[data-go-mouvements]')?.addEventListener('click', () => {
    close();
    location.hash = '#/mouvements';
  });

  document.body.appendChild(wrapper);
}

export async function renderDashboard(container) {
  const [{ data }, audit] = await Promise.all([
    api.getDashboard({ delay_days: dashboardState.delay_days }),
    api.getAuditLogs({
      q: dashboardState.audit_q,
      action: dashboardState.audit_action,
      entity_type: dashboardState.audit_entity_type,
      date_from: dashboardState.audit_date_from,
      date_to: dashboardState.audit_date_to,
      page: dashboardState.audit_page,
      limit: dashboardState.audit_limit
    })
  ]);
  const urgent = urgentActions(data);
  const deliveryQueue = deliveryQueueRows(data);

  container.innerHTML = `
    <div class="dashboard-top-grid" style="margin-bottom:1rem;">
      <div class="card">
        <h3>⚡ Actions rapides</h3>
        <div class="actions" style="margin-top:0.6rem;">
          <button class="btn btn-primary" id="quick-entry">+ Entrée stock</button>
          <button class="btn btn-light" id="quick-exit">+ Sortie stock</button>
          <button class="btn btn-light" id="quick-order">+ Nouvelle commande</button>
        </div>
      </div>

      <div class="card">
        <h3>⬇️ Exports CSV</h3>
        <div class="actions" style="margin-top:0.6rem;">
          <button class="btn btn-light" id="export-products">Produits CSV</button>
          <button class="btn btn-light" id="export-clients">Clients CSV</button>
          <button class="btn btn-light" id="export-mouvements">Mouvements CSV</button>
          <button class="btn btn-light" id="export-commandes">Commandes CSV</button>
        </div>
      </div>

      <div class="card">
        <h3>💾 Sauvegarde & restauration</h3>
        <div class="actions" style="margin-top:0.6rem;">
          <button class="btn btn-light" id="backup-create">Créer une sauvegarde</button>
          <button class="btn btn-light" id="backup-restore">Restaurer une sauvegarde</button>
        </div>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:1rem;">
      <article class="kpi"><h3>Produits</h3><strong>${data.totalProducts}</strong></article>
      <article class="kpi"><h3>Mouvements</h3><strong>${data.totalMouvements}</strong></article>
      <article class="kpi"><h3>Commandes</h3><strong>${data.totalCommandes}</strong></article>
    </div>

    <div class="card" style="margin-bottom:1rem;">
      <h3>🚨 Actions urgentes</h3>
      ${
        urgent.length
          ? `<div class="table-wrap" style="margin-top:0.6rem;">
              <table>
                <thead><tr><th>Type</th><th>Détail</th><th></th></tr></thead>
                <tbody>
                  ${urgent
                    .map(
                      (item, idx) => `<tr>
                        <td>${item.level === 'high' ? 'Priorité haute' : 'À traiter'}</td>
                        <td><strong>${item.title}</strong><br/><span style="color:var(--muted);">${item.detail}</span></td>
                        <td><button class="btn btn-light" data-urgent-go="${idx}">Ouvrir</button></td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : '<p style="margin-top:0.5rem;">Aucune action urgente détectée.</p>'
      }
    </div>

    <div class="card" style="margin-bottom:1rem;">
      <h3>🚚 File d’attente livraisons</h3>
      ${
        deliveryQueue.length
          ? `<div class="table-wrap" style="margin-top:0.6rem;">
              <table>
                <thead><tr><th>Commande</th><th>Client</th><th>Validation</th><th></th></tr></thead>
                <tbody>
                  ${deliveryQueue
                    .map(
                      (row) => `<tr>
                        <td>#${row.num_com}</td>
                        <td>${row.nom} ${row.prenom}</td>
                        <td>${asDate(row.date_validation || row.date_com)}</td>
                        <td>
                          <button class="btn btn-primary" data-deliver-now="${row.num_com}">Livrer</button>
                          <button class="btn btn-light" data-open-delivery="${row.num_com}">Ouvrir</button>
                        </td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : '<p style="margin-top:0.5rem;">Aucune commande en attente de livraison.</p>'
      }
    </div>

    <div class="card" style="margin-bottom:1rem;">
      <h3>📌 À traiter aujourd’hui</h3>
      <div class="form-grid" style="margin-top:0.6rem;">
        <div>
          <strong>Commandes brouillon</strong>
          ${
            data.todayItems?.commandesBrouillon?.length
              ? `<ul>${data.todayItems.commandesBrouillon
                  .map((c) => `<li>#${c.num_com} - ${c.nom} ${c.prenom}</li>`)
                  .join('')}</ul>`
              : '<p>Aucune commande brouillon.</p>'
          }
        </div>
        <div>
          <strong>Commandes à livrer</strong>
          ${
            data.todayItems?.commandesALivrer?.length
              ? `<ul>${data.todayItems.commandesALivrer
                  .map((c) => `<li>#${c.num_com} - ${c.nom} ${c.prenom}</li>`)
                  .join('')}</ul>`
              : '<p>Aucune commande à livrer.</p>'
          }
        </div>
      </div>
      <div style="margin-top:0.4rem;">
        <strong>Stocks critiques:</strong>
        ${data.todayItems?.stocksCritiques?.length ? data.todayItems.stocksCritiques.length : 0}
      </div>
    </div>

    <div class="dashboard-alerts-grid" style="margin-bottom:1rem;">
      <div class="card">
        <h3>⏱️ Retards livraison</h3>
        <div class="toolbar" style="margin-top:0.6rem;">
          <label class="field" style="max-width:260px;">
            Retard au-delà de (jours)
            <input id="delay-days" type="number" min="0" value="${dashboardState.delay_days}" />
          </label>
        </div>
        ${
          data.delayedDeliveries?.items?.length
            ? `<ul>${data.delayedDeliveries.items
                .map((c) => `<li>#${c.num_com} - ${c.nom} ${c.prenom} (validée le ${asDate(c.date_validation || c.date_com)})</li>`)
                .join('')}</ul>`
            : '<p>Aucun retard détecté selon le seuil courant.</p>'
        }
      </div>

      <div class="card">
        <h3>⚠️ Alertes stock bas</h3>
        ${
          data.lowStock.length === 0
            ? '<p>Aucune alerte stock bas.</p>'
            : `<ul>${data.lowStock
                .map((p) => `<li>${p.libelle} — ${p.stock_actuel} (min: ${p.stock_min})</li>`)
                .join('')}</ul>`
        }
      </div>

      <div class="card">
        <h3>🟠 Alertes surstock</h3>
        ${
          data.overStock.length === 0
            ? '<p>Aucune alerte surstock.</p>'
            : `<ul>${data.overStock
                .map((p) => `<li>${p.libelle} — ${p.stock_actuel} (max: ${p.stock_max})</li>`)
                .join('')}</ul>`
        }
      </div>
    </div>

    <div class="card" style="margin-top:1rem;">
      <h3>🧾 Journal d’audit récent</h3>
      <div class="toolbar" style="margin-top:0.6rem;">
        <input id="audit-search" placeholder="Rechercher (action, détail, id)..." value="${dashboardState.audit_q}" style="max-width:280px;" />
        <select id="audit-action" style="max-width:220px;">
          <option value="">Toutes actions</option>
          ${[
            'CREATE_PRODUCT',
            'UPDATE_PRODUCT',
            'DELETE_PRODUCT',
            'CREATE_CLIENT',
            'UPDATE_CLIENT',
            'DELETE_CLIENT',
            'CREATE_MOUVEMENT',
            'UPDATE_MOUVEMENT',
            'DELETE_MOUVEMENT',
            'CREATE_COMMANDE',
            'UPDATE_COMMANDE',
            'DELETE_COMMANDE',
            'VALIDATE_COMMANDE',
            'CHANGE_COMMANDE_STATUS',
            'CREATE_BACKUP',
            'RESTORE_BACKUP'
          ]
            .map(
              (action) =>
                `<option value="${action}" ${dashboardState.audit_action === action ? 'selected' : ''}>${action}</option>`
            )
            .join('')}
        </select>
        <select id="audit-entity" style="max-width:160px;">
          <option value="">Toutes entités</option>
          ${['Product', 'Client', 'Mouvement', 'Commande', 'System']
            .map(
              (entity) =>
                `<option value="${entity}" ${dashboardState.audit_entity_type === entity ? 'selected' : ''}>${entity}</option>`
            )
            .join('')}
        </select>
        <input id="audit-from" type="date" value="${dashboardState.audit_date_from}" style="max-width:160px;" />
        <input id="audit-to" type="date" value="${dashboardState.audit_date_to}" style="max-width:160px;" />
      </div>
      ${
        audit.data?.length
          ? `<div class="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Action</th><th>Entité</th><th>Détail</th><th></th></tr></thead>
                <tbody>
                  ${audit.data
                    .map(
                      (a) => `<tr>
                        <td>${asDate(a.date_audit)}</td>
                        <td>${a.action}</td>
                        <td>${a.entity_type}${a.entity_id ? ` #${a.entity_id}` : ''}</td>
                        <td>${a.detail || '-'}</td>
                        <td><button class="btn btn-light" data-audit-view="${a.id_audit}">Détail</button></td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : '<p>Aucune action journalisée.</p>'
      }
      ${paginationTemplate(audit.pagination)}
    </div>
  `;

  container.querySelector('#delay-days')?.addEventListener('change', (event) => {
    dashboardState.delay_days = Math.max(0, Number(event.target.value) || 0);
    renderDashboard(container);
  });

  container.querySelector('#audit-search')?.addEventListener('input', (event) => {
    dashboardState.audit_q = event.target.value;
    dashboardState.audit_page = 1;
    renderDashboard(container);
  });

  container.querySelector('#audit-action')?.addEventListener('change', (event) => {
    dashboardState.audit_action = event.target.value;
    dashboardState.audit_page = 1;
    renderDashboard(container);
  });

  container.querySelector('#audit-entity')?.addEventListener('change', (event) => {
    dashboardState.audit_entity_type = event.target.value;
    dashboardState.audit_page = 1;
    renderDashboard(container);
  });

  container.querySelector('#audit-from')?.addEventListener('change', (event) => {
    dashboardState.audit_date_from = event.target.value;
    dashboardState.audit_page = 1;
    renderDashboard(container);
  });

  container.querySelector('#audit-to')?.addEventListener('change', (event) => {
    dashboardState.audit_date_to = event.target.value;
    dashboardState.audit_page = 1;
    renderDashboard(container);
  });

  bindPagination(container, audit.pagination, (page) => {
    dashboardState.audit_page = page;
    renderDashboard(container);
  });

  audit.data?.forEach((row) => {
    container.querySelector(`[data-audit-view="${row.id_audit}"]`)?.addEventListener('click', () => {
      openAuditDrawer(row);
    });
  });

  container.querySelector('#quick-entry')?.addEventListener('click', () => {
    location.hash = '#/mouvements?action=entree';
  });

  container.querySelector('#quick-exit')?.addEventListener('click', () => {
    location.hash = '#/mouvements?action=sortie';
  });

  container.querySelector('#quick-order')?.addEventListener('click', () => {
    location.hash = '#/commandes?action=new';
  });

  urgent.forEach((item, idx) => {
    container.querySelector(`[data-urgent-go="${idx}"]`)?.addEventListener('click', () => {
      location.hash = item.hash;
    });
  });

  deliveryQueue.forEach((row) => {
    container.querySelector(`[data-open-delivery="${row.num_com}"]`)?.addEventListener('click', () => {
      location.hash = `#/commandes?q=${encodeURIComponent(row.num_com)}`;
    });

    container.querySelector(`[data-deliver-now="${row.num_com}"]`)?.addEventListener('click', () => {
      openConfirm({
        title: `Livrer commande #${row.num_com}`,
        message: `Confirmer la livraison de la commande #${row.num_com} ?`,
        onConfirm: async () => {
          await api.updateCommandeStatus(row.num_com, 'LIVREE');
          showToast(`Commande #${row.num_com} livrée`);
          renderDashboard(container);
        }
      });
    });
  });

  container.querySelector('#backup-create')?.addEventListener('click', async () => {
    try {
      const created = await api.createBackup();
      showToast(`Sauvegarde créée: ${created.data.file_name}`);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  container.querySelector('#backup-restore')?.addEventListener('click', async () => {
    try {
      const backups = await api.getBackups();
      if (!backups.data.length) {
        showToast('Aucune sauvegarde disponible', 'error');
        return;
      }

      openModal({
        title: 'Restaurer une sauvegarde',
        submitText: 'Restaurer',
        body: `
          <label class="field">Fichier de sauvegarde
            <select name="file_name" required>
              ${backups.data
                .map((b) => `<option value="${b.file_name}">${b.file_name} (${Math.round(b.size_bytes / 1024)} Ko)</option>`)
                .join('')}
            </select>
          </label>
          <p style="margin-top:0.6rem; color:var(--muted);">La restauration remplace les données actuelles.</p>
        `,
        onSubmit: async (formData, close) => {
          const fileName = formData.get('file_name');
          openConfirm({
            title: 'Confirmer restauration',
            message: `Restaurer ${fileName} ? Les données actuelles seront remplacées.`,
            onConfirm: async () => {
              await api.restoreBackup(fileName);
              close();
              showToast('Restauration terminée');
              location.hash = '#/dashboard';
              location.reload();
            }
          });
        }
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  container.querySelector('#export-products')?.addEventListener('click', async () => {
    try {
      const rows = (await api.getProducts({ page: 1, limit: 5000 })).data;
      downloadCsv(
        'produits.csv',
        ['id_prod', 'libelle', 'pu', 'stock_min', 'stock_max', 'stock_actuel', 'stock_status'],
        rows.map((p) => [p.id_prod, p.libelle, p.pu, p.stock_min, p.stock_max, p.stock_actuel, p.stock_status])
      );
      showToast('Export produits généré');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  container.querySelector('#export-clients')?.addEventListener('click', async () => {
    try {
      const rows = (await api.getClients({ page: 1, limit: 5000 })).data;
      downloadCsv(
        'clients.csv',
        ['id_client', 'nom', 'prenom', 'ville', 'telephone'],
        rows.map((c) => [c.id_client, c.nom, c.prenom, c.ville, c.telephone])
      );
      showToast('Export clients généré');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  container.querySelector('#export-mouvements')?.addEventListener('click', async () => {
    try {
      const rows = (await api.getMouvements({ page: 1, limit: 5000 })).data;
      downloadCsv(
        'mouvements.csv',
        ['num_op', 'date_op', 'lib_op', 'id_prod', 'libelle', 'type_mvt', 'qte_op'],
        rows.map((m) => [m.num_op, asDate(m.date_op), m.lib_op, m.id_prod, m.libelle, m.type_mvt, m.qte_op])
      );
      showToast('Export mouvements généré');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  container.querySelector('#export-commandes')?.addEventListener('click', async () => {
    try {
      const rows = (await api.getCommandes({ page: 1, limit: 5000 })).data;
      downloadCsv(
        'commandes.csv',
        [
          'num_com',
          'date_com',
          'id_client',
          'client_nom',
          'client_prenom',
          'nb_lignes',
          'montant_total',
          'statut_com',
          'date_validation',
          'date_livraison',
          'date_annulation'
        ],
        rows.map((c) => [
          c.num_com,
          asDate(c.date_com),
          c.id_client,
          c.nom,
          c.prenom,
          c.nb_lignes,
          c.montant_total,
          c.statut_com || (c.etat_com ? 'VALIDEE' : 'BROUILLON'),
          asDate(c.date_validation),
          asDate(c.date_livraison),
          asDate(c.date_annulation)
        ])
      );
      showToast('Export commandes généré');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}
