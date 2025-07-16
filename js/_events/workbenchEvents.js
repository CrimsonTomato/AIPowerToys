import { initClickListeners } from './clickHandlers.js';
import { initChangeListeners } from './changeHandlers.js';
import { initMouseMoveListeners } from './mouseMoveHandlers.js';
import { applyTheme } from '../ui/main_component.js';
import { applySidebarWidth } from '../ui/sidebar.js';

// Export these so they can be called dynamically when workbench content changes
export {
    handleImageDropAreaEvents,
    handleAudioDropAreaEvents,
} from './dragDropHandlers.js';

export function initWorkbenchEvents() {
    initClickListeners();
    initChangeListeners();
    initMouseMoveListeners();
}

export function initGlobalEvents() {
    applyTheme();
    applySidebarWidth();
}
