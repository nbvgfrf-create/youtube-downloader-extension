const toastNode = document.getElementById("toast");
const healthNode = document.getElementById("health");
const statusNode = document.getElementById("status");
const form = document.getElementById("settingsForm");
const saveButton = document.getElementById("saveButton");
const refreshButton = document.getElementById("refreshButton");
const cookieSourceNode = document.getElementById("cookieSource");
const browserCookieFields = document.getElementById("browserCookieFields");
const cookieFileField = document.getElementById("cookieFileField");
const languageNode = document.getElementById("language");

let currentLocale = "ru";
let currentSettings = null;

function t(key, vars = {}) {
  return YTHelperI18N.formatMessage(currentLocale, key, vars);
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || t("request_failed"));
  }
  return payload;
}

function showToast(text, kind = "ok") {
  toastNode.hidden = false;
  toastNode.textContent = text;
  toastNode.dataset.kind = kind;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastNode.hidden = true;
  }, 3200);
}

function setStatus(text, kind = "idle") {
  statusNode.textContent = text;
  statusNode.dataset.kind = kind;
}

function fillLanguageOptions() {
  languageNode.innerHTML = "";
  for (const [code, payload] of Object.entries(YTHelperI18N.locales)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = payload.language_name || code;
    option.selected = code === currentLocale;
    languageNode.appendChild(option);
  }
}

function applyTexts() {
  document.documentElement.lang = currentLocale;
  document.title = "YouTube Downloader Helper";

  document.getElementById("heroSubtitle").textContent = t("hero_subtitle");
  document.getElementById("healthTitle").textContent = t("health_title");
  document.getElementById("healthSubtitle").textContent = t("health_subtitle");
  document.getElementById("settingsTitle").textContent = t("settings_title");
  document.getElementById("settingsSubtitle").textContent = t("settings_subtitle");
  refreshButton.textContent = t("refresh_button");

  document.getElementById("languageLabel").textContent = t("language_label");
  document.getElementById("languageHelp").textContent = t("language_help");
  document.getElementById("saveDirectoryLabel").textContent = t("save_directory_label");
  document.getElementById("saveDirectoryHelp").textContent = t("save_directory_help");
  document.getElementById("defaultModeLabel").textContent = t("default_mode_label");
  document.getElementById("defaultModeHelp").textContent = t("default_mode_help");
  document.getElementById("preferredAudioFormatLabel").textContent = t("preferred_audio_format_label");
  document.getElementById("preferredAudioFormatHelp").textContent = t("preferred_audio_format_help");
  document.getElementById("cookieSourceLabel").textContent = t("cookie_source_label");
  document.getElementById("cookieSourceHelp").textContent = t("cookie_source_help");
  document.getElementById("cookieBrowserLabel").textContent = t("cookie_browser_label");
  document.getElementById("cookieBrowserHelp").textContent = t("cookie_browser_help");
  document.getElementById("cookieBrowserProfileLabel").textContent = t("cookie_browser_profile_label");
  document.getElementById("cookieBrowserProfileHelp").textContent = t("cookie_browser_profile_help");
  document.getElementById("cookieFilePathLabel").textContent = t("cookie_file_path_label");
  document.getElementById("cookieFilePathHelp").textContent = t("cookie_file_path_help");
  document.getElementById("ffmpegTitle").textContent = t("ffmpeg_title");
  document.getElementById("ffmpegHelp").textContent = t("ffmpeg_help");
  document.getElementById("launchAtStartupLabel").textContent = t("launch_at_startup_label");
  document.getElementById("launchAtStartupHelp").textContent = t("launch_at_startup_help");
  document.getElementById("minimizeToTrayLabel").textContent = t("minimize_to_tray_label");
  document.getElementById("minimizeToTrayHelp").textContent = t("minimize_to_tray_help");
  document.getElementById("closeToTrayLabel").textContent = t("close_to_tray_label");
  document.getElementById("closeToTrayHelp").textContent = t("close_to_tray_help");
  document.getElementById("showCompletionNotificationsLabel").textContent = t("show_completion_notifications_label");
  document.getElementById("showCompletionNotificationsHelp").textContent = t("show_completion_notifications_help");
  document.getElementById("saveButton").textContent = t("save_button");
  document.getElementById("openDownloadsButton").textContent = t("open_downloads_button");
  document.getElementById("openLogsButton").textContent = t("open_logs_button");

  for (const option of document.querySelectorAll("[data-i18n]")) {
    option.textContent = t(option.dataset.i18n);
  }

  fillLanguageOptions();
  if (!statusNode.textContent.trim()) {
    setStatus(t("status_ready"), "ok");
  }
}

