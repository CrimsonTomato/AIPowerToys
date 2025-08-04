import { dom } from '../dom.js';
import { state, setSidebarWidth } from '../state.js';
import { saveAppState } from '../_controllers/fileSystemController.js';
import { applySidebarWidth } from '../ui/sidebar.js';
import {
    renderComparisonView,
    redrawCompareCanvas,
    getImageBounds,
} from '../ui/workbench.js';
import { showInputOnCanvas } from '../ui/workbench.js';

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
        showInputOnCanvas();
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isResizingSidebar) {
        const newWidth = Math.max(300, Math.min(e.clientX, 800));
        setSidebarWidth(newWidth);
        applySidebarWidth();
    } else if (isDraggingSlider) {
        const outputArea = dom.outputArea();
        if (!outputArea) return;
        const imageBounds = getImageBounds();
        const rect = outputArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const position = Math.max(
            imageBounds.x,
            Math.min(imageBounds.x + imageBounds.width, mouseX)
        );
        dom.imageCompareSlider().style.left = `${position}px`;
        redrawCompareCanvas(position);
    }
}

function handleMouseUp() {
    if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveAppState();
    }
    if (isDraggingSlider) {
        isDraggingSlider = false;
    }
    if (state.workbench.output.comparisonMode === 'hold') {
        renderComparisonView();
    }
}

export function initMouseMoveListeners() {
    document.body.addEventListener('mousedown', handleMouseDown);
    document.body.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('mouseleave', handleMouseUp);
}
