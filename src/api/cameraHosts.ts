// Camera image hosts the time endpoint may ask about. Shared by the browser and
// api/camera-time.ts, so it uses nothing browser-only.

/** Hosts that serve camera images for QLDTraffic and the council dashboards. Nothing else is asked. */
const CAMERA_HOSTS = [
  /(^|\.)qldtraffic\.qld\.gov\.au$/,
  /(^|\.)qld\.gov\.au$/,
  /^portal\.sightmaster\.com\.au$/,
  /(^|\.)envault\.com\.au$/,
  /^public\.disasterwatch-iotp\.com\.au$/,
  /^images\.valora1\.com\.au$/,
  /(^|\.)ftp-images\.qteq\.com$/,
  /^media\.floodmonitoraustralia\.com$/,
  /^camera\.spectur\.net$/,
  /^www\.usee\.com$/,
  /^weathercams\.airservicesaustralia\.com$/,
  /^view\.myairportcams\.com$/,
  /\.amazonaws\.com$/,
  /\.cloudfront\.net$/,
  /\.blob\.core\.windows\.net$/,
]

/** Whether a camera image address is one the time endpoint will ask about. */
export function isCameraImage(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && CAMERA_HOSTS.some((h) => h.test(u.hostname))
  } catch {
    return false
  }
}
