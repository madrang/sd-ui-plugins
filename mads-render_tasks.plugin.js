/* Madrang's SD-UI Render Tasks Plugin.js
 *        DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
 *                    Version 2, December 2004
 *
 * Copyright (C) 2022 Marc-Andre Ferland <madrang@gmail.com>
 *
 * Everyone is permitted to copy and distribute verbatim or modified
 * copies of this plugin, and changing it is allowed as long
 * as the name is changed.
 *
 *            DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
 *   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION
 *
 *  0. You just DO WHAT THE FUCK YOU WANT TO.
 *
 * @link http://www.wtfpl.net/
 * @source https://raw.githubusercontent.com/madrang/sd-ui-plugins/master/buttons.plugin.js
 */
(function() { "use strict"
    const GITHUB_PAGE = "https://github.com/madrang/sd-ui-plugins"
    const VERSION = "3.0.1.2";
    const ID_PREFIX = "madrang-plugin";
    console.log('%s render tasks Version: %s', ID_PREFIX, VERSION);

    const MODE_REDO = 'img2img_redo';
    const MODE_RESIZE = 'img2img_resize';
    const MODE_WARP = 'img2img_warp';
    const MODE_DISPLAY_NAMES = {
        [MODE_REDO]: "Redo Vars"
        , [MODE_RESIZE]: "Resize"
        , [MODE_WARP]: "Move"
    };
    PLUGINS['IMAGE_INFO_BUTTONS'].push([
        { type: "label"
            , class: [ "imgInfoLabel", "imgSeedLabel" ]
            , text: "Mad's"
        }
        , ...Object.keys(MODE_DISPLAY_NAMES).map((key) => ({
            text: MODE_DISPLAY_NAMES[key]
            , filter: () => isTaskSupported(key)
            , on_click: getStartNewTaskHandler(key)
        }))
    ]);
    const style = document.createElement('style');
    style.textContent = `
#${ID_PREFIX}-popup {
    background: var(--background-color2);
    max-width: 600px;
    max-height: 90%;
    margin: auto;
    margin-top: 64px;
    border-radius: 6px;
    padding: 30px;
    text-align: center;
    overflow: auto;
}
#${ID_PREFIX}-popup-title {
    line-height: 10px;
}
#${ID_PREFIX}-popup-close-btn {
    float: right;
    cursor: pointer;
    padding: 10px;
    transform: translate(50%, -50%) scaleX(130%);
}
#${ID_PREFIX}-popup-apply-btn {
    background: rgb(8 132 0);
    border: 1px solid rgb(24 122 0);
}
#${ID_PREFIX}-prompt {
    width: 100%;
    height: 65pt;
}
`;
    document.head.append(style);

    function clamp(num, min = 0, max = 1) {
        if (min === max) {
            return min;
        }
        if (max < min) {
            return (
                (num <= max) ? max : (
                    (num >= min) ? min : num
                )
            );
        }
        return (
            (num <= min) ? min : (
                (num >= max) ? max : num
            )
        );
    };
    const invlerp = (start, end, amt) => clamp((amt - start) / (end - start));
    const lerp = (start, end, amt) => clamp((1 - amt) * start + amt * end, start, end);
    const scale = (x, in_min, in_max, out_min, out_max) => clamp((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min, out_min, out_max);

    function readAsDataURL(file) {
        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                // resolve file as base64 string
                resolve(reader.result);
            }, false);
            reader.addEventListener("error", (event) => {
                reject(new Error("Error occurred reading object"));
            });
            reader.readAsDataURL(file);
        });
    }

    const KEYBOARD_SPEED = 0.001;
    class InputSurface extends HTMLCanvasElement {
        #image = undefined;
        #offset = undefined;
        #size = undefined;
        #ctx = undefined;
        constructor() {
            super();
            this.tabIndex = 0; // Allow to be focused for keyboard events.
            this.style.touchAction = "none"; // Cellphones: Disable default touch actions.
            const eventOptions = { // addEventListener options
                capture: true
                , passive: false
            };
            // Keyboard Input
            this.addEventListener('keydown', (event) => this.#onKeyboardInput(event), eventOptions);
            this.addEventListener('keyup'  , (event) => this.#onKeyboardInput(event), eventOptions);
            // Pointer/Mouse/Touch Inputs
            [ "pointerdown", "pointermove", "pointerup"
                , "wheel"
            ].forEach((key) => this.addEventListener(key, (event) => this.#onPointerInput(event), eventOptions));

            // Update Visual
            //document.addEventListener("focus", redraw, true);
            //document.addEventListener("blur", redraw, true);
            this.#onChanged();

            // get context
            this.#ctx = this.getContext('2d', { willReadFrequently: true });
        }

        get disabled() {
            return this.hasAttribute('disabled');
        }
        set disabled(val) {
            if (val) {
                this.setAttribute('disabled', '');
            } else {
                this.removeAttribute('disabled');
            }
            this.#onChanged();
        }

        get size() {
            if (this.#size) {
                return this.#size;
            }
            if (!this.hasAttribute('size')) {
                this.#size = [ 1.0, 1.0 ];
                return this.#size;
            }
            const attrVal = this.getAttribute('size');
            this.#size = JSON.parse(attrVal);
            return this.#size;
        }
        set size(val) {
            if (val) {
                this.#size = val;
                this.setAttribute('size', JSON.stringify(val));
            } else {
                this.#size = [ 1.0, 1.0 ];
                this.removeAttribute('size');
            }
            this.#onChanged();
        }
        get offset() {
            if (this.#offset) {
                return this.#offset;
            }
            if (!this.hasAttribute('offset')) {
                this.#offset = [ 0, 0 ];
                return this.#offset;
            }
            const attrVal = this.getAttribute('offset');
            this.#offset = JSON.parse(attrVal);
            return this.#offset;
        }
        set offset(val) {
            const oldOffset = this.offset;
            if (val && oldOffset[0] == val[0] && oldOffset[1] == val[1]) {
                return;
            }
            if (val) {
                this.#offset = val;
                this.setAttribute('offset', JSON.stringify(val));
            } else {
                this.#offset = [ 0, 0 ];
                this.removeAttribute('offset');
            }
            this.#onChanged();
        }

        get image() {
            return this.#image?.src;
        }
        set image(val) {
            console.log("get image", val);
            getImg(val).then(image => {
                this.#image = image;
                console.log("cursor image", image);
            });
            this.#onChanged();
        }

        get height() {
            return super.height;
        }
        set height(val) {
            super.height = val;
            this.#onChanged();
        }
        get width() {
            return super.width;
        }
        set width(val) {
            super.width = val;
            this.#onChanged();
        }

        reset() {
            this.offset = [0,0];
            this.size = [1,1];
        }

        #onChanged() {
            this.dispatchEvent(new Event('change'));
            // Redraw canvas
            this.raf = window.requestAnimationFrame((time) => InputSurface.prototype.draw.call(this, time));
        }

        #onKeyboardInput(event) {
            //console.log('#onKeyboardInput', event);
            switch (event.key) {
                case "Down":
                case "ArrowDown":
                    this.offset = [
                        this.offset[0]
                        , clamp(this.offset[1] + (event.shiftKey ? KEYBOARD_SPEED * 10 : KEYBOARD_SPEED), -1, 1)
                    ];
                    break;
                case "Up":
                case "ArrowUp":
                    this.offset = [
                        this.offset[0]
                        , clamp(this.offset[1] - (event.shiftKey ? KEYBOARD_SPEED * 10 : KEYBOARD_SPEED), -1, 1)
                    ];
                    break;
                case "Left":
                case "ArrowLeft":
                    this.offset = [
                        clamp(this.offset[0] - (event.shiftKey ? KEYBOARD_SPEED * 10 : KEYBOARD_SPEED), -1, 1)
                        , this.offset[1]
                    ];
                    break;
                case "Right":
                case "ArrowRight":
                    this.offset = [
                        clamp(this.offset[0] + (event.shiftKey ? KEYBOARD_SPEED * 10 : KEYBOARD_SPEED), -1, 1)
                        , this.offset[1]
                    ];
                    break;
                default:
                    return;
            }
            //console.log('offset', this.offset);
            // Cancel the default action to avoid it being handled twice
            event.preventDefault();
            event.stopPropagation();
            this.#onChanged();
        }
        #onPointerInput(event) {
            //console.log('#onPointerInput', event);
            if (this.disabled) {
                return;
            }
            if (event instanceof WheelEvent || event.type == "wheel") {
                event.preventDefault();
                event.stopImmediatePropagation();
                //event.wheelDeltaX
                this.size = this.size.map((s) => clamp(s + (event.wheelDeltaY / 1000), 0.01, 8));
                return false;
            }
            // mouseup, mousedown, mousemove, touch, pen
            let evButtons = event.buttons;
            if (!evButtons && (event.type == "click" || event.pointerType == "touch" || event.pointerType == "pen")) {
                evButtons = 1;
            }
            if (!evButtons) {
                return;
            }
            if (event.pointerId) {
                this.setPointerCapture(event.pointerId);
            }
            if (evButtons === 1) {
                const surfaceRect = this.getBoundingClientRect();
                this.offset = [
                    scale(event.pageX - window.scrollX, surfaceRect.left, surfaceRect.right, -1, 1)
                    , scale(event.pageY - window.scrollY, surfaceRect.top, surfaceRect.bottom, -1, 1)
                ];
                //console.log('offset', this.offset);
                event.preventDefault();
                event.stopImmediatePropagation();
                return false;
            }
        }

        static spiral(setPixel, width, height, x, y) {
            if (typeof x === "undefined") {
                x = width / 2;
            }
            if (typeof y === "undefined") {
                y = height / 2;
            }
            const startX = x;
            const startY = y;
            x = clamp(Math.round(x), 0, width - 1);
            y = clamp(Math.round(y), 0, height - 1);
            let upper = y;
            let lower = y;
            let left = x;
            let right = x;
            let lastPass = [ -1, -1, -1, -1 ];
            const getRatio = function() {
                let w;
                if (right >= width) {
                    if (left < 0) {
                        w = width * 4;
                    } else {
                        w = (startX - left) * 2;
                    }
                } else if (left < 0) {
                    w = (right - startX) * 2;
                } else {
                    w = right - left;
                }
                let h;
                if (lower >= height) {
                    if (upper < 0) {
                        h = height * 4;
                    } else {
                        h = (startY - upper) * 2;
                    }
                } else if (upper < 0) {
                    h = (lower - startY) * 2;
                } else {
                    h = lower - upper;
                }
                if (h <= 0) {
                    if (w <= 0) {
                        return 0;
                    }
                    return w;
                }
                return w / h;
            };
            const keepCenter = function(edge) {
                switch (edge) {
                    case "up": return startY - upper <= lower - startY || lower >= height;
                    case "right": return startX - left >= right - startX || left < 0;
                    case "down": return startY - upper >= lower - startY || upper < 0;
                    case "left": return startX - left <= right - startX || right >= width;
                }
            }
            while (upper >= 0 || lower < height || left >= 0 || right < width) {
                if (upper >= 0 && (
                    lastPass[0] == upper
                        ? true
                        : (getRatio() >= (width / height) && keepCenter("up"))
                    )
                ) {
                    while (x < right && x < width) {
                        setPixel(x, y, "up", Math.max(Math.abs(x - startX), Math.abs(y - startY)));
                        x++;
                    }
                    upper--;
                } else {
                    x = right;
                    y = upper + 1;
                }
                if (right < width && (
                    lastPass[1] == right
                        ? true
                        : (getRatio() <= (width / height) && keepCenter("right"))
                    )
                ) {
                    while (y < lower && y < height) {
                        setPixel(x, y, "right", Math.max(Math.abs(x - startX), Math.abs(y - startY)));
                        y++;
                    }
                    right++;
                } else {
                    y = lower;
                    x = right - 1;
                }
                if (lower < height && (
                    lastPass[2] == lower
                        ? true
                        : (getRatio() >= (width / height) && keepCenter("down"))
                    )
                ) {
                    while (x > left && x >= 0) {
                        setPixel(x, y, "down", Math.max(Math.abs(x - startX), Math.abs(y - startY)));
                        x--;
                    }
                    lower++;
                } else {
                    x = left;
                    y = lower - 1;
                }
                if (left >= 0 && (
                    lastPass[3] == left
                        ? true
                        : (getRatio() <= (width / height) && keepCenter("left"))
                    )
                ) {
                    while (y > upper && y >= 0) {
                        setPixel(x, y, "left", Math.max(Math.abs(x - startX), Math.abs(y - startY)));
                        y--;
                    }
                    left--;
                } else {
                    y = upper;
                    x = left + 1;
                }
                lastPass = [ upper, right, lower, left ];
            }
        }
        static getPixelOffset(rawImage, x, y, edge, edgeOffset = 1) {
            switch (edge) {
                case "up":
                    if (y - edgeOffset < 0) {
                        return undefined;
                    }
                    return ((y - edgeOffset) * rawImage.width + x) * 4;
                case "right":
                    if (x + edgeOffset >= rawImage.width) {
                        return undefined;
                    }
                    return (y * rawImage.width + (x + edgeOffset)) * 4;
                case "down":
                    if (y + edgeOffset >= rawImage.height) {
                        return undefined;
                    }
                    return ((y + edgeOffset) * rawImage.width + x) * 4;
                case "left":
                    if (x - edgeOffset < 0) {
                        return undefined;
                    }
                    return (y * rawImage.width + (x - edgeOffset)) * 4;
                default:
                    return (y * rawImage.width + x) * 4;
            }
        }

        makeNoise(rawImage, mode, mask) {
            const pix = rawImage.data;
            const maskData = mask?.data;
            const setPixel = function(x, y, edge, distance = 0) {
                let i = InputSurface.getPixelOffset(rawImage, x, y);
                if (pix[i + 3] > 0) {
                    // Set mask
                    if (maskData) {
                        let maskVal = 0;
                        const next = InputSurface.getPixelOffset(rawImage, x, y, edge, 1);
                        if (next && pix[next + 3] == 0) {
                            const overlapDist = 64;
                            const fadeDist = 50;
                            for (let p = 1; p <= overlapDist; ++p) {
                                const prevMask = InputSurface.getPixelOffset(rawImage, x, y, edge, -p);
                                if (!prevMask) {
                                    break;
                                }
                                maskVal = Math.max(
                                    Math.ceil(scale(Math.min(overlapDist - p, fadeDist), 0, fadeDist, 1, 255))
                                    , maskData[prevMask]
                                );
                                maskData[prevMask] = maskVal;
                                maskData[prevMask + 1] = maskVal;
                                maskData[prevMask + 2] = maskVal;
                                maskData[prevMask + 3] = 255;
                            }
                            maskVal = 255;
                        }
                        maskData[i] = maskVal;
                        maskData[i + 1] = maskVal;
                        maskData[i + 2] = maskVal;
                        maskData[i + 3] = 255;
                    }
                    // Ignore alpha values that have been set.
                    return;
                }
                const prev = edge ? InputSurface.getPixelOffset(rawImage, x, y, edge, -(Math.floor(Math.random() * (distance / 2)) + 1)) : undefined;
                const gain = 30; // Max 40
                let c = 7 + Math.sin(i / 50000);
                if (prev) {
                    const lpGain = 0.05;
                    pix[i] = lerp(pix[prev], gain * Math.random() * c, lpGain);
                    pix[i + 1] = lerp(pix[prev + 1], gain * Math.random() * c, lpGain);
                    pix[i + 2] = lerp(pix[prev + 2], gain * Math.random() * c, lpGain);
                } else {
                    pix[i] = gain * Math.random() * c;
                    pix[i + 1] = gain * Math.random() * c;
                    pix[i + 2] = gain * Math.random() * c;
                }
                // Set alpha to be non transparent.
                pix[i + 3] = 255;
                // Set mask
                if (maskData) {
                    maskData[i] = 255;
                    maskData[i + 1] = 255;
                    maskData[i + 2] = 255;
                    maskData[i + 3] = 255;
                    mask.modified = true;
                }
            };
            if (mode === "fast") {
                for(let y = 0; y < rawImage.height; ++y) {
                    for(let x = 0; x < rawImage.width; ++x) {
                        setPixel(x, y);
                    }
                }
            } else {
                InputSurface.spiral(setPixel
                    ,rawImage.width, rawImage.height
                    , scale(this.offset[0], -1, 1, -rawImage.width * this.size[0], rawImage.width) + ((rawImage.width / 2) * this.size[0])
                    , scale(this.offset[1], -1, 1, -rawImage.height * this.size[1], rawImage.height) + ((rawImage.height / 2) * this.size[1])
                );
            }
        }

        draw (time) {
            // Clear canvas surface.
            this.#ctx.clearRect(0, 0, this.width, this.height);

            //TODO Blend image with noise using prompt strength
            this.#ctx.globalAlpha = 1.0;

            // Draw current image
            const curImg = this.#image;
            if (curImg) {
                this.#ctx.drawImage(curImg
                    , Math.round(scale(this.offset[0], -1, 1, -this.width * this.size[0], this.width))
                    , Math.round(scale(this.offset[1], -1, 1, -this.height * this.size[1], this.height))
                    , Math.floor(this.size[0] * this.width), Math.floor(this.size[1] * this.height)
                );
            } else {
                // If missing, fill with gray square.
                this.#ctx.fillStyle = "rgb(128, 128, 128)";
                this.#ctx.fillRect(
                    scale(this.offset[0], -1, 1, -this.width * this.size[0], this.width)
                    , scale(this.offset[1], -1, 1, -this.height * this.size[1], this.height)
                    , this.size[0] * this.width, this.size[1] * this.height
                );
            }
            this.#ctx.globalAlpha = 1.0;

            // Add noize
            const rawImage = this.#ctx.getImageData(0, 0, this.width, this.height);
            this.makeNoise(rawImage);
            this.#ctx.putImageData(rawImage, 0, 0);
        };

        async render () {
            const curImg = this.#image;
            if (!curImg) {
                throw new Error("No image defined!");
            }

            const offscreeCanvas = new OffscreenCanvas(
                Math.round(curImg.width / this.size[0])
                , Math.round(curImg.height / this.size[1])
            );
            const ctx = offscreeCanvas.getContext('2d', { willReadFrequently: true });

            // Clear canvas surface.
            ctx.clearRect(0, 0, curImg.width, curImg.height);
            // Draw current image
            ctx.drawImage(curImg
                , Math.round(scale(this.offset[0], -1, 1, -curImg.width, offscreeCanvas.width))
                , Math.round(scale(this.offset[1], -1, 1, -curImg.height, offscreeCanvas.height))
                , curImg.width, curImg.height
            );
            // Add noize
            const rawImage = ctx.getImageData(0, 0, offscreeCanvas.width, offscreeCanvas.height);
            const mask = ctx.createImageData(offscreeCanvas.width, offscreeCanvas.height);
            this.makeNoise(rawImage, undefined, mask);
            ctx.putImageData(rawImage, 0, 0);
            // Contert to URL.
            const imageData = await readAsDataURL(await offscreeCanvas.convertToBlob());
            if (mask.modified) {
                ctx.putImageData(mask, 0, 0);
                const maskData = await readAsDataURL(await offscreeCanvas.convertToBlob());
                return { image: imageData, mask: maskData };
            }
            return { image: imageData };
        }
    }
    customElements.define('input-surface', InputSurface, { extends: 'canvas' });

    const DEFAULT_SCALE_RATIO = 200;
    const SURFACE_MAX_SIZE = 300;

    const POPUP_INIT = "waiting"
    const POPUP_OK = "ok";
    const POPUP_CANCELLED = "cancelled";

    const mainContainer = document.getElementById('container');
    // Help and Community links
    const links = document.getElementById("community-links");
    // Header menu
    const navMenu = document.getElementById("top-nav-items");
    // Tools menu hidden by defaults, shows when tasks are added.
    const toolsMenu = document.getElementById("preview-tools");
    // List of render tasks
    const previewContent = document.getElementById("preview-content");

    const keepMaxSelect = document.createElement('input');
    keepMaxSelect.id = `${ID_PREFIX}-keep-max`;
    const popupContainer = document.createElement('dialog');
    popupContainer.id = `${ID_PREFIX}-popup`;

    let showPopup = (mode, defaults = {}) => Promise.reject(new Error("Failed to create popup."));
    let isCustomCanvasSupported = () => false;
    (function() {
        if (links && !document.getElementById(`${ID_PREFIX}-link`)) {
            // Add link to plugin repo.
            const pluginLink = document.createElement('li');
            pluginLink.innerHTML = `<a id="${ID_PREFIX}-link" href="${GITHUB_PAGE}" target="_blank"><i class="fa-solid fa-code-merge"></i> Madrang's Plugins on GitHub</a>`;
            links.appendChild(pluginLink);
        }
        if (!mainContainer) {
            return
        }

        // Max number of tasks to keep.
        if (toolsMenu) {
            keepMaxSelect.style.width = '64px';
            const datalist = document.createElement('datalist');
            datalist.id = 'keep-max-datalist';
            document.body.appendChild(datalist);
            ['off', 4, 8, 16, 32, 64].forEach(function(data) {
                const option = document.createElement('option');
                option.value = data;
                datalist.appendChild(option);
            });
            keepMaxSelect.setAttribute('type', 'text');
            keepMaxSelect.setAttribute('list','keep-max-datalist');
            keepMaxSelect.value = 'off';
            const keepLabel = document.createElement('label');
            keepLabel.innerText = "Auto-Remove after "
            keepLabel.appendChild(keepMaxSelect);
            keepLabel.insertAdjacentText('beforeend', ' completed tasks.');
            toolsMenu.appendChild(keepLabel);
        }
        let intervalPtr = undefined;
        let keepOldVar = keepMaxSelect.value;
        keepMaxSelect.addEventListener("click", function() {
            // Remove old value to display all the choices.
            keepOldVar = keepMaxSelect.value;
            keepMaxSelect.value = '';
        });
        keepMaxSelect.addEventListener("mouseleave", function() {
            if (!keepMaxSelect.value) { // If nothing, restore old choice.
                keepMaxSelect.value = keepOldVar;
            }
        });
        keepMaxSelect.addEventListener("change", function() {
            if (!keepMaxSelect.value || keepMaxSelect.value == 'off') {
                if (intervalPtr !== undefined) {
                    clearInterval(intervalPtr);
                    intervalPtr = undefined;
                }
                return;
            }
            if (intervalPtr == undefined) {
                intervalPtr = setInterval(function() {
                    if (!keepMaxSelect.value || keepMaxSelect.value == 'off') {
                        if (intervalPtr !== undefined) {
                            clearInterval(intervalPtr);
                            intervalPtr = undefined;
                        }
                        return;
                    }
                    const keep = parseInt(keepMaxSelect.value);
                    const taskContainers = Array.from(
                        document.querySelectorAll('#preview .imageTaskContainer .taskStatusLabel')
                    ).filter(taskLabel => taskLabel.style.display == "none").map((taskLabel) => taskLabel.closest('.imageTaskContainer'));
                    for (const imageTask of taskContainers) {
                        if (taskContainers.indexOf(imageTask) < keep) {
                            continue;
                        }
                        previewContent.removeChild(imageTask);
                    }
                }, 10 * 1000);
            }
        });

        popupContainer.innerHTML = `
            <span id="${ID_PREFIX}-popup-close-btn">X</span>
            <h1 id="${ID_PREFIX}-popup-title">Popup Settings<br><small style="font-size: small;">V${VERSION}</small></h1>
            <p id="${ID_PREFIX}-popup-subtitle"></p>
            <label for="${ID_PREFIX}-num_outputs_total">Number of Images:</label> <input id="${ID_PREFIX}-num_outputs_total" name="num_outputs_total" value="1" size="1"> <label><small>(total)</small></label> <input id="${ID_PREFIX}-num_outputs_parallel" name="num_outputs_parallel" value="1" size="1"> <label for="${ID_PREFIX}-num_outputs_parallel"><small>(in parallel)</small></label><br>
            <label for="${ID_PREFIX}-diffusion_model">Model:</label> <input id="${ID_PREFIX}-diffusion_model" type="text" spellcheck="false" autocomplete="off" class="model-filter model-selector" data-path="dreamshaperXL10_alpha2Xl10" style="width: 280px;"><br>
            <label for="${ID_PREFIX}-guidance_scale_slider">Guidance Scale:</label> <input id="${ID_PREFIX}-guidance_scale_slider" name="guidance_scale_slider" class="editor-slider" value="75" type="range" min="10" max="500"> <input id="${ID_PREFIX}-guidance_scale" name="guidance_scale" size="4"><br>
            <label for="${ID_PREFIX}-num_inference_steps">Inference Steps:</label></td><td> <input id="${ID_PREFIX}-num_inference_steps" name="${ID_PREFIX}-num_inference_steps" size="4" value="25"><br>
            <label for="${ID_PREFIX}-prompt_strength_slider">Prompt Strength:</label> <input id="${ID_PREFIX}-prompt_strength_slider" name="prompt_strength_slider" class="editor-slider" value="50" type="range" min="0" max="99"> <input id="${ID_PREFIX}-prompt_strength" name="prompt_strength" size="4"><br>
            <div id="${ID_PREFIX}-warp_input_surface_container"><canvas is="input-surface" id="${ID_PREFIX}-warp_input_surface" name="warp_input_surface" value="${DEFAULT_SCALE_RATIO}" type="range" min="101" max="300"></canvas><br>
                <label for="${ID_PREFIX}-warp_input_surface">Warp:</label> <input id="${ID_PREFIX}-warp_slider" name="warp_slider" class="editor-slider" value="100" type="range" min="1" max="300"> <input id="${ID_PREFIX}-warp_width" name="width" size="4"> x <input id="${ID_PREFIX}-warp_height" name="height" size="4"><br>
            </div>
            <div id="${ID_PREFIX}-resolution_container"><label for="${ID_PREFIX}-scale_slider">Resolution:</label> <input id="${ID_PREFIX}-scale_slider" name="scale_slider" class="editor-slider" value="${DEFAULT_SCALE_RATIO}" type="range" min="101" max="300"> <input id="${ID_PREFIX}-width" name="width" size="4"> x <input id="${ID_PREFIX}-height" name="height" size="4"><br></div>
            <div id="${ID_PREFIX}-compoundChanges_container" title="Keep the alterations done to this result, without use the original"> <input id="${ID_PREFIX}-compoundChanges" name="compoundChanges" type="checkbox" checked="true"> <label for="${ID_PREFIX}-compoundChanges">Compound changes </label> </div>
            <div id="${ID_PREFIX}-vram_level_container" title="Faster performance requires more GPU memory (VRAM)"> <label for="${ID_PREFIX}-vram_level">GPU Memory Usage</label> <select id="${ID_PREFIX}-vram_level" name="vram_level"> <option value="high">High</option><option value="balanced">Balanced</option><option value="low">Low</option> </select> </div>
            <p style="text-align: left;">Prompt:</p><textarea id="${ID_PREFIX}-prompt"></textarea>
            <p><small><b>Tip:</b> You can click on the transparent overlay to close </br> and by holding Ctrl quickly Apply. </br> Edit the prompt to control the alterations. </small></p>
            <button id="${ID_PREFIX}-popup-apply-btn" class="secondaryButton"><i class="fa-solid fa-check"></i> Apply</button>
        `;
        mainContainer.insertBefore(popupContainer, document.getElementById('save-settings-config'));
        popupContainer.addEventListener('click', (event) => {
            const dialogRect = popupContainer.getBoundingClientRect();
            const isInDialog = Boolean(
                dialogRect.top <= event.clientY
                && event.clientY <= dialogRect.top + dialogRect.height
                && dialogRect.left <= event.clientX
                && event.clientX <= dialogRect.left + dialogRect.width
            );
            if (!isInDialog && event.target.id == popupContainer.id) {
                popupContainer.close(event.ctrlKey ? POPUP_OK : POPUP_CANCELLED);
            }
        });
        const closeBtn = document.getElementById(`${ID_PREFIX}-popup-close-btn`);
        closeBtn.addEventListener('click', () => {
            popupContainer.close(POPUP_CANCELLED);
        });
        const applyBtn = document.getElementById(`${ID_PREFIX}-popup-apply-btn`);
        applyBtn.addEventListener('click', () => {
            popupContainer.close(POPUP_OK);
        });

        const popup_title = document.getElementById(`${ID_PREFIX}-popup-title`);
        const popup_subtitle = document.getElementById(`${ID_PREFIX}-popup-subtitle`);

        const popup_parallel = document.getElementById(`${ID_PREFIX}-num_outputs_parallel`);
        const popup_totalOutputs = document.getElementById(`${ID_PREFIX}-num_outputs_total`);

        const popup_guidanceScaleSlider = document.getElementById(`${ID_PREFIX}-guidance_scale_slider`);
        const popup_guidanceScaleField = document.getElementById(`${ID_PREFIX}-guidance_scale`);
        popup_guidanceScaleSlider.addEventListener('input', function() {
            popup_guidanceScaleField.value = popup_guidanceScaleSlider.value / 10;
        });
        popup_guidanceScaleField.addEventListener('input', function() {
            if (popup_guidanceScaleField.value < 0) {
                popup_guidanceScaleField.value = 0;
            } else if (popup_guidanceScaleField.value > 50) {
                popup_guidanceScaleField.value = 50;
            }

            popup_guidanceScaleSlider.value = popup_guidanceScaleField.value * 10;
        });
        popup_guidanceScaleSlider.dispatchEvent(new Event("input"));

        const popup_num_inference_steps = document.getElementById(`${ID_PREFIX}-num_inference_steps`);

        const popup_promptStrengthSlider = document.getElementById(`${ID_PREFIX}-prompt_strength_slider`);
        const popup_promptStrengthField = document.getElementById(`${ID_PREFIX}-prompt_strength`);
        popup_promptStrengthSlider.addEventListener('input', function() {
            popup_promptStrengthField.value = popup_promptStrengthSlider.value / 100;
        });
        popup_promptStrengthField.addEventListener('input', function() {
            if (popup_promptStrengthField.value < 0) {
                popup_promptStrengthField.value = 0;
            } else if (popup_promptStrengthField.value > 0.99) {
                popup_promptStrengthField.value = 0.99;
            }

            popup_promptStrengthSlider.value = popup_promptStrengthField.value * 100;
        });
        popup_promptStrengthSlider.dispatchEvent(new Event("input"));

        const popup_scale_slider = document.getElementById(`${ID_PREFIX}-scale_slider`);
        const popup_width = document.getElementById(`${ID_PREFIX}-width`);
        const popup_height = document.getElementById(`${ID_PREFIX}-height`);
        const popup_prompt = document.getElementById(`${ID_PREFIX}-prompt`);
        const resolution_container = document.getElementById(`${ID_PREFIX}-resolution_container`);

        const input_surface_container = document.getElementById(`${ID_PREFIX}-warp_input_surface_container`);
        const input_surface_canvas = document.getElementById(`${ID_PREFIX}-warp_input_surface`);
        const popup_warp_slider = document.getElementById(`${ID_PREFIX}-warp_slider`);
        const popup_warp_width = document.getElementById(`${ID_PREFIX}-warp_width`);
        const popup_warp_height = document.getElementById(`${ID_PREFIX}-warp_height`);

        const compoundChanges_container = document.getElementById(`${ID_PREFIX}-compoundChanges_container`);
        const compoundChanges = document.getElementById(`${ID_PREFIX}-compoundChanges`);

        const popup_vram_level = document.getElementById(`${ID_PREFIX}-vram_level`);
        const popup_vram_level_container = document.getElementById(`${ID_PREFIX}-vram_level_container`);
        const popup_diffusionModelField = new ModelDropdown(document.getElementById(`${ID_PREFIX}-diffusion_model`), "stable-diffusion");

        // Custom html elements can't be extended and won't have those functions on WebKit.
        isCustomCanvasSupported = () => Boolean(typeof input_surface_canvas.reset === "function");

        const setupPopup = (mode, defaults = {}, refImg) => {
            popup_title.innerHTML = `${MODE_DISPLAY_NAMES[mode]} Settings<br><small style="font-size: small;">V${VERSION}</small>`;

            popup_guidanceScaleSlider.value = ('guidance_scale' in defaults ? defaults.guidance_scale * 10 : 75);
            popup_guidanceScaleField.value = defaults.guidance_scale || 7.5;

            popup_promptStrengthSlider.value = ('prompt_strength' in defaults ? defaults.prompt_strength * 100 : 50);
            popup_promptStrengthField.value = defaults.prompt_strength || 0.5;

            if (typeof vramUsageLevelField !== "undefined" && typeof vramUsageLevelField.value === "string") {
                popup_vram_level.value = vramUsageLevelField.value;
            } else {
                popup_vram_level.value = defaults.vram_usage_level;
            }

            switch (mode) {
                case MODE_REDO:
                    resolution_container.style.display = 'none';
                    input_surface_container.style.display = 'none';
                    popup_vram_level_container.style.display = 'none';

                    popup_subtitle.innerHTML = 'Redo the current render with small variations.';
                    popup_parallel.value = defaults.num_outputs || defaults.parallel || 1;
                    if (typeof numOutputsTotalField !== "undefined" && numOutputsTotalField.value && parseInt(numOutputsTotalField.value) > 1) {
                        popup_totalOutputs.value = numOutputsTotalField.value;
                    } else {
                        popup_totalOutputs.value = 4;
                    }
                    if ("num_inference_steps" in defaults) {
                        popup_num_inference_steps.value = defaults.num_inference_steps;
                    }

                    if (defaults.init_image) {
                        compoundChanges.checked = true;
                        compoundChanges_container.style.display = 'block';
                    } else {
                        compoundChanges_container.style.display = 'none';
                    }
                    break;
                case MODE_RESIZE:
                    compoundChanges_container.style.display = 'none';
                    input_surface_container.style.display = 'none';

                    popup_subtitle.innerHTML = 'Resize the current render.</br><small>(Will include alterations/mutations.)</small>';
                    popup_parallel.value = 1;
                    popup_totalOutputs.value = 1;
                    popup_scale_slider.value = DEFAULT_SCALE_RATIO;

                    if ("num_inference_steps" in defaults) {
                        popup_num_inference_steps.value = Math.round(defaults.num_inference_steps * (DEFAULT_SCALE_RATIO / 100));
                    }

                    resolution_container.style.display = 'block';
                    popup_vram_level_container.style.display = 'block';
                    break;
                case MODE_WARP:
                    compoundChanges_container.style.display = 'none';

                    console.log('defaults', defaults);
                    console.log('refImg', refImg);
                    popup_scale_slider.value = 101;
                    if (defaults.width > defaults.height) {
                        input_surface_canvas.width = SURFACE_MAX_SIZE;
                        input_surface_canvas.height = SURFACE_MAX_SIZE * (defaults.height / defaults.width);
                    } else if (defaults.height > defaults.width) {
                        input_surface_canvas.width = SURFACE_MAX_SIZE * (defaults.width / defaults.height);
                        input_surface_canvas.height = SURFACE_MAX_SIZE;
                    } else {
                        input_surface_canvas.width = SURFACE_MAX_SIZE;
                        input_surface_canvas.height = SURFACE_MAX_SIZE;
                    }
                    input_surface_canvas.image = refImg || defaults.init_image;
                    popup_warp_slider.value = 100;

                    input_surface_container.style.display = 'block';
                    resolution_container.style.display = 'block';
                    popup_vram_level_container.style.display = 'block';
                    break;
            }
            popup_num_inference_steps.value = Math.max(25, popup_num_inference_steps.value);

            let width = defaults.width;
            let height = defaults.height;
            popup_width.value = round_64(width * (popup_scale_slider.value / 100));
            popup_height.value = round_64(height * (popup_scale_slider.value / 100));
            const setResolutionFields = function() {
                popup_width.value = round_64(width * (popup_scale_slider.value / 100));
                popup_height.value = round_64(height * (popup_scale_slider.value / 100));
            };
            const setResolutionSlider = function() {
                const ratio = ((popup_width.value / width) + (popup_height.value / height)) / 2;
                width = popup_width.value / ratio;
                height = popup_height.value / ratio;
                popup_scale_slider.value = ratio * 100;
                if (mode == MODE_WARP) {
                    if (popup_width.value > popup_height.value) {
                        input_surface_canvas.width = SURFACE_MAX_SIZE;
                        input_surface_canvas.height = SURFACE_MAX_SIZE * (popup_height.value / popup_width.value);
                    } else if (popup_height.value > popup_width.value) {
                        input_surface_canvas.width = SURFACE_MAX_SIZE * (popup_width.value / popup_height.value);
                        input_surface_canvas.height = SURFACE_MAX_SIZE;
                    } else {
                        input_surface_canvas.width = SURFACE_MAX_SIZE;
                        input_surface_canvas.height = SURFACE_MAX_SIZE;
                    }
                }
            };
            const set_width = debounce(function() {
                let tmp_width = popup_width.value;
                if (mode == MODE_RESIZE) {
                    tmp_width = round_64(tmp_width);
                }
                if (tmp_width != popup_width.value) {
                    popup_width.value = tmp_width;
                }
                setResolutionSlider();
            }, 1000, false);
            const set_height = debounce(function() {
                let tmp_height = popup_height.value;
                if (mode == MODE_RESIZE) {
                    tmp_height = round_64(tmp_height);
                }
                if (tmp_height != popup_height.value) {
                    popup_height.value = tmp_height;
                }
                setResolutionSlider();
            }, 1000, false);

            popup_warp_width.value = popup_warp_slider.value / 100;
            popup_warp_height.value = popup_warp_slider.value / 100;
            if (isCustomCanvasSupported()) {
                input_surface_canvas.reset();
            }
            const onCanvasChanged = function() {
                const [ sizeWidth, sizeHeigth ] = input_surface_canvas.size;
                popup_warp_width.value = sizeWidth.toFixed(2);
                popup_warp_height.value = sizeHeigth.toFixed(2);
                const ratio = (sizeWidth + sizeHeigth) / 2;
                popup_warp_slider.value = ratio * 100;
            };
            const setWarpFields = function() {
                popup_warp_width.value = (popup_warp_slider.value / 100).toFixed(2);
                popup_warp_height.value = (popup_warp_slider.value / 100).toFixed(2);
                input_surface_canvas.size = [
                    popup_warp_slider.value / 100
                    , popup_warp_slider.value / 100
                ];
            };
            const setWarpSlider = function() {
                const ratio = (popup_warp_width.value + popup_warp_height.value) / 2;
                input_surface_canvas.size = [
                    popup_warp_width.value
                    , popup_warp_height.value
                ];
                popup_warp_slider.value = ratio * 100;
            };
            const set_warp_width = debounce(setWarpSlider, 1000, false);
            const set_warp_height = debounce(setWarpSlider, 1000, false);

            popup_diffusionModelField.value = defaults.use_stable_diffusion_model || stableDiffusionModelField.value;
            popup_prompt.value = defaults.prompt;

            popup_scale_slider.addEventListener('input', setResolutionFields);
            popup_width.addEventListener('input', set_width);
            popup_height.addEventListener('input', set_height);
            popup_warp_slider.addEventListener('input', setWarpFields);
            popup_warp_width.addEventListener('input', set_warp_width);
            popup_warp_height.addEventListener('input', set_warp_height);
            input_surface_canvas.addEventListener('change', onCanvasChanged);

            return Object.defineProperties({
                remove() {
                    popup_scale_slider.removeEventListener('input', setResolutionFields);
                    popup_width.removeEventListener('input', set_width);
                    popup_height.removeEventListener('input', set_height);
                    popup_warp_slider.removeEventListener('input', setWarpFields);
                    popup_warp_width.removeEventListener('input', set_warp_width);
                    popup_warp_height.removeEventListener('input', set_warp_height);
                    input_surface_canvas.removeEventListener('change', onCanvasChanged);
                }
            }, {
                returnValue: {
                        get: async () => {
                        const response = {
                            parallel: parseInt(popup_parallel.value)
                            , totalOutputs: parseInt(popup_totalOutputs.value)

                            , prompt: popup_prompt.value
                            , prompt_strength: parseFloat(popup_promptStrengthField.value)
                            , guidance_scale: parseFloat(popup_guidanceScaleField.value)
                            , num_inference_steps: parseInt(popup_num_inference_steps.value)

                            , width: round_64(popup_width.value)
                            , height: round_64(popup_height.value)

                            , diffusion_model: popup_diffusionModelField.value

                            , vram_usage_level: popup_vram_level.value
                            , compoundChanges: compoundChanges.checked
                        };
                        if (mode === MODE_WARP) {
                            const result = await input_surface_canvas.render();
                            response.init_image = result.image;
                            response.mask = result.mask;
                        }
                        return response;
                    }
                }
            });
        };

        showPopup = (...args) => {
            return new Promise((resolve, reject) => {
                popupContainer.returnValue = POPUP_INIT;
                const popupSetup = setupPopup(...args);
                popupContainer.addEventListener("close", async () => {
                    try {
                        const retVal = { returnValue: popupContainer.returnValue };
                        if (retVal.returnValue === POPUP_OK) {
                            retVal.response = await popupSetup.returnValue;
                        }
                        resolve(retVal);
                    } catch (err) {
                        reject(err);
                    }
                    popupSetup.remove();
                }, { once: true });
                popupContainer.showModal();
            });
        }
    })();

    function getImg(src) {
        if (src instanceof HTMLImageElement
            || src instanceof SVGImageElement
            || src instanceof HTMLCanvasElement
            || src instanceof ImageBitmap
        ) {
            return Promise.resolve(src);
        }
        return new Promise(function(resolve, reject) {
            try {
                const image = new Image();
                image.addEventListener('load', () => resolve(image));
                image.addEventListener('error', () => reject(new Error('Failed to load image.')));
                image.src = src;
            } catch (e) {
                reject(e);
            }
        });
    }

    function copyImg(ctx, src, dest={}) {
        return new Promise(function(resolve, reject) {
            const drawImage = function(image) {
                ctx.drawImage(image
                    , src.x || 0, src.y || 0
                    , src.w || src.width || image.naturalWidth
                    , src.h || src.height || image.naturalHeight
                    , dest.x || 0, dest.y || 0
                    , dest.w || dest.width || ctx.width || ctx.canvas.width
                    , dest.h || dest.height || ctx.height || ctx.canvas.height
                );
                resolve(image);
            }
            try {
                if (src.data instanceof HTMLImageElement
                    || src.data instanceof SVGImageElement
                    || src.data instanceof HTMLCanvasElement
                    || src.data instanceof ImageBitmap
                ) {
                    drawImage(src.data);
                    return;
                }
                const image = new Image();
                image.addEventListener('load', () => drawImage(image));
                image.addEventListener('error', () => reject(new Error('Failed to load image.')));
                image.src = src.url || src.data;
            } catch (e) {
                reject(e);
            }
        });
    }
    async function goBig(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const newTaskRequest = modifyCurrentRequest(reqBody, {
            num_outputs: options.parallel || 1
        });
        newTaskRequest.numOutputsTotal = Math.max(newTaskRequest.reqBody.num_outputs, options.totalOutputs || 1);
        newTaskRequest.batchCount = Math.ceil(newTaskRequest.numOutputsTotal / newTaskRequest.reqBody.num_outputs);

        await copyImg(ctx, {data:img.src}, {});
        newTaskRequest.reqBody.init_image = canvas.toDataURL("image/png")
        await doMakeImage(task);

        return canvas.toDataURL("image/png");
    }

    function round_64(val) {
        val = Math.round(val);
        const left = val % 64;
        val = val - left;
        if (left >= 32) {
            return val + 64;
        }
        return val;
    }

    function buildRequest(mode, reqBody, img, options = {}) {
        const newTaskRequest = modifyCurrentRequest(reqBody, {
            num_outputs: options.parallel || 1
            , prompt_strength: options.prompt_strength || 0.5
            , num_inference_steps: options.num_inference_steps || 25
            , preserve_init_image_color_profile: true
        });
        newTaskRequest.numOutputsTotal = Math.max(newTaskRequest.reqBody.num_outputs, options.totalOutputs || 1);
        newTaskRequest.batchCount = Math.ceil(newTaskRequest.numOutputsTotal / newTaskRequest.reqBody.num_outputs);
        if ('guidance_scale' in options) {
            newTaskRequest.reqBody.guidance_scale = options.guidance_scale;
        }
        if ('prompt' in options) {
            newTaskRequest.reqBody.prompt = options.prompt;
        }
        if ('vram_usage_level' in options) {
            newTaskRequest.reqBody.vram_usage_level = options.vram_usage_level;
        }
        if (options.diffusion_model) {
            newTaskRequest.reqBody.use_stable_diffusion_model = options.diffusion_model;
        }
        switch (mode) {
            case MODE_REDO:
            case MODE_RESIZE:
                if (!newTaskRequest.reqBody.init_image || mode === MODE_RESIZE || options.compoundChanges) {
                    newTaskRequest.reqBody.sampler_name = 'ddim';
                    newTaskRequest.reqBody.init_image = img.src;
                    delete newTaskRequest.reqBody.mask;
                    if (mode !== MODE_RESIZE) {
                        newTaskRequest.reqBody.seed = Math.floor(Math.random() * 10000000);
                    }
                } else {
                    newTaskRequest.reqBody.seed = 1 + newTaskRequest.reqBody.seed;
                }
                if (mode === MODE_RESIZE) {
                    newTaskRequest.reqBody.width = options.width;
                    newTaskRequest.reqBody.height = options.height;
                    if (useUpscalingField.checked) {
                        newTaskRequest.reqBody.use_upscale = upscaleModelField.value;
                    } else {
                        delete newTaskRequest.reqBody.use_upscale;
                    }
                }
                break;
            case MODE_WARP:
                newTaskRequest.reqBody.width = options.width;
                newTaskRequest.reqBody.height = options.height;
                newTaskRequest.reqBody.sampler_name = 'ddim';
                newTaskRequest.reqBody.init_image = options.init_image;
                if (options.mask) {
                    newTaskRequest.reqBody.mask = options.mask;
                } else {
                    delete newTaskRequest.reqBody.mask;
                }
                break;
            default: throw new Error("Unknown button.action mode: " + mode);
        }
        newTaskRequest.seed = newTaskRequest.reqBody.seed;
        return newTaskRequest;
    }

    function isTaskSupported(mode) {
        if (mode === MODE_WARP) {
            return isCustomCanvasSupported();
        }
        return true;
    }
    function getStartNewTaskHandler(mode) {
        return async function(reqBody, img) {
            const popupResult = await showPopup(mode, reqBody, img);
            if (popupResult?.returnValue !== POPUP_OK) {
                return;
            }
            const newTaskRequest = buildRequest(mode, reqBody, img, popupResult.response);
            createTask(newTaskRequest);
        };
    }

    // Register selftests when loaded by jasmine.
    if (typeof PLUGINS?.SELFTEST === 'object') {
        PLUGINS.SELFTEST[ID_PREFIX + " render tasks"] = function() {
            it('should be able to run a test...', function() {
                expect(function() {
                    SD.sessionId = undefined
                }).toThrowError("Can't set sessionId to undefined.")
            })
        }
    }
})();
