const helperStateNode = document.getElementById("helperState");
const statusNode = document.getElementById("status");
const optionsNode = document.getElementById("options");
const metaNode = document.getElementById("videoMeta");
const refreshButton = document.getElementById("refreshButton");
const settingsButton = document.getElementById("settingsButton");
const downloadsNode = document.getElementById("downloads");
const downloadsHintNode = document.getElementById("downloadsHint");
const toastNode = document.getElementById("toast");
const autostartToggle = document.getElementById("autostartToggle");
const autostartTitleNode = document.getElementById("autostartTitle");
const autostartHintNode = document.getElementById("autostartHint");
const languageSelect = document.getElementById("languageSelect");
const languageTitleNode = document.getElementById("languageTitle");
const languageHintNode = document.getElementById("languageHint");
const popupTitleNode = document.getElementById("popupTitle");
const popupSubtitleNode = document.getElementById("popupSubtitle");
const downloadsTitleNode = document.getElementById("downloadsTitle");

let currentVideoUrl = null;
let currentOptions = [];
let trackedJobs = [];
let refreshLoopId = null;
let startingOptionKey = null;
let settingsState = null;
let currentLocale = "ru";

function t(key, vars = {}) {
  return YTDI18N.formatMessage(currentLocale, key, vars);
}

async function persistUiLanguage(language) {
  await chrome.storage.local.set({ uiLanguage: language });
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || t("helper_unreachable")));
        return;
      }

      resolve(response.data);
    });
  });
}

async function getActiveTabVideoUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    throw new Error(t("tab_not_detected"));
  }

  const current = new URL(tab.url);
  const videoId = current.searchParams.get("v");
  if (current.hostname !== "www.youtube.com" || current.pathname !== "/watch" || !videoId) {
    throw new Error(t("open_youtube_video"));
  }

  return `${current.origin}/watch?v=${videoId}`;
}

function applyStaticTexts() {
  document.documentElement.lang = currentLocale;
  popupTitleNode.textContent = t("popup_title");
  popupSubtitleNode.textContent = t("popup_subtitle");
  refreshButton.textContent = t("btn_refresh");
  settingsButton.textContent = t("btn_settings");
  downloadsTitleNode.textContent = t("downloads_title");
  languageTitleNode.textContent = t("language_label");
  languageHintNode.textContent = t("language_hint");

  if (!helperStateNode.textContent.trim()) {
    helperStateNode.textContent = t("helper_checking");
  }
  if (!statusNode.textContent.trim()) {
    statusNode.textContent = t("status_waiting");
  }
  if (!metaNode.textContent.trim()) {
    metaNode.textContent = t("video_searching");
  }
  if (!trackedJobs.length) {
    downloadsHintNode.textContent = t("downloads_idle");
  }
}

function renderLanguageSelect() {
  const localeNames = Object.entries(YTDI18N.locales).map(([code, payload]) => ({
    code,
    name: payload.language_name || code,
  }));

  languageSelect.innerHTML = "";
  for (const item of localeNames) {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.name;
    option.selected = item.code === currentLocale;
    languageSelect.appendChild(option);
  }
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
    return { label: t("job_done"), icon: "OK", state: "success" };
  }
  if (job.state === "failed") {
    return { label: job.message || t("job_error"), icon: "ERR", state: "error" };
  }
  const progress = typeof job.progress === "number" ? `${job.progress.toFixed(1)}%` : t("job_working");
  return {
    label: `${job.message || t("status_downloading")} ${progress}`.trim(),
    icon: "...",
    state: "busy",
  };
}

