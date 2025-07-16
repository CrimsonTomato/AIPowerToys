import { dom } from '../../dom.js';
import { state } from '../../state.js';

export function renderGpuStatus() {
    const statusEl = dom.gpuStatusText();
    const toggleBtn = dom.gpuToggleBtn();
    if (!statusEl || !toggleBtn) return;

    if (state.gpuSupported) {
        statusEl.textContent = 'WebGPU supported and available.';
        toggleBtn.disabled = false;
        if (state.useGpu) {
            toggleBtn.textContent = 'GPU: ON';
            toggleBtn.classList.add('btn-primary');
            toggleBtn.classList.remove('btn-secondary');
        } else {
            toggleBtn.textContent = 'GPU: OFF';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
        }
    } else {
        statusEl.textContent = 'WebGPU not supported by this browser/device.';
        toggleBtn.disabled = true;
        toggleBtn.textContent = 'GPU: N/A';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
    }
}
