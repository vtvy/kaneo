import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type NameDialogProps = {
  open: boolean;
  title: string;
  initialValue?: string;
  confirmLabel: string;
  placeholder?: string;
  pending?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
};

export default function NameDialog({
  open,
  title,
  initialValue = "",
  confirmLabel,
  placeholder,
  pending = false,
  onConfirm,
  onClose,
}: NameDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="contents">
          <DialogPanel>
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              required
            />
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!value.trim() || pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
