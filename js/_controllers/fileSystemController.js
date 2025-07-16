import { get, set } from 'idb-keyval';
import {
    state,
    setDirectoryHandle,
    setSidebarWidth,
    setStarredModels,
    setModelOrder,
    setTheme,
    updateModelStatus,
    setCollapsedModels,
    setUseGpu,
    setProcessingMode,
} from '../state.js';
import { renderModelsList } from '../ui/models.js';
import {
    renderFolderConnectionStatus,
    applyTheme,
    applySidebarWidth,
    renderGpuStatus,
} from '../ui/main.js';

const DIRECTORY_HANDLE_KEY = 'modelsDirectoryHandle';
const APP_STATE_KEY = 'aiPowerToysState';

export async function connectToDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
        setDirectoryHandle(handle);
        renderFolderConnectionStatus();
        // Re-check statuses and save state after connecting
        await checkAllModelsStatus();
        await saveAppState();
    } catch (error) {
        console.error('Error connecting to directory:', error);
    }
}

export async function loadDirectoryHandle() {
    // Load general app state first. This includes theme, sidebarWidth, starredModels, modelOrder, AND collapsedModels.
    await loadAppState();
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (handle) {
        // Check permission for the loaded handle
        if (
            (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
        ) {
            setDirectoryHandle(handle);
            renderFolderConnectionStatus();
            await checkAllModelsStatus(); // Check statuses based on loaded directory
            return true;
        } else {
            // Permission revoked, clear the handle and reset state.
            console.warn('Permission revoked for directory handle. Resetting.');
            await set(DIRECTORY_HANDLE_KEY, null); // Clear the stored handle
            setDirectoryHandle(null); // Clear from state
        }
    }
    renderFolderConnectionStatus(); // Update UI even if no handle found
    return false;
}

export async function checkAllModelsStatus() {
    for (const module of state.modules) {
        await checkModelStatus(module);
    }
}

async function checkModelStatus(module) {
    if (!state.directoryHandle) return;

    updateModelStatus(module.id, { status: 'checking' });
    renderModelsList();

    try {
        const repoDirName = module.id.split('/')[1];
        const moduleDirHandle = await state.directoryHandle.getDirectoryHandle(
            repoDirName
        );

        let onnxFiles = [];
        let onnxSubDir = '';

        try {
            // Prefer the 'onnx' subdirectory
            const onnxDirHandle = await moduleDirHandle.getDirectoryHandle(
                'onnx'
            );
            onnxSubDir = 'onnx/';
            for await (const name of onnxDirHandle.keys()) {
                if (name.endsWith('.onnx')) {
                    onnxFiles.push(name);
                }
            }
        } catch (e) {
            // Fallback to root directory of the model
            for await (const name of moduleDirHandle.keys()) {
                if (name.endsWith('.onnx')) {
                    onnxFiles.push(name);
                }
            }
        }

        if (onnxFiles.length === 0) {
            throw new Error(
                `Found repository directory, but no .onnx files were found.`
            );
        }

        // Add the subdirectory prefix back to the file names for path consistency
        const prefixedOnnxFiles = onnxFiles.map(file => `${onnxSubDir}${file}`);

        let discoveredVariants = parseAllVariants(prefixedOnnxFiles);

        if (discoveredVariants.length > 0) {
            discoveredVariants = sortVariants(discoveredVariants);

            updateModelStatus(module.id, {
                status: 'found',
                discoveredVariants: discoveredVariants,
                selectedVariant: discoveredVariants.some(
                    v =>
                        v.name ===
                        state.modelStatuses[module.id]?.selectedVariant
                )
                    ? state.modelStatuses[module.id].selectedVariant
                    : discoveredVariants[0].name,
            });
        } else {
            throw new Error(`No recognized ONNX model variants found.`);
        }
    } catch (error) {
        console.warn(`Model check failed for "${module.id}":`, error.message);
        updateModelStatus(module.id, { status: 'missing' });
    }

    renderModelsList();
}

/**
 * Navigates the stored directoryHandle and retrieves a file's content as an ArrayBuffer.
 * @param {string} relativePath - The path to the file relative to the models folder.
 * @returns {Promise<ArrayBuffer|null>} The file content as an ArrayBuffer, or null if not found.
 */
export async function getFileBuffer(relativePath) {
    if (!state.directoryHandle) return null;

    const pathParts = relativePath.split('/');
    try {
        let currentHandle = state.directoryHandle;
        for (const part of pathParts.slice(0, -1)) {
            currentHandle = await currentHandle.getDirectoryHandle(part);
        }
        const fileHandle = await currentHandle.getFileHandle(
            pathParts[pathParts.length - 1]
        );
        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
    } catch (e) {
        console.error(`Could not get file buffer for: ${relativePath}`, e);
        return null;
    }
}

const VARIANT_SUFFIX_MAP = {
    '': { name: 'Full Precision (fp32)', options: { dtype: 'fp32' } },
    fp32: { name: 'Full Precision (fp32)', options: { dtype: 'fp32' } },
    fp16: { name: 'Half Precision (fp16)', options: { dtype: 'fp16' } },
    quantized: { name: 'Quantized (Default)', options: { quantized: true } },
    int8: { name: '8-bit Quantized (int8)', options: { dtype: 'int8' } },
    uint8: { name: '8-bit Quantized (uint8)', options: { dtype: 'uint8' } },
    q4: { name: '4-bit Quantized (q4)', options: { dtype: 'q4' } },
    bnb4: { name: '4-bit Quantized (bnb4)', options: { dtype: 'q4' } },
    q4f16: { name: '4-bit Quantized (q4f16)', options: { dtype: 'q4f16' } },
};

function getSuffix(filename) {
    const base = filename
        .replace(/\.onnx$/, '')
        .split('/')
        .pop(); // Get filename without path
    const parts = base.split('_');
    const lastPart = parts[parts.length - 1];

    if (Object.keys(VARIANT_SUFFIX_MAP).includes(lastPart)) {
        return lastPart;
    }

    return '';
}

function getBaseName(filename) {
    const base = filename
        .replace(/\.onnx$/, '')
        .split('/')
        .pop();
    const parts = base.split('_');
    const lastPart = parts[parts.length - 1];

    if (Object.keys(VARIANT_SUFFIX_MAP).includes(lastPart)) {
        return parts.slice(0, -1).join('_');
    }
    return base;
}

function parseAllVariants(prefixedOnnxFiles) {
    const variants = new Map();

    for (const file of prefixedOnnxFiles) {
        const suffix = getSuffix(file);
        const baseName = getBaseName(file);

        if (!variants.has(suffix)) {
            variants.set(suffix, {
                suffix: suffix,
                name: VARIANT_SUFFIX_MAP[suffix]?.name || `Unknown (${suffix})`,
                pipeline_options: VARIANT_SUFFIX_MAP[suffix]?.options || {},
                filesByBase: new Map(), // Group by base name first
            });
        }
        const variant = variants.get(suffix);
        if (!variant.filesByBase.has(baseName)) {
            variant.filesByBase.set(baseName, file);
        }
    }

    // Convert files map to array of full file paths
    return Array.from(variants.values()).map(v => ({
        ...v,
        files: Array.from(v.filesByBase.values()),
        filesByBase: undefined, // clean up temp property
    }));
}

/**
 * Sorts an array of variant objects according to a predefined order.
 * @param {Array<object>} variants - An array of variant objects.
 * @returns {Array<object>} The sorted array of variant objects.
 */
function sortVariants(variants) {
    const order = [
        'Full Precision (fp32)',
        'Quantized (Default)',
        'Half Precision (fp16)',
    ];

    return variants.sort((a, b) => {
        const indexA = order.indexOf(a.name);
        const indexB = order.indexOf(b.name);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        const getQuantScore = name => {
            if (name.includes('8-bit')) return 1;
            if (name.includes('4-bit')) return 2;
            return 99;
        };
        const scoreA = getQuantScore(a.name);
        const scoreB = getQuantScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;

        return a.name.localeCompare(b.name);
    });
}

/**
 * Loads all persistent application state from IndexedDB.
 */
async function loadAppState() {
    const savedState = await get(APP_STATE_KEY);
    if (savedState) {
        setSidebarWidth(savedState.sidebarWidth || 500);
        setTheme(savedState.theme || 'light');
        if (state.gpuSupported && typeof savedState.useGpu !== 'undefined') {
            setUseGpu(savedState.useGpu);
        }
        setProcessingMode(savedState.processingMode || 'batch');
        setStarredModels(new Set(savedState.starredModels || []));
        setModelOrder(savedState.modelOrder || []);

        let collapsedModelsToLoad = new Set();
        if (
            savedState.collapsedModels &&
            Array.isArray(savedState.collapsedModels)
        ) {
            collapsedModelsToLoad = new Set(savedState.collapsedModels);
        } else {
            if (state.modules && state.modules.length > 0) {
                const allModuleIds = state.modules.map(m => m.id);
                collapsedModelsToLoad = new Set(allModuleIds);
            }
        }
        setCollapsedModels(collapsedModelsToLoad);
    } else {
        if (state.modules && state.modules.length > 0) {
            const allModuleIds = state.modules.map(m => m.id);
            setCollapsedModels(new Set(allModuleIds));
        } else {
            setCollapsedModels(new Set());
        }
    }

    applyTheme();
    applySidebarWidth();
}

/**
 * Saves the current application state to IndexedDB.
 */
export async function saveAppState() {
    const appState = {
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        useGpu: state.useGpu,
        processingMode: state.processingMode,
        starredModels: Array.from(state.starredModels),
        modelOrder: state.modelOrder,
        collapsedModels: Array.from(state.collapsedModels),
    };
    await set(APP_STATE_KEY, appState);
}
