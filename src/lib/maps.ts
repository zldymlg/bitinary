import { isGeoPoint, type GeoPoint } from "./geo"

export function googleMapsDirectionsUrl(
  destination: string,
  coordinates?: GeoPoint | null,
) {
  const target =
    coordinates && isGeoPoint(coordinates)
      ? `${coordinates.lat},${coordinates.lng}`
      : destination.trim()

  if (!target) return null

  const params = new URLSearchParams({ api: "1", destination: target })

  return `https://www.google.com/maps/dir/?${params.toString()}`
}
