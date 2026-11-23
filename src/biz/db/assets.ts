import { supabase } from "@/lib/supabase"

type BusinessAssetKind = "image" | "video"

// Cache lang ang signed URLs hanggang bago mag-expire; path pa rin ang ise-save sa database.
const signedAssetUrls = new Map<string, { url: string; expiresAt: number }>()

function getStorageAsset(path: string, kind: BusinessAssetKind) {
  const bucket = kind === "video" ? "videos" : "images"
  const urlMatch =
    /\/storage\/v1\/object\/(?:sign|public|authenticated)\/(images|videos)\/([^?]+)/i.exec(
      path,
    )

  if (/^https?:\/\//i.test(path) && !urlMatch) return null

  const resolvedBucket = urlMatch?.[1] ?? bucket
  const objectPath = decodeURIComponent(urlMatch?.[2] ?? path)
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${resolvedBucket}/`), "")

  return { bucket: resolvedBucket, objectPath }
}

export async function resolveBusinessAsset(
  path: string,
  kind: BusinessAssetKind,
  forceRefresh = false,
): Promise<string> {
  if (/^(data:image\/|blob:)/i.test(path)) return path

  const asset = getStorageAsset(path, kind)
  if (!asset) return path
  if (!asset.objectPath) {
    throw new Error("The business media path is empty.")
  }

  const cacheKey = `${asset.bucket}:${asset.objectPath}`
  const cached = signedAssetUrls.get(cacheKey)
  if (forceRefresh) signedAssetUrls.delete(cacheKey)
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url
  }

  const { data, error } = await supabase.storage
    .from(asset.bucket)
    .createSignedUrl(asset.objectPath, 3600)

  if (error) throw new Error(error.message)
  if (!data.signedUrl) {
    throw new Error("The business media could not be loaded.")
  }

  signedAssetUrls.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + 3_540_000,
  })
  return data.signedUrl
}

export function resolveBusinessImage(
  path: string,
  forceRefresh = false,
): Promise<string> {
  return resolveBusinessAsset(path, "image", forceRefresh)
}

export async function uploadBusinessAsset(
  businessId: string,

  file: Blob,

  kind: "image" | "video",
  folder = "posts",
): Promise<string> {
  const { data: auth, error: authError } = await supabase.auth.getUser()

  if (authError) throw new Error(authError.message)

  if (!auth.user)
    throw new Error("Sign in as the business owner before uploading media.")

  const bucket = kind === "video" ? "videos" : "images"

  const extension =
    file.type
      .split("/")[1]
      ?.replace("jpeg", "jpg")
      .replace(/[^a-z0-9]/gi, "") || (kind === "video" ? "mp4" : "jpg")

  const path = `${auth.user.id}/business/${businessId}/${folder}/${crypto.randomUUID()}.${extension}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),

      upsert: false,
    })

  if (error) throw new Error(error.message)

  return data.path
}
