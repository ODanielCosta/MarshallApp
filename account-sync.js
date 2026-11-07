// MarshallApp: account and shared pace records.
(() => {
  const SUPABASE_URL = 'https://czpttuvcppxdfbrdpwyh.supabase.co';
  const KEY = 'sb_publishable_e1Zz8LKxo5A_OW-lHYq7vA_B5h8-Owu';
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.min.js';
  script.onload = initialize;
  script.onerror = () => showStatus('Não foi possível carregar o serviço de contas.');
  document.head.append(script);

  const panel = document.createElement('section');
  panel.id = 'account-panel';
  panel.innerHTML = `
    <div class="account-bar"><strong id="account-mode">Modo Guest</strong><button type="button" id="account-toggle" aria-expanded="false" aria-controls="account-details">Conta</button></div>
    <div id="account-details" hidden>
      <form id="account-form">
        <label>Email <input id="account-email" type="email" autocomplete="username" required></label>
        <label>Password <input id="account-password" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="account-actions"><button type="submit">Entrar</button><button type="button" id="account-register">Criar conta</button><button type="button" id="account-logout" hidden>Sair</button><button type="button" id="account-resend" hidden>Reenviar confirmação</button></div>
      </form>
      <p id="account-message" role="status" aria-live="polite"></p>
    </div>`;
  const menu = document.getElementById('mode-menu');
  menu.insertBefore(panel, document.getElementById('install-app'));
  const css = document.createElement('style');
  css.textContent = `
    #account-panel{width:100%;box-sizing:border-box;margin-top:8px;padding:12px 10px 4px;border-top:1px solid var(--app-border);color:var(--app-ink)}
    .account-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px}
    #account-panel button{border:1px solid #1e3859;border-radius:8px;background:#1e3859;color:white;min-height:44px;padding:8px 12px;cursor:pointer}
    #account-details{padding-top:10px}#account-form{display:grid;gap:8px}
    #account-form label{display:grid;gap:4px;font-size:13px}#account-form label[hidden]{display:none}#account-form input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #8da4bf;border-radius:8px;font:inherit;font-size:16px}
    .account-actions{display:flex;gap:6px;flex-wrap:wrap}#account-message{font-size:12px;overflow-wrap:anywhere;margin:8px 0 0}
  `;
  document.head.append(css);
  const $ = id => document.getElementById(id);
  $('account-toggle').onclick = () => {
    const open = $('account-details').hidden;
    $('account-details').hidden = !open;
    $('account-toggle').setAttribute('aria-expanded', String(open));
  };
  const recordsDialog = $('records-dialog');
  const recordDialog = $('record-dialog');
  const recordForm = $('record-form');
  const recordsList = $('records-list');
  const confirmationUrl = new URL('./', window.location.href).href;
  const recordColumns = 'id,mode,start_hole,tee_time,hole,delay_seconds,buggy_number,warned,notes,recorded_at,revision';
  const observationTime = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit'
  });
  let client;
  let currentUser = null;
  let recordsChannel;
  let listRequest = 0;
  let listDay;
  let draft;
  let saving = false;
  let authPending = false;

  const recordsButton = document.createElement('button');
  recordsButton.id = 'records-open';
  recordsButton.type = 'button';
  recordsButton.className = 'pwa-menu-action';
  recordsButton.setAttribute('aria-haspopup', 'dialog');
  recordsButton.setAttribute('aria-controls', 'records-dialog');
  recordsButton.innerHTML = '<span aria-hidden="true">≡</span><span><strong>Registos</strong><small>Atrasos e avisos de hoje</small></span>';
  menu.insertBefore(recordsButton, panel);

  function showStatus(message) {
    $('account-message').textContent = message;
  }

  function openAccount(message) {
    closeProgressDialog(false);
    setMenuOpen(true);
    $('account-details').hidden = false;
    $('account-toggle').setAttribute('aria-expanded', 'true');
    showStatus(message);
    $('account-email').focus();
  }

  function describeRecord(record) {
    const route = record.mode === 'shotgun' ? `Shotgun B${record.start_hole}` : `T${record.start_hole}`;
    return `${record.tee_time.slice(0, 5)} · ${route} · Buraco ${record.hole}`;
  }

  function renderRecords(records) {
    const version = records.map(({ id, revision }) => `${id}:${revision}`).join(',');
    if (recordsList.dataset.version === version) return;
    recordsList.dataset.version = version;
    recordsList.replaceChildren();
    for (const record of records) {
      const card = document.createElement('li');
      const heading = document.createElement('strong');
      heading.textContent = describeRecord(record);
      const delay = document.createElement('p');
      delay.className = 'record-late';
      delay.textContent = `Atrasado ${formatPaceDuration(record.delay_seconds)}`;
      const details = document.createElement('p');
      const buggy = record.buggy_number ? `Buggy ${record.buggy_number} · ` : '';
      details.textContent = `${buggy}${record.warned ? 'Grupo avisado' : 'Por avisar'} · Registado às ${observationTime.format(new Date(record.recorded_at))}`;
      card.append(heading, delay, details);
      if (record.notes) {
        const notes = document.createElement('p');
        notes.className = 'record-notes';
        notes.textContent = record.notes;
        card.append(notes);
      }
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Editar aviso e notas';
      edit.addEventListener('click', () => openRecordForm(record, true));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Apagar';
      remove.setAttribute('aria-label', `Apagar registo de ${describeRecord(record)}`);
      remove.addEventListener('click', () => deleteRecord(record, remove));
      const actions = document.createElement('div');
      actions.className = 'record-actions';
      actions.append(edit, remove);
      card.append(actions);
      recordsList.append(card);
    }
  }

  async function deleteRecord(record, button) {
    const owner = currentUser?.id;
    if (!owner || !window.confirm(`Apagar o registo de ${describeRecord(record)} para todos os que usam esta conta?`)) return;
    button.disabled = true;
    try {
      const { data, error } = await client.from('marshall_records').delete()
        .eq('id', record.id).eq('user_id', owner).eq('revision', record.revision)
        .select('id').maybeSingle();
      if (error) throw error;
      if (currentUser?.id !== owner || !recordsDialog.open) return;
      await loadRecords();
      if (!data && currentUser?.id === owner && recordsDialog.open) {
        $('records-status').textContent = 'O registo foi alterado ou já foi apagado. Verifica a lista atualizada.';
      }
    } catch {
      if (currentUser?.id === owner && recordsDialog.open) {
        $('records-status').textContent = 'Não foi possível apagar o registo. Tenta de novo.';
      }
    } finally {
      button.disabled = false;
    }
  }

  async function loadRecords() {
    if (!currentUser || !recordsDialog.open) return;
    const request = ++listRequest;
    const day = getCourseClock().day;
    if (listDay !== day) {
      renderRecords([]);
      $('records-status').textContent = 'A carregar os registos de hoje…';
      listDay = day;
    }
    const { data, error } = await client.from('marshall_records').select(recordColumns)
      .eq('user_id', currentUser.id).eq('work_day', day).order('recorded_at', { ascending: false });
    if (request !== listRequest || !recordsDialog.open) return;
    if (error) {
      $('records-status').textContent = 'Não foi possível carregar os registos. Fecha e volta a abrir para tentar de novo.';
      return;
    }
    renderRecords(data);
    $('records-status').textContent = data.length ? '' : 'Ainda não há atrasos registados hoje.';
  }

  function openRecords() {
    if (!currentUser) return openAccount('Entra na conta para consultar os registos partilhados.');
    setMenuOpen(false);
    if (!recordsDialog.open) recordsDialog.showModal();
    loadRecords();
  }

  function openRecordForm(record, edit = false) {
    if (!currentUser) return openAccount('Entra na conta para guardar e partilhar este atraso.');
    if (saving || recordDialog.open) return;
    draft = { record, edit, day: record.day ?? listDay, owner: currentUser.id, id: record.id ?? crypto.randomUUID() };
    recordForm.reset();
    $('record-title').textContent = edit ? 'Editar registo' : 'Registar atraso';
    $('record-context').textContent = `${describeRecord(record)} · Atrasado ${formatPaceDuration(record.delay_seconds)}`;
    $('record-buggy').value = record.buggy_number ?? '';
    $('record-warned').checked = record.warned ?? false;
    $('record-notes').value = record.notes ?? '';
    $('record-status').textContent = '';
    recordDialog.showModal();
  }

  recordsButton.addEventListener('click', openRecords);
  $('records-close').addEventListener('click', () => recordsDialog.close());
  $('record-cancel').addEventListener('click', () => recordDialog.close());
  recordDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  recordButtons.forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const observation = getDelayObservation();
    if (observation) openRecordForm(observation);
  }));

  recordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !draft || currentUser?.id !== draft.owner) return;
    if (draft.day !== getCourseClock().day) {
      $('record-status').textContent = 'O dia mudou. Fecha este registo e volta a registar o atraso.';
      return;
    }
    const { record, edit, owner, id } = draft;
    const fields = {
      buggy_number: $('record-buggy').value.trim(),
      warned: $('record-warned').checked,
      notes: $('record-notes').value.trim()
    };
    saving = true;
    $('record-save').disabled = true;
    $('record-cancel').disabled = true;
    $('record-status').textContent = 'A guardar…';
    try {
      if (edit) {
        const { data, error } = await client.from('marshall_records')
          .update({ ...fields, revision: record.revision + 1 }).eq('id', id)
          .eq('revision', record.revision).select('id').maybeSingle();
        if (error) throw error;
        if (!data) {
          $('record-status').textContent = 'Este registo mudou. Volta à lista e abre a versão mais recente.';
          loadRecords();
          return;
        }
      } else {
        const { mode, start_hole, tee_time, hole, delay_seconds } = record;
        const { error } = await client.from('marshall_records').upsert({
          id, mode, start_hole, tee_time, hole, delay_seconds, ...fields
        }, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
      }
      if (currentUser?.id === owner) {
        recordDialog.close();
        openRecords();
      }
    } catch {
      $('record-status').textContent = 'Não foi possível guardar. Verifica a ligação e tenta de novo.';
    } finally {
      saving = false;
      $('record-save').disabled = false;
      $('record-cancel').disabled = false;
    }
  });

  function setUser(user) {
    if (user?.id === currentUser?.id && user) return;
    if (recordsChannel) client.removeChannel(recordsChannel);
    recordsChannel = null;
    currentUser = user;
    listRequest++;
    listDay = undefined;
    renderRecords([]);
    recordsDialog.close();
    recordDialog.close();
    draft = undefined;
    $('account-mode').textContent = user ? 'Conta partilhada' : 'Modo Guest';
    $('account-logout').hidden = !user;
    $('account-form').querySelectorAll('label').forEach(label => { label.hidden = !!user; });
    $('account-form').querySelector('button[type="submit"]').hidden = !!user;
    $('account-register').hidden = !!user;
    $('account-resend').hidden = true;
    if (!user) {
      showStatus('Podes usar o calculador em modo Guest.');
      return;
    }
    $('account-password').value = '';
    showStatus('Ligado: ' + user.email);
    const recordFilter = { schema: 'public', table: 'marshall_records', filter: 'user_id=eq.' + user.id };
    recordsChannel = client.channel('marshall-records-' + user.id)
      .on('postgres_changes', { ...recordFilter, event: 'INSERT' }, loadRecords)
      .on('postgres_changes', { ...recordFilter, event: 'UPDATE' }, loadRecords)
      .subscribe(status => { if (status === 'SUBSCRIBED') loadRecords(); });
  }

  function initialize() {
    client = window.supabase.createClient(SUPABASE_URL, KEY);
    client.auth.onAuthStateChange((_event, session) => { setTimeout(() => setUser(session?.user ?? null), 0); });
  }

  async function runAuth(action) {
    if (!client) return showStatus('O serviço de contas ainda não está disponível.');
    if (authPending) return;
    authPending = true;
    try {
      await action();
    } catch {
      showStatus('Não foi possível contactar o serviço de contas. Tenta de novo.');
    } finally {
      authPending = false;
    }
  }

  function showAuthError(error) {
    if (error.code === 'email_not_confirmed') {
      $('account-resend').hidden = false;
      return showStatus('Confirma o teu email. Podes pedir um novo link.');
    }
    showStatus(error.code === 'invalid_credentials' ? 'Email ou palavra-passe incorretos.' : error.message);
  }

  $('account-form').addEventListener('submit', event => {
    event.preventDefault();
    runAuth(async () => {
      const { error } = await client.auth.signInWithPassword({
        email: $('account-email').value.trim(), password: $('account-password').value
      });
      if (error) showAuthError(error);
    });
  });
  $('account-register').onclick = () => {
    if (!$('account-email').reportValidity() || !$('account-password').reportValidity()) return;
    runAuth(async () => {
      const { data, error } = await client.auth.signUp({
        email: $('account-email').value.trim(), password: $('account-password').value,
        options: { emailRedirectTo: confirmationUrl }
      });
      if (error) return showAuthError(error);
      if (!data.session) {
        $('account-resend').hidden = false;
        showStatus('Verifica o email para confirmar a conta.');
      }
    });
  };
  $('account-resend').onclick = () => {
    if (!$('account-email').reportValidity()) return;
    runAuth(async () => {
      const { error } = await client.auth.resend({
        type: 'signup', email: $('account-email').value.trim(), options: { emailRedirectTo: confirmationUrl }
      });
      if (error) return showAuthError(error);
      showStatus('Pedido de confirmação enviado. Verifica o email.');
    });
  };
  $('account-logout').onclick = () => runAuth(async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) showAuthError(error);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRecords(); });
  setInterval(() => {
    // Filtered Realtime subscriptions do not receive deletes.
    if (!document.hidden && recordsDialog.open) loadRecords();
  }, 30000);
})();
