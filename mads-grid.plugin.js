/* Madrang's SD-UI Render Grid Plugin.js
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
    console.log('%s GIFs Version: %s', ID_PREFIX, VERSION);

    // Help and Community links
    const links = document.getElementById("community-links");
    (function() {
        if (links && !document.getElementById(`${ID_PREFIX}-link`)) {
            // Add link to plugin repo.
            const pluginLink = document.createElement('li');
            pluginLink.innerHTML = `<a id="${ID_PREFIX}-link" href="${GITHUB_PAGE}" target="_blank"><i class="fa-solid fa-code-merge"></i> Madrang's Plugins on GitHub</a>`;
            links.appendChild(pluginLink);
        }
    })();

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
                console.log("loading", src.url || src.data)
            } catch (e) {
                reject(e);
            }
        });
    }

    if (!('OUTPUTS_FORMATS' in PLUGINS)) {
        return;
    }
    PLUGINS['OUTPUTS_FORMATS'].register(function grid() {
        const SIZE = { x: 10, y: 8 };
        const processImage = async function*(reqBody, callback, signal) {
            const gridCanvas = document.createElement('canvas');
            gridCanvas.width = reqBody.width * SIZE.x;
            gridCanvas.height = reqBody.height * SIZE.y;
            const gridCtx = gridCanvas.getContext("2d");
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

            console.log(`GRID - Starting ${gridCanvas.width}x${gridCanvas.height} grid render.`);
            for (let x = 0; x < SIZE.x; ++x) {
                for (let y = 0; y < SIZE.y; ++y) {
                    const updateCanvas = async function(event) {
                        console.log('Grid.updateCanvas on %o with %o', this, event);
                        let outputData = event.update?.output
                        if (outputData) {
                            outputData = outputData[0]?.path || outputData[0]?.data;
                        }
                        if (outputData && !("status" in event.update)) {
                            delete event.update.output[0].path;
                            await copyImg(gridCtx
                                , { data: outputData
                                    , width: reqBody.width, height: reqBody.height
                                }
                                , { // dest
                                    x: x * reqBody.width, y: y * reqBody.height
                                    , width: reqBody.width, height: reqBody.height
                                }
                            );
                            event.update.output[0].data = gridCanvas.toDataURL("image/jpeg", reqBody.output_quality);
                        }
                        const cbResult = callback.call(this, event);
                        if (typeof cbResult === "object" && cbResult instanceof Promise) {
                            return await cbResult;
                        }
                        return cbResult;
                    };
                    console.log(`Grid.frame Starting Render [${x}, ${y}]`);
                    const result = yield SD.render(Object.assign({}, reqBody, {
                        num_inference_steps: reqBody.num_inference_steps + (x * 5)
                        , guidance_scale: Math.min(6.2, reqBody.guidance_scale) + (y * 6.2)
                        , output_format: 'png'
                    }), updateCanvas);
                    console.log('Grid.frame Render response %o', result);

                    // Read back result.
                    const outputData = result.output[0].data;
                    const img = yield copyImg(gridCtx
                        , { data: outputData
                            , width: reqBody.width
                            , height: reqBody.height
                        }
                        , { // dest
                            x: x * reqBody.width, y: y * reqBody.height
                            , width: reqBody.width, height: reqBody.height
                        }
                    );
                    console.log('Added new frame %o to grid %o', img, gridCanvas);
                    if (signal.aborted) {
                        console.log('grid stopped %o', gridCanvas);
                        return {status:'abort', output: [{data:gridCanvas.toDataURL("image/jpeg", reqBody.output_quality)}]};
                    }
                }
            }
            console.log('Completed grid %o', gridCanvas);
            return {status:'succeeded', output: [{data:gridCanvas.toDataURL("image/jpeg", reqBody.output_quality)}]};
        };
        return (reqBody) => {
            const controller = new AbortController();
            return {
                abort: () => controller.abort()
                , enqueue: function(callback) {
                    const process = processImage(reqBody, callback, controller.signal);
                    return SD.Task.enqueue(process);
                }
            };
        }
    });

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
