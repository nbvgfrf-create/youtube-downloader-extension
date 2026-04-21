#define AppName "YouTube Downloader"
#define AppVersion "0.1.0"
#define AppPublisher "Tim"
#define AppExeName "YouTubeDownloaderHelper.exe"
#define DistDir "..\\app\\helper\\dist\\YouTubeDownloaderHelper"
#define ExtensionDir "..\\extension"

[Setup]
AppId={{C1F4E7A9-62E2-4E36-9D63-02E987AF114A}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
OutputDir=.
OutputBaseFilename=setup-youtube-downloader

[Files]
Source: "{#DistDir}\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "{#ExtensionDir}\*"; DestDir: "{app}\Extension"; Flags: recursesubdirs ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\run_helper.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\run_helper.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Parameters: "--settings"
Name: "{group}\{#AppName} Downloads"; Filename: "{app}"

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Запустить helper после установки"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox(
      'Helper установлен. Для dev-сборки загрузи папку Extension как unpacked extension в Chrome или Edge. ' +
      'Для production нужен подписанный пакет расширения или policy-based install. ' +
      'Если запускаешь из исходников, используй run_helper.cmd.',
      mbInformation,
      MB_OK
    );
  end;
end;
