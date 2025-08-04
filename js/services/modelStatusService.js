import { state, updateModelStatus } from '../state.js';

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
        .pop();
    const parts = base.split('_');
    const lastPart = parts[parts.length - 1];
    return Object.keys(VARIANT_SUFFIX_MAP).includes(lastPart) ? lastPart : '';
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
                filesByBase: new Map(),
            });
        }
        const variant = variants.get(suffix);
        if (!variant.filesByBase.has(baseName)) {
            variant.filesByBase.set(baseName, file);
        }
    }
    return Array.from(variants.values()).map(v => ({
        ...v,
        files: Array.from(v.filesByBase.values()),
        filesByBase: undefined,
    }));
}

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
        const getQuantScore = name =>
            name.includes('8-bit') ? 1 : name.includes('4-bit') ? 2 : 99;
        const scoreA = getQuantScore(a.name);
        const scoreB = getQuantScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
    });
}

async function checkModelStatus(module) {
    if (!state.system.directoryHandle) {
        updateModelStatus(module.id, { status: 'missing' });
        return;
    }

    updateModelStatus(module.id, { status: 'checking' });

    try {
        const repoDirName = module.id.split('/')[1];
        const moduleDirHandle =
            await state.system.directoryHandle.getDirectoryHandle(repoDirName);
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
            const existingStatus = state.models.modelStatuses[module.id] || {};
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

export async function checkAllModelsStatus() {
    for (const module of state.models.modules) {
        await checkModelStatus(module);
    }
}
