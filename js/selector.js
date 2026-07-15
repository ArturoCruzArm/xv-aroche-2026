// ========================================
// SELECTOR DE FOTOS - XV AROCHE 2026
// Basado en el selector de invitacion-rigoberto-alondra
// Fotos: definidas en photos_list.js (const photos)
// ========================================
const STORAGE_KEY = 'xv_aroche_2026_photo_selections';
const CATEGORIES = ['ampliacion', 'impresion', 'redes_sociales', 'invitaciones_web', 'descartada'];
const CATEGORY_LABELS = {
    ampliacion: '🖼️ Ampliación',
    impresion: '📸 Impresión',
    redes_sociales: '📱 Redes',
    invitaciones_web: '💌 Inv. Web',
    descartada: '❌ Descartada'
};
let photoSelections = {};
let currentPhotoIndex = null;
let currentFilter = 'all';
const PAGE_SIZE = 60;
const PAGE_KEY = 'xv_aroche_2026_page';
let currentPage = parseInt(sessionStorage.getItem(PAGE_KEY) || '0', 10);

// Proteccion basica de imagenes
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });

// Thumbnail helper: convierte 'imagenes/foto.webp' -> 'imagenes/thumb/foto.webp'
function getThumbPath(fullPath) {
    return fullPath.replace('imagenes/', 'imagenes/thumb/');
}

// ========================================
// LOCAL STORAGE FUNCTIONS
// ========================================
function loadSelections() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            photoSelections = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error cargando selecciones:', error);
        photoSelections = {};
    }
}

function normalizeSelection(selection) {
    const normalized = {};
    CATEGORIES.forEach(cat => { normalized[cat] = !!(selection && selection[cat]); });
    normalized.notes = (selection && typeof selection.notes === 'string') ? selection.notes.trim() : '';
    return normalized;
}

function hasAnySelection(selection) {
    const normalized = normalizeSelection(selection);
    return CATEGORIES.some(cat => normalized[cat]) || !!normalized.notes;
}

function selectionsAreEqual(a, b) {
    const left = normalizeSelection(a);
    const right = normalizeSelection(b);
    return CATEGORIES.every(cat => left[cat] === right[cat]) && left.notes === right.notes;
}

function saveSelections(options) {
    const shouldSync = !options || options.sync !== false;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(photoSelections));
    } catch (error) {
        showToast('Error al guardar. Verifica el espacio del navegador.', 'error');
    }
    if (shouldSync && typeof sbUpsertSelections === 'function') {
        sbUpsertSelections().catch(function(e) { console.warn('[Supabase] Sync:', e.message); });
    }
}

function clearAllSelections() {
    if (confirm('¿Estás seguro de que quieres borrar TODAS las selecciones? Esta acción no se puede deshacer.')) {
        photoSelections = {};
        try { localStorage.setItem(STORAGE_KEY, '{}'); } catch(e) {}
        if (typeof sbDeleteAll === 'function') {
            sbDeleteAll().catch(function(e) { console.warn('[Supabase] DeleteAll:', e.message); });
        }
        renderGallery();
        updateStats();
        updateFilterButtons();
        showToast('Todas las selecciones han sido eliminadas', 'success');
    }
}

// ========================================
// STATS FUNCTIONS
// ========================================
function getStats() {
    const stats = {
        ampliacion: 0,
        impresion: 0,
        redes_sociales: 0,
        invitaciones_web: 0,
        descartada: 0,
        sinClasificar: photos.length
    };

    Object.values(photoSelections).forEach(selection => {
        CATEGORIES.forEach(cat => { if (selection[cat]) stats[cat]++; });
    });

    stats.sinClasificar = photos.length - Object.keys(photoSelections).length;

    return stats;
}

function updateStats() {
    const stats = getStats();

    document.getElementById('countAmpliacion').textContent = stats.ampliacion;
    document.getElementById('countImpresion').textContent = stats.impresion;
    document.getElementById('countRedes').textContent = stats.redes_sociales;
    document.getElementById('countInvWeb').textContent = stats.invitaciones_web;
    document.getElementById('countDescartada').textContent = stats.descartada;
    document.getElementById('countSinClasificar').textContent = stats.sinClasificar;
}

