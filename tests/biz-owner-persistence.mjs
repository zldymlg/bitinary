import assert from 'node:assert/strict'
import { planPhotoSync, postWriteValues } from '../src/biz/db/ownerPersistence.ts'

assert.deepEqual(
  postWriteValues({
    type: 'post',
    title: undefined,
    text: 'Lunch special',
    media: ['owners/business/photo.jpg'],
    video: undefined,
    at: '2026-11-24T03:00:00.000Z',
  }, 'draft'),
  {
    post_type: 'post',
    title: null,
    body: 'Lunch special',
    media_urls: ['owners/business/photo.jpg'],
    video_url: null,
    status: 'draft',
    published_at: null,
    scheduled_at: null,
  },
  'Draft saves must stay unpublished and must not create a scheduled post.',
)
assert.deepEqual(
  postWriteValues({
    type: 'blog',
    title: 'The story',
    text: 'A short story',
    media: [],
    video: undefined,
    at: '2026-11-24T03:00:00.000Z',
  }, 'published'),
  {
    post_type: 'blog',
    title: 'The story',
    body: 'A short story',
    media_urls: [],
    video_url: null,
    status: 'published',
    published_at: '2026-11-24T03:00:00.000Z',
    scheduled_at: null,
  },
  'Publishing must set the publish timestamp and leave scheduling disabled.',
)

assert.deepEqual(
  planPhotoSync(
    [
      { id: 'cover', storage_path: 'cover.jpg', is_cover: true, sort_order: 0 },
      { id: 'keep', storage_path: 'one.jpg', is_cover: false, sort_order: 0 },
      { id: 'remove', storage_path: 'old.jpg', is_cover: false, sort_order: 1 },
      { id: 'move', storage_path: 'two.jpg', is_cover: false, sort_order: 2 },
    ],
    ['two.jpg', 'one.jpg', 'new.jpg'],
  ),
  {
    keep: [
      { id: 'move', sort_order: 0 },
      { id: 'keep', sort_order: 1 },
    ],
    create: [{ storage_path: 'new.jpg', is_cover: false, sort_order: 2 }],
    remove: ['remove'],
  },
  'Saving photos must preserve retained rows, reorder them, add new paths, and remove omitted gallery rows.',
)

assert.deepEqual(
  planPhotoSync(
    [
      { id: 'kept', storage_path: 'one.jpg', is_cover: false, sort_order: 0 },
      { id: 'removed', storage_path: 'old.jpg', is_cover: false, sort_order: 1 },
      { id: 'concurrent', storage_path: 'another-tab.jpg', is_cover: false, sort_order: 2 },
    ],
    ['one.jpg'],
    ['kept', 'removed'],
  ),
  {
    keep: [
      { id: 'kept', sort_order: 0 },
      { id: 'concurrent', sort_order: 1 },
    ],
    create: [],
    remove: ['removed'],
  },
  'Saving an older gallery draft must preserve rows added by a different tab.',
)

console.log('Business owner persistence checks passed')
