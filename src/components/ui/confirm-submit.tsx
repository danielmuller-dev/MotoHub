"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  label = "Confirmar",
  message,
  variant = "danger"
}: {
  label?: string;
  message: string;
  variant?: "danger" | "secondary";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
