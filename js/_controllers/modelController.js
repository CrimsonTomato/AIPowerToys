import {
    state,
    setProcessing,
    setOutputData,
    setInferenceStartTime,
    setInferenceDuration,
} from '../state.js';
import { dom } from '../dom.js';
import { renderStatus } from '../ui/main_component.js';
import { prepareModelFiles } from './modelFileManager.js';

let inferenceWorker;
let resolveSingleInferencePromise = null;
let audioContext = null;

export function initWorker() {
    inferenceWorker = new Worker(
        new URL('../../workers/inference.worker.js', import.meta.url),
        { type: 'module' }
    );

    inferenceWorker.onmessage = e => {
        const { type, data } = e.data;
        if (type === 'result') {
            if (resolveSingleInferencePromise) {
                resolveSingleInferencePromise(data);
                resolveSingleInferencePromise = null;
            } else {
                const duration = Date.now() - state.inferenceStartTime;
                setInferenceDuration(duration);
                setOutputData(data);
                setProcessing(false);
                renderStatus();
            }
        } else if (type === 'status') {
            const statusEl = dom.statusText();
            if (statusEl) statusEl.textContent = `Status: ${data}`;
        }
    };
}

export async function runInference() {
    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const modelStatus = state.modelStatuses[state.activeModuleId];
    const inputReady =
        state.inputDataURLs.length > 0 || state.inputAudioURL !== null;

    if (
        !inputReady ||
        state.isProcessing ||
        !activeModule ||
        modelStatus.status !== 'found'
    )
        return;

    setProcessing(true);
    setInferenceStartTime(Date.now());
    setInferenceDuration(null);
    setOutputData(null);
    renderStatus();

    try {
        if (
            state.processingMode === 'iterative' &&
            state.inputDataURLs.length > 1
        ) {
            await _runIterativeInference(activeModule, modelStatus);
        } else {
            await _runBatchInference(activeModule, modelStatus);
        }
    } catch (error) {
        console.error('Error during inference:', error);
        dom.statusText().textContent = `Error: ${error.message}`;
        setProcessing(false);
        setInferenceStartTime(null);
        renderStatus();
    }
}

function _getPipelineOptions(activeModule, modelStatus) {
    const selectedVariant = modelStatus.discoveredVariants?.find(
        v => v.name === modelStatus.selectedVariant
    );

    if (!selectedVariant) {
        throw new Error(
            `Could not find details for selected variant "${modelStatus.selectedVariant}".`
        );
    }

    const baseOptions = selectedVariant.pipeline_options || {};
    const userConfigs = state.runtimeConfigs[activeModule.id] || {};
    const device = state.useGpu ? 'webgpu' : 'wasm';

    const finalPipelineOptions = {
        ...baseOptions,
        ...userConfigs,
        device: device,
    };

    if (activeModule.task === 'automatic-speech-recognition') {
        finalPipelineOptions.chunk_length_s = 30;
    }

    return { selectedVariant, finalPipelineOptions };
}

async function _executeSingleInference(url, activeModule, modelStatus) {
    return new Promise(async (resolve, reject) => {
        try {
            resolveSingleInferencePromise = resolve;

            const { selectedVariant, finalPipelineOptions } =
                _getPipelineOptions(activeModule, modelStatus);

            const modelFiles = await prepareModelFiles(
                activeModule,
                selectedVariant
            );

            inferenceWorker.postMessage({
                type: 'run',
                modelFiles: modelFiles,
                modelId: activeModule.id,
                task: activeModule.task,
                pipelineOptions: finalPipelineOptions,
                data: url,
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function decodeAudio(url) {
    if (!audioContext) {
        audioContext = new AudioContext({ sampleRate: 16000 });
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);

    return decodedAudio.getChannelData(0);
}

async function _runBatchInference(activeModule, modelStatus) {
    try {
        const { selectedVariant, finalPipelineOptions } = _getPipelineOptions(
            activeModule,
            modelStatus
        );

        const modelFiles = await prepareModelFiles(
            activeModule,
            selectedVariant
        );

        let dataToProcess;
        if (state.inputAudioURL) {
            dom.statusText().textContent = 'Status: Decoding audio file...';
            dataToProcess = await decodeAudio(state.inputAudioURL.url);
        } else {
            dataToProcess =
                state.inputDataURLs.length === 1
                    ? state.inputDataURLs[0]
                    : state.inputDataURLs;
        }

        inferenceWorker.postMessage({
            type: 'run',
            modelFiles: modelFiles,
            modelId: activeModule.id,
            task: activeModule.task,
            pipelineOptions: finalPipelineOptions,
            data: dataToProcess,
        });
    } catch (error) {
        throw error;
    }
}
