const HELPER_SETTINGS_LOCALES = {
  ru: {
    language_name: "Русский",
    hero_subtitle:
      "Фоновое приложение для расширения: получение форматов, очередь загрузок, cookies, автозапуск и сохранение видео без отдельной установки ffmpeg.",
    health_title: "Состояние",
    health_subtitle: "Быстрая проверка helper и встроенных зависимостей.",
    settings_title: "Настройки",
    settings_subtitle: "Изменения сохраняются локально и применяются для следующих загрузок.",
    refresh_button: "Обновить",
    status_ready: "Готово",
    status_loading: "Обновляем...",
    status_saving: "Сохраняем...",
    status_saved: "Настройки сохранены",
    request_failed: "Не удалось выполнить запрос",
    language_label: "Язык интерфейса",
    language_help: "Меняет язык popup, кнопок на YouTube и этой страницы настроек.",
    save_directory_label: "Папка сохранения",
    save_directory_help: "Итоговые видео и аудио сохраняются сюда.",
    default_mode_label: "Что делать по кнопке Скачать под видео",
    default_mode_help: "Эта настройка используется для быстрой кнопки прямо под видео.",
    default_mode_best: "Скачать лучшее доступное",
    default_mode_video: "Скачать видео со звуком",
    default_mode_audio: "Скачать только аудио",
    preferred_audio_format_label: "Аудио-формат по умолчанию",
    preferred_audio_format_help: "Нужно только для режима только аудио.",
    cookie_source_label: "Источник cookies",
    cookie_source_help:
      "Нужно для видео, где YouTube просит авторизацию, подтверждение возраста или bot-check.",
    cookie_source_auto: "Авто: сначала без cookies, затем поддерживаемые браузеры",
    cookie_source_browser: "Брать cookies из браузера",
    cookie_source_file: "Использовать cookies.txt",
    cookie_source_none: "Никогда не использовать cookies",
    cookie_browser_label: "Браузер для чтения cookies",
    cookie_browser_help:
      "Используется только если выше выбран режим Брать cookies из браузера. Для Яндекс Браузера надёжнее использовать cookies.txt.",
    cookie_browser_profile_label: "Профиль браузера",
    cookie_browser_profile_help: "Оставь пустым, если не знаешь точное имя профиля.",
    cookie_file_path_label: "Путь к cookies.txt",
    cookie_file_path_help: "Используй этот режим, если YouTube требует авторизацию, а browser cookies не читаются.",
    ffmpeg_title: "ffmpeg уже встроен.",
    ffmpeg_help:
      "Отдельно ставить ffmpeg в систему не нужно. Если helper не сможет подготовить встроенный ffmpeg, он покажет понятную ошибку и попросит повторить первый запуск.",
    launch_at_startup_label: "Запускать helper автоматически при входе в Windows",
    launch_at_startup_help:
      "Если включено, кнопкой Скачать можно пользоваться без ручного запуска helper каждый раз.",
    minimize_to_tray_label: "Показывать helper в области уведомлений Windows",
    minimize_to_tray_help:
      "Возле часов появится иконка helper с меню: открыть настройки, папку загрузок и логи.",
    close_to_tray_label: "При закрытии оставлять helper работать в фоне",
    close_to_tray_help: "Полезно, если не хочешь случайно остановить загрузки.",
    show_completion_notifications_label: "Показывать уведомление после завершения загрузки",
    show_completion_notifications_help:
      "Если выключить, статус всё равно останется виден в панели расширения.",
    save_button: "Сохранить",
    open_downloads_button: "Открыть загрузки",
    open_logs_button: "Открыть логи",
    toast_downloads_opened: "Папка загрузок открыта",
    toast_logs_opened: "Папка логов открыта",
    health_helper: "Helper",
    health_helper_ready: "активен",
    health_helper_down: "недоступен",
    health_api: "API",
    health_downloads: "Папка загрузки",
    health_dependencies: "Зависимости",
    health_dependencies_ready: "встроены и готовы",
    health_ytdlp: "yt-dlp",
    health_ffmpeg: "ffmpeg",
    health_not_found: "не найден",
    health_ffmpeg_not_ready: "не подготовлен",
  },
  en: {
    language_name: "English",
    hero_subtitle:
      "Background application for the extension: format lookup, download queue, cookies, autostart, and video saving without a separate ffmpeg installation.",
    health_title: "Status",
    health_subtitle: "Quick helper and built-in dependency check.",
    settings_title: "Settings",
    settings_subtitle: "Changes are stored locally and used for the next downloads.",
    refresh_button: "Refresh",
    status_ready: "Ready",
    status_loading: "Refreshing...",
    status_saving: "Saving...",
    status_saved: "Settings saved",
    request_failed: "Request failed",
    language_label: "Interface language",
    language_help: "Changes the popup, YouTube buttons, and this settings page language.",
    save_directory_label: "Save folder",
    save_directory_help: "Final video and audio files are stored here.",
    default_mode_label: "What the Download button under the video does",
    default_mode_help: "This setting is used by the quick button directly under the video.",
    default_mode_best: "Download the best available format",
    default_mode_video: "Download video with audio",
    default_mode_audio: "Download audio only",
    preferred_audio_format_label: "Default audio format",
    preferred_audio_format_help: "Used only for the audio-only mode.",
    cookie_source_label: "Cookie source",
    cookie_source_help:
      "Needed for videos where YouTube asks for sign-in, age confirmation, or bot-check.",
    cookie_source_auto: "Auto: first without cookies, then supported browsers",
    cookie_source_browser: "Read cookies from browser",
    cookie_source_file: "Use cookies.txt",
    cookie_source_none: "Never use cookies",
    cookie_browser_label: "Browser for cookie reading",
    cookie_browser_help:
      "Used only when Read cookies from browser is selected. For Yandex Browser, cookies.txt is usually more reliable.",
    cookie_browser_profile_label: "Browser profile",
    cookie_browser_profile_help: "Leave empty if you do not know the exact profile name.",
    cookie_file_path_label: "Path to cookies.txt",
    cookie_file_path_help: "Use this mode if YouTube requires sign-in and browser cookies cannot be read.",
    ffmpeg_title: "ffmpeg is already bundled.",
    ffmpeg_help:
      "You do not need to install ffmpeg system-wide. If the helper cannot prepare the bundled ffmpeg runtime, it will show a clear error and ask you to repeat the first launch.",
    launch_at_startup_label: "Start the helper automatically when Windows starts",
    launch_at_startup_help:
      "When enabled, you can use the Download button without starting the helper manually every time.",
    minimize_to_tray_label: "Show the helper in the Windows notification area",
    minimize_to_tray_help:
      "A helper icon appears near the clock with quick actions for settings, downloads, and logs.",
    close_to_tray_label: "Keep the helper running in background when you close it",
    close_to_tray_help: "Useful if you do not want to stop downloads by accident.",
    show_completion_notifications_label: "Show a notification after a download finishes",
    show_completion_notifications_help:
      "If disabled, the status still remains visible in the extension popup.",
    save_button: "Save",
    open_downloads_button: "Open downloads",
    open_logs_button: "Open logs",
    toast_downloads_opened: "Downloads folder opened",
    toast_logs_opened: "Logs folder opened",
    health_helper: "Helper",
    health_helper_ready: "active",
    health_helper_down: "unavailable",
    health_api: "API",
    health_downloads: "Download folder",
    health_dependencies: "Dependencies",
    health_dependencies_ready: "bundled and ready",
    health_ytdlp: "yt-dlp",
    health_ffmpeg: "ffmpeg",
    health_not_found: "not found",
    health_ffmpeg_not_ready: "not prepared",
  },
};

function normalizeHelperLocale(locale) {
  if (!locale) {
    return "ru";
  }
  return Object.prototype.hasOwnProperty.call(HELPER_SETTINGS_LOCALES, locale) ? locale : "ru";
}

function helperMessage(locale, key, vars = {}) {
  const table = HELPER_SETTINGS_LOCALES[normalizeHelperLocale(locale)] || HELPER_SETTINGS_LOCALES.ru;
  const fallback = HELPER_SETTINGS_LOCALES.ru;
  let template = table[key] || fallback[key] || key;
  for (const [name, value] of Object.entries(vars)) {
    template = template.replaceAll(`{${name}}`, String(value));
  }
  return template;
}

globalThis.YTHelperI18N = {
  locales: HELPER_SETTINGS_LOCALES,
  normalizeLocale: normalizeHelperLocale,
  formatMessage: helperMessage,
};
