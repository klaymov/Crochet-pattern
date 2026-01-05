const state = {
    image: null,
    gridWidth: 60,
    gridHeight: 60,
    showCoordinates: true,
    colorMode: true,
    colorCount: 4,
    zoom: 1,
    colors: [],
    gridData: [],
    originalImageWidth: 0,
    originalImageHeight: 0,
    activeRow: null
};

const imageInput = document.getElementById('imageInput');
const gridWidthInput = document.getElementById('gridWidth');
const gridHeightInput = document.getElementById('gridHeight');
const showCoordinatesCheckbox = document.getElementById('showCoordinates');
const colorModeCheckbox = document.getElementById('colorMode');
const colorCountSelect = document.getElementById('colorCount');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const canvasWrapper = document.getElementById('canvasWrapper');
const infoPanel = document.getElementById('infoPanel');
const gridInfo = document.getElementById('gridInfo');
const colorInfo = document.getElementById('colorInfo');
const zoomControl = document.getElementById('zoomControl');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const imageDimensions = document.getElementById('imageDimensions');
const useOriginalSize = document.getElementById('useOriginalSize');
const keepAspectRatio = document.getElementById('keepAspectRatio');

imageInput.addEventListener('change', handleImageUpload);
gridWidthInput.addEventListener('input', () => state.gridWidth = parseInt(gridWidthInput.value));
gridHeightInput.addEventListener('input', () => state.gridHeight = parseInt(gridHeightInput.value));
showCoordinatesCheckbox.addEventListener('change', () => {
    state.showCoordinates = showCoordinatesCheckbox.checked;
    if (state.image) renderGrid();
});
colorModeCheckbox.addEventListener('change', () => {
    state.colorMode = colorModeCheckbox.checked;
    colorCountSelect.disabled = !state.colorMode;
});
colorCountSelect.addEventListener('change', () => {
    state.colorCount = parseInt(colorCountSelect.value);
});
generateBtn.addEventListener('click', generateGrid);
downloadBtn.addEventListener('click', downloadCanvas);
zoomSlider.addEventListener('input', handleZoom);
zoomInBtn.addEventListener('click', () => adjustZoom(0.01));
zoomOutBtn.addEventListener('click', () => adjustZoom(-0.01));
useOriginalSize.addEventListener('click', setOriginalSize);
keepAspectRatio.addEventListener('click', setAspectRatio);

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.image = img;
            state.originalImageWidth = img.width;
            state.originalImageHeight = img.height;

            previewImg.src = event.target.result;
            imageDimensions.textContent = `Оригінальний розмір: ${img.width} × ${img.height} пікселів`;
            imagePreview.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function setOriginalSize() {
    const maxSize = 200;
    let width = state.originalImageWidth;
    let height = state.originalImageHeight;

    if (width > maxSize || height > maxSize) {
        if (width > height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
        } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
        }
    }

    state.gridWidth = width;
    state.gridHeight = height;
    gridWidthInput.value = width;
    gridHeightInput.value = height;
}

function setAspectRatio() {
    const targetWidth = state.gridWidth;
    const aspectRatio = state.originalImageHeight / state.originalImageWidth;
    const newHeight = Math.round(targetWidth * aspectRatio);

    state.gridHeight = newHeight;
    gridHeightInput.value = newHeight;
}

