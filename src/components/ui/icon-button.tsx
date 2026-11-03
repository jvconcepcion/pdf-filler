import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Icons, type IconName } from "@/components/icons";

type ButtonProps = ComponentProps<typeof Button>;

/*
  Icon-only button. `aria-label` is required: it is Omit-ed from the inherited
  button props and re-declared as mandatory, so an IconButton cannot be created
  without an accessible label. The glyph itself is aria-hidden. Size and color
  come from the Button variants/tokens; iconClassName tunes the glyph.
*/
export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  icon: IconName;
  "aria-label": string;
  iconClassName?: string;
}

export function IconButton({ icon, iconClassName, size = "icon", ...props }: IconButtonProps) {
  const Icon = Icons[icon];
  return (
    <Button size={size} {...props}>
      <Icon className={iconClassName} aria-hidden />
    </Button>
  );
}
