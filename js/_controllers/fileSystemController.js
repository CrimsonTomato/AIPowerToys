import { get, set } from 'idb-keyval';
import {
    setDirectoryHandle,
    updateModelStatus,
    setDownloadProgress,
    state,
} from '../state.js'; // MODIFIED: Added state import
import { renderModelsList, renderFolderConnectionStatus } from '../ui.js';

const DIRECTORY_HANDLE_KEY = 'modelsDirectoryHandle';

export async function connectToDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
        setDirectoryHandle(handle);
        renderFolderConnectionStatus();
        checkAllModelsStatus();
    } catch (error) {
        console.error('Error connecting to directory:', error);
    }
}

export async function loadDirectoryHandle() {
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (handle) {
        if (
            (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
        ) {
            setDirectoryHandle(handle);
            renderFolderConnectionStatus();
            await checkAllModelsStatus();
            return true;
        }
    }
    renderFolderConnectionStatus();
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
