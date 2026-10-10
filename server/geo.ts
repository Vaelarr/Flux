export interface GeoHeaders {
  city?: string
  region?: string
  country?: string
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip
    .replace(/^::ffff:/, "")
    .trim()
    .toLowerCase()
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean === "unknown" ||
    clean === "test-client" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    clean.startsWith("fc") ||
    clean.startsWith("fe80")
  ) {
    return true
  }
  return false
}

export function formatTimezoneLocation(tz: string): string {
  try {
    const parts = tz.split("/")
    if (parts.length >= 2) {
      const city = parts[parts.length - 1].replace(/_/g, " ")
      const area = parts[0].replace(/_/g, " ")
      return `${city}, ${area}`
    }
  } catch {
    /* fallback */
  }
  return tz
}

export async function resolveLocation(options: {
  ip: string
  geoHeaders?: GeoHeaders
  timeZone?: string
}): Promise<string> {
  const { ip, geoHeaders, timeZone } = options

  // 1. Edge/CDN geolocation headers (e.g., Vercel, Cloudflare)
  if (geoHeaders?.city || geoHeaders?.country) {
    const parts = [
      geoHeaders.city,
      geoHeaders.region,
      geoHeaders.country,
    ].filter(Boolean)
    if (parts.length > 0) {
      return parts.join(", ")
    }
  }

  // 2. Private, LAN, or localhost development addresses
  if (isPrivateOrLocalIp(ip)) {
    if (timeZone) {
      return `${formatTimezoneLocation(timeZone)} (Local network)`
    }
    return "Local network / Machine"
  }

  // 3. Fast public IP lookup with a strict timeout (1500ms)
  try {
    const cleanIp = ip.replace(/^::ffff:/, "").trim()
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,city,regionName,country`,
      {
        signal: AbortSignal.timeout(1500),
      },
    )
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string
        city?: string
        regionName?: string
        country?: string
      }
      if (data.status === "success") {
        const parts = [data.city, data.regionName, data.country].filter(Boolean)
        if (parts.length > 0) {
          return parts.join(", ")
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // 4. Fallback to client timezone
  if (timeZone) {
    return formatTimezoneLocation(timeZone)
  }

  return "Unknown location"
}

export function parseDeviceFromUserAgent(agent: string): string {
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent) ||
            (/AppleWebKit/i.test(agent) && /iPhone|iPad/i.test(agent))
          ? "Safari"
          : "Web Browser"

  const os = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Windows/.test(agent)
          ? "Windows"
          : /Macintosh|Mac OS/.test(agent)
            ? "macOS"
            : /Linux/.test(agent)
              ? "Linux"
              : "Unknown OS"

  return `${browser} on ${os}`
}
