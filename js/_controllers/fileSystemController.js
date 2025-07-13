import { get, set } from 'idb-keyval';
import { setDirectoryHandle, updateModelStatus } from '../state.js';
import { renderModelsList } from '../ui.js';
import { state } from '../state.js';

const DIRECTORY_HANDLE_KEY = 'modelsDirectoryHandle';

export async function connectToDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
        setDirectoryHandle(handle);
        checkAllModelsStatus();
    } catch (error) {
        console.error('Error connecting to directory:', error);
        alert('Failed to get directory handle. Please try again.');
    }
}

export async function loadDirectoryHandle() {
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (handle) {
        if (
            (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
        ) {
            setDirectoryHandle(handle);
            checkAllModelsStatus();
            return true;
        }
    }
    return false;
}

export async function checkAllModelsStatus() {
    for (const module of state.modules) {
        await checkModelStatus(module); // Ensure we await the check
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
        const onnxDirHandle = await moduleDirHandle.getDirectoryHandle('onnx');

        const discoveredVariants = [];
        // Iterate through all files in the onnx directory
        for await (const [name, handle] of onnxDirHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.onnx')) {
                const variant = parseVariantFromFilename(name);
                if (variant) {
                    discoveredVariants.push(variant);
                }
            }
        }

        if (discoveredVariants.length > 0) {
            updateModelStatus(module.id, {
                status: 'found',
                discoveredVariants: discoveredVariants,
                // Default to the first discovered variant
                selectedVariant: discoveredVariants[0].name,
            });
        } else {
            // Found the repo, but no .onnx files in the onnx folder
            updateModelStatus(module.id, { status: 'missing' });
        }
    } catch (error) {
        // Could not find the repo directory or onnx subdirectory
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
            name: 'Quantized (Default)',
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
    // The user can still try to run it.
    return {
        name: `Unknown (${filename})`,
        filename: fullPath,
        pipeline_options: {}, // No specific options
    };
}
