# YouTube Downloader: README для разработчиков

## Назначение

Репозиторий содержит:

- браузерное расширение для YouTube;
- локальный Python helper для скачивания, очереди задач и настроек;
- bootstrap первого запуска для Windows;
- шаблон сборки helper в `.exe`.

## Что считается production-ready в этом репозитории

- в git лежат только исходники, документация и скрипты;
- build-артефакты, `dist`, `.venv`, temp, логи и локальные конфиги не коммитятся;
- тяжёлые бинарники не хранятся в репозитории;
- зависимости подтягиваются на первом запуске.

## Структура проекта

```text
app/
  helper/
    yt_helper/        основной Python helper
extension/           браузерное расширение
docs/                дополнительные документы
installer/           шаблон Inno Setup
run_helper.cmd       основной пользовательский запуск
run_helper.ps1       bootstrap первого запуска
```

## Основные компоненты

### Extension

- `extension/i18n.js`
  Общий словарь интерфейса расширения.
- `extension/content.js`
  Встраивает кнопки под видео на YouTube.
- `extension/popup.js`
  Показывает popup, прогресс загрузок, выбор языка и toggle автозапуска helper.
- `extension/background.js`
  Связывает расширение с локальным helper API.

### Helper

- `app/helper/yt_helper/app.py`
  Точка входа helper.
- `app/helper/yt_helper/http_api.py`
  Локальный HTTP API на `127.0.0.1:45719`.
- `app/helper/yt_helper/download_manager.py`
  Очередь загрузок и статусы.
- `app/helper/yt_helper/yt_dlp_service.py`
  Работа с `yt-dlp`, скачивание, объединение дорожек и cookies.
- `app/helper/yt_helper/autostart.py`
  Работа с Windows autostart через реестр.
- `app/helper/yt_helper/static/settings.html`
  Локальная страница настроек helper.
- `app/helper/yt_helper/static/settings-i18n.js`
  Словарь локализации страницы настроек helper.
- `app/helper/yt_helper/static/settings.js`
  Логика страницы настроек helper.

## Локальный запуск

### Пользовательский сценарий

```powershell
.\run_helper.ps1
```

или:

```text
run_helper.cmd
```

### Что делает bootstrap

1. Ищет Python 3.11.
2. Если Python отсутствует, сначала пытается поставить его через `winget`, а затем через официальный установщик с python.org.
3. Создаёт `.venv`.
4. Устанавливает зависимости из `app/helper/requirements.txt`.
5. Прогревает встроенный `ffmpeg`.
6. Запускает helper через `pythonw`.

## Локализация и добавление нового языка

Сейчас проект поддерживает `ru` и `en`.

Чтобы добавить новый язык:

1. Добавь новый ключ языка в `extension/i18n.js`.
2. Заполни переводы для popup, inline-кнопок на YouTube и фоновых сообщений расширения.
3. Добавь такой же ключ языка в `app/helper/yt_helper/static/settings-i18n.js`.
4. Заполни переводы для страницы настроек helper.
5. Убедись, что код языка совпадает в обоих файлах, например `de`, `es`, `fr`.

Дополнительная регистрация не нужна:

- popup сам строит список языков из `extension/i18n.js`;
- settings page сама строит список языков из `settings-i18n.js`.

## Почему ffmpeg не должен лежать в репозитории

Репозиторий должен оставаться лёгким.  
`ffmpeg` подтягивается как runtime-зависимость на первом запуске через Python-зависимости helper и прогревается bootstrap-скриптом.

В git не должны попадать:

- `bin/`
- `dist/`
- `build/`
- любые `.exe` и архивы сборки

## Установка расширения в dev-режиме

Расширение ставится как unpacked extension из папки `extension`.

Важно: это ограничение браузеров. Полностью автоматическая установка локального расширения без магазина расширений или policy install ненадёжна.

## Полезные команды

### Проверка helper

```powershell
py -3.11 -m app.helper.yt_helper --healthcheck
```

### Синтаксическая проверка Python

```powershell
py -3.11 -m compileall app\helper\yt_helper
```

### Синтаксическая проверка extension

```powershell
node --check extension\background.js
node --check extension\content.js
node --check extension\popup.js
```

### Проверка bootstrap-скрипта PowerShell

```powershell
powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw 'run_helper.ps1')) | Out-Null; 'ok'"
```

### Сборка `.exe`

```powershell
Set-Location app\helper
.\build.ps1
```

## CI

Для GitHub стоит проверять минимум:

- установку Python 3.11;
- установку `app/helper/requirements.txt`;
- `compileall` для helper;
- `node --check` для JS-файлов extension.

## Что не коммитить

Не коммитить:

- `.venv/`
- `.local-helper-data/`
- `.test-downloads/`
- `app/helper/build/`
- `app/helper/dist/`
- `__pycache__/`
- любые локальные логи и временные папки

## Что можно улучшить дальше

- подписанный installer;
- публикация extension в store;
- smoke-тест API;
- автоматическая сборка release-артефактов в GitHub Actions.

## Дополнительные материалы

- архитектура: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- user docs RU: [README.user.ru.md](README.user.ru.md)
- user docs EN: [README.user.en.md](README.user.en.md)
