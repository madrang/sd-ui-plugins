/* Madrang's SD-UI Twitch Plugin
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
 * @source https://raw.githubusercontent.com/madrang/sd-ui-plugins/master/mads-twitch.plugin.js
 */
(function() { "use strict"
    const GITHUB_PAGE = "https://github.com/madrang/sd-ui-plugins"
    const VERSION = "2.4.19.1";
    const ID_PREFIX = "madrang-plugin";
    console.log('%s Twitch Integration! Version: %s', ID_PREFIX, VERSION);

    const style = document.createElement('style');
    style.textContent = `
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

    const TWITCH_USER_HOST = "tmi.twitch.tv";
    const SUPPORTED_HOSTS = [
        TWITCH_USER_HOST
    ];

    const TWITCH_IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
    const LOCALHOST_NAME = "Localhost";

    const TokenType = {
        App: "AppToken"
        , User: "UserToken"
    };
    Object.freeze(TokenType);

    function getRandomString(len) {
        const SALTCHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        return getRandomString(SALTCHARS, len);
    }
    function getRandomString(candidateChars, len) {
        const strb = [];
        while (strb.length < len) {
            const index = Math.floor(Math.random() * candidateChars.length);
            strb.push(candidateChars.charAt(index));
        }
        return strb.join('');
    }

    class AccessToken {
        #created;
        #client_id;
        #token;
        #expires_in;
        #refresh_token;
        #type;
        constructor(clid, tokType, dataObj={tok:'', exp:0}) {
            this.#created = Date.now();
            this.#client_id = clid;
            this.#type = tokType;

            // App/User access token
            if ('tok' in dataObj) {
                this.#token = dataObj.tok;
            } else if ('access_token' in dataObj) {
                this.#token = dataObj["access_token"];
            } else {
                throw new Error('Missing access_token!');
            }

            // Time until the token expires
            if ('exp' in dataObj) {
                this.#expires_in = dataObj.exp;
            } else if ('expires_in' in dataObj) {
                // Number in seconds, convert to ms
                this.#expires_in = parseInt(dataObj.expires_in) * 1000;
            } else {
                this.#expires_in = 0;
            }

            if ("refresh_token" in dataObj) {
                this.#refresh_token = dataObj.refresh_token;
            } else {
                this.#refresh_token = null;
            }

            console.debug('new AccessToken %o', this);
        }
        get createdTime() {
            return this.#created;
        }
        get expiration() {
            return this.#created + this.#expires_in;
        }
        get clientID() {
            return this.#client_id;
        }
        get token() {
            return this.#token;
        }
        get tokenType() {
            return this.#type;
        }
        static async getAppAccessToken(client_id, client_secret, scopes) {
            // POST https://id.twitch.tv/oauth2/token?client_id=uo6dggojyb8d6soh92zknwmi5ej1q2&client_secret=nyo51xcdrerl8z9m56w9w6wg&grant_type=client_credentials
            let requestUrl = `https://id.twitch.tv/oauth2/token?client_id=${client_id}&client_secret=${client_secret}&grant_type=client_credentials`;
            if (Array.isArray(scopes) && scopes.length > 0) {
                requestUrl = requestUrl + "&scope=" + encodeURIComponent(scopes.join(" "));
            }
            const response = await fetch(requestUrl, {method: "POST"});
            return new AccessToken(client_id, TokenType.App, await response.json());
        }
        static async getUserAccessToken(client_id, client_secret, code) {
            // POST https://id.twitch.tv/oauth2/token?client_id=uo6dggojyb8d6soh92zknwmi5ej1q2&client_secret=nyo51xcdrerl8z9m56w9w6wg&code=394a8bc98028f39660e53025de824134fb46313&grant_type=authorization_code
            const response = await fetch(
                `https://id.twitch.tv/oauth2/token?client_id=${client_id}&client_secret=${client_secret}&code=${code}&grant_type=authorization_code`
                , {
                    method: "POST"
                }
            );
            return new AccessToken(client_id, TokenType.User, await response.json());
        }
        static async getUserAccessCode(client_id, scopes) {
            const redirectUri = `${location.protocol}/plugins/user/twitchLogin.html`;
            let requestUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirectUri}`;
            if (Array.isArray(scopes) && scopes.length > 0) {
                requestUrl = requestUrl + "&scope=" + encodeURIComponent(scopes.join(" "));
            }
            requestUrl = requestUrl + "&state=c3ab8aa609ea11e793ae92361f002671";
            const response = await fetch(
                requestUrl
                , {
                    method: "POST"
                }
            );
            return new AccessToken(client_id, TokenType.User, await response.json());
        }
    }

    class UserInfo {
        #broadcaster_id;
        #display_name;
        #login;
        #description;
        #createdAt;

        #profile_image_url;
        #offline_image_url;

        #view_count;

        constructor(dataObj) {
            this.#broadcaster_id = dataObj.id;
            this.#display_name = dataObj.display_name;
            this.#login = dataObj.login;
            this.#description = dataObj.description;
            let createdIsoString = dataObj.created_at;
            //if (createdIsoString.endsWith("Z")) {
            //    createdIsoString = createdIsoString.substring(0, createdIsoString.length - 1);
            //}
            this.#createdAt = Date.parse(createdIsoString);

            this.#profile_image_url = dataObj.profile_image_url;
            this.#offline_image_url = dataObj.offline_image_url;
            this.#view_count = dataObj.view_count;
            /*
                "type":""
                "broadcaster_type":""
            */
        }

        get broadcasterID() {
            return this.#broadcaster_id;
        }
        get userName() {
            return this.#login;
        }
        get displayName() {
            return this.#display_name;
        }
        get description() {
            return this.#description;
        }

        get createdAt() {
            return this.#createdAt;
        }
        get viewCount() {
            return this.#view_count;
        }

        get profileImage() {
            if (!this.#profile_image_url || this.#profile_image_url.length <= 0) {
                return undefined;
            }
            return loadImage(profile_image_url);
        }
        get offlineImage() {
            if (!this.#offline_image_url || this.#offline_image_url.length <= 0) {
                return undefined;
            }
            return loadImage(this.#offline_image_url);
        }
    }

    class ChannelInfo {
        #id; // the channel id
        #broadcaster_id;
        #broadcaster_login;
        #broadcaster_name;
        #broadcaster_language;

        #game_id;
        #game_name;

        #title;

        #delay;
        #is_live;
        #started_at;

        #thumbnail_url;

        #client;

        constructor(client, dataObj) {
            this.#client = client;
            if (typeof dataObj.id === "undefined") {
                this.#id = -1;
            } else {
                this.#id = dataObj.id;
            }
            this.#broadcaster_id = dataObj.broadcaster_id;

            this.#broadcaster_login = dataObj.broadcaster_login;
            if (dataObj.broadcaster_name) {
                this.#broadcaster_name = dataObj.broadcaster_name;
            } else if (dataObj.display_name) {
                this.#broadcaster_name = dataObj.display_name;
            }
            this.#broadcaster_language = dataObj.broadcaster_language;

            this.#game_id = dataObj.getInt("game_id");
            this.#game_name = dataObj.getString("game_name");

            this.#title = dataObj.getString("title");

            if (dataObj.isNull("delay")) {
                this.#delay = -1;
            } else {
                this.#delay = dataObj.getInt("delay");
            }
            if (delay >= 0 || dataObj.isNull("is_live")) {
                this.#is_live = true;
                this.#started_at = LocalDateTime.now();
            } else {
                this.#is_live = dataObj.getBoolean("is_live");
                if (this.#is_live) {
                    let startedIsoString = dataObj.started_at;
                    if (startedIsoString.endsWith("Z")) {
                        startedIsoString = startedIsoString.substring(0, startedIsoString.length - 1);
                    }
                    this.#started_at = LocalDateTime.parse(startedIsoString);
                } else {
                    this.#started_at = LocalDateTime.of(0, 0, 0, 0, 0, 0);
                }
            }
            if (!dataObj.isNull("thumbnail_url")) {
                this.#thumbnail_url = dataObj.getString("thumbnail_url");
            }
        }

        get gameID() {
            return this.#game_id;
        }
        get gameInfo() {
            return this.#client.getGame(game_id);
        }
    }

    class GameInfo {
        #id;
        #name;
        #box_art_url;

        constructor(dataObj) {
            id = dataObj.getInt("id");
            name = dataObj.getString("name");
            box_art_url = dataObj.getString("box_art_url");
        }

        getBoxArt(width, height) {
            if (!this.#box_art_url == null || this.#box_art_url.length <= 0) {
                return undefined;
            }
            const imgUrl = box_art_url.replace("{width}", Integer.toString(width)).replace("{height}", Integer.toString(height));
            return loadImage(imgUrl);
        }
    }

    class UserMessage {
        #user;
        #server;
        #uniqueName;
        #text;
        constructor(userName, msg) {
            //madrang!madrang@madrang.tmi.twitch.tv
            if (userName.includes("!") && userName.includes("@")) {
                this.#user = userName.substring(0, userName.indexOf("!"));
                this.#server = userName.substring(userName.indexOf("@") + 1);
                this.#uniqueName = this.#user + "@" + this.#server;
            } else if (userName.includes("@")) {
                this.#uniqueName = userName;
                this.#user = userName.substring(0, userName.indexOf("@"));
                this.#server = userName.substring(userName.indexOf("@"));
            } else {
                this.#user = userName;
                this.#uniqueName = userName + "@" + LOCALHOST_NAME;
                this.#server = LOCALHOST_NAME;
            }
            this.#text = msg;
        }
        get userName() {
            return this.#user;
        }
        get serverName() {
            return this.#server;
        }
        get uniqueName() {
            return this.#uniqueName;
        }
        get message() {
            return this.#text;
        }
        toString() {
            return `${this.#user}: ${this.#text}`;
        }
    }

    class ChatClient {
        #socket
        #access
        #eventSrc
        #twitchClient
        constructor(twitchClient, access, ...protocols) {
            if (!(twitchClient instanceof TwitchClient)) {
                throw new Error("twitchClient is not a instance of TwitchClient.");
            }
            this.#twitchClient = twitchClient;
            this.#access = access;
            console.info("Connecting to IRC chat WebSocket at " + TWITCH_IRC_URL);
            this.#socket = new WebSocket(TWITCH_IRC_URL, protocols);
            this.#socket.addEventListener('open', this.onOpen.bind(this));
            this.#socket.addEventListener('message', this.onMessage.bind(this));
            this.#socket.addEventListener('close', this.onClose.bind(this));
            this.#socket.addEventListener('error', this.onError.bind(this));
            this.#eventSrc = new GenericEventSource("userMessage");
        }

        get isClosed() {
            return Boolean(this.#socket.readyState === WebSocket.CLOSING || this.#socket.readyState === WebSocket.CLOSED);
        }
        get isOpen() {
            return Boolean(this.#socket.readyState === WebSocket.OPEN);
        }

        close(code, reason) {
            this.#socket.close(code, reason);
        }
        send(data) {
            console.log("WebSocket Sending: %o", data);
            this.#socket.send(data);
        }
        sendMessage() {
            // @client-nonce=37594d898d36bbc2251b5fc5be6338d6 PRIVMSG #band_di_london :LOL
        }

        addEventListener(name, handler) {
            return this.#eventSrc.addEventListener(name, handler);
        }
        removeEventListener(name, handler) {
            return this.#eventSrc.removeEventListener(name, handler);
        }

        onOpen(event) {
            //String cap = "twitch.tv/tags twitch.tv/commands twitch.tv/membership";
            //CAP REQ :twitch.tv/tags twitch.tv/commands
            //this.send("CAP REQ : " + cap);
            if (this.#access?.tokenType === TokenType.User && this.#access?.token) {
                this.send("PASS oauth:" + this.#access.token);
                this.send("NICK " + USERNAME);
                //USER madrang 8 * :madrang
            } else {
                this.send("PASS oauth:" + getRandomString(8));
                this.send("NICK justinfan" + getRandomString("0123456789", 3));
            }
            console.log("%o\nOpened connection %o", this.#socket, event);
        }
        onMessage(event) {
            console.log("%o\nReceived new message %o", this.#socket, event);
            let message = event.data;
            if (message.startsWith("PING")) {
                // Keep alive autoreply.
                //PING :tmi.twitch.tv
                //PONG :tmi.twitch.tv
                this.send(message.replace("PING", "PONG"));
                return;
            }
            // @badge-info=;badges=vip/1;client-nonce=37594d898d36bbc2251b5fc5be6338d6;color=#FF0000;display-name=Madrang;emote-sets=0,1411067,300374282,9639e3d0-c2f7-48b8-8de7-bd93d2b360c0;id=2dd44d0a-afaa-416f-ab8d-265c4058b2f9;mod=0;subscriber=0;user-type= :tmi.twitch.tv USERSTATE #band_di_london
            // @badge-info=;badges=vip/1;color=#FF0000;display-name=Madrang;emote-sets=0,1411067,300374282,9639e3d0-c2f7-48b8-8de7-bd93d2b360c0;mod=0;subscriber=0;user-type= :tmi.twitch.tv USERSTATE #band_di_london
            // @emote-only=0;followers-only=0;r9k=0;room-id=202117458;slow=0;subs-only=0 :tmi.twitch.tv ROOMSTATE #band_di_london

            const msgParts = message.split(" ");
            if (msgParts[1] === "PRIVMSG") {
                //:madrang!madrang@madrang.tmi.twitch.tv PRIVMSG #band_di_london :Wazzaa !!
                let userName = msgParts[0];
                if (userName.startsWith(":")) {
                    userName = userName.substring(1, userName.length);
                }
                const strb = [];
                let msgBuffer = msgParts[3];
                if (msgBuffer.startsWith(":")) {
                    msgBuffer = msgBuffer.substring(1, msgBuffer.length);
                }
                strb.push(msgBuffer);
                for(let i = 4; i < msgParts.length; i++) {
                    strb.push(" " + msgParts[i]);
                }
                msgBuffer = strb.join('');
                console.info("User " + userName + " sent message: " + msgBuffer);
                this.onUserMessage(new UserMessage(userName, msgBuffer));
                return;
            }
            /*
            for(int i = 0; i < msgParts.length; i++) {
                console.log("[" + i + "] = " + msgParts[i]);
            }
            */
        }
        onClose(event) {
            console.log(`Connection to ${this.#socket.url} ${(event.wasClean ? "closed" : "failed")}. Code ${event.code || 0} - ${event.reason || 'undefined'}`, event);
        }
        onError(ex) {
            // if the error is fatal then onClose will be called additionally
            console.error(ex);
        }

        onUserMessage(userMessage) {
            console.log("New message %o from User %s received.", userMessage, userMessage.userName);
            this.#eventSrc.fireEvent("userMessage", userMessage);
        }

        joinChannel(channelName) {
            this.send("JOIN #" + channelName);
        }
        joinChannels(...channelNames) {
            for(const channel of channelNames) {
                this.joinChannel(channel);
            }
        }
    }
    class TwitchClient {
        #access;
        #weakChatRef;
        #userMap = new Map();

        constructor() {
        }

        async getAccessToken(client_id, client_secret, scopes) {
            //await AccessToken.getUserAccessToken
            this.#access = await AccessToken.getAppAccessToken(client_id, client_secret, scopes);
        }

        get chat() {
            let chatInstance = this.#weakChatRef?.deref();
            if (!chatInstance) {
                chatInstance = new ChatClient(this, this.#access);
                this.#weakChatRef = new WeakRef(chatInstance);
            }
            return chatInstance;
        }

        static async getWebData(method, requestUrl, data, access) {
            console.log("Starting web request: ", requestUrl);
            const headers = {};
            if (access != null) {
                headers["Client-Id"] = access.clientID;
                headers["Authorization"] = "Bearer " + access.token;
            }
            const fetchOptions = {
                method
                , headers
            };
            if (typeof data !== "undefined") {
                headers["Content-Type"] = "application/json; charset=UTF-8";
                if (typeof data === "string") {
                    fetchOptions.body = data;
                } else {
                    fetchOptions.body = JSON.stringify(data);
                }
            }
            const httpResp = await fetch(requestUrl, fetchOptions);
            return await httpResp.json();
        }
        async getWebData(method, requestUrl, data) {
            return await TwitchClient.getWebData(method, requestUrl, data, this.#access);
        }

        async getChannelInformation(broadcaster_id) {
            let response = await this.getWebData("GET", `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcaster_id}`);
            if (!Array.isArray(response?.data) || response.data.length <= 0) {
                return undefined;
            }
            return new ChannelInfo(this, response.data[0]);
        }
        async updateChannelInformation(broadcaster_id, gameID, newTitle, language) {
            if (language == null) {
                language = "other";
            }
            const data = `{"game_id":"${gameID}", "title":"${newTitle}", "broadcaster_language":"${language}"}`;
            const response = await this.getWebData("PATCH", `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcaster_id}`, data);
            console.info(response);
            return Boolean(response);
        }
        async searchChannels(query, first=20, after) {
            let requestUrl = `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=${first}&live_only=true`;
            if (typeof after === "string" && after.length > 0) {
                requestUrl = requestUrl + "&after=" + after;
            }
            const response = await this.getWebData("GET", requestUrl);
            if (!Array.isArray(response.data) || response.data.length <= 0) {
                return undefined;
            }
            return response.data.map((infoObj) => new ChannelInfo(this, infoObj));
        }

        async getUsers(usernames) {
            if (typeof usernames !== "undefined" && !Array.isArray(usernames)) {
                throw new Error("usernames is not an array.");
            }
            if (usernames.length <= 0) {
                throw new Error("usernames is empty.");
            }

            const usersData = {};
            usernames.forEach((user) => usersData[user] = this.#userMap.get(user));
            usernames = usernames.filter((user) => typeof usersData[user] === "undefined");
            if (usernames.length <= 0) {
                return usersData;
            }
            let requestUrl = "https://api.twitch.tv/helix/users?login=" + usernames.map((user) => String(user)).join("&login=");
            const response = await this.getWebData("GET", requestUrl);
            if (!Array.isArray(response?.data) || response.data.length <= 0) {
                console.error("Failed to get user information.", requestUrl);
            } else {
                response.data.forEach((userObj) => {
                    const userInfo = new UserInfo(userObj);
                    console.log(userInfo);
                    usersData[userInfo.userName] = userInfo;
                    this.#userMap.set(userInfo.userName, userInfo);
                });
            }
            return usersData;
        }
        async getUser(username) {
            const usersArr = await this.getUsers([username]);
            return (usersArr ? usersArr[username] : undefined);
        }

        async getCurrentUser() {
            let currentUser = this.#userMap.get("CURRENT_USER");
            if (currentUser) {
                return currentUser;
            }
            if (this.#access.tokenType === TokenType.App) {
                currentUser = this.getUser(USERNAME);
            } else {
                const requestUrl = "https://api.twitch.tv/helix/users";
                const response = await this.getWebData("GET", requestUrl);
                if (!Array.isArray(response?.data) || response.data.length <= 0) {
                    throw new Error("Failed to get user information.");
                }
                currentUser = new UserInfo(response.data);
            }
            this.#userMap.set("CURRENT_USER", currentUser);
            return currentUser;
        }
        async getUserChatColor(userId) {
            let response = await this.getWebData("GET", `https://api.twitch.tv/helix/chat/color?user_id=${userId}`);
            if (!Array.isArray(response?.data) || response.data.length <= 0) {
                return undefined;
            }
            return response.data;
        }

        //https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=ssssss&user_id=sssss

        async follows(uid) {
            if (uid == null) {
                return null;
            }
            let requestUrl = "https://api.twitch.tv/helix/users/follows?from_id=" + uid; // + "&after=";
            return await this.getWebData("GET", requestUrl);
        }

        async getCustomRewards(broadcaster_id) {
            //GET 'https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=274637212&only_manageable_rewards=true'
        }
        async getCustomRewardRedemptions() {
            //GET 'https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=274637212&reward_id=92af127c-7326-4483-a52b-b0da0be61c01&status=CANCELED'

            // Update reward status
            // PATCH 'https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=274637212&reward_id=92af127c-7326-4483-a52b-b0da0be61c01&id=17fa2df1-ad76-4804-bfa5-a40ef63efe63'
            const fulfilled = true;
            let status = (fulfilled ? "FULFILLED" : "CANCELED");
            const data = `{ "status": "${status}" }`;
        }
        async getGames(games_id) {
            if (!Array.isArray(games_id)) {
                throw new Error("games_id is not an array.");
            }
            if (games_id.length <= 0) {
                throw new Error("games_id is empty.");
            }
            const response = await this.getWebData("GET", "https://api.twitch.tv/helix/games?id=" + games_id.join("&id="));
            if (!Array.isArray(response?.data) || response.data.length <= 0) {
                return undefined;
            }
            return response.data.map((gameObj) => new GameInfo(gameObj));
        }
        async getGame(game_id) {
            if (typeof game_id !== 'undefined') {
                game_id = [game_id];
            }
            const gamesArr = await this.getGames(game_id);
            return (gamesArr ? gamesArr[0] : undefined);
        }
        async getTopGames() {
            const response = await this.getWebData("GET", "https://api.twitch.tv/helix/games/top");
            if (!Array.isArray(response?.data) || response.data.length <= 0) {
                return undefined;
            }
            return response.data.map((gameInfo) => new GameInfo(dataArr.getJSONObject(i)));
        }

        async getCreatorGoals() {
            // https://api.twitch.tv/helix/goals?broadcaster_id=141981764'
            /*
            "id": "1woowvbkiNv8BRxEWSqmQz6Zk92",
            "broadcaster_id": "141981764",
            "broadcaster_name": "TwitchDev",
            "broadcaster_login": "twitchdev",
            "type": "follower",
            "description": "Follow goal for Helix testing",
            "current_amount": 27062,
            "target_amount": 30000,
            "created_at": "2021-08-16T17:22:23Z"
            */
            return "";
        }

        async getVIPs() {
            if (this.#access.tokenType === TokenType.App) {
                console.warn('A user token is required. Applications cannot have VIPs. Returning Empty array...');
                return [];
            }
            const currentUser = await this.getCurrentUser();
            const response = await this.getWebData("GET", "https://api.twitch.tv/helix/channels/vips?broadcaster_id=" + currentUser.broadcasterID);
            return response?.data;
        }

        async createEventSubscription(type) {
            //POST 'https://api.twitch.tv/helix/eventsub/subscriptions'
            const data = "{\"type\":\"user.update\",\"version\":\"1\",\"condition\":{\"user_id\":\"1234\"},\"transport\":{\"method\":\"webhook\",\"callback\":\"https://this-is-a-callback.com\",\"secret\":\"s3cre7\"}}";
            return "";
        }
    }

    let twitchService;
    let streamConfig;
    let elementsToFocus = [];
    const logo = document.getElementById("logo");
    const preview = document.getElementById("preview");
    const autoScroll = document.getElementById("auto_scroll")

    function* keepFocus() {
        if (autoScroll?.checked) {
            while (elementsToFocus.length > 0) {
                elementsToFocus.shift();
                yield asyncDelay(8);
            }
            return asyncDelay(1000);
        }
        if (elementsToFocus.length <= 0) {
            const keep = 5;
            // Completed tasks
            elementsToFocus = Array.from(document.querySelectorAll("#preview .imageTaskContainer .taskStatusLabel"))
                .filter((taskLabel) => taskLabel.style.display == "none").map((taskLabel) => taskLabel.closest('.imageTaskContainer'));
            // Remove all after the keep amount.
            for (const imageTask of elementsToFocus.splice(keep, Number.POSITIVE_INFINITY)) {
                preview.removeChild(imageTask);
            }
            // Add those in progress if streaming is enabled.
            if (typeof streamImageProgressField === "object" && streamImageProgressField.checked) {
                const processingTasks = Array.from(document.querySelectorAll('#preview .imageTaskContainer .taskStatusLabel'))
                .filter((taskLabel) => {
                    if (taskLabel.style.display == "none") {
                        return false;
                    }
                    return taskLabel.innerHTML.toLowerCase().includes("processing");
                }).map((taskLabel) => taskLabel.closest('.imageTaskContainer'));
                if (processingTasks.length > 0) {
                    elementsToFocus.unshift(...processingTasks);
                }
            }
            if (elementsToFocus.length <= 0) {
                return asyncDelay(1000);
            }
            // Always end by returning all the way to the top of the page.
            elementsToFocus.push(logo);
        }
        // List has elements.
        // Move first into focus.
        const element = elementsToFocus.shift();
        let rect = element.getBoundingClientRect();
        const MIN_STEP_SIZE = 3;
        let timeout = 750;
        while (Math.abs(rect.top) > MIN_STEP_SIZE * 1.5 && timeout > 0) {
            let stepSize = rect.top * 0.005;
            if (Math.abs(stepSize) < MIN_STEP_SIZE) {
                if (stepSize > 0) {
                    stepSize = MIN_STEP_SIZE;
                } else {
                    stepSize = 0 - MIN_STEP_SIZE;
                }
            }
            scrollTo(0, document.documentElement.scrollTop + stepSize);
            timeout--;
            yield asyncDelay(8);
            rect = element.getBoundingClientRect();
        }
        if (element === logo) {
            // Stay up 1 second at the logo, then continue moving...
            return asyncDelay(1000);
        }
        if (element.querySelector(".imgContainer")) {
            //Has an image. Wait longer...
            return asyncDelay(16 * 1000);
        }
        // No image, only show we got the request then continue.
        return asyncDelay(3 * 1000);
    }

    PLUGINS['TASK_CREATE'].push(function(event) {
        const taskContainer = this['taskStatusLabel'].closest('.imageTaskContainer');
        elementsToFocus.unshift(taskContainer);
    });

    function removeAllTasks() {
        stopAllTasks().finally(function(){
            let taskEntries = document.querySelectorAll('.imageTaskContainer');
            taskEntries.forEach(task => {
                task.remove();
            });

            previewTools.style.display = 'none';
            initialText.style.display = 'block';
        });
    }

    async function getUserInfos(uniqueName, userName, serverName) {
        const serverConfig = streamConfig[serverName];
        if (!serverConfig) {
            console.warn(`Server "${serverName}" config not found. Can't identify user ${userName}.`);
            return
        }
        const userconfig = serverConfig[userName];
        if (userconfig) {
            console.log("User %s identified. Returning config %o", uniqueName, userconfig);
            return userconfig;
        }

        const serverHost = SUPPORTED_HOSTS.find((host) => serverName.includes(host))
        if (serverHost === TWITCH_USER_HOST) {
            console.log("Sender %o", await twitchService.getUser(userName));
            console.log("Channel VIPs %o", await twitchService.getVIPs());
        }
    }

    async function onChatMessage(event) {
        const userConfig = getUserInfos(event.uniqueName, event.userName, event.serverName);

        let message = event.message;
        if (typeof message !== "string" || message.length <= 0) {
            return;
        }
        const lowerCaseMsg = message.toLowerCase();
        if (lowerCaseMsg.startsWith("!stop")
            || lowerCaseMsg.startsWith("!rem")
            || lowerCaseMsg.startsWith("!norm") // !normalise - remove unwanted things...
        ) {
            removeAllTasks();
            return;
        }
        if (!lowerCaseMsg.startsWith("!ai") && !lowerCaseMsg.startsWith("!sd")) {
            return;
        }

        message = message.slice(3).trim();
        const argsParts = message.split("#");
        const promptsVars = getPrompts(argsParts[0]);
        let negative_prompt = argsParts[1] || "";
        if (negative_prompt.length > 0) {
            negative_prompt = negative_prompt.trim();
        }

        // 896 x 640 / 960 x 576
        const taskTemplate = modifyCurrentRequest({
            model: "sd2_768-v-ema"
            , num_outputs: 1
            , num_inference_steps: 1
            , guidance_scale: 7.5
            , prompt_strength: 0.7
            , seed: Math.floor(Math.random() * 10000000)
        });
        taskTemplate.numOutputsTotal = 1;
        taskTemplate.batchCount = 1;
        delete taskTemplate.reqBody.mask;

        const newTaskRequests = promptsVars.map((promptText) => Object.assign({}, taskTemplate, {
            reqBody: Object.assign({}, taskTemplate.reqBody, {
                prompt: promptText
                , negative_prompt
            })
        }));

        if (newTaskRequests.length > (userConfig?.group ? Number.MAX_SAFE_INTEGER : 4)) {
            console.warn('Need VIPs or mods permission for this command.');
            return;
        }

        newTaskRequests.forEach(createTask);
        initialText.style.display = 'none';
    }

    const editor = document.querySelector("#editor");
    const topNav = document.querySelector("#top-nav");
    let connectButton = document.createElement('button');

    async function onTwitchConnect() {
        if (connectButton) {
            connectButton.remove();
        }
        const streamConfigResponse = await fetch("/plugins/user/streamConfig.json?v=" + Date.now());
        streamConfig = await streamConfigResponse.json();

        // Hide the editor
        editor.style.display = 'none';
        // Set full width
        preview.style.paddingLeft = '0px';

        twitchService = new TwitchClient();
        const twitchConfig = streamConfig[TWITCH_USER_HOST]
        await twitchService.getAccessToken(twitchConfig.client_id, twitchConfig.secret, twitchConfig.scopes);
        const user = await twitchService.getUser(twitchConfig.username);
        if (!user) {
            return;
        }
        console.log(user);
        //const broadcaster_id = user.getBroadcasterID();
        //const chanInfo = twitchService.getChannelInformation(broadcaster_id);
        //twitchService.getTopGames(access);

        //const game = chanInfo.getGameInfo();

        //const profileImage = user.getProfileImage();
        //const offlineImage = user.getOfflineImage();
        //const gameBoxArt = game.getBoxArt(64, 64);
        asyncDelay(100).then(async function() {
            while(!twitchService.chat.isOpen) {
                await asyncDelay(100);
            }
            twitchService.chat.joinChannels(...twitchConfig.channels);
            twitchService.chat.addEventListener("userMessage", onChatMessage);
        });
        let scrollPromise;
        let intervalPtr = setInterval(() => {
            if (!scrollPromise?.isPending) {
                scrollPromise = makeQuerablePromise(SD.Task.enqueue(keepFocus()));
            }
        }, 1000);

        const closeButton = document.createElement('button');
        closeButton.id = `${ID_PREFIX}-twitchDisconnectButton`;
        closeButton.innerHTML = `Disconnect from Twitch`;
        closeButton.title = `V${VERSION} - Twitch`;

        topNav.appendChild(closeButton);
        closeButton.addEventListener('click', () => {
            twitchService.chat.close();
            closeButton.disabled = true;
            closeButton.innerHTML = `Disconnected...`;
            editor.style.removeProperty("display");
            preview.style.removeProperty("padding-left");
            clearInterval(intervalPtr);
            asyncDelay(3 * 1000).then(() => {
                closeButton.remove();
                buttonsContainer.appendChild(connectButton);
            });
        });
    }

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = `${ID_PREFIX}-twitchContainer`;
    const editorInputs = document.getElementById("editor-inputs");
    editorInputs?.appendChild(buttonsContainer);

    connectButton.id = `${ID_PREFIX}-twitchConnectButton`;
    connectButton.innerHTML = `Connect to Twitch`;
    connectButton.title = `V${VERSION} - Twitch`;
    buttonsContainer.appendChild(connectButton);
    connectButton.addEventListener('click', onTwitchConnect);
})();
