import { dom } from '../dom.js';
import { state } from '../state.js';

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
