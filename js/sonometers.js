// ======================================================
// SONOMETERS — VERSION PRO+
// Gestion markers, clusters, heatmap, historique, UI liste
// ======================================================

import { SONOS, SONO_ADDRESSES } from "./config.js";
import { haversineDistance } from "./helpers.js";


// ------------------------------------------------------
// Logging PRO+
// ------------------------------------------------------
const IS_DEV = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
const log = (...a) => IS_DEV && console.log("[SONO]", ...a);
const logErr = (...a) => console.error("[SONO ERROR]", ...a);


// ------------------------------------------------------
// ÉTAT GLOBAL
// ------------------------------------------------------
export let sonometers = {};
export let heatLayer = null;
export let heatHistory = [];
export const MAX_HISTORY = 50;

export let clusterLayer = L.markerClusterGroup();


// ======================================================
// 1) UI — Surlignage dans la liste
// ======================================================
export function highlightSonometerInList(id) {
    try {
        const list = document.getElementById("sono-list");
        if (!list) return;

        list.querySelectorAll(".sono-item").forEach(el =>
            el.classList.remove("sono-highlight")
        );

        const item = [...list.children].find(el => el.textContent.trim() === id);
        if (item) {
            item.classList.add("sono-highlight");
            item.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    } catch (err) {
        logErr("Erreur highlightSonometerInList :", err);
    }
}


// ======================================================
// 1b) UI — Liste des sonomètres
// ======================================================
export function populateSonometerList() {
    try {
        const list = document.getElementById("sono-list");
        if (!list) return;

        list.innerHTML = "";

        Object.keys(sonometers).forEach(id => {
            const item = document.createElement("div");
            item.className = "sono-item";
            item.textContent = id;

            item.onclick = () => {
                highlightSonometerInList(id);
                showDetailPanel(id, [50.64695, 5.44340]);
            };

            list.appendChild(item);
        });

        log("Liste sonomètres générée :", Object.keys(sonometers).length);

    } catch (err) {
        logErr("Erreur populateSonometerList :", err);
    }
}


// ======================================================
// 2) Heatmap dynamique
// ======================================================
export function updateHeatmap(map) {
    try {
        if (heatLayer) map.removeLayer(heatLayer);

        const points = Object.values(sonometers).map(s => {
            let weight = 0.2;
            if (s.marker.options.color === "green") weight = 0.6;
            if (s.marker.options.color === "red") weight = 1.0;
            return [s.lat, s.lon, weight];
        });

        heatLayer = L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 12,
            minOpacity: 0.3
        }).addTo(map);

    } catch (err) {
        logErr("Erreur updateHeatmap :", err);
    }
}


// ======================================================
// 3) Panneau détail
// ======================================================
export function showDetailPanel(id, runwayStart) {
    try {
        const s = sonometers[id];
        if (!s) return;

        const panel = document.getElementById("detail-panel");
        const title = document.getElementById("detail-title");
        const address = document.getElementById("detail-address");
        const town = document.getElementById("detail-town");
        const status = document.getElementById("detail-status");
        const distance = document.getElementById("detail-distance");

        const fullAddress = SONO_ADDRESSES[id] || "Adresse inconnue";
        const townName = fullAddress.split(",")[1] || "—";

        const d = haversineDistance([s.lat, s.lon], runwayStart).toFixed(2);

        title.textContent = id;
        address.textContent = fullAddress;
        town.textContent = townName.trim();
        status.textContent = s.marker.options.color.toUpperCase();
        distance.textContent = `${d} km`;

        panel.classList.remove("hidden");

    } catch (err) {
        logErr("Erreur showDetailPanel :", err);
    }
}


// ======================================================
// 4) Historique Heatmap
// ======================================================
export function snapshotHeatmap() {
    try {
        const snapshot = Object.values(sonometers).map(s => ({
            lat: s.lat,
            lon: s.lon,
            color: s.marker.options.color
        }));

        heatHistory.push(snapshot);
        if (heatHistory.length > MAX_HISTORY) heatHistory.shift();

    } catch (err) {
        logErr("Erreur snapshotHeatmap :", err);
    }
}

export async function playHeatmapHistory(map) {
    try {
        for (const snapshot of heatHistory) {
            if (heatLayer) map.removeLayer(heatLayer);

            const points = snapshot.map(s => {
                let weight = 0.2;
                if (s.color === "green") weight = 0.6;
                if (s.color === "red") weight = 1.0;
                return [s.lat, s.lon, weight];
            });

            heatLayer = L.heatLayer(points, {
                radius: 35,
                blur: 25,
                maxZoom: 12,
                minOpacity: 0.3
            }).addTo(map);

            await new Promise(r => setTimeout(r, 300));
        }

    } catch (err) {
        logErr("Erreur playHeatmapHistory :", err);
    }
}


// ======================================================
// 5) Initialisation des sonomètres (clusters + markers)
// ======================================================
export function initSonometers(map) {
    try {
        SONOS.forEach(s => {
            const marker = L.circleMarker([s.lat, s.lon], {
                radius: 6,
                color: "gray",
                fillColor: "gray",
                fillOpacity: 0.9,
                weight: 1
            });

            clusterLayer.addLayer(marker);

            marker.on("click", () => {
                highlightSonometerInList(s.id);
                showDetailPanel(s.id, [50.64695, 5.44340]);
            });

            sonometers[s.id] = { ...s, marker, status: "UNKNOWN" };
        });

        map.addLayer(clusterLayer);
        log("Sonomètres initialisés :", SONOS.length);

    } catch (err) {
        logErr("Erreur initSonometers :", err);
    }
}


// ======================================================
// 6) Bouton ON/OFF Heatmap
// ======================================================
export function initHeatmapToggle(map) {
    try {
        const btn = document.getElementById("toggle-heatmap");
        if (!btn) return;

        btn.onclick = () => {
            if (map.hasLayer(heatLayer)) {
                map.removeLayer(heatLayer);
                btn.classList.add("off");
            } else {
                map.addLayer(heatLayer);
                btn.classList.remove("off");
            }
        };

        updateHeatmap(map);

    } catch (err) {
        logErr("Erreur initHeatmapToggle :", err);
    }
}


// ======================================================
// 7) Heatmap dynamique basée sur le vent
// ======================================================
export function updateHeatmapDynamic(map, windDir, windSpeed, runwayHeading) {
    try {
        if (heatLayer) map.removeLayer(heatLayer);

        const diff = Math.abs(windDir - runwayHeading);
        const angle = Math.min(diff, 360 - diff);

        const windFactor = Math.min(windSpeed / 20, 1);
        const crossFactor = Math.sin(angle * Math.PI / 180);

        const radius = 35 + windFactor * 20 + crossFactor * 10;
        const blur = 25 + windFactor * 15;

        const points = Object.values(sonometers).map(s => {
            let weight = 0.2;
            if (s.marker.options.color === "green") weight = 0.6;
            if (s.marker.options.color === "red") weight = 1.0;
            return [s.lat, s.lon, weight];
        });

        heatLayer = L.heatLayer(points, {
            radius,
            blur,
            maxZoom: 12,
            minOpacity: 0.3
        }).addTo(map);

    } catch (err) {
        logErr("Erreur updateHeatmapDynamic :", err);
    }
}
