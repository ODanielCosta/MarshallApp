// MarshallApp: optional daily account synchronization. Guest mode remains local.
(() => {
  const URL = 'https://czpttuvcppxdfbrdpwyh.supabase.co';
  const KEY = 'sb_publishable_e1Zz8LKxo5A_OW-lHYq7vA_B5h8-Owu';
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.min.js';
  script.onload = initialize;
  script.onerror = () => showStatus('Não foi possível carregar o serviço de contas.');
  document.head.append(script);

  const panel = document.createElement('section');
  panel.id = 'account-panel';
  panel.innerHTML = `
    <div class="account-bar"><strong id="account-mode">Modo Guest</strong><button type="button" id="account-toggle">Conta</button></div>
    <div id="account-details" hidden>
      <form id="account-form">
        <label>Email <input id="account-email" type="email" autocomplete="username" required></label>
        <label>Password <input id="account-password" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="account-actions"><button type="submit">Entrar</button><button type="button" id="account-register">Criar conta</button><button type="button" id="account-logout" hidden>Sair</button></div>
      </form>
      <p id="account-message" role="status" aria-live="polite"></p>
    </div>`;
  document.querySelector('main').prepend(panel);
  const css = document.createElement('style');
  css.textContent = `
    #account-panel{width:100%;max-width:350px;box-sizing:border-box;padding:10px 12px;border:1px solid #8da4bf;border-radius:12px;background:#fff;color:#1e3859}
    .account-bar{display:flex;align-items:center;justify-content:space-between;gap:8px}
    #account-panel button{border:1px solid #1e3859;border-radius:8px;background:#1e3859;color:white;padding:8px 12px;cursor:pointer}
    #account-details{padding-top:10px}#account-form{display:grid;gap:8px}
    #account-form label{display:grid;gap:4px;font-size:13px}#account-form input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #8da4bf;border-radius:8px;font:inherit}
    .account-actions{display:flex;gap:6px;flex-wrap:wrap}#account-message{font-size:12px;overflow-wrap:anywhere;margin:8px 0 0}
  `;
  document.head.append(css);
  const $ = id => document.getElementById(id);
  $('account-toggle').onclick = () => { $('account-details').hidden = !$('account-details').hidden; };
  let client, currentUser = null, channel = null, loading = false, timer = null, sequence = 0;
  const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
  let activeDay = today();
  function showStatus(message) { $('account-message').textContent = message; }
  function snapshot() {
    return {
      mode: document.querySelector('.mode-option[aria-pressed="true"]')?.dataset.mode || 't1',
      teeTime: $('tee-time').value, hole: $('hole').value,
      shotgunTime: $('shotgun-time').value, shotgunStart: $('shotgun-start-hole').value,
      resultView: document.querySelector('[data-result-view][aria-pressed="true"]')?.dataset.resultView || 'table'
    };
  }
  function apply(state) {
    if (!state || loading) return;
    loading = true;
    try {
      const mode = document.querySelector('.mode-option[data-mode="' + state.mode + '"]');
      if (mode && mode.getAttribute('aria-pressed') !== 'true') mode.click();
      for (const [id, value] of [['tee-time',state.teeTime],['shotgun-time',state.shotgunTime],['shotgun-start-hole',state.shotgunStart],['hole',state.hole]]) {
        const element = $(id);
        if (value != null && [...(element.options || [])].some(o => o.value === value) || (id === 'shotgun-time' && value != null)) {
          element.value = value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      const view = document.querySelector('[data-result-view="' + state.resultView + '"]');
      if (view) view.click();
    } finally { loading = false; }
  }
  async function fetchState() {
    if (!currentUser) return;
    const {data,error} = await client.from('daily_states').select('state').eq('user_id',currentUser.id).eq('work_day',activeDay).maybeSingle();
    if (error) return showStatus('Erro ao sincronizar: ' + error.message);
    if (data) apply(data.state);
  }
  async function save() {
    if (!currentUser || loading) return;
    if (activeDay !== today()) { activeDay = today(); await fetchState(); return; }
    const state = snapshot();
    const {error} = await client.from('daily_states').upsert({user_id:currentUser.id,work_day:activeDay,state,updated_at:new Date().toISOString()},{onConflict:'user_id,work_day'});
    if (error) showStatus('Não foi possível guardar: ' + error.message);
  }
  function queueSave() {
    if (!currentUser || loading) return;
    clearTimeout(timer);
    timer = setTimeout(save,350);
  }
  function stop() { if (channel) client.removeChannel(channel); channel = null; clearTimeout(timer); }
  async function setUser(user) {
    stop();
    currentUser = user;
    activeDay = today();
    $('account-mode').textContent = user ? 'Conta partilhada' : 'Modo Guest';
    $('account-logout').hidden = !user;
    $('account-form').querySelectorAll('input').forEach(input => input.disabled = !!user);
    $('account-form').querySelector('button[type="submit"]').hidden = !!user;
    $('account-register').hidden = !!user;
    if (!user) { showStatus('Dados apenas neste dispositivo.'); return; }
    showStatus('Ligado: ' + user.email);
    await fetchState();
    if (currentUser?.id !== user.id) return;
    channel = client.channel('daily-state-' + user.id).on('postgres_changes',{event:'*',schema:'public',table:'daily_states',filter:'user_id=eq.'+user.id},() => fetchState()).subscribe();
  }
  async function initialize() {
    client = window.supabase.createClient(URL,KEY);
    const {data:{session}} = await client.auth.getSession();
    await setUser(session?.user || null);
    client.auth.onAuthStateChange((_event,session) => { setTimeout(() => setUser(session?.user || null),0); });
  }
  $('account-form').addEventListener('submit',async event => {
    event.preventDefault(); if (!client) return showStatus('A aguardar ligação...');
    const {error} = await client.auth.signInWithPassword({email:$('account-email').value.trim(),password:$('account-password').value});
    if (error) showStatus(error.message);
  });
  $('account-register').onclick = async () => {
    if (!client) return showStatus('A aguardar ligação...');
    if (!$('account-email').reportValidity() || !$('account-password').reportValidity()) return;
    const {data,error} = await client.auth.signUp({email:$('account-email').value.trim(),password:$('account-password').value});
    showStatus(error ? error.message : data.session ? 'Conta criada.' : 'Verifica o email para confirmar a conta.');
  };
  $('account-logout').onclick = () => client?.auth.signOut();
  document.querySelector('.selectors').addEventListener('change',queueSave);
  document.querySelector('.selectors').addEventListener('input',event => { if (event.target.id === 'shotgun-time') queueSave(); });
  document.querySelectorAll('.mode-option,[data-result-view]').forEach(el => el.addEventListener('click',queueSave));
  document.addEventListener('visibilitychange',() => { if (!document.hidden && currentUser) { if (activeDay !== today()) activeDay = today(); fetchState(); } });
})();
