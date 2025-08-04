import { get, set } from 'idb-keyval';
import { state, setDirectoryHandle } from '../state.js';
import { checkAllModelsStatus } from '../services/modelStatusService.js';
import { saveAppState } from '../services/persistenceService.js';

const DIRECTORY_HANDLE_KEY = 'modelsDirectoryHandle';

export async function connectToDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
        setDirectoryHandle(handle);
        await checkAllModelsStatus();
        await saveAppState();
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
            return true;
        } else {
            console.warn('Permission revoked for directory handle. Resetting.');
            await set(DIRECTORY_HANDLE_KEY, null);
            setDirectoryHandle(null);
        }
    }
    if (!state.system.directoryHandle) {
        setDirectoryHandle(null);
    }
    return false;
}

export async function getFileBuffer(relativePath) {
    if (!state.system.directoryHandle) return null;

    const pathParts = relativePath.split('/');
    try {
        let currentHandle = state.system.directoryHandle;
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
