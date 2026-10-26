using System.IO.Compression;

namespace ContentFactory;

public static class UploadValidation
{
    public static readonly Dictionary<string, string> Types = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf", [".epub"] = "application/epub+zip", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png"
    };
    public static string Extension(string name)
    {
        var ext = Path.GetExtension(name).ToLowerInvariant();
        if (!Types.ContainsKey(ext)) throw new FactoryException("僅支援 PDF、EPUB、JPG 或 PNG。"); return ext;
    }
    public static void ValidateSet(IReadOnlyList<(string Name, long Size)> files)
    {
        if (files.Count == 0 || files.Count > FactoryOptions.MaxPages) throw new FactoryException("請選擇一份電子書，或最多 600 張逐頁圖片。");
        if (files.Any(f => f.Size <= 0) || files.Sum(f => f.Size) > FactoryOptions.MaxUploadBytes) throw new FactoryException("教材不可為空，全部檔案合計不可超過 200 MB。");
        var extensions = files.Select(f => Extension(f.Name)).ToArray();
        if (files.Count > 1 && extensions.Any(ext => ext is ".pdf" or ".epub")) throw new FactoryException("PDF／EPUB 請各自建立教材；多檔上傳只接受逐頁圖片。");
    }
    public static async Task ValidateSignature(string path, string extension, CancellationToken token)
    {
        await using var stream = File.OpenRead(path); var header = new byte[8]; var count = await stream.ReadAsync(header, token);
        var valid = extension switch
        {
            ".pdf" => count >= 5 && header.Take(5).SequenceEqual("%PDF-"u8.ToArray()),
            ".png" => count == 8 && header.SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            ".jpg" or ".jpeg" => count >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255,
            ".epub" => count >= 4 && header[0] == 80 && header[1] == 75 && header[2] == 3 && header[3] == 4,
            _ => false
        };
        if (!valid) throw new FactoryException("檔案內容與副檔名不符，請重新匯出教材。");
        if (extension == ".epub")
        {
            stream.Position = 0; using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            if (archive.Entries.Count > 5000 || archive.Entries.Sum(e => e.Length) > 400L * 1024 * 1024) throw new FactoryException("EPUB 解壓縮內容過大。");
            var mime = archive.GetEntry("mimetype") ?? throw new FactoryException("EPUB 缺少 mimetype。");
            using var reader = new StreamReader(mime.Open()); if ((await reader.ReadToEndAsync(token)).Trim() != "application/epub+zip") throw new FactoryException("不是有效的 EPUB 電子書。");
        }
    }
}
