/* Madrang's SD-UI Surprise Me Plugin.js
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
    const VERSION = "2.4.7.4";
    const ID_PREFIX = "madrang-plugin";
    const RITA_VERSION = "2.8.31.1"
    console.log('%s SurpriseMe! Version: %s', ID_PREFIX, VERSION);

    const style = document.createElement('style');
    style.textContent = `
    #${ID_PREFIX}-surpriseMeButton {
        margin-top: 8px;
    }
`;
    document.head.append(style);
    (function() {
        const links = document.getElementById("community-links");
        if (links && !document.getElementById(`${ID_PREFIX}-link`)) {
            // Add link to plugin repo.
            const pluginLink = document.createElement('li');
            pluginLink.innerHTML = `<a id="${ID_PREFIX}-link" href="${GITHUB_PAGE}" target="_blank"><i class="fa-solid fa-code-merge"></i> Madrang's Plugins on GitHub</a>`;
            links.appendChild(pluginLink);
        }
    })();
    const DEFAULT_PROMPT = "a photograph of an astronaut riding a horse";

    const editorInputs = document.getElementById("editor-inputs");
    const START_RULE = "start";
    let ritaGrammar = undefined;
    let defaultStartRule = undefined;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = `${ID_PREFIX}-surpriseContainer`;
    editorInputs?.appendChild(buttonsContainer);

    const surpriseMeButton = document.createElement('button');
    surpriseMeButton.id = `${ID_PREFIX}-surpriseMeButton`;
    surpriseMeButton.innerHTML = `Surprise Me!`;
    surpriseMeButton.title = `V${VERSION} - Loading...`;
    buttonsContainer.appendChild(surpriseMeButton);
    surpriseMeButton.addEventListener('click', getStartNewTaskHandler());

    const getRandomInt = function (min, max) {
        //The maximum is exclusive and the minimum is inclusive
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    };
    const getRandomObj = function (...args) {
        if (typeof args === "undefined" || !Array.isArray(args) || args.length <= 0) {
            return undefined;
        }
        if (args.length === 1 && Array.isArray(args[0])) {
            // If single item array at pos zero.
            args = args[0];
        }
        return args[getRandomInt(0, args.length)];
    };
    const randomFloat = function(min, max, fixedLen) {
        min = parseFloat(min);
        max = parseFloat(max);
        fixedLen = parseInt(fixedLen);
        return (min + Math.random() * (max - min)).toFixed(fixedLen);
    };

    const parseVersion = function(versionString, options = {}) {
        if (typeof versionString === "undefined") {
            throw new Error("versionString is undefined.");
        }
        if (typeof versionString !== "string") {
            throw new Error("versionString is not a string.");
        }
        const lexicographical = options && options.lexicographical;
        const zeroExtend = options && options.zeroExtend;
        let versionParts = versionString.split('.');
        function isValidPart(x) {
            const re = (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/);
            return re.test(x);
        }

        if (!versionParts.every(isValidPart)) {
            throw new Error("Version string is invalid.");
        }

        if (zeroExtend) {
            while (versionParts.length < 4) {
                versionParts.push("0");
            }
        }
        if (!lexicographical) {
            versionParts = versionParts.map(Number);
        }
        return versionParts;
    };

    const versionCompare = function(v1, v2, options = {}) {
        if (typeof v1 == "undefined") {
            throw new Error("vi is undefined.");
        }
        if (typeof v2 === "undefined") {
            throw new Error("v2 is undefined.");
        }

        let v1parts;
        if (typeof v1 === "string") {
            v1parts = parseVersion(v1, options);
        } else if (Array.isArray(v1)) {
            v1parts = [...v1];
            if (!v1parts.every (p => typeof p === "number" && p !== NaN)) {
                throw new Error("v1 part array does not only contains numbers.");
            }
        } else {
            throw new Error("v1 is of an unexpected type: " + typeof v1);
        }

        let v2parts;
        if (typeof v2 === "string") {
            v2parts = parseVersion(v2, options);
        } else if (Array.isArray(v2)) {
            v2parts = [...v2];
            if (!v2parts.every(p => typeof p === "number" && p !== NaN)) {
                throw new Error("v2 part array does not only contains numbers.");
            }
        } else {
            throw new Error("v2 is of an unexpected type: " + typeof v2);
        }

        while (v1parts.length < v2parts.length) {
            v1parts.push("0");
        }
        while (v2parts.length < v1parts.length) {
            v2parts.push("0");
        }

        for (let i = 0; i < v1parts.length; ++i) {
            if (v2parts.length == i) {
                return 1;
            }
            if (v1parts[i] == v2parts[i]) {
                continue;
            } else if (v1parts[i] > v2parts[i]) {
                return 1;
            } else {
                return -1;
            }
        }
        return 0;
    };

    //Load RiTa
    loadScript("/plugins/user/rita.js?v=" + VERSION).then(async function() {
        if (versionCompare(RITA_VERSION, RiTa.VERSION) < 0) {
            const errMsg = `[RiTa.js V${RiTa.VERSION}] Doesn't match expected version ${RITA_VERSION}!`;
            console.error(errMsg);
            surpriseMeButton.title = `SurpriseMe V${VERSION} - ${errMsg}`;
            surpriseMeButton.style.backgroundColor = '#DD0000';
        }
        RiTa.addTransform('aug', function(words) { // Augment strength of statement.
            return `&#40;${words.trim()}&#41;`;
        });
        RiTa.addTransform('dec', function(words) { // Decrease strength of statement.
            return `&#91;${words.trim()}&#93;`;
        });

        RiTa.addTransform('cnv', function(words) { // Conjugate Verb.
            const tokens = RiTa.tokenize(words);
            const options = {
                tense: RiTa.PRESENT
                , number: RiTa.SINGULAR
                , person: RiTa.THIRD
            };
            let verb = 'swim';
            for (token of tokens) {
                //  a r u  options.tense:    [RiTa.PAST, RiTa.PRESENT, or RiTa.FUTURE]
                //   s p   options.number:   [RiTa.SINGULAR or RiTa.PLURAL]
                //  i e h  options.person:   [RiTa.FIRST, RiTa.SECOND or RiTa.THIRD]
                //   n g   options.form:     [RiTa.INFINITIVE or RiTa.GERUND]
                //    A    options.passive        {boolean}
                //    R    options.progressive    {boolean}
                //    N    options.interrogative  {boolean}
                //    E    options.perfect        {boolean}
            }
            RiTa.conjugate(verb, options);
        });

        const reRndNums = /(\d+|\d+\.\d+)(?:\\|\/)(\d+|\d+\.\d+)\:(\d+)/;
        RiTa.addTransform('rnd', function(words) { // Get a random words.
            const match = reRndNums.exec(words);
            if (match) {
                return `${randomFloat(match[1], match[2], match[3])}`
            }
            // Uses postags - https://rednoise.org/rita/reference/postags.html
            const wTokens = RiTa.tokenize(words);
            const rndWords = RiTa.randomWord({ pos: getRandomObj(wTokens) });
            return getRandomObj(rndWords);
        });
        const isNumbersRe = new RegExp('^\\d+$');
        RiTa.addTransform('rym', function(words) { // Replace words by random rhymes.
            const tokens = RiTa.tokenize(words);
            let stride = 1;
            if (tokens.length > 0 && isNumbersRe.test(tokens[0])) {
                const elm = tokens.shift();
                stride = parseInt(elm);
            }
            const resultText = [];
            let count = stride;
            for (const token of tokens) {
                if (RiTa.isPunct(token)) {
                    resultText.append(token);
                    continue;
                }
                count--;
                if (count > 0) {
                    resultText.append(token);
                    continue;
                }
                count = stride;
                const rhymes = RiTa.rhymes(token);
                resultText.append(getRandomObj(rhymes));
            }
            return RiTa.untokenize(resultText);
        });
        try{
            console.log("Loading rita_grammar.json");
            const response = await fetch("/plugins/user/rita_grammar.json?v=" + Date.now());
            const rules = await response.json();
            ritaGrammar = RiTa.grammar(rules);
            defaultStartRule = rules[START_RULE];

            const grammarVersion = ritaGrammar.expand('version');
            if (!grammarVersion) {
                const errMsg = `[RiTa.js V${RITA_VERSION}] No grammar version found!`;
                console.error(errMsg);
                surpriseMeButton.title = `SurpriseMe V${VERSION} - ${errMsg}`;
                surpriseMeButton.style.backgroundColor = '#DD0000';
            } else if (versionCompare(RITA_VERSION, grammarVersion) < 0) {
                const msg = `[RiTa.js V${RITA_VERSION}] Grammar ${grammarVersion} version mismatch.`;
                console.warn(msg);
                surpriseMeButton.title = `SurpriseMe V${VERSION} - ${msg}`;
                surpriseMeButton.style.backgroundColor = '#DDDD00';
            } else {
                const msg = `[RiTa.js V${RITA_VERSION}] Grammar version: ${grammarVersion}`;
                console.log(msg);
                surpriseMeButton.title = `SurpriseMe V${VERSION} - ${msg}`;
            }

            if (typeof promptField !== 'object' || promptField.value !== DEFAULT_PROMPT) {
                return;
            }
            promptField.value = ritaGrammar.expand(START_RULE);
        } catch(e) {
            surpriseMeButton.innerHTML = `ERR: Invalid grammar!`;
            surpriseMeButton.title = `Make sure that rita_grammar.json is present and valid.`;
            surpriseMeButton.disabled = true;
            console.error(e);
        }
    }, function(error) {
        surpriseMeButton.innerHTML = `ERR: Missing rita!`;
        surpriseMeButton.title = `Make sure that rita.js is present and valid.`;
        surpriseMeButton.disabled = true;
    });

    function buildRequest(options = {}) {
        const newTaskRequest = modifyCurrentRequest(getCurrentUserRequest().reqBody, { //TODO remove getCurrentUserRequest after is fixed upstream.
            session_id: sessionId
        });
        //newTaskRequest.reqBody.num_outputs = options.parallel || 1;
        //newTaskRequest.numOutputsTotal = Math.max(newTaskRequest.reqBody.num_outputs, options.totalOutputs || 1);
        //newTaskRequest.batchCount = Math.ceil(newTaskRequest.numOutputsTotal / newTaskRequest.reqBody.num_outputs);
        if ('prompt' in options) {
            newTaskRequest.reqBody.prompt = options.prompt;
        } else {
            newTaskRequest.reqBody.prompt = ritaGrammar.expand(START_RULE);
        }
        //newTaskRequest.reqBody.sampler = 'euler_a';
        //newTaskRequest.reqBody.sampler = 'ddim';
        //if ('guidance_scale' in options) {
        //    newTaskRequest.reqBody.guidance_scale = options.guidance_scale;
        //}
        //newTaskRequest.reqBody.width = options.width || round_64(512);
        //newTaskRequest.reqBody.height = options.height || round_64(512);
        //newTaskRequest.reqBody.num_inference_steps = Math.min(100, options.num_inference_steps || Math.round(50));
        return newTaskRequest;
    }
    function getStartNewTaskHandler() {
        return async function(event) {
            //const options = await showPopup(mode, reqBody);
            //if (options.cancelled) {
            //    return;
            //}
            const prompt = promptField?.value;
            if (prompt && prompt.startsWith("$")) {
                ritaGrammar.addRule(START_RULE, prompt.slice(1));
            } else {
                ritaGrammar.addRule(START_RULE, defaultStartRule);
            }

            const options = {};
            const newTaskRequest = buildRequest(options);
            createTask(newTaskRequest);
            initialText.style.display = 'none';
        }
    }

    // Register selftests when loaded by jasmine.
    if (typeof PLUGINS?.SELFTEST === 'object') {
        PLUGINS.SELFTEST[ID_PREFIX + " surprise"] = function() {
            it('should be able to run a test...', function() {
                expect(function() {
                    SD.sessionId = undefined
                }).toThrowError("Can't set sessionId to undefined.")
            })
        }
    }
})();
