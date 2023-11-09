/*    Plugin Manager
 *    by Patrice, Madrang
 *    @version 3.0.3.2
 *
 *    A simple plugin manager with a search box, that installs and auto updates plugins from GitHub.
 *
 *    Devs, please feel free to add your plugins to the catalog at: https://github.com/patriceac/Easy-Diffusion-Plugins
 *    Mandatory fields to add a plugin to the plugin catalog are: id, name, url. All other fields are optional.
 */
(function () { "use strict"
    if (document.getElementById("tab-content-plugin")) {
        console.log('Plugin Manager already running, do not reload.');
        return;
    }

    const VERSION = "3.0.3.1";
    const GITHUB_CREATE_REPOSITORY = 'https://github.com/madrang/sd-ui-plugins/blob/master/CreateRepository.md';

    const PLUGIN_MAX_NOTIFICATIONS = 50;

    // localStorage keys
    const PLUGIN_LAST_UPDATES = "plugin-manager_lastUpdates";

    // Style.css
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        .plugins-table {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .plugins-table > div {
            background: var(--background-color2);
            display: flex;
            padding: 0px 4px;
        }

        .plugins-table > div > div {
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .plugins-table small {
            color: rgb(153, 153, 153);
        }

        .plugins-table > div > div:nth-child(1) {
            font-size: 20px;
            width: 45px;
        }

        .plugins-table > div > div:nth-child(2) {
            flex: 1;
            flex-direction: column;
            text-align: left;
            justify-content: center;
            align-items: start;
            gap: 4px;
        }

        .plugins-table > div > div:nth-child(3) {
            text-align: right;
        }

        .plugins-table > div:first-child {
            border-radius: 12px 12px 0px 0px;
        }

        .plugins-table > div:last-child {
            border-radius: 0px 0px 12px 12px;
        }

        .notifications-table {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .notifications-table > div {
            background: var(--background-color2);
            display: flex;
            padding: 0px 4px;
        }

        .notifications-table > div > div {
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .notifications-table small {
            color: rgb(153, 153, 153);
        }

        .notifications-table > div > div:nth-child(1) {
            flex: 1;
            flex-direction: column;
            text-align: left;
            justify-content: center;
            align-items: start;
            gap: 4px;
        }

        .notifications-table > div > div:nth-child(2) {
            width: auto;
        }

        .notifications-table > div:first-child {
            border-radius: 12px 12px 0px 0px;
        }

        .notifications-table > div:last-child {
            border-radius: 0px 0px 12px 12px;
        }

        .notification-error {
            color: red;
        }
        
        DIV.no-notification {
            padding-top: 16px;
            font-style: italic;
        }

        .plugin-manager-intro {
            margin: 0 0 16px 0;
        }

        #plugin-filter {
            box-sizing: border-box;
            width: 100%;
            margin: 4px 0 6px 0;
            padding: 10px;
        }

        #plugins-actions {
            box-sizing: border-box;
            width: 100%;
            padding: 0px;
        }

        #plugins-actions a {
            cursor: pointer;
        }

        #plugins-actions a:active {
            transition-duration: 0.1s;
            position: relative;
            top: 1px;
            left: 1px;
        }

        .plugin-installed-locally {
            font-style: italic;
            font-size: small;
        }

        .plugin-source {
            font-size: x-small;
        }

        .plugin-warning {
            color: orange;
            font-size: smaller;
        }

        .plugin-warning.hide {
            display: none;
        }

        .plugin-warning ul {
            list-style: square;
            margin: 0 0 8px 16px;
            padding: 0;
        }

        .plugin-warning li {
            margin-left: 8px;
            padding: 0;
        }

        /* MODAL DIALOG */
        #custom-plugin-dialog {
            width: 80%;
            height: 80%;
            background: var(--background-color2);
            border: solid 1px var(--background-color3);
            border-radius: 6px;
            box-shadow: 0px 0px 30px black;
        }

        .custom-plugin-dialog-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
        }

        .custom-plugin-dialog-header h2 {
            margin: 0;
        }

        .custom-plugin-dialog-close-button {
            font-size: 24px;
            font-weight: bold;
            line-height: 1;
            border: none;
            background-color: transparent;
            cursor: pointer;
        }

        .custom-plugin-dialog-close-button:hover {
            color: #555;
        }

        .custom-plugin-dialog-content {
            padding: 0 16px 0 16px;
            height: 80%;
        }

        .custom-plugin-dialog-content textarea {
            width: 100%;
            height: 90%;
            border-radius: var(--input-border-radius);
            padding: 4px;
            accent-color: var(--accent-color);
            background: var(--input-background-color);
            border: var(--input-border-size) solid var(--input-border-color);
            color: var(--input-text-color);
            font-size: 9pt;
            resize: none;
        }

        .custom-plugin-dialog-buttons {
            display: flex;
            justify-content: flex-end;
            padding: 16px;
        }

        .custom-plugin-dialog-buttons button {
            margin-left: 8px;
            padding: 8px 16px;
            font-size: 16px;
            border-radius: 4px;
            /*background: var(--accent-color);*/
            /*border: var(--primary-button-border);*/
            /*color: rgb(255, 221, 255);*/
            background-color: #3071a9;
            border: none;
            cursor: pointer;
        }

        .custom-plugin-dialog-buttons button:hover {
            /*background: hsl(var(--accent-hue), 100%, 50%);*/
            background-color: #428bca;
        }

        /* NOTIFICATION CENTER */
        #plugin-notification-button {
            float: right;
            margin-top: 30px;
        }

        #plugin-notification-button:hover {
            background: unset;
        }

        #plugin-notification-button:active {
            transition-duration: 0.1s;
            position: relative;
            top: 1px;
            left: 1px;
        }

        .plugin-notification-pill {
            background-color: red;
            border-radius: 50%;
            color: white;
            font-size: 10px;
            font-weight: bold;
            height: 12px;
            line-height: 12px;
            position: relative;
            right: -8px;
            text-align: center;
            top: -20px;
            width: 12px;
        }
    `;
    document.head.appendChild(styleSheet);

    loadScript("/plugins/user/plugin-manager-database.js").then(function () {
        let PLUGIN_MODE = "local";

        /* plugin tab */
        //document.querySelector('.tab-container #tab-news')?.insertAdjacentHTML('beforebegin', `
        document.querySelector('.tab-container')?.insertAdjacentHTML('beforeend'
            , `<span id="tab-plugin" class="tab">
                <span><i class="fa fa-puzzle-piece icon"></i> Plugins</span>
            </span>`
        );
        document.querySelector('#tab-content-wrapper')?.insertAdjacentHTML('beforeend'
            , `<div id="tab-content-plugin" class="tab-content">
                <div id="plugin-manager" class="tab-content-inner">
                    <i id="plugin-notification-button" class="fa-solid fa-message">
                        <span class="plugin-notification-pill" id="notification-pill" style="display: none">!</span>
                    </i>
                    <div id="plugin-notification-list" style="display: none">
                        <h1>Notifications</h1>
                        <div class="plugin-manager-intro">The latest plugin updates are listed below</div>
                        <div class="notifications-table"></div>
                        <div class="no-notification">No new notifications</div>
                    </div>
                    <div id="plugin-manager-section">
                        <h1>Plugin Manager</h1>
                        <div class="plugin-manager-intro">Changes take effect after reloading the page</div>
                        <input type="text" id="plugin-filter" placeholder="Search for..." autocomplete="off"/>
                        <div class="plugins-table"></div>
                        <p id="plugins-actions"><small><a id="refresh-plugins-link">Refresh plugins</a> / <a id="add-plugin-link">Add local plugin</a></small></p>
                        <p><small>(Plugin developers, see <a href='${GITHUB_CREATE_REPOSITORY}' target='_blank'>CreateRepository.md</a> on github to setup your own repository.)</small></p>
                    </div>
                </div>
                <dialog id="custom-plugin-dialog">
                    <div class="custom-plugin-dialog-header">
                        <h2>Paste the plugin's code here</h2>
                        <button class="custom-plugin-dialog-close-button">&times;</button>
                    </div>
                    <div class="custom-plugin-dialog-content">
                        <textarea id="plugin-dialog-input-textarea" spellcheck="false" autocomplete="off"></textarea>
                    </div>
                    <div class="custom-plugin-dialog-buttons">
                        <button id="plugin-dialog-input-ok">OK</button>
                        <button id="plugin-dialog-input-cancel">Cancel</button>
                    </div>
                </dialog>
            </div>`
        );

        const EasyDiffusionVersion = extractVersionNumber(document.querySelector('#top-nav > #logo'));

        const tabPlugin = document.querySelector('#tab-plugin');
        if (tabPlugin) {
            linkTabContents(tabPlugin);
        }

        const pluginsTable = document.querySelector("#plugin-manager-section .plugins-table");
        const pluginNotificationTable = document.querySelector("#plugin-notification-list .notifications-table");
        const pluginNoNotification = document.querySelector("#plugin-notification-list .no-notification");

        /* notification center */
        const pluginNotificationButton = document.getElementById("plugin-notification-button");
        const pluginNotificationList = document.getElementById("plugin-notification-list");
        const notificationPill = document.getElementById("notification-pill");
        const pluginManagerSection = document.getElementById("plugin-manager-section");

        // Add event listener to show/hide the action center
        pluginNotificationButton.addEventListener("click", async function () {
            // Hide list if already displayed.
            if (pluginNotificationList.style.display != "none") {
                pluginNotificationList.style.display = "none";
                pluginManagerSection.style.display = "block";
                return;
            }
            // Show list and hide manager.
            pluginNotificationList.style.display = "block";
            pluginManagerSection.style.display = "none";
            // Hide the notification pill when the action center is opened
            notificationPill.style.display = "none";
            // Update content
            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            const notifications = await idb_selectData(PLUGIN_DB, 'notifications', (val) => val);
            notifications.sort((a, b) => b.date - a.date);
            renderPluginNotifications(notifications);
            // Remove all unread flags and save.
            notifications.forEach((n) => delete n.unread);
            await idb_putData(PLUGIN_DB, "notifications", ...notifications);
        });

        document.addEventListener("tabClick", (e) => {
            if (e.detail.name == 'plugin') {
                // Restore default layout
                pluginNotificationList.style.display = "none";
                pluginManagerSection.style.display = "block";

                pluginFilter.value = "";
                filterPlugins();
            }
        });

        function createNotificationElement(notification) {
            const newRow = document.createElement('div');
            newRow.innerHTML = `
                <div${notification.error ? ' class="notification-error"' : ''}>${notification.text}</div>
                <div><small>${timeAgo(notification.date)}</small></div>
            `;
            return newRow;
        }

        function renderPluginNotifications(notifications) {
            if (!Array.isArray(notifications)) {
                throw new Error("notifications must be an array.");
            }
            pluginNotificationTable.replaceChildren(...notifications.map(createNotificationElement));
            if (pluginNotificationTable.childElementCount > 0) {
                pluginNoNotification.style.display = "none";
                pluginNotificationTable.style.display = "block";
            } else {
                pluginNoNotification.style.display = "block";
                pluginNotificationTable.style.display = "none";
            }
        }

        /* search box */
        function filterPlugins() {
            let search = pluginFilter.value.toLowerCase();
            let searchTerms = search.split(' ');
            let labels = pluginsTable.querySelectorAll("label.plugin-name");

            for (let i = 0; i < labels.length; i++) {
                let label = labels[i].innerText.toLowerCase();
                let match = true;

                for (let j = 0; j < searchTerms.length; j++) {
                    let term = searchTerms[j].trim();
                    if (term && label.indexOf(term) === -1) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    labels[i].closest('.plugin-container').style.display = "flex";
                } else {
                    labels[i].closest('.plugin-container').style.display = "none";
                }
            }
        }

        const pluginFilter = document.getElementById("plugin-filter"); // search box

        // Add the debounced function to the keyup event listener
        pluginFilter.addEventListener('keyup', debounce(filterPlugins, 250));

        // select the text on focus
        pluginFilter.addEventListener('focus', function (event) {
            pluginFilter.select()
        });

        // empty the searchbox on escape
        pluginFilter.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                pluginFilter.value = '';
                filterPlugins();
            }
        });

        // focus on the search box upon tab selection
        document.addEventListener("tabClick", (e) => {
            if (e.detail.name == 'plugin') {
                pluginFilter.focus()
            }
        })

        // refresh link
        const refreshPlugins = document.getElementById("refresh-plugins-link");
        refreshPlugins.addEventListener("click", async function (event) {
            event.preventDefault();
            await initPlugins(true);
        });

        function showPluginToast(message, duration = 5000, error = false, addNotification = true) {
            if (error) {
                console.error(message);
            } else {
                console.log(message);
            }
            if (addNotification) {
                addPluginNotification(message, error);
                notificationPill.style.display = "block";
            }
            try {
                showToast(message, duration, error)
            } catch (error) {
                console.error('Error while trying to show toast:', error);
            }
        }

        function matchPluginFileNames(fileName1, fileName2) {
            const regex = /^(.+?)(?:-\d+(\.\d+)*)?\.plugin\.js$/;
            const match1 = fileName1.match(regex);
            const match2 = fileName2.match(regex);

            if (match1 && match2 && match1[1] === match2[1]) {
                return true; // the two file names match
            } else {
                return false; // the two file names do not match
            }
        }

        function checkFileNameInArray(paths, filePath) {
            // Strip off the path from the file name
            const fileName = extractFilename(filePath);
            // Check if the file name exists in the array of paths
            return paths.some((path) => matchPluginFileNames(fileName, extractFilename(path)));
        }

        /* PLUGIN MANAGEMENT */

        /* fill in the plugins table */
        async function initPluginTable(plugins) {
            const getIncompatiblePlugins = function (pluginId) {
                const enabledPlugins = plugins.filter(plugin => plugin.enabled && plugin.id !== pluginId);
                const incompatiblePlugins = enabledPlugins.filter(plugin => plugin.compatIssueIds?.includes(pluginId));
                const pluginNames = incompatiblePlugins.map(plugin => plugin.name);
                if (pluginNames.length === 0) {
                    return null;
                }
                const pluginNamesList = pluginNames.map(name => `<li>${name}</li>`).join('');
                return `<ul>${pluginNamesList}</ul>`;
            };
            console.debug("initPluginTable", plugins);
            plugins.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            pluginsTable.replaceChildren(...plugins.map(plugin => {
                let htmlTitle = plugin.name;
                if (plugin.author) {
                    htmlTitle = `${htmlTitle}, by ${plugin.author}`;
                }
                if (plugin.version) {
                    htmlTitle = `${htmlTitle} (version: ${plugin.version})`;
                }
                let htmlWarning = "";
                const incompatiblePlugins = getIncompatiblePlugins(plugin.id);
                if (incompatiblePlugins) {
                    htmlWarning = `<span class="plugin-warning${plugin.enabled ? '' : ' hide'}">This plugin might conflict with:${incompatiblePlugins}</span>`;
                }
                let htmlNote = `<small>No description</small>`;
                if (plugin.description) {
                    htmlNote = `<small>${plugin.description.replaceAll('\n', '<br>')}</small>`;
                }
                let htmlIcon = '<i class="fa fa-puzzle-piece"></i>';
                if (plugin.icon) {
                    htmlIcon = `<i class="fa ${plugin.icon}"></i>`;
                }
                let htmlButton = "";
                if (plugin.updatePending) {
                    htmlButton = `<span class="plugin-update-available">Update Available!</span>`;
                } else if (plugin.installedLocally) {
                    htmlButton = `<span class="plugin-installed-locally">Installed locally</span>`;
                } else if (plugin.localInstallOnly) {
                    htmlButton = `<span class="plugin-installed-locally">Download and<br />install manually</span>`;
                } else if (isTrustedSourceUrl(plugin.url)) {
                    htmlButton = `<input id="plugin-${plugin.id}" name="plugin-${plugin.id}" type="checkbox">`;
                } else {
                    htmlButton = `<button id="plugin-${plugin.id}-install" class="tertiaryButton"></button>`;
                }
                const pluginContainerElement = document.createElement("div");
                pluginContainerElement.innerHTML = `<!--Plugin ${plugin.id} Entry-->
                    <div>${htmlIcon}</div>
                    <div><!--Main Plugin Description-->
                        <label class="plugin-name">${htmlTitle}</label>
                        ${htmlWarning}
                        ${htmlNote}
                        <span class='plugin-source'>Source: <a href="${plugin.url}" target="_blank">${extractFilename(plugin.url)}</a></span>
                    </div>
                    <!--Enable or Download update Button-->
                    <div>${htmlButton}</div>
                `;
                pluginContainerElement.classList.add("plugin-container");
                //console.log(plugin.id, plugin.localInstallOnly);
                const pluginManualInstall = pluginContainerElement.querySelector(`#plugin-${plugin.id}-install`);
                updateManualInstallButtonCaption();

                // checkbox event handler
                const pluginToggle = pluginContainerElement.querySelector(`#plugin-${plugin.id}`);
                if (pluginToggle) {
                    pluginToggle.checked = plugin.enabled; // set initial state of checkbox
                    pluginToggle.addEventListener("change", async () => {
                        const container = pluginToggle.closest(".plugin-container");
                        const warningElement = container.querySelector(".plugin-warning");

                        // if the plugin got enabled, download the plugin's code
                        plugin.enabled = pluginToggle.checked;
                        if (plugin.enabled) {
                            const wasEnabled = await enablePlugin(plugin);
                            if (wasEnabled) {
                                // Show warning if there is one.
                                warningElement?.classList.remove("hide");
                                showPluginToast(`Plugin ${plugin.name} installed`);
                            } else {
                                console.error("Couldn't enable plugin", plugin);
                                pluginToggle.checked = false;
                                showPluginToast(`Failed to load ${plugin.name} (Couldn't fetch ${getPluginEntryPointFile(plugin)})`, 5000, true);
                            }
                        } else {
                            warningElement?.classList.add("hide");
                            disablePlugin(plugin);
                            showPluginToast(`Plugin ${plugin.name} disabled`);
                        }
                    });
                }

                // manual install event handler
                pluginManualInstall?.addEventListener("click", async () => {
                    showPopup().then((popupResult) => {
                        if (popupResult?.returnValue !== POPUP_OK) {
                            return;
                        }
                        popupResult.response
                    }, (reason) => {});
                    pluginDialogOpenDialog(inputOK, inputCancel)
                    pluginDialogTextarea.value = plugin.code ? plugin.code : '';
                    pluginDialogTextarea.select();
                    pluginDialogTextarea.focus();
                });
                // Dialog OK
                async function inputOK() {
                    let pluginSource = pluginDialogTextarea.value
                    // remove empty lines and trim existing lines
                    //plugin.code = pluginSource
                    if (pluginSource.trim()) {
                        plugin.enabled = true
                        showPluginToast(`Plugin ${plugin.name} installed`);
                    } else {
                        plugin.enabled = false
                        showPluginToast(`No code provided for plugin ${plugin.name}, disabling the plugin`);
                    }
                    updateManualInstallButtonCaption()
                    await setStorageData('plugins', JSON.stringify(plugins))
                }
                // Dialog Cancel
                async function inputCancel() {
                    plugin.enabled = false
                    console.log(`Installation of plugin ${plugin.name} cancelled`);
                    showPluginToast("Cancelled installation of " + plugin.name);
                }
                // update button caption
                function updateManualInstallButtonCaption() {
                    if (pluginManualInstall) {
                        pluginManualInstall.innerHTML = (!plugin.code ? "Install" : "Edit");
                    }
                }

                return pluginContainerElement;
            }));
            prettifyInputs(pluginsTable);
            filterPlugins();
        }

        async function enablePlugin(plugin) {
            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            const pluginsSettings = await idb_getData(PLUGIN_DB, "settings", "plugins");
            if (!Array.isArray(pluginsSettings.installed)) {
                pluginsSettings.installed = [];
            }
            const idx = pluginsSettings.installed.findIndex((p) => p.id == plugin.id);
            const installedPlugin = pluginsSettings.installed[idx];
            if (installedPlugin?.enabled) {
                console.warn("Plugin already enabled.");
                return true;
            }
            // Enable plugin
            if (installedPlugin) {
                pluginsSettings.installed[idx] = plugin;
            } else {
                pluginsSettings.installed.push(plugin);
            }
            await idb_putData(PLUGIN_DB, "settings", pluginsSettings);
            // Update and load plugin content
            await updatePlugin(plugin);
            return await loadPlugins(plugin);
        }
        async function disablePlugin(plugin) {
            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            const pluginsSettings = await idb_getData(PLUGIN_DB, "settings", "plugins");
            if (!Array.isArray(pluginsSettings.installed)) {
                pluginsSettings.installed = [];
            }
            pluginsSettings.installed.filter((p) => p.id == plugin.id).forEach((p) => p.enabled = false);
            await idb_putData(PLUGIN_DB, "settings", pluginsSettings);
            //TODO Show warning to reload the page.
        }
        async function removePlugin(plugin) {
            await disablePlugin(plugin);
            //TODO Warn and delete files...
        }

        async function checkNewNotifications() {
            // load the notifications
            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            const notifications = await idb_selectData(PLUGIN_DB, "notifications", (val) => val);
            if (notifications?.length && notifications.some((n) => n.unread)) {
                // Display pill when new unread
                notificationPill.style.display = "block";
            }
            // limit array length to PLUGIN_MAX_NOTIFICATIONS entries
            if (notifications.length > PLUGIN_MAX_NOTIFICATIONS) {
                notifications.sort((a, b) => b.date - a.date);
                const removed = notifications.splice(PLUGIN_MAX_NOTIFICATIONS);
                await idb_deleteData(PLUGIN_DB, "notifications", ...removed.map(n => n.id));
            }
        }

        const initPlugins = debounce(async (refreshPlugins = false) => {
            checkNewNotifications();

            if (refreshPlugins && refreshAllowed()) {
                try {
                    await updateRepository({ name: PLUGIN_CATALOG_FILE
                        , url: PLUGIN_ROOT + PLUGIN_CATALOG_FILE
                        , noCache: true
                    }, {
                        defaultCatalogName: PLUGIN_CATALOG_FILE
                    });
                } catch (error) {
                    console.error(error);
                }
            } else if (refreshPlugins) {
                showPluginToast('Plugins have been refreshed recently, refresh will be available in ' + convertSeconds(getTimeUntilNextRefresh()), 5000, true, false);
            }

            let pluginCatalog = await getPluginRepositoryCatalog(PLUGIN_CATALOG_FILE);
            if (!Array.isArray(pluginCatalog)) {
                throw new Error("Missing plugin catalog.");
            }

            const localPlugins = await getLocalPlugins();
            for (const plugin of pluginCatalog) {
                const pluginFileName = getPluginEntryPointFile(plugin);
                if (pluginFileName && !checkFileNameInArray(localPlugins, pluginFileName)) {
                    continue; // Ignore plugins that aren't locally installed
                }
                plugin.installedLocally = true;
                if (plugin.id == "plugin-manager") {
                    try {
                        plugin.updatePending = await updatePlugin(plugin, { dryRun: true
                            , getContent: async (contentDescriptor) => {
                                const response = await fetch(PLUGIN_ROOT + contentDescriptor.name);
                                if (!response.ok) {
                                    console.error(`Failed checking for updates for ${contentName} HTTP${response.status} error! status: ${response.statusText}`);
                                    return undefined;
                                }
                                return {
                                    name: contentDescriptor.name
                                    , content: await response.blob()
                                    , type: contentDescriptor.type
                                    //, timestamp: //TODO
                                };
                            }
                            //, onNewContent
                        });
                    } catch (error) {
                        console.error(error);
                    }
                }
            }

            // Disable plugins that don't meet the min ED version requirement
            pluginCatalog = filterPluginsByMinEDVersion(pluginCatalog, EasyDiffusionVersion);
            // update compatIssueIds
            updateCompatIssueIds(pluginCatalog);

            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            // try and load plugins from local cache
            const pluginsSettings = await idb_getData(PLUGIN_DB, "settings", "plugins");
            const installedPlugins = pluginsSettings?.installed || [];
            // Add installed plugins no longer in repositories.
            if (Array.isArray(installedPlugins) && installedPlugins.length > 0) {
                const missingPlugins = pluginsSettings.installed.filter((plugin) => !pluginCatalog.some((p) => p.id === plugin.id));
                missingPlugins.forEach((plugin) => plugin.repositoryMissing = true);
                pluginCatalog.push(...missingPlugins);
            }

            const enabledPlugins = installedPlugins.filter((p) => p.enabled);
            pluginCatalog.filter((plugin) => {
                return enabledPlugins.some((p) => plugin.id == p.id);
            }).forEach((plugin) => {
                plugin.enabled = true;
            });

            await idb_putData(PLUGIN_DB, "settings", {
                sectionName: "plugins"
                , installed: installedPlugins
                , lastAvailable: pluginCatalog.map((plugin) => plugin.id)
            });

            if (Array.isArray(pluginsSettings?.lastAvailable)) {
                // Show toast for new plugins.
                pluginCatalog.filter((plugin) => {
                    return !pluginsSettings.lastAvailable.some((id) => plugin.id == id);
                }).forEach(async (plugin, index) => {
                    await asyncDelay(index * 1000);
                    showPluginToast(`New plugin "${plugin.name}" is available.`);
                });
            }
            // refresh the display of the plugins table
            initPluginTable(pluginCatalog);
            loadPlugins(enabledPlugins);
        }, 1000, true);

        function updateMetaTagPlugins(plugin) {
            // Update the meta tag with the list of loaded plugins
            let metaTag = document.querySelector('meta[name="plugins"]');
            if (!metaTag) {
                metaTag = document.createElement('meta');
                metaTag.name = "plugins";
                document.head.appendChild(metaTag);
            }
            if (metaTag.content) {
                metaTag.content = `${metaTag.content}, ${plugin.id}`;
            } else {
                metaTag.content = plugin.id;
            }
        }
        function isPluginLoaded(pluginID) {
            let metaTag = document.querySelector('meta[name="plugins"]');
            if (!metaTag || !metaTag.content) {
                return false;
            }
            return metaTag.content.split(',').map(s => s.trim()).some(s => s == pluginID);
        }

        function updateCompatIssueIds(plugins, plugin) {
            if (plugin == undefined) {
                // Loop through each plugin
                plugins.forEach(p => updateCompatIssueIds(plugins, p));
                return;
            }

            // Check if the plugin has `compatIssueIds` property
            if (plugin.compatIssueIds) {
                // Loop through each of the `compatIssueIds`
                plugin.compatIssueIds.forEach(issueId => {
                    // Find the plugin with the corresponding `issueId`
                    const issuePlugin = plugins.find(p => p.id === issueId);
                    // If the corresponding plugin is found, initialize its `compatIssueIds` property with an empty array if it's undefined
                    if (issuePlugin) {
                        if (!issuePlugin.compatIssueIds) {
                            issuePlugin.compatIssueIds = [];
                        }
                        // If the current plugin's ID is not already in the `compatIssueIds` array, add it
                        if (!issuePlugin.compatIssueIds.includes(plugin.id)) {
                            issuePlugin.compatIssueIds.push(plugin.id);
                        }
                    }
                });
            } else {
                // If the plugin doesn't have `compatIssueIds` property, initialize it with an empty array
                plugin.compatIssueIds = [];
            }
        }

        async function loadPlugins(plugin) {
            if (Array.isArray(plugin)) {
                return plugin.map(p => loadPlugins(p));
            }
            if (!plugin?.enabled) {
                throw new Error("Plugin must be enabled before loading");
            }
            if (plugin.localInstallOnly) {
                throw new Error("Plugin must be installed locally");
            }
            if (plugin.installedLocally) {
                throw new Error("Plugin is already loaded as it is installed locally.");
            }
            if (isPluginLoaded(plugin.id)) {
                console.debug("Plugin %o already loaded", plugin);
                return false;
            }
            if (PLUGIN_MODE == "serviceWorker") {
                console.log("Loading plugin %o using mode serviceWorker", plugin);
                try {
                    await loadScript(`${PLUGIN_ROOT}${pluginFileName}`);
                    return true;
                } catch (err) {
                    showPluginToast(`Error loading plugin ${plugin.name} (${err.message})`, undefined, true);
                    return false;
                }
            }

            console.log("Loading plugin %s using local eval mode", plugin.name);
            const pluginFileName = getPluginEntryPointFile(plugin);

            // Isolate and patch plugins to work around conflicting plugin implementations
            const invocationContext = Object.create(window);
            //const invocationContext = { eval };
            invocationContext.fetch = (...args) => {
                const response = fetchPluginContent(...args)
                if (response) {
                    return response;
                }
                return window.fetch(...args);
            };
            invocationContext.loadScript = (url) => {
                if (!url.startsWith(PLUGIN_ROOT)) {
                    return loadScript(url);
                }
                return loadContent(invocationContext, extractFilename(url));
            };
            try {
                // Load content using ctx
                const loaded = loadContent(invocationContext, pluginFileName);
                console.log("Plugin %s loaded using context %o", plugin.name, invocationContext);
                // add plugin to the meta tag
                updateMetaTagPlugins(plugin);
                return loaded;
            } catch (error) {
                console.error(error);
                showPluginToast(`Error loading plugin ${plugin.name} Failed to load ${contentName} (${error})`, null, true);
            }
            return false;
        }

        async function loadContent(invocationContext, contentName) {
            const PLUGIN_DB = await PLUGIN_DB_PROMISE;
            const contentStore = await idb_getData(PLUGIN_DB, "files", contentName);
            if (!contentStore?.content) {
                throw new Error(`Missing content: ${contentName}`);
            }
            const code = await contentStore.content.text();
            console.log("Loading content", contentName);
            invocationContext.eval(code);
            return true;
        }

        // only allow two refresh per hour
        function getTimeUntilNextRefresh() {
            const lastRuns = JSON.parse(localStorage.getItem(PLUGIN_LAST_UPDATES) || '[]');
            const currentTime = Date.now();
            const numRunsLast60Min = lastRuns.filter(run => currentTime - run <= 60 * 60 * 1000).length;

            if (numRunsLast60Min >= 2) {
                return 3600 - Math.round((currentTime - lastRuns[lastRuns.length - 1]) / 1000);
            }

            return 0;
        }

        function refreshAllowed() {
            const timeUntilNextRefresh = getTimeUntilNextRefresh();

            if (timeUntilNextRefresh > 0) {
                console.log(`Next refresh available in ${timeUntilNextRefresh} seconds`);
                return false;
            }

            const lastRuns = JSON.parse(localStorage.getItem(PLUGIN_LAST_UPDATES) || '[]');
            const currentTime = Date.now();
            lastRuns.push(currentTime);
            localStorage.setItem(PLUGIN_LAST_UPDATES, JSON.stringify(lastRuns));
            return true;
        }

        /* MODAL DIALOG */
        const DIALOG_INIT = "waiting"
        const DIALOG_OK = "ok";
        const DIALOG_CANCELLED = "cancelled";
        const pluginDialogDialog = document.getElementById("custom-plugin-dialog");
        const pluginDialogOkButton = document.getElementById("plugin-dialog-input-ok");
        const pluginDialogCancelButton = document.getElementById("plugin-dialog-input-cancel");
        const pluginDialogCloseButton = document.querySelector(".custom-plugin-dialog-close-button");
        const pluginDialogTextarea = document.getElementById("plugin-dialog-input-textarea");
        let callbackOK;
        let callbackCancel;

        pluginDialogDialog.addEventListener('click', (event) => {
            const dialogRect = pluginDialogDialog.getBoundingClientRect();
            const isInDialog = Boolean(
                dialogRect.top <= event.clientY
                && event.clientY <= dialogRect.top + dialogRect.height
                && dialogRect.left <= event.clientX
                && event.clientX <= dialogRect.left + dialogRect.width
            );
            if (!isInDialog && event.target.id == pluginDialogDialog.id) {
                pluginDialogDialog.close(event.ctrlKey ? POPUP_OK : POPUP_CANCELLED);
            }
        });

        const setupPopup = (mode, defaults = {}, pluginOwner) => {
            return Object.defineProperties({
                remove() {

                }
            }, {
                returnValue: {
                        get: async () => {
                        const response = {
                            name: "" //TODO Editable title.
                            , content: pluginDialogTextarea.value
                        };
                        if (mode === MODE_WARP) {
                            const result = await input_surface_canvas.render();
                            response.init_image = result.image;
                            response.mask = result.mask;
                        }
                        return response;
                    }
                }
            });
        };

        const showPopup = (...args) => {
            return Promise((resolve, reject) => {
                pluginDialogDialog.returnValue = DIALOG_INIT;
                const popupSetup = setupPopup(...args);
                pluginDialogDialog.addEventListener("close", async () => {
                    try {
                        const retVal = { returnValue: pluginDialogDialog.returnValue };
                        if (retVal.returnValue === DIALOG_OK) {
                            retVal.response = await popupSetup.returnValue;
                        }
                        resolve(retVal);
                    } catch (err) {
                        reject(err);
                    }
                    popupSetup.remove();
                }, { once: true });
                pluginDialogDialog.showModal();
            });
        }

        const addPlugin = document.getElementById("add-plugin-link");
        addPlugin.addEventListener("click", async function (event) {
            event.preventDefault();
            pluginDialogDialog.showModal();
        });

        function pluginDialogOpenDialog(inputOK, inputCancel) {
            pluginDialogDialog.showModal();
            callbackOK = inputOK;
            callbackCancel = inputCancel;
        }

        function pluginDialogCloseDialog() {
            pluginDialogDialog.close();
        }

        function pluginDialogHandleOkClick() {
            const userInput = pluginDialogTextarea.value;
            // Do something with the user input
            callbackOK()
            pluginDialogCloseDialog();
        }

        function pluginDialogHandleCancelClick() {
            callbackCancel()
            pluginDialogCloseDialog();
        }

        function pluginDialogHandleKeyDown(event) {
            if ((event.key === "Enter" && event.ctrlKey) || event.key === "Escape") {
                event.preventDefault();
                if (event.key === "Enter" && event.ctrlKey) {
                    pluginDialogHandleOkClick();
                } else {
                    pluginDialogCloseDialog();
                }
            }
        }

        pluginDialogTextarea.addEventListener("keydown", pluginDialogHandleKeyDown);
        pluginDialogOkButton.addEventListener("click", pluginDialogHandleOkClick);
        pluginDialogCancelButton.addEventListener("click", pluginDialogHandleCancelClick);
        pluginDialogCloseButton.addEventListener("click", pluginDialogCloseDialog);

        /* STORAGE MANAGEMENT */

        // Request persistent storage
        async function requestPersistentStorage() {
            if (navigator.storage && navigator.storage.persist) {
                const isPersisted = await navigator.storage.persist();
                console.log(`Persisted storage granted: ${isPersisted}`);
            }
        }
        requestPersistentStorage()

        // USE WITH CARE - THIS MAY DELETE ALL ENTRIES
        async function deleteKeys(keyToDelete) {
            let confirmationMessage = keyToDelete
                ? `This will delete the template with key "${keyToDelete}". Continue?`
                : "This will delete ALL templates. Continue?";
            if (!confirm(confirmationMessage)) {
                return false;
            }
            return openDB().then(db => {
                let tx = db.transaction("EasyDiffusionSettings", "readwrite");
                let store = tx.objectStore("EasyDiffusionSettings");
                return new Promise((resolve, reject) => {
                    store.openCursor().onsuccess = function (event) {
                        let cursor = event.target.result;
                        if (cursor) {
                            if (!keyToDelete || cursor.key === keyToDelete) {
                                cursor.delete();
                            }
                            cursor.continue();
                        } else {
                            // refresh the dropdown and resolve
                            resolve();
                        }
                    };
                });
            });
        }

        /* Time */

        function timeAgo(inputDate) {
            const now = new Date();
            const date = new Date(inputDate);
            const diffInSeconds = Math.floor((now - date) / 1000);
            const units = [
                { name: 'year', seconds: 31536000 },
                { name: 'month', seconds: 2592000 },
                { name: 'week', seconds: 604800 },
                { name: 'day', seconds: 86400 },
                { name: 'hour', seconds: 3600 },
                { name: 'minute', seconds: 60 },
                { name: 'second', seconds: 1 }
            ];

            for (const unit of units) {
                const unitValue = Math.floor(diffInSeconds / unit.seconds);
                if (unitValue > 0) {
                    return `${unitValue} ${unit.name}${unitValue > 1 ? 's' : ''} ago`;
                }
            }
            return 'just now';
        }

        function convertSeconds(seconds) {
            const timeParts = [];
            const hours = Math.floor(seconds / 3600);
            if (hours >= 1) {
                timeParts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
            }
            const minutes = Math.floor((seconds % 3600) / 60);
            if (minutes >= 1) {
                timeParts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
            }
            const remainingSeconds = seconds % 60;
            if (remainingSeconds >= 1) {
                timeParts.push(`${remainingSeconds} second${remainingSeconds > 1 ? "s" : ""}`);
            }
            return timeParts.join(', and ');
        }

        /* Version Management */

        function extractVersionNumber(elem) {
            if (!elem || !elem.innerHTML) {
                return;
            }
            const matches = /v(\d+\.\d+\.\d+)/.exec(elem.innerHTML);
            if (matches && matches.length > 1) {
                return matches[1];
            }
        }

        function filterPluginsByMinEDVersion(plugins, EDVersion) {
            const filteredPlugins = plugins.filter(plugin => {
                if (plugin.minEDVersion) {
                    return versionCompare(plugin.minEDVersion, EDVersion) <= 0;
                }
                return true;
            });
            return filteredPlugins;
        }

        // Initialize plugin
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/plugins/user/plugin-manager-worker.js?t=" + Date.now(), {
                scope: "/plugins/user/"
            }).then((registration) => {
                console.log("ServiceWorker registration", registration);
                let serviceWorker;
                if (registration.installing) {
                    serviceWorker = registration.installing;
                    console.log("installing", serviceWorker);
                } else if (registration.waiting) {
                    serviceWorker = registration.waiting;
                    console.log("waiting", serviceWorker);
                } else if (registration.active) {
                    serviceWorker = registration.active;
                    console.log("active", serviceWorker);
                    //PLUGIN_MODE = "serviceWorker"; //TODO Enable when included in core
                    setTimeout(initPlugins, 0);
                    return;
                }
                if (serviceWorker) {
                    console.log("Worker State", serviceWorker.state);
                    serviceWorker.addEventListener("statechange", (event) => {
                        console.log("Worker State Change", event.target.state);
                        if (event.target.state == "activated") {
                            //PLUGIN_MODE = "serviceWorker"; //TODO Enable when included in core
                            setTimeout(initPlugins, 0);
                        }
                    });
                }
            }, (error) => { // Something went wrong during registration.
                // The service-worker.js file might be unavailable or contains the wrong content.
                console.error(error);
            });
        } else {
            console.error("serviceWorker API unavailable.");
            setTimeout(initPlugins, 0);
            //TODO Monkey patch fetch to override plugin content download.
        }
    }, function() {
        // plugin-manager-database.js missing or corrupted content.
        document.querySelector('.tab-container')?.insertAdjacentHTML('beforeend'
            , `<span id="tab-plugin" class="tab">
                <span><i class="fa fa-puzzle-piece icon"></i> Plugins</span>
            </span>`
        );
        const databaseDownloadUrl = "https://raw.githubusercontent.com/madrang/sd-ui-plugins/beta/plugin-manager-database.js";
        document.querySelector('#tab-content-wrapper')?.insertAdjacentHTML('beforeend'
            , `<div id="tab-content-plugin" class="tab-content">
                <div id="plugin-manager" class="tab-content-inner">
                    <div id="plugin-manager-section">
                        <h1>Plugin Manager</h1>
                        <h2>Missing <a id="plugin-missing-database">Plugin Manager Database</a></h2>
                        <div class="plugin-manager-intro">Changes take effect after reloading the page</div>
                        <p><small>(Plugin developers, see <a href='${GITHUB_CREATE_REPOSITORY}' target='_blank'>CreateRepository.md</a> on github to setup your own repository.)</small></p>
                    </div>
                </div>
            </div>`
        );
        const tabPlugin = document.querySelector('#tab-plugin');
        if (tabPlugin) {
            linkTabContents(tabPlugin);
        }

        const downloadDatabaseButton = document.getElementById("plugin-missing-database");
        downloadDatabaseButton.addEventListener("click", debounce(async () => {
            const response = await fetch(databaseDownloadUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "plugin-manager-database.js";
            link.click();
            await asyncDelay(5 * 1000);
            URL.revokeObjectURL(url);
            link.remove();
        }, 500, true));
    });
})();
