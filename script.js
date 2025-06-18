document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // 1. DOM ELEMENT REFERENCES
    // =================================================================
    const canvas = document.getElementById('sprite-canvas');
    const ctx = canvas.getContext('2d');
    const spriteWidthInput = document.getElementById('sprite-width');
    const spriteHeightInput = document.getElementById('sprite-height');
    const resizeSpriteBtn = document.getElementById('resize-sprite-btn');
    const pixelModeBtn = document.getElementById('pixel-mode');
    const attributeModeBtn = document.getElementById('attribute-mode');
    const attributeControls = document.getElementById('attribute-controls');
    const selectedCharLabel = document.getElementById('selected-char-label');
    const flashBitCheckbox = document.getElementById('flash-bit');
    const brightBitCheckbox = document.getElementById('bright-bit');
    const attrButtons = document.querySelectorAll('.attr-btn');
    const spriteListDiv = document.getElementById('sprite-list');
    const addSpriteBtn = document.getElementById('add-sprite-btn');
    const deleteSpriteBtn = document.getElementById('delete-sprite-btn');
    const moveSpriteUpBtn = document.getElementById('move-sprite-up-btn');
    const moveSpriteDownBtn = document.getElementById('move-sprite-down-btn');
    const loadFileBtn = document.getElementById('load-file-btn');
    const saveFileBtn = document.getElementById('save-file-btn');
    const fileInput = document.getElementById('file-input');
    const blockModal = document.getElementById('block-modal');
    const modalBlockList = document.getElementById('modal-block-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const themeToggle = document.getElementById('theme-toggle');


    // =================================================================
    // 2. EDITOR STATE & CONSTANTS
    // =================================================================
    let spriteSet = [];
    let selectedSpriteIndex = -1;
    let isPixelMode = true;
    let selectedCharX = -1;
    let selectedCharY = -1;
    let isDrawing = false;
    let drawingValue = 0;
    let isFlashInverted = false;

    const charWidth = 8,
        charHeight = 8,
        pixelSize = 10;

    const spectrumColorsNormal = ['#000000', '#0000D7', '#D70000', '#D700D7', '#00D700', '#00D7D7', '#D7D700', '#D7D7D7'];
    const spectrumColorsBright = ['#000000', '#0000FF', '#FF0000', '#FF00FF', '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'];


    // =================================================================
    // 3. THEME MANAGEMENT
    // =================================================================
    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            if (themeToggle) themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-theme');
            if (themeToggle) themeToggle.checked = false;
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('spriteEditorTheme', newTheme);
        applyTheme(newTheme);
    }


    // =================================================================
    // 4. UNDO / REDO HISTORY MANAGEMENT
    // =================================================================

    /**
     * Creates a deep copy of a sprite's drawable data.
     * @param {object} sprite - The sprite to capture.
     * @returns {object} A snapshot of the sprite's pixel and attribute data.
     */
    function captureSpriteState(sprite) {
        return {
            pixelData: JSON.parse(JSON.stringify(sprite.pixelData)),
            attributeData: JSON.parse(JSON.stringify(sprite.attributeData))
        };
    }

    /**
     * Pushes the current state of a sprite onto its undo stack.
     * This should be called *before* any modification is made.
     */
    function pushHistoryState() {
        if (selectedSpriteIndex < 0) return;
        const sprite = spriteSet[selectedSpriteIndex];
        const currentState = captureSpriteState(sprite);
        sprite.history.undoStack.push(currentState);
        sprite.history.redoStack = []; // Clear the redo stack on a new action
    }

    /**
     * Applies a saved state back to a sprite.
     * @param {object} sprite - The target sprite.
     * @param {object} state - The state object to apply.
     */
    function applyHistoryState(sprite, state) {
        sprite.pixelData = JSON.parse(JSON.stringify(state.pixelData));
        sprite.attributeData = JSON.parse(JSON.stringify(state.attributeData));
        redrawAndGenerate();
    }

    function undo() {
        if (selectedSpriteIndex < 0) return;
        const sprite = spriteSet[selectedSpriteIndex];
        if (sprite.history.undoStack.length === 0) return; // Nothing to undo

        const currentState = captureSpriteState(sprite);
        sprite.history.redoStack.push(currentState);

        const lastState = sprite.history.undoStack.pop();
        applyHistoryState(sprite, lastState);
    }

    function redo() {
        if (selectedSpriteIndex < 0) return;
        const sprite = spriteSet[selectedSpriteIndex];
        if (sprite.history.redoStack.length === 0) return; // Nothing to redo

        const currentState = captureSpriteState(sprite);
        sprite.history.undoStack.push(currentState);

        const nextState = sprite.history.redoStack.pop();
        applyHistoryState(sprite, nextState);
    }


    // =================================================================
    // 5. BINARY PARSER LOGIC for .TAP FILES
    // =================================================================
    var TapeStream = (() => {
        function TapeStream(arrayBuffer) {
            this.dataView = new DataView(arrayBuffer);
            this.pos = 0;
        }
        TapeStream.prototype.readBytes = function (len) {
            var res = this.dataView.buffer.slice(this.pos, this.pos + len);
            this.pos += len;
            return res;
        };
        TapeStream.prototype.readU1 = function () {
            var v = this.dataView.getUint8(this.pos);
            this.pos += 1;
            return v;
        };
        TapeStream.prototype.readU2le = function () {
            var v = this.dataView.getUint16(this.pos, true);
            this.pos += 2;
            return v;
        };
        TapeStream.prototype.isEof = function () {
            return this.pos >= this.dataView.byteLength;
        };
        return TapeStream;
    })();

    var ZxSpectrumTap = (() => {
        function ZxSpectrumTap(_io) {
            this._io = _io;
            this._read();
        }
        ZxSpectrumTap.prototype._read = function () {
            this.blocks = [];
            while (!this._io.isEof()) {
                this.blocks.push(new ZxSpectrumTap.TapBlock(this._io));
            }
        };
        ZxSpectrumTap.TapBlock = (() => {
            function TapBlock(_io) {
                this._io = _io;
                this._read();
            }
            TapBlock.prototype._read = function () {
                this.lenBlock = this._io.readU2le();
                if (this.lenBlock > 0) {
                    const blockPayload = new Uint8Array(this._io.readBytes(this.lenBlock));
                    this.flag = blockPayload[0];
                    const actualDataBytes = blockPayload.slice(1, -1);
                    this.checksum = blockPayload[blockPayload.length - 1];
                    if (this.flag === 0) {
                        this.header = new ZxSpectrumTap.Header(new TapeStream(actualDataBytes.buffer));
                    } else if (this.flag === 255) {
                        this.data = actualDataBytes.buffer;
                    }
                }
            };
            return TapBlock;
        })();
        ZxSpectrumTap.Header = (() => {
            function Header(_io) {
                this._io = _io;
                this._read();
            }
            Header.prototype._read = function () {
                this.headerType = this._io.readU1();
                this.filename = new TextDecoder("ascii").decode(this._io.readBytes(10)).trim();
                this.lenData = this._io.readU2le();
                this.param1 = this._io.readU2le();
                this.param2 = this._io.readU2le();
            };
            return Header;
        })();
        return ZxSpectrumTap;
    })();


    // =================================================================
    // 6. FILE I/O AND MODAL LOGIC
    // =================================================================
    function handleLoad() {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const tapFile = new ZxSpectrumTap(new TapeStream(e.target.result));
                const codeBlocks = [];
                for (let i = 0; i < tapFile.blocks.length; i++) {
                    if (tapFile.blocks[i].header && (i + 1 < tapFile.blocks.length) && tapFile.blocks[i + 1].data) {
                        codeBlocks.push({
                            name: tapFile.blocks[i].header.filename,
                            data: new Uint8Array(tapFile.blocks[i + 1].data)
                        });
                    }
                }
                if (codeBlocks.length === 0) {
                    alert("No valid sprite data blocks found in this TAP file.");
                    return;
                }
                showBlockModal(codeBlocks);
            } catch (error) {
                alert("Error reading or parsing TAP file: " + error.message);
                console.error(error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function handleSave() {
        if (spriteSet.length === 0) {
            alert("Nothing to save. Add some sprites first.");
            return;
        }
        let filename = prompt("Enter filename for TAP file (max 10 chars, e.g. 'sprites'):", "sprites");
        if (!filename) return;

        try {
            const totalSpriteDataSize = spriteSet.reduce((acc, s) => acc + 5 + 9 * s.width * s.height, 0);
            const endAddress = 56575;
            const startAddress = endAddress - totalSpriteDataSize;

            if (startAddress < 0) {
                throw new Error(`Sprite data is too large (${totalSpriteDataSize} bytes) to fit into memory.`);
            }

            const spriteDataBuffer = buildOption2Data(startAddress);
            const {
                tapBuffer
            } = buildTapFile(spriteDataBuffer, filename, startAddress);

            const finalFilename = `${filename.trim().split(' ')[0]}_${startAddress}.tap`;
            const blob = new Blob([tapBuffer], {
                type: "application/x-tap"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const laserBasicLoadCommand = `CLEAR ${startAddress - 1}: LOAD "${filename}" CODE ${startAddress}: .POKE 62464, ${startAddress}`;
            prompt("File saved! Copy this command to load sprites in Laser Basic:", laserBasicLoadCommand);

        } catch (error) {
            alert("Error creating TAP file: " + error.message);
            console.error(error);
        }
    }

    function showBlockModal(blocks) {
        modalBlockList.innerHTML = '';
        blocks.forEach(block => {
            const item = document.createElement('button');
            item.className = 'block-item';
            item.textContent = `${block.name} (${block.data.length} bytes)`;
            item.onclick = () => {
                const newSpriteSet = parseOption2Data(block.data);
                // Add empty history to each loaded sprite
                newSpriteSet.forEach(s => s.history = {
                    undoStack: [],
                    redoStack: []
                });
                spriteSet = newSpriteSet;
                selectSprite(0);
                hideBlockModal();
            };
            modalBlockList.appendChild(item);
        });
        blockModal.classList.remove('hidden');
    }

    function hideBlockModal() {
        blockModal.classList.add('hidden');
    }


    // =================================================================
    // 7. DATA CONVERSION (Editor Format <-> Binary Format)
    // =================================================================
    function parseOption2Data(data) {
        const newSpriteSet = [];
        let offset = 0;
        while (offset < data.length) {
            if (data[offset] === 0 || offset + 5 > data.length) break;
            const spriteLenChars = data[offset + 3],
                spriteHgtChars = data[offset + 4];
            if (spriteLenChars === 0 || spriteHgtChars === 0) break;
            const pixelDataSize = 8 * spriteHgtChars * spriteLenChars,
                attrDataSize = spriteHgtChars * spriteLenChars,
                totalSpriteSize = 5 + pixelDataSize + attrDataSize;
            if (offset + totalSpriteSize > data.length) break;
            const pixelData = [],
                pixelDataOffset = offset + 5;
            for (let y = 0; y < spriteHgtChars * 8; y++) {
                pixelData[y] = [];
                for (let x_char = 0; x_char < spriteLenChars; x_char++) {
                    const byte = data[pixelDataOffset + y * spriteLenChars + x_char];
                    for (let bit = 0; bit < 8; bit++) pixelData[y][x_char * 8 + bit] = (byte & (1 << (7 - bit))) ? 1 : 0;
                }
            }
            const attributeData = [],
                attrDataOffset = pixelDataOffset + pixelDataSize;
            for (let y_char = 0; y_char < spriteHgtChars; y_char++) {
                attributeData[y_char] = [];
                for (let x_char = 0; x_char < spriteLenChars; x_char++) attributeData[y_char][x_char] = data[attrDataOffset + y_char * spriteLenChars + x_char];
            }
            newSpriteSet.push({
                width: spriteLenChars,
                height: spriteHgtChars,
                pixelData,
                attributeData
            });
            offset += totalSpriteSize;
        }
        return newSpriteSet;
    }

    function buildOption2Data(startAddress) {
        const totalBytes = spriteSet.reduce((acc, s) => acc + 5 + 9 * s.width * s.height, 0);
        const buffer = new ArrayBuffer(totalBytes);
        const dataView = new DataView(buffer);
        let currentOffset = 0;
        let currentAddress = startAddress;

        for (let i = 0; i < spriteSet.length; i++) {
            const sprite = spriteSet[i];
            const spriteSize = 5 + 9 * sprite.width * sprite.height;
            const nextAddress = (i === spriteSet.length - 1) ? 0 : currentAddress + spriteSize;

            dataView.setUint8(currentOffset, i + 1);
            dataView.setUint16(currentOffset + 1, nextAddress, true);
            dataView.setUint8(currentOffset + 3, sprite.width);
            dataView.setUint8(currentOffset + 4, sprite.height);

            let pixelDataOffset = currentOffset + 5;
            for (let y = 0; y < sprite.height * 8; y++) {
                for (let x_char = 0; x_char < sprite.width; x_char++) {
                    let byte = 0;
                    for (let bit = 0; bit < 8; bit++)
                        if (sprite.pixelData[y][x_char * 8 + bit]) byte |= 1 << (7 - bit);
                    dataView.setUint8(pixelDataOffset + y * sprite.width + x_char, byte);
                }
            }
            let attrDataOffset = pixelDataOffset + 8 * sprite.height * sprite.width;
            for (let y_char = 0; y_char < sprite.height; y_char++) {
                for (let x_char = 0; x_char < sprite.width; x_char++) {
                    dataView.setUint8(attrDataOffset + y_char * sprite.width + x_char, sprite.attributeData[y_char][x_char]);
                }
            }
            currentOffset += spriteSize;
            currentAddress += spriteSize;
        }
        return new Uint8Array(buffer);
    }

    function createTapBlock(flag, payload) {
        const blockContents = new Uint8Array(1 + payload.length);
        blockContents[0] = flag;
        blockContents.set(payload, 1);
        let checksum = 0;
        for (const byte of blockContents) checksum ^= byte;
        const fullBlock = new Uint8Array(2 + blockContents.length + 1);
        const view = new DataView(fullBlock.buffer);
        view.setUint16(0, blockContents.length + 1, true);
        fullBlock.set(blockContents, 2);
        fullBlock[fullBlock.length - 1] = checksum;
        return fullBlock;
    }

    function buildTapFile(spriteData, filename, startAddress) {
        const headerPayload = new Uint8Array(17);
        const headerView = new DataView(headerPayload.buffer);
        headerPayload[0] = 3;
        for (let i = 0; i < 10; i++) headerPayload[i + 1] = (filename.padEnd(10, ' ')[i] || ' ').charCodeAt(0);
        headerView.setUint16(11, spriteData.length, true);
        headerView.setUint16(13, startAddress, true);
        headerView.setUint16(15, 32768, true);
        const headerBlock = createTapBlock(0, headerPayload);
        const dataBlock = createTapBlock(255, spriteData);
        const tapFile = new Uint8Array(headerBlock.length + dataBlock.length);
        tapFile.set(headerBlock, 0);
        tapFile.set(dataBlock, headerBlock.length);
        return {
            tapBuffer: tapFile.buffer,
            startAddress: startAddress
        };
    }


    // =================================================================
    // 8. SPRITE MANAGEMENT
    // =================================================================
    /**
     * Creates a new sprite object, including its personal history stacks.
     */
    function createNewSprite(widthChars, heightChars) {
        return {
            width: widthChars,
            height: heightChars,
            pixelData: Array.from({
                length: heightChars * charHeight
            }, () => Array(widthChars * charWidth).fill(0)),
            attributeData: Array.from({
                length: heightChars
            }, () => Array(widthChars).fill(56)),
            history: {
                undoStack: [],
                redoStack: []
            }
        };
    }

    function addSprite() {
        if (spriteSet.length >= 255) {
            alert("Maximum sprites (255) reached.");
            return;
        }
        spriteSet.push(createNewSprite(2, 2));
        selectSprite(spriteSet.length - 1);
    }

    function deleteSelectedSprite() {
        if (selectedSpriteIndex < 0) return;
        spriteSet.splice(selectedSpriteIndex, 1); // History is deleted along with the sprite object
        if (spriteSet.length === 0) {
            selectedSpriteIndex = -1;
            clearEditor();
        } else {
            selectSprite(Math.max(0, selectedSpriteIndex - 1));
        }
        renderSpriteList();
    }

    function selectSprite(index) {
        if (spriteSet.length === 0) {
            clearEditor();
            return;
        }
        if (index < 0 || index >= spriteSet.length) {
            index = 0;
        }
        selectedSpriteIndex = index;
        const sprite = spriteSet[index];
        spriteWidthInput.value = sprite.width;
        spriteHeightInput.value = sprite.height;
        selectedCharX = -1;
        selectedCharY = -1;
        updateAttributeControlsUI();
        renderSpriteList();
        redrawAndGenerate();
    }

    /**
     * Resizes a sprite and clears its history stacks.
     */
    function resizeSelectedSprite() {
        if (selectedSpriteIndex < 0) return;
        const newWidth = parseInt(spriteWidthInput.value);
        const newHeight = parseInt(spriteHeightInput.value);
        spriteSet[selectedSpriteIndex] = createNewSprite(newWidth, newHeight);
        redrawAndGenerate();
        renderSpriteList();
    }

    function moveSpriteUp() {
        if (selectedSpriteIndex <= 0) return;
        [spriteSet[selectedSpriteIndex - 1], spriteSet[selectedSpriteIndex]] = [spriteSet[selectedSpriteIndex], spriteSet[selectedSpriteIndex - 1]];
        selectSprite(selectedSpriteIndex - 1);
    }

    function moveSpriteDown() {
        if (selectedSpriteIndex < 0 || selectedSpriteIndex >= spriteSet.length - 1) return;
        [spriteSet[selectedSpriteIndex + 1], spriteSet[selectedSpriteIndex]] = [spriteSet[selectedSpriteIndex], spriteSet[selectedSpriteIndex + 1]];
        selectSprite(selectedSpriteIndex + 1);
    }


    // =================================================================
    // 9. RENDERING LOGIC
    // =================================================================
    function renderSpriteList() {
        spriteListDiv.innerHTML = '';
        spriteSet.forEach((sprite, index) => {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'sprite-preview';
            if (index === selectedSpriteIndex) {
                previewContainer.classList.add('selected');
            }
            const numberLabel = document.createElement('span');
            numberLabel.textContent = `${index + 1}:`;
            const previewCanvas = document.createElement('canvas');
            const previewCtx = previewCanvas.getContext('2d');
            const previewPixelSize = 2;
            previewCanvas.width = sprite.width * charWidth * previewPixelSize;
            previewCanvas.height = sprite.height * charHeight * previewPixelSize;
            drawSpriteToCanvas(previewCtx, sprite, previewPixelSize);
            previewContainer.appendChild(numberLabel);
            previewContainer.appendChild(previewCanvas);
            previewContainer.addEventListener('click', () => selectSprite(index));
            spriteListDiv.appendChild(previewContainer);
        });
    }

    function drawSpriteToCanvas(targetCtx, sprite, pSize) {
        for (let charY = 0; charY < sprite.height; charY++) {
            for (let charX = 0; charX < sprite.width; charX++) {
                const attr = sprite.attributeData[charY][charX];
                const isBright = (attr & 0x40) !== 0;
                const isFlash = (attr & 0x80) !== 0;
                const colors = isBright ? spectrumColorsBright : spectrumColorsNormal;
                let inkColor = colors[attr & 0x07];
                let paperColor = colors[(attr >> 3) & 0x07];
                if (isFlash && isFlashInverted) {
                    [inkColor, paperColor] = [paperColor, inkColor];
                }
                for (let y = 0; y < charHeight; y++) {
                    for (let x = 0; x < charWidth; x++) {
                        const pixelIsSet = sprite.pixelData[charY * charHeight + y][charX * charWidth + x];
                        targetCtx.fillStyle = pixelIsSet ? inkColor : paperColor;
                        targetCtx.fillRect((charX * charWidth + x) * pSize, (charY * charHeight + y) * pSize, pSize, pSize);
                    }
                }
            }
        }
    }

    function drawEditorGrid() {
        if (selectedSpriteIndex < 0) {
            clearEditor();
            return;
        }
        const sprite = spriteSet[selectedSpriteIndex];
        canvas.width = sprite.width * charWidth * pixelSize;
        canvas.height = sprite.height * charHeight * pixelSize;
        drawSpriteToCanvas(ctx, sprite, pixelSize);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        for (let i = 1; i < sprite.width * charWidth; i++) {
            ctx.moveTo(i * pixelSize, 0);
            ctx.lineTo(i * pixelSize, canvas.height);
        }
        for (let i = 1; i < sprite.height * charHeight; i++) {
            ctx.moveTo(0, i * pixelSize);
            ctx.lineTo(canvas.width, i * pixelSize);
        }
        ctx.stroke();
        ctx.strokeStyle = '#555';
        ctx.beginPath();
        for (let i = 1; i < sprite.width; i++) {
            ctx.moveTo(i * charWidth * pixelSize, 0);
            ctx.lineTo(i * charWidth * pixelSize, canvas.height);
        }
        for (let i = 1; i < sprite.height; i++) {
            ctx.moveTo(0, i * charHeight * pixelSize);
            ctx.lineTo(canvas.width, i * charHeight * pixelSize);
        }
        ctx.stroke();
        if (!isPixelMode && selectedCharX !== -1) {
            ctx.strokeStyle = '#FF3333';
            ctx.lineWidth = 2;
            ctx.strokeRect(selectedCharX * charWidth * pixelSize, selectedCharY * charHeight * pixelSize, charWidth * pixelSize, charHeight * pixelSize);
        }
    }

    function clearEditor() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        spriteWidthInput.value = 2;
        spriteHeightInput.value = 2;
    }


    // =================================================================
    // 10. UI AND EVENT HANDLING
    // =================================================================
    function updateAttributeControlsUI() {
        if (selectedSpriteIndex < 0 || selectedCharX === -1) {
            selectedCharLabel.textContent = 'None';
            attributeControls.querySelectorAll('input, button').forEach(el => el.disabled = true);
            return;
        }
        attributeControls.querySelectorAll('input, button').forEach(el => el.disabled = false);
        selectedCharLabel.textContent = `(${selectedCharX}, ${selectedCharY})`;
        const attr = spriteSet[selectedSpriteIndex].attributeData[selectedCharY][selectedCharX];
        flashBitCheckbox.checked = (attr & 0x80) !== 0;
        brightBitCheckbox.checked = (attr & 0x40) !== 0;
        attrButtons.forEach(btn => btn.classList.toggle('active', (attr & (1 << parseInt(btn.dataset.bit))) !== 0));
    }

    function handleAttributeChange(bit) {
        if (selectedCharX < 0) return;
        pushHistoryState();
        let attr = spriteSet[selectedSpriteIndex].attributeData[selectedCharY][selectedCharX];
        attr ^= (1 << bit);
        spriteSet[selectedSpriteIndex].attributeData[selectedCharY][selectedCharX] = attr;
        redrawAndGenerate();
        updateAttributeControlsUI();
    }

    function redrawAndGenerate() {
        drawEditorGrid();
        const previewCanvas = spriteListDiv.querySelector(`.sprite-preview:nth-child(${selectedSpriteIndex + 1}) canvas`);
        if (previewCanvas) drawSpriteToCanvas(previewCanvas.getContext('2d'), spriteSet[selectedSpriteIndex], 2);
    }

    function getCanvasPixelCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - rect.left) / pixelSize),
            y: Math.floor((e.clientY - rect.top) / pixelSize)
        };
    }

    // --- Main Event Listeners ---
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    saveFileBtn.addEventListener('click', handleSave);
    loadFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleLoad);
    modalCloseBtn.addEventListener('click', hideBlockModal);
    blockModal.addEventListener('click', (e) => {
        if (e.target === blockModal) hideBlockModal();
    });
    addSpriteBtn.addEventListener('click', addSprite);
    deleteSpriteBtn.addEventListener('click', deleteSelectedSprite);
    resizeSpriteBtn.addEventListener('click', resizeSelectedSprite);
    moveSpriteUpBtn.addEventListener('click', moveSpriteUp);
    moveSpriteDownBtn.addEventListener('click', moveSpriteDown);
    pixelModeBtn.addEventListener('click', () => {
        isPixelMode = true;
        pixelModeBtn.classList.add('active');
        attributeModeBtn.classList.remove('active');
        attributeControls.classList.add('hidden');
        drawEditorGrid();
    });
    attributeModeBtn.addEventListener('click', () => {
        isPixelMode = false;
        pixelModeBtn.classList.remove('active');
        attributeModeBtn.classList.add('active');
        attributeControls.classList.remove('hidden');
        drawEditorGrid();
    });
    canvas.addEventListener('mousedown', (e) => {
        if (e.buttons !== 1 || selectedSpriteIndex < 0) return;
        isDrawing = true;
        pushHistoryState();
        const sprite = spriteSet[selectedSpriteIndex];
        const {
            x,
            y
        } = getCanvasPixelCoords(e);
        if (isPixelMode) {
            if (y >= sprite.height * charHeight || x >= sprite.width * charWidth) return;
            drawingValue = 1 - sprite.pixelData[y][x];
            sprite.pixelData[y][x] = drawingValue;
        } else {
            selectedCharX = Math.floor(x / charWidth);
            selectedCharY = Math.floor(y / charHeight);
            if (selectedCharY >= sprite.height || selectedCharX >= sprite.width) {
                selectedCharX = -1;
                selectedCharY = -1;
            }
            updateAttributeControlsUI();
        }
        redrawAndGenerate();
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !isPixelMode || selectedSpriteIndex < 0) return;
        const sprite = spriteSet[selectedSpriteIndex];
        const {
            x,
            y
        } = getCanvasPixelCoords(e);
        if (y < sprite.height * charHeight && x < sprite.width * charWidth && sprite.pixelData[y][x] !== drawingValue) {
            sprite.pixelData[y][x] = drawingValue;
            redrawAndGenerate();
        }
    });
    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });
    flashBitCheckbox.addEventListener('change', () => handleAttributeChange(7));
    brightBitCheckbox.addEventListener('change', () => handleAttributeChange(6));
    attrButtons.forEach(btn => btn.addEventListener('click', () => handleAttributeChange(parseInt(btn.dataset.bit))));
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        }
    });


    // =================================================================
    // 11. INITIALIZATION
    // =================================================================
    const savedTheme = localStorage.getItem('spriteEditorTheme') || 'dark';
    applyTheme(savedTheme);
    addSprite();

    setInterval(() => {
        isFlashInverted = !isFlashInverted;
        drawEditorGrid();
        renderSpriteList();
    }, 500);
});