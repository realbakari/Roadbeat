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
  // Council dashboards' cloud storage, named bucket by bucket (Oct 2026), so the
  // endpoint can't be pointed at any S3 bucket, CloudFront site or Azure blob.
  // A camera on a new bucket shows without a publisher time until it's added.
  /^camera-custom-image\.s3-ap-southeast-2\.amazonaws\.com$/,
  /^ims-s3-upload\.s3-ap-southeast-2\.amazonaws\.com$/,
  /^rcc-flood-images\.s3\.ap-southeast-2\.amazonaws\.com$/,
  /^(akcl5hth66|bgnve882ji)\.execute-api\.ap-southeast-2\.amazonaws\.com$/,
  /^d2w9pjl8ozl6el\.cloudfront\.net$/,
  /^prospectsstorageaccount\.blob\.core\.windows\.net$/,
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
