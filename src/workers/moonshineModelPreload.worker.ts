import { getMoonshineModelProfile } from "../utils/moonshineRuntime";
import {
  getMoonshineManifestSize,
  isMoonshineManifestCached,
} from "../utils/moonshineCache";

function post(type: string, data: Record<string, unknown> = {}) {
  self.postMessage({ type, ...data });
}

async function preload() {
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error("Moonshine requiere aislamiento COOP/COEP para preparar sus modelos.");
  }

  post("phase", { label: "Preparando motor Moonshine WASM" });
  const { AssetDownloader, ModelArch, loadMoonshineModule } = await import(
    "@moonshine-ai/moonshine-wasm"
  );
  const module = await loadMoonshineModule();
  const englishProfile = getMoonshineModelProfile("english");

  const models = [
    {
      language: "en",
      label: `Moonshine Inglés ${englishProfile.shortLabel}`,
      arch: englishProfile.model === "tiny-streaming"
        ? ModelArch.TinyStreaming
        : ModelArch.SmallStreaming,
    },
    {
      language: "es",
      label: "Moonshine Español Base",
      arch: ModelArch.Base,
    },
  ];

  const manifests = models.map((model) => {
    const json = module.sttDependencies(model.language, String(model.arch), false);
    return { ...model, json, bytes: getMoonshineManifestSize(json) };
  });
  const totalBytes = manifests.reduce((total, manifest) => total + manifest.bytes, 0);
  let completedBytes = 0;

  for (const [index, manifest] of manifests.entries()) {
    const stage = index + 2;
    post("phase", { stage, label: `Verificando ${manifest.label}` });
    if (await isMoonshineManifestCached(manifest.json)) {
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
    totalBytes,
    models: manifests.map((manifest) => manifest.label),
  });
}

self.addEventListener("message", ({ data }) => {
  if (data?.type !== "preload") return;
  preload().catch((error) => {
    post("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
