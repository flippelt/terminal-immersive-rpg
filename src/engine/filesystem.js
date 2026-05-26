// Virtual filesystem driven by the theme JSON.
// Theme provides an object keyed by absolute path:
//   { "/": { type:"dir", children:["logs","note.txt"] },
//     "/note.txt": { type:"file", content:"..." } }

export function normalizePath(cwd, target) {
  if (!target || target === '.') return cwd
  let path
  if (target.startsWith('/')) {
    path = target
  } else {
    path = (cwd === '/' ? '' : cwd) + '/' + target
  }
  const parts = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

export function getNode(fs, path) {
  if (!fs) return null
  return fs[path] ?? null
}

export function listDir(fs, path) {
  const node = getNode(fs, path)
  if (!node || node.type !== 'dir') return null
  return (node.children || []).map((name) => {
    const child = getNode(fs, normalizePath(path, name))
    return {
      name,
      type: child?.type ?? 'file',
      size: child?.type === 'file' ? (child.content?.length ?? 0) : null
    }
  })
}
