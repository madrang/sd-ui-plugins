/*    Plugin Manager ServiceWorker
 *    by Madrang
 *    @version 3.0.3
 *
 *    A simple plugin manager that installs and auto updates plugins from GitHub.
 *
 */
// Chrome
// chrome://flags/#unsafely-treat-insecure-origin-as-secure
// debugging info at chrome://inspect/#service-workers
//     chrome://serviceworker-internals
// Firefox
// about:config#dom.securecontext.allowlist
importScripts("./plugin-manager-database.js");

const WORKER_NAME = "plugin-manager-worker";
const WORKER_VERSION = "3.0.3.1";

self.addEventListener('install', function(event) {
    console.log("%s Install event: %o", WORKER_NAME, event);
    const onInstall = async function() {
        await updateRepository({ name: PLUGIN_CATALOG_FILE
            , url: PLUGIN_ROOT + PLUGIN_CATALOG_FILE
            , noCache: true
        }, {
            defaultCatalogName: PLUGIN_CATALOG_FILE
        });
    };
    event.waitUntil(onInstall());
});

self.addEventListener('activate', function(event) {
    console.log("%s Activate event: %o", WORKER_NAME, event);
    const onActivate = async function() {
    };
    event.waitUntil(onActivate());
});

self.addEventListener('fetch', function(event) {
    console.log("%s Handling fetch event for %s", WORKER_NAME, event.request.url);
    const onFetch = async function() {
        const response = await fetch(event.request);
        if (response.ok) {
            return response;
        }
        try {
            const pluginResponse = fetchPluginContent(event.request);
            if (pluginResponse) {
                return pluginResponse;
            }
        } catch (error) {
            console.error(error);
        }
        return response;
    }
    event.respondWith(onFetch());
});

function getContentType(type) {
    if (typeof type !== "string") {
        throw new Error("type is not a string.");
    }
    switch (type) {
        case undefined:
        case "txt":
        case "text":
            return "text/plain";
        case "repository":
        case "json":
            return "application/json";
        case "css":
            return "text/css";
        case "javascript":
        case "module":
            return "text/javascript"
        default:
            return type;
    }
}
