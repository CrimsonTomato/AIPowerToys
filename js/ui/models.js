import Sortable from 'sortablejs';
import { dom } from '../dom.js';
import { state, setModelOrder } from '../state.js';
import { saveAppState } from '../_controllers/fileSystemController.js';
import { eventBus } from '../_events/eventBus.js';

let modelSearchTerm = '';
// --- MODIFIED: Keep the Sortable instance alive outside the render function ---
let sortableInstance = null;

export function handleSearch(term) {
    modelSearchTerm = term.toLowerCase();
    renderModelsList();
}

/**
 * Renders the entire list of model cards into the DOM using a keyed reconciliation strategy
 * to avoid full re-renders and improve performance.
 */
export function renderModelsList() {
    const container = dom.modelsList();
    if (!container) return;

    // --- NEW: Keyed Reconciliation Logic ---

    // 1. Index existing DOM nodes by their module ID for quick lookups.
    const existingNodes = new Map();
    for (const child of container.children) {
        if (child.dataset.moduleId) {
            existingNodes.set(child.dataset.moduleId, child);
        }
    }

    // 2. Determine the new, sorted list of modules that should be visible.
    const filteredModules = state.modules.filter(m =>
        m.name.toLowerCase().includes(modelSearchTerm)
    );

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
        return getSortKey(a.id) - getSortKey(b.id); // Then sort by user order
    });

    // 3. Iterate through the desired state and reconcile with the DOM.
    filteredModules.forEach(module => {
        let node = existingNodes.get(module.id);

        if (node) {
            // A. NODE EXISTS: Update its content and properties in place.
            _updateSingleModelCard(node, module);
            existingNodes.delete(module.id); // Mark as processed.
        } else {
            // B. NEW NODE: Create it from scratch.
            node = _createSingleModelCard(module);
        }
        // This ensures the node is in the correct sorted position.
        container.appendChild(node);
    });

    // 4. Remove any nodes that are no longer in the filtered list.
    for (const unusedNode of existingNodes.values()) {
        container.removeChild(unusedNode);
    }

    // --- END NEW LOGIC ---

    // Initialize SortableJS only once.
    if (!sortableInstance) {
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
                saveAppState();
                // A re-render is now fast and respects the new user-defined order.
                renderModelsList();
            },
        });
    }
}

/**
 * Creates a new model card element.
 * @param {object} module The module data to render.
 * @returns {HTMLElement} The newly created model card element.
 */
function _createSingleModelCard(module) {
    const element = document.createElement('div');
    element.className = 'model-card';
    element.dataset.moduleId = module.id;
    // Use the update function to populate the new element's content.
    _updateSingleModelCard(element, module);
    return element;
}

/**
 * Updates an existing model card element with new data.
 * @param {HTMLElement} element The DOM element of the model card to update.
 * @param {object} module The module data to render.
 */
function _updateSingleModelCard(element, module) {
    const statusInfo = state.modelStatuses[module.id] || { status: 'checking' };
    const isActive = state.activeModuleId === module.id;
    const isCollapsed = state.collapsedModels.has(module.id);
    const isStarred = state.starredModels.has(module.id);

    const currentDownloadProgress =
        statusInfo.status === 'downloading' &&
        state.downloadProgress.status === 'downloading' &&
        state.downloadProgress.moduleId === module.id
            ? state.downloadProgress
            : null;

    // Update data attributes - this is cheap and efficient.
    element.dataset.active = isActive;
    element.dataset.collapsed = isCollapsed;
    element.dataset.status = statusInfo.status;

    // Now, update the innerHTML. This is a good compromise, as we are only
    // re-rendering the content of a single card, not the entire list container.
    const starIconName = isStarred ? 'star' : 'star_border';
    const starColor = isStarred ? '#FFC107' : 'currentColor';

    element.innerHTML = `
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
        </div>`;
}

// These helper functions do not need to be changed.
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

// --- NEW: Subscription setup ---
export function initModelSubscriptions() {
    // Re-render the list if any of these things change
    const rerenderEvents = [
        'modulesChanged',
        'modelStatusUpdated',
        'activeModuleChanged',
        'modelCollapsedToggled',
        'modelStarredToggled',
        'modelOrderChanged',
        'downloadProgressChanged',
    ];
    rerenderEvents.forEach(event => eventBus.on(event, renderModelsList));

    // Initial render
    renderModelsList();
}
