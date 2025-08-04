import { dom } from '../dom.js';
import { state, setSidebarWidth } from '../state.js';
import { saveAppState } from '../services/persistenceService.js';
import { eventBus } from './eventBus.js';
import {
    getImageBounds,
    redrawCompareCanvas,
    showInputOnCanvas,
} from '../ui/components/ImageOutput.js';

let isResizingSidebar = false;
let isDraggingSlider = false;

function handleMouseDown(e) {
    if (e.target.matches('.sidebar-resizer')) {
        isResizingSidebar = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    } else if (e.target.closest('#image-compare-slider')) {
        isDraggingSlider = true;
        e.preventDefault();
    } else if (
        e.target.closest('.output-area') &&
        state.workbench.output.comparisonMode === 'hold'
    ) {
        showInputOnCanvas(); // Call imported function directly
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isResizingSidebar) {
        const newWidth = Math.max(300, Math.min(e.clientX, 800));
        // This is a direct DOM manipulation for live-resizing feedback,
        // which is a reasonable exception. The state will be updated on mouseup.
        dom.appContainer().style.gridTemplateColumns = `${newWidth}px 1fr`;
    } else if (isDraggingSlider) {
        const outputArea = dom.outputArea();
        if (!outputArea) return;
        const imageBounds = getImageBounds(); // Call imported function
        const rect = outputArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const position = Math.max(
            imageBounds.x,
            Math.min(imageBounds.x + imageBounds.width, mouseX)
        );
        dom.imageCompareSlider().style.left = `${position}px`;
        redrawCompareCanvas(position); // Call imported function
    }
}

function handleMouseUp(e) {
    if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Set state which will trigger the event bus to apply the width correctly
        setSidebarWidth(
            parseInt(dom.appContainer().style.gridTemplateColumns, 10)
        );
        saveAppState();
    }
    if (isDraggingSlider) {
        isDraggingSlider = false;
    }
    if (state.workbench.output.comparisonMode === 'hold') {
        // Trigger a re-render to show the output again by emitting an event
        // that the ImageOutput component is listening to.
        eventBus.emit('outputDataChanged');
    }
}

export function initMouseMoveListeners() {
    document.body.addEventListener('mousedown', handleMouseDown);
    document.body.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('mouseleave', handleMouseUp);
}
