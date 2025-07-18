import { dom } from '../dom.js';
import { state } from '../state.js';
import { eventBus } from '../_events/eventBus.js';
import { renderGpuStatus } from './components/gpuStatus.js';

export function renderFolderConnectionStatus() {
    const connectBtn = dom.connectFolderBtn();
    const pathText = dom.currentFolderPath();
    if (!connectBtn || !pathText) return;
    if (state.directoryHandle) {
        connectBtn.textContent = 'Change Folder';
        pathText.textContent = `Connected: ${state.directoryHandle.name}`;
    } else {
        connectBtn.textContent = 'Connect Folder';
        pathText.textContent = 'Not connected';
    }
}

export function applySidebarWidth() {
    const appContainer = dom.appContainer();
    if (appContainer) {
        appContainer.style.gridTemplateColumns = `${state.sidebarWidth}px 1fr`;
    }
}

export function applyTheme() {
    const isDark = state.theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    const sunIcon = dom.themeIconSun();
    const moonIcon = dom.themeIconMoon();
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
    }
}

// --- NEW: Subscription setup ---
export function initSidebarSubscriptions() {
    eventBus.on('directoryHandleChanged', renderFolderConnectionStatus);
    eventBus.on('sidebarWidthChanged', applySidebarWidth);
    eventBus.on('gpuSupportChanged', renderGpuStatus);
    eventBus.on('useGpuChanged', renderGpuStatus);

    // Initial renders
    renderFolderConnectionStatus();
    applySidebarWidth();
    applyTheme();
    renderGpuStatus();
}
