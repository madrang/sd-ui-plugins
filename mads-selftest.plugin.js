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
    const VERSION = "2.3.9.1";
    const ID_PREFIX = "madrang-plugin";
    console.log('%s SelfTest! Version: %s', ID_PREFIX, VERSION);

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
        // Add link to Jasmine SpecRunner
        const pluginLink = document.createElement('li');
        const options = {
            'stopSpecOnExpectationFailure': "true"
            , 'stopOnSpecFailure': 'false'
            , 'random': 'false'
            , 'hideDisabled': 'false'
        }
        const optStr = Object.entries(options).map(([key, val]) => `${key}=${val}`).join('&')
        pluginLink.innerHTML = `<a id="${ID_PREFIX}-selftest" href="${location.protocol}/plugins/SpecRunner.html?${optStr}" target="_blank"><i class="fa-solid fa-vial-circle-check"></i> Start SelfTest</a>`;
        links.appendChild(pluginLink);
    })();
})();
