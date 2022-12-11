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
            const processImage = async function*(reqBody, callback) {
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
                return {
                    enqueue: function(callback) {
                        const process = processImage(reqBody, callback);
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
            const processImage = async function*(callback) {
                const inputCanvas = document.createElement('canvas');
                inputCanvas.width = event.reqBody.width;
                inputCanvas.height = event.reqBody.height;
                const inputCtx = inputCanvas.getContext("2d");
                inputCtx.clearRect(0, 0, event.reqBody.width, event.reqBody.height);

                yield readGifPromiseSrc.promise;
                console.log(`GIF2GIF - Starting ${imgHeader.width}x${imgHeader.height} gif render of ${imgArr.length} frames.`);

                const gif = new GIF({
                    workerScript: '/plugins/user/gif.worker.js'
                    , workers: 2
                    , quality: 10
                    , width: imgHeader.width
                    , height: imgHeader.height
                });

                const saveGifPromiseSrc = new PromiseSource();
                gif.on('finished', function(blob) {
                    console.log('gif completed...')
                    //window.open(URL.createObjectURL(blob));
                    saveGifPromiseSrc.resolve(URL.createObjectURL(blob));
                });

                const offscreenOutput = new OffscreenCanvas(imgHeader.width, imgHeader.height);
                const outputCtx = offscreenOutput.getContext("2d");
                outputCtx.clearRect(0, 0, imgHeader.width, imgHeader.height);

                let prompt_strength = event.reqBody.prompt_strength;
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
                    outputCtx.clearRect(0, 0, imgHeader.width, imgHeader.height);
                    // Read back result.
                    const img = yield copyImg(outputCtx, {data: result?.output[0]?.data, width: imgHeader.width, height: imgHeader.height});
                    // Add to gif renderer.
                    gif.addFrame(outputCtx, {copy: true, delay});
                    console.log('Added new frame %o to gif %o', img, gif);
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
            event.instance = {enqueue: function(callback) {
                const process = processImage(callback);
                return SD.Task.enqueue(process);
            }};
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

// Generic functions
function bitsToNum(word) {
    return word.reduce((s, n) => s * 2 + n, 0);
};

function byteToBitArr(word) {
    const a = [];
    for (let i = 7; i >= 0; --i) {
        a.push(Boolean(word & (1 << i)));
    }
    return a;
};

class Stream {
    #data
    constructor(data) {
        this.#data = data;
        this.pos = 0;
    }

    get data() {
        return this.#data;
    }
    get len() {
        return this.#data.length;
    }

    readByte() {
        if (this.pos >= this.#data.length) {
            throw new Error('Attempted to read past end of stream.');
        }
        return this.#data.charCodeAt(this.pos++) & 0xFF;
    }
    readBytes(n) {
        const bytes = [];
        for (let i = 0; i < n; ++i) {
            bytes.push(this.readByte());
        }
        return bytes;
    }
    readUnsigned() { // Little-endian.
        const a = this.readBytes(2);
        return (a[1] << 8) + a[0];
    };
    read(n) {
        let s = '';
        for (let i = 0; i < n; ++i) {
            s += String.fromCharCode(this.readByte());
        }
        return s;
    }
};

function lzwDecode(minCodeSize, data) {
        // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
        let pos = 0; // Maybe this streaming thing should be merged with the Stream?

        const readCode = function(size) {
            let code = 0;
            for (let i = 0; i < size; ++i) {
                if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
                    code |= 1 << i;
                }
                pos++;
            }
            return code;
        };

    const output = [];

    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;

    let codeSize = minCodeSize + 1;
    let dict = [];

    const clear = function() {
        dict = [];
        codeSize = minCodeSize + 1;
        for (var i = 0; i < clearCode; ++i) {
            dict[i] = [i];
        }
        dict[clearCode] = [];
        dict[eoiCode] = null;
    };

    let code;
    let last;
    while (true) {
        last = code;
        code = readCode(codeSize);

        if (code === clearCode) {
            clear();
            continue;
        }
        if (code === eoiCode) {
            break;
        }

        if (code < dict.length) {
            if (last !== clearCode) {
                dict.push(dict[last].concat(dict[code][0]));
            }
        } else {
            if (code !== dict.length) {
                throw new Error('Invalid LZW code.');
            }
            dict.push(dict[last].concat(dict[last][0]));
        }
        output.push.apply(output, dict[code]);

        if (dict.length === (1 << codeSize) && codeSize < 12) {
            // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
            codeSize++;
        }
    }

    // I don't know if this is technically an error, but some GIFs do it.
    //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
    return output;
};

// The actual parsing; returns an object with properties.
function parseGIF(st, handler) {
    if (!handler) {
        handler = {};
    }

    // LZW (GIF-specific)
    const parseCT = function(entries) { // Each entry is 3 bytes, for RGB.
        let ct = [];
        for (let i = 0; i < entries; i++) {
            ct.push(st.readBytes(3));
        }
        return ct;
    };

    const readSubBlocks = function() {
        let size;
        const data = [];
        do {
            size = st.readByte();
            data.push(st.read(size));
        } while (size !== 0);
        return data.join('');
    };

    const parseHeader = function() {
        const hdr = {};
        hdr.sig = st.read(3);
        hdr.ver = st.read(3);
        if (hdr.sig !== 'GIF') {
            throw new Error('Not a GIF file.'); // XXX: This should probably be handled more nicely.
        }

        hdr.width = st.readUnsigned();
        hdr.height = st.readUnsigned();

        var bits = byteToBitArr(st.readByte());
        hdr.gctFlag = bits.shift();
        hdr.colorRes = bitsToNum(bits.splice(0, 3));
        hdr.sorted = bits.shift();
        hdr.gctSize = bitsToNum(bits.splice(0, 3));

        hdr.bgColor = st.readByte();
        hdr.pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64

        if (hdr.gctFlag) {
            hdr.gct = parseCT(1 << (hdr.gctSize + 1));
        }
        if (handler.hdr) {
            handler.hdr(hdr);
        }
    };

    const parseExt = function(block) {
        const parseGCExt = function(block) {
            const blockSize = st.readByte(); // Always 4

            const bits = byteToBitArr(st.readByte());
            block.reserved = bits.splice(0, 3); // Reserved; should be 000.
            block.disposalMethod = bitsToNum(bits.splice(0, 3));
            block.userInput = bits.shift();
            block.transparencyGiven = bits.shift();

            block.delayTime = st.readUnsigned();
            block.transparencyIndex = st.readByte();
            block.terminator = st.readByte();

            if (handler.gce) {
                handler.gce(block);
            }
        };

        const parseComExt = function(block) {
            block.comment = readSubBlocks();
            if (handler.com) {
                handler.com(block);
            }
        };

        const parsePTExt = function(block) {
            // No one *ever* uses this. If you use it, deal with parsing it yourself.
            const blockSize = st.readByte(); // Always 12
            block.ptHeader = st.readBytes(12);
            block.ptData = readSubBlocks();
            handler.pte && handler.pte(block);
        };

        const parseAppExt = function(block) {
            const parseNetscapeExt = function(block) {
                const blockSize = st.readByte(); // Always 3
                block.unknown = st.readByte(); // ??? Always 1? What is this?
                block.iterations = st.readUnsigned();
                block.terminator = st.readByte();
                if (handler?.app?.NETSCAPE) {
                    handler.app.NETSCAPE(block);
                }
            };

            const parseUnknownAppExt = function(block) {
                block.appData = readSubBlocks();
                // FIXME: This won't work if a handler wants to match on any identifier.
                if (handler.app) {
                    const appFn = handler.app[block.identifier];
                    if (appFn) {
                        appFn(block);
                    }
                }
            };

            var blockSize = st.readByte(); // Always 11
            block.identifier = st.read(8);
            block.authCode = st.read(3);
            switch (block.identifier) {
            case 'NETSCAPE':
                parseNetscapeExt(block);
                break;
            default:
                parseUnknownAppExt(block);
                break;
            }
        };

        const parseUnknownExt = function(block) {
            block.data = readSubBlocks();
            handler.unknown && handler.unknown(block);
        };

        block.label = st.readByte();
        switch (block.label) {
        case 0xF9:
            block.extType = 'gce';
            parseGCExt(block);
            break;
        case 0xFE:
            block.extType = 'com';
            parseComExt(block);
            break;
        case 0x01:
            block.extType = 'pte';
            parsePTExt(block);
            break;
        case 0xFF:
            block.extType = 'app';
            parseAppExt(block);
            break;
        default:
            block.extType = 'unknown';
            parseUnknownExt(block);
            break;
        }
    };

    const parseImg = function(img) {
        const deinterlace = function(pixels, width) {
            // Of course this defeats the purpose of interlacing. And it's *probably*
            // the least efficient way it's ever been implemented. But nevertheless...

            const newPixels = new Array(pixels.length);
            const rows = pixels.length / width;
            const cpRow = function(toRow, fromRow) {
                const fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width);
                newPixels.splice.apply(newPixels, [toRow * width, width].concat(fromPixels));
            };

            // See appendix E.
            const offsets = [0,4,2,1];
            const steps   = [8,8,4,2];

            let fromRow = 0;
            for (let pass = 0; pass < 4; pass++) {
                for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
                    cpRow(toRow, fromRow)
                    fromRow++;
                }
            }

            return newPixels;
        };

        img.leftPos = st.readUnsigned();
        img.topPos = st.readUnsigned();
        img.width = st.readUnsigned();
        img.height = st.readUnsigned();

        const bits = byteToBitArr(st.readByte());
        img.lctFlag = bits.shift();
        img.interlaced = bits.shift();
        img.sorted = bits.shift();
        img.reserved = bits.splice(0, 2);
        img.lctSize = bitsToNum(bits.splice(0, 3));

        if (img.lctFlag) {
            img.lct = parseCT(1 << (img.lctSize + 1));
        }

        img.lzwMinCodeSize = st.readByte();

        const lzwData = readSubBlocks();
        img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData);

        if (img.interlaced) { // Move
            img.pixels = deinterlace(img.pixels, img.width);
        }

        if (handler.img) {
            handler.img(img);
        }
    };

    const parseBlock = function() {
        const block = {};
        block.sentinel = st.readByte();

        switch (String.fromCharCode(block.sentinel)) { // For ease of matching
        case '!':
            block.type = 'ext';
            parseExt(block);
            break;
        case ',':
            block.type = 'img';
            parseImg(block);
            break;
        case ';':
            block.type = 'eof';
            handler.eof && handler.eof(block);
            break;
        default:
            throw new Error('Unknown block: 0x' + block.sentinel.toString(16)); // TODO: Pad this with a 0.
        }

        if (block.type !== 'eof') {
            setTimeout(parseBlock, 0);
        }
    };

    const parse = function() {
        parseHeader();
        setTimeout(parseBlock, 0);
    };
    parse();
};