function generateGrid() {
    if (!state.image) {
        alert('Будь ласка, завантажте зображення');
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.gridWidth;
    tempCanvas.height = state.gridHeight;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(state.image, 0, 0, state.gridWidth, state.gridHeight);
    const imageData = tempCtx.getImageData(0, 0, state.gridWidth, state.gridHeight);

    if (state.colorMode) {
        state.colors = extractColors(imageData, state.colorCount);
        state.gridData = quantizeToColors(imageData, state.colors);
    } else {
        state.colors = ['#FFFFFF', '#2C2C2C'];
        state.gridData = convertToBlackWhite(imageData);
    }

    state.activeRow = null;
    renderGrid();
    updateInfo();
    downloadBtn.style.display = 'block';
    zoomControl.style.display = 'flex';
}

function extractColors(imageData, maxColors) {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3];
        if (alpha < 128) continue;

        pixels.push([
            imageData.data[i],
            imageData.data[i + 1],
            imageData.data[i + 2]
        ]);
    }

    if (pixels.length === 0) {
        return ['#FFFFFF'];
    }

    const colors = kMeans(pixels, Math.min(maxColors, pixels.length));

    colors.sort((a, b) => {
        const brightnessA = (a[0] + a[1] + a[2]) / 3;
        const brightnessB = (b[0] + b[1] + b[2]) / 3;
        return brightnessB - brightnessA;
    });

    return colors.map(c => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`);
}

function kMeans(data, k) {
    if (data.length < k) {
        return data;
    }

    const indices = [];
    for (let i = 0; i < k; i++) {
        indices.push(Math.floor(i * data.length / k));
    }
    let centroids = indices.map(i => [...data[i]]);

    let iterations = 15;

    for (let iter = 0; iter < iterations; iter++) {
        const clusters = Array(k).fill().map(() => []);

        data.forEach(point => {
            let minDist = Infinity;
            let clusterIndex = 0;

            centroids.forEach((centroid, i) => {
                const dist = Math.sqrt(
                    Math.pow(point[0] - centroid[0], 2) +
                    Math.pow(point[1] - centroid[1], 2) +
                    Math.pow(point[2] - centroid[2], 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    clusterIndex = i;
                }
            });
            clusters[clusterIndex].push(point);
        });

        centroids = clusters.map((cluster, i) => {
            if (cluster.length === 0) return centroids[i];
            const sum = cluster.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
            return [sum[0] / cluster.length, sum[1] / cluster.length, sum[2] / cluster.length];
        });
    }

    return centroids;
}

function quantizeToColors(imageData, colors) {
    const grid = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];

        let minDist = Infinity;
        let colorIndex = 0;

        colors.forEach((color, idx) => {
            const rgb = color.match(/\d+/g).map(Number);
            const dist = Math.sqrt(
                Math.pow(r - rgb[0], 2) +
                Math.pow(g - rgb[1], 2) +
                Math.pow(b - rgb[2], 2)
            );
            if (dist < minDist) {
                minDist = dist;
                colorIndex = idx;
            }
        });

        grid.push(colorIndex);
    }
    return grid;
}

function convertToBlackWhite(imageData) {
    const grid = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const brightness = (r + g + b) / 3;
        grid.push(brightness > 127 ? 0 : 1);
    }
    return grid;
}

function renderGrid() {
    const existingCanvas = document.getElementById('gridCanvas');
    if (existingCanvas) {
        const container = existingCanvas.parentElement;
        container.remove();
    }

    const placeholder = canvasWrapper.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const cellSize = 20;
    const coordMargin = state.showCoordinates ? 30 : 0;

    const container = document.createElement('div');
    container.className = 'canvas-container';

    const canvas = document.createElement('canvas');
    canvas.id = 'gridCanvas';

    canvas.width = state.gridWidth * cellSize + coordMargin * 2;
    canvas.height = state.gridHeight * cellSize + coordMargin * 2;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.showCoordinates) {
        ctx.fillStyle = '#8B8B8B';
        ctx.font = '9px DM Sans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Numbers Top and Bottom (Reversed: 1 at the right)
        for (let x = 0; x < state.gridWidth; x++) {
            const label = (state.gridWidth - x).toString();
            const posX = coordMargin + x * cellSize + cellSize / 2;
            ctx.fillText(label, posX, 15); // Top
            ctx.fillText(label, posX, canvas.height - 15); // Bottom
        }

        // Numbers Left and Right (Reversed: 1 at the bottom)
        for (let y = 0; y < state.gridHeight; y++) {
            const label = (state.gridHeight - y).toString();
            const posY = coordMargin + y * cellSize + cellSize / 2;

            ctx.textAlign = 'right';
            ctx.fillText(label, coordMargin - 5, posY); // Left

            ctx.textAlign = 'left';
            ctx.fillText(label, canvas.width - coordMargin + 5, posY); // Right
        }
    }

    for (let y = 0; y < state.gridHeight; y++) {
        for (let x = 0; x < state.gridWidth; x++) {
            const index = y * state.gridWidth + x;
            const colorIndex = state.gridData[index];

            ctx.fillStyle = state.colors[colorIndex];
            ctx.fillRect(
                coordMargin + x * cellSize,
                coordMargin + y * cellSize,
                cellSize,
                cellSize
            );

            ctx.strokeStyle = '#E5E0D8';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                coordMargin + x * cellSize,
                coordMargin + y * cellSize,
                cellSize,
                cellSize
            );
        }
    }

    if (state.activeRow !== null) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        for (let y = 0; y < state.gridHeight; y++) {
            if (y !== state.activeRow) {
                ctx.fillRect(
                    coordMargin,
                    coordMargin + y * cellSize,
                    state.gridWidth * cellSize,
                    cellSize
                );
            }
        }

        ctx.strokeStyle = '#C77B5D';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            coordMargin,
            coordMargin + state.activeRow * cellSize,
            state.gridWidth * cellSize,
            cellSize
        );
    }

    if (state.showCoordinates) {
        ctx.strokeStyle = '#2C2C2C';
        ctx.lineWidth = 2;
        ctx.strokeRect(coordMargin, coordMargin, state.gridWidth * cellSize, state.gridHeight * cellSize);
    }

    canvas.addEventListener('click', handleCanvasClick);

    container.appendChild(canvas);
    container.style.transform = `scale(${state.zoom})`;
    container.style.transformOrigin = 'top left';
    container.style.width = (canvas.width * state.zoom) + 'px';
    container.style.height = (canvas.height * state.zoom) + 'px';
    canvasWrapper.appendChild(container);
}

function handleCanvasClick(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const cellSize = 20;
    const coordMargin = state.showCoordinates ? 30 : 0;

    // Adjust for the double margin on the canvas
    const gridX = x - coordMargin;
    const gridY = y - coordMargin;

    if (gridX >= 0 && gridY >= 0 &&
        gridX < state.gridWidth * cellSize &&
        gridY < state.gridHeight * cellSize) {

        // Calculate row index from the top (0-indexed)
        const rowIndex = Math.floor(gridY / cellSize);

        if (state.activeRow === rowIndex) {
            state.activeRow = null;
        } else {
            state.activeRow = rowIndex;
        }
    } else {
        state.activeRow = null;
    }

    renderGrid();
}

function handleZoom() {
    state.zoom = parseFloat(zoomSlider.value);
    updateZoomUI();
}

function adjustZoom(delta) {
    state.zoom = Math.min(Math.max(state.zoom + delta, 0.1), 3);
    zoomSlider.value = state.zoom;
    updateZoomUI();
}

function updateZoomUI() {
    zoomValue.textContent = Math.round(state.zoom * 100) + '%';
    const container = document.querySelector('.canvas-container');
    const canvas = document.getElementById('gridCanvas');

    if (container && canvas) {
        container.style.transform = `scale(${state.zoom})`;
        // Update physical size of the container to enable proper scrolling
        container.style.width = (canvas.width * state.zoom) + 'px';
        container.style.height = (canvas.height * state.zoom) + 'px';
    }
}

function updateInfo() {
    gridInfo.textContent = `Схема: ${state.gridWidth} × ${state.gridHeight} петель`;
    colorInfo.textContent = `Кольорів: ${state.colors.length}`;
    infoPanel.style.display = 'flex';
}

function downloadCanvas() {
    const canvas = document.getElementById('gridCanvas');
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crochet-pattern-${state.gridWidth}x${state.gridHeight}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
}
