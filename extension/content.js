const ROOT_ID = "yt-helper-download-root";
const STYLE_ID = "yt-helper-style-link";

let currentLocale = "ru";

function t(key, vars = {}) {
  return YTDI18N.formatMessage(currentLocale, key, vars);
}

async function loadUiLanguage() {
  const stored = await chrome.storage.local.get("uiLanguage");
  currentLocale = YTDI18N.normalizeLocale(stored.uiLanguage || "ru");
}

function isWatchPage() {
  return location.pathname === "/watch" && new URL(location.href).searchParams.has("v");
}

function cleanVideoUrl() {
  const current = new URL(location.href);
  const videoId = current.searchParams.get("v");
  return videoId ? `${current.origin}/watch?v=${videoId}` : location.href;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("styles.css");
  document.head.appendChild(link);
}

function findMountPoint() {
  const inlineSelectors = [
    "ytd-watch-metadata #top-level-buttons-computed",
    "#above-the-fold #top-level-buttons-computed",
    "#top-level-buttons-computed",
  ];

  for (const selector of inlineSelectors) {
    const node = document.querySelector(selector);
    if (node) {
      return { node, variant: "inline" };
    }
  }

  const blockSelectors = [
    "ytd-watch-metadata #actions-inner",
    "#above-the-fold #actions-inner",
    "#above-the-fold ytd-watch-metadata",
    "#above-the-fold",
  ];

  for (const selector of blockSelectors) {
    const node = document.querySelector(selector);
    if (node) {
      return { node, variant: "block" };
    }
  }

  return document.body ? { node: document.body, variant: "floating" } : null;
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

function showToast(root, text, kind = "info") {
  let toast = root.querySelector(".ytd-helper__toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "ytd-helper__toast";
    root.appendChild(toast);
  }

  toast.textContent = text;
  toast.dataset.kind = kind;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function createOptionButton(option, videoUrl, statusNode, onStart) {
  const button = document.createElement("button");
  button.className = "ytd-helper__option";
  button.textContent = option.label;
  button.addEventListener("click", async () => {
    await onStart({
      url: videoUrl,
      option,
      button,
      statusNode,
    });
  });
  return button;
}

function formatJobMessage(job) {
  if (job.state === "completed") {
    return t("status_completed");
  }
  if (job.state === "failed") {
    return job.message || t("status_failed");
  }
  const progress = typeof job.progress === "number" ? ` ${job.progress.toFixed(1)}%` : "";
  return `${job.message || t("status_downloading")}${progress}`;
}

function pollJob(jobId, statusNode) {
  window.clearInterval(pollJob.currentTimer);
  pollJob.currentTimer = window.setInterval(async () => {
    try {
      const job = await sendMessage({
        type: "GET_DOWNLOAD_STATUS",
        jobId,
      });

      statusNode.textContent = formatJobMessage(job);
      statusNode.dataset.state =
        job.state === "completed" ? "success" : job.state === "failed" ? "error" : "busy";

      if (job.state === "completed" || job.state === "failed") {
        window.clearInterval(pollJob.currentTimer);
      }
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.dataset.state = "error";
      window.clearInterval(pollJob.currentTimer);
    }
  }, 1500);
}

async function populatePanel(panel, videoUrl, statusNode, onStart) {
  panel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "ytd-helper__header";
  header.textContent = t("panel_loading");
  panel.appendChild(header);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "ytd-helper__options";
  panel.appendChild(optionsWrap);

  try {
    const data = await sendMessage({
      type: "GET_FORMATS",
      url: videoUrl,
    });

    header.textContent = data.title || t("panel_formats");
    for (const option of data.options || []) {
      optionsWrap.appendChild(createOptionButton(option, videoUrl, statusNode, onStart));
    }
    statusNode.textContent = t("panel_choose");
    statusNode.dataset.state = "idle";
  } catch (error) {
    header.textContent = t("panel_error");
    statusNode.textContent = error.message;
    statusNode.dataset.state = "error";
    panel.dataset.loadedFor = "";
  }
}

function buildUi(videoUrl, variant) {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "ytd-helper";
  root.dataset.videoUrl = videoUrl;
  root.dataset.variant = variant;

  if (variant === "block") {
    root.classList.add("ytd-helper--block");
  }
  if (variant === "floating") {
    root.classList.add("ytd-helper--floating");
  }

  const mainButton = document.createElement("button");
  mainButton.className = "ytd-helper__button";
  mainButton.textContent = t("download_button");

  const menuButton = document.createElement("button");
  menuButton.className = "ytd-helper__button ytd-helper__button--secondary";
  menuButton.textContent = t("quality_button");

  const panel = document.createElement("div");
  panel.className = "ytd-helper__panel";
  panel.hidden = true;

  const statusNode = document.createElement("div");
  statusNode.className = "ytd-helper__status";
  statusNode.textContent = t("status_idle");

  function setBusyState(isBusy) {
    mainButton.disabled = isBusy;
    menuButton.disabled = isBusy;
  }

  async function handleStart({ option = null, sourceButton = null } = {}) {
    const message = option
      ? { type: "START_DOWNLOAD", url: videoUrl, option }
      : { type: "START_DEFAULT_DOWNLOAD", url: videoUrl };

    statusNode.textContent = option
      ? t("start_downloading", { label: option.label })
      : t("start_default");
    statusNode.dataset.state = "busy";
    setBusyState(true);
    if (sourceButton) {
      sourceButton.disabled = true;
    }

    try {
      const job = await sendMessage(message);
      const optionLabel =
        job.option_label || job.selected_option?.label || option?.label || t("selected_format");
      const toastText = job.already_exists
        ? t("already_downloading", { label: optionLabel })
        : t("default_download_started", { label: optionLabel });

      statusNode.textContent = toastText;
      statusNode.dataset.state = job.already_exists ? "busy" : "success";
      showToast(root, toastText, job.already_exists ? "warn" : "success");
      pollJob(job.job_id, statusNode);
      panel.hidden = true;
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.dataset.state = "error";
      showToast(root, error.message, "error");
    } finally {
      setBusyState(false);
      if (sourceButton) {
        sourceButton.disabled = false;
      }
    }
  }

  mainButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await handleStart();
  });

  menuButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden && panel.dataset.loadedFor !== videoUrl) {
      panel.dataset.loadedFor = videoUrl;
      await populatePanel(panel, videoUrl, statusNode, async ({ option, button }) => {
        await handleStart({ option, sourceButton: button });
      });
    }
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) {
      panel.hidden = true;
    }
  });

  root.appendChild(mainButton);
  root.appendChild(menuButton);
  root.appendChild(statusNode);
  root.appendChild(panel);
  return root;
}

function ensureUi() {
  ensureStyles();

  if (!isWatchPage()) {
    document.getElementById(ROOT_ID)?.remove();
    return;
  }

  const mountPoint = findMountPoint();
  if (!mountPoint) {
    return;
  }

  const videoUrl = cleanVideoUrl();
  const existing = document.getElementById(ROOT_ID);
  if (
    existing?.dataset.videoUrl === videoUrl &&
    existing.dataset.variant === mountPoint.variant &&
    existing.parentElement === mountPoint.node
  ) {
    return;
  }

  existing?.remove();
  const ui = buildUi(videoUrl, mountPoint.variant);
  if (mountPoint.variant === "floating") {
    mountPoint.node.appendChild(ui);
  } else {
    mountPoint.node.prepend(ui);
  }
}

let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
  }
  ensureUi();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.uiLanguage) {
    return;
  }
  currentLocale = YTDI18N.normalizeLocale(changes.uiLanguage.newValue || "ru");
  document.getElementById(ROOT_ID)?.remove();
  ensureUi();
});

document.addEventListener("yt-navigate-finish", ensureUi);
window.addEventListener("popstate", ensureUi);
window.setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    ensureUi();
  }
}, 1000);

loadUiLanguage().finally(() => {
  ensureUi();
});
