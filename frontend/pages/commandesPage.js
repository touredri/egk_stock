import { api } from '../services/api.js';
import { openConfirm, openModal, showToast, paginationTemplate, bindPagination } from '../components/ui.js';

const state = { q: '', page: 1, limit: 10, etat_com: '', statut_com: '', id_client: '', date_from: '', date_to: '' };

function getHashParams() {
  const query = location.hash.split('?')[1] || '';
  return new URLSearchParams(query);
}

function getHashAction() {
  return getHashParams().get('action') || '';
}

function applyHashSearchState() {
  const q = getHashParams().get('q');
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

function currency(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function statusBadge(statut) {
  if (statut === 'VALIDEE') return '✅ Validée';
  if (statut === 'LIVREE') return '📦 Livrée';
  if (statut === 'ANNULEE') return '❌ Annulée';
  return '📝 Brouillon';
}

function timelineLabel(action) {
  if (action === 'CREATE_COMMANDE') return 'Création';
  if (action === 'VALIDATE_COMMANDE') return 'Validation';
  if (action === 'CHANGE_COMMANDE_STATUS') return 'Transition de statut';
  return action || 'Événement';
}

function buildSystemTimeline(details) {
  const events = [];

  if (details.date_com) {
    events.push({
      source: 'SYSTEM',
      date: details.date_com,
      label: 'Création',
      detail: 'Commande créée.'
    });
  }

  if (details.date_validation) {
    events.push({
      source: 'SYSTEM',
      date: details.date_validation,
      label: 'Transition',
      detail: 'Passage BROUILLON → VALIDEE'
    });
  }

  if (details.date_livraison) {
    events.push({
      source: 'SYSTEM',
      date: details.date_livraison,
      label: 'Transition',
      detail: 'Passage VALIDEE → LIVREE'
    });
  }

  if (details.date_annulation) {
    events.push({
      source: 'SYSTEM',
      date: details.date_annulation,
      label: 'Transition',
      detail: 'Passage BROUILLON → ANNULEE'
    });
  }

  return events;
}

function buildAuditTimeline(history) {
  return (history || []).map((item) => {
    let detail = item.detail || '-';
    if (item.action === 'CHANGE_COMMANDE_STATUS' && detail.includes('LIVREE')) {
      detail = 'Passage VALIDEE → LIVREE';
    } else if (item.action === 'CHANGE_COMMANDE_STATUS' && detail.includes('ANNULEE')) {
      detail = 'Passage BROUILLON → ANNULEE';
    } else if (item.action === 'VALIDATE_COMMANDE') {
      detail = 'Passage BROUILLON → VALIDEE';
    }

    return {
      source: 'AUDIT',
      date: item.date_audit,
      label: timelineLabel(item.action),
      detail
    };
  });
}

function buildTimeline(details, history) {
  const merged = [...buildSystemTimeline(details), ...buildAuditTimeline(history)];
  return merged
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function timelineHtml(events) {
  if (!events || events.length === 0) {
    return '<p style="color:var(--muted); margin:0;">Aucun événement disponible pour cette commande.</p>';
  }

  return `
    <div class="timeline">
      ${events
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${item.label}</strong>
              <div style="color:var(--muted); font-size:0.88rem;">${new Date(item.date).toLocaleString('fr-FR')} • ${item.source === 'SYSTEM' ? 'Système' : 'Audit'}</div>
              <div>${item.detail || '-'}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function generateInvoicePdf(details) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Facture - EGK Matériaux', 12, 15);
  doc.setFontSize(11);
  doc.text(`Commande: #${details.num_com}`, 12, 26);
  doc.text(`Date: ${details.date_com ? new Date(details.date_com).toLocaleString('fr-FR') : '-'}`, 12, 33);
  doc.text(`Client: ${details.nom} ${details.prenom}`, 12, 40);
  doc.text(`Statut: ${details.statut_com}`, 12, 47);

  let y = 60;
  doc.text('Lignes:', 12, y);
  y += 8;

  details.lignes.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
    doc.text(
      `${line.libelle} | Qte ${line.qte_com} | PU ${currency(line.pu)} | Sous-total ${currency(line.sous_total)}`,
      12,
      y
    );
    y += 7;
  });

  y += 6;
  doc.setFontSize(12);
  doc.text(`Total: ${currency(details.montant_total)}`, 12, y);
  doc.save(`facture_commande_${details.num_com}.pdf`);
}

function lineTemplate(optionsHtml, initial = {}) {
  const { id_prod = '', qte_com = '' } = initial;

  return `
    <div class="line-item" data-line>
      <label class="field">Produit
        <select name="id_prod" required>
          ${optionsHtml.replace(`value="${id_prod}"`, `value="${id_prod}" selected`)}
        </select>
      </label>
      <label class="field">Quantité
        <input type="number" name="qte_com" min="1" required value="${qte_com}" />
      </label>
      <button type="button" class="btn btn-danger" data-remove-line>Supprimer</button>
    </div>
  `;
}

function openDeliveryAssistantModal(container, commandeNum, currentStatus) {
  openModal({
    title: `Assistant livraison #${commandeNum}`,
    submitText: 'Fermer',
    body: `
      <div class="card" style="margin-bottom:0.8rem;">
        <h4 style="margin:0 0 0.5rem;">Checklist livraison</h4>
        <label class="field"><input type="checkbox" id="step-validate" disabled /> Étape 1: commande validée</label>
        <label class="field"><input type="checkbox" id="step-deliver" disabled /> Étape 2: commande livrée</label>
      </div>
      <div class="actions" style="margin-top:0.6rem;">
        <button type="button" class="btn btn-primary" id="assistant-validate">Valider (étape 1)</button>
        <button type="button" class="btn btn-light" id="assistant-deliver">Marquer livrée (étape 2)</button>
      </div>
      <p style="margin-top:0.6rem; color:var(--muted);">Le flux sécurisé applique les règles stock et statut existantes.</p>
    `,
    onOpen: async (wrapper) => {
      let status = currentStatus;
      const checkValidate = () => {
        wrapper.querySelector('#step-validate').checked = status === 'VALIDEE' || status === 'LIVREE';
      };
      const checkDeliver = () => {
        wrapper.querySelector('#step-deliver').checked = status === 'LIVREE';
      };
      const refreshChecks = () => {
        checkValidate();
        checkDeliver();
      };

      refreshChecks();

      wrapper.querySelector('#assistant-validate')?.addEventListener('click', async () => {
        if (status !== 'BROUILLON') {
          showToast('Étape 1 déjà faite ou non applicable');
          return;
        }
        await api.updateCommandeStatus(commandeNum, 'VALIDEE');
        status = 'VALIDEE';
        refreshChecks();
        showToast('Étape 1 validée');
      });

      wrapper.querySelector('#assistant-deliver')?.addEventListener('click', async () => {
        if (status === 'BROUILLON') {
          showToast('Effectuez d’abord l’étape 1 (validation)', 'error');
          return;
        }
        if (status === 'LIVREE') {
          showToast('Commande déjà livrée');
          return;
        }
        await api.updateCommandeStatus(commandeNum, 'LIVREE');
        status = 'LIVREE';
        refreshChecks();
        showToast('Étape 2 terminée: commande livrée');
        renderCommandes(container);
      });
    },
    onSubmit: async (_formData, close) => {
      close();
      renderCommandes(container);
    }
  });
}

function openCreateCommandeModal(container, clients, products) {
  const clientOptions = clients.data
    .map((c) => `<option value="${c.id_client}">${c.nom} ${c.prenom} - ${c.ville}</option>`)
    .join('');
  const productOptions = products.data
    .map((p) => `<option value="${p.id_prod}">${p.libelle} (stock ${p.stock_actuel})</option>`)
    .join('');
  const productById = new Map(products.data.map((p) => [String(p.id_prod), p]));

  openModal({
    title: 'Créer commande',
    submitText: 'Créer',
    body: `
      <label class="field">Client
        <select name="id_client" required>${clientOptions}</select>
      </label>
      <label class="field" style="margin-top:0.6rem;">
        <input type="checkbox" name="etat_com" value="1" /> Valider immédiatement (sortie de stock)
      </label>
      <h4>Lignes produits</h4>
      <div class="line-items" id="order-lines">
        ${lineTemplate(productOptions)}
      </div>
      <button type="button" class="btn btn-light" id="add-line">+ Ajouter une ligne</button>
      <div id="order-stock-assistant" class="card" style="margin-top:0.8rem; padding:0.8rem; background:var(--surface-2);">
        <strong>Assistant rupture partielle</strong>
        <p style="margin:0.4rem 0 0; color:var(--muted);">Activez “Valider immédiatement” pour vérifier les lignes bloquantes.</p>
      </div>
    `,
    onOpen: (wrapper) => {
      const lines = wrapper.querySelector('#order-lines');
      const immediateCheckbox = wrapper.querySelector('[name="etat_com"]');
      const assistant = wrapper.querySelector('#order-stock-assistant');
      const submitBtn = wrapper.querySelector('button[type="submit"]');

      const evaluateLines = () => {
        const lineEls = [...wrapper.querySelectorAll('[data-line]')];
        const wantsImmediate = immediateCheckbox?.checked;

        const rows = lineEls.map((line, index) => {
          const idProd = line.querySelector('[name="id_prod"]')?.value;
          const qty = Number(line.querySelector('[name="qte_com"]')?.value || 0);
          const product = productById.get(String(idProd));
          if (!product) {
            return { index: index + 1, level: 'error', text: `Ligne ${index + 1}: produit introuvable.` };
          }

          const maxAllowedByStock = Number(product.stock_actuel);
          const maxAllowedByMin = Math.max(0, Number(product.stock_actuel) - Number(product.stock_min));

          if (!wantsImmediate) {
            return {
              index: index + 1,
              level: 'info',
              text: `Ligne ${index + 1} (${product.libelle}) — validation différée, contrôle stock appliqué plus tard.`
            };
          }

          if (qty > maxAllowedByStock) {
            return {
              index: index + 1,
              level: 'error',
              text: `Ligne ${index + 1} (${product.libelle}) bloquée: demandé ${qty}, stock disponible ${maxAllowedByStock}.` +
                ` Suggestion: quantité max ${maxAllowedByMin}.`
            };
          }

          if (qty > maxAllowedByMin) {
            return {
              index: index + 1,
              level: 'error',
              text: `Ligne ${index + 1} (${product.libelle}) bloquée: passerait sous stock min (${product.stock_min}).` +
                ` Suggestion: quantité max ${maxAllowedByMin}.`
            };
          }

          return {
            index: index + 1,
            level: 'ok',
            text: `Ligne ${index + 1} (${product.libelle}) OK — demandé ${qty}, max autorisé ${maxAllowedByMin}.`
          };
        });

        const hasBlocking = wantsImmediate && rows.some((r) => r.level === 'error');
        if (submitBtn) submitBtn.disabled = hasBlocking;

        const title = hasBlocking
          ? '<span style="color:var(--danger);">Blocages détectés</span>'
          : '<span style="color:var(--success);">Contrôle stock OK</span>';

        assistant.innerHTML = `
          <strong>Assistant rupture partielle</strong>
          <p style="margin:0.35rem 0 0.55rem; color:var(--muted);">
            ${wantsImmediate ? 'Validation immédiate active: règles stock appliquées maintenant.' : 'Validation différée: brouillon autorisé même si stock insuffisant.'}
          </p>
          ${rows.length ? `<div style="display:flex; flex-direction:column; gap:0.35rem;">${rows
            .map(
              (r) => `<div style="padding:0.35rem 0.5rem; border:1px solid var(--border); border-radius:0.45rem; ${
                r.level === 'error' ? 'border-color: var(--danger);' : r.level === 'ok' ? 'border-color: var(--success);' : ''
              }">${r.text}</div>`
            )
            .join('')}</div>` : '<p style="margin:0; color:var(--muted);">Ajoutez des lignes pour lancer l’analyse.</p>'}
          <p style="margin:0.55rem 0 0;">${title}</p>
        `;
      };

      const bindRemove = () => {
        wrapper.querySelectorAll('[data-remove-line]').forEach((btn) => {
          btn.onclick = () => {
            const allLines = wrapper.querySelectorAll('[data-line]');
            if (allLines.length === 1) return;
            btn.closest('[data-line]').remove();
            evaluateLines();
          };
        });
      };

      const bindLineInputs = () => {
        wrapper.querySelectorAll('[data-line]').forEach((line) => {
          line.querySelector('[name="id_prod"]')?.addEventListener('change', evaluateLines);
          line.querySelector('[name="qte_com"]')?.addEventListener('input', evaluateLines);
        });
      };

      wrapper.querySelector('#add-line').addEventListener('click', () => {
        lines.insertAdjacentHTML('beforeend', lineTemplate(productOptions));
        bindRemove();
        bindLineInputs();
        evaluateLines();
      });

      immediateCheckbox?.addEventListener('change', evaluateLines);

      bindRemove();
      bindLineInputs();
      evaluateLines();
    },
    onSubmit: async (formData, close, wrapper) => {
      const lines = [...wrapper.querySelectorAll('[data-line]')].map((line) => ({
        id_prod: Number(line.querySelector('[name="id_prod"]').value),
        qte_com: Number(line.querySelector('[name="qte_com"]').value)
      }));

      if (lines.length === 0) throw new Error('Ajoutez au moins une ligne produit.');

      const wantsImmediate = formData.get('etat_com') === '1';
      if (wantsImmediate) {
        const blockingLine = lines.find((line) => {
          const product = productById.get(String(line.id_prod));
          if (!product) return true;
          const maxByStock = Number(product.stock_actuel);
          const maxByMin = Math.max(0, Number(product.stock_actuel) - Number(product.stock_min));
          return line.qte_com > maxByStock || line.qte_com > maxByMin;
        });

        if (blockingLine) {
          throw new Error('Assistant rupture: corrigez les lignes bloquantes ou décochez la validation immédiate.');
        }
      }

      await api.createCommande({
        id_client: Number(formData.get('id_client')),
        etat_com: wantsImmediate,
        produits: lines
      });

      close();
      showToast('Commande créée');
      renderCommandes(container);
    }
  });
}

function openEditCommandeModal(container, clients, products, details) {
  const clientOptions = clients.data
    .map(
      (c) =>
        `<option value="${c.id_client}" ${Number(details.id_client) === Number(c.id_client) ? 'selected' : ''}>${c.nom} ${c.prenom} - ${c.ville}</option>`
    )
    .join('');
  const productOptions = products.data
    .map((p) => `<option value="${p.id_prod}">${p.libelle} (stock ${p.stock_actuel})</option>`)
    .join('');

  const initialLines = details.lignes?.length
    ? details.lignes.map((line) => lineTemplate(productOptions, line)).join('')
    : lineTemplate(productOptions);

  openModal({
    title: `Modifier commande #${details.num_com}`,
    submitText: 'Mettre à jour',
    body: `
      <label class="field">Client
        <select name="id_client" required>${clientOptions}</select>
      </label>
      <h4>Lignes produits</h4>
      <div class="line-items" id="order-lines">
        ${initialLines}
      </div>
      <button type="button" class="btn btn-light" id="add-line">+ Ajouter une ligne</button>
      <p style="margin-top:0.6rem; color:var(--muted);">Seules les commandes brouillon peuvent être modifiées.</p>
    `,
    onOpen: (wrapper) => {
      const lines = wrapper.querySelector('#order-lines');

      const bindRemove = () => {
        wrapper.querySelectorAll('[data-remove-line]').forEach((btn) => {
          btn.onclick = () => {
            const allLines = wrapper.querySelectorAll('[data-line]');
            if (allLines.length === 1) return;
            btn.closest('[data-line]').remove();
          };
        });
      };

      wrapper.querySelector('#add-line').addEventListener('click', () => {
        lines.insertAdjacentHTML('beforeend', lineTemplate(productOptions));
        bindRemove();
      });

      bindRemove();
    },
    onSubmit: async (formData, close, wrapper) => {
      const lines = [...wrapper.querySelectorAll('[data-line]')].map((line) => ({
        id_prod: Number(line.querySelector('[name="id_prod"]').value),
        qte_com: Number(line.querySelector('[name="qte_com"]').value)
      }));

      if (!lines.length) throw new Error('Ajoutez au moins une ligne produit.');

      await api.updateCommande(details.num_com, {
        id_client: Number(formData.get('id_client')),
        produits: lines
      });

      close();
      showToast('Commande brouillon mise à jour');
      renderCommandes(container);
    }
  });
}

export async function renderCommandes(container) {
  applyHashSearchState();
  const [result, clients, products] = await Promise.all([
    api.getCommandes(state),
    api.getClients({ page: 1, limit: 500 }),
    api.getProducts({ page: 1, limit: 500 })
  ]);

  container.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <input id="search-commandes" placeholder="Rechercher commande..." value="${state.q}" style="max-width:300px;" />
        <select id="filter-commandes-client" style="max-width:260px;">
          <option value="">Tous clients</option>
          ${clients.data
            .map(
              (c) =>
                `<option value="${c.id_client}" ${String(state.id_client) === String(c.id_client) ? 'selected' : ''}>${c.nom} ${c.prenom}</option>`
            )
            .join('')}
        </select>
        <select id="filter-commandes-etat" style="max-width:200px;">
          <option value="">Tous états</option>
          <option value="0" ${state.etat_com === '0' ? 'selected' : ''}>Brouillon</option>
          <option value="1" ${state.etat_com === '1' ? 'selected' : ''}>Validée</option>
        </select>
        <select id="filter-commandes-statut" style="max-width:200px;">
          <option value="">Tous statuts</option>
          <option value="BROUILLON" ${state.statut_com === 'BROUILLON' ? 'selected' : ''}>Brouillon</option>
          <option value="VALIDEE" ${state.statut_com === 'VALIDEE' ? 'selected' : ''}>Validée</option>
          <option value="LIVREE" ${state.statut_com === 'LIVREE' ? 'selected' : ''}>Livrée</option>
          <option value="ANNULEE" ${state.statut_com === 'ANNULEE' ? 'selected' : ''}>Annulée</option>
        </select>
        <input id="filter-commandes-from" type="date" value="${state.date_from}" style="max-width:170px;" />
        <input id="filter-commandes-to" type="date" value="${state.date_to}" style="max-width:170px;" />
        <button id="add-commande" class="btn btn-primary">+ Créer commande</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Lignes</th><th>Montant</th><th>État</th><th>Actions</th></tr></thead>
          <tbody>
            ${result.data
              .map(
                (c) => `
              <tr>
                <td>${c.num_com}</td>
                <td>${new Date(c.date_com).toLocaleString('fr-FR')}</td>
                <td>${c.nom} ${c.prenom}</td>
                <td>${c.nb_lignes}</td>
                <td>${currency(c.montant_total)}</td>
                <td>${statusBadge(c.statut_com || (c.etat_com ? 'VALIDEE' : 'BROUILLON'))}</td>
                <td class="actions">
                  ${(c.statut_com || 'BROUILLON') === 'BROUILLON' ? `<button class="btn btn-light" data-edit="${c.num_com}" title="Modifier la commande" aria-label="Modifier la commande"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>` : ''}
                  ${(c.statut_com || 'BROUILLON') === 'BROUILLON' ? `<button class="btn btn-danger" data-delete="${c.num_com}" title="Supprimer la commande" aria-label="Supprimer la commande"><svg class="icon-action" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>` : ''}
                  ${(c.statut_com || 'BROUILLON') === 'BROUILLON' ? `<button class="btn btn-primary" data-validate="${c.num_com}">Valider</button>` : ''}
                  ${(c.statut_com || 'BROUILLON') === 'BROUILLON' ? `<button class="btn btn-danger" data-cancel="${c.num_com}">Annuler</button>` : ''}
                  ${['BROUILLON', 'VALIDEE'].includes(c.statut_com || 'BROUILLON') ? `<button class="btn btn-light" data-assistant="${c.num_com}">Assistant livraison</button>` : ''}
                  ${(c.statut_com || 'BROUILLON') === 'VALIDEE' ? `<button class="btn btn-light" data-deliver="${c.num_com}">Marquer livrée</button>` : ''}
                  ${(c.statut_com || 'BROUILLON') === 'LIVREE' ? `<button class="btn btn-light" data-invoice="${c.num_com}">Facture PDF</button>` : ''}
                  <button class="btn btn-light" data-view="${c.num_com}">Voir</button>
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

  container.querySelector('#search-commandes').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  container.querySelector('#filter-commandes-client')?.addEventListener('change', (event) => {
    state.id_client = event.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  container.querySelector('#filter-commandes-etat')?.addEventListener('change', (event) => {
    state.etat_com = event.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  container.querySelector('#filter-commandes-statut')?.addEventListener('change', (event) => {
    state.statut_com = event.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  container.querySelector('#filter-commandes-from')?.addEventListener('change', (event) => {
    state.date_from = event.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  container.querySelector('#filter-commandes-to')?.addEventListener('change', (event) => {
    state.date_to = event.target.value;
    state.page = 1;
    renderCommandes(container);
  });

  bindPagination(container, result.pagination, (page) => {
    state.page = page;
    renderCommandes(container);
  });

  container.querySelector('#add-commande').addEventListener('click', async () => {
    openCreateCommandeModal(container, clients, products);
  });

  const action = getHashAction();
  if (action === 'new') {
    clearHashQuery('#/commandes');
    openCreateCommandeModal(container, clients, products);
  }

  result.data.forEach((commande) => {
    container.querySelector(`[data-edit="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        const details = await api.getCommande(commande.num_com);
        openEditCommandeModal(container, clients, products, details.data);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-delete="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        openConfirm({
          title: `Supprimer commande #${commande.num_com}`,
          message: `Confirmer la suppression définitive de la commande brouillon #${commande.num_com} ?`,
          onConfirm: async () => {
            await api.deleteCommande(commande.num_com);
            showToast('Commande supprimée');
            renderCommandes(container);
          }
        });
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-validate="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        await api.updateCommandeStatus(commande.num_com, 'VALIDEE');
        showToast('Commande validée');
        renderCommandes(container);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-deliver="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        await api.updateCommandeStatus(commande.num_com, 'LIVREE');
        showToast('Commande marquée livrée');
        renderCommandes(container);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-cancel="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        await api.updateCommandeStatus(commande.num_com, 'ANNULEE');
        showToast('Commande annulée');
        renderCommandes(container);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-assistant="${commande.num_com}"]`)?.addEventListener('click', async () => {
      const status = commande.statut_com || (commande.etat_com ? 'VALIDEE' : 'BROUILLON');
      openDeliveryAssistantModal(container, commande.num_com, status);
    });

    container.querySelector(`[data-invoice="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        const details = await api.getCommande(commande.num_com);
        if ((details.data.statut_com || 'BROUILLON') !== 'LIVREE') {
          showToast('La facture est disponible uniquement pour une commande livrée', 'error');
          return;
        }
        generateInvoicePdf(details.data);
        showToast('Facture PDF générée');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    container.querySelector(`[data-view="${commande.num_com}"]`)?.addEventListener('click', async () => {
      try {
        const [details, historyRes] = await Promise.all([
          api.getCommande(commande.num_com),
          api.getCommandeHistory(commande.num_com, { limit: 40 })
        ]);
        const timeline = buildTimeline(details.data, historyRes.data);
        const lines = details.data.lignes
          .map((line) => `${line.libelle}: ${line.qte_com} x ${currency(line.pu)} = ${currency(line.sous_total)}`)
          .join('<br/>');

        openModal({
          title: `Commande #${commande.num_com}`,
          submitText: 'Fermer',
          body: `
            <p><strong>Client:</strong> ${details.data.nom} ${details.data.prenom}</p>
            <p><strong>Statut:</strong> ${statusBadge(details.data.statut_com || (details.data.etat_com ? 'VALIDEE' : 'BROUILLON'))}</p>
            <p><strong>Timeline:</strong><br/>
              Créée: ${details.data.date_com ? new Date(details.data.date_com).toLocaleString('fr-FR') : '-'}<br/>
              Validée: ${details.data.date_validation ? new Date(details.data.date_validation).toLocaleString('fr-FR') : '-'}<br/>
              Livrée: ${details.data.date_livraison ? new Date(details.data.date_livraison).toLocaleString('fr-FR') : '-'}<br/>
              Annulée: ${details.data.date_annulation ? new Date(details.data.date_annulation).toLocaleString('fr-FR') : '-'}
            </p>
            <p style="margin-bottom:0.4rem;"><strong>Historique commande:</strong></p>
            ${timelineHtml(timeline)}
            <p><strong>Lignes:</strong><br/>${lines || 'Aucune ligne'}</p>
            <p><strong>Total:</strong> ${currency(details.data.montant_total)}</p>
            ${
              (details.data.statut_com || 'BROUILLON') === 'LIVREE'
                ? '<p><em>Cette commande est livrée: utilisez le bouton "Facture PDF" dans la liste.</em></p>'
                : ''
            }
          `,
          onSubmit: async (_formData, close) => close()
        });
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });
}
