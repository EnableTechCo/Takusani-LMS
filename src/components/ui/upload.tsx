"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * Upload rows (design system 4.4). Every state is written in words in the row's status; the border, the colour and
 * the bar only support it. The wording is fixed by the design system, so it is kept here rather than at each call
 * site: a pause is never called a failure, and a rejection says what to do instead.
 *
 * Announcements (audit finding A11Y-11): a row that becomes "Not accepted" or "Expired" is something the learner
 * must act on, so those rows are announced at once; progress is announced politely from one status line, not from
 * every row.
 */

export type UploadState =
  "waiting" | "uploading" | "paused" | "resuming" | "checking" | "uploaded" | "rejected" | "expired";

export interface UploadRowProps {
  state: UploadState;
  /** The file's own name, as the learner chose it. */
  name: string;
  /** The state in words, for example "Uploading 42% · 5.0 of 12.0 MB". */
  status: ReactNode;
  /** 0 to 100 while uploading; leave out for an indeterminate bar or no bar. */
  percent?: number;
  /** True while the file is being checked, when the bar has no value to show. */
  indeterminate?: boolean;
  actions?: ReactNode;
}

const NEEDS_ATTENTION: UploadState[] = ["rejected", "expired"];

export function UploadRow({ state, name, status, percent, indeterminate, actions }: UploadRowProps) {
  const urgent = NEEDS_ATTENTION.includes(state);
  const barLabel = `${name}, ${typeof status === "string" ? status : state}`;
  return (
    <li className={cx("upload-row", `upload-row--${state}`)} role={urgent ? "alert" : undefined}>
      <Icon className="icon upload-row__icon" name="file" />
      <span className="upload-row__name">{name}</span>
      <span className="upload-row__status">
        {state === "resuming" ? <span aria-hidden="true" className="spinner" /> : null} {status}
      </span>
      {actions ? <span className="upload-row__actions">{actions}</span> : null}
      {indeterminate ? (
        <div aria-label={barLabel} className="progress progress--indeterminate" role="progressbar">
          <div className="progress__bar" />
        </div>
      ) : percent === undefined ? null : (
        <div
          aria-label={barLabel}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(percent)}
          className={cx("progress", state === "paused" && "progress--caution")}
          role="progressbar"
        >
          <div className="progress__bar" style={{ ["--value" as string]: `${Math.round(percent)}%` }} />
        </div>
      )}
    </li>
  );
}

/**
 * One drop zone: a real file input behind a button, so it works by keyboard and without drag and drop. The title
 * names what this slot is for and labels the input, so a screen reader hears "Add evidence for requirement 2",
 * not a second "Choose files" (A11Y-11).
 */
export function UploadDrop({
  id,
  title,
  help,
  accept,
  multiple,
  disabled,
  buttonLabel = "Choose files",
  onFiles,
  children,
}: {
  id: string;
  title: string;
  help: ReactNode;
  /** Accepted media types, for the file chooser. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  onFiles?: (files: FileList) => void;
  /** The rows for this slot. */
  children?: ReactNode;
}) {
  return (
    <div className="upload">
      <div className={cx("upload__drop", disabled && "is-disabled")}>
        <Icon className="icon icon--xl" name="upload" />
        <p className="upload__title" id={`${id}-title`}>
          {title}
        </p>
        <p id={`${id}-help`}>{help}</p>
        <input
          accept={accept}
          aria-describedby={`${id}-help`}
          aria-labelledby={`${id}-title`}
          className="upload__input"
          disabled={disabled}
          id={id}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files?.length) onFiles?.(event.target.files);
            event.target.value = "";
          }}
          type="file"
        />
        <label className="btn btn--secondary" htmlFor={id}>
          {buttonLabel}
        </label>
      </div>
      {children ? (
        <ul aria-label={`Files for ${title}`} className="upload__list">
          {children}
        </ul>
      ) : null}
    </div>
  );
}
