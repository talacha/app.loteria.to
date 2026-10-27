import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

interface Common {
  variant?: ButtonVariant;
  /** Leading icon (decorative). */
  icon?: ReactNode;
  /** Full width is the phone default for primary; set false to size to content. */
  fit?: boolean;
  children: ReactNode;
}

type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    loading?: boolean;
    to?: undefined;
    href?: undefined;
  };
type LinkProps = Common & {
  to: string;
  className?: string;
  'aria-label'?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  href?: undefined;
};
type AnchorProps = Common & { href: string; download?: string; className?: string; to?: undefined };

/** Button, or a router link styled as one when `to` is given. */
export default function Button(props: ButtonProps | LinkProps | AnchorProps) {
  const { variant = 'primary', icon, fit, children } = props;
  const cls = [
    variant === 'link' ? styles.link : `${styles.btn} ${styles[variant]}`,
    fit ? styles.small : '',
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </>
  );
  if (props.href !== undefined) {
    return (
      <a href={props.href} download={props.download} className={cls}>
        {inner}
      </a>
    );
  }
  if (props.to !== undefined) {
    return (
      <Link
        to={props.to}
        className={cls}
        aria-label={props['aria-label']}
        onClick={props.onClick}
      >
        {inner}
      </Link>
    );
  }
  const { loading, type = 'button', disabled, ...rest } = props as ButtonProps;
  delete (rest as { variant?: unknown }).variant;
  delete (rest as { icon?: unknown }).icon;
  delete (rest as { fit?: unknown }).fit;
  delete (rest as { children?: unknown }).children;
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {inner}
    </button>
  );
}
