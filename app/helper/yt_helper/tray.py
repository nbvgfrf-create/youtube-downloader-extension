from __future__ import annotations

import ctypes
from ctypes import wintypes


user32 = ctypes.windll.user32
shell32 = ctypes.windll.shell32
kernel32 = ctypes.windll.kernel32

LRESULT = ctypes.c_longlong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_long
WPARAM = wintypes.WPARAM
LPARAM = wintypes.LPARAM
ATOM = wintypes.WORD
HICON = wintypes.HANDLE
HCURSOR = wintypes.HANDLE
HBRUSH = wintypes.HANDLE
HMENU = wintypes.HANDLE
UINT_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else wintypes.UINT

WM_DESTROY = 0x0002
WM_COMMAND = 0x0111
WM_CLOSE = 0x0010
WM_USER = 0x0400
WM_RBUTTONUP = 0x0205
WM_LBUTTONDBLCLK = 0x0203
WS_OVERLAPPED = 0x00000000
CW_USEDEFAULT = -2147483648
NIM_ADD = 0x00000000
NIM_DELETE = 0x00000002
NIF_MESSAGE = 0x00000001
NIF_ICON = 0x00000002
NIF_TIP = 0x00000004
MF_STRING = 0x00000000
MF_SEPARATOR = 0x00000800
TPM_LEFTALIGN = 0x0000
TPM_BOTTOMALIGN = 0x0020
TPM_RIGHTBUTTON = 0x0002
IDI_APPLICATION = 32512
TRAY_CALLBACK = WM_USER + 20

MENU_OPEN_SETTINGS = 1001
MENU_OPEN_DOWNLOADS = 1002
MENU_OPEN_LOGS = 1003
MENU_EXIT = 1004


def make_int_resource(value: int):
    return ctypes.cast(ctypes.c_void_p(value), wintypes.LPCWSTR)


WNDPROC = ctypes.WINFUNCTYPE(
    LRESULT,
    wintypes.HWND,
    wintypes.UINT,
    WPARAM,
    LPARAM,
)


