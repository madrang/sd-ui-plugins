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
    const VERSION = "2.3.9.2";
    const ID_PREFIX = "madrang-plugin";
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
    let ritaGrammar = undefined;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = `${ID_PREFIX}-surpriseContainer`;
    editorInputs.appendChild(buttonsContainer);

    const surpriseMeButton = document.createElement('button');
    surpriseMeButton.id = `${ID_PREFIX}-surpriseMeButton`;
    surpriseMeButton.innerHTML = `Surprise Me!`;
    surpriseMeButton.title = `V${VERSION}`;
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

    //Load RiTa
    const rita_script = document.createElement('script');
    rita_script.addEventListener('load', async function() {
        RiTa.addTransform('aug', function(words) { // Augment strength of statement.
            return `&#40;${words.trim()}&#41;`;
        });
        RiTa.addTransform('dec', function(words) { // Decrease strength of statement.
            return `&#91;${words.trim()}&#93;`;
        });
        RiTa.addTransform('rnd', function(word) { // Get random words
            // Uses postags - https://rednoise.org/rita/reference/postags.html
            const words = RiTa.randomWord({ pos: getRandomObj(word.split(' ')).trim() });
            return getRandomObj(words);
        });
        RiTa.addTransform('rym', function(words) { // Get random rhymes
            const resultText = [];
            for (const word of words.split(' ')) {
                const res = RiTa.rhymes(word); // get the rhymes
                resultText.append(RiTa.random(res));      // append a random one
            }
            return resultText.join(' ');
        });

        console.log("Loading rita_grammar.json");
        const response = await fetch("/plugins/rita_grammar.json?v=" + VERSION);
        const rules = await response.json();

        ritaGrammar = RiTa.grammar(rules);
        if (promptField.value == DEFAULT_PROMPT) {
            promptField.value = ritaGrammar.expand();
        }
    });
    console.log("Loading rita.js");
    rita_script.src = "/plugins/rita.js?v=" + VERSION;
    document.head.append(rita_script);

    function round_64(val) {
        val = Math.round(val);
        const left = val % 64;
        val = val - left;
        if (left >= 32) {
            return val + 64;
        }
        return val;
    }
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
            newTaskRequest.reqBody.prompt = ritaGrammar.expand();
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
            const options = {};
            const newTaskRequest = buildRequest(options);
            createTask(newTaskRequest);
            initialText.style.display = 'none';
        }
    }
})();
