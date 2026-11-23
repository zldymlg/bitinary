import type { Post } from '../seed'
import type { BusinessPhotoRow } from './photos'

export type EditablePostStatus = Extract<Post['status'], 'draft' | 'published'>

export function postWriteValues(
  post: Pick<Post, 'type' | 'title' | 'text' | 'media' | 'video' | 'at'>,
  status: EditablePostStatus,
) {
  return {
    post_type: post.type,
    title: post.title ?? null,
    body: post.text,
    media_urls: post.media.filter(Boolean),
    video_url: post.video ?? null,
    status,
    published_at: status === 'published' ? post.at : null,
    scheduled_at: null,
  }
}

export function planPhotoSync(
  current: Pick<BusinessPhotoRow, 'id' | 'storage_path' | 'is_cover' | 'sort_order'>[],
  desiredPaths: string[],
  originalIds?: readonly string[],
) {
  const paths = [...new Set(desiredPaths.filter(Boolean))]
  const rowsByPath = new Map(
    current.filter((row) => !row.is_cover).map((row) => [row.storage_path, row]),
  )
  const desired = new Set(paths)
  const editableIds = new Set(originalIds ?? current.map((row) => row.id))
  const untouched = current
    .filter((row) => !row.is_cover && !editableIds.has(row.id) && !desired.has(row.storage_path))
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    keep: paths.flatMap((path, sort_order) => {
      const row = rowsByPath.get(path)
      return row ? [{ id: row.id, sort_order }] : []
    }).concat(untouched.map((row, index) => ({ id: row.id, sort_order: paths.length + index }))),
    create: paths.flatMap((path, sort_order) =>
      rowsByPath.has(path)
        ? []
        : [{ storage_path: path, is_cover: false, sort_order }],
    ),
    remove: current
      .filter((row) => !row.is_cover && editableIds.has(row.id) && !desired.has(row.storage_path))
      .map((row) => row.id),
  }
}