// ========================================
// GALLERY FUNCTIONS
// ========================================
function getFilteredIndices() {
    const indices = [];
    for (let i = 0; i < photos.length; i++) {
        const sel = photoSelections[i] || {};
        let show = false;
        switch (currentFilter) {
            case 'all': show = true; break;
            case 'sin-clasificar': show = !CATEGORIES.some(cat => sel[cat]); break;
            default: show = sel[currentFilter] === true; break;
        }
        if (show) indices.push(i);
    }
    return indices;
}

function getTotalPages() {
    return Math.ceil(getFilteredIndices().length / PAGE_SIZE);
}

function getPagePhotos() {
    const filtered = getFilteredIndices();
    const start = currentPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filtered.length);
    return { indices: filtered.slice(start, end), total: filtered.length, start, end };
}

function goToPage(page) {
    const total = getTotalPages();
    if (page < 0) page = 0;
    if (page >= total) page = total - 1;
    currentPage = page;
    try { sessionStorage.setItem(PAGE_KEY, String(currentPage)); } catch(e) {}
    renderGallery();
    updateStats();
    updateFilterButtons();
    window.scrollTo({ top: document.querySelector('.gallery-section').offsetTop - 10, behavior: 'smooth' });
}

function renderPagination(container) {
    const totalPages = getTotalPages();
    if (totalPages <= 1) return;

    const pageData = getPagePhotos();
    const nav = document.createElement('div');
    nav.className = 'pagination-nav';
    nav.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:16px 0;';

    const btnStyle = 'border:none;padding:10px 18px;border-radius:25px;font-size:.95rem;font-weight:600;cursor:pointer;font-family:Lato,sans-serif;transition:all .2s;';

    if (currentPage > 0) {
        const prev = document.createElement('button');
        prev.textContent = '← Anterior';
        prev.style.cssText = btnStyle + 'background:#9B84C4;color:#fff;';
        prev.addEventListener('click', () => goToPage(currentPage - 1));
        nav.appendChild(prev);
    }

    const maxBtns = 7;
    let pageStart = Math.max(0, currentPage - 3);
    let pageEnd = Math.min(totalPages, pageStart + maxBtns);
    if (pageEnd - pageStart < maxBtns) pageStart = Math.max(0, pageEnd - maxBtns);

    for (let i = pageStart; i < pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i + 1;
        const isActive = i === currentPage;
        btn.style.cssText = btnStyle + (isActive
            ? 'background:#D4478A;color:#fff;transform:scale(1.1);'
            : 'background:#eee;color:#333;');
        if (!isActive) btn.addEventListener('click', () => goToPage(i));
        nav.appendChild(btn);
    }

    if (currentPage < totalPages - 1) {
        const next = document.createElement('button');
        next.textContent = 'Siguiente →';
        next.style.cssText = btnStyle + 'background:#9B84C4;color:#fff;';
        next.addEventListener('click', () => goToPage(currentPage + 1));
        nav.appendChild(next);
    }

    const info = document.createElement('div');
    info.style.cssText = 'grid-column:1/-1;text-align:center;color:#888;font-size:.85rem;padding:4px 0;';
    info.textContent = `Fotos ${pageData.start + 1}–${pageData.end} de ${pageData.total}`;

    container.appendChild(info);
    container.appendChild(nav);
}

