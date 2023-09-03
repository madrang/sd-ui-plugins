/*    Plugin Manager Database
 *    by Patrice, Madrang
 *    @version 3.0.3.2
 *
 *    A simple plugin manager that installs and auto updates plugins from GitHub.
 *
 */
const PLUGIN_CACHE_TIMEOUT = 15 * 60 * 1000;
const PLUGIN_MANAGER_DATABASE_VERSION = "3.0.3.1";

const PLUGIN_DB_NAME = "plugin-manager"
const PLUGIN_DB_VERSION = 1;
const PLUGIN_DB_OPENARGS = [
    PLUGIN_DB_NAME
    , PLUGIN_DB_VERSION
    , (db) => {
        db.createObjectStore("files", { keyPath: "name" });
        db.createObjectStore("notifications", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("settings", { keyPath: "sectionName" });
    }
];
const PLUGIN_DB_PROMISE = openIndexedDB(...PLUGIN_DB_OPENARGS);

async function addPluginNotification(messageText, error) {
    const PLUGIN_DB = await PLUGIN_DB_PROMISE;
    await idb_putData(PLUGIN_DB, "notifications", {
        date: Date.now()
        , text: messageText
        , error: error
        , unread: true
    });
}

const WILDCARD_FILE = "{FILE}";
const WILDCARD_RELEASE = "{RELEASE}";

const REPOSITORY_TRUSTED_URLS = [
    "https://raw.githubusercontent.com/"
];

const REPOSITORY_MODULES_EXTENTIONS = [
    ".plugin.js"
];

const PLUGIN_ROOT = "/plugins/user/";
const PLUGIN_CATALOG_FILE = "plugins.json";

function extractFilename(filepath) {
    if (typeof filepath !== "string") {
        throw new Error("filepath must be a string");
    }
    // Normalize the path separators to forward slashes and make the file names lowercase
    const normalizedFilePath = filepath.replace(/\\/g, "/").toLowerCase();
    // Strip off the path from the file name
    let fileName = normalizedFilePath.slice(normalizedFilePath.lastIndexOf("/") + 1);
    // Remove all trailling query parameters
    let idx = fileName.indexOf("?");
    if (idx >= 0) {
        fileName = fileName.slice(0, idx);
    }
    idx = fileName.indexOf("#");
    if (idx >= 0) {
        fileName = fileName.slice(0, idx);
    }
    return fileName;
}

function getContentVersion(textContent) {
    let matches = /\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+/.exec(textContent);
    if (!matches) {
        return;
    }
    matches = /@version[\s=,]*(?:(\d+)\.)?(?:(\d+)\.)?(?:(\d+)\.(\d+))/.exec(matches[0]);
    if (!matches) {
        return;
    }
    console.log("getContentVersion found tag %s", matches.shift());
    return matches.filter((s) => Boolean(s)).map((s) => Number(s));
}

async function getPluginRepositoryCatalog(catalogName) {
    const PLUGIN_DB = await PLUGIN_DB_PROMISE;
    const catalogStore = await idb_getData(PLUGIN_DB, "files", catalogName);
    if (catalogStore?.type !== "repository") {
        throw new Error(`catalogName ${catalogName} does not match to a stored repository entry.`);
    }
    const catalog = catalogStore.content;
    if (!Array.isArray(catalog)) {
        throw new Error("catalog is not an array of elements.");
    }
    // SubRepositories
    const flattenedCatalog = [];
    for (const entry of catalog) {
        if (entry.type !== "repository") {
            entry.fromRepository = catalogName;
            flattenedCatalog.push(entry);
            continue;
        }
        const repositoryName = entry.id || entry.name;
        try {
            let newEntries = await getPluginRepositoryCatalog(repositoryName);
            newEntries = newEntries.filter((p) => {
                if (flattenedCatalog.some((e) => p.id == e.id)) {
                    console.warn(`Ignored existing plugin id: ${p.id} name: ${p.name}`);
                    return false;
                }
                return true;
            });
            flattenedCatalog.push(...newEntries);
        } catch (error) {
            console.warn("Repository catalog %s not found!", repositoryName);
        }
    }
    // remove from plugins the entries that don't have mandatory fields (id, name, url)
    return flattenedCatalog.filter((plugin) => plugin.id && plugin.name && plugin.url);
}

function getPluginEntryPointFile(pluginDescriptor) {
    if (typeof pluginDescriptor !== "object") {
        throw new Error("pluginDescriptor isn't an object.");
    }
    let pluginUrl = pluginDescriptor.url;
    if (typeof pluginUrl !== "string" || !pluginUrl) {
        const err = new Error("pluginDescriptor.url isn't a string or is empty.");
        err.plugin = pluginDescriptor;
        throw err;
    }
    if (!pluginUrl.includes(WILDCARD_FILE)) {
        const contentName = extractFilename(pluginUrl);
        return (isPluginModule(contentName) ? contentName : undefined);
    }
    if (typeof pluginDescriptor.files === "object") {
        for (let fileName in pluginDescriptor.files) {
            let contentType = pluginDescriptor.files[fileName];
            if (typeof contentType === "object" && contentType.name) {
                fileName = contentType.name;
            }
            if (isPluginModule(fileName)) {
                return fileName;
            }
        }
    } else if (Array.isArray(pluginDescriptor.files)) {
        for (let fileName of pluginDescriptor.files) {
            if (typeof fileName === "object") {
                if (!fileName.name) {
                    throw new Error("fileName.name is missing.");
                }
                fileName = fileName.name;
            }
            if (isPluginModule(fileName)) {
                return fileName;
            }
        }
    } else {
        throw new Error(`Found "${WILDCARD_FILE}" but pluginDescriptor.files isn't an array of valid values.`);
    }
}

async function fetchHeaders(url) {
    if (typeof url !== "string") {
        throw new Error("url must be a string.");
    }
    try {
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
            console.error(`HTTP${response.status} error! status: ${response.statusText}, url: ${apiUrl}`);
            return;
        }
        const headers = Object.fromEntries(response.headers.entries());
        console.debug("Content headers data", headers);
        return headers;
    } catch (error) {
        console.error("Error while fetching data from url: %s Error: %s", apiUrl, error);
    }
}

