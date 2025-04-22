let initialZoom = window.innerWidth < 768 ? 3 : 4;

let map = L.map("map", {
  minZoom: 3,
  maxZoom: 10,
  scrollWheelZoom: true,    // ✅ 允許滾輪縮放
  zoomControl: true,         // ✅ 顯示縮放控制按鈕
  wheelPxPerZoomLevel: 180, // ❗調整滑鼠滾輪縮放靈敏度，預設是 60，
  maxBounds: [
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

fetch("/api/states")  // 取得美國各州的 GeoJSON 資料
  .then(res => res.json())                 // 轉換成 JSON 格式
  .then(data => {                 // 取得資料
    layer = L.geoJson(data, {       // 載入 GeoJSON 資料
      style: feature => ({           // 設定樣式
        fillColor: "hsl(" + Math.random() * 360 + ", 50%, 85%)",   // 隨機生成顏色
        weight: 2,              // 邊界寬度
        opacity: 1,             // 邊界透明度
        color: "white",         // 邊界顏色
        dashArray: "3",         // 虛線樣式
        fillOpacity: 0.7        // 填充透明度
      }),
      onEachFeature: (feature, layer) => {    // 設定事件
        const name = feature.properties.NAME || "";   // 取得州名
        const code = feature.properties.STUSPS || "";  // 取得州代碼

        layer.bindTooltip(name);  // 顯示州名

        const center = layer.getBounds().getCenter(); // 取得州的中心點
        const label = L.marker(center, {      // 在中心點上顯示州代碼
          icon: L.divIcon({                   // 設定圖標
            className: "state-label",         // CSS 類別
            html: `<strong>${code}</strong>`, // 顯示州代碼
            iconSize: [30, 20],               // 圖標大小 
            iconAnchor: [15, 10]              // 圖標錨點 
          }),
          interactive: false                // 不可互動
        }).addTo(map);                      // 將圖標加入地圖
        stateLabels.push(label);            // 將圖標加入陣列

        layer.on("click", () => {            // 點擊州時
          loadCountyMap(code, layer.getBounds());     // 載入該州的縣市地圖
        });
      }
    }).addTo(map);                            // 將縣市地圖加入地圖
  });

function loadCountyMap(stateCode, bounds) {          // 載入縣市地圖
  if (layer) map.removeLayer(layer);                // 移除舊的縣市地圖
  stateLabels.forEach(label => map.removeLayer(label));   // 移除舊的州代碼圖標
  stateLabels = [];                          // 清空州代碼圖標陣列

  fetch(`/api/counties/${stateCode}`)   // 取得縣市的 GeoJSON 資料
    .then(res => res.json())            // 轉換成 JSON 格式
    .then(data => {                     // 取得資料  
      layer = L.geoJson(data, {         // 載入 GeoJSON 資料
        style: feature => ({     // 設定樣式
          fillColor: "hsl(" + Math.random() * 360 + ", 60%, 80%)",    // 隨機生成顏色
          weight: 2,            // 邊界寬度
          color: "white",       // 邊界顏色
          fillOpacity: 0.9      // 填充透明度
        }),
        onEachFeature: (feature, layer) => {    // 設定事件
          const name = feature.properties.NAME || "County";   // 取得縣市名
          window.currentCountyName = name.replace(/\s+/g, "");  // 去除空白字元
          layer.bindTooltip(name);    // 顯示縣市名

          layer.on("click", () => {     // 點擊縣市時
            const center = layer.getBounds().getCenter(); // 取得縣市的中心點
            const lat = center.lat;                       // 緯度
            const lon = center.lng;                       // 經度                 

            // 取得 forecast URL → 再抓七天預報
            fetch(`https://api.weather.gov/points/${lat},${lon}`)                   
              .then(res => res.json())          
              .then(data => fetch(data.properties.forecast))
              .then(res => res.json())                      
              .then(data => {                             // 取得資料
                const periods = data.properties.periods;  // 取得預報資料
                window.lastForecastData = periods;        // 記錄最新預報資料
                let html = "";                            // 空字串

                // 攝氏轉換用函式
                const fToC = f => ((f - 32) * 5 / 9).toFixed(1);   

                // 取出未來 1-7 天的資料（共 14 筆：白天/夜晚交替）
                for (let i = 0; i < Math.min(14, periods.length); i++) {             
                  const p = periods[i];       
                  const tempC = fToC(p.temperature);        
                  html += `<div><strong>${p.name}</strong>: ${p.detailedForecast}（約 ${tempC}°C）</div>`;
                }

                const firstTempC = fToC(periods[0].temperature);      // 取得第一天的溫度
                document.getElementById("weather-info").innerText =     
                  `${name} 當前預測：約 ${firstTempC}°C`;               // 顯示當前預測 

                document.getElementById("forecast-info").innerHTML = html;  // 顯示預報資料

                // 動態產生下載按鈕與成功訊息
                const container = document.getElementById("forecast-info");       

                // 刪除舊按鈕與訊息
                const oldBtn = document.getElementById("save-forecast-btn");        
                if (oldBtn) oldBtn.remove();                  
                const oldStatus = document.getElementById("save-status");
                if (oldStatus) oldStatus.remove();            

                const btn = document.createElement("button");           
                //btn.id = "save-forecast-btn";               
                btn.className = "base-btn download-btn";  // 使用 base-btn 類別
                btn.innerText = "下載\n預報 CSV";              
                //btn.style.marginTop = "10px"; 
                //btn.style.borderRadius = "5px";
                btn.style.innerText = "下載\n預報 CSV";           
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
