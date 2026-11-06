(() => {
    'use strict';

    const installButton = document.getElementById('install-app');
    const installDialog = document.getElementById('install-dialog');
    const status = document.getElementById('app-status');
    const statusMessage = document.getElementById('app-status-message');
    const updateButton = document.getElementById('update-app');
    const retryButton = document.getElementById('retry-offline');
    const standalone = window.matchMedia('(display-mode: standalone)');
    let installed = standalone.matches || navigator.standalone === true;
    let installPrompt = null;
    let registration = null;
    let registrationFailed = false;
    let updateRequested = false;
    let reloading = false;

    function renderInstallButton() {
        installButton.hidden = installed || !window.isSecureContext;
    }

    function renderStatus() {
        const updateReady = Boolean(registration && registration.waiting);
        status.hidden = navigator.onLine && !registrationFailed && !updateReady;
        updateButton.hidden = !updateReady || !navigator.onLine;
        retryButton.hidden = !registrationFailed || !navigator.onLine;
        statusMessage.textContent = !navigator.onLine
            ? 'Sem rede. Os cálculos continuam disponíveis neste dispositivo.'
            : registrationFailed
                ? 'Não foi possível preparar o acesso sem internet. Podes tentar novamente.'
                : updateReady ? 'Nova versão disponível. Atualiza quando terminares a consulta.' : '';
    }

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        renderInstallButton();
    });
    window.addEventListener('appinstalled', () => {
        installed = true;
        installPrompt = null;
        renderInstallButton();
        if (installDialog.open) installDialog.close();
    });
    standalone.addEventListener('change', event => {
        installed = event.matches || navigator.standalone === true;
        renderInstallButton();
    });

    installButton.addEventListener('click', async () => {
        // Close the existing mode menu without changing the selected mode.
        document.getElementById('mode-menu').hidden = true;
        document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
        if (installPrompt) {
            const prompt = installPrompt;
            installPrompt = null;
            try {
                await prompt.prompt();
                await prompt.userChoice;
                return;
            } catch {
                // Browsers may withdraw an install event; keep manual instructions available.
            }
        }
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        document.getElementById('install-instructions').textContent = isIOS
            ? 'Abre esta página no Safari. Toca em Partilhar, escolhe “Adicionar ao ecrã principal” e confirma em “Adicionar”.'
            : /Android/.test(navigator.userAgent)
                ? 'Abre esta página no Chrome. No menu ⋮, escolhe “Instalar app” ou “Adicionar ao ecrã principal” e confirma a instalação.'
                : 'No menu do navegador, procura “Instalar app” ou “Adicionar ao ecrã principal”. No telemóvel, utiliza o Chrome no Android ou o Safari no iPhone.';
        installDialog.showModal();
    });
    installDialog.addEventListener('close', () => {
        document.getElementById('menu-toggle').focus();
    });

    async function registerWorker() {
        if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
        retryButton.disabled = true;
        try {
            registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
            registrationFailed = false;
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'redundant') registrationFailed = true;
                    renderStatus();
                });
            });
        } catch (error) {
            registrationFailed = true;
            console.warn('Marshall: não foi possível preparar o acesso offline.', error);
        } finally {
            retryButton.disabled = false;
            renderStatus();
        }
    }

    updateButton.addEventListener('click', () => {
        if (!registration || !registration.waiting) return;
        updateRequested = true;
        updateButton.disabled = true;
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // The first installation must not interrupt the current calculation.
            if (updateRequested && !reloading) {
                reloading = true;
                window.location.reload();
            }
        });
    }
    retryButton.addEventListener('click', registerWorker);
    window.addEventListener('online', () => {
        renderStatus();
        if (registrationFailed) registerWorker();
        else if (registration) registration.update().catch(() => {});
    });
    window.addEventListener('offline', renderStatus);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine && registration) {
            registration.update().catch(() => {});
        }
    });

    renderInstallButton();
    renderStatus();
    registerWorker();
})();
