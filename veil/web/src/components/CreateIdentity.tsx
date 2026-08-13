import { useMemo, useState } from "react";
import { Modal, Field } from "./ui";
import {
  generateEmailAlias,
  generatePassword,
  generatePersona,
  generatePhoneAlias,
  pickColor,
  randomId,
} from "../lib/generators";
import { getProvider } from "../providers";
import type { Identity, Persona, Settings } from "../lib/types";

interface Props {
  count: number;
  settings: Settings;
  onClose: () => void;
  onCreate: (identity: Identity) => Promise<void>;
}

export function CreateIdentity({ count, settings, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("");
  const [persona, setPersona] = useState<Persona>(() => generatePersona());
  const [emailAlias, setEmailAlias] = useState(() => generateEmailAlias("mask"));
  const [phoneAlias, setPhoneAlias] = useState(() => generatePhoneAlias());
  const [withPhone, setWithPhone] = useState(true);
  const [withCard, setWithCard] = useState(false);
  const [password] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getProvider();
  const color = useMemo(() => pickColor(count), [count]);

  function regenerate() {
    setPersona(generatePersona());
    setEmailAlias(generateEmailAlias(label || "mask"));
    setPhoneAlias(generatePhoneAlias());
  }

  async function create() {
    setError(null);
    const trimmed = label.trim();
    if (!trimmed) return setError("Give the identity a label (the service name).");
    setBusy(true);
    try {
      const email = generateEmailAlias(trimmed);
      await provider.email.provisionAlias(email, settings.forwardEmail || "(unset)");
      let phone = "";
      if (withPhone) {
        phone = phoneAlias;
        await provider.phone.provisionNumber(phone, settings.forwardPhone || "(unset)");
      }
      const card = withCard ? await provider.card.issueCard() : undefined;

      const identity: Identity = {
        id: randomId(),
        label: trimmed,
        createdAt: new Date().toISOString(),
        status: "active",
        emailAlias: email,
        phoneAlias: phone,
        persona,
        secret: { username: email, password },
        card,
        color,
      };
      await onCreate(identity);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create identity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New masked identity" onClose={onClose} wide>
      <label className="input-label">Service / label</label>
      <input
        className="input"
        autoFocus
        placeholder="e.g. Reddit, Newsletter, Landlord…"
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setEmailAlias(generateEmailAlias(e.target.value || "mask"));
        }}
      />

      <div className="preview-grid">
        <Field label="Email alias" value={emailAlias} mono copy />
        {withPhone && <Field label="Phone alias" value={phoneAlias} mono copy />}
        <Field label="Generated password" value={password} mono copy />
        <Field
          label="Persona"
          value={`${persona.firstName} ${persona.lastName} · ${persona.dateOfBirth}`}
        />
        <Field label="Address" value={`${persona.street}, ${persona.city}, ${persona.state} ${persona.zip}`} />
        {withCard && <Field label="Card" value="issued on create (test token)" />}
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={withPhone} onChange={(e) => setWithPhone(e.target.checked)} />
          Include masked phone number
        </label>
        <label className="toggle">
          <input type="checkbox" checked={withCard} onChange={(e) => setWithCard(e.target.checked)} />
          Issue masked card (test token)
        </label>
      </div>

      {!provider.live && (
        <p className="hint">
          Running with the local mock provider — aliases are generated and stored
          but not routed. Configure a provider in Settings to enable real forwarding.
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div className="modal-actions">
        <button className="btn" type="button" onClick={regenerate} disabled={busy}>
          ↻ Regenerate
        </button>
        <div className="spacer" />
        <button className="btn" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create identity"}
        </button>
      </div>
    </Modal>
  );
}
