using System.Text;
using System.Text.Json;
using Windows.ApplicationModel.Calls;

// Chrome native-messaging host. Registers an active VoIP "call" so Windows routes
// Win+Alt+K to us, and forwards each real state change to the extension.
// stdout is the message channel: never write anything else to it.
// Chrome always passes the caller's origin as the first argument; without it we were double-clicked.
if (args.Length == 0 || !args[0].StartsWith("chrome-extension://"))
{
    Installer.Run();
    return;
}

var coordinator = VoipCallCoordinator.GetDefault();
var call = coordinator.RequestNewOutgoingCall("bridge", "Mute Bridge", "Mute Bridge", VoipPhoneCallMedia.Audio);
call.EndRequested += (_, _) => Environment.Exit(0); // extension reconnects and re-registers
call.NotifyCallActive();

var stdout = Console.OpenStandardOutput();
var gate = new object();
var last = false; // Windows starts unmuted; startup sync events equal this and are dropped

coordinator.MuteStateChanged += (_, e) =>
{
    // Ack, otherwise Windows keeps requesting "mute".
    if (e.Muted) coordinator.NotifyMuted(); else coordinator.NotifyUnmuted();

    lock (gate)
    {
        if (e.Muted == last) return;
        last = e.Muted;
        var payload = Encoding.UTF8.GetBytes($"{{\"muted\":{(e.Muted ? "true" : "false")}}}");
        stdout.Write(BitConverter.GetBytes(payload.Length)); // 4-byte little-endian length prefix
        stdout.Write(payload);
        stdout.Flush();
    }
};

// The extension sends {"muted":bool} when the page's mic changes (e.g. Meet's own button), so
// Windows' state matches and the next Win+Alt+K toggles from the right place.
// Chrome closes stdin when the extension disconnects; that's our exit signal.
var stdin = Console.OpenStandardInput();
var len = new byte[4];
try
{
    while (true)
    {
        stdin.ReadExactly(len);
        var msg = new byte[BitConverter.ToInt32(len)];
        stdin.ReadExactly(msg);
        var muted = JsonDocument.Parse(msg).RootElement.GetProperty("muted").GetBoolean();
        lock (gate)
        {
            if (muted == last) continue;
            last = muted;
            if (muted) coordinator.NotifyMuted(); else coordinator.NotifyUnmuted();
        }
    }
}
catch (EndOfStreamException) { }
call.NotifyCallEnded();
