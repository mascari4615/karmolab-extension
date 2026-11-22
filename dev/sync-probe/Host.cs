using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

internal static class Host
{
    private const string Origin = "chrome-extension://jeejnajjlpdepjaelmahdlialbhcfbed/";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 8192 };
    private static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    private static readonly string Job = Path.Combine(Root, "job.json");
    private static readonly string Receipt = Path.Combine(Root, "receipt.json");
    private static readonly string[] Actions = { "prepare", "observe", "add", "remove" };
    private static readonly string[] Flags = { "ok", "ready", "syncError", "keyword", "youtube", "arca", "dc", "gallery" };

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 2 && args[0] == "submit" && Array.IndexOf(Actions, args[1]) >= 0)
            {
                var job = new { id = Guid.NewGuid().ToString("D"), action = args[1], expires = DateTime.UtcNow.AddMinutes(5).ToString("o") };
                WriteFile(Job, job);
                Console.WriteLine(Json.Serialize(job));
                return 0;
            }
            if (args.Length == 1 && args[0] == "status")
            {
                Console.WriteLine(ReadFile(Receipt) ?? "{}");
                return 0;
            }
            if (args.Length < 1 || args[0] != Origin) return 2;
            Serve(Console.OpenStandardInput(), Console.OpenStandardOutput());
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static void Serve(Stream input, Stream output)
    {
        var size = BitConverter.ToInt32(Read(input, 4), 0);
        if (size < 2 || size > 8192) throw new InvalidDataException("Invalid native message length.");
        var request = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(Read(input, size)));
        object type;
        request.TryGetValue("type", out type);
        var content = ReadFile(Job);
        var job = content == null ? null : Json.Deserialize<Dictionary<string, object>>(content);
        if (job != null && DateTime.Parse((string)job["expires"]).ToUniversalTime() < DateTime.UtcNow) job = null;
        if (Equals(type, "poll")) { Reply(output, job ?? new Dictionary<string, object>()); return; }
        if (!Equals(type, "receipt") || job == null || !Equals(request["id"], job["id"]))
        {
            Reply(output, new { ok = false });
            return;
        }
        var result = new Dictionary<string, object> {
            { "id", job["id"] }, { "action", job["action"] }, { "host", Environment.MachineName },
            { "at", DateTime.UtcNow.ToString("o") }
        };
        foreach (string flag in Flags)
        {
            object value;
            if (!request.TryGetValue(flag, out value) || !(value is bool)) throw new InvalidDataException("Missing probe flag.");
            result.Add(flag, value);
        }
        WriteFile(Receipt, result);
        Reply(output, new { ok = true });
    }

    private static byte[] Read(Stream stream, int size)
    {
        var bytes = new byte[size];
        for (int offset = 0; offset < size;)
        {
            int count = stream.Read(bytes, offset, size - offset);
            if (count == 0) throw new EndOfStreamException();
            offset += count;
        }
        return bytes;
    }

    private static void Reply(Stream stream, object value)
    {
        var bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        stream.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    private static void WriteFile(string path, object value)
    {
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporary, Json.Serialize(value), new UTF8Encoding(false));
        if (File.Exists(path)) File.Replace(temporary, path, null);
        else File.Move(temporary, path);
    }

    private static string ReadFile(string path)
    {
        try
        {
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (var reader = new StreamReader(stream, Encoding.UTF8)) return reader.ReadToEnd();
        }
        catch (FileNotFoundException) { return null; }
    }
}
