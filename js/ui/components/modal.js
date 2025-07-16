import { dom } from '../../dom.js';

export function openImageModal(type, sourceElementOrData) {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (!modal || !modalBody) return;
    modalBody.innerHTML = '';
    let contentElement;
    if (type === 'data-url') {
        contentElement = document.createElement('img');
        contentElement.src = sourceElementOrData;
    } else if (type === 'canvas') {
        contentElement = sourceElementOrData.cloneNode(true);
        const ctx = contentElement.getContext('2d');
        ctx.drawImage(sourceElementOrData, 0, 0);
    } else if (type === 'image-data') {
        contentElement = document.createElement('canvas');
        contentElement.width = sourceElementOrData.width;
        contentElement.height = sourceElementOrData.height;
        const ctx = contentElement.getContext('2d');
        ctx.putImageData(sourceElementOrData, 0, 0);
    } else {
        return;
    }
    contentElement.classList.add('modal-image');
    modalBody.appendChild(contentElement);
    modal.classList.remove('hidden');
}

export function closeImageModal() {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (modal) modal.classList.add('hidden');
    if (modalBody) modalBody.innerHTML = '';
}