function renderGallery() {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;
    const topPag = document.getElementById('paginationTop');
    const bottomPag = document.getElementById('paginationBottom');

    grid.innerHTML = '';
    if (topPag) topPag.innerHTML = '';
    if (bottomPag) bottomPag.innerHTML = '';

    const filtered = getFilteredIndices();
    if (filtered.length === 0) {
        grid.innerHTML = currentFilter === 'all'
            ? '<div class="no-photos-message">No hay fotos disponibles aún.</div>'
            : '<div class="no-photos-message">No hay fotos en esta categoría.</div>';
        return;
    }

    // Validar página actual
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;

    // Paginación arriba
    if (topPag) renderPagination(topPag);

    const pageStart = currentPage * PAGE_SIZE;
    const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);

    for (let fi = pageStart; fi < pageEnd; fi++) {
        const index = filtered[fi];
        const photo = photos[index];
        const selection = photoSelections[index] || {};
        const activeCats = CATEGORIES.filter(cat => selection[cat]);
        const hasAny = activeCats.length > 0;

        const card = document.createElement('div');
        card.className = 'photo-card';
        card.dataset.index = index;

        if (selection.descartada) {
            card.classList.add('has-descartada');
        } else if (activeCats.length > 1) {
            card.classList.add('has-multiple');
        } else if (activeCats.length === 1) {
            card.classList.add(`has-${activeCats[0]}`);
        }

        let badgesHTML = '';
        if (hasAny || (selection.notes && selection.notes.trim())) {
            badgesHTML = '<div class="photo-badges">';
            activeCats.forEach(cat => {
                badgesHTML += `<span class="badge badge-${cat}">${CATEGORY_LABELS[cat]}</span>`;
            });
            if (selection.notes && selection.notes.trim()) {
                badgesHTML += '<span class="badge" style="background:#607d8b;">💬 Nota</span>';
            }
            badgesHTML += '</div>';
        }

        const displayNumber = `Foto ${index + 1}`;
        const mediaHTML = `
            <div class="photo-image-container">
                <img src="${getThumbPath(photo)}" alt="${displayNumber}" loading="lazy">
            </div>
        `;

        card.innerHTML = `
            ${mediaHTML}
            <div class="photo-number">${displayNumber}</div>
            ${badgesHTML}
        `;

        card.addEventListener('click', () => openModal(index));
        grid.appendChild(card);
    }

    // Paginación abajo
    if (bottomPag) renderPagination(bottomPag);
}

