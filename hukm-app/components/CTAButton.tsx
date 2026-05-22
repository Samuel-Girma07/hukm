"use client";

import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Icon } from "./Icon";

type CTAVariant = "primary" | "secondary" | "ghost";

interface SharedProps {
  children: ReactNode;
  variant?: CTAVariant;
  /** Trailing icon rendered to the right of the label. */
  trailingIcon?: string;
  /** Leading icon rendered to the left of the label. */
  leadingIcon?: string;
  /** Trailing icon size in px (defaults to 14). */
  trailingIconSize?: number;
  /** Optional extra utility classes. */
  className?: string;
}

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    href?: never;
    type?: "button" | "submit" | "reset";
  };

type LinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

type Props = ButtonProps | LinkProps;

const variantClass: Record<CTAVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

/**
 * Perplexity-style CTA button. Renders an `<a>` (via Next `<Link>`) when
 * `href` is set, otherwise a `<button>`.
 *
 * Trailing icons sit inline with the label (no nested "button-in-button"
 * circle) — clean and quiet.
 */
export const CTAButton = forwardRef<HTMLElement, Props>(function CTAButton(
  props,
  ref,
) {
  const {
    children,
    variant = "primary",
    trailingIcon,
    leadingIcon,
    trailingIconSize = 14,
    className = "",
    ...rest
  } = props;

  const inner = (
    <>
      {leadingIcon ? (
        <Icon name={leadingIcon} size={trailingIconSize} className="-ml-0.5 shrink-0" />
      ) : null}
      <span className="truncate">{children}</span>
      {trailingIcon ? (
        <Icon name={trailingIcon} size={trailingIconSize} className="-mr-0.5 shrink-0" />
      ) : null}
    </>
  );

  const classes = `${variantClass[variant]} ${className}`.trim();

  if ("href" in props && typeof props.href === "string") {
    const linkProps = rest as Omit<LinkProps, keyof SharedProps | "href">;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={props.href}
        className={classes}
        {...linkProps}
      >
        {inner}
      </Link>
    );
  }

  const buttonProps = rest as Omit<ButtonProps, keyof SharedProps | "type">;
  const buttonType = (props as ButtonProps).type ?? "button";
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={buttonType}
      className={classes}
      {...buttonProps}
    >
      {inner}
    </button>
  );
});
