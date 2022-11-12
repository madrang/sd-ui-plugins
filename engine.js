/** SD-UI Backend control and classes.
 */
(function () { "use strict";
    const RETRY_DELAY_IF_BUFFER_IS_EMPTY = 1000 // ms
    const RETRY_DELAY_IF_SERVER_IS_BUSY = 30 * 1000 // ms, status_code 503, already a task running
    const TASK_STATE_SERVER_UPDATE_DELAY = 1500 // ms
    const SERVER_STATE_VALIDITY_DURATION = 10 * 1000 // ms
    const HEALTH_PING_INTERVAL = 5 // seconds

    /** Returns the global object for the current execution environement.
     * @Returns window in a browser, global in node and self in a ServiceWorker.
     * @Notes Allows unit testing and use of the engine outside of a browser.
     */
    function getGlobal() {
        if (typeof globalThis === 'object') {
            return globalThis
        } else if (typeof global === 'object') {
            return global
        } else if (typeof self === 'object') {
            return self
        }
        try {
            return Function('return this')()
        } catch {
            // If the Function constructor fails, we're in a browser with eval disabled by CSP headers.
            return window
        } // Returns undefined if global can't be found.
    }

    /** Check if x is an Array or a TypedArray.
     * @Returns true if x is an Array or a TypedArray, false otherwise.
     */
    function isArrayOrTypedArray(x) {
        return Boolean(typeof x === 'object' && (Array.isArray(x) || (ArrayBuffer.isView(x) && !(x instanceof DataView))))
    }

    function makeQuerablePromise(promise) {
        if (typeof promise !== 'object') {
            throw new Error('promise is not an object.')
        }
        if (!(promise instanceof Promise)) {
            throw new Error('Argument is not a promise.')
        }
        // Don't modify a promise that's been already modified.
        if ('isResolved' in promise || 'isRejected' in promise || 'isPending' in promise) {
            return promise
        }
        let isPending = true
        let isRejected = false
        let rejectReason = undefined
        let isResolved = false
        let resolvedValue = undefined
        const qurPro = promise.then(
            function(val){
                isResolved = true
                isPending = false
                resolvedValue = val
                return val
            }
            , function(reason) {
                rejectReason = reason
                isRejected = true
                isPending = false
                throw reason
            }
        )
        Object.defineProperties(qurPro, {
            'isResolved': {
                get: () => isResolved
            }
            , 'resolvedValue': {
                get: () => resolvedValue
            }
            , 'isPending': {
                get: () => isPending
            }
            , 'isRejected': {
                get: () => isRejected
            }
            , 'rejectReason': {
                get: () => rejectReason
            }
        })
        return qurPro
    }

    /** Connects to an endpoint and resumes connexion after reaching end of stream until all data is received.
     * Allows closing the connexion while the server buffers more data.
     */
    class ChunkedStreamReader {
        #bufferedString = '' // Data received waiting to be read.
        #url
        #fetchOptions
        #response

        constructor(url, initialContent='', options={}) {
            if (typeof url !== 'string' && !(url instanceof String)) {
                throw new Error('url is not a string.')
            }
            if (typeof initialContent !== 'undefined' && typeof initialContent !== 'string') {
                throw new Error('initialContent is not a string.')
            }
            this.#bufferedString = initialContent
            this.#url = url
            this.#fetchOptions = Object.assign({
                headers: {
                    'Content-Type': 'application/json'
                }
            }, options)
            this.onNext = undefined
        }

        get url() {
            if (this.#response.redirected) {
                return this.#response.url
            }
            return this.#url
        }
        get bufferedString() {
            return this.#bufferedString
        }
        get status() {
            this.#response?.status
        }
        get statusText() {
            this.#response?.statusText
        }

        parse(value) {
            if (typeof value === 'undefined') {
                return
            }
            if (!isArrayOrTypedArray(value)) {
                return [value]
            }
            if (value.length === 0) {
                return value
            }
            if (typeof this.textDecoder === 'undefined') {
                this.textDecoder = new TextDecoder()
            }
            return [this.textDecoder.decode(value)]
        }
        onComplete(value) {
            return value
        }
        onError(response) {
            throw new Error(response.statusText)
        }
        onNext({value, done}, response) {
            return {value, done}
        }

        async *[Symbol.asyncIterator]() {
            return this.open()
        }
        async *open() {
            let value = undefined
            let done = undefined
            do {
                if (this.#response) {
                    await asyncDelay(RETRY_DELAY_IF_BUFFER_IS_EMPTY)
                }
                this.#response = await fetch(this.#url, this.#fetchOptions)
                if (!this.#response.ok) {
                    if (this.#response.status === 425) {
                        continue
                    }
                    // Request status indicate failure
                    console.warn('Stream %o stopped unexpectedly.', this.#response)
                    value = await Promise.resolve(this.onError(this.#response))
                    if (typeof value === 'boolean' && value) {
                        continue
                    }
                    return value
                }
                const reader = this.#response.body.getReader()
                done = false
                do {
                    const readState = await reader.read()
                    value = this.parse(readState.value)
                    if (value) {
                        for(let sVal of value) {
                            ({value: sVal, done} = await Promise.resolve(this.onNext({value:sVal, done:readState.done})))
                            yield sVal
                            if (done) {
                                return this.onComplete(sVal)
                            }
                        }
                    }
                    if (done) {
                        return
                    }
                } while(value && !done)
            } while (!done && (this.#response.ok || this.#response.status === 425))
        }
        *readStreamAsJSON(jsonStr, throwOnError) {
            if (typeof jsonStr !== 'string') {
                throw new Error('jsonStr is not a string.')
            }
            do {
                if (this.#bufferedString.length > 0) {
                    // Append new data when required
                    if (jsonStr.length > 0) {
                        jsonStr = this.#bufferedString + jsonStr
                    } else {
                        jsonStr = this.#bufferedString
                    }
                    this.#bufferedString = ''
                }
                if (!jsonStr) {
                    return
                }
                // Find next delimiter
                let lastChunkIdx = jsonStr.indexOf('}{')
                if (lastChunkIdx >= 0) {
                    this.#bufferedString = jsonStr.substring(0, lastChunkIdx + 1)
                    jsonStr = jsonStr.substring(lastChunkIdx + 1)
                } else {
                    this.#bufferedString = jsonStr
                    jsonStr = ''
                }
                if (this.#bufferedString.length <= 0) {
                    return
                }
                // hack for a middleman buffering all the streaming updates, and unleashing them on the poor browser in one shot.
                // this results in having to parse JSON like {"step": 1}{"step": 2}{"step": 3}{"ste...
                // which is obviously invalid and can happen at any point while rendering.
                // So we need to extract only the next {} section
                try { // Try to parse
                    const jsonObj = JSON.parse(this.#bufferedString)
                    this.#bufferedString = jsonStr
                    jsonStr = ''
                    yield jsonObj
                } catch (e) {
                    if (throwOnError) {
                        console.error(`Parsing: "${this.#bufferedString}", Buffer: "${jsonStr}"`)
                    }
                    this.#bufferedString += jsonStr
                    if (e instanceof SyntaxError && !throwOnError) {
                        return
                    }
                    throw e
                }
            } while (this.#bufferedString.length > 0 && this.#bufferedString.indexOf('}') >= 0)
        }
    }

    const events = {};

    /** Add a new event listener
     */
    function addEventListener(name, handler) {
        if (events.hasOwnProperty(name)) {
            events[name].push(handler)
        } else {
            events[name] = [handler]
        }
    }
    /** Remove the event listener
     */
    function removeEventListener(name, handler) {
        if (!events.hasOwnProperty(name)) {
            return
        }
        const index = events[name].indexOf(handler)
        if (index != -1) {
            events[name].splice(index, 1)
        }
    }
    function fireEvent(thisArg, name, ...args) {
        if (!events.hasOwnProperty(name)) {
            return
        }
        if (!args || !args.length) {
            args = []
        }
        const evs = events[name]
        const len = evs.length
        for (let i = 0; i < len; ++i) {
            evs[i].apply(thisArg, args)
        }
    }

    function setServerStatus(msgType, msg){
        fireEvent(SD, 'statusChange', msgType, msg)
    }

    const ServerStates = {
        init: 'Init'
        , loadingModel: 'LoadingModel'
        , online: 'Online'
        , rendering: 'Rendering'
        , unavailable: 'Unavailable'
    }
    Object.freeze(ServerStates)

    let sessionId = Date.now()
    let serverState = {'status': ServerStates.unavailable, 'time': Date.now()}

    async function healthCheck() {
        try {
            let res = undefined
            if (typeof sessionId !== 'undefined') {
                res = await fetch('/ping?session_id=' + sessionId)
            } else {
                res = await fetch('/ping')
            }
            serverState = await res.json()
            if (typeof serverState !== 'object' || typeof serverState.status !== 'string') {
                serverState = {'status': ServerStates.unavailable, 'time': Date.now()}
                setServerStatus('error', 'offline')
                return
            }
            // Set status
            switch(serverState.status) {
                case ServerStates.init:
                    // Wait for init to complete before updating status.
                    break
                case ServerStates.online:
                    setServerStatus('online', 'ready')
                    break
                case ServerStates.loadingModel:
                    setServerStatus('busy', 'loading..')
                    break
                case ServerStates.rendering:
                    setServerStatus('busy', 'rendering..')
                    break
                default: // Unavailable
                    setServerStatus('error', serverState.status.toLowerCase())
                    break
            }
            serverState.time = Date.now()
        } catch (e) {
            serverState = {'status': ServerStates.unavailable, 'time': Date.now()}
            setServerStatus('error', 'offline')
        }
    }

    function isServerAvailable() {
        if (typeof serverState !== 'object') {
            return false
        }
        switch (serverState.status) {
            case ServerStates.loadingModel:
            case ServerStates.rendering:
            case ServerStates.online:
                return true
            default:
                return false
        }
    }

    async function waitUntil(isReadyFn, delay, timeout) {
        if (typeof delay === 'number') {
            const msDelay = delay
            delay = () => asyncDelay(msDelay)
        }
        if (typeof delay !== 'function') {
            throw new Error('delay is not a number or a function.')
        }
        if (typeof timeout !== 'undefined' && typeof timeout !== 'number') {
            throw new Error('timeout is not a number.')
        }
        if (typeof timeout === 'undefined' || timeout < 0) {
            timeout = Number.MAX_SAFE_INTEGER
        }
        timeout = Date.now() + timeout
        while (timeout > Date.now()
            && Date.now() < (serverState.time + (timeout || SERVER_STATE_VALIDITY_DURATION))
            && !isReadyFn()
        ) {
            await delay()
            if (!isServerAvailable()) {
                throw new Error('Connexion with server lost.')
            }
        }
    }

    const TaskStatus = {
        init: 'init'
        , pending: 'pending' // Queued locally, not yet posted to server
        , waiting: 'waiting' // Waiting to run on server
        , processing: 'processing'
        , stopped: 'stopped'
        , completed: 'completed'
        , failed: 'failed'
    }
    Object.freeze(TaskStatus)

    const TASK_STATUS_ORDER = [
        TaskStatus.init
        , TaskStatus.pending
        , TaskStatus.waiting
        , TaskStatus.processing
        //Don't add status that are final.
    ]

    const task_queue = new Map()
    const concurrent_generators = new Map()
    const weak_results = new WeakMap()

    class Task {
        // Private properties...
        _reqBody = {} // request body of this task.
        #reader = undefined
        #status = TaskStatus.init
        #id = undefined
        #exception = undefined

        constructor(options={}) {
            this._reqBody = Object.assign({}, options)
            if (typeof this._reqBody.session_id === 'undefined') {
                this._reqBody.session_id = sessionId
            }
            if (typeof this._reqBody.session_id === 'number') {
                this._reqBody.session_id = String(this._reqBody.session_id)
            }
            if (typeof this._reqBody.session_id !== 'string') {
                throw new Error('session_id needs to be a number or a string.')
            }
        }

        get id() {
            return this.#id
        }
        _setId(id) {
            if (typeof this.#id !== 'undefined') {
                throw new Error('The task ID can only be set once.')
            }
            this.#id = id
        }

        get exception() {
            return this.#exception
        }
        abort(exception) {
            if (this.isCompleted || this.isStopped || this.hasFailed) {
                return
            }
            task_queue.delete(this)
            if (typeof exception !== 'undefined') {
                if (typeof exception === 'string') {
                    exception = new Error(exception)
                }
                if (typeof exception !== 'object') {
                    throw new Error('exception is not an object.')
                }
                if (!(exception instanceof Error)) {
                    throw new Error('exception is not an Error or a string.')
                }
            }
            this.#exception = exception
            this.#status = (exception ? TaskStatus.failed : TaskStatus.stopped)
        }

        get reqBody() {
            if (this.#status === TaskStatus.init) {
                return this._reqBody
            }
            console.warn('Task reqBody cannot be changed after the init state.')
            return Object.assign({}, this._reqBody)
        }

        get isCompleted() {
            return this.#status === TaskStatus.completed
        }
        get hasFailed() {
            return this.#status === TaskStatus.failed
        }
        get isStopped() {
            return this.#status === TaskStatus.stopped
        }
        get status() {
            return this.#status
        }
        _setStatus(status) {
            if (status === this.#status) {
                return
            }
            const currentIdx = TASK_STATUS_ORDER.indexOf(this.#status)
            if (currentIdx < 0) {
                throw Error(`The task status ${this.#status} is final and can't be changed.`)
            }
            const newIdx = TASK_STATUS_ORDER.indexOf(status)
            if (newIdx >= 0 && newIdx < currentIdx) {
                throw Error(`The task status ${status} can't replace ${this.#status}.`)
            }
            this.#status = status
        }

        static getReader(url) {
            const reader = new ChunkedStreamReader(url)
            const parseToString = reader.parse
            reader.parse = function(value) {
                value = parseToString.call(this, value)
                if (!value || value.length <= 0) {
                    return
                }
                return reader.readStreamAsJSON(value.join(''))
            }
            reader.onNext = function({done, value}) {
                // By default is completed when the return value has a status defined.
                if (typeof value === 'object' && 'status' in value) {
                    done = true
                }
                return {done, value}
            }
            return reader
        }
        _setReader(reader) {
            if (typeof this.#reader !== 'undefined') {
                throw new Error('The task reader can only be set once.')
            }
            this.#reader = reader
        }
        get reader() {
            if (this.#reader) {
                return this.#reader
            }
            if (!this.streamUrl) {
                throw new Error('The task has no stream Url defined.')
            }
            this.#reader = Task.getReader(this.streamUrl)
            const task = this
            this.#reader.onComplete = function(value) {
                task.result = value
                task._setStatus(TaskStatus.completed)
                return value
            }
            this.#reader.onError = function(response) {
                const err = new Error(response.statusText)
                task.abort(err)
                throw err
            }
            return this.#reader
        }

        async waitUntil({timeout=-1, callback, status, signal}) {
            const currentIdx = TASK_STATUS_ORDER.indexOf(this.#status)
            if (currentIdx <= 0) {
                return false
            }
            const stIdx = (status ? TASK_STATUS_ORDER.indexOf(status) : currentIdx + 1)
            if (stIdx >= 0 && stIdx <= currentIdx) {
                return true
            }
            if (stIdx < 0 && currentIdx < 0) {
                return this.#status === (status || TaskStatus.completed)
            }
            switch(this.#status) {
                case TaskStatus.init:
                case TaskStatus.pending:
                    // Wait for server status to update.
                    await waitUntil(() => (this.#id && SD.serverState.task === this.#id)
                        || callback?.call(this)
                        || signal?.aborted
                        , TASK_STATE_SERVER_UPDATE_DELAY
                        , SERVER_STATE_VALIDITY_DURATION
                    )
                    if (stIdx >= 0 && stIdx <= TASK_STATUS_ORDER.indexOf(TaskStatus.waiting)) {
                        return true
                    }
                case TaskStatus.waiting:
                    // Wait for task to start on server.
                    await waitUntil(() => SD.serverState.task !== this.#id
                        || SD.serverState.session !== 'pending'
                        || callback?.call(this)
                        || signal?.aborted
                        , TASK_STATE_SERVER_UPDATE_DELAY
                        , timeout
                    )
                    this._setStatus(TaskStatus.processing)
                    if (stIdx >= 0 && stIdx <= TASK_STATUS_ORDER.indexOf(TaskStatus.processing)) {
                        return true
                    }
                case TaskStatus.processing:
                    await waitUntil(() => SD.serverState.task !== this.#id
                        || SD.serverState.session !== 'running'
                        || callback?.call(this)
                        || signal?.aborted
                        , TASK_STATE_SERVER_UPDATE_DELAY
                        , timeout
                    )
                default:
                    return this.#status === (status || TaskStatus.completed)
            }
        }

        async enqueue(promiseGenerator, ...args) {
            if (this.status !== TaskStatus.init) {
                throw new Error(`Task is in an invalid status ${this.status} to add to queue.`)
            }
            this._setStatus(TaskStatus.pending)
            task_queue.set(this, promiseGenerator)
            fireEvent(this, 'task_queued', {})
            await Task.enqueue(promiseGenerator, ...args)
            await this.waitUntil({status: TaskStatus.completed})
            if (this.exception) {
                throw this.exception
            }
            return this.result
        }
        static async enqueue(promiseGenerator, ...args) {
            if (typeof promiseGenerator === 'undefined') {
                throw new Error('To enqueue a concurrent task, a *Promise Generator is needed but undefined was found.')
            }
            //if (Symbol.asyncIterator in result || Symbol.iterator in result) {
                //concurrent_generators.set(result, Promise.resolve(args))
            if (typeof promiseGenerator === 'function') {
                concurrent_generators.set(asGenerator({callback: promiseGenerator}), Promise.resolve(args))
            } else {
                concurrent_generators.set(promiseGenerator, Promise.resolve(args))
            }
            await waitUntil(() => !concurrent_generators.has(promiseGenerator), 250)
            return weak_results.get(promiseGenerator)
        }

        static async run(promiseGenerator, {callback, signal, timeout=-1}={}) {
            let value = undefined
            let done = undefined
            if (timeout < 0) {
                timeout = Number.MAX_SAFE_INTEGER
            }
            timeout = Date.now() + timeout
            do {
                ({value, done} = await Promise.resolve(promiseGenerator.next(value)))
                if (value instanceof Promise) {
                    value = await value
                }
                if (callback) {
                    ({value, done} = await Promise.resolve(callback.call(promiseGenerator, {value, done})))
                }
                if (value instanceof Promise) {
                    value = await value
                }
            } while(!done && !signal?.aborted && timeout > Date.now())
            return value
        }
        static *asGenerator({callback, generator, signal, timeout=-1}={}) {
            let value = undefined
            let done = undefined
            if (timeout < 0) {
                timeout = Number.MAX_SAFE_INTEGER
            }
            timeout = Date.now() + timeout
            do {
                ({value, done} = yield generator.next(value))
                if (value instanceof Promise) {
                    value = yield value
                }
                if (callback) {
                    ({value, done} = yield callback.call(generator, {value, done}))
                }
                if (value instanceof Promise) {
                    value = yield value
                }
            } while(!done && !signal?.aborted && timeout > Date.now())
            return value
        }
    }

    const TASK_REQUIRED = {
        "session_id": 'string'
        , "prompt": 'string'
        , "negative_prompt": 'string'
        , "width": 'number'
        , "height": 'number'
        , "seed": 'number'

        , "sampler": 'string'
        , "use_stable_diffusion_model": 'string'
        , "num_inference_steps": 'number'
        , "guidance_scale": 'number'

        , "num_outputs": 'number'
        , "stream_progress_updates": 'boolean'
        , "stream_image_progress": 'boolean'
        , "show_only_filtered_image": 'boolean'
        , "turbo": 'boolean'
        , "use_full_precision": 'boolean'
        , "output_format": 'string'
    }
    const TASK_DEFAULTS = {
        "sampler": "euler_a"
        , "use_stable_diffusion_model": "sd-v1-4"
        , "num_inference_steps": 50
        , "guidance_scale": 7.5
        , "negative_prompt": ""

        , "num_outputs": 1
        , "stream_progress_updates": true
        , "stream_image_progress": true
        , "show_only_filtered_image": true
        , "turbo": false
        , "use_full_precision": false
        , "output_format": "png"
    }
    const TASK_OPTIONAL = {
        "device": 'string'
        , "init_image": 'string'
        , "mask": 'string'
        , "save_to_disk_path": 'string'
        , "use_face_correction": 'string'
        , "use_upscale": 'string'
        , "use_vae_model": 'string'
    }

    // Higer values will result in...
    // pytorch_lightning/utilities/seed.py:60: UserWarning: X is not in bounds, numpy accepts from 0 to 4294967295
    const MAX_SEED_VALUE = 4294967295

    class RenderTask extends Task {
        constructor(options={}) {
            super(options)
            if (typeof this._reqBody.seed === 'undefined') {
                this._reqBody.seed = Math.floor(Math.random() * (MAX_SEED_VALUE + 1))
            }
            if (typeof typeof this._reqBody.seed === 'number' && (this._reqBody.seed > MAX_SEED_VALUE || this._reqBody.seed < 0)) {
                throw new Error(`seed must be in range 0 to ${MAX_SEED_VALUE}.`)
            }

            if ('use_cpu' in this._reqBody) {
                if (this._reqBody.use_cpu) {
                    this._reqBody.device = 'cpu'
                }
                delete this._reqBody.use_cpu
            }
            if (this._reqBody.init_image) {
                if (typeof this._reqBody.prompt_strength === 'undefined') {
                    this._reqBody.prompt_strength = 0.8
                } else if (typeof this._reqBody.prompt_strength !== 'number') {
                    throw new Error(`prompt_strength need to be of type number but ${typeof this._reqBody.prompt_strength} was found.`)
                }
            }
            if ('modifiers' in this._reqBody) {
                if (Array.isArray(this._reqBody.modifiers) && this._reqBody.modifiers.length > 0) {
                    this._reqBody.modifiers = this._reqBody.modifiers.filter((val) => val.trim())
                    if (this._reqBody.modifiers.length > 0) {
                        this._reqBody.prompt = `${this._reqBody.prompt}, ${this._reqBody.modifiers.join(', ')}`
                    }
                }
                if (typeof this._reqBody.modifiers === 'string' && this._reqBody.modifiers.length > 0) {
                    this._reqBody.modifiers = this._reqBody.modifiers.trim()
                    if (this._reqBody.modifiers.length > 0) {
                        this._reqBody.prompt = `${this._reqBody.prompt}, ${this._reqBody.modifiers}`
                    }
                }
                delete this._reqBody.modifiers
            }
            this.checkReqBody()
        }

        checkReqBody() {
            for (const key in TASK_DEFAULTS) {
                if (typeof this._reqBody[key] === 'undefined') {
                    this._reqBody[key] = TASK_DEFAULTS[key]
                }
            }
            for (const key in TASK_REQUIRED) {
                if (typeof this._reqBody[key] !== TASK_REQUIRED[key]) {
                    throw new Error(`${key} need to be of type ${TASK_REQUIRED[key]} but ${typeof this._reqBody[key]} was found.`)
                }
            }
            for (const key in this._reqBody) {
                if (key in TASK_REQUIRED) {
                    continue
                }
                if (key in TASK_OPTIONAL) {
                    if (typeof this._reqBody[key] !== TASK_OPTIONAL[key]) {
                        throw new Error(`${key} need to be of type ${TASK_OPTIONAL[key]} but ${typeof this._reqBody[key]} was found.`)
                    }
                }
            }
        }

        enqueue(promiseGenerator) {
            if (this.status !== TaskStatus.init) {
                throw new Error('Task has an invalid status to add to queue.')
            }
            if (typeof promiseGenerator === 'undefined') {
                promiseGenerator = RenderTask.start(this)
            }
            if (typeof promiseGenerator === 'function') {
                const result = promiseGenerator.call(this, {})
                if (typeof result === 'object' && (Symbol.asyncIterator in result || Symbol.iterator in result)) {
                    promiseGenerator = result
                } else {
                    promiseGenerator = RenderTask.start(this, promiseGenerator)
                }
            }
            return Task.prototype.enqueue.call(this, promiseGenerator)
        }

        /** Send current task to server.
         * @param {*} [timeout=-1] Optional timeout value in ms
         * @returns the response from the render request.
         * @memberof Task
         */
        async post(timeout=-1) {
            if(this.status !== TaskStatus.init && this.status !== TaskStatus.pending) {
                throw new Error(`Task status ${this.status} is not valid for post.`)
            }
            this._setStatus(TaskStatus.pending)
            Object.freeze(this._reqBody)
            try {
                this.checkReqBody()
            } catch (err) {
                this.abort(err)
                throw err
            }
            const abortSignal = (timeout >= 0 ? AbortSignal.timeout(timeout) : undefined)
            let res = undefined
            do {
                abortSignal?.throwIfAborted()
                res = await fetch('/render', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this._reqBody),
                    signal: abortSignal
                })
                // status_code 503, already a task running.
            } while (res.status === 503 && await asyncDelay(RETRY_DELAY_IF_SERVER_IS_BUSY))
            if (!res.ok) {
                throw new Error(`Unexpected response HTTP${res.status}. Details: ${res.statusText}`)
            }
            const jsonResponse = await res.json()
            if (typeof jsonResponse?.task !== 'number') {
                console.warn('Endpoint error response: ', jsonResponse)
                fireEvent(this, "error", jsonResponse)
                const err = new Error(jsonResponse?.detail || 'Endpoint response does not contains a task ID.')
                this.abort(err)
                throw err
            }
            this._setId(jsonResponse.task)
            if (jsonResponse.stream) {
                this.streamUrl = jsonResponse.stream
            }
            this._setStatus(TaskStatus.waiting)
            return jsonResponse
        }

        *start(progressCallback) {
            if (typeof progressCallback !== 'undefined' && typeof progressCallback !== 'function') {
                throw new Error('progressCallback is not a function. progressCallback type: ' + typeof progressCallback)
            }
            if (this.isStopped) {
                return
            }

            // Post task request to backend
            let renderRequest = undefined
            try {
                renderRequest = yield this.post()
            } catch (e) {
                yield progressCallback?.call(this, { detail: e.message })
                throw e
            }
            try { // Wait for task to start on server.
                yield this.waitUntil({
                    callback: () => progressCallback?.call(this, {})
                    , status: TaskStatus.processing
                })
            } catch (e) {
                this.abort(err)
                throw e
            }
            // Update class status and callback.
            switch(serverState.session) {
                case 'pending': // Session has pending tasks.
                    console.error('Server %o render request %o is still waiting.', serverState, renderRequest)
                    this._setStatus(TaskStatus.waiting) // Waiting in backend.
                    break
                case 'running':
                case 'buffer':
                    // Normal expected messages.
                    this._setStatus(TaskStatus.processing)
                    break
                case 'completed':
                    this._setStatus(TaskStatus.completed)
                    console.warn('Server %o render request %o completed unexpectedly', serverState, renderRequest)
                    break // Continue anyway to try to read cached result.
                case 'error':
                    this._setStatus(TaskStatus.failed)
                    console.error('Server %o render request %o has failed', serverState, renderRequest)
                    break // Still valid, Update UI with error message
                case 'stopped':
                    this._setStatus(TaskStatus.stopped)
                    console.log('Server %o render request %o was stopped', serverState, renderRequest)
                    return false
                default:
                    if (!progressCallback) {
                        const err = new Error('Unexpected server task state: ' + serverState.session || 'Undefined')
                        this.abort(err)
                        throw err
                    }
                    const response = yield progressCallback.call(this, {})
                    if (response instanceof Error) {
                        this.abort(response)
                        throw response
                    }
                    if (!response) {
                        return false
                    }
            }

            // Task started!
            // Open the reader.
            const reader = this.reader
            const task = this
            reader.onError = function(response) {
                if (progressCallback) {
                    task.abort(new Error(response.statusText))
                    return progressCallback.call(task, { response, reader })
                }
                return Task.prototype.onError.call(task, response)
            }
            yield progressCallback?.call(this, { reader })

            //Start streaming the results.
            const streamGenerator = reader.open()
            let value = undefined
            let done = undefined
            yield progressCallback?.call(this, { stream: streamGenerator })
            do {
                ({value, done} = yield streamGenerator.next())
                if (typeof value !== 'object') {
                    continue
                }
                yield progressCallback?.call(this, { update: value })
                //yield progressCallback?.call(this, { value, done })
            } while(!done)
            return value
        }
        static start(task, progressCallback) {
            if (typeof task !== 'object') {
                throw new Error ('task is not an object. task type: ' + typeof task)
            }
            if (!(task instanceof Task)) {
                if (task.reqBody) {
                    task = new RenderTask(task.reqBody)
                } else {
                    task = new RenderTask(task)
                }
            }
            return task.start(progressCallback)
        }
        static run(task, progressCallback) {
            const promiseGenerator = RenderTask.start(task, progressCallback)
            return Task.run(promiseGenerator)
        }
    }

    async function continueTasks() {
        if (task_queue.size <= 0 && concurrent_generators.size <= 0) {
            //setStatus('request', 'done', 'success')
            return await asyncDelay(1000)
        }
        //task._setStatus(TaskStatus.processing)
        //setStatus('request', 'fetching..')
        const completedTasks = []
        for (let [generator, promise] of concurrent_generators.entries()) {
            if (promise.isPending) {
                continue
            }
            if (promise.isRejected) {
                console.error(promise.rejectReason)
                concurrent_generators.delete(generator)
                completedTasks.push(generator)
                continue
            }
            let value = promise.resolvedValue?.value || promise.resolvedValue
            if (value instanceof Promise) {
                promise = makeQuerablePromise(value.then((val) => ({done: promise.resolvedValue?.done, value: val})))
                concurrent_generators.set(generator, promise)
                continue
            }
            weak_results.set(generator, value)
            if (promise.resolvedValue?.done) {
                concurrent_generators.delete(generator)
                completedTasks.push(generator)
                continue
            }

            promise = generator.next(value)
            if (!(promise instanceof Promise)) {
                promise = Promise.resolve(promise)
            }
            promise = makeQuerablePromise(promise)
            concurrent_generators.set(generator, promise)
        }

        const serverCapacity = 2
        if (concurrent_generators.size < serverCapacity) {
            for (let [task, generator] of task_queue.entries()) {
                if (task.hasFailed || task.isCompleted || task.isStopped || completedTasks.includes(generator)) {
                    task_queue.delete(task)
                    continue
                }
                if (concurrent_generators.has(generator)) {
                    continue
                }
                if (!generator && typeof task.start === 'function') {
                    generator = task.start()
                }
                const promise = makeQuerablePromise(Promise.resolve())
                concurrent_generators.set(generator, promise)
            }
        }
        const promises = Array.from(concurrent_generators.values())
        if (promises.length <= 0) {
            return await asyncDelay(1000)
        }
        return await Promise.race(promises)
    }
    let taskPromise = undefined
    function startCheck() {
        if (taskPromise && taskPromise.isRejected) {
            fireEvent(null, 'error', taskPromise.rejectReason)
            taskPromise = makeQuerablePromise(asyncDelay(4000))
        } else if (!taskPromise?.isPending) {
            taskPromise = makeQuerablePromise(continueTasks())
        }
    }

    const SD = {
        ChunkedStreamReader
        , ServerStates
        , TaskStatus
        , Task
        , RenderTask

        , init: async function(options={}) {
            if ('onStatusChange' in options) {
                addEventListener('statusChange', options.onStatusChange)
            }
            await healthCheck()
            setInterval(healthCheck, HEALTH_PING_INTERVAL * 1000)
            setInterval(startCheck, 500)
        }

        /** Add a new event listener
         */
        , addEventListener
        /** Remove the event listener
         */
        , removeEventListener

        , isServerAvailable

        , render: (...args) => RenderTask.run(...args)
        , waitUntil
    };

    Object.defineProperties(SD, {
        serverState: {
            configurable: false
            , get: () => serverState
        }
        , sessionId: {
            configurable: false
            , get: () => sessionId
            , set: (val) => {
                if (typeof val === 'undefined') {
                    throw new Error("Can't set sessionId to undefined.")
                }
                sessionId = val
            }
        }
        , MAX_SEED_VALUE: {
            configurable: false
            , get: () => MAX_SEED_VALUE
        }
        , activeTasks: {
            configurable: false
            , get: () => task_queue
        }
    })
    Object.defineProperties(getGlobal(), {
        SD: {
            configurable: false
            , get: () => SD
        }
        , sessionId: {
            configurable: false
            , get: () => {
                console.warn('Deprecated window.sessionId has been replaced with SD.sessionId.')
                console.trace()
                return SD.sessionId
            }
        }
    })
})()
