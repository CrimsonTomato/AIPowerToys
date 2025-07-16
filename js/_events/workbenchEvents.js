import { initClickListeners } from './clickHandlers.js';
import { initChangeListeners } from './changeHandlers.js';
import { initMouseMoveListeners } from './mouseMoveHandlers.js';
import { eventBus } from './eventBus.js';

// --- NEW: Import all the subscription initializers ---
import { initMainComponentSubscriptions } from '../ui/main_component.js';
import { initSidebarSubscriptions } from '../ui/sidebar.js';
import { initModelSubscriptions } from '../ui/models.js';
import { initWorkbenchSubscriptions } from '../ui/workbench.js';

// Export these so they can be called dynamically when workbench content changes
export {
    handleImageDropAreaEvents,
    handleAudioDropAreaEvents,
} from './dragDropHandlers.js';

/**
 * Initializes all event listeners for the entire application.
 */
export function initEventListeners() {
    initClickListeners();
    initChangeListeners();
    initMouseMoveListeners();
    initSubscriptions(); // NEW
}

/**
 * Initializes all event bus subscriptions for UI components.
 * This connects state changes to UI updates.
 */
function initSubscriptions() {
    initMainComponentSubscriptions();
    initSidebarSubscriptions();
    initModelSubscriptions();
    initWorkbenchSubscriptions();
}