async function fetchPluginContent(request, ...args) {
    if (typeof request === "string") {
        request = new Request(request, ...args);
    }
    const requestUrl = new URL(request.url);
    if (!requestUrl.pathname.startsWith(PLUGIN_ROOT)) {
        return;
    }
    const requestPath = requestUrl.pathname.slice(PLUGIN_ROOT.length);
    const PLUGIN_DB = await PLUGIN_DB_PROMISE;
    const fileDesc = await idb_getData(PLUGIN_DB, "files", requestPath);
    if (!fileDesc) {
        return;
    }
    console.debug("Fetching %s found value %o", requestPath, fileDesc);
    const responseInit = {
        status: 200
        , statusText: 'OK'
        , headers: {
            'Content-Type': getContentType(fileDesc.type)
            , 'X-Mock-Response': PLUGIN_DB_NAME
        }
    };
    if (fileDesc.type == "repository") {
        return new Response(JSON.stringify(fileDesc.content), responseInit);
    }
    return new Response(fileDesc.content, responseInit);
}

async function getFileHash(blob, algorithm="SHA-1") {
    if (typeof blob?.arrayBuffer !== "function") {
        throw new Error("blob isn't an instance of Blob");
    }
    const dataArray = new Uint8Array(await blob.arrayBuffer());
    const hashBuffer = await crypto.subtle.digest(algorithm, dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((h) => h.toString(16).padStart(2, '0')).join('');
}

async function getLocalPlugins () {
    const res = await fetch("/get/ui_plugins");
    if (!res.ok) {
        throw new Error(`Error HTTP${res.status} while loading plugins list. - ${res.statusText}`);
    }
    return await res.json();
}

function isTrustedSourceUrl(url) {
    if (typeof url !== "string") {
        return false;
    }
    return REPOSITORY_TRUSTED_URLS.some((t) => url.startsWith(t));
}

function isPluginModule(url) {
    if (typeof url !== "string") {
        return false;
    }
    return REPOSITORY_MODULES_EXTENTIONS.some((t) => url.endsWith(t));
}

async function updateContent(contentDescriptor, options = {}) {
    if (typeof contentDescriptor !== "object") {
        throw new Error("contentDescriptor isn't an object.");
    }
    if (typeof contentDescriptor.name !== "string") {
        throw new Error("contentDescriptor.name isn't a string.");
    }
    if (typeof contentDescriptor.url !== "string") {
        throw new Error("contentDescriptor.url isn't a string.");
    }
    if (typeof contentDescriptor.type !== "string") {
        throw new Error("contentDescriptor.type isn't a string.");
    }
    if (!isTrustedSourceUrl(contentDescriptor.url)) {
        console.warn("Refusing to update %s from untrusted content source at %s", contentDescriptor.name, contentDescriptor.url);
        return false;
    }

    const PLUGIN_DB = await PLUGIN_DB_PROMISE;
    let cachedData;
    if (options.getContent) {
        cachedData = await Promise.resolve(options.getContent(contentDescriptor));
    } else {
        cachedData = await idb_getData(PLUGIN_DB, "files", contentDescriptor.name);
    }

    let oldSha;
    if (cachedData?.content) {
        // Check content headers
        const contentHeaders = await fetchHeaders(contentDescriptor.url);
        // Time base headers
        if (typeof cachedData?.timestamp === "number") {
            // last-modified / When missing default to PLUGIN_CACHE_TIMEOUT
            let expiresAt = Date.now() - PLUGIN_CACHE_TIMEOUT;
            if ("last-modified" in contentHeaders) {
                expiresAt = Date.parse(contentHeaders["last-modified"]);
            }
            if (cachedData.timestamp > expiresAt) {
                console.debug("Content %s update skipped, updated %s ago", contentDescriptor.name, Date.now() - cachedData.timestamp);
                return false;
            }
        }
        // content headers
        oldSha = await getFileHash(cachedData.content, "SHA-1");
        if ("etag" in contentHeaders) {
            if (contentHeaders["etag"] == oldSha) {
                console.debug("Content %s update skipped, Etag/SHA-1 checksum %s didn't change.", contentDescriptor.name, oldSha);
                return false;
            }
        }
    }

    const contentRequest = new Request(contentDescriptor.url, {
        //mode: 'no-cors' //TODO Currently fails when used... TODO!!
        cache: "no-cache"
    });
    const contentResponse = await fetch(contentRequest);
    console.log("updateContent response", contentResponse);
    if (!contentResponse.ok) {
        throw new Error(`updateContent ${contentDescriptor.name} HTTP${contentResponse.status} error! status: ${contentResponse.statusText}`);
    }

    const content = await contentResponse.blob();
    const newSha = await getFileHash(content, "SHA-1");
    if (newSha == oldSha) {
        console.debug("Content %s update skipped, sha checksum %s didn't change.", contentDescriptor.name, newSha);
        return false;
    }

    if (contentDescriptor.version && cachedData?.content) {
        const newVersion = getContentVersion(await content.text());
        const oldVersion = getContentVersion(await cachedData.content.text());
        if (oldVersion && !newVersion) {
            console.debug("Content %s update skipped, missing version number.", contentDescriptor.name);
            return false;
        }
        if (newVersion && oldVersion && versionCompare(newVersion, oldVersion) <= 0) {
            console.debug("Content %s update skipped, local version %s is up to date or more recent than %s", contentDescriptor.name, oldVersion, newVersion);
            return false;
        }
    }

    const newContent = {
        name: contentDescriptor.name
        , content: content
        , type: contentDescriptor.type
        , timestamp: Date.now()
    };
    if (options.onNewContent) {
        await Promise.resolve(options.onNewContent(newContent));
    }
    if (options.dryRun) {
        return true;
    }
    await idb_putData(PLUGIN_DB, "files", newContent);
    console.log(`${contentDescriptor.type} content from ${contentDescriptor.url} saved`);
    if (options.skipNotify) {
        await addPluginNotification(`Content ${contentDescriptor.name} updated.`);
    }
    return true;
}

async function updatePlugin(pluginDescriptor, options = {}) {
    if (typeof pluginDescriptor !== "object") {
        throw new Error("pluginDescriptor isn't an object.");
    }
    if (!options.dryRun) {
        if (pluginDescriptor.localInstallOnly) {
            console.log("localInstallOnly plugin ignored", pluginDescriptor);
            return false;
        }

        // Check plugin is enabled
        const PLUGIN_DB = await PLUGIN_DB_PROMISE;
        const pluginsSettings = await idb_getData(PLUGIN_DB, "settings", "plugins");
        if (!pluginsSettings?.installed || !Array.isArray(pluginsSettings.installed)) {
            console.log("No plugins installed... Skipping all contents.");
            return false;
        }
        if (!pluginsSettings.installed.some((plugin) => pluginDescriptor.id == plugin.id && plugin.enabled)) {
            console.log("Ignored disabled plugin", pluginDescriptor);
            return false;
        }
    }

    console.log("Updating plugin", pluginDescriptor);

    let pluginUrl = pluginDescriptor.url;
    if (typeof pluginUrl !== "string" || !pluginUrl) {
        const err = new Error("pluginDescriptor.url isn't a string or is empty.");
        err.plugin = pluginDescriptor;
        throw err;
    }

    let defaultContentType;
    switch (pluginDescriptor.type) {
        case undefined:
        case "client/plugin":
            defaultContentType = "javascript";
            break;
        case "client/module":
            defaultContentType = "module";
            break;
        case "client/theme":
            defaultContentType = "css";
            break;
        default:
            throw new Error(`Unknown pluginDescriptor.type "${pluginDescriptor.type}"`);
    }
    if (pluginUrl.includes(WILDCARD_RELEASE)) {
        if (!Array.isArray(pluginDescriptor.releases)) {
            throw new Error(`Found "${WILDCARD_RELEASE}" but pluginDescriptor.releases isn't an array of valid values.`);
        }
        //TODO Implement pluginDescriptor.releases to support releases.
        pluginUrl = pluginUrl.replace(WILDCARD_RELEASE, pluginDescriptor.releases[0]);
    }
    if (!pluginUrl.includes(WILDCARD_FILE)) {
        // Single file plugin.
        const contentName = extractFilename(pluginUrl);
        const updated = await updateContent({
            name: contentName
            , url: pluginUrl
            , type: defaultContentType
            , version: pluginDescriptor.version
        }, { skipNotify: true, ...options });
        if (updated) {
            await addPluginNotification(`Plugin ${pluginDescriptor.name} updated.`);
        }
        return updated;
    }
    // Multi file / Fetch one file at a time.
    let updated = false;
    if (typeof pluginDescriptor.files === "object") {
        for (let fileName in pluginDescriptor.files) {
            const contentUrl = pluginUrl.replace(WILDCARD_FILE, fileName);
            let contentType = pluginDescriptor.files[fileName];
            if (typeof contentType === "object") {
                if (contentType.name) {
                    fileName = contentType.name;
                }
                contentType = contentType.type || defaultContentType;
            }
            updated |= await updateContent({
                name: fileName
                , url: contentUrl
                , type: contentType
                , version: pluginDescriptor.version
            }, { skipNotify: true, ...options });
        }
    } else if (Array.isArray(pluginDescriptor.files)) {
        // Fetch one file at a time.
        for (let fileName of pluginDescriptor.files) {
            let contentUrl;
            let contentType;
            if (typeof fileName === "object") {
                if (!fileName.name) {
                    throw new Error("fileName.name is missing.");
                }
                contentUrl = pluginUrl.replace(WILDCARD_FILE, fileName.name);
                contentType = fileName.type || defaultContentType;
                fileName = fileName.name;
            } else if (typeof fileName === "string") {
                contentUrl = pluginUrl.replace(WILDCARD_FILE, fileName);
                contentType = defaultContentType;
            } else {
                throw new Error("file descriptor is of unsupported type.");
            }
            updated |= await updateContent({
                name: fileName
                , url: contentUrl
                , type: contentType
                , version: pluginDescriptor.version
            }, { skipNotify: true, ...options });
        }
    } else {
        throw new Error(`Found "${WILDCARD_FILE}" but pluginDescriptor.files isn't an array of valid values.`);
    }
    if (updated) {
        await addPluginNotification(`Plugin ${pluginDescriptor.name} updated.`);
    }
    return updated;
}

async function updateRepository(repositoryDescriptor, options = {}) {
    if (typeof repositoryDescriptor !== "object") {
        throw new Error("repositoryDescriptor isn't an object.");
    }

    const PLUGIN_DB = await PLUGIN_DB_PROMISE;
    if (!repositoryDescriptor.noCache) {
        const cachedData = await idb_getData(PLUGIN_DB, "files", repositoryDescriptor.id || repositoryDescriptor.name);
        if (typeof cachedData?.timestamp === "number" && Date.now() - cachedData.timestamp < PLUGIN_CACHE_TIMEOUT) {
            console.debug("Skipping repository %o update, was updated %s ago", repositoryDescriptor, Date.now() - cachedData.timestamp);
            return false;
        }
    }

    let repoUrl = repositoryDescriptor.url;
    if (typeof repoUrl !== "string" || !repoUrl) {
        throw new Error("repositoryDescriptor.url isn't a string or is empty.");
    }
    if (repoUrl.includes(WILDCARD_FILE)) {
        repoUrl = repoUrl.replace(WILDCARD_FILE, options.defaultCatalogName || PLUGIN_CATALOG_FILE);
    } else if (repoUrl.endsWith("/")) {
        repoUrl += (options.defaultCatalogName || PLUGIN_CATALOG_FILE);
    }
    repoUrl = `${repoUrl}?t=${Date.now()}`;

    let repoData = await fetch(repoUrl);
    if (!repoData.ok) {
        throw new Error(`Failed to fetch ${repoUrl} with status ${repoData.statusText}`);
    }
    repoData = await repoData.json();

    await idb_putData(PLUGIN_DB, "files", {
        name: repositoryDescriptor.id || repositoryDescriptor.name
        , content: repoData
        , type: "repository"
        , timestamp: Date.now()
    });

    // Fetch each repository/plugins in parallel.
    const results = await Promise.allSettled(repoData.map(async (entry) => {
        switch (entry.type) {
            case undefined:       // Default
            case "client/plugin": // .js
            case "client/module": // .mjs
            case "client/theme":  // .css
                return await updatePlugin(entry);
            case "host/plugin":
                console.log(`Ignored ${entry.name || entry.id}, host plugin...`);
                return;
            case "repository":
                if ((entry.id || entry.name) == (options.defaultCatalogName || PLUGIN_CATALOG_FILE)) {
                    throw new Error("repositoryDescriptor id is matching defaultCatalogName. Not allowed.");
                }
                return await updateRepository(entry, options);
            default: // Unknown/Invalid entry type.
                throw new Error(`Unknown entry.type "${entry.type}"`);
        }
    }));
    const failedFetch = results.filter((r) => r.status == "rejected");
    if (failedFetch.length > 0) {
        failedFetch.forEach((r) => console.error(r.reason));
        return false;
    }
    return true;
}

async function openIndexedDB(db_name, db_version, onUpgradeNeeded) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(db_name, db_version);
        if (typeof onUpgradeNeeded === "function") {
            request.addEventListener("upgradeneeded", () => onUpgradeNeeded(request.result), { once: true });
        } else {
            throw new Error("onUpgradeNeeded function is not optional.");
        }
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
    });
}

