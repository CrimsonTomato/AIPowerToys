import { initModelSubscriptions } from '../models.js';
import { initSidebarSubscriptions } from '../sidebar.js';

/**
 * Initializes all components and subscriptions related to the sidebar.
 */
export function initSidebarView() {
    // These functions already encapsulate the logic and subscriptions
    // for their respective parts of the sidebar. This view just
    // ensures they are all called.
    initModelSubscriptions();
    initSidebarSubscriptions();
}
