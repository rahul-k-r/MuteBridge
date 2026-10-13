# MuteBridge

Makes the Windows 11 system mic-mute shortcut (**Win+Alt+K**) mute and unmute Google Meet in Chrome,
without Chrome being focused. Muting from Meet itself (button or Ctrl+D) stays in sync, so the
shortcut always toggles from the right state.

## How it works

Windows doesn't expose Win+Alt+K as a hotkey. It delivers it only to an app with an active VoIP call,
via `VoipCallCoordinator.MuteStateChanged`. So MuteBridge has two parts:

- **Native host** (`host/`, C# / .NET 8, Native AOT): a Chrome
  [native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
  host that registers a VoIP call and relays mute changes to and from the extension.
- **Chrome extension** (`extension/`, Manifest V3): detects when a Meet tab is in a call, starts the host
  only for that time, and clicks Meet's mic button to match the requested state.

Chrome launches and stops the host automatically. There's nothing to run in the background yourself.

## Requirements

- Windows 11 and Google Chrome
- To build from source: .NET 8 SDK and the Visual Studio C++ build tools ("Desktop development
  with C++"), which Native AOT needs

## Install

1. Get the host:
   - **From a release:** download `MuteBridgeHost.exe` and the source code zip from the
     [latest release](../../releases/latest), and extract the zip.
   - **From source:** run `.\build.ps1`. The exe is written to `dist\MuteBridgeHost.exe`.
2. Double-click `MuteBridgeHost.exe`. It copies itself to `%LOCALAPPDATA%\MuteBridge` and registers
   with Chrome, after which you can delete the downloaded exe. It's unsigned, so Windows SmartScreen
   may warn: click **More info > Run anyway**.
3. In `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the
   `extension` folder from the source. Keep that folder where it is; Chrome loads it from there.
4. Fully quit Chrome (tray icon > **Exit**) and reopen it. Chrome may not see a newly registered
   host until it restarts.

Then join a Meet call and press Win+Alt+K.

## Known issues

- **Bluetooth speakers/headphones may go silent during a call.** Windows tells every connected
  Bluetooth Hands-Free device about the VoIP call, and some (e.g. Sony SRS-XE200) mute their music
  stream in response. If you use a device only for output, disable its `<device> Hands-Free AG`
  entry under Device Manager > System devices.
- **Zoom web** support (`*.zoom.us`) is included but its mic-button selector hasn't been verified
  against the live UI. Zoom desktop is not supported.

## Uninstall

Remove the extension from `chrome://extensions`, then:

```powershell
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\rahul.mutebridge" /f
Remove-Item -Recurse "$env:LOCALAPPDATA\MuteBridge"
```

## Development

Extension tests (Node 20+):

```powershell
cd extension
npm install
npm test
```

After changing the host, rebuild and double-click the new `dist\MuteBridgeHost.exe` to reinstall.
Leave any Meet call first, or the running host's exe can't be replaced.

## License

[MIT](LICENSE)
