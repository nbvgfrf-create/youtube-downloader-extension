const helperStateNode = document.getElementById("helperState");
const statusNode = document.getElementById("status");
const optionsNode = document.getElementById("options");
const metaNode = document.getElementById("videoMeta");
const refreshButton = document.getElementById("refreshButton");
const settingsButton = document.getElementById("settingsButton");
const downloadsNode = document.getElementById("downloads");
const downloadsHintNode = document.getElementById("downloadsHint");
const toastNode = document.getElementById("toast");

let currentVideoUrl = null;
let currentOptions = [];
let trackedJobs = [];
let refreshLoopId = null;
let startingOptionKey = null;

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Не удалось связаться с helper."));
        return;
      }

      resolve(response.data);
    });
  });
}

async function getActiveTabVideoUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    throw new Error("Не удалось определить активную вкладку.");
  }

  const current = new URL(tab.url);
  const videoId = current.searchParams.get("v");
  if (current.hostname !== "www.youtube.com" || current.pathname !== "/watch" || !videoId) {
    throw new Error("Открой страницу YouTube-видео, чтобы увидеть список качеств.");
  }

  return `${current.origin}/watch?v=${videoId}`;
}

function setStatus(text, state = "idle") {
  statusNode.textContent = text;
  statusNode.dataset.state = state;
}

function setHelperState(text, state = "idle") {
  helperStateNode.textContent = text;
  helperStateNode.dataset.state = state;
}

function showToast(text, kind = "ok") {
  toastNode.hidden = false;
  toastNode.textContent = text;
  toastNode.dataset.kind = kind;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastNode.hidden = true;
  }, 2800);
}

function getJobVisualState(job) {
  if (job.state === "completed") {
    return { label: "Готово", icon: "✓", state: "success" };
  }
  if (job.state === "failed") {
    return { label: job.message || "Ошибка", icon: "!", state: "error" };
  }
  const progress = typeof job.progress === "number" ? `${job.progress.toFixed(1)}%` : "В работе";
  return { label: `${job.message || "Скачивание"} ${progress}`.trim(), icon: "…" , state: "busy" };
}

function renderTrackedDownloads() {
  downloadsNode.innerHTML = "";

  if (!trackedJobs.length) {
    downloadsHintNode.textContent = "Пока нет активных загрузок";
    return;
  }

  const activeCount = trackedJobs.filter((job) => job.state !== "completed" && job.state !== "failed").length;
  downloadsHintNode.textContent = activeCount
    ? `Активных: ${activeCount}`
    : "Последние завершённые загрузки";

  for (const job of trackedJobs.slice(0, 4)) {
    const card = document.createElement("article");
    const visual = getJobVisualState(job);
    card.className = "ytd-helper-popup__download";
    card.dataset.state = visual.state;

    const title = document.createElement("div");
    title.className = "ytd-helper-popup__download-title";
    title.textContent = job.title || job.option_label || "Загрузка";

    const meta = document.createElement("div");
    meta.className = "ytd-helper-popup__download-meta";
    meta.textContent = job.option_label || "Формат по умолчанию";

    const label = document.createElement("div");
    label.className = "ytd-helper-popup__download-status";
    label.textContent = `${visual.icon} ${visual.label}`;

    const progress = document.createElement("div");
    progress.className = "ytd-helper-popup__progress";

    const progressFill = document.createElement("div");
    progressFill.className = "ytd-helper-popup__progress-fill";
    progressFill.style.width = `${Math.max(4, Math.min(100, Number(job.progress) || 0))}%`;
    if (job.state === "completed") {
      progressFill.style.width = "100%";
    }
    progress.appendChild(progressFill);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(progress);
    card.appendChild(label);
    downloadsNode.appendChild(card);
  }
}

function isOptionBusy(option) {
  return trackedJobs.some(
    (job) =>
      job.url === currentVideoUrl &&
      job.option_key === option.key &&
      job.state !== "completed" &&
      job.state !== "failed"
  );
}

function renderOptions() {
  optionsNode.innerHTML = "";

  for (const option of currentOptions) {
    const button = document.createElement("button");
    button.className = "ytd-helper-popup__option";
    button.textContent = option.label;
    const busy = isOptionBusy(option) || startingOptionKey === option.key;
    button.disabled = busy;
    if (busy) {
      button.dataset.busy = "true";
      button.textContent = `${option.label} • уже в работе`;
    }

    button.addEventListener("click", async () => {
      startingOptionKey = option.key;
      renderOptions();
      setStatus(`Запускаем ${option.label}...`, "busy");

      try {
        const job = await sendMessage({
          type: "START_DOWNLOAD",
          url: currentVideoUrl,
          option,
        });

        trackedJobs = await sendMessage({ type: "GET_TRACKED_DOWNLOADS", refresh: true });
        renderTrackedDownloads();
        renderOptions();

        const text = job.already_exists
          ? `Уже скачивается: ${job.option_label || option.label}`
          : `Загрузка в разрешении ${option.label} началась`;
        showToast(text, job.already_exists ? "warn" : "ok");
        setStatus(text, job.already_exists ? "busy" : "success");
      } catch (error) {
        setStatus(error.message, "error");
        showToast(error.message, "error");
      } finally {
        startingOptionKey = null;
        renderOptions();
      }
    });

    optionsNode.appendChild(button);
  }
}

async function refreshTrackedDownloads() {
  try {
    trackedJobs = await sendMessage({ type: "GET_TRACKED_DOWNLOADS", refresh: true });
    renderTrackedDownloads();
    renderOptions();
  } catch {
    // Не сбиваем UI, если helper временно не ответил именно на обновление прогресса.
  }
}

async function ensureHelperReady() {
  try {
    const health = await sendMessage({ type: "HEALTH" });
    setHelperState(`Helper активен: ${health.host}:${health.port}`, "success");
    return health;
  } catch (error) {
    setHelperState(error.message, "error");
    setStatus("Helper не запущен", "error");
    throw error;
  }
}

async function loadFormats() {
  currentOptions = [];
  currentVideoUrl = null;
  optionsNode.innerHTML = "";
  metaNode.textContent = "Ищем активное видео...";

  await refreshTrackedDownloads();

  try {
    await ensureHelperReady();
  } catch {
    return;
  }

  try {
    currentVideoUrl = await getActiveTabVideoUrl();
  } catch (error) {
    metaNode.textContent = "Открой вкладку с YouTube-видео, чтобы выбрать качество";
    setStatus(error.message, "error");
    return;
  }

  setStatus("Получаем форматы...", "busy");

  try {
    const data = await sendMessage({
      type: "GET_FORMATS",
      url: currentVideoUrl,
    });

    metaNode.textContent = data.title || currentVideoUrl;
    currentOptions = Array.isArray(data.options) ? data.options : [];
    renderOptions();
    setStatus("Выбери качество или нажми кнопку под видео для загрузки по умолчанию", "idle");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function startRefreshLoop() {
  window.clearInterval(refreshLoopId);
  refreshLoopId = window.setInterval(refreshTrackedDownloads, 1500);
}

refreshButton.addEventListener("click", loadFormats);
settingsButton.addEventListener("click", async () => {
  try {
    await sendMessage({ type: "OPEN_SETTINGS" });
    showToast("Настройки helper открыты", "ok");
  } catch (error) {
    showToast(error.message, "error");
  }
});

startRefreshLoop();
loadFormats();
