import { getFileBuffer } from './fileSystemController.js';

/**
 * Gathers all necessary file buffers for a given model variant.
 * @param {object} activeModule - The manifest object for the active model.
 * @param {object} selectedVariant - The variant object for the selected model version.
 * @returns {Promise<object>} An object mapping virtual file paths to their ArrayBuffer content.
 */
export async function prepareModelFiles(activeModule, selectedVariant) {
    const modelFiles = {};
    const repoDirName = activeModule.id.split('/')[1];

    // Load all ONNX files for the selected variant. The paths are now fully qualified relative to the repo root.
    for (const onnxFile of selectedVariant.files) {
        const realPath = `${repoDirName}/${onnxFile}`;
        const modelBuffer = await getFileBuffer(realPath);
        if (!modelBuffer)
            throw new Error(`Could not load model file: ${realPath}`);

        // The path in the virtual file system for the worker.
        const virtualPath = `/models/${activeModule.id}/${onnxFile}`;
        modelFiles[virtualPath] = modelBuffer;
    }

    // Load all JSON config files.
    for (const key of activeModule.config_files) {
        const configPath = `${repoDirName}/${key}`;
        const fileBuffer = await getFileBuffer(configPath);
        if (fileBuffer) {
            modelFiles[`/models/${activeModule.id}/${key}`] = fileBuffer;
        } else {
            console.warn(
                `Manifest specified "${key}", but it was not found in the repository. This may be expected.`
            );
        }
    }
    return modelFiles;
}
