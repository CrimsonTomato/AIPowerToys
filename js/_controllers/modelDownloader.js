import { state, updateModelStatus, setDownloadProgress } from '../state.js';
import { dom } from '../dom.js';
import { checkAllModelsStatus } from '../services/modelStatusService.js';

/**
 * Downloads a model repository from Hugging Face, including only .onnx and .json files.
 * @param {string} moduleId - The ID of the model to download.
 */
export async function downloadModel(moduleId) {
    if (!state.system.directoryHandle) {
        dom.statusText().textContent =
            'Status: Please connect to a models folder first!';
        return;
    }
    const module = state.models.modules.find(m => m.id === moduleId);
    if (!module) return;

    updateModelStatus(moduleId, { status: 'downloading' });
    setDownloadProgress({
        status: 'downloading',
        moduleId: moduleId,
        progress: 0,
        total: 0,
        filename: 'Fetching file list...',
    });

    try {
        const api_url = `https://huggingface.co/api/models/${moduleId}`;
        const response = await fetch(api_url);
        if (!response.ok)
            throw new Error(
                `Failed to fetch model info from Hugging Face API. Status: ${response.status}`
            );
        const modelInfo = await response.json();

        const filesToDownload = modelInfo.siblings.filter(fileInfo => {
            const filename = fileInfo.rfilename.toLowerCase();
            return filename.endsWith('.onnx') || filename.endsWith('.json');
        });

        if (filesToDownload.length === 0) {
            throw new Error(
                'No .onnx or .json files found in the model repository.'
            );
        }

        const dirName = moduleId.split('/')[1];
        const moduleDirHandle =
            await state.system.directoryHandle.getDirectoryHandle(dirName, {
                create: true,
            });

        let count = 0;
        for (const fileInfo of filesToDownload) {
            const filePath = fileInfo.rfilename;
            count++;

            setDownloadProgress({
                progress: count,
                total: filesToDownload.length,
                filename: filePath,
            });

            const pathParts = filePath.split('/');
            let currentHandle = moduleDirHandle;
            if (pathParts.length > 1) {
                for (const part of pathParts.slice(0, -1)) {
                    currentHandle = await currentHandle.getDirectoryHandle(
                        part,
                        { create: true }
                    );
                }
            }
            const fileHandle = await currentHandle.getFileHandle(
                pathParts[pathParts.length - 1],
                { create: true }
            );

            const downloadUrl = `https://huggingface.co/${moduleId}/resolve/main/${filePath}`;
            const fileResponse = await fetch(downloadUrl);
            const fileBlob = await fileResponse.blob();
            const writable = await fileHandle.createWritable();
            await writable.write(fileBlob);
            await writable.close();
        }

        setDownloadProgress({ status: 'idle', moduleId: null });
        dom.statusText().textContent = `Status: Model "${module.name}" downloaded successfully!`;
        await checkAllModelsStatus();
    } catch (error) {
        console.error('Download failed:', error);
        setDownloadProgress({ status: 'idle', moduleId: null });
        dom.statusText().textContent = `Status: Download for "${module.name}" failed. ${error.message}`;
        updateModelStatus(moduleId, { status: 'missing' });
    }
}
