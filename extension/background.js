const HELPER_BASE = "http://127.0.0.1:45719";
const TRACKED_DOWNLOADS_KEY = "trackedDownloads";
const REFRESH_INTERVAL_MS = 1500;
const NOTIFICATION_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cb5b2d"/><stop offset="1" stop-color="#f28d35"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="#1d231d"/><path d="M64 24v46.5" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/><path d="M44 53l20 20 20-20" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><rect x="28" y="88" width="72" height="12" rx="6" fill="#f6efe6"/></svg>'
)}`;

let refreshTimer = null;

async function helperRequest(path, init = {}) {
  let response;

  try {
    response = await fetch(`${HELPER_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      ...init,
    });
  } catch {
    throw new Error(
      "Локальное приложение не отвечает. Запусти run_helper.cmd или собранный YouTubeDownloaderHelper.exe."
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Helper вернул ошибку ${response.status}`);
  }
  return payload;
}

async function getHelperSettings() {
  return helperRequest("/api/settings");
}

async function readTrackedDownloads() {
  const stored = await chrome.storage.local.get(TRACKED_DOWNLOADS_KEY);
  return Array.isArray(stored[TRACKED_DOWNLOADS_KEY]) ? stored[TRACKED_DOWNLOADS_KEY] : [];
}

async function writeTrackedDownloads(jobs) {
  const normalized = jobs
    .slice()
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
    .slice(0, 12);

  await chrome.storage.local.set({
    [TRACKED_DOWNLOADS_KEY]: normalized,
  });
  return normalized;
}

function isActiveState(state) {
  return state === "queued" || state === "running" || state === "downloading";
}

function upsertTrackedJob(jobs, job) {
  const next = jobs.filter((item) => item.job_id !== job.job_id);
  next.push(job);
  return next;
}

function pickDefaultOption(options, settings) {
  const safeOptions = Array.isArray(options) ? options : [];
  if (!safeOptions.length) {
    throw new Error("Helper не вернул ни одного доступного формата.");
  }

  const defaultMode = String(settings?.default_mode || "best").toLowerCase();
  const preferredAudioFormat = String(settings?.preferred_audio_format || "mp3").toLowerCase();

  if (defaultMode === "audio") {
    return (
      safeOptions.find((option) => option.kind === "audio" && option.container === preferredAudioFormat) ||
      safeOptions.find((option) => option.kind === "audio") ||
      safeOptions[0]
    );
  }

  if (defaultMode === "video") {
    return (
      safeOptions.find((option) => option.kind === "video") ||
      safeOptions.find((option) => option.kind === "best") ||
      safeOptions[0]
    );
  }

  return (
    safeOptions.find((option) => option.kind === "best") ||
    safeOptions.find((option) => option.kind === "video") ||
    safeOptions[0]
  );
}

async function createCompletionNotification(job, settings) {
  if (!settings?.show_completion_notifications) {
    return;
  }

  const title = job.title || "Загрузка завершена";
  const message = job.file_path
    ? `Файл сохранён: ${job.file_path}`
    : `${job.option_label || "Формат"} готов.`;

  await chrome.notifications.create(`yt-helper-${job.job_id}`, {
    type: "basic",
    iconUrl: NOTIFICATION_ICON,
    title,
    message,
    priority: 2,
  });
}

async function refreshTrackedDownloads() {
  const currentJobs = await readTrackedDownloads();
  if (!currentJobs.length) {
    return [];
  }

  let settings = null;
  let changed = false;
  const refreshedJobs = [];

  for (const job of currentJobs) {
    if (!isActiveState(job.state)) {
      refreshedJobs.push(job);
      continue;
    }

    try {
      const payload = await helperRequest(`/api/downloads/${job.job_id}`);
      const updatedJob = {
        ...job,
        ...payload,
        option_key: payload.option_key || job.option_key,
        option_label: payload.option_label || job.option_label,
      };

      if (updatedJob.state === "completed" && !job.notified_completion) {
        settings ??= await getHelperSettings().catch(() => ({ show_completion_notifications: true }));
        await createCompletionNotification(updatedJob, settings);
        updatedJob.notified_completion = true;
      } else {
        updatedJob.notified_completion = Boolean(job.notified_completion);
      }

      changed = changed || JSON.stringify(updatedJob) !== JSON.stringify(job);
      refreshedJobs.push(updatedJob);
    } catch (error) {
      refreshedJobs.push({
        ...job,
        state: "failed",
        message: error.message || "Не удалось обновить статус загрузки.",
        notified_completion: Boolean(job.notified_completion),
      });
      changed = true;
    }
  }

  return changed ? writeTrackedDownloads(refreshedJobs) : refreshedJobs;
}

async function ensureRefreshLoop() {
  if (refreshTimer !== null) {
    return;
  }

  const tick = async () => {
    refreshTimer = null;
    const jobs = await refreshTrackedDownloads().catch(() => []);
    if (jobs.some((job) => isActiveState(job.state))) {
      refreshTimer = self.setTimeout(tick, REFRESH_INTERVAL_MS);
    }
  };

  refreshTimer = self.setTimeout(tick, REFRESH_INTERVAL_MS);
}

async function startTrackedDownload(url, option, context = {}) {
  const currentJobs = await readTrackedDownloads();
  const duplicate = currentJobs.find(
    (job) => job.url === url && job.option_key === option.key && isActiveState(job.state)
  );

  if (duplicate) {
    return {
      ...duplicate,
      already_exists: true,
      option_label: duplicate.option_label || option.label,
    };
  }

  const payload = await helperRequest("/api/downloads", {
    method: "POST",
    body: JSON.stringify({
      url,
      option,
    }),
  });

  const job = {
    ...payload,
    job_id: payload.job_id,
    url,
    option_key: payload.option_key || option.key,
    option_label: payload.option_label || option.label,
    title: context.title || payload.title || null,
    notified_completion: false,
  };

  await writeTrackedDownloads(upsertTrackedJob(currentJobs, job));
  await ensureRefreshLoop();
  return job;
}

async function startDefaultDownload(url) {
  const [formats, settings] = await Promise.all([
    helperRequest("/api/formats", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
    getHelperSettings(),
  ]);
  const option = pickDefaultOption(formats.options, settings);
  const job = await startTrackedDownload(url, option, { title: formats.title });
  return {
    ...job,
    selected_option: option,
    title: formats.title || job.title || null,
  };
}

async function openSettingsPage() {
  await chrome.tabs.create({ url: `${HELPER_BASE}/settings` });
  return { ok: true };
}

async function handleMessage(message) {
  if (!message?.type) {
    throw new Error("Неизвестный тип сообщения расширения.");
  }

  switch (message.type) {
    case "GET_FORMATS":
      return helperRequest("/api/formats", {
        method: "POST",
        body: JSON.stringify({ url: message.url }),
      });
    case "START_DOWNLOAD":
      return startTrackedDownload(message.url, message.option, { title: message.title });
    case "START_DEFAULT_DOWNLOAD":
      return startDefaultDownload(message.url);
    case "GET_DOWNLOAD_STATUS":
      return helperRequest(`/api/downloads/${message.jobId}`);
    case "GET_TRACKED_DOWNLOADS":
      if (message.refresh !== false) {
        return refreshTrackedDownloads();
      }
      return readTrackedDownloads();
    case "OPEN_SETTINGS":
      return openSettingsPage();
    case "GET_SETTINGS":
      return getHelperSettings();
    case "HEALTH":
      return helperRequest("/health");
    default:
      throw new Error(`Расширение не поддерживает действие ${message.type}`);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    helperBase: HELPER_BASE,
    [TRACKED_DOWNLOADS_KEY]: [],
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Локальное приложение недоступно.",
      });
    });

  return true;
});