// ========================================
// FILTER FUNCTIONS
// ========================================
function setFilter(filter) {
    currentFilter = filter;
    currentPage = 0;
    renderGallery();
    updateStats();

    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function updateFilterButtons() {
    const stats = getStats();

    document.getElementById('btnFilterAll').textContent = `Todas (${photos.length})`;
    document.getElementById('btnFilterAmpliacion').textContent = `Ampliación (${stats.ampliacion})`;
    document.getElementById('btnFilterImpresion').textContent = `Impresión (${stats.impresion})`;
    document.getElementById('btnFilterRedes').textContent = `Redes (${stats.redes_sociales})`;
    document.getElementById('btnFilterInvWeb').textContent = `Inv. Web (${stats.invitaciones_web})`;
    document.getElementById('btnFilterDescartada').textContent = `Descartadas (${stats.descartada})`;
    document.getElementById('btnFilterSinClasificar').textContent = `Sin Clasificar (${stats.sinClasificar})`;
}

// ========================================
// MODAL FUNCTIONS
// ========================================
function openModal(index) {
    currentPhotoIndex = index;
    const modal = document.getElementById('photoModal');
    const modalImageContainer = document.querySelector('.modal-image-container');

    const photo = photos[index];
    const displayNumber = `Foto ${index + 1}`;

    modalImageContainer.innerHTML = `
        <img id="modalImage" src="${photo}" alt="${displayNumber}">
        <div class="modal-photo-number" id="modalPhotoNumber">${displayNumber}</div>
    `;

    const selection = photoSelections[index] || {};

    document.querySelectorAll('.option-btn').forEach(btn => {
        const category = btn.dataset.category;
        btn.classList.toggle('selected', selection[category] === true);
    });

    const notesField = document.getElementById('editNotes');
    if (notesField) notesField.value = selection.notes || '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    saveCurrentSelections();
    renderGallery();
    const modal = document.getElementById('photoModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentPhotoIndex = null;
}

// ========================================
// NAVIGATION FUNCTIONS
// ========================================
function navigatePhoto(direction) {
    if (currentPhotoIndex === null) return;

    let newIndex;
    if (direction === 'next') {
        newIndex = currentPhotoIndex + 1;
        if (newIndex >= photos.length) {
            newIndex = 0;
        }
    } else if (direction === 'prev') {
        newIndex = currentPhotoIndex - 1;
        if (newIndex < 0) {
            newIndex = photos.length - 1;
        }
    }

    saveCurrentSelections();
    openModal(newIndex);
}

function readModalSelection() {
    const selected = {};
    document.querySelectorAll('.option-btn').forEach(btn => {
        selected[btn.dataset.category] = btn.classList.contains('selected');
    });
    const notesField = document.getElementById('editNotes');
    selected.notes = notesField ? notesField.value : '';
    return selected;
}

function saveCurrentSelections() {
    if (currentPhotoIndex === null) return;

    persistPhotoSelection(currentPhotoIndex, readModalSelection());
    updateStats();
    updateFilterButtons();
}

function persistPhotoSelection(index, selection, options) {
    const previousSelection = photoSelections[index] || {};
    const normalized = normalizeSelection(selection);
    const changed = !selectionsAreEqual(previousSelection, normalized);
    const silent = options && options.silent;

    if (!changed) {
        saveSelections({ sync: false });
        return false;
    }

    if (hasAnySelection(normalized)) {
        photoSelections[index] = normalized;
        saveSelections({ sync: false });
        if (typeof sbSaveSelection === 'function') {
            sbSaveSelection(index, normalized).catch(function(e) { console.warn('[Supabase] Save:', e.message); });
        } else if (typeof sbUpsertSelections === 'function') {
            sbUpsertSelections().catch(function(e) { console.warn('[Supabase] Sync:', e.message); });
        }
    } else {
        delete photoSelections[index];
        saveSelections({ sync: false });
        if (typeof sbDeleteSelection === 'function') {
            sbDeleteSelection(index).catch(function(e) { console.warn('[Supabase] Delete:', e.message); });
        }
    }

    if (!silent) showToast('Selección actualizada', 'success');
    return true;
}

function saveModalSelection() {
    if (currentPhotoIndex === null) return;

    persistPhotoSelection(currentPhotoIndex, readModalSelection(), { silent: true });
    renderGallery();
    updateStats();
    updateFilterButtons();
    closeModal();
    showToast('Selección guardada correctamente', 'success');
}

function deleteCurrentSelection() {
    if (currentPhotoIndex === null) return;
    const displayNumber = currentPhotoIndex + 1;
    if (!confirm('¿Borrar la selección de la foto ' + displayNumber + '? Esta acción se sincronizará con todos los dispositivos.')) {
        return;
    }
    persistPhotoSelection(currentPhotoIndex, {}, { silent: true });
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    const notesField = document.getElementById('editNotes');
    if (notesField) notesField.value = '';
    renderGallery();
    updateStats();
    updateFilterButtons();
    closeModal();
    showToast('Selección borrada', 'success');
}

// ========================================
// EXPORT FUNCTIONS
// ========================================
function exportToJSON() {
    const exportData = {
        evento: 'XV Años Grecia Yareli Hernández Aroche',
        fecha_exportacion: new Date().toISOString(),
        total_fotos: photos.length,
        estadisticas: getStats(),
        selecciones: []
    };

    photos.forEach((photo, index) => {
        const selection = photoSelections[index];
        if (selection && hasAnySelection(selection)) {
            const item = {
                numero_foto: index + 1,
                archivo: photo
            };
            CATEGORIES.forEach(cat => { item[cat] = selection[cat] || false; });
            if (selection.notes && selection.notes.trim()) item.notas = selection.notes.trim();
            exportData.selecciones.push(item);
        }
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seleccion-fotos-xv-aroche-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Reporte descargado correctamente', 'success');
}

function generateTextSummary() {
    const stats = getStats();
    let summary = '🦋 SELECCIÓN DE FOTOS - XV AÑOS GRECIA YARELI\n';
    summary += '═══════════════════════════════════════════\n\n';
    summary += `📊 RESUMEN:\n`;
    summary += `   Total de fotos: ${photos.length}\n`;
    summary += `   🖼️  Ampliación: ${stats.ampliacion}\n`;
    summary += `   📸 Impresión: ${stats.impresion}\n`;
    summary += `   📱 Redes sociales: ${stats.redes_sociales}\n`;
    summary += `   💌 Inv. web: ${stats.invitaciones_web}\n`;
    summary += `   ❌ Descartadas: ${stats.descartada}\n`;
    summary += `   ⭕ Sin clasificar: ${stats.sinClasificar}\n\n`;

    const categoryNames = {
        ampliacion: '🖼️  AMPLIACIÓN',
        impresion: '📸 IMPRESIÓN',
        redes_sociales: '📱 REDES SOCIALES',
        invitaciones_web: '💌 INV. WEB',
        descartada: '❌ DESCARTADAS'
    };

    CATEGORIES.forEach(category => {
        const photosInCategory = [];
        photos.forEach((photo, index) => {
            const selection = photoSelections[index];
            if (selection && selection[category]) {
                photosInCategory.push(index + 1);
            }
        });

        if (photosInCategory.length > 0) {
            summary += `${categoryNames[category]}:\n`;
            summary += `   Fotos: ${photosInCategory.join(', ')}\n`;
            summary += `   Total: ${photosInCategory.length}\n\n`;
        }
    });

    const notas = [];
    photos.forEach((photo, index) => {
        const selection = photoSelections[index];
        if (selection && selection.notes && selection.notes.trim()) {
            notas.push(`   📸 Foto ${index + 1}: ${selection.notes.trim()}`);
        }
    });
    if (notas.length) {
        summary += `💬 COMENTARIOS:\n${notas.join('\n')}\n\n`;
    }

    summary += `📅 Generado el: ${new Date().toLocaleString('es-MX')}\n`;

    return summary;
}

function copyToClipboard() {
    const summary = generateTextSummary();

    navigator.clipboard.writeText(summary).then(() => {
        showToast('Resumen copiado al portapapeles', 'success');
    }).catch(() => {
        showToast('No se pudo copiar. Selecciona el texto manualmente.', 'error');
    });
}

function exportarWhatsApp() {
    const summary = generateTextSummary();
    window.open(`https://wa.me/524779203776?text=${encodeURIComponent(summary)}`, '_blank');
}

// ========================================
// TOAST NOTIFICATION
// ========================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================================
// EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSelections();
    renderGallery();
    updateStats();
    updateFilterButtons();

    document.getElementById('btnFilterAll').addEventListener('click', () => setFilter('all'));
    document.getElementById('btnFilterAmpliacion').addEventListener('click', () => setFilter('ampliacion'));
    document.getElementById('btnFilterImpresion').addEventListener('click', () => setFilter('impresion'));
    document.getElementById('btnFilterRedes').addEventListener('click', () => setFilter('redes_sociales'));
    document.getElementById('btnFilterInvWeb').addEventListener('click', () => setFilter('invitaciones_web'));
    document.getElementById('btnFilterDescartada').addEventListener('click', () => setFilter('descartada'));
    document.getElementById('btnFilterSinClasificar').addEventListener('click', () => setFilter('sin-clasificar'));

    document.getElementById('btnFilterAll').dataset.filter = 'all';
    document.getElementById('btnFilterAmpliacion').dataset.filter = 'ampliacion';
    document.getElementById('btnFilterImpresion').dataset.filter = 'impresion';
    document.getElementById('btnFilterRedes').dataset.filter = 'redes_sociales';
    document.getElementById('btnFilterInvWeb').dataset.filter = 'invitaciones_web';
    document.getElementById('btnFilterDescartada').dataset.filter = 'descartada';
    document.getElementById('btnFilterSinClasificar').dataset.filter = 'sin-clasificar';

    document.getElementById('btnFilterAll').classList.add('active');

    document.getElementById('btnExport').addEventListener('click', exportToJSON);
    document.getElementById('btnWhatsApp').addEventListener('click', exportarWhatsApp);
    document.getElementById('btnShare').addEventListener('click', copyToClipboard);
    document.getElementById('btnClear').addEventListener('click', clearAllSelections);

    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('btnCancelSelection').addEventListener('click', closeModal);
    document.getElementById('btnSaveSelection').addEventListener('click', saveModalSelection);
    document.getElementById('btnDeleteSelection').addEventListener('click', deleteCurrentSelection);

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
        });
    });

    document.getElementById('photoModal').addEventListener('click', (e) => {
        if (e.target.id === 'photoModal') {
            closeModal();
        }
    });

    document.getElementById('btnPrevPhoto').addEventListener('click', () => {
        navigatePhoto('prev');
    });

    document.getElementById('btnNextPhoto').addEventListener('click', () => {
        navigatePhoto('next');
    });

    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('photoModal');
        if (modal.classList.contains('active')) {
            if (e.target && e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Escape') {
                closeModal();
            } else if (e.key === 'Enter') {
                saveModalSelection();
            } else if (e.key === 'ArrowLeft') {
                navigatePhoto('prev');
            } else if (e.key === 'ArrowRight') {
                navigatePhoto('next');
            }
        }
    });

});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        saveSelections({ sync: false });
    } else if (typeof sbRefreshSelections === 'function') {
        sbRefreshSelections().catch(function(e) { console.warn('[Supabase] Refresh:', e.message); });
    }
});

