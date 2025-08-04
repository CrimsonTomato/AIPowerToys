import { initClickListeners } from './clickHandlers.js';
import { initChangeListeners } from './changeHandlers.js';
import { initMouseMoveListeners } from './mouseMoveHandlers.js';

// Export these so they can be called dynamically when workbench content changes
export {
    handleImageDropAreaEvents,
    handleAudioDropAreaEvents,
} from './dragDropHandlers.js';

/**
 * Initializes all event listeners for the entire application.
 * This sets up global event delegation for clicks, changes, etc.
 * Component-specific rendering subscriptions are handled by the components themselves.
 */
export function initEventListeners() {
    initClickListeners();
    initChangeListeners();
    initMouseMoveListeners();
}
