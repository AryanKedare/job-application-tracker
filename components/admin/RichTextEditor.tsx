'use client'

import { useEffect, useRef } from 'react'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface Props {
  value: string
  onChange: (html: string, text: string) => void
  disabled?: boolean
  maxTextLength?: number
}

type Command = {
  label: string
  title: string
  icon: typeof Bold
  command: string
  value?: string
}

const COMMANDS: Command[] = [
  { label: 'Paragraph', title: 'Paragraph', icon: Pilcrow, command: 'formatBlock', value: 'p' },
  { label: 'Heading 2', title: 'Heading 2', icon: Heading2, command: 'formatBlock', value: 'h2' },
  { label: 'Heading 3', title: 'Heading 3', icon: Heading3, command: 'formatBlock', value: 'h3' },
  { label: 'Bold', title: 'Bold (Ctrl/Cmd+B)', icon: Bold, command: 'bold' },
  { label: 'Italic', title: 'Italic (Ctrl/Cmd+I)', icon: Italic, command: 'italic' },
  { label: 'Underline', title: 'Underline (Ctrl/Cmd+U)', icon: Underline, command: 'underline' },
  { label: 'Strikethrough', title: 'Strikethrough', icon: Strikethrough, command: 'strikeThrough' },
  { label: 'Bulleted list', title: 'Bulleted list', icon: List, command: 'insertUnorderedList' },
  { label: 'Numbered list', title: 'Numbered list', icon: ListOrdered, command: 'insertOrderedList' },
]

export default function RichTextEditor({ value, onChange, disabled = false, maxTextLength = 10_000 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) return

    const text = editor.innerText.replace(/\u00a0/g, ' ')
    if (!text.trim()) {
      if (editor.innerHTML) editor.innerHTML = ''
      onChange('', '')
      return
    }

    onChange(editor.innerHTML, text)
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.innerHTML === value) return
    editor.innerHTML = value
  }, [value])

  useEffect(() => {
    // Keep browser-generated markup semantic (<b>, <i>, etc.) instead of inline CSS.
    document.execCommand('styleWithCSS', false, 'false')
  }, [])

  const runCommand = (command: string, commandValue?: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    emitChange()
  }

  const addLink = () => {
    if (disabled) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
      window.alert('Select the text you want to link first.')
      return
    }

    const raw = window.prompt('Enter an HTTPS URL')?.trim()
    if (!raw) return

    try {
      const url = new URL(raw)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid')
      runCommand('createLink', url.toString())
    } catch {
      window.alert('Enter a valid HTTPS URL.')
    }
  }

  const pastePlainText = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emitChange()
  }

  const textLength = editorRef.current?.innerText.replace(/\u00a0/g, ' ').length ?? 0
  const tooLong = textLength > maxTextLength

  return (
    <div className={`overflow-hidden rounded-xl border bg-slate-950 ${tooLong ? 'border-red-500/60' : 'border-slate-700'}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/80 p-2">
        {COMMANDS.map(({ label, title, icon: Icon, command, value: commandValue }) => (
          <Button
            key={label}
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
            title={title}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command, commandValue)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}

        <span className="mx-1 h-6 w-px bg-slate-700" aria-hidden="true" />

        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Add link" aria-label="Add link" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Remove link" aria-label="Remove link" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('unlink')}>
          <Unlink className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Clear formatting" aria-label="Clear formatting" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('removeFormat')}>
          <RemoveFormatting className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-6 w-px bg-slate-700" aria-hidden="true" />

        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Undo" aria-label="Undo" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('undo')}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Redo" aria-label="Redo" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('redo')}>
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={editorRef}
        id="broadcast-message"
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder="Write your update…"
        onInput={emitChange}
        onPaste={pastePlainText}
        className="min-h-52 max-h-[32rem] overflow-y-auto px-4 py-3 text-sm leading-7 text-slate-200 outline-none empty:before:pointer-events-none empty:before:text-slate-600 empty:before:content-[attr(data-placeholder)] [&_a]:text-blue-300 [&_a]:underline [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-6 [&_ol]:my-3 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:my-3 [&_ul]:list-disc"
      />

      <div className={`border-t border-slate-800 px-3 py-1.5 text-right text-xs ${tooLong ? 'text-red-300' : 'text-slate-600'}`}>
        {textLength.toLocaleString()} / {maxTextLength.toLocaleString()}
      </div>
    </div>
  )
}
