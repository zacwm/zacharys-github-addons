// ==UserScript==
// @name         Zachary's GitHub Addons
// @namespace    http://github.com/zacwm/zacharys-github-addons
// @version      0.0.1
// @description  Eventually more than just labels to notifications. :^)
// @author       Zachary (github.com/zacwm)
// @match        https://*.github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

// code lol
(function() {
    'use strict';

    const configItems = {
        label_on_notifs: { name: "Label on Notifs", values: ["labels", "dots", "counter", "off"], defaultValue: "labels" }
    };
    const config = {};

    function prepConfig() {
        config.token = GM_getValue(`zga_token`);
        GM_registerMenuCommand('Set GitHub Token', () => {
            const tokenPrompt = prompt("Enter your GitHub Personal Access Token");
            GM_setValue(`zga_token`, tokenPrompt);
            location.reload();
        });

        Object.entries(configItems).forEach(([key, value]) => {
            const configValue = GM_getValue(`zga_${key}`) || value.defaultValue;
            config[key] = configValue;
            GM_registerMenuCommand(`${value.name}: ${configValue}`, () => {
                const currentIndex = value.values.indexOf(configValue);
                const nextIndex = currentIndex > value.values.length ? 0 : currentIndex + 1;
                GM_setValue(`zga_${key}`, value.values[nextIndex]);
                location.reload();
            });
        });
    }

    /* ================================================= */
    function main() {
        const pageRoute = window.location.href.split("//")[1].split("/");
        switch (pageRoute[1]) {
            case "notifications":
                if (config.label_on_notifs !== "off") run_LabelOnNotifs();
                break;
        }

    }

    // Fetches lables and appends them to notification items.
    function run_LabelOnNotifs() {
        const ElemNotifsContainer = document
            .querySelector(".notifications-list > .Box-body > ul");

        if (!ElemNotifsContainer) return;

        // Parse all GitHub HTML Notification elements into an array of objects with username, repo, type and number.
        const Query = Array.from(ElemNotifsContainer.children)
            .map(ElemNotif => {
                const [username, repo, type, raw ] = ElemNotif.querySelector("a")
                .href
                .split("github.com/")[1].split("/");
                if (!["issues", "pull"].includes(type)) return;

                const number = raw.match(/\d+/)[0];
                if (!number) return;

                return { username, repo, type, number };
            })
            .map((i, index) => {
                if (!i) return '';
                return `
notif${index}: repository(name: "${i.repo}", owner: "${i.username}") {
    ${i.type === "issues" ? "issue" : "pullRequest"}(number: ${i.number}) {
        labels(first: 10) {
            edges {
                node { color, name, url }
            }
        }
    }
}
            `
            })
            .join("\n");

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token}`
        }

        // Make the API request to GitHub
        fetch("https://api.github.com/graphql", {
            method: "POST",
            headers,
            body: JSON.stringify({ query: `query { ${Query} }` })
        })
        .then(response => response.json())
        .then(data => {
            if (!data?.data) {
                // TODO: Create an error notification...
                console.dir("Failed...");
                return;
            }

            Object.entries(data.data).forEach(item => {
                const NotifIndex = item[0].match(/\d+/)[0];
                const Labels = Object.values(item[1])[0].labels.edges.map(labels => {
                    return labels?.node;
                });

                const ElemNotifItem = ElemNotifsContainer.children[NotifIndex];

                let labelsElement;

                switch (config.label_on_notifs) {
                    case "labels":
                        labelsElement = genLabels(Labels);
                        break;
                    case "dots":
                        labelsElement = genDots(Labels);
                        break;
                    case "counter":
                        labelsElement = genCounter(Labels);
                        break;
                }

                ElemNotifItem.querySelector(".flex-md-row-reverse").appendChild(labelsElement);
            });
        })
        .catch(console.warn);

        // Types of possible label styles
        // Returns: html element
        function genLabels(Labels) {
            const ElemLabelsParent = document.createElement("div");
            Object.assign(ElemLabelsParent.style, {
                position: "relative",
                display: "flex",
                flexDirection: "row",
            });

            Labels.forEach(Label => {
                const ElemNewLabel = document.createElement("a");
                ElemNewLabel.innerText = Label.name;
                ElemNewLabel.href = Label.url;
                const ElemNewLabelStyles = {
                    fontSize: ".7rem",
                    fontWeight: 600,
                    marginLeft: "10px",
                    padding: "0 8px",
                    backgroundColor: `#${Label.color}35`,
                    border: `solid 1px #${Label.color}`,
                    borderRadius: "20px",
                    color: `#${Label.color}`
                }
                Object.assign(ElemNewLabel.style, ElemNewLabelStyles);

                ElemLabelsParent.appendChild(ElemNewLabel);
            });

            return ElemLabelsParent;
        }

        function genDots(Labels) {
            const ElemDotsParent = document.createElement("div");
            Object.assign(ElemDotsParent.style, {
                position: "relative",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
            });

            Labels.forEach(Label => {
                const ElemNewDot = document.createElement("span");
                ElemNewDot.title = Label.name;
                Object.assign(ElemNewDot.style, {
                    height: "12px",
                    width: "12px",
                    marginRight: "5px",
                    backgroundColor: `#${Label.color}`,
                    borderRadius: "50%",
                });

                ElemDotsParent.appendChild(ElemNewDot);
            });

            return ElemDotsParent;
        }

        function genCounter(Labels) {
            const ElemCounterParent = document.createElement("div");
            Object.assign(ElemCounterParent.style, {
                position: "relative",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
            });

            const ElemCounterBody = document.createElement("span");
            ElemCounterBody.innerText = Labels.length;
            ElemCounterBody.title = "Number of labels";
            Object.assign(ElemCounterBody.style, {
                fontSize: ".7rem",
                fontWeight: 600,
                marginLeft: "10px",
                padding: "0 8px",
                backgroundColor: `#$ffffff35`,
                border: `solid 1px #fff`,
                borderRadius: "20px",
                color: `#fff`
            });

            ElemCounterParent.append(ElemCounterBody);
            return ElemCounterParent;
        }
    }

    prepConfig();
    main();
    document.addEventListener('pjax:end', main);
    document.addEventListener('turbo:render', main);
})();