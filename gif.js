/* The MIT License (MIT)
 *
 * Copyright (c) 2011 Shachaf Ben-Kiki, https://github.com/shachaf/jsgif/blob/master/gif.js
 *          2013-2018 Johan Nordberg, https://github.com/jnordberg/gif.js
 *               2022 Marc-Andre Ferland(Madrang)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE. */

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    } else if (typeof define === "function" && define.amd) {
        define([], f)
    } else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        } else if (typeof global !== "undefined") {
            g = global
        } else if (typeof self !== "undefined") {
            g = self
        } else {
            g = this
        }
        g.GIF = f()
    }
})(function() {
    var define, module, exports;
    return function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    }({
        1: [function(require, module, exports) {
            function EventEmitter() {
                this._events = this._events || {};
                this._maxListeners = this._maxListeners || undefined
            }
            module.exports = EventEmitter;
            EventEmitter.EventEmitter = EventEmitter;
            EventEmitter.prototype._events = undefined;
            EventEmitter.prototype._maxListeners = undefined;
            EventEmitter.defaultMaxListeners = 10;
            EventEmitter.prototype.setMaxListeners = function(n) {
                if (!isNumber(n) || n < 0 || isNaN(n)) throw TypeError("n must be a positive number");
                this._maxListeners = n;
                return this
            };
            EventEmitter.prototype.emit = function(type) {
                var er, handler, len, args, i, listeners;
                if (!this._events) this._events = {};
                if (type === "error") {
                    if (!this._events.error || isObject(this._events.error) && !this._events.error.length) {
                        er = arguments[1];
                        if (er instanceof Error) {
                            throw er
                        } else {
                            var err = new Error('Uncaught, unspecified "error" event. (' + er + ")");
                            err.context = er;
                            throw err
                        }
                    }
                }
                handler = this._events[type];
                if (isUndefined(handler)) return false;
                if (isFunction(handler)) {
                    switch (arguments.length) {
                        case 1:
                            handler.call(this);
                            break;
                        case 2:
                            handler.call(this, arguments[1]);
                            break;
                        case 3:
                            handler.call(this, arguments[1], arguments[2]);
                            break;
                        default:
                            args = Array.prototype.slice.call(arguments, 1);
                            handler.apply(this, args)
                    }
                } else if (isObject(handler)) {
                    args = Array.prototype.slice.call(arguments, 1);
                    listeners = handler.slice();
                    len = listeners.length;
                    for (i = 0; i < len; i++) listeners[i].apply(this, args)
                }
                return true
            };
            EventEmitter.prototype.addListener = function(type, listener) {
                var m;
                if (!isFunction(listener)) throw TypeError("listener must be a function");
                if (!this._events) this._events = {};
                if (this._events.newListener) this.emit("newListener", type, isFunction(listener.listener) ? listener.listener : listener);
                if (!this._events[type]) this._events[type] = listener;
                else if (isObject(this._events[type])) this._events[type].push(listener);
                else this._events[type] = [this._events[type], listener];
                if (isObject(this._events[type]) && !this._events[type].warned) {
                    if (!isUndefined(this._maxListeners)) {
                        m = this._maxListeners
                    } else {
                        m = EventEmitter.defaultMaxListeners
                    }
                    if (m && m > 0 && this._events[type].length > m) {
                        this._events[type].warned = true;
                        console.error("(node) warning: possible EventEmitter memory " + "leak detected. %d listeners added. " + "Use emitter.setMaxListeners() to increase limit.", this._events[type].length);
                        if (typeof console.trace === "function") {
                            console.trace()
                        }
                    }
                }
                return this
            };
            EventEmitter.prototype.on = EventEmitter.prototype.addListener;
            EventEmitter.prototype.once = function(type, listener) {
                if (!isFunction(listener)) throw TypeError("listener must be a function");
                var fired = false;

                function g() {
                    this.removeListener(type, g);
                    if (!fired) {
                        fired = true;
                        listener.apply(this, arguments)
                    }
                }
                g.listener = listener;
                this.on(type, g);
                return this
            };
            EventEmitter.prototype.removeListener = function(type, listener) {
                var list, position, length, i;
                if (!isFunction(listener)) throw TypeError("listener must be a function");
                if (!this._events || !this._events[type]) return this;
                list = this._events[type];
                length = list.length;
                position = -1;
                if (list === listener || isFunction(list.listener) && list.listener === listener) {
                    delete this._events[type];
                    if (this._events.removeListener) this.emit("removeListener", type, listener)
                } else if (isObject(list)) {
                    for (i = length; i-- > 0;) {
                        if (list[i] === listener || list[i].listener && list[i].listener === listener) {
                            position = i;
                            break
                        }
                    }
                    if (position < 0) return this;
                    if (list.length === 1) {
                        list.length = 0;
                        delete this._events[type]
                    } else {
                        list.splice(position, 1)
                    }
                    if (this._events.removeListener) this.emit("removeListener", type, listener)
                }
                return this
            };
            EventEmitter.prototype.removeAllListeners = function(type) {
                var key, listeners;
                if (!this._events) return this;
                if (!this._events.removeListener) {
                    if (arguments.length === 0) this._events = {};
                    else if (this._events[type]) delete this._events[type];
                    return this
                }
                if (arguments.length === 0) {
                    for (key in this._events) {
                        if (key === "removeListener") continue;
                        this.removeAllListeners(key)
                    }
                    this.removeAllListeners("removeListener");
                    this._events = {};
                    return this
                }
                listeners = this._events[type];
                if (isFunction(listeners)) {
                    this.removeListener(type, listeners)
                } else if (listeners) {
                    while (listeners.length) this.removeListener(type, listeners[listeners.length - 1])
                }
                delete this._events[type];
                return this
            };
            EventEmitter.prototype.listeners = function(type) {
                var ret;
                if (!this._events || !this._events[type]) ret = [];
                else if (isFunction(this._events[type])) ret = [this._events[type]];
                else ret = this._events[type].slice();
                return ret
            };
            EventEmitter.prototype.listenerCount = function(type) {
                if (this._events) {
                    var evlistener = this._events[type];
                    if (isFunction(evlistener)) return 1;
                    else if (evlistener) return evlistener.length
                }
                return 0
            };
            EventEmitter.listenerCount = function(emitter, type) {
                return emitter.listenerCount(type)
            };

            function isFunction(arg) {
                return typeof arg === "function"
            }

            function isNumber(arg) {
                return typeof arg === "number"
            }

            function isObject(arg) {
                return typeof arg === "object" && arg !== null
            }

            function isUndefined(arg) {
                return arg === void 0
            }
        }, {}],
        2: [function(require, module, exports) {
            var UA, browser, mode, platform, ua;
            ua = navigator.userAgent.toLowerCase();
            platform = navigator.platform.toLowerCase();
            UA = ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/) || [null, "unknown", 0];
            mode = UA[1] === "ie" && document.documentMode;
            browser = {
                name: UA[1] === "version" ? UA[3] : UA[1],
                version: mode || parseFloat(UA[1] === "opera" && UA[4] ? UA[4] : UA[2]),
                platform: {
                    name: ua.match(/ip(?:ad|od|hone)/) ? "ios" : (ua.match(/(?:webos|android)/) || platform.match(/mac|win|linux/) || ["other"])[0]
                }
            };
            browser[browser.name] = true;
            browser[browser.name + parseInt(browser.version, 10)] = true;
            browser.platform[browser.platform.name] = true;
            module.exports = browser
        }, {}],
        3: [function(require, module, exports) {
            var EventEmitter, GIF, browser, extend = function(child, parent) {
                    for (var key in parent) {
                        if (hasProp.call(parent, key)) child[key] = parent[key]
                    }

                    function ctor() {
                        this.constructor = child
                    }
                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor;
                    child.__super__ = parent.prototype;
                    return child
                },
                hasProp = {}.hasOwnProperty,
                indexOf = [].indexOf || function(item) {
                    for (var i = 0, l = this.length; i < l; i++) {
                        if (i in this && this[i] === item) return i
                    }
                    return -1
                },
                slice = [].slice;
            EventEmitter = require("events").EventEmitter;
            browser = require("./browser.coffee");
            GIF = function(superClass) {
                var defaults, frameDefaults;
                extend(GIF, superClass);
                defaults = {
                    workerScript: "gif.worker.js",
                    workers: 2,
                    repeat: 0,
                    background: "#fff",
                    quality: 10,
                    width: null,
                    height: null,
                    transparent: null,
                    debug: false,
                    dither: false
                };
                frameDefaults = {
                    delay: 500,
                    copy: false
                };

                function GIF(options) {
                    var base, key, value;
                    this.running = false;
                    this.options = {};
                    this.frames = [];
                    this.freeWorkers = [];
                    this.activeWorkers = [];
                    this.setOptions(options);
                    for (key in defaults) {
                        value = defaults[key];
                        if ((base = this.options)[key] == null) {
                            base[key] = value
                        }
                    }
                }
                GIF.prototype.setOption = function(key, value) {
                    this.options[key] = value;
                    if (this._canvas != null && (key === "width" || key === "height")) {
                        return this._canvas[key] = value
                    }
                };
                GIF.prototype.setOptions = function(options) {
                    var key, results, value;
                    results = [];
                    for (key in options) {
                        if (!hasProp.call(options, key)) continue;
                        value = options[key];
                        results.push(this.setOption(key, value))
                    }
                    return results
                };
                GIF.prototype.addFrame = function(image, options) {
                    var frame, key;
                    if (options == null) {
                        options = {}
                    }
                    frame = {};
                    frame.transparent = this.options.transparent;
                    for (key in frameDefaults) {
                        frame[key] = options[key] || frameDefaults[key]
                    }
                    if (this.options.width == null) {
                        this.setOption("width", image.width)
                    }
                    if (this.options.height == null) {
                        this.setOption("height", image.height)
                    }
                    if (typeof ImageData !== "undefined" && ImageData !== null && image instanceof ImageData) {
                        frame.data = image.data
                    } else if (typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D !== null && image instanceof CanvasRenderingContext2D
                        || typeof OffscreenCanvasRenderingContext2D !== "undefined" && OffscreenCanvasRenderingContext2D !== null && image instanceof OffscreenCanvasRenderingContext2D
                        || typeof WebGLRenderingContext !== "undefined" && WebGLRenderingContext !== null && image instanceof WebGLRenderingContext
                    ) {
                        if (options.copy) {
                            frame.data = this.getContextData(image)
                        } else {
                            frame.context = image
                        }
                    } else if (image.childNodes != null) {
                        if (options.copy) {
                            frame.data = this.getImageData(image)
                        } else {
                            frame.image = image
                        }
                    } else {
                        throw new Error("Invalid image")
                    }
                    return this.frames.push(frame)
                };
                GIF.prototype.render = function() {
                    var i, j, numWorkers, ref;
                    if (this.running) {
                        throw new Error("Already running")
                    }
                    if (this.options.width == null || this.options.height == null) {
                        throw new Error("Width and height must be set prior to rendering")
                    }
                    this.running = true;
                    this.nextFrame = 0;
                    this.finishedFrames = 0;
                    this.imageParts = function() {
                        var j, ref, results;
                        results = [];
                        for (i = j = 0, ref = this.frames.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
                            results.push(null)
                        }
                        return results
                    }.call(this);
                    numWorkers = this.spawnWorkers();
                    if (this.options.globalPalette === true) {
                        this.renderNextFrame()
                    } else {
                        for (i = j = 0, ref = numWorkers; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
                            this.renderNextFrame()
                        }
                    }
                    this.emit("start");
                    return this.emit("progress", 0)
                };
                GIF.prototype.abort = function() {
                    var worker;
                    while (true) {
                        worker = this.activeWorkers.shift();
                        if (worker == null) {
                            break
                        }
                        this.log("killing active worker");
                        worker.terminate()
                    }
                    this.running = false;
                    return this.emit("abort")
                };
                GIF.prototype.spawnWorkers = function() {
                    var j, numWorkers, ref, results;
                    numWorkers = Math.min(this.options.workers, this.frames.length);
                    (function() {
                        results = [];
                        for (var j = ref = this.freeWorkers.length; ref <= numWorkers ? j < numWorkers : j > numWorkers; ref <= numWorkers ? j++ : j--) {
                            results.push(j)
                        }
                        return results
                    }).apply(this).forEach(function(_this) {
                        return function(i) {
                            var worker;
                            _this.log("spawning worker " + i);
                            worker = new Worker(_this.options.workerScript);
                            worker.onmessage = function(event) {
                                _this.activeWorkers.splice(_this.activeWorkers.indexOf(worker), 1);
                                _this.freeWorkers.push(worker);
                                return _this.frameFinished(event.data)
                            };
                            return _this.freeWorkers.push(worker)
                        }
                    }(this));
                    return numWorkers
                };
                GIF.prototype.frameFinished = function(frame) {
                    var i, j, ref;
                    this.log("frame " + frame.index + " finished - " + this.activeWorkers.length + " active");
                    this.finishedFrames++;
                    this.emit("progress", this.finishedFrames / this.frames.length);
                    this.imageParts[frame.index] = frame;
                    if (this.options.globalPalette === true) {
                        this.options.globalPalette = frame.globalPalette;
                        this.log("global palette analyzed");
                        if (this.frames.length > 2) {
                            for (i = j = 1, ref = this.freeWorkers.length; 1 <= ref ? j < ref : j > ref; i = 1 <= ref ? ++j : --j) {
                                this.renderNextFrame()
                            }
                        }
                    }
                    if (indexOf.call(this.imageParts, null) >= 0) {
                        return this.renderNextFrame()
                    } else {
                        return this.finishRendering()
                    }
                };
                GIF.prototype.finishRendering = function() {
                    var data, frame, i, image, j, k, l, len, len1, len2, len3, offset, page, ref, ref1, ref2;
                    len = 0;
                    ref = this.imageParts;
                    for (j = 0, len1 = ref.length; j < len1; j++) {
                        frame = ref[j];
                        len += (frame.data.length - 1) * frame.pageSize + frame.cursor
                    }
                    len += frame.pageSize - frame.cursor;
                    this.log("rendering finished - filesize " + Math.round(len / 1e3) + "kb");
                    data = new Uint8Array(len);
                    offset = 0;
                    ref1 = this.imageParts;
                    for (k = 0, len2 = ref1.length; k < len2; k++) {
                        frame = ref1[k];
                        ref2 = frame.data;
                        for (i = l = 0, len3 = ref2.length; l < len3; i = ++l) {
                            page = ref2[i];
                            data.set(page, offset);
                            if (i === frame.data.length - 1) {
                                offset += frame.cursor
                            } else {
                                offset += frame.pageSize
                            }
                        }
                    }
                    image = new Blob([data], {
                        type: "image/gif"
                    });
                    return this.emit("finished", image, data)
                };
                GIF.prototype.renderNextFrame = function() {
                    var frame, task, worker;
                    if (this.freeWorkers.length === 0) {
                        throw new Error("No free workers")
                    }
                    if (this.nextFrame >= this.frames.length) {
                        return
                    }
                    frame = this.frames[this.nextFrame++];
                    worker = this.freeWorkers.shift();
                    task = this.getTask(frame);
                    this.log("starting frame " + (task.index + 1) + " of " + this.frames.length);
                    this.activeWorkers.push(worker);
                    return worker.postMessage(task)
                };
                GIF.prototype.getContextData = function(ctx) {
                    return ctx.getImageData(0, 0, this.options.width, this.options.height).data
                };
                GIF.prototype.getImageData = function(image) {
                    var ctx;
                    if (this._canvas == null) {
                        this._canvas = document.createElement("canvas");
                        this._canvas.width = this.options.width;
                        this._canvas.height = this.options.height
                    }
                    ctx = this._canvas.getContext("2d");
                    ctx.setFill = this.options.background;
                    ctx.fillRect(0, 0, this.options.width, this.options.height);
                    ctx.drawImage(image, 0, 0);
                    return this.getContextData(ctx)
                };
                GIF.prototype.getTask = function(frame) {
                    var index, task;
                    index = this.frames.indexOf(frame);
                    task = {
                        index: index,
                        last: index === this.frames.length - 1,
                        delay: frame.delay,
                        transparent: frame.transparent,
                        width: this.options.width,
                        height: this.options.height,
                        quality: this.options.quality,
                        dither: this.options.dither,
                        globalPalette: this.options.globalPalette,
                        repeat: this.options.repeat,
                        canTransfer: browser.name === "chrome"
                    };
                    if (frame.data != null) {
                        task.data = frame.data
                    } else if (frame.context != null) {
                        task.data = this.getContextData(frame.context)
                    } else if (frame.image != null) {
                        task.data = this.getImageData(frame.image)
                    } else {
                        throw new Error("Invalid frame")
                    }
                    return task
                };
                GIF.prototype.log = function() {
                    var args;
                    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
                    if (!this.options.debug) {
                        return
                    }
                    return console.log.apply(console, args)
                };
                return GIF
            }(EventEmitter);
            module.exports = GIF
        }, {
            "./browser.coffee": 2,
            events: 1
        }]
    }, {}, [3])(3)
});

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
