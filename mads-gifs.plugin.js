/* Madrang's SD-UI GIFs Plugin.js
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
 * @source https://raw.githubusercontent.com/madrang/sd-ui-plugins/master/mads-gifs.plugin.js
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
            } catch (e) {
                reject(e);
            }
        });
    }

    function imageDelta(imageA, imageB) {
        const getImgData = function(img) {
            if (typeof img.getImageData === 'function') {
                return img.getImageData(0, 0, img.width, img.height).data;
            }
            return img;
        }
        imageA = getImgData(imageA);
        imageB = getImgData(imageB);
        if (imageA.length !== imageB.length) {
            return -1;
        }
        let changeDelta = 0;
        for (let i = imageA.length - 1; i >= 0; i -= 4) {
            // data === [R,G,B,A,R,G,B,A,...]
            let pixChange = 0;
            pixChange += Math.abs(data[i * 4 + 0] - data[i * 4 + 0])
            pixChange += Math.abs(data[i * 4 + 1] - data[i * 4 + 1])
            pixChange += Math.abs(data[i * 4 + 2] - data[i * 4 + 2])
            pixChange += Math.abs(data[i * 4 + 3] - data[i * 4 + 3])
            changeDelta += pixChange;
        }
        return changeDelta;
    }

    function writeImg(ctx, header, img, transparency, disposalMethod) {
        const ct = img.lctFlag ? img.lct : header.gct; // TODO: What if neither exists?
        const cData = ctx.getImageData(img.leftPos, img.topPos, img.width, img.height);

        img.pixels.forEach(function(pixel, i) {
            // cData.data === [R,G,B,A,...]
            if (transparency !== pixel) { // This includes null, if no transparency was defined.
                cData.data[i * 4 + 0] = ct[pixel][0];
                cData.data[i * 4 + 1] = ct[pixel][1];
                cData.data[i * 4 + 2] = ct[pixel][2];
                cData.data[i * 4 + 3] = 255; // Opaque.
            } else {
                // TODO: Handle disposal method properly.
                // XXX: When I get to an Internet connection, check which disposal method is which.
                if (disposalMethod === 2 || disposalMethod === 3) {
                    cData.data[i * 4 + 3] = 0; // Transparent.
                    // XXX: This is very very wrong.
                } else {
                    // disposalMethod should be null (no GCE), 0, or 1; leave the pixel as it is.
                    // assert(disposalMethod === null || disposalMethod === 0 || disposalMethod === 1);
                    // XXX: If this is the first frame (and we *do* have a GCE),
                    // disposalMethod will be null, but we want to set undefined
                    // pixels to the background color.
                }
            }
        });
        ctx.putImageData(cData, img.leftPos, img.topPos);
    };

    const GIF_DISPOSAL_METHODS = {
        notSpecified: 0
        , doNotDispose: 1
        , restoreToBackgroundColor: 2
        , restoreToPrevious: 3
    };
    Object.freeze(GIF_DISPOSAL_METHODS);
    loadScript('/plugins/user/gif.js').then(function() {
        if (!('OUTPUTS_FORMATS' in PLUGINS)) {
            return;
        }
        PLUGINS['OUTPUTS_FORMATS'].register(function gif() {
            return (reqBody) => {
                reqBody.stream_image_progress = true;
                reqBody.stream_image_progress_interval = 1;
                const instance = new SD.RenderTask(reqBody)
                const enqueue = instance.enqueue
                const gif = new GIF({
                    workerScript: '/plugins/user/gif.worker.js'
                    , workers: 2
                    , quality: 10
                    , width: reqBody.width
                    , height: reqBody.height
                });
                const offscreenOutput = new OffscreenCanvas(reqBody.width, reqBody.height);
                const outputCtx = offscreenOutput.getContext("2d");
                gif.on('finished', function(blob) {
                    console.log('gif completed...')
                    window.open(URL.createObjectURL(blob));
                });
                //TODO Same prompt, but start low steps to high steps to see details slowly gets added in.
                instance.enqueue = function(callback) {
                    return enqueue.call(this, async function(event) {
                        if (typeof event?.update?.output === 'object' && !gif.running) {
                            const updateOutput = event.update.output;
                            console.log('output update', updateOutput);
                            const src = {};
                            if (updateOutput[0]?.path) {
                                src.url = updateOutput[0]?.path + '?t=' + Date.now();
                            }
                            if (updateOutput[0]?.data) {
                                src.data = updateOutput[0]?.data;
                            }
                            const img = await copyImg(outputCtx, src);
                            gif.addFrame(outputCtx, {copy: true});
                            console.log('Added new frame %o to gif %o', img, gif);
                            if (event?.update?.status === 'succeeded') {
                                gif.addFrame(outputCtx, {copy: true}); // Add the last frame a second time...
                                gif.render();
                                console.log('Render completed!');
                            }
                        }
                        return await Promise.resolve(callback.call(this, event))
                    })
                };
                return instance;
            }
        });
        PLUGINS['OUTPUTS_FORMATS'].register(function stepAnim() {
            const processImage = async function*(reqBody, callback, signal) {
                console.log(`GIF - Starting ${reqBody.width}x${reqBody.height} gif render.`);

                const gif = new GIF({
                    workerScript: '/plugins/user/gif.worker.js'
                    , workers: 2
                    , quality: 10
                    , width: reqBody.width
                    , height: reqBody.height
                });

                const saveGifPromiseSrc = new PromiseSource();
                gif.on('finished', function(blob) {
                    console.log('gif completed...')
                    //window.open(URL.createObjectURL(blob));
                    saveGifPromiseSrc.resolve(URL.createObjectURL(blob));
                });

                const offscreenOutput = new OffscreenCanvas(reqBody.width, reqBody.height);
                const outputCtx = offscreenOutput.getContext("2d");
                outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                const renderFrames = [];

                let delay = 250;
                const advance_step = 0.088;
                for (let num_inference_steps = 5;
                    num_inference_steps <= reqBody.num_inference_steps;
                    num_inference_steps += Math.max(1, Math.floor(num_inference_steps * advance_step))
                ) {
                    console.log(`Gif.frame Starting Render ${num_inference_steps}/${reqBody.num_inference_steps}`);
                    const result = yield SD.render(Object.assign({}, reqBody, {
                        num_inference_steps
                        , output_format: 'png'
                    }), callback);
                    console.log('Gif.frame Render response %o', result);

                    const outputData = result?.output[0]?.data;
                    renderFrames.push(outputData);

                    // Clear output buffer
                    outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: outputData, width: reqBody.width, height: reqBody.height});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);
                    if (signal.aborted) {
                        break;
                    }
                }
                // Reverse animation and add frames again.
                renderFrames.reverse();
                for(const imgData of renderFrames) {
                    // Clear output buffer
                    outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: imgData, width: reqBody.width, height: reqBody.height});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);
                }

                // Start final render
                gif.render();
                const gifDataUrl = await saveGifPromiseSrc.promise;
                return {status:'succeeded', output: [{data:gifDataUrl}]};
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
        PLUGINS['OUTPUTS_FORMATS'].register(function morph() {
            const parsePrompt = function(text, params) {
                for (const [argName, argValue] of Object.entries(params)) {
                    text = text.replace(new RegExp(`{${argName}}`, "igm"), argValue.toFixed(3))
                }
                return text;
            };
            const processImage = async function*(reqBody, callback, signal) {
                console.log(`GIF - Starting ${reqBody.width}x${reqBody.height} gif render.`);

                const gif = new GIF({
                    workerScript: '/plugins/user/gif.worker.js'
                    , workers: 2
                    , quality: 10
                    , width: reqBody.width
                    , height: reqBody.height
                });

                const saveGifPromiseSrc = new PromiseSource();
                gif.on('finished', function(blob) {
                    console.log('gif completed...')
                    //window.open(URL.createObjectURL(blob));
                    saveGifPromiseSrc.resolve(URL.createObjectURL(blob));
                });

                const offscreenOutput = new OffscreenCanvas(reqBody.width, reqBody.height);
                const outputCtx = offscreenOutput.getContext("2d");
                outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                const renderFrames = [];

                let delay = 99; // playback time per frame in milliseconds.
                const advance_step = 2;
                const rangeStart = 1;
                const rangeEnd = 99;
                for (let weight_step = 0; rangeStart + weight_step <= rangeEnd; weight_step += advance_step) {
                    let promptOptions;
                    if (false) {
                        const blendAlpha = (2.0 / (1.0 + Math.exp(-0.05 * weight_step))) - 1.0;
                        promptOptions = { x: 100 * (1.0 - blendAlpha), y: 100 * blendAlpha };
                    } else {
                        promptOptions = { x: rangeEnd - weight_step, y: rangeStart + weight_step };
                    }
                    console.log(`Gif.frame Starting Render ${weight_step / advance_step}/${Math.floor((1 + rangeEnd - rangeStart) / advance_step)} using options %o`, promptOptions);
                    const result = yield SD.render(Object.assign({}, reqBody, {
                        prompt: parsePrompt(reqBody.prompt, promptOptions)
                        , output_format: 'png'
                    }), callback);
                    console.log('Gif.frame Render response %o', result);

                    const outputData = result?.output[0]?.data;
                    renderFrames.push(outputData);

                    // Clear output buffer
                    outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: outputData, width: reqBody.width, height: reqBody.height});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);
                    if (signal.aborted) {
                        break;
                    }
                }
                // Reverse animation and add frames again.
                renderFrames.reverse();
                for(const imgData of renderFrames) {
                    // Clear output buffer
                    outputCtx.clearRect(0, 0, reqBody.width, reqBody.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: imgData, width: reqBody.width, height: reqBody.height});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);
                }

                // Start final render
                gif.render();
                const gifDataUrl = await saveGifPromiseSrc.promise;
                return {status:'succeeded', output: [{data:gifDataUrl}]};
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

        const GIF_HEADER = 'data:image/gif;base64,'
        PLUGINS['TASK_CREATE'].push(function(event) {
            if (typeof event?.reqBody?.init_image !== 'string' || !event.reqBody.init_image.startsWith(GIF_HEADER)) {
                return
            }
            const data = event.reqBody.init_image.slice(GIF_HEADER.length);
            const decodedData = (typeof atob === 'function' ? atob(data) : Buffer.from(data, 'base64'));
            const stream = new Stream(decodedData);
            const imgArr = [];
            const eventsArr = [];
            let imgHeader = undefined;
            const readGifPromiseSrc = new PromiseSource();
            const processImage = async function*(callback, signal) {
                const inputCanvas = document.createElement('canvas');
                inputCanvas.width = imgHeader.width;
                inputCanvas.height = imgHeader.height;
                const inputCtx = inputCanvas.getContext("2d");
                inputCtx.clearRect(0, 0, event.reqBody.width, event.reqBody.height);

                yield readGifPromiseSrc.promise;
                console.log(`GIF2GIF - Starting ${imgHeader.width}x${imgHeader.height} gif render of ${imgArr.length} frames.`);

                const gif = new GIF({
                    workerScript: '/plugins/user/gif.worker.js'
                    , workers: 2
                    , quality: 10
                    , width: event.reqBody.width
                    , height: event.reqBody.height
                });

                const saveGifPromiseSrc = new PromiseSource();
                gif.on('finished', function(blob) {
                    console.log('gif completed...')
                    //window.open(URL.createObjectURL(blob));
                    saveGifPromiseSrc.resolve(URL.createObjectURL(blob));
                });

                const offscreenOutput = new OffscreenCanvas(event.reqBody.width, event.reqBody.height);
                const outputCtx = offscreenOutput.getContext("2d");
                outputCtx.clearRect(0, 0, event.reqBody.width, event.reqBody.height);

                let transparency = undefined;
                let disposalMethod = undefined;
                let delay = 500;
                let lastFrameData = undefined;
                for (let srcImg of eventsArr) {
                    if (srcImg.type === 'ext') {
                        // pixel manipulation events...
                        if (srcImg.extType === 'gce') {
                            transparency = srcImg.transparencyGiven ? srcImg.transparencyIndex : null;
                            if (srcImg.delayTime) {
                                delay = srcImg.delayTime;
                            }
                            disposalMethod = srcImg.disposalMethod;
                            if (disposalMethod == GIF_DISPOSAL_METHODS.restoreToBackgroundColor) {
                                inputCtx.clearRect(0, 0, imgHeader.width, imgHeader.height);
                            } else if (disposalMethod == GIF_DISPOSAL_METHODS.restoreToPrevious) {
                                inputCtx.globalAlpha = 1;
                                yield copyImg(inputCtx, {data: lastFrameData, width: imgHeader.width, height: imgHeader.height});
                            } else if (disposalMethod == GIF_DISPOSAL_METHODS.doNotDispose) {
                                lastFrameData = inputCanvas.toDataURL("image/png")
                            }
                        }
                        continue;
                    }

                    // keep some of the last output in the frame to stabilise Stable Diffusion.
                    //inputCtx.globalAlpha = prompt_strength / 2.0;
                    //inputCtx.drawImage(offscreenOutput
                    //    , 0, 0, offscreenOutput.width, offscreenOutput.height // Src
                    //    , 0, 0, imgHeader.width, imgHeader.height // Dest
                    //);

                    // Write the updated pixels of the current gif frame to the ctx.
                    inputCtx.globalAlpha = 1;
                    writeImg(inputCtx, imgHeader, srcImg, transparency, disposalMethod);

                    // Send to backend
                    console.log(`Gif.frame Starting Render ${imgArr.indexOf(srcImg) + 1} of ${imgArr.length}`);
                    const result = yield SD.render(Object.assign({}, event.reqBody, {
                        init_image: inputCanvas.toDataURL("image/png")
                        , output_format: 'png'
                    }), callback);
                    console.log('Gif.frame Render response %o', result);

                    // Clear output buffer
                    outputCtx.clearRect(0, 0, event.reqBody.width, event.reqBody.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: result?.output[0]?.data});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);

                    if (signal.aborted) {
                        break;
                    }
                }
                // Start final render
                gif.render();
                const gifDataUrl = await saveGifPromiseSrc.promise;
                return {status:'succeeded', output: [{data:gifDataUrl}]};
            };
            parseGIF(stream, {
                // Print header to console.
                hdr: (h) => {
                    imgHeader = h;
                    console.log(h);
                }
                // Get Image data.
                , img: (imgData) => {
                    console.log(imgData);
                    eventsArr.push(imgData);
                    imgArr.push(imgData);
                }
                , gce: function(gce) {
                    console.log(gce);
                    eventsArr.push(gce);
                }
                // End of file reached.
                , eof: () => {
                    readGifPromiseSrc.resolve(eventsArr);
                    console.log('GIF read completed! ImageData: %o', eventsArr);
                }
            });
            const controller = new AbortController();
            event.instance = {
                abort: () => controller.abort()
                , enqueue: function(callback) {
                    const process = processImage(callback, controller.signal);
                    return SD.Task.enqueue(process);
                }
            };
            event.reqBody.output_format = 'gif2gif';
        })
    }, (reason) => console.error(reason));

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