function idb_deleteData(db, storeName, ...keys) {
    return new Promise((resolve, reject) => {
        const dbTransaction = db.transaction(storeName, "readwrite");
        dbTransaction.addEventListener("complete", (event) => resolve(event), { once: true });
        dbTransaction.addEventListener("error", (event) => reject(event.error), { once: true });

        const objectStore = dbTransaction.objectStore(storeName);
        keys.forEach((key) => objectStore.delete(key));
        dbTransaction.commit();
    });
}

function idb_getData(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const dbTransaction = db.transaction(storeName, "readonly");
        dbTransaction.addEventListener("error", (event) => reject(event.error), { once: true });

        const objectStore = dbTransaction.objectStore(storeName);
        const request = objectStore.get(key);
        request.addEventListener("success", () => resolve(request.result), { once: true });
        dbTransaction.commit();
    });
}

function idb_putData(db, storeName, ...data) {
    return new Promise((resolve, reject) => {
        const dbTransaction = db.transaction(storeName, "readwrite");
        dbTransaction.addEventListener("complete", (event) => resolve(event), { once: true });
        dbTransaction.addEventListener("error", (event) => reject(event.error), { once: true });

        const objectStore = dbTransaction.objectStore(storeName);
        data.forEach((value) => objectStore.put(value));
        dbTransaction.commit();
    });
}

