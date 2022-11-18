/* Madrang's SD-UI Theme Plugin
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
    const VERSION = "2.4.7.1";
    const ID_PREFIX = "madrang-plugin";
    const THEME_KEY = 'theme-mads';
    const THEME_NAME = "Mads Theme";
    if (typeof THEMES !== "object") {
        return
    }
    console.log('%s Theme! Version: %s', ID_PREFIX, VERSION);

    const style = document.createElement('style');
    style.textContent = `
#makeImage:hover {
    background: hsl(var(--accent-hue), var(--accent-saturation-hover), calc(var(--accent-lightness) + 6%));
}
input[type=button]:hover {
    background-color: var(--accent-color-hover);
}
.${THEME_KEY} {
    --main-hue: 0;
    --main-saturation: 50%;
    --value-base: 8%;
    --value-step: 2%;
    --background-color1: hsl(var(--main-hue), var(--main-saturation), var(--value-base));
    --background-color2: hsl(var(--main-hue), var(--main-saturation), calc(var(--value-base) - (1 * var(--value-step))));
    --background-color3: hsl(var(--main-hue), var(--main-saturation), calc(var(--value-base) - (2 * var(--value-step))));
    --background-color4: hsl(var(--main-hue), var(--main-saturation), calc(var(--value-base) - (3 * var(--value-step))));

    --accent-hue: 314;
    --accent-saturation: 50%;
    --accent-lightness: 36%;
    --accent-saturation-hover: 55%;
    --accent-lightness-hover: 36%;
    --accent-color: hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness));
    --accent-color-hover: hsl(var(--accent-hue), var(--accent-saturation-hover), var(--accent-lightness-hover));

    --primary-button-border: none;
    --button-color: var(--accent-color);
    --button-border: none;

    --input-border-size: 1px;
    --input-background-color: var(--background-color3);
    --input-text-color: #FF2B2B;
    --input-border-color: var(--background-color4);
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
    THEMES.push({
        key: THEME_KEY,
        name: THEME_NAME,
        rule: style.sheet.cssRules
    })
    const newThemeOption = document.createElement("option");
    newThemeOption.setAttribute("value", THEME_KEY);
    newThemeOption.innerText = THEME_NAME;
    themeField.appendChild(newThemeOption);

    // Set plugin as current theme.
    themeField.value = THEME_KEY
    themeFieldChanged()
})();
