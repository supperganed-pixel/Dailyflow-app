import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const currentVersion = Constants.expoConfig?.version ?? "1.0.3";
export const releaseRepo =
  process.env.EXPO_PUBLIC_GITHUB_RELEASES_REPO ??
  "supperganed-pixel/dailyflow-releases";
export type ReleaseAsset = {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
};
export type Release = {
  id: number;
  prerelease: boolean;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
};
type Cache = { at: number; etag: string; releases: Release[] };
const ttl = 6 * 60 * 60 * 1000;
const cacheKey = `dailyflow.releases.v2.${releaseRepo}`;
let pending: Promise<{ releases: Release[]; stale: boolean }> | undefined;
export function isNewer(tag: string, current: string) {
  const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  const next = parse(tag),
    old = parse(current);
  if (!next || !old) return false;
  for (let i = 1; i <= 3; i++) {
    if (+next[i] !== +old[i]) return +next[i] > +old[i];
  }
  return false;
}
export function safeReleaseUrl(value: string, asset = false) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      !u.username &&
      !u.password &&
      u.pathname.startsWith(
        `/${releaseRepo}/releases/${asset ? "download/" : ""}`,
      )
    );
  } catch {
    return false;
  }
}
function parseReleases(value: unknown): Release[] {
  if (!Array.isArray(value)) throw new Error("Invalid release information.");
  return (
    value
      .filter(
        (r) =>
          r &&
          !r.draft &&
          typeof r.tag_name === "string" &&
          typeof r.html_url === "string" &&
          safeReleaseUrl(r.html_url),
      )
      .slice(0, 20)
      .map((r) => ({
        id: Number(r.id),
        prerelease: r.prerelease === true,
        tag_name: r.tag_name,
        name: String(r.name || r.tag_name),
        body: String(r.body || "No release notes provided.").slice(0, 30000),
        published_at: String(r.published_at),
        html_url: r.html_url,
        assets: (Array.isArray(r.assets) ? r.assets : [])
          .filter(
            (a: any) =>
              typeof a.name === "string" &&
              /\.apk$/i.test(a.name) &&
              safeReleaseUrl(a.browser_download_url, true),
          )
          .map((a: any) => ({
            id: Number(a.id),
            name: a.name,
            size: Number(a.size),
            download_count: Number(a.download_count),
            browser_download_url: a.browser_download_url,
          })),
      }))
      // Prefer a stable release, but keep clearly labelled previews available
      // before the first stable version is published.
      .sort(
        (a, b) =>
          Number(a.prerelease) - Number(b.prerelease) ||
          Date.parse(b.published_at) - Date.parse(a.published_at),
      )
  );
}
export async function getReleases(force = false) {
  if (pending) return pending;
  pending = (async () => {
    if (!/^[\w.-]+\/[\w.-]+$/.test(releaseRepo))
      throw new Error("The downloads repository is not configured.");
    let cache: Cache | undefined;
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const stored = JSON.parse(raw);
        cache = {
          at: Number(stored.at),
          etag: String(stored.etag || ""),
          releases: parseReleases(stored.releases),
        };
      }
    } catch {}
    if (cache && Date.now() - cache.at < (force ? 60000 : ttl))
      return { releases: cache.releases, stale: false };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${releaseRepo}/releases?per_page=20`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            ...(cache?.etag ? { "If-None-Match": cache.etag } : {}),
          },
          signal: controller.signal,
        },
      );
      if (response.status === 304 && cache) {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ ...cache, at: Date.now() }),
        );
        return { releases: cache.releases, stale: false };
      }
      if (response.status === 403 || response.status === 429)
        throw new Error("GitHub is limiting requests. Please try again later.");
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Downloads are not available yet."
            : "Could not retrieve releases. Please try again.",
        );
      const releases = parseReleases(await response.json());
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          at: Date.now(),
          etag: response.headers.get("etag") ?? "",
          releases,
        }),
      ).catch(() => {});
      return { releases, stale: false };
    } catch (e) {
      if (cache) return { releases: cache.releases, stale: true };
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
