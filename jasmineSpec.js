"use strict";

JASMINE_SESSION_ID = 'jasmine'

beforeEach(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 15 * 60 * 1000; // Test timeout after 15 minutes
    jasmine.addMatchers({
        toBePlaying: function () {
            // demonstrates use of custom matcher
            //expect(player).toBePlaying(song);
            return {
                compare: function (actual, expected) {
                    const player = actual;
                    return {
                        pass: player.currentlyPlayingSong === expected && player.isPlaying
                    };
                }
            };
        }
    });
});
describe('stable-diffusion-ui', function() {
    beforeEach(function() {
        expect(typeof SD).toBe('object')
        expect(typeof SD.serverState).toBe('object')
        expect(typeof SD.serverState.status).toBe('string')
    });
    it('should be able to reach the backend', async function() {
        expect(SD.serverState.status).toBe(SD.ServerStates.unavailable)
        await SD.init();
        expect(SD.isServerAvailable()).toBeTrue();
    });

    it('enfore the current task state', function() {
        const task = new SD.Task()
        expect(task.status).toBe(SD.TaskStatus.init);
        expect(task.isPending).toBeTrue();

        task._setStatus(SD.TaskStatus.pending)
        expect(task.status).toBe(SD.TaskStatus.pending);
        expect(task.isPending).toBeTrue();
        expect(function() {
            task._setStatus(SD.TaskStatus.init)
        }).toThrowError();

        task._setStatus(SD.TaskStatus.waiting)
        expect(task.status).toBe(SD.TaskStatus.waiting);
        expect(task.isPending).toBeTrue();
        expect(function() {
            task._setStatus(SD.TaskStatus.pending)
        }).toThrowError();

        task._setStatus(SD.TaskStatus.processing)
        expect(task.status).toBe(SD.TaskStatus.processing);
        expect(task.isPending).toBeTrue();
        expect(function() {
            task._setStatus(SD.TaskStatus.pending)
        }).toThrowError();

        task._setStatus(SD.TaskStatus.failed)
        expect(task.status).toBe(SD.TaskStatus.failed);
        expect(task.isPending).toBeFalse();
        expect(function() {
            task._setStatus(SD.TaskStatus.processing)
        }).toThrowError();
        expect(function() {
            task._setStatus(SD.TaskStatus.completed)
        }).toThrowError();
    });
    it('should be able to run tasks', async function() {
        expect(typeof SD.Task.run).toBe('function')
        const promiseGenerator = (function*(val) {
            expect(val).toBe('start')
            expect(yield 1 + 1).toBe(4)
            expect(yield 2 + 2).toBe(8)
            yield asyncDelay(500)
            expect(yield 3 + 3).toBe(12)
            expect(yield 4 + 4).toBe(16)
            return 8 + 8
        })('start')
        const callback = function({value, done}) {
            return {value: 2 * value, done}
        }
        expect(await SD.Task.run(promiseGenerator, {callback})).toBe(32)
    });
    it('should be able to queue tasks', async function() {
        expect(typeof SD.Task.enqueue).toBe('function')
        const promiseGenerator = (function*(val) {
            expect(val).toBe('start')
            expect(yield 1 + 1).toBe(4)
            expect(yield 2 + 2).toBe(8)
            yield asyncDelay(500)
            expect(yield 3 + 3).toBe(12)
            expect(yield 4 + 4).toBe(16)
            return 8 + 8
        })('start')
        const callback = function({value, done}) {
            return {value: 2 * value, done}
        }
        const gen = SD.Task.asGenerator({generator: promiseGenerator, callback})
        expect(await SD.Task.enqueue(gen)).toBe(32)
    });
    it('should be able to chain handlers', async function() {
        expect(typeof SD.Task.enqueue).toBe('function')
        const promiseGenerator = (function*(val) {
            expect(val).toBe('start')
            expect(yield {test: '1'}).toEqual({test: '1', foo: 'bar'})
            expect(yield 2 + 2).toEqual(8)
            yield asyncDelay(500)
            expect(yield 3 + 3).toEqual(12)
            expect(yield {test: 4}).toEqual({test: 8, foo: 'bar'})
            return {test: 8}
        })('start')
        const gen1 = SD.Task.asGenerator({generator: promiseGenerator, callback: function({value, done}) {
            if (typeof value === "object") {
                value['foo'] = 'bar'
            }
            return {value, done}
        }})
        const gen2 = SD.Task.asGenerator({generator: gen1, callback: function({value, done}) {
            if (typeof value === 'number') {
                value = 2 * value
            }
            if (typeof value === 'object' && typeof value.test === 'number') {
                value.test = 2 * value.test
            }
            return {value, done}
        }})
        expect(await SD.Task.enqueue(gen2)).toEqual({test:32, foo: 'bar'})
    });
    it('should be able to stream data in chunks', async function() {
        expect(SD.isServerAvailable()).toBeTrue();
        const nbr_steps = 15
        let res = await fetch('/render', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "prompt": "a photograph of an astronaut riding a horse"
                , "negative_prompt": ""
                , "width": 128
                , "height": 128
                , "seed": Math.floor(Math.random() * 10000000)

                , "sampler": "euler_a"
                , "use_stable_diffusion_model": "sd-v1-4"
                , "num_inference_steps": nbr_steps
                , "guidance_scale": 7.5

                , "numOutputsParallel": 1
                , "stream_image_progress": true
                , "show_only_filtered_image": true
                , "output_format": "jpeg"

                //, "session_id": SD.sessionId
                , "session_id": JASMINE_SESSION_ID
            }),
        })
        expect(res.ok).toBeTruthy();
        const renderRequest = await res.json()
        expect(typeof renderRequest.stream).toBe('string')
        expect(renderRequest.task).toBeDefined()

        // Wait for server status to update.
        await SD.waitUntil(() => {
            console.log('Waiting for %s to be received...', renderRequest.task)
            return SD.serverState.task === renderRequest.task
        }, 250, 10 * 60 * 1000)
        // Wait for task to start on server.
        await SD.waitUntil(() => {
            console.log('Waiting for %s to start...', renderRequest.task)
            return SD.serverState.task !== renderRequest.task || SD.serverState.session !== 'pending'
        }, 250)

        const reader = new SD.ChunkedStreamReader(renderRequest.stream)
        const parseToString = reader.parse
        reader.parse = function(value) {
            value = parseToString.call(this, value)
            if (!value || value.length <= 0) {
                return
            }
            return reader.readStreamAsJSON(value.join(''))
        }
        reader.onNext = function({done, value}) {
            console.log(value)
            if (typeof value === 'object' && 'status' in value) {
                done = true
            }
            return {done, value}
        }
        let lastUpdate = undefined
        let stepCount = 0
        let complete = false
        //for await (const stepUpdate of reader) {
        for await (const stepUpdate of reader.open()) {
            console.log('ChunkedStreamReader received ', stepUpdate)
            lastUpdate = stepUpdate
            if (complete) {
                expect(stepUpdate.status).toBe('succeeded');
                expect(stepUpdate.output).toHaveSize(1)
            } else {
                expect(stepUpdate.total_steps).toBe(nbr_steps);
                expect(stepUpdate.step).toBe(stepCount);
                if (stepUpdate.step === stepUpdate.total_steps) {
                    complete = true
                } else {
                    stepCount++
                }
            }
        }
        for(let i=1; i <= 5; ++i) {
            res = await fetch(renderRequest.stream)
            expect(res.ok).toBeTruthy();
            const cachedResponse = await res.json()
            console.log('Cache test %s received %o', i, cachedResponse)
            expect(lastUpdate).toEqual(cachedResponse)
        }
    });

    describe('should be able to make renders', function() {
        beforeEach(function() {
            expect(SD.isServerAvailable()).toBeTrue();
        });
        it('basic inline request', async function() {
            let stepCount = 0
            let complete = false
            const result = await SD.render({
                "prompt": "a photograph of an astronaut riding a horse"
                , "width": 128
                , "height": 128
                , "num_inference_steps": 10
                , "show_only_filtered_image": false
                //, "use_face_correction": 'GFPGANv1.3'
                , "use_upscale": "RealESRGAN_x4plus"
                , "session_id": JASMINE_SESSION_ID
            }, function(event) {
                console.log(this, event)
                if ('update' in event) {
                    const stepUpdate = event.update
                    if (complete) {
                        expect(stepUpdate.status).toBe('succeeded')
                        expect(stepUpdate.output).toHaveSize(2)
                    } else {
                        expect(stepUpdate.step).toBe(stepCount);
                        if (stepUpdate.step === stepUpdate.total_steps) {
                            complete = true
                        } else {
                            stepCount++
                        }
                    }
                }
            })
            console.log(result)
            expect(result.status).toBe('succeeded')
            expect(result.output).toHaveSize(2)
        });
        it('post and reader request', async function() {
            const renderTask = new SD.RenderTask({
                "prompt": "a photograph of an astronaut riding a horse"
                , "width": 128
                , "height": 128
                , "seed": SD.MAX_SEED_VALUE
                , "num_inference_steps": 10
                , "session_id": JASMINE_SESSION_ID
            })
            expect(renderTask.status).toBe(SD.TaskStatus.init)

            const timeout = -1
            const renderRequest = await renderTask.post(timeout)
            expect(typeof renderRequest.stream).toBe('string')
            expect(renderTask.status).toBe(SD.TaskStatus.waiting)
            expect(renderTask.streamUrl).toBe(renderRequest.stream)

            await renderTask.waitUntil({state: SD.TaskStatus.processing, callback: () => console.log('Waiting for render task to start...') })
            expect(renderTask.status).toBe(SD.TaskStatus.processing)

            let stepCount = 0
            let complete = false
            //for await (const stepUpdate of renderTask.reader) {
            for await (const stepUpdate of renderTask.reader.open()) {
                console.log(stepUpdate)
                if (complete) {
                    expect(stepUpdate.status).toBe('succeeded')
                    expect(stepUpdate.output).toHaveSize(1)
                } else {
                    expect(stepUpdate.step).toBe(stepCount);
                    if (stepUpdate.step === stepUpdate.total_steps) {
                        complete = true
                    } else {
                        stepCount++
                    }
                }
            }
            expect(renderTask.status).toBe(SD.TaskStatus.completed)
            expect(renderTask.result.status).toBe('succeeded')
            expect(renderTask.result.output).toHaveSize(1)
        });
        it('queued request', async function() {
            let stepCount = 0
            let complete = false
            const renderTask = new SD.RenderTask({
                "prompt": "a photograph of an astronaut riding a horse"
                , "width": 128
                , "height": 128
                , "num_inference_steps": 10
                , "show_only_filtered_image": false
                //, "use_face_correction": 'GFPGANv1.3'
                , "use_upscale": "RealESRGAN_x4plus"
                , "session_id": JASMINE_SESSION_ID
            })
            await renderTask.enqueue(function(event) {
                console.log(this, event)
                if ('update' in event) {
                    const stepUpdate = event.update
                    if (complete) {
                        expect(stepUpdate.status).toBe('succeeded')
                        expect(stepUpdate.output).toHaveSize(2)
                    } else {
                        expect(stepUpdate.step).toBe(stepCount);
                        if (stepUpdate.step === stepUpdate.total_steps) {
                            complete = true
                        } else {
                            stepCount++
                        }
                    }
                }
            })
            console.log(renderTask.result)
            expect(renderTask.result.status).toBe('succeeded')
            expect(renderTask.result.output).toHaveSize(2)
        });
    });
    describe('#special cases', function() {
        it('should throw an exception on set for invalid sessionId', function() {
            expect(function() {
                SD.sessionId = undefined
            }).toThrowError("Can't set sessionId to undefined.");
        });
        it('should throw an exception on render after more than the active number of gpu is already in progress', function() {
            //expect(function() {
            //    player.resume();
            //}).toThrowError('song is already playing');
            //spyOn(song, 'persistFavoriteStatus');
            //expect(song.persistFavoriteStatus).toHaveBeenCalledWith(true);
        });
    });
});
