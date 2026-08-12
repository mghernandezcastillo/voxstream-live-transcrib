type ManifestFile = { name?: string; size?: number; url?: string };
type ManifestGroup = { base_url?: string; files?: ManifestFile[] };
type Manifest = { groups?: ManifestGroup[] };

function parseManifest(manifestJson: string) {
  return JSON.parse(manifestJson) as Manifest;
}

function joinUrl(base: string, file: string) {
  return `${base.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
}

export function getMoonshineManifestSize(manifestJson: string) {
  const manifest = parseManifest(manifestJson);
  return (manifest.groups || []).reduce(
    (groupTotal, group) => groupTotal + (group.files || []).reduce(
      (fileTotal, file) => fileTotal + (Number(file.size) || 0),
      0,
    ),
    0,
  );
}

export async function isMoonshineManifestCached(manifestJson: string) {
  if (typeof caches === "undefined") return false;

  const manifest = parseManifest(manifestJson);
  const urls = (manifest.groups || []).flatMap((group) =>
    (group.files || []).map((file) =>
      file.url || (group.base_url && file.name ? joinUrl(group.base_url, file.name) : ""),
    ),
  );
  if (!urls.length || urls.some((url) => !url)) return false;

  try {
    const cache = await caches.open("moonshine-models-v1");
    const matches = await Promise.all(urls.map((url) => cache.match(url)));
    return matches.every(Boolean);
  } catch {
    return false;
  }
}