function idb_forEach(db, storeName, callback, options = {}) {
    if (!db) {
        throw new Error("db is undefined.");
    }
    return new Promise((resolve, reject) => {
        const dbTransaction = db.transaction(storeName, options.write ? "readwrite" : "readonly");
        dbTransaction.addEventListener("complete", (event) => {
            if (event.type === "error") {
                reject(event.target.error);
            } else if (event.type === "complete") {
                if (typeof options.oncomplete === "function") {
                    try {
                        const returnValue = options.oncomplete(event.returnValue);
                        resolve(returnValue);
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    resolve(event.returnValue);
                }
            } else {
                console.warn("Unexpected event.type", event);
            }
        }, { once: true });
        const store = dbTransaction.objectStore(storeName);
        const request = store.openCursor();
        request.addEventListener("success", (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const retVal = callback(cursor);
                if (retVal == undefined) {
                    cursor.continue();
                }
                if (!retVal) {
                    return;
                }
            }
            dbTransaction.commit();
        });
    });
}

function idb_selectData(db, storeName, filter) {
    if (typeof filter !== "function") {
        throw new Error("filter must be a function");
    }
    const data = [];
    return idb_forEach(db, storeName, (cursor) => {
        const val = filter.call(cursor, cursor.value, cursor.key || cursor.primaryKey);
        if (val) {
            data.push(val);
        }
    }, { oncomplete: () => data });
}


function parseVersion (versionString, options = {}) {
    if (typeof versionString === "undefined") {
        throw new Error("versionString is undefined.");
    }
    if (typeof versionString !== "string") {
        throw new Error("versionString is not a string.");
    }
    const lexicographical = options && options.lexicographical;
    const isValidPart = (x) => (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    let versionParts = versionString.split('.');
    if (!versionParts.every(isValidPart)) {
        throw new Error("Version string is invalid.");
    }
    if (options && options.zeroExtend) {
        while (versionParts.length < 4) {
            versionParts.push("0");
        }
    }
    if (!lexicographical) {
        versionParts = versionParts.map(Number);
    }
    return versionParts;
};

function versionCompare (v1, v2, options = {}) {
    if (typeof v1 == "undefined") {
        throw new Error("v1 is undefined.");
    }
    if (typeof v2 === "undefined") {
        throw new Error("v2 is undefined.");
    }

    let v1parts;
    if (typeof v1 === "string") {
        v1parts = parseVersion(v1, options);
    } else if (Array.isArray(v1)) {
        v1parts = [...v1];
        if (!v1parts.every(p => typeof p === "number" && p !== NaN)) {
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
}
