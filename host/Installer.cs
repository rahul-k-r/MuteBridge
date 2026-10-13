using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Win32;

// Double-clicked rather than launched by Chrome: copy to %LOCALAPPDATA%\MuteBridge and register
// as the extension's native messaging host, so the download location doesn't matter.
static class Installer
{
    const string Name = "rahul.mutebridge";
    const string ExtensionId = "pkbkkghhmneflkfilbpnhblnfoankgjo"; // derived from "key" in extension/manifest.json

    public static void Run()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MuteBridge");
        var exe = Path.Combine(dir, "MuteBridgeHost.exe");
        var manifest = Path.Combine(dir, Name + ".json");
        try
        {
            Directory.CreateDirectory(dir);
            if (!string.Equals(Environment.ProcessPath, exe, StringComparison.OrdinalIgnoreCase))
                File.Copy(Environment.ProcessPath!, exe, overwrite: true);

            using (var file = File.Create(manifest))
            using (var w = new Utf8JsonWriter(file, new JsonWriterOptions { Indented = true }))
            {
                w.WriteStartObject();
                w.WriteString("name", Name);
                w.WriteString("description", "Mute Bridge host");
                w.WriteString("path", exe);
                w.WriteString("type", "stdio");
                w.WriteStartArray("allowed_origins");
                w.WriteStringValue($"chrome-extension://{ExtensionId}/");
                w.WriteEndArray();
                w.WriteEndObject();
            }
            Registry.SetValue($@"HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\{Name}", "", manifest);

            MessageBox(0, $"Installed to {dir}\n\nNext: load the extension folder at chrome://extensions " +
                "(Developer mode > Load unpacked), then fully quit Chrome (tray icon > Exit) and reopen it.",
                "Mute Bridge", 0x40);
        }
        catch (Exception e)
        {
            MessageBox(0, $"Install failed: {e.Message}\n\nIf you're in a meeting, leave it and try again.", "Mute Bridge", 0x10);
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBox(nint hWnd, string text, string caption, uint type);
}
