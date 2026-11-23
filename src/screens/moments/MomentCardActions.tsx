import { CopyPlus, Trash2 } from "lucide-react"

import { useLang } from "@/app/i18n"

import { IconButton } from "@/components/ui/Button"

export function MomentCardActions({
  canSave,

  canDelete,

  busy,

  onSave,

  onDelete,
}: {
  canSave: boolean

  canDelete: boolean

  busy?: boolean

  onSave: () => void

  onDelete: () => void
}) {
  const { t } = useLang()

  return (
    <>
      {canSave && (
        <IconButton
          label={t("I-save ang kopya sa Moments mo", "Copy to your Moments")}
          variant="surface"
          size={34}
          disabled={busy}
          onClick={onSave}
          className="shadow-md"
        >
          <CopyPlus size={16} />
        </IconButton>
      )}
      {canDelete && (
        <IconButton
          label={t("I-delete ang Moment", "Delete Moment")}
          variant="surface"
          size={34}
          disabled={busy}
          onClick={onDelete}
          className="text-danger shadow-md"
        >
          <Trash2 size={16} />
        </IconButton>
      )}
    </>
  )
}
