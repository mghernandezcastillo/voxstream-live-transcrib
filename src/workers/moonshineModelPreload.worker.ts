type EnglishModel = "small" | "tiny";

type ManifestFile = { name?: string; size?: number; url?: string };
type ManifestGroup = { base_url?: string; files?: ManifestFile[] };
type Manifest = { groups?: ManifestGroup[] };

function post(type: string, data: Record<string, unknown> = {}) {
  self.postMessage({ type, ...data });
}

function manifestSize(manifestJson: string) {
  const manifest = JSON.parse(manifestJson) as Manifest;
  return (manifest.groups || []).reduce(
    (groupTotal, group) => groupTotal + (group.files || []).reduce(
      (fileTotal, file) => fileTotal + (Number(file.size) || 0),
      0,
    ),
    0,
  );
}

function joinUrl(base: string, file: string) {
  return `${base.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
}

async function isManifestCached(manifestJson: string) {
  if (typeof caches === "undefined") return false;
  const manifest = JSON.parse(manifestJson) as Manifest;
  const urls = (manifest.groups || []).flatMap((group) =>
    (group.files || []).map((file) =>
      file.url || (group.base_url && file.name ? joinUrl(group.base_url, file.name) : ""),
    ),
  );
  if (!urls.length || urls.some((url) => !url)) return false;

  const cache = await caches.open("moonshine-models-v1");
  const matches = await Promise.all(urls.map((url) => cache.match(url)));
  return matches.every(Boolean);
}

async function preload(englishModel: EnglishModel) {
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error("Moonshine requiere aislamiento COOP/COEP para preparar sus modelos.");
  }

  post("phase", { label: "Preparando motor Moonshine WASM" });
  const { AssetDownloader, ModelArch, loadMoonshineModule } = await import(
    "@moonshine-ai/moonshine-wasm"
  );
  const module = await loadMoonshineModule();

  const models = [
    {
      language: "en",
      label: englishModel === "tiny" ? "Moonshine Inglés Tiny" : "Moonshine Inglés Small",
      arch: englishModel === "tiny" ? ModelArch.TinyStreaming : ModelArch.SmallStreaming,
    },
    {
      language: "es",
      label: "Moonshine Español Base",
      arch: ModelArch.Base,
    },
  ];

  const manifests = models.map((model) => {
    const json = module.sttDependencies(model.language, String(model.arch), false);
    return { ...model, json, bytes: manifestSize(json) };
  });
  const totalBytes = manifests.reduce((total, manifest) => total + manifest.bytes, 0);
  let completedBytes = 0;

  for (const [index, manifest] of manifests.entries()) {
    const stage = index + 2;
    post("phase", { stage, label: `Verificando ${manifest.label}` });
    if (await isManifestCached(manifest.json)) {
      completedBytes += manifest.bytes;
      post("progress", {
        stage,
        label: manifest.label,
        file: "en caché",
        loaded: completedBytes,
        total: totalBytes || completedBytes,
      });
      continue;
    }

    post("phase", { stage, label: `Descargando ${manifest.label}` });
    const downloader = new AssetDownloader({
      onProgress: (loaded, modelTotal, file) => {
        post("progress", {
          stage,
          label: manifest.label,
          file,
          loaded: completedBytes + loaded,
          total: totalBytes || completedBytes + (modelTotal || loaded),
        });
      },
    });
    const assets = await downloader.downloadManifest(manifest.json);
    assets.clear();
    completedBytes += manifest.bytes;
    post("progress", {
      stage,
      label: manifest.label,
      file: "completo",
      loaded: completedBytes,
      total: totalBytes || completedBytes,
    });
  }

  post("ready", {
    englishModel,
    totalBytes,
    models: manifests.map((manifest) => manifest.label),
  });
}

self.addEventListener("message", ({ data }) => {
  if (data?.type !== "preload") return;
  preload(data.englishModel === "tiny" ? "tiny" : "small").catch((error) => {
    post("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
