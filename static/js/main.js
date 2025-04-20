let initialZoom = window.innerWidth < 768 ? 3 : 4;

let map = L.map("map", {
  minZoom: 3,
  maxZoom: 10,
  scrollWheelZoom: true,    // ✅ 允許滾輪縮放
  zoomControl: true,         // ✅ 顯示縮放控制按鈕
  minZoom: 3,
  maxZoom: 10,
  wheelPxPerZoomLevel: 180, // ❗調整滑鼠滾輪縮放靈敏度，預設是 60，
  maxBounds: [
    // [10, -180],
    // [85, 180]
    [20, -130],  // 左下角（德州、佛羅里達更南）
    [52, -60]    // 右上角（緬因州附近）
  ]
}).setView([39.8283, -98.5795], initialZoom);  // ✅ 美國本土大致中心（堪薩斯附近）

// 聚焦美國本土地理區域
map.fitBounds([
  [24.396308, -125.0],
  [49.384358, -66.93457]
]);


let layer;
let stateLabels = [];

fetch("/api/states")
  .then(res => res.json())
  .then(data => {
    layer = L.geoJson(data, {
      style: feature => ({
        fillColor: "hsl(" + Math.random() * 360 + ", 50%, 85%)",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: "3",
        fillOpacity: 0.7
      }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties.NAME || "";
        const code = feature.properties.STUSPS || "";

        layer.bindTooltip(name);

        const center = layer.getBounds().getCenter();
        const label = L.marker(center, {
          icon: L.divIcon({
            className: "state-label",
            html: `<strong>${code}</strong>`,
            iconSize: [30, 20],
            iconAnchor: [15, 10]
          }),
          interactive: false
        }).addTo(map);
        stateLabels.push(label);

        layer.on("click", () => {
          loadCountyMap(code, layer.getBounds());
        });
      }
    }).addTo(map);
  });

function loadCountyMap(stateCode, bounds) {
  if (layer) map.removeLayer(layer);
  stateLabels.forEach(label => map.removeLayer(label));
  stateLabels = [];

  fetch(`/api/counties/${stateCode}`)
    .then(res => res.json())
    .then(data => {
      layer = L.geoJson(data, {
        style: feature => ({
          fillColor: "hsl(" + Math.random() * 360 + ", 60%, 80%)",
          weight: 1,
          color: "#555",
          fillOpacity: 0.9
        }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties.NAME || "County";
          window.currentCountyName = name.replace(/\s+/g, "");
          layer.bindTooltip(name);

          layer.on("click", () => {
            const center = layer.getBounds().getCenter();
            const lat = center.lat;
            const lon = center.lng;

            // 取得 forecast URL → 再抓七天預報
            fetch(`https://api.weather.gov/points/${lat},${lon}`)
              .then(res => res.json())
              .then(data => fetch(data.properties.forecast))
              .then(res => res.json())
              .then(data => {
                const periods = data.properties.periods;
                window.lastForecastData = periods;    //+++++++++
                let html = "";

                // 攝氏轉換用函式
                const fToC = f => ((f - 32) * 5 / 9).toFixed(1);

                // 取出未來 1-7 天的資料（共 14 筆：白天/夜晚交替）
                for (let i = 0; i < Math.min(14, periods.length); i++) {
                  const p = periods[i];
                  const tempC = fToC(p.temperature);
                  html += `<div><strong>${p.name}</strong>: ${p.detailedForecast}（約 ${tempC}°C）</div>`;
                }

                const firstTempC = fToC(periods[0].temperature);
                document.getElementById("weather-info").innerText =
                  `${name} 當前預測：約 ${firstTempC}°C`;

                document.getElementById("forecast-info").innerHTML = html;

                // 動態產生下載按鈕與成功訊息
                const container = document.getElementById("forecast-info");

                // 刪除舊按鈕與訊息
                const oldBtn = document.getElementById("save-forecast-btn");
                if (oldBtn) oldBtn.remove();
                const oldStatus = document.getElementById("save-status");
                if (oldStatus) oldStatus.remove();

                const btn = document.createElement("button");
                btn.id = "save-forecast-btn";
                // 統一風格
                btn.style.position = "absolute";
                btn.className = "top-button";
                btn.style.top = "12px";  
                btn.style.left = "220px";  // 稍微拉開距離
                btn.innerText = "下載\n預報 CSV";
                btn.style.marginTop = "10px";
                btn.style.padding = "6px 10px";
                btn.style.border = "none";
                btn.style.backgroundColor = "#28a745";
                btn.style.color = "white";
                btn.style.borderRadius = "5px";
                btn.style.cursor = "pointer";    
                btn.style.fontSize = "17px";        
                btn.onclick = () => {
                  exportForecastToCSV(periods);
                  const existingStatus = document.getElementById("save-status");
                  if (existingStatus) existingStatus.remove();
                
                  const status = document.createElement("div");
                  status.id = "save-status";
                  status.innerText = `下載成功：weather_${window.currentCountyName || "forecast"}.csv（請於下載資料夾中查看）`;
                  status.style.fontSize = "12px";
                  status.style.color = "green";
                  status.style.marginTop = "4px";
                  document.getElementById("forecast-info").appendChild(status);
                };
                document.body.appendChild(btn);

                const status = document.createElement("div");
                status.id = "save-status";
                status.style.fontSize = "12px";
                status.style.color = "green";
                status.style.marginTop = "4px";
                const filename = `weather_${window.currentCountyName || "forecast"}.csv`;
                status.innerText = `./${filename} 儲存成功`;
              })
              .catch(err => {
                document.getElementById("weather-info").innerText = `${name} 無法取得天氣資料`;
                document.getElementById("forecast-info").innerHTML = "";
                console.error(err);
              });
          });
        }
      }).addTo(map);
      map.fitBounds(bounds, { maxZoom: 6 });
    });
}

function exportForecastToCSV(forecastPeriods) {
  if (!forecastPeriods || forecastPeriods.length === 0) return;

  let rows = [["Period", "Forecast (Celsius)"]];
  const fToC = f => ((f - 32) * 5 / 9).toFixed(1);

  for (let i = 0; i < Math.min(14, forecastPeriods.length); i++) {
    const p = forecastPeriods[i];
    const tempC = fToC(p.temperature);
    rows.push([p.name, `${p.detailedForecast}（約 ${tempC}°C）`]);
  }

  const csvContent = rows.map(e => e.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = (window.currentCountyName ? `weather_${window.currentCountyName}.csv` : "weather_forecast.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
