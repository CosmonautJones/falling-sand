// The in-app gallery: the newest twelve scene-stamp links made or opened on this device.
export const GALLERY_MAX = 12;
const FLASK_LINK = /^(?:https?:\/\/[^#\s]*)?#flask=[zr][A-Za-z0-9_-]+$/;

export function addToGallery(list, entry) {
  if (!entry || typeof entry.url !== 'string' || !FLASK_LINK.test(entry.url)) return list;
  const rest = (Array.isArray(list) ? list : []).filter(e => e && e.url !== entry.url);
  return [{ url: entry.url, thumb: typeof entry.thumb === 'string' ? entry.thumb : '', t: Number(entry.t) || 0 }, ...rest].slice(0, GALLERY_MAX);
}
