import { useEffect, useRef, useState } from 'react'

export default function Prompt({ sigil, cwd, onSubmit, history }) {
  const [value, setValue] = useState('')
  const [histIdx, setHistIdx] = useState(history.length)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setHistIdx(history.length)
  }, [history.length])

  const submit = () => {
    onSubmit(value)
    setValue('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (histIdx > 0) {
        const next = histIdx - 1
        setHistIdx(next)
        setValue(history[next] ?? '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx < history.length - 1) {
        const next = histIdx + 1
        setHistIdx(next)
        setValue(history[next] ?? '')
      } else {
        setHistIdx(history.length)
        setValue('')
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      onSubmit('clear')
    }
  }

  return (
    <div
      className="prompt-line"
      onClick={() => inputRef.current?.focus()}
    >
      <span className="prompt-line__sigil">
        {sigil} {cwd === '/' ? '/' : cwd}{' '}
        <span style={{ opacity: 0.7 }}>&gt;</span>
      </span>
      <input
        ref={inputRef}
        className="prompt-line__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <span className="cursor" />
    </div>
  )
}
