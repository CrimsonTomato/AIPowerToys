import { get, set } from 'idb-keyval';
import {
    state,
    setDirectoryHandle,
    setSidebarWidth,
    setStarredModels,
    setModelOrder,
    setTheme,
    updateModelStatus,
    setCollapsedModels
} from '../state.js';
import { renderModelsList } from '../ui/models.js';
import {
    renderFolderConnectionStatus,
    applyTheme,
    applySidebarWidth,
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

    let onnxDirHandle;
    try {
        const repoDirName = module.id.split('/')[1];
        const moduleDirHandle = await state.directoryHandle.getDirectoryHandle(
            repoDirName
        );

        try {
            onnxDirHandle = await moduleDirHandle.getDirectoryHandle('onnx');
        } catch (e) {
            throw new Error(
                `Found repository directory, but the required 'onnx' subdirectory is missing.`
            );
        }

        let discoveredVariants = []; // Use `let` so we can reassign after sorting
        for await (const [name, handle] of onnxDirHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.onnx')) {
                const variant = parseVariantFromFilename(name);
                if (variant) discoveredVariants.push(variant);
            }
        }

        if (discoveredVariants.length > 0) {
            // NEW: Sort the discovered variants
            discoveredVariants = sortVariants(discoveredVariants);

            updateModelStatus(module.id, {
                status: 'found',
                discoveredVariants: discoveredVariants,
                // Ensure selectedVariant is still valid after sorting, or default to first
                selectedVariant: discoveredVariants.some(
                    v =>
                        v.name ===
                        state.modelStatuses[module.id]?.selectedVariant
                )
                    ? state.modelStatuses[module.id].selectedVariant
                    : discoveredVariants[0].name,
            });
        } else {
            throw new Error(
                `Found 'onnx' subdirectory, but it contains no .onnx model files.`
            );
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

/**
 * A data-driven map of known ONNX file suffixes to their display names
 * and corresponding pipeline options for Transformers.js.
 */
const VARIANT_SUFFIX_MAP = {
    fp32: { name: 'Full Precision (fp32)', options: { dtype: 'fp32' } },
    fp16: { name: 'Half Precision (fp16)', options: { dtype: 'fp16' } },
    q8: { name: '8-bit Quantized (q8)', options: { dtype: 'q8' } },
    int8: { name: '8-bit Quantized (int8)', options: { dtype: 'int8' } },
    uint8: { name: '8-bit Quantized (uint8)', options: { dtype: 'uint8' } },
    q4: { name: '4-bit Quantized (q4)', options: { dtype: 'q4' } },
    bnb4: { name: '4-bit Quantized (bnb4)', options: { dtype: 'q4' } }, // bnb4 often implies q4
    q4f16: { name: '4-bit Quantized (q4f16)', options: { dtype: 'q4f16' } },
};

/**
 * A more intelligent helper function to create a variant object from an ONNX filename.
 * It uses a data map and regex for scalability and maintainability.
 * @param {string} filename - The name of the .onnx file (e.g., 'model_quantized.onnx').
 * @returns {object|null} A variant object or null if not a recognized pattern.
 */
function parseVariantFromFilename(filename) {
    const fullPath = `onnx/${filename}`;

    // Handle the two most common special cases first.
    if (filename === 'model.onnx') {
        return {
            name: 'Full Precision (fp32)',
            filename: fullPath,
            pipeline_options: { dtype: 'fp32' },
        };
    }
    if (filename === 'model_quantized.onnx') {
        // This is a special flag in Transformers.js, often a default for int8.
        return {
            name: 'Quantized (Default)', // Use 'Quantized (Default)' as requested
            filename: fullPath,
            pipeline_options: { quantized: true },
        };
    }

    // Use a regular expression to extract the suffix from "model_<suffix>.onnx"
    const match = filename.match(/^model_(.+)\.onnx$/);
    if (match && match[1]) {
        const suffix = match[1];
        const variantInfo = VARIANT_SUFFIX_MAP[suffix];

        if (variantInfo) {
            // We found a known suffix in our map.
            return {
                name: variantInfo.name,
                filename: fullPath,
                pipeline_options: variantInfo.options,
            };
        }
    }

    // Fallback for any other .onnx file that doesn't match known patterns.
    return {
        name: `Unknown (${filename})`, // Provide a name for unknown variants
        filename: fullPath,
        pipeline_options: {}, // No specific options
    };
}

/**
 * Sorts an array of variant objects according to a predefined order.
 * Order: "Quantized (Default)", "Full Precision (fp32)", "Half Precision (fp16)", then others alphabetically.
 * @param {Array<object>} variants - An array of variant objects.
 * @returns {Array<object>} The sorted array of variant objects.
 */
function sortVariants(variants) {
    const order = [
        'Quantized (Default)',
        'Full Precision (fp32)',
        'Half Precision (fp16)',
    ];

    return variants.sort((a, b) => {
        const indexA = order.indexOf(a.name);
        const indexB = order.indexOf(b.name);

        // If both are in the predefined order, sort by their index
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        // If only A is in the predefined order, A comes first
        if (indexA !== -1) {
            return -1;
        }
        // If only B is in the predefined order, B comes first
        if (indexB !== -1) {
            return 1;
        }
        // If neither is in the predefined order, sort alphabetically by name
        return a.name.localeCompare(b.name);
    });
}

/**
 * Loads all persistent application state from IndexedDB.
 * This includes theme, sidebar width, starred models, model order, and collapsed models.
 */
async function loadAppState() {
    const savedState = await get(APP_STATE_KEY);
    if (savedState) {
        // Load sidebar width
        setSidebarWidth(savedState.sidebarWidth || 500);
        // Load theme
        setTheme(savedState.theme || 'light');
        // Load starred models (convert back to Set)
        setStarredModels(new Set(savedState.starredModels || []));
        // Load model order
        setModelOrder(savedState.modelOrder || []);

        // --- NEW: Load collapsed models state ---
        let collapsedModelsToLoad = new Set();
        if (
            savedState.collapsedModels &&
            Array.isArray(savedState.collapsedModels)
        ) {
            // If we have saved collapsed state, use it.
            collapsedModelsToLoad = new Set(savedState.collapsedModels);
        } else {
            // Default behavior: collapse ALL models if no specific state is saved.
            // This ensures the cards are collapsed by default on first run or if the previous save was incomplete.
            // We rely on state.modules being populated by main.js before this function is called.
            if (state.modules && state.modules.length > 0) {
                const allModuleIds = state.modules.map(m => m.id);
                collapsedModelsToLoad = new Set(allModuleIds);
            }
        }
        // Update the state with the loaded or default collapsed models.
        setCollapsedModels(collapsedModelsToLoad);
        // --- END NEW ---
    } else {
        // If no saved state at all (e.g., first run), apply default collapsed state.
        if (state.modules && state.modules.length > 0) {
            const allModuleIds = state.modules.map(m => m.id);
            setCollapsedModels(new Set(allModuleIds)); // Collapse all models by default
        } else {
            setCollapsedModels(new Set()); // Ensure it's a Set if modules are empty.
        }
    }

    applyTheme(); // Apply theme immediately after loading
    applySidebarWidth(); // Apply sidebar width immediately after loading
}

/**
 * Saves the current application state to IndexedDB.
 * This includes theme, sidebar width, starred models, model order, and collapsed models.
 */
export async function saveAppState() {
    // Prepare the state to be saved
    const appState = {
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        starredModels: Array.from(state.starredModels), // Convert Set to Array for saving
        modelOrder: state.modelOrder,
        collapsedModels: Array.from(state.collapsedModels), // Convert collapsed Set to Array for saving
    };
    await set(APP_STATE_KEY, appState); // Save to IndexedDB
}
