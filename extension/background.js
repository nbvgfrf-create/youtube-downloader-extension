importScripts("i18n.js");

const HELPER_BASE = "http://127.0.0.1:45719";
const TRACKED_DOWNLOADS_KEY = "trackedDownloads";
const REFRESH_INTERVAL_MS = 1500;
const FINISHED_JOB_TTL_MS = 1000 * 60 * 60 * 12;
const NOTIFICATION_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cb5b2d"/><stop offset="1" stop-color="#f28d35"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="#1d231d"/><path d="M64 24v46.5" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/><path d="M44 53l20 20 20-20" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><rect x="28" y="88" width="72" height="12" rx="6" fill="#f6efe6"/></svg>'
)}`;

let refreshTimer = null;

async function getCurrentLocale() {
  const data = await chrome.storage.local.get("uiLanguage");
  return YTDI18N.normalizeLocale(data.uiLanguage || "ru");
}

async function t(key, vars = {}) {
  return YTDI18N.formatMessage(await getCurrentLocale(), key, vars);
}

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
    throw new Error(await t("helper_unreachable"));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Helper returned error ${response.status}`);
  }
  return payload;
}

async function getHelperSettings() {
  return helperRequest("/api/settings");
}

async function updateHelperSettings(patch) {
  const current = await getHelperSettings();
  const next = await helperRequest("/api/settings", {
    method: "POST",
    body: JSON.stringify({
      ...current,
      ...patch,
    }),
  });

  if (next?.settings?.language) {
    await chrome.storage.local.set({
      uiLanguage: YTDI18N.normalizeLocale(next.settings.language),
    });
  }

  return next;
}

async function readTrackedDownloads() {
  const stored = await chrome.storage.local.get(TRACKED_DOWNLOADS_KEY);
  return pruneTrackedDownloads(Array.isArray(stored[TRACKED_DOWNLOADS_KEY]) ? stored[TRACKED_DOWNLOADS_KEY] : []);
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

function getUpdatedAtTimestamp(job) {
  const parsed = Date.parse(job?.updated_at || job?.created_at || "");
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function pruneTrackedDownloads(jobs) {
  const now = Date.now();
  return jobs.filter((job) => {
    if (isActiveState(job.state)) {
      return true;
    }
    return now - getUpdatedAtTimestamp(job) <= FINISHED_JOB_TTL_MS;
  });
}

function isMissingJobError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("download was not found") ||
    message.includes("загрузка не найдена")
  );
}

function upsertTrackedJob(jobs, job) {
  const next = jobs.filter((item) => item.job_id !== job.job_id);
  next.push(job);
  return next;
}

async function pickDefaultOption(options, settings) {
  const safeOptions = Array.isArray(options) ? options : [];
  if (!safeOptions.length) {
    throw new Error(await t("helper_no_formats"));
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

  const title = job.title || (await t("helper_completed_title"));
  const message = job.file_path
    ? await t("helper_completed_file", { path: job.file_path })
    : await t("helper_completed_generic", { label: job.option_label || (await t("job_default_format")) });

  try {
    await chrome.notifications.create(`yt-helper-${job.job_id}`, {
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title,
      message,
      priority: 2,
    });
  } catch (error) {
    console.warn("Notification error", error);
  }
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
      if (isMissingJobError(error)) {
        changed = true;
        continue;
      }

      refreshedJobs.push({
        ...job,
        state: "failed",
        message: error.message || (await t("helper_refresh_failed")),
        notified_completion: Boolean(job.notified_completion),
      });
      changed = true;
    }
  }

  const prunedJobs = pruneTrackedDownloads(refreshedJobs);
  return changed || prunedJobs.length !== refreshedJobs.length ? writeTrackedDownloads(prunedJobs) : prunedJobs;
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
  const option = await pickDefaultOption(formats.options, settings);
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
    throw new Error(await t("unknown_message_type"));
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
    case "UPDATE_SETTINGS":
      return updateHelperSettings(message.patch || {});
    case "HEALTH":
      return helperRequest("/health");
    default:
      throw new Error(await t("action_not_supported", { type: message.type }));
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    helperBase: HELPER_BASE,
    [TRACKED_DOWNLOADS_KEY]: [],
    uiLanguage: "ru",
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch(async (error) => {
      sendResponse({
        ok: false,
        error: error?.message || (await t("helper_unreachable")),
      });
    });

  return true;
});