class WNDCLASS(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", HICON),
        ("hCursor", HCURSOR),
        ("hbrBackground", HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
    ]


class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class NOTIFYICONDATA(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("hWnd", wintypes.HWND),
        ("uID", wintypes.UINT),
        ("uFlags", wintypes.UINT),
        ("uCallbackMessage", wintypes.UINT),
        ("hIcon", HICON),
        ("szTip", wintypes.WCHAR * 128),
        ("dwState", wintypes.DWORD),
        ("dwStateMask", wintypes.DWORD),
        ("szInfo", wintypes.WCHAR * 256),
        ("uTimeoutOrVersion", wintypes.UINT),
        ("szInfoTitle", wintypes.WCHAR * 64),
        ("dwInfoFlags", wintypes.DWORD),
        ("guidItem", GUID),
        ("hBalloonIcon", HICON),
    ]


class MSG(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("message", wintypes.UINT),
        ("wParam", WPARAM),
        ("lParam", LPARAM),
        ("time", wintypes.DWORD),
        ("pt", wintypes.POINT),
    ]


user32.LoadIconW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR]
user32.LoadIconW.restype = HICON
user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASS)]
user32.RegisterClassW.restype = ATOM
user32.CreateWindowExW.argtypes = [
    wintypes.DWORD,
    wintypes.LPCWSTR,
    wintypes.LPCWSTR,
    wintypes.DWORD,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.HWND,
    HMENU,
    wintypes.HINSTANCE,
    wintypes.LPVOID,
]
user32.CreateWindowExW.restype = wintypes.HWND
user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, WPARAM, LPARAM]
user32.DefWindowProcW.restype = LRESULT
user32.DestroyWindow.argtypes = [wintypes.HWND]
user32.DestroyWindow.restype = wintypes.BOOL
user32.PostQuitMessage.argtypes = [ctypes.c_int]
user32.PostQuitMessage.restype = None
user32.GetMessageW.argtypes = [ctypes.POINTER(MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
user32.GetMessageW.restype = wintypes.BOOL
user32.TranslateMessage.argtypes = [ctypes.POINTER(MSG)]
user32.TranslateMessage.restype = wintypes.BOOL
user32.DispatchMessageW.argtypes = [ctypes.POINTER(MSG)]
user32.DispatchMessageW.restype = LRESULT
user32.CreatePopupMenu.argtypes = []
user32.CreatePopupMenu.restype = HMENU
user32.AppendMenuW.argtypes = [HMENU, wintypes.UINT, UINT_PTR, wintypes.LPCWSTR]
user32.AppendMenuW.restype = wintypes.BOOL
user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
user32.GetCursorPos.restype = wintypes.BOOL
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.SetForegroundWindow.restype = wintypes.BOOL
user32.TrackPopupMenu.argtypes = [
    HMENU,
    wintypes.UINT,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.HWND,
    wintypes.LPVOID,
]
user32.TrackPopupMenu.restype = wintypes.BOOL
user32.DestroyMenu.argtypes = [HMENU]
user32.DestroyMenu.restype = wintypes.BOOL
kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
shell32.Shell_NotifyIconW.argtypes = [wintypes.DWORD, ctypes.POINTER(NOTIFYICONDATA)]
shell32.Shell_NotifyIconW.restype = wintypes.BOOL


class TrayController:
    def __init__(self, on_open_settings, on_open_downloads, on_open_logs) -> None:
        self._on_open_settings = on_open_settings
        self._on_open_downloads = on_open_downloads
        self._on_open_logs = on_open_logs
        self._class_name = "YouTubeDownloaderTrayWindow"
        self._window_name = "YouTube Downloader Helper"
        self._instance = kernel32.GetModuleHandleW(None)
        self._hwnd: wintypes.HWND | None = None
        self._wnd_proc = WNDPROC(self._window_proc)

    def run(self) -> None:
        self._register_window_class()
        self._create_window()
        self._install_icon()
        self._message_loop()

    def _register_window_class(self) -> None:
        window_class = WNDCLASS()
        window_class.lpfnWndProc = self._wnd_proc
        window_class.lpszClassName = self._class_name
        window_class.hInstance = self._instance
        window_class.hIcon = user32.LoadIconW(None, make_int_resource(IDI_APPLICATION))
        atom = user32.RegisterClassW(ctypes.byref(window_class))
        if atom == 0:
            error_code = kernel32.GetLastError()
            if error_code != 1410:
                raise OSError(f"Не удалось зарегистрировать tray class: {error_code}")

    def _create_window(self) -> None:
        hwnd = user32.CreateWindowExW(
            0,
            self._class_name,
            self._window_name,
            WS_OVERLAPPED,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            None,
            None,
            self._instance,
            None,
        )
        if hwnd == 0:
            raise OSError(f"Не удалось создать tray window: {kernel32.GetLastError()}")
        self._hwnd = hwnd

    def _install_icon(self) -> None:
        notify_data = NOTIFYICONDATA()
        notify_data.cbSize = ctypes.sizeof(NOTIFYICONDATA)
        notify_data.hWnd = self._hwnd
        notify_data.uID = 1
        notify_data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP
        notify_data.uCallbackMessage = TRAY_CALLBACK
        notify_data.hIcon = user32.LoadIconW(None, make_int_resource(IDI_APPLICATION))
        notify_data.szTip = "YouTube Downloader Helper"
        shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(notify_data))

    def _remove_icon(self) -> None:
        if not self._hwnd:
            return
        notify_data = NOTIFYICONDATA()
        notify_data.cbSize = ctypes.sizeof(NOTIFYICONDATA)
        notify_data.hWnd = self._hwnd
        notify_data.uID = 1
        shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(notify_data))

    def _message_loop(self) -> None:
        msg = MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))

    def _show_menu(self) -> None:
        if not self._hwnd:
            return

        menu = user32.CreatePopupMenu()
        user32.AppendMenuW(menu, MF_STRING, MENU_OPEN_SETTINGS, "Открыть настройки")
        user32.AppendMenuW(menu, MF_STRING, MENU_OPEN_DOWNLOADS, "Открыть папку загрузок")
        user32.AppendMenuW(menu, MF_STRING, MENU_OPEN_LOGS, "Открыть логи")
        user32.AppendMenuW(menu, MF_SEPARATOR, 0, None)
        user32.AppendMenuW(menu, MF_STRING, MENU_EXIT, "Выход")

        cursor = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(cursor))
        user32.SetForegroundWindow(self._hwnd)
        user32.TrackPopupMenu(
            menu,
            TPM_LEFTALIGN | TPM_BOTTOMALIGN | TPM_RIGHTBUTTON,
            cursor.x,
            cursor.y,
            0,
            self._hwnd,
            None,
        )
        user32.DestroyMenu(menu)

    def _window_proc(self, hwnd, msg, w_param, l_param):  # noqa: ANN001
        if msg == TRAY_CALLBACK:
            if l_param == WM_RBUTTONUP:
                self._show_menu()
                return 0
            if l_param == WM_LBUTTONDBLCLK:
                self._on_open_settings()
                return 0

        if msg == WM_COMMAND:
            command = int(w_param) & 0xFFFF
            if command == MENU_OPEN_SETTINGS:
                self._on_open_settings()
                return 0
            if command == MENU_OPEN_DOWNLOADS:
                self._on_open_downloads()
                return 0
            if command == MENU_OPEN_LOGS:
                self._on_open_logs()
                return 0
            if command == MENU_EXIT:
                user32.DestroyWindow(hwnd)
                return 0

        if msg == WM_CLOSE:
            user32.DestroyWindow(hwnd)
            return 0

        if msg == WM_DESTROY:
            self._remove_icon()
            user32.PostQuitMessage(0)
            return 0

        return user32.DefWindowProcW(hwnd, msg, w_param, l_param)
