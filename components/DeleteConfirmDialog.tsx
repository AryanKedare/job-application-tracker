// components/DeleteConfirmDialog.tsx
// Replaces native confirm() with a styled Radix dialog
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  jobTitle: string
  company: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmDialog({
  open,
  jobTitle,
  company,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Delete application?</DialogTitle>
          <DialogDescription className="text-slate-400 pt-1">
            This will permanently remove{' '}
            <span className="font-semibold text-slate-200">{jobTitle}</span>
            {company ? ` at ${company}` : ''}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
