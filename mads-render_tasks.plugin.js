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
    const VERSION = "2.4.19.1";
    const ID_PREFIX = "madrang-plugin";
    console.log('%s render tasks Version: %s', ID_PREFIX, VERSION);

    const MODE_REDO = 'img2img_redo';
    const MODE_RESIZE = 'img2img_resize';
    const MODE_DISPLAY_NAMES = {
        [MODE_REDO]: "Mad's Redo Vars"
        , [MODE_RESIZE]: "Mad's Resize"
    };
    Object.keys(MODE_DISPLAY_NAMES).forEach((key) => PLUGINS['IMAGE_INFO_BUTTONS'].push({ text: MODE_DISPLAY_NAMES[key], on_click: getStartNewTaskHandler(key) }))

    const style = document.createElement('style');
    style.textContent = `
#${ID_PREFIX}-popup {
    position: fixed;
    background: rgba(32, 33, 36, 50%);
    top: 0px;
    left: 0px;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
}
#${ID_PREFIX}-popup > div {
    background: var(--background-color2);
    max-width: 600px;
    margin: auto;
    margin-top: 100px;
    border-radius: 6px;
    padding: 30px;
    text-align: center;
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

    const mainContainer = document.getElementById('container');
    // Help and Community links
    const links = document.getElementById("community-links");
    // Header menu
    const navMenu = document.getElementById("top-nav-items");
    // Tools menu hidden by defaults, shows when tasks are added.
    const toolsMenu = document.getElementById("preview-tools");
    // List of render tasks
    const preview = document.getElementById("preview");

    const keepMaxSelect = document.createElement('input');
    keepMaxSelect.id = `${ID_PREFIX}-keep-max`;
    const popupContainer = document.createElement('div');
    popupContainer.id = `${ID_PREFIX}-popup`;

    let popupCancelled = false;
    let showPopup = async (mode, defaults = {}) => {}
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
                        preview.removeChild(imageTask);
                    }
                }, 10 * 1000);
            }
        });

        popupContainer.style.display = 'none';
        popupContainer.innerHTML = `
            <div>
                <span id="${ID_PREFIX}-popup-close-btn">X</span>
                <h1 id="${ID_PREFIX}-popup-title">Popup Settings<br/><small style="font-size: small;">V${VERSION}</small></h1>
                <p id="${ID_PREFIX}-popup-subtitle"></p>
                <label for="${ID_PREFIX}-num_outputs_total">Number of Images:</label> <input id="${ID_PREFIX}-num_outputs_total" name="num_outputs_total" value="1" size="1"> <label><small>(total)</small></label> <input id="${ID_PREFIX}-num_outputs_parallel" name="num_outputs_parallel" value="1" size="1"> <label for="${ID_PREFIX}-num_outputs_parallel"><small>(in parallel)</small></label><br/>
                <label for="${ID_PREFIX}-guidance_scale_slider">Guidance Scale:</label> <input id="${ID_PREFIX}-guidance_scale_slider" name="guidance_scale_slider" class="editor-slider" value="75" type="range" min="10" max="500"> <input id="${ID_PREFIX}-guidance_scale" name="guidance_scale" size="4"><br/>
                <label for="${ID_PREFIX}-prompt_strength_slider">Prompt Strength:</label> <input id="${ID_PREFIX}-prompt_strength_slider" name="prompt_strength_slider" class="editor-slider" value="50" type="range" min="0" max="99"> <input id="${ID_PREFIX}-prompt_strength" name="prompt_strength" size="4"><br/>
                <div id="${ID_PREFIX}-resolution_container"><label for="${ID_PREFIX}-scale_slider">Resolution:</label> <input id="${ID_PREFIX}-scale_slider" name="scale_slider" class="editor-slider" value="200" type="range" min="101" max="300"> <input id="${ID_PREFIX}-width" name="width" size="4"> x <input id="${ID_PREFIX}-height" name="height" size="4"><br/></div>
                <div id="${ID_PREFIX}-compoundChanges_container" title="Keep the alterations done to this result, without use the original"> <input id="${ID_PREFIX}-compoundChanges" name="compoundChanges" type="checkbox" checked="true"> <label for="${ID_PREFIX}-compoundChanges">Compound changes </label> </div>
                <div id="${ID_PREFIX}-turbo_container" title="Generates images faster, but uses an additional 1 GB of GPU memory"> <input id="${ID_PREFIX}-turbo" name="turbo" type="checkbox" checked> <label for="turbo">Turbo mode</label> </div>
                <p style="text-align: left;">Prompt:</p><textarea id="${ID_PREFIX}-prompt"></textarea>
                <p><small><b>Tip:</b> You can click on the transparent overlay to close </br> and by holding Ctrl quickly Apply. </br> Edit the prompt to control the alterations. </small></p>
                <button id="${ID_PREFIX}-popup-apply-btn" class="secondaryButton"><i class="fa-solid fa-check"></i> Apply</button>
            </div>`;
        mainContainer.insertBefore(popupContainer, document.getElementById('save-settings-config'));
        popupContainer.addEventListener('click', (event) => {
            if (event.target.id == popupContainer.id) {
                popupContainer.style.display = 'none';
                if (!event.ctrlKey) {
                    popupCancelled = true;
                }
            }
        });
        const closeBtn = document.getElementById(`${ID_PREFIX}-popup-close-btn`);
        closeBtn.addEventListener('click', () => {
            popupContainer.style.display = 'none';
            popupCancelled = true;
        });
        const applyBtn = document.getElementById(`${ID_PREFIX}-popup-apply-btn`);
        applyBtn.addEventListener('click', () => {
            popupContainer.style.display = 'none';
            popupCancelled = false;
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

        const compoundChanges_container = document.getElementById(`${ID_PREFIX}-compoundChanges_container`);
        const compoundChanges = document.getElementById(`${ID_PREFIX}-compoundChanges`);

        const popup_turbo = document.getElementById(`${ID_PREFIX}-turbo`);
        const popup_turbo_container = document.getElementById(`${ID_PREFIX}-turbo_container`);

        showPopup = async (mode, defaults = {}) => {
            popupCancelled = false;

            popup_title.innerHTML = `${MODE_DISPLAY_NAMES[mode]} Settings<br/><small style="font-size: small;">V${VERSION}</small>`;

            popup_guidanceScaleSlider.value = ('guidance_scale' in defaults ? defaults.guidance_scale * 10 : 75);
            popup_guidanceScaleField.value = defaults.guidance_scale || 7.5;

            popup_promptStrengthSlider.value = ('prompt_strength' in defaults ? defaults.prompt_strength * 100 : 50);
            popup_promptStrengthField.value = defaults.prompt_strength || 0.5;

            if (typeof turboField !== "undefined" && typeof turboField.checked === "boolean") {
                popup_turbo.checked = turboField.checked;
            } else {
                popup_turbo.checked = defaults.turbo;
            }

            switch (mode) {
                case MODE_REDO:
                    resolution_container.style.display = 'none';
                    popup_subtitle.innerHTML = 'Redo the current render with small variations.';
                    popup_parallel.value = defaults.num_outputs || defaults.parallel || 1;
                    if (typeof numOutputsTotalField !== "undefined" && numOutputsTotalField.value && parseInt(numOutputsTotalField.value) > 1) {
                        popup_totalOutputs.value = numOutputsTotalField.value;
                    } else {
                        popup_totalOutputs.value = 4;
                    }
                    if (defaults.init_image) {
                        compoundChanges.checked = true;
                        compoundChanges_container.style.display = 'block';
                    } else {
                        compoundChanges_container.style.display = 'none';
                    }
                    popup_turbo_container.style.display = 'none';
                    break;
                case MODE_RESIZE:
                    compoundChanges_container.style.display = 'none';
                    resolution_container.style.display = 'block';
                    popup_subtitle.innerHTML = 'Resize the current render.</br><small>(Will include alterations/mutations.)</small>';
                    popup_parallel.value = 1;
                    popup_totalOutputs.value = 1;
                    popup_scale_slider.value = 200;
                    popup_turbo_container.style.display = 'block';
                    break;
            }

            let width = defaults.width;
            popup_width.value = width * (popup_scale_slider.value / 100);
            let height = defaults.height;
            popup_height.value = height * (popup_scale_slider.value / 100);
            const setResolutionFields = function() {
                popup_width.value = round_64(width * (popup_scale_slider.value / 100));
                popup_height.value = round_64(height * (popup_scale_slider.value / 100));
            };
            const setResolutionSlider = function() {
                const ratio = ((popup_width.value / width) + (popup_height.value / height)) / 2;
                width = popup_width.value / ratio;
                height = popup_height.value / ratio;
                popup_scale_slider.value = ratio * 100;
            };

            const set_width = debounce(function() {
                const tmp_width = round_64(popup_width.value);
                if (tmp_width != popup_width.value) {
                    popup_width.value = tmp_width;
                }
                setResolutionSlider();
            }, 1000, false);
            const set_height = debounce(function() {
                const tmp_height = round_64(popup_height.value);
                if (tmp_height != popup_height.value) {
                    popup_height.value = tmp_height;
                }
                setResolutionSlider();
            }, 1000, false);

            popup_prompt.value = defaults.prompt;

            try {
                popup_scale_slider.addEventListener('input', setResolutionFields);
                popup_width.addEventListener('input', set_width);
                popup_height.addEventListener('input', set_height);
                // Display popup
                popupContainer.style.display = 'block';
                while (window.getComputedStyle(popupContainer).display !== "none") {
                    await asyncDelay(1000);
                }
            } finally {
                popup_scale_slider.removeEventListener('input', setResolutionFields);
                popup_width.removeEventListener('input', set_width);
                popup_height.removeEventListener('input', set_height);
            }
            const response = {
                cancelled: popupCancelled

                , parallel: parseInt(popup_parallel.value)
                , totalOutputs: parseInt(popup_totalOutputs.value)

                , prompt: popup_prompt.value
                , prompt_strength: parseFloat(popup_promptStrengthField.value)
                , guidance_scale: parseFloat(popup_guidanceScaleField.value)

                , width: round_64(popup_width.value)
                , height: round_64(popup_height.value)
                , scale: popup_scale_slider.value / 100

                , turbo: popup_turbo.checked
                , compoundChanges: compoundChanges.checked
            };
            popupCancelled = false;
            return response;
        }
    })();

    function getImg(src) {
        return new Promise(function(resolve, reject) {
            try {
                if (src.data instanceof HTMLImageElement
                    || src.data instanceof SVGImageElement
                    || src.data instanceof HTMLCanvasElement
                    || src.data instanceof ImageBitmap
                ) {
                    throw new Error('Not implemtented...')
                }
                const image = new Image();
                image.addEventListener('load', () => resolve(image));
                image.addEventListener('error', () => reject(new Error('Failed to load image.')));
                image.src = src.url || src.data;
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
        const ctx = canvas.getContext('2d');

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
        });
        newTaskRequest.numOutputsTotal = Math.max(newTaskRequest.reqBody.num_outputs, options.totalOutputs || 1);
        newTaskRequest.batchCount = Math.ceil(newTaskRequest.numOutputsTotal / newTaskRequest.reqBody.num_outputs);
        if ('guidance_scale' in options) {
            newTaskRequest.reqBody.guidance_scale = options.guidance_scale;
        }
        if ('prompt' in options) {
            newTaskRequest.reqBody.prompt = options.prompt;
        }
        if ('turbo' in options) {
            newTaskRequest.reqBody.turbo = options.turbo;
        }
        switch (mode) {
            case MODE_REDO:
            case MODE_RESIZE:
                if (!newTaskRequest.reqBody.init_image || mode === MODE_RESIZE || options.compoundChanges) {
                    newTaskRequest.reqBody.sampler = 'ddim';
                    newTaskRequest.reqBody.prompt_strength = options.prompt_strength || '0.5';
                    newTaskRequest.reqBody.init_image = img.src;
                    delete newTaskRequest.reqBody.mask;
                    if (mode !== MODE_RESIZE) {
                        newTaskRequest.reqBody.seed = Math.floor(Math.random() * 10000000);
                    }
                } else {
                    newTaskRequest.reqBody.seed = 1 + newTaskRequest.reqBody.seed;
                }
                if (mode === MODE_RESIZE) {
                    newTaskRequest.reqBody.width = options.width || round_64(reqBody.width * (options.scale || 2));
                    newTaskRequest.reqBody.height = options.height || round_64(reqBody.height * (options.scale || 2));
                    newTaskRequest.reqBody.num_inference_steps = Math.min(100, options.num_inference_steps || Math.round(reqBody.num_inference_steps * (options.scale || 2)));
                    if (useUpscalingField.checked) {
                        newTaskRequest.reqBody.use_upscale = upscaleModelField.value;
                    } else {
                        delete newTaskRequest.reqBody.use_upscale;
                    }
                }
                break;
            default: throw new Error("Unknown button.action mode: " + mode);
        }
        newTaskRequest.seed = newTaskRequest.reqBody.seed;
        return newTaskRequest;
    }

    function getStartNewTaskHandler(mode) {
        return async function(reqBody, img) {
            const options = await showPopup(mode, reqBody);
            if (options.cancelled) {
                return;
            }
            const newTaskRequest = buildRequest(mode, reqBody, img, options);
            createTask(newTaskRequest);
        }
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