function renderTrackedDownloads() {
  downloadsNode.innerHTML = "";

  if (!trackedJobs.length) {
    downloadsHintNode.textContent = t("downloads_empty");
    return;
  }

  const activeCount = trackedJobs.filter((job) => job.state !== "completed" && job.state !== "failed").length;
  downloadsHintNode.textContent = activeCount
    ? t("active_downloads", { count: activeCount })
    : t("recent_downloads");

  for (const job of trackedJobs.slice(0, 4)) {
    const card = document.createElement("article");
    const visual = getJobVisualState(job);
    card.className = "ytd-helper-popup__download";
    card.dataset.state = visual.state;

    const title = document.createElement("div");
    title.className = "ytd-helper-popup__download-title";
    title.textContent = job.title || job.option_label || t("downloads_title");

    const meta = document.createElement("div");
    meta.className = "ytd-helper-popup__download-meta";
    meta.textContent = job.option_label || t("job_default_format");

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
      button.textContent = `${option.label} ${t("btn_busy_suffix")}`;
    }

    button.addEventListener("click", async () => {
      startingOptionKey = option.key;
      renderOptions();
      setStatus(t("start_downloading", { label: option.label }), "busy");

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
          ? t("already_downloading", { label: job.option_label || option.label })
          : t("resolution_started", { label: option.label });
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

function renderAutostart() {
  const enabled = Boolean(settingsState?.launch_at_startup);
  autostartTitleNode.textContent = t("autostart_title");
  autostartToggle.checked = enabled;
  autostartToggle.disabled = false;
  autostartHintNode.textContent = enabled ? t("autostart_on") : t("autostart_off");
}

async function refreshTrackedDownloads() {
  try {
    trackedJobs = await sendMessage({ type: "GET_TRACKED_DOWNLOADS", refresh: true });
    renderTrackedDownloads();
    renderOptions();
  } catch {
    // Do not break the popup UI if only the status refresh fails.
  }
}

async function loadSettings() {
  try {
    settingsState = await sendMessage({ type: "GET_SETTINGS" });
    currentLocale = YTDI18N.normalizeLocale(settingsState.language || "ru");
    renderLanguageSelect();
    applyStaticTexts();
    renderAutostart();
  } catch (error) {
    autostartToggle.disabled = true;
    autostartHintNode.textContent = error.message;
  }
}

async function ensureHelperReady() {
  try {
    const health = await sendMessage({ type: "HEALTH" });
    setHelperState(t("helper_ready", { host: health.host, port: health.port }), "success");
    return health;
  } catch (error) {
    setHelperState(error.message, "error");
    setStatus(t("helper_not_running"), "error");
    throw error;
  }
}

async function loadFormats() {
  currentOptions = [];
  currentVideoUrl = null;
  optionsNode.innerHTML = "";
  metaNode.textContent = t("video_searching");

  await refreshTrackedDownloads();

  try {
    await ensureHelperReady();
    await loadSettings();
  } catch {
    return;
  }

  try {
    currentVideoUrl = await getActiveTabVideoUrl();
  } catch (error) {
    metaNode.textContent = t("open_tab_for_quality");
    setStatus(error.message, "error");
    return;
  }

  setStatus(t("fetching_formats"), "busy");

  try {
    const data = await sendMessage({
      type: "GET_FORMATS",
      url: currentVideoUrl,
    });

    metaNode.textContent = data.title || currentVideoUrl;
    currentOptions = Array.isArray(data.options) ? data.options : [];
    renderOptions();
    setStatus(t("choose_quality_or_default"), "idle");
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
    showToast(t("helper_opened"), "ok");
  } catch (error) {
    showToast(error.message, "error");
  }
});

autostartToggle.addEventListener("change", async () => {
  autostartToggle.disabled = true;
  try {
    const result = await sendMessage({
      type: "UPDATE_SETTINGS",
      patch: {
        launch_at_startup: autostartToggle.checked,
      },
    });
    settingsState = result.settings;
    renderAutostart();
    showToast(
      autostartToggle.checked ? t("autostart_enabled") : t("autostart_disabled"),
      "ok"
    );
  } catch (error) {
    autostartToggle.checked = Boolean(settingsState?.launch_at_startup);
    autostartToggle.disabled = false;
    showToast(error.message, "error");
  }
});

languageSelect.addEventListener("change", async () => {
  const nextLocale = YTDI18N.normalizeLocale(languageSelect.value);
  languageSelect.disabled = true;
  try {
    const result = await sendMessage({
      type: "UPDATE_SETTINGS",
      patch: {
        language: nextLocale,
      },
    });
    settingsState = result.settings;
    currentLocale = YTDI18N.normalizeLocale(result.settings.language || nextLocale);
    await persistUiLanguage(currentLocale);
    renderLanguageSelect();
    applyStaticTexts();
    renderTrackedDownloads();
    renderOptions();
    renderAutostart();
    await refreshTrackedDownloads();
    showToast(`${t("language_label")}: ${YTDI18N.locales[currentLocale].language_name}`, "ok");
  } catch (error) {
    languageSelect.value = currentLocale;
    showToast(error.message, "error");
  } finally {
    languageSelect.disabled = false;
  }
});

applyStaticTexts();
renderLanguageSelect();
startRefreshLoop();
loadFormats();
