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

const DIRECTORY_HANDLE_KEY = 'modelsDirectoryHandle';
const APP_STATE_KEY = 'aiPowerToysState';

export async function connectToDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
        setDirectoryHandle(handle); // This will trigger UI updates via event bus
        await checkAllModelsStatus();
        await saveAppState();
    } catch (error) {
        console.error('Error connecting to directory:', error);
    }
}
export async function loadDirectoryHandle() {
    await loadAppState();
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (handle) {
        if (
            (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
        ) {
            setDirectoryHandle(handle);
            await checkAllModelsStatus();
            return true;
        } else {
            console.warn('Permission revoked for directory handle. Resetting.');
            await set(DIRECTORY_HANDLE_KEY, null);
            setDirectoryHandle(null);
        }
    }
    // Set handle to null if nothing was loaded, to trigger "Not Connected" state
    if (!state.directoryHandle) {
        setDirectoryHandle(null);
    }
    return false;
}

export async function checkAllModelsStatus() {
    // Sequentially check models to prevent race conditions on UI updates
    for (const module of state.modules) {
        await checkModelStatus(module);
    }
}

async function checkModelStatus(module) {
    if (!state.directoryHandle) {
        updateModelStatus(module.id, { status: 'missing' }); // Set to missing if no dir
        return;
    }

    updateModelStatus(module.id, { status: 'checking' });

    try {
        const repoDirName = module.id.split('/')[1];
        const moduleDirHandle = await state.directoryHandle.getDirectoryHandle(
            repoDirName
        );

        let onnxFiles = [];
        let onnxSubDir = '';

        try {
            const onnxDirHandle = await moduleDirHandle.getDirectoryHandle(
                'onnx'
            );
            onnxSubDir = 'onnx/';
            for await (const name of onnxDirHandle.keys()) {
                if (name.endsWith('.onnx')) onnxFiles.push(name);
            }
        } catch (e) {
            for await (const name of moduleDirHandle.keys()) {
                if (name.endsWith('.onnx')) onnxFiles.push(name);
            }
        }

        if (onnxFiles.length === 0) throw new Error('No .onnx files found.');

        const prefixedOnnxFiles = onnxFiles.map(file => `${onnxSubDir}${file}`);
        let discoveredVariants = parseAllVariants(prefixedOnnxFiles);

        if (discoveredVariants.length > 0) {
            discoveredVariants = sortVariants(discoveredVariants);
            const existingStatus = state.modelStatuses[module.id] || {};
            const selectedVariant = discoveredVariants.some(
                v => v.name === existingStatus.selectedVariant
            )
                ? existingStatus.selectedVariant
                : discoveredVariants[0].name;

            updateModelStatus(module.id, {
                status: 'found',
                discoveredVariants: discoveredVariants,
                selectedVariant: selectedVariant,
            });
        } else {
            throw new Error('No recognized ONNX model variants found.');
        }
    } catch (error) {
        updateModelStatus(module.id, { status: 'missing' });
    }
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
        // Use state setters to ensure events are fired for initial UI render
        setTheme(savedState.theme || 'light');
        setSidebarWidth(savedState.sidebarWidth || 500);
        if (state.gpuSupported && typeof savedState.useGpu !== 'undefined') {
            setUseGpu(savedState.useGpu);
        }
        setProcessingMode(savedState.processingMode || 'batch');

        // These don't have direct UI effects, so they can be set directly
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
                collapsedModelsToLoad = new Set(state.modules.map(m => m.id));
            }
        }
        setCollapsedModels(collapsedModelsToLoad);
    } else {
        // Default initial state
        setTheme('light');
        setSidebarWidth(500);
        if (state.modules && state.modules.length > 0) {
            setCollapsedModels(new Set(state.modules.map(m => m.id)));
        } else {
            setCollapsedModels(new Set());
        }
    }

    // The UI updates for these are now handled by subscriptions
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
