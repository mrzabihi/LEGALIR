// ============================================================
// LEGALIR — Delete Confirmation Dialog
// Confirmation modal for irreversible document deletion (Phase 9)
// ============================================================

"use client";

import { Dialog, Button } from "@legalir/ui";
import { IconWarning, IconDelete } from "@/lib/icons";

// ============================================================
// DeleteConfirmDialog component
// ============================================================

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  documentName: string;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  isDeleting,
  documentName,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="حذف سند"
      description="آیا از حذف این سند اطمینان دارید؟ این عمل قابل بازگشت نیست."
      maxWidth="sm"
      actions={
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isDeleting}
            fullWidth
          >
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={onConfirm}
            disabled={isDeleting}
            loading={isDeleting}
            fullWidth
            className="bg-red-600 hover:bg-red-700 text-white"
            startIcon={<IconDelete size={18} />}
          >
            {isDeleting ? "در حال حذف..." : "حذف"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center gap-4" dir="rtl">
        {/* Warning icon */}
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <IconWarning size={28} className="text-red-600" />
        </div>

        {/* Document name */}
        <div className="w-full rounded-medium bg-surface border border-divider px-4 py-3">
          <div className="flex items-center gap-2">
            <IconDelete size={18} className="text-muted shrink-0" />
            <p
              className="text-body-2 text-on-surface font-medium truncate"
              title={documentName}
            >
              {documentName}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
