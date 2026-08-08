import { useState } from "react";
import { Modal, Field, StatusBadge, Dot } from "./ui";
import type { Identity } from "../lib/types";
import { generatePassword, passwordEntropyBits } from "../lib/generators";

interface Props {
  identity: Identity;
  onClose: () => void;
  onStatus: (status: Identity["status"]) => void;
  onUpdate: (patch: Partial<Identity>) => void;
  onRemove: () => void;
}

export function IdentityDetail({ identity, onClose, onStatus, onUpdate, onRemove }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const secret = identity.secret;

  function rotatePassword() {
    const password = generatePassword();
    onUpdate({ secret: { ...(secret ?? { username: identity.emailAlias, password }), password } });
  }

  return (
    <Modal
      title={identity.label}
      onClose={onClose}
      wide
    >
      <div className="detail-head">
        <Dot color={identity.color} />
        <StatusBadge status={identity.status} />
        <span className="detail-created">
          created {new Date(identity.createdAt).toLocaleDateString()}
        </span>
      </div>

      <section className="detail-section">
        <h3>Masked contact</h3>
        <Field label="Email alias" value={identity.emailAlias} mono copy />
        {identity.phoneAlias && <Field label="Phone alias" value={identity.phoneAlias} mono copy />}
      </section>

      {secret && (
        <section className="detail-section">
          <h3>Credentials</h3>
          <Field label="Username" value={secret.username} mono copy />
          <div className="field">
            <span className="field-label">Password</span>
            <span className="field-value mono">
              {showPassword ? secret.password : "•".repeat(Math.min(20, secret.password.length))}
              <button className="copy-btn" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "hide" : "show"}
              </button>
              <button className="copy-btn" onClick={rotatePassword}>rotate</button>
            </span>
          </div>
          <p className="hint">~{passwordEntropyBits(secret.password)} bits of entropy</p>
        </section>
      )}

      <section className="detail-section">
        <h3>Persona</h3>
        <Field label="Name" value={`${identity.persona.firstName} ${identity.persona.lastName}`} copy />
        <Field label="Date of birth" value={identity.persona.dateOfBirth} copy />
        <Field
          label="Address"
          value={`${identity.persona.street}, ${identity.persona.city}, ${identity.persona.state} ${identity.persona.zip}`}
          copy
        />
      </section>

      {identity.card && (
        <section className="detail-section">
          <h3>Masked card <span className="tag-test">test token</span></h3>
          <Field label="Number" value={identity.card.number} mono copy />
          <Field
            label="Expires"
            value={`${String(identity.card.expMonth).padStart(2, "0")}/${identity.card.expYear}`}
            mono
          />
          <Field label="CVC" value={identity.card.cvc} mono copy />
          <p className="hint">Non-functional test number. Cannot be charged.</p>
        </section>
      )}

      <div className="modal-actions">
        {identity.status === "active" ? (
          <button className="btn" onClick={() => onStatus("paused")}>Pause</button>
        ) : identity.status === "paused" ? (
          <button className="btn" onClick={() => onStatus("active")}>Resume</button>
        ) : null}
        {identity.status !== "revoked" && (
          <button className="btn btn-warn" onClick={() => onStatus("revoked")}>Revoke</button>
        )}
        <div className="spacer" />
        {confirmRemove ? (
          <button className="btn btn-danger" onClick={onRemove}>Confirm delete</button>
        ) : (
          <button className="btn btn-danger-ghost" onClick={() => setConfirmRemove(true)}>
            Delete
          </button>
        )}
      </div>
    </Modal>
  );
}
