import Sortable from 'sortablejs';
import { dom } from '../dom.js';
import { state, setModelOrder } from '../state.js';
import { saveAppState } from '../_controllers/fileSystemController.js';

let modelSearchTerm = '';
let sortableInstance = null;

export function handleSearch(term) {
    modelSearchTerm = term.toLowerCase();
    renderModelsList();
}

/**
 * Renders the entire list of model cards into the DOM.
 */
export function renderModelsList() {
    const container = dom.modelsList();
    if (!container) return;

    // 1. Filter models based on search term
    const filteredModules = state.modules.filter(m =>
        m.name.toLowerCase().includes(modelSearchTerm)
    );

    // 2. Create a stable order, respecting user sort and stars
    const getSortKey = id => {
        const orderIndex = state.modelOrder.indexOf(id);
        return orderIndex === -1 ? Infinity : orderIndex;
    };
    filteredModules.sort((a, b) => {
        const aIsStarred = state.starredModels.has(a.id);
        const bIsStarred = state.starredModels.has(b.id);

        if (aIsStarred !== bIsStarred) {
            return aIsStarred ? -1 : 1; // Starred models first
        }
        return getSortKey(a.id) - getSortKey(b.id); // Then sort by order
    });

    // 3. Render HTML
    container.innerHTML = filteredModules
        .map(module => _renderSingleModelCard(module))
        .join('');

    // 4. Initialize or update SortableJS
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    sortableInstance = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.star-btn, .model-card-toggle-btn, .select-model-btn, .download-btn',
        onEnd: evt => {
            const newOrder = Array.from(evt.to.children).map(
                el => el.dataset.moduleId
            );
            setModelOrder(newOrder);

            // --- NEW: Persist the model order change ---
            saveAppState();
            // --- END NEW ---

            // Re-render the list. This is important because changing the order
            // might change the visual position of starred vs unstarred items,
            // and we want the rendering to accurately reflect the new sorted state.
            renderModelsList();
        },
    });
}

function _renderSingleModelCard(module) {
    const statusInfo = state.modelStatuses[module.id] || { status: 'checking' };
    // The collapsed state is determined by state.collapsedModels, which is managed by toggleModelCollapsed.
    // The data-collapsed attribute reflects this state.
    const isCollapsed = state.collapsedModels.has(module.id);

    const isActive = state.activeModuleId === module.id;
    const isStarred = state.starredModels.has(module.id);

    const currentDownloadProgress =
        statusInfo.status === 'downloading' &&
        state.downloadProgress.status === 'downloading' &&
        state.downloadProgress.moduleId === module.id
            ? state.downloadProgress
            : null;

    const starIconName = isStarred ? 'star' : 'star_border';
    const starColor = isStarred ? '#FFC107' : 'currentColor'; // Yellow for starred, default for not

    return `
        <div class="model-card"
             data-module-id="${module.id}"
             data-active="${isActive}"
             data-collapsed="${isCollapsed}"
             data-status="${statusInfo.status}">

            <div class="model-card-header">
                <button class="star-btn icon-btn" data-module-id="${
                    module.id
                }" title="Star/Pin Model">
                    <span class="material-icons" style="color: ${starColor};">${starIconName}</span>
                </button>
                <h3>${module.name}</h3>
                <button class="model-card-toggle-btn" data-module-id="${
                    module.id
                }" title="Expand/Collapse Details">
                    <span class="material-icons">expand_more</span>
                </button>
            </div>

            <div class="model-card-content">
                <p>${module.description}</p>
                ${_renderModelStatus(statusInfo, currentDownloadProgress)}
                <div class="model-controls">${_renderModelControls(
                    module,
                    statusInfo
                )}</div>
            </div>
        </div>`;
}

// ... _renderModelStatus and _renderModelControls remain unchanged ...
function _renderModelStatus(statusInfo, downloadProgressInfo = null) {
    let statusHtml = '';
    switch (statusInfo.status) {
        case 'checking':
            statusHtml = '<p>Status: Checking...</p>';
            break;
        case 'missing':
            statusHtml =
                '<p class="status-missing">Status: Repository not found</p>';
            break;
        case 'found':
            statusHtml = '<p class="status-found">Status: Found</p>';
            break;
        case 'downloading':
            if (downloadProgressInfo && downloadProgressInfo.total > 0) {
                const filenameParts = downloadProgressInfo.filename.split('/');
                const shortFilename =
                    filenameParts.length > 1
                        ? `.../${filenameParts[filenameParts.length - 1]}`
                        : downloadProgressInfo.filename;
                const percentage = Math.round(
                    (downloadProgressInfo.progress /
                        downloadProgressInfo.total) *
                        100
                );
                statusHtml = `
                    <p>Downloading: ${shortFilename} (${downloadProgressInfo.progress}/${downloadProgressInfo.total})</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>`;
            } else {
                statusHtml = `<p>Status: Downloading...</p>`;
            }
            break;
        default:
            statusHtml = '';
            break;
    }
    return statusHtml;
}

function _renderModelControls(module, statusInfo) {
    if (statusInfo.status === 'found') {
        return `
            <select class="variant-selector select-input" data-module-id="${
                module.id
            }">
                ${(statusInfo.discoveredVariants || [])
                    .map(
                        v =>
                            `<option value="${v.name}" ${
                                statusInfo.selectedVariant === v.name
                                    ? 'selected'
                                    : ''
                            }>${v.name}</option>`
                    )
                    .join('')}
            </select>
            <button class="select-model-btn btn" data-module-id="${
                module.id
            }">Use Model</button>`;
    } else if (statusInfo.status === 'missing') {
        return `<button class="download-btn btn" data-module-id="${module.id}">Download</button>`;
    }
    return '';
}