function renderHealth(payload) {
  const missing = payload.missing_dependencies?.length
    ? payload.missing_dependencies.join(", ")
    : t("health_dependencies_ready");
  const details = payload.dependency_details || {};

  healthNode.innerHTML = `
    <article>
      <span class="label">${t("health_helper")}</span>
      <strong>${payload.ready ? t("health_helper_ready") : t("health_helper_down")}</strong>
    </article>
    <article>
      <span class="label">${t("health_api")}</span>
      <strong>${payload.host}:${payload.port}</strong>
    </article>
    <article>
      <span class="label">${t("health_downloads")}</span>
      <strong>${payload.save_directory}</strong>
    </article>
    <article>
      <span class="label">${t("health_dependencies")}</span>
      <strong>${missing}</strong>
    </article>
    <article>
      <span class="label">${t("health_ytdlp")}</span>
      <strong>${details.yt_dlp || t("health_not_found")}</strong>
    </article>
    <article>
      <span class="label">${t("health_ffmpeg")}</span>
      <strong>${details.ffmpeg || t("health_ffmpeg_not_ready")}</strong>
    </article>
  `;
}

function syncCookieFields() {
  const source = cookieSourceNode.value;
  browserCookieFields.hidden = !(source === "browser" || source === "auto");
  cookieFileField.hidden = source !== "file";
}

function fillForm(settings) {
  currentSettings = settings;
  currentLocale = YTHelperI18N.normalizeLocale(settings.language || currentLocale || "ru");
  applyTexts();

  document.getElementById("saveDirectory").value = settings.save_directory || "";
  document.getElementById("defaultMode").value = settings.default_mode || "best";
  document.getElementById("preferredAudioFormat").value = settings.preferred_audio_format || "mp3";
  document.getElementById("launchAtStartup").checked = Boolean(settings.launch_at_startup);
  document.getElementById("minimizeToTray").checked = Boolean(settings.minimize_to_tray);
  document.getElementById("closeToTray").checked = Boolean(settings.close_to_tray);
  document.getElementById("showCompletionNotifications").checked = settings.show_completion_notifications !== false;
  document.getElementById("cookieSource").value = settings.cookie_source || "auto";
  document.getElementById("cookieBrowser").value = settings.cookie_browser || "edge";
  document.getElementById("cookieBrowserProfile").value = settings.cookie_browser_profile || "";
  document.getElementById("cookieFilePath").value = settings.cookie_file_path || "";
  document.getElementById("language").value = currentLocale;
  syncCookieFields();
}

async function load() {
  setStatus(t("status_loading"), "busy");
  try {
    const [health, settings] = await Promise.all([
      jsonRequest("/health"),
      jsonRequest("/api/settings"),
    ]);
    fillForm(settings);
    renderHealth(health);
    setStatus(t("status_ready"), "ok");
  } catch (error) {
    setStatus(error.message, "error");
    showToast(error.message, "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(t("status_saving"), "busy");
  saveButton.disabled = true;

  const payload = {
    save_directory: document.getElementById("saveDirectory").value.trim(),
    default_mode: document.getElementById("defaultMode").value,
    preferred_audio_format: document.getElementById("preferredAudioFormat").value,
    launch_at_startup: document.getElementById("launchAtStartup").checked,
    minimize_to_tray: document.getElementById("minimizeToTray").checked,
    close_to_tray: document.getElementById("closeToTray").checked,
    show_completion_notifications: document.getElementById("showCompletionNotifications").checked,
    cookie_source: document.getElementById("cookieSource").value,
    cookie_browser: document.getElementById("cookieBrowser").value,
    cookie_browser_profile: document.getElementById("cookieBrowserProfile").value.trim(),
    cookie_file_path: document.getElementById("cookieFilePath").value.trim(),
    language: YTHelperI18N.normalizeLocale(document.getElementById("language").value),
  };

  try {
    const result = await jsonRequest("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    fillForm(result.settings);
    await load();
    setStatus(result.message || t("status_saved"), "ok");
    showToast(result.message || t("status_saved"));
  } catch (error) {
    setStatus(error.message, "error");
    showToast(error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
});

refreshButton.addEventListener("click", load);
cookieSourceNode.addEventListener("change", syncCookieFields);

languageNode.addEventListener("change", () => {
  currentLocale = YTHelperI18N.normalizeLocale(languageNode.value);
  applyTexts();
  if (currentSettings) {
    document.getElementById("language").value = currentLocale;
  }
});

document.getElementById("openDownloadsButton").addEventListener("click", async () => {
  try {
    const result = await jsonRequest("/api/actions/open-downloads", { method: "POST", body: "{}" });
    showToast(result.message || t("toast_downloads_opened"));
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.getElementById("openLogsButton").addEventListener("click", async () => {
  try {
    const result = await jsonRequest("/api/actions/open-logs", { method: "POST", body: "{}" });
    showToast(result.message || t("toast_logs_opened"));
  } catch (error) {
    showToast(error.message, "error");
  }
});

applyTexts();
load();