window.addEventListener('beforeunload', (e) => {
    saveSelections({ sync: false });
});

// ========================================
// DOWNLOAD FUNCTIONS
// ========================================
async function downloadCurrentPhoto() {
    if (currentPhotoIndex === null) return;
    const url = photos[currentPhotoIndex];
    if (!url) return;
    const filename = 'foto-' + (currentPhotoIndex + 1) + '.jpg';
    showToast('Descargando...', 'success');
    try {
        const resp = await fetch(url, { mode: 'cors' });
        const blob = await resp.blob();
        let finalBlob = blob;
        if (!blob.type.includes('jpeg') && !blob.type.includes('jpg')) {
            const bmp = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = bmp.width; canvas.height = bmp.height;
            canvas.getContext('2d').drawImage(bmp, 0, 0);
            finalBlob = await new Promise(function(res){ canvas.toBlob(res, 'image/jpeg', 0.95); });
        }
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(finalBlob);
        a.href = objUrl; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(objUrl); }, 2000);
        if (typeof sbRegistrarVisita === 'function') sbRegistrarVisita('descarga');
        showToast('Descargando ' + filename, 'success');
    } catch(e) {
        window.open(url, '_blank');
        showToast('Abriendo foto...', 'success');
    }
}

function downloadAndClose() {
    downloadCurrentPhoto();
    closeModal();
}

// Inyectar botones de descarga en el modal al cargar
(function injectDownloadButtons(){
    function tryInject(){
        var actions = document.querySelector('.modal-actions');
        if (!actions) return;
        if (document.getElementById('btnDownloadClose')) return;
        var btnDlClose = document.createElement('button');
        btnDlClose.id = 'btnDownloadClose';
        btnDlClose.className = 'btn';
        btnDlClose.textContent = '⬇ Descargar y Cerrar';
        btnDlClose.style.cssText = 'background:#6c5ce7;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:.85rem;margin-right:4px;';
        btnDlClose.addEventListener('click', downloadAndClose);
        var btnDl = document.createElement('button');
        btnDl.id = 'btnDownloadPhoto';
        btnDl.className = 'btn';
        btnDl.textContent = '⬇ JPG';
        btnDl.style.cssText = 'background:#0984e3;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:.85rem;margin-right:4px;';
        btnDl.addEventListener('click', downloadCurrentPhoto);
        actions.insertBefore(btnDlClose, actions.firstChild);
        actions.insertBefore(btnDl, btnDlClose);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInject);
    else tryInject();
})();
