import { getAdminSupabase } from '@/lib/admin-supabase'

export async function deleteResumeFolder(userId: string) {
  const bucket = getAdminSupabase().storage.from('resumes')
  let pages = 0
  async function emptyFolder(prefix: string, depth: number): Promise<void> {
    if (depth > 20) throw new Error('Resume folder nesting limit reached; deletion is incomplete.')
    while (true) {
      if (++pages > 1000) throw new Error('Resume cleanup limit reached; retry deletion to continue.')
      // Deletion shifts the remaining objects. Always re-read the first page,
      // including after a short page, to verify that the folder is empty.
      const { data, error } = await bucket.list(prefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      if (!data) throw new Error('Storage returned no listing.')
      if (!data.length) return
      const files: string[] = []
      for (const item of data) {
        if (!item.name || item.name.includes('/') || item.name === '.' || item.name === '..') {
          throw new Error('Storage returned an invalid object name.')
        }
        const path = `${prefix}/${item.name}`
        if (item.id === null) await emptyFolder(path, depth + 1)
        else files.push(path)
      }
      if (files.length) {
        const { error: removeError } = await bucket.remove(files)
        if (removeError) throw removeError
      }
    }
  }
  await emptyFolder(userId, 0)
}
